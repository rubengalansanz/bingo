import { DEFAULT_RANGE, PRESETS } from '../../engine/range';
import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  numberScale,
  parseSettings,
  serializeSettings,
} from '../settings';

/**
 * Preference parsing (plan §4.7): a corrupt blob never blocks the start, and
 * every invalid field falls back **alone** — losing the theme must not reset
 * the range draft.
 */

describe('defaults (§4.3)', () => {
  it('starts on European 90, classic, auto and normal size', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('settings.v1');
    expect(DEFAULT_SETTINGS).toMatchObject({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      themeId: 'classic',
      appearance: 'auto',
      numberSize: 'normal',
      labelMode: 'letter-number',
      sound: true,
      haptics: true,
      animationSpeed: 1,
      reduceMotion: 'auto',
      keepAwake: true,
      language: 'es',
    });
    expect(DEFAULT_SETTINGS.rangeDraft).toEqual({
      ...DEFAULT_RANGE,
      labelMode: 'letter-number',
    });
  });

  it('maps number sizes to font multipliers', () => {
    expect(numberScale('normal')).toBe(1);
    expect(numberScale('large')).toBe(1.25);
    expect(numberScale('xlarge')).toBe(1.5);
  });
});

describe('parseSettings (§4.7)', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the defaults for corrupt or non-object JSON', () => {
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1,2,3]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"hello"')).toEqual(DEFAULT_SETTINGS);
  });

  it('reads a valid stored object', () => {
    const stored = {
      schemaVersion: 1,
      themeId: 'neon',
      appearance: 'dark',
      numberSize: 'xlarge',
      labelMode: 'number',
      rangeDraft: { preset: 'custom', min: 1, max: 64, labelMode: 'number' },
      sound: false,
      haptics: false,
      animationSpeed: 1.5,
      reduceMotion: 'on',
      keepAwake: false,
      language: 'en',
    };

    expect(parseSettings(JSON.stringify(stored))).toEqual(stored);
  });

  it('reads the language and falls back to Spanish on an unknown one (§7.5)', () => {
    expect(parseSettings(JSON.stringify({ language: 'en' })).language).toBe('en');
    expect(parseSettings(JSON.stringify({ language: 'fr' })).language).toBe('es');
    expect(parseSettings(JSON.stringify({ language: 7 })).language).toBe('es');
  });

  it('reads the Phase 4 feedback preferences field by field (§4.4, §7.5)', () => {
    const parsed = parseSettings(
      JSON.stringify({
        sound: 'yes',
        haptics: false,
        animationSpeed: 1.25,
        reduceMotion: 'sometimes',
        keepAwake: 1,
      }),
    );

    expect(parsed.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(parsed.haptics).toBe(false);
    expect(parsed.animationSpeed).toBe(DEFAULT_SETTINGS.animationSpeed);
    expect(parsed.reduceMotion).toBe(DEFAULT_SETTINGS.reduceMotion);
    expect(parsed.keepAwake).toBe(DEFAULT_SETTINGS.keepAwake);
  });

  it('accepts every speed multiplier the picker offers', () => {
    for (const animationSpeed of [0.5, 1, 1.5]) {
      expect(parseSettings(JSON.stringify({ animationSpeed })).animationSpeed).toBe(animationSpeed);
    }
  });

  it('falls back field by field, keeping the valid ones', () => {
    const parsed = parseSettings(
      JSON.stringify({
        themeId: 'neon',
        appearance: 'sepia',
        numberSize: 42,
        labelMode: 'letters',
        rangeDraft: 'not a range',
      }),
    );

    expect(parsed.themeId).toBe('neon');
    expect(parsed.appearance).toBe(DEFAULT_SETTINGS.appearance);
    expect(parsed.numberSize).toBe(DEFAULT_SETTINGS.numberSize);
    expect(parsed.labelMode).toBe(DEFAULT_SETTINGS.labelMode);
    expect(parsed.rangeDraft).toEqual(DEFAULT_SETTINGS.rangeDraft);
  });

  it('keeps a valid preset only when its bounds match (§3.1)', () => {
    const matching = parseSettings(
      JSON.stringify({
        rangeDraft: { ...PRESETS.us75, labelMode: 'letter-number' },
      }),
    );
    expect(matching.rangeDraft).toEqual(PRESETS.us75);

    const tampered = parseSettings(
      JSON.stringify({
        rangeDraft: { preset: 'eu90', min: 1, max: 5, labelMode: 'number' },
      }),
    );
    expect(tampered.rangeDraft).toEqual({
      preset: 'custom',
      min: 1,
      max: 5,
      labelMode: 'letter-number',
    });
  });

  it('falls back to the default bound when a stored bound is not an integer', () => {
    const parsed = parseSettings(
      JSON.stringify({
        labelMode: 'number',
        rangeDraft: { preset: 'custom', min: 1.5, max: 10, labelMode: 'number' },
      }),
    );

    // 1.5 is discarded, the default min (1) keeps the draft valid.
    expect(parsed.rangeDraft).toEqual({
      preset: 'custom',
      min: 1,
      max: 10,
      labelMode: 'number',
    });
  });

  it('uses the custom preset for a free valid range', () => {
    const parsed = parseSettings(
      JSON.stringify({
        labelMode: 'number',
        rangeDraft: { preset: 'custom', min: 10, max: 19, labelMode: 'number' },
      }),
    );

    expect(parsed.rangeDraft).toEqual({
      preset: 'custom',
      min: 10,
      max: 19,
      labelMode: 'number',
    });
  });

  it('rejects an out-of-range draft and falls back to the default range', () => {
    for (const rangeDraft of [
      { preset: 'custom', min: 5, max: 5, labelMode: 'number' },
      { preset: 'custom', min: 0, max: 10, labelMode: 'number' },
      { preset: 'custom', min: 1, max: 201, labelMode: 'number' },
      { preset: 'custom', min: 300, max: 400, labelMode: 'number' },
    ]) {
      const parsed = parseSettings(JSON.stringify({ labelMode: 'number', rangeDraft }));
      expect(parsed.rangeDraft).toEqual({ ...DEFAULT_RANGE, labelMode: 'number' });
    }
  });

  it('round-trips through serialization', () => {
    expect(parseSettings(serializeSettings(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS);
  });
});
