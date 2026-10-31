import {
  DEFAULT_RANGE,
  PRESETS,
  RANGE_MAX_TOTAL,
  RANGE_PRESETS,
  RANGE_WARNING_TOTAL,
  customRange,
  formatLabel,
  formatRangeSpan,
  rangeForPreset,
  rangeNumbers,
  rangeTotal,
  validateRange,
} from '../range';

const US75_PLAIN = { ...PRESETS.us75, labelMode: 'number' } as const;
const EU90_LETTERS = { ...PRESETS.eu90, labelMode: 'letter-number' } as const;

describe('presets (§3.1)', () => {
  it('defines the three fixed boards', () => {
    expect(PRESETS.eu90).toEqual({
      preset: 'eu90',
      min: 1,
      max: 90,
      labelMode: 'number',
    });
    expect(PRESETS.us75).toEqual({
      preset: 'us75',
      min: 1,
      max: 75,
      labelMode: 'letter-number',
    });
    expect(PRESETS.n80).toEqual({
      preset: 'n80',
      min: 1,
      max: 80,
      labelMode: 'number',
    });
  });

  it('defaults the first launch to the European 1–90 game (§7.7)', () => {
    expect(DEFAULT_RANGE).toBe(PRESETS.eu90);
  });

  it('builds a preset with the chosen label mode (§3.4)', () => {
    expect(rangeForPreset('us75', 'number')).toEqual({
      preset: 'us75',
      min: 1,
      max: 75,
      labelMode: 'number',
    });
    expect(rangeForPreset('eu90', 'letter-number')).toEqual({
      ...PRESETS.eu90,
      labelMode: 'letter-number',
    });
  });

  it('builds a free range as the custom preset (§3.2)', () => {
    expect(customRange(1, 5, 'number')).toEqual({
      preset: 'custom',
      min: 1,
      max: 5,
      labelMode: 'number',
    });
  });

  it('lists the presets in picker order and warns below ten balls (§3.2)', () => {
    expect(RANGE_PRESETS).toEqual(['eu90', 'us75', 'n80', 'custom']);
    expect(RANGE_WARNING_TOTAL).toBe(10);
  });
});

describe('validateRange (§3.2)', () => {
  it('accepts the presets and returns the total of balls', () => {
    expect(validateRange(1, 90)).toEqual({ ok: true, value: 90 });
    expect(validateRange(1, 75)).toEqual({ ok: true, value: 75 });
    expect(validateRange(1, 80)).toEqual({ ok: true, value: 80 });
    expect(validateRange(5, 68)).toEqual({ ok: true, value: 64 });
  });

  it('accepts the documented boundaries: 1 and 200 (ADR-08)', () => {
    expect(validateRange(1, 200)).toEqual({ ok: true, value: RANGE_MAX_TOTAL });
    expect(validateRange(199, 200)).toEqual({ ok: true, value: 2 });
    expect(RANGE_MAX_TOTAL).toBe(200);
  });

  it('rejects non-integers', () => {
    expect(validateRange(1.5, 90)).toEqual({ ok: false, error: 'NOT_INTEGER' });
    expect(validateRange(1, 75.5)).toEqual({ ok: false, error: 'NOT_INTEGER' });
  });

  it('rejects a range that does not start at 1 or above', () => {
    expect(validateRange(0, 90)).toEqual({ ok: false, error: 'MIN_AT_LEAST_ONE' });
    expect(validateRange(-3, 10)).toEqual({ ok: false, error: 'MIN_AT_LEAST_ONE' });
  });

  it('rejects min >= max', () => {
    expect(validateRange(90, 90)).toEqual({ ok: false, error: 'MIN_NOT_LESS_THAN_MAX' });
    expect(validateRange(10, 5)).toEqual({ ok: false, error: 'MIN_NOT_LESS_THAN_MAX' });
  });

  it('rejects a maximum above 200 in v1', () => {
    expect(validateRange(1, 201)).toEqual({ ok: false, error: 'MAX_EXCEEDED' });
  });

  it('checks the rules in order: integers first, bounds last', () => {
    // Both wrong; the integral rule is reported first.
    expect(validateRange(0.5, 90.5)).toEqual({ ok: false, error: 'NOT_INTEGER' });
  });
});

describe('rangeNumbers / rangeTotal / formatRangeSpan', () => {
  it('enumerates the whole contiguous range without gaps', () => {
    expect(rangeNumbers({ min: 5, max: 8 })).toEqual([5, 6, 7, 8]);
    expect(rangeNumbers({ min: 1, max: 3 })).toEqual([1, 2, 3]);
  });

  it('totals the range as max - min + 1', () => {
    expect(rangeTotal({ min: 5, max: 68 })).toBe(64);
    expect(rangeTotal({ min: 1, max: 90 })).toBe(90);
  });

  it('never throws on a degenerate range (corrupt data must not crash §7.7)', () => {
    expect(rangeNumbers({ min: 5, max: 4 })).toEqual([]);
  });

  it('formats the span for headers as 1–90', () => {
    expect(formatRangeSpan({ min: 1, max: 90 })).toBe('1–90');
    expect(formatRangeSpan({ min: 5, max: 68 })).toBe('5–68');
  });
});

describe('formatLabel (§3.1, §3.4)', () => {
  it('prints the plain number in number mode', () => {
    expect(formatLabel(42, PRESETS.eu90)).toBe('42');
    expect(formatLabel(7, US75_PLAIN)).toBe('7');
  });

  it('maps the US75 board to its five columns', () => {
    expect(formatLabel(1, PRESETS.us75)).toBe('B-1');
    expect(formatLabel(15, PRESETS.us75)).toBe('B-15');
    expect(formatLabel(16, PRESETS.us75)).toBe('I-16');
    expect(formatLabel(30, PRESETS.us75)).toBe('I-30');
    expect(formatLabel(31, PRESETS.us75)).toBe('N-31');
    expect(formatLabel(45, PRESETS.us75)).toBe('N-45');
    expect(formatLabel(46, PRESETS.us75)).toBe('G-46');
    expect(formatLabel(60, PRESETS.us75)).toBe('G-60');
    expect(formatLabel(61, PRESETS.us75)).toBe('O-61');
    expect(formatLabel(75, PRESETS.us75)).toBe('O-75');
  });

  it('ignores letter mode outside preset 75 (§3.4)', () => {
    expect(formatLabel(42, EU90_LETTERS)).toBe('42');
  });

  it('degrades to the plain number when there is no column (§7.7)', () => {
    expect(formatLabel(0, PRESETS.us75)).toBe('0');
    expect(formatLabel(76, PRESETS.us75)).toBe('76');
  });
});
