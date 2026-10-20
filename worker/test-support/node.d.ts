// The scaffold does not install @types/node. Declare only the test APIs used here.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): { all(...values: unknown[]): Record<string, unknown>[]; run(...values: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint } };
    close(): void;
  }
}
declare module 'node:fs' { export function readFileSync(path: URL, encoding: 'utf8'): string; }
