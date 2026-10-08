import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { parseSkillFrontmatter } from './frontmatter.mjs';
import { assertContained } from './paths.mjs';

const IGNORED_DIRECTORIES = new Set(['.git', '.worktrees', 'node_modules', 'dist']);

export async function validatePlugin(pluginRoot, options = {}) {
  const root = path.resolve(pluginRoot);
  const errors = [];
  const checks = [];
  const addError = (code, message, evidence) => errors.push({ code, message, evidence });
  const pass = (name, evidence) => checks.push({ name, status: 'passed', evidence });
  let manifest;

  const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    pass('plugin-manifest-json', relative(root, manifestPath));
  } catch (error) {
    addError('FM_MANIFEST_INVALID', `Cannot parse plugin manifest: ${error.message}`, relative(root, manifestPath));
    return report(errors, checks);
  }

  validateManifest(manifest, options, addError, pass);

  if (Object.hasOwn(manifest, 'hooks')) {
    addError('FM_MANIFEST_FIELD_UNSUPPORTED', 'plugin.json field `hooks` is not accepted by Codex validation', 'hooks');
  }

  const skillRoot = path.resolve(root, manifest.skills ?? './skills/');
  try {
    assertContained(root, skillRoot);
    const skillFiles = (await walk(skillRoot)).filter((file) => path.basename(file) === 'SKILL.md');
    if (skillFiles.length === 0) addError('FM_SKILLS_MISSING', 'No SKILL.md files found', relative(root, skillRoot));
    const names = new Map();
    for (const file of skillFiles) {
      try {
        const metadata = parseSkillFrontmatter(await readFile(file, 'utf8'), relative(root, file));
        if (names.has(metadata.name)) {
          addError('FM_SKILL_DUPLICATE', `Duplicate skill name: ${metadata.name}`, `${names.get(metadata.name)}, ${relative(root, file)}`);
        } else {
          names.set(metadata.name, relative(root, file));
        }
      } catch (error) {
        addError(error.code ?? 'FM_FRONTMATTER_INVALID', error.message, relative(root, file));
      }
    }
    pass('skills', `${skillFiles.length} skill files`);
  } catch (error) {
    addError(error.code ?? 'FM_SKILLS_INVALID', error.message, relative(root, skillRoot));
  }

  for (const [field, candidate] of Object.entries({
    composerIcon: manifest.interface?.composerIcon,
    logo: manifest.interface?.logo,
  })) {
    if (!candidate) continue;
    const asset = path.resolve(root, candidate);
    try {
      assertContained(root, asset);
      await access(asset);
      pass(`interface-${field}`, relative(root, asset));
    } catch {
      addError('FM_ASSET_MISSING', `Missing interface asset ${field}: ${candidate}`, candidate);
    }
  }

  for (const markdown of (await walk(root)).filter((file) => file.endsWith('.md'))) {
    const content = await readFile(markdown, 'utf8');
    for (const link of markdownLinks(content)) {
      if (isExternal(link)) continue;
      const clean = decodeURIComponent(link.split('#')[0].split('?')[0]);
      if (!clean) continue;
      const target = path.resolve(path.dirname(markdown), clean);
      try {
        assertContained(root, target);
        await access(target);
      } catch {
        addError('FM_LINK_BROKEN', `Broken local Markdown link: ${link}`, relative(root, markdown));
      }
    }
  }
  pass('markdown-links', 'local links inspected');

  return report(errors, checks);
}

function validateManifest(manifest, options, addError, pass) {
  for (const field of ['name', 'version', 'description', 'skills', 'interface']) {
    if (manifest[field] === undefined || manifest[field] === null || manifest[field] === '') {
      addError('FM_MANIFEST_FIELD_REQUIRED', `Missing plugin manifest field: ${field}`, field);
    }
  }
  if (manifest.name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name)) {
    addError('FM_MANIFEST_NAME_INVALID', 'Plugin name must be lower-case hyphen-case', manifest.name);
  }
  if (options.strictRelease && containsPlaceholder(manifest.author)) {
    addError('FM_METADATA_PLACEHOLDER', 'Author metadata contains placeholder values', 'author');
  }
  pass('manifest-fields', manifest.name ?? 'unknown');
}

function containsPlaceholder(author) {
  if (!author) return true;
  const text = JSON.stringify(author).toLowerCase();
  return text.includes('example.com') || text.includes('todo') || text.includes('placeholder');
}

async function walk(root) {
  const files = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function markdownLinks(content) {
  return [...content.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)].map((match) => match[1]);
}

function isExternal(link) {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link);
}

function report(errors, checks) {
  return { schemaVersion: 1, status: errors.length ? 'failed' : 'passed', checks, errors };
}

function relative(root, candidate) {
  return path.relative(root, candidate).replaceAll(path.sep, '/');
}
