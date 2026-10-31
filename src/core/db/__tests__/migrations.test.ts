import { MIGRATIONS, applyMigrations } from '../migrations';
import { memorySqlite } from './betterSqlite';

describe('applyMigrations (§5.5)', () => {
  it('applies the v1 baseline and stamps user_version', () => {
    const db = memorySqlite();

    const report = applyMigrations(db);

    expect(report).toEqual({ applied: [1], failed: false });
    expect(db.raw.pragma('user_version', { simple: true })).toBe(1);
    expect(
      db.get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'game'`),
    ).not.toBeNull();
    expect(
      db.get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'draw'`),
    ).not.toBeNull();
    db.close();
  });

  it('is idempotent: a second run applies nothing', () => {
    const db = memorySqlite();

    expect(applyMigrations(db).applied).toEqual([1]);
    expect(applyMigrations(db)).toEqual({ applied: [], failed: false });
    db.close();
  });

  it('reports failure and rolls back when a migration breaks (§7.7)', () => {
    const db = memorySqlite();

    const report = applyMigrations(db, [
      { version: 1, name: 'half', sql: 'CREATE TABLE temp_table (a INTEGER); THIS IS SQL.' },
    ]);

    expect(report.failed).toBe(true);
    expect(report.applied).toEqual([]);
    // Rolled back: neither the table nor the version stamp survived.
    expect(db.get(`SELECT name FROM sqlite_master WHERE name = 'temp_table'`)).toBeNull();
    expect(db.raw.pragma('user_version', { simple: true })).toBe(0);
    db.close();
  });

  it('keeps the migrations that already succeeded when a later one fails', () => {
    const db = memorySqlite();

    const report = applyMigrations(db, [
      ...MIGRATIONS,
      { version: 2, name: 'broken', sql: 'CREATE TABLE v2_table (a INTEGER); NOT SQL AT ALL;' },
    ]);

    expect(report).toEqual({ applied: [1], failed: true });
    expect(db.raw.pragma('user_version', { simple: true })).toBe(1);
    expect(db.get(`SELECT name FROM sqlite_master WHERE name = 'v2_table'`)).toBeNull();
    db.close();
  });

  it('defines a strictly ordered migration list', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(versions[0]).toBe(1);
  });
});
