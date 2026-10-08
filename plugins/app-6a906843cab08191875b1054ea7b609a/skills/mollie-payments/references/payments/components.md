# Mollie Components (Mollie.js)

Mollie Components lets you embed PCI-DSS SAQ-A compliant card fields directly in your checkout.
Card data is captured inside iframes — your server never handles raw card numbers. Instead, the
library exchanges card data for a short-lived `cardToken` that you pass to the Mollie Payments API.

## Full integration flow

1. Load `mollie.js` in the browser
2. Initialise `Mollie(profileId)` with your **profile ID** (not your API key)
3. Create and mount component(s) into your form
4. Listen for `change` events on each component to show validation errors inline
5. On form submit, call `mollie.createToken()` to get a `cardToken`
6. POST the `cardToken` to your backend (hidden form field or JSON body)
7. Backend creates a payment with `method: 'creditcard'` and `cardToken`
8. Redirect the customer to `_links.checkout` for 3D Secure

## 1. Load the script

```html
<!-- Add before </body> — never load from a CDN mirror, only from js.mollie.com -->
<script src="https://js.mollie.com/v1/mollie.js"></script>
```

**CSP headers required:**
```
script-src: js.mollie.com
frame-src:  js.mollie.com
style-src:  'unsafe-inline'
```

## 2. Initialise

```javascript
// profileId is pfl_xxx — find it in the Mollie Dashboard under Developers > Your profile
// Never use your API key (live_xxx / test_xxx) here
const mollie = Mollie('pfl_3RkSN1zuPE', {
  locale: 'en_US',  // controls error message language
  testmode: false,  // set true for test payments; must match the API key used on the backend
});
```

## 3a. Single card component (simplest)

Use this when you want Mollie to render and lay out all fields together.

```html
<form id="checkout-form">
  <div id="card"></div>
  <div id="card-error"></div>
  <button type="submit">Pay</button>
</form>
```

```javascript
const cardComponent = mollie.createComponent('card');
cardComponent.mount('#card');

cardComponent.addEventListener('change', (event) => {
  document.querySelector('#card-error').textContent =
    event.error && event.touched ? event.error : '';
});
```

## 3b. Separate fields (more control over layout)

Use when you need full control over the form layout and styling.

```html
<form id="checkout-form">
  <div>
    <label>Card number</label>
    <div id="card-number"></div>
    <span id="card-number-error" class="field-error"></span>
  </div>
  <div>
    <label>Card holder</label>
    <div id="card-holder"></div>
    <span id="card-holder-error" class="field-error"></span>
  </div>
  <div>
    <label>Expiry date</label>
    <div id="expiry-date"></div>
    <span id="expiry-date-error" class="field-error"></span>
  </div>
  <div>
    <label>CVC / CVV</label>
    <div id="verification-code"></div>
    <span id="verification-code-error" class="field-error"></span>
  </div>
  <button type="submit">Pay</button>
</form>
```

```javascript
const components = {
  cardNumber:       mollie.createComponent('cardNumber'),
  cardHolder:       mollie.createComponent('cardHolder'),
  expiryDate:       mollie.createComponent('expiryDate'),
  verificationCode: mollie.createComponent('verificationCode'),
};

// Mount each component into the corresponding DOM element
components.cardNumber.mount('#card-number');
components.cardHolder.mount('#card-holder');
components.expiryDate.mount('#expiry-date');
components.verificationCode.mount('#verification-code');

// Wire up inline validation errors for each field
for (const [key, component] of Object.entries(components)) {
  const errorEl = document.querySelector(`#${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-error`);
  component.addEventListener('change', (event) => {
    errorEl.textContent = event.error && event.touched ? event.error : '';
  });
}
```

## 4. Tokenise on submit and send to backend

```javascript
document.querySelector('#checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const { token, error } = await mollie.createToken();

  if (error) {
    // Show the error to the user — do not submit the form
    console.error('Token error:', error);
    return;
  }

  // Option A: hidden form field
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'cardToken';
  input.value = token;
  e.target.appendChild(input);
  e.target.submit();

  // Option B: fetch / XHR (for SPAs)
  // await fetch('/api/create-payment', {
  //   method: 'POST',
  //   body: JSON.stringify({ cardToken: token }),
  //   headers: { 'Content-Type': 'application/json' },
  // });
});
```

**Token validity:** 1 hour. Never cache or reuse tokens.

## 5. Backend: create the payment

```typescript
// Node.js — mollie-api-typescript
import { Client } from 'mollie-api-typescript';

// Injected from your secret manager / deployment config
declare const mollieApiKey: string;

const mollie = new Client({ security: { apiKey: mollieApiKey } });

const payment = await mollie.payments.create({
  paymentRequest: {
    method: 'creditcard',
    amount: { currency: 'EUR', value: '29.99' },
    description: 'Order #1234',
    redirectUrl: 'https://example.com/order/1234/complete',
    webhookUrl: 'https://example.com/webhooks/mollie',
    cardToken: req.body.cardToken,   // ← from the frontend
  },
});

// Redirect the customer — use 303 See Other (GET redirect), never 302/POST
res.redirect(303, payment._links.checkout.href);
```

## 6. Styling

Components render inside iframes, so **text/font styles must be passed via options**, not CSS.
Container-level styles (borders, backgrounds) can be set via CSS classes.

```javascript
const options = {
  styles: {
    base: {
      color: '#1a1a1a',
      fontSize: '16px',
      fontFamily: 'Inter, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    valid: {
      color: '#059669',
    },
    invalid: {
      color: '#dc2626',
    },
  },
};

const cardNumber = mollie.createComponent('cardNumber', options);
```

CSS classes on the container div:

| Class | When present |
|---|---|
| `.mollie-component` | Always |
| `.mollie-component--is-loading` | While iframe loads |
| `.is-touched` | After first focus |
| `.is-valid` | Valid input |
| `.is-invalid` | Invalid input while focused |

## Common mistakes

| Mistake | Fix |
|---|---|
| Using `live_xxx` / `test_xxx` API key in `Mollie()` | Use `pfl_xxx` profile ID in the browser only |
| Frontend `testmode: false` but test API key on backend | Must both be test or both be live |
| Not redirecting to `_links.checkout` | Always redirect for 3D Secure, even if not required |
| Retrying a failed payment | Create a new token → new payment on failure |
| Styling text via CSS | Pass font/color inside `createComponent(type, { styles })` |
| Token cached between page loads | Tokens expire after 1 hour — generate fresh on each submit |
| Profile ID from wrong account | `pfl_xxx` must belong to the same account as the backend API key |
