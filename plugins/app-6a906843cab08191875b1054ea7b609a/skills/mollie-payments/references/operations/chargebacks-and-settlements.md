# Chargebacks, settlements, and reconciliation

These are read/investigate operations, not actions you trigger — a merchant reacts
to a chargeback, they don't issue one. Lower risk than refunds/captures, but the
data matters for support and finance tooling.

## Chargebacks

A chargeback happens when a cardholder disputes a payment with their bank/card
issuer, outside of Mollie. If the issuer accepts the dispute, the money is reclaimed
and deducted from your Mollie balance — this is not reversible through the Mollie
API.

```javascript
// List chargebacks across your account, or scoped to one payment
const chargebacks = await mollie.paymentChargebacks.page({ paymentId: 'tr_WDqYK6vllg' });
```

- The Chargebacks API is **read-only** — there is no create/dispute endpoint. Disputing
  a chargeback happens through the card network/bank process outside Mollie, not
  through this API.
- Your webhook fires when a chargeback is received on a payment — treat it as a
  signal to flag the order for manual review, not to auto-refund or auto-cancel
  anything downstream.

## Settlements

A settlement is a payout from your Mollie balance to your bank account, generated
automatically on your configured schedule (not something you create via the API).

```javascript
const settlement = await mollie.settlements.get('stl_jDk30akdN6');
// or: await mollie.settlements.getOpen(); // the settlement currently being built
```

Each settlement's report line-items every payment, refund, capture, and chargeback
that affected the balance since the previous settlement — this is what reconciles
against your bookkeeping.

## Choosing Balances API vs. Settlements API for reconciliation

| Need | Use |
|---|---|
| Real-time current balance, without waiting for payout | Balances API |
| Time-based bookkeeping (e.g. "everything that happened this month") | Balances API — balance report |
| Reconciling against a specific bank payout | Settlements API — settlement report |
| Platform/marketplace: unsettled + open balance visibility | Balances API |

```javascript
// Real-time balance, no report generation needed
const balances = await mollie.balances.page();
```

Don't build reconciliation tooling against Settlements alone if the requirement is
"what's my balance right now" — Settlements only reflect completed payouts, not the
current open balance.
