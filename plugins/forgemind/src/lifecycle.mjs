import { access, chmod, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { loadConfig } from './config.mjs';
import { ForgeMindError, invalidInput } from './errors.mjs';
import { assertContained } from './paths.mjs';
import { evaluateAction } from './policy.mjs';
import { verifyPackage } from './package.mjs';

export async function installPlugin({ packagePath, home, pluginPath, requestedStatus, injectFailure }) {
  const source = path.resolve(packagePath);
  const { home: root, target } = await resolveInstallationTarget({ home, pluginPath });
  const sourceReport = await verifyPackage(source);
  if (sourceReport.status !== 'passed') throw new ForgeMindError('FM_PACKAGE_INVALID', 'Installation package validation failed.', { details: sourceReport.errors });
  await mkdir(root, { recursive: true });
  const sourceManifest = JSON.parse(await readFile(path.join(source, '.codex-plugin', 'plugin.json'), 'utf8'));
  const previousManifest = await readManifest(target);
  const staging = assertContained(root, path.join(root, '.staging', `forgemind-${process.pid}-${Date.now()}`));
  const backup = previousManifest
    ? assertContained(root, path.join(root, 'backups', 'forgemind', `${previousManifest.version}-${Date.now()}`))
    : null;
  let backedUp = false;
  let installedTarget = false;
  let commandWrapper = null;
  try {
    await rm(staging, { recursive: true, force: true });
    await mkdir(path.dirname(staging), { recursive: true });
    await cp(source, staging, { recursive: true, force: true });
    if ((await verifyPackage(staging)).status !== 'passed') throw new ForgeMindError('FM_PACKAGE_INVALID', 'Staged package validation failed.');
    if (backup) {
      await mkdir(path.dirname(backup), { recursive: true });
      await rename(target, backup);
      backedUp = true;
    }
    if (injectFailure === 'after-backup') throw new Error('Injected lifecycle failure');
    await mkdir(path.dirname(target), { recursive: true });
    await rename(staging, target);
    installedTarget = true;
    commandWrapper = await installCommandWrapper({ home: root, target });
    const selfTest = await runInstallationSelfTest({ home: root });
    return {
      schemaVersion: 1,
      status: requestedStatus ?? (previousManifest ? versionStatus(previousManifest.version, sourceManifest.version) : 'installed'),
      version: sourceManifest.version,
      installPath: target,
      backupPath: backup,
      commandPath: commandWrapper.path,
      commandSmokeTest: commandWrapper.smokeTest,
      reloadRequired: commandWrapper.reloadRequired,
      selfTest,
    };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (commandWrapper?.created) await removeManagedCommandWrapper(root);
    if (backedUp) {
      await rm(target, { recursive: true, force: true });
      await rename(backup, target);
      throw new ForgeMindError('FM_INSTALL_ROLLED_BACK', `Installation failed and previous version was restored: ${error.message}`);
    }
    if (installedTarget) await rm(target, { recursive: true, force: true });
    if (error instanceof ForgeMindError) throw error;
    throw new ForgeMindError('FM_INSTALL_FAILED', error.message);
  }
}

export async function uninstallPlugin({ home, pluginPath, workspace, purgeData = false, approvedPurge = false }) {
  const { home: root, target } = await resolveInstallationTarget({ home, pluginPath });
  await removeManagedCommandWrapper(root);
  await rm(target, { recursive: true, force: true });
  let dataPurged = false;
  if (purgeData) {
    if (!workspace) throw new ForgeMindError('FM_WORKSPACE_INVALID', 'Workspace is required with --purge-data.');
    const config = await loadConfig(path.resolve(workspace));
    const decision = evaluateAction(config.policy, { kind: 'destructive', path: '.codex-orchestrator' });
    if (!approvedPurge || decision.decision === 'deny') throw new ForgeMindError('FM_POLICY_DENIED', decision.rationale);
    const data = assertContained(path.resolve(workspace), path.join(path.resolve(workspace), '.codex-orchestrator'));
    await rm(data, { recursive: true, force: true });
    dataPurged = true;
  }
  return { schemaVersion: 1, status: 'uninstalled', installPath: target, dataPurged };
}

export async function runInstallationSelfTest({ home, pluginPath }) {
  const { home: root, target } = await resolveInstallationTarget({ home, pluginPath });
  const manifest = await readManifest(target);
  if (!manifest) throw new ForgeMindError('FM_INSTALLATION_MISSING', 'ForgeMind is not installed in this Codex home.');
  const bin = assertContained(root, path.join(root, 'bin'));
  const name = process.platform === 'win32' ? 'forgemind.cmd' : 'forgemind';
  const commandPath = assertContained(root, path.join(bin, name));
  await access(commandPath);
  await smokeTestCommand(bin);
  const packageReport = await verifyPackage(target);
  const removedLegacyPluginArtifacts = await removeLegacyPluginArtifacts(root, target);
  return {
    schemaVersion: 1,
    status: packageReport.status === 'passed' ? 'passed' : 'failed',
    installedVersion: manifest.version,
    installPath: target,
    commandPath,
    commandSmokeTest: 'passed',
    packageValidation: packageReport.status,
    removedLegacyPluginArtifacts,
    remediation: removedLegacyPluginArtifacts.length ? 'Removed only legacy artifact directories within the installed plugin or ForgeMind backups. Project .codex-orchestrator directories were not touched.' : null,
    reloadRequired: true,
    errors: packageReport.errors,
  };
}

export async function resolveInstallationTarget({ home, pluginPath }) {
  if (pluginPath) {
    const target = path.resolve(pluginPath);
    if (path.basename(target) !== 'forgemind' || path.basename(path.dirname(target)) !== 'plugins') {
      throw invalidInput('FM_INSTALL_TARGET_INVALID', '--plugin-path must end in plugins/forgemind.');
    }
    const root = path.dirname(path.dirname(target));
    return { home: root, target: assertContained(root, target) };
  }
  const root = path.resolve(home);
  return { home: root, target: assertContained(root, path.join(root, 'plugins', 'forgemind')) };
}

async function installCommandWrapper({ home, target }) {
  const bin = assertContained(home, path.join(home, 'bin'));
  const name = process.platform === 'win32' ? 'forgemind.cmd' : 'forgemind';
  const wrapper = assertContained(home, path.join(bin, name));
  await mkdir(bin, { recursive: true });
  const runner = path.relative(bin, path.join(target, 'bin', 'forgemind.mjs')).replaceAll('\\', '/');
  const content = process.platform === 'win32'
    ? `@echo off\r\n:: ForgeMind managed wrapper\r\nnode "%~dp0${runner}" %*\r\n`
    : `#!/bin/sh\n# ForgeMind managed wrapper\nexec node "$(dirname "$0")/${runner}" "$@"\n`;
  await writeFile(wrapper, content, 'utf8');
  if (process.platform !== 'win32') await chmod(wrapper, 0o755);
  await smokeTestCommand(bin);
  return { path: wrapper, smokeTest: 'passed', reloadRequired: true, created: true };
}

async function smokeTestCommand(bin) {
  const environment = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
  await new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'forgemind --help'], { env: environment, stdio: 'ignore', windowsHide: true })
      : spawn('forgemind', ['--help'], { env: environment, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`forgemind --help exited with ${code}`)));
  });
}

async function removeManagedCommandWrapper(home) {
  const name = process.platform === 'win32' ? 'forgemind.cmd' : 'forgemind';
  const wrapper = assertContained(home, path.join(home, 'bin', name));
  try {
    if ((await readFile(wrapper, 'utf8')).includes('ForgeMind managed wrapper')) await rm(wrapper, { force: true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function removeLegacyPluginArtifacts(home, target) {
  const roots = [target, assertContained(home, path.join(home, 'backups', 'forgemind'))];
  const names = ['.codex-orchestrator', '.forgemind-artifacts'];
  const found = [];
  for (const root of roots) {
    for (const candidate of await findNamedDirectories(root, names)) { await rm(candidate, { recursive: true, force: true }); found.push(candidate); }
  }
  return found;
}

async function findNamedDirectories(root, names) {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const found = [];
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory() && names.includes(entry.name)) found.push(candidate);
    else if (entry.isDirectory()) found.push(...await findNamedDirectories(candidate, names));
  }
  return found;
}

async function readManifest(target) {
  try { return JSON.parse(await readFile(path.join(target, '.codex-plugin', 'plugin.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function versionStatus(previous, next) {
  const left = previous.split('+', 1)[0].split('.').map(Number);
  const right = next.split('+', 1)[0].split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (right[index] > left[index]) return 'upgraded';
    if (right[index] < left[index]) return 'downgraded';
  }
  return 'reinstalled';
}
