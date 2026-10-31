import type { DrawRecord, Game, GameStatus, LabelMode, RangePreset } from '../../engine/types';
import type { Sqlite } from '../sqlite';

/**
 * Persistence for the current game (plan §5.5, ADR-03/ADR-06).
 *
 * Two rules define this file:
 *
 * - **One transaction per fact.** `commitDraw` writes the draw row *and* the
 *   new pool in a single transaction (§2.5, §2.9 capa 5): there is no instant
 *   where the history says one thing and the pool another.
 * - **Storage defends INV-1 too.** `UNIQUE (game_id, number)` means a bug that
 *   tries to record a ball twice fails at the database, not at the user
 *   (§2.9 capa 6). The error propagates so the UI can show it; nothing is
 *   committed.
 *
 * Rows are typed: SQLite only ever returns primitives, and the schema's CHECK
 * constraints (`status`, `preset`, `label_mode`, `min < max`) guarantee the
 * domain unions — that is why the mappings below are casts and not validators.
 */

type GameRow = {
  id: string;
  created_at: number;
  finished_at: number | null;
  status: GameStatus;
  preset: RangePreset;
  min_value: number;
  max_value: number;
  label_mode: LabelMode;
  pool_json: string;
  draw_count: number;
  seed: number | null;
};

type DrawRow = {
  position: number;
  number: number;
  drawn_at: number;
};

const GAME_COLUMNS =
  'id, created_at, finished_at, status, preset, min_value, max_value, label_mode, pool_json, draw_count, seed';

const GAME_VALUES = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';

const GAME_UPSERT = `
  ON CONFLICT(id) DO UPDATE SET
    created_at = excluded.created_at,
    finished_at = excluded.finished_at,
    status = excluded.status,
    preset = excluded.preset,
    min_value = excluded.min_value,
    max_value = excluded.max_value,
    label_mode = excluded.label_mode,
    pool_json = excluded.pool_json,
    draw_count = excluded.draw_count,
    seed = excluded.seed`;

export type GameRepository = {
  /**
   * The game the app is about, or `null` on first launch (§7.7). Ordering is
   * `rowid DESC` — insertion order — so it never depends on two games sharing
   * a millisecond timestamp.
   */
  loadCurrent(): Game | null;
  /** Persists a brand new game, archiving the active one first (§2.7). */
  saveNew(game: Game): void;
  /** Persists a whole game; used by the integrity repair (§2.5). */
  save(game: Game): void;
  /** `INSERT draw` + `UPDATE game` in one transaction (§2.5). */
  commitDraw(game: Game, record: DrawRecord): void;
};

export function createGameRepository(db: Sqlite): GameRepository {
  return {
    loadCurrent: () => loadCurrent(db),
    saveNew: (game) => saveNew(db, game),
    save: (game) => db.transaction(() => writeGame(db, game)),
    commitDraw: (game, record) => commitDraw(db, game, record),
  };
}

function loadCurrent(db: Sqlite): Game | null {
  const row = db.get(
    `SELECT * FROM game WHERE status IN ('running', 'exhausted') ORDER BY rowid DESC LIMIT 1`,
  );
  if (row === null) {
    return null;
  }

  const gameRow = row as GameRow;
  const drawRows = db.all(
    'SELECT position, number, drawn_at FROM draw WHERE game_id = ? ORDER BY position ASC',
    [gameRow.id],
  ) as DrawRow[];

  return {
    id: gameRow.id,
    range: {
      preset: gameRow.preset,
      min: gameRow.min_value,
      max: gameRow.max_value,
      labelMode: gameRow.label_mode,
    },
    // A broken or missing blob degrades to an empty pool; `integrityCheck`
    // rebuilds it from the history on load (§2.5, §7.7: nunca un crash).
    pool: parsePool(gameRow.pool_json),
    history: drawRows.map((d) => ({ number: d.number, position: d.position, drawnAt: d.drawn_at })),
    status: gameRow.status,
    createdAt: gameRow.created_at,
    finishedAt: gameRow.finished_at,
    seed: gameRow.seed,
  };
}

function commitDraw(db: Sqlite, game: Game, record: DrawRecord): void {
  db.transaction(() => {
    db.run('INSERT INTO draw (game_id, position, number, drawn_at) VALUES (?, ?, ?, ?)', [
      game.id,
      record.position,
      record.number,
      record.drawnAt,
    ]);
    db.run(
      'UPDATE game SET pool_json = ?, draw_count = ?, status = ?, finished_at = ? WHERE id = ?',
      [JSON.stringify(game.pool), game.history.length, game.status, game.finishedAt, game.id],
    );
  });
}

function saveNew(db: Sqlite, game: Game): void {
  db.transaction(() => {
    // Only one active game may exist (partial unique index, §5.5); the previous
    // one becomes archived history instead of being deleted (§2.4).
    db.run(`UPDATE game SET status = 'abandoned' WHERE status = 'running'`);
    writeGame(db, game);
  });
}

function writeGame(db: Sqlite, game: Game): void {
  db.run(`INSERT INTO game (${GAME_COLUMNS}) VALUES (${GAME_VALUES})${GAME_UPSERT}`, [
    game.id,
    game.createdAt,
    game.finishedAt,
    game.status,
    game.range.preset,
    game.range.min,
    game.range.max,
    game.range.labelMode,
    JSON.stringify(game.pool),
    game.history.length,
    game.seed,
  ]);

  // The draw log is a projection of `history`: replace it wholesale.
  db.run('DELETE FROM draw WHERE game_id = ?', [game.id]);
  for (const record of game.history) {
    db.run('INSERT INTO draw (game_id, position, number, drawn_at) VALUES (?, ?, ?, ?)', [
      game.id,
      record.position,
      record.number,
      record.drawnAt,
    ]);
  }
}

/** `pool_json` → array; anything unparseable becomes an empty pool (§2.5). */
function parsePool(json: string): number[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}
