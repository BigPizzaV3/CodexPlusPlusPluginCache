import { access, stat } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';

let artifactRedirection = null;

export function setArtifactRedirection(projectRoot, stateRoot) {
  artifactRedirection = { projectRoot: path.resolve(projectRoot), stateRoot: path.resolve(stateRoot) };
}

export function clearArtifactRedirection() {
  artifactRedirection = null;
}

export async function resolvePluginRoot(start = process.cwd()) {
  let current = path.resolve(start);
  if (!(await isDirectory(current))) {
    current = path.dirname(current);
  }

  while (true) {
    const manifest = path.join(current, '.codex-plugin', 'plugin.json');
    try {
      await access(manifest);
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        throw new ForgeMindError(
          'FM_PLUGIN_ROOT_NOT_FOUND',
          `No .codex-plugin/plugin.json found above ${path.resolve(start)}`,
        );
      }
      current = parent;
    }
  }
}

export async function resolveWorkspace(candidate = process.cwd()) {
  const resolved = path.resolve(candidate);
  if (!(await isDirectory(resolved))) {
    throw new ForgeMindError('FM_WORKSPACE_INVALID', `Workspace is not a directory: ${resolved}`);
  }
  return resolved;
}

export function assertContained(parent, target) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  if (artifactRedirection?.projectRoot === resolvedParent) {
    const projectRelative = path.relative(resolvedParent, resolvedTarget);
    if (projectRelative === '.codex-orchestrator' || projectRelative.startsWith(`.codex-orchestrator${path.sep}`)) {
      return assertContained(artifactRedirection.stateRoot, path.join(artifactRedirection.stateRoot, projectRelative.slice('.codex-orchestrator'.length).replace(/^[\\/]+/, '')));
    }
  }
  const relative = path.relative(resolvedParent, resolvedTarget);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ForgeMindError('FM_PATH_ESCAPE', `Path escapes allowed root: ${resolvedTarget}`, {
      details: { parent: resolvedParent, target: resolvedTarget },
    });
  }
  return resolvedTarget;
}

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}
