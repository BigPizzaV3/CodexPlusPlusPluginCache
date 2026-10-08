import type { ActivitySummary, ReportInput, Workstream } from "@devrecap/shared";
import { objectivePhrase, objectiveSubject, topicLabel, type Lang } from "./language.ts";

export interface AnalysisItem {
  title: string;
  narrative: string;
  activityIds: string[];
  confidence: number;
}

export interface ReportAnalysis {
  version: 1;
  headline: string;
  executiveSummary: string;
  summaryActivityIds: string[];
  mainFocus?: AnalysisItem;
  highlights: AnalysisItem[];
  investigations: AnalysisItem[];
  inProgress: AnalysisItem[];
  blockers: AnalysisItem[];
  nextSteps: AnalysisItem[];
}

export interface AnalysisOptions { language?: string; request?: string; }
export interface AnalysisContract {
  version: 1;
  language: string;
  rules: string[];
  allowedActivityIds: string[];
  outputShape: Record<string, unknown>;
  facts: ReportInput;
}

export function buildAnalysisContract(input: ReportInput, options: AnalysisOptions = {}): AnalysisContract {
  const allowedActivityIds = input.projects.flatMap((p) => p.activities.map((a) => a.id));
  const language = options.language ?? (input.resolvedLanguage === "pt" ? "pt-BR" : "en");
  return {
    version: 1,
    language,
    allowedActivityIds,
    rules: [
      "Use only the supplied facts.",
      "Every analysis item must reference one or more allowed activityIds.",
      "Use facts.workstreams to describe broader objectives; do not turn filenames, command counts, or technology names into the main meaning of the work.",
      "Never change an in_progress, blocked, or unknown activity into completed work.",
      "Session activity means worked on; shipped/delivered language requires completion or commit evidence.",
      "Highlights/key deliveries may reference only completed activities.",
      "In-progress, blocker, and investigation sections must match the referenced activities' evidence-backed state.",
      "Do not repeat the same activity in multiple report sections. Choose the single section that best describes it.",
      "Only populate nextSteps when facts.nextSteps contains an explicit evidence-backed next step. Never invent 'continue or verify' filler.",
      "Prefer meaningful outcomes and objectives over command-by-command narration or telemetry.",
      "Return JSON only.",
    ],
    outputShape: {
      headline: "string",
      executiveSummary: "string",
      summaryActivityIds: ["act_id"],
      mainFocus: { title: "string", narrative: "string", activityIds: ["act_id"], confidence: 0.9 },
      highlights: [], investigations: [], inProgress: [], blockers: [], nextSteps: [],
    },
    facts: input,
  };
}

export function buildAnalysisPrompt(input: ReportInput, options: AnalysisOptions = {}): string {
  const contract = buildAnalysisContract(input, options);
  return [
    "You are the DevRecap analysis layer.",
    options.request ? `User request: ${options.request}` : "",
    `Language: ${contract.language}.`,
    "Analyze only the contract facts. Never invent work. Return exactly one JSON object matching outputShape, and cite allowed activityIds in every item.",
    JSON.stringify(contract, null, 2),
  ].filter(Boolean).join("\n");
}

export function validateReportAnalysis(input: ReportInput, raw: unknown): ReportAnalysis {
  const fallback = buildDeterministicAnalysis(input);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;

  const o = raw as Record<string, unknown>;
  const activities = input.projects.flatMap((p) => p.activities);
  const byId = new Map(activities.map((a) => [a.id, a]));
  const known = new Set(byId.keys());
  const summaryIds = ids(o.summaryActivityIds, known);
  const list = (value: unknown, max = 8, predicate?: (a: ActivitySummary) => boolean) =>
    validateItems(value, known, byId, max, predicate);

  const candidateHighlights = list(o.highlights, 8, (a) => a.status === "completed");
  const candidateBlockers = list(o.blockers, 6, (a) => a.status === "blocked");
  const candidateInvestigations = list(o.investigations, 8, (a) => a.category === "investigation" && a.status !== "completed" && a.status !== "blocked");
  const candidateProgress = list(o.inProgress, 8, (a) => a.status === "in_progress" || a.status === "unknown");
  const candidateNext = input.nextSteps.length
    ? list(o.nextSteps, 6, (a) => a.status !== "completed")
    : [];

  // A recap is a partition, not a telemetry dump. One activity may support the
  // main-focus overview, but it must not be repeated across the detail sections.
  const seen = new Set<string>();
  const highlights = uniqueSection(candidateHighlights.length ? candidateHighlights : fallback.highlights, seen);
  const blockers = uniqueSection(candidateBlockers.length ? candidateBlockers : fallback.blockers, seen);
  const investigations = uniqueSection(candidateInvestigations.length ? candidateInvestigations : fallback.investigations, seen);
  const inProgress = uniqueSection(candidateProgress.length ? candidateProgress : fallback.inProgress, seen);
  const nextSteps = input.nextSteps.length
    ? uniqueSection(candidateNext.length ? candidateNext : fallback.nextSteps, seen)
    : [];

  return {
    version: 1,
    headline: text(o.headline, fallback.headline, 140),
    executiveSummary: text(o.executiveSummary, fallback.executiveSummary, 1400),
    summaryActivityIds: summaryIds.length ? summaryIds : fallback.summaryActivityIds,
    mainFocus: validateItem(o.mainFocus, known, byId) ?? fallback.mainFocus,
    highlights,
    investigations,
    inProgress,
    blockers,
    nextSteps,
  };
}

export function buildDeterministicAnalysis(input: ReportInput): ReportAnalysis {
  const all = input.projects.flatMap((p) => p.activities);
  const done = all.filter((a) => a.status === "completed");
  const open = all.filter((a) => a.status === "in_progress" || a.status === "unknown");
  const L: Lang = input.resolvedLanguage;
  const period = `${input.range.start.slice(0, 10)} → ${input.range.end.slice(0, 10)}`;
  const fronts = consolidateForReport(input.workstreams)
    .sort((a, b) => b.significance - a.significance);
  const primary = fronts.filter((w) => w.workKind === "primary");
  const ranked = primary.length ? primary : fronts;

  if (!all.length) {
    return {
      version: 1,
      headline: L === "pt" ? "DevRecap — nenhuma atividade relevante" : "DevRecap — no meaningful activity detected",
      executiveSummary: L === "pt"
        ? `Nenhuma atividade de desenvolvimento sustentada por evidências foi detectada em ${period}.`
        : `No evidence-backed development activity was detected for ${period}.`,
      summaryActivityIds: [],
      highlights: [], investigations: [], inProgress: [], blockers: [], nextSteps: [],
    };
  }

  const completedFronts = fronts.filter((w) => w.status === "completed" && w.workKind === "primary");
  const blockedFronts = fronts.filter((w) => w.status === "blocked");
  const investigationFronts = fronts.filter((w) =>
    w.workKind === "primary" &&
    w.status !== "completed" &&
    w.status !== "blocked" &&
    isInvestigationFront(w));
  const progressFronts = fronts.filter((w) =>
    w.workKind === "primary" &&
    w.status !== "completed" &&
    w.status !== "blocked" &&
    !isInvestigationFront(w));

  const used = new Set<string>();
  const highlights = uniqueSection([
    ...completedFronts.map((w) => workstreamItem(w, input)),
    ...commitHighlights(all, L),
  ], used).slice(0, 8);
  const blockers = uniqueSection(blockedFronts.map((w) => workstreamItem(w, input)), used).slice(0, 6);
  const investigations = uniqueSection(investigationFronts.map((w) => workstreamItem(w, input)), used).slice(0, 8);
  const inProgress = uniqueSection(progressFronts.map((w) => workstreamItem(w, input)), used).slice(0, 8);

  const top = ranked[0];
  const headline = L === "pt"
    ? `DevRecap — ${all.length} atividades relevantes`
    : `DevRecap — ${all.length} meaningful activities`;
  const executiveSummary = L === "pt"
    ? `O DevRecap reconstruiu ${all.length} atividades relevantes em ${input.projects.length} projeto(s) no período ${period}. ${done.length} têm evidência de conclusão; ${open.length} permanecem em andamento ou sem confirmação. ${primary.length ? `${primary.length} frente(s) principal(is) foram consolidadas por objetivo.` : ""}`.trim()
    : `DevRecap reconstructed ${all.length} meaningful activities across ${input.projects.length} project(s) for ${period}. ${done.length} have completion evidence; ${open.length} remain in progress or unconfirmed. ${primary.length ? `${primary.length} main workstream(s) were consolidated by objective.` : ""}`.trim();

  return {
    version: 1,
    headline,
    executiveSummary,
    summaryActivityIds: ranked.flatMap((w) => w.activities.map((a) => a.id)).slice(0, 12),
    mainFocus: top ? workstreamItem(top, input) : undefined,
    highlights,
    investigations,
    inProgress,
    blockers,
    // No synthetic "Continue or verify" items. A next step is shown only when
    // the input contains an explicit evidence-backed next step.
    nextSteps: [],
  };
}

function consolidateForReport(streams: Workstream[]): Workstream[] {
  const groups = new Map<string, Workstream>();
  for (const w of streams) {
    const key = reportGroupKey(w);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ...w,
        activities: [...w.activities],
        techTerms: [...w.techTerms],
        topicSignals: [...w.topicSignals],
      });
      continue;
    }

    const activities = dedupeActivities([...existing.activities, ...w.activities]);
    const preferred = chooseMoreSpecific(existing, w);
    groups.set(key, {
      ...existing,
      title: preferred.title,
      objective: preferred.objective,
      activities,
      status: rollupStatus(activities),
      workKind: rollupWorkKind(activities),
      techTerms: [...new Set([...existing.techTerms, ...w.techTerms])],
      topicSignals: mergeSignals(existing.topicSignals, w.topicSignals),
      significance: existing.significance + w.significance,
      startedAt: existing.startedAt < w.startedAt ? existing.startedAt : w.startedAt,
      endedAt: existing.endedAt > w.endedAt ? existing.endedAt : w.endedAt,
    });
  }
  return [...groups.values()];
}

function reportGroupKey(w: Workstream): string {
  const project = w.projectId ?? "unassigned";
  if (w.topicKey === "git") return `${project}:git:${w.id}`; // keep individual commit/change fronts useful
  if (w.workKind === "operational" || w.topicKey === "operational") return `${project}:operational`;
  const subject = normalizeSubject(w.objective || w.title);
  if (subject && !isGenericSubject(subject)) return `${project}:${w.topicKey}:${subject}`;
  const tech = [...w.techTerms].map((t) => t.toLowerCase()).sort().slice(0, 2).join("+");
  return `${project}:${w.topicKey}:${tech || subject || "general"}`;
}

function normalizeSubject(value: string): string {
  return value.toLowerCase()
    .replace(/\b(build|fix|investigate|restructure|validate|document|configure|ship|organize|work on|worked on|developed|implemented|correct|adjust)\b/g, " ")
    .replace(/\b(the|a|an|for|to|of|on|in)\b/g, " ")
    .replace(/[^a-z0-9à-ú_]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericSubject(subject: string): boolean {
  return /^(api|project|configuration|application|app|system|code|files?|development|general)$/.test(subject);
}

function chooseMoreSpecific(a: Workstream, b: Workstream): Workstream {
  return specificity(b.objective || b.title) > specificity(a.objective || a.title) ? b : a;
}

function specificity(value: string): number {
  const subject = normalizeSubject(value);
  if (!subject) return 0;
  const words = subject.split(/\s+/).filter(Boolean);
  return (isGenericSubject(subject) ? 0 : 5) + words.length * 2 + Math.min(value.length, 80) / 80;
}

function rollupStatus(activities: ActivitySummary[]): Workstream["status"] {
  const statuses = new Set(activities.map((a) => a.status));
  if (statuses.size === 1 && statuses.has("completed")) return "completed";
  if (statuses.has("completed") && statuses.size > 1) return "partially_completed";
  if (statuses.has("in_progress")) return "in_progress";
  if (statuses.has("blocked")) return "blocked";
  return "unconfirmed";
}

function rollupWorkKind(activities: ActivitySummary[]): Workstream["workKind"] {
  if (activities.some((a) => a.workKind === "primary")) return "primary";
  if (activities.some((a) => a.workKind === "support")) return "support";
  if (activities.some((a) => a.workKind === "operational")) return "operational";
  return "noise";
}

function mergeSignals(a: Workstream["topicSignals"], b: Workstream["topicSignals"]): Workstream["topicSignals"] {
  const counts = new Map<string, number>();
  for (const signal of [...a, ...b]) counts.set(signal.term, (counts.get(signal.term) ?? 0) + signal.count);
  return [...counts].map(([term, count]) => ({ term, count })).sort((x, y) => y.count - x.count);
}

function dedupeActivities(activities: ActivitySummary[]): ActivitySummary[] {
  const seen = new Set<string>();
  return activities.filter((a) => !seen.has(a.id) && Boolean(seen.add(a.id)));
}

function isInvestigationFront(w: Workstream): boolean {
  const substantive = w.activities.filter((a) => a.workKind !== "noise");
  if (!substantive.length) return false;
  return substantive.filter((a) => a.category === "investigation").length >= Math.ceil(substantive.length / 2);
}

function workstreamItem(w: Workstream, input: ReportInput): AnalysisItem {
  const L: Lang = input.resolvedLanguage;
  const objective = (w.objective && w.objective.trim()) || w.title;
  const title = displayTitle(w, L, objective);
  const narrative = workstreamNarrative(w, L, objective, input.length);
  return {
    title,
    narrative,
    activityIds: w.activities.map((a) => a.id),
    confidence: clamp(avg(w.activities.map((a) => a.confidence))),
  };
}

function displayTitle(w: Workstream, L: Lang, objective: string): string {
  if (w.topicKey === "git") return L === "pt" ? "Versionamento e organização das mudanças" : "Git and change organization";
  if (w.workKind === "operational" || w.topicKey === "operational") return L === "pt" ? "Sessão e ambiente" : "Session and environment";
  const phrase = objectivePhrase(L, objective, w.techTerms).replace(/\s+/g, " ").trim();
  const normalized = normalizeSubject(phrase);
  if (!phrase || isGenericSubject(normalized)) {
    if (w.topicKey === "api") return L === "pt" ? "Trabalho na API" : "API work";
    if (w.topicKey === "config") return L === "pt" ? "Configuração" : "Configuration";
    const fallback = topicLabel(L, w.topicKey, w.techTerms).replace(/\s+/g, " ").trim();
    return cap(fallback || (L === "pt" ? "Frente de desenvolvimento" : "Development workstream"));
  }
  return cap(phrase);
}

function workstreamNarrative(w: Workstream, L: Lang, objective: string, length: ReportInput["length"]): string {
  if (w.topicKey === "git") {
    const commits = w.activities.filter((a) => a.committed).length;
    return L === "pt"
      ? commits ? `Houve organização das mudanças no Git, com ${commits} commit${commits === 1 ? "" : "s"} confirmado${commits === 1 ? "" : "s"} pelas evidências.` : "Houve trabalho de organização e revisão das mudanças no Git."
      : commits ? `Version-control work included ${commits} evidence-backed commit${commits === 1 ? "" : "s"}.` : "The work included organizing and reviewing changes in Git.";
  }
  if (w.workKind === "operational" || w.topicKey === "operational") {
    return L === "pt"
      ? "Houve uma questão operacional de sessão ou ambiente; ela é registrada como interrupção, não como entrega do projeto."
      : "A session or environment issue occurred; it is recorded as operational interruption, not as a project delivery.";
  }

  const subject = objectiveSubject(L, objective, w.techTerms).replace(/\s+/g, " ").trim();
  const edits = w.activities.reduce((n, a) => n + (a.filesModifiedCount ?? 0), 0);
  const tests = w.activities.reduce((n, a) => n + (a.testCount ?? 0), 0);
  const committed = w.activities.some((a) => a.committed);
  const parts: string[] = [];

  if (L === "pt") {
    parts.push(isInvestigationFront(w)
      ? `A frente envolveu investigação de ${subject || "uma área do projeto"}`
      : `O trabalho ficou concentrado em ${subject || "uma frente do projeto"}`);
    if (w.activities.length > 1) parts[0] += `, reunindo ${w.activities.length} atividades relacionadas`;
    parts[0] += ".";
    if (length === "detailed" && edits > 0) parts.push(`As evidências registram alterações em ${edits} arquivo${edits === 1 ? "" : "s"}, como detalhe de suporte — não como objetivo da frente.`);
    if (tests > 0) parts.push(`Também houve ${tests} execução${tests === 1 ? "" : "ões"} de teste associada${tests === 1 ? "" : "s"} ao trabalho.`);
    if (committed) parts.push("Há evidência de commit relacionada a essa frente.");
    parts.push(statusSentencePt(w.status));
  } else {
    parts.push(isInvestigationFront(w)
      ? `This workstream involved investigating ${subject || "a project area"}`
      : `The work focused on ${subject || "a project workstream"}`);
    if (w.activities.length > 1) parts[0] += ` across ${w.activities.length} related activities`;
    parts[0] += ".";
    if (length === "detailed" && edits > 0) parts.push(`The evidence records changes across ${edits} file${edits === 1 ? "" : "s"} as supporting detail, not as the workstream's objective.`);
    if (tests > 0) parts.push(`${tests} test run${tests === 1 ? " was" : "s were"} also associated with the work.`);
    if (committed) parts.push("Commit evidence is associated with this workstream.");
    parts.push(statusSentenceEn(w.status));
  }

  return parts.join(" ");
}

function statusSentencePt(status: Workstream["status"]): string {
  if (status === "completed") return "A conclusão dessa frente foi confirmada pelas evidências.";
  if (status === "partially_completed") return "Parte do trabalho foi concluída, mas ainda havia itens sem confirmação de conclusão.";
  if (status === "blocked") return "A frente terminou bloqueada segundo os registros disponíveis.";
  if (status === "in_progress") return "Ao final do período capturado, a frente ainda estava em andamento.";
  return "Os registros não são suficientes para confirmar a conclusão dessa frente.";
}

function statusSentenceEn(status: Workstream["status"]): string {
  if (status === "completed") return "The evidence confirms completion of this workstream.";
  if (status === "partially_completed") return "Part of the work was completed, while some items remained unconfirmed.";
  if (status === "blocked") return "The workstream ended blocked according to the available records.";
  if (status === "in_progress") return "At the end of the captured period, this workstream was still in progress.";
  return "The records are not sufficient to confirm completion of this workstream.";
}

function commitHighlights(all: ActivitySummary[], L: Lang): AnalysisItem[] {
  return all
    .filter((a) => a.status === "completed" && a.committed)
    .map((a) => ({
      title: a.title,
      narrative: L === "pt"
        ? "As alterações foram registradas em um commit confirmado pelas evidências."
        : "The changes were recorded in a commit confirmed by the evidence.",
      activityIds: [a.id],
      confidence: clamp(a.confidence),
    }));
}

function uniqueSection(items: AnalysisItem[], seen: Set<string>): AnalysisItem[] {
  const out: AnalysisItem[] = [];
  for (const item of mergeDuplicateItems(items)) {
    const remaining = item.activityIds.filter((id) => !seen.has(id));
    if (!remaining.length) continue;
    remaining.forEach((id) => seen.add(id));
    out.push({ ...item, activityIds: remaining });
  }
  return out;
}

function mergeDuplicateItems(items: AnalysisItem[]): AnalysisItem[] {
  const byTitle = new Map<string, AnalysisItem>();
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, { ...item, activityIds: [...item.activityIds] });
      continue;
    }
    existing.activityIds = [...new Set([...existing.activityIds, ...item.activityIds])];
    existing.confidence = Math.max(existing.confidence, item.confidence);
  }
  return [...byTitle.values()];
}

function validateItems(
  raw: unknown,
  known: Set<string>,
  byId: Map<string, ActivitySummary>,
  max: number,
  predicate?: (a: ActivitySummary) => boolean,
): AnalysisItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AnalysisItem[] = [];
  for (const x of raw) {
    const v = validateItem(x, known, byId, predicate);
    if (v) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function validateItem(
  raw: unknown,
  known: Set<string>,
  byId: Map<string, ActivitySummary>,
  predicate?: (a: ActivitySummary) => boolean,
): AnalysisItem | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const o = raw as Record<string, unknown>;
  const activityIds = ids(o.activityIds, known);
  if (!activityIds.length) return;
  if (predicate && !activityIds.every((id) => {
    const a = byId.get(id);
    return !!a && predicate(a);
  })) return;
  const narrative = text(o.narrative, "", 1200);
  if (!narrative) return;
  return {
    title: text(o.title, "Activity", 180),
    narrative,
    activityIds,
    confidence: typeof o.confidence === "number" ? clamp(o.confidence) : 0.7,
  };
}

function ids(raw: unknown, known: Set<string>): string[] {
  return Array.isArray(raw)
    ? [...new Set(raw.filter((x): x is string => typeof x === "string" && known.has(x)))]
    : [];
}

function text(raw: unknown, fallback: string, max: number): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return fallback;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((n, x) => n + x, 0) / values.length;
}

function cap(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, Number(n.toFixed(2))));
}
