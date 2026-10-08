---
name: sql-performance-advisor
description: Use when investigating SQL Server or PostgreSQL performance and guiding a case from scoped diagnosis to measured, business-correct verification.
---

# SQL Performance Advisor

For explicit tuning acceptance limits, supply `budgets` with `caseId` and
`maxCandidateMedianMs` and/or `maxRegressionMs`. Report every unbudgeted case.
Treat exceeded limits as a rejected candidate and context drift as inconclusive;
do not label observed median budgets as production SLO or percentile guarantees.

For ERP invariants, add lab cases with `assertion: "zero_violations"` using reviewed
control-query templates. Each must return one `violations` integer count. Treat
nonzero or malformed evidence as rejection even when both query results match.
State exactly which business rule and database principal were tested; never claim
universal ERP or cross-role correctness from these checks.

Use `run_tuning_lab` to combine before/after live context fingerprints with the
administratively qualified lab rewrite replay. Require all replay scope, registry,
template and edge-case coverage prerequisites. Reject result differences and treat
context drift as inconclusive. Median client duration is not server CPU or a proven
production improvement. Report the returned missing evidence before proposing a fix.

For SQL Server TempDB investigation use `collect_tempdb_health` with explicit
`engine: "sqlserver", database: "tempdb"`. Explain that TempDB is shared across
application databases. Review file settings, data/log counters and observed page
waits without inferring disk headroom, allocation contention or workload ownership.
Preserve unavailable/truncated sections. Never automatically shrink or resize files.

For PostgreSQL replication or WAL-retention investigations, use
`collect_replication_health` with explicit `engine: "postgres"` and `database`.
Report cluster-wide physical slots/archive statistics separately from database-local
logical slots. Preserve unavailable sections and decimal-string LSN distances;
never equate them with disk usage or replica delay. Findings request investigation,
not permission to drop slots or remove WAL. Subscriber health remains unverified.

For ERP/CRM vendor context, first follow `../erp-crm-advisor/SKILL.md` and select
the exact product profile. Do not infer that a vendor-managed SQL endpoint permits
index changes or that faster SQL preserves application business semantics.

Resolve the plugin root two directories above this SKILL.md and use its absolute
`runtime/runTool.js` path. Check Node.js and installed dependencies first; use
`npm ci` in that plugin root when dependencies are missing. Do not request an LLM
API key: Codex supplies the reasoning. Database credentials come from the user's
process environment or an explicitly selected private environment file.

For real database requests, require live evidence with
`CODEXDB_REQUIRE_LIVE_CONNECTION=true`. Never present mock samples, heuristic
scores, generated runbooks, or estimated improvements as measured facts. Report
connection failures and missing evidence explicitly. Start with read-only analysis;
do not execute generated writes without the user's authorization.

Use JSON via stdin (`runTool.js advisor_workflow -`) for structured inputs.
Keep persistent state outside the plugin cache using `CODEXDB_STATE_DIR`.

## Standard workflow

Use `collect_blocking_frame` for a real PostgreSQL frame with explicit `engine`,
`systemId`, `database`, and optional `connectionProfile`. Pass the returned `frame`
into `blocking_timeline` along with earlier frames from the same scope. The tool
captures session starts and pg_blocking_pids, not SQL text or usernames. Hidden
identities and excessive session counts fail closed. PID zero remains an unresolved
prepared-transaction blocker. This is on-demand collection; do not start frequent
polling or imply unattended monitoring. SQL Server/MySQL/MariaDB frame collection
is not supported by this command yet.

For sampled blocking history, use `blocking_timeline` with `engine`, `systemId`,
`database`, and 1..120 `frames` in ascending capture order. Each frame repeats the
scope and contains canonical UTC `capturedAt`, `evidenceRef`, and `sessions`.
A session has string `sessionId`, canonical UTC `startedAt`, and `blockedBy` as
an array of session IDs in the same frame (including unresolved IDs if the blocker
was not captured). Start time distinguishes reused IDs. Explain edges, observed
root blockers, unresolved blockers, and cycles. Never infer uninterrupted blocking
duration from samples or call a cycle a proven deadlock; obtain the native deadlock
artifact separately. Do not execute KILL or cancel sessions from these findings.

Use `operational_window_compare` for supplied cumulative counters. Require top-level
`engine`, `systemId`, `database` and `before`/`after` windows repeating that scope.
Each window has canonical UTC `start`/`end`, `metrics`, and `queries`. A metric is
`{metric,unit,start:{value,counterEpoch},end:{value,counterEpoch}}`; values must be
nonnegative safe integers. Queries are `{queryId,metrics}`. Supported metrics:
execution_count/logical_reads/physical_reads/rows/errors in count; elapsed_time/
cpu_time/lock_wait_time in ms; bytes_read/bytes_written in bytes. Windows must have
equal positive duration, must not overlap, and counters must share an epoch.
Resets, decreasing counters, or missing queries mean insufficient evidence.
Optional `slo` entries contain metric, unit, aggregation (`delta` or `rate`),
operator (`lte` or `gte`), threshold, and optional queryId. Rate units use `/s`.
Report supplied-counter differences, never inferred percentiles, causal impact,
background monitoring, or CPU derived from elapsed time.

Use `consulting_project` to maintain a local consulting case. Require explicit
`tenantId` and `projectId`. Actions are `create`, `get`, `update`, and `export`.
Create/update `data` supports `goals`, `systems`, `findings`, `decisions`, and
`evidence`, each a list of `{id,text,evidenceRefs?}`. Goals and systems are required;
evidence references must resolve to IDs in the evidence list. Updates require the
last `expectedRevision`. Export with `format: json` or `markdown`; the result
contains the report and its hash. Keep customer secrets out of all project text.
Acceptance is recorded as supplied, not authenticated: accepted/rejected requires
reviewer, recordedAt, note, and evidenceRefs. Content updates invalidate acceptance
unless a new explicit statement accompanies them. Project namespaces are not
tenant authorization; use OS/process isolation for different customers.

For operating evidence, run `collect_dba_maintenance` with explicit SQL Server or
PostgreSQL `engine`, `database`, and optional `connectionProfile`. Report section
status and scope. PostgreSQL tuple counts are estimates, not bloat measurements;
SQL Server modification counters do not define a universal maintenance threshold.
SQL Server backup history is not recovery-chain or restore proof. PostgreSQL
requires external backup-tool evidence. Do not infer RPO/RTO compliance or perform
maintenance writes from these results.

If legacy audit import prevents any operation, use `audit_state_recovery` with
`action: inspect` first. It reads the configured state only and returns a source
fingerprint. `start_new_epoch` requires the exact `expectedFingerprint`,
`acknowledgeHistoricalGaps: true`, and a bounded `reason`. Explain the historical
gaps and obtain the user's authorization to resume with a separate epoch before
doing so. Original files and exact source bytes are preserved locally. The
archived bytes may contain historical sensitive content; protect the state folder.
This is not repair of the old chain. Never reinterpret
`current_epoch_verified_legacy_unverified` as globally verified audit history.

For a consolidated first review, run `database_engineer_brief` with explicit
`engine`, `database`, optional `connectionProfile`, and optionally a SELECT `sql`.
Explain the report in terms of observed facts, unresolved questions, and the next
safe measurement. Cite the relevant section and its capture time for each finding.
The report requires live discovery; downstream collector failures remain visible
without being replaced by mock data. It reuses one discovery snapshot for native
index reviews, limits each list to 20 with explicit totals, and returns no health
score or write approval. Retrieve the named detail tool when a section is truncated.
SQL Server/PostgreSQL have catalog/security sections; native index review and the
optional plan section currently target SQLite/MySQL/MariaDB. Unsupported sections
are not clean bills of health. Never claim uniqueness against competitors or
production readiness from this report alone.

Use `duplicate_index_review` with a SQLite/MySQL/MariaDB discovery `result` as
`snapshot` to find groups with identical observed full-column index keys. Key
order, sort direction, and SQLite collation are compared. Unique, partial,
expression, prefix, and incompletely described indexes are excluded. Treat each
group as a review candidate only. Check foreign-key dependencies, application
hints, visibility/storage options, and representative usage before proposing any
retirement. Never turn these findings directly into DROP INDEX; the tool provides
neither executable DDL nor fabricated storage/write-cost savings.

Use `compare_native_plans` with `before` and `after` results from
`native_query_plan` and optional `maxAgeMinutes` (default 60, maximum 10080).
The command requires identical engine, database, profile label, and exact SQL
hash, and reports positional native-plan differences plus evidence age gaps.
Do not call `plan_changed` a regression or improvement: obtain workload timing
and business-correctness evidence separately. The SQL fingerprint is not a secret
redaction mechanism; do not put sensitive literals into queries or exported plans.
Profiles and supplied timestamps are not independent server-identity attestations.

For SQLite/MySQL/MariaDB foreign-key indexing, pass the discovery `result` as
`snapshot` to `foreign_key_index_review`. It compares child-key columns with
leading full-column index positions, preserving order and schema/table identity.
Partial, expression, prefix, or incompletely described indexes are skipped and
reported. `leading_columns_observed` is metadata evidence, not proof of actual
optimizer use. `no_matching_index_observed` is a review candidate, not permission
to create an index. Preserve coverage gaps; do not claim missing indexes are
proven absent or automatically generate index DDL.

For SQLite, MySQL, or MariaDB query plans, run `native_query_plan` with `engine`,
`database`, `sql`, and optional `connectionProfile`. It uses the native adapter's
EXPLAIN without ANALYZE. Treat plan rows and index choices as optimizer evidence,
not measured latency or proof that an index will improve performance. SQLite
supports guarded SELECT plans. MySQL/MariaDB currently accept only a single
base-table SELECT with `*` or named columns and optional LIMIT, bounded to 1000;
joins, predicates, expressions, views, and stored functions are intentionally
unsupported. Report this limitation rather than rewriting a query and presenting
its plan as equivalent. Never retry rejected queries through a less restricted
executor. This command does not enable query execution or writes.

For deployment review, use `schema_contract_check` with `before` and `after`
observation envelopes returned by `discover_database` (including `scope`,
`capturedAt`, and `result`). Supply a `contract` containing `requiredObjects`,
`protectedObjects`, `expectedChanges`, and `maxAgeMinutes` (1..1440). Object
identities contain `kind`, `schema`, and `name`; expected changes contain
`identity` and `type` from the schema comparison. At least one contract rule is
required. Protect ERP keys and business-critical columns explicitly, not by name
heuristics. Expected changes never override protection. Missing objects mean
not observed, not proven deleted. Pass a previous `reviewFingerprint` as
`reviewedFingerprint` to detect changes to the exact evidence or contract.
This hash is not approval. Preserve `insufficient_evidence` for incomplete
catalogs and stale timestamps. Even `observed_contract_matches` is only a result
against supplied observations, never authorization to deploy or modify data.

Use `compare_live_schemas` for two live connection scopes, supplied as `before`
and `after`, each with `engine`, `database`, and optional `connectionProfile`.
Use `compare_database_snapshots` for previously collected discovery results.
Both require the same engine and report changed observations and one-sided
objects, not executable migration instructions. Incomplete discovery cannot prove
object deletion. Changes to statistics are not necessarily schema changes. Never
turn this output directly into DROP/ALTER statements or claim an atomic snapshot.

For schema inventory, run `discover_database` with explicit `engine` and `database`.
Supported inspection engines: `sqlserver`, `postgres`, `sqlite`, `mysql`, `mariadb`.
Use `database_capabilities` to inspect adapter support and
`database_security_findings` for scoped security evidence. All three require a
live connection, validate the selected database, and never authorize changes.
Respect per-kind coverage and limitations; `complete: false` is not a full audit.
SQLite supports metadata inspection only through these commands. MySQL/MariaDB
security auditing is explicitly unsupported. Do not route those engines through
legacy SQL Server/PostgreSQL tuning, replay, migration, or administrative tools.

For SQLite, set `CODEXDB_SQLITE_DATABASE` to an existing absolute database file
path and pass that same path as `database`; the file opens read-only. For MySQL
or MariaDB, use `CODEXDB_MYSQL_*` or `CODEXDB_MARIADB_*` profile fields `SERVER`,
`PORT`, `DATABASE`, `USER`, and `PASSWORD`. Verified TLS is mandatory; no automatic
insecure fallback. Credentials must remain in the private environment.

Before live diagnosis, run `admin_preflight` with explicit `engine` and `database`,
and optional `connectionProfile`, `schema`, `table`. This always requires a live
connection and checks query-statistics, lock and index collectors independently.
Report `blocked` or `limited` and each missing capability. `available_no_rows`
does not mean healthy. This tool never restarts a service or grants write access.

Live index changes are limited to the explicit `lab` environment. Follow
`../../FIRST_RUN.md` for `create_index` / `rollback_migration`: request a dry-run
draft, review exact SQL and scope, then pass its signature and unchanged issue/expiry
times into apply. An external signing key and explicit actor/database/schema/table
are required. The actor is self-declared, not authenticated approval. Other migration
tools are draft-only; never treat local qualification as production authorization.

Live query statistics contain measured means, not latency percentiles. `p95Ms`
and `regressionScore` are null when unavailable. PostgreSQL execution time is not
CPU time; its `cpuMs` is null. Preserve `metricEvidence` and never substitute an
average, a multiplier or a fabricated baseline for these missing measurements.

For backup/restore assessment, call `backup_restore_readiness_guard` with numeric
`lastBackupAgeHours`, `lastRestoreTestDays`, `restoreDurationHours` (all >= 0),
explicit positive `rpoHours`, `rtoHours`, `maxRestoreTestAgeDays`, and boolean
`restoreTestSucceeded`. Missing evidence never qualifies as ready. These are
supplied assertions, not an independently witnessed restore or execution approval.

Use `advisor_workflow` as the main entry, with `action: start`, an `objective`, and
`systemId`, `environment`, `product`, `productVersion`. For database-only cases,
use the actual database product/version, not an invented ERP profile. Resume with
`action: resume`, the same scope and `caseId`; follow its `nextStep` through
`advisory_case`. Missing evidence means collect or ask for it, not assume success.

Read the persistent-case section of `../erp-crm-advisor/SKILL.md` for case inputs.
It also applies to database-only cases; vendor-specific catalog selection does not.
The approved business contract must name required company/currency/unit/metric
groups. Both technical measurements and these controls must pass verification and
later follow-up before confirmation. Never synthesize approval references.

For application/integration/database traces, use `causal_evidence_review` with
scoped events and hypotheses listing supporting and refuting event IDs. Review
alternative explanations. Correlation does not establish root cause.

When causes remain ambiguous, use `next_evidence_test` to compare proposed tests.
Supply the full scope including deployment, hypothesis IDs, available evidence
references, and tests with matching scope, `id`, `readOnly`, `estimatedMinutes`,
`requiresEvidence`, and `outcomes` (`id`, `compatibleHypotheses`). Codex proposes
these compatibility assumptions explicitly; never describe them as measured facts.
The tool prefers tests that narrow hypotheses even in their worst modeled outcome,
then lower estimated time. Missing prerequisites, mutations and excessive cost
exclude a test. Review the selected test's actual SQL/permissions before execution.
If an unexpected outcome occurs, stop and revise the model rather than forcing
the result into a predefined conclusion. No candidate is a valid result.

Find relevant history through `advisory_case` with `action: find_confirmed`, exact
scope, `workloadId` and `customizationHash`. Explain why a prior case applies and
what must be remeasured. No matches is a valid result, not grounds to broaden scope.

## Evidence-driven operating loop

For automatically collected context, use `live_context_fingerprint` with engine,
database, connectionProfile and the five-field system scope. Use its returned
validityContext when proposing a case. `live_recommendation_check` collects a fresh
context and checks caseId; never replace failed collection with caller hashes.
These are visible metadata, row estimates and instantaneous load, not content
checksums or continuous monitoring. Schedule checks only on explicit user request.

`collect_process_evidence` fetches spans from an administrator-configured HTTPS
exporter and collects database context. Configure endpoints as documented in
FIRST_RUN.md. `process_trace_correlation` accepts supplied spans without network
access. Each span needs full five-field scope, id, traceId, spanId, parentSpanId
(null for roots), processId, layer (app/api/db/wait/plan), startedAt, durationMs,
evidenceRef. Joins require exact trace and parent-span identities; ambiguous links
remain unresolved. Separate query/lock snapshots are not automatically proven trace
joins. Exporter evidence is not independently attested causality.

Use `live_workload_replay` only in an explicitly registered isolated lab database.
Pass full scope, cases (id, baselineTemplate, candidateTemplate, parameters,
offsetMs), concurrency 1..5, repetitions 3..10 and optional ordered comparison.
SQL is taken only from reviewed environment configuration, never from case input.
Provide anonymized scalar parameters through stdin, not command-line arguments.
The runtime does not anonymize customer data. Alternating paired runs preserve
parameter cases; actual arrival offsets reveal queueing. No raw results or parameter
values are exported. Results compare driver values, including multiplicity and nulls;
freeze test data and preserve exact decimal precision in reviewed SQL projections.

`live_rewrite_verification` additionally requires coverage mapping nulls, duplicates,
rounding, timezone and permissions to case IDs. These references are declared test
coverage, not proof that every edge case or every principal was exercised. A match
means matched recorded cases, never universal SQL equivalence or production approval.

`business_outcome_measurement` takes before/after process runs and businessControls.
Each run has full five-field scope, exportId, processId, cohortHash, datasetHash,
sloMs, window {startAt,endAt}, events. Each event repeats scope/processId/cohortHash,
and has eventId, caseId, status (success/error), startedAt, durationMs, blockedMs,
evidenceRef. Both runs require identical case IDs, process, cohort, dataset and SLO,
fresh non-overlapping equal-duration windows, distinct export/event IDs. Controls
use the existing business reconciliation schema plus matching processId, cohortHash
and window, with snapshotHash equal to datasetHash and capturedAt after window end.
Report measured success, errors, SLO breaches, blocking and duration deltas together
with correctness. Do not call supplied exports live telemetry or turn them into ROI.

Enterprise approval and external hash witnesses are opt-in configured integrations.
Use `enterprise_approval_check` and `enterprise_audit_witness` per FIRST_RUN.md.
Neither is an IdP login implementation or immutable audit storage certificate.

Use `diagnostic_session` with full scope (`systemId`, `environment`, `product`,
`productVersion`, `deployment`). Start with `action: start`, `objective` and 2-20
hypotheses. Read with `sessionId`; every mutation requires `expectedRevision`.
`plan_test` takes the test model described above. Execute only a separately reviewed
read-only test, then `record_result` with the pending plan's `inputHash` as `planHash`,
selected `testId`, actual `observedOutcomeId`, fresh `observedAt`, unique
`evidenceRefs` and exact `resultScope`. References are supplied evidence, not attestation.
Unexpected results require `revise_model` with a reason and replacement hypotheses.
`record_trace_review` accepts `causalEvidence`; counterevidence must remain visible.
One remaining hypothesis is ready for verification, not proof of causality.

`record_verification` accepts `measurements` and `businessControls: {before, after}`.
The standalone `outcome_evidence_gate` checks these same inputs: repeated technical
improvement AND unchanged supplied business controls, with matching snapshot hashes
and full five-field scope on every benchmark run and business export. Session
measurements must follow the diagnostic result. A verified session must still pass
the approved expected-control contract and follow-up in `advisory_case` before closure.

Prioritize actual process impact with `business_impact_priority`, full scope and
`processes`: each has `id`, `name`, `evidenceRef`, fresh `observedAt`, `criticality`
(`critical`, `high`, `normal`), integer `affectedTransactions`, `blockedTransactions`,
and nullable `p95Ms`, `sloMs`, `deadlineAt`. Explain the returned ordering; missing
metrics remain unassessed. Do not invent lost revenue or measured AI confidence.

When proposing a case, supply `validityContext` with deployment and SHA-256 hashes
`schemaHash`, `dataProfileHash`, `loadProfileHash`, `configurationHash`, plus optional
`validityHours` (default 24, maximum 720). Pass current context to `find_confirmed`
or `recommendation_validity` (`action: check`, case ID and scope). Changed, missing,
expired or explicitly invalidated context requires revalidation. `action: invalidate`
requires revision and reason. This compares supplied hashes, not a background monitor.

For authenticated-issuer lab approval, follow FIRST_RUN.md. `admin_approval_check`
validates trusted Ed25519 receipts; verification alone never executes or consumes
them. Actual apply consumes the issuer/nonce once before connecting. This proves
an issuer assertion, not an independent IdP login, and never enables production apply.

Keep legacy simulators, scorecards and generated ROI narratives out of the default
evidence path. Use them only for explicitly requested scenario exploration and
label their assumptions. The older `sql_performance_advisor` tool remains available
for compatibility, not as a substitute for the verified case workflow.
