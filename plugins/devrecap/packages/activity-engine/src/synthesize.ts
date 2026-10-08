/**
 * Activity synthesis (Semantic Synthesis V2).
 *
 * The report layer must describe WORK, not replay the developer's prompts. This
 * module derives a NORMALIZED, evidence-grounded descriptor for a finished
 * TaskCandidate:
 *
 *   - workKind: PRIMARY_WORK | SUPPORT_WORK | OPERATIONAL | NOISE
 *   - gitAction: the precise git action actually observed (never inferred from
 *     generic output — `git status` is inspection, not a commit)
 *   - title: a concise topic phrase built from category + files + technical
 *     terms, NOT the raw user prompt (a prompt is evidence of intent, not prose)
 *   - topicKey / topicTokens: stable signals for conservative workstream grouping
 *
 * Everything here is deterministic and evidence-only. Paths/commands are DATA
 * ONLY — never opened or executed.
 */

import type { ActivityCategory, ActivityStatus, NormalizedEvent } from "@devrecap/shared";
import { basename } from "@devrecap/shared";

/** How a piece of work fits the developer's memory of the day. */
export type WorkKind = "primary" | "support" | "operational" | "noise";

/** A precise, observed git action (only what the evidence actually shows). */
export type GitAction =
  | "inspected"   // git status / log / show / blame
  | "reviewed"    // git diff
  | "branch"      // git switch / checkout / branch
  | "staged"      // git add / reset
  | "committed"   // git commit
  | "pushed"      // git push / pull / fetch
  | "stash"       // git stash
  | "other";

/**
 * A compact, evidence-derived semantic profile of one activity, used by the
 * report layer to CLUSTER and NAME workstreams by objective (not by generic
 * grammar or by one shared technology keyword). Everything is lowercased,
 * deduped, and free of generic/stop concepts. No raw prompts, paths, or
 * commands are stored here — only distilled signals.
 */
export interface TopicProfile {
  /** Domain nouns describing the SUBJECT of the work (contract, signature…). */
  domainTerms: string[];
  /** Named technical entities/technologies (DocuSign, Vue, PDF, Docker…). */
  technologies: string[];
  /** Component/area hints (from directories/components, e.g. "editor"). */
  components: string[];
  /** Action verbs observed (investigate, configure, validate…). */
  actions: string[];
  /**
   * The single strongest recurring signal for this activity — the concept most
   * likely to define its objective. Empty when nothing specific is detectable.
   */
  primarySignal: string;
}

export interface ActivityDescriptor {
  title: string;
  workKind: WorkKind;
  /** Precise git action when this activity is git-centric; else undefined. */
  gitAction?: GitAction;
  /** Lowercase topic tokens used for conservative workstream grouping. */
  topicTokens: string[];
  /** A coarse topic key ("app" | "git" | "operational" | "docs" | …). */
  topicKey: string;
  /** Compact semantic profile for workstream clustering + naming. */
  topicProfile: TopicProfile;
  /** Canonical objective (WHY the work existed); "" for git/operational. */
  objective: string;
}

// Minimal shape this module needs from a TaskCandidate (avoids a circular dep).
export interface SynthInput {
  intents: string[];
  filesModified: Set<string>;
  filesCreated: Set<string>;
  filesDeleted: Set<string>;
  filesRead: Set<string>;
  commands: NormalizedEvent[];
  tests: NormalizedEvent[];
  errors: NormalizedEvent[];
  gitOps: NormalizedEvent[];
  assistantSummaries: string[];
}

// ---------------------------------------------------------------------------
// Git semantics
// ---------------------------------------------------------------------------

/** Map a git subcommand to a precise, observed action. */
export function gitActionOfOp(op: string | undefined): GitAction {
  const g = (op ?? "").toLowerCase();
  if (/^(status|log|show|blame|reflog|describe|ls-files)$/.test(g)) return "inspected";
  if (/^diff$/.test(g)) return "reviewed";
  if (/^(switch|checkout|branch|worktree)$/.test(g)) return "branch";
  if (/^(add|reset|restore|rm)$/.test(g)) return "staged";
  if (/^commit$/.test(g)) return "committed";
  if (/^(push|pull|fetch|clone)$/.test(g)) return "pushed";
  if (/^stash$/.test(g)) return "stash";
  return "other";
}

/** The strongest (most work-significant) git action across a candidate's ops. */
function dominantGitAction(gitOps: NormalizedEvent[]): GitAction | undefined {
  if (!gitOps.length) return undefined;
  // Significance order: a real commit/push outranks staging, which outranks a
  // branch change, which outranks mere inspection.
  const rank: Record<GitAction, number> = {
    committed: 6, pushed: 5, staged: 4, branch: 3, stash: 2, reviewed: 1, inspected: 0, other: 0,
  };
  let best: GitAction = "other";
  for (const g of gitOps) {
    const a = gitActionOfOp(g.gitOp);
    if (rank[a] >= rank[best]) best = a;
  }
  return best;
}

/** True only when an ACTUAL commit occurred (never inferred from output). */
export function hasRealCommit(gitOps: NormalizedEvent[]): boolean {
  return gitOps.some((g) => gitActionOfOp(g.gitOp) === "committed");
}

// ---------------------------------------------------------------------------
// Work classification
// ---------------------------------------------------------------------------

/** Operational / session-management signals (Codex resume, WSL, env, session). */
const OPERATIONAL_RE =
  /\b(resume|resumir|retomar|sess[aã]o|session|conversa anterior|previous conversation|\bwsl\b|reconnect|reconectar|voltar (?:para|à)|環境|environment setup|codex (?:cli|session)|reopen|restore session)\b/i;

/**
 * Classify the work kind from evidence:
 *  - NOISE: no work signal at all (should already be filtered upstream).
 *  - OPERATIONAL: session/tooling/environment plumbing (resume, branch-only
 *    fiddling to unblock, WSL/path issues) — mentionable, not an accomplishment.
 *  - SUPPORT_WORK: git organization (commit/stage/push/branch), test-only runs,
 *    pure inspection with no edits.
 *  - PRIMARY_WORK: actual code/feature/bugfix/config/db changes, or a
 *    substantive investigation that drove edits.
 */
export function classifyWorkKind(
  c: SynthInput,
  category: ActivityCategory,
  gitAction: GitAction | undefined,
): WorkKind {
  const edited =
    c.filesModified.size > 0 || c.filesCreated.size > 0 || c.filesDeleted.size > 0;
  const intentText = c.intents.join(" ").toLowerCase();
  const opText = `${intentText} ${c.assistantSummaries.join(" ")}`.toLowerCase();

  // Operational: session/environment plumbing with no real code change.
  if (!edited && OPERATIONAL_RE.test(opText)) return "operational";

  // Git-centric with no edits → support (organization), unless it's just
  // inspection that accompanied real work elsewhere.
  if (!edited && category === "git") return "support";

  // Test-only or pure-inspection runs with no edits → support.
  if (!edited && (category === "testing" || (c.tests.length > 0 && c.commands.length === 0)))
    return "support";

  // A branch/inspection-only git action with no edits → operational/support.
  if (!edited && gitAction && gitAction !== "committed" && gitAction !== "pushed") {
    return gitAction === "branch" ? "operational" : "support";
  }

  // Everything with real edits, or a substantive investigation, is primary.
  if (edited) return "primary";
  if (category === "investigation" && (c.filesRead.size > 0 || c.commands.length > 0)) return "primary";

  return "support";
}

// ---------------------------------------------------------------------------
// Topic synthesis (title comes from EVIDENCE, not the prompt)
// ---------------------------------------------------------------------------

/** Domain topics we can name from files/terms, most specific first. */
interface TopicRule { key: string; test: RegExp; label: string; }
const TOPIC_RULES: TopicRule[] = [
  { key: "contract-pdf", test: /\b(contract|contrato|acroform|forge_files|\bpdf\b|template|document)\b/i, label: "contract document generation" },
  { key: "auth", test: /\b(auth|login|logout|oauth|jwt|saml|session|token|permission)\b/i, label: "authentication" },
  { key: "api", test: /\b(api|endpoint|route|controller|request|response|webhook)\b/i, label: "the API" },
  { key: "db", test: /\b(migrat|schema|\bsql\b|database|\bdb\b|query|seed|prisma)\b/i, label: "the database" },
  { key: "ui", test: /\b(ui|component|page|view|css|style|button|form|render|frontend)\b/i, label: "the user interface" },
  { key: "config", test: /\b(config|autoload|\benv\b|setting|setup|install|dependency|package)\b/i, label: "configuration" },
  { key: "build", test: /\b(build|bundle|webpack|vite|compile|deploy|release|docker|ci)\b/i, label: "the build/deployment" },
  { key: "test", test: /\b(test|spec|coverage|assert)\b/i, label: "the test suite" },
];

/** Choose the best domain topic from the candidate's files + intents + terms. */
function detectTopic(c: SynthInput): TopicRule | undefined {
  const files = [...c.filesModified, ...c.filesCreated, ...c.filesDeleted, ...c.filesRead].join(" ");
  const text = `${files} ${c.intents.join(" ")} ${c.assistantSummaries.join(" ")}`;
  for (const rule of TOPIC_RULES) if (rule.test.test(text)) return rule;
  return undefined;
}

/** Lowercase topic tokens (files basenames + domain key) for grouping. */
function topicTokensOf(c: SynthInput, topic: TopicRule | undefined): string[] {
  const out = new Set<string>();
  if (topic) out.add(topic.key);
  for (const f of [...c.filesModified, ...c.filesCreated, ...c.filesRead]) {
    const b = basename(f).toLowerCase().replace(/\.[a-z0-9]+$/, "");
    if (b.length >= 3) out.add(b);
    const parts = f.split("/").filter(Boolean);
    const dir = parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : "";
    if (dir.length >= 3) out.add(dir);
  }
  return [...out];
}

/**
 * A canonical, English action verb per category+status. The REPORT layer maps
 * these to natural language (incl. Portuguese) — this is a stable internal
 * label, never shown raw in a localized report body.
 */
export function actionVerb(category: ActivityCategory, status: ActivityStatus, gitAction?: GitAction): string {
  if (gitAction) {
    return gitAction === "committed" ? "Committed changes"
      : gitAction === "pushed" ? "Pushed changes"
      : gitAction === "staged" ? "Staged changes"
      : gitAction === "branch" ? "Worked with Git branches"
      : gitAction === "reviewed" ? "Reviewed changes with Git"
      : gitAction === "stash" ? "Stashed changes"
      : "Inspected repository state";
  }
  const done = status === "completed";
  switch (category) {
    case "bugfix": return done ? "Fixed" : "Worked on a fix for";
    case "feature": return done ? "Implemented" : "Developed";
    case "investigation": return "Investigated";
    case "refactor": return done ? "Refactored" : "Refactored";
    case "testing": return done ? "Validated" : "Tested";
    case "documentation": return "Updated documentation for";
    case "configuration": return done ? "Configured" : "Adjusted";
    case "database": return done ? "Updated the database for" : "Worked on the database for";
    case "deployment": return done ? "Deployed" : "Worked on deploying";
    default: return "Worked on";
  }
}

// ---------------------------------------------------------------------------
// TopicProfile — distilled semantic signals for workstream clustering/naming
// ---------------------------------------------------------------------------

/**
 * Generic/stop CONCEPTS that must never define a workstream's identity. These
 * are subject-neutral words that carry no memory value ("the application", "the
 * system", "changes", "code"). Kept language-agnostic (EN + PT). This is NOT a
 * technology list — it is the opposite: words to ignore, so real domain signals
 * win. New technologies are picked up generically via `techTerms`.
 */
const STOP_CONCEPTS = new Set([
  // English
  "application", "app", "system", "project", "task", "code", "codebase",
  "change", "changes", "file", "files", "thing", "things", "stuff", "feature",
  "function", "issue", "problem", "bug", "work", "update", "repo", "repository",
  "the", "this", "that", "it", "something", "part", "area", "logic", "module",
  // Portuguese
  "aplicação", "aplicacao", "sistema", "projeto", "tarefa", "código", "codigo",
  "arquivo", "arquivos", "coisa", "coisas", "mudança", "mudanca", "mudanças",
  "alteração", "alteracao", "alterações", "problema", "erro", "trecho", "parte",
  "isso", "esse", "essa", "essas", "esses", "esta", "este", "função", "funcao",
  "módulo", "modulo", "desenvolvimento", "recurso",
]);

/** Meaningful domain nouns extracted from free text (title/intent/summary). */
const DOMAIN_NOUN_RE = /[a-zà-ú][a-zà-ú0-9_]{3,}/giu;

/** Words that are actions, not subjects — excluded from domain terms. */
const ACTION_WORDS = new Set([
  "investigate", "investigated", "investigar", "investigou", "fix", "fixed", "corrigir", "corrigiu",
  "add", "added", "adicionar", "implement", "implemented", "implementar", "implementou",
  "configure", "configured", "configurar", "configurou", "ajustar", "ajustou", "adjust", "adjusted",
  "validate", "validated", "validar", "validou", "review", "reviewed", "revisar", "revisou",
  "worked", "trabalhou", "developed", "desenvolveu", "create", "created", "criar", "criou",
  "update", "updated", "atualizar", "atualizou", "make", "made", "fazer", "gerar", "gerou",
  "send", "sent", "enviar", "enviou", "run", "ran", "rodar", "executar", "test", "tested",
  // more verb participles that show up in synthesized titles/summaries
  "built", "build", "caught", "catch", "handled", "handle", "moved", "move",
  "removed", "remove", "renamed", "rename", "refactored", "refactor", "wrote",
  "write", "written", "read", "checked", "check", "ensured", "ensure", "improved",
  "improve", "resolved", "resolve", "corrected", "correct", "generate", "generated",
  "generation", "processing", "processed", "loading", "loaded", "saving", "saved",
]);

/** Non-noun connectives / adjectives / meta words that are never a work subject. */
const GENERIC_NON_NOUNS = new Set([
  "against", "behavior", "behaviour", "sample", "into", "onto", "about", "before",
  "after", "during", "while", "still", "again", "also", "then", "when", "where",
  "which", "such", "very", "just", "only", "each", "both", "here", "there",
  "properly", "correctly", "successfully", "necessary", "expected", "current",
  "previous", "related", "several", "various", "different", "certain", "proper",
  // PT connectives/adjectives
  "contra", "sobre", "antes", "depois", "enquanto", "ainda", "novamente",
  "corretamente", "necessário", "esperado", "atual", "anterior", "relacionado",
  "vários", "várias", "diferentes", "certo", "correto",
  // PT verb forms that survive the suffix filter (common "ser/estar/ter/haver"
  // + frequent action verbs) — never a work subject.
  "está", "estão", "estava", "estavam", "estar", "seja", "sejam", "será",
  "tem", "têm", "tinha", "havia", "sendo", "sido", "foram", "fica", "ficou",
  "ficam", "geram", "vamos", "quero", "queria", "posso", "preciso", "deve",
  "pode", "podem", "fazer", "faça", "usar", "usando", "isso", "esse", "essa",
  "este", "esta", "esses", "essas", "aqui", "ali", "assim", "mesmo", "mesma",
]);

/**
 * Domain nouns that legitimately end in -ed/-ing and must survive the
 * verb-participle filter (they name real subjects, not actions).
 */
const DOMAIN_NOUN_ALLOW = new Set([
  "billing", "onboarding", "logging", "routing", "caching", "polling",
  "mapping", "booking", "listing", "landing", "pricing", "rating",
  "feed", "thread", "field", "record", "keyword", "dashboard", "wizard",
  "pipeline", "timeline", "headers", "credentials",
]);

/** Canonical action label from a category (used in the profile). */
function actionOfCategory(category: ActivityCategory): string[] {
  switch (category) {
    case "bugfix": return ["fix"];
    case "feature": return ["implement"];
    case "investigation": return ["investigate"];
    case "refactor": return ["refactor"];
    case "testing": return ["validate"];
    case "documentation": return ["document"];
    case "configuration": return ["configure"];
    case "database": return ["database"];
    case "deployment": return ["deploy"];
    default: return [];
  }
}

/** Component hints from file directories (e.g. "src/editor/…" → "editor"). */
function componentsFromFiles(c: SynthInput): string[] {
  const out = new Set<string>();
  for (const f of [...c.filesModified, ...c.filesCreated, ...c.filesRead]) {
    const parts = f.split("/").filter(Boolean);
    // Take the most specific directory (not the leaf file, not "src").
    for (const p of parts.slice(0, -1)) {
      const w = p.toLowerCase();
      if (w.length >= 3 && !STOP_CONCEPTS.has(w) && !/^(src|lib|app|apps|packages|dist|build|node_modules|test|tests|public|assets)$/.test(w)) {
        out.add(w);
      }
    }
  }
  return [...out].slice(0, 4);
}

/** Distilled domain nouns from the intents (subject of the work). */
function domainTermsFromText(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  DOMAIN_NOUN_RE.lastIndex = 0;
  while ((m = DOMAIN_NOUN_RE.exec(text)) !== null) {
    const w = m[0].toLowerCase();
    if (STOP_CONCEPTS.has(w) || ACTION_WORDS.has(w) || GENERIC_NON_NOUNS.has(w)) continue;
    // skip very common connectors that slipped through the length filter
    if (/^(that|this|with|from|para|com|dos|das|que|uma|meu|minha|seu|sua|pelo|pela|onde|quando|como|mais|todos|toda|todas)$/.test(w)) continue;
    // drop obvious verb participles/gerunds that are not real work subjects.
    // Domain nouns rarely end in these verb suffixes.
    //   EN: -ed / -ing   (built, caught, handled, loading)
    //   PT: -ando/-endo/-indo (gerund), -ado/-ido (participle),
    //       -aram/-eram (3rd-person plural preterite). We avoid broad -ão/-am/-ou
    //       rules because real nouns share those endings (botão, exame); specific
    //       verb forms like "estão"/"geram" are in GENERIC_NON_NOUNS instead.
    if (!DOMAIN_NOUN_ALLOW.has(w) &&
        /(?:ed|ing|ando|endo|indo|ado|ido|aram|eram)$/.test(w)) continue;
    out.add(w);
  }
  return [...out];
}

/**
 * Build a TopicProfile from an activity's evidence. `techTerms` are the
 * canonical technologies already extracted by the report layer; we also derive
 * domain terms from the intents, components from file directories, and actions
 * from the category. The `primarySignal` is the single most defining concept:
 * a technology if present, else the most salient domain term, else a component.
 */
export function buildTopicProfile(
  c: SynthInput,
  category: ActivityCategory,
  techTerms: string[],
): TopicProfile {
  const technologies = dedupeLower(techTerms).filter((t) => !STOP_CONCEPTS.has(t));
  // A term is a technology (not a domain subject) if it, or its singular form,
  // matches a known technology — so "pdfs"/"apis" don't leak as domain nouns.
  const techStems = new Set(technologies.flatMap((t) => [t, t.replace(/s$/, "")]));
  const isTech = (t: string) => techStems.has(t) || techStems.has(t.replace(/s$/, ""));
  const domainSrc = `${c.intents.join(" ")} ${c.assistantSummaries.join(" ")}`;
  const domainTerms = domainTermsFromText(domainSrc)
    .filter((t) => !isTech(t))
    .slice(0, 6);
  const components = componentsFromFiles(c);
  const actions = actionOfCategory(category);

  // primarySignal: prefer a concrete technology, then a domain term, then a
  // component. Never a generic/stop concept.
  const primarySignal =
    technologies[0] ?? domainTerms[0] ?? components[0] ?? "";

  return { domainTerms, technologies, components, actions, primarySignal };
}

/**
 * A canonical English OBJECTIVE phrase for an activity — WHY the work existed,
 * e.g. "Correct contract document generation", not "PDF & Vue". Prefers the
 * SUBJECT of the work (a domain noun or a component/feature area) over the
 * technology used; the technology is supporting detail. Deterministic and
 * generic (no per-project hardcoding). The report layer localizes this.
 */
export function objectiveOf(profile: TopicProfile, category: ActivityCategory): string {
  const act = OBJECTIVE_VERB[category] ?? "Work on";
  // The verb's root (e.g. "Build"→"build", "Fix"→"fix") so the subject never
  // echoes it ("Build the built catalog" → "Build the catalog").
  const verbRoot = act.split(" ")[0].toLowerCase();
  const subject = subjectOf(profile, verbRoot);
  if (!subject) return ""; // no meaningful subject → composer uses a neutral label
  // Investigation reads naturally as "Investigate the <subject>".
  return `${act} ${subject}`;
}

/** True when a subject word is a morphological echo of the objective verb. */
function echoesVerb(word: string, verbRoot: string): boolean {
  if (!verbRoot || verbRoot.length < 3) return false;
  const w = word.toLowerCase();
  if (w === verbRoot) return true;
  // shared 4+ char prefix (build/built, fix/fixed, configure/configured)
  const stem = verbRoot.slice(0, 4);
  return stem.length >= 4 && w.startsWith(stem);
}

/** Verb that frames the objective (the goal), by category. */
const OBJECTIVE_VERB: Record<ActivityCategory, string> = {
  feature: "Build", bugfix: "Fix", investigation: "Investigate", refactor: "Restructure",
  testing: "Validate", documentation: "Document", configuration: "Configure",
  database: "Evolve the data model for", deployment: "Ship", git: "Organize", other: "Work on",
};

/**
 * The SUBJECT of the work (a noun phrase), preferring a domain term (e.g.
 * "contract", "signature") or a component/feature ("editor", "checkout") over a
 * raw technology. Multiple domain terms compose into a short phrase. When only
 * technologies exist, the subject stays empty so the objective is not just a
 * tech collection.
 */
function subjectOf(profile: TopicProfile, verbRoot = ""): string {
  const domain = profile.domainTerms.filter(
    (t) => t.length >= 3 && !echoesVerb(t, verbRoot),
  );
  const comps = profile.components.filter(
    (t) => t.length >= 3 && !echoesVerb(t, verbRoot),
  );
  if (domain.length >= 2) return `the ${domain[0]} ${domain[1]}`;
  if (domain.length === 1 && comps.length >= 1) return `the ${domain[0]} ${comps[0]}`;
  if (domain.length === 1) return `the ${domain[0]}`;
  if (comps.length >= 1) return `the ${comps[0]}`;
  // Fall back to a single technology ONLY if it is domain-like (a concept, not
  // a stack layer). We can't tell reliably, so leave empty — the composer will
  // use the technology under Technical Areas instead of as the objective.
  return "";
}

function dedupeLower(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const k = x.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

/**
 * Build a normalized, evidence-grounded title. Never a raw prompt, path,
 * filename, or command fragment. Format: "<Action> <topic>" where topic comes
 * from the detected domain (files/terms), with a light fallback to a cleaned
 * intent NOUN phrase only when no domain topic is detectable.
 */
export function synthesizeDescriptor(
  c: SynthInput,
  category: ActivityCategory,
  status: ActivityStatus,
  techTerms: string[] = [],
): ActivityDescriptor {
  const gitAction = dominantGitAction(c.gitOps);
  const noEdits = c.filesModified.size === 0 && c.filesCreated.size === 0 && c.filesDeleted.size === 0;
  // Git-centric when the category is git, OR when git ops are the ONLY concrete
  // work signal (no edits, no non-git commands, no tests) — so a bare
  // `git status`/`git switch` reads as a git action, not a vague investigation.
  const isGitCentric =
    noEdits && c.gitOps.length > 0 &&
    (category === "git" || (c.commands.length === 0 && c.tests.length === 0));

  const topic = detectTopic(c);
  const workKind = classifyWorkKind(c, category, isGitCentric ? gitAction : undefined);

  let title: string;
  if (isGitCentric && gitAction) {
    // Prefer a real commit subject when a commit actually happened.
    if (gitAction === "committed") {
      const msg = c.gitOps.map((g) => g.text).find((t) => t && t.trim());
      title = msg ? cap(truncate(msg.split("\n")[0].trim(), 72)) : "Committed changes";
    } else {
      title = actionVerb(category, status, gitAction);
    }
  } else if (workKind === "operational") {
    title = "Worked through a session/environment issue";
  } else {
    const verb = actionVerb(category, status);
    if (topic) {
      title = `${verb} ${topic.label}`;
    } else {
      // Last resort: a cleaned NOUN topic from files (never the prompt).
      const primary = pickPrimaryFile(c);
      title = primary ? `${verb} ${humanizeFile(primary)}` : `${verb} the project`;
    }
  }

  const topicProfile = buildTopicProfile(c, category, techTerms);
  return {
    title: cap(title),
    workKind,
    gitAction: isGitCentric ? gitAction : undefined,
    topicTokens: topicTokensOf(c, topic),
    topicKey: workKind === "operational" ? "operational" : (isGitCentric ? "git" : (topic?.key ?? "app")),
    topicProfile,
    // Objective: WHY the work existed (subject + goal). Git/operational work
    // has no application objective — leave empty (the composer labels those).
    objective: (workKind === "operational" || isGitCentric) ? "" : objectiveOf(topicProfile, category),
  };
}

/** Pick the most representative source file (modified > created > read). */
function pickPrimaryFile(c: SynthInput): string | undefined {
  const pref = [...c.filesModified, ...c.filesCreated];
  const code = pref.find((f) => /\.(ts|tsx|js|jsx|php|py|go|rb|java|rs|vue|css)$/i.test(f));
  return code ?? pref[0] ?? [...c.filesRead][0];
}

/** Turn a file path into a human topic (e.g. "src/pdf/autoload.php" →
 *  "automatic document loading") — only used as a last resort, and kept generic
 *  so it never surfaces a raw path/command. */
function humanizeFile(path: string): string {
  const b = basename(path).toLowerCase();
  const map: Record<string, string> = {
    "autoload.php": "automatic document loading",
    "forge_files": "document storage",
  };
  if (map[b]) return map[b];
  const stem = b.replace(/\.[a-z0-9]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem ? `the ${stem} area` : "the codebase";
}

function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
