const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function withState(logFile, fn) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const db = new DatabaseSync(`${logFile}.sqlite`, { timeout: 10000 });
  try {
    db.exec("PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (sequence INTEGER PRIMARY KEY, record TEXT NOT NULL, replay TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS memory (sequence INTEGER PRIMARY KEY, category TEXT NOT NULL, value TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS memory_category ON memory(category, sequence);`);
      const result = fn(db);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

function importOnce(db, key, fn) {
  if (db.prepare("SELECT value FROM metadata WHERE key=?").get(key)) return;
  fn();
  db.prepare("INSERT INTO metadata(key,value) VALUES(?,?)").run(key, new Date().toISOString());
}

function readLegacyLines(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`Legacy audit is invalid at line ${index + 1}; repair a copy before migration`); }
  });
}

module.exports = { withState, importOnce, readLegacyLines };
