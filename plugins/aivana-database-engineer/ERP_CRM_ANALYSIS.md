# ERP / CRM Evidence Analysis

The plugin provides 13 explicit review profiles, 43 catalog checks, diagnostic
import and optional read-only API collection. It analyzes diagnostic counts and structured assessments.
Codex can interpret authorized traces, code and configuration into assessments;
the runtime validates scope and evaluates those assessments deterministically.
It does not automatically discover every vendor-specific defect or certify an
installation. API collectors currently cover Dataverse plug-in traces and
Salesforce query plans only; other products use evidence imports. Existing SQL Server/PostgreSQL
drivers do not add Oracle Database or SAP HANA support.

## Product Scope

| Product ID | Review context | Evidence entry point |
| --- | --- | --- |
| sap-s4hana | Custom-code migration and SQL usage | ATC, SQL Monitor |
| dynamics-dataverse | Read-only TDS, synchronous plug-in work | TDS, plug-in traces |
| dynamics-finance-operations | Entity logic and batch contention | Data entity and batch history |
| business-central | Extension SQL and repeated calculations | AL and Application Insights |
| salesforce | SOQL selectivity and soft-delete effects | Query Plan and debug logs |
| oracle-fusion | Integration loops and import reconciliation | Integration execution history |
| netsuite | SuiteQL dialect and projection | SuiteQL and script diagnostics |
| odoo | Company context and ORM/record rules | Profiler and company/role context |
| infor-ion | Gateway throttling | ION API policy and logs |
| sage-intacct | XML business failures | Web Services responses |
| workday | Versioned API contracts | WSDL/API metadata |
| hubspot | Association request fan-out | API and association diagnostics |
| servicenow | Slow business-rule queries | Slow query and transaction logs |

Each profile also applies 22 cross-product checks: tenant leakage, unsupported
business-table writes, duplicate posting, missing deltas, backoff violations,
N+1 access, batch interference, replica freshness, join double-counting, currency
and unit semantics, effective dates, missing deletes, upgrade regressions,
privileged exports, sensitive telemetry, deadlocks, unbounded extraction,
reconciliation, period-close contention, business-key collisions, application
SLO violations and observed API throttling.

Products and modules not listed here, including SAP ECC, Oracle EBS/Siebel and
other Sage editions, are not silently treated as equivalent to these profiles.
Add explicit profiles and qualified evidence mappings before claiming support.

## Workflow

From the installed plugin directory:

```powershell
'{}' | node runtime/runTool.js erp_crm_vendor_catalog -
'{"product":"dynamics-dataverse"}' | node runtime/runTool.js erp_crm_evidence_plan -
```

For a risk assessment, supply a JSON object like this via stdin to
`node runtime/runTool.js erp_crm_risk_analyzer -`:

```json
{
  "product": "dynamics-dataverse",
  "productVersion": "9.2",
  "systemId": "crm-prod",
  "environment": "production",
  "deployment": "saas",
  "maxEvidenceAgeHours": 168,
  "evidence": [{
    "product": "dynamics-dataverse",
    "productVersion": "9.2",
    "systemId": "crm-prod",
    "environment": "production",
    "deployment": "saas",
    "ref": "redacted-trace-001",
    "sourceType": "telemetry_export",
    "observedAt": "2026-09-12T00:00:00Z",
    "metrics": { "deadlockCount": 3, "duplicatePostingCount": 2 },
    "observations": { "tdsWriteAttempt": true }
  }]
}
```

This is synthetic example data, not a measurement. Use actual evidence context
and timestamps. Allowed deployments are `saas`, `on_premises`, `private_cloud`.
Accepted source types are `telemetry_export`, `application_trace`, `query_plan`,
`configuration_review`, `manual_review`. References must be short opaque labels,
not credentials, connection strings or customer data. Raw payloads are not needed.

The evidence plan lists valid signals and numeric metrics. Counts must be finite,
nonnegative integers; a count greater than zero produces its associated indicator.
Qualitative observations must be booleans: `true` means an observed risk indicator,
`false` means reviewed and not observed. Missing signals stay unassessed.
All five context fields must match. The default freshness window is seven days,
an analysis setting rather than a manufacturer limit. Conflicting evidence stays
unresolved. Invalid bundles include rejection reasons and do not produce findings.

Results contain prioritized findings, measurements and references, evidence gaps,
owners, next verification steps and coverage. Even 100% coverage only means all
applicable catalog checks received unambiguous observations; it is not a health,
security or compliance certificate. Findings are not proof of root cause.

## Diagnostic Imports And API Collection

`erp_crm_import_diagnostics` accepts the same product/system context as the risk
analyzer plus `format` and a structured `data` object:

- `normalized_events`: `{ "records": [...] }`, with `systemId`, ISO `timestamp`
  and `eventType` on each row. Types: `deadlock`, `duplicate_posting`,
  `missing_delta`, `tenant_violation`, `reconciliation_mismatch`,
  `business_key_collision`, or `http`. HTTP events need integer `statusCode`;
  retry comparisons additionally require `retryAfterMs` and `retryDelayMs`.
- `azure_monitor`: native `{ "tables": [...] }` query response with `PrimaryResult`,
  `columns` and `rows`. Project `systemId`, `TimeGenerated`, `eventType` and the
  HTTP fields above in KQL. Partial-error responses are rejected.
- `dataverse_plugin_trace`: native `{ "value": [...] }` with `createdon` and
  `performanceexecutionduration`. Supply your application's positive `sloMs`.
  Slow execution alone does not prove database root cause or a synchronous chain.
- `salesforce_query_plan`: native `{ "plans": [...] }` with `relativeCost`,
  Salesforce product context and `observedAt`. The lowest-cost available plan
  is compared to the optimizer's relative-cost threshold, not an invented SQL index rule.

Imports return evidence bundles, a SHA-256 export fingerprint, sample boundaries
and an assessment. Raw payloads are omitted from the output and audit input.
Unknown event types fail explicitly. An empty export does not clear any checks.
Counts describe supplied events; collectors do not claim a complete event census.

`erp_crm_collect_api` uses GET only, rejects redirects and cross-origin pagination,
limits response sizes/page counts and uses request timeouts. Configure the
provider-specific `URL`, `SYSTEM_ID` and `ACCESS_TOKEN` variables in `.env.example`.
These are manufacturer OAuth credentials, not an LLM key. Tokens are never returned.
Provide complete context and an explicit `apiVersion`; Dataverse also needs `sloMs`,
Salesforce needs a SELECT `soql` whose query plan is requested without executing it.
Commercial `.dynamics.com` and `.salesforce.com` origins are supported; sovereign
cloud/custom-domain origins require an explicitly qualified adapter extension.
Real customer-tenant authentication and permission tests remain deployment work.

## Benchmark Evidence

Use `benchmark_evidence_compare` with `before` and `after` runs. Each run needs
distinct `runId`, ISO `capturedAt` within seven days, `systemId`, `workloadId`,
`datasetHash`, `parameterSetHash`, `engine`, positive integer `concurrency`, and
at least ten `samples` by default. Each sample needs unique `caseId`, nonnegative
`durationMs`, integer `rowCount`, SHA-256 `resultHash`, and boolean `error`.
Use stable result canonicalization and identical case IDs on both runs.

Workload, dataset, parameter set, system, engine and concurrency must match.
P50/P95 use nearest-rank percentiles. The default observed p95 regression budget
is 5%, configurable with `maxRegressionPct`. Correctness mismatches and execution
errors reject a candidate even when it is faster. Results are descriptive sample
comparisons, not statistical significance or production-wide ROI claims.

## Manufacturer References

Reference review date: 2026-09-12. The catalog stores product-specific source URLs.
These sources establish the supported review context; the cross-product checks
are general engineering checks, not claimed manufacturer mandates.

- [Dataverse TDS](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/dataverse-sql-query): SQL access is read-only.
- [Dataverse API protection](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/api-limits): use actual response telemetry and limits.
- [SAP ATC and SQL Monitor](https://help.sap.com/docs/ABAP_PLATFORM_NEW/a24970c68fcf4770a64bf9a78e3719e2/2b99ce231e7e45e6a365608d63424336.html): correlate static findings with runtime usage.
- [Salesforce optimizer](https://developer.salesforce.com/blogs/engineering/2013/07/maximizing-the-performance-of-force-com-soql-reports-and-list-views): historical guidance on selectivity and soft deletes; verify current release behavior.
- [NetSuite SuiteQL](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0824094533.html): review syntax and query shape against SuiteQL support.
- [Odoo multi-company](https://www.odoo.com/documentation/18.0/developer/howtos/company.html): version 18 guidance; qualify other releases separately.
- [Sage error handling](https://developer.intacct.com/web-services/error-handling/): distinguish response error layers and rate-limit handling.
- [Workday versioned APIs](https://community-content.workday.com/en-us/public/products/platform-and-product-extensions/soap-api-reference.html): bind integrations to the actual API version.

Provider limits, hosting permissions, extensions and service plans vary. This
release deliberately does not hard-code universal tenant limits or recommend
automatic DDL changes on vendor-owned databases.
