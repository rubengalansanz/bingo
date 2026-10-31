import { type Result, err, ok } from '../result';

import type { LabelMode, RangeConfig, RangePreset } from './types';

/**
 * Number range: presets, validation and labelling (plan §3).
 *
 * Every rule that decides whether a range is legal lives here, and so does the
 * exact text of a number's label, so ball, board and history can never disagree
 * (§3.1, §3.4). User-facing copy does NOT live here: failures are typed codes
 * the UI maps to Spanish messages (§3.2).
 */

/** Inclusive lower bound of any range (§3.2). */
export const RANGE_MIN_VALUE = 1;

/** Inclusive upper bound in v1 — a domain constant, not a UI number (§3.2, ADR-08). */
export const RANGE_MAX_TOTAL = 200;

/** Why a range can be rejected. */
export type RangeError =
  'NOT_INTEGER' | 'MIN_AT_LEAST_ONE' | 'MIN_NOT_LESS_THAN_MAX' | 'MAX_EXCEEDED';

/** The three fixed presets; `custom` is built by the settings form (§3.1). */
export const PRESETS = {
  eu90: { preset: 'eu90', min: 1, max: 90, labelMode: 'number' },
  us75: { preset: 'us75', min: 1, max: 75, labelMode: 'letter-number' },
  n80: { preset: 'n80', min: 1, max: 80, labelMode: 'number' },
} as const satisfies Record<Exclude<RangePreset, 'custom'>, RangeConfig>;

/**
 * Range used until Settings can supply one (§7.7, first launch): the European
 * 1-90 game, which is the product's default.
 */
export const DEFAULT_RANGE: RangeConfig = PRESETS.eu90;

/** `min < max` and both integral, inside the v1 bounds (§3.2). Returns the total. */
export function validateRange(min: number, max: number): Result<number, RangeError> {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return err('NOT_INTEGER');
  }
  if (min < RANGE_MIN_VALUE) {
    return err('MIN_AT_LEAST_ONE');
  }
  if (min >= max) {
    return err('MIN_NOT_LESS_THAN_MAX');
  }
  if (max > RANGE_MAX_TOTAL) {
    return err('MAX_EXCEEDED');
  }
  return ok(max - min + 1);
}

/**
 * A range shorter than this is legal but warned about (§3.2): the game ends in
 * fewer than ten draws. Warning only — it never blocks the form.
 */
export const RANGE_WARNING_TOTAL = 10;

/** Every preset id, in picker order; `custom` is the free form (§3.1). */
export const RANGE_PRESETS = ['eu90', 'us75', 'n80', 'custom'] as const;

/** The fixed range of a preset, with the label preference applied (§3.1, §3.4). */
export function rangeForPreset(
  preset: Exclude<RangePreset, 'custom'>,
  labelMode: LabelMode,
): RangeConfig {
  return { ...PRESETS[preset], labelMode };
}

/** A free range between two bounds; validity is still `validateRange`'s job. */
export function customRange(min: number, max: number, labelMode: LabelMode): RangeConfig {
  return { preset: 'custom', min, max, labelMode };
}

/** How many balls the range holds: `max - min + 1` (§3.2, "Serán 64 bolas"). */
export function rangeTotal(cfg: Pick<RangeConfig, 'min' | 'max'>): number {
  return cfg.max - cfg.min + 1;
}

/** The whole ordered universe of a range, `[min..max]`. */
export function rangeNumbers(cfg: Pick<RangeConfig, 'min' | 'max'>): number[] {
  const numbers: number[] = [];
  for (let n = cfg.min; n <= cfg.max; n++) {
    numbers.push(n);
  }
  return numbers;
}

/** `1–90`, for headers and dialogs (§7.2). */
export function formatRangeSpan(cfg: Pick<RangeConfig, 'min' | 'max'>): string {
  return `${cfg.min}–${cfg.max}`;
}

/** B-I-N-G-O columns of the US 1-75 board (§3.1). */
const US75_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const US75_PER_LETTER = 15;

/**
 * Label of a number inside a range (§3.1, §3.4): `42`, or `B-12` on the US75
 * board when `labelMode` asks for letters. Domain-owned so every surface prints
 * the same string; screen-reader phrasing ("B, doce") is a UI concern (§3.4).
 */
export function formatLabel(n: number, cfg: RangeConfig): string {
  const letter = us75Letter(n, cfg);
  return letter === null ? String(n) : `${letter}-${n}`;
}

/** Returns the column letter only where it exists: `labelMode` + preset 75 (§3.4). */
function us75Letter(n: number, cfg: RangeConfig): string | null {
  if (cfg.labelMode !== 'letter-number' || cfg.preset !== 'us75') {
    return null;
  }
  if (n < 1 || n > US75_PER_LETTER * US75_LETTERS.length) {
    return null;
  }
  // Bounded above by 75, so the index is always a valid column.
  return US75_LETTERS[Math.ceil(n / US75_PER_LETTER) - 1]!;
}
