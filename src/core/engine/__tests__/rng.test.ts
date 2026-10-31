import {
  cryptoRng,
  mulberry32,
  randomInt,
  UINT32_SPACE,
  type Rng,
  type Uint32Source,
} from '../rng';

const MAX_U32 = UINT32_SPACE - 1;

describe('cryptoRng', () => {
  it('maps the uint32 space onto [0, 1)', () => {
    const samples: Uint32Source[] = [() => 0, () => 0x8000_0000, () => MAX_U32];
    expect(samples.map((source) => cryptoRng(source)())).toEqual([0, 0.5, MAX_U32 / UINT32_SPACE]);
  });

  it('coerces out-of-range uint32 values with >>> 0', () => {
    const rng = cryptoRng(() => -1);
    expect(rng()).toBe(MAX_U32 / UINT32_SPACE);
  });

  it('stays in [0, 1) and is not degenerate', () => {
    const rng = cryptoRng(() => 12345);
    const value = rng();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const first = Array.from({ length: 8 }, () => a());
    expect(first).toEqual(Array.from({ length: 8 }, () => b()));
  });

  it('produces different sequences for different seeds', () => {
    const take = (seed: number) => {
      const rng = mulberry32(seed);
      return Array.from({ length: 8 }, () => rng());
    };
    expect(take(1)).not.toEqual(take(2));
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is not a constant function', () => {
    const rng = mulberry32(9);
    const values = new Set(Array.from({ length: 50 }, () => rng()));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('randomInt', () => {
  it('always returns an integer inside [0, maxExclusive)', () => {
    const rng = mulberry32(123);
    for (const k of [1, 2, 3, 7, 10, 90, 200]) {
      for (let i = 0; i < 500; i++) {
        const value = randomInt(rng, k);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(k);
      }
    }
  });

  it('returns 0 when there is only one option', () => {
    expect(randomInt(mulberry32(1), 1)).toBe(0);
  });

  it('accepts the full uint32 space', () => {
    expect(randomInt(() => 0.5, UINT32_SPACE)).toBe(0x8000_0000);
  });

  it.each([0, -1, 1.5, Number.NaN, UINT32_SPACE + 1])(
    'rejects an invalid maxExclusive (%p)',
    (k) => {
      expect(() => randomInt(mulberry32(1), k)).toThrow(RangeError);
    },
  );

  it('rejects a value in the tail and retries (§2.8 bias removal)', () => {
    // k=3 => limit = 4294967295, so this first sample must be discarded.
    const queue = [0.9999999999999999, 0];
    let index = 0;
    const rng: Rng = () => queue[index++] ?? 0;

    expect(randomInt(rng, 3)).toBe(0);
    expect(index).toBe(2);
  });

  it('fails loudly instead of hanging when rng() is stuck in the tail', () => {
    const stuck: Rng = () => 0.9999999999999999;
    expect(() => randomInt(stuck, 3)).toThrow(/uniform/);
  });

  it('is uniform enough for a draw (chi-square smoke test)', () => {
    const rng = mulberry32(2024);
    const k = 6;
    const samples = 60_000;
    const counts = new Array<number>(k).fill(0);

    for (let i = 0; i < samples; i++) {
      counts[randomInt(rng, k)]! += 1;
    }

    const expected = samples / k;
    for (const count of counts) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });
});
