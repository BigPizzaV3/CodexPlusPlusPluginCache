# Hosted Checkout

The simplest integration: Mollie hosts the entire payment page. No frontend JS required.

## Flow

1. Backend creates a payment → receives `_links.checkout` URL
2. Redirect customer to checkout URL with `303 See Other`
3. Customer pays on Mollie's page
4. Mollie sends webhook → your server fetches payment status
5. Mollie redirects customer back to your `redirectUrl`

## Create a payment

```javascript
// Node.js — mollie-api-typescript
const payment = await mollie.payments.create({
  paymentRequest: {
    amount: { currency: 'EUR', value: '99.00' },
    description: 'Order #4567',
    redirectUrl: `https://example.com/orders/4567/complete`,
    webhookUrl: 'https://example.com/webhooks/mollie',
    metadata: { orderId: '4567' },  // passed back in webhook and GET
    // Omitting 'method' shows all available payment methods on the checkout page
    // Set method: 'ideal' | 'creditcard' | 'bancontact' | etc. to pre-select
  },
});

res.redirect(303, payment._links.checkout.href);
```

## Check payment status on your redirect page

```javascript
app.get('/orders/:id/complete', async (req, res) => {
  // The redirect URL is NOT guaranteed to arrive after the webhook.
  // Fetch status from the API — do not use query params from the redirect.
  const order = await db.orders.findById(req.params.id);
  const payment = await mollie.payments.get({ paymentId: order.molliePaymentId });

  if (payment.status === 'paid') {
    res.render('order-complete', { order });
  } else {
    // Payment may still be pending — the webhook will arrive separately
    res.render('order-pending', { order });
  }
});
```

## Supported methods (common)

`ideal`, `creditcard`, `bancontact`, `paypal`, `applepay`, `googlepay`,
`klarna`, `klarnapaylater`, `klarnasliceit`, `sofort`, `belfius`, `eps`,
`giropay`, `przelewy24`, `mybank`, `sepadirectdebit`, `giftcard`

Omit `method` to let the customer choose — Mollie shows only methods enabled for your profile.
