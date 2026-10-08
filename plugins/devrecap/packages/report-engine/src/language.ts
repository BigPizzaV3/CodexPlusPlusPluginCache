/**
 * Report language support (Semantics V3).
 *
 * DevRecap sessions may be in English or Portuguese. Reports should read
 * naturally in the developer's own language. This module:
 *   - detects the dominant language of a set of user intents (for `auto`), and
 *   - provides a small deterministic phrase table so the local report engine
 *     can render fixed report scaffolding (headers, labels, connective prose)
 *     in en/pt without translating the user's own words or technical terms.
 *
 * We never translate imported content or technical terms — only the report's
 * own boilerplate is localized.
 */

import type { ReportLanguage } from "@devrecap/shared";

/** Portuguese stopword/diacritic markers used to detect PT text. */
const PT_MARKERS = /\b(?:não|são|está|estão|também|então|você|voc[eê]|pra|para|com|dos|das|uma|isso|fazer|preciso|gerar|contrato|arquivo|corrigir|precisa|configurar|ajust\w*|tudo|problema|erro)\b|[ãõçáéíóúâêô]/i;
const EN_MARKERS = /\b(?:the|and|for|with|please|fix|add|need|should|error|file|contract|generate|configure|adjust|investigate)\b/i;

/**
 * Infer the dominant language ("en" | "pt") from user-intent texts. Counts PT
 * vs EN marker hits; ties and empty input default to English.
 */
export function detectLanguage(intents: string[]): "en" | "pt" {
  let pt = 0, en = 0;
  for (const t of intents) {
    if (!t) continue;
    if (PT_MARKERS.test(t)) pt++;
    if (EN_MARKERS.test(t)) en++;
  }
  return pt > en ? "pt" : "en";
}

/** Resolve a requested ReportLanguage against detected intents. */
export function resolveLanguage(requested: ReportLanguage, intents: string[]): "en" | "pt" {
  if (requested === "en" || requested === "pt") return requested;
  return detectLanguage(intents);
}

export type Lang = "en" | "pt";

/** Evidence signals a workstream narrative is synthesized from. */
export interface WsSignals {
  topicLabel: string;      // localized topic label (e.g. "geração de documentos")
  memberCount: number;
  edits: number;           // files modified/created/deleted (summed)
  reads: number;           // files read/inspected
  tests: number;
  testsFailed: boolean;
  errors: number;
  committed: boolean;
  gitAction?: string;      // inspected|reviewed|branch|staged|committed|pushed
  status: string;          // WorkstreamStatus (completed|partially_completed|…)
  workKind: "primary" | "support" | "operational" | "noise";
  terms: string[];
}

/**
 * Fixed report scaffolding + a deterministic NARRATIVE synthesizer, localized.
 * The narrative is built from evidence SIGNALS (counts/status/terms), never from
 * raw prompts and never by prefixing an English verb to a title. Keep EN & PT
 * in parity.
 */
interface Phrases {
  helpMeRememberTitle: string;
  dayHeading: string;         // "Summary of the period" / "Resumo do período"
  mainWork: string;           // "Main work" / "Principais frentes"
  otherWork: string;          // "Other things you worked on"
  reviewTitle: string;
  executiveTitle: string;
  technicalAreas: string;
  problems: string;           // "Problems / interruptions"
  leftOpen: string;           // "What was left open"
  status: string;
  noActivities: string;
  noneOpen: string;           // "Nothing significant was left open."
  noProblems: string;
  outcomeLabel: string;
  outcomeCompleted: string;
  outcomePartial: string;
  outcomeInProgress: string;
  outcomeBlocked: string;
  outcomeUnconfirmed: string;
  outcomeUnknown: string;
  // day-summary sentence: what most effort went into
  daySummaryMain: (topics: string[]) => string;
  daySummaryAlso: (topics: string[]) => string;
  // one-sentence narrative for a workstream, from its evidence signals
  wsNarrative: (s: WsSignals) => string;
  // per-workstream outcome sentence
  wsOutcome: (s: WsSignals) => string;
  // daily
  dailyNarrative: (main: string, others: string[]) => string;
  dailyOutcome: (status: string) => string;
}

// ---- helpers shared by both languages ----
function joinList(items: string[], and: string): string {
  const xs = items.filter(Boolean);
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")} ${and} ${xs[xs.length - 1]}`;
}

/** PT: preposition "em" + a topic label, contracting the article naturally
 *  (em + a → na, em + o → no); otherwise plain "em <label>". */
function emPt(label: string): string {
  if (/^a /i.test(label)) return "na " + label.slice(2);
  if (/^o /i.test(label)) return "no " + label.slice(2);
  if (/^as /i.test(label)) return "nas " + label.slice(3);
  if (/^os /i.test(label)) return "nos " + label.slice(3);
  return "em " + label;
}

/** Join PT topic labels after the preposition "a", contracting the article
 *  ("a" + "a geração…" → "à geração…"; "a" + "o build" → "ao build"). */
function joinListPtDe(items: string[]): string {
  const contracted = items.filter(Boolean).map((s) =>
    /^a /i.test(s) ? "à " + s.slice(2) : /^o /i.test(s) ? "ao " + s.slice(2) : "a " + s,
  );
  if (contracted.length === 0) return "";
  if (contracted.length === 1) return contracted[0];
  return `${contracted.slice(0, -1).join(", ")} e ${contracted[contracted.length - 1]}`;
}

const EN: Phrases = {
  helpMeRememberTitle: "HELP ME REMEMBER",
  dayHeading: "Summary",
  mainWork: "Main work",
  otherWork: "Other things you worked on",
  reviewTitle: "REVIEW",
  executiveTitle: "EXECUTIVE SUMMARY",
  technicalAreas: "Technical areas",
  problems: "Problems / interruptions",
  leftOpen: "What was left open",
  status: "Status",
  noActivities: "No activities were recorded for this period.",
  noneOpen: "Nothing significant was left open.",
  noProblems: "No significant problems or interruptions were recorded.",
  outcomeLabel: "Outcome",
  outcomeCompleted: "Completed",
  outcomePartial: "Partially completed",
  outcomeInProgress: "In progress",
  outcomeBlocked: "Blocked",
  outcomeUnconfirmed: "Not confirmed in the records",
  outcomeUnknown: "Unclear",
  daySummaryMain: (t) => `You spent most of this period on ${joinList(t, "and")}.`,
  daySummaryAlso: (t) => `You also touched ${joinList(t, "and")}.`,
  wsNarrative: (s) => enWsNarrative(s),
  wsOutcome: (s) => enWsOutcome(s),
  dailyNarrative: (main, others) =>
    `Recently I worked mainly on ${main}.` +
    (others.length ? ` I also touched ${joinList(others, "and")}.` : ""),
  dailyOutcome: (st) =>
    st === "completed" ? "That work was completed."
    : st === "blocked" ? "That work is currently blocked."
    : "That work is still in progress.",
};

function enWsNarrative(s: WsSignals): string {
  if (s.workKind === "operational") {
    return `Handled a session/environment issue (operational work, not feature development).`;
  }
  if (s.workKind === "support" && s.gitAction) {
    const g = s.committed ? "created a commit"
      : s.gitAction === "pushed" ? "pushed changes"
      : s.gitAction === "staged" ? "staged changes"
      : s.gitAction === "branch" ? "worked with branches"
      : s.gitAction === "reviewed" ? "reviewed the changes"
      : "checked the repository state";
    return `Organized version control: ${g}.`;
  }
  const parts: string[] = [];
  if (s.reads) parts.push(`investigated ${s.topicLabel}`);
  else parts.push(`worked on ${s.topicLabel}`);
  if (s.edits) parts.push(`made changes across ${s.edits} file${s.edits === 1 ? "" : "s"}`);
  if (s.tests && !s.testsFailed) parts.push("and validated the result with tests");
  else if (s.testsFailed) parts.push("with tests still failing");
  let sentence = cap(joinPhrase(parts)) + ".";
  if (s.errors) sentence += ` A few errors came up during the work.`;
  return sentence;
}

function enWsOutcome(s: WsSignals): string {
  return s.status === "completed" ? "Completed."
    : s.status === "partially_completed" ? "Partially completed; some parts remain open."
    : s.status === "blocked" ? "Blocked."
    : s.status === "in_progress" ? "Still in progress; completion not confirmed."
    : s.status === "unconfirmed" ? "Not confirmed in the records."
    : "Outcome unclear.";
}

const PT: Phrases = {
  helpMeRememberTitle: "PARA ME LEMBRAR",
  dayHeading: "Resumo",
  mainWork: "Principais frentes",
  otherWork: "Outras coisas que você fez",
  reviewTitle: "REVISÃO",
  executiveTitle: "RESUMO EXECUTIVO",
  technicalAreas: "Áreas técnicas",
  problems: "Problemas / interrupções",
  leftOpen: "O que ficou em aberto",
  status: "Status",
  noActivities: "Nenhuma atividade foi registrada neste período.",
  noneOpen: "Nada relevante ficou em aberto.",
  noProblems: "Nenhum problema ou interrupção relevante foi registrado.",
  outcomeLabel: "Resultado",
  outcomeCompleted: "Concluído",
  outcomePartial: "Parcialmente concluído",
  outcomeInProgress: "Em andamento",
  outcomeBlocked: "Bloqueado",
  outcomeUnconfirmed: "Sem confirmação nos registros",
  outcomeUnknown: "Indefinido",
  daySummaryMain: (t) => `A maior parte deste período foi dedicada ${joinListPtDe(t)}.`,
  daySummaryAlso: (t) => `Você também trabalhou com ${joinList(t, "e")}.`,
  wsNarrative: (s) => ptWsNarrative(s),
  wsOutcome: (s) => ptWsOutcome(s),
  dailyNarrative: (main, others) =>
    `Recentemente trabalhei principalmente em ${main}.` +
    (others.length ? ` Também mexi em ${joinList(others, "e")}.` : ""),
  dailyOutcome: (st) =>
    st === "completed" ? "Esse trabalho foi concluído."
    : st === "blocked" ? "Esse trabalho está bloqueado no momento."
    : "Esse trabalho ainda está em andamento.",
};

function ptWsNarrative(s: WsSignals): string {
  if (s.workKind === "operational") {
    return `Você lidou com uma questão de sessão/ambiente (trabalho operacional, não de desenvolvimento).`;
  }
  if (s.workKind === "support" && s.gitAction) {
    const g = s.committed ? "criou um commit"
      : s.gitAction === "pushed" ? "enviou as alterações (push)"
      : s.gitAction === "staged" ? "preparou os arquivos (staging)"
      : s.gitAction === "branch" ? "trabalhou com branches"
      : s.gitAction === "reviewed" ? "revisou as alterações"
      : "verificou o estado do repositório";
    return `Organizou o versionamento: ${g}.`;
  }
  const parts: string[] = [];
  if (s.reads) parts.push(`investigou ${s.topicLabel}`);
  else parts.push(`trabalhou ${emPt(s.topicLabel)}`);
  if (s.edits) parts.push(`fez alterações em ${s.edits} arquivo${s.edits === 1 ? "" : "s"}`);
  if (s.tests && !s.testsFailed) parts.push("e validou o resultado com testes");
  else if (s.testsFailed) parts.push("com testes ainda falhando");
  let sentence = cap(joinPhrasePt(parts)) + ".";
  if (s.errors) sentence += ` Alguns erros apareceram durante o trabalho.`;
  return sentence;
}

function ptWsOutcome(s: WsSignals): string {
  return s.status === "completed" ? "Concluído."
    : s.status === "partially_completed" ? "Parcialmente concluído; parte do trabalho continua em aberto."
    : s.status === "blocked" ? "Bloqueado."
    : s.status === "in_progress" ? "Ainda em andamento; conclusão não confirmada."
    : s.status === "unconfirmed" ? "Não confirmado nos registros."
    : "Resultado indefinido.";
}

/** Join phrase parts naturally (EN): "a, made b and validated…". */
function joinPhrase(parts: string[]): string {
  const xs = parts.filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? "";
  // parts after the first are already connective (", " then last with no extra "and")
  return xs.reduce((acc, p, i) => (i === 0 ? p : `${acc}, ${p}`));
}
function joinPhrasePt(parts: string[]): string {
  const xs = parts.filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? "";
  return xs.reduce((acc, p, i) => (i === 0 ? p : `${acc}, ${p}`));
}

function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

export function phrases(lang: Lang): Phrases {
  return lang === "pt" ? PT : EN;
}

/** Localized outcome word for a workstream status (Grouping V3). */
export function outcomeWord(lang: Lang, status: string): string {
  const p = phrases(lang);
  switch (status) {
    case "completed": return p.outcomeCompleted;
    case "partially_completed": return p.outcomePartial;
    case "in_progress": return p.outcomeInProgress;
    case "blocked": return p.outcomeBlocked;
    case "unconfirmed": return p.outcomeUnconfirmed;
    default: return p.outcomeUnknown;
  }
}

/** Only these coarse buckets/reserved labels get a fixed localized label;
 *  everything else is named from the activities' own (technology/domain)
 *  signals and shown as-is (technical terms are never translated). */
const FIXED_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    git: "Git & change organization", operational: "Session & environment",
    "General development": "General development",
  },
  pt: {
    git: "Versionamento", operational: "Sessão e ambiente",
    "General development": "Trabalho geral de desenvolvimento",
  },
};

/**
 * Localized topic label for a workstream. For git/operational fronts a fixed
 * localized label is used. Otherwise the workstream's own signal-derived title
 * is used verbatim (its technical/domain terms must NOT be translated), lightly
 * lowercased for mid-sentence use.
 */
export function topicLabel(lang: Lang, topicKeyOrTitle: string, fallbackTerms: string[]): string {
  const fixed = FIXED_LABELS[lang][topicKeyOrTitle];
  if (fixed) return fixed;
  const title = (topicKeyOrTitle && topicKeyOrTitle !== "app")
    ? topicKeyOrTitle
    : (fallbackTerms.length ? fallbackTerms.slice(0, 2).join(lang === "pt" ? " e " : " and ") : "");
  if (!title) return lang === "pt" ? "desenvolvimento geral" : "general development";
  // Lowercase only an ordinary leading word; keep proper/acronym casing.
  const first = title.split(" ")[0];
  if (/^[A-Z][a-z]|^[A-Z]{2,}/.test(first)) return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/**
 * Localize a canonical English OBJECTIVE phrase ("Fix the contract generation")
 * for display. The frame verb + article are translated for PT; the SUBJECT
 * nouns (the developer's own domain terms) are preserved as-is. Reserved
 * sentinels ("General development", git/operational) route through FIXED_LABELS.
 */
const OBJECTIVE_VERB_PT: Record<string, string> = {
  Build: "Desenvolver", Fix: "Corrigir", Investigate: "Investigar",
  Restructure: "Reestruturar", Validate: "Validar", Document: "Documentar",
  Configure: "Configurar", Ship: "Publicar", Organize: "Organizar",
  "Work on": "Trabalhar em", "Evolve the data model for": "Evoluir o modelo de dados de",
};
export function objectivePhrase(lang: Lang, objective: string, fallbackTerms: string[]): string {
  const trimmed = (objective ?? "").trim();
  if (!trimmed || trimmed === "General development") {
    return lang === "pt" ? "Trabalho geral de desenvolvimento" : "General development";
  }
  const fixed = FIXED_LABELS[lang][trimmed];
  if (fixed) return fixed;
  if (lang === "en") return trimmed;
  // PT: translate the leading verb frame; keep the rest (subject) verbatim.
  for (const [en, pt] of Object.entries(OBJECTIVE_VERB_PT)) {
    if (trimmed.startsWith(en + " ")) {
      let rest = trimmed.slice(en.length + 1);
      // "the <x>" → "o/a <x>" is risky (gender); use neutral "de/do" framing.
      rest = rest.replace(/^the /i, "");
      return `${pt} ${rest}`.trim();
    }
  }
  return trimmed;
}

/**
 * The SUBJECT of an objective (the domain noun phrase, no verb, no article) for
 * MID-SENTENCE use where a narrative already supplies its own verb — avoids
 * "worked on Investigate the item" / "trabalhou em Trabalhar em …". Given
 * "Fix the friendly error" → "friendly error"; "Work on the single edit" →
 * "single edit". Subject nouns are preserved verbatim (never translated).
 * Reserved sentinels/git/operational return their localized fixed label.
 */
export function objectiveSubject(lang: Lang, objective: string, fallbackTerms: string[]): string {
  const trimmed = (objective ?? "").trim();
  if (!trimmed || trimmed === "General development") {
    return lang === "pt" ? "desenvolvimento geral" : "general development";
  }
  const fixed = FIXED_LABELS[lang][trimmed];
  if (fixed) return fixed;
  // Strip a known leading English verb frame (canonical objectives are English).
  let rest = trimmed;
  for (const en of Object.keys(OBJECTIVE_VERB_PT)) {
    if (rest.startsWith(en + " ")) { rest = rest.slice(en.length + 1); break; }
  }
  rest = rest.replace(/^the /i, "").trim();
  if (!rest) return objectivePhrase(lang, objective, fallbackTerms);
  const first = rest.split(" ")[0];
  if (/^[A-Z][a-z]|^[A-Z]{2,}/.test(first)) return rest;
  return rest.charAt(0).toLowerCase() + rest.slice(1);
}
