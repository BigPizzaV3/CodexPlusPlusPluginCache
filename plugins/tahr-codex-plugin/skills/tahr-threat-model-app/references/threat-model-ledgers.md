# Threat Model Data Contract

Use `assets/threat-model.schema.json` as the authoritative structure and
`assets/threat-model.template.json` as the starting artifact. Keep one
canonical `threat-model.json`; render summaries and plans from it.

## Contents

- [Stable identifiers](#stable-identifiers)
- [Exact enums](#exact-enums)
- [Evidence and claims](#evidence-and-claims)
- [Model relationships](#model-relationships)
- [Risk, response, and ownership](#risk-response-and-ownership)
- [Validation tests](#validation-tests)
- [Coverage and completeness](#coverage-and-completeness)

## Stable identifiers

Use these prefixes and never reuse an ID for another record:

| Record | Prefix |
|---|---|
| Evidence | `EVD-` |
| Actor | `ACTOR-` |
| Service or system principal | `PRINCIPAL-` |
| Asset | `ASSET-` |
| Component | `COMP-` |
| Entrypoint | `ENTRYPOINT-` |
| Trust zone | `ZONE-` |
| Data store | `STORE-` |
| Integration | `INTEGRATION-` |
| Boundary | `BOUNDARY-` |
| Flow | `FLOW-` |
| Invariant | `INV-` |
| Control | `CONTROL-` |
| Threat | `THREAT-` |
| Attack path | `PATH-` |
| Decision | `DEC-` |
| Validation test | `TEST-` |
| Coverage item | `COV-` |
| Open question | `Q-` |
| Claim | `CLAIM-` |
| Flow hop | `HOP-` |
| Decision option | `OPTION-` |
| Validation signal | `SIGNAL-` |
| Privacy data category | `DATA-` |
| Privacy or AI analysis item | `ANALYSIS-` |
| Quality gate | `GATE-` |
| Independent challenge finding | `QF-` |

## Exact enums

These are the complete authoring vocabularies. Do not improvise a near-synonym;
use `other` where the schema provides it and explain the choice in the record.

- Review mode: `full`; scope target: `entire_application`.
- Model status: `complete`, `incomplete_high_risk_coverage`.
- Assurance status: `source_observed`, `partially_runtime_validated`,
  `runtime_validated`.
- Runtime authorization: `not_authorized`, `requires_authorization`,
  `authorized`.
- Evidence class: `observed`, `intended`, `inferred`, `unknown`.
- Evidence source type: `source_code`, `configuration`,
  `infrastructure_as_code`, `repository_manifest`, `api_specification`,
  `design_document`, `diagram`, `role_matrix`, `policy`,
  `runtime_observation`, `test_result`, `interview`, `unknown`.
- Confidence or evidence reliability: `low`, `medium`, `high`.
- Entity type: `actor`, `asset`, `component`, `trust_zone`, `data_store`,
  `integration`, `entrypoint`, `principal`.
- Entity criticality: `low`, `medium`, `high`, `critical`.
- Data classification: `none`, `public`, `internal`, `confidential`,
  `restricted`, `unknown`.
- Trust level: `untrusted`, `partially_trusted`, `trusted`, `privileged`,
  `unknown`.
- Boundary direction: `unidirectional`, `bidirectional`.
- Flow security-decision type: `authentication`, `authorization`, `ownership`,
  `tenant_scope`, `role_policy`, `validation`, `serialization`,
  `rate_or_usage`.
- Invariant status: `implemented`, `partial`, `assumed`, `missing`, `unknown`.
- Control category: `authentication`, `authorization`, `tenant_isolation`,
  `ownership`, `input_validation`, `serialization`, `queue_security`,
  `network_security`, `least_privilege`, `data_protection`,
  `logging_and_audit`, `retention`, `rate_and_usage_control`, `privacy`,
  `supply_chain`, `other`.
- Control implementation status: `observed`, `intended`, `assumed`, `partial`,
  `missing`, `unknown`.
- Likelihood: `rare`, `unlikely`, `possible`, `likely`, `almost_certain`.
- Impact: `negligible`, `minor`, `moderate`, `major`, `severe`; risk rating:
  `low`, `medium`, `high`, `critical`.
- Exposure: `internet`, `private_network`, `local`, `third_party`, `unknown`.
- Required privilege: `none`, `authenticated_user`, `privileged_user`,
  `service_access`, `code_execution`, `unknown`.
- Attacker complexity: `low`, `medium`, `high`, `unknown`; user interaction:
  `none`, `required`, `unknown`; asset sensitivity: `low`, `medium`, `high`,
  `critical`, `unknown`; tenant reach: `single_tenant`, `cross_tenant`,
  `all_tenants`, `unknown`.
- Threat status: `modeled`, `validation_required`, `accepted`, `rejected`;
  attack-path status: `complete`, `conditional`, `rejected`.
- Response strategy: `mitigate`, `accept`, `eliminate`, `transfer`,
  `investigate`; response priority: `p0`, `p1`, `p2`, `p3`; response status:
  `proposed`, `planned`, `in_progress`, `implemented`, `accepted`, `deferred`.
- Decision status: `proposed`, `approved`, `in_progress`, `implemented`,
  `accepted`, `blocked`.
- Signal type: `http_response`, `authorization_decision`, `database_trace`,
  `queue_event`, `object_store_event`, `audit_event`, `metric`, `log`,
  `state_inspection`, `other`.
- Test execution: `planned`, `passed`, `failed`, `inconclusive`, `blocked`;
  result outcome: `control_held`, `control_failed`, `inconclusive`.
- Coverage category: `entrypoint`, `authentication`, `authorization`, `asset`,
  `boundary`, `flow`, `integration`, `worker`, `admin_surface`,
  `deployment_zone`, `security_decision`, `data_store`, `privacy`, `control`,
  `other`.
- Coverage status: `reviewed`, `reviewed_no_issue`, `out_of_scope`,
  `deferred_with_specific_reason`, `pending`; risk if unread: `low`, `medium`,
  `high`, `critical`.
- Question priority: `p0`, `p1`, `p2`, `p3`; question status: `open`,
  `answered`, `deferred`.
- Analysis status: `not_applicable`, `reviewed_no_issue`, `risk_identified`,
  `unknown`; privacy classification: `personal`, `sensitive`, `regulated`,
  `confidential`, `unknown`.
- Quality status: `pass`, `fail`, `incomplete`; challenge severity: `critical`,
  `high`, `medium`, `low`; challenge status: `open`, `resolved`, `dismissed`;
  gate status: `passed`, `failed`, `incomplete`, `not_applicable`.
- Quality gate: `scope_and_evidence`, `architecture_inventory`,
  `flow_completeness`, `contradiction`, `material_threat`, `attack_path`,
  `risk_ranking`, `privacy_applicability`, `ai_applicability`,
  `validation_safety`, `coverage`.

Use one enum value per field. When part of a claim is observed and another part
is unknown, create two claims instead of writing `observed/unknown`.

Use `partially_runtime_validated` only when at least one authorized test ran
and has runtime or test-result evidence. Use `runtime_validated` only when all
required validation tests ended conclusively as `passed` or `failed`.

## Evidence and claims

Give each material claim its own evidence class, confidence, and evidence
references. An `observed` claim must cite current source, configuration, IaC,
or authorized runtime evidence. An `intended` claim must cite a document,
specification, diagram, policy, or requirement. Use `unknown` for an important
unresolved fact. Cite an `unknown` evidence record that names the missing
artifact or observation and how to resolve it; never invent behavioral
evidence.

Evidence references must identify a non-secret source and precise location,
such as a repository-relative path plus line/symbol, or an artifact plus JSON
pointer. Include the repository revision in metadata so references remain
meaningful.

## Model relationships

Build the graph in this order:

```text
evidence -> entity or control claim -> boundary -> flow hop
         -> invariant -> threat -> attack path
         -> decision and response -> validation test
         -> coverage and quality review
```

Require every material threat to reference actors, assets, flows, boundaries,
evidence, a decision, and a validation test. Require every attack-path step to
reference an existing flow, threat, or boundary rather than only free text.

Empty `threats`, `attack_paths`, `decisions`, `validation_tests`, and
`questions` arrays are valid when no material candidate survives. In that
case, implemented invariants and controls use empty `threat_ids` and
`validation_test_ids`; the evidence graph, manifest, coverage, and quality
review remain populated. Never add a synthetic threat to satisfy the shape.

Treat controls as first-class records. Link one control to any number of
assets, flows, and threats; do not create a combinatorial control-matrix row for
every possible tuple. Generate a matrix view only when it helps the reader.

## Risk, response, and ownership

Record risk and confidence separately. Explain exposure, required privilege,
preconditions, asset sensitivity, tenant/role reach, business impact, visible
controls, and uncertainty in the risk rationale.

For every critical or high threat, assign a response, owner, next action,
residual risk, and validation test. Use `owner: "unknown"` only when coverage
records the ownership gap and a decision assigns responsibility for resolving
it.

## Validation tests

Make the canonical signals unambiguous:

- `attacker_case.attacker_success_signal`: evidence that the modeled abuse
  succeeded.
- `attacker_case.expected_denial_signal`: evidence that the abuse was denied.
- `control_case.control_success_signal`: evidence that the expected control
  held.
- `control_case.control_failure_signal`: evidence that the expected control
  failed.

Also record a normal baseline, exact action, safe environment, required
authorization, fixtures, evidence collection, cleanup, destructive risk,
target Tahr skill, confidence, and execution status. `planned` never means the
test ran.

Interpret execution status consistently:

- `passed`: the expected invariant/control held; `result.outcome` is
  `control_held`.
- `failed`: the invariant/control failed; `result.outcome` is
  `control_failed`.
- `inconclusive`: authorized execution produced no discriminating result.
- `blocked`: execution did not run and a claim-level `blocker` explains why.

Every executed result records its time, executor, observed signal IDs, runtime
or test-result evidence, limitations, and a claim-level summary. A tool error,
missing fixture, or ambiguous signal is `inconclusive` or `blocked`, never
evidence that the target control passed or failed.

For `passed`, `result.observed_signal_ids` must contain the expected-denial and
control-success signals and no attacker-success or control-failure signal. For
`failed`, require attacker-success and control-failure and forbid the two held
signals. An `inconclusive` result cannot contain either complete conclusive
pair. Put observed `runtime_observation` or `test_result` evidence directly in
`result.evidence_ids`, and make the result-summary claim cite at least one of
those same IDs; evidence attached only to the hypothesis or another test field
does not prove the outcome.

## Coverage and completeness

Create an observed, SHA-256-bound repository manifest at the immutable
revision. Reconcile its embedded content hash and admitted paths, packages,
environments, documents, and exclusions exactly with evidence and metadata.
Use explicit empty document and exclusion arrays when none exist. Freeze every
modeled entity, boundary, flow,
invariant, control, and decision into
`coverage.inventory.expected_subject_ids`, then create at least one coverage
record for every expected subject. The validator rejects missing expected
rows, modeled subjects omitted from the inventory, and duplicate
subject/category rows.

Any critical/high `pending`, `deferred_with_specific_reason`, or `out_of_scope`
item, generic disposition, unread high-signal item, unresolved high-severity
quality finding, or broken reference forces `incomplete_high_risk_coverage`.

An `out_of_scope` record must set `scope_exclusion` to an exact declared path or
environment exclusion. Critical/high out-of-scope records also force
`incomplete_high_risk_coverage`; lower-risk exclusions remain visible assurance
limitations. Time pressure or missing access is a deferral, not a scope
exclusion.

Do not create coverage rows merely because a validation test remains `planned`.
Planned tests limit `assurance_status`; they force incomplete coverage only
when runtime validation was explicitly included in the declared review scope.
