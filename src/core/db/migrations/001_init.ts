/**
 * Migration 001 — initial schema (plan §5.5).
 *
 * Written as a TypeScript string rather than a `.sql` file because the same
 * statement text must run in two engines: Metro cannot import raw SQL at
 * runtime, while the Node test suite (§8.1) reads this module directly. One
 * source of truth, two SQLite builds.
 *
 * PRAGMAs (WAL, foreign_keys) are *connection* settings and are applied by the
 * adapter, not here: `PRAGMA journal_mode` cannot run inside the migration's
 * transaction.
 */
export const SQL = `
CREATE TABLE game (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  status        TEXT    NOT NULL CHECK (status IN ('running','exhausted','abandoned')),
  preset        TEXT    NOT NULL CHECK (preset IN ('eu90','us75','n80','custom')),
  min_value     INTEGER NOT NULL,
  max_value     INTEGER NOT NULL,
  label_mode    TEXT    NOT NULL CHECK (label_mode IN ('number','letter-number')),
  pool_json     TEXT    NOT NULL,   -- remaining order: the last element is the next ball
  draw_count    INTEGER NOT NULL DEFAULT 0,
  seed          INTEGER,            -- reproducible mode only (§2.8)
  CHECK (min_value < max_value),
  CHECK (draw_count >= 0)
);

-- Only one game may be active at a time (§5.5)
CREATE UNIQUE INDEX ux_game_active ON game(status) WHERE status = 'running';

-- INV-1 enforced by storage: a ball cannot be recorded twice (§2.9, capa 6)
CREATE TABLE draw (
  game_id   TEXT    NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,   -- 1..n, monotonic (§2.9, capa 7)
  number    INTEGER NOT NULL,
  drawn_at  INTEGER NOT NULL,
  PRIMARY KEY (game_id, position),
  UNIQUE (game_id, number)
);

CREATE INDEX ix_draw_game_time ON draw(game_id, drawn_at);
`;
