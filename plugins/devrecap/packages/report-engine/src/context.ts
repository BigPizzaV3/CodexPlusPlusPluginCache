/**
 * ReportContext builder (Semantic Report Composer).
 *
 * Derives a STRUCTURED, sanitized snapshot of the work from a ReportInput.
 * This is the ONLY thing a semantic composer (deterministic or optional LLM)
 * ever sees. It contains distilled FACTS already extracted by DevRecap:
 *   - per-activity objective (WHY), category, status, confidence, short summary,
 *     technical terms, and file/command/error/validation COUNTS/labels
 *   - workstreams (objective + status + member activity IDs for traceability)
 *   - the distinct technical areas across the period
 *   - which objectives were not confirmed complete (for "left open")
 *
 * It never includes raw rollout files, raw Codex sessions, full command output,
 * source code, credentials, repository contents, or the paths/commands found
 * inside imported data.
 */

import type {
  ReportInput, ReportContext, ReportContextActivity, ReportContextWorkstream,
  ActivitySummary, Workstream,
} from "@devrecap/shared";
import { sha1 } from "@devrecap/shared";

/** Localized-neutral, count-only summaries derived from an ActivitySummary. */
function commandsSummary(a: ActivitySummary): string {
  // We only have file/test counts on the summary; commands aren't separately
  // counted here, so this stays empty unless a future field carries it.
  return "";
}
function errorsSummary(a: ActivitySummary): string {
  const n = a.errorCount ?? 0;
  return n > 0 ? `${n} error${n === 1 ? "" : "s"} encountered` : "";
}
function validationSummary(a: ActivitySummary): string {
  const tests = a.testCount ?? 0;
  if (tests <= 0) return "";
  if (a.status === "completed") return "tests passed";
  return "tests run";
}

/** Fallback objective when the engine didn't produce one — never generic. */
function activityObjective(a: ActivitySummary): string {
  if (a.objective && a.objective.trim()) return a.objective.trim();
  const p = a.topicProfile;
  if (p) {
    const subj = [...p.domainTerms, ...p.components].find((t) => t.length >= 3);
    if (subj) return `Work on the ${subj}`;
  }
  return ""; // composer will use the workstream objective / neutral label
}

function contextActivity(a: ActivitySummary): ReportContextActivity {
  return {
    id: a.id,
    objective: activityObjective(a),
    category: a.category,
    status: a.status,
    confidence: a.confidence,
    summary: a.summary,
    technicalTerms: a.techTerms ?? [],
    filesModifiedCount: a.filesModifiedCount ?? 0,
    filesReadCount: a.filesReadCount ?? 0,
    commandsSummary: commandsSummary(a),
    errorsSummary: errorsSummary(a),
    validationSummary: validationSummary(a),
    startedAt: a.startedAt,
    // Use the real end time when available; fall back to startedAt only when
    // the activity carries no distinct end (never silently zero out the span).
    endedAt: a.endedAt || a.startedAt,
  };
}

function contextWorkstream(w: Workstream): ReportContextWorkstream {
  return {
    id: w.id,
    objective: (w.objective && w.objective.trim()) || w.title,
    status: w.status,
    workKind: w.workKind,
    technicalTerms: w.techTerms,
    activityIds: w.activities.map((a) => a.id),
    significance: w.significance,
  };
}

/** Build the structured, sanitized ReportContext from a ReportInput. */
export function buildReportContext(input: ReportInput): ReportContext {
  const activities: ReportContextActivity[] = [];
  const seenActivity = new Set<string>();
  for (const w of input.workstreams) {
    for (const a of w.activities) {
      if (seenActivity.has(a.id)) continue;
      seenActivity.add(a.id);
      activities.push(contextActivity(a));
    }
  }

  const workstreams = input.workstreams.map(contextWorkstream);

  const technicalAreas = [
    ...new Set(input.workstreams.flatMap((w) => w.techTerms)),
  ].slice(0, 16);

  // Objectives whose completion was not confirmed (primary work only).
  const openObjectives = input.workstreams
    .filter((w) => w.workKind === "primary" &&
      (w.status === "in_progress" || w.status === "blocked" || w.status === "partially_completed"))
    .map((w) => (w.objective && w.objective.trim()) || w.title);

  return {
    kind: input.kind,
    language: input.resolvedLanguage,
    length: input.length,
    period: input.range,
    projects: input.projects.map((p) => ({ id: p.id, name: p.name })),
    workstreams,
    activities,
    technicalAreas,
    openObjectives: [...new Set(openObjectives)],
    generatedAt: input.generatedAt,
  };
}

/**
 * A STABLE fingerprint of the meaningful, sanitized ReportContext payload — the
 * exact bytes an external composer would receive. Used to enforce explicit
 * consent: the server only sends a ReportContext to an external provider when
 * the request carries a consent token matching THIS digest, so a user cannot
 * accidentally authorize sending a different payload than the one they
 * previewed. Volatile fields (generatedAt) are excluded so the same underlying
 * work produces the same digest across preview → generate.
 */
export function reportContextDigest(context: ReportContext): string {
  // Exclude volatile-but-meaningless fields so the SAME work yields the SAME
  // digest across preview → generate: `generatedAt`, and the per-build random
  // workstream ids (`newId("wst")`). We keep each workstream's objective,
  // status, kind, technical terms, and its member activityIds — the stable,
  // meaningful payload. Activity ids come from the database and ARE stable.
  const stable = {
    kind: context.kind,
    language: context.language,
    length: context.length,
    period: context.period,
    projects: context.projects,
    workstreams: context.workstreams.map((w) => ({
      objective: w.objective,
      status: w.status,
      workKind: w.workKind,
      technicalTerms: w.technicalTerms,
      activityIds: w.activityIds,
      significance: w.significance,
    })),
    activities: context.activities,
    technicalAreas: context.technicalAreas,
    openObjectives: context.openObjectives,
  };
  return sha1(JSON.stringify(stable));
}
