/** Numbered, ordered schema migrations. Never edit an APPLIED migration in a
 *  shipped product; add a new one. (v1 is being (re)defined pre-release for the
 *  manual-import architecture — no production databases exist yet.) */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "manual_import_schema",
    sql: /* sql */ `
      -- One row per USER-PROVIDED file. The ONLY entry point for data.
      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        original_filename TEXT NOT NULL,
        file_type TEXT,                    -- jsonl | json | gz | zip | txt
        stored_path TEXT,                  -- verbatim copy in import storage
        size INTEGER NOT NULL DEFAULT 0,
        hash TEXT NOT NULL,                -- SHA-256 of raw bytes (dedup)
        status TEXT NOT NULL DEFAULT 'pending',
        detected_format TEXT,              -- codex | git-log | generic | unknown
        event_count INTEGER NOT NULL DEFAULT 0,
        activity_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        imported_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_imports_hash ON imports(hash);
      CREATE INDEX IF NOT EXISTS idx_imports_at ON imports(imported_at);

      -- A parsed session (Codex rollout, or a synthetic session per import member).
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
        source_member TEXT,                -- filename within a zip, if any
        cwd TEXT,
        cli_version TEXT,
        model TEXT,
        git_branch TEXT,
        git_commit TEXT,
        started_at TEXT,
        ended_at TEXT,
        event_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_import ON sessions(import_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

      -- Verbatim raw events (never dropped; audit trail). Cascades from import.
      CREATE TABLE IF NOT EXISTS raw_events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        ts TEXT,
        ts_epoch INTEGER,
        root_type TEXT,
        payload_type TEXT,                 -- unknown types preserved as 'unknown'
        role TEXT,
        tool_name TEXT,
        raw TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_raw_events_import ON raw_events(import_id);
      CREATE INDEX IF NOT EXISTS idx_raw_events_ts ON raw_events(ts_epoch);
      CREATE INDEX IF NOT EXISTS idx_raw_events_ptype ON raw_events(payload_type);

      -- Projects inferred ONLY from metadata inside imported files.
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other', -- work | personal | university | other
        root_path TEXT,                     -- metadata string only; never visited
        git_remote TEXT,
        detected_from TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_root ON projects(root_path);

      -- Commits parsed from imported git-log text or embedded in Codex logs.
      CREATE TABLE IF NOT EXISTS commits (
        id TEXT PRIMARY KEY,
        import_id TEXT REFERENCES imports(id) ON DELETE CASCADE,
        repository_id TEXT,
        project_id TEXT,
        hash TEXT NOT NULL,
        author_name TEXT,
        author_email TEXT,
        committed_at TEXT,
        committed_epoch INTEGER,
        message TEXT,
        branch TEXT,
        files_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project_id);
      CREATE INDEX IF NOT EXISTS idx_commits_epoch ON commits(committed_epoch);
      CREATE INDEX IF NOT EXISTS idx_commits_import ON commits(import_id);

      -- Evidence-backed activities. import_id is null for manual entries.
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,               -- codex | git | manual
        import_id TEXT REFERENCES imports(id) ON DELETE CASCADE,
        project_id TEXT,
        started_at TEXT,
        ended_at TEXT,
        started_epoch INTEGER,
        ended_epoch INTEGER,
        category TEXT NOT NULL DEFAULT 'other',
        title TEXT NOT NULL,
        summary TEXT,
        status TEXT NOT NULL DEFAULT 'unknown',
        confidence REAL NOT NULL DEFAULT 0,
        review_state TEXT NOT NULL DEFAULT 'pending',
        merged_into TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
      CREATE INDEX IF NOT EXISTS idx_activities_import ON activities(import_id);
      CREATE INDEX IF NOT EXISTS idx_activities_epoch ON activities(started_epoch);
      CREATE INDEX IF NOT EXISTS idx_activities_source ON activities(source);
      CREATE INDEX IF NOT EXISTS idx_activities_review ON activities(review_state);
      CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);

      -- Evidence rows cascade when their activity is deleted.
      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        label TEXT NOT NULL,
        detail TEXT,
        ts TEXT,
        ts_epoch INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_evidence_activity ON evidence(activity_id);

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        style TEXT NOT NULL,
        length TEXT NOT NULL,
        provider TEXT NOT NULL,
        range_start TEXT,
        range_end TEXT,
        filters_json TEXT,
        content TEXT,
        input_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
    `,
  },
  {
    version: 2,
    name: "import_diagnostics",
    sql: /* sql */ `
      -- Safe, counts-only extraction diagnostics (JSON). No raw content.
      ALTER TABLE imports ADD COLUMN diagnostics TEXT;
    `,
  },
  {
    version: 3,
    name: "report_language",
    sql: /* sql */ `
      -- Report output language (auto|en|pt), resolved to en|pt at generation.
      ALTER TABLE reports ADD COLUMN language TEXT;
    `,
  },
];
