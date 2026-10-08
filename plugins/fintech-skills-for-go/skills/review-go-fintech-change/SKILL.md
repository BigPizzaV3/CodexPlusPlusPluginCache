---
name: review-go-fintech-change
description: "Use as lead for fintech Go diff/PR review: money, payments, settlement, payment data, and audit. Do not use for general work."
license: Apache-2.0
compatibility: "Go 1.24 or newer; product, provider, rail, and compliance contracts control the review."
---

# Review a Go fintech change

Treat any path that can invent, duplicate, lose, misstate, or conceal money as financial-integrity sensitive.

## Trace the financial effect

Follow authenticated command, money representation, idempotency identity, state transition, provider attempt, ledger posting, event, settlement evidence, reconciliation, response, and audit record. Identify exact transaction boundaries and unknown-outcome windows.

For every caller, payment, provider, or replay identity, verify its authority scope and canonical payload binding. State all three behaviors explicitly: equivalent input replays the same outcome; different input is rejected before a new effect or prior-result disclosure; wrong authority learns nothing. Saying an identity is “bound to a fingerprint” is not an enforceable finding unless the mismatch path is defined.

Treat product, provider, rail, report, and repository semantics already supplied by the task as the review contract. Choose the narrowest focused skill that owns the dominant financial effect: `go-money-and-ledgers` for arithmetic or journal invariants, `go-payment-lifecycles` for provider states, `go-financial-idempotency` for financial replay identity, `go-clearing-settlement-reconciliation` for post-capture evidence, or `go-fintech-security-compliance` for regulated data and audit controls. Do not load adjacent skills merely because the diff mentions their topic.

For report ingestion, payout, settlement, or reconciliation code, read `go-clearing-settlement-reconciliation` before findings even when business contracts are supplied. Source completeness, source and parser provenance, exclusive match-group membership, currency-preserving equations, and completion evidence are correctness invariants rather than optional background. Load another focused or cross-collection skill only when an unresolved invariant directly changes the financial finding; stop once it is resolved.

## Critical schedules

- concurrent same-key and different-payload requests;
- timeout after provider or database may have committed;
- duplicate, delayed, and out-of-order webhooks;
- partial capture/refund and cumulative amount races;
- rounding residual across allocations and currencies;
- unbalanced or mutable journal history;
- report re-ingestion and duplicate adjustment;
- late chargeback or settlement event after local terminal state;
- cross-tenant replay, excessive privilege, or sensitive data in telemetry;
- mixed versions during schema and state-machine rollout.

## Findings

Zero tolerance: silent precision loss, unbalanced committed entries, duplicate financial effects, illegal state transitions presented as success, missing reconciliation evidence, or sensitive authentication data leakage. Tie every finding to a reachable schedule and authoritative invariant. State the exact identity, amount, currency, evidence state, authority, known/failed/ambiguous outcome, durable consequence, smallest repair, and required backfill or reconciliation. Do not treat provider documentation as universal across rails.

Read [references/financial-finding-standard.md](references/financial-finding-standard.md) only when the task requires a formal audit format or a finding still lacks one of those dispositions.

## Output contract

Lead with critical financial-integrity findings, then security/compliance and operational risks. State when scheme, legal, or compliance interpretation requires a qualified owner; never infer certification.

Audit the final prose against every applicable financial-effect boundary. Do not rely on naming idempotency, reconciliation, or an adjustment to imply payload mismatch handling, evidence lineage, replay safety, exact arithmetic, or immutable correction.
