# Disputes and evidence

Model a dispute as a provider- or rail-owned case linked to, but distinct from, the payment, refund, and settlement records. One payment can have multiple disputes, including partial disputes with different reasons. Never deduplicate cases by payment ID alone.

## Persist the case envelope

For each dispute, retain:

- provider account and unique dispute/case identity;
- immutable linkage to the charge, payment attempt, order, and affected ledger entries;
- exact disputed amount and currency, reason/category, network or provider stage, and challengeability;
- provider timestamps, evidence deadline, current authoritative status, and received event identities;
- funds-withdrawal, fee, reinstatement, and later settlement evidence as separate monetary events;
- evidence draft version, canonical fingerprint, attachments, submission attempt identity, provider receipt, submission count, and ambiguity state;
- terminal decision and provenance, while still accepting later financial adjustment evidence under the provider contract.

Case status and funds movement are related projections, not one transition. A webhook saying funds were withdrawn is not necessarily the final decision; a won/lost status does not authorize inventing a ledger movement that has not been observed or contractually established.

## Own evidence as a deadline-bound operation

Treat evidence preparation, provider update, final submission, review, and decision as explicit stages. Validate required fields, attachment ownership, safe content, provider limits, and the authoritative deadline before submission. Store the exact evidence version sent so an audit can reconstruct the case.

If submission times out after transmission, mark its result ambiguous. Retrieve the provider case and its evidence details or replay only under a verified idempotency contract before sending a materially different submission. A local request timeout does not prove the provider rejected the evidence, and a local `submitted=true` written before the call does not prove acceptance.

After the evidence deadline or an unchallengeable status, fail closed according to the provider contract. A local timer may stop new attempts, but authoritative late events must still be persisted and reconciled. Human workflows need ownership, escalation before the deadline, and an append-only record of who approved each submitted version.

## Apply asynchronous evidence

Verify webhook authenticity, deduplicate event identities, and apply case transitions conditionally. Persist duplicate, stale, future, and conflicting evidence separately enough to reconcile it; provider delivery order is not financial order. Re-fetch authoritative case state when events are missing or a submission result is ambiguous.

A refund is not a portable dispute cancellation. For Stripe card disputes, even a customer withdrawal does not by itself close the case in the merchant's favor; evidence still must be submitted. Keep refunds, dispute decisions, and funds reinstatement distinct until the verified provider evidence joins them. Do not generalize Stripe status names, deadlines, or fee behavior to another acquirer, network, region, or issuing-dispute product.

## Review invariants

- Cumulative disputed and refunded amounts are checked under the provider's coexistence rules without collapsing independent case IDs.
- Duplicate or out-of-order webhooks cannot withdraw or reinstate funds twice.
- A partial dispute cannot silently become a full-payment loss in local money projections.
- A failed evidence upload is not confused with a failed evidence submission; unattached files do not count as submitted evidence.
- Finality comes from the verified case decision and financial evidence, not from elapsed local time, a customer message, or the original payment's success state.

Primary evidence: Stripe's [dispute lifecycle](https://docs.stripe.com/disputes/how-disputes-work), [Disputes API guide](https://docs.stripe.com/disputes/api), and [event type reference](https://docs.stripe.com/api/events/types). These establish Stripe behavior only.
