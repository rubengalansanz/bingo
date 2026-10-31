import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createGame, draw, integrityCheck } from '../../engine/game';
import { PRESETS } from '../../engine/range';
import { mulberry32 } from '../../engine/rng';
import type { DrawRecord, Game } from '../../engine/types';
import { applyMigrations } from '../migrations';
import { createGameRepository, type GameRepository } from '../repositories/game.repository';
import { fileSqlite, memorySqlite, type TestDatabase } from './betterSqlite';

type Harness = { db: TestDatabase; repo: GameRepository };

function harness(): Harness {
  const db = memorySqlite();
  const report = applyMigrations(db);
  expect(report.failed).toBe(false);
  return { db, repo: createGameRepository(db) };
}

function openAt(path: string): Harness {
  const db = fileSqlite(path);
  expect(applyMigrations(db).failed).toBe(false);
  return { db, repo: createGameRepository(db) };
}

/** One engine draw, with the loud failure this suite wants. */
function drawOnce(g: Game, now: number): { game: Game; record: DrawRecord } {
  const result = draw(g, now);
  if (!result.ok) {
    throw new Error(`unexpected ${result.error}`);
  }
  return result.value;
}

describe('createGameRepository — loading (§7.7)', () => {
  it('returns null on a fresh install: first launch has no game', () => {
    const { db, repo } = harness();
    expect(repo.loadCurrent()).toBeNull();
    db.close();
  });

  it('round-trips a whole game: pool order, range, status, seed', () => {
    const { db, repo } = harness();
    const created = createGame(PRESETS.eu90, mulberry32(1), 1_000, 42);

    repo.saveNew(created);

    expect(repo.loadCurrent()).toEqual(created);
    db.close();
  });

  it('loads the newest game and archives the previous active one (§5.5)', () => {
    const { db, repo } = harness();
    const first = createGame(PRESETS.eu90, mulberry32(2), 1_000);
    repo.saveNew(first);

    const second = createGame(PRESETS.n80, mulberry32(3), 2_000);
    repo.saveNew(second);

    const loaded = repo.loadCurrent();
    expect(loaded?.id).toBe(second.id);
    expect(loaded?.range).toEqual(PRESETS.n80);

    const running = db.get(`SELECT COUNT(*) AS total FROM game WHERE status = 'running'`);
    expect(running?.total).toBe(1);
    const archived = db.get('SELECT status FROM game WHERE id = ?', [first.id]);
    expect(archived?.status).toBe('abandoned');
    db.close();
  });

  it('picks the new game over an exhausted one by insertion order, not timestamp', () => {
    const { db, repo } = harness();
    // Both games share the same millisecond: rowid decides (§5.5).
    const finished = createGame({ ...PRESETS.eu90, max: 3 }, mulberry32(4), 5_000);
    repo.saveNew(finished);
    const after = drawOnce(finished, 5_001);
    repo.commitDraw(after.game, after.record);
    const done = drawOnce(after.game, 5_002);
    repo.commitDraw(done.game, done.record);
    const exhausted = drawOnce(done.game, 5_003);
    repo.commitDraw(exhausted.game, exhausted.record);
    expect(exhausted.game.status).toBe('exhausted');

    const next = createGame(PRESETS.eu90, mulberry32(5), 5_000);
    repo.saveNew(next);

    expect(repo.loadCurrent()?.id).toBe(next.id);
    db.close();
  });

  it('refuses a second active game: the unique index is real (§5.5)', () => {
    const { db, repo } = harness();
    const first = createGame(PRESETS.eu90, mulberry32(6), 1_000);
    repo.saveNew(first);

    expect(() =>
      db.run(
        `INSERT INTO game (id, created_at, status, preset, min_value, max_value, label_mode, pool_json, draw_count)
         VALUES ('other', 2, 'running', 'eu90', 1, 90, 'number', '[]', 0)`,
      ),
    ).toThrow(/UNIQUE/i);
    db.close();
  });
});

describe('createGameRepository — commitDraw (§2.5, §2.9)', () => {
  function started(): Harness & { game: Game } {
    const h = harness();
    const game = createGame(PRESETS.eu90, mulberry32(7), 1_000);
    h.repo.saveNew(game);
    return { ...h, game };
  }

  it('persists exactly what the engine produced', () => {
    const { db, repo, game } = started();
    let live = game;

    for (let i = 1; i <= 3; i++) {
      const step = drawOnce(live, 1_000 + i);
      repo.commitDraw(step.game, step.record);
      live = step.game;
    }

    expect(repo.loadCurrent()).toEqual(live);
    expect(live.history.map((d) => d.number)).toHaveLength(3);
    const row = db.get('SELECT draw_count, pool_json FROM game WHERE id = ?', [live.id]);
    expect(row?.draw_count).toBe(3);
    expect(JSON.parse(String(row?.pool_json))).toHaveLength(87);
    db.close();
  });

  it('commits the ball that ends the game as exhausted (§2.4)', () => {
    const { db, repo } = harness();
    const game = createGame({ ...PRESETS.eu90, max: 2 }, mulberry32(8), 1_000);
    repo.saveNew(game);

    const first = drawOnce(game, 1_001);
    repo.commitDraw(first.game, first.record);
    const last = drawOnce(first.game, 1_002);
    repo.commitDraw(last.game, last.record);

    const loaded = repo.loadCurrent();
    expect(loaded?.status).toBe('exhausted');
    expect(loaded?.finishedAt).toBe(1_002);
    expect(loaded?.pool).toEqual([]);
    db.close();
  });

  it('rejects a repeated ball at the storage layer and rolls the whole commit back (§2.9)', () => {
    const { db, repo, game } = started();
    const first = drawOnce(game, 1_001);
    repo.commitDraw(first.game, first.record);
    const committed = repo.loadCurrent();

    // Simulates a buggy caller re-sending the same ball with a new position.
    const duplicate: DrawRecord = { number: first.record.number, position: 2, drawnAt: 1_002 };
    expect(() => repo.commitDraw(first.game, duplicate)).toThrow(/UNIQUE/i);

    // Neither the draw nor the pool update survived: one transaction, one fact.
    expect(repo.loadCurrent()).toEqual(committed);
    const draws = db.get('SELECT COUNT(*) AS total FROM draw WHERE game_id = ?', [game.id]);
    expect(draws?.total).toBe(1);
    db.close();
  });

  it('rolls back when the game row does not exist (foreign keys on)', () => {
    const { db, repo } = harness();
    const orphan = createGame(PRESETS.eu90, mulberry32(9), 1_000);

    expect(() => repo.commitDraw(orphan, { number: 1, position: 1, drawnAt: 1 })).toThrow(
      /FOREIGN KEY/i,
    );
    db.close();
  });

  it('leaves the game untouched when the same fact is committed twice', () => {
    const { db, repo, game } = started();
    const first = drawOnce(game, 1_001);
    repo.commitDraw(first.game, first.record);
    const before = repo.loadCurrent();

    // Position and number both collide: the commit cannot be applied twice.
    expect(() => repo.commitDraw(first.game, first.record)).toThrow(/UNIQUE/i);
    expect(repo.loadCurrent()).toEqual(before);
    db.close();
  });
});

describe('createGameRepository — integrity repair persistence (§2.5)', () => {
  it('degrades a corrupt pool_json to an empty pool instead of crashing', () => {
    const { db, repo } = harness();
    const game = createGame(PRESETS.eu90, mulberry32(10), 1_000);
    repo.saveNew(game);
    db.run('UPDATE game SET pool_json = ? WHERE id = ?', ['{ not json', game.id]);

    const loaded = repo.loadCurrent();

    expect(loaded).not.toBeNull();
    expect(loaded?.pool).toEqual([]);
    expect(loaded?.id).toBe(game.id);
    expect(loaded?.history).toEqual([]);
    db.close();
  });

  it('degrades a pool_json that is valid JSON but not an array', () => {
    const { db, repo } = harness();
    const game = createGame(PRESETS.eu90, mulberry32(17), 1_000);
    repo.saveNew(game);
    db.run('UPDATE game SET pool_json = ? WHERE id = ?', ['{"balls":[1,2]}', game.id]);

    expect(repo.loadCurrent()?.pool).toEqual([]);
    db.close();
  });

  it('rewrites both the game row and its draw log when saving a repair', () => {
    const { db, repo } = harness();
    const game = createGame(PRESETS.eu90, mulberry32(14), 1_000);
    repo.saveNew(game);
    const first = drawOnce(game, 1_001);
    repo.commitDraw(first.game, first.record);
    const second = drawOnce(first.game, 1_002);
    repo.commitDraw(second.game, second.record);

    // Storage loses the pool; the visible log survives (§2.5).
    db.run('UPDATE game SET pool_json = ? WHERE id = ?', ['nope', game.id]);
    const damaged = repo.loadCurrent()!;
    expect(damaged.pool).toEqual([]);
    expect(damaged.history).toHaveLength(2);

    const report = integrityCheck(damaged, mulberry32(15));
    expect(report.ok).toBe(false);
    repo.save(report.repaired);

    const repaired = repo.loadCurrent()!;
    expect(repaired).toEqual(report.repaired);
    expect(repaired.history).toHaveLength(2);
    expect(repaired.pool).toHaveLength(88);
    expect(integrityCheck(repaired, mulberry32(16)).ok).toBe(true);
    db.close();
  });

  it('saves the repaired game so the next boot is clean', () => {
    const { db, repo } = harness();
    const game = createGame(PRESETS.eu90, mulberry32(11), 1_000);
    repo.saveNew(game);
    db.run('UPDATE game SET pool_json = ? WHERE id = ?', ['[]', game.id]);

    const damaged = repo.loadCurrent()!;
    const report = integrityCheck(damaged, mulberry32(12));
    expect(report.ok).toBe(false);
    repo.save(report.repaired);

    const repaired = repo.loadCurrent();
    expect(repaired).toEqual(report.repaired);
    expect(integrityCheck(repaired!, mulberry32(13)).ok).toBe(true);
    // Saving does not resurrect the archived/active index invariant.
    const running = db.get(`SELECT COUNT(*) AS total FROM game WHERE status = 'running'`);
    expect(running?.total).toBe(1);
    db.close();
  });
});

describe('process-death recovery (§2.5 — Fase 1 gate)', () => {
  let dir: string;
  /** Connections still open; closed after every test so Windows can delete them. */
  const sessions: TestDatabase[] = [];

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bingo-phase1-'));
  });

  afterEach(() => {
    while (sessions.length > 0) {
      sessions.pop()!.close();
    }
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function openSession(path: string): Harness {
    const opened = openAt(path);
    sessions.push(opened.db);
    return opened;
  }

  /** Closes a connection the way a killed process would: nothing left open. */
  function killSession(db: TestDatabase): void {
    db.close();
    const index = sessions.indexOf(db);
    if (index >= 0) {
      sessions.splice(index, 1);
    }
  }

  it('reopens with the exact committed state and keeps drawing without repeats', () => {
    const path = join(dir, 'game.db');

    // Session 1: play three draws, then die without any shutdown hook.
    const first = openSession(path);
    const created = createGame(PRESETS.eu90, mulberry32(21), 1_000);
    first.repo.saveNew(created);
    let live = created;
    for (let i = 1; i <= 3; i++) {
      const step = drawOnce(live, 1_000 + i);
      first.repo.commitDraw(step.game, step.record);
      live = step.game;
    }
    killSession(first.db);

    // Session 2: a brand new connection reads back what was committed.
    const second = openSession(path);
    const recovered = second.repo.loadCurrent();
    expect(recovered).toEqual(live);
    expect(recovered?.history.map((d) => d.number)).toHaveLength(3);

    // …and the game continues with no ball ever repeating (INV-1 across restarts).
    const drawn = new Set(recovered!.history.map((d) => d.number));
    let current = recovered!;
    for (let i = 4; i <= 20; i++) {
      const step = drawOnce(current, 1_000 + i);
      expect(drawn.has(step.record.number)).toBe(false);
      drawn.add(step.record.number);
      second.repo.commitDraw(step.game, step.record);
      current = step.game;
    }
    expect(drawn.size).toBe(20);
    expect(second.repo.loadCurrent()).toEqual(current);
  });
});
