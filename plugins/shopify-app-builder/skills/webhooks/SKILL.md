---
name: webhooks
description: "Webhook delivery methods, verification, retry behavior, payload handling, and implementation patterns for Shopify events. Triggers include: 'set up webhook', 'verify webhook signature', 'webhook delivery', 'HMAC verification', 'webhook retry', 'event subscription', 'webhook payload', 'AWS EventBridge Shopify', 'Google Pub/Sub webhook', 'webhook manifest'."
---

# Shopify Webhooks Implementation Guide

## When to Use This Skill

Use webhooks when you need to:
- Receive real-time event notifications from Shopify (orders, products, customers, fulfillments, etc.)
- Sync external systems with Shopify data changes
- Trigger automated workflows based on shop events
- Monitor GDPR compliance actions (customer data erasure, shop deletion)
- Process bulk operations completion
- Update inventory or pricing in third-party systems

## Webhook Delivery Methods

### 1. HTTPS (Traditional)

Most common delivery method. Webhooks sent as POST requests to your publicly accessible HTTPS endpoint.

**Characteristics:**
- Requires public HTTPS endpoint (443, TLS 1.2+)
- Real-time delivery (within seconds)
- Max 5 retries over 48 hours (exponential backoff: 10s, 30s, 1m, 2m, 8h)
- Request timeout: 30 seconds
- Payload size: max 2MB
- Rate limiting: respect Shopify API rate limits

**Configuration Example:**
```json
{
  "deliveryMethod": {
    "https": {
      "address": "https://myapp.example.com/webhooks/shopify"
    }
  },
  "query": "subscription { event { id occurredAt } }",
  "filter": "orders/created"
}
```

### 2. AWS EventBridge

Asynchronous delivery via AWS EventBridge. Events queued in partner event bus.

**Characteristics:**
- No public endpoint needed
- Queued delivery (managed by EventBridge)
- Scalable, event-sourcing ready
- Requires AWS EventBridge partner event bus setup
- Lower operational overhead
- Better for high-volume events

**Setup Steps:**
```bash
# 1. Shopify creates AWS partner event bus in your account
# 2. Your app subscribes to webhooks via EventBridge configuration
# 3. Events appear in partner event bus: aws.partner/shopify.com/[app-id]/[account-id]

# 3. Create rule to route to your targets (SQS, Lambda, etc.)
aws events put-rule \
  --name shopify-webhook-router \
  --event-bus-name aws.partner/shopify.com/12345/default \
  --state ENABLED
```

**Example Event:**
```json
{
  "detail-type": "orders/created",
  "detail": {
    "id": "gid://shopify/Order/123456",
    "displayOrderNumber": "#1001",
    "email": "customer@example.com",
    "createdAt": "2026-05-04T14:30:00Z",
    "totalPriceSet": {
      "shopMoney": {
        "amount": "299.99",
        "currencyCode": "USD"
      }
    }
  },
  "source": "aws.partner/shopify.com/12345/default"
}
```

### 3. Google Cloud Pub/Sub

Event streaming via Google Pub/Sub. Decoupled, scalable webhook delivery.

**Characteristics:**
- No public endpoint needed
- Managed queue with exactly-once semantics
- Scalable message processing
- Requires Google Cloud project setup
- Integration with Cloud Functions, Dataflow, etc.
- Best for data pipeline workflows

**Configuration:**
```bash
# 1. Create Pub/Sub topic in Google Cloud
gcloud pubsub topics create shopify-webhooks

# 2. Subscribe your app to receive messages
gcloud pubsub subscriptions create shopify-webhook-sub \
  --topic=shopify-webhooks \
  --push-endpoint=https://your-service.com/pubsub-handler

# 3. Create service account for Shopify to publish
gcloud iam service-accounts create shopify-publisher
gcloud pubsub topics add-iam-policy-binding shopify-webhooks \
  --member=serviceAccount:shopify-publisher@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

## HMAC Verification (HTTPS Only)

All HTTPS webhooks are signed with HMAC-SHA256. Always verify signatures.

**Headers:**
- `X-Shopify-Hmac-SHA256`: Base64-encoded HMAC-SHA256 signature
- `X-Shopify-Shop-Api-Access-Token`: OAuth token used (for debugging)
- `X-Shopify-Webhook-Id`: Unique webhook instance ID
- `X-Shopify-Topic`: Event topic (e.g., "orders/created")
- `X-Shopify-Transmitted-At`: ISO 8601 timestamp

**Verification Algorithm:**

```javascript
// Node.js verification
const crypto = require('crypto');

function verifyWebhookSignature(req, secret) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const body = req.rawBody; // Must be raw bytes, not parsed JSON

  // Compute expected HMAC
  const computed = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(computed)
  );
}

// Express middleware example
app.use(express.raw({ type: 'application/json' }));

app.post('/webhooks/shopify', (req, res) => {
  if (!verifyWebhookSignature(req, process.env.SHOPIFY_WEBHOOK_SECRET)) {
    return res.status(401).send('Unauthorized');
  }

  const event = JSON.parse(req.body);
  // Process webhook...
  res.status(200).send('OK');
});
```

**Python Verification:**

```python
import hmac
import hashlib
import base64

def verify_webhook_signature(request, secret):
    hmac_header = request.headers.get('X-Shopify-Hmac-SHA256')
    body = request.get_data()  # Raw bytes

    computed = base64.b64encode(
        hmac.new(
            secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).digest()
    ).decode('utf-8')

    return hmac.compare_digest(hmac_header, computed)

from flask import Flask, request

@app.route('/webhooks/shopify', methods=['POST'])
def handle_webhook():
    if not verify_webhook_signature(request, SHOPIFY_WEBHOOK_SECRET):
        return 'Unauthorized', 401

    event = request.get_json()
    # Process webhook...
    return 'OK', 200
```

## Webhook Events and Payloads

### Order Events

**orders/created** - New order placed
```graphql
subscription {
  event {
    id
    occurredAt
    ... on OrderCreatedEvent {
      order {
        id
        displayOrderNumber
        email
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 10) {
          edges {
            node {
              id
              title
              quantity
              variantId
            }
          }
        }
      }
    }
  }
}
```

**orders/updated** - Order modified
```graphql
subscription {
  event {
    ... on OrderUpdatedEvent {
      order {
        id
        status
        fulfillmentStatus
        tags
      }
    }
  }
}
```

**orders/cancelled** - Order cancellation
```graphql
subscription {
  event {
    ... on OrderCancelledEvent {
      order {
        id
        cancelReason
        cancelledAt
      }
    }
  }
}
```

### Product Events

**products/create** - New product
**products/update** - Product modified
**products/delete** - Product deleted

### Customer Events

**customers/create** - New customer account
**customers/update** - Customer data changed
**customers/delete** - Customer deleted (GDPR)

### Fulfillment Events

**fulfillments/created** - Items shipped
**fulfillments/updated** - Fulfillment status changed
**fulfillment_orders/scheduled** - Order ready to ship

### GDPR Events

**shop/redact** - Shop deletion requested
**customers/redact** - Customer data erasure
**orders/redact** - Order redaction (72-hour compliance)

## Webhook Manifest Configuration

Modern apps define webhooks in `shopify.app.toml`:

```toml
scopes = "write_orders,read_products"

webhooks = {
  orders_create = {
    uri = "api/webhooks/orders-create"
    filter_query = "query { event { id occurredAt } }"
  }
  orders_update = {
    uri = "api/webhooks/orders-update"
  }
  products_create = {
    uri = "api/webhooks/products-create"
  }
  fulfillments_create = {
    uri = "api/webhooks/fulfillments-create"
  }
  customers_redact = {
    uri = "api/webhooks/gdpr/customers-redact"
  }
  orders_redact = {
    uri = "api/webhooks/gdpr/orders-redact"
  }
  shop_redact = {
    uri = "api/webhooks/gdpr/shop-redact"
  }
}
```

## Retry Behavior

HTTPS webhooks use exponential backoff:

| Attempt | Delay | Total Time |
|---------|-------|-----------|
| 1 | Immediate | 0s |
| 2 | 10 seconds | 10s |
| 3 | 30 seconds | 40s |
| 4 | 1 minute | 1m 40s |
| 5 | 2 minutes | 3m 40s |
| 6 | 8 hours | 8h 3m 40s |

**Retry Conditions:**
- HTTP 5xx errors: always retry
- HTTP 4xx errors: no retry (except 429)
- 429 Too Many Requests: respect Retry-After header, retry
- Connection timeout: retry
- SSL/TLS errors: no retry (fix cert, reregister)
- Response timeout (30s): retry

**Idempotent Processing Pattern:**

```javascript
const db = require('./database');

app.post('/webhooks/shopify', async (req, res) => {
  if (!verifyWebhookSignature(req, SECRET)) {
    return res.status(401).send('Unauthorized');
  }

  const webhookId = req.headers['x-shopify-webhook-id'];
  const event = JSON.parse(req.body);

  // Check if already processed
  const existing = await db.webhookLog.findOne({ webhookId });
  if (existing) {
    return res.status(200).send('Already processed');
  }

  try {
    // Process event
    if (event.id.includes('Order')) {
      await handleOrderEvent(event);
    }

    // Record successful processing
    await db.webhookLog.create({
      webhookId,
      topic: req.headers['x-shopify-topic'],
      processedAt: new Date(),
      status: 'success'
    });

    res.status(200).send('OK');
  } catch (error) {
    // Log error, let retry happen
    console.error('Webhook processing failed:', error);
    res.status(500).send('Processing error');
  }
});
```

## GDPR Compliance Webhooks

Handle data erasure requests within 30 days.

**Customer Redaction (24-hour notice):**
```graphql
subscription {
  event {
    ... on CustomerRedactEvent {
      customerId
      ordersToRedact
    }
  }
}
```

Handler implementation:
```javascript
app.post('/webhooks/gdpr/customer-redact', async (req, res) => {
  const { customerId, ordersToRedact } = req.body;

  // Delete all customer data
  await db.customers.deleteOne({ shopifyId: customerId });
  await db.orders.updateMany(
    { _id: { $in: ordersToRedact } },
    { $unset: { customerEmail: '', customerPhone: '' } }
  );

  res.status(200).send('Redacted');
});
```

**Shop Redaction (48-hour notice):**
```javascript
app.post('/webhooks/gdpr/shop-redact', async (req, res) => {
  const { shopId } = req.body;

  // Delete all shop and customer data
  await db.shops.deleteOne({ shopifyId: shopId });
  await db.customers.deleteMany({ shopifyId });

  res.status(200).send('Shop deleted');
});
```

## Implementation Patterns

### Remix Framework Pattern

```typescript
// app/routes/webhooks/shopify.tsx
import { json, type ActionFunction } from '@remix-run/node';
import crypto from 'crypto';

function verifyWebhookSignature(
  request: Request,
  secret: string
): boolean {
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const body = request.body;

  const computed = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader || ''),
    Buffer.from(computed)
  );
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!verifyWebhookSignature(request, process.env.WEBHOOK_SECRET!)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await request.json();

  switch (request.headers.get('x-shopify-topic')) {
    case 'orders/created':
      await handleOrderCreated(event);
      break;
    case 'products/updated':
      await handleProductUpdated(event);
      break;
    case 'customers/redact':
      await handleCustomerRedact(event);
      break;
  }

  return json({ success: true });
};
```

### Next.js API Route Pattern

```typescript
// pages/api/webhooks/shopify.ts
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

function verifySignature(req: NextApiRequest, secret: string): boolean {
  const signature = req.headers['x-shopify-hmac-sha256'] as string;
  const body = (req as any).rawBody;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

// Middleware to capture raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Capture raw body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  (req as any).rawBody = Buffer.concat(chunks).toString('utf-8');

  if (!verifySignature(req, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = JSON.parse((req as any).rawBody);

  // Process webhook
  await processWebhook(req.headers['x-shopify-topic'] as string, body);

  res.status(200).json({ success: true });
}
```

## Webhook Payload Examples

**Order Created Payload:**
```json
{
  "id": 1234567890,
  "email": "customer@example.com",
  "display_order_number": "#1001",
  "created_at": "2026-05-04T14:30:00Z",
  "updated_at": "2026-05-04T14:30:00Z",
  "total_price": "299.99",
  "currency": "USD",
  "line_items": [
    {
      "id": 9876543210,
      "title": "Blue T-Shirt",
      "variant_id": 1111111111,
      "quantity": 2,
      "price": "29.99"
    }
  ],
  "customer": {
    "id": 5555555555,
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Product Updated Payload:**
```json
{
  "id": 1234567890,
  "title": "Blue T-Shirt",
  "handle": "blue-t-shirt",
  "vendor": "Example Vendor",
  "product_type": "Apparel",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-05-04T14:30:00Z",
  "variants": [
    {
      "id": 1111111111,
      "title": "Small / Blue",
      "sku": "BTS-S-BLU",
      "price": "29.99",
      "inventory_quantity": 50
    }
  ]
}
```

## Common Gotchas

| Issue | Cause | Solution |
|-------|-------|----------|
| Invalid signature | Raw body passed to parser | Capture raw body before JSON parsing |
| Duplicate processing | Retries without idempotency | Store webhook IDs, check before processing |
| Timeout errors | Slow processing in handler | Process asynchronously, return 200 immediately |
| Missing events | Webhook deregistered | Check app installation, reauth if needed |
| GDPR violation | Not respecting 30-day deadline | Implement automated redaction workflow |
| Rate limit rejection | Too many API calls in handler | Batch requests, use bulk operations |
| SSL certificate errors | Expired or invalid cert | Renew cert, restart webhook delivery |
| Event data incomplete | Querying without proper fields | Subscribe with full field selections |
| Webhook loop | Webhook triggers same event | Add idempotency guard, check source app |
| Lost messages | HTTPS retry limit exceeded | Implement event queue, use EventBridge/Pub/Sub |

## Decision Tree: Choosing Delivery Method

```
START: Do you need real-time delivery?
├─ YES → Can you expose public HTTPS endpoint?
│  ├─ YES → Use HTTPS (traditional, simplest)
│  └─ NO → Go to AWS/GCP check
├─ NO → Use EventBridge/Pub/Sub (async)
   └─ Do you use AWS?
      ├─ YES → Use EventBridge
      └─ NO → Use Google Pub/Sub
```

## Best Practices

1. **Always verify signatures** - Never skip HMAC verification
2. **Process asynchronously** - Use queues, return 200 immediately
3. **Implement idempotency** - Store webhook IDs, deduplicate
4. **Handle retries gracefully** - Exponential backoff already applied
5. **Monitor webhook health** - Track delivery success rates
6. **Log all events** - For debugging and audit trails
7. **Use webhooks manifest** - Declarative, cleaner than APIs
8. **Respect rate limits** - Don't make too many API calls in handlers
9. **GDPR compliance** - Process redaction webhooks within 30 days
10. **Test locally** - Use ngrok or Shopify CLI to tunnel webhooks
