# Runtime Access-Control Test Safety

Use this contract before sending any access-control test request. Default to
source-only review. Run tests only against the exact environment, identities,
objects, transports, and action classes the owner explicitly authorized.

## Table of contents

- [Require explicit authority](#require-explicit-authority)
- [Protect identities and customer state](#protect-identities-and-customer-state)
- [Validate caller identity](#validate-caller-identity)
- [Prove target ownership and tenancy](#prove-target-ownership-and-tenancy)
- [Design discriminating tests](#design-discriminating-tests)
- [Use a least-destructive execution order](#use-a-least-destructive-execution-order)
- [Apply protocol-specific safeguards](#apply-protocol-specific-safeguards)
- [Require semantic proof](#require-semantic-proof)
- [Handle failures and uncertainty](#handle-failures-and-uncertainty)
- [Protect evidence](#protect-evidence)
- [Clean up and respond to incidents](#clean-up-and-respond-to-incidents)
- [Complete runtime testing](#complete-runtime-testing)

## Require explicit authority

Before runtime interaction, record:

- target origin and environment;
- allowed transport and interfaces;
- approved identities and tenants;
- permitted read-only and state-changing action classes;
- prohibited data, workflows, and infrastructure;
- request, concurrency, and time limits;
- approved test window and stop conditions;
- cleanup and incident contacts.

Represent each grant as a structured authorization target, not a prose-only
permission note. Bind it to an authorization target ID, exact origin and
environment, surface and operation IDs, resource IDs, allowed tenants or
authorization domains, transports, identity IDs, action classes, mutation
resources/carriers, maximum requests, maximum attempts per test, and an exact
`valid_from`/`expires_at` window. An executed test must fit one—and only one—
such target in every dimension. Prose `constraints` may narrow the grant but
never broaden a missing structured field. Treat `max_requests` as the total
budget shared by every executed test bound to that authorization target, not a
fresh allowance for each test. A target's `expires_at` must not outlive the
global runtime-authorization expiry.

Treat permission to review source as no permission to start the application,
log in, refresh sessions, send requests, create data, or mutate state. Treat
authorization for read-only requests as no permission for writes, deletes,
races, account changes, billing actions, messages, webhooks, or external side
effects. Stop and request authority when scope is missing or contradictory.

Do not test production merely because credentials work there. Verify the exact
origin before every session setup and state-changing sequence. Do not bypass
network, browser, or environment restrictions imposed by the assessment.

## Protect identities and customer state

Treat every supplied assessment account as protected. Use protected accounts
only as callers for safe requests. Never use them as destructive targets.

Do not delete, disable, block, lock, rename, re-role, transfer, impersonate, or
take over a protected account. Do not change its password, email, profile,
MFA, passkeys, recovery methods, API tokens, sessions, or account-wide logout
state. Do not use its identifier as the victim in a destructive workflow.

For state-changing tests:

1. Use a clearly labeled disposable account or object created for the test.
2. Verify that it is outside the protected identity set.
3. Record its owner, tenant, initial state, creation evidence, and cleanup plan.
4. Avoid real customer, financial, regulated, operational, or shared data.
5. Skip the mutation when ownership or disposability is uncertain.

Do not use a successfully gained role, ownership change, or cross-tenant access
to expand testing. Preserve the smallest proof, restore safe test state, and
return to the original authorized identity.

## Validate caller identity

Bind each runtime caller to:

- observed user or service identity;
- expected role and tenant or authorization domain;
- exact origin, transport, cookie/header mechanism, and session fingerprint;
- freshness and validation time;
- a safe current-caller or equivalent identity assertion.

Keep configured labels, filenames, token claims, and observed runtime identity
as separate evidence. Flag mismatches and stop using that identity for proof.
A token-shaped value, successful login, or HTTP 200 alone does not establish
which principal the application recognized.

Immediately before a test run, perform one bounded preflight per identity.
Record each preflight as observed `runtime_identity_check` evidence under the
same `run_id`, origin, and transport as the result. The check must be no more
than 15 minutes old when the test executes and must be referenced by both the
identity and result. Treat timeout,
rate limiting, upstream failure, expired auth, redirect loops, challenge pages,
and 5xx responses as inconclusive. Isolate the failing identity; do not relabel
its failures as application denials. Refresh at most within the authorized
session procedure and retry budget.

## Prove target ownership and tenancy

Use only owner-attributed targets. Establish attribution through one or more of:

- creation and authoritative readback under the owner identity;
- an owner-scoped list or detail baseline;
- a trusted administrative fixture or documented relationship;
- source-backed test fixture data confirmed in the target environment.

Record resource type, exact identifier and carrier, owner/controller, tenant,
sensitivity, lifecycle, and provenance. Treat shared ID pools, guessed adjacent
IDs, random UUIDs, identifiers seen in logs, and objects merely visible to an
administrator as targeting leads—not ownership proof.

Do not call a `/me`, profile, preferences, session, or current-organization
response cross-user access unless it returns or changes another principal’s
state and that foreign attribution is proven.

## Design discriminating tests

For each test, define before execution:

- the application-specific expected rule;
- authorized caller and authorized target baseline;
- unauthorized caller relationship being changed;
- exact request shape and identifier/property carrier;
- control-held signal and control-failure signal;
- concrete protected data or action that would prove impact;
- authoritative readback or equivalent side-effect check;
- cleanup and stop condition.

Pair every unauthorized attempt with an authorized request of the same
operation shape. Change one authorization dimension at a time: caller, owner,
tenant, role, object ID, sensitive field, method, parser, workflow state, or
GraphQL selection. Keep other values stable enough to distinguish an access
control decision from validation, object absence, or business-state changes.

Use fresh identity state and a fresh authorized control to repeat any apparent
failure before confirming it. Do not use body size or hash equality alone;
compare the semantic protected fields, object identity, and side effect.

## Use a least-destructive execution order

Execute the smallest safe proof first:

1. Inspect source, schema, and existing authorized baselines.
2. Use safe metadata or read-only requests when they answer the question.
3. Test unauthenticated and cross-identity reads with owner-attributed fixtures.
4. Test non-destructive function and field boundaries.
5. Use reversible writes only when read-only evidence cannot prove the issue.
6. Run delete, race, external-callback, billing, messaging, or high-volume tests
   only when specifically authorized and isolated to disposable state.

Do not send a mutating request without a valid minimal body and known target.
Do not issue DELETE against an unresolved, shared, customer-owned, protected,
or production-critical object. Do not test concurrency against money,
inventory, quotas, notifications, authentication state, or external systems
unless the owner supplied an isolated fixture and explicit limits.

Bound requests, retries, concurrency, aliases, batch sizes, and generated
objects. Honor rate limits and back off on 429 or service degradation. Stop a
test family when repeated requests no longer add proof.

## Apply protocol-specific safeguards

For REST and RPC:

- test only evidenced methods, parsers, overrides, routes, and versions;
- require a denied or control-held baseline before method or parser bypass;
- preserve the same target and authorization boundary across variants;
- treat redirects, shells, generic errors, and content negotiation failures as
  transport diagnostics.

For GraphQL:

- inspect `data`, `errors`, partial data, and null fields; ignore HTTP 200 as an
  authorization verdict;
- start with narrow selections and bounded aliases;
- test nested fields, fragments, batches, mutations, and subscriptions only
  where the schema and scope justify them;
- mutate one forbidden input field at a time and read it back;
- require an actual unauthorized delivered event for subscription impact.

For asynchronous operations:

- distinguish queue acceptance from completed effect;
- use a bounded status/readback check and stop at the agreed timeout;
- verify the eventual object, file, event, notification, callback, or audit
  effect under the correct owner and tenant;
- prevent callbacks, emails, messages, and webhooks from reaching real users or
  third parties.

## Require semantic proof

Confirm a runtime finding only when all five gates pass:

1. Prove the exact caller and trusted runtime authorization state.
2. Prove the exact target object, property, function, or workflow action.
3. Prove its owner, controller, tenant, or required relationship.
4. Prove why this application should deny that caller.
5. Prove protected data disclosure or a concrete unauthorized effect.

For reads, retain the unauthorized caller-to-foreign-target request and the
legitimate owner-to-same-target control. Identify the protected fields or
resource semantics; a non-empty response is insufficient.

For writes, require authoritative post-state readback, disappearance, audit
evidence, or another persistent side effect. Treat 2xx, 202 acceptance, an
echoed body, a changed response hash, or a success message as a lead only.

For method, parser, or route variants, retain the control-held baseline and the
alternate request against the same target. Require protected data or a proven
action, not mere reachability.

For parameter or mass-assignment tests, retain baseline and tampered requests,
change one authorization-relevant property, and prove the value or privilege
persisted or changed control flow.

## Handle failures and uncertainty

Classify these as diagnostic or inconclusive unless semantic impact is proven:

- 200 with empty, null, false, generic, or caller-owned output;
- 400, 401, 403, 404, 409, 429, or 5xx status alone;
- soft 404s, SPA shells, login pages, WAF/challenge pages, and redirects;
- validation differences, object enumeration oracles, timing differences, and
  response size/hash changes;
- stale or mismatched sessions and transport-incompatible credentials;
- accepted asynchronous work without completed effect;
- expected sharing, support, administrator, or public behavior;
- results whose baseline changed in more than the authorization dimension.

Do not turn missing proof into certainty. Record `inconclusive` or `blocked`,
the exact reason, evidence already collected, and the smallest safe follow-up.
Do not repeat an unsafe test merely to improve coverage.

## Protect evidence

Retain the minimum evidence needed to reproduce and understand the result:

- timestamp, origin, exact environment and transport, method/operation, and
  redacted request shape;
- caller/session fingerprint without reusable credentials;
- target and owner/tenant attribution;
- response status and redacted semantic excerpt;
- readback, control, and cleanup references;
- run or revision provenance.

Give each run one stable `run_id`. All runtime evidence supporting its result,
including identity preflights and observed signals, must use that run ID and
exact target. Map every observed signal to purpose-specific evidence. Do not
reuse one aggregate traffic capture or test-result record as the only support
for caller identity, target attribution, baseline, denial/impact, readback, and
cleanup. Record actual request and attempt counts and stop before either the
test plan or authorization target limit is reached.

Never store raw passwords, session cookies, bearer tokens, API keys, MFA or
recovery values, personal data, or unrelated response bodies in findings or
logs. Redact deterministically before writing. If redaction cannot be applied,
omit the sensitive body and retain a one-way fingerprint plus safe field names;
never fail open by writing the original value.

## Clean up and respond to incidents

After each state-changing sequence:

1. Verify the final state before cleanup.
2. Restore or delete only the disposable data created for the test.
3. Confirm cleanup through authoritative readback.
4. Record residual state and any cleanup that was unsafe or impossible.
5. Confirm protected identities remain usable and unchanged.

If a protected account, customer object, external system, or production
workflow is affected unexpectedly, stop that test path immediately. Preserve
redacted evidence, avoid speculative repair, notify the designated contact,
and wait for direction before further state-changing work.

## Complete runtime testing

Before marking runtime coverage complete:

- disposition every planned matrix cell as passed, failed, inconclusive,
  blocked, deferred, or out of scope;
- retain unavailable identities and unsafe fixtures as visible limitations;
- verify that priority ranking did not erase unexecuted tests;
- confirm every accepted finding passes all proof gates and has a safe repro;
- confirm every mutation has readback and cleanup evidence;
- reject stale, shared-ID, status-only, hash-only, and error-only candidates;
- state the exact environment, time, scope, and assurance achieved;
- never conclude that the application is secure from a clean test result.
