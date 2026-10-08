# Sales Invoices (Revenue Collection)

**Disambiguate this first, before writing any code.** Mollie has two unrelated
"invoice" concepts:

| API | Endpoint | Who it's for | Purpose |
|---|---|---|---|
| **Sales Invoices** (Revenue Collection) | `/v2/sales-invoices` | The merchant's own customers | The merchant invoices *their* customer for goods/services — this page |
| **Invoices** | `/v2/invoices` | The merchant | Mollie bills *the merchant* for Mollie's own transaction fees — unrelated, read-only, nothing to build here |

If the request is "how do I send my customer an invoice" or mentions payment
terms, VAT lines, or B2B billing — it's Sales Invoices. If it's about Mollie's own
fee statements, there's no integration to build; that's just something a merchant
reads in their dashboard.

## When to use Sales Invoices instead of a payment or payment link

| Situation | Use |
|---|---|
| B2B billing with payment terms (e.g. "net 30"), VAT line items, or a formal invoice document | Sales Invoices |
| Real-time checkout, single amount, immediate payment | Payments API — `<hosted-checkout.md>` |
| Sharing a link for payment with no formal invoice document | Payment link — `<payment-links.md>` |

## Status lifecycle — issuing is a real, hard-to-undo action

A sales invoice has a `status` field: `draft` → `issued` → `paid` / `cancelled`.

- **`draft`** — saved, not sent to anyone. Fully editable. Safe to create freely.
- **`issued`** — sent to the recipient. This is a real communication to a real
  person, not just a database write.
- **`paid`** — marks the invoice as settled (does not itself charge anything).
- **`cancelled`** — voids the invoice.

Apply the same rule `<operations/write-action-safety.md>` applies to refunds and
captures here: **never issue an invoice as a side effect of an unrelated request.**
If a developer asks for a "batch job" or "cleanup script" that includes issuing
invoices, call that out explicitly and confirm scope before generating the code.
Default to `status: 'draft'` unless the developer has explicitly confirmed the
invoice should go out immediately.

## Create a sales invoice

```javascript
// Node.js — mollie-api-typescript
const invoice = await mollie.salesInvoices.create({
  salesInvoiceRequest: {
    status: 'draft', // 'draft' saves only; 'issued' sends it; 'paid' records payment immediately
    recipientIdentifier: 'customer-4567', // your own internal identifier for this recipient
    recipient: {
      type: 'business',
      organizationName: 'Acme B.V.',
      email: 'billing@acme.example',
      streetAndNumber: 'Keizersgracht 1',
      postalCode: '1015 CJ',
      city: 'Amsterdam',
      country: 'NL',
    },
    lines: [
      {
        description: 'Consulting services — March',
        quantity: 1,
        vatRate: '21.00',
        unitPrice: { currency: 'EUR', value: '1500.00' },
      },
    ],
    paymentTerm: '30 days', // options: 7/14/30/45/60/90/120 days
    memo: 'Thank you for your business.',
    vatScheme: 'standard', // or 'one-stop-shop' for OSS-eligible cross-border sales
  },
});
```

- `isEInvoice` is only available for recipients in BE, DE, and NL, and **cannot be
  changed after issuance** — confirm this up front if the developer needs e-invoicing.
- Update a draft invoice with `salesInvoices.update()` — draft invoices are fully
  editable; setting `status: 'issued'` on update sends it, `status: 'cancelled'` voids it.

## Reading back invoices

```javascript
const invoices = await mollie.salesInvoices.list({ limit: 50 });
const invoice = await mollie.salesInvoices.get({ salesInvoiceId: 'invoice_4Y0eZitmBnQ6IDoMqZQKh' });
```
