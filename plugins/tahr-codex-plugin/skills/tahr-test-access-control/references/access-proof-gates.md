# Access-Control Proof Gates

Promote a candidate only when all five application-specific proof gates are
`proven`. Evaluate the gates separately; strength in one gate never substitutes
for a missing caller, target, owner, policy, or impact.

## Contents

- [Evidence rules](#evidence-rules)
- [Gate 1: caller](#gate-1-caller)
- [Gate 2: target](#gate-2-target)
- [Gate 3: ownership or tenant](#gate-3-ownership-or-tenant)
- [Gate 4: expected denial](#gate-4-expected-denial)
- [Gate 5: unauthorized impact](#gate-5-unauthorized-impact)
- [Source-confirmed requirements](#source-confirmed-requirements)
- [Runtime-confirmed requirements](#runtime-confirmed-requirements)
- [False-positive rejection](#false-positive-rejection)
- [Independent challenge](#independent-challenge)
- [Quality and publication gates](#quality-and-publication-gates)
- [Clean-result gate](#clean-result-gate)

## Evidence rules

Use the exact gate names `caller`, `target`, `ownership_or_tenant`,
`expected_denial`, and `unauthorized_impact`. Use only `proven`, `missing`, or
`contradicted` as gate status.

Every gate record contains:

- a short, falsifiable claim;
- supporting evidence IDs and related model IDs;
- the strongest contradicting evidence considered;
- the reason for its status;
- the safe next action when status is `missing`.

`Observed` source evidence proves only the frozen shipped path it cites.
`Observed` runtime evidence proves only the exact authorized target, identity,
resource, request shape, and collection time it cites. Intended policy does not
prove enforcement. An inference cannot be the sole basis for caller identity,
object ownership, expected denial, or runtime impact.

An operational failure, stale credential, missing fixture, absent owner,
unavailable parser, tool error, or inaccessible environment is a blocker or
coverage limitation. It is not evidence that the authorization control held or
failed.

## Gate 1: caller

Prove the exact actor whose privileges matter.

For source proof, identify the reachable unauthenticated or authenticated
subject, relevant role, tenant/domain, authentication assumptions, and how that
subject reaches the operation. `source_modeled` is sufficient only for a
source-confirmed path and must not be described as a runtime identity.

For runtime proof, require:

- an identity with verification `runtime_verified_portable` or
  `runtime_verified_browser_bound`;
- a fresh `runtime_identity_check` through the same transport used by the
  test;
- observed caller, role, tenant/domain, authentication mode, and transport;
- a redacted credential or session fingerprint; and
- agreement between the test's identity, transport, and the exact authorized
  action.

A browser-bound session replayed through raw HTTP is not the same verified
caller. Configured account labels, filenames, JWT claims, role strings,
profile fields, cookies, HTTP 200 responses, or rendered application shells do
not independently prove caller identity.

Set this gate to `missing` for `coverage_only` or `unusable` identities, stale
checks, failed login, mismatched observed caller, wrong transport, uncertain
tenant, or ambiguous session state. Do not reinterpret those failures as
target-side denial.

## Gate 2: target

Prove the exact protected object, property, function, action, workflow step, or
asynchronous effect that the caller attempted to reach.

Identify:

- operation and authorization-obligation IDs;
- action, method or operation name, route or document, API version, parser or
  content type, and relevant variant;
- every caller-controlled identifier/property carrier and the changed
  authorization dimension;
- target resource type, identifier fingerprint, lifecycle, and sensitivity;
- parent, child, relationship, source, and destination objects when distinct;
- the final protected data return, state change, worker action, integration,
  notification, signed object, export, or other side effect.

For source proof, trace the submitted target to the shipped sink. For runtime
proof, preserve the redacted request shape and stable target fingerprint.
Changing an unrelated route, parser, body shape, workflow state, or target
existence between baseline and attempted denial makes the comparison
non-discriminating.

A route name, guessed numeric ID, response size, generic function name, or
client-side navigation state does not prove the target. Set the gate to
`contradicted` when the response or action concerns only the caller's own
object, a public resource, or another target than the one claimed.

## Gate 3: ownership or tenant

Prove who owns, controls, or shares the target and which authorization domain
contains it.

Accept these provenance classes when they directly support the relationship:

- `source_attributed`: source shows the authoritative owner/tenant binding;
- `runtime_created`: a creation receipt under the owner identity attributes a
  disposable object;
- `runtime_readback`: an owner-authenticated or tenant-scoped authoritative
  read attributes the exact object.

An explicit assessment context may support the model through policy evidence,
but retain `unknown` provenance until the object itself is attributed.
`shared_unattributed`, `guessed`, and `unknown` never prove horizontal or
cross-tenant impact.

For a same-tenant peer case, caller and owner identities are distinct and the
domain is the same. For a cross-tenant case, both domain labels are proven and
different. For an own-object baseline, caller and owner match. For a
property/function finding, prove which protected owner, tenant, role, or
business authority controls that property or function.

Resolve collaboration, delegation, sharing links, inherited workspace access,
support privileges, administrator scope, and service-account grants before
claiming denial. Set the gate to `contradicted` when an applicable allow or
conditional policy legitimately grants the tested relationship.

## Gate 4: expected denial

Prove why this application should deny this exact caller-resource-action-
context tuple.

The policy rule must match:

- caller kind, role, relationship, and tenant/domain;
- action, resource and sensitive property;
- workflow state, feature or plan, authentication strength, API version, and
  other relevant context; and
- any administrator, support, sharing, delegation, or service exception.

For a confirmed candidate, prefer authority `source_policy`, `role_matrix`,
`documented_requirement`, or `explicit_context`. `runtime_baseline` may
corroborate expected denial and establish response semantics, but an owner's
successful request normally proves only that the owner is allowed. `inferred`
authority alone cannot prove a confirmed denial.

UI hiding, endpoint names, generic least-privilege expectations, assumptions
that administrators can or cannot see everything, common SaaS conventions,
schema field names, or a difference between two responses are leads only.

Record the strongest contradictory policy and resolve it. Use `missing` when
sharing or role semantics remain ambiguous. Use `contradicted` when policy
permits the behavior. Never promote an `expected_decision` of `unknown` or a
matrix result whose baseline tests a different operation shape.

## Gate 5: unauthorized impact

Prove a concrete protected effect, not request reachability.

Valid impact includes:

- protected data or another tenant's object returned to the unauthorized
  caller;
- a privileged function executed;
- a forbidden property, role, owner, permission, price, credit, entitlement,
  or verification state persisted;
- an unauthorized workflow transition or durable state change;
- an export, signed URL, notification, job, integration call, or other
  protected side effect completed; or
- a sensitive existence disclosure whose target and policy are independently
  proven.

For source confirmation, trace the caller-controlled target through a missing,
partial, or bypassable authorization obligation to the concrete serialization,
query, state-change, or side-effect sink. State the plausible protected effect
as source-observed; do not say that the attack executed.

For runtime confirmation, cite direct `runtime_response`, `object_readback`,
`audit_event`, or `test_result` evidence. Read findings identify protected
field or object classes rather than merely a non-empty body. Mutations require
before state and authoritative readback, disappearance, audit evidence, or an
equivalent persistent effect. Asynchronous acceptance requires observation of
the worker or final side effect.

HTTP 200, 202, redirects, response length/hash differences, echoed request
fields, generic JSON shells, parser reachability, 4xx/5xx differences, or an
unproven error are not unauthorized impact.

## Source-confirmed requirements

Set candidate disposition to `source_confirmed` and finding `proof_basis` to
`source` only when:

1. all five proof gates are `proven`;
2. repository-manifest evidence binds the review to an immutable revision;
3. a shipped, attacker-reachable entrypoint reaches the exact operation and
   protected sink;
4. caller influence over the target, action, property, or policy context is
   observed;
5. owner/tenant derivation and application-specific expected denial are
   evidenced;
6. the relevant obligation is `missing`, `partial`, or `bypassable` on this
   path;
7. global middleware, dependency injection, decorators, policy services,
   repository/ORM filters, serializers, database policy, workers, provider
   controls, and relevant deployment controls were checked and the strongest
   contradiction recorded;
8. alternate methods, parsers, API versions, bulk paths, GraphQL resolvers,
   and asynchronous continuations were dispositioned where applicable; and
9. wording clearly distinguishes observed source behavior from runtime proof.

A missing local check is not enough when another effective layer can enforce
the rule. Dead, test-only, generated, dependency, unreachable, or feature-
disabled code cannot support source confirmation without evidence that it is
shipped and reachable in the modeled configuration.

Source confirmation does not require an executed runtime test. A planned test
may remain linked, and assurance may remain `source_observed`.

## Runtime-confirmed requirements

Set candidate disposition to `runtime_confirmed` and finding `proof_basis` to
`runtime` only when:

1. all five proof gates are `proven`;
2. the test matches exactly one structured authorization target across origin,
   environment, surface/operation/resource IDs, tenant/domain, identity,
   transport, action/mutation scope, request/attempt limits, and time window;
3. caller identity is freshly runtime-verified through the test transport, and
   its preflight evidence shares the result's run ID and exact target;
4. the exact target has proven owner/tenant provenance;
5. the authorized baseline uses the same operation shape and succeeds;
6. the attempted denial changes only the declared authorization dimension;
7. test execution status is `failed` and result outcome is `control_failed`;
8. observed signals include `unauthorized_impact` and `control_failure`, and
   exclude `expected_denial` and `control_success`;
9. the result and its summary cite direct same-run runtime evidence, and each
   observed signal has purpose-specific evidence rather than one aggregate
   record reused for all signals;
10. an independent repetition uses fresh identity state and a fresh authorized
    control; and
11. state-changing validation uses a fresh `disposable` object, records before
    state and authoritative readback, and reports cleanup evidence.

An inconclusive, blocked, or failed-to-run test never confirms a finding.
Missing cleanup does not erase observed impact, but it is a safety failure and
publication blocker until the residual state and owner are explicitly
reported and safely resolved.

Interpret test outcomes consistently:

- `passed` / `control_held`: expected-denial and control-success signals are
  observed; unauthorized-impact and control-failure signals are absent;
- `failed` / `control_failed`: unauthorized-impact and control-failure signals
  are observed; expected-denial and control-success signals are absent;
- `inconclusive`: neither complete conclusive pair is present.

## False-positive rejection

Reject the candidate or keep it `needs_followup` when any required fact is
missing. Common rejection cases include:

- `/me`, profile, preference, subscription, or organization endpoints return
  only caller-owned or empty state;
- a public, shared, delegated, support, administrator, or service relationship
  is permitted by the applicable policy;
- an ID was guessed, harvested from a global pool, or never attributed to an
  owner or tenant;
- the caller is stale, mismatched, logged out, browser-bound on the wrong
  transport, or otherwise `coverage_only` or `unusable`;
- null, false, empty, redacted, static-shell, validation-error, parser-error,
  soft-404, resource-absence, or unproven server-error responses contain no
  protected effect;
- a status, header, response size, body hash, timing, or route-name difference
  is the only evidence;
- a method, content type, API version, GraphQL document, target existence, or
  workflow state changed between attempted denial and control;
- a source file lacks a local check but global policy, query scoping,
  serializer filtering, worker revalidation, database policy, or another
  effective control applies;
- a request echoes an owner, tenant, role, permission, status, price, credit,
  or entitlement field but does not persist or use it;
- a 202 response or queue identifier is not followed to the final side effect;
- a signed URL, export, download, or indirect reference is not shown to expose
  the protected object to the unauthorized caller;
- a crash or 500 has no proven confidentiality, integrity, availability, or
  privilege impact; or
- only the legitimate baseline failed, making the unauthorized comparison
  uninterpretable.

Keep rejected candidates with their contradiction evidence. They document that
the reviewer challenged the lead and prevent the same weak signal from being
re-promoted later.

## Independent challenge

Run a separate adversarial pass after the primary draft. Use an independent
subagent when available; otherwise use a fresh reasoning pass with instructions
that do not reveal the desired conclusions. Give it the frozen scope, evidence,
authorization model, matrix, candidates, findings, tests, and coverage.

Require the challenger to seek:

- omitted surfaces, identities, tenants, parent/child resources, properties,
  carriers, methods, parsers, versions, resolvers, and workers;
- policy exceptions, collaboration, sharing, administrator/support scope, and
  stronger contrary controls;
- false caller identity or owner/tenant attribution;
- source helpers that are declared but not invoked and controls overlooked by
  the primary reviewer;
- non-equivalent baselines, ambiguous signals, status-only impact, unsafe
  tests, protected fixtures, missing readback, and failed cleanup;
- unsupported source/runtime wording, inflated severity, duplicate findings,
  and concealed high-risk coverage gaps.

Record each challenge as `QF-` with severity, related IDs, evidence, owner,
status, and disposition. The challenger does not silently rewrite the model.
Material primary-pass changes require the challenge to be rerun.

## Quality and publication gates

Record each of these quality gates exactly once:

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

Required gates are `passed`. A gate is `incomplete` when safe follow-up could
resolve missing evidence and `failed` when the publication claim contradicts
the evidence. Use `not_applicable` only where the declared analysis basis makes
the entire gate impossible: `source_trace` may be `not_applicable` for
`runtime_only`. Runtime-specific checks may be not applicable when no runtime
action executed, but the containing `runtime_safety` gate still accounts for
proof that no action occurred and that planned tests are safely bounded.

Reject complete publication when:

- full scope lacks a frozen source or runtime surface inventory;
- source/hybrid metadata, manifest evidence, revision, content hash, and scope
  disagree;
- IDs are duplicated, malformed, dangling, or omitted from expected coverage;
- an admitted high-risk operation, relationship, carrier, property, variant,
  source path, or required runtime case remains pending, deferred, or excluded;
- a confirmed candidate has a gate other than `proven`;
- source and runtime evidence or claims are conflated;
- runtime execution exceeds exact authorization or uses protected identities
  or non-disposable mutation targets;
- an executed result lacks direct evidence or has contradictory signals;
- a finding does not map to a source- or runtime-confirmed candidate;
- a critical/high challenge remains unresolved;
- a required quality gate is missing, duplicated, `failed`, or `incomplete`;
- focused scope lacks a visible application-wide limitation;
- cleanup failure or residual mutation state is hidden; or
- artifacts contain apparent credentials, tokens, private keys, customer
  content, or unrelated personal data.

Validate the canonical JSON in strict mode before rendering. Derived Markdown,
findings, validation-plan, and coverage files are views, not independent
sources of truth.

## Clean-result gate

A clean result means no candidate satisfied all five proof gates within the
declared completed scope. It does not mean the application or its access
control is secure.

Allow an empty confirmed-finding ledger without inventing a low-value issue
only when scope/evidence, operation inventory, authorization model, expected
matrix, coverage, and independent challenge are populated and pass. Preserve
rejected leads and unresolved follow-up items where they exist.

Operations and matrix rows may be empty only when evidence shows every admitted
surface is public or not authorization-relevant and the challenger agrees. A
source-only review may be `complete` with `source_observed` assurance and
planned runtime tests when runtime was not declared in scope. A focused clean
result applies only to its named targets and cannot support an application-wide
claim.

Use wording such as: "No additional proof-gated access-control finding was
identified within the declared completed scope at source-observed assurance."
Never use "the application is secure", "access control is correct", or "no
authorization vulnerabilities exist".
