# Customers and mandates

Recurring payments are a different mental model from `<references/payments/>`: you
capture consent once, then charge without the customer present. This only works via
the API — not through the Mollie Dashboard.

## 1. Create a customer

```javascript
const customer = await mollie.customers.create({
  name: 'Jane Doe',
  email: 'jane@example.com',
});
// Store customer.id — every future payment, mandate, and subscription
// for this person ties back to it.
```

## 2. First payment (`sequenceType: 'first'`)

The customer must complete one real checkout using the payment method that will be
charged in the future. This is what captures their consent.

```javascript
const payment = await mollie.payments.create({
  customerId: customer.id,
  sequenceType: 'first',
  method: 'creditcard',   // or 'paypal', 'ideal', 'bancontact', etc.
  amount: { currency: 'EUR', value: '0.01' },  // token amount is fine for card/PayPal — some methods require exactly 0.00
  description: 'Authorize future charges',
  redirectUrl: 'https://example.com/setup/complete',
  webhookUrl: 'https://example.com/webhooks/mollie',
});
```

Check the specific method's requirement for the first-payment amount before
hardcoding `0.01` — some direct-debit methods require exactly `0.00`.

## 3. Mandate is created automatically

Once the first payment succeeds, Mollie creates a mandate tied to that payment
method. Fetch it to confirm it's usable before relying on it:

```javascript
const mandates = await mollie.customerMandates.page({ customerId: customer.id });
```

- `status: 'valid'` — usable for both on-demand recurring charges and subscriptions.
- `status: 'pending'` — some direct-debit mandates start here; still sufficient to
  start a subscription, but confirm current behavior for the specific method before
  assuming it can be charged on demand.

Mandate type follows the first payment's method: `creditcard`, `paypal`, or
`directdebit` (for iDEAL, Bancontact, EPS, KBC, PayByBank, Belfius — all settle via
SEPA direct debit for recurring charges even though the first payment used a
different method).

## Common mistakes

| Mistake | Fix |
|---|---|
| Charging via `sequenceType: 'recurring'` without confirming mandate status first | Check the mandate is `valid` (or the method-appropriate status) before charging |
| Reusing a payment method's mandate across different customers | Mandates are tied to one customer — never share a `mandateId` |
| Assuming every method needs the same first-payment amount | Some direct-debit methods require exactly `0.00`; confirm per method |
