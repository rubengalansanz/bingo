import { memorySqlite, type TestDatabase } from '@/core/db/__tests__/betterSqlite';
import { applyMigrations } from '@/core/db/migrations';
import { createGameRepository, type GameRepository } from '@/core/db/repositories/game.repository';
import { createGame, draw } from '@/core/engine/game';
import { PRESETS } from '@/core/engine/range';
import { mulberry32 } from '@/core/engine/rng';
import type { Game, RangeConfig } from '@/core/engine/types';

import { BUSY_MS, createGameStore, type GameStore } from '../gameStore';

/**
 * Store behaviour against a **real** SQLite (better-sqlite3, same SQL as the
 * device adapter). The point is the ordering that protects `INV-1`:
 * the in-memory game must never be ahead of what the repository committed.
 */

const SEED = 7;
const START = 1_700_000_000_000;

type Harness = {
  db: TestDatabase;
  repo: GameRepository;
  store: ReturnType<typeof createGameStore>;
  /** Makes every repository call fail, as a failing transaction would. */
  failWrites: (fail: boolean) => void;
  /** Persists a game with `draws` balls already out — a game recovered on boot. */
  seed: (draws: number, cfg?: RangeConfig) => Game;
};

function harness(): Harness {
  const db = memorySqlite();
  const report = applyMigrations(db);
  expect(report.failed).toBe(false);

  const repo = createGameRepository(db);
  // One generator for the whole test: every game gets a different id.
  const rng = mulberry32(SEED);
  let failing = false;
  let clock = START;

  const store = createGameStore({
    openRepository: () => {
      if (failing) {
        throw new Error('write failed');
      }
      return repo;
    },
    now: () => clock,
    rng: () => rng,
  });

  return {
    db,
    repo,
    store,
    failWrites: (fail) => {
      failing = fail;
    },
    seed: (draws, cfg = PRESETS.eu90) => {
      let game = createGame(cfg, rng, clock);
      for (let i = 0; i < draws; i++) {
        clock += 1000;
        const result = draw(game, clock);
        if (!result.ok) {
          throw new Error(`seed: unexpected ${result.error}`);
        }
        game = result.value.game;
      }
      repo.saveNew(game);
      return game;
    },
  };
}

function state(store: Harness['store']): GameStore {
  return store.getState();
}

describe('gameStore — boot (§5.4, §7.7)', () => {
  it('creates and persists the first game when there is none', async () => {
    const { store, repo } = harness();

    expect(state(store).phase).toBe('loading');
    await state(store).boot();

    expect(state(store).phase).toBe('ready');
    expect(state(store).game).not.toBeNull();
    expect(state(store).game?.history).toHaveLength(0);
    expect(state(store).game?.pool).toHaveLength(90);
    // Persisted before it is shown: the next boot reads the same game.
    expect(repo.loadCurrent()?.id).toBe(state(store).game?.id);
  });

  it('is idempotent: two boots load the game once', async () => {
    const { store, repo } = harness();
    const load = jest.spyOn(repo, 'loadCurrent');
    const saveNew = jest.spyOn(repo, 'saveNew');

    await Promise.all([state(store).boot(), state(store).boot()]);
    await state(store).boot();

    expect(load).toHaveBeenCalledTimes(1);
    expect(saveNew).toHaveBeenCalledTimes(1);
  });

  it('repairs a damaged pool from the history and persists the repair', async () => {
    const { store, repo } = harness();
    const damaged = harnessGameWithBrokenPool(repo);

    await state(store).boot();

    expect(state(store).phase).toBe('ready');
    expect(state(store).banner).toEqual({
      tone: 'info',
      text: 'Se reparó el estado de la partida.',
    });
    expect(state(store).game?.history).toHaveLength(damaged.history.length);
    // Two balls are out, so a healthy pool has 88 numbers left (INV-1).
    expect(state(store).game?.pool).toHaveLength(88);
    expect(repo.loadCurrent()?.pool).toHaveLength(88);
  });

  it('turns a repository failure into the error phase instead of a crash', async () => {
    const { store, failWrites } = harness();
    failWrites(true);

    await state(store).boot();

    expect(state(store).phase).toBe('error');
    expect(state(store).game).toBeNull();
    expect(state(store).banner).toEqual({
      tone: 'error',
      text: 'No se pudo cargar la partida guardada.',
    });
  });
});

/** Two balls out, then a `pool_json` that lost every remaining number. */
function harnessGameWithBrokenPool(repo: GameRepository): Game {
  const rng = mulberry32(11);
  let game = createGame(PRESETS.eu90, rng, START);
  for (let i = 0; i < 2; i++) {
    const result = draw(game, START + i + 1);
    if (!result.ok) {
      throw new Error('unexpected exhaustion');
    }
    game = result.value.game;
  }
  repo.save({ ...game, pool: [] });
  return game;
}

describe('gameStore — draw (§2.5, §7.9)', () => {
  it('commits the draw before exposing it', async () => {
    const { store, repo } = harness();
    await state(store).boot();

    state(store).drawBall();

    const stored = repo.loadCurrent();
    expect(stored?.history).toHaveLength(1);
    expect(stored?.history[0]?.number).toBe(state(store).game?.history[0]?.number);
    expect(stored?.pool).toHaveLength(89);
    expect(state(store).banner).toBeNull();
  });

  it('keeps the state untouched and reports when the commit fails', async () => {
    const { store, failWrites } = harness();
    await state(store).boot();
    const before = state(store).game;

    failWrites(true);
    state(store).drawBall();

    expect(state(store).game).toBe(before);
    expect(state(store).banner).toEqual({
      tone: 'error',
      text: 'No se pudo guardar la extracción.',
    });
  });

  it('ignores a second tap while the lock is held, then releases it', async () => {
    jest.useFakeTimers();
    const { store, repo } = harness();
    await state(store).boot();

    state(store).drawBall();
    state(store).drawBall();

    expect(state(store).busy).toBe(true);
    expect(repo.loadCurrent()?.history).toHaveLength(1);

    jest.advanceTimersByTime(BUSY_MS);

    expect(state(store).busy).toBe(false);
    jest.useRealTimers();
  });

  it('does nothing when the bombo is empty', async () => {
    const { store, repo, seed } = harness();
    seed(2, { ...PRESETS.eu90, min: 1, max: 2 });
    await state(store).boot();
    expect(state(store).game?.status).toBe('exhausted');

    state(store).drawBall();

    expect(repo.loadCurrent()?.history).toHaveLength(2);
    expect(state(store).game?.history).toHaveLength(2);
  });
});

describe('gameStore — undo (§2.6, INV-1)', () => {
  it('returns the ball to the pool, persists it and survives a reload', async () => {
    const { store, repo, seed } = harness();
    const seeded = seed(1);
    await state(store).boot();
    const undone = seeded.history[0]!.number;

    state(store).undoBall();

    expect(state(store).game?.history).toHaveLength(0);
    expect(state(store).game?.pool).toHaveLength(90);
    expect(state(store).game?.status).toBe('running');

    // The undo is durable: the repository holds exactly the same state.
    const reloaded = repo.loadCurrent();
    expect(reloaded?.history).toHaveLength(0);
    expect(reloaded?.pool).toHaveLength(90);
    expect(reloaded?.pool.at(-1)).toBe(undone);
  });

  it('makes the next draw return exactly the undone ball', async () => {
    const { store, seed } = harness();
    const seeded = seed(1);
    await state(store).boot();
    const undone = seeded.history[0]!.number;

    state(store).undoBall();
    state(store).drawBall();

    expect(state(store).game?.history[0]?.number).toBe(undone);
  });

  it('is a no-op when there is no history', async () => {
    const { store, repo } = harness();
    await state(store).boot();
    const before = state(store).game;

    state(store).undoBall();

    expect(state(store).game).toBe(before);
    expect(state(store).banner).toBeNull();
    expect(repo.loadCurrent()?.history).toHaveLength(0);
  });

  it('reactivates an exhausted game', async () => {
    const { store, seed } = harness();
    seed(2, { ...PRESETS.eu90, min: 1, max: 2 });
    await state(store).boot();
    expect(state(store).game?.status).toBe('exhausted');

    state(store).undoBall();

    expect(state(store).game?.status).toBe('running');
    expect(state(store).game?.history).toHaveLength(1);
    expect(state(store).game?.finishedAt).toBeNull();
  });

  it('keeps the state untouched and reports when the undo write fails', async () => {
    const { store, seed, failWrites } = harness();
    seed(1);
    await state(store).boot();
    const before = state(store).game;

    failWrites(true);
    state(store).undoBall();

    expect(state(store).game).toBe(before);
    expect(state(store).banner).toEqual({
      tone: 'error',
      text: 'No se pudo deshacer la extracción.',
    });
  });
});

describe('gameStore — new game (§2.4, §7.6)', () => {
  it('starts a fresh game over the same range and archives the previous one', async () => {
    const { store, repo, seed } = harness();
    seed(1);
    await state(store).boot();
    const previousId = state(store).game!.id;
    const range = state(store).game!.range;

    state(store).startNewGame();

    expect(state(store).game?.id).not.toBe(previousId);
    expect(state(store).game?.history).toHaveLength(0);
    expect(state(store).game?.pool).toHaveLength(90);
    expect(state(store).game?.range).toEqual(range);
    expect(repo.loadCurrent()?.id).toBe(state(store).game?.id);
  });

  it('keeps the current game and reports when the write fails', async () => {
    const { store, failWrites } = harness();
    await state(store).boot();
    const before = state(store).game;

    failWrites(true);
    state(store).startNewGame();

    expect(state(store).game).toBe(before);
    expect(state(store).banner).toEqual({
      tone: 'error',
      text: 'No se pudo crear la partida.',
    });
  });
});
