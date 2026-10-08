const WRITE_KEYWORDS = /\b(alter|create|delete|drop|exec|execute|grant|insert|merge|revoke|truncate|update|xp_cmdshell)\b/i;
const ALWAYS_DANGEROUS = /\b(xp_cmdshell|grant|revoke)\b/i;
const WRITE_LIKE_READ = /\bselect\b[\s\S]+\binto\b/i;
const DANGEROUS_READ_FUNCTIONS = /\b(nextval|setval|pg_advisory_lock|pg_advisory_unlock|dblink_exec)\s*\(/i;

function stripSqlComments(sql) {
  return String(sql || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function hasMultipleStatements(sql) {
  const cleaned = stripSqlComments(sql).trim();
  const withoutTerminal = cleaned.endsWith(";") ? cleaned.slice(0, -1) : cleaned;
  return withoutTerminal.includes(";");
}

function validateSqlSafety(sql, options = {}) {
  const statement = String(sql || "").trim();
  const violations = [];
  if (!statement) {
    return { safe: false, violations: ["missing_sql"] };
  }
  const cleaned = stripSqlComments(statement);
  if (hasMultipleStatements(cleaned)) {
    violations.push("multiple_statements");
  }
  const writeAllowed = Boolean(options.allowWrite || options.isMigration);
  const dangerousPattern = writeAllowed ? ALWAYS_DANGEROUS : WRITE_KEYWORDS;
  if (dangerousPattern.test(cleaned)) {
    violations.push("dangerous_keyword");
  }
  if (!writeAllowed && WRITE_LIKE_READ.test(cleaned)) {
    violations.push("write_like_read");
  }
  if (!writeAllowed && DANGEROUS_READ_FUNCTIONS.test(cleaned)) {
    violations.push("dangerous_function");
  }
  if (options.readOnly !== false && !/^\s*(select|with|explain|show)\b/i.test(cleaned)) {
    violations.push("read_statement_required");
  }
  return {
    safe: violations.length === 0,
    violations: Array.from(new Set(violations)),
    normalizedSql: cleaned,
  };
}

module.exports = {
  stripSqlComments,
  validateSqlSafety,
};
