import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { applyMigrations } from '@/core/db/migrations';
import { createGameRepository, type GameRepository } from '@/core/db/repositories/game.repository';
import type { SqlRow, Sqlite } from '@/core/db/sqlite';

/**
 * The expo-sqlite side of the `Sqlite` port (plan §5.5).
 *
 * Same connection contract as the Node test adapter (§8.1): WAL, foreign keys
 * on, transactions through BEGIN/COMMIT with rollback on throw. This is the
 * only file in the app that touches expo-sqlite — `core` stays free of native
 * modules, exactly like the CSPRNG port (§5.2, `shared/random/expoCryptoSource`).
 */
export function expoSqlite(db: SQLiteDatabase): Sqlite {
  return {
    exec: (sql) => {
      db.execSync(sql);
    },
    run: (sql, params) => db.runSync(sql, [...(params ?? [])]),
    get: (sql, params) => db.getFirstSync<SqlRow>(sql, [...(params ?? [])]),
    all: (sql, params) => db.getAllSync<SqlRow>(sql, [...(params ?? [])]),
    transaction: <T>(fn: () => T): T => {
      let out!: T;
      db.withTransactionSync(() => {
        out = fn();
      });
      return out;
    },
  };
}

/** Opens the game database with the connection settings from §5.5. */
export function openGameDatabase(name = 'game.db'): Sqlite {
  const db = openDatabaseSync(name);
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return expoSqlite(db);
}

let cached: GameRepository | null = null;

/**
 * Process-wide repository: open + migrate once, on first use (plan §5.7,
 * "_layout: DB bootstrap"). Bootstrapping lazily keeps module import side
 * effects out of the router.
 *
 * A failed migration throws instead of handing back a repository that cannot
 * work: the caller shows the failure and the app stays read-only rather than
 * pretending a game is loadable (§5.5, §7.7).
 */
export function gameRepository(): GameRepository {
  if (cached === null) {
    const db = openGameDatabase();
    const report = applyMigrations(db);
    if (report.failed) {
      throw new Error('database migration failed');
    }
    cached = createGameRepository(db);
  }
  return cached;
}
