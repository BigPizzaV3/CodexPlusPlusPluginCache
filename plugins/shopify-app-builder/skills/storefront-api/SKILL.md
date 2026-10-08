---
name: storefront-api
description: "Build customer-facing storefront applications with Shopify Storefront API. Access product catalogs, collections, checkout flows, cart management, and customer accounts using public/private tokens. Includes GraphQL queries, Market directives, Customer Account API, and TypeScript examples. Triggers include: 'storefront api', 'customer-facing shopify', 'shopping cart api', 'product catalog query', 'checkout flow', 'customer account api', 'market directive', 'storefront token'."
---

## When to Use Storefront API

Use **Storefront API** for customer-facing applications:
- Building custom storefronts (headless commerce)
- Shopping cart and checkout flows
- Product browsing and search
- Customer account management (orders, addresses)
- Subscription management
- Market-specific pricing and inventory (with Market directives)
- Cart line operations (add, remove, update)
- Customer authentication and profiles

**DO NOT use for:** store management, admin operations, or internal tools (use Admin API instead).

---

## Token Types & Scopes

### Public Access Tokens
**Use for:** Frontend applications, public data access

```javascript
const publicToken = 'Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Public token
const shopDomain = 'mystore.myshopify.com';
const endpoint = `https://${shopDomain}/api/2026-01/graphql.json`;

const headers = {
  'Content-Type': 'application/json',
  'X-Shopify-Storefront-Access-Token': publicToken,
};
```

**Scopes enabled with public token:**
- Read products
- Read product collections
- Read shop information
- Read customer information (requires customer login)
- Create shopping carts
- Manage shopping carts
- Access checkout URLs

### Private Access Tokens (Storefront)
**Use for:** Backend/server-side access with elevated permissions

```javascript
const privateToken = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;

const headers = {
  'Content-Type': 'application/json',
  'X-Shopify-Storefront-Access-Token': privateToken,
};
```

**Additional scopes with private token:**
- Full customer account access
- All storefront operations
- No rate limiting (unlike public token: 2 requests/second per IP)

---

## Headers & Configuration

**Standard Storefront Headers:**
```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-Shopify-Storefront-Access-Token': accessToken,
};
```

**TypeScript Headers Interface:**
```typescript
interface StorefrontHeaders {
  'Content-Type': 'application/json';
  'X-Shopify-Storefront-Access-Token': string;
  'Accept-Language'?: string; // For locale-specific data
}
```

**Add Market/Localization (Market Directive):**
```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-Shopify-Storefront-Access-Token': accessToken,
  'Accept-Language': 'en-US', // for Market resolution
};
```

---

## Product Queries

### Get Product by Handle

```graphql
query GetProduct($handle: String!) {
  product(handle: $handle) {
    id
    title
    description
    handle
    vendor
    productType
    images(first: 10) {
      edges {
        node {
          url
          altText
        }
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          sku
          price {
            amount
            currencyCode
          }
          availableForSale
          quantityAvailable
          compareAtPrice {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
    collections(first: 5) {
      edges {
        node {
          title
          handle
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "handle": "wireless-headphones"
}
```

### List Products (Paginated)

```graphql
query ListProducts($first: Int!, $after: String, $query: String) {
  products(first: $first, after: $after, query: $query) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
        handle
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        images(first: 1) {
          edges {
            node {
              url
            }
          }
        }
      }
    }
  }
}
```

### Search Products

```graphql
query SearchProducts($query: String!, $first: Int) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        handle
        description
      }
    }
  }
}
```

---

## Collection Queries

### Get Collection Products

```graphql
query GetCollection($handle: String!, $first: Int) {
  collection(handle: $handle) {
    id
    title
    description
    image {
      url
      altText
    }
    products(first: $first) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
}
```

### List Collections

```graphql
query ListCollections($first: Int, $after: String) {
  collections(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
        handle
        image {
          url
        }
      }
    }
  }
}
```

---

## Cart & Checkout Workflow

### Create Cart

```graphql
mutation CreateCart($input: CartInput!) {
  cartCreate(input: $input) {
    cart {
      id
      checkoutUrl
      lines(first: 10) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
      cost {
        subtotalAmount {
          amount
          currencyCode
        }
        totalAmount {
          amount
          currencyCode
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

### Add to Cart

```graphql
mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart {
      id
      lines(first: 10) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                price {
                  amount
                  currencyCode
                }
              }
            }
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

**Variables:**
```json
{
  "cartId": "gid://shopify/Cart/abc123",
  "lines": [
    {
      "merchandiseId": "gid://shopify/ProductVariant/123456",
      "quantity": 2
    }
  ]
}
```

### Update Cart Line

```graphql
mutation UpdateCartLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
  cartLinesUpdate(cartId: $cartId, lines: $lines) {
    cart {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

### Remove from Cart

```graphql
mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
  cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
    cart {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

### Get Checkout URL

```graphql
query GetCart($cartId: ID!) {
  cart(id: $cartId) {
    checkoutUrl
  }
}
```

---

## Customer Account API

### Get Current Customer

```graphql
query GetCurrentCustomer {
  customer {
    id
    email
    firstName
    lastName
    phone
    createdAt
    updatedAt
    addresses(first: 10) {
      edges {
        node {
          id
          firstName
          lastName
          address1
          address2
          city
          province
          country
          zip
          isDefaultBillingAddress
          isDefaultShippingAddress
        }
      }
    }
    orders(first: 10) {
      edges {
        node {
          id
          orderNumber
          processedAt
          totalPrice {
            amount
            currencyCode
          }
          financialStatus
          fulfillmentStatus
          lineItems(first: 10) {
            edges {
              node {
                title
                quantity
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Update Customer

```graphql
mutation UpdateCustomer($customer: CustomerInput!) {
  customerUpdate(customer: $customer) {
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

### Create Address

```graphql
mutation CreateAddress($address: MailingAddressInput!) {
  customerAddressCreate(address: $address) {
    customerAddress {
      id
      address1
      city
      country
      province
      zip
    }
    userErrors {
      field
      message
    }
  }
}
```

---

## Market Directives (Multi-Region)

Markets enable locale-specific product data, pricing, and availability.

### Query with Market Context

```graphql
query GetProductByMarket($handle: String!, $country: CountryCode!, $language: LanguageCode) @inContext(country: $country, language: $language) {
  product(handle: $handle) {
    id
    title
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 10) {
      edges {
        node {
          id
          availableForSale
          quantityAvailable
        }
      }
    }
  }
}
```

**Variables (for Canadian French market):**
```json
{
  "handle": "wireless-headphones",
  "country": "CA",
  "language": "FR"
}
```

### Supported Markets

```typescript
enum CountryCode {
  US = "US",
  CA = "CA",
  GB = "GB",
  AU = "AU",
  JP = "JP",
  DE = "DE",
  FR = "FR",
  IT = "IT",
  // ... and 150+ more
}

enum LanguageCode {
  EN = "EN",
  FR = "FR",
  DE = "DE",
  IT = "IT",
  JA = "JA",
  ES = "ES",
  // ... and 20+ more
}
```

---

## TypeScript Client Example

```typescript
interface StorefrontConfig {
  shop: string;
  token: string;
  apiVersion: string;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  priceRange: {
    minVariantPrice: MoneyV2;
    maxVariantPrice: MoneyV2;
  };
  variants: ProductVariant[];
}

interface ProductVariant {
  id: string;
  title: string;
  sku: string;
  price: MoneyV2;
  availableForSale: boolean;
  quantityAvailable: number;
}

interface MoneyV2 {
  amount: string;
  currencyCode: string;
}

class StorefrontClient {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(config: StorefrontConfig) {
    this.endpoint = `https://${config.shop}/api/${config.apiVersion}/graphql.json`;
    this.headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': config.token,
    };
  }

  async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }

    return data.data;
  }

  async getProduct(handle: string): Promise<Product> {
    const query = `
      query GetProduct($handle: String!) {
        product(handle: $handle) {
          id
          title
          handle
          description
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price {
                  amount
                  currencyCode
                }
                availableForSale
              }
            }
          }
        }
      }
    `;

    const result = await this.query(query, { handle });
    return result.product;
  }

  async createCart(variantId: string, quantity: number = 1) {
    const mutation = `
      mutation CreateCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                }
              }
            }
          }
        }
      }
    `;

    const input = {
      lines: [
        {
          merchandiseId: variantId,
          quantity,
        },
      ],
    };

    return this.query(mutation, { input });
  }
}

// Usage
const client = new StorefrontClient({
  shop: 'mystore.myshopify.com',
  token: 'public_token_here',
  apiVersion: '2026-01',
});

const product = await client.getProduct('wireless-headphones');
console.log(`Product: ${product.title} - $${product.priceRange.minVariantPrice.amount}`);

const cart = await client.createCart('gid://shopify/ProductVariant/123456', 2);
console.log(`Cart created: ${cart.cart.checkoutUrl}`);
```

---

## Rate Limiting

**Public token rate limits:**
- 2 requests per second per IP address
- 4 requests per second per user token (if customer logged in)

**Private token rate limits:**
- No rate limiting (server-side access)

**Handling rate limits:**
```javascript
async function executeWithRetry(query, variables, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    return response;
  }
}
```

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| **Unauthorized** | Invalid or expired token | Verify token in X-Shopify-Storefront-Access-Token header |
| **Field not available** | Token doesn't have scope | Use private token for full access, or request scope |
| **Product not found** | Wrong product handle | Verify handle exists; check product published to sales channel |
| **Cart checkoutUrl null** | Cart hasn't been created properly | Ensure cartCreate mutation completed successfully |
| **Customer is null** | User not logged in | Authenticate customer first (requires customer token) |
| **Variant not available** | Out of stock | Check availableForSale and quantityAvailable fields |

---

## Reference URLs

- [Shopify Storefront API Docs](https://shopify.dev/api/storefront/2026-01)
- [Storefront GraphQL Queries](https://shopify.dev/api/storefront/2026-01/queries)
- [Storefront GraphQL Mutations](https://shopify.dev/api/storefront/2026-01/mutations)
- [Customer Account API](https://shopify.dev/api/customer/2026-01)
- [Market Directives Guide](https://shopify.dev/api/storefront/2026-01/guide-markets)
- [Cart Operations Guide](https://shopify.dev/api/storefront/2026-01/guide-cart)
- [Authentication Flows](https://shopify.dev/api/storefront/2026-01/guide-authentication)
- [Rate Limiting Documentation](https://shopify.dev/api/storefront/2026-01#rate-limits)
