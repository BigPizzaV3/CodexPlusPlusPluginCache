# Failed recurring payments and SEPA-specific behavior

## Retry behavior

Mollie retries failed recurring/subscription payments automatically — up to five
attempts, roughly once daily, with retry logic varying by method and failure reason.
Don't build your own retry loop on top of this; it will double-charge or conflict
with Mollie's own retries.

- If a retry succeeds, the subscription's next charge date recalculates from that
  successful payment — not from the original schedule.
- If all retries fail, the subscription is cancelled automatically.

Your webhook fires on every attempt, success or failure — use it to update your own
records, not to trigger a manual retry.

## SEPA Direct Debit failure codes

Bank-reported failure/chargeback reason codes affect the subscription differently
depending on severity. **Confirm the current code list against Mollie's docs before
hardcoding this logic** — reason codes and their handling can change.

| Behavior | Example codes | Meaning |
|---|---|---|
| Cancels subscription immediately | `AC01`, `AC04`, `AC06`, `MD07` | Invalid IBAN, closed/blocked account, deceased debtor |
| Cancels after 3 occurrences | `MD01`, `MD06`, `MS02`, `MS03`, `SL01` | No mandate, customer-requested refund, debtor refusal, unspecified, bank service issue |

Cancellation triggered by these failure reasons also **revokes the underlying
mandate** — this is different from a manual `cancel()` call, which only stops the
subscription. If recurring billing needs to resume after a mandate revocation, the
customer must complete a new first payment (`<references/recurring/customers-and-mandates.md>`)
— you cannot reuse the old mandate.

## What to build on your side

- Handle the webhook for failed subscription payments by notifying the customer
  (e.g. "your payment method needs updating") — don't wait for the 5th retry to
  surface the problem.
- Check mandate status after a subscription auto-cancels due to failures — if it was
  revoked, your UI needs to prompt for a new payment method, not just "retry
  subscription."

## Common mistakes

| Mistake | Fix |
|---|---|
| Building a custom retry loop alongside Mollie's automatic retries | Let Mollie retry; react to the final failure via webhook instead |
| Treating a failure-triggered cancellation the same as a manual one | Check whether the mandate was also revoked — it changes what recovery looks like |
| Waiting until all 5 retries fail to notify the customer | Notify on the first failure so they can act before the subscription cancels |
