import { ForgeMindError } from './errors.mjs';

export function parseSkillFrontmatter(content, source = 'SKILL.md') {
  const normalized = content.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    throw invalid(source, 'Missing YAML frontmatter block');
  }

  const result = {};
  for (const [index, line] of match[1].split('\n').entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const pair = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):(?:\s+(.*)|\s*)$/);
    if (!pair) throw invalid(source, `Invalid frontmatter line ${index + 2}`);
    const [, key, raw = ''] = pair;
    if (Object.hasOwn(result, key)) throw invalid(source, `Duplicate frontmatter key: ${key}`);
    result[key] = parseScalar(raw, source, key);
  }

  for (const required of ['name', 'description']) {
    if (typeof result[required] !== 'string' || !result[required].trim()) {
      throw invalid(source, `Missing required frontmatter field: ${required}`);
    }
  }
  return result;
}

function parseScalar(raw, source, key) {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'string') throw new Error('not a string');
      return parsed;
    } catch {
      throw invalid(source, `Invalid quoted value for ${key}`);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (/:\s/.test(value) || /\s#/.test(value)) {
    throw invalid(source, `YAML-sensitive value for ${key} must be quoted`);
  }
  return value;
}

function invalid(source, message) {
  return new ForgeMindError('FM_FRONTMATTER_INVALID', `${source}: ${message}`);
}
