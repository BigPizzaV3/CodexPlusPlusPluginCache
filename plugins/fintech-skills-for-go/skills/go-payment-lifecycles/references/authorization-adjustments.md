# Authorization adjustments and follow-on operations

Do not model authorization as one Boolean or amount. Persist exact currency and at least the requested, approved, incrementally approved, reversed or released, captured, and remaining capturable amounts. Keep refunds, disputes, fees, and settlement adjustments as later evidence dimensions rather than subtracting them from the authorization record.

## Bind follow-on operations

Every capture, incremental authorization, void, and authorization reversal needs a stable local operation identity, canonical payload, provider request identity, and explicit link to the provider's predecessor transaction. Enforce cumulative amount and legal-state predicates atomically before sending or applying evidence. A retry of an ambiguous follow-on operation reuses its identity or reconciles; it does not create an unrelated operation.

When a provider partially approves an authorization, use the approved amount—not the requested amount—as the starting authority. Track multiple captures and reversals as individual operations so concurrent or late evidence cannot exceed the currently authorized amount or erase history.

## Treat capabilities as provider data

Record the verified provider, rail, region, payment-method, and version contract for:

- partial and incremental authorization support;
- single or multiple partial captures;
- whether final or partial capture releases the unused hold automatically;
- void eligibility before processor submission;
- full or partial authorization reversal support;
- authorization expiry and any provider-returned capture deadline.

For example, one provider may automatically release the remainder after partial capture while another requires or conditionally performs a partial authorization reversal. A void of an unprocessed capture can still leave the underlying authorization hold in place. Encode the observed capability; do not infer release from a generic `canceled` state.

Use provider evidence—not a replica's wall clock alone—to resolve expiry, capture, reversal, or late success. When the provider outcome is unknown or its query can lag, keep the operation ambiguous and reconcile asynchronous evidence. Record any forced manual resolution as a new auditable decision rather than rewriting the original authorization.
