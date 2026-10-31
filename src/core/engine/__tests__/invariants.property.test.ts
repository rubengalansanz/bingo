import fc from 'fast-check';

import { mulberry32, randomInt } from '../rng';
import { shuffle } from '../shuffle';

/**
 * Phase 0 covers shuffle + randomInt only. The full INV-1 property suite over
 * the game engine lands in Phase 1 (§8.3); these properties are the base it
 * stands on.
 */

describe('shuffle — properties', () => {
  it('is always a permutation of its input', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -1000, max: 1000 }), { maxLength: 200 }),
        fc.integer({ min: 0, max: 2 ** 31 }),
        (input, seed) => {
          const out = shuffle(input, mulberry32(seed));
          expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('never repeats a number when the whole shuffled pool is consumed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 150 }),
        fc.integer({ min: 1, max: 60 }),
        fc.integer({ min: 0, max: 2 ** 31 }),
        (min, size, seed) => {
          const max = min + size - 1;
          const range = Array.from({ length: size }, (_, i) => min + i);
          const pool = shuffle(range, mulberry32(seed));

          const drawn: number[] = [];
          while (pool.length > 0) {
            drawn.push(pool.pop()!);
          }

          const unique = new Set(drawn);
          expect(unique.size).toBe(size);
          expect(drawn.every((n) => n >= min && n <= max)).toBe(true);
          expect(unique).toEqual(new Set(range));
        },
      ),
      { numRuns: 3000 },
    );
  });
});

describe('randomInt — properties', () => {
  it('stays inside [0, k) for any k', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 0, max: 2 ** 31 }),
        (k, seed) => {
          const rng = mulberry32(seed);
          for (let i = 0; i < 20; i++) {
            const value = randomInt(rng, k);
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(k);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('rejects k outside [1, 2^32]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2 ** 32 + 1, max: 2 ** 40 }), (k) => {
        expect(() => randomInt(mulberry32(0), k)).toThrow(RangeError);
      }),
      { numRuns: 100 },
    );
  });
});
