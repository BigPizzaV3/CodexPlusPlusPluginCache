# First Run

Requires Node.js 22.16+; persistent local state uses SQLite transactions. Stop
older plugin runtimes before upgrading existing JSON/JSONL history. The original
files remain available after import; do not run old and new writers together.

1. Install dependencies:

```bash
npm ci
```

2. Use the installed plugin directory as the command working directory. Store
connection settings outside the plugin cache. The runtime reads process environment
variables; a `.env` file alone is not automatically loaded. With Node 22/24, use
`node --env-file=/absolute/private/path/.env runtime/runTool.js <tool> <json>`.
No separate LLM API key is needed; Codex provides the AI reasoning.
Set `CODEXDB_STATE_DIR` to a private writable directory outside the plugin cache.

3. Run the deterministic test suite:

```bash
npm test
```

4. Run readiness:

```bash
npm run readiness
```

5. Run the AI USP contract smoke test:

```bash
node --test tests/release-contracts.test.js
```

6. Try a closed-loop dry-run demo:

```bash
node runtime/runTool.js knowledge_gap_detector '{"objective":"recommend production index","evidence":{"hasSchema":true,"hasLivePlan":false,"hasTelemetry":false,"hasPolicy":true}}'
```

7. Review the curated killer demos:

```text
demos/KILLER_DEMOS.md
```

8. Review the launch messaging and sales flow:

```text
MARKETING.md
demos/SALES_PLAYBOOK.md
```

9. For production, set:

```bash
CODEXDB_REQUIRE_LIVE_CONNECTION=true
CODEXDB_MIGRATION_SIGNING_KEY=<secret>
```

The plugin will block live advisory workflows in production if it only has mock evidence.

## Optional release qualification

With authorized database connection settings, run either engine rehearsal:

```bash
npm run release:qualify -- --live-postgres --live-write-rehearsal
npm run release:qualify -- --live-sqlserver --live-write-rehearsal
```

`--live-write-rehearsal` requires `--live-postgres` and/or `--live-sqlserver`;
both engines can be selected in one run. It checks synthetic INSERT, UPDATE and
DELETE rollback and constraint failure recovery in isolated sessions using
temporary tables only. No customer tables are written. This is neither production
migration authorization nor backup/restore qualification. Unexecuted checks stay
`not_run` until run evidence exists.

During local qualification on 2026-09-13, `pg_stat_statements` 1.12 was activated
in PostgreSQL 18 database `postgres` after an authorized restart. Installed-plugin
statistics collection passed. Other installations must check their own state;
never automatically restart services, reset statistics or overwrite preload settings.

Use `--live-migration-workflow` with either live-engine flag to test the actual
installed `create_index` and `rollback_migration` dispatch in a fresh disposable
database. The test compares index catalogs and fixture rows, checks rejected
signatures before execution, and removes only its own test database. It requires
database-create/drop permission and must run on an authorized test instance.
It does not qualify productive migrations or authenticate the supplied actor.

Index application is limited to `environment: lab` with explicit `engine`,
`database`, `schema`, `table`. First request `executionMode: dry_run`, then copy
`migrationSignature`, `migrationSignedAt`, `migrationSigningExpiresAt` unchanged
into the `executionMode: apply` request. The scope, actor, index and connection
profile must remain unchanged. A signing key is required outside source control;
the qualification runner generates a temporary key only for its child processes.
Rollback is limited to the same scoped index, not arbitrary SQL. Other migration
tools remain draft-only. SQL execution success is not proof of business correctness.

External tenant tests use the existing `--live-dataverse` or `--live-salesforce`
flags with `npm run release:qualify --`. They require authorized access to an
actual tenant context, not local fixtures. Follow the tenant collection settings
in `RELEASE_CHECKLIST.md`; do not invent URLs or credentials. Keep external tenant
qualification `not_run` until actual tenant evidence is recorded.

## Trusted Issuer Approval For Lab Changes

Set `CODEXDB_REQUIRE_AUTHENTICATED_APPROVAL=true` to fail closed unless a trusted
receipt is present. Setting `CODEXDB_APPROVAL_TRUST_JSON` also activates this rule.
Its JSON object maps a key ID to exactly `publicKey` (Ed25519 SPKI PEM), `issuer`,
`subjects` (allowed initiators) and `approvers` (allowed reviewers). Provision this
trusted configuration outside source control; never accept caller-provided keys.
No LLM API key is needed. These are administrative signing credentials.

Supply `adminApprovalReceipt: {keyId, payload, signature}` in the apply request.
The external trusted issuer signs UTF-8 output from
`serializeAdminApprovalPayload` in `runtime/policyEngine.js` using Ed25519 and
encodes the signature as base64url. Payload fields, in canonical order:
`issuer`, `subject`, `approver`, `role`, `tool`, `engine`, `environment`,
`connectionProfile`, `database`, `schema`, `statementHash`, `issuedAt`,
`expiresAt`, `nonce`. Use role `dba_approver`, distinct subject and approver,
the exact request actor/scope and draft `actionFingerprint` as statementHash.
Times must be UTC ISO strings; validity is at most 15 minutes. Use a fresh nonce.

The existing migration HMAC is still required. Approved issuer/nonces are consumed
atomically before connecting, even if the database operation subsequently fails.
A retry or rollback needs a fresh receipt. Protect the local state directory with
OS permissions; deleting or restoring state can defeat its local replay history.
`admin_approval_check` verifies without consuming and cannot authorize execution.
This verifies an issuer's assertion, not a live customer IdP session. Production
application remains prohibited. Release qualification uses ephemeral test issuers,
not customer identity evidence. Without configured trust, legacy lab actors remain
self-declared and are explicitly reported as unauthenticated.

## Six Evidence Capabilities

### Live Replay And Context Collection

`live_context_fingerprint` reads visible schema/index metadata, data estimates,
selected settings and active-session count for SQL Server or PostgreSQL. It returns
the validityContext used by advisory cases. `live_recommendation_check` performs
collection and validity comparison in one call. Collection is on demand, not a
daemon. Incomplete permissions and statistics are not a full-system fingerprint.

`CODEXDB_REPLAY_REGISTRY_JSON` is administrator-owned JSON keyed by connection
profile. Each entry contains exact engine, database, systemId, deployment,
`isolated: true`, `readOnlyPrincipalReviewed: true`, and a templates object.
Each template contains `sql`, its lowercase `sha256`, `parameterCount`, `maxRows`
(1..10000), and `reviewedReadOnly: true`. Only lab scope is supported. PostgreSQL
placeholders are $1, $2; SQL Server placeholders are @codex_arg_1, @codex_arg_2.
Review finite result size in the SQL itself; output bounds are checked after driver
materialization. Use a genuinely read-only database principal. Registry declarations
are administrative assertions, not independent privilege or isolation verification.
SQL filtering is defense in depth; it cannot prove arbitrary functions harmless.

Run `live_workload_replay` with the full system/database scope, cases containing id,
baselineTemplate, candidateTemplate, parameters, optional offsetMs (0..10000).
Limits: 100 cases, 1..5 workers, 3..10 repetitions, five-second SQL timeout,
90-second admission budget. Already running queries finish or time out before close.
Arrival schedules restart per repetition; inspect actual offsets for queueing.
Supply sanitized parameters using the CLI's JSON stdin mode. No automatic customer
dataset anonymization, clone provisioning or arbitrary SQL rewrite is implemented.
Result hashes are keyed per run; raw rows and parameter values stay out of exports
and local audits. Cross-run hash equality is intentionally unsupported.

`live_rewrite_verification` requires coverage case references for nulls, duplicates,
rounding, timezone and permissions. Test references do not prove edge-case coverage.
Use exact decimal text projections where driver number conversion could lose
precision; date conversion can normalize timezone offsets. Authorization is tested
only under the connected principal, not all application roles.

### Process Evidence Exporter

Configure CODEXDB_PROCESS_TRACE_URL as a fixed HTTPS GET endpoint and
CODEXDB_PROCESS_TRACE_TOKEN outside source control. Its JSON response must contain
scope matching engine, database and the five system-context fields, plus spans
using the main skill's schema. Responses are limited to 1 MiB and five seconds;
redirects are rejected. `collect_process_evidence` joins explicit span identities
and also reads query/lock context. It does not infer links from temporal proximity
or install instrumentation in ERP/CRM systems. Customer exporter qualification is
separate from local tests.

### Central Status And External Witness

Configure CODEXDB_ENTERPRISE_APPROVAL_URL/TOKEN and optionally
CODEXDB_REQUIRE_ENTERPRISE_APPROVAL=true. The URL automatically activates the
requirement for lab apply; missing/invalid configuration fails closed. The existing
trusted Ed25519 receipt is still mandatory. A HTTPS POST checks central active or
revoked status immediately before local nonce consumption. Requests contain version
1, random requestId, receiptHash, issuer, nonce, subject, approver and operation
(tool, engine, environment, connectionProfile, database, schema, statementHash).
The response must echo exactly these fields plus status=active, checkedAt and
expiresAt. Timestamps must be fresh canonical UTC; expiry is at most 60 seconds
after checkedAt. No redirects, cached fallback or caller-selected URLs are accepted.

Configure CODEXDB_AUDIT_WITNESS_URL/TOKEN and optionally
CODEXDB_REQUIRE_AUDIT_WITNESS=true to require a remote intent-hash acknowledgement
before lab apply. POST requests contain version=1, requestId, action (append/check),
eventHash. Responses echo these fields plus status=recorded, witnessId, checkedAt,
expiresAt. `enterprise_audit_witness` can append/check a separately computed event
hash. Automatic apply witnesses bind authorized intent, not completed execution.
Timeouts/invalid acknowledgements block before connecting. CODEXDB_ENTERPRISE_TIMEOUT_MS
is bounded to 1..5000; JSON responses to 32 KiB. Central services must implement
these contracts and protect their own identity, revocation and storage policies.

These are provider-neutral adapters, not built-in Entra/Okta login, independently
verified immutable storage, or globally atomic cross-installation nonce consumption.
Production writes remain blocked. Never present fixture HTTP tests as live customer
identity qualification.

The main SQL performance skill documents `diagnostic_session`,
`diagnostic_test_result`, `business_impact_priority`, `outcome_evidence_gate`,
`recommendation_validity` and `admin_approval_check`. Use the persistent diagnostic
loop alongside `advisory_case`: measured speed alone never confirms business safety.
Context hashes are caller-supplied; collect fresh hashes before reusing past advice.
# DBA Recovery And Maintenance Evidence

If the runtime reports a legacy audit/replay mismatch, run
`node runtime/runTool.js audit_state_recovery '{"action":"inspect"}'` from the
plugin root (or supply JSON on stdin). Inspection does not create a state database.
After reviewing the gaps, an explicitly authorized new epoch can be started with
`action: start_new_epoch`, the returned `expectedFingerprint`,
`acknowledgeHistoricalGaps: true`, and a meaningful `reason`. Existing SQLite
audit epochs cannot be replaced. Exact legacy bytes are archived in the local
SQLite state, and original JSONL files remain untouched. Protect this directory:
historical files and their archival copies may contain sensitive content.
Audit verification continues to disclose that the legacy history is unverified.

`collect_dba_maintenance` collects bounded SQL Server/PostgreSQL catalog evidence
only. It does not execute VACUUM, statistics updates, BACKUP, RESTORE or DBCC.
Backup history cannot establish recoverability. Supply separately tested restore
evidence before evaluating RPO/RTO. Missing records and privileges are reported.
