import type { Sqlite } from '../sqlite';

import { SQL as initSql } from './001_init';

/**
 * Ordered migrations applied at startup (plan §5.5).
 *
 * Each migration runs in a transaction stamped with `PRAGMA user_version`, so
 * a failure rolls both the schema and the version back: the database is left
 * exactly as it was and the caller enters safe mode (§5.5, §7.7). Data is never
 * deleted to "fix" a schema.
 *
 * v1 is the baseline — there is no older schema to back up yet. The pre-migration
 * file copy the plan requires belongs here once `002_…` exists.
 */
export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
};

export const MIGRATIONS: readonly Migration[] = [{ version: 1, name: 'init', sql: initSql }];

export type MigrationReport = {
  /** Versions committed by this run, in order. */
  readonly applied: readonly number[];
  /** True when a migration failed: the app must start in read-only safe mode. */
  readonly failed: boolean;
};

export function applyMigrations(
  db: Sqlite,
  migrations: readonly Migration[] = MIGRATIONS,
): MigrationReport {
  const current = currentVersion(db);
  const applied: number[] = [];

  for (const migration of migrations) {
    if (migration.version <= current) {
      continue;
    }
    try {
      db.transaction(() => {
        db.exec(migration.sql);
        db.exec(`PRAGMA user_version = ${migration.version}`);
      });
    } catch {
      // The transaction already rolled back: schema and version are untouched.
      return { applied, failed: true };
    }
    applied.push(migration.version);
  }

  return { applied, failed: false };
}

/**
 * `PRAGMA user_version` always returns exactly one row on both engines, hence
 * the non-null assertion: a missing row would be an engine failure, and the
 * caller already treats a thrown migration as safe mode (§7.7).
 */
function currentVersion(db: Sqlite): number {
  return Number(db.get('PRAGMA user_version')!.user_version);
}
