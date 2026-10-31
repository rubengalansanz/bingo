/**
 * The SQL port the persistence layer talks to (plan §5.2, §5.5).
 *
 * Deliberately **synchronous**: `commitDraw` has to be atomic with the state
 * update that follows it (§2.5 "commit antes de animar"), a synchronous
 * transaction cannot interleave with anything, and the same code then runs
 * unchanged against better-sqlite3 in the Node test suite (§8.1). The app-side
 * implementation lives in `src/shared/db/`, keeping `core` free of native
 * modules exactly like the CSPRNG port (§5.2).
 */

/** Every value SQLite can bind and both engines return as a JS primitive. */
export type SqlValue = string | number | null;

export type SqlParams = readonly SqlValue[];

export type SqlRunResult = {
  readonly changes: number;
};

export type SqlRow = Record<string, SqlValue>;

export interface Sqlite {
  /** Executes one or more statements with no parameters. */
  exec(sql: string): void;
  /** Runs a statement; throws on constraint violation. */
  run(sql: string, params?: SqlParams): SqlRunResult;
  /** First row, or `null` when the statement matches nothing. */
  get(sql: string, params?: SqlParams): SqlRow | null;
  /** All rows, empty when the statement matches nothing. */
  all(sql: string, params?: SqlParams): SqlRow[];
  /**
   * Runs `fn` inside BEGIN/COMMIT. Rolls back and rethrows if `fn` throws, so
   * an insert that violates a constraint leaves the database untouched (§2.9).
   */
  transaction<T>(fn: () => T): T;
}
