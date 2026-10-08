---
name: go-financial-idempotency
description: "Use only for financial request identity, replay, retention, and ambiguity. Do not use for non-financial effects."
license: Apache-2.0
compatibility: "Go 1.24 or newer; external idempotency guarantees must match the active provider contract."
---

# Go financial idempotency

Idempotency means equivalent retries under one authenticated operation identity produce at most one committed financial effect and a consistent outcome.

## Define identity and scope

Scope the key by tenant/principal, operation type, and target resource. Bind it to a canonical fingerprint of semantic input. Reject same-key different-input reuse. Never put PII or secrets in the key.

## Serialize first use

Use a durable unique constraint or equivalent atomic claim. Store state such as processing, succeeded, failed-final, and ambiguous; include response/result evidence, canonical fingerprint, attempt owner, lease/version, and provider operation identity. Check-then-insert without a constraint races. A process-local mutex or cache cannot survive replicas and crashes.

## Couple effect and record

When local state is the effect, write idempotency record, domain transition, ledger journal, and stored result in one transaction. For an external provider, persist the attempt before calling, reuse the same provider identity, and reconcile ambiguity before issuing a new operation.

Recover abandoned `processing` ownership with a bounded lease and compare-and-swap or fencing transition. Lease expiry proves only that the prior worker lost local ownership; it never proves an external effect failed. A taker-over must first query or reconcile using the stable provider identity, then either record the discovered result or repeat only under the provider's same-identity guarantee.

## Retention and replay

Retain records for the maximum credible client, webhook, and operational replay window. Define behavior after expiry explicitly. Do not prune while in-flight or ambiguous operations can still resolve. Return the stored outcome only if authorization and current disclosure policy allow it.

Read [references/idempotency-record.md](references/idempotency-record.md) for a state model.

When the effect crosses a payment-provider API, read [references/provider-idempotency-contract.md](references/provider-idempotency-contract.md). Provider keys differ in supported operations, scope, retention, concurrency, response replay, and regional behavior; encode the deployed endpoint contract instead of assuming a generic header supplies permanent deduplication.

## Output contract

State key scope, fingerprint, concurrency control, atomic boundary, result replay, ambiguity, and retention. Treat mismatched reuse and duplicate financial effects as critical failures.
