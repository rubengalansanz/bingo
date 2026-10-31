import { type Result, err, ok } from '../result';

import { randomInt, type Rng } from './rng';
import { rangeNumbers, rangeTotal } from './range';
import { shuffle } from './shuffle';
import type { DrawRecord, Game, RangeConfig } from './types';

/**
 * The game engine (plan §6.3): `createGame · draw · undo · reset · integrityCheck`.
 *
 * Pure functions over an immutable `Game`: no effects, no native imports, no
 * exceptions for expected failures (§6.3). The caller injects both randomness
 * (`Rng`, §2.8) and time (`now`), which is what keeps this module runnable in
 * plain Node for the INV-1 suite (§5.2).
 */

/**
 * UUID v4 over the injected CSPRNG.
 *
 * `expo-crypto.randomUUID()` would drag a native module into `core`, so the id
 * is derived from the same port the shuffle uses (§5.2: core stays native-free).
 * Production rng = system CSPRNG → the id is as good as a platform UUID; the
 * reproducible dev mode gets a deterministic id, which is desirable there.
 */
function uuidV4(rng: Rng): string {
  const hex: string[] = new Array(32);
  for (let i = 0; i < 32; i++) {
    hex[i] = randomInt(rng, 16).toString(16);
  }
  hex[12] = '4'; // version 4
  hex[16] = (8 + randomInt(rng, 4)).toString(16); // variant 10xx
  const raw = hex.join('');
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

/** A brand new `running` game over `cfg`, with its pool already shuffled (§2.2). */
export function createGame(
  cfg: RangeConfig,
  rng: Rng,
  now: number,
  seed: number | null = null,
): Game {
  return {
    id: uuidV4(rng),
    range: cfg,
    pool: shuffle(rangeNumbers(cfg), rng),
    history: [],
    status: 'running',
    createdAt: now,
    finishedAt: null,
    seed,
  };
}

/**
 * Draw one ball (§2.2, §6.5).
 *
 * The number *leaves* the pool (`pop()`), so non-repetition is structural: a
 * drawn ball cannot come out again without an explicit `undo`. When the pool
 * empties the game becomes `exhausted`; an already empty pool returns
 * `Err('EXHAUSTED')` with the state untouched — the UI only reflects the
 * domain, it never grants a draw (§2.7).
 */
export function draw(
  g: Game,
  now: number,
): Result<{ game: Game; record: DrawRecord }, 'EXHAUSTED'> {
  if (g.pool.length === 0) {
    return err('EXHAUSTED');
  }

  const pool = g.pool.slice();
  // Safe: pool.length > 0.
  const number = pool.pop()!;
  const record: DrawRecord = { number, position: g.history.length + 1, drawnAt: now };
  const exhausted = pool.length === 0;

  return ok({
    record,
    game: {
      ...g,
      pool,
      history: [...g.history, record],
      status: exhausted ? 'exhausted' : 'running',
      // `finishedAt` is only stamped on the ball that empties the bombo (§2.4).
      finishedAt: exhausted ? now : g.finishedAt,
    },
  });
}

/**
 * Undo the last draw (§2.6).
 *
 * The ball goes back to the **end** of the pool, which is where `draw` pops
 * from: the next draw therefore returns exactly the ball that was undone, making
 * undo a genuinely reversible operation. `exhausted → running` (§2.4).
 */
export function undo(g: Game): Result<{ game: Game; undone: DrawRecord }, 'EMPTY_HISTORY'> {
  const last = g.history[g.history.length - 1];
  if (last === undefined) {
    return err('EMPTY_HISTORY');
  }

  return ok({
    undone: last,
    game: {
      ...g,
      pool: [...g.pool, last.number],
      history: g.history.slice(0, -1),
      status: 'running',
      finishedAt: null,
    },
  });
}

/**
 * Restart over the same range (§2.7: `reset → idle → startGame`).
 *
 * A reset is a *new* game: fresh id, full pool, empty history — the previous
 * one stays in storage as archived history (§2.4, "no se borra sola").
 */
export function reset(cfg: RangeConfig, rng: Rng, now: number): Game {
  return createGame(cfg, rng, now);
}

/** Violations `integrityCheck` can report (§2.9, layer 4). */
export type IntegrityIssue =
  'POSITION_GAP' | 'DUPLICATE_NUMBER' | 'OUT_OF_RANGE' | 'PARTITION_MISMATCH' | 'STATUS_MISMATCH';

export type IntegrityReport = {
  readonly ok: boolean;
  readonly issues: readonly IntegrityIssue[];
  /**
   * The game normalized from its **history** — the truth the user can see
   * (§2.5). When `ok`, this is the very same object; otherwise it is the
   * repaired game the caller must persist instead.
   */
  readonly repaired: Game;
};

/**
 * Detect and repair a damaged game (§2.9 capa 4, §2.5).
 *
 * History wins over the stored pool: the pool is rebuilt from
 * `range − history` and re-shuffled, because losing the remaining *order* is
 * infinitely better than showing a ball twice. Never throws — a corrupted file
 * must degrade into a repaired game, not a crash (§7.7).
 *
 * `rng` is injected (and only consumed when a repair actually happens) to
 * reshuffle the rebuilt pool.
 */
export function integrityCheck(g: Game, rng: Rng): IntegrityReport {
  const issues = detectIssues(g);
  if (issues.length === 0) {
    return { ok: true, issues, repaired: g };
  }
  return { ok: false, issues, repaired: repair(g, rng) };
}

function detectIssues(g: Game): IntegrityIssue[] {
  const found = new Set<IntegrityIssue>();
  const seen = new Set<number>();

  g.history.forEach((record, index) => {
    if (record.position !== index + 1) {
      found.add('POSITION_GAP');
    }
    if (!isInRange(record.number, g.range)) {
      found.add('OUT_OF_RANGE');
    }
    if (seen.has(record.number)) {
      found.add('DUPLICATE_NUMBER');
    }
    seen.add(record.number);
  });

  for (const n of g.pool) {
    if (!isInRange(n, g.range)) {
      found.add('OUT_OF_RANGE');
    }
    if (seen.has(n)) {
      found.add('DUPLICATE_NUMBER');
    }
    seen.add(n);
  }

  // `pool ∪ history` must be exactly the range, each number once (INV-1).
  const expected = rangeTotal(g.range);
  if (expected !== seen.size || g.history.length + g.pool.length !== expected) {
    found.add('PARTITION_MISMATCH');
  }

  const empty = g.pool.length === 0;
  if ((g.status === 'running' && empty) || (g.status === 'exhausted' && !empty)) {
    found.add('STATUS_MISMATCH');
  }
  if ((g.status === 'exhausted') !== (g.finishedAt !== null)) {
    found.add('STATUS_MISMATCH');
  }

  return [...found];
}

function repair(g: Game, rng: Rng): Game {
  const history: DrawRecord[] = [];
  const drawn = new Set<number>();

  for (const record of g.history) {
    // Duplicates and foreign numbers are dropped: `drawn` is the real log.
    if (!isInRange(record.number, g.range) || drawn.has(record.number)) {
      continue;
    }
    drawn.add(record.number);
    history.push({ number: record.number, position: history.length + 1, drawnAt: record.drawnAt });
  }

  const pool = shuffle(
    rangeNumbers(g.range).filter((n) => !drawn.has(n)),
    rng,
  );
  const exhausted = pool.length === 0;
  const last = history[history.length - 1];

  return {
    ...g,
    history,
    pool,
    status: exhausted ? 'exhausted' : 'running',
    finishedAt: exhausted
      ? (g.finishedAt ?? (last !== undefined ? last.drawnAt : g.createdAt))
      : null,
  };
}

/** Integral and inside `[min, max]` — the one predicate both checks share. */
function isInRange(n: number, cfg: RangeConfig): boolean {
  return Number.isInteger(n) && n >= cfg.min && n <= cfg.max;
}
