const { getPolicy } = require("./config");
const nodecrypto = require("node:crypto");

// Wire format: UTF-8 JSON.stringify in this exact order; no whitespace/case coercion.
const approvalFields = ["issuer", "subject", "approver", "role", "tool", "engine", "environment", "connectionProfile", "database", "schema", "statementHash", "issuedAt", "expiresAt", "nonce"];
const approvalLimit = 32 * 1024;
function approvalObject(value, fields) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.hasOwn(value, field));
}
function approvalString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024
    && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value) && value === value.normalize("NFC");
}
function serializeAdminApprovalPayload(payload) {
  if (!approvalObject(payload, approvalFields) || !approvalFields.every((field) => approvalString(payload[field]))
    || !/^[a-f0-9]{64}$/.test(payload.statementHash)) {
    throw new Error("malformed_approval_payload");
  }
  return JSON.stringify(Object.fromEntries(approvalFields.map((field) => [field, payload[field]])));
}

// args: {receipt:{keyId,payload,signature}, actor:string|{subject}, tool, engine,
// environment, connectionProfile, database, schema, statementHash}. No scope defaults.
// Times must equal Date.toISOString() (UTC).
// Trust is exclusively the process environment, with mandatory subjects/approvers arrays.
// This attestation neither authenticates an IdP login nor grants production execution.
function verifyAdminApproval(args) {
  const deny = (reason) => ({ authorized: false, reason });
  try {
    const rawInput = JSON.stringify(args);
    if (!args || Buffer.byteLength(rawInput, "utf8") > approvalLimit) return deny("malformed_approval_input");
    // Snapshot JSON input so validation and verification use precisely the same values.
    const input = JSON.parse(rawInput);
    const receipt = input.receipt;
    if (!approvalObject(receipt, ["keyId", "payload", "signature"]) || !approvalString(receipt.keyId)
      || typeof receipt.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(receipt.signature)) return deny("malformed_approval_receipt");
    const payload = receipt.payload;
    const signedContent = serializeAdminApprovalPayload(payload);
    const signature = Buffer.from(receipt.signature, "base64url");
    if (signature.length !== 64 || signature.toString("base64url") !== receipt.signature) return deny("malformed_approval_signature");
    if (payload.role !== "dba_approver") return deny("approval_role_not_allowed");
    const subject = typeof input.actor === "string" ? input.actor : input.actor?.subject;
    if (!approvalString(subject) || subject !== payload.subject || payload.subject === payload.approver) return deny("approval_identity_mismatch");
    if (!["tool", "engine", "environment", "connectionProfile", "database", "schema", "statementHash"].every((field) => approvalString(input[field]) && input[field] === payload[field])) return deny("approval_scope_mismatch");
    const issuedAt = Date.parse(payload.issuedAt);
    const expiresAt = Date.parse(payload.expiresAt);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)
      || new Date(issuedAt).toISOString() !== payload.issuedAt || new Date(expiresAt).toISOString() !== payload.expiresAt
      || expiresAt <= issuedAt || expiresAt - issuedAt > 15 * 60 * 1000) return deny("approval_invalid_validity");
    const now = Date.now();
    if (issuedAt > now) return deny("approval_issued_in_future");
    if (expiresAt <= now) return deny("approval_expired");
    const rawTrust = process.env.CODEXDB_APPROVAL_TRUST_JSON;
    if (!rawTrust || Buffer.byteLength(rawTrust, "utf8") > approvalLimit) return deny("approval_untrusted_issuer");
    let trust;
    try { trust = JSON.parse(rawTrust); } catch { return deny("approval_invalid_trust_config"); }
    if (!trust || typeof trust !== "object" || Array.isArray(trust) || !Object.hasOwn(trust, receipt.keyId)) return deny("approval_untrusted_issuer");
    const entry = trust[receipt.keyId];
    if (!approvalObject(entry, ["publicKey", "issuer", "subjects", "approvers"])
      || typeof entry.publicKey !== "string" || !approvalString(entry.issuer)
      || ![entry.subjects, entry.approvers].every((list) => Array.isArray(list) && list.length > 0 && list.every(approvalString))) return deny("approval_invalid_trust_config");
    if (entry.issuer !== payload.issuer) return deny("approval_untrusted_issuer");
    if (!entry.subjects.includes(payload.subject) || !entry.approvers.includes(payload.approver)) return deny("approval_identity_not_allowlisted");
    let key;
    try {
      if (!entry.publicKey.startsWith("-----BEGIN PUBLIC KEY-----")) return deny("approval_invalid_trust_key");
      key = nodecrypto.createPublicKey(entry.publicKey);
    } catch { return deny("approval_invalid_trust_key"); }
    if (key.asymmetricKeyType !== "ed25519") return deny("approval_invalid_trust_key");
    if (!nodecrypto.verify(null, Buffer.from(signedContent, "utf8"), key, signature)) return deny("approval_invalid_signature");
    return {
      authorized: true,
      receiptHash: nodecrypto.createHash("sha256").update(JSON.stringify({ keyId: receipt.keyId, payload: JSON.parse(signedContent), signature: receipt.signature })).digest("hex"),
      nonce: payload.nonce, expiresAt: payload.expiresAt,
      issuer: payload.issuer, subject: payload.subject, approver: payload.approver,
      provenance: "cryptographic_trusted_issuer_attestation_not_independent_IdP_login",
      productionAuthorization: false,
    };
  } catch {
    return deny("malformed_approval_input");
  }
}

// Provider-neutral HTTPS JSON boundary, not an OIDC authentication implementation.
// Only administrators configure endpoints/tokens. fetchImpl is a unit-test seam, never tool args.
async function approvalAuthorityRequest(prefix, request, fetchImpl) {
  const endpoint = new URL(process.env[`${prefix}_URL`]);
  const token = process.env[`${prefix}_TOKEN`];
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash
    || !token || token.length > 8192 || /[\s\u0000-\u001f\u007f]/.test(token)) throw new Error("authority_configuration");
  const timeout = Number(process.env.CODEXDB_ENTERPRISE_TIMEOUT_MS || 5000);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 5000) throw new Error("authority_configuration");
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("authority_timeout")); }, timeout);
      }),
      (async () => {
        const response = await fetchImpl(endpoint.href, {
          method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(request),
        });
        if (response.status !== 200 || response.redirected
          || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") || "")) throw new Error("authority_response");
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > approvalLimit)) throw new Error("authority_response_size");
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > approvalLimit) throw new Error("authority_response_size");
            chunks.push(Buffer.from(value));
          }
        } finally {
          void reader.cancel().catch(() => {});
        }
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function freshAuthorityResponse(response, startedAt) {
  const now = Date.now();
  const checked = Date.parse(response.checkedAt);
  const expires = Date.parse(response.expiresAt);
  return typeof response.checkedAt === "string" && typeof response.expiresAt === "string"
    && Number.isFinite(checked) && Number.isFinite(expires)
    && new Date(checked).toISOString() === response.checkedAt && new Date(expires).toISOString() === response.expiresAt
    && checked <= now && checked >= startedAt - 5000 && now - checked <= 30000
    && expires > now && expires > checked && expires - checked <= 60000;
}

// Response exactly echoes request plus {status:"active",checkedAt,expiresAt}.
// operation order: tool,engine,environment,connectionProfile,database,schema,statementHash.
async function verifyEnterpriseApproval(args, { fetchImpl = globalThis.fetch } = {}) {
  try {
    const raw = JSON.stringify(args);
    if (Buffer.byteLength(raw, "utf8") > approvalLimit) return { authorized: false, reason: "malformed_approval_input" };
    const input = JSON.parse(raw);
    const local = verifyAdminApproval(input);
    if (!local.authorized) return local;
    const scope = ["tool", "engine", "environment", "connectionProfile", "database", "schema", "statementHash"];
    const request = {
      version: 1, requestId: nodecrypto.randomBytes(32).toString("hex"),
      receiptHash: local.receiptHash, issuer: local.issuer, nonce: local.nonce,
      subject: local.subject, approver: local.approver,
      operation: Object.fromEntries(scope.map((field) => [field, input[field]])),
    };
    const startedAt = Date.now();
    const response = await approvalAuthorityRequest("CODEXDB_ENTERPRISE_APPROVAL", request, fetchImpl);
    if (!approvalObject(response, [...Object.keys(request), "status", "checkedAt", "expiresAt"])
      || !approvalObject(response.operation, scope)
      || !Object.keys(request).filter((key) => key !== "operation").every((key) => response[key] === request[key])
      || !scope.every((field) => response.operation[field] === request.operation[field])) return { authorized: false, reason: "enterprise_approval_binding_mismatch" };
    if (response.status !== "active") return { authorized: false, reason: "enterprise_approval_not_active" };
    if (!freshAuthorityResponse(response, startedAt) || Date.parse(local.expiresAt) <= Date.now()) return { authorized: false, reason: "enterprise_approval_stale" };
    return { ...local, expiresAt: new Date(Math.min(Date.parse(local.expiresAt), Date.parse(response.expiresAt))).toISOString(),
      checkedAt: response.checkedAt, provenance: "trusted_issuer_receipt_with_online_authority_status_not_independent_IdP_login", productionAuthorization: false };
  } catch {
    return { authorized: false, reason: "enterprise_approval_unavailable" };
  }
}

// Witness request: {version:1,requestId,action:"append"|"check",eventHash:sha256hex}.
// Response echoes request plus {status:"recorded",witnessId,checkedAt,expiresAt}.
// A remote acknowledgement is not proof of immutable storage or tamperproof local audit.
async function verifyEnterpriseAuditWitness(args, { fetchImpl = globalThis.fetch } = {}) {
  try {
    if (!approvalObject(args, ["action", "eventHash"]) || !["append", "check"].includes(args.action)
      || typeof args.eventHash !== "string" || !/^[a-f0-9]{64}$/.test(args.eventHash)) return { acknowledged: false, reason: "audit_witness_invalid_input" };
    const request = { version: 1, requestId: nodecrypto.randomBytes(32).toString("hex"), action: args.action, eventHash: args.eventHash };
    const startedAt = Date.now();
    const response = await approvalAuthorityRequest("CODEXDB_AUDIT_WITNESS", request, fetchImpl);
    if (!approvalObject(response, [...Object.keys(request), "status", "witnessId", "checkedAt", "expiresAt"])
      || !Object.keys(request).every((key) => request[key] === response[key]) || response.status !== "recorded"
      || !approvalString(response.witnessId) || !freshAuthorityResponse(response, startedAt)) return { acknowledged: false, reason: "audit_witness_invalid_acknowledgement" };
    return { acknowledged: true, action: request.action, eventHash: request.eventHash, witnessId: response.witnessId,
      checkedAt: response.checkedAt, expiresAt: response.expiresAt,
      provenance: "external_https_witness_acknowledgement_not_tamperproof_storage", productionAuthorization: false };
  } catch {
    return { acknowledged: false, reason: "audit_witness_unavailable" };
  }
}

const writeActions = new Set([
  "propose_migration",
  "simulate_query",
  "create_index",
  "rollback_migration",
  "optimize_query",
  "create_partitioning",
]);
const migrationActions = new Set(["create_index", "create_partitioning", "rollback_migration", "optimize_query", "propose_migration"]);

function normalizeActorRole(actor, rolePolicy) {
  if (actor && typeof actor === "object") {
    const directRole = actor.role || actor.roles?.[0] || actor.idpRole;
    if (directRole) {
      return normalizeActorRole(String(directRole), rolePolicy);
    }
    const roleClaim = actor.roleClaim || actor.role_claim;
    if (roleClaim) {
      return normalizeActorRole(String(roleClaim), rolePolicy);
    }
    return (rolePolicy && rolePolicy.defaultRole) || "developer";
  }
  const fallback = rolePolicy.defaultRole || "developer";
  const roles = rolePolicy && rolePolicy.roles ? rolePolicy.roles : {};
  const roleAliases = rolePolicy && rolePolicy.roleAliases ? rolePolicy.roleAliases : {};
  if (!actor || typeof actor !== "string") {
    return fallback;
  }
  const trimmed = actor.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.includes("|")) {
    const [left, right] = trimmed.split("|");
    if (right) {
      const rightCandidate = right.trim().toLowerCase().replace(/^role:/, "");
      if (roleAliases[rightCandidate]) {
        return roleAliases[rightCandidate];
      }
      if (roles[rightCandidate]) {
        return rightCandidate;
      }
    }
    if (left) {
      const leftCandidate = left.trim().toLowerCase().replace(/^role:/, "");
      if (roleAliases[leftCandidate]) {
        return roleAliases[leftCandidate];
      }
      if (roles[leftCandidate]) {
        return leftCandidate;
      }
    }
  }
  const direct = trimmed.toLowerCase().replace(/^role:/, "");
  const directAlias = roleAliases[direct];
  if (directAlias) {
    return directAlias;
  }
  if (roles[direct]) {
    return direct;
  }
  if (trimmed.toLowerCase().startsWith("role:")) {
    const candidate = trimmed.slice(5).toLowerCase();
    const alias = roleAliases[candidate];
    if (alias) {
      return alias;
    }
    if (roles[candidate]) {
      return candidate;
    }
  }
  return fallback;
}

function evaluateAction({
  actionType,
  environment = "lab",
  riskLevel = "LOW",
  database,
  schema,
  actor = "codex-user",
  sqlFingerprint = "",
  migrationSignature = "",
  actionFingerprint = "",
  isDryRun = false,
  rlsContext = {},
}) {
  const policy = getPolicy();
  const decision = {
    actionType,
    environment,
    riskLevel,
    policyVersion: "1.0",
    requiredControls: [],
    decision: "ALLOW",
    reasonCodes: [],
  };
  const env = String(environment || "lab").toLowerCase();
  const normalizedAction = String(actionType || "").toLowerCase();
  const effectiveSchema = schema ? String(schema).toLowerCase() : "";
  const rolePolicy = policy.rolePolicy || {};
  const role = normalizeActorRole(actor, rolePolicy);
  const roleConfig = rolePolicy.roles && rolePolicy.roles[role] ? rolePolicy.roles[role] : {};
  const productionAllowedWrites = roleConfig.allowedWriteActionsInProduction || rolePolicy.allowedWriteActionsInProduction || policy.allowedWriteActionsInProduction || [];
  const productionAllowedSchemas = roleConfig.allowedSchemasInProduction || ["public", "dbo"];
  const productionAllowedTools = roleConfig.allowedToolsInProduction || roleConfig.allowedTools || rolePolicy.allowedToolsInProduction;
  const isWriteAction = writeActions.has(normalizedAction);
  const isProduction = env === "production";
  const isMigrationAction = migrationActions.has(normalizedAction);
  const signatureRequired = policy.migrationSigning?.requireInProduction && isMigrationAction;
  const allowDryRunWithoutSignature = policy.migrationSigning?.allowDryRunWithoutSignature;
  const enforceSignatureTools = new Set(
    (policy.migrationSigning && policy.migrationSigning.enforceForTools && policy.migrationSigning.enforceForTools.length)
      ? policy.migrationSigning.enforceForTools
      : []
  );
  const requireSignature =
    !(allowDryRunWithoutSignature && isDryRun) &&
    (enforceSignatureTools.has(normalizedAction) || (signatureRequired && isProduction && isMigrationAction));
  const allowlistActive = String(policy.queryAllowlistMode || "off").toLowerCase() === "enforce" || String(policy.queryAllowlistMode || "off").toLowerCase() === "warn";
  const hasQueryFingerprint = Boolean(sqlFingerprint || actionFingerprint);
  const queryId = sqlFingerprint || actionFingerprint;
  const isQueryAllowlisted = !queryId || !policy.queryAllowlist.length || policy.queryAllowlist.includes(queryId);
  const hasRoleAllowlist = Array.isArray(productionAllowedTools) && productionAllowedTools.length > 0;

  if (riskLevel === "CRITICAL") {
    decision.decision = "SCOPE_TO_SANDBOX";
    decision.requiredControls.push("sandbox_profile", "forensic_snapshot", "network_isolation");
    decision.reasonCodes.push("critical_operation_requires_sandbox");
  } else if (riskLevel === "HIGH") {
    if (String(policy.sandboxPolicy?.highRiskDecision || "BLOCK").toUpperCase() === "SCOPE_TO_SANDBOX") {
      decision.decision = "SCOPE_TO_SANDBOX";
      decision.requiredControls.push("sandbox_profile", "forensic_snapshot", "network_isolation");
      decision.reasonCodes.push("high_risk_requires_sandbox");
    } else {
      decision.decision = "BLOCK";
      decision.requiredControls.push("high_risk_blocked");
      decision.reasonCodes.push("high_risk_blocked_by_policy");
    }
  } else if (riskLevel === "MEDIUM") {
    decision.decision = "REQUIRES_APPROVAL";
    decision.requiredControls.push("human_approval", "risk_review_note");
    decision.reasonCodes.push("medium_risk_requires_human_approval");
  }

  if (isProduction && isWriteAction && !productionAllowedWrites.includes(normalizedAction)) {
    decision.decision = "BLOCK";
    decision.requiredControls.push("role_write_allowlist", "policy_override_request");
    decision.reasonCodes.push("prod_write_not_allowed_for_role");
  }

  if (hasRoleAllowlist && isProduction && !productionAllowedTools.includes(normalizedAction)) {
    decision.decision = "BLOCK";
    decision.requiredControls.push("role_tool_allowlist", "policy_owner_signoff");
    decision.reasonCodes.push("tool_not_allowlisted_for_role");
  }

  if (isProduction && isWriteAction && riskLevel === "LOW") {
    decision.requiredControls.push("human_approval", "rollback_plan");
    if (!decision.requiredControls.includes("policy_owner_signoff")) {
      decision.requiredControls.push("policy_owner_signoff");
    }
    if (decision.decision === "ALLOW") {
      decision.decision = "REQUIRES_APPROVAL";
    }
    if (!decision.reasonCodes.includes("prod_write_requires_approval")) {
      decision.reasonCodes.push("prod_write_requires_approval");
    }
  } else if (isProduction && isWriteAction && riskLevel !== "LOW") {
    if (!decision.requiredControls.includes("human_approval")) {
      decision.requiredControls.push("human_approval", "rollback_plan");
    }
    if (!decision.requiredControls.includes("policy_owner_signoff")) {
      decision.requiredControls.push("policy_owner_signoff");
    }
    if (!decision.reasonCodes.includes("prod_write_requires_human_approval")) {
      decision.reasonCodes.push("prod_write_requires_human_approval");
    }
  }

  if (schema && policy.restrictedSchemas.includes(schema.toLowerCase())) {
    decision.decision = "BLOCK";
    decision.requiredControls.push("restricted_schema_override");
    decision.reasonCodes.push("restricted_schema_access");
  }

  if (isProduction && isWriteAction && effectiveSchema && !productionAllowedSchemas.includes(effectiveSchema)) {
    if (decision.decision !== "BLOCK") {
      decision.decision = "BLOCK";
    }
    decision.requiredControls.push("schema_scope_override");
    decision.reasonCodes.push("prod_schema_access_not_permitted");
  }

  const piiSensitiveActions = new Set(["query", "analyze", "detect_pii", "explain_query"]);
  if (piiSensitiveActions.has(normalizedAction) && !database) {
    decision.decision = "BLOCK";
    decision.requiredControls.push("database_scope");
    decision.reasonCodes.push("missing_database_context");
  }

  if (allowlistActive && !isWriteAction && hasQueryFingerprint && !isQueryAllowlisted) {
    if (String(policy.queryAllowlistMode).toLowerCase() === "enforce") {
      decision.decision = "BLOCK";
      decision.requiredControls.push("query_allowlist");
      decision.reasonCodes.push("query_not_allowlisted");
    } else if (!decision.reasonCodes.includes("query_not_allowlisted")) {
      decision.requiredControls.push("query_allowlist_audit");
      decision.reasonCodes.push("query_not_on_allowlist");
    }
  }

  if (requireSignature && isMigrationAction && !migrationSignature) {
    decision.requiredControls.push("migration_signature");
    decision.reasonCodes.push("missing_migration_signature");
    if (decision.decision === "ALLOW") {
      decision.decision = "BLOCK";
    }
  }

  decision.actorRole = role;

  const rlsEnabled = policy.rls?.enabled;
  const requireRlsContext = policy.rls?.requireTenantContext;
  const allowedTenantIds = policy.rls?.allowedTenantIds || [];
  const tenantId = rlsContext?.tenantId || rlsContext?.tenant;
  if (rlsEnabled && requireRlsContext && !tenantId) {
    if (policy.rls?.fallbackMode === "block") {
      decision.decision = "BLOCK";
      decision.requiredControls.push("rls_context_required");
      decision.reasonCodes.push("missing_rls_context");
    } else {
      decision.requiredControls.push("rls_context_warning");
    }
  }
  if (rlsEnabled && tenantId && allowedTenantIds.length && !allowedTenantIds.includes(String(tenantId))) {
    decision.requiredControls.push("tenant_access_denied", "tenant_access_review");
    if (decision.decision === "ALLOW") {
      decision.decision = "BLOCK";
    }
    decision.reasonCodes.push("tenant_not_allowed");
  }

  if (isMigrationAction && policy.migrationSigning?.requireNotExpired) {
    const signatureExpiresAt = String(migrationSignature || "").split("|").at(-1) || "";
    if (signatureExpiresAt && Date.parse(signatureExpiresAt) < Date.now()) {
      decision.decision = "BLOCK";
      decision.requiredControls.push("migration_signature_expired");
      decision.reasonCodes.push("policy_requires_unexpired_signature");
    }
  }

  return decision;
}

function classifyDecision(actionType, environment, riskLevel, database, schema, actor, options = {}) {
  if (typeof actionType === "object" && actionType !== null) {
    return evaluateAction(actionType);
  }
  return evaluateAction({
    actionType,
    environment,
    riskLevel,
    database,
    schema,
    actor,
    rlsContext: options.rlsContext || {},
  });
}

module.exports = {
  verifyEnterpriseApproval,
  verifyEnterpriseAuditWitness,
  verifyAdminApproval,
  serializeAdminApprovalPayload,
  evaluateAction,
  classifyDecision,
};
