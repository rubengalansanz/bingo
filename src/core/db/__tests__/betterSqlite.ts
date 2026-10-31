import Database from 'better-sqlite3';

import type { SqlRow, Sqlite } from '../sqlite';

/**
 * better-sqlite3 implementation of the `Sqlite` port (plan §8.1: "SQLite real
 * en Node, mismo SQL"). Not a test itself — Jest only picks up `*.test.ts`.
 *
 * Mirrors the app adapter exactly: same PRAGMAs, same transaction semantics,
 * so what passes here runs unchanged on the device.
 */

type RawDatabase = InstanceType<typeof Database>;

export type TestDatabase = Sqlite & {
  /** Escape hatch for assertions about engine-level state (`user_version`, …). */
  readonly raw: RawDatabase;
  close(): void;
};

export function memorySqlite(): TestDatabase {
  return wrap(new Database(':memory:'));
}

export function fileSqlite(path: string): TestDatabase {
  return wrap(new Database(path));
}

function wrap(raw: RawDatabase): TestDatabase {
  // Same connection setup the app adapter performs (§5.5).
  raw.pragma('foreign_keys = ON');

  return {
    raw,
    close: () => raw.close(),
    exec: (sql) => {
      raw.exec(sql);
    },
    run: (sql, params) => {
      const info = raw.prepare(sql).run(...(params ?? []));
      return { changes: Number(info.changes) };
    },
    get: (sql, params) => (raw.prepare(sql).get(...(params ?? [])) as SqlRow | undefined) ?? null,
    all: (sql, params) => raw.prepare(sql).all(...(params ?? [])) as SqlRow[],
    transaction: <T>(fn: () => T): T => raw.transaction(fn)(),
  };
}
