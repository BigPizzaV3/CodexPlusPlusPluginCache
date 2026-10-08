import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import { initializeWorkspace } from './artifacts.mjs';
import { diagnose } from './doctor.mjs';
import { ForgeMindError } from './errors.mjs';
import { generateDashboard } from './dashboard.mjs';
import { getGitState } from './git.mjs';
import { scanGaps } from './gaps.mjs';
import { writeJsonAtomic, writeTextAtomic } from './io.mjs';
import { appendMemoryEntry } from './memory.mjs';
import { resolveWorkspace } from './paths.mjs';
import { runProcess } from './process.mjs';
import { inspectProject } from './project.mjs';
import { scoreReadiness } from './readiness.mjs';
import { scanRisks } from './risks.mjs';
import { saveUspRecords } from './signals.mjs';
import { validatePlugin } from './validate.mjs';
import { verifyWorkspace } from './verify.mjs';

export async function runLegacy(scriptName, args, { pluginRoot, cwd }) {
  const flags = parseLegacyArgs(args);
  const workspace = await resolveWorkspace(flags.Path ?? flags.RepoRoot ?? cwd);
  switch (scriptName) {
    case 'detect-stack': return { status: 'passed', ...await inspectProject(workspace), errors: [] };
    case 'validate-plugin': return validatePlugin(pluginRoot);
    case 'test-forgemind': return runSelfTests(pluginRoot);
    case 'verify-workspace': return verifyWorkspace({ workspace, run: Boolean(flags.Run), allowInferred: Boolean(flags.AllowInferred) });
    case 'gap-scan': return scanGaps({ workspace });
    case 'risk-radar': return scanRisks({ workspace, changedFiles: await gitChangedFiles(workspace) });
    case 'release-readiness-score': return scoreReadiness({ workspace });
    case 'generate-dashboard': return generateDashboard({ workspace });
    case 'runtime-discovery-test': return diagnose({ pluginRoot, workspace });
    case 'init-artifacts': return initializeWorkspace({ workspace, pluginRoot, withArtifacts: true });
    case 'init-workflow': return initializeWorkspace({ workspace, pluginRoot, withArtifacts: true, withMemory: true });
    case 'write-project-profile': return initializeWorkspace({ workspace, pluginRoot, withArtifacts: Boolean(flags.WithArtifacts), withMemory: Boolean(flags.WithMemory) });
    case 'init-global-memory': return initializeWorkspace({ workspace: flags.CodexHome ?? path.join(homedir(), '.codex', 'forgemind'), pluginRoot, withMemory: true });
    case 'generate-workflow-graph': return initializeWorkspace({ workspace, pluginRoot, withArtifacts: true });
    case 'add-traceability': return appendArtifact(workspace, 'docs/forgemind/traceability.md', `\n### ${date()} - ${flags.Feature ?? 'Feature'}\n\n- Epic/story: ${flags.Story ?? ''}\n- Acceptance criteria: ${flags.Acceptance ?? ''}\n- Verification: ${flags.Verification ?? '.codex-orchestrator/reports/verification-latest.json'}\n`);
    case 'generate-rollback-plan': return writeArtifact(workspace, 'docs/forgemind/rollback-plan.md', `# Rollback Plan\n\n- Change: ${flags.Change ?? 'unspecified'}\n- Trigger: verification or production regression\n- Recovery: revert the referenced commit and rerun verification\n`);
    case 'generate-pr-summary': return generatePrSummary(workspace, flags.Title ?? 'ForgeMind change');
    case 'orchestrator-status': return statusSummary(workspace);
    case 'record-decision': return memoryRecord(workspace, 'decision', flags.Decision ?? 'Decision', flags.Rationale ?? '', flags);
    case 'record-learning': return memoryRecord(workspace, 'learning', flags.Task ?? 'Task', flags.Note ?? String(flags.Outcome ?? ''), flags);
    case 'register-verification': return memoryRecord(workspace, 'verification', flags.Category ?? 'verification', flags.Command ?? '', flags);
    case 'update-usp-backlog': return manualUsp(workspace, flags);
    case 'bump-version': return bumpVersion(pluginRoot, flags.Version);
    default: throw new ForgeMindError('FM_LEGACY_UNKNOWN', `Unknown legacy script: ${scriptName}`, { exitCode: 2 });
  }
}

function parseLegacyArgs(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('-')) continue;
    const key = token.replace(/^-+/, '');
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith('-')) flags[key] = next, index += 1;
    else flags[key] = true;
  }
  return flags;
}

async function runSelfTests(pluginRoot) {
  const result = await runProcess('npm', ['test'], { cwd: pluginRoot, maxOutputBytes: 1024 * 1024 });
  return { schemaVersion: 1, status: result.exitCode === 0 ? 'passed' : 'failed', result, errors: result.exitCode === 0 ? [] : [{ code: 'FM_TEST_FAILED', message: 'npm test failed' }] };
}

async function appendArtifact(workspace, relative, addition) {
  const target = path.join(workspace, relative);
  let current = '';
  try { current = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeTextAtomic(target, `${current}${addition}`);
  return { schemaVersion: 1, status: 'passed', path: relative, errors: [] };
}

async function writeArtifact(workspace, relative, content) {
  await writeTextAtomic(path.join(workspace, relative), content);
  return { schemaVersion: 1, status: 'passed', path: relative, errors: [] };
}

async function generatePrSummary(workspace, title) {
  const git = await getGitState(workspace);
  return writeArtifact(workspace, '.codex-orchestrator/reports/pr-summary.md', `# ${title}\n\n- Commit: ${git.commit}\n- Dirty: ${git.dirty}\n- Changed files: ${git.changedFiles.join(', ')}\n`);
}

async function statusSummary(workspace) {
  const names = ['verification-latest.json', 'gap-scan-latest.json', 'risk-radar-latest.json', 'release-readiness-latest.json'];
  const reports = {};
  for (const name of names) {
    try { reports[name] = JSON.parse(await readFile(path.join(workspace, '.codex-orchestrator', 'reports', name), 'utf8')).status; }
    catch { reports[name] = 'missing'; }
  }
  return { schemaVersion: 1, status: 'passed', reports, errors: [] };
}

async function memoryRecord(workspace, type, subject, statement, flags) {
  return appendMemoryEntry({ workspace, scope: 'shared', entry: {
    type, subject, statement: statement || subject, source: `legacy:${type}`, evidence: flags.Verification ? [flags.Verification] : [],
    author: process.env.USERNAME ?? process.env.USER ?? 'unknown', confidence: 0.7, reviewState: 'pending', sensitivity: 'internal', nonExpiring: true,
  } });
}

async function manualUsp(workspace, flags) {
  const components = { revenuePotential: 0, differentiation: 0, dataAvailability: 0, trustFeasibility: 0, buildEffort: 0, timeToMvp: 0, total: Number(flags.Score ?? 0) };
  return saveUspRecords({ workspace, records: [{ schemaVersion: 1, id: `usp_legacy_${Date.now()}`, title: flags.Title ?? 'USP', sourceSignalIds: [], hypothesis: flags.Title ?? 'USP', experiment: flags.Experiment ?? 'Validate with users.', status: 'proposed', score: components, outcome: null }] });
}

async function bumpVersion(pluginRoot, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new ForgeMindError('FM_VERSION_INVALID', 'Version must use semantic x.y.z format.');
  const manifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = version;
  await writeJsonAtomic(manifestPath, manifest);
  const packagePath = path.join(pluginRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  packageJson.version = version;
  await writeJsonAtomic(packagePath, packageJson);
  return { schemaVersion: 1, status: 'passed', version, errors: [] };
}

async function gitChangedFiles(workspace) { try { return (await getGitState(workspace)).changedFiles; } catch { return []; } }
function date() { return new Date().toISOString().slice(0, 10); }
