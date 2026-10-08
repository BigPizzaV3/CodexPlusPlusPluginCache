/**
 * SQLite access layer built on Node's built-in `node:sqlite`.
 *
 * This module isolates all raw SQL behind a thin wrapper so the storage engine
 * can be swapped for Prisma + better-sqlite3 in the canonical stack without
 * touching the engine/report/api packages. Schema is applied via numbered
 * migrations tracked in the `settings('schema_version')` row.
 */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "./util.ts";
import { MIGRATIONS } from "./migrations.ts";

export interface DB {
  raw: DatabaseSync;
  run(sql: string, params?: unknown[]): void;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  tx<T>(fn: () => T): T;
  close(): void;
}

export function openDb(filePath: string): DB {
  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }
  const raw = new DatabaseSync(filePath);
  raw.exec("PRAGMA journal_mode = WAL;");
  raw.exec("PRAGMA foreign_keys = ON;");

  const db: DB = {
    raw,
    run(sql, params = []) {
      raw.prepare(sql).run(...(params as never[]));
    },
    get(sql, params = []) {
      return raw.prepare(sql).get(...(params as never[])) as never;
    },
    all(sql, params = []) {
      return raw.prepare(sql).all(...(params as never[])) as never;
    },
    tx(fn) {
      raw.exec("BEGIN");
      try {
        const r = fn();
        raw.exec("COMMIT");
        return r;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
    close() {
      try {
        raw.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch {
        /* ignore checkpoint errors on close */
      }
      raw.close();
    },
  };

  migrate(db);
  return db;
}

function currentVersion(db: DB): number {
  db.run(
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  );
  const row = db.get<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'schema_version'`,
  );
  return row ? Number(JSON.parse(row.value)) : 0;
}

function migrate(db: DB): void {
  const from = currentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > from);
  if (pending.length === 0) return;
  for (const m of pending) {
    db.tx(() => {
      db.raw.exec(m.sql);
      db.run(
        `INSERT INTO settings(key, value) VALUES('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [JSON.stringify(m.version)],
      );
    });
    logger.info("migration applied", { version: m.version, name: m.name });
  }
}
