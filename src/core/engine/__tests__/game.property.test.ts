import fc from 'fast-check';

import { createGame, draw, integrityCheck, undo } from '../game';
import { mulberry32 } from '../rng';
import type { RangeConfig } from '../types';

/**
 * Property suite for the invariant (plan §2.1, §8.3):
 * INV-1 — no number is ever drawn twice, and `pool ∪ history` is always an
 * exact partition of the range. 10 000 runs per property in CI (§8.3).
 *
 * Every run reports its violations in one list, so a failure names the exact
 * invariant that broke instead of dying on the first assertion.
 */

const rangeArb = fc
  .record({
    min: fc.integer({ min: 1, max: 150 }),
    max: fc.integer({ min: 2, max: 200 }),
  })
  .map(({ min, max }) => ({
    preset: 'custom' as const,
    min,
    max: Math.max(min + 1, max),
    labelMode: 'number' as const,
  }));

const seedArb = fc.integer({ min: 0, max: 2 ** 31 });

type Violation = string;

describe('INV-1 — no repetition, ever (§2.1)', () => {
  it('never repeats a ball and always partitions the range (10 000 runs)', () => {
    fc.assert(
      fc.property(rangeArb, seedArb, (cfg: RangeConfig, seed) => {
        const violations: Violation[] = [];
        const total = cfg.max - cfg.min + 1;
        let game = createGame(cfg, mulberry32(seed), 0);
        const seen = new Set<number>();

        for (let tap = 1; tap <= total + 3; tap++) {
          const result = draw(game, tap);
          if (!result.ok) {
            if (result.error !== 'EXHAUSTED') {
              violations.push(`tap ${tap}: unexpected error ${result.error}`);
            }
            if (game.history.length !== total) {
              violations.push(`exhausted with ${game.history.length}/${total} drawn`);
            }
            if (game.pool.length !== 0) {
              violations.push(`exhausted with ${game.pool.length} balls left`);
            }
            break;
          }

          game = result.value.game;
          const n = result.value.record.number;

          if (seen.has(n)) violations.push(`duplicate ball ${n} on tap ${tap}`);
          if (n < cfg.min || n > cfg.max) violations.push(`ball ${n} outside range`);
          if (result.value.record.position !== tap) {
            violations.push(`position ${result.value.record.position} != ${tap}`);
          }
          if (game.pool.length + game.history.length !== total) {
            violations.push(`conservation broken after tap ${tap}`);
          }
          seen.add(n);
        }

        if (seen.size !== total) {
          violations.push(`only ${seen.size}/${total} distinct balls came out`);
        }
        expect(violations).toEqual([]);
      }),
      { numRuns: 10_000 },
    );
  });

  it('stays valid at every prefix: the engine never reports damage (§2.9)', () => {
    fc.assert(
      fc.property(rangeArb, seedArb, fc.nat({ max: 250 }), (cfg, seed, taps) => {
        let game = createGame(cfg, mulberry32(seed), 0);

        for (let i = 0; i < taps; i++) {
          const result = draw(game, i);
          if (!result.ok) break;
          game = result.value.game;
        }

        const report = integrityCheck(game, mulberry32(seed + 1));
        expect(report.ok).toBe(true);
        expect(report.repaired).toBe(game);
      }),
      { numRuns: 3000 },
    );
  });
});

describe('undo — exact inverse (§2.6)', () => {
  it('restores the previous state bit for bit', () => {
    fc.assert(
      fc.property(seedArb, fc.nat({ max: 89 }), (seed, draws) => {
        const game = createGame(
          { preset: 'eu90', min: 1, max: 90, labelMode: 'number' },
          mulberry32(seed),
          0,
        );
        const before = JSON.stringify(game);

        let current = game;
        for (let i = 0; i < draws; i++) {
          const result = draw(current, i);
          if (!result.ok) break;
          current = result.value.game;
        }

        // Undo everything that was drawn: the game must come back unchanged.
        for (let i = 0; i < draws; i++) {
          const undone = undo(current);
          if (!undone.ok) break;
          current = undone.value.game;
        }

        expect(JSON.stringify(current)).toBe(before);
      }),
      { numRuns: 3000 },
    );
  });

  it('re-draws the very ball that was undone', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const game = createGame(
          { preset: 'eu90', min: 1, max: 90, labelMode: 'number' },
          mulberry32(seed),
          0,
        );
        const first = draw(game, 1);
        expect(first.ok).toBe(true);
        if (!first.ok) return;

        const undone = undo(first.value.game);
        expect(undone.ok).toBe(true);
        if (!undone.ok) return;

        const again = draw(undone.value.game, 2);
        expect(again.ok).toBe(true);
        if (!again.ok) return;

        expect(again.value.record.number).toBe(first.value.record.number);
      }),
      { numRuns: 3000 },
    );
  });
});

describe('integrityCheck — repair converges (§2.5)', () => {
  it('detects a vanished ball and returns a game that checks out clean', () => {
    fc.assert(
      fc.property(rangeArb, seedArb, fc.nat({ max: 249 }), (cfg, seed, taps) => {
        const violations: Violation[] = [];
        let game = createGame(cfg, mulberry32(seed), 0);

        for (let i = 0; i < taps; i++) {
          const result = draw(game, i);
          if (!result.ok) break;
          game = result.value.game;
        }
        if (game.pool.length === 0) return; // nothing left to lose

        const pool = [...game.pool];
        pool.splice(Math.floor(pool.length / 2), 1); // one ball vanishes from storage
        const damaged = { ...game, pool };

        const report = integrityCheck(damaged, mulberry32(seed + 7));
        if (report.ok) violations.push('damaged game reported as healthy');
        if (!report.issues.includes('PARTITION_MISMATCH')) {
          violations.push(`expected PARTITION_MISMATCH, got ${report.issues.join(',')}`);
        }

        const total = cfg.max - cfg.min + 1;
        if (report.repaired.pool.length + report.repaired.history.length !== total) {
          violations.push('repaired game does not cover the range');
        }
        const again = integrityCheck(report.repaired, mulberry32(seed + 8));
        if (!again.ok) violations.push(`repaired game still damaged: ${again.issues.join(',')}`);

        expect(violations).toEqual([]);
      }),
      { numRuns: 3000 },
    );
  });
});
