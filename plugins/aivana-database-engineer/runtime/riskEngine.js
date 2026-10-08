const { getPolicy } = require("./config");

const HIGH_COST_PATTERNS = [
  /\b(drop|truncate|delete\s+from)\b/i,
  /\balter\s+table\b/i,
  /\bcreate\s+(or\s+replace\s+)?(function|procedure|trigger|view|index|schema)\b/i,
];

const MEDIUM_COST_PATTERNS = [
  /\bupdate\s+.*\bset\b/i,
  /\binsert\s+into\b/i,
  /\bmerge\s+into\b/i,
  /\bcreate\s+table\b/i,
];

const READ_PATTERNS = [
  /\bselect\b/i,
  /\bexplain\b/i,
  /\bshow\b/i,
  /\bwith\s+\w+\s+as\b/i,
];

const TRANSACTION_PATTERNS = [
  /\b(begin|commit|rollback|savepoint)\b/i,
  /\btransaction\b/i,
  /\block\s+\w+\b/i,
];

const INJECTION_PATTERNS = [
  /'.*?(or|and)\s+1\s*=\s*1/i,
  /;\s*(drop|alter|delete|insert|update|create|truncate)\b/i,
  /union\s+select/i,
  /--\s*?/,
  /\/\*/,
];

const CRITICAL_PATTERNS = [
  /\bdrop\s+database\b/i,
  /\balter\s+system\b/i,
  /\bshutdown\b/i,
  /\bpg_terminate_backend\b/i,
];

function parseSqlWithSqlParser(sql) {
  try {
    const parserLib = require("node-sql-parser");
    const parser = new (parserLib.Parser)();
    return parser.astify(sql, { database: "postgresql" });
  } catch (_error) {
    return null;
  }
}

function astRiskSignals(ast) {
  if (!ast) {
    return [];
  }
  if (Array.isArray(ast)) {
    return ast.flatMap((entry) => astRiskSignals(entry));
  }
  const signals = [];
  const type = String(ast?.type || "").toUpperCase();
  if (type.includes("DELETE") || type.includes("UPDATE") || type.includes("INSERT")) {
    signals.push("mutation_ast_node_detected");
  }
  if (type.includes("CREATE") || type.includes("ALTER") || type.includes("DROP")) {
    signals.push("ddl_ast_node_detected");
  }
  if (type.includes("SELECT") && /union|join/i.test(JSON.stringify(ast).toLowerCase())) {
    signals.push("ast_union_or_join_detected");
  }
  return signals;
}

function normalize(sql) {
  return String(sql || "").trim().replace(/\s+/g, " ");
}

function stripComments(sql) {
  return sql
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .trim();
}

function hasNoWhereClause(sql) {
  return /\bdelete\s+.*from\b/i.test(sql) && !/\bwhere\b/i.test(sql);
}

function countSqlTokens(sql) {
  return normalize(sql).split(" ").filter(Boolean).length;
}

function estimateImpact(sql) {
  const tokens = countSqlTokens(sql);
  if (tokens > 120) {
    return "high";
  }
  if (tokens > 60) {
    return "medium";
  }
  return "low";
}

function classify(sql) {
  const policy = getPolicy();
  const sanitized = stripComments(normalize(sql)).toLowerCase();
  const tokens = countSqlTokens(sanitized);
  const riskSignals = [];
  const ast = parseSqlWithSqlParser(sql);
  const astSignals = astRiskSignals(ast);
  riskSignals.push(...astSignals);

  let level = "LOW";

  if (CRITICAL_PATTERNS.some((re) => re.test(sanitized))) {
    level = "CRITICAL";
    riskSignals.push("critical_control_plane_operation_detected");
  } else if (HIGH_COST_PATTERNS.some((re) => re.test(sanitized))) {
    level = "HIGH";
    riskSignals.push("high_risk_mutating_or_schema_operation");
  } else if (MEDIUM_COST_PATTERNS.some((re) => re.test(sanitized))) {
    level = "MEDIUM";
    riskSignals.push("mutating_or_schema_write_operation");
  } else if (READ_PATTERNS.some((re) => re.test(sanitized))) {
    level = "LOW";
    riskSignals.push("read_only_query");
  }

  if (hasNoWhereClause(sanitized)) {
    level = "HIGH";
    riskSignals.push("unsafe_bulk_delete_without_where");
  }

  if (INJECTION_PATTERNS.some((re) => re.test(sanitized))) {
    level = "CRITICAL";
    riskSignals.push("possible_sql_injection_pattern");
  }

  if (TRANSACTION_PATTERNS.some((re) => re.test(sanitized))) {
    riskSignals.push("transaction_or_lock_context_detected");
    if (level === "LOW") {
      level = "MEDIUM";
    }
  }
  if (astSignals.includes("ddl_ast_node_detected")) {
    riskSignals.push("ddl_ast_structural_change");
  }
  if (astSignals.includes("mutation_ast_node_detected")) {
    riskSignals.push("mutation_ast_structural_change");
  }
  if (estimateImpact(sanitized) === "high" && level !== "HIGH" && level !== "CRITICAL") {
    level = "MEDIUM";
    riskSignals.push("high_complexity_query");
  }

  if (tokens > 250) {
    riskSignals.push("very_large_query_text");
    if (policy && policy.risk[level]) {
      const current = policy.risk[level];
      if (current.action === "AUTO_EXECUTE") {
        level = "MEDIUM";
      }
    }
  }

  const enforcement = policy.risk[level] || policy.risk.LOW;
  return {
    riskLevel: level,
    riskSignals,
    impact: estimateImpact(sanitized),
    requiresHumanApproval: enforcement.requiresApproval,
    suggestedAction: enforcement.action,
    maxExecutionWindowMs: enforcement.maxExecutionWindowMs,
    estimatedComplexity: estimateImpact(sanitized),
    sqlFingerprint: Buffer.from(sanitized).toString("base64").slice(0, 24),
    astParsed: Boolean(ast),
    safetyFlags: riskSignals,
  };
}

module.exports = {
  classify,
};
