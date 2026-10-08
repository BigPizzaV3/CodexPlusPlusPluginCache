---
name: review-go-distributed-change
description: "Use to review Go diffs/PRs for distributed failures in transactions, brokers, retries, leases, or effects. Do not use for fintech."
license: Apache-2.0
compatibility: "Go 1.24 or newer; repository and deployed-system guarantees control the review."
---

# Review a Go distributed change

Find the failure schedule that violates a system invariant.

## Resolve only missing contracts

Treat semantics stated by the prompt, repository, and deployed-system documentation as the review contract. Do not load auxiliary skills or references when those sources already define the relevant transaction, broker, remote-effect, retry, or lease behavior.

When a missing contract blocks a finding, load only the matching focused skill: `go-data-consistency` for storage/commit semantics, `go-message-processing` for broker acknowledgement or ordering, `go-service-resilience` for client retry/timeout policy, or `go-distributed-coordination` for leases and fencing. Stop once the missing contract is resolved. Read [references/schedule-catalog.md](references/schedule-catalog.md) only when the changed path contains an effect boundary not covered below or a concrete counterexample is still needed.

## Build the state/effect graph

Trace admission, local reads, decisions, durable writes, remote calls, publication, acknowledgement, response, and recovery. Mark transaction boundaries, goroutine owners, retry owners, ordering keys, leases, queues, and version transitions.

## Test causal schedules

- concurrent same/conflicting identities;
- cancellation before admission, during work, and after a durable effect;
- crash immediately before and after commit, publish, and acknowledgement;
- timeout with unknown remote result;
- redelivery, duplication, delay, and reordering;
- retry at several layers under dependency overload;
- lease expiry while an owner is paused;
- mixed versions during deploy and rollback;
- recovery with cold caches, reconnects, and queued retries.

Use only schedules reachable in the changed path. Quantify maximum goroutines, queue entries, attempts, held connections, and duplicate effects where possible.

## Close every effect boundary

Before finalizing, give every applicable boundary an explicit disposition:

| Boundary | Required disposition |
|---|---|
| Database commit | State how an unknown commit is resolved by stable operation identity or an authoritative read. |
| Remote effect | State whether replay can duplicate the effect and name target-enforced idempotency, fencing, or reconciliation. |
| Publication | Preserve one logical event identity across ambiguous publication and retries. |
| Consumer acknowledgement or cumulative offset | State when it is safe, how failure or an unknown result replays, and which durable outcome makes replay harmless; never infer this from an outbox alone. |
| Lease renewal or release | Treat an unknown renewal as uncertain authority, stop unsafe work before expiry, enforce a monotonic fence at every authoritative effect, and prevent a stale release from revoking a successor. |

For every retry, enforce one end-to-end deadline and distinguish transient faults from permanent failures and ambiguous outcomes before replay. When retries or redeliveries exist at several layers, compute the configured maximum leaf attempts as their product; if a bound is unknown, leave it symbolic rather than inventing one. Assign retry ownership to one bounded layer.

For each goroutine, name its owner, derive cancellation from that lifecycle, bound each blocking operation, and join before the owner returns. Work that can outlive the request or lease must have a deliberate lifecycle and must not perform an unfenced effect after authority is lost.

## Completeness gate

Do not emit the final review while either applicable disposition is only implied:

- If consumer acknowledgement appears, state when it becomes safe, how a failed or unknown acknowledgement causes replay, and which durable outcome makes that replay harmless. Scope any exactly-once statement to the boundary that actually provides it.
- If any retry appears, state one end-to-end deadline, transient and permanent error classes, and reconciliation before replaying an ambiguous outcome.
- If two or more layers can retry or redeliver, state the product bound and select one retry owner. A numeric bound without the ownership repair is incomplete.
- If a lease appears, state the paused-owner takeover schedule, the authoritative fence, behavior after an unknown renewal, and how the renewer derives cancellation from its owner, bounds each renewal call, and terminates before release or return.

## Findings

Tie each finding to a changed line and include invariant, trigger schedule, state consequence, and smallest correction. Do not recommend retries without replay safety, locks without an authoritative boundary, or “exactly once” without naming its scope.

## Output contract

Lead with correctness and availability findings. Route monetary, ledger, settlement, or compliance consequences to `review-go-fintech-change` for domain adjudication.

Audit the final prose—not only the analysis—against every applicable completeness-gate clause. Add any missing clause to the nearest causal finding; do not rely on an inbox/outbox recommendation or attempt count to imply acknowledgement replay, retry ownership, deadline, or error classification.
