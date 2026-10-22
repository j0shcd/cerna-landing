import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function database(migrate = true): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync(new URL('../../migrations/0001_waitlist.sql', import.meta.url), 'utf8'));
  if (migrate) sqlite.exec(readFileSync(new URL('../../migrations/0002_welcome_unsubscribe.sql', import.meta.url), 'utf8'));
  class Statement {
    constructor(readonly sql: string, readonly values: unknown[] = []) {}
    bind(...values: unknown[]) { return new Statement(this.sql, values); }
    async first(column?: string) {
      const row = sqlite.prepare(this.sql).all(...this.values)[0] ?? null;
      return column && row ? row[column] : row;
    }
    async all() {
      return { success: true, results: sqlite.prepare(this.sql).all(...this.values), meta: {} };
    }
    async run() {
      const result = sqlite.prepare(this.sql).run(...this.values);
      return { success: true, results: [], meta: { changes: Number(result.changes) } };
    }
  }
  const db = {
    prepare(sql: string) { return new Statement(sql); },
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  return { db, sqlite };
}
