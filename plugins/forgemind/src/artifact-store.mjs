import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { assertContained, clearArtifactRedirection, resolveWorkspace, setArtifactRedirection } from './paths.mjs';

let active = null;

export async function activateArtifactStore({ workspace, mode = 'workspace', artifactDir } = {}) {
  const projectRoot = await resolveWorkspace(workspace);
  const selectedMode = String(mode ?? 'local').toLowerCase();
  if (!['local', 'workspace', 'none'].includes(selectedMode)) {
    throw new ForgeMindError('FM_ARTIFACT_MODE_INVALID', 'Artifact mode must be local, workspace, or none.');
  }
  if (artifactDir) throw new ForgeMindError('FM_ARTIFACT_DIR_DISABLED', 'External artifact directories are disabled. ForgeMind stores persistent output only in the target project.', { exitCode: 2 });

  const projectLocal = selectedMode === 'local' ? 'workspace' : selectedMode;
  const basePath = projectLocal === 'workspace'
      ? projectRoot
      : await mkdtemp(path.join(tmpdir(), 'forgemind-'));
  active = {
    projectRoot,
    mode: projectLocal,
    basePath,
    stateRoot: projectLocal === 'workspace' ? path.join(projectRoot, '.codex-orchestrator') : path.join(basePath, '.codex-orchestrator'),
    temporary: projectLocal === 'none',
  };
  setArtifactRedirection(active.projectRoot, active.stateRoot);
  return metadata();
}

export async function deactivateArtifactStore() {
  const previous = active;
  active = null;
  clearArtifactRedirection();
  if (previous?.temporary) await rm(previous.basePath, { recursive: true, force: true });
}

export function artifactStatePath(workspace, ...segments) {
  const projectRoot = path.resolve(workspace);
  const stateRoot = active?.projectRoot === projectRoot ? active.stateRoot : path.join(projectRoot, '.codex-orchestrator');
  return assertContained(stateRoot, path.join(stateRoot, ...segments));
}

export function artifactMetadata() {
  return metadata();
}

export function addArtifactMetadata(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  if (!active) return { ...data, ...metadata(), projectDocuments: data.projectDocuments ?? [] };
  const result = { ...data, artifactMode: active.mode, artifactPath: active.temporary ? null : active.stateRoot };
  result.projectDocuments = data.projectDocuments ?? [];
  if (typeof data.artifactPath === 'string') {
    const relative = data.artifactPath.replace(/^\.codex-orchestrator[\\/]?/, '');
    result.artifactPath = active.temporary ? null : path.join(active.stateRoot, relative);
  }
  return result;
}

function metadata() {
  return active ? { artifactMode: active.mode, artifactPath: active.temporary ? null : active.stateRoot } : { artifactMode: 'workspace', artifactPath: null };
}
