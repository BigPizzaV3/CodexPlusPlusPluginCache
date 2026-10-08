/**
 * Git LOG TEXT parser (manual-import only).
 *
 * IMPORTANT: DevRecap never runs `git` and never touches a local repository.
 * This module parses the TEXT of a git-log export that the USER explicitly
 * imported, e.g. produced by:
 *
 *     git log --stat > git-history.txt
 *     git log --name-only --date=iso-strict > git-history.txt
 *
 * It is defensive: unknown/garbled sections are skipped, never thrown.
 */

import type { Commit } from "@devrecap/shared";
import { stableId, toEpoch, logger } from "@devrecap/shared";

/** A commit block starts with a line like: `commit <40-hex>` (git log default). */
const COMMIT_RE = /^commit\s+([0-9a-f]{7,40})/;
const AUTHOR_RE = /^Author:\s*(.+?)\s*<([^>]*)>/;
const DATE_RE = /^Date:\s*(.+)$/;
const NAME_ONLY_RE = /^[\w./~-][\w./ ~-]*$/; // conservative file-path-ish line

/**
 * Parse the text of a `git log` export into Commit records. `sourceLabel` is a
 * human label (e.g. the imported filename) used only for the repository id.
 */
export function parseGitLogText(
  text: string,
  opts: { repositoryId?: string; projectId?: string } = {},
): Commit[] {
  const repositoryId = opts.repositoryId ?? "imported_git";
  const lines = text.split(/\r?\n/);
  const commits: Commit[] = [];

  let cur:
    | {
        hash: string;
        authorName?: string;
        authorEmail?: string;
        date?: string;
        messageLines: string[];
        files: Set<string>;
      }
    | undefined;

  const flush = () => {
    if (!cur) return;
    const message = cur.messageLines.join("\n").trim();
    const committedAt = normalizeDate(cur.date);
    commits.push({
      id: stableId("cmt", repositoryId, cur.hash),
      repositoryId,
      projectId: opts.projectId,
      hash: cur.hash,
      authorName: cur.authorName,
      authorEmail: cur.authorEmail,
      committedAt,
      committedEpoch: toEpoch(committedAt),
      message,
      files: [...cur.files],
    });
    cur = undefined;
  };

  let inMessage = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const commitMatch = COMMIT_RE.exec(line);
    if (commitMatch) {
      flush();
      cur = { hash: commitMatch[1], messageLines: [], files: new Set() };
      inMessage = false;
      continue;
    }
    if (!cur) continue;

    const authorMatch = AUTHOR_RE.exec(line);
    if (authorMatch) {
      cur.authorName = authorMatch[1];
      cur.authorEmail = authorMatch[2];
      continue;
    }
    const dateMatch = DATE_RE.exec(line);
    if (dateMatch) {
      cur.date = dateMatch[1].trim();
      inMessage = true; // message body follows the headers
      continue;
    }
    // Headers we don't care about (Merge:, Commit:, etc.) before the blank line.
    if (!inMessage && /^[A-Z][A-Za-z-]+:\s/.test(line)) continue;

    // --stat summary line ("2 files changed, ...") ends the message body.
    if (/^\s*\d+\s+files?\s+changed/.test(line)) { inMessage = false; continue; }

    // --stat file line: "path/file.ts | 3 +++". Also ends the message body.
    const statMatch = /^\s*(\S.*?)\s+\|\s+\d+/.exec(line);
    if (statMatch && statMatch[1]) {
      cur.files.add(statMatch[1].trim());
      inMessage = false;
      continue;
    }

    // While in the message body, indented lines (and blank lines between
    // paragraphs) are part of the message. git indents body by 4 spaces.
    if (inMessage) {
      if (/^\s{4}/.test(rawLine)) { cur.messageLines.push(rawLine.slice(4)); continue; }
      if (line.trim() === "") { cur.messageLines.push(""); continue; }
      // A non-indented, non-blank line here is the start of the file list.
      inMessage = false;
    }

    // --name-only lines: a bare path after the message/blank line.
    if (line && !line.startsWith(" ") && NAME_ONLY_RE.test(line) && /[./]/.test(line)) {
      cur.files.add(line.trim());
      continue;
    }
  }
  flush();

  logger.info("git log text parsed", { commits: commits.length, repositoryId });
  return commits;
}

function normalizeDate(d?: string): string {
  if (!d) return "";
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}


// ---------------------------------------------------------------------------
// GitLogAdapter — recognizes and parses user-imported `git log` TEXT exports.
// ---------------------------------------------------------------------------

import type { RawEvent, ImportSourceAdapter } from "@devrecap/shared";

/** Confidence (0..1) that this text is a git-log export. */
export function looksLikeGitLog(content: string, filename = ""): number {
  const head = content.slice(0, 4000);
  let score = 0;
  if (/\bgit[-_ ]?log\b|git-history/i.test(filename)) score += 0.3;
  const commitLines = (head.match(/^commit\s+[0-9a-f]{7,40}/gim) || []).length;
  if (commitLines >= 1) score += 0.5;
  if (commitLines >= 2) score += 0.2;
  if (/^Author:\s.+<.+>/m.test(head)) score += 0.2;
  if (/^Date:\s/m.test(head)) score += 0.1;
  // Must NOT look like Codex JSON
  if (/"type"\s*:\s*"(session_meta|response_item)"/.test(head)) score -= 0.6;
  return Math.max(0, Math.min(score, 1));
}

/**
 * Adapter that turns git-log text into RawEvents (one 'git_commit' event per
 * commit) so the normalizer/engine can treat commits uniformly. It also exposes
 * the parsed commits via parseCommits() for direct correlation use.
 */
export class GitLogAdapter implements ImportSourceAdapter {
  readonly kind = "git-log" as const;
  detect(content: string, filename: string): number {
    return looksLikeGitLog(content, filename);
  }
  parseContent(content: string): { events: RawEvent[]; malformed: number; sessionId?: string } {
    const commits = parseGitLogText(content);
    const events: RawEvent[] = commits.map((c, i) => ({
      seq: i,
      ts: c.committedAt || undefined,
      rootType: "git",
      payloadType: "git_commit",
      toolName: "git",
      data: c,
      raw: `commit ${c.hash} ${c.message.split("\n")[0]}`,
    }));
    return { events, malformed: 0 };
  }
  parseCommits(content: string) {
    return parseGitLogText(content);
  }
}
