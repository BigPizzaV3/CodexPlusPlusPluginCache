---
name: tahr-test-business-workflows
description: Model and safely abuse-test stateful business workflows, API operations, and application invariants such as checkout, billing, credits, invitations, approvals, entitlements, exports, uploads, integrations, quotas, and asynchronous jobs. Use for business-logic review, race-condition and replay testing, mass-assignment or excessive-property review, workflow bypass analysis, API version/parser comparison, or pre-pentest testing of critical product flows.
---

# Test Business Workflows

Look for normal-looking requests that produce outcomes the business never intended. Prove the outcome, not merely that an unusual value was accepted.

## Bound the work safely

1. Identify source roots, specifications, runtime scope, supplied identities, sandbox/test mode, and critical workflows.
2. Do not send live requests without clear authorization. Use source, tests, schemas, and captured traffic to model workflows otherwise.
3. Treat supplied accounts, customer data, billing objects, orders, balances, coupons, invitations, and integrations as protected.
4. Require a disposable fixture or explicit dry-run/preview/test mode before creating orders, changing plans or roles, transferring value, consuming benefits, sending messages, registering webhooks, or mutating persistent state.
5. Define before state, expected effect, authoritative readback, restoration, and cleanup before every mutation or race batch. Stop on unexpected side effects or instability.

## Reconstruct the real workflow

For each critical workflow, combine code, UI, schemas, tests, background jobs, JavaScript, and authorized traffic. Record:

- actors, roles, tenants, objects, and ownership;
- entry conditions and server-side prerequisites;
- states, transitions, terminal states, and asynchronous steps;
- authoritative values and where each value originates;
- one-time tokens, idempotency keys, approvals, expiries, counters, and quotas;
- compensating actions, cancellation, rollback, and cleanup;
- alternate API versions, clients, content types, bulk operations, and direct endpoints.

Write explicit invariants such as “the server calculates the total,” “only the current owner may approve,” “a code is redeemed once,” or “a transition requires the immediately preceding state.” Cite the evidence for each invariant; do not invent product rules from route names.

## Derive an abuse plan

Read [workflow-abuse-matrix.md](references/workflow-abuse-matrix.md). Cover applicable classes:

- boundary values, type confusion, omitted fields, extra fields, nested/array forms, and duplicate parameters;
- client-controlled price, total, discount, tax, quantity, balance, owner, tenant, role, status, approval, entitlement, or feature fields;
- direct access to later steps, skipped/reordered prerequisites, repeated actions, stale token/state reuse, and alternate actors;
- duplicate submission, idempotency collisions, last-byte/single-packet concurrency in a disposable environment, and time-of-check/time-of-use gaps;
- rate/quota limits on sensitive successful operations;
- version, method, parser/content-type, mobile/legacy, bulk, GraphQL alias/batch, and asynchronous variants;
- excessive response properties, unsafe third-party responses, webhook signature/event handling, and generated-link/cache-key trust.

Rank high-impact invariants first, but give every discovered workflow or operation a terminal disposition. Do not replace target-derived requests with guessed endpoints or generic bodies.

## Execute paired experiments

For authorized runtime work:

1. Capture a valid single-request baseline and define what proves business success.
2. Change one invariant-related dimension while holding actor, object, method, body, parser, and timing constant.
3. Use a negative control and, where useful, an authorized control.
4. Read the authoritative state after the attempt; also inspect related list, audit, balance, entitlement, or downstream job state.
5. For races, first prove sequential behavior, then run the smallest bounded synchronized batch and count business successes—not merely HTTP responses.
6. Restore or delete only disposable fixtures and record cleanup.

An accepted value, 2xx, redirect, response-size change, missing header, or multiple concurrent responses is candidate evidence until the unsafe business outcome is shown.

## Apply proof gates and chain impact

Read [workflow-proof-gates.md](references/workflow-proof-gates.md). Confirm only reproducible outcomes such as unauthorized state transition, financial/value manipulation, duplicate benefit, quota bypass, stale-token replay, persisted privileged property, sensitive overexposure, weaker old-version control, or parser-dependent security bypass.

Cross-reference a proven workflow issue with access control and dangerous-input findings. Ask whether a single-object issue scales to bulk impact, a skipped approval unlocks a privileged action, or an upload/callback field reaches another trust boundary. Test one safe higher-impact hop only when authorized; do not inflate hypothetical chains.

## Report outcomes and gaps

For each finding, preserve the intended invariant, actor/object context, baseline, manipulated request/action, before/after proof, concrete impact, repeatability, cleanup, and faithful reproduction steps. Redact tokens, cookies, payment/customer records, PII, and secrets while retaining field names, value classes, lengths, hashes, and fingerprints.

Separate confirmed findings, candidates, expected behavior, unsafe variants not attempted, missing disposable fixtures, untested race conditions, unavailable roles, asynchronous jobs not observed, and other coverage gaps. Never describe incomplete workflow coverage as secure.
