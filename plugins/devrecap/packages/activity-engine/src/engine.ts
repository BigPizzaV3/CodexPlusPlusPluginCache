/**
 * Activity engine (Activity Extraction V2, deterministic — no AI).
 *
 * Pipeline:
 *   classified/normalized events
 *        ↓  task segmentation (follow-ups stay in the same task)
 *   TaskCandidate  { intents, filesRead/Modified/Created/Deleted, commands,
 *                    tests, errors, gitOps, timespan }
 *        ↓  evidence evaluation (conservative)
 *   Activity       { category, status, confidence, title, summary, evidence }
 *
 * Guiding principles:
 *  - An Activity is meaningful WORK, not a message. Many events → one activity.
 *  - A user prompt is INTENT, not proof of completion.
 *  - A file being READ/mentioned is NOT a modification.
 *  - `completed` needs strong evidence; `blocked` only when the TASK ends
 *    blocked (never from an incidental error during debugging).
 *  - Confidence reflects how well the reconstruction matches real work, not the
 *    number of events.
 *  - No-work candidates (a bare question with no follow-through) produce NOTHING.
 */

import type {
  Activity,
  ActivityCategory,
  ActivityStatus,
  Evidence,
  NormalizedEvent,
} from "@devrecap/shared";
import { newId, nowIso, basename } from "@devrecap/shared";
import { synthesizeDescriptor, hasRealCommit } from "./synthesize.ts";

export interface EngineOptions {
  /** Max idle gap (minutes) before a new task window opens. */
  gapMinutes: number;
  projectId?: string;
}

export interface BuiltActivity {
  activity: Activity;
  evidence: Evidence[];
}

const DEFAULT_OPTS: EngineOptions = { gapMinutes: 30 };

// ---------------------------------------------------------------------------
// TaskCandidate
// ---------------------------------------------------------------------------

/**
 * An intermediate work unit. TaskCandidates are converted into user-facing
 * Activities. Keeping this explicit separates "what happened" (evidence) from
 * "how we describe it" (the Activity) and eases future AI enhancement.
 */
export interface TaskCandidate {
  events: NormalizedEvent[];
  intents: string[]; // substantive user intents (not follow-ups)
  filesRead: Set<string>;
  filesModified: Set<string>;
  filesCreated: Set<string>;
  filesDeleted: Set<string>;
  filesMentioned: Set<string>;
  commands: NormalizedEvent[];
  tests: NormalizedEvent[];
  errors: NormalizedEvent[];
  gitOps: NormalizedEvent[];
  assistantSummaries: string[];
  /** Count of edit/create/delete events, even when a path wasn't extractable. */
  editEventCount: number;
  /** Count of file-read/inspect events, even when a path wasn't extractable. */
  readEventCount: number;
}

function newCandidate(): TaskCandidate {
  return {
    events: [], intents: [],
    filesRead: new Set(), filesModified: new Set(), filesCreated: new Set(),
    filesDeleted: new Set(), filesMentioned: new Set(),
    commands: [], tests: [], errors: [], gitOps: [], assistantSummaries: [],
    editEventCount: 0, readEventCount: 0,
  };
}

/** Pure affirmations / trivial continuations (match the WHOLE short message). */
const FOLLOWUP_WHOLE_RE =
  /^\s*(?:(?:please\s+)?(?:try\s+again|again|retry|redo|do (?:that|it|this)|go ahead|proceed|continue|yes|yep|yeah|ok(?:ay)?|sure|sounds good|do it|run (?:the )?tests?(?:\s+again)?|run it|rerun|fix it|fix that|and|also|hmm+|thanks?|thank you|great|perfect|nice))[\s.!?]*$/i;
/** Continuation phrases that mark a short message as a follow-up if present. */
const FOLLOWUP_CONTAINS_RE =
  /\b(try again|still (?:not )?(?:work|fail|broken)|not working|doesn'?t work|same (?:error|issue|problem)|it (?:still )?(?:fails?|errors?|breaks?)|what about|run (?:the )?tests?|rerun|now what)\b/i;
const FOLLOWUP_MAX_LEN = 60;

/** Is this user text a follow-up (stays in the current task) vs a new intent? */
export function isFollowUp(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (FOLLOWUP_WHOLE_RE.test(t)) return true;
  if (t.length <= FOLLOWUP_MAX_LEN && FOLLOWUP_CONTAINS_RE.test(t)) return true;
  return false;
}

/** Max time between two occurrences of the SAME user turn (event_msg twin +
 *  response_item twin) for them to be treated as one turn, not two tasks.
 *  Deliberately small: real duplicates share a turn and land within seconds. */
const DUP_INTENT_WINDOW_MS = 5_000;

/** Normalize intent text for equality comparison (whitespace + case folded). */
function normalizeIntent(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function accumulate(cand: TaskCandidate, ev: NormalizedEvent): void {
  cand.events.push(ev);
  const files = ev.files ?? [];
  switch (ev.kind) {
    case "user_request":
      if (ev.text && !isFollowUp(ev.text)) {
        // De-dupe: real rollouts carry the same user turn twice (event_msg +
        // response_item). Skip an intent whose text already appears in this
        // candidate (compared normalized), keeping the first canonical copy.
        const norm = normalizeIntent(ev.text);
        const seen = cand.intents.some((i) => normalizeIntent(i) === norm);
        if (!seen) cand.intents.push(ev.text);
      }
      break;
    case "assistant_action":
      if (ev.text) cand.assistantSummaries.push(ev.text);
      for (const f of files) cand.filesMentioned.add(f); // prose = mention only
      break;
    case "file_edit":
      cand.editEventCount += 1;
      for (const f of files) {
        if (ev.fileOp === "delete") cand.filesDeleted.add(f);
        else if (ev.fileOp === "create") cand.filesCreated.add(f);
        else cand.filesModified.add(f);
      }
      break;
    case "file_read":
      cand.readEventCount += 1;
      for (const f of files) cand.filesRead.add(f);
      break;
    case "shell_command":
      cand.commands.push(ev);
      break;
    case "test_run":
      cand.tests.push(ev);
      for (const f of files) cand.filesRead.add(f);
      break;
    case "error":
      cand.errors.push(ev);
      break;
    case "git_op":
      cand.gitOps.push(ev);
      break;
  }
}

function anyRead(c: TaskCandidate): boolean {
  return c.readEventCount > 0 || c.filesRead.size > 0;
}

/** Did the assistant explicitly report the task is blocked/unresolved? */
function hasExplicitBlocker(c: TaskCandidate): boolean {
  return c.assistantSummaries.some((t) => EXPLICIT_BLOCKED_RE.test(t));
}

/** Does the candidate contain any real work signal (beyond a bare question)? */
function hasWorkSignal(c: TaskCandidate): boolean {
  return (
    c.editEventCount > 0 ||
    c.filesModified.size > 0 ||
    c.filesCreated.size > 0 ||
    c.filesDeleted.size > 0 ||
    anyRead(c) ||
    c.tests.length > 0 ||
    c.gitOps.length > 0 ||
    c.commands.length > 0 ||
    c.errors.length > 0 ||
    // A user task that the assistant explicitly reports as blocked is a
    // meaningful (blocked) activity even without file work.
    (c.intents.length > 0 && hasExplicitBlocker(c))
  );
}

// ---------------------------------------------------------------------------
// Category / status / confidence (conservative)
// ---------------------------------------------------------------------------

const EXPLICIT_DONE_RE =
  /\b(done|completed|fixed(?:\s+it)?|resolved|implemented|applied the (?:fix|change|patch)|all tests? pass|tests? (?:now )?pass|works now|is now working|now works|successfully (?:added|fixed|updated|implemented|created)|committed)\b/i;
const EXPLICIT_BLOCKED_RE =
  /\b(i(?:'?m| am) blocked|(?:this |the task )?is blocked|cannot proceed|can'?t (?:continue|proceed)|need (?:access|permission|credentials|the password)|waiting on|requires manual|unable to (?:continue|proceed|complete)|no permission)\b/i;

function anyEdit(c: TaskCandidate): boolean {
  return c.editEventCount > 0 || c.filesModified.size > 0 || c.filesCreated.size > 0 || c.filesDeleted.size > 0;
}
function joinedIntent(c: TaskCandidate): string {
  return c.intents.join(" \u2022 ").toLowerCase();
}

function classifyCategory(c: TaskCandidate): ActivityCategory {
  const req = joinedIntent(c);
  const edited = anyEdit(c);

  if (/\b(migrat|schema|\bsql\b|\bdb\b|database|seed)\b/.test(req)) return "database";
  if (/\b(deploy|release|staging|production|rollout|ship)\b/.test(req)) return "deployment";
  if (/\b(refactor|rename|extract|clean ?up|reorganiz|restructure)\b/.test(req) && edited) return "refactor";
  if (/\b(document|readme|docs|comment|changelog)\b/.test(req) && edited) return "documentation";
  if (/\b(config|configure|setup|set up|\benv\b|settings|install)\b/.test(req) && edited) return "configuration";

  const bugWords = /\b(fix|bug|broken|issue|error|crash|fail|not working|doesn'?t work|regression)\b/.test(req);
  if (bugWords && edited) return "bugfix";
  if (c.errors.length > 0 && edited) return "bugfix";
  if (/\b(add|implement|create|build|feature|new|support)\b/.test(req) && edited) return "feature";

  // No edits → this is inspection/diagnosis, or testing/git-only.
  if (!edited) {
    const gitIntent = /\b(commit|stage|staged|push|add and commit|git add)\b/.test(req);
    const committed = c.gitOps.some((g) => g.gitOp === "commit");
    if ((gitIntent || committed) && c.gitOps.length > 0) return "git";
    if (c.tests.length > 0 && c.commands.length === 0 && !anyRead(c)) return "testing";
    if (c.gitOps.length > 0 && c.commands.length === 0 && !anyRead(c) && c.tests.length === 0) return "git";
    return "investigation";
  }
  return "feature"; // edits with no clear intent keyword
}

interface Assessment {
  status: ActivityStatus;
  confidence: number;
  reasons: string[];
}

/**
 * Conservative status + interpretation-quality confidence.
 *
 * completed: strong evidence — passing test AFTER edits, a git commit, or an
 *   explicit "done/works now" result following edits.
 * blocked: only when the TASK itself ends blocked (explicit blocker language and
 *   no resolving edit/commit/passing-test afterwards). NOT from a mid-task error.
 * in_progress: real work happened but completion is unproven.
 * unknown: not enough evidence.
 */
function assess(c: TaskCandidate): Assessment {
  const reasons: string[] = [];
  const edited = anyEdit(c);
  const modifiedCount = c.filesModified.size + c.filesCreated.size + c.filesDeleted.size;
  const testsPassed = c.tests.some((t) => t.passed === true);
  const testsFailed = c.tests.some((t) => t.passed === false);
  const committed = c.gitOps.some((g) => g.gitOp === "commit");
  const summaries = c.assistantSummaries;
  const explicitDone = summaries.some((t) => EXPLICIT_DONE_RE.test(t));
  const explicitBlocked = summaries.some((t) => EXPLICIT_BLOCKED_RE.test(t));

  if (c.intents.length) reasons.push(`User intent: "${trimReason(c.intents[0])}".`);
  if (modifiedCount) reasons.push(`${modifiedCount} file(s) were modified/created/deleted.`);
  if (c.filesRead.size) reasons.push(`${c.filesRead.size} file(s) were read/inspected.`);
  if (c.tests.length) reasons.push(testsPassed ? "A test run reported success." : testsFailed ? "A test run reported failure." : "Tests were run.");
  if (committed) reasons.push("A Git commit was observed.");
  if (c.errors.length) reasons.push(`${c.errors.length} error signal(s) were seen during the work.`);
  if (explicitDone) reasons.push("The assistant explicitly stated the change was completed.");
  if (explicitBlocked) reasons.push("The session contains explicit unresolved-blocker language.");

  // --- status ---
  let status: ActivityStatus;
  const strongCompletion =
    (testsPassed && edited) ||
    committed ||
    (explicitDone && edited);

  // Blocked only if the task ENDS blocked: explicit blocker language AND no
  // resolving evidence afterwards.
  if (explicitBlocked && !strongCompletion) {
    status = "blocked";
    reasons.push("Task treated as blocked: unresolved blocker with no resolving change.");
  } else if (strongCompletion) {
    status = "completed";
    reasons.push("Strong completion evidence (passing test after edits, commit, or explicit result).");
  } else if (testsFailed && !edited) {
    // ran tests, they failed, nothing changed → still investigating
    status = "in_progress";
  } else if (edited || c.errors.length > 0 || c.commands.length > 0 || anyRead(c) || c.tests.length > 0) {
    status = "in_progress";
    reasons.push("Work occurred but completion is not proven; needs review.");
  } else {
    status = "unknown";
    reasons.push("Insufficient evidence to determine an outcome.");
  }

  // --- confidence: interpretation quality (not event count) ---
  let conf = 0.2;
  const hasIntent = c.intents.length > 0;
  if (hasIntent) conf += 0.15;
  if (edited && hasIntent) conf += 0.2; // intent + concrete change → we understand it
  else if (edited) conf += 0.1;
  if (testsPassed && edited) conf += 0.2;
  if (committed) conf += 0.25;
  if (explicitDone && edited) conf += 0.1;
  if (!edited && anyRead(c) && hasIntent) conf += 0.1; // clear investigation

  // Penalties: weak / ambiguous interpretations.
  if (!hasIntent && !edited && !committed && c.tests.length === 0) conf -= 0.15;
  if (status === "unknown") conf = Math.min(conf, 0.35);
  if (status === "in_progress" && !edited && c.tests.length === 0) conf = Math.min(conf, 0.5);
  if (status === "in_progress" && !committed && !testsPassed) conf = Math.min(conf, 0.72);

  const confidence = Math.max(0.05, Math.min(0.99, Number(conf.toFixed(2))));
  return { status, confidence, reasons };
}

// ---------------------------------------------------------------------------
// Title + summary (deterministic, evidence-grounded)
// ---------------------------------------------------------------------------

/** Named technical terms worth preserving in titles/summaries when they appear
 *  in imported evidence (frameworks, doc/API concepts, file-format terms). */
const TECH_TERM_RE = /\b(DocuSign|ApiClient|autoload(?:\.php)?|forge_files|AcroForms?|PDFs?|Snowflake|Laravel|OAuth2?|GraphQL|webhook|Stripe|Kafka|Redis|Postgres(?:QL)?|MySQL|Docker|Kubernetes|Terraform|OpenAPI|Swagger|JWT|SAML|S3|DynamoDB|Prisma|Vite|React|Vue|Angular|Django|Flask|Rails|Kotlin|Tailwind)\b/gi;

/** Canonical display form for a matched term (folds plural/case variants). */
function canonicalTerm(raw: string): string {
  const k = raw.toLowerCase().replace(/\.php$/, "");
  const map: Record<string, string> = {
    pdf: "PDF", pdfs: "PDF", acroform: "AcroForm", acroforms: "AcroForm",
    autoload: "autoload.php", forge_files: "forge_files", docusign: "DocuSign",
    apiclient: "ApiClient", snowflake: "Snowflake", laravel: "Laravel",
    oauth: "OAuth", oauth2: "OAuth2", graphql: "GraphQL", postgres: "Postgres",
    postgresql: "Postgres", mysql: "MySQL", docker: "Docker", kubernetes: "Kubernetes",
    terraform: "Terraform", openapi: "OpenAPI", swagger: "Swagger", jwt: "JWT",
    saml: "SAML", s3: "S3", dynamodb: "DynamoDB", prisma: "Prisma", vite: "Vite",
    react: "React", vue: "Vue", angular: "Angular", django: "Django", flask: "Flask",
    rails: "Rails", kotlin: "Kotlin", tailwind: "Tailwind", stripe: "Stripe",
    kafka: "Kafka", redis: "Redis", webhook: "webhook",
  };
  return map[k] ?? raw;
}

/** Extract preserved technical terms from any text (canonicalized, deduped). */
export function techTerms(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  TECH_TERM_RE.lastIndex = 0;
  while ((m = TECH_TERM_RE.exec(text)) !== null) out.add(canonicalTerm(m[0]));
  return [...out];
}

/**
 * Build a rich, memory-refreshing summary (Semantics V3). Reads as prose and
 * captures: objective → area/components → what was investigated/changed →
 * errors → validation → outcome. File lists are SUMMARIZED (counts + a few
 * area hints), never dumped; exact files stay in the evidence. Named technical
 * terms found in the evidence are preserved.
 */
function summaryFor(cat: ActivityCategory, c: TaskCandidate, status: ActivityStatus): string {
  const modified = [...c.filesModified, ...c.filesCreated, ...c.filesDeleted];
  const created = [...c.filesCreated];
  const deleted = [...c.filesDeleted];
  const reads = [...c.filesRead];
  const passed = c.tests.filter((t) => t.passed === true).length;
  const failed = c.tests.filter((t) => t.passed === false).length;
  const committed = c.gitOps.some((g) => g.gitOp === "commit");

  // Preserve named technical terms from intents + assistant summaries + files.
  const evidenceText = [c.intents.join(" "), c.assistantSummaries.join(" "), modified.join(" "), reads.join(" ")].join(" ");
  const terms = techTerms(evidenceText).slice(0, 4);

  const parts: string[] = [];

  // 1) Objective — describe the AREA of work, not the raw prompt text.
  if (modified.length) {
    parts.push(`Made changes in ${areaHint(modified)}.`);
  } else if (reads.length) {
    parts.push(`Investigated ${areaHint(reads)}.`);
  } else if (c.gitOps.length) {
    parts.push(`Worked with version control.`);
  }

  // 2) What was investigated (reads) — summarized, not dumped.
  if (reads.length) {
    parts.push(`Inspected ${count(reads.length, "file")}${areaSuffix(reads)}.`);
  }

  // 3) What was changed — summarized, not dumped.
  if (modified.length) {
    const detail: string[] = [];
    if (created.length) detail.push(`${count(created.length, "new file")}`);
    if (deleted.length) detail.push(`removed ${count(deleted.length, "file")}`);
    const suffix = detail.length ? ` (${detail.join(", ")})` : "";
    parts.push(`Modified ${count(modified.length, "file")}${areaSuffix(modified)}${suffix}.`);
  }

  // 4) Commands run (count only).
  if (c.commands.length) parts.push(`Ran ${count(c.commands.length, "command")}.`);

  // 5) Validation / tests.
  if (passed && !failed) parts.push(`Validation passed.`);
  else if (failed) parts.push(`Tests were failing during the work.`);
  else if (c.tests.length) parts.push(`Ran the test suite.`);

  // 6) Errors encountered.
  if (c.errors.length) parts.push(`Encountered ${count(c.errors.length, "error")} during the work.`);

  // 7) Git.
  if (committed) parts.push(`Committed the changes.`);

  // 8) Technical areas involved.
  if (terms.length) parts.push(`Areas involved: ${terms.join(", ")}.`);

  // 9) Outcome — status-consistent, never claims completion when unproven.
  parts.push(
    status === "completed" ? "The work was completed in this session."
    : status === "blocked" ? "The work was blocked and did not complete."
    : status === "in_progress" ? "The work remained in progress at the end of the session."
    : "The outcome was not clearly confirmed in the session.",
  );
  return parts.join(" ");
}

/** "3 files" / "1 file" etc. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** A short area hint from a set of paths: top directory or dominant basename. */
function areaHint(files: string[]): string {
  const primary = dominantFile(new Set(files)) ?? files[0];
  if (!primary) return "the codebase";
  const dir = primary.includes("/") ? primary.split("/").slice(-2, -1)[0] : "";
  return dir ? `the ${dir} area` : basename(primary);
}

/** " related to <area>" suffix, or "" when we can't tell. */
function areaSuffix(files: string[]): string {
  const primary = dominantFile(new Set(files));
  if (!primary) return "";
  return ` related to ${basename(primary)}`;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

function buildEvidence(activityId: string, c: TaskCandidate): Evidence[] {
  const ev: Evidence[] = [];
  const push = (kind: Evidence["kind"], label: string, n: NormalizedEvent, detail?: string) =>
    ev.push({
      id: newId("evd"),
      activityId,
      kind,
      refType: "raw_event",
      refId: n.sessionId ? `${n.sessionId}:${n.rawEventSeq}` : String(n.rawEventSeq),
      label,
      detail,
      ts: n.ts,
      tsEpoch: n.tsEpoch,
    });

  for (const n of c.events) {
    switch (n.kind) {
      case "user_request":
        push("codex_message", isFollowUp(n.text ?? "") ? "Follow-up" : "User request", n, truncate(n.text ?? "", 300));
        break;
      case "file_edit":
        for (const f of n.files ?? [])
          push("edited_file", `${opLabel(n.fileOp)} ${basename(f)}`, n, f);
        if (!(n.files && n.files.length)) push("edited_file", "File edit", n, n.command);
        break;
      case "file_read":
        for (const f of n.files ?? []) push("shell_command", `Read ${basename(f)}`, n, n.command ?? f);
        if (!(n.files && n.files.length) && n.command) push("shell_command", "Inspected files", n, truncate(n.command, 200));
        break;
      case "shell_command":
        push("shell_command", "Shell command", n, truncate(n.command ?? "", 200));
        break;
      case "test_run":
        push("test_run", n.passed === true ? "Tests passed" : n.passed === false ? "Tests failed" : "Test run", n, truncate(n.command ?? "", 200));
        break;
      case "git_op":
        push("git_commit", `Git ${n.gitOp ?? "op"}`, n, truncate(n.command ?? n.text ?? "", 200));
        break;
      case "error":
        push("error", "Error / investigation", n, truncate(n.text ?? "", 240));
        break;
      case "assistant_action":
        // keep a light trace only if it stated an outcome
        if (n.text && (EXPLICIT_DONE_RE.test(n.text) || EXPLICIT_BLOCKED_RE.test(n.text)))
          push("codex_message", "Assistant result", n, truncate(n.text, 240));
        break;
    }
  }
  return ev;
}

function opLabel(op?: string): string {
  return op === "create" ? "Created" : op === "delete" ? "Deleted" : "Edited";
}

// ---------------------------------------------------------------------------
// Candidate → Activity
// ---------------------------------------------------------------------------

/** Why a task candidate did not become an activity (for diagnostics). */
export type RejectionReason = "no_work_evidence" | "no_meaningful_intent";

export interface FinalizeResult {
  built?: BuiltActivity;
  rejected?: RejectionReason;
}

function finalizeCandidate(
  c: TaskCandidate,
  source: Activity["source"],
  projectId?: string,
): FinalizeResult {
  // Drop candidates with no real work signal (e.g. a bare question, or pure
  // noise that slipped through). A question with follow-through keeps its work.
  if (!hasWorkSignal(c)) return { rejected: "no_work_evidence" };

  const cat = classifyCategory(c);
  const evalResult = assess(c);

  // Extra guard: a candidate with NO user intent and only a single incidental
  // read (and nothing else) is too weak to be a user-facing activity → drop it
  // to keep the Review Inbox clean.
  const trivial =
    !anyEdit(c) &&
    c.intents.length === 0 &&
    c.tests.length === 0 &&
    c.gitOps.length === 0 &&
    c.errors.length === 0 &&
    c.commands.length === 0 &&
    !hasExplicitBlocker(c) &&
    c.readEventCount <= 1;
  if (trivial) return { rejected: "no_meaningful_intent" };

  const id = newId("act");
  const times = c.events.map((e) => e.tsEpoch).filter(Boolean).sort((a, b) => a - b);
  const startedAt = times.length ? new Date(times[0]).toISOString() : nowIso();
  const endedAt = times.length ? new Date(times[times.length - 1]).toISOString() : undefined;

  // Semantic Synthesis V2/V3: derive a normalized descriptor from EVIDENCE
  // (never the raw prompt) — title, work kind, precise git action, and a
  // TopicProfile (domain/technology/component signals) for workstream grouping.
  const evidenceText = [
    ...c.intents, ...c.assistantSummaries,
    ...c.filesModified, ...c.filesCreated, ...c.filesRead,
  ].join(" ");
  const activityTerms = techTerms(evidenceText);
  const desc = synthesizeDescriptor(c, cat, evalResult.status, activityTerms);

  const activity: Activity = {
    id, source, projectId, startedAt, endedAt,
    category: cat,
    title: desc.title,
    summary: summaryFor(cat, c, evalResult.status),
    status: evalResult.status,
    confidence: evalResult.confidence,
    reviewState: "pending",
    metadata: {
      intents: c.intents,
      filesModified: [...c.filesModified],
      filesCreated: [...c.filesCreated],
      filesDeleted: [...c.filesDeleted],
      filesRead: [...c.filesRead],
      filesMentioned: [...c.filesMentioned],
      commandCount: c.commands.length,
      testCount: c.tests.length,
      gitOps: c.gitOps.map((g) => g.gitOp),
      // V2 synthesis signals (used by the report/workstream layer):
      workKind: desc.workKind,
      gitAction: desc.gitAction,
      topicKey: desc.topicKey,
      topicTokens: desc.topicTokens,
      topicProfile: desc.topicProfile,
      objective: desc.objective,
      techTerms: activityTerms.slice(0, 8),
      committed: hasRealCommit(c.gitOps),
      reasoning: evalResult.reasons,
    },
  };
  return { built: { activity, evidence: buildEvidence(id, c) } };
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Safe, counts-only diagnostics for one analyzed member/session. Contains NO
 * raw content — only event-shape counts, classification counts, candidate
 * accept/reject tallies, and a few sanitized sample SHAPES (types only).
 */
export interface ExtractionDiagnostics {
  rawShapes: Record<string, number>; // e.g. "response_item/function_call" → n
  classified: Record<string, number>; // EventClass → n
  normalizedKinds: Record<string, number>;
  candidatesCreated: number;
  activitiesAccepted: number;
  candidatesRejected: number;
  rejectionReasons: Record<string, number>;
  sampleShapes: { rootType: string; payloadType?: string; toolName?: string; contentTypes?: string[] }[];
}

export function emptyDiagnostics(): ExtractionDiagnostics {
  return {
    rawShapes: {}, classified: {}, normalizedKinds: {},
    candidatesCreated: 0, activitiesAccepted: 0, candidatesRejected: 0,
    rejectionReasons: {}, sampleShapes: [],
  };
}

function inc(m: Record<string, number>, k: string): void { m[k] = (m[k] ?? 0) + 1; }

// ---------------------------------------------------------------------------
// Streaming builder + batch API
// ---------------------------------------------------------------------------

/**
 * Memory-bounded streaming builder. Accepts normalized events in chronological
 * order and holds only the CURRENT TaskCandidate. A new candidate opens on a
 * substantive user intent (not a follow-up) or a long idle gap.
 */
export class StreamingActivityBuilder {
  private gapMs: number;
  private source: Activity["source"];
  private projectId?: string;
  private onActivity: (a: BuiltActivity) => void;
  private diag?: ExtractionDiagnostics;
  private cur: TaskCandidate | undefined;
  private lastTs = 0;
  /** Normalized text + epoch of the most recent substantive intent, used to
   *  recognize the SAME user turn arriving twice (event_msg + response_item). */
  private lastIntentNorm = "";
  private lastIntentTs = 0;

  constructor(
    source: Activity["source"],
    onActivity: (a: BuiltActivity) => void,
    opts: Partial<EngineOptions> & { diagnostics?: ExtractionDiagnostics } = {},
  ) {
    const o = { ...DEFAULT_OPTS, ...opts };
    this.gapMs = o.gapMinutes * 60_000;
    this.source = source;
    this.projectId = o.projectId;
    this.onActivity = onActivity;
    this.diag = opts.diagnostics;
  }

  add(ev: NormalizedEvent): void {
    if (this.diag) inc(this.diag.normalizedKinds, ev.kind);

    let substantiveIntent =
      ev.kind === "user_request" && !!ev.text && !isFollowUp(ev.text);

    // Duplicate-turn guard: some Codex rollouts emit the SAME user turn twice —
    // once as event_msg/user_message and once as response_item/message (role
    // user). Those twins carry the same text within the same turn (near
    // timestamp). Treat the second one as NOT a new task boundary so it does
    // not spawn a duplicate TaskCandidate; accumulate() then drops the repeat
    // intent text while keeping the event as traceable evidence.
    if (substantiveIntent) {
      const norm = normalizeIntent(ev.text!);
      const closeInTime =
        this.lastIntentTs > 0 && Math.abs(ev.tsEpoch - this.lastIntentTs) <= DUP_INTENT_WINDOW_MS;
      if (norm === this.lastIntentNorm && closeInTime) {
        substantiveIntent = false; // same turn, seen twice → not a boundary
      } else {
        this.lastIntentNorm = norm;
        this.lastIntentTs = ev.tsEpoch;
      }
    }

    const timeGap = this.lastTs > 0 && ev.tsEpoch - this.lastTs > this.gapMs;
    const startNew =
      !this.cur ||
      (substantiveIntent && this.cur.events.length > 0) ||
      timeGap;
    if (startNew) {
      this.closeCurrent();
      this.cur = newCandidate();
    }
    accumulate(this.cur!, ev);
    this.lastTs = ev.tsEpoch;
  }

  private closeCurrent(): void {
    if (!this.cur) return;
    if (this.diag) this.diag.candidatesCreated += 1;
    const res = finalizeCandidate(this.cur, this.source, this.projectId);
    this.cur = undefined;
    if (res.built) {
      if (this.diag) this.diag.activitiesAccepted += 1;
      this.onActivity(res.built);
    } else if (res.rejected) {
      if (this.diag) {
        this.diag.candidatesRejected += 1;
        inc(this.diag.rejectionReasons, res.rejected);
      }
    }
  }

  flush(): void {
    this.closeCurrent();
  }
}

/** Batch API: build activities from a whole normalized-event array. */
export function buildActivities(
  events: NormalizedEvent[],
  source: Activity["source"],
  opts: Partial<EngineOptions> = {},
): BuiltActivity[] {
  const out: BuiltActivity[] = [];
  const sorted = [...events].sort((a, b) => a.tsEpoch - b.tsEpoch);
  const builder = new StreamingActivityBuilder(source, (a) => out.push(a), opts);
  for (const ev of sorted) builder.add(ev);
  builder.flush();
  return out;
}

// --- helpers ---------------------------------------------------------------

/** Files that are data/logs/artifacts — never good title material. */
const NON_SOURCE_RE = /\.(jsonl|log|lock|csv|tsv|out|tmp|bak|snap|map|min\.js)$|(^|\/)(rollout-|package-lock|yarn\.lock|pnpm-lock)/i;

function dominantFile(files: Set<string>): string | undefined {
  let best: string | undefined;
  let bestScore = -1;
  for (const f of files) {
    if (NON_SOURCE_RE.test(f)) continue; // skip data/log/artifact files
    let score = 0;
    if (/\.(ts|tsx|js|jsx|vue|php|py|go|rs|java|rb|c|cpp|cs|kt|swift|scala)$/i.test(f)) score += 2;
    if (/(test|spec)/i.test(f)) score -= 1;
    if (/(readme|changelog|\.md$)/i.test(f)) score -= 1;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function lowerFirst(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }
function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function trimReason(s: string): string { return truncate(s.replace(/\s+/g, " ").trim(), 80); }
