import { access, constants, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export async function diagnose({ pluginRoot, workspace, installation = false }) {
  const checks = [];
  const check = (name, status, evidence, remediation) => checks.push({ name, status, evidence, remediation });
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  check('node-version', nodeMajor >= 20 ? 'passed' : 'failed', process.versions.node, 'Install Node.js 20 or newer.');

  try {
    JSON.parse(await readFile(path.join(pluginRoot, '.codex-plugin', 'plugin.json'), 'utf8'));
    check('plugin-manifest', 'passed', path.join(pluginRoot, '.codex-plugin', 'plugin.json'));
  } catch (error) {
    check('plugin-manifest', 'failed', error.message, 'Repair .codex-plugin/plugin.json.');
  }

  await permissionCheck(check, 'workspace-readable', workspace, constants.R_OK, 'Grant read permission to the workspace.');
  await permissionCheck(check, 'workspace-writable', workspace, constants.W_OK, 'Grant write permission to the workspace.');
  if (installation) {
    const runner = path.join(pluginRoot, 'bin', 'forgemind.mjs');
    await permissionCheck(check, 'bundled-runner', runner, constants.R_OK, 'Reinstall ForgeMind from the Marketplace or a verified package.');
    try { const manifest = JSON.parse(await readFile(path.join(pluginRoot, '.codex-plugin', 'plugin.json'), 'utf8')); check('installed-version', 'passed', manifest.version, 'Upgrade with codex plugin marketplace upgrade forgemind-marketplace, then reinstall ForgeMind.'); } catch {}
    await marketplaceFreshnessCheck(check, pluginRoot);
  }

  const config = path.join(workspace, 'forgemind.config.json');
  try {
    await access(config, constants.R_OK);
    check('shared-config', 'passed', config);
  } catch {
    check('shared-config', 'warning', 'No shared config; secure defaults apply.', 'Copy forgemind.config.example.json when team policy is needed.');
  }

  const failed = checks.some((item) => item.status === 'failed');
  const warning = checks.some((item) => item.status === 'warning');
  return { schemaVersion: 1, status: failed ? 'failed' : warning ? 'warning' : 'passed', checks, errors: [] };
}

async function marketplaceFreshnessCheck(check, pluginRoot) {
  try {
    const installed = JSON.parse(await readFile(path.join(pluginRoot, '.codex-plugin', 'plugin.json'), 'utf8'));
    const source = path.join(homedir(), '.codex', '.tmp', 'marketplaces', 'forgemind-marketplace', 'plugins', 'forgemind', '.codex-plugin', 'plugin.json');
    const marketplace = JSON.parse(await readFile(source, 'utf8'));
    const fresh = installed.version === marketplace.version;
    check('marketplace-cache-freshness', fresh ? 'passed' : 'warning', `installed=${installed.version}; marketplace=${marketplace.version}`, fresh ? 'Marketplace source matches the installed plugin.' : 'Run git -C ~/.codex/.tmp/marketplaces/forgemind-marketplace pull --ff-only, then codex plugin add forgemind@forgemind-marketplace.');
  } catch { check('marketplace-cache-freshness', 'warning', 'Marketplace clone was not available for comparison.', 'Run codex plugin marketplace add rweisssieker-xp/RW-Forgemind-Codex-Plugin --ref main, then reinstall ForgeMind.'); }
}

async function permissionCheck(check, name, candidate, mode, remediation) {
  try {
    await access(candidate, mode);
    check(name, 'passed', candidate);
  } catch (error) {
    check(name, 'failed', error.message, remediation);
  }
}
