# Aivana Database Engineer

## Live Database Inspection

### DBA And Consulting Workflows

`run_tuning_lab` accepts optional per-case `budgets`, for example
`[{"caseId":"invoice","maxCandidateMedianMs":100,"maxRegressionMs":5}]`.
Limits are inclusive, nonnegative milliseconds measured on client elapsed medians.
Exceeded limits reject the candidate for review; cases without limits are listed
explicitly. Invalid/duplicate case references fail before database collection.
Context drift takes precedence as inconclusive. These are observed lab budgets,
not percentile SLOs, statistical significance or production authorization.

Lab replay cases can specify `assertion: "zero_violations"`. Their administratively
reviewed templates must return exactly one row with a nonnegative integer
`violations` count. Both baseline and candidate must report zero; matching nonzero
results are rejected by `run_tuning_lab` as `reject_business_invariant`. Missing,
fractional, negative or unsafe numeric counts are invalid evidence, never passes.
Use explicit control queries for tenant boundaries, reconciliation or other ERP
rules. A passing query proves only its implemented check under the current principal,
not general ERP correctness or coverage of other roles. No control SQL is invented
or automatically approved. Raw result rows remain excluded from replay output.


`run_tuning_lab` integrates live context fingerprints before/after an isolated
SQL Server or PostgreSQL rewrite replay. It uses the existing administrative replay
registry, reviewed read-only templates and explicit edge-case coverage references.
Per-case median client elapsed times and result hashes expose slower candidates and
semantic differences. Context drift makes the outcome inconclusive. It does not
measure server CPU/IO, certify statistical significance or authorize deployment.
Required scope: engine, database, systemId, environment (`lab`), product,
productVersion and deployment; also supply cases and coverage as for
`live_rewrite_verification`. No production workload is executed by this tool.


`collect_tempdb_health` requires `engine: "sqlserver", database: "tempdb"` and
collects file configuration, data/log space and current request-level page waits.
It flags unequal data-file sizes, percentage growth, disabled autogrowth and observed
page waits for review, without claiming causality. All observations describe shared
instance TempDB, not one application's consumption. Page counters remain decimal
strings (8 KiB pages); unallocated extents are not free disk space. Missing permissions
and truncated sections are explicit. No shrink, resize, restart or configuration
change is executed. Log and version-store observations do not identify their owners.


`collect_replication_health` requires an explicit PostgreSQL database and collects
read-only WAL settings, server recovery role, replication slots and archive counters.
Logical slots are limited to the selected database; physical slots and archive
statistics are explicitly cluster-scoped. Lost/unreserved WAL status, inactive
slots retaining a WAL reference and unlimited slot retention produce review items.
LSN distances stay decimal strings, not disk-usage or time-lag estimates. Missing
permissions/version support and truncation remain visible evidence gaps. This does
not verify subscribers, backup recovery, or replication health and never deletes
slots/WAL or changes settings. Each section is an independent bounded observation.


`collect_blocking_frame` collects a live PostgreSQL observation directly usable by
`blocking_timeline`, without SQL text or usernames. It scopes activity to the
selected database, deduplicates blocker PIDs, preserves unresolved blockers, and
rejects hidden session identities or more than 500 sessions. It does not start
background monitoring or terminate sessions. PostgreSQL documents duplicate
client-visible PIDs and PID zero for prepared transactions in
[pg_blocking_pids](https://www.postgresql.org/docs/17/functions-info.html).

`blocking_timeline` reconstructs observed blocking edges across supplied session
snapshots for SQL Server, PostgreSQL, MySQL, and MariaDB. Session ID plus start time
prevents merging reused IDs. Missing blockers, cycles, and sampling limits remain
explicit. It reports observed root blockers without claiming native deadlock proof,
uninterrupted blocking duration, or root cause. No sessions are killed or canceled.

- `audit_state_recovery`: inspect legacy mismatches and explicitly start a separate
  audit epoch while preserving original files and exact source bytes. Historical
  gaps remain visible; recovery never certifies the old chain.
- `consulting_project`: local tenant/project namespaces, goals, systems, findings,
  decisions, evidence references, optimistic revisions, supplied acceptance, and
  JSON/Markdown report export. Local namespaces do not provide authentication.
- `operational_window_compare`: compare supplied cumulative counters and per-query
  evidence across equal, nonoverlapping windows. Resets and missing evidence are
  rejected as incomparable. Optional supplied SLO thresholds remain separate from
  claims of causal improvement.
- `collect_dba_maintenance`: live SQL Server statistics/configuration/backup-history
  and PostgreSQL vacuum/analyze/configuration evidence, with collection gaps shown.

Still outstanding for the broader DBA/consultant scope: automated isolated restore
qualification, complete backup-chain verification, full deadlock/wait incident
timelines, authenticated customer isolation, MySQL/MariaDB live qualification,
TempDB/InnoDB/replication maintenance coverage, customer-specific ERP process
acceptance suites, and the complete approved production-change lifecycle. No
production-readiness or all-features-complete claim is made by these additions.

### Consolidated Database Engineer Brief

`database_engineer_brief` turns scoped live discovery into a compact review with
catalog counts, security evidence, native index candidates, and an optional native
query plan. Each section identifies its source, limitations, and detail tool.
Next steps are tied to observed findings and list prerequisites before changes.
Missing collectors and unsupported capabilities remain explicit; there are no
invented health scores, savings, or automatic remediation. Lists are capped at
20 items with totals and truncation flags. SQL Server/PostgreSQL provide catalog
and security sections; index reviews and optional plans currently target SQLite,
MySQL, and MariaDB. Index checks reuse the same captured catalog. Other collectors
run sequentially, not in one atomic snapshot. AI interpretation comes from Codex,
not a hidden external LLM service.

### Native Plans For Additional Engines

`duplicate_index_review` groups SQLite/MySQL/MariaDB indexes by observed full-key
structure, including order, direction, and SQLite collation. It excludes unique,
partial, expression, prefix, and incompletely described indexes. Candidates come
with dependency, workload, and application-reference checks, never automatic
DROP SQL or invented savings. Native index visibility and storage options still
require a separate review. Tests cover actual SQLite duplicate indexes and
MySQL/MariaDB catalog fixtures.

`compare_native_plans` compares two native plan observations for identical SQL,
engine, database, and profile. It returns canonical plan fingerprints, positional
differences, and stale-evidence warnings. An actual SQLite index addition is
covered by the test suite. Plan changes never constitute measured performance
improvement or regression, and profile labels are not server attestations.

`foreign_key_index_review` checks SQLite/MySQL/MariaDB discovery results for
full-column indexes whose leading columns match child foreign-key columns in
order. It preserves schema/table identity and reports skipped partial, expression,
prefix, or incompletely described indexes. Findings are metadata evidence, not
performance measurements or index-creation approval; no DDL is generated.

`native_query_plan` exposes SQLite EXPLAIN QUERY PLAN and native MySQL/MariaDB
EXPLAIN through scoped live connections. It returns the database's plan without
executing the workload or inventing improvement percentages. SQLite uses the
read-only file adapter. MySQL/MariaDB require verified TLS and support a narrow
base-table SELECT grammar (columns or `*`, optional LIMIT up to 1000), not joins,
predicates, expressions, or views. Rejected SQL never falls back to execution.
SQLite is tested with a real database; MySQL/MariaDB adapter behavior is covered
by driver tests but still awaits live-server qualification.

### Evidence-Aware Schema Comparison

`schema_contract_check` adds a deployment-review contract over discovery
observations: required objects, protected objects, expected changes, and evidence
age limits. Its review fingerprint binds exact snapshots and contract rules;
changed evidence invalidates a supplied fingerprint. Protected objects cannot be
overridden by expected changes. Incomplete or stale evidence is explicit. The
tool never grants deployment approval, and user-supplied evidence is not treated
as independently attested. Business-result verification remains a separate step.

`compare_live_schemas` collects two explicit connection scopes (`before` and
`after`) and compares their visible catalog objects. `compare_database_snapshots`
compares existing discovery results without connecting. Both require matching
engines, reject duplicate identities, preserve index-column ordering, and ignore
JSON key order. One-sided objects remain unconfirmed when coverage is incomplete.
Changed observations can include statistics, not just DDL. Neither command
generates migration SQL or authorizes changes. Live collection is sequential,
not an atomic cross-database snapshot. Tests include a real SQLite comparison.

`discover_database`, `database_capabilities`, and `database_security_findings`
require an explicit engine, database, and configured live connection. They expose
visible metadata, adapter capabilities, and security evidence without permitting
database changes. Coverage and limitations are returned explicitly; missing
findings never certify health or compliance.

SQL Server and PostgreSQL provide catalog and security collectors. SQLite provides
read-only metadata inspection of an existing absolute file path. MySQL/MariaDB
provide catalog inspection over verified TLS, but security auditing is currently
unsupported. Their integration does not enable legacy tuning or migration tools.
See the main advisor skill for environment configuration.

Local verification: 279 tests passed, including an actual SQLite fixture and
scope-rejection tests. All three inspection commands were exercised against local
SQL Server and PostgreSQL. MySQL/MariaDB have not been live-qualified. A preexisting
legacy audit/replay mismatch prevented use of the default local state; live checks
used a separate temporary state directory without modifying the original records.
These changes have not been uploaded to the existing OpenAI portal draft.

Aivana Database Engineer is a Codex plugin by [Aivana GmbH](https://www.aivana-gmbh.ai)
for safety-governed SQL Server and PostgreSQL
analysis, performance diagnostics, migration planning, and policy-controlled
database operations.

**Evidence-driven database engineering inside Codex.**

The technical package ID remains `sqlserver-postgres-performance-advisor` for
installation compatibility. Earlier project material may refer to CodexDB Agent.

The plugin is designed as an advisor and governed operations layer. It is not a
replacement for SSMS, DataGrip, dbForge, SSDT, Redgate SQL Prompt, SQL Sentry,
or other IDE and monitoring suites. It focuses on deterministic Codex skills,
evidence packages, policy gates, rollback planning, and repeatable database
operations.

## What It Provides

- ERP/CRM evidence analysis: 13 vendor review profiles and 43 scoped checks with
  diagnostic counts, provenance, freshness and explicit evidence gaps. See
  [ERP/CRM analysis](ERP_CRM_ANALYSIS.md), including diagnostic imports and optional
  read-only Dataverse trace and Salesforce query-plan API collection.

- SQL Server and PostgreSQL metadata discovery.
- Query, plan, wait, lock, index, replication, and workload analysis.
- Policy-gated migration, rollback, index, partitioning, and optimization flows.
- Production readiness checks, signed migration artifacts, audit records, and
  replay support.
- Advisor workflows for SLO impact, release readiness, incident analysis,
  workload impact, cost-performance tradeoffs, and governed self-healing.
- Disruptive AI cognitive control plane for strategy synthesis, prompt risk,
  trust scoring, knowledge gaps, semantic incident prediction, multi-agent
  consensus, and executive ROI narratives.
- Enterprise proof USPs for live evidence smoke profiles, formal contracts,
  governance proof packets, measured ROI, pilot success packs, visual executive
  reports, zero-autonomous-write security proof, and competitive battlecards.
- Marketplace-ready Codex skills under `skills/`.

## Plugin Layout

```text
.codex-plugin/plugin.json
skills/
runtime/
scripts/
tests/
.env.example
README.md
MARKETING.md
LICENSE
SECURITY.md
PRIVACY.md
CONTRIBUTING.md
SUPPORT.md
MARKETPLACE.md
```

The repository root also contains `.codex-plugin/plugin.json`, because the
marketplace scanner expects the required manifest at the submitted artifact
root. The plugin keeps a compact marketplace skill set to stay within the
128-file scan limit; executable runtime tools are declared in
`runtime/tool-manifest.json`.

## Installation

Node.js 22.16 or newer is required for transactional SQLite state. Windows
Integrated Authentication uses the optional `msnodesqlv8` package and Microsoft
ODBC Driver 18; SQL/password authentication keeps using the portable driver.
Requests naming a database must match the database of the selected connection
profile. Mismatches and unsupported engines fail before workload analysis.

Maintainers can build a standalone candidate with `npm run release:package`.
The `dist/` archive includes the plugin manifest and dependency lockfile, excludes
local state and secrets, and has a SHA-256 sidecar. Extract it before installation;
it is a distribution archive, not a claim of public marketplace approval.

`npm run release:qualify` verifies extraction, clean dependency installation and
runtime invocation. From the repository checkout, set `CODEXDB_CODEX_CLI` to a
Codex executable and add `-- --require-codex` to verify install and update in a
disposable isolated profile. Optional `--live-sqlserver --live-postgres` flags use
configured database credentials for session cleanup and a read-only synthetic
benchmark fixture. The report is written to `dist/qualification.json`. No customer
data or database objects are changed by that fixture. Hosted CI runs the offline
qualification on Windows/Linux and Node 22/24; it does not claim external tenant coverage.

Install dependencies from the plugin directory:

```bash
npm ci
```

Run the test suite:

```bash
npm test
```

Run the readiness report:

```bash
npm run readiness
```

Run the strict production gate:

```bash
npm run readiness:strict
```

## Marketplace Installation

From a local checkout, register the repository marketplace with the Codex CLI:

```bash
codex plugin marketplace add /absolute/path/to/SQLSERVER-POSTGRES-Plugin
codex plugin add sqlserver-postgres-performance-advisor@sqlserver-postgres-plugin-marketplace
```

Use the actual absolute checkout path, then start a new Codex task to load the
installed skills. Dependency installation is a separate prerequisite; the plugin
does not automatically install Node.js or database drivers. Repository for review:

```text
https://github.com/rweisssieker-xp/SQLSERVER-POSTGRES-Plugin/tree/master/plugins/sqlserver-postgres-performance-advisor
```

## Runtime Usage

Run commands from the installed plugin directory. Codex should resolve that
directory from the selected skill's absolute path, not the user's working directory.
The AI reasoning is provided by Codex; this runtime needs no separate LLM API key.
Database authentication remains necessary for live connections. Most advanced
advisor tools are deterministic analyses or simulations, not trained predictive models.
Keep `source: mock` and estimated results distinct from measured live evidence.

For Windows-safe SQL quoting, pipe a JSON object to `runTool.js <tool> -`.
Environment files are not loaded automatically; Node 22/24 can load a private file
with `node --env-file=/absolute/private/path/.env runtime/runTool.js ...`.
Set `CODEXDB_STATE_DIR` to an external writable directory to preserve advisor
history across plugin upgrades. Audit and memory writes use SQLite transactions
in `runtime-state.json.sqlite`. Use a local disk, stop older runtime versions
before upgrading, and retain a backup of legacy state. Valid JSON/JSONL history
is imported once without deleting the original files; damaged or unmatched audit
history fails explicitly. `audit_integrity_check` verifies storage and chain
ordering, but does not claim cryptographic tamper protection.

Run a tool directly:

```bash
node runtime/runTool.js list_databases '{"engine":"postgres"}'
```

Run a production readiness check:

```bash
node runtime/runTool.js production_readiness_check '{"environment":"production","engine":"postgres"}'
```

Run an advisor workflow:

```bash
node runtime/runTool.js sql_performance_advisor '{"engine":"postgres","database":"analytics","sql":"SELECT * FROM orders"}'
```

Run an enterprise AI USP smoke scenario:

```bash
node runtime/runTool.js llm_prompt_risk_auditor '{"prompt":"Fix production by dropping slow indexes and update all customers","environment":"production"}'
```

Release contracts for the disruptive autonomous and AI USP layers are
declared in `runtime/tool-contracts.json`. Demo-ready enterprise scenarios are
declared in `demos/enterprise-ai-usp-scenarios.json`, with curated killer-demo
scripts in `demos/KILLER_DEMOS.md` and sales guidance in
`demos/SALES_PLAYBOOK.md`. Launch-ready positioning, buyer personas, USP
matrix, competitive framing, marketplace copy, and landing-page copy are
available in `MARKETING.md`.

## Production Configuration

For production use, configure real database connectivity and signing outside
source control:

```bash
CODEXDB_DEFAULT_ENV=production
CODEXDB_REQUIRE_LIVE_CONNECTION=true
CODEXDB_MIGRATION_SIGNING_KEY=<hmac-secret>
```

Optional connector settings are documented in `.env.example`.

If `CODEXDB_REQUIRE_LIVE_CONNECTION=true` is enabled, the runtime blocks silent
mock fallbacks. Missing drivers, secrets, or connection data produce an explicit
readiness failure instead of a false-positive success.

## Safety Model

- Low-risk read workflows may run automatically.
- Medium-risk actions require human approval.
- High-risk actions are blocked by policy.
- Critical actions are sandbox-only.
- Write-like flows default to dry-run behavior where applicable.
- Dangerous SQL patterns are rejected before adapter execution in normal
  query/simulation paths.

Migration-like tools produce or validate rollback plans, safety checks,
execution metadata, and migration signing artifacts.

## Key Runtime Files

- `runtime/orchestrator.js`: deterministic tool dispatcher.
- `runtime/policyEngine.js`: policy decisions and production controls.
- `runtime/riskEngine.js`: risk classification.
- `runtime/sqlSafety.js`: SQL safety checks.
- `runtime/db/`: SQL Server and PostgreSQL adapters.
- `runtime/tool-manifest.json`: tool catalog.
- `scripts/plugin-readiness-report.js`: release readiness report.

## Main Tool Areas

- Inventory: `list_databases`, `list_tables`, `describe_table`,
  `describe_relationships`.
- Query analysis: `explain_query`, `query_stats`, `plan_deep_diagnostics`,
  `plan_diff_intelligence`, `query_plan_narrator`.
- Performance: `wait_event_root_cause`, `lock_analysis`, `deadlock_simulator`,
  `index_usage`, `index_roi_simulator`, `statistics_health_doctor`.
- Migration: `propose_migration`, `rollback_migration`,
  `ai_migration_risk_radar`, `migration_twin_simulator`,
  `rollback_rehearsal_engine`.
- Governance: `classify_risk`, `audit_query`, `enforce_policy`,
  `validate_compliance`, `production_readiness_check`.
- Operations: `release_readiness_report`, `run_health_assessment`,
  `incident_analysis`, `fleet_health_scorecard`, `sql_performance_advisor`.
- Closed-loop autonomous operator: `objective_to_ops_plan`,
  `autonomous_experiment_planner`, `counterfactual_risk_engine`,
  `decision_evidence_compiler`, `next_best_safe_action`,
  `autonomous_ops_briefing`.
- AI cognitive control plane: `ai_strategy_synthesizer`,
  `cognitive_schema_mapper`, `llm_prompt_risk_auditor`,
  `ai_decision_simulator`, `autonomous_learning_backlog`,
  `knowledge_gap_detector`, `ai_trust_scorecard`,
  `semantic_incident_predictor`, `cross_agent_consensus_builder`,
  `ai_roi_narrative_generator`.
- Enterprise proof layer: `live_evidence_smoke_profile`,
  `formal_contract_catalog`, `governance_proof_packet`,
  `benchmark_roi_proof`, `pilot_success_pack`, `visual_executive_report`,
  `enterprise_security_proof`, `competitive_battlecards`.

See `runtime/tool-manifest.json` for the full tool list.
# Workload Regression Guard

Publisher: Aivana GmbH. User-supplied company website: https://www.aivana-gmbh.ai.
Privacy and terms URLs still require verified published pages; repository license
terms are not a substitute for a product privacy notice.

`workload_regression_guard` checks paired benchmark cases as well as aggregate
p95. It flags individual slowdowns that an overall improvement can hide, while
preserving result-equivalence, freshness and system-scope validation. Inputs are
`before` and `after` in the `benchmark_evidence_compare` format; optional
`maxCaseRegressionPct` (default 10) and `noiseFloorMs` (default 1) set the review
thresholds. Output includes ranked regressions, aggregate masking and the next
verification action. This is deterministic evidence checking for Codex reasoning,
not an independent AI model, statistical proof or authorization to deploy.

Optional `caseBudgets` assigns business-process deadlines to measured case IDs:
`[{"caseId":"case-0","businessProcess":"Order posting","maxDurationMs":100}]`.
Absolute breaches take precedence over relative gains and noise thresholds.
The guard reports existing/new breaches, missing budget coverage and a policy
fingerprint. These supplied single-case measurements do not certify an end-to-end
business SLO; deadlines must match what each benchmark actually measures.

## Evidence-driven advisory lifecycle

`next_evidence_test` ranks proposed diagnostic tests by worst-case hypothesis
reduction under an explicitly supplied outcome model, then by estimated time.
It excludes write proposals, missing evidence prerequisites and proposals exceeding
`maxEstimatedMinutes` (default 30). Each possible outcome lists compatible hypotheses;
models omitting a hypothesis are rejected. Outputs explain remaining hypotheses,
blockers and what to do with unexpected outcomes. This supports Codex's reasoning;
it neither measures information gain nor executes or authorizes the selected test.
The main advisor skill documents its input fields.

Start with `advisor_workflow` (`action: start`, scope and objective), then resume
by case ID. The returned next step uses validated `advisory_case` transitions;
it does not collect data or approve changes unattended. The main advisor skill
uses this path; legacy heuristic simulators are reserved for requested exploration.

Case contract v2 requires `workloadId`, SHA256 `customizationHash` and an agreed
`businessContract` before approval. The contract fixes `definitionHash`, `period`,
`deployment`, and the complete expected `groups` (company/currency/unit/metric).
Verification and follow-up require `businessControls` as well as `measurements`.
The controls' `snapshotHash` must match benchmark `datasetHash`. Missing groups,
wrong definitions and failed controls prevent confirmed closure, even when faster.
Legacy proposals without a contract must start a new case; old history is preserved.

`causal_evidence_review` resolves supporting/refuting event references across
application, integration and database layers using matching trace IDs and temporal
overlap. It exposes conflicts and missing alternatives, never a proven root cause.
Inputs and examples are specified in the ERP advisor skill.

`advisory_case` with `action: find_confirmed` searches only the exact system/version,
workload and customization hash. It returns up to ten technically and business-
verified cases from the latest 1000 scoped records, with evidence fingerprints.
No match does not trigger cross-tenant or cross-version fallback.

`business_reconciliation_compare` checks exact decimal totals and row counts per
company/currency/unit/metric. It rejects missing or unexpected groups and mismatched
system, period, snapshot or control definitions. Equal overall totals cannot hide
offsetting group errors. Both exports need ERP scope, `period`, matching SHA256
`snapshotHash`/`definitionHash`, distinct `exportId`, fresh `capturedAt` and `controls`:
`[{"companyId":"DE01","currency":"EUR","unit":"money","metric":"net_sales","amount":"1234.56","rowCount":20}]`.
Amounts must be plain decimal strings, not JavaScript numbers or scientific notation.
No exchange-rate conversion, implicit rounding or production approval is performed.
Matching aggregates complement, but do not replace, row-level correctness checks.

`advisory_case` persists scoped cases with revision conflict checks, hypotheses,
proposal/rollback/test plans, a recorded human test-approval reference, verification,
later follow-up, and reviewed outcomes. It never executes changes or authenticates
approvals. See `skills/erp-crm-advisor/SKILL.md` for actions and input fields.

`repeated_benchmark_review` accepts 3-30 chronological `repetitions`, each with
`before`/`after` benchmark runs and globally unique run IDs. Supply `sampling` with
`warmupIterations`, `executionOrder` (`alternating` or `randomized`) and
`collectionRef`. Workload/data/parameters/concurrency must remain comparable.
All repetitions must pass correctness and regression checks and meet the supplied
`minImprovementPct` (default 5) for `repeatable_observed_improvement`. It reports
spread, not statistical significance. Warm-up metadata is supplied evidence.

`advisory_case` with `action: quality_report` reports confirmation, false-positive,
inconclusive and correction counts from closed cases only, scoped to system,
environment, product and version. This is review tracking, not model training.

`release_qualification_matrix` evaluates release-SHA256-bound receipts for external
launch gates. Missing receipts remain `not_run`; supplied passing receipts permit
independent review, never automatic publication. Receipts include `gate`, `status`,
`releaseHash`, `reviewer`, `evidenceRef`, `observedAt` (maximum age 30 days).

Legacy `source: analysis` tools now label heuristic evidence explicitly; their
uncalibrated confidence is exposed as `heuristicScore`, not a probability. Counterfactual
timings and keyword-derived incident probabilities are unavailable rather than
invented. ROI requires supplied hourly/incident costs and does not monetize SLO percentages.
