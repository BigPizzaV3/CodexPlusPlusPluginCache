# Full Application Review Workflow

Use this workflow only for a full review of an existing application. It is not
a diff review, feature-only review, or sampling mode. Read it with
[threat-model-ledgers.md](threat-model-ledgers.md) and
[threat-evidence-and-quality-gates.md](threat-evidence-and-quality-gates.md).

## Contents

- [Fixed vocabulary](#fixed-vocabulary)
- [Deterministic review sequence](#deterministic-review-sequence)
- [Hard and soft gates](#hard-and-soft-gates)
- [Publication format](#publication-format)
- [Lifecycle and updates](#lifecycle-and-updates)

## Fixed vocabulary

- Evidence: `observed`, `intended`, `inferred`, `unknown`.
- Risk: `critical`, `high`, `medium`, `low`.
- Confidence: `high`, `medium`, `low`.
- Coverage: `pending`, `reviewed`, `reviewed_no_issue`, `out_of_scope`,
  `deferred_with_specific_reason`.
- Model status: `complete`, `incomplete_high_risk_coverage`.

Do not add synonyms to stored records. A model can be `complete` while it has
accepted or unresolved risks; completeness means every material surface and
decision is dispositioned, not that the application is safe. A source-observed
model may also have `planned` runtime tests when runtime was not in scope;
represent that limit with assurance and test status rather than false coverage.

## Deterministic review sequence

### 1. Freeze scope and evidence

1. Record repository revision, dependency lock revisions, supplied artifacts,
   environments, deployment variants, and explicit exclusions.
2. Enumerate files and artifacts in stable sorted order. Record roots, ignore
   rules, generated/vendor treatment, unreadable items, and inventory command.
   Save an observed `repository_manifest` evidence record with the manifest's
   embedded SHA-256 content hash and mirror that hash plus the exact admitted
   paths, packages, environments, documents, and exclusions into
   `coverage.inventory.manifest`. Record documents and exclusions as explicit
   empty arrays when there are none.
3. Classify high-signal surfaces: entrypoints, auth/authz, tenant and ownership
   policy, schemas, jobs, integrations, stores, secrets/config, IaC, admin,
   mobile, AI, logging, and security tests.
4. Freeze `coverage.inventory.expected_subject_ids`, including every modeled
   entity, boundary, flow, invariant, control, and decision. Create at least one
   coverage record for every expected subject as `pending`. Change each only
   after review or a specific disposition; never remove an expected subject or
   use sampling language to make a full review pass.

Use an immutable commit or release digest for `metadata.repository.revision`.
When the target has no version-control metadata, build a deterministic manifest
from each admitted repository-relative path and its content digest, hash that
inventory with `scripts/build_repository_manifest.py`, and use its embedded
and printed `snapshot-sha256:<digest>`. The embedded `content_hash` binds the
canonical admitted scope payload; it is not a hash of the JSON file containing
itself. Record the manifest method and exclusions in the
scope description, limitation claims, and inventory evidence, and use the same
snapshot revision in first-party evidence locators. A date, `HEAD`, branch
name, or `working-tree` label does not bind the model to the reviewed bytes.

### 2. Capture claim-level evidence

Give every material claim an evidence ID, class, source and precise location,
revision, short claim, and confidence. `Observed` proves only what the cited
source/config/runtime artifact shows. `Intended` records documents or policy.
`Inferred` records the supporting observations and reasoning. `Unknown` names
the missing evidence and the decision or test that can resolve it.

Keep secrets and personal/customer data out of evidence. For every control-gap
claim, search global middleware, domain policy, repositories, serialization,
framework hooks, IaC, and compensating deployment controls. Record supporting
and contradicting evidence separately.

### 3. Build the application graph

Create stable nodes for actors, principals, assets, components, stores,
integrations, trust zones, controls, and threats. Create directed flow edges
with actor, input, entrypoint, component handoffs, assets, boundary crossings,
identity/tenant/role decisions, controls, sinks, responses, side effects, and
durable state.

Trace every high-signal entrypoint to its sinks and response path. Continue
through queues, callbacks, redirects, workers, webhooks, renderers, mobile
handlers, AI tools, and third parties. A boundary must connect two named zones;
a threat and attack path must reference existing graph elements.

### 4. Derive risks and responses

For each material flow, state an invariant, actor goal, preconditions, abuse
path, boundary, affected asset, business impact, visible controls, assumed or
missing controls, and contradiction result. Rank risk independently from
confidence using exposure, privilege, complexity, sensitivity, reach, impact,
control evidence, and workflow criticality.

For every retained threat, record a response: mitigate, eliminate, accept,
transfer, or investigate. Record owner, rationale, target state, decision date, and linked
validation test. Never turn a catalog match or missing-control hypothesis into
an executed result or verified vulnerability.

If no candidate survives the evidence, contradiction, and materiality gates,
use empty threat, attack-path, decision, validation-test, and question ledgers.
Keep the full graph, controls, invariants, manifest, coverage, and challenger;
an empty risk ledger is valid only because those populated records demonstrate
what was actually reviewed.

### 5. Fan out specialist work

When the relevant companion skill is available, use
[specialist-handoffs.md](specialist-handoffs.md). Send stable model IDs,
bounded scope, safe targets, exact test hypotheses, and `planned` status.
On return, preserve specialist provenance and limitations. Reconcile results
into evidence, tests, decisions, threats, graph edges, and coverage; do not copy
a specialist conclusion without checking that target and revision match.
When it is unavailable, preserve the executable handoff in the canonical model
and continue the full source review locally.

### 6. Run an independent challenger

Before publication, give a reviewer or fresh agent the frozen scope, inventory,
graph, evidence, threats, decisions, tests, and coverage ledger. The challenger
must independently seek missing actors/assets/boundaries, alternate paths,
contradicting controls, unjustified risk ranks, overclaimed evidence, unsafe or
non-discriminating tests, and high-signal unread items.

Record each challenge, evidence, disposition, owner, and resulting ledger
change. The primary reviewer cannot silently dismiss a challenge. Unresolved
publication-blocking challenges force `incomplete_high_risk_coverage`.

### 7. Validate semantics

Validate allowed enums, required fields, unique IDs, evidence references,
referential integrity, boundary endpoints, connected attack paths, normalized
control relationships, test completeness, and coverage accounting. Recompute
status from gates; do not set it editorially.

## Hard and soft gates

Hard gates block `complete`: missing critical actor/asset/boundary; high-risk
surface still `pending`, deferred, or out of scope; inventory manifest/scope or
expected-subject mismatch; generic deferral; dangling or contradictory IDs;
material claim without evidence class/reference; attack path without connected
flow and impact; critical/high uncertain control without a decision and test;
unsafe test; unredacted secret/customer data; or unresolved challenger issue.

A planned validation test is not by itself a coverage failure. It blocks
`runtime_validated`, not a fully dispositioned `source_observed` model, unless
runtime execution was explicitly included in scope.

Soft gates warn but do not alone block publication: weak naming, duplicated
records, low-value catalog mapping, missing diagram polish, verbose prose,
minor low-risk coverage debt, or response ownership dates not yet finalized.
List soft-gate debt and its owner in the report.

An `out_of_scope` row must name `scope_exclusion` exactly as declared in
metadata. It never permits a critical/high subject in a complete full model;
use `incomplete_high_risk_coverage`. Lower-risk declared exclusions remain
visible assurance limitations.

## Publication format

Publish concise-first: executive summary; scope/revision/status; top risks and
attack paths; required decisions and owners; highest-value validation tests;
coverage gaps and confidence impact. Put the complete evidence, entity, flow,
threat, decision, control, test, challenge, and coverage ledgers afterward.

## Lifecycle and updates

Version the model and bind it to application/deployment revisions. Update it on
auth/authz, tenant, data-flow, integration, admin, mobile, AI, infrastructure,
or incident changes. Preserve stable IDs, add supersession links, invalidate
stale observations, reopen affected coverage as `pending`, retrace changed and
dependent graph paths, rerun linked tests and the challenger, then recompute the
model status. Record what changed, why, who reviewed it, and the next trigger.
