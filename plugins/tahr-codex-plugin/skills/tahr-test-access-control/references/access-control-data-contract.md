# Access-Control Review Data Contract

Use `assets/access-control-review.schema.json` as the authoritative structure
and `assets/access-control-review.template.json` as the starting artifact. Keep
one canonical `access-control-review.json`; derive all summaries, findings,
validation plans, and coverage views from it.

## Contents

- [Stable identifiers](#stable-identifiers)
- [Exact enums](#exact-enums)
- [Scope and evidence](#scope-and-evidence)
- [Identity and resource provenance](#identity-and-resource-provenance)
- [Policy, operation, and enforcement relationships](#policy-operation-and-enforcement-relationships)
- [Matrix and validation relationships](#matrix-and-validation-relationships)
- [Candidates and findings](#candidates-and-findings)
- [Coverage and completeness](#coverage-and-completeness)
- [Quality review](#quality-review)
- [Clean-model semantics](#clean-model-semantics)

## Stable identifiers

Use these prefixes and never reuse an ID for another record:

| Record | Prefix |
|---|---|
| Evidence | `EVD-` |
| Claim | `CLAIM-` |
| Surface | `SURFACE-` |
| Identity | `IDENTITY-` |
| Resource or attributed object | `RESOURCE-` |
| Policy rule | `POLICY-` |
| Enforcement point | `ENFORCEMENT-` |
| Operation | `OP-` |
| Authorization obligation | `OBLIGATION-` |
| Identifier or property carrier | `CARRIER-` |
| Interface variant | `VARIANT-` |
| Source trace | `TRACE-` |
| Source-trace hop | `HOP-` |
| Matrix requirement | `REQUIREMENT-` |
| Matrix row | `MATRIX-` |
| Validation test | `TEST-` |
| Validation signal | `SIGNAL-` |
| Candidate | `CANDIDATE-` |
| Finding | `FINDING-` |
| Coverage item | `COV-` |
| Open question | `Q-` |
| Quality gate | `GATE-` |
| Challenge finding | `QF-` |

IDs express identity, not array position. Preserve an ID in a later review only
when it still denotes the same fact or security object. Create a new ID and
record supersession when an operation, rule, resource, or claim changes
meaning.

## Exact enums

These are the complete authoring vocabularies. Do not invent near-synonyms.
Use `other` only where listed and explain it in the record.

### Review and evidence

- `review_mode`: `full`, `focused`.
- `analysis_basis`: `source_only`, `runtime_only`, `hybrid`.
- `review_status`: `complete`, `incomplete_high_risk_coverage`.
- `assurance_status`: `source_observed`, `partially_runtime_validated`,
  `runtime_validated`.
- Runtime authorization status: `not_authorized`, `requires_authorization`,
  `authorized`.
- Runtime action class: `read_only`, `state_change`, `account_lifecycle`,
  `destructive`.
- Evidence class: `observed`, `intended`, `inferred`, `unknown`.
- Evidence `source_type`: `source_code`, `configuration`,
  `repository_manifest`, `api_specification`, `graphql_schema`,
  `design_document`, `role_matrix`, `policy`, `traffic_capture`,
  `runtime_identity_check`, `runtime_request`, `runtime_response`,
  `object_readback`, `audit_event`, `test_result`, `interview`, `unknown`.
- Confidence: `high`, `medium`, `low`.
- Risk or severity: `critical`, `high`, `medium`, `low`.
- Surface kind: `rest`, `graphql`, `rpc`, `server_action`, `web`,
  `websocket`, `job`, `worker`, `webhook`, `other`.
- Surface disposition: `operation`, `intentionally_public`,
  `not_authorization_relevant`, `deferred`, `excluded`.
- Carrier kind: `path`, `query`, `body`, `header`, `cookie`, `property`,
  `graphql`, `multipart`, `job_payload`, `other`.
- Variant kind: `method`, `content_type`, `api_version`, `route`, `parser`,
  `bulk`, `async`, `graphql`, `public`, `admin`, `other`.

### Identity and resource

- Identity verification: `source_modeled`, `runtime_verified_portable`,
  `runtime_verified_browser_bound`, `coverage_only`, `unusable`.
- Identity kind: `unauthenticated`, `human`, `administrator`, `support`,
  `service`, `worker`, `integration`, `third_party`.
- Transport: `source`, `raw_http`, `browser`, `graphql_client`, `rpc_client`,
  `worker`, `other`.
- Resource provenance: `source_attributed`, `runtime_created`,
  `runtime_readback`, `shared_unattributed`, `guessed`, `unknown`.
- Resource safety: `protected_existing`, `disposable`, `read_only_reference`,
  `unknown`.
- Resource sensitivity: `public`, `internal`, `confidential`, `restricted`,
  `unknown`.

### Policy and operation

- Policy decision: `allow`, `deny`, `conditional`, `unknown`.
- Policy authority: `source_policy`, `role_matrix`,
  `documented_requirement`, `explicit_context`, `runtime_baseline`,
  `inferred`.
- Enforcement status: `observed_enforced`, `intended`, `partial`, `missing`,
  `bypassable`, `unknown`.
- Enforcement kind: `middleware`, `decorator`, `policy`, `service`,
  `repository_filter`, `database_policy`, `serializer`, `worker`, `gateway`,
  `other`.
- Operation kind: `rest`, `graphql_query`, `graphql_mutation`,
  `graphql_subscription`, `rpc`, `server_action`, `web`, `websocket`, `job`,
  `worker`, `webhook`, `other`.
- Obligation action: `create`, `read`, `list`, `update`, `delete`, `execute`,
  `approve`, `assign`, `transfer`, `share`, `export`, `import`, `subscribe`,
  `other`.
- Obligation status: `enforced`, `partial`, `missing`, `bypassable`, `unknown`.
- Source-trace reachability: `shipped`, `test_only`, `dead`, `generated`,
  `dependency`, `disabled`, `unknown`.
- Source-trace conclusion: `enforced`, `gap`, `ambiguous`, `not_applicable`.
- Source-trace hop kind: `entrypoint`, `middleware`, `controller`, `resolver`,
  `service`, `policy`, `repository`, `serializer`, `worker`, `integration`,
  `sink`, `other`.
- Restriction state: `introduced`, `propagated`, `consumed`, `dropped`,
  `not_applicable`, `unknown`.
- Relationship: `unauthenticated`, `own`, `same_tenant_peer`, `cross_role`,
  `cross_tenant`, `privileged_to_private`, `service_to_user`,
  `worker_continuation`, `public_or_shared`, `unknown`.

### Matrix, candidates, findings, and tests

- Matrix `review_status`: `source_reviewed`, `runtime_tested`, `blocked`,
  `deferred`, `out_of_scope`, `not_applicable`.
- Matrix `expected_decision`: `allow`, `deny`, `conditional`, `unknown`.
- Matrix `observed_decision`: `not_observed`, `allowed`, `denied`, `partial`,
  `error`, `ambiguous`.
- Candidate disposition: `lead`, `needs_followup`, `rejected`,
  `source_confirmed`, `runtime_confirmed`.
- Proof gate: `caller`, `target`, `ownership_or_tenant`, `expected_denial`,
  `unauthorized_impact`.
- Proof-gate status: `proven`, `missing`, `contradicted`.
- Finding `proof_basis`: `source`, `runtime`.
- Finding severity: `critical`, `high`, `medium`, `low`.
- Finding type: `BOLA`, `BFLA`, `BOPLA`, `cross_tenant`,
  `vertical_privilege_escalation`, `missing_authorization`,
  `mass_assignment`, `parameter_tampering`, `method_or_variant_bypass`,
  `workflow_authorization`, `other`.
- Test execution status: `planned`, `passed`, `failed`, `inconclusive`,
  `blocked`.
- Test result outcome: `control_held`, `control_failed`, `inconclusive`.
- Signal purpose: `caller_identity`, `owner_target_attribution`,
  `authorized_baseline`, `expected_denial`, `unauthorized_impact`,
  `control_success`, `control_failure`, `state_readback`, `cleanup`, `error`.
- Test destructive risk: `low`, `medium`, `high`.
- Cleanup status: `not_required`, `complete`, `incomplete`, `failed`.

### Coverage and quality

- Coverage status: `reviewed`, `reviewed_no_issue`, `tested`, `pending`,
  `deferred_with_specific_reason`, `out_of_scope`, `not_applicable`.
- Coverage risk: `critical`, `high`, `medium`, `low`.
- Coverage category: `surface`, `identity`, `resource`, `policy`,
  `enforcement_point`, `operation`, `obligation`, `source_trace`,
  `matrix_requirement`, `matrix_cell`, `carrier`, `variant`, `candidate`,
  `finding`, `validation_test`, `other`.
- Question priority: `p0`, `p1`, `p2`, `p3`.
- Question status: `open`, `answered`, `deferred`.
- Quality-review status: `pass`, `fail`, `incomplete`.
- Challenge-finding status: `open`, `resolved`, `dismissed`.
- Quality gate: `scope_and_evidence`, `identity_integrity`,
  `resource_provenance`, `operation_inventory`, `policy_model`,
  `source_trace`, `matrix_completeness`, `runtime_safety`, `proof_gates`,
  `false_positive_challenge`, `coverage`.
- Quality-gate status: `passed`, `failed`, `incomplete`, `not_applicable`.

## Scope and evidence

Metadata binds the review to its declared subject. Record:

- review mode, analysis basis, review status, and assurance status;
- repository name, admitted paths, immutable revision, packages, supplied
  documents, exclusions, and the linked manifest content hash when source is used;
- each exact runtime authorization target ID, origin, environment, surface IDs,
  operation IDs, resource IDs, tenant or domain allowlists, transport, action
  classes, identity IDs, structured mutation scope, request and attempt limits,
  and `valid_from`/`expires_at` window; use `constraints` only for additional
  restrictions that are not already represented structurally. `max_requests`
  is cumulative across all executed tests that consume the authorization
  target; `max_attempts_per_test` applies separately to each test;
- authors, review dates, focused targets, and limitations.

A `focused` review names its exact operations, resources, policy boundary, or
candidate and carries a limitation that forbids application-wide conclusions.
For `source_only` or `hybrid`, repository-manifest evidence is `observed`, has
`source_type: repository_manifest`, carries a lowercase
`sha256:<64-hex>` content hash, and matches the metadata revision and admitted
scope exactly.

Every evidence record has an evidence ID, class, source type, precise locator,
revision or exact runtime target, short redacted summary, reliability, and a
collection time. Runtime evidence also records its environment, transport, and
run ID. Keep evidence class independent from
source type:

- `observed` states only what current source, configuration, traffic, or
  authorized runtime evidence directly shows;
- `intended` records an application-specific requirement or policy;
- `inferred` cites supporting evidence and explains the reasoning;
- `unknown` names the missing fact and the question or test that resolves it.

An executed result records one `run_id`, request count, attempt count, and the
fresh identity-preflight evidence used for that run. Every observed signal has
its own `signal_evidence` mapping. A shared aggregate record cannot stand in
for purpose-specific caller, target, baseline, denial, impact, readback, or
cleanup evidence.

Source evidence locators match the frozen revision. Runtime evidence locators
match an exactly authorized target. Do not store raw passwords, tokens,
cookies, private keys, reset links, personal data, customer object content, or
unredacted tenant identifiers. Retain stable actor labels, field classes,
redacted request shapes, response classes, and cryptographic fingerprints.

## Identity and resource provenance

An identity records kind, stable redacted label, relevant role, tenant or
authorization domain, transport, auth-artifact fingerprint when runtime
verified, freshness, verification state, and evidence.

`source_modeled` describes code or policy and does not prove a runtime caller.
`runtime_verified_portable` requires a fresh identity-confirming check through
the same portable transport used by the test.
`runtime_verified_browser_bound` requires testing in that bound browser
context; replay through raw HTTP does not preserve its verification.
`coverage_only` and `unusable` identities cannot prove a runtime denial or
failure.

A resource record contains resource type, stable `identifier_fingerprint`,
`carrier_ids`, owner/controller identity, tenant/domain, sensitivity,
lifecycle, provenance, safety, and evidence. `source_attributed` names the
source binding that derives owner or tenant. `runtime_created` cites a creation
receipt under the owner identity. `runtime_readback` cites an authoritative
owner or tenant-scoped read.

`shared_unattributed`, `guessed`, and `unknown` cannot prove ownership or
cross-tenant impact. `protected_existing` resources are read-only unless the
authorization record explicitly permits the exact mutation. State-changing
tests use `disposable` resources. A `read_only_reference` may support a bounded
read check but not a write, delete, transfer, role, billing, invitation,
credential, or lifecycle mutation.

For peer proof, caller and owner are distinct identities. For cross-tenant
proof, their tenant/domain labels are both proven and distinct. For an `own`
baseline, caller and owner match. Preserve parent, child, relationship, source,
and destination objects separately when one operation authorizes more than one
object.

## Policy, operation, and enforcement relationships

Maintain these relationships and reject every dangling reference:

1. Each surface cites discovery evidence and either an operation or a specific
   public, non-applicable, deferred, or excluded disposition.
2. Each policy rule binds an identity kind, role or relationship, action,
   resource, property, tenant/domain and relevant context to a policy decision.
3. Each policy rule records authority and evidence. `runtime_baseline` and
   `inferred` may corroborate expected denial but cannot normally prove it
   alone. UI hiding and endpoint names are evidence leads, never authority.
4. Each enforcement point links policy and operation IDs and records where the
   caller, target, owner, tenant, action, and context enter the decision and
   where the decision constrains the protected sink.
5. Each operation links a discovered surface to its kind, entrypoint, carriers,
   variants, obligations, continuation operations, and evidence. Its obligations
   carry the resource, property, policy, enforcement, restriction, and sink details.
6. Each authorization obligation links one operation, action, resource or
   property, relationship, expected policy, enforcement status, evidence, and
   downstream continuation.

An enforcement helper's existence is not `observed_enforced`. That status
requires evidence that the shipped operation invokes it with the relevant
caller, target, action, owner/tenant, and context before the protected sink.
Trace workers and jobs through queue publication, worker identity, object
reload, policy re-evaluation, and the final side effect.

Group operations only when policy, resource, action, enforcement point,
carriers, and security-relevant variants genuinely match. Otherwise preserve
separate operation IDs for legacy routes, bulk interfaces, alternate parsers,
nested resolvers, and asynchronous continuations.

## Matrix and validation relationships

Freeze the expected relationships, carriers, properties, and variants for each
operation before recording results. Each matrix row links:

- operation and obligation IDs;
- caller identity and target resource IDs;
- relationship and policy IDs;
- obligation, carrier, and variant IDs;
- expected and observed decisions;
- source traces, runtime tests, evidence, review status, and an exact reason;
- an authorized `baseline_cell_id` for expected-denial or conditional cases.

Every applicable protected operation has an `own` or other authorized control
when the policy permits one, plus every meaningful expected-denial
relationship. A row with expected decision `unknown` cannot support a
confirmed candidate. `not_applicable`, `deferred`, and `out_of_scope` require
a concrete reason; do not delete the row.

Each runtime validation test links the matrix rows it validates and records:

- exact authorized target and action class;
- caller-identity and owner-target-attribution signals;
- an authorized baseline of the same operation shape;
- expected-denial and unauthorized-impact signals;
- control-success and control-failure signals;
- fixtures, before state, authoritative readback, cleanup, stop conditions,
  `max_attempts`, whether a fresh authorized control was repeated, execution
  status, result, evidence, and limitations.

Change one declared authorization dimension at a time. If more than one change
is unavoidable, state why it is still discriminating. `planned` means no
runtime action ran. `blocked` records a claim-level blocker and has no result.

Interpret executed statuses consistently:

- `passed` has outcome `control_held`, observes expected denial and control
  success, and does not observe unauthorized impact or control failure;
- `failed` has outcome `control_failed`, observes unauthorized impact and
  control failure, and does not observe expected denial or control success;
- `inconclusive` has outcome `inconclusive` and no complete conclusive pair.

Executed results record `attempt_count`; it cannot exceed the planned
`max_attempts`. A runtime-confirmed failure requires at least two attempts plus
`fresh_control_repeated: true`. Executed results cite direct `runtime_response`,
`object_readback`,
`audit_event`, or `test_result` evidence. The result-summary claim cites at
least one of the same evidence IDs. A state-changing result also records before
state, authoritative readback or equivalent side effect, and cleanup evidence.
If cleanup is `incomplete` or `failed`, preserve any proven impact, set the
review to `incomplete_high_risk_coverage`, keep the test in high-risk pending
or deferred coverage, open a blocking residual-state question, and fail or
incomplete the quality review.

## Candidates and findings

A candidate references the affected operation, obligations, matrix rows,
identity, resources, policies, enforcement points, evidence, five proof gates,
risk, confidence, contradiction search, validation tests, and any published
finding. Concrete impact and remediation are carried by its finding.

- `lead` is an anomaly before the five gates have been evaluated.
- `needs_followup` identifies the exact missing proof and safe next action.
- `rejected` cites the contradiction or failed assumption.
- `source_confirmed` has every proof gate `proven` from an observed shipped
  source path, with no claim that a runtime attempt occurred.
- `runtime_confirmed` has every proof gate `proven` and cites a conclusive,
  authorized, independently reproduced runtime failure with direct evidence.

A finding exists only for a `source_confirmed` or `runtime_confirmed`
candidate and preserves that candidate ID. `proof_basis: source` maps only to
`source_confirmed`; `proof_basis: runtime` maps only to `runtime_confirmed`.
The finding cites its type, severity, confidence, concrete impact, affected
records, reproduction or source trace, remediation at the authoritative
enforcement layer, and validation plan.

Do not promote candidates by setting gate statuses editorially. Each gate is
a short claim with evidence IDs and related model IDs. Follow the detailed
requirements in [access-proof-gates.md](access-proof-gates.md).

## Coverage and completeness

Freeze expected source paths, surfaces, model records, and matrix rows before
changing coverage from `pending`. Coverage rows may group records with
`subject_ids`, but an ID may appear in only one coverage row. Every modeled
surface, identity, resource, policy,
enforcement point, operation, obligation, carrier, variant, source trace,
matrix requirement, matrix row, candidate decision, finding, and runtime test
appears in the expected inventory and has
at least one coverage row. Never remove an item from both sets to make a review
pass.

Keep source and runtime coverage distinct. A planned runtime test does not make
complete source coverage incomplete unless runtime execution was declared in
scope. Runtime testing cannot compensate for an unread high-risk source path
in a full source or hybrid review.

Every `deferred_with_specific_reason` or `out_of_scope` row records an exact
reason, confidence impact, owner, and next action. `out_of_scope` names an exact
declared exclusion. Any critical/high `pending`,
`deferred_with_specific_reason`, or `out_of_scope` row forces
`incomplete_high_risk_coverage`. `not_applicable` requires evidence and cannot
hide an unknown relationship or variant.

For `full`, account for every admitted authorization-relevant surface. For
`focused`, account for every named target and retain the focused-scope
limitation. Ranking changes review order, never expected inventory membership.

## Quality review

Record each required quality gate exactly once:

- `scope_and_evidence`;
- `identity_integrity`;
- `resource_provenance`;
- `operation_inventory`;
- `policy_model`;
- `source_trace`;
- `matrix_completeness`;
- `runtime_safety`;
- `proof_gates`;
- `false_positive_challenge`;
- `coverage`.

Core gates cannot be `not_applicable`. `source_trace` may be
`not_applicable` only for a declared `runtime_only` review. Runtime-specific
checks inside `runtime_safety` and `proof_gates` may be recorded as
`not_applicable` only when no runtime action executed; the gate still accounts
for proof that no runtime action occurred and that planned tests are bounded.

Challenge records use `QF-` IDs, severity, related model IDs, evidence, owner,
status, and disposition. An unresolved critical/high challenge, a missing or
duplicate required gate, or a gate marked `failed` or `incomplete` blocks a
complete publication.

## Clean-model semantics

A legitimate clean review may have no confirmed candidates or findings. It may
have an empty candidate ledger when no lead survives, or retain rejected leads
and follow-up items without inventing a finding. It still contains:

- frozen scope and evidence;
- a dispositioned surface and operation inventory;
- an evidence-backed identity, resource, policy, and enforcement model;
- expected matrix rows for every applicable protected operation;
- complete coverage and an independent false-positive challenge.

Operations and matrix rows may be empty only when every admitted surface is
evidenced as public or not authorization-relevant and the challenger confirms
that disposition.

A source-only review can be `complete` with `source_observed` assurance while
safe runtime tests remain `planned`, provided runtime was not declared in
scope. A focused clean result applies only to its named targets. Never render a
clean result as "the application is secure" or "no authorization
vulnerabilities exist". State only that no additional proof-gated finding was
identified within the declared completed scope and assurance level.
