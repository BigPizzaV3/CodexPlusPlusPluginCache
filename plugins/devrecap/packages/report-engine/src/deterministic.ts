/**
 * Deterministic report provider.
 *
 * Renders a ReportInput into readable text without any external service. This
 * is the default provider: fully local, no hallucination, grounded entirely in
 * the extracted activities. It honors style (spoken/professional/executive/
 * technical) and length (short/normal/detailed), and for spoken Daily reports
 * it trims content to fit a target speaking duration.
 */

import type {
  ReportInput,
  ReportProvider,
  ReportProjectGroup,
  ActivitySummary,
  Workstream,
} from "@devrecap/shared";
import { phrases, outcomeWord, topicLabel, objectivePhrase, objectiveSubject, type Lang, type WsSignals } from "./language.ts";

const WORDS_PER_SECOND = 2.5; // ~150 wpm speaking pace

function bullet(text: string): string {
  return `- ${text}`;
}

function activityLine(a: ActivitySummary, style: ReportInput["style"]): string {
  const title = a.title.replace(/\s+/g, " ").trim();
  if (style === "technical") {
    return `${title} [${a.category}, ${a.status}, conf ${a.confidence.toFixed(2)}, ${a.evidenceCount} evidence]`;
  }
  if (style === "executive") {
    return title;
  }
  return title;
}

function pickActivities(
  g: ReportProjectGroup,
  length: ReportInput["length"],
): ActivitySummary[] {
  const sorted = [...g.activities].sort((a, b) => b.confidence - a.confidence);
  const limit = length === "short" ? 3 : length === "normal" ? 6 : 100;
  return sorted.slice(0, limit);
}

function renderProjectSection(
  g: ReportProjectGroup,
  input: ReportInput,
): string[] {
  const lines: string[] = [];
  lines.push(g.name);
  for (const a of pickActivities(g, input.length)) {
    lines.push(bullet(activityLine(a, input.style)));
  }
  return lines;
}

function accomplishmentVerbs(a: ActivitySummary): string {
  // Turn a title into a natural spoken clause when possible.
  return a.title.replace(/\s+/g, " ").trim();
}

function renderDaily(input: ReportInput): string {
  const all = input.projects.flatMap((p) => p.activities);
  const completed = all.filter((a) => a.status === "completed");
  const inProgress = all.filter((a) => a.status === "in_progress");

  if (input.style === "spoken") {
    const budgetWords = Math.max(
      25,
      Math.round((input.durationSeconds ?? 60) * WORDS_PER_SECOND),
    );
    const items = [...completed, ...inProgress].sort(
      (a, b) => b.confidence - a.confidence,
    );
    const sentences: string[] = [];
    let words = 0;
    sentences.push("Here's what I worked on.");
    words += 5;
    for (const a of items) {
      const clause = accomplishmentVerbs(a);
      const s =
        a.status === "in_progress"
          ? `I'm still working on ${lowerFirst(clause)}.`
          : `I ${pastify(clause)}.`;
      const w = s.split(/\s+/).length;
      if (words + w > budgetWords) break;
      sentences.push(s);
      words += w;
    }
    if (input.nextSteps.length && words < budgetWords - 8) {
      sentences.push(`Next, ${lowerFirst(input.nextSteps[0])}.`);
    }
    sentences.push(
      input.blockers.length
        ? `Blocker: ${input.blockers[0]}.`
        : "No blockers.",
    );
    return sentences.join(" ");
  }

  const out: string[] = [];
  out.push(headerFor(input));
  out.push("");
  out.push("Done");
  for (const a of completed.slice(0, input.length === "short" ? 4 : 12))
    out.push(bullet(a.title));
  if (inProgress.length) {
    out.push("");
    out.push("In progress");
    for (const a of inProgress.slice(0, 6)) out.push(bullet(a.title));
  }
  out.push("");
  out.push("Next steps");
  if (input.nextSteps.length) input.nextSteps.forEach((s) => out.push(bullet(s)));
  else out.push(bullet("Continue current work."));
  out.push("");
  out.push("Blockers");
  if (input.blockers.length) input.blockers.forEach((s) => out.push(bullet(s)));
  else out.push(bullet("None identified."));
  return out.join("\n");
}

function renderGrouped(input: ReportInput, heading: string): string {
  const out: string[] = [];
  out.push(heading);
  out.push("");
  const projects = input.projects.filter((p) => p.activities.length > 0);
  if (projects.length === 0) {
    out.push("No activities recorded for this period.");
    return out.join("\n");
  }
  for (const g of projects) {
    out.push(...renderProjectSection(g, input));
    out.push("");
  }
  if (input.style === "executive") {
    const total = input.projects.reduce((n, p) => n + p.activities.length, 0);
    out.unshift("");
    out.unshift(
      `Summary: ${total} activities across ${projects.length} project(s).`,
    );
  }
  if (input.blockers.length) {
    out.push("Blockers");
    input.blockers.forEach((b) => out.push(bullet(b)));
  }
  return out.join("\n").trim();
}

function headerFor(input: ReportInput): string {
  const map = {
    daily: "Daily Standup",
    weekly: "Weekly Review",
    custom: "Activity Report",
    monthly: "Monthly Summary",
    help_me_remember: "Help Me Remember",
    review: "Review",
    executive: "Executive Summary",
  } as const;
  return `${map[input.kind]} — ${input.range.start.slice(0, 10)} to ${input.range.end.slice(0, 10)}`;
}

// ---------------------------------------------------------------------------
// Semantic Synthesis V2 renderers — narrative, language-native, memory-first.
// A report SYNTHESIZES work; it never replays prompts or narrates every event.
// ---------------------------------------------------------------------------

function lang(input: ReportInput): Lang { return input.resolvedLanguage; }
function dateLabel(iso: string): string { return iso.slice(0, 10); }

/**
 * A localized workstream HEADING. For a single-member workstream in English we
 * can use the (English) synthesized title directly; but to keep a Portuguese
 * report fully Portuguese we derive the heading from the localized topic label
 * (title-cased), never leaking an English activity title into PT prose.
 */
function wsHeading(w: Workstream, L: Lang): string {
  // git/operational fronts get a localized fixed label.
  if (w.topicKey === "git" || w.workKind === "operational" || w.topicKey === "operational") {
    const label = topicLabel(L, w.topicKey === "git" ? "git" : "operational", w.techTerms);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  // Everything else is named by its OBJECTIVE (localized; domain terms kept).
  const obj = (w.objective && w.objective.trim()) || w.title;
  const phrase = objectivePhrase(L, obj, w.techTerms);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * Localized mid-sentence topic phrase for a workstream — the SUBJECT of the
 * objective (no verb), because narratives supply their own verb. This avoids
 * doubling ("trabalhou em Investigar item selection").
 */
function wsTopic(w: Workstream, L: Lang): string {
  if (w.topicKey === "git") return topicLabel(L, "git", w.techTerms);
  if (w.workKind === "operational" || w.topicKey === "operational") return topicLabel(L, "operational", w.techTerms);
  const obj = (w.objective && w.objective.trim()) || w.title;
  return objectiveSubject(L, obj, w.techTerms);
}

/** Build the evidence signals a workstream narrative is synthesized from. */
function signalsOf(w: Workstream, L: Lang): WsSignals {
  const edits = w.activities.reduce((n, a) => n + (a.filesModifiedCount ?? 0), 0);
  const reads = w.activities.reduce((n, a) => n + (a.filesReadCount ?? 0), 0);
  const tests = w.activities.reduce((n, a) => n + (a.testCount ?? 0), 0);
  const errors = w.activities.reduce((n, a) => n + (a.errorCount ?? 0), 0);
  const committed = w.activities.some((a) => a.committed);
  const testsFailed = w.status !== "completed" && tests > 0 && !committed && edits === 0;
  const gitAction = w.activities.map((a) => a.gitAction).find(Boolean);
  return {
    topicLabel: wsTopic(w, L),
    memberCount: w.activities.length,
    edits, reads, tests, testsFailed, errors, committed,
    gitAction,
    status: w.status,
    workKind: w.workKind,
    terms: w.techTerms,
  };
}

/** Split workstreams into MAIN (primary + significant) and OTHER (small/support). */
function splitMainOther(streams: Workstream[]): { main: Workstream[]; other: Workstream[] } {
  const primary = streams.filter((w) => w.workKind === "primary");
  const secondary = streams.filter((w) => w.workKind !== "primary");
  // Main = top primary workstreams (up to 5); the rest of primary + all
  // support/operational go under "other".
  const main = primary.slice(0, 5);
  const other = [...primary.slice(5), ...secondary];
  return { main, other };
}

/** Collect distinct technical areas across all workstreams. */
function allTechTerms(streams: Workstream[]): string[] {
  const set = new Set<string>();
  for (const w of streams) for (const t of w.techTerms) set.add(t);
  return [...set];
}

/** Genuinely unfinished MAIN items (in_progress / blocked / partial). */
function openItems(streams: Workstream[]): Workstream[] {
  return streams.filter((w) =>
    w.workKind === "primary" &&
    (w.status === "in_progress" || w.status === "blocked" || w.status === "partially_completed"));
}

/**
 * HELP ME REMEMBER — the memory report. Sections:
 *   RESUMO (2–4 sentences) → PRINCIPAIS FRENTES (per-workstream narrative) →
 *   OUTRAS COISAS → PROBLEMAS → ÁREAS TÉCNICAS → O QUE FICOU EM ABERTO.
 * Synthesis, not a transcript: no "Depois, <prompt>".
 */
function renderHelpMeRemember(input: ReportInput): string {
  const L = lang(input);
  const P = phrases(L);
  const out: string[] = [];
  out.push(P.helpMeRememberTitle);
  out.push(`${dateLabel(input.range.start)} → ${dateLabel(input.range.end)}`);
  out.push("");

  const streams = input.workstreams;
  if (streams.length === 0) { out.push(P.noActivities); return out.join("\n"); }

  const { main, other } = splitMainOther(streams);

  // --- RESUMO: what the period was mostly about. ---
  out.push(P.dayHeading);
  out.push("");
  const focusTopics = (main.length ? main : streams).slice(0, 3)
    .map((w) => wsTopic(w, L));
  out.push(P.daySummaryMain(dedupeStrings(focusTopics)));
  const alsoTopics = other.slice(0, 3).map((w) => wsTopic(w, L));
  if (alsoTopics.length) out.push(P.daySummaryAlso(dedupeStrings(alsoTopics)));
  out.push("");

  // --- PRINCIPAIS FRENTES: one narrative paragraph per main workstream. ---
  out.push(P.mainWork);
  out.push("");
  for (const w of (main.length ? main : streams.slice(0, 3))) {
    const s = signalsOf(w, L);
    out.push(`### ${wsHeading(w, L)}`);
    out.push(P.wsNarrative(s));
    out.push(`${P.outcomeLabel}: ${P.wsOutcome(s)}`);
    out.push("");
  }

  // --- OTHER: smaller/support/operational work, briefly. ---
  if (other.length) {
    out.push(P.otherWork);
    for (const w of other) {
      const s = signalsOf(w, L);
      out.push(bullet(`${wsHeading(w, L)} — ${outcomeWord(L, w.status)}. ${P.wsNarrative(s)}`));
    }
    out.push("");
  }

  // --- PROBLEMS / INTERRUPTIONS: only significant errors/blockers/operational. ---
  const problems: string[] = [];
  for (const w of streams) {
    if (w.status === "blocked") problems.push(`${wsHeading(w, L)}: ${outcomeWord(L, "blocked")}`);
    else if (w.workKind === "operational") problems.push(wsHeading(w, L));
    else if (w.activities.some((a) => (a.errorCount ?? 0) > 0)) problems.push(wsHeading(w, L));
  }
  out.push(P.problems);
  if (problems.length) dedupeStrings(problems).forEach((p) => out.push(bullet(p)));
  else out.push(P.noProblems);
  out.push("");

  // --- TECHNICAL AREAS. ---
  const terms = allTechTerms(streams);
  if (terms.length) {
    out.push(P.technicalAreas);
    out.push(terms.slice(0, 12).join(", "));
    out.push("");
  }

  // --- WHAT WAS LEFT OPEN. ---
  out.push(P.leftOpen);
  const open = openItems(streams);
  if (open.length) open.forEach((w) => out.push(bullet(`${wsHeading(w, L)} — ${outcomeWord(L, w.status)}`)));
  else out.push(P.noneOpen);

  return out.join("\n").trim();
}

/** REVIEW — concise, one narrative line + status per workstream. */
function renderReview(input: ReportInput): string {
  const L = lang(input);
  const P = phrases(L);
  const out: string[] = [];
  out.push(`${P.reviewTitle} — ${dateLabel(input.range.start)} → ${dateLabel(input.range.end)}`);
  out.push("");
  if (input.workstreams.length === 0) { out.push(P.noActivities); return out.join("\n"); }
  for (const w of input.workstreams) {
    const s = signalsOf(w, L);
    out.push(`### ${wsHeading(w, L)}`);
    out.push(bullet(P.wsNarrative(s)));
    out.push(`${P.status}: ${outcomeWord(L, w.status)}`);
    if (w.techTerms.length) out.push(`${P.technicalAreas}: ${w.techTerms.slice(0, 8).join(", ")}.`);
    out.push("");
  }
  return out.join("\n").trim();
}

/** EXECUTIVE — a top-level paragraph then a compact ranked workstream list. */
function renderExecutive(input: ReportInput): string {
  const L = lang(input);
  const P = phrases(L);
  const out: string[] = [];
  out.push(`${P.executiveTitle} — ${dateLabel(input.range.start)} → ${dateLabel(input.range.end)}`);
  out.push("");
  if (input.workstreams.length === 0) { out.push(P.noActivities); return out.join("\n"); }
  const { main, other } = splitMainOther(input.workstreams);
  const focus = (main.length ? main : input.workstreams).slice(0, 3).map((w) => wsTopic(w, L));
  out.push(P.daySummaryMain(dedupeStrings(focus)));
  const also = other.slice(0, 3).map((w) => wsTopic(w, L));
  if (also.length) out.push(P.daySummaryAlso(dedupeStrings(also)));
  out.push("");
  for (const w of input.workstreams) {
    out.push(bullet(`${wsHeading(w, L)} — ${outcomeWord(L, w.status)} (${w.activities.length})`));
  }
  return out.join("\n").trim();
}

/** DAILY (natural, say-aloud) — one localized narrative, honest about outcome. */
function renderDailyNarrative(input: ReportInput): string {
  const L = lang(input);
  const P = phrases(L);
  const streams = input.workstreams;
  if (streams.length === 0) return P.noActivities;
  const { main, other } = splitMainOther(streams);
  const mainTopic = wsTopic(main[0] ?? streams[0], L);
  const otherTopics = dedupeStrings(other.slice(0, 2).map((w) => wsTopic(w, L)));
  const parts: string[] = [];
  parts.push(P.dailyNarrative(mainTopic, otherTopics));
  parts.push(P.dailyOutcome((main[0] ?? streams[0]).status));
  return parts.join(" ");
}

function dedupeStrings(xs: string[]): string[] { return [...new Set(xs.filter(Boolean))]; }

export function renderDeterministic(input: ReportInput): string {
  switch (input.kind) {
    case "help_me_remember":
      return renderHelpMeRemember(input);
    case "review":
      return renderReview(input);
    case "executive":
      return renderExecutive(input);
    case "daily":
      // spoken daily keeps the duration-budgeted path; otherwise the localized
      // natural narrative built from workstreams.
      return input.style === "spoken" ? renderDaily(input) : renderDailyNarrative(input);
    case "weekly":
      return renderGrouped(input, headerFor(input));
    case "monthly":
      return renderGrouped(input, headerFor(input));
    case "custom":
    default:
      return renderGrouped(input, headerFor(input));
  }
}

export class DeterministicProvider implements ReportProvider {
  readonly name = "deterministic";
  readonly external = false;
  async generateReport(input: ReportInput): Promise<{ content: string }> {
    return { content: renderDeterministic(input) };
  }
}

/**
 * Render a StructuredReport: the deterministic prose PLUS a traceable section
 * per workstream (heading + member activity IDs). The sections keep the
 * workstream → activity references intact for downstream traceability, even if
 * an external composer later rewrites the `content`.
 */
export function renderStructured(input: ReportInput): import("@devrecap/shared").StructuredReport {
  const L = input.resolvedLanguage;
  const content = renderDeterministic(input);
  const sections: import("@devrecap/shared").StructuredReportSection[] = input.workstreams.map((w) => ({
    heading: wsHeading(w, L),
    body: phrases(L).wsNarrative(signalsOf(w, L)),
    workstreamId: w.id,
    activityIds: w.activities.map((a) => a.id),
  }));
  return { content, sections, composer: "deterministic", fellBack: false };
}

// --- small language helpers (kept intentionally simple, no NLP dep) ---------

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Best-effort past-tensing of a leading verb for spoken output. */
function pastify(clause: string): string {
  const c = lowerFirst(clause);
  const first = c.split(" ")[0];
  const map: Record<string, string> = {
    fix: "fixed",
    add: "added",
    implement: "implemented",
    investigate: "investigated",
    refactor: "refactored",
    update: "updated",
    create: "created",
    test: "tested",
    configure: "configured",
    deploy: "deployed",
    review: "reviewed",
    build: "built",
    worked: "worked on",
  };
  if (map[first]) return c.replace(first, map[first]);
  // If it doesn't start with a known verb, phrase as "worked on X".
  if (!/(ed|ing)\b/.test(first)) return `worked on ${c}`;
  return c;
}
