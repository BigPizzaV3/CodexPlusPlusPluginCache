---
name: admin-rest
description: "Use the legacy REST Admin API only when maintaining an existing integration. Covers common resources, the 40-request bucket with a 2-request-per-second standard restore rate, and migration to GraphQL. New public apps must use the GraphQL Admin API."
---

## When to Use REST API (Rarely)

**LEGACY API WARNING:** Shopify has classified the REST Admin API as legacy since October 1, 2024. Since April 1, 2025, new public apps must use the GraphQL Admin API exclusively. Shopify has not published a blanket December 2026 shutdown date for every REST resource.

Use REST API ONLY for:
- Maintaining existing legacy applications built before 2024
- Simple read-only queries from archived systems
- Temporary compatibility layers during GraphQL migration
- Systems that cannot be updated to use GraphQL

**MIGRATE TO GRAPHQL FOR:** All new features, bulk operations, cost efficiency, and latest Shopify functionality.

---

## REST vs GraphQL Comparison

| Feature | REST (Legacy) | GraphQL (Current) |
|---------|---------------|-------------------|
| Rate Limiting | 40-request standard bucket, restored at 2 requests/sec | Cost-based; restore rate varies by plan |
| Pagination | Limit/offset (inefficient) | Cursor-based (Relay) |
| Field Selection | Fixed response (bloated) | Precise fields only |
| Bulk Operations | Sequential requests | Native JSONL bulk |
| Latest Features | Some newer features are GraphQL-only | Current platform features |
| Support Window | Versioned; verify the selected version and resource | Versioned; verify the selected version |
| Status | Maintenance only | Production active |

---

## API Endpoint Structure

**Base URL:** `https://{shop}.myshopify.com/admin/api/2025-10/`

**Authentication (Header):**
```bash
curl -X GET "https://store.myshopify.com/admin/api/2025-10/products.json" \
  -H "X-Shopify-Access-Token: {access_token}"
```

The examples below use `2025-10` for compatibility with older integrations. Before deploying, select a currently supported API version from Shopify's version schedule and test the exact resources you use.

---

## Rate Limiting

**REST limits:**
- Standard limit: a 40-request bucket per app and store
- Standard restore rate: 2 requests per second
- Shopify Plus: limits are typically 10 times the standard limit
- Read `X-Shopify-Shop-Api-Call-Limit` and honor `Retry-After`; Shopify can reduce limits temporarily

**Rate limit headers:**
```
X-Shop-API-Call-Limit: 30/40
X-Inventory-API-Call-Limit: 20/40
Retry-After: 2
```

**Handling 429 (Too Many Requests):**
```javascript
async function executeWithRetry(url, options, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After')) || Math.pow(2, attempt - 1);
      console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}
```

---

## Common Legacy REST Resources

### Products

**1. List Products**
```bash
GET /admin/api/2025-10/products.json?limit=50&status=active
```

Response:
```json
{
  "products": [
    {
      "id": 123456789,
      "title": "Wireless Headphones",
      "handle": "wireless-headphones",
      "status": "active",
      "vendor": "TechBrand",
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2025-10-15T14:30:00Z"
    }
  ]
}
```

**2. Get Single Product**
```bash
GET /admin/api/2025-10/products/{id}.json
```

**3. Create Product**
```bash
POST /admin/api/2025-10/products.json
```

Body:
```json
{
  "product": {
    "title": "New Product",
    "product_type": "Electronics",
    "vendor": "MyVendor",
    "status": "active"
  }
}
```

**4. Update Product**
```bash
PUT /admin/api/2025-10/products/{id}.json
```

Body:
```json
{
  "product": {
    "id": 123456789,
    "title": "Updated Title",
    "status": "active"
  }
}
```

### Variants

**5. List Product Variants**
```bash
GET /admin/api/2025-10/products/{product_id}/variants.json?limit=50
```

**6. Create Variant**
```bash
POST /admin/api/2025-10/products/{product_id}/variants.json
```

Body:
```json
{
  "variant": {
    "title": "Red / Small",
    "sku": "WH-RED-S",
    "price": "59.99",
    "option1": "Red",
    "option2": "Small"
  }
}
```

**7. Update Variant**
```bash
PUT /admin/api/2025-10/products/{product_id}/variants/{id}.json
```

### Orders

**8. List Orders**
```bash
GET /admin/api/2025-10/orders.json?status=any&limit=50
```

Response:
```json
{
  "orders": [
    {
      "id": 987654321,
      "order_number": 1001,
      "email": "customer@example.com",
      "created_at": "2025-10-01T10:00:00Z",
      "total_price": "99.99",
      "currency": "USD",
      "fulfillment_status": "fulfilled",
      "financial_status": "paid"
    }
  ]
}
```

**9. Get Single Order**
```bash
GET /admin/api/2025-10/orders/{id}.json
```

**10. Update Order**
```bash
PUT /admin/api/2025-10/orders/{id}.json
```

Body:
```json
{
  "order": {
    "id": 987654321,
    "tags": "wholesale,vip"
  }
}
```

### Customers

**11. List Customers**
```bash
GET /admin/api/2025-10/customers.json?limit=50
```

**12. Create Customer**
```bash
POST /admin/api/2025-10/customers.json
```

Body:
```json
{
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

**13. Update Customer**
```bash
PUT /admin/api/2025-10/customers/{id}.json
```

### Shop

**14. Get Shop Information**
```bash
GET /admin/api/2025-10/shop.json
```

Response:
```json
{
  "shop": {
    "id": 123456,
    "name": "My Store",
    "email": "shop@example.com",
    "domain": "mystore.myshopify.com",
    "currency": "USD",
    "timezone": "America/New_York"
  }
}
```

### Webhooks

**15. List Webhooks**
```bash
GET /admin/api/2025-10/webhooks.json
```

---

## REST to GraphQL Migration Recipes

### Recipe 1: Listing Products with Variants

**Old REST approach (inefficient):**
```javascript
// Step 1: Fetch products
const productsRes = await fetch(
  'https://store.myshopify.com/admin/api/2025-10/products.json?limit=250',
  { headers: { 'X-Shopify-Access-Token': token } }
);
const { products } = await productsRes.json();

// Step 2: For each product, fetch variants separately (N+1 problem)
const productData = await Promise.all(
  products.map(p =>
    fetch(`https://store.myshopify.com/admin/api/2025-10/products/${p.id}/variants.json`,
      { headers: { 'X-Shopify-Access-Token': token } }
    ).then(r => r.json())
  )
);
```

**New GraphQL approach (efficient):**
```javascript
const query = `
  query {
    products(first: 250) {
      edges {
        node {
          id
          title
          variants(first: 250) {
            edges {
              node {
                id
                sku
                price
              }
            }
          }
        }
      }
    }
  }
`;

const response = await fetch(
  'https://store.myshopify.com/admin/api/2026-01/graphql.json',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query }),
  }
);
```

**Benefits:** Single request, no N+1 problem, precise field selection, cost-aware rate limiting.

### Recipe 2: Creating Order with Line Items

**Old REST (multiple requests):**
```javascript
// REST doesn't support creating orders with line items directly
// Must create as draft order, then convert
const draftRes = await fetch(
  'https://store.myshopify.com/admin/api/2025-10/draft_orders.json',
  {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft_order: {
        line_items: [{ variant_id: 123, quantity: 2 }]
      }
    })
  }
);
```

**New GraphQL (atomic operation):**
```graphql
mutation CreateDraftOrder($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id
      draftOrderLineItems(first: 10) {
        edges {
          node {
            id
            title
            quantity
          }
        }
      }
    }
  }
}
```

### Recipe 3: Bulk Update Variant Prices

**Old REST (request-by-request update):**
```javascript
const updates = [
  { id: 1, price: '49.99' },
  { id: 2, price: '59.99' },
  // ... 1000 more
];

for (const update of updates) {
  await fetch(
    `https://store.myshopify.com/admin/api/2025-10/variants/${update.id}.json`,
    {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: { price: update.price } })
    }
  );
  await new Promise(resolve => setTimeout(resolve, 100)); // Delay to avoid rate limit
}
// Time for 1000 updates: ~100 seconds
```

**New GraphQL with bulk operations (fast):**
```javascript
const jsonl = updates
  .map(u => ({
    __typename: 'ProductVariant',
    id: `gid://shopify/ProductVariant/${u.id}`,
    price: u.price
  }))
  .map(o => JSON.stringify(o))
  .join('\n');

const bulkRes = await fetch(
  'https://store.myshopify.com/admin/api/2026-01/graphql.json',
  {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation { bulkOperationRunMutation(input: "${jsonl}") { bulkOperation { id status } } }`
    })
  }
);
// Time for 1000 updates: ~10-30 seconds (with polling)
```

---

## Red Flags: When REST Fails

| Red Flag | Symptom | Solution |
|----------|---------|----------|
| **N+1 problem** | 1000+ requests for simple data fetch | Migrate to GraphQL single query |
| **Rate limit throttling** | Constant 429 responses during bulk operations | Use GraphQL bulk operations |
| **Missing fields** | REST returns data you don't need (bloated) | Use GraphQL precise field selection |
| **Slow pagination** | Offset/limit pagination on large dataset | Use GraphQL cursor-based pagination |
| **No bulk update endpoint** | Creating/updating 100+ records slowly | Use GraphQL bulkOperationRunMutation |
| **Feature not in REST** | Trying to use 2025+ features | Must migrate to GraphQL |
| **Resource or version retirement** | A resource is unavailable or an API version is no longer supported | Track the version schedule and migrate to GraphQL before support ends |

---

## Critical Migration Checklist

For every maintained REST integration:

- [ ] Audit all REST API calls in your codebase
- [ ] Count requests per day (compare to GraphQL cost)
- [ ] Create GraphQL equivalents for each REST endpoint
- [ ] Test GraphQL mutations with real data
- [ ] Replace REST calls one endpoint at a time
- [ ] Monitor error rates during migration
- [ ] Remove REST calls once GraphQL is stable
- [ ] Set an internal GraphQL migration deadline based on the versions and resources you actually use

---

## Reference URLs

- [Shopify Admin REST API (Legacy)](https://shopify.dev/docs/api/admin-rest/latest)
- [API version schedule](https://shopify.dev/docs/api/usage/versioning)
- [Migration guide: REST to GraphQL](https://shopify.dev/docs/apps/build/graphql/migrate)
- [Shopify API limits](https://shopify.dev/docs/api/usage/limits)
