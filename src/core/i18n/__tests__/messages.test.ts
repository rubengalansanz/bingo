import { RANGE_PRESETS } from '../../engine/range';
import { ANIMATION_SPEEDS, REDUCE_MOTION_PREFERENCES } from '../../settings/settings';
import { THEME_IDS } from '../../theme/tokens';
import {
  BANNER_CODES,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  MESSAGES,
  isLanguage,
  messagesFor,
  type Messages,
} from '../messages';

/**
 * UI catalog (plan §4.7, §7.5).
 *
 * The type already forces both languages to share a shape; these tests cover
 * what a type cannot: an empty translation, a forgotten enum key, and the
 * formatting helpers of every language (which is also what keeps the 100 %
 * function coverage of `src/core` honest).
 */

/** Every string leaf, in a stable order, so an empty one can be spotted. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(strings);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

/** Keys plus the kind of value, to compare two catalogs without their text. */
function shape(value: unknown): Record<string, string> {
  if (typeof value === 'string') {
    return { '': 'string' };
  }
  if (typeof value === 'function') {
    return { '': 'function' };
  }
  if (Array.isArray(value)) {
    return { '': `array:${value.length}` };
  }
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    for (const [suffix, kind] of Object.entries(shape(child))) {
      out[`${key}${suffix === '' ? '' : `.${suffix}`}`] = kind;
    }
  }
  return out;
}

/** Calls every formatting helper so no catalog function is left unexecuted. */
function formatAll(m: Messages): string[] {
  return [
    m.draw.previous('B-12'),
    m.draw.lastBall('B-12'),
    m.draw.counter(1, 90),
    m.draw.counterLabel(1, 90),
    m.draw.complete(90, 90),
    m.draw.undoToast('B-12'),
    m.draw.announce('B-12', 89),
    m.board.compactCounter(1, 90),
    m.board.counter(1, 89),
    m.board.counterLabel(1, 89),
    m.board.cellDrawn(4),
    m.board.cellLabel('B, 12', m.board.cellPending),
    m.history.counter(1),
    m.history.counter(5),
    m.history.undoLabel('B-12'),
    m.history.rowLabel(1, 'B-12', '09:05'),
    m.settings.version('1.0.0'),
    m.settings.rowLabel('Tema', ''),
    m.settings.rowLabel('Tema', 'Clásico'),
    m.settings.switchLabel('Sonido', true),
    m.settings.switchLabel('Sonido', false),
    m.settings.extractionsLost(0),
    m.settings.extractionsLost(1),
    m.settings.extractionsLost(5),
    m.settings.restartMessage(1),
    m.settings.rangeMessage(90, 75, 3),
    m.range.total(90),
    m.range.presetDetail(1, 90, 90),
  ];
}

describe('catalog (§4.7)', () => {
  it('ships Spanish and English, with Spanish as the fallback', () => {
    expect(LANGUAGES).toEqual(['es', 'en']);
    expect(DEFAULT_LANGUAGE).toBe('es');
    expect(messagesFor('es')).toBe(MESSAGES.es);
    expect(messagesFor('en')).toBe(MESSAGES.en);
  });

  it('has exactly the same keys and value kinds in both languages', () => {
    expect(shape(MESSAGES.en)).toEqual(shape(MESSAGES.es));
  });

  it('has no empty translation', () => {
    const empty = [...strings(MESSAGES.es), ...strings(MESSAGES.en)].filter(
      (text) => text.trim() === '',
    );
    expect(empty).toEqual([]);
  });

  it('formats every message in both languages', () => {
    for (const language of LANGUAGES) {
      const texts = formatAll(MESSAGES[language]);
      expect(texts).toHaveLength(28);
      expect(texts.every((text) => text.trim() !== '')).toBe(true);
    }
  });

  it('translates every theme, preset, speed, motion mode and banner code', () => {
    for (const language of LANGUAGES) {
      const m = MESSAGES[language];
      for (const id of THEME_IDS) {
        expect(m.settings.themes[id].label).toBeTruthy();
        expect(m.settings.themes[id].detail).toBeTruthy();
      }
      for (const preset of RANGE_PRESETS) {
        expect(m.range.presets[preset]).toBeTruthy();
      }
      for (const speed of ANIMATION_SPEEDS) {
        expect(m.settings.speeds[speed].label).toBeTruthy();
        expect(m.settings.speeds[speed].detail).toBeTruthy();
      }
      for (const motion of REDUCE_MOTION_PREFERENCES) {
        expect(m.settings.motions[motion].label).toBeTruthy();
      }
      for (const code of BANNER_CODES) {
        expect(m.banners[code]).toBeTruthy();
      }
      expect(m.privacy.points).toHaveLength(5);
    }
  });
});

describe('isLanguage (§4.7)', () => {
  it('accepts a supported language and rejects anything else', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(42)).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
