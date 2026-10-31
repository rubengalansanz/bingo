import { createGame, draw, integrityCheck, reset, undo } from '../game';
import { mulberry32 } from '../rng';
import { DEFAULT_RANGE, PRESETS } from '../range';
import type { DrawRecord, Game } from '../types';

const rng = (seed = 7) => mulberry32(seed);

function snapshot(g: Game): string {
  return JSON.stringify(g);
}

/** Draws `n` balls and returns the resulting game. */
function drawMany(g: Game, n: number, startAt = 0): Game {
  let current = g;
  for (let i = 0; i < n; i++) {
    const result = draw(current, startAt + i);
    if (!result.ok) {
      throw new Error(`drawMany: unexpected ${result.error} at ${i}`);
    }
    current = result.value.game;
  }
  return current;
}

/** Builds a game state directly, for corruption scenarios (§2.9). */
function gameOf(overrides: Partial<Game> = {}): Game {
  return {
    id: 'test-game',
    range: DEFAULT_RANGE,
    pool: [],
    history: [],
    status: 'running',
    createdAt: 1_000,
    finishedAt: null,
    seed: null,
    ...overrides,
  };
}

function record(number: number, position: number, drawnAt = 0): DrawRecord {
  return { number, position, drawnAt };
}

/** A game whose 90 balls were all drawn. */
function completeGame(overrides: Partial<Game> = {}): Game {
  const history = Array.from({ length: 90 }, (_, i) => record(i + 1, i + 1, 2_000 + i));
  return gameOf({ status: 'exhausted', finishedAt: 2_089, history, ...overrides });
}

describe('createGame (§8.2)', () => {
  it('creates a 90-ball game with an empty history', () => {
    const g = createGame(PRESETS.eu90, rng(1), 1_000);

    expect(g.pool).toHaveLength(90);
    expect([...g.pool].sort((a, b) => a - b)).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
    expect(new Set(g.pool).size).toBe(90);
    expect(g.history).toEqual([]);
    expect(g.status).toBe('running');
    expect(g.createdAt).toBe(1_000);
    expect(g.finishedAt).toBeNull();
    expect(g.range).toBe(PRESETS.eu90);
    expect(g.seed).toBeNull();
    expect(g.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('records the seed in reproducible mode (§2.8)', () => {
    expect(createGame(PRESETS.eu90, rng(1), 0, 42).seed).toBe(42);
  });

  it('gives two games distinct ids', () => {
    const r = rng(3);
    expect(createGame(PRESETS.eu90, r, 0).id).not.toBe(createGame(PRESETS.eu90, r, 0).id);
  });

  it('does not mutate the incoming range config (§8.2)', () => {
    const cfg = Object.freeze({ ...PRESETS.eu90 });
    const before = JSON.stringify(cfg);
    const g = createGame(cfg, rng(5), 0);

    expect(JSON.stringify(cfg)).toBe(before);
    expect(g.range).toBe(cfg);
  });

  it('is deterministic in reproducible mode with the same seed', () => {
    const a = createGame(PRESETS.eu90, rng(9), 0);
    const b = createGame(PRESETS.eu90, rng(9), 0);
    expect(a).toEqual(b);
  });
});

describe('draw (§8.2)', () => {
  it('draws 90 unique balls whose set is the whole range', () => {
    let g = createGame(PRESETS.eu90, rng(2), 0);

    for (let i = 1; i <= 90; i++) {
      const result = draw(g, i);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.record.position).toBe(i);
      expect(result.value.record.drawnAt).toBe(i);
      g = result.value.game;
    }

    const drawn = g.history.map((d) => d.number);
    expect(drawn).toHaveLength(90);
    expect(new Set(drawn).size).toBe(90);
    expect([...drawn].sort((a, b) => a - b)).toEqual(Array.from({ length: 90 }, (_, k) => k + 1));
    expect(g.pool).toEqual([]);
    expect(g.status).toBe('exhausted');
    expect(g.finishedAt).toBe(90);
  });

  it('returns Err(EXHAUSTED) on the 91st draw, leaving the state untouched', () => {
    const g = drawMany(createGame(PRESETS.eu90, rng(3), 0), 90);
    const before = snapshot(g);

    const result = draw(g, 999);

    expect(result).toEqual({ ok: false, error: 'EXHAUSTED' });
    expect(snapshot(g)).toBe(before);
  });

  it('does not mutate the previous state (§8.2)', () => {
    const g = createGame(PRESETS.eu90, rng(4), 0);
    const before = snapshot(g);

    const result = draw(g, 1);

    expect(snapshot(g)).toBe(before);
    expect(result.ok).toBe(true);
  });

  it('keeps pool ∪ history as an exact partition of the range', () => {
    let g = createGame(PRESETS.eu90, rng(6), 0);
    const total = 90;

    for (let i = 0; i < 40; i++) {
      const result = draw(g, i);
      if (!result.ok) break;
      g = result.value.game;

      expect(g.pool.length + g.history.length).toBe(total);
      const union = new Set([...g.pool, ...g.history.map((d) => d.number)]);
      expect(union.size).toBe(total);
    }
  });

  it('survives a JSON round-trip unchanged (§8.2)', () => {
    const g = drawMany(createGame(PRESETS.eu90, rng(8), 0), 12);
    const restored: Game = JSON.parse(snapshot(g));

    expect(restored).toEqual(g);
    const result = draw(restored, 500);
    expect(result.ok).toBe(true);
  });
});

describe('undo (§8.2, §2.6)', () => {
  it('returns one ball to the end of the pool', () => {
    const g = drawMany(createGame(PRESETS.eu90, rng(10), 0), 5);

    const result = undo(g);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.game.history).toHaveLength(4);
    expect(result.value.game.pool).toHaveLength(86); // 90 - 5 + 1
    // The next draw pops the very ball that was undone.
    expect(result.value.game.pool[result.value.game.pool.length - 1]).toBe(
      result.value.undone.number,
    );
    expect(result.value.game.history.map((d) => d.position)).toEqual([1, 2, 3, 4]);
  });

  it('reactivates an exhausted game (exhausted → running)', () => {
    const g = drawMany(createGame(PRESETS.eu90, rng(11), 0), 90);

    const result = undo(g);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.game.status).toBe('running');
    expect(result.value.game.pool).toHaveLength(1);
    expect(result.value.game.finishedAt).toBeNull();
  });

  it('rejects undo with an empty history', () => {
    const g = createGame(PRESETS.eu90, rng(12), 0);
    const before = snapshot(g);

    expect(undo(g)).toEqual({ ok: false, error: 'EMPTY_HISTORY' });
    expect(snapshot(g)).toBe(before);
  });

  it('is the exact inverse of draw (§2.6)', () => {
    const g = createGame(PRESETS.eu90, rng(13), 0);
    const before = snapshot(g);

    const drawn = draw(g, 5);
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;

    const undone = undo(drawn.value.game);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;

    expect(snapshot(undone.value.game)).toBe(before);
  });

  it('undo → draw returns the same ball, repeatedly', () => {
    let g = drawMany(createGame(PRESETS.eu90, rng(14), 0), 7);
    const last = g.history[g.history.length - 1]!;

    for (let round = 0; round < 3; round++) {
      const undone = undo(g);
      expect(undone.ok).toBe(true);
      if (!undone.ok) return;

      const redrawn = draw(undone.value.game, 100 + round);
      expect(redrawn.ok).toBe(true);
      if (!redrawn.ok) return;

      expect(redrawn.value.record.number).toBe(last.number);
      g = redrawn.value.game;
    }
  });
});

describe('reset (§8.2, §2.7)', () => {
  it('starts a fresh game over the same range with a new id', () => {
    const g = drawMany(createGame(PRESETS.eu90, rng(15), 0), 5);

    const fresh = reset(PRESETS.eu90, rng(16), 77);

    expect(fresh.id).not.toBe(g.id);
    expect(fresh.history).toEqual([]);
    expect(fresh.pool).toHaveLength(90);
    expect(fresh.status).toBe('running');
    expect(fresh.finishedAt).toBeNull();
    expect(fresh.createdAt).toBe(77);
  });
});

describe('integrityCheck (§2.9 capa 4)', () => {
  it('reports a healthy engine-built game as untouched', () => {
    const fresh = createGame(PRESETS.eu90, rng(20), 0);
    const played = drawMany(createGame(PRESETS.eu90, rng(21), 0), 17);

    for (const g of [fresh, played]) {
      const report = integrityCheck(g, rng(22));
      expect(report.ok).toBe(true);
      expect(report.issues).toEqual([]);
      expect(report.repaired).toBe(g);
    }
  });

  it('detects a non-monotonic position and renumbers on repair', () => {
    const g = gameOf({
      pool: [4, 5, 6],
      history: [record(1, 1), record(2, 7), record(3, 3)],
    });

    const report = integrityCheck(g, rng(23));

    expect(report.ok).toBe(false);
    expect(report.issues).toContain('POSITION_GAP');
    expect(report.repaired.history.map((d) => d.position)).toEqual([1, 2, 3]);
    expect(report.repaired.history.map((d) => d.number)).toEqual([1, 2, 3]);
  });

  it('detects a ball repeated inside the history', () => {
    const g = gameOf({ pool: [4, 5, 6], history: [record(1, 1), record(1, 2), record(3, 3)] });

    const report = integrityCheck(g, rng(24));

    expect(report.issues).toContain('DUPLICATE_NUMBER');
    // The second copy is dropped: the visible log keeps one entry per ball.
    expect(report.repaired.history.map((d) => d.number)).toEqual([1, 3]);
    expect(report.repaired.pool).toHaveLength(88);
  });

  it('detects a ball present both in history and pool', () => {
    const g = gameOf({ pool: [1, 5, 6], history: [record(1, 1), record(2, 2), record(3, 3)] });

    const report = integrityCheck(g, rng(25));

    expect(report.issues).toContain('DUPLICATE_NUMBER');
    expect(report.repaired.pool).not.toContain(1);
    expect(report.repaired.history.map((d) => d.number)).toEqual([1, 2, 3]);
  });

  it('detects a ball repeated inside the pool', () => {
    const g = gameOf({ pool: [1, 1, 3], history: [record(2, 1), record(4, 2)] });

    const report = integrityCheck(g, rng(26));

    expect(report.issues).toContain('DUPLICATE_NUMBER');
    expect(new Set(report.repaired.pool).size).toBe(report.repaired.pool.length);
  });

  it('detects numbers outside the range, including non-integers', () => {
    const below = integrityCheck(gameOf({ pool: [0, 2] }), rng(27));
    const above = integrityCheck(gameOf({ pool: [2, 91] }), rng(28));
    const fractional = integrityCheck(gameOf({ pool: [1, 2.5] }), rng(29));

    expect(below.issues).toContain('OUT_OF_RANGE');
    expect(above.issues).toContain('OUT_OF_RANGE');
    expect(fractional.issues).toContain('OUT_OF_RANGE');
    expect(fractional.repaired.pool).not.toContain(2.5);
  });

  it('detects a foreign ball inside the history and drops it on repair', () => {
    const g = gameOf({ pool: [2, 3], history: [record(91, 1), record(4, 2)] });

    const report = integrityCheck(g, rng(42));

    expect(report.issues).toContain('OUT_OF_RANGE');
    expect(report.repaired.history.map((d) => d.number)).toEqual([4]);
    expect(report.repaired.pool).toHaveLength(89);
  });

  it('detects a vanished ball as a partition mismatch and rebuilds it', () => {
    const g = gameOf({ pool: [2, 3], history: [record(1, 1)] }); // 4..90 are gone

    const report = integrityCheck(g, rng(30));

    expect(report.issues).toContain('PARTITION_MISMATCH');
    expect(report.repaired.pool).toHaveLength(89);
    expect(
      [...report.repaired.pool, ...report.repaired.history.map((d) => d.number)].sort(
        (a, b) => a - b,
      ),
    ).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
  });

  it('detects status/finishedAt inconsistencies', () => {
    const runningButEmpty = integrityCheck(gameOf({ pool: [] }), rng(31));
    const exhaustedButFull = integrityCheck(
      gameOf({ pool: [1], status: 'exhausted', finishedAt: 10 }),
      rng(32),
    );
    const runningWithStamp = integrityCheck(gameOf({ pool: [1], finishedAt: 10 }), rng(33));
    const exhaustedWithoutStamp = integrityCheck(gameOf({ status: 'exhausted' }), rng(34));

    expect(runningButEmpty.issues).toContain('STATUS_MISMATCH');
    expect(exhaustedButFull.issues).toContain('STATUS_MISMATCH');
    expect(runningWithStamp.issues).toContain('STATUS_MISMATCH');
    expect(exhaustedWithoutStamp.issues).toContain('STATUS_MISMATCH');
  });

  it('rebuilds the whole pool from a lost pool_json and re-shuffles it', () => {
    const g = gameOf({ pool: [], history: [record(7, 1, 10), record(3, 2, 11)] });

    const report = integrityCheck(g, rng(35));

    expect(report.ok).toBe(false);
    expect(report.repaired.pool).toHaveLength(88);
    expect(report.repaired.pool).not.toContain(7);
    expect(report.repaired.pool).not.toContain(3);
    // A fresh shuffle: not simply the ascending remainder.
    expect(report.repaired.pool).not.toEqual(
      Array.from({ length: 90 }, (_, i) => i + 1).filter((n) => n !== 7 && n !== 3),
    );
    expect(integrityCheck(report.repaired, rng(36)).ok).toBe(true);
  });

  it('keeps a known finishedAt when repairing a completed game', () => {
    const g = completeGame({ pool: [1] }); // one ball came back from nowhere

    const report = integrityCheck(g, rng(37));

    expect(report.ok).toBe(false);
    expect(report.repaired.status).toBe('exhausted');
    expect(report.repaired.finishedAt).toBe(2_089);
    expect(report.repaired.pool).toEqual([]);
  });

  it('stamps finishedAt from the last draw when the stored one is lost', () => {
    const g = completeGame({ finishedAt: null, status: 'running' });

    const report = integrityCheck(g, rng(38));

    expect(report.ok).toBe(false);
    expect(report.repaired.status).toBe('exhausted');
    expect(report.repaired.finishedAt).toBe(2_089);
  });

  it('never throws on a degenerate range (§7.7: nunca un crash)', () => {
    const g = gameOf({ range: { ...DEFAULT_RANGE, min: 5, max: 4 }, status: 'exhausted' });

    const report = integrityCheck(g, rng(39));

    expect(report.ok).toBe(false);
    expect(report.repaired.pool).toEqual([]);
    expect(report.repaired.finishedAt).toBe(1_000);
  });

  it('reports several independent problems at once', () => {
    const g = gameOf({
      pool: [91, 1, 1],
      history: [record(2, 1), record(2, 5)],
      status: 'exhausted',
      finishedAt: 5,
    });

    const report = integrityCheck(g, rng(40));

    expect(report.issues).toEqual(
      expect.arrayContaining([
        'POSITION_GAP',
        'DUPLICATE_NUMBER',
        'OUT_OF_RANGE',
        'PARTITION_MISMATCH',
        'STATUS_MISMATCH',
      ]),
    );
    expect(integrityCheck(report.repaired, rng(41)).ok).toBe(true);
  });
});
