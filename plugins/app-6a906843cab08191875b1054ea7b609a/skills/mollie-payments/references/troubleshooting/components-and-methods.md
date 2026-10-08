# Mollie Components token failures, payment method unavailable

## Components: `createToken()` returns an error

| Error pattern | Likely cause |
|---|---|
| Token creation fails immediately | Wrong `profileId` passed to `Mollie()`, or it belongs to a different account than the backend key |
| Token accepted by frontend, rejected by backend `payments.create()` | Token has expired — tokens are valid for 1 hour; a cached/stale token from an earlier page load was reused |
| Fields never validate as complete | Component `change` events not wired up, or components not fully mounted before the customer submits |
| Styling doesn't apply | Text/font styles must be passed via `createComponent(type, { styles })` — CSS cannot reach inside the iframe |

Always generate a fresh token per submit attempt — never store or reuse one across
retries.

## "Payment method X isn't showing up at checkout"

1. Confirm the method is actually enabled for the Mollie profile being used — this
   is configured in the Mollie Dashboard, not something the API can override at
   payment-creation time.
2. Check the payment amount and currency — some methods have minimum/maximum
   amounts or are currency-restricted, and Mollie silently excludes them from the
   method list rather than erroring.
   ```javascript
   const methods = await mollie.methods.list({
     amount: { value: '99.00', currency: 'EUR' },
   });
   // Compare against the method you expected — if it's missing here,
   // it's a profile/amount/currency issue, not a code bug
   ```
3. Test mode vs. live mode: a method enabled in live may not be enabled in test (or
   vice versa) — confirm you're checking the same mode you're testing in.
4. For issuer-based methods (iDEAL, KBC), the issuer list itself can be empty if
   `include: 'issuers'` wasn't passed to the Methods API call.

## Common mistakes

| Mistake | Fix |
|---|---|
| Assuming a missing method is an API bug | Check profile-level method configuration in the Dashboard first |
| Reusing a Components token across a failed-then-retried payment | Generate a new token for every attempt |
| Checking method availability without `amount`/`currency` | Some methods are excluded outside certain amount/currency ranges — always pass both |
