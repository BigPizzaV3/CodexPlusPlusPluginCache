import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(ROOT, 'skills');

const NAME_PATTERN = /^ship24-[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);
const MAX_BODY_LINES = 500;
const MIN_DESCRIPTION_LENGTH = 1;
const MAX_DESCRIPTION_LENGTH = 1024;

function splitFrontmatter(raw) {
  if (!raw.startsWith('---\n') && raw !== '---') return null;
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return null;
  const frontmatter = raw.slice(4, end);
  let bodyStart = end + 4;
  if (raw[bodyStart] === '\r') bodyStart += 1;
  if (raw[bodyStart] === '\n') bodyStart += 1;
  return { frontmatter, body: raw.slice(bodyStart) };
}

async function findSkillDirs() {
  let entries;
  try {
    entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const skillDirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(SKILLS_DIR, entry.name);
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    try {
      await stat(skillMdPath);
      skillDirs.push({ name: entry.name, dir: skillPath, skillMdPath });
    } catch {
      // no SKILL.md in this directory; not a skill to lint yet
    }
  }
  return skillDirs;
}

async function collectMarkdownLinkTargets(body) {
  const targets = [];
  const pattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match = pattern.exec(body);
  while (match !== null) {
    targets.push(match[1]);
    match = pattern.exec(body);
  }
  return targets;
}

function isExternalLink(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#');
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function lintSkill(skill) {
  const violations = [];
  const raw = await readFile(skill.skillMdPath, 'utf8');
  const split = splitFrontmatter(raw);
  if (!split) {
    violations.push(`${skill.name}: SKILL.md must start with a YAML frontmatter block ("---").`);
    return violations;
  }

  let frontmatter;
  try {
    frontmatter = parse(split.frontmatter) || {};
  } catch (error) {
    violations.push(`${skill.name}: could not parse frontmatter YAML (${error.message}).`);
    return violations;
  }

  for (const key of Object.keys(frontmatter)) {
    if (!ALLOWED_KEYS.has(key)) {
      violations.push(`${skill.name}: frontmatter key "${key}" is not allowed.`);
    }
  }

  if (frontmatter.name !== skill.name) {
    violations.push(
      `${skill.name}: frontmatter "name" (${JSON.stringify(frontmatter.name)}) must equal the directory name.`,
    );
  }
  if (typeof frontmatter.name !== 'string' || !NAME_PATTERN.test(frontmatter.name)) {
    violations.push(`${skill.name}: frontmatter "name" must match ${NAME_PATTERN}.`);
  }

  if (
    typeof frontmatter.description !== 'string' ||
    frontmatter.description.length < MIN_DESCRIPTION_LENGTH
  ) {
    violations.push(`${skill.name}: frontmatter "description" must be a non-empty string.`);
  } else if (frontmatter.description.length > MAX_DESCRIPTION_LENGTH) {
    violations.push(
      `${skill.name}: frontmatter "description" must be at most ${MAX_DESCRIPTION_LENGTH} characters ` +
        `(got ${frontmatter.description.length}).`,
    );
  }

  const bodyLines = split.body.split('\n');
  if (bodyLines.length >= MAX_BODY_LINES) {
    violations.push(
      `${skill.name}: SKILL.md body must be under ${MAX_BODY_LINES} lines (got ${bodyLines.length}).`,
    );
  }

  const linkTargets = await collectMarkdownLinkTargets(split.body);
  for (const target of linkTargets) {
    if (isExternalLink(target)) continue;
    const [pathPart] = target.split('#');
    if (!pathPart) continue;
    const resolved = path.join(skill.dir, decodeURIComponent(pathPart));
    if (!(await fileExists(resolved))) {
      violations.push(
        `${skill.name}: link target "${target}" does not resolve to a file inside the skill dir.`,
      );
    }
  }

  return violations;
}

async function main() {
  const skills = await findSkillDirs();
  if (skills.length === 0) {
    console.log('No skills/*/SKILL.md files found yet; nothing to lint.');
    return;
  }

  const allViolations = [];
  for (const skill of skills) {
    const violations = await lintSkill(skill);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    for (const violation of allViolations) {
      console.error(violation);
    }
    console.error(`\n${allViolations.length} violation(s) found across ${skills.length} skill(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`All ${skills.length} skill(s) passed lint-skills checks.`);
}

await main();
