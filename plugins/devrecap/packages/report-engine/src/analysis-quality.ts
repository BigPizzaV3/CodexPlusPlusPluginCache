import type { ActivitySummary, ReportInput, Workstream } from "@devrecap/shared";
import {
  buildDeterministicAnalysis as baseBuildDeterministicAnalysis,
  validateReportAnalysis as baseValidateReportAnalysis,
  type AnalysisItem,
  type ReportAnalysis,
} from "./analysis.ts";

/**
 * Final semantic guardrails for user-facing recap output.
 *
 * The activity/workstream engine is intentionally conservative and
 * deterministic. That means a weak noun phrase can occasionally survive topic
 * extraction (for example conversational words such as "deste/traga" or a
 * tooling fragment such as "main event"). This layer never decides whether
 * work happened. It only prevents weak labels and telemetry from becoming the
 * story shown to the developer.
 */

const WEAK_SUBJECT_WORDS = new Set([
  // conversational / request glue (PT)
  "deste", "desta", "desse", "dessa", "destes", "destas", "desses", "dessas",
  "isto", "isso", "aquilo", "traga", "trazer", "mostre", "mostrar", "fale",
  "quero", "queria", "preciso", "poderia", "consegue", "conseguiria", "favor",
  "aqui", "agora", "depois", "antes", "entao", "então", "assim", "mesmo",
  // conversational / request glue (EN)
  "please", "could", "would", "want", "need", "show", "tell", "bring", "give",
  "this", "that", "these", "those", "here", "there", "then", "now",
  // process words that are usually parser/tooling residue when used as a subject
  "main", "payload", "response", "request", "message", "prompt", "context",
  "thread", "item", "items", "output", "input", "command", "commands", "progress",
]);

const GENERIC_SUBJECTS = new Set([
  "application", "app", "system", "project", "task", "code", "files", "file",
  "development", "general", "configuration", "aplicacao", "aplicação", "sistema",
  "projeto", "tarefa", "codigo", "código", "arquivos", "arquivo", "desenvolvimento",
]);

const KNOWN_CASE: Record<string, string> = {
  api: "API",
  pdf: "PDF",
  vue: "Vue",
  docker: "Docker",
  laravel: "Laravel",
  docusign: "DocuSign",
  acroform: "AcroForm",
  codex: "Codex",
  claude: "Claude",
  github: "GitHub",
  git: "Git",
  readme: "README",
  sql: "SQL",
  mysql: "MySQL",
  postgres: "Postgres",
  oauth: "OAuth",
  jwt: "JWT",
};

export function buildDeterministicAnalysis(input: ReportInput): ReportAnalysis {
  return polishAnalysis(input, baseBuildDeterministicAnalysis(input), true);
}

export function validateReportAnalysis(input: ReportInput, raw: unknown): ReportAnalysis {
  return polishAnalysis(input, baseValidateReportAnalysis(input, raw), false);
}

function polishAnalysis(input: ReportInput, analysis: ReportAnalysis, aggressive: boolean): ReportAnalysis {
  const L = input.resolvedLanguage;
  const activityById = new Map(
    input.projects.flatMap((p) => p.activities).map((a) => [a.id, a] as const),
  );
  const workstreamByActivity = new Map<string, Workstream>();
  for (const w of input.workstreams) {
    for (const a of w.activities) workstreamByActivity.set(a.id, w);
  }

  const polishItem = (item: AnalysisItem, section: Section): AnalysisItem => {
    const w = bestWorkstream(item.activityIds, workstreamByActivity);
    const activities = item.activityIds
      .map((id) => activityById.get(id))
      .filter((a): a is ActivitySummary => Boolean(a));
    const commitOnly = section === "highlight" && activities.length > 0 && activities.every((a) => a.committed);

    if (commitOnly) {
      return {
        ...item,
        title: polishCommitTitle(item.title, L),
        narrative: L === "pt"
          ? "As alterações foram registradas em commit e têm evidência de conclusão."
          : "The changes were recorded in a commit and have completion evidence.",
      };
    }

    const badTitle = lowQualityTitle(item.title);
    const title = w && (aggressive || badTitle)
      ? safeWorkstreamTitle(w, L, item.title)
      : properCaseTerms(item.title);

    const telemetryNarrative = /\b\d+\s+(?:files?|commands?|arquivos?|comandos?)\b|\b(?:app\.js|n-async)\b/i.test(item.narrative);
    const narrative = w && (aggressive || badTitle || telemetryNarrative)
      ? safeWorkstreamNarrative(w, L)
      : item.narrative;

    return { ...item, title, narrative };
  };

  const mainFocus = analysis.mainFocus ? polishItem(analysis.mainFocus, "focus") : undefined;
  const highlights = dedupeItems(analysis.highlights.map((x) => polishItem(x, "highlight")));
  const investigations = dedupeItems(analysis.investigations.map((x) => polishItem(x, "investigation")));
  const inProgress = dedupeItems(analysis.inProgress.map((x) => polishItem(x, "progress")));
  const blockers = dedupeItems(analysis.blockers.map((x) => polishItem(x, "blocker")));
  const nextSteps = dedupeItems(analysis.nextSteps.map((x) => polishItem(x, "next")));

  return {
    ...analysis,
    headline: localizedHeadline(input),
    executiveSummary: localizedSummary(input),
    mainFocus,
    highlights,
    investigations,
    inProgress,
    blockers,
    nextSteps,
  };
}

type Section = "focus" | "highlight" | "investigation" | "progress" | "blocker" | "next";

function bestWorkstream(ids: string[], byActivity: Map<string, Workstream>): Workstream | undefined {
  const counts = new Map<Workstream, number>();
  for (const id of ids) {
    const w = byActivity.get(id);
    if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].significance - a[0].significance)[0]?.[0];
}

function safeWorkstreamTitle(w: Workstream, L: "pt" | "en", original: string): string {
  if (w.topicKey === "git") {
    return L === "pt" ? "Versionamento e organização das mudanças" : "Git and change organization";
  }
  if (w.workKind === "operational" || w.topicKey === "operational") {
    return L === "pt" ? "Sessão e ambiente" : "Session and environment";
  }

  const candidate = properCaseTerms(original.replace(/\s+/g, " ").trim());
  if (!lowQualityTitle(candidate)) return candidate;

  const project = cleanProjectName(w.projectName);
  const investigation = isInvestigationFront(w);
  const coarse = coarseTopic(w, L, investigation);
  if (coarse) return project ? `${coarse} — ${project}` : coarse;

  if (project) {
    if (L === "pt") {
      if (investigation) return `Investigação em ${project}`;
      const category = dominantCategory(w);
      if (category === "bugfix") return `Correções em ${project}`;
      if (category === "configuration") return `Configuração em ${project}`;
      if (category === "deployment") return `Deploy em ${project}`;
      if (category === "testing") return `Validação em ${project}`;
      return `Desenvolvimento em ${project}`;
    }
    if (investigation) return `Investigation in ${project}`;
    const category = dominantCategory(w);
    if (category === "bugfix") return `Fixes in ${project}`;
    if (category === "configuration") return `Configuration in ${project}`;
    if (category === "deployment") return `Deployment in ${project}`;
    if (category === "testing") return `Validation in ${project}`;
    return `Development in ${project}`;
  }

  return L === "pt"
    ? (investigation ? "Frente de investigação" : "Frente de desenvolvimento")
    : (investigation ? "Investigation workstream" : "Development workstream");
}

function coarseTopic(w: Workstream, L: "pt" | "en", investigation: boolean): string {
  const signals = new Set([
    w.topicKey,
    ...w.topicSignals.map((s) => s.term),
  ].map((x) => x.toLowerCase()));

  const has = (...xs: string[]) => xs.some((x) => signals.has(x));
  if (has("api", "endpoint", "webhook")) {
    if (L === "pt") return investigation ? "Investigação da API" : "Trabalho na API";
    return investigation ? "API investigation" : "API work";
  }
  if (has("auth", "authentication", "oauth", "jwt", "saml")) {
    return L === "pt" ? "Autenticação" : "Authentication";
  }
  if (has("database", "db", "sql", "schema", "migration")) {
    return L === "pt" ? "Banco de dados" : "Database";
  }
  if (has("ui", "frontend", "interface")) {
    return L === "pt" ? "Interface" : "User interface";
  }
  if (has("test", "tests", "testing")) {
    return L === "pt" ? "Validação e testes" : "Validation and tests";
  }
  return "";
}

function safeWorkstreamNarrative(w: Workstream, L: "pt" | "en"): string {
  const n = w.activities.length;
  const project = cleanProjectName(w.projectName);
  const investigation = isInvestigationFront(w);
  const terms = usefulTechnicalTerms(w).slice(0, 3);
  const hasTests = w.activities.some((a) => (a.testCount ?? 0) > 0);
  const hasCommit = w.activities.some((a) => a.committed);

  const parts: string[] = [];
  if (L === "pt") {
    const count = `${n} ${n === 1 ? "atividade" : "atividades"}`;
    const projectClause = project ? ` no projeto ${project}` : "";
    parts.push(investigation
      ? `A frente reuniu ${count} de investigação${projectClause}.`
      : `A frente reuniu ${count} relacionadas${projectClause}.`);
    if (terms.length) parts.push(`Os registros relacionam essa frente a ${joinPt(terms)}.`);
    if (hasTests) parts.push("Há evidência de testes associados ao trabalho.");
    if (hasCommit) parts.push("Há evidência de commit relacionada a essa frente.");
    parts.push(statusPt(w.status));
  } else {
    const count = `${n} related activit${n === 1 ? "y" : "ies"}`;
    const projectClause = project ? ` in ${project}` : "";
    parts.push(investigation
      ? `This workstream grouped ${count} focused on investigation${projectClause}.`
      : `This workstream grouped ${count}${projectClause}.`);
    if (terms.length) parts.push(`The records associate this workstream with ${joinEn(terms)}.`);
    if (hasTests) parts.push("There is test evidence associated with the work.");
    if (hasCommit) parts.push("There is commit evidence associated with this workstream.");
    parts.push(statusEn(w.status));
  }
  return parts.join(" ");
}

function lowQualityTitle(value: string): boolean {
  const title = value.trim();
  if (!title) return true;
  if (/^\S+\.(?:js|ts|tsx|jsx|php|py|rb|go|rs|java|md|json|yml|yaml)$/i.test(title)) return true;
  if (/\b\d+\s+(?:files?|commands?|arquivos?|comandos?)\b/i.test(title)) return true;

  const subject = normalizeSubject(title);
  if (!subject) return true;
  const tokens = subject.split(/\s+/).filter(Boolean);
  if (tokens.some((t) => WEAK_SUBJECT_WORDS.has(t))) return true;
  if (tokens.length === 1 && GENERIC_SUBJECTS.has(tokens[0])) return true;
  return false;
}

function normalizeSubject(value: string): string {
  return value.toLowerCase()
    .replace(/\b(build|fix|investigate|restructure|validate|document|configure|ship|organize|work on|worked on|developed|implemented|correct|adjust|corrigir|investigar|desenvolver|configurar|validar|documentar|publicar|organizar|trabalhar em|correções|correcoes|configuração|configuracao)\b/giu, " ")
    .replace(/\b(the|a|an|for|to|of|on|in|o|a|os|as|de|do|da|dos|das|em|no|na|nos|nas|para)\b/giu, " ")
    .replace(/[^a-z0-9à-ú_.-]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localizedHeadline(input: ReportInput): string {
  const total = input.projects.reduce((n, p) => n + p.activities.length, 0);
  if (input.resolvedLanguage === "pt") {
    return total ? `DevRecap — ${total} ${total === 1 ? "atividade relevante" : "atividades relevantes"}` : "DevRecap — nenhuma atividade relevante";
  }
  return total ? `DevRecap — ${total} meaningful activit${total === 1 ? "y" : "ies"}` : "DevRecap — no meaningful activity detected";
}

function localizedSummary(input: ReportInput): string {
  const activities = input.projects.flatMap((p) => p.activities);
  const projects = input.projects.filter((p) => p.activities.length > 0).length;
  const done = activities.filter((a) => a.status === "completed").length;
  const open = activities.filter((a) => a.status === "in_progress" || a.status === "unknown").length;
  const fronts = new Set(
    input.workstreams
      .filter((w) => w.workKind === "primary")
      .map((w) => safeWorkstreamTitle(w, input.resolvedLanguage, w.title).toLowerCase()),
  ).size;
  const period = `${input.range.start.slice(0, 10)} → ${input.range.end.slice(0, 10)}`;

  if (input.resolvedLanguage === "pt") {
    const projectText = `${projects} ${projects === 1 ? "projeto" : "projetos"}`;
    const doneText = `${done} ${done === 1 ? "tem" : "têm"} evidência de conclusão`;
    const openText = `${open} ${open === 1 ? "permanece" : "permanecem"} em andamento ou sem confirmação`;
    const frontText = fronts ? ` ${fronts} ${fronts === 1 ? "frente principal foi consolidada" : "frentes principais foram consolidadas"} por objetivo.` : "";
    return `O DevRecap reconstruiu ${activities.length} ${activities.length === 1 ? "atividade relevante" : "atividades relevantes"} em ${projectText} no período ${period}. ${doneText}; ${openText}.${frontText}`;
  }

  const projectText = `${projects} project${projects === 1 ? "" : "s"}`;
  const doneText = `${done} ${done === 1 ? "has" : "have"} completion evidence`;
  const openText = `${open} ${open === 1 ? "remains" : "remain"} in progress or unconfirmed`;
  const frontText = fronts ? ` ${fronts} main workstream${fronts === 1 ? " was" : "s were"} consolidated by objective.` : "";
  return `DevRecap reconstructed ${activities.length} meaningful activit${activities.length === 1 ? "y" : "ies"} across ${projectText} for ${period}. ${doneText}; ${openText}.${frontText}`;
}

function polishCommitTitle(raw: string, L: "pt" | "en"): string {
  const title = raw.replace(/\s+/g, " ").trim();
  if (/^readme(?:\.md)?$/i.test(title)) return L === "pt" ? "Atualização do README" : "README update";

  const conventional = /^(feat(?:ure|ura)?|fix|docs|chore|refactor|test|build|ci)(?:\(([^)]+)\))?:\s*(.+)$/i.exec(title);
  if (conventional) {
    const scope = conventional[2] ? properCaseTerms(conventional[2].trim()) : "";
    const message = cap(properCaseTerms(conventional[3].trim()));
    return scope ? `${message} — ${scope}` : message;
  }
  return properCaseTerms(title);
}

function properCaseTerms(value: string): string {
  let out = value;
  for (const [raw, display] of Object.entries(KNOWN_CASE)) {
    out = out.replace(new RegExp(`\\b${escapeRegex(raw)}\\b`, "gi"), display);
  }
  return out;
}

function cleanProjectName(value?: string): string {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  if (!v || /^(unassigned|other|project|projeto)$/i.test(v)) return "";
  return properCaseTerms(v);
}

function usefulTechnicalTerms(w: Workstream): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of w.techTerms) {
    const t = properCaseTerms(raw.trim());
    const key = t.toLowerCase();
    if (!t || key.length < 2 || GENERIC_SUBJECTS.has(key) || seen.has(key)) continue;
    if (/^\S+\.(?:js|ts|tsx|jsx|php|py|rb|go|rs|java)$/i.test(t)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function dominantCategory(w: Workstream): ActivitySummary["category"] {
  const count = new Map<ActivitySummary["category"], number>();
  for (const a of w.activities) count.set(a.category, (count.get(a.category) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
}

function isInvestigationFront(w: Workstream): boolean {
  const substantive = w.activities.filter((a) => a.workKind !== "noise");
  if (!substantive.length) return false;
  return substantive.filter((a) => a.category === "investigation").length >= Math.ceil(substantive.length / 2);
}

function statusPt(status: Workstream["status"]): string {
  if (status === "completed") return "A conclusão dessa frente foi confirmada pelas evidências.";
  if (status === "partially_completed") return "Parte do trabalho foi concluída, mas ainda havia itens sem confirmação de conclusão.";
  if (status === "blocked") return "A frente terminou bloqueada segundo os registros disponíveis.";
  if (status === "in_progress") return "Ao final do período capturado, a frente ainda estava em andamento.";
  return "Os registros não são suficientes para confirmar a conclusão dessa frente.";
}

function statusEn(status: Workstream["status"]): string {
  if (status === "completed") return "The evidence confirms completion of this workstream.";
  if (status === "partially_completed") return "Part of the work was completed, while some items remained unconfirmed.";
  if (status === "blocked") return "The workstream ended blocked according to the available records.";
  if (status === "in_progress") return "At the end of the captured period, this workstream was still in progress.";
  return "The records are not sufficient to confirm completion of this workstream.";
}

function dedupeItems(items: AnalysisItem[]): AnalysisItem[] {
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

function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function joinEn(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function cap(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
