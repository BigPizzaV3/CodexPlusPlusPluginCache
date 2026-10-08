# Access-Control Review Workflow

Use this sequence for both complete authorization reviews and focused finding
validation. Keep one canonical `access-control-review.json` and preserve every
decision as evidence-backed state.

## Contents

- [Operating states](#operating-states)
- [1. Freeze scope and provenance](#1-freeze-scope-and-provenance)
- [2. Model authorization truth](#2-model-authorization-truth)
- [3. Inventory operations and obligations](#3-inventory-operations-and-obligations)
- [4. Trace source enforcement](#4-trace-source-enforcement)
- [5. Freeze and disposition the matrix](#5-freeze-and-disposition-the-matrix)
- [6. Run authorized validation](#6-run-authorized-validation)
- [7. Decide candidates](#7-decide-candidates)
- [8. Challenge and publish](#8-challenge-and-publish)
- [Completion rules](#completion-rules)
- [Lifecycle updates](#lifecycle-updates)

## Operating states

Use only the canonical enums in
[access-control-data-contract.md](access-control-data-contract.md).

- Review mode: `full`, `focused`.
- Analysis basis: `source_only`, `runtime_only`, `hybrid`.
- Review status: `complete`, `incomplete_high_risk_coverage`.
- Assurance: `source_observed`, `partially_runtime_validated`,
  `runtime_validated`.

`complete` means every item in the declared scope was reviewed or specifically
dispositioned. It does not mean every policy held, every runtime test ran, or
the application is secure. A source-only full review can be complete while
planned runtime tests remain, provided runtime execution was not included in
the declared scope.

A focused review covers only the named operations, resources, candidates, or
findings. Require a visible limitation that it is not application-wide. Do not
use a focused review to silently replace a full review whose coverage is
incomplete.

## 1. Freeze scope and provenance

1. Record the application, repository root, immutable revision or deterministic
   snapshot, environments, interfaces, supplied documents, exclusions, and
   runtime-authorization limits.
2. For source or hybrid review, run `scripts/build_review_manifest.py`. Save
   its embedded content hash and revision in an observed `repository_manifest`
   evidence record and in `coverage.inventory.source_manifest`.
3. Inventory every admitted first-party file and authorization-relevant
   interface. Include source, config, route registration, middleware, policy,
   models, repositories, serializers, schemas, workers, tests, deployment
   controls, and supplied policy documents.
4. Record explicit empty arrays for absent documents or exclusions. A missing
   field is not proof that no exclusion exists.
5. Bind source evidence to the same revision. Bind runtime evidence to one run
   ID, exact target, collection time, and redacted request or state fingerprint.

Use an immutable commit or release digest when available. If VCS metadata is
absent or the working tree itself is the review target, use the script-derived
`snapshot-sha256:<digest>`. Do not use `HEAD`, a branch name, `latest`, or a
date as byte-level provenance.

For runtime-only review, freeze the supplied operation/surface inventory and
its evidence even when no repository exists. Missing source limits assurance;
it does not authorize invention of policy or implementation behavior.

## 2. Model authorization truth

Build the model before classifying behavior:

1. Create identities for applicable callers and authorization domains.
2. Separate source-modeled identities from runtime sessions. For runtime
   sessions, record exact artifact fingerprint, transport, freshness, observed
   caller, role/domain, and verification evidence.
3. Create resources for objects, functions, properties, relationships, and
   sensitive result sets. Record controller, tenant/domain, sensitivity,
   lifecycle, disposability, and provenance.
4. Create policy rules for subject, action, resource, relationship, and context.
   Record `allow`, `deny`, `conditional`, or `unknown` and cite authoritative
   evidence.
5. Create enforcement points for middleware, policy, repository scope, database
   policy, serializer/field filter, worker, or other path-specific control.
6. Preserve unknown ownership, collaboration, support, administrator, or public
   semantics as questions. Do not default uncertainty to denial.

An authorized owner baseline proves request shape and expected success. It does
not by itself prove another caller should be denied. UI visibility and route
names are targeting context, not policy authority.

## 3. Inventory operations and obligations

Create a stable operation record for every admitted route, resolver, server
action, RPC, job, worker, webhook, import/export, download, bulk action,
subscription, signed-URL issuer, admin function, and legacy/versioned variant.

For each operation:

1. Record method or operation kind, entrypoint, request carriers, sensitive
   response fields, state-change behavior, and continuations.
2. Split every authorization obligation into its own record. Include source,
   destination, parent, child, relationship, property, function, and continuation
   objects.
3. Name the required action and policy for each obligation.
4. Record where the restriction is produced, how it propagates, where it is
   consumed, and the final query, state change, disclosure, or side effect.
5. Record route, method, parser, content-type, API version, bulk, mobile,
   GraphQL, public, administrative, and asynchronous equivalents.
6. Mark intentionally public and authorization-irrelevant surfaces explicitly.

Group operations only when these are identical: policy, resource/action,
enforcement point, carriers, relevant variants, and continuation behavior.
Retain every member operation ID in the group and require coverage for it.

## 4. Trace source enforcement

For `source_only` or `hybrid`, create a source trace for every protected or
uncertain operation:

1. Start at a shipped runtime entrypoint.
2. Follow middleware, controller/resolver, service, policy, query/repository,
   serializer, worker, integration, and final sink.
3. Record every hop and exact evidence location.
4. Verify that the authorization restriction is consumed by the target query or
   state change; declared or injected but unused restrictions do not enforce.
5. Check every independent object obligation.
6. Search global and downstream controls before retaining a gap.
7. Record the strongest contradictory control and whether it applies to this
   exact path.
8. Mark dead, test-only, generated, dependency, disabled, or unreachable paths
   as non-shipped rather than findings.

A source-confirmed gap requires a shipped reachable path, an applicable deny or
conditional rule, a missing/partial/bypassable path-specific enforcement point,
and a concrete protected data or action sink. Use source-observed wording; do
not claim the attack executed.

## 5. Freeze and disposition the matrix

For each relevant operation, freeze:

- required callers;
- required relationships;
- identifier and property carriers;
- applicable variants;
- paired authorized baseline;
- source and runtime coverage expectations.

Create every required matrix cell before executing or reviewing individual
cells. A cell can be source reviewed, runtime tested, blocked, deferred, out of
scope, or not applicable, but it cannot disappear.

Change one declared authorization dimension between the control and test case.
Keep operation, parser, request shape, target type, and unrelated state stable.
If they differ, record each difference and explain why the comparison remains
valid or mark it inconclusive.

Do not require an impossible cross-tenant case when the application has no
tenant concept. Do require explicit `not_applicable` evidence. When a tenant
boundary exists but no second trusted identity or owner-attributed resource is
available, keep the high-risk cell blocked and report incomplete runtime
coverage.

## 6. Run authorized validation

Read [runtime-test-safety.md](runtime-test-safety.md) in full before any action.

1. Match the test to exactly one structured authorization target: origin,
   environment, surface and operation IDs, resource IDs, tenant/domain,
   identities, transport, action and mutation scope, request/attempt limits,
   and validity window.
2. Verify every caller immediately before the test and bind its preflight to
   the result's same `run_id`, origin, and transport.
3. Establish the authorized baseline.
4. Establish owner/tenant/target provenance.
5. Replay the same operation while changing one authorization dimension.
6. Collect separate, purpose-specific evidence for caller, attribution,
   baseline, denial/impact, readback, and cleanup signals; one aggregate record
   cannot prove all purposes.
7. For mutations, capture before state, authoritative readback or equivalent
   side effect, and cleanup proof.
8. Repeat an apparent failure with fresh identity state and a fresh control.

Operational errors, rate limits, target instability, missing fixtures, session
failure, parser errors, and ambiguous responses produce `inconclusive` or
`blocked`, never a control verdict.
`planned` and `blocked` tests never contain a result object.

## 7. Decide candidates

Apply [access-proof-gates.md](access-proof-gates.md). Every candidate records
all five gates even when some are missing or contradicted.

- Keep `lead` when the behavior is only a diagnostic signal.
- Use `needs_followup` when a specific obtainable proof is missing.
- Use `rejected` when applicable control or policy evidence contradicts the
  hypothesis, or when follow-up proves expected behavior.
- Use `source_confirmed` only for a complete source path and source proof.
- Use `runtime_confirmed` only for a conclusive, repeated, directly evidenced
  runtime control failure.

Create a finding only for `source_confirmed` or `runtime_confirmed`. The finding
must reference the originating candidate, exact operation and enforcement
point, proof gates, remediation target, and regression test.

Keep severity and confidence separate. Reject missing semantics instead of
defaulting an unknown type, severity, or confidence.

## 8. Challenge and publish

Use an independent subagent when available, or a separate adversarial pass when
it is not. Give the challenger the frozen inventory and canonical model—not the
desired findings. Require it to inspect:

- omitted operations, objects, identities, tenants, carriers, and variants;
- unused restrictions and control placement;
- parent/child and source/destination asymmetry;
- legitimate sharing, public, support, and administrator behavior;
- false owner or tenant attribution;
- status-only, soft-404, empty, error, or async-acceptance evidence;
- unproven source reachability or runtime impact;
- protected-account or non-disposable mutations;
- stale evidence and hidden high-risk coverage gaps.

Record each challenge with a `QF-` ID, severity, related IDs, disposition,
owner, and evidence. The primary reviewer cannot silently dismiss it.

Run the strict validator, fix the canonical model, rerun the challenger after
material changes, validate again, and only then render derived artifacts.

## Completion rules

Set `incomplete_high_risk_coverage` when any critical/high required surface,
identity, operation, obligation, relationship, carrier, variant, enforcement
point, proof question, or challenge remains pending, deferred, blocked, or out
of scope within the declared review basis.

Planned runtime tests do not make a source-only review incomplete unless runtime
was part of the declared scope. They do limit assurance to `source_observed`.

An empty finding ledger is valid when the inventory, model, traces or runtime
evidence, matrix, rejected leads, coverage, and quality review demonstrate what
was evaluated. Never invent a low-value finding to make the artifact look
complete.

## Lifecycle updates

Set a next-review date and change triggers. Reopen affected coverage when any
of these change:

- route, resolver, policy, middleware, repository scope, or serializer;
- role, tenant, sharing, support, administrator, or service semantics;
- resource ownership or lifecycle;
- API version, parser, bulk behavior, job, worker, or integration;
- runtime identity, target, or deployment control;
- accepted risk or remediation.

Preserve prior candidate and finding IDs where the meaning is unchanged. Add
new evidence and results; do not rewrite history to make an old conclusion look
stronger than the evidence available at that time.
