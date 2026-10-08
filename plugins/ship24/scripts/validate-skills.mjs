import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const PACKAGE_SPEC = 'skills-ref@0.1.5';
const TIMEOUT_MS = 60000;

function runNpx(args) {
  return spawnSync('npx', ['--yes', PACKAGE_SPEC, ...args], {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    shell: true,
  });
}

async function findSkillDirs() {
  let entries;
  try {
    entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_DIR, entry.name));
}

function skipNote(reason) {
  console.log(`validate-skills: ${reason} lint-skills.mjs remains the authoritative gate.`);
}

async function main() {
  const help = runNpx(['--help']);
  if (help.error || help.status !== 0) {
    skipNote(
      `could not run "npx --yes ${PACKAGE_SPEC} --help" (${help.error?.message ?? `exit code ${help.status}`}).`,
    );
    return;
  }

  const helpText = `${help.stdout ?? ''}${help.stderr ?? ''}`;
  if (!/\bvalidate\b/.test(helpText)) {
    skipNote(`${PACKAGE_SPEC} exposes no "validate" command.`);
    return;
  }

  const skillDirs = await findSkillDirs();
  if (skillDirs.length === 0) {
    console.log('validate-skills: no skills/*/ directories found; nothing to validate.');
    return;
  }

  let hasFailure = false;
  for (const dir of skillDirs) {
    const result = runNpx(['validate', dir]);
    if (result.error) {
      skipNote(`"skills-ref validate" failed to start for ${dir} (${result.error.message}).`);
      return;
    }
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    if (result.status !== 0) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
    return;
  }

  console.log(`All ${skillDirs.length} skill(s) passed skills-ref validate.`);
}

await main();
