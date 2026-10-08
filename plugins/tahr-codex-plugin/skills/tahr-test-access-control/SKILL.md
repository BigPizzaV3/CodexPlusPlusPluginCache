---
name: tahr-test-access-control
description: Perform complete or focused, evidence-backed access-control review from source and optionally an explicitly authorized local or staging runtime. Model subjects, roles, tenants, resources, actions, properties, policy rules, enforcement points, and owner-attributed test cases; trace object-, function-, property-, role-, and tenant-level authorization through REST, GraphQL, web, job, and asynchronous paths; safely validate IDOR/BOLA/BFLA, mass assignment, privilege escalation, and cross-tenant isolation; and reject status-code or guessed-ID false positives. Use for authorization code review, multi-user or multi-tenant assessments, admin and role boundary analysis, pre-pentest review, or validation of a suspected access-control finding.
---

# Tahr Test Access Control

Determine exactly who can perform which action on which resource, property, or
function—and prove when the implementation violates that application-specific
rule. Produce an authorization model and proof ledger, not a status-code diff.

## Load the operating contract

Before reviewing:

1. Read [full-review-workflow.md](references/full-review-workflow.md) for scope,
   execution order, completion, and lifecycle rules.
2. Read [access-control-data-contract.md](references/access-control-data-contract.md)
   for stable IDs, exact enums, and record relationships.
3. Read [access-matrix.md](references/access-matrix.md) before constructing
   operation, relationship, carrier, property, or variant coverage.
4. Read [access-proof-gates.md](references/access-proof-gates.md) before
   accepting or rejecting a candidate.
5. Read [runtime-test-safety.md](references/runtime-test-safety.md) before any
   runtime action.
6. Read [source-review-patterns.md](references/source-review-patterns.md) when
   source is available.
7. Use [worked-example.md](references/worked-example.md) only when the expected
   evidence-to-finding trace is unclear.

Start from [access-control-review.template.json](assets/access-control-review.template.json)
and keep [access-control-review.schema.json](assets/access-control-review.schema.json)
as the canonical output contract. Maintain one `access-control-review.json`;
derive all reader-facing artifacts from it.

## Choose scope and assurance honestly

Set `review_mode` to:

- `full` for every admitted authorization-relevant operation in the existing
  application; or
- `focused` for explicitly named operations, findings, resources, or policy
  boundaries.

Default to `full` when the user asks to review or secure the application and
does not explicitly narrow the authorization scope.

Set `analysis_basis` to `source_only`, `runtime_only`, or `hybrid`. A focused
review must carry a visible limitation and must not make an application-wide
claim. A source-only review may be `complete` with `source_observed` assurance
and planned runtime tests when every declared source surface is dispositioned.
It must not claim that an attack ran or that deployed enforcement failed.

Keep these states separate:

- `review_status`: whether the declared authorization scope was dispositioned;
- `assurance_status`: source observation versus authorized runtime validation;
- candidate `disposition`: lead, follow-up, rejected, source-confirmed, or
  runtime-confirmed;
- test `execution_status`: planned, passed, failed, inconclusive, or blocked;
- coverage `status`: reviewed, tested, pending, deferred, or out of scope.

Default to read-only analysis. Never start an application, send a request,
refresh a session, or mutate state unless the exact target and action class are
authorized. Never commit, patch, or reconfigure the reviewed application as
part of this skill.

## Freeze the review inputs

For source or hybrid review, create a deterministic manifest in the selected
output directory:

```bash
python3 <skill-directory>/scripts/build_review_manifest.py \
  path/to/application --include . \
  --output path/to/output/repository-manifest.json
```

Pass `--revision` for an immutable VCS or release revision. When omitted, the
script derives `snapshot-sha256:<digest>` from admitted paths and bytes. Copy
its embedded revision and content hash into metadata, manifest evidence, and
coverage inventory. Repeat `--package` for package/module labels and
`--document` for supplied repository policy or design files; documents are
admitted and hashed automatically. Use explicit empty arrays for absent
documents or exclusions. When the output lives under the application root,
place it in a dedicated subdirectory such as `.tahr-review/`; the builder
records and excludes that whole directory to prevent generated artifacts from
contaminating later snapshots, and refuses output directly in the root.

Inventory every admitted REST route, GraphQL query/mutation/subscription,
server action, RPC method, UI-backed function, webhook, worker/job, queue
consumer, export/download, bulk operation, legacy/versioned interface, and
administrative surface that makes or depends on an authorization decision.
Record intentionally public and non-applicable surfaces instead of deleting
them from the inventory.

When `$tahr-map-attack-surface` is available, consume its frozen operation
inventory and reconcile it; otherwise inventory locally. Companion skills are
optional—the access-control skill must remain independently usable.

## Establish identity and object truth

Model unauthenticated, user, peer, role, tenant, administrator, support,
service, worker, integration, and other applicable subjects. Keep source-modeled
identities separate from runtime-verified sessions.

For runtime identities, bind the redacted auth artifact fingerprint to an
observed caller, role, tenant or authorization domain, transport, freshness,
and validation evidence. A filename, configured label, JWT claim, profile
field, or successful HTTP response alone does not make a session trustworthy.
Mark unusable or mismatched identities as coverage limitations; never turn
their failures into target-side denials.

For each target object, record resource type, exact identifier carrier, owner
or controller, tenant/domain, sensitivity, lifecycle, and provenance. A shared
ID pool, guessed adjacent ID, globally discovered identifier, or caller-owned
`/me` object cannot prove peer or cross-tenant impact. Use owner-attributed
source evidence, an authoritative owner baseline, or a disposable object
created and read back under the owner identity.

Treat supplied assessment identities as protected. Do not delete, disable,
lock, re-role, rename, reset, or rotate them. Use fresh disposable objects and
non-protected accounts for state-changing validation.

## Build the authorization model before judging

Record subject, action, resource, property, relationship, tenant/domain,
workflow state, feature/plan, authentication strength, and other policy
context. Express each rule as `allow`, `deny`, `conditional`, or `unknown` and
cite its authority.

Prefer source policy, middleware, domain rules, role matrices, documented
requirements, or explicit assessment context. UI hiding, endpoint names,
generic assumptions about administrators, and an owner-success baseline may
corroborate a rule but do not normally prove expected denial alone.

For every operation, enumerate each independent authorization obligation:
source object, destination object, parent, child, relationship object,
property, function, and asynchronous continuation. Record every caller-supplied
identifier and sensitive property, where restrictions enter the path, where
they are consumed, the authoritative query or state change, and every
downstream enforcement point checked.

## Trace controls end to end

When source is available, trace shipped entrypoint to final data return,
mutation, worker, integration, signed URL, audit record, notification, or other
side effect. A route-level guard that permits an action somewhere is not proof
that the submitted target is in scope. A policy helper that exists but is not
consumed on this path is not a control.

Search for the strongest contradiction before retaining a gap: global
middleware, dependency injection, decorators, domain policy, repository
filters, ORM scopes, serializers, workers, database policy, deployment
controls, and sibling route variants. Mark dead, test-only, generated,
dependency, or unreachable paths explicitly.

Group operations only when policy, resource, action, enforcement point, and
relevant carriers and variants genuinely match. Preserve operation-level IDs
so grouping cannot hide a legacy route, bulk path, alternate parser, nested
GraphQL resolver, or asynchronous continuation.

## Construct complete matrix coverage

For each applicable operation, freeze the expected callers, relationships,
identifier/property carriers, and interface variants before recording results.
Include unauthenticated, own-object, same-role peer, cross-role, cross-tenant,
service-to-user, and privileged-function cases when the model makes them
meaningful.

Pair unauthorized cases with an authorized baseline of the same operation
shape. Change one declared authorization dimension at a time. If an identity,
owner-attributed object, parser, route variant, or safe fixture is unavailable,
keep the matrix cell and mark the exact blocker; never omit it to improve
coverage.

Ranking controls execution order, not inventory. A full review processes every
expected case or gives a specific disposition. Planned runtime validation does
not by itself make completed source coverage incomplete; missing high-risk
source analysis or an explicitly required runtime case does.

## Execute only safe, discriminating tests

Follow [runtime-test-safety.md](references/runtime-test-safety.md). Require the
test to match exactly one structured authorization target across origin,
environment, surface/operation/resource IDs, tenant or domain, identities,
transport, action and mutation scope, request/attempt limits, and validity
window. Use synthetic data and the smallest reversible proof.

Every test defines and distinguishes:

- caller-identity proof;
- owner/tenant/target attribution;
- authorized baseline success;
- expected denial or control-held signal;
- unauthorized protected-data/action impact or control-failure signal;
- authoritative readback and cleanup for state changes.

An executed result uses one `run_id`. Its freshly collected identity preflights
and every observed signal must cite same-run, same-target runtime evidence.
Keep purpose-specific evidence for each signal; one aggregate record cannot be
the sole proof for caller, target, baseline, denial/impact, readback, and
cleanup. `planned` and `blocked` tests never contain a result.

HTTP 200, non-empty output, size/hash differences, empty/null/false output,
generic SPA shells, validation errors, 4xx/5xx reachability, 202 acceptance, or
an echoed request are leads only. A mutation requires persistent authoritative
readback or an equivalent side effect. Repeat an accepted runtime failure with
fresh identity state and a fresh authorized control.

## Apply proof and false-positive gates

Use the five mandatory gates: caller, target, ownership or tenant, expected
denial, and unauthorized impact. A source-confirmed candidate must connect a
shipped reachable entrypoint to a concrete protected data/action sink, show the
missing or bypassed path-specific control, and record the strongest
contradiction checked. A runtime-confirmed candidate must additionally cite a
conclusive authorized test result with direct runtime evidence.

Reject or retain as follow-up:

- current-user endpoints returning only caller-owned or empty state;
- legitimate sharing, public, support, or administrator behavior supported by
  an applicable policy;
- guessed or shared IDs without owner attribution;
- wrong, stale, mismatched, or transport-incompatible identity material;
- soft 404s, shells, parser errors, resource absence, or unproven server errors;
- writes without readback, async acceptance without a side effect, or results
  whose baseline changed more than the authorization dimension.

Record rejected leads with the applicable control or contradiction evidence.
Do not erase them; they demonstrate that the review challenged its own leads.

## Challenge and publish the model

After the primary pass, use an independent subagent when available; otherwise
perform a separate adversarial reasoning pass with fresh instructions. Require
it to seek omitted operations and identities, unmodeled parent/child objects,
unused restrictions, alternate routes/parsers/versions, false owner or tenant
attribution, ambiguous collaboration, unsafe tests, unsupported impact, stale
evidence, and hidden coverage gaps. Record every challenge and disposition.

Validate the canonical model:

```bash
python3 <skill-directory>/scripts/validate_access_control_review.py \
  path/to/access-control-review.json --strict
```

Fix failures, rerun the challenger when material content changes, and render:

```bash
python3 <skill-directory>/scripts/render_access_control_review.py \
  path/to/access-control-review.json --output-dir path/to/output --strict
```

The renderer produces `access-control-review.md`, `validation-plan.json`,
`findings.json`, and `coverage.json`. Do not edit derived artifacts as separate
sources of truth.

Lead with confirmed source or runtime findings, unresolved high-risk
candidates, blocked tests, and coverage limitations. Never conclude that
access control or the application is secure. A clean result means only that no
additional proof-gated finding was produced within the declared completed
scope and assurance level.
