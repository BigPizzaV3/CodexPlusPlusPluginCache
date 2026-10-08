---
name: go-payment-lifecycles
description: "Use only for payment/rail authorization, capture, refund, webhook, and ambiguity. Do not use for non-financial effects."
license: Apache-2.0
compatibility: "Go 1.24 or newer; provider, rail, and scheme state semantics are version- and region-specific."
---

# Go payment lifecycles

Model provider evidence as events and local payment state as a constrained projection. A network result is not automatically a financial result.

## Define the machine

List states, legal commands, provider requests, provider evidence, terminality, amount constraints, expiry, and late-event behavior. Keep authorization, capture, refund, reversal, dispute, and settlement distinct even if the UI says “paid.”

## Handle ambiguous outcomes

A timeout or lost response after request transmission can mean success, failure, or still processing. Persist the attempt and stable provider identity, replay only under the provider's idempotency contract, identify what evidence is authoritative for this provider or rail and whether its query can lag, and reconcile asynchronous evidence. Never create a new payment identity merely because the response was missing. If the deployed provider or rail contract is unavailable, stop at a conditional state machine; do not transfer Stripe-specific idempotency, expiry, or finality semantics to ACH or another rail.

## Apply events safely

Verify authenticity before parsing into trusted events. Deduplicate by provider event or operation identity, but make handlers tolerant of out-of-order evidence. Distinguish duplicate, stale, future/missing-predecessor, conflicting, and contract-invalid evidence. Persist future evidence such as refund success arriving before capture success and reevaluate it when prerequisites arrive; quarantine only contract-invalid or irreconcilably conflicting evidence. Apply transitions conditionally against current version/state.

## Amount and terminality

Enforce cumulative capture and refund limits with exact money. Partial capture/refund and multiple disputes can coexist. “Succeeded” may be locally terminal for fulfillment while chargebacks and settlement adjustments remain possible.

For multi-capture or partial-refund flows, allocate each amount-bearing operation to stable payment, capture, shipment or item, and provider identities. Fulfill only the durably captured allocation, never a payment-wide Boolean. Persist provider capability and final-capture semantics, serialize concurrent amount decisions, and reconcile aggregate fields to item-level evidence. Read [references/partial-capture-and-refund-accounting.md](references/partial-capture-and-refund-accounting.md); its Stripe rules remain Stripe-specific.

Read [references/payment-machine.md](references/payment-machine.md) for transition and ambiguity rules.

For partial authorization, incremental authorization, capture, void, or authorization-reversal changes, read [references/authorization-adjustments.md](references/authorization-adjustments.md). Preserve requested, approved, capturable, captured, and released amounts separately; provider-specific remainder-release behavior is not a portable payment rule.

For card disputes, chargebacks, evidence, or representment, read [references/disputes-and-evidence.md](references/disputes-and-evidence.md). A dispute is its own amount-bearing case and deadline lifecycle; it is not a Boolean on the original payment or proof that a refund resolved the issuer process.

Use `go-financial-idempotency` for repeated-request identity, and `go-clearing-settlement-reconciliation` for post-capture external reports and settlement breaks.

## Output contract

Provide the state/event table, authoritative evidence, ambiguity policy, and illegal-transition handling. Do not compress the design into booleans or infer provider success from HTTP status alone.
