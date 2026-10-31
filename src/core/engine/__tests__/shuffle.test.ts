import { mulberry32 } from '../rng';
import { shuffle } from '../shuffle';

const EU90 = Object.freeze(Array.from({ length: 90 }, (_, i) => i + 1));

describe('shuffle (Fisher-Yates, §2.2)', () => {
  it('returns a permutation of the input', () => {
    const out = shuffle(EU90, mulberry32(42));
    expect(out).toHaveLength(EU90.length);
    expect([...out].sort((a, b) => a - b)).toEqual([...EU90]);
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    shuffle(input, mulberry32(7));
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for the same seed', () => {
    expect(shuffle(EU90, mulberry32(2026))).toEqual(shuffle(EU90, mulberry32(2026)));
  });

  it('actually reorders (is not the identity)', () => {
    expect(shuffle(EU90, mulberry32(2026))).not.toEqual([...EU90]);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    expect(shuffle(['only'], mulberry32(1))).toEqual(['only']);
  });

  it('draws 90 unique balls by popping: the INV-1 precursor', () => {
    const pool = shuffle(EU90, mulberry32(11));
    const drawn: number[] = [];
    while (pool.length > 0) {
      drawn.push(pool.pop()!);
    }

    expect(drawn).toHaveLength(90);
    expect(new Set(drawn).size).toBe(90);
    expect(pool).toHaveLength(0);
    expect([...drawn].sort((a, b) => a - b)).toEqual([...EU90]);
  });

  it('gives every ball a chance to come out first (no dead positions)', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 5000; seed++) {
      // Fisher-Yates consumes from the end, so "first out" is the last element.
      const pool = shuffle(EU90, mulberry32(seed));
      seen.add(pool[pool.length - 1]!);
    }
    expect(seen.size).toBe(90);
  });
});
