# Partial capture and refund accounting

## Model amounts as a conservation system

Keep requested, approved, capturable, captured, released or expired, refunded, disputed, and settled amounts distinct. Use exact currency-scale arithmetic. Derive balances from immutable amount-bearing operations and authoritative provider evidence rather than from booleans such as `Captured` or `Refunded`.

Each authorization, capture, reversal, refund, dispute, fee refund, and transfer reversal needs its own stable operation identity, canonical payload, provider identity, amount, currency, state, and evidence. Link every follow-on operation to the authorization and, where the provider exposes it, to the exact charge or capture component it changes.

Enforce provider-independent inequalities only after defining their scope. Typical card invariants include cumulative successful capture not exceeding currently approved authority and cumulative successful refund not exceeding eligible captured value, but provider fees, incremental authorization, multi-capture eligibility, reversals, disputes, and settlement adjustments need separate states rather than being forced into one subtraction formula.

## Serialize local decisions and reconcile ambiguity

Two shipment workers can both read the same capturable amount and issue individually valid captures whose total exceeds the intended allocation. Serialize or conditionally update the local allocation and stable attempt record before the remote call. Reuse the same provider idempotency identity only for an exact replay under the verified provider contract. A timeout leaves the capture or refund unresolved until authoritative retrieval, webhook evidence, or reconciliation resolves it.

Fulfillment authority follows the amount durably allocated and captured for that shipment or item, not a payment-wide success Boolean. A partial capture must not fulfill the uncaptured remainder. A partial refund must not mark every captured component refunded.

## Keep provider-specific semantics scoped

Stripe supports multiple captures only for eligible PaymentIntents and payment methods. Its multi-capture contract exposes `amount_capturable` updates; a final capture ends further capture and releases the remaining authorization. Most manual-capture payments instead allow only one capture, where partial capture releases the remainder. Persist the verified capability and API version with the payment rather than inferring multi-capture from one successful call.

For Stripe multi-capture payments, refund capacity is based on received minus refunded amount. `charge.refunded` becomes true only when the final capture has happened and the entire received amount has been refunded, so it cannot serve as the ingestion gate for partial refund events. Stripe also documents restrictions on partial refunds that request application-fee refund or transfer reversal; model those connected-account legs and outcomes separately.

Do not transfer these field names, automatic-release rules, or connected-account restrictions to another provider. Record the provider, account, region, payment method, capability, API version, and evidence source for every rule used by the projection.

## Reconcile the amount graph

Reconcile local capture and refund operations against provider capture/charge/refund objects and later settlement evidence. Classify missing, duplicate, conflicting, reversed, late, and amount-mismatched components explicitly. Webhook order or one aggregate provider field does not replace item-level identity and evidence.

Test concurrent partial captures, an ambiguous capture followed by a webhook, final capture with an uncaptured remainder, partial refunds before and after final capture, duplicate and reordered refund events, refund limits, connected-account fee and transfer legs, authorization expiry, and provider capability changes.
