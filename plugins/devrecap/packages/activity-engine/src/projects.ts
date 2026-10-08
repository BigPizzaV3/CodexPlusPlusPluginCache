/**
 * Project detection & naming.
 *
 * Given a working directory (from Codex `cwd`) or a git root, derive a stable
 * project identity and a human-friendly display name. Detection signals, in
 * priority order: git remote → git root dir name → manifest name → path tail.
 */

import type { ProjectType } from "@devrecap/shared";
import { basename, stableId } from "@devrecap/shared";

export interface DetectedProject {
  id: string;
  name: string;
  displayName: string;
  rootPath: string;
  detectedFrom: string;
  type: ProjectType;
}

/** Turn a slug-ish directory name into a friendly title, e.g. sample-dashboard
 *  → Sample Dashboard, demo-api-client → Demo Api Client. */
export function humanizeName(raw: string): string {
  const cleaned = raw.replace(/[._]+/g, "-").replace(/-+/g, "-").trim();
  return cleaned
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Heuristic type from the path (used only as a default; user can override). */
export function guessType(rootPath: string): ProjectType {
  const p = rootPath.toLowerCase();
  // Generic classification keywords only — no project-specific names.
  if (/(university|univ|college|\bfac\b|academic|coursework|thesis)/.test(p))
    return "university";
  if (/(personal|hobby|sandbox|playground|weekend|side-?project)/.test(p)) return "personal";
  return "work";
}

/**
 * Detect a project from a working directory path. `manifestName` and
 * `gitRemote` are optional enrichments the caller may supply after inspecting
 * the filesystem/git. The project id is stable per rootPath.
 */
export function detectProject(
  cwd: string,
  opts: { manifestName?: string; gitRemote?: string } = {},
): DetectedProject {
  const rootPath = cwd.replace(/[/\\]+$/, "");
  const dirName = basename(rootPath) || rootPath;

  let name = dirName;
  let detectedFrom = "cwd";
  if (opts.gitRemote) {
    const repo = remoteToName(opts.gitRemote);
    if (repo) {
      name = repo;
      detectedFrom = "git_remote";
    }
  } else if (opts.manifestName) {
    name = opts.manifestName;
    detectedFrom = "manifest";
  }

  return {
    id: stableId("prj", rootPath),
    name,
    displayName: humanizeName(name),
    rootPath,
    detectedFrom,
    type: guessType(rootPath),
  };
}

/** Extract a repo name from a git remote URL. */
export function remoteToName(remote: string): string | undefined {
  const m = remote.match(/[/:]([\w.-]+?)(?:\.git)?$/);
  return m ? m[1] : undefined;
}
