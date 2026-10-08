# Worked Example: Full Source-Only Access-Control Review

Use this fictional example to understand how the canonical records connect
from frozen scope to a proof-gated finding. Keep the example source-only: no
request is sent, no session is verified, no object is modified, and no deployed
behavior is claimed.

## Table of contents

- [Scenario and review posture](#scenario-and-review-posture)
- [Freeze evidence and model policy](#freeze-evidence-and-model-policy)
- [Inventory operations](#inventory-operations)
- [Split operations into obligations](#split-operations-into-obligations)
- [Trace both source paths](#trace-both-source-paths)
- [Build the source matrix](#build-the-source-matrix)
- [Reject the global-lookup lead](#reject-the-global-lookup-lead)
- [Confirm the owner-transfer flaw from source](#confirm-the-owner-transfer-flaw-from-source)
- [Apply the five proof gates](#apply-the-five-proof-gates)
- [Plan runtime validation without executing it](#plan-runtime-validation-without-executing-it)
- [Reconcile coverage and quality](#reconcile-coverage-and-quality)
- [State honest limits](#state-honest-limits)

## Scenario and review posture

Review a fictional multi-tenant report service with two registered,
authorization-relevant REST surfaces:

- `GET /api/reports/{report_id}` returns a confidential report.
- `PATCH /api/reports/{report_id}` updates report content and accepts JSON that
  may include `owner_id`.

Model these application rules:

- Allow an editor to read a report in the editor's tenant when the editor owns
  it or has an explicit share.
- Deny cross-tenant report reads without an applicable share.
- Allow an editor to update ordinary report content in the editor's tenant.
- Allow only a tenant administrator to transfer report ownership.

Set the review metadata exactly as:

| Field | Value | Meaning |
|---|---|---|
| `review_mode` | `full` | Review every admitted authorization-relevant surface in this fictional service. |
| `analysis_basis` | `source_only` | Draw conclusions only from the frozen source and policy. |
| `review_status` | `complete` | Disposition every admitted source item and source matrix case. |
| `assurance_status` | `source_observed` | Do not represent any identity, denial, or impact as runtime-verified. |
| Runtime authorization status | `requires_authorization` | Preserve the test as a plan until an exact target and action are authorized. |

Treat `full` and `source_only` as compatible. A full source review can be
complete without runtime execution when runtime is outside the declared scope.

## Freeze evidence and model policy

Bind every source claim to the same fictional revision and manifest. Use the
template's stable evidence IDs:

| Evidence ID | Class and source | Purpose |
|---|---|---|
| `EVD-MANIFEST` | `observed` repository manifest | Bind admitted `src/` and `docs/` content to the revision and SHA-256 digest. |
| `EVD-INVENTORY` | `observed` source code | Prove that exactly two registered authorization-relevant routes are admitted. |
| `EVD-ROUTES` | `observed` source code | Identify entrypoints, `report_id`, and caller-supplied `owner_id`. |
| `EVD-POLICIES` | `observed` source code | Identify read, edit, and owner-transfer policy functions. |
| `EVD-REPOSITORY` | `observed` source code | Trace report loading, serialization inputs, and generic field persistence. |
| `EVD-POLICY` | `intended` policy | Establish the application-specific expected rules. |
| `EVD-RUNTIME-UNKNOWN` | `unknown` | Record that no authorized target, runtime identity, or disposable object was supplied. |

Keep intended policy separate from observed enforcement. `EVD-POLICY` proves
what should happen; `EVD-ROUTES`, `EVD-POLICIES`, and `EVD-REPOSITORY` show
what the frozen source path does.

Model the source identities as `IDENTITY-UNAUTHENTICATED`,
`IDENTITY-EDITOR-A`, `IDENTITY-EDITOR-B`, and `IDENTITY-ADMIN-A`. Mark each
authenticated identity `source_modeled`; never call it a verified session.

Model the relevant targets separately:

- `RESOURCE-REPORT-A`: a source-attributed Tenant A report fixture.
- `RESOURCE-REPORT-B`: a source-attributed Tenant B read-only reference.
- `RESOURCE-OWNER-PROPERTY`: the restricted `owner_id` authorization
  property controlled by the administrator-only transfer rule.

Link the rules as `POLICY-REPORT-READ`, `POLICY-REPORT-EDIT`, and
`POLICY-OWNER-TRANSFER`. Do not infer the owner-transfer denial merely from the
field name; cite the documented and source policy.

## Inventory operations

Create one surface and one operation for each registered route:

| Surface ID | Operation ID | Operation | Security characteristics |
|---|---|---|---|
| `SURFACE-REPORT-READ` | `OP-REPORT-READ` | `GET /api/reports/{report_id}` | Read-only, confidential response, not public. |
| `SURFACE-REPORT-PATCH` | `OP-REPORT-PATCH` | `PATCH /api/reports/{report_id}` | State-changing, sensitive response, not public. |

Record the path carrier as `CARRIER-REPORT-ID`, the sensitive JSON property as
`CARRIER-OWNER-ID`, and the evidenced JSON update interface as
`VARIANT-PATCH-JSON`.

Do not merge the two operations merely because they address the same report.
They use different actions, policies, carriers, sinks, and proof requirements.

## Split operations into obligations

Separate each independent authorization decision:

| Obligation ID | Operation | Protected element | Expected control | Source status |
|---|---|---|---|---|
| `OBLIGATION-REPORT-READ` | `OP-REPORT-READ` | Confidential report selected by `report_id` | Apply tenant and sharing policy before serialization. | `enforced` |
| `OBLIGATION-REPORT-PATCH` | `OP-REPORT-PATCH` | Ordinary `title` and `body` updates | Require same-tenant edit permission. | `enforced` |
| `OBLIGATION-OWNER-TRANSFER` | `OP-REPORT-PATCH` | Restricted `owner_id` transfer | Require tenant-administrator transfer permission. | `missing` |

This split is essential. The PATCH handler can correctly scope the report to
the editor's tenant while still failing property-level authorization for
`owner_id`. Do not let the enforced content-update obligation conceal the
missing owner-transfer obligation.

## Trace both source paths

Record the read path as `TRACE-REPORT-READ`:

1. `HOP-READ-ENTRY` introduces caller-controlled `report_id` at the shipped
   GET handler.
2. The repository performs a global lookup of the exact report record.
3. `HOP-READ-POLICY` consumes the caller's tenant and sharing relation through
   the read policy against that loaded report.
4. `HOP-READ-SINK` serializes the confidential report only after policy
   approval.
5. Set `control_conclusion` to `enforced`.

Record the PATCH path as `TRACE-REPORT-PATCH`:

1. `HOP-PATCH-ENTRY` introduces `report_id` and JSON properties at the shipped
   PATCH handler.
2. `HOP-PATCH-SCOPE` consumes tenant scope for the report but does not evaluate
   the administrator-only rule for `owner_id`.
3. `HOP-PATCH-SINK` passes the supplied fields to a generic repository
   assignment that includes `owner_id`.
4. Check route registration, middleware, policy invocation, serializer,
   repository, and downstream source for a later transfer check or field
   filter; find none on this path.
5. Set `control_conclusion` to `gap`.

Use the contrast deliberately: an early global lookup is not automatically a
vulnerability, and an earlier tenant check is not automatically sufficient.
Follow each value to its final protected sink.

## Build the source matrix

Freeze requirements before recording conclusions:

- Use `REQUIREMENT-REPORT-READ` for own and cross-tenant read relationships,
  `OBLIGATION-REPORT-READ`, and `CARRIER-REPORT-ID`.
- Use `REQUIREMENT-REPORT-PATCH` for administrator and editor relationships,
  both PATCH obligations, both carriers, and `VARIANT-PATCH-JSON`.

Create these four cells:

| Matrix cell | Caller and target | Expected decision | Baseline | Source conclusion |
|---|---|---|---|---|
| `MATRIX-READ-OWN` | `IDENTITY-EDITOR-A` to `RESOURCE-REPORT-A` | `allow` | Authorized control | The read policy is consumed before serialization. |
| `MATRIX-READ-CROSS-TENANT` | `IDENTITY-EDITOR-A` to `RESOURCE-REPORT-B` | `deny` | `MATRIX-READ-OWN` | The same path applies tenant policy before serialization. |
| `MATRIX-PATCH-ADMIN` | `IDENTITY-ADMIN-A` transferring `RESOURCE-OWNER-PROPERTY` on `RESOURCE-REPORT-A` | `allow` | Authorized control | Policy permits this relationship; use it only as a planned runtime baseline. |
| `MATRIX-PATCH-EDITOR-OWNER` | `IDENTITY-EDITOR-A` transferring the same property | `deny` | `MATRIX-PATCH-ADMIN` | Source drops the property-specific restriction before persistence. |

Set all four rows to `review_status: source_reviewed` and
`observed_decision: not_observed`. The source establishes expected rules and
code paths; it does not observe an HTTP response or deployed decision.

## Reject the global-lookup lead

Retain `CANDIDATE-READ-GLOBAL-LOOKUP` as a challenged lead rather than silently
deleting it. The initial concern is reasonable: `OP-REPORT-READ` loads a report
globally by caller-controlled `report_id` before checking access.

Evaluate the five gates:

| Gate | Status | Reason |
|---|---|---|
| `caller` | `proven` | A source-modeled tenant editor reaches the shipped GET handler. |
| `target` | `proven` | The path loads the exact report selected by `report_id`. |
| `ownership_or_tenant` | `proven` | The model distinguishes the Tenant A caller from the Tenant B target. |
| `expected_denial` | `proven` | `POLICY-REPORT-READ` denies unshared cross-tenant access. |
| `unauthorized_impact` | `contradicted` | The downstream policy receives the loaded report and blocks it before the only serializer. |

Set disposition to `rejected`, cite `ENFORCEMENT-READ-POLICY` and
`TRACE-REPORT-READ`, and create no finding. The rejected record demonstrates
that the review tested the apparent unscoped lookup against the complete path.

Record the independent challenge as
`QF-GLOBAL-LOOKUP-FALSE-POSITIVE`. Resolve it only after confirming there is no
sibling response path that bypasses the downstream policy.

## Confirm the owner-transfer flaw from source

Retain `CANDIDATE-OWNER-TRANSFER` for `OP-REPORT-PATCH` and
`OBLIGATION-OWNER-TRANSFER`. Classify it as `BOPLA`, set disposition to
`source_confirmed`, and link:

- caller `IDENTITY-EDITOR-A`;
- resources `RESOURCE-REPORT-A` and `RESOURCE-OWNER-PROPERTY`;
- policy `POLICY-OWNER-TRANSFER`;
- missing point `ENFORCEMENT-OWNER-FILTER`;
- trace `TRACE-REPORT-PATCH`;
- matrix cells `MATRIX-PATCH-ADMIN` and `MATRIX-PATCH-EDITOR-OWNER`.

The source-confirmed path is:

`editor request -> PATCH JSON owner_id -> same-tenant report check -> generic field update -> persistent owner_id assignment`

The missing decision is the administrator-only transfer check between the
caller-controlled property and the persistent assignment. Authentication and
same-tenant edit scope are real controls, but neither authorizes this property.

Create `FINDING-OWNER-TRANSFER` only because the candidate passes every source
proof gate. Set `proof_basis` to `source`, severity to `high`, and confidence to
`high`. Phrase the impact conditionally: the frozen source permits an editor-
supplied ownership transfer if the deployed path behaves as modeled. Do not
state that an editor actually transferred a report.

Place remediation at the authoritative update boundary: reject `owner_id` from
ordinary edit payloads and enforce the owner-transfer policy before any
ownership assignment. Add a regression test that denies the editor case while
allowing an administrator case on disposable state.

## Apply the five proof gates

For `CANDIDATE-OWNER-TRANSFER`, record all five as `proven` from source:

| Gate | Evidence-backed claim |
|---|---|
| `caller` | `EVD-ROUTES` shows that a source-modeled editor can submit PATCH fields. |
| `target` | `EVD-ROUTES` and `EVD-REPOSITORY` trace `owner_id` to the stored report assignment. |
| `ownership_or_tenant` | `EVD-POLICIES` and `EVD-POLICY` place ownership transfer under tenant-administrator authority. |
| `expected_denial` | The documented and source policy explicitly denies editor ownership transfer. |
| `unauthorized_impact` | The shipped source connects editor-controlled `owner_id` to persistent state without the required property control. |

For the impact gate, claim only source-observed reachability to a persistent
sink. Do not cite `EVD-RUNTIME-UNKNOWN` as proof of impact and do not describe
the candidate as `runtime_confirmed`.

Record the strongest contradiction checked: tenant scope is enforced, but no
route, serializer, repository, middleware, policy, or downstream control
applies the separate owner-transfer rule. This distinguishes a path-specific
authorization gap from a missing local annotation.

## Plan runtime validation without executing it

Create `TEST-OWNER-TRANSFER` with `execution_status: planned`. Link it to both
PATCH matrix cells and `EVD-RUNTIME-UNKNOWN`. Do not add a result object or any
runtime response, identity-check, readback, audit, or cleanup evidence.
Set `max_attempts` to `2`, record the same stop conditions as the template,
and retain `CLAIM-TEST-LIMITATION` until the target and identities are authorized.

Require explicit authorization for an isolated local or staging target before
execution. When authorized later, design the test to:

1. Verify `IDENTITY-ADMIN-A` and `IDENTITY-EDITOR-A` through the same approved
   transport used by the requests.
2. Create a fresh synthetic disposable report and prove its initial owner and
   tenant through a creation receipt and authoritative readback.
3. Use the administrator request as the authorized baseline with the same
   route, parser, body shape, and lifecycle.
4. Use a fresh disposable report for the editor case and change only the caller
   role for the same owner-transfer action.
5. Treat editor denial plus unchanged readback as `control_held`.
6. Treat editor-requested ownership persisting in authoritative readback as
   `control_failed`.
7. Restore or delete only the disposable fixture and verify cleanup.

Use the template signal IDs without marking them observed:

- `SIGNAL-CALLER-IDENTITY`;
- `SIGNAL-OWNER-ATTRIBUTION`;
- `SIGNAL-AUTHORIZED-BASELINE`;
- `SIGNAL-EXPECTED-DENIAL`;
- `SIGNAL-UNAUTHORIZED-IMPACT`;
- `SIGNAL-CONTROL-SUCCESS`;
- `SIGNAL-CONTROL-FAILURE`;
- `SIGNAL-STATE-READBACK`;
- `SIGNAL-CLEANUP`.

Keep every signal description `unknown` until direct authorized runtime
evidence exists. A planned test improves the validation plan; it does not
increase assurance beyond `source_observed`.

## Reconcile coverage and quality

Freeze every modeled record in `coverage.inventory.expected_subject_ids`.
Include both surfaces, all identities and resources, all policies and
enforcement points, carriers and variants, operations and obligations, both
traces, matrix requirements and cells, both candidates, the one finding, and
the planned test.

Use the template coverage IDs to show disposition rather than volume:

- `COV-SURFACES` and `COV-OPERATIONS-OBLIGATIONS` prove that both admitted
  routes and all three independent obligations were reviewed.
- `COV-TRACES` proves that each route reached a final sink and received a
  contradiction search.
- `COV-MATRIX` proves that the frozen own, cross-tenant, administrator, and
  editor-property cases are present.
- `COV-DECISIONS` preserves both the rejected lead and source-confirmed
  candidate, plus the planned test.

Set these source coverage items to `reviewed` and keep
`unread_high_risk_count: 0`. Do not mark runtime cells `tested`; runtime was not
declared in scope.

Record each required quality gate exactly once and set it to `passed` only for
the claim it actually establishes:

- `GATE-SCOPE`, `GATE-IDENTITY`, `GATE-RESOURCE`, `GATE-INVENTORY`,
  `GATE-POLICY`, `GATE-SOURCE-TRACE`, and `GATE-MATRIX` establish the frozen
  source review.
- `GATE-RUNTIME-SAFETY` establishes that no runtime action occurred and that
  the plan is bounded; it does not establish that a runtime control held.
- `GATE-PROOF` establishes that the accepted source candidate passes all five
  gates and the rejected candidate records its contradiction.
- `GATE-FALSE-POSITIVE` records the resolved independent challenge.
- `GATE-COVERAGE` reconciles every expected source subject with a coverage
  disposition.

Set quality status to `pass` only after IDs are unique, references resolve,
source and runtime semantics remain separated, evidence is redacted, coverage
reconciles, and no critical or high challenge remains unresolved.

## State honest limits

Publish these limitations with the example:

- No request was sent and no application instance was started.
- No editor or administrator session was runtime-verified.
- No report owner, tenant, persistence result, denial, or cleanup was observed
  at runtime.
- Framework transformations, deployment configuration, database policy, and
  compensating controls may differ from the frozen source model.
- `TEST-OWNER-TRANSFER` cannot run until the exact target, identities, action
  class, disposable fixtures, stop conditions, and cleanup are authorized.
- `FINDING-OWNER-TRANSFER` is source-confirmed only; runtime exploitability and
  deployed impact remain unverified.

Conclude narrowly: one owner-transfer issue satisfies the source proof gates
within the completed fictional source scope, while the global-lookup lead is
rejected by a downstream control. Never conclude that the service is secure or
that runtime authorization has been tested.
