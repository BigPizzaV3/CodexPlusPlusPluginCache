---
name: erp-crm-advisor
description: Use when diagnosing ERP or CRM performance, integration failures, tenant isolation, reporting or customization risks using scoped evidence and explicit vendor-coverage gaps.
---

# ERP / CRM Advisor

Use when the user asks about ERP/CRM bottlenecks, vendor-specific data semantics,
integration failures, upgrades, reports, duplicate postings or tenant/company leakage.
Codex performs the interpretation; no separate LLM API key is required.

Resolve the plugin root two directories above this file. Read
`ERP_CRM_ANALYSIS.md` and `runtime/erp-crm-catalog.json` relative to that root.
Invoke its absolute `runtime/runTool.js` path; use JSON via stdin (`-`) for inputs.
Install missing dependencies with `npm ci` in the plugin root.

1. Run `erp_crm_vendor_catalog` with `{}`. Select an exact product profile; do not
   equate Dataverse with Finance and Operations or Business Central, or SAP ECC
   with S/4HANA. Obtain product release, instance ID, environment and deployment.
2. Run `erp_crm_evidence_plan` with the selected `product`. Identify installed
   modules, customizations and affected business processes. Separate application
   execution from database, API and reporting costs.
3. Inspect authorized, redacted exports and traces using available read-only
   tools. Do not invent credentials, assume native SaaS connectors, or send SOQL,
   SuiteQL, ABAP or HANA syntax to the SQL Server/PostgreSQL adapter.
   Use `erp_crm_import_diagnostics` for supported exports. For Dataverse traces or
   Salesforce query plans, use `erp_crm_collect_api` only with a configured
   provider URL, matching system ID, access token and explicit API version.
   A collector implementation is not proof that the customer's tenant was tested.
4. Build evidence bundles with matching context, trace references and actual
   observation timestamps. Populate supported numeric diagnostics from exports.
   For qualitative observations, assess the relevant code/configuration with an
   explanation tied to a trace or file reference; use `manual_review` for your
   interpretation. Never convert absent evidence into `false`, and never pretend
   a user assertion is a live measurement. Preserve provenance in the answer.
5. Run `erp_crm_risk_analyzer`. Explain prioritized findings, business impact,
   evidence, owner and next verification step. Include unresolved/conflicting
   checks and coverage of this finite catalog. Check the cited manufacturer
   guidance against the actual release before making product-specific claims.
6. For an optimization claim, run `benchmark_evidence_compare` on comparable,
   timestamped samples with case IDs, result hashes and row counts. Reject faster
   results with semantic differences or errors. Explain sampling and uncertainty;
   do not replace measured benchmarks with estimated advisor scores.
   Also run `workload_regression_guard` with the same runs to detect individual
   cases hidden by aggregate gains. Its defaults are a 10 percent per-case budget
   and a 1 ms noise floor; set these from the workload requirements. Repeat flagged
   cases under controlled load. A flag is not statistical proof or apply approval.
   Supply `caseBudgets` when the process owner provides absolute deadlines:
   `[{"caseId":"case-0","businessProcess":"Order posting","maxDurationMs":100}]`.
   Review existing as well as newly breached budgets. Unassessed cases are not
   evidence of business-SLO compliance. Preserve the returned policyHash with the
   benchmark inputHash so threshold changes remain distinguishable.

Review order-to-cash, procure-to-pay, period close and reporting where applicable:
company keys, document/line grain, status transitions, currencies/units, effective
dates, soft deletes, replication freshness and retry idempotency. Use control
totals from the business owner; a faster query that changes business meaning is
not an optimization.

Run `business_reconciliation_compare` for business control exports before accepting
an optimization. Both `before` and `after` require the full ERP scope, matching
`period`, `snapshotHash` and `definitionHash` (SHA256), distinct `exportId`, fresh
`capturedAt`, and nonempty `controls`. Each control has `companyId`, `currency`,
`unit`, `metric`, `amount` as an exact decimal string, and integer `rowCount`.
Use an explicitly agreed unit/currency label for nonmonetary metrics. Never invent
hashes, totals or counts. Missing groups are not zero. A matched result proves only
the supplied aggregate controls, not row-level equivalence; retain result-hash checks.

Analysis tools do not execute corrections. Do not modify vendor-managed tables,
indexes, permissions or production application data as part of this workflow.
Prepare supported remediation and before/after verification for authorized work.
No result establishes exhaustive coverage, vendor certification or compliance.

## Persistent advisory cases

Use `advisory_case` for a tracked engagement. Every call requires `systemId`,
`environment`, `product`, and `productVersion`. Create with `action: create` and
`objective`; later calls need `caseId` and mutations need `expectedRevision` from
the last read. Follow this sequence:

- `diagnose`: `hypothesis`, `evidenceRefs` (references are not attested facts).
- `propose`: `change`, `rollback`, `testPlan`, `workloadId`, `customizationHash`
  (SHA256 of the agreed customization inventory), and `businessContract` with
  `definitionHash`, `period`, `deployment`, and `groups`. Each group has `companyId`,
  `currency`, `unit`, `metric`. All expected groups must be agreed before approval;
  do not derive the expected set solely from a potentially incomplete candidate.
- `approve_test`: matching `proposalHash`, `reviewer`, `approvalRef`, `approvedAt`
  (timestamp within seven days) from an actual
  user approval. Never invent approval. This records a statement, not authenticated
  authorization, and executes nothing.
- `verify`, then `follow_up`: matching `proposalHash`, `measurements` for
  `repeated_benchmark_review`, and `businessControls` for `business_reconciliation_compare`.
  Control scope, period, definition and exact group set must match the approved
  contract; `snapshotHash` must equal the benchmark `datasetHash`. Follow-up controls
  must be newer. Missing controls cannot be waived by passing performance results.
  Measurements must not predate the recorded test approval.
  Each run must include the full case scope. Follow-up must use newer measurements,
  the same workload and thresholds. A verified state means evidence was assessed,
  not that an improvement succeeded; inspect its decision.
- `close`: `outcome` (`confirmed`, `false_positive`, `inconclusive`), `corrected`
  boolean, `reviewer`, `note`. Confirmation requires technical and business checks
  to pass at both stages. Old proposals without contracts require a new case.

Use `read` to resume, and `quality_report` to aggregate reviewed cases within the
exact same scope/version. Neither reviews nor local storage authenticate a tenant;
use separate OS-protected state directories for different trust boundaries.

Use `find_confirmed` with `workloadId` and `customizationHash` for up to ten relevant
confirmed cases. Search is limited to the latest 1000 cases in the exact scope;
legacy cases without business checks are excluded. Returned cases are examples
for review, not automatic optimization instructions.

Optional `causalEvidence` on `diagnose` is validated by `causal_evidence_review`:
`events` contain the four case-scope fields, `id`, `traceId`, `layer` (application,
integration, database), `startedAt`, `durationMs`, `evidenceRef`. `hypotheses` contain
`id`, `claim`, `supportRefs`, `refuteRefs`. References must resolve; stale or wrong-scope
events are rejected. Report contradictions and unresolved alternatives explicitly.
