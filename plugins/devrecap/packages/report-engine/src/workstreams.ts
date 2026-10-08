/**
 * Workstream Semantic Grouping V3.
 *
 * A Workstream represents an OBJECTIVE / PROBLEM the developer worked on
 * (e.g. "Contract document generation", "DocuSign signature workflow"), not a
 * technology and not a generic noun. Grouping is deterministic, evidence-only,
 * conservative, and lossless — activities are never deleted; a workstream keeps
 * its full ordered member list.
 *
 * Pipeline:
 *   1. Each activity carries a TopicProfile (domain terms, technologies,
 *      components) built from its evidence.
 *   2. Activities are bucketed by KIND first: git / operational never merge
 *      with application development.
 *   3. Within application development, activities cluster by their strongest
 *      SHARED topic signal (a recurring technology or domain term) — so
 *      DocuSign work groups together and PDF/AcroForm/contract work groups
 *      together, even when the coarse topicKey was generic ("app").
 *   4. A consolidation pass merges workstreams with identical/near-identical
 *      names or strongly overlapping topic signals.
 *   5. Names come from the most frequent MEANINGFUL signal — never a generic
 *      noun like "the application".
 */

import type {
  Activity, ActivitySummary, WorkKind, Workstream, WorkstreamStatus,
  TopicProfile, TopicSignal,
} from "@devrecap/shared";
import { newId } from "@devrecap/shared";

/** Max idle gap between related activities to still count as one workstream. */
const MAX_GAP_MS = 8 * 60 * 60 * 1000; // 8 hours (grouping is topic-led, not purely time-led)

/** Generic/stop CONCEPTS that must never name a workstream (EN + PT). */
const STOP_CONCEPTS = new Set([
  "application", "app", "system", "project", "task", "code", "codebase",
  "change", "changes", "file", "files", "thing", "things", "stuff", "feature",
  "function", "issue", "problem", "bug", "work", "update", "repo", "repository",
  "the", "this", "that", "it", "something", "part", "area", "logic", "module",
  "aplicação", "aplicacao", "sistema", "projeto", "tarefa", "código", "codigo",
  "arquivo", "arquivos", "coisa", "coisas", "mudança", "mudanca", "mudanças",
  "alteração", "alteracao", "alterações", "problema", "erro", "trecho", "parte",
  "isso", "esse", "essa", "função", "funcao", "módulo", "modulo",
  "desenvolvimento", "recurso", "codebase", "projeto",
]);

// ---------------------------------------------------------------------------
// Topic signal extraction (per activity)
// ---------------------------------------------------------------------------

/** Canonicalize a signal term so plural/case variants collapse to one
 *  (pdf/pdfs → pdf, acroform/acroforms → acroform). Keeps identifiers with
 *  dots/underscores intact (autoload.php, forge_files). */
function canonSignal(term: string): string {
  let k = term.toLowerCase().trim();
  if (/[._]/.test(k)) return k; // file-ish identifiers stay as-is
  // collapse a simple trailing plural "s" so pdf/pdfs and term/terms unify
  if (k.length >= 4 && k.endsWith("s") && !k.endsWith("ss") && !k.endsWith("us")) k = k.slice(0, -1);
  return k;
}

/** All meaningful signals for an activity, weighted by kind. Technologies and
 *  domain terms carry the most identity; components are weaker hints. */
function signalsForActivity(a: ActivitySummary): Map<string, number> {
  const m = new Map<string, number>();
  const bump = (term: string, w: number) => {
    const k = canonSignal(term);
    if (!k || k.length < 3 || STOP_CONCEPTS.has(k)) return;
    m.set(k, (m.get(k) ?? 0) + w);
  };
  const p: TopicProfile | undefined = a.topicProfile;
  if (p) {
    for (const t of p.technologies) bump(t, 3);
    for (const d of p.domainTerms) bump(d, 2);
    for (const c of p.components) bump(c, 1);
  }
  // techTerms are strong technology signals even without a profile.
  for (const t of a.techTerms ?? []) bump(t, 3);
  return m;
}

/** The dominant (highest-weight) signal for an activity, or "" if none. */
function dominantSignal(a: ActivitySummary): string {
  const m = signalsForActivity(a);
  let best = ""; let bestW = 0;
  for (const [term, w] of m) if (w > bestW) { bestW = w; best = term; }
  // Prefer the profile's declared primarySignal when it's meaningful.
  const ps = a.topicProfile?.primarySignal?.toLowerCase();
  if (ps && !STOP_CONCEPTS.has(ps) && ps.length >= 3) return ps;
  return best;
}

// ---------------------------------------------------------------------------
// Bucketing (git / operational kept separate from app development)
// ---------------------------------------------------------------------------

function kindBucket(a: ActivitySummary): "git" | "operational" | "app" {
  if (a.workKind === "operational" || a.topicKey === "operational") return "operational";
  if (a.topicKey === "git" || a.gitAction) return "git";
  return "app";
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

interface Feat {
  a: ActivitySummary;
  epoch: number;
  signals: Map<string, number>;
  dominant: string;
  projectId: string;
}

function sharedSignal(x: Feat, y: Feat): boolean {
  // Any shared meaningful signal (technology or domain term) links two app
  // activities into the same objective. Components alone are too weak, so we
  // only accept a shared signal that appears in BOTH with weight >= 2 for at
  // least one of them, or a shared dominant signal.
  if (x.dominant && x.dominant === y.dominant) return true;
  for (const [term, wx] of x.signals) {
    const wy = y.signals.get(term);
    if (wy !== undefined && (wx >= 2 || wy >= 2)) return true;
  }
  return false;
}

/**
 * Cluster a project's application-development activities by shared topic
 * signal. Uses a connected-components sweep: an activity joins any existing
 * cluster it shares a signal with (merging clusters transitively), else starts
 * a new one. Time gap only splits clearly-unrelated far-apart work.
 */
function clusterApp(feats: Feat[]): Feat[][] {
  const clusters: Feat[][] = [];
  for (const f of feats) {
    const hits: number[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const near = c.some((m) => Math.abs(m.epoch - f.epoch) <= MAX_GAP_MS);
      if (c.some((m) => sharedSignal(m, f)) && near) hits.push(i);
    }
    if (hits.length === 0) { clusters.push([f]); continue; }
    // Merge all hit clusters + this activity into the first hit cluster.
    const target = clusters[hits[0]];
    target.push(f);
    for (let j = hits.length - 1; j >= 1; j--) {
      target.push(...clusters[hits[j]]);
      clusters.splice(hits[j], 1);
    }
  }
  return clusters;
}

/** Git / operational activities in a project form ONE front each (by proximity). */
function clusterByProximity(feats: Feat[]): Feat[][] {
  const sorted = [...feats].sort((a, b) => a.epoch - b.epoch);
  const clusters: Feat[][] = [];
  for (const f of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && f.epoch - last[last.length - 1].epoch <= MAX_GAP_MS) last.push(f);
    else clusters.push([f]);
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// Naming (from recurring meaningful signals — never a generic noun)
// ---------------------------------------------------------------------------

/** Aggregate ranked topic signals across a cluster's members. */
function aggregateSignals(members: ActivitySummary[]): TopicSignal[] {
  const total = new Map<string, number>();
  for (const a of members) {
    // Count each activity's signals ONCE (presence), weighted by strength, so a
    // concept recurring across activities outranks one noisy activity.
    for (const [term, w] of signalsForActivity(a)) {
      total.set(term, (total.get(term) ?? 0) + Math.min(w, 3));
    }
  }
  return [...total.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((p, q) => q.count - p.count || (p.term < q.term ? -1 : 1));
}

/** Preferred display casing for common technical terms. Data-driven, not a
 *  hardcoded grouping list — only affects how a detected term is capitalized. */
const DISPLAY_CASING: Record<string, string> = {
  pdf: "PDF", api: "API", acroform: "AcroForm", docusign: "DocuSign",
  oauth: "OAuth", jwt: "JWT", saml: "SAML", sql: "SQL", ui: "UI",
  graphql: "GraphQL", openapi: "OpenAPI", mysql: "MySQL", postgres: "Postgres",
  dynamodb: "DynamoDB", "forge_files": "forge_files", "autoload.php": "autoload.php",
};

/** Display casing for a signal term, using the canonical technical form when
 *  known, else Title Case; short lowercase acronyms are upper-cased. */
function displayTerm(term: string): string {
  const k = term.toLowerCase();
  if (DISPLAY_CASING[k]) return DISPLAY_CASING[k];
  if (term.length <= 4 && /^[a-z0-9]+$/.test(term)) return term.toUpperCase();
  return term.charAt(0).toUpperCase() + term.slice(1);
}

const KIND_TITLE: Record<string, string> = {
  git: "Git & change organization",
  operational: "Session & environment",
};

/**
 * Domain SUBJECT terms recurring across members (from each activity's
 * TopicProfile.domainTerms + components). Technologies are deliberately NOT
 * used as the subject — they belong in Technical Areas. Ranked by recurrence.
 */
function domainSubjects(members: ActivitySummary[]): string[] {
  // Collect the technologies used across members so we can EXCLUDE them from
  // the subject (technologies belong in Technical Areas, not the objective).
  const techs = new Set<string>();
  for (const m of members) {
    for (const t of m.topicProfile?.technologies ?? []) techs.add(canonSignal(t));
    for (const t of m.techTerms ?? []) techs.add(canonSignal(t));
  }
  const count = new Map<string, number>();
  for (const m of members) {
    const p = m.topicProfile;
    if (!p) continue;
    for (const d of [...p.domainTerms, ...p.components]) {
      const k = canonSignal(d);
      if (k.length >= 3 && !STOP_CONCEPTS.has(k) && !techs.has(k)) {
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([t]) => t);
}

/**
 * The single dominant technology across members, when one clearly leads. Used
 * ONLY as a last-resort subject when no objective / domain subject exists — a
 * single technology as the subject ("DocuSign work") is allowed; joining
 * multiple technologies ("Vue & PDF") is not, so we return "" when several
 * technologies tie for the lead.
 */
function dominantTechnology(members: ActivitySummary[]): string {
  const count = new Map<string, number>();
  const techSet = new Set<string>();
  for (const m of members) {
    const techs = new Set<string>();
    for (const t of m.topicProfile?.technologies ?? []) techs.add(canonSignal(t));
    for (const t of m.techTerms ?? []) techs.add(canonSignal(t));
    for (const k of techs) {
      if (k.length >= 2 && !STOP_CONCEPTS.has(k)) { count.set(k, (count.get(k) ?? 0) + 1); techSet.add(k); }
    }
  }
  if (count.size === 0) return "";
  // Prefer a members' declared primarySignal when it IS one of the technologies
  // (resolves ties like pdf+acroform in a single activity → "pdf").
  for (const m of members) {
    const ps = m.topicProfile?.primarySignal ? canonSignal(m.topicProfile.primarySignal) : "";
    if (ps && techSet.has(ps)) return ps;
  }
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  // Clear single leader (strictly more than the runner-up), or a lone tech.
  if (ranked.length === 1) return ranked[0][0];
  if (ranked[0][1] > ranked[1][1]) return ranked[0][0];
  return ""; // tie between technologies → don't pick arbitrarily / don't join
}

/** The most common canonical objective across members (WHY the work existed). */
function commonObjective(members: ActivitySummary[]): string {
  const count = new Map<string, number>();
  for (const m of members) {
    const o = (m.objective ?? "").trim();
    if (o) count.set(o, (count.get(o) ?? 0) + 1);
  }
  let best = ""; let bestN = 0;
  for (const [o, n] of count) if (n > bestN) { bestN = n; best = o; }
  return best;
}

/**
 * Name a workstream by its OBJECTIVE (WHY), never as a technology collection.
 * Priority:
 *   1. git/operational → fixed objective label
 *   2. a shared canonical objective from the activities (e.g. "Fix the contract
 *      generation")
 *   3. a phrase built from recurring DOMAIN subject terms ("Contract signature")
 *   4. a member's specific (non-generic) title
 *   5. neutral "General development" sentinel
 * Technologies are NEVER joined with "&" to form a title.
 */
function nameWorkstream(bucket: string, _signals: TopicSignal[], members: ActivitySummary[]): string {
  if (bucket === "git" || bucket === "operational") return KIND_TITLE[bucket];

  const objective = commonObjective(members);
  if (objective) return objectiveTitle(objective);

  const subjects = domainSubjects(members);
  if (subjects.length >= 2) return `${displayTerm(subjects[0])} & ${displayTerm(subjects[1])}`;
  if (subjects.length === 1) return `${displayTerm(subjects[0])} work`;

  // No objective and no domain subject: use a specific member title if any.
  const specific = members.map((m) => m.title).find((t) => t && !isGenericTitle(t));
  if (specific) return specific;

  // Last resort before the neutral sentinel: a SINGLE dominant technology may
  // name the front ("DocuSign work") — this is a subject, not a banned tech
  // COLLECTION. Only when exactly one technology dominates (never joined).
  const tech = dominantTechnology(members);
  if (tech) return `${displayTerm(tech)} work`;

  return "General development";
}

/** Turn a canonical objective ("Fix the contract generation") into a concise
 *  Title-cased workstream heading, capping length. */
function objectiveTitle(objective: string): string {
  const t = objective.replace(/\s+/g, " ").trim();
  const capped = t.length > 64 ? t.slice(0, 63) + "…" : t;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

/** True if a title is essentially generic (no meaningful noun). */
function isGenericTitle(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-zà-ú0-9_.]+/u).filter(Boolean);
  const meaningful = words.filter((w) => w.length >= 3 && !STOP_CONCEPTS.has(w) && !TITLE_ACTION_STOP.has(w));
  return meaningful.length === 0;
}
const TITLE_ACTION_STOP = new Set([
  "developed", "implemented", "fixed", "worked", "investigated", "configured",
  "adjusted", "created", "updated", "refactored", "reviewed", "validated", "built",
  "desenvolveu", "implementou", "corrigiu", "trabalhou", "investigou",
  "configurou", "ajustou", "criou", "atualizou", "revisou", "validou",
]);

// ---------------------------------------------------------------------------
// Status aggregation
// ---------------------------------------------------------------------------

function aggregateStatus(members: ActivitySummary[]): WorkstreamStatus {
  if (members.some((m) => m.status === "blocked")) return "blocked";
  const completed = members.filter((m) => m.status === "completed").length;
  const unfinished = members.filter((m) => m.status === "in_progress").length;
  const unknown = members.filter((m) => m.status === "unknown").length;
  if (completed === members.length) return "completed";
  if (completed > 0 && (unfinished > 0 || unknown > 0)) return "partially_completed";
  if (unfinished > 0) return "in_progress";
  return "unconfirmed";
}

function rollupWorkKind(members: ActivitySummary[]): WorkKind {
  if (members.some((m) => m.workKind === "primary")) return "primary";
  if (members.some((m) => m.workKind === "support")) return "support";
  if (members.some((m) => m.workKind === "operational")) return "operational";
  return "primary";
}

function significanceOf(members: ActivitySummary[], workKind: WorkKind, spanMs: number): number {
  let s = 0;
  for (const m of members) {
    s += (m.filesModifiedCount ?? 0) * 3;
    s += (m.filesReadCount ?? 0) * 0.5;
    s += (m.testCount ?? 0) * 1.5;
    s += m.committed ? 2 : 0;
    s += m.confidence * 2;
    s += 1;
  }
  s += Math.min(spanMs / (30 * 60 * 1000), 4);
  if (workKind === "support") s *= 0.5;
  if (workKind === "operational") s *= 0.25;
  return Number(s.toFixed(2));
}

function makeWorkstream(bucket: string, feats: Feat[]): Workstream {
  const members = feats.map((f) => f.a);
  const epochs = feats.map((f) => f.epoch);
  const span = Math.max(...epochs) - Math.min(...epochs);
  const workKind = rollupWorkKind(members);
  const signals = aggregateSignals(members);
  const techTerms = [...new Set(members.flatMap((m) => m.techTerms ?? []))].slice(0, 8);
  const objective = bucket === "git" || bucket === "operational" ? "" : commonObjective(members);
  return {
    id: newId("wst"),
    title: nameWorkstream(bucket, signals, members),
    objective,
    activities: members,
    status: aggregateStatus(members),
    workKind,
    topicKey: bucket === "app" ? (signals[0]?.term ?? "app") : bucket,
    techTerms,
    topicSignals: signals.slice(0, 8),
    significance: significanceOf(members, workKind, span),
    startedAt: new Date(Math.min(...epochs)).toISOString(),
    endedAt: new Date(Math.max(...epochs)).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Consolidation pass (merge duplicate / strongly-overlapping workstreams)
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").replace(/[&,]/g, "").trim();
}

/** Jaccard overlap of two workstreams' top topic-signal sets. */
function signalOverlap(a: Workstream, b: Workstream): number {
  const sa = new Set(a.topicSignals.map((s) => s.term));
  const sb = new Set(b.topicSignals.map((s) => s.term));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

function mergeWorkstreams(a: Workstream, b: Workstream): Workstream {
  const feats: ActivitySummary[] = [...a.activities, ...b.activities]
    .sort((x, y) => (x.startedAt < y.startedAt ? -1 : 1));
  // Re-derive aggregate fields from the merged members.
  const pseudo: Feat[] = feats.map((s) => ({
    a: s, epoch: Date.parse(s.startedAt) || 0,
    signals: signalsForActivity(s), dominant: dominantSignal(s),
    projectId: a.projectId ?? b.projectId ?? "unassigned",
  }));
  const bucket = a.topicKey === b.topicKey ? a.topicKey : "app";
  const merged = makeWorkstream(bucket, pseudo);
  merged.projectId = a.projectId ?? b.projectId;
  merged.projectName = a.projectName ?? b.projectName;
  return merged;
}

/**
 * Consolidate: merge workstreams (same project) that share a normalized name OR
 * whose top topic signals overlap strongly. Repeated until stable so three
 * "A aplicação"-style groups collapse into one.
 */
function consolidate(streams: Workstream[]): Workstream[] {
  let list = [...streams];
  let changed = true;
  while (changed) {
    changed = false;
    outer:
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if ((a.projectId ?? "") !== (b.projectId ?? "")) continue;
        // Never merge across kinds (git/operational vs app).
        const aKind = a.workKind === "operational" ? "op" : a.topicKey === "git" ? "git" : "app";
        const bKind = b.workKind === "operational" ? "op" : b.topicKey === "git" ? "git" : "app";
        if (aKind !== bKind) continue;
        const sameName = normalizeName(a.title) === normalizeName(b.title);
        const overlap = signalOverlap(a, b);
        if (sameName || overlap >= 0.5) {
          const merged = mergeWorkstreams(a, b);
          list.splice(j, 1);
          list.splice(i, 1, merged);
          changed = true;
          break outer;
        }
      }
    }
  }
  return list;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WorkstreamInput {
  summary: ActivitySummary;
  activity: Activity;
}

function toFeat(it: WorkstreamInput): Feat {
  return {
    a: it.summary,
    epoch: Date.parse(it.summary.startedAt) || 0,
    signals: signalsForActivity(it.summary),
    dominant: dominantSignal(it.summary),
    projectId: it.activity.projectId ?? "unassigned",
  };
}

function groupWithinProject(items: WorkstreamInput[]): Workstream[] {
  const feats = items.map(toFeat);
  const app = feats.filter((f) => kindBucket(f.a) === "app");
  const git = feats.filter((f) => kindBucket(f.a) === "git");
  const op = feats.filter((f) => kindBucket(f.a) === "operational");

  const streams: Workstream[] = [];
  for (const c of clusterApp(app)) streams.push(makeWorkstream("app", c));
  for (const c of clusterByProximity(git)) streams.push(makeWorkstream("git", c));
  for (const c of clusterByProximity(op)) streams.push(makeWorkstream("operational", c));
  return streams;
}

/**
 * Build workstreams across all in-range activities: cluster per project, run a
 * consolidation pass, then rank by significance (main work first).
 */
export function buildWorkstreams(items: WorkstreamInput[]): Workstream[] {
  const byProject = new Map<string, WorkstreamInput[]>();
  for (const it of items) {
    const key = it.activity.projectId ?? "unassigned";
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key)!.push(it);
  }
  let all: Workstream[] = [];
  for (const [projectId, group] of byProject) {
    const streams = groupWithinProject(group);
    for (const s of streams) s.projectId = projectId === "unassigned" ? undefined : projectId;
    all.push(...streams);
  }
  all = consolidate(all);
  all.sort((a, b) => b.significance - a.significance || (a.endedAt < b.endedAt ? 1 : -1));
  return all;
}
