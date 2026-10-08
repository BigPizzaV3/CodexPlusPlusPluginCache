const PATTERNS = [
  { type: 'PRIVATE_KEY', pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g },
  { type: 'GITHUB_TOKEN', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { type: 'OPENAI_KEY', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { type: 'SECRET_ASSIGNMENT', pattern: /\b(?:API[_-]?KEY|TOKEN|PASSWORD|SECRET|CREDENTIALS?)\s*=\s*[^\s]+/gi },
];

export function redactText(input, config = {}) {
  let text = String(input ?? '');
  const protectedValues = [];
  for (const allowed of config.allowlist ?? []) {
    const marker = `__FORGEMIND_ALLOW_${protectedValues.length}__`;
    protectedValues.push(String(allowed));
    text = text.replaceAll(String(allowed), marker);
  }

  let matches = 0;
  const types = [];
  for (const { type, pattern } of PATTERNS) {
    text = text.replace(pattern, () => {
      matches += 1;
      types.push(type);
      return `[REDACTED:${type}]`;
    });
  }
  protectedValues.forEach((value, index) => { text = text.replaceAll(`__FORGEMIND_ALLOW_${index}__`, value); });
  return { text, matches, types: [...new Set(types)] };
}

export function redactValue(value, config = {}) {
  let matches = 0;
  const types = [];
  const visit = (current) => {
    if (typeof current === 'string') {
      const result = redactText(current, config);
      matches += result.matches;
      types.push(...result.types);
      return result.text;
    }
    if (Array.isArray(current)) return current.map(visit);
    if (current && typeof current === 'object') {
      return Object.fromEntries(Object.entries(current).map(([key, child]) => [key, visit(child)]));
    }
    return current;
  };
  return { value: visit(value), matches, types: [...new Set(types)] };
}
