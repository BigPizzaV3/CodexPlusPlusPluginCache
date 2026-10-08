---
name: admin-graphql
description: "Build Shopify Admin GraphQL queries and mutations for products, orders, customers, inventory, and more. Covers cost-aware rate limiting, cursor pagination, bulk operations, global resource identifiers, and version-safe API usage."
---

## When to Use This Skill

Use **Admin GraphQL API** when you need to:
- Manage products, variants, collections, and pricing (preferred over REST for any business logic)
- Query or modify orders, fulfillments, and refunds
- Create or update customers and customer accounts
- Adjust inventory across multiple locations
- Create metafields and metaobjects for custom data
- Set up webhooks for event subscriptions
- Perform bulk operations on large datasets (1000+ records)
- Access the latest Shopify features (GraphQL-only endpoints)

**GraphQL vs REST comparison:**
| Feature | GraphQL Admin | REST (Deprecated) |
|---------|--------------|-------------------|
| Rate Limiting | Cost-based; standard restore rate is 100 points/sec | Request bucket; standard restore rate is 2 requests/sec |
| Pagination | Cursor-based (Relay pattern) | Offset/limit (deprecated) |
| Field Selection | Precise (fetch only needed fields) | Fixed response shape (wasteful) |
| Batch Operations | Native bulk operations (JSONL) | Multiple sequential requests |
| Latest Features | Current platform features | Some newer features are GraphQL-only |
| Status | Required for new public apps | Legacy since October 1, 2024 |

---

## API Endpoint & Authentication

**Endpoint:** `https://{shop}.myshopify.com/admin/api/2026-07/graphql.json`

**Authentication:**
```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
};
```

---

## Cost-Based Rate Limiting

Shopify uses calculated query costs. The standard GraphQL Admin API restore rate is 100 points per second; Advanced, Plus, and enterprise plans have higher rates. A single query can't exceed 1,000 requested points. Read `extensions.cost.throttleStatus` instead of hard-coding one bucket size.

**Handling throttling:**
```javascript
async function executeWithRetry(query, variables, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();

    if (data.errors?.some(e => e.extensions?.code === 'THROTTLED')) {
      const waitTime = Math.pow(2, attempt - 1) * 1000;
      console.log(`Throttled. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    return data;
  }
  throw new Error('Max retries exceeded');
}
```

---

## Cursor-Based Pagination

```graphql
query GetProducts($first: Int, $after: String) {
  products(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
      }
    }
  }
}
```

**JavaScript iteration:**
```javascript
const allProducts = [];
let hasNextPage = true;
let endCursor = null;

while (hasNextPage) {
  const data = await executeQuery(GET_PRODUCTS, {
    first: 50,
    after: endCursor,
  });

  const { edges, pageInfo } = data.products;
  allProducts.push(...edges.map(e => e.node));

  hasNextPage = pageInfo.hasNextPage;
  endCursor = pageInfo.endCursor;
}
```

---

## 30 Essential Operations

### Product Management

**1. Create Product**
```graphql
mutation CreateProduct($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      handle
      title
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

**2. Update Product**
```graphql
mutation UpdateProduct($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      title
      updatedAt
    }
    userErrors {
      field
      message
    }
  }
}
```

**3. Create Variants (Bulk)**
```graphql
mutation BulkCreateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    productVariants {
      id
      title
      sku
      price
    }
    userErrors {
      field
      message
    }
  }
}
```

**4. Update Variants (Bulk)**
```graphql
mutation BulkUpdateVariants($variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(variants: $variants) {
    productVariants {
      id
      sku
      price
    }
    userErrors {
      message
    }
  }
}
```

### Order Management

**5. Get Orders (Paginated)**
```graphql
query GetOrders($first: Int!, $after: String) {
  orders(first: $first, after: $after) {
    edges {
      node {
        id
        name
        createdAt
        customer {
          id
          email
        }
        lineItems(first: 10) {
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
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

**6. Update Order (Add Tags)**
```graphql
mutation UpdateOrderTags($input: OrderInput!) {
  orderUpdate(input: $input) {
    order {
      id
      tags
    }
    userErrors {
      field
      message
    }
  }
}
```

**7. Begin Order Edit**
```graphql
mutation BeginOrderEdit($orderId: ID!) {
  orderEditBegin(orderId: $orderId) {
    calculatedOrder {
      id
      lineItems(first: 10) {
        edges {
          node {
            id
            title
            quantity
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

**8. Commit Order Edit**
```graphql
mutation CommitOrderEdit($id: ID!) {
  orderEditCommit(id: $id) {
    order {
      id
      name
    }
    userErrors {
      field
      message
    }
  }
}
```

### Fulfillment

**9. Create Fulfillment**
```graphql
mutation CreateFulfillment($input: FulfillmentInput!) {
  fulfillmentCreate(input: $input) {
    fulfillment {
      id
      status
      trackingInfo {
        number
        company
        url
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Inventory

**10. Adjust Inventory (Multiple Locations)**
```graphql
mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    inventoryLevels {
      id
      quantity
      location {
        id
        name
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Customers

**11. Create Customer**
```graphql
mutation CreateCustomer($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer {
      id
      email
      firstName
      lastName
    }
    userErrors {
      field
      message
    }
  }
}
```

**12. Update Customer**
```graphql
mutation UpdateCustomer($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer {
      id
      email
      updatedAt
    }
    userErrors {
      field
      message
    }
  }
}
```

**13. Get Customer with Orders**
```graphql
query GetCustomerOrders($customerId: ID!, $first: Int!) {
  customer(id: $customerId) {
    id
    email
    firstName
    orders(first: $first) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
}
```

### Metafields

**14. Set Metafields (Product)**
```graphql
mutation SetMetafields($input: MetafieldsSetInput!) {
  metafieldsSet(input: $input) {
    metafields {
      id
      namespace
      key
      value
    }
    userErrors {
      field
      message
    }
  }
}
```

**15. Create Metaobject**
```graphql
mutation CreateMetaobject($input: MetaobjectInput!) {
  metaobjectCreate(input: $input) {
    metaobject {
      id
      type
      fields {
        key
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Discounts

**16. Create Discount Code**
```graphql
mutation CreateDiscount($input: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(input: $input) {
    discountCodeBasic {
      id
      codes(first: 1) {
        edges {
          node {
            code
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Webhooks

**17. Create Webhook Subscription**
```graphql
mutation CreateWebhook($input: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(input: $input) {
    webhookSubscription {
      id
      topic
      endpoint {
        __typename
        ... on WebhookHttpEndpoint {
          callbackUrl
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Draft Orders

**18. Create Draft Order**
```graphql
mutation CreateDraftOrder($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id
      invoiceUrl
    }
    userErrors {
      field
      message
    }
  }
}
```

**19. Complete Draft Order**
```graphql
mutation CompleteDraftOrder($id: ID!) {
  draftOrderComplete(id: $id) {
    draftOrder {
      id
      order {
        id
        name
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Shop

**20. Get Shop Details**
```graphql
query GetShopDetails {
  shop {
    id
    name
    email
    myshopifyDomain
    currency
  }
}
```

### Collections

**21. Create Collection**
```graphql
mutation CreateCollection($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection {
      id
      handle
      title
    }
    userErrors {
      field
      message
    }
  }
}
```

**22. Add Products to Collection**
```graphql
mutation AddProductsToCollection($id: ID!, $productIds: [ID!]!) {
  collectionAddProducts(id: $id, productIds: $productIds) {
    collection {
      id
      products(first: 10) {
        totalCount
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Bulk Operations

**23. Run Bulk Query**
```graphql
mutation BulkQueryRun($query: String!) {
  bulkOperationRunQuery(query: $query) {
    bulkOperation {
      id
      status
      createdAt
    }
    userErrors {
      field
      message
    }
  }
}
```

**24. Get Bulk Operation Status**
```graphql
query GetBulkOperation($id: ID!) {
  node(id: $id) {
    ... on BulkOperation {
      id
      status
      createdAt
      completedAt
      objectCount
      fileSize
      url
    }
  }
}
```

**25. Run Bulk Mutation**
```graphql
mutation BulkMutationRun($input: String!) {
  bulkOperationRunMutation(input: $input) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

### Search

**26. Search Products**
```graphql
query SearchProducts($query: String!, $first: Int) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}
```

### Locations

**27. Get All Locations**
```graphql
query GetLocations {
  locations(first: 250) {
    edges {
      node {
        id
        name
        isActive
      }
    }
  }
}
```

### Refunds

**28. Create Refund**
```graphql
mutation CreateRefund($input: RefundInput!) {
  refundCreate(input: $input) {
    refund {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

### Returns

**29. Create Return**
```graphql
mutation CreateReturn($input: ReturnInput!) {
  returnCreate(input: $input) {
    return {
      id
      status
      requestedAt
    }
    userErrors {
      field
      message
    }
  }
}
```

### App Info

**30. Get App Installation Data**
```graphql
query GetAppInstallation {
  appInstallation {
    launchUrl
    accessScopes {
      handle
    }
  }
}
```

---

## Bulk Operations Workflow

For 100+ record operations, use bulk mutations to avoid rate limit delays:

```javascript
async function processBulkResults(fileUrl) {
  const response = await fetch(fileUrl);
  const text = await response.text();
  const lines = text.trim().split('\n');

  const results = lines.map(line => JSON.parse(line));
  const errors = results.filter(r => r.__typename === 'Error');

  if (errors.length > 0) {
    console.error('Bulk operation errors:', errors);
  }

  return results.filter(r => r.__typename !== 'Error');
}
```

---

## User Errors Handling

```javascript
function handleMutationResponse(response) {
  if (response.errors) {
    throw new Error(`GraphQL Error: ${response.errors[0].message}`);
  }

  const result = response.data?.productCreate;

  if (result.userErrors.length > 0) {
    const fieldErrors = result.userErrors.map(err =>
      `${err.field.join('.')}: ${err.message}`
    ).join('; ');
    throw new Error(`Validation failed: ${fieldErrors}`);
  }

  return result.product;
}
```

---

## Global Resource Identifiers (GIDs)

All Shopify resources use format: `gid://shopify/{ResourceType}/{NumericID}`

**Common types:**
- `gid://shopify/Product/123456`
- `gid://shopify/Order/345678`
- `gid://shopify/Customer/901234`
- `gid://shopify/Location/567890`

**Parsing GIDs:**
```javascript
function parseGid(gid) {
  const match = gid.match(/gid:\/\/shopify\/(\w+)\/(.+)/);
  return {
    type: match[1],
    id: match[2],
  };
}
```

---

## Scope-to-Operation Mapping

| Scope | Operations |
|-------|-----------|
| `write_products` | Create, update products; manage variants |
| `read_products` | Query products, variants, collections |
| `write_orders` | Update orders, create fulfillments |
| `read_orders` | Query orders, line items |
| `write_customers` | Create, update customers |
| `read_customers` | Query customer data |
| `write_inventory` | Adjust inventory quantities |
| `read_inventory` | Query inventory levels |
| `write_webhooks` | Create webhook subscriptions |

---

## MoneyV2 Fields Best Practice

Always request money values with currency:

```graphql
query {
  products(first: 1) {
    edges {
      node {
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 1) {
          edges {
            node {
              price
              compareAtPrice
            }
          }
        }
      }
    }
  }
}
```

---

## Common Gotchas (15 Critical Issues)

| Gotcha | Solution |
|--------|----------|
| **userErrors but no message** | Check field array—sometimes indicates the issue |
| **Product not appearing in storefront** | Ensure `status: ACTIVE` is set |
| **Metafield value undefined** | Metafields must match namespace/key exactly |
| **Pagination returns empty with hasNextPage: true** | Use `after: endCursor`, not offset |
| **GID format errors** | Always use full format: `gid://shopify/Type/ID` |
| **Rate limited immediately** | Check query cost; use `first: 50` initially |
| **Variant options not syncing** | Product options must be created before variants |
| **Webhook never delivers** | Verify endpoint returns 200-299 status |
| **Customer metafields not visible** | Check `visible_to_storefront` flag |
| **Bulk operation returns partial results** | JSONL requires proper line breaks |
| **Order edit fails silently** | Must run `orderEditBegin` first |
| **Price not updating** | Use `variants` input as collection |
| **Inventory shows negative** | Shopify allows negatives; check location config |
| **Collection products order wrong** | Use `collectionReorderProducts` if order matters |
| **Webhook signature mismatch** | Use raw request body bytes for HMAC, not JSON |

---

## Decision Tree: Choosing the Right Operation

**Product Management:** Single product? Use create/update. Many variants? Use bulk variants.
**Order Processing:** Modify after creation? Use orderEditBegin/Commit. Add tags? Use orderUpdate.
**Inventory:** Single location? Use inventoryAdjustQuantities. Many locations? Use bulk mutation.
**Customers:** New customer? Use customerCreate. Attach data? Use metafieldsSet.
**Custom Data:** Attach to existing resource? Use metafieldsSet. Create new structure? Use metaobjectCreate.

---

## API Version & Support Lifecycle

- **Current when this release was audited:** 2026-07
- **Rule:** Confirm the latest stable version and its support dates before deployment
- **Release:** Quarterly (Jan, Apr, Jul, Oct)
- **Support:** 12 months per version

---

## Reference URLs

- [Shopify Admin GraphQL API Docs](https://shopify.dev/docs/api/admin-graphql/latest)
- [GraphQL Mutations Reference](https://shopify.dev/docs/api/admin-graphql/latest/mutations)
- [Rate Limiting Guide](https://shopify.dev/docs/api/usage/limits)
- [Global IDs Explained](https://shopify.dev/docs/api/usage/gids)
- [OAuth Scopes Reference](https://shopify.dev/docs/api/usage/access-scopes)
- [API Version Timeline](https://shopify.dev/api/admin-graphql#api-versions)
- [Bulk Operations Guide](https://shopify.dev/docs/api/usage/bulk-operations/queries)
