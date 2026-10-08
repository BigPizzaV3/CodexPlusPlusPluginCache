/**
 * Report input builder.
 *
 * Assembles a deterministic, sanitized ReportInput from activities + projects.
 * This is the ONLY thing an external AI provider ever sees. Blockers are
 * derived conservatively from evidence-backed activity status. Next steps are
 * included only when the activity metadata contains an explicit step; an
 * in-progress status by itself is never rewritten as a fabricated next action.
 */

import type {
  Activity,
  ActivitySummary,
  Project,
  ReportInput,
  ReportKind,
  ReportLanguage,
  ReportLength,
  ReportProjectGroup,
  ReportStyle,
  TimelineEntry,
  WorkKind,
} from "@devrecap/shared";
import type { TopicProfile } from "@devrecap/shared";
import { nowIso } from "@devrecap/shared";
import { techTerms, buildTopicProfile, objectiveOf } from "@devrecap/activity-engine";
import { redactDeep } from "./redact.ts";
import { buildWorkstreams, type WorkstreamInput } from "./workstreams.ts";
import { resolveLanguage } from "./language.ts";

export interface BuildOptions {
  kind: ReportKind;
  style: ReportStyle;
  length: ReportLength;
  language?: ReportLanguage;
  durationSeconds?: number;
  range: { start: string; end: string };
  excludeTypes?: string[];
  redactionEnabled?: boolean;
}

function activityTechTerms(a: Activity): string[] {
  const meta = (a.metadata ?? {}) as Record<string, unknown>;
  const fileText = ["filesModified", "filesCreated", "filesRead"]
    .flatMap((k) => (Array.isArray(meta[k]) ? (meta[k] as unknown[]) : []))
    .filter((x): x is string => typeof x === "string")
    .join(" ");
  const intents = Array.isArray(meta.intents) ? (meta.intents as unknown[]).join(" ") : "";
  return techTerms(`${a.title} ${a.summary} ${intents} ${fileText}`).slice(0, 8);
}

const asArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];

function profileFromSummary(a: Activity): TopicProfile {
  const meta = (a.metadata ?? {}) as Record<string, unknown>;
  return buildTopicProfile(
    {
      intents: asArr(meta.intents),
      filesModified: new Set(asArr(meta.filesModified)),
      filesCreated: new Set(asArr(meta.filesCreated)),
      filesDeleted: new Set(asArr(meta.filesDeleted)),
      filesRead: new Set(asArr(meta.filesRead)),
      commands: [], tests: [], errors: [], gitOps: [],
      assistantSummaries: [a.summary, a.title],
    },
    a.category,
    activityTechTerms(a),
  );
}

function countOf(meta: Record<string, unknown>, key: string): number {
  const v = meta[key];
  return Array.isArray(v) ? v.length : 0;
}

function explicitNextSteps(meta: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["nextSteps", "next_steps"]) {
    for (const value of asArr(meta[key])) {
      const clean = value.replace(/\s+/g, " ").trim();
      if (clean) out.push(clean);
    }
  }
  for (const key of ["nextStep", "next_step"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) out.push(value.replace(/\s+/g, " ").trim());
  }
  return out;
}

function timeLabel(iso: string): string {
  return (iso.slice(11, 16)) || "";
}

export function buildReportInput(
  activities: Activity[],
  projects: Project[],
  opts: BuildOptions,
): { input: ReportInput; redactionCount: number } {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const exclude = new Set(opts.excludeTypes ?? []);

  const groups = new Map<string, ReportProjectGroup>();
  const nextSteps: string[] = [];
  const blockers: string[] = [];
  const intentTexts: string[] = [];
  const wsItems: WorkstreamInput[] = [];

  const inRange = [...activities].sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));

  for (const a of inRange) {
    const project = a.projectId ? projectById.get(a.projectId) : undefined;
    if (project && exclude.has(project.type)) continue;

    const gid = project?.id ?? "unassigned";
    if (!groups.has(gid)) {
      groups.set(gid, {
        id: gid,
        name: project?.displayName ?? "Unassigned",
        type: project?.type ?? "other",
        activities: [],
      });
    }

    const meta0 = (a.metadata ?? {}) as Record<string, unknown>;
    const resolvedProfile = (meta0.topicProfile && typeof meta0.topicProfile === "object"
      ? meta0.topicProfile
      : profileFromSummary(a)) as ActivitySummary["topicProfile"];
    const metaWorkKind = (typeof meta0.workKind === "string" ? meta0.workKind : "primary") as WorkKind;
    const metaGitAction = typeof meta0.gitAction === "string" ? meta0.gitAction : undefined;
    const storedObjective = typeof meta0.objective === "string" ? meta0.objective : "";
    const derivedObjective = (metaWorkKind === "operational" || metaGitAction)
      ? ""
      : objectiveOf(resolvedProfile as TopicProfile, a.category);

    const summary: ActivitySummary = {
      id: a.id,
      title: a.title,
      summary: a.summary,
      category: a.category,
      status: a.status,
      confidence: a.confidence,
      startedAt: a.startedAt,
      endedAt: a.endedAt || a.startedAt,
      evidenceCount: a.evidence?.length ?? 0,
      techTerms: activityTechTerms(a),
      objective: storedObjective || derivedObjective,
      workKind: metaWorkKind,
      topicKey: typeof meta0.topicKey === "string" ? meta0.topicKey : "app",
      filesModifiedCount: countOf(meta0, "filesModified") + countOf(meta0, "filesCreated") + countOf(meta0, "filesDeleted"),
      filesReadCount: countOf(meta0, "filesRead"),
      testCount: typeof meta0.testCount === "number" ? meta0.testCount : countOf(meta0, "tests"),
      errorCount: typeof meta0.errorCount === "number" ? meta0.errorCount : countOf(meta0, "errors"),
      committed: meta0.committed === true,
      gitAction: metaGitAction,
      topicProfile: resolvedProfile,
    };

    groups.get(gid)!.activities.push(summary);
    wsItems.push({ summary, activity: a });

    if (Array.isArray(meta0.intents)) {
      for (const i of meta0.intents as unknown[]) if (typeof i === "string") intentTexts.push(i);
    }
    for (const step of explicitNextSteps(meta0)) nextSteps.push(step);
    if (a.status === "blocked") blockers.push(a.title);
  }

  const workstreams = buildWorkstreams(wsItems);
  for (const w of workstreams) {
    if (w.projectId) w.projectName = projectById.get(w.projectId)?.displayName;
  }

  const timeline: TimelineEntry[] = [];
  for (const w of workstreams) {
    for (const act of w.activities) {
      timeline.push({
        ts: act.startedAt,
        time: timeLabel(act.startedAt),
        title: act.title,
        status: act.status,
        workKind: act.workKind,
        activityId: act.id,
        workstreamId: w.id,
      });
    }
  }
  timeline.sort((x, y) => (x.ts < y.ts ? -1 : 1));

  const resolvedLanguage = resolveLanguage(opts.language ?? "auto", intentTexts);

  const input: ReportInput = {
    kind: opts.kind,
    style: opts.style,
    length: opts.length,
    language: opts.language ?? "auto",
    resolvedLanguage,
    durationSeconds: opts.durationSeconds,
    range: opts.range,
    projects: [...groups.values()].sort((a, b) => b.activities.length - a.activities.length),
    workstreams,
    timeline,
    blockers: dedupe(blockers).slice(0, 5),
    nextSteps: dedupe(nextSteps).slice(0, 5),
    generatedAt: nowIso(),
  };

  if (opts.redactionEnabled === false) {
    return { input, redactionCount: 0 };
  }
  const { value, total } = redactDeep(input);
  return { input: value, redactionCount: total };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
