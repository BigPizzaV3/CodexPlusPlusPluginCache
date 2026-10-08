/**
 * Redaction layer.
 *
 * Replaces likely-sensitive substrings with [REDACTED]. Applied to any text
 * before it can be shown in a report or transmitted to an external AI provider.
 * Ordered, conservative regexes; false positives are preferable to leaking a
 * secret. This is defense-in-depth: report inputs are already derived from
 * extracted activity titles/summaries (not raw sessions), but titles can still
 * quote a user request that contained a token.
 */

export const REDACTED = "[REDACTED]";

interface Rule {
  name: string;
  re: RegExp;
  /** Optional replacer to keep a non-sensitive prefix (e.g. "AKIA…"). */
  replace?: (m: string) => string;
}

const RULES: Rule[] = [
  { name: "private_key_block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name: "openai_key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "openai_proj_key", re: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { name: "github_token", re: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g },
  { name: "slack_token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "aws_access_key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "google_api_key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "bearer", re: /\b[Bb]earer\s+[A-Za-z0-9._-]{16,}/g },
  { name: "db_url", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s'"]*@[^\s'"]+/g },
  { name: "assignment_secret", re: /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?[^\s"'`,;]{4,}["']?/gi,
    replace: (m) => m.replace(/([:=]\s*["']?)[^\s"'`,;]{4,}(["']?)$/i, `$1${REDACTED}$2`) },
  { name: "env_secret", re: /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*)=\S+/g,
    replace: (m) => m.replace(/=.*/s, `=${REDACTED}`) },
];

export interface RedactionResult {
  text: string;
  redactions: { rule: string; count: number }[];
}

/** Redact a single string, returning the sanitized text and a rule tally. */
export function redact(input: string): RedactionResult {
  if (!input) return { text: input, redactions: [] };
  let text = input;
  const tally: Record<string, number> = {};
  for (const rule of RULES) {
    text = text.replace(rule.re, (m) => {
      tally[rule.name] = (tally[rule.name] ?? 0) + 1;
      return rule.replace ? rule.replace(m) : REDACTED;
    });
  }
  return {
    text,
    redactions: Object.entries(tally).map(([rule, count]) => ({ rule, count })),
  };
}

/** Deep-redact all string values in an arbitrary JSON-serializable value. */
export function redactDeep<T>(value: T): { value: T; total: number } {
  let total = 0;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = redact(v);
      total += r.redactions.reduce((a, b) => a + b.count, 0);
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return { value: walk(value) as T, total };
}
