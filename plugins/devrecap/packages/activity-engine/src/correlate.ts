/**
 * Git ↔ activity correlation and cross-activity merge heuristics.
 *
 * Correlation attaches commit evidence to activities and raises confidence when
 * a commit falls in the activity's time window (with slack), shares a project,
 * and overlaps on files or message keywords. This is the mechanism that turns a
 * weak Codex-only signal into a strong, evidence-backed activity.
 */

import type { Activity, Commit, Evidence } from "@devrecap/shared";
import { newId, jaccard, basename, toEpoch } from "@devrecap/shared";

export interface CorrelationResult {
  evidence: Evidence[];
  confidenceDelta: number;
  statusToCompleted: boolean;
}

const SLACK_MS = 90 * 60_000; // 90 min window around the activity

function fileSet(files: unknown): Set<string> {
  const arr = Array.isArray(files) ? files : [];
  return new Set(arr.map((f) => basename(String(f)).toLowerCase()));
}

function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
}

/** Correlate a single activity against candidate commits (same project). */
export function correlateActivityWithCommits(
  activity: Activity,
  commits: Commit[],
): CorrelationResult {
  const start = toEpoch(activity.startedAt) - SLACK_MS;
  const end = toEpoch(activity.endedAt ?? activity.startedAt) + SLACK_MS;
  const actFiles = fileSet((activity.metadata as Record<string, unknown>)?.files);
  const actWords = wordSet(`${activity.title} ${activity.summary}`);

  const evidence: Evidence[] = [];
  let delta = 0;
  let matched = false;

  for (const c of commits) {
    if (c.committedEpoch < start || c.committedEpoch > end) continue;
    const commitFiles = fileSet(c.files);
    const fileScore = jaccard(actFiles, commitFiles);
    const msgScore = jaccard(actWords, wordSet(c.message));
    const inWindow = true; // already filtered
    const strong = fileScore >= 0.15 || msgScore >= 0.15;
    if (!inWindow || !strong) continue;

    matched = true;
    evidence.push({
      id: newId("evd"),
      activityId: activity.id,
      kind: "git_commit",
      refType: "commit",
      refId: c.id,
      label: `Commit ${c.hash.slice(0, 7)}`,
      detail: c.message.split("\n")[0],
      ts: c.committedAt,
      tsEpoch: c.committedEpoch,
    });
    delta += 0.3 * Math.max(fileScore, msgScore, 0.5);
  }

  return {
    evidence,
    confidenceDelta: Math.min(delta, 0.4),
    statusToCompleted: matched,
  };
}

/**
 * Suggest merges among activities: same project, close in time, overlapping
 * files. Returns groups of activity ids that should merge (first id = primary).
 */
export function suggestMerges(
  activities: Activity[],
  opts: { gapMinutes?: number; fileJaccard?: number } = {},
): string[][] {
  const gapMs = (opts.gapMinutes ?? 20) * 60_000;
  const minJ = opts.fileJaccard ?? 0.3;
  const sorted = [...activities].sort(
    (a, b) => toEpoch(a.startedAt) - toEpoch(b.startedAt),
  );
  const groups: string[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;
    const group = [a.id];
    used.add(a.id);
    const aFiles = fileSet((a.metadata as Record<string, unknown>)?.files);
    let lastEnd = toEpoch(a.endedAt ?? a.startedAt);
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (used.has(b.id)) continue;
      if (a.projectId !== b.projectId) continue;
      const bStart = toEpoch(b.startedAt);
      const closeInTime = bStart - lastEnd <= gapMs;
      const bFiles = fileSet((b.metadata as Record<string, unknown>)?.files);
      const overlap = jaccard(aFiles, bFiles) >= minJ;
      if (closeInTime && overlap) {
        group.push(b.id);
        used.add(b.id);
        lastEnd = Math.max(lastEnd, toEpoch(b.endedAt ?? b.startedAt));
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}
