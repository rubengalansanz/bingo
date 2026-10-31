import {
  DEFAULT_RANGE,
  PRESETS,
  RANGE_PRESETS,
  customRange,
  rangeForPreset,
  validateRange,
} from '../engine/range';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../i18n/messages';
import type { LabelMode, RangeConfig } from '../engine/types';
import { DEFAULT_THEME_ID, THEME_IDS, type Appearance, type ThemeId } from '../theme/tokens';

/**
 * User preferences (plan §3.3, §4.3, §4.7, §5.4).
 *
 * Preferences are not part of the game: they live in key-value storage and a
 * corrupt value **never** blocks the start. Each field falls back to its own
 * default, so losing one preference does not reset the others (§4.7).
 *
 * The parser is hand-written instead of Zod — the spec named Zod, but six
 * fields with per-field defaults do not justify a runtime schema dependency in
 * the bundle. The contract is the same: invalid field ⇒ that field's default.
 *
 * This file is pure (no MMKV, no React): the adapter lives in
 * `src/shared/kv`, and the store receives the port by injection (§5.2).
 */

export type NumberSize = 'normal' | 'large' | 'xlarge';

/** Multipliers of the base animation time (§4.4): lower is faster. */
export const ANIMATION_SPEEDS = [0.5, 1, 1.5] as const;

export type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number];

/** `auto` follows the system accessibility setting (§4.4). */
export const REDUCE_MOTION_PREFERENCES = ['auto', 'on', 'off'] as const;

export type ReduceMotionPreference = (typeof REDUCE_MOTION_PREFERENCES)[number];

export type Settings = {
  readonly schemaVersion: 1;
  readonly themeId: ThemeId;
  readonly appearance: Appearance;
  readonly numberSize: NumberSize;
  /** Display preference for 75-ball games: `B-12` vs `12` (§3.4). */
  readonly labelMode: LabelMode;
  /** The range materialised by the **next** game and shown in Ajustes (§3.3). */
  readonly rangeDraft: RangeConfig;
  /** Ball sound on every draw (§4.4). */
  readonly sound: boolean;
  /** Impact/success haptics (§4.4). */
  readonly haptics: boolean;
  /** Multiplier applied to the theme's base animation time (§4.4). */
  readonly animationSpeed: AnimationSpeed;
  readonly reduceMotion: ReduceMotionPreference;
  /** Keep the screen on while Sorteo is focused and the game is running (§7.9). */
  readonly keepAwake: boolean;
  /** UI language (§7.5). Presentation only: it never touches the game. */
  readonly language: Language;
};

/** Versioned key in key-value storage (§4.7). */
export const SETTINGS_STORAGE_KEY = 'settings.v1';

export const SETTINGS_SCHEMA_VERSION = 1;

/**
 * The 75 preset is defined with letters (§3.1); the other presets ignore it,
 * so this default is what makes the US75 board print B-12 out of the box.
 */
const DEFAULT_LABEL_MODE: LabelMode = 'letter-number';

/**
 * Defaults: European 90, classic theme, system colour mode, normal size, sound
 * and haptics on, 1× animation, system reduce-motion, screen kept on, Spanish.
 * Sound and haptics default to on because a caller expects feedback by tap.
 */
export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  themeId: DEFAULT_THEME_ID,
  appearance: 'auto',
  numberSize: 'normal',
  labelMode: DEFAULT_LABEL_MODE,
  rangeDraft: { ...DEFAULT_RANGE, labelMode: DEFAULT_LABEL_MODE },
  sound: true,
  haptics: true,
  animationSpeed: 1,
  reduceMotion: 'auto',
  keepAwake: true,
  language: DEFAULT_LANGUAGE,
};

/** `normal` / `grande` / `extra`, as multipliers of the display type (§4.3). */
const NUMBER_SCALES: Record<NumberSize, number> = {
  normal: 1,
  large: 1.25,
  xlarge: 1.5,
};

/** Font multiplier of the number-size preference (§4.3). */
export function numberScale(size: NumberSize): number {
  return NUMBER_SCALES[size];
}

/** Raw key-value port: MMKV on the device, a Map in tests (§5.2). */
export type KeyValueStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
};

/**
 * Reads persisted preferences. Never throws and never returns a partial object:
 * an unreadable blob, a missing field or an out-of-range draft is replaced by
 * the default of that field alone (§4.7, §7.7).
 */
export function parseSettings(raw: string | null): Settings {
  const stored = readObject(raw);

  const themeId = pick(stored.themeId, THEME_IDS, DEFAULT_SETTINGS.themeId);
  const appearance = pick(
    stored.appearance,
    ['light', 'dark', 'auto'] as const,
    DEFAULT_SETTINGS.appearance,
  );
  const numberSize = pick(
    stored.numberSize,
    ['normal', 'large', 'xlarge'] as const,
    DEFAULT_SETTINGS.numberSize,
  );
  const labelMode = pick(
    stored.labelMode,
    ['number', 'letter-number'] as const,
    DEFAULT_SETTINGS.labelMode,
  );
  const rangeDraft = parseRangeDraft(stored.rangeDraft, labelMode);
  const sound = readBoolean(stored.sound, DEFAULT_SETTINGS.sound);
  const haptics = readBoolean(stored.haptics, DEFAULT_SETTINGS.haptics);
  const animationSpeed = pickNumber(
    stored.animationSpeed,
    ANIMATION_SPEEDS,
    DEFAULT_SETTINGS.animationSpeed,
  );
  const reduceMotion = pick(
    stored.reduceMotion,
    REDUCE_MOTION_PREFERENCES,
    DEFAULT_SETTINGS.reduceMotion,
  );
  const keepAwake = readBoolean(stored.keepAwake, DEFAULT_SETTINGS.keepAwake);
  const language = pick(stored.language, LANGUAGES, DEFAULT_SETTINGS.language);

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    themeId,
    appearance,
    numberSize,
    labelMode,
    rangeDraft,
    sound,
    haptics,
    animationSpeed,
    reduceMotion,
    keepAwake,
    language,
  };
}

/** JSON form written to storage. */
export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings);
}

/** `null` when the blob is not a JSON object, so every field falls back. */
function readObject(raw: string | null): Record<string, unknown> {
  if (raw === null) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    // A corrupt settings blob is not an error: defaults are the recovery (§4.7).
    return {};
  }
}

/**
 * A stored range is accepted only if it validates. A fixed preset whose bounds
 * were tampered with degrades to `custom` instead of lying in the Ajustes row.
 */
function parseRangeDraft(value: unknown, labelMode: LabelMode): RangeConfig {
  if (!isRecord(value)) {
    return { ...DEFAULT_RANGE, labelMode };
  }

  const min = readInteger(value.min, DEFAULT_RANGE.min);
  const max = readInteger(value.max, DEFAULT_RANGE.max);
  if (!validateRange(min, max).ok) {
    return { ...DEFAULT_RANGE, labelMode };
  }

  const preset = pick(value.preset, RANGE_PRESETS, 'custom');
  if (preset !== 'custom' && (PRESETS[preset].min !== min || PRESETS[preset].max !== max)) {
    return customRange(min, max, labelMode);
  }
  return preset === 'custom' ? customRange(min, max, labelMode) : rangeForPreset(preset, labelMode);
}

/** One of `allowed`, or `fallback` — the per-field default (§4.7). */
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** A boolean from storage, or the fallback when the value is anything else. */
function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** An integer from storage, or the fallback when the value is anything else. */
function readInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}

/** One of `allowed` numbers, or `fallback` — the numeric twin of `pick`. */
function pickNumber<T extends number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'number' && (allowed as readonly number[]).includes(value)
    ? (value as T)
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
