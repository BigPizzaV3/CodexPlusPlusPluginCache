---
name: app-auth
description: "Implement OAuth 2.0, Token Exchange, Managed Installation, App Proxy, and webhook verification for Shopify apps. Support online/offline tokens, session storage (Prisma, Redis, Memory), and multi-auth patterns. Covers admin API, public apps, custom apps, and customer account authentication. Triggers include: 'Shopify authentication', 'OAuth 2.0', 'Token Exchange', 'Managed Installation', 'App Proxy', 'Webhook signature', 'HMAC verification', 'Admin API auth', 'Customer Account API', 'Session storage', 'Online token', 'Offline token', 'Remix auth', 'shopify auth'."
---

# Shopify App Authentication

Shopify provides multiple authentication flows depending on your app type and use case. The modern standard is **Token Exchange** (2024+) for server-rendered apps, **Managed Installation** for headless apps, and **OAuth 2.0 Authorization Code Grant** for legacy/custom implementations. All flows result in an access token for the Shopify GraphQL Admin API.

## Authentication Flows Overview

### 1. Token Exchange (Recommended for 2024+)

**Use Case:** Server-rendered apps (Remix, Next.js with SSR), Shopify CLI apps
**Flow:** Merchant installs app → Shopify generates temporary exchange token → App exchanges for access token
**Security:** No client secret exposed; uses PKCE-style rotation per request
**Token Lifetime:** Access tokens are short-lived; refresh tokens rotate automatically

**Token Exchange Diagram:**
```
1. Merchant clicks "Install" in Shopify Admin
2. Shopify redirects: https://your-app.com/auth/callback?code=EXCHANGE_TOKEN
3. App validates HMAC, exchanges code for access token (private, server-side only)
4. Shopify Admin API grants scopes; token stored in session/database
5. Token auto-refreshes on next request if expired
```

**Remix Implementation (Token Exchange):**

```typescript
// shopify.app.ts (App Configuration)
import { shopifyApp } from '@shopify/shopify-app-remix/server';
import { restResources } from '@shopify/shopify-api/rest/admin/2026-07';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { prisma } from '~/db.server';

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecret: process.env.SHOPIFY_API_SECRET || '',
  scopes: process.env.SCOPES?.split(',') || [
    'write_products',
    'read_products',
    'write_orders',
    'read_orders',
    'write_customers',
    'read_customers',
    'write_discounts',
    'read_discounts',
    'write_fulfillments',
    'read_fulfillments',
    'write_inventory',
    'read_inventory',
  ],
  appUrl: process.env.SHOPIFY_APP_URL || 'http://localhost:3000',
  auth: {
    path: '/auth',
    callbackPath: '/auth/callback',
  },
  webhooks: {
    path: '/webhooks',
  },
  isEmbeddedApp: true, // Polaris admin dashboard
  sessionStorage: new PrismaSessionStorage(prisma),
  restResources, // Includes REST API helpers
});

export default shopify;
```

**Environment Variables (.env):**
```bash
SHOPIFY_API_KEY=your-public-api-key-from-partner-dashboard
SHOPIFY_API_SECRET=your-private-api-secret
SHOPIFY_APP_URL=https://your-domain.ngrok.io  # or prod URL
SCOPES=write_products,read_products,write_orders,read_orders
```

**Auth Routes (routes/auth.$.tsx - Catch-all route):**
```typescript
import { redirect } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }) => {
  const { authenticate } = await import('~/shopify.server');
  return authenticate.admin(request); // Token Exchange happens here
};
```

**Callback Handling (routes/auth.callback.tsx):**
```typescript
import { json } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  // Session contains:
  // - session.accessToken (valid for API calls)
  // - session.shop (merchant's shop domain)
  // - session.scope (granted scopes)
  // - session.state (optional custom data)

  return redirect('/app'); // Redirect to dashboard after auth
};
```

**Using Token in API Calls (routes/app.products.tsx):**
```typescript
import { json } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';
import { GraphQLClient } from 'graphql-request';

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Method 1: Use Shopify's admin helper (recommended)
  const response = await admin.graphql(`
    query GetProducts {
      products(first: 10) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }
  `);

  // Method 2: Manual GraphQL call
  const client = new GraphQLClient(
    `https://${session.shop}/admin/api/2026-07/graphql.json`,
    {
      headers: {
        'X-Shopify-Access-Token': session.accessToken,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await client.request(/* ... */);

  return json({ products: response.data?.products?.edges || [] });
};
```

**Token Refresh (Automatic):**
Token Exchange tokens auto-refresh via Shopify's session middleware. No manual refresh needed:
```typescript
// Tokens are refreshed transparently on each request
const response = await admin.graphql(query); // Handles refresh internally
```

### 2. Managed Installation (Headless/Custom Apps)

**Use Case:** Headless storefront, mobile apps, third-party integrations
**Flow:** Merchant authorizes app → Shopify generates permanent access token (no secret rotation)
**Token Lifetime:** Long-lived; no refresh required
**Security:** Token is permanent; store securely in environment variable

**Managed Installation Setup:**

In Shopify Partner Dashboard:
1. App Settings > API Credentials
2. Select "Managed installation" under Admin API access scopes
3. Merchant grants permission once
4. Copy access token to your environment

```bash
# .env
SHOPIFY_ADMIN_ACCESS_TOKEN=<SHOPIFY_ADMIN_ACCESS_TOKEN>
SHOPIFY_SHOP_URL=example-shop.myshopify.com
```

**Using Managed Installation Token:**
```typescript
import { GraphQLClient } from 'graphql-request';

const client = new GraphQLClient(
  `https://${process.env.SHOPIFY_SHOP_URL}/admin/api/2026-07/graphql.json`,
  {
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '',
    },
  }
);

// Token never expires; call API anytime
const query = `query { products(first: 10) { edges { node { id title } } } }`;
const products = await client.request(query);
```

### 3. OAuth 2.0 Authorization Code Grant (Legacy, Still Supported)

**Use Case:** Public apps with traditional OAuth flow
**Flow:** Merchant clicks "Install" → App redirects to Shopify OAuth → Merchant authorizes → App receives code → App exchanges code for token
**Token Lifetime:** Long-lived access token (no expiration unless revoked)
**Security:** Client secret required; PKCE optional

**OAuth Flow Diagram:**
```
1. Merchant visits: https://your-app.com/auth
2. App redirects to: https://your-shop.myshopify.com/admin/oauth/authorize?client_id=KEY&scope=write_products&redirect_uri=https://your-app.com/auth/callback&state=RANDOM
3. Merchant authorizes app in Shopify Admin
4. Shopify redirects back: https://your-app.com/auth/callback?code=AUTHORIZATION_CODE&hmac=SIGNATURE&state=RANDOM&shop=your-shop.myshopify.com
5. App validates HMAC and state
6. App exchanges code for token (server-side, using client secret)
7. App stores token in database
```

**Express.js OAuth Example:**
```typescript
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';

const app = express();

const API_KEY = process.env.SHOPIFY_API_KEY || '';
const API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://your-app.com/auth/callback';
const SCOPES = 'write_products,read_products';

// Step 1: Redirect merchant to Shopify OAuth
app.get('/auth', (req, res) => {
  const shop = req.query.shop as string;

  if (!shop || !shop.includes('.myshopify.com')) {
    return res.status(400).send('Missing or invalid shop parameter');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  // Store state in session (or database) for validation
  req.session.state = state;
  req.session.nonce = nonce;

  const authUrl = new URL(
    `/admin/oauth/authorize`,
    `https://${shop}`
  );
  authUrl.searchParams.append('client_id', API_KEY);
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('state', state);

  res.redirect(authUrl.toString());
});

// Step 2: Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, hmac, shop, state } = req.query;

  // Validate HMAC
  const message = Object.entries(req.query)
    .filter(([key]) => key !== 'hmac')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');

  const hash = crypto
    .createHmac('sha256', API_SECRET)
    .update(message, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    return res.status(401).send('Unauthorized request detected');
  }

  // Validate state
  if (state !== req.session.state) {
    return res.status(401).send('State mismatch');
  }

  try {
    // Exchange code for access token
    const response = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: API_KEY,
        client_secret: API_SECRET,
        code,
      }
    );

    const { access_token, scope } = response.data;

    // Store access token (in database, not session, for persistence)
    await storeAccessToken(shop as string, access_token, scope);

    // Redirect to app dashboard
    res.redirect(`/app?shop=${shop}`);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Helper function to store token
async function storeAccessToken(shop: string, token: string, scope: string) {
  // Store in database (example using mock storage)
  const db = {
    shops: {} as Record<string, { token: string; scope: string }>,
  };
  db.shops[shop] = { token, scope };
}

app.listen(3000);
```

## Session Storage Adapters

Access tokens must be stored persistently. Shopify provides adapters for common storage backends:

### Prisma (Recommended for Remix)

**Schema (prisma/schema.prisma):**
```prisma
model Session {
  id        String    @id
  shop      String
  state     String
  isOnline  Boolean   @default(false)
  accessToken String
  refreshToken String?
  scope     String
  expiresAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([shop, state])
  @@index([shop])
}
```

**Setup (shopify.app.ts):**
```typescript
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { prisma } from '~/db.server';

const shopify = shopifyApp({
  // ...
  sessionStorage: new PrismaSessionStorage(prisma),
});
```

### Redis

```typescript
import { RedisSessionStorage } from '@shopify/shopify-app-session-storage-redis';
import redis from 'redis';

const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379,
});

const sessionStorage = new RedisSessionStorage({
  client: redisClient,
  prefix: 'shopify_session:',
});

const shopify = shopifyApp({
  // ...
  sessionStorage,
});
```

### In-Memory (Development Only)

```typescript
import { MemorySessionStorage } from '@shopify/shopify-app-session-storage';

const sessionStorage = new MemorySessionStorage();

const shopify = shopifyApp({
  // ...
  sessionStorage, // CAUTION: Sessions lost on app restart; development only
});
```

### DynamoDB

```typescript
import { DynamoDBSessionStorage } from '@shopify/shopify-app-session-storage-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' });

const sessionStorage = new DynamoDBSessionStorage({
  client: dynamoDBClient,
  tableName: 'shopify-sessions',
});

const shopify = shopifyApp({
  // ...
  sessionStorage,
});
```

## Online vs. Offline Tokens

**Online Token:**
- Scope: Current user's permissions (typically admin user)
- Expiration: 24 hours
- Use Case: Browser-based actions (Polaris admin dashboard)
- Limitations: Cannot run background jobs; limited when user logs out

**Offline Token:**
- Scope: App's granted scopes
- Expiration: None; permanent until revoked
- Use Case: Background jobs, webhooks, scheduled tasks
- Limitations: None; use by default for app operations

**Requesting Offline Token in Token Exchange:**
```typescript
// shopify.app.ts
const shopify = shopifyApp({
  // ...
  auth: {
    path: '/auth',
    callbackPath: '/auth/callback',
  },
});

// Remix automatically requests offline token by default
// No action needed; use session.accessToken for API calls
```

**Using Offline Token for Webhooks:**
```typescript
// webhooks/products-update.ts
export const webhooks = {
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/app-uninstalled',
  },
  PRODUCTS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/products-update',
  },
};

export default defineWebhooksConfig(
  async (request, { admin, session }) => {
    const { body, query } = await graphql.query(request, {
      query: GET_PRODUCT,
      variables: { id: 'gid://shopify/Product/123' },
    });

    // session.accessToken is offline token; valid here
    console.log(`Webhook processed with token for shop: ${session.shop}`);
  },
  webhooksConfig
);
```

## App Proxy Authentication

**Use Case:** Storefront (public-facing) requests to app backend
**Authentication:** HMAC signature validation (like webhooks)
**Flow:** Storefront → Liquid proxy request → App backend (validates HMAC) → Response

**Setting Up App Proxy (shopify.app.toml):**
```toml
[[extensions]]
type = "app_proxy"
name = "Storefront API"
url = "/api/proxy"
subpath = "loyalty"  # Requests to /apps/loyalty/* are routed here
```

**App Proxy Handler (Remix routes/api/proxy.ts):**
```typescript
import { json } from '@shopify/remix-oxygen';
import crypto from 'crypto';

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const hmac = url.searchParams.get('hmac') || '';
  const timestamp = url.searchParams.get('_t') || '';
  const shop = url.searchParams.get('shop') || '';

  // Build message to validate HMAC
  const params = new URLSearchParams();
  Array.from(url.searchParams.entries()).forEach(([key, value]) => {
    if (key !== 'hmac') params.append(key, value);
  });

  const message = params.toString();
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
    .update(message, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate timestamp (within 24 hours)
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - requestTime) > 86400) {
    return json({ error: 'Request expired' }, { status: 401 });
  }

  // Valid app proxy request; return customer's loyalty points
  const customerId = url.searchParams.get('customer_id') || '';
  const points = await getLoyaltyPoints(customerId);

  return json({ points });
};

async function getLoyaltyPoints(customerId: string) {
  // Fetch from database
  return 1500; // Example
}
```

**Storefront Liquid Snippet:**
```liquid
<div id="loyalty-widget">
  <p>Your loyalty points: <span id="points">Loading...</span></p>
</div>

<script>
fetch('/apps/loyalty?customer_id={{ customer.id }}')
  .then(r => r.json())
  .then(data => {
    document.getElementById('points').textContent = data.points;
  });
</script>
```

## Webhook Signature Verification

**How It Works:** Shopify sends HMAC-SHA256 signature in `X-Shopify-Hmac-SHA256` header

**Verify Signature (Manual):**
```typescript
import crypto from 'crypto';

export const verifyWebhookSignature = (
  request: Request,
  secret: string
): boolean => {
  const hmacHeader = request.headers.get('X-Shopify-Hmac-SHA256') || '';
  const body = request.body; // Must be raw bytes, not JSON

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(hmacHeader)
  );
};
```

**Verify Signature (Remix Shopify Package):**
```typescript
import { authenticate } from '~/shopify.server';

export const action = async ({ request }) => {
  const { webhook } = await authenticate.webhook(request);

  // Signature already validated by middleware
  console.log(`Webhook received for shop: ${webhook.shop}`);
  console.log(`Topic: ${webhook.topic}`);
  console.log(`Body:`, webhook.payload);

  return json({ status: 'ok' });
};
```

**Register Webhook (shopify.app.ts):**
```typescript
const shopify = shopifyApp({
  // ...
  webhooks: {
    path: '/webhooks',
    validateHmac: true, // Automatic signature verification
  },
});

// Define webhooks in routes/webhooks.ts
export const webhooks = {
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/app-uninstalled',
  },
  ORDERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/orders-create',
  },
};
```

## Customer Account API Authentication

**Use Case:** Access customer account data (orders, addresses, metafields)
**Authentication:** Customer-specific access tokens (from Shopify Hydrogen or customer flow)
**Note:** Different from admin API; limited to customer data only

**Get Customer Access Token (in Hydrogen/Storefront):**
```typescript
// This is typically handled by Shopify's customer auth flow
const customerAccessToken = 'shpuc_XXXXX'; // Provided by auth

const response = await fetch(
  `https://example-shop.myshopify.com/api/2026-07/graphql.json`,
  {
    method: 'POST',
    headers: {
      'X-Shopify-Storefront-Access-Token': 'public-storefront-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          customer(customerAccessToken: "${customerAccessToken}") {
            id
            firstName
            email
            orders(first: 10) {
              edges {
                node {
                  id
                  orderNumber
                  totalPrice
                }
              }
            }
          }
        }
      `,
    }),
  }
);
```

## Public vs. Custom vs. Custom Distribution Apps

**Public App (Shopify App Store):**
- Listed in Shopify App Store
- OAuth 2.0 or Token Exchange
- Scopes reviewed by Shopify
- Available to all merchants
- Example: "Email Marketing Pro"

**Custom App (Internal Use):**
- Private; not listed in App Store
- No scopes; request all access
- Created by/for single merchant
- Only accessible to merchant account
- Example: Custom inventory sync for specific store

**Custom Distribution App:**
- Limited distribution; only shared with specific merchants via link
- Behaves like public app (listed in custom store) but not publicly visible
- OAuth 2.0 required
- Scopes still reviewed

**Configuration (shopify.app.toml):**
```toml
# Public App
scopes = "write_products,read_products,write_orders"
distribution = "public"

# Custom App (all scopes by default)
distribution = "private"

# Custom Distribution
distribution = "custom"
allowedDomains = ["company-partner.myshopify.com"]
```

## Top 10 Authentication Bugs & Fixes

| Bug | Symptom | Fix |
|-----|---------|-----|
| **Missing HMAC validation** | Webhook spoofing; malicious requests processed | Always validate HMAC signature in webhook handlers; use `authenticate.webhook(request)` |
| **Storing access token in session cookie** | Token exposed in browser; XSS vulnerability | Store token in database (Prisma); never send to client; use httpOnly cookies for session ID only |
| **Expired token not refreshed** | "Unauthorized" errors after 24h (online tokens) | Token Exchange auto-refreshes; OAuth tokens are permanent; Managed Installation tokens never expire |
| **Incorrect HMAC secret** | "Invalid signature" errors on valid requests | Use correct `SHOPIFY_API_SECRET`; verify in Partner Dashboard > App Settings |
| **State parameter not validated** | CSRF attacks; attacker redirects merchant | Store state in session; validate in callback; use `crypto.randomBytes(16).toString('hex')` for state generation |
| **App proxy timestamp not checked** | Old requests replayed; business logic executed twice | Validate timestamp within 24h; use `Math.abs(currentTime - timestamp) < 86400` |
| **Scope creep (requesting too many scopes)** | App rejected by Shopify; merchant distrust | Request only scopes needed; remove unused scopes from SCOPES array |
| **Token stored in environment variable for multi-tenant** | Security breach; one merchant's token accessed by another | Use database storage (Prisma/Redis); one token per shop; index by shop domain |
| **Webhook signature verified but not in constant-time** | Timing attacks; signature can be guessed | Use `crypto.timingSafeEqual()` for comparison; avoid simple `===` |
| **Customer access token hardcoded** | Exposed in source code; customer data accessed | Never hardcode tokens; pass via environment variables or customer auth flow |

## Full Working Examples

### Example 1: Remix Token Exchange App (Complete)

**Directory Structure:**
```
my-app/
├── app/
│   ├── routes/
│   │   ├── auth.$.tsx (Auth handler)
│   │   ├── auth.callback.tsx (Callback)
│   │   └── app.products.tsx (Protected route)
│   ├── shopify.server.ts (Config)
│   └── db.server.ts (Prisma client)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── .env (API keys)
└── shopify.app.toml
```

**shopify.app.toml:**
```toml
scopes = "write_products,read_products,write_orders,read_orders"
```

**app/shopify.server.ts:**
```typescript
import { shopifyApp } from '@shopify/shopify-app-remix/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { prisma } from '~/db.server';

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecret: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES?.split(',') || [],
  appUrl: process.env.SHOPIFY_APP_URL,
  auth: {
    path: '/auth',
    callbackPath: '/auth/callback',
  },
  webhooks: {
    path: '/webhooks',
  },
  isEmbeddedApp: true,
  sessionStorage: new PrismaSessionStorage(prisma),
});

export const authenticate = shopify.authenticate;
```

**app/routes/auth.$.tsx:**
```typescript
import { redirect } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return redirect('/app');
};
```

**app/routes/auth.callback.tsx:**
```typescript
import { json } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return redirect(`/app?shop=${session.shop}`);
};
```

**app/routes/app.products.tsx:**
```typescript
import { json } from '@shopify/remix-oxygen';
import { useLoaderData } from '@remix-run/react';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query GetProducts {
      products(first: 10) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
  `);

  const products = response.data?.products?.edges || [];

  return json({ products });
};

export default function Products() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Products</h1>
      <ul>
        {products.map((p) => (
          <li key={p.node.id}>{p.node.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 2: Webhook Signature Verification

**routes/webhooks.ts:**
```typescript
import { define } from '@shopify/shopify-app-remix/server';
import { DeliveryMethod } from '@shopify/shopify-api';

export const webhooks = define({
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/app-uninstalled',
  },
  PRODUCTS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/products-create',
  },
  PRODUCTS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/products-update',
  },
});

export async function handleWebhook(
  topic,
  shop,
  body,
  webhookId
) {
  switch (topic) {
    case 'app/uninstalled':
      await deleteShopData(shop);
      break;
    case 'products/create':
      await syncProduct(shop, body);
      break;
    case 'products/update':
      await updateProduct(shop, body);
      break;
  }
}

async function deleteShopData(shop: string) {
  // Clean up shop data on uninstall
  console.log(`App uninstalled for shop: ${shop}`);
}

async function syncProduct(shop: string, body: any) {
  const product = JSON.parse(body).product;
  console.log(`Product created in ${shop}: ${product.title}`);
}

async function updateProduct(shop: string, body: any) {
  const product = JSON.parse(body).product;
  console.log(`Product updated in ${shop}: ${product.title}`);
}
```

**routes/webhooks/app-uninstalled.tsx:**
```typescript
import { json } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';
import { deleteShopData } from '~/models/shop.server';

export const action = async ({ request }) => {
  const { webhook } = await authenticate.webhook(request);

  // HMAC signature already validated
  await deleteShopData(webhook.shop);

  return json({ status: 'processed' });
};
```

### Example 3: App Proxy with Customer Loyalty

**routes/api/proxy.tsx:**
```typescript
import { json } from '@shopify/remix-oxygen';
import crypto from 'crypto';

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const hmac = url.searchParams.get('hmac') || '';
  const timestamp = url.searchParams.get('_t') || '';

  // Build message for HMAC validation
  const params = new URLSearchParams();
  Array.from(url.searchParams.entries()).forEach(([key, value]) => {
    if (key !== 'hmac') params.append(key, value);
  });

  const message = params.toString();
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
    .update(message, 'utf8')
    .digest('base64');

  // Validate signature
  if (hash !== hmac) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate timestamp
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - requestTime) > 86400) {
    return json({ error: 'Request expired' }, { status: 401 });
  }

  // Valid request; return loyalty data
  const customerId = url.searchParams.get('customer_id') || '';
  const loyaltyPoints = await getLoyaltyPoints(customerId);

  return json({ loyaltyPoints, success: true });
};

async function getLoyaltyPoints(customerId: string): Promise<number> {
  // Fetch from database
  return 1500;
}
```

## API Version & Scope Reference

**Current when this release was audited:** `2026-07`. Verify Shopify's latest stable version before deployment.

**Essential Scopes:**
- `write_products`, `read_products` — Manage product catalog
- `write_orders`, `read_orders` — Access order data
- `write_customers`, `read_customers` — Manage customer data
- `write_fulfillments`, `read_fulfillments` — Manage fulfillments
- `write_inventory`, `read_inventory` — Manage inventory levels
- `write_discounts`, `read_discounts` — Create/manage discounts
- `write_draft_orders`, `read_draft_orders` — Draft order management
- `write_checkout`, `read_checkout` — Checkout customization
- `write_metafields`, `read_metafields` — Manage custom data

**Scope Review:** Scopes are reviewed by Shopify during app approval. Request only necessary scopes.

## Resources

- **Shopify OAuth Docs:** https://shopify.dev/docs/apps/auth
- **Session Storage:** https://shopify.dev/docs/apps/auth-session-storage
- **Webhook Verification:** https://shopify.dev/docs/apps/webhooks/configuration/verify-webhook-authenticity
- **Token Exchange:** https://shopify.dev/docs/apps/auth/get-access-tokens/token-exchange
