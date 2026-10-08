/**
 * DevRecap shared domain types — the single source of truth for the data model.
 *
 * These types describe the normalized internal representation used across the
 * ingestion → extraction → activity → evidence → report pipeline.
 */

// ---------------------------------------------------------------------------
// Sources & adapters
// ---------------------------------------------------------------------------

export type SourceKind = "codex" | "git" | "manual";

/**
 * An imported file/source. DevRecap only ever knows about data the user
 * explicitly imported — there is no automatic discovery, scanning, or
 * connection to any developer tool. Every raw event, activity and piece of
 * evidence traces back to one of these records.
 */
export type ImportStatus =
  | "uploaded"    // bytes received & stored; NOT yet analyzed (awaiting user)
  | "pending"     // queued for analysis
  | "processing"  // analysis in progress
  | "completed"   // analyzed; no malformed records
  | "partial"     // analyzed; some malformed records were skipped
  | "failed";     // analysis could not produce any events

export interface ImportedSource {
  id: string;
  /** Optional grouping label for a batch (e.g. "Codex September 9"). */
  batchId?: string;
  originalFilename: string;
  /** File extension/type as provided, e.g. 'jsonl' | 'json' | 'gz' | 'zip' | 'txt'. */
  fileType: string;
  importedAt: string;
  size: number;
  /** SHA-256 of the raw file bytes, used for duplicate detection. */
  hash: string;
  status: ImportStatus;
  /** Adapter/format detected, e.g. 'codex' | 'git-log' | 'generic' | 'unknown'. */
  detectedFormat?: string;
  eventCount?: number;
  activityCount?: number;
  errorCount?: number;
  warningCount?: number;
  error?: string;
  /** Safe, counts-only extraction diagnostics (no raw content). */
  diagnostics?: unknown;
}

/** A raw event as parsed from a source, before normalization. Never dropped. */
export interface RawEvent {
  sessionId?: string;
  /** Line/record index within the source file. */
  seq: number;
  ts?: string;
  /** Root discriminator, e.g. 'session_meta' | 'response_item' | 'event_msg'. */
  rootType: string;
  /** Nested discriminator, e.g. 'message' | 'function_call'. */
  payloadType?: string;
  role?: string;
  toolName?: string;
  cwd?: string;
  data: unknown;
  /** Verbatim source line for the audit trail. */
  raw: string;
}

/**
 * An import source adapter consumes the CONTENT of a user-provided file and
 * produces raw events. All current and future integrations (Codex, Git-log,
 * Claude Code, Kiro, Cursor, Gemini exports) implement this same contract.
 *
 * Adapters NEVER discover, open, watch, or connect to the originating tool —
 * they only parse the bytes the user explicitly imported.
 */
export interface ImportSourceAdapter {
  readonly kind: string;
  /** Confidence (0..1) that this adapter recognizes the content. */
  detect(content: string, filename: string): number;
  /** Parse recognized content into raw events + malformed/error counts. */
  parseContent(content: string): { events: RawEvent[]; malformed: number; sessionId?: string };
}

// ---------------------------------------------------------------------------
// Normalized events
// ---------------------------------------------------------------------------

export type NormalizedEventKind =
  | "user_request"
  | "assistant_action"
  | "shell_command"
  | "file_read"
  | "file_edit"
  | "test_run"
  | "error"
  | "git_op"
  | "note";

/** How a file was involved. Only `edit`/`create`/`delete` count as work. */
export type FileOp = "read" | "edit" | "create" | "delete" | "mention";

export interface NormalizedEvent {
  sessionId?: string;
  ts: string;
  tsEpoch: number;
  kind: NormalizedEventKind;
  cwd?: string;
  /** Free text: request text, assistant message, or error text. */
  text?: string;
  /** Shell command string when kind === 'shell_command'/'file_read'. */
  command?: string;
  /** Files affected — interpretation depends on `fileOp`. */
  files?: string[];
  /** The file operation (read/edit/create/delete/mention) when file-related. */
  fileOp?: FileOp;
  /** Test result when known. */
  passed?: boolean;
  /** Git subcommand when kind === 'git_op'. */
  gitOp?: string;
  /** Tool call_id (unified custom_tool_call) — used to correlate a tool call
   *  with its later custom_tool_call_output (result). */
  callId?: string;
  /** Link back to the originating raw event's seq within its session. */
  rawEventSeq: number;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type ProjectType = "work" | "personal" | "university" | "other";

export interface Project {
  id: string;
  name: string;
  displayName: string;
  type: ProjectType;
  rootPath?: string;
  gitRemote?: string;
  detectedFrom?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Activities & evidence
// ---------------------------------------------------------------------------

export type ActivityCategory =
  | "feature"
  | "bugfix"
  | "investigation"
  | "refactor"
  | "testing"
  | "documentation"
  | "git"
  | "deployment"
  | "configuration"
  | "database"
  | "other";

export type ActivityStatus =
  | "completed"
  | "in_progress"
  | "blocked"
  | "unknown";

export type ReviewState =
  | "pending"
  | "approved"
  | "ignored"
  | "edited"
  | "merged";

export type EvidenceKind =
  | "codex_message"
  | "shell_command"
  | "edited_file"
  | "test_run"
  | "git_commit"
  | "git_diff"
  | "manual_note"
  | "error";

export interface Evidence {
  id: string;
  activityId: string;
  kind: EvidenceKind;
  /** e.g. 'raw_event' | 'commit'. */
  refType?: string;
  refId?: string;
  label: string;
  detail?: string;
  ts?: string;
  tsEpoch?: number;
}

export interface Activity {
  id: string;
  source: SourceKind;
  projectId?: string;
  startedAt: string;
  endedAt?: string;
  category: ActivityCategory;
  title: string;
  summary: string;
  status: ActivityStatus;
  confidence: number;
  reviewState: ReviewState;
  mergedInto?: string;
  evidence?: Evidence[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

export interface Repository {
  id: string;
  projectId?: string;
  rootPath: string;
  gitRemote?: string;
  defaultBranch?: string;
  lastScannedAt?: string;
  lastCommitHash?: string;
}

export interface Commit {
  id: string;
  repositoryId: string;
  projectId?: string;
  hash: string;
  authorName?: string;
  authorEmail?: string;
  committedAt: string;
  committedEpoch: number;
  message: string;
  branch?: string;
  files: string[];
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportKind =
  | "daily" | "weekly" | "custom" | "monthly"
  // Semantics V3 report modes:
  | "help_me_remember" // detailed memory-refresh narrative
  | "review"           // sprint/weekly review, bulleted per workstream
  | "executive";       // top-level executive summary
export type ReportStyle = "spoken" | "professional" | "executive" | "technical";
export type ReportLength = "short" | "normal" | "detailed";
/** Report output language. `auto` = infer from the period's user intents. */
export type ReportLanguage = "auto" | "en" | "pt";

/**
 * How a piece of work fits the developer's memory of the day (Synthesis V2):
 *  - primary: real feature/bugfix/config/db/investigation work
 *  - support: git organization, test-only runs, pure inspection
 *  - operational: session/environment/tooling plumbing (resume, WSL, branch fiddling)
 *  - noise: no real work signal (should be filtered upstream)
 */
export type WorkKind = "primary" | "support" | "operational" | "noise";

/**
 * A compact, evidence-derived semantic profile of an activity (Grouping V3),
 * used to CLUSTER and NAME workstreams by objective rather than by generic
 * grammar. All fields are lowercased, deduped, and free of generic/stop words.
 */
export interface TopicProfile {
  domainTerms: string[];
  technologies: string[];
  components: string[];
  actions: string[];
  primarySignal: string;
}

export interface ActivitySummary {
  id: string;
  title: string;
  summary: string;
  category: ActivityCategory;
  status: ActivityStatus;
  confidence: number;
  startedAt: string;
  /** When the activity ended. Optional; callers fall back to startedAt when a
   *  real end time is not available (e.g. instantaneous or manual entries). */
  endedAt?: string;
  evidenceCount: number;
  /** A compact objective describing WHY the work existed (Semantic Composer).
   *  Derived from the activity's TopicProfile — never a technology list. */
  objective?: string;
  /** Named technical terms preserved from the activity's evidence. */
  techTerms?: string[];
  /** Work-kind classification (primary/support/operational). */
  workKind?: WorkKind;
  /** Coarse topic key used for grouping ("contract-pdf" | "git" | …). */
  topicKey?: string;
  /** File counts (summarized — never the raw file list) for narrative prose. */
  filesModifiedCount?: number;
  filesReadCount?: number;
  testCount?: number;
  errorCount?: number;
  /** True only when a real Git commit occurred (never inferred from output). */
  committed?: boolean;
  /** Precise git action when git-centric. */
  gitAction?: string;
  /** Distilled semantic signals for workstream clustering + naming (V3). */
  topicProfile?: TopicProfile;
}

export interface ReportProjectGroup {
  id: string;
  name: string;
  type: ProjectType;
  activities: ActivitySummary[];
}

/**
 * A Workstream groups strongly-related Activities that belong to one broader
 * objective (e.g. "Contract PDF generation"). Grouping is conservative and
 * NEVER deletes the underlying activities — it references them by order and
 * keeps the full list, so reports can expand a workstream into its steps.
 */
/**
 * Aggregated workstream outcome (Grouping V3) — richer than a single activity's
 * status. `partially_completed` when a workstream mixes completed and
 * unfinished members; `unconfirmed` when there simply isn't enough evidence.
 */
export type WorkstreamStatus =
  | "completed" | "partially_completed" | "in_progress" | "blocked" | "unconfirmed";

/** A ranked topic signal with its occurrence count (for diagnostics/naming). */
export interface TopicSignal { term: string; count: number; }

export interface Workstream {
  id: string;
  /** Human-readable workstream title (the broader objective). */
  title: string;
  projectId?: string;
  projectName?: string;
  /** Member activities, chronological. Preserved in full (no data loss). */
  activities: ActivitySummary[];
  /** Aggregated outcome across the members. */
  status: WorkstreamStatus;
  /** Dominant work kind for the workstream (primary/support/operational). */
  workKind: WorkKind;
  /** Coarse topic key ("contract-pdf" | "git" | "operational" | …). */
  topicKey: string;
  /** Distinct technical areas involved across members. */
  techTerms: string[];
  /** Ranked topic signals (term → count) that define this workstream. */
  topicSignals: TopicSignal[];
  /** The objective this workstream represents (WHY the work existed) — the
   *  human-readable purpose, distinct from the technologies used. */
  objective?: string;
  /** Significance score for ranking main vs secondary work (not raw count). */
  significance: number;
  startedAt: string;
  endedAt: string;
}

/** One sanitized timeline entry (for the optional "View timeline" detail). */
export interface TimelineEntry {
  ts: string;
  /** HH:MM local-ish label derived from ts. */
  time: string;
  title: string;
  status: ActivityStatus;
  workKind?: WorkKind;
  activityId: string;
  workstreamId: string;
}

/** Deterministic, sanitized snapshot fed to any ReportProvider. */
export interface ReportInput {
  kind: ReportKind;
  style: ReportStyle;
  length: ReportLength;
  language: ReportLanguage;
  /** The concrete language chosen after resolving `auto` (en | pt). */
  resolvedLanguage: "en" | "pt";
  durationSeconds?: number;
  range: { start: string; end: string };
  projects: ReportProjectGroup[];
  /** Workstreams derived from the activities in-range (grouping preserved). */
  workstreams: Workstream[];
  /** Sanitized chronological timeline for the optional "View timeline" detail. */
  timeline: TimelineEntry[];
  blockers: string[];
  nextSteps: string[];
  generatedAt: string;
}

export interface Report {
  id: string;
  kind: ReportKind;
  style: ReportStyle;
  length: ReportLength;
  language?: ReportLanguage;
  provider: string;
  rangeStart: string;
  rangeEnd: string;
  content: string;
  input: ReportInput;
  createdAt: string;
}

export interface ReportProvider {
  readonly name: string;
  /** True if this provider transmits data off the local machine. */
  readonly external: boolean;
  generateReport(input: ReportInput): Promise<{ content: string }>;
}

// ---------------------------------------------------------------------------
// Semantic Report Composer
// ---------------------------------------------------------------------------

/**
 * A structured, sanitized snapshot of the work — the ONLY thing a semantic
 * composer (deterministic or optional LLM) ever sees. It contains distilled
 * FACTS already extracted by DevRecap: never raw rollout files, raw Codex
 * sessions, full command output, source code, credentials, or repository
 * contents. Paths/commands that appear in imported data are NOT included here.
 */
export interface ReportContextActivity {
  id: string;
  /** Compact objective — WHY the work existed (not a technology list). */
  objective: string;
  category: ActivityCategory;
  status: ActivityStatus;
  confidence: number;
  /** One-line factual summary already produced deterministically. */
  summary: string;
  technicalTerms: string[];
  filesModifiedCount: number;
  filesReadCount: number;
  commandsSummary: string;   // e.g. "3 commands run"
  errorsSummary: string;     // e.g. "1 error encountered" or ""
  validationSummary: string; // e.g. "tests passed" | "tests failing" | ""
  startedAt: string;
  endedAt: string;
}

export interface ReportContextWorkstream {
  id: string;
  objective: string;
  status: WorkstreamStatus;
  workKind: WorkKind;
  technicalTerms: string[];
  /** IDs of the member activities (traceability — never detached). */
  activityIds: string[];
  significance: number;
}

export interface ReportContext {
  kind: ReportKind;
  language: "en" | "pt";
  length: ReportLength;
  period: { start: string; end: string };
  projects: { id: string; name: string }[];
  workstreams: ReportContextWorkstream[];
  activities: ReportContextActivity[];
  /** Distinct technologies/components across the period. */
  technicalAreas: string[];
  /** Objectives whose completion was NOT confirmed (for "left open"). */
  openObjectives: string[];
  generatedAt: string;
}

/** A composed, still-traceable structured report. `content` is the rendered
 *  text; `sections` keep workstream → activity references intact. */
export interface StructuredReportSection {
  heading: string;
  body: string;
  workstreamId?: string;
  activityIds: string[];
}
export interface StructuredReport {
  content: string;
  sections: StructuredReportSection[];
  /** Composer that produced this ("deterministic" | "openai" | "ollama"),
   *  possibly annotated when a fallback occurred. */
  composer: string;
  /** True if the composed output was rejected by validation and the
   *  deterministic fallback was used instead. */
  fellBack: boolean;
}

/**
 * Transforms a structured ReportContext into readable prose. It may group,
 * name, summarize, and improve wording — but NEVER decides whether work
 * happened, invents work, or infers completion beyond the supplied status.
 */
export interface SemanticReportComposer {
  readonly name: string;
  readonly external: boolean;
  compose(context: ReportContext): Promise<StructuredReport>;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  timezone: string;
  aiProvider: "deterministic" | "openai" | "ollama";
  aiModel: string;
  openaiApiKey?: string;
  ollamaEndpoint: string;
  redactionEnabled: boolean;
  showPayloadPreview: boolean;
  excludedProjectIds: string[];
  defaultStyle: ReportStyle;
  defaultLength: ReportLength;
  defaultLanguage: ReportLanguage;
  dailyDurationSeconds: number;
  reviewThreshold: number;
}
