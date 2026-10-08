---
name: shopify-cli
description: "Use when scaffolding a new Shopify app, running Shopify CLI commands (shopify app dev/deploy/generate), configuring shopify.app.toml, generating app extensions (admin/checkout/theme/function), debugging tunnels or auth issues, or working with the official Remix/Node/PHP/Ruby app templates. Trigger on 'shopify app', 'shopify cli', 'shopify init', 'shopify dev', 'shopify deploy', 'generate extension', 'shopify.app.toml', 'remix template', 'tunnel', 'ngrok', 'cloudflare tunnel', 'ME APP_URL', 'SHOPIFY_API_KEY', or anything involving the Shopify CLI workflow."
---

# Shopify CLI Skill Reference

## When to Use This Skill

Use this skill for any task involving:
- Creating a new Shopify app with `shopify app init`
- Running development server with `shopify app dev`
- Deploying apps with `shopify app deploy` or `shopify app release`
- Generating extensions (admin actions, checkout UI, theme extensions, functions)
- Configuring `shopify.app.toml` and understanding all available settings
- Working with Remix + React Router v7 app template
- Setting up local tunnels (Cloudflare Tunnel or ngrok)
- Debugging authentication, webhooks, or environment issues
- Managing theme development with `shopify theme` commands
- Generating GraphQL types with `@shopify/api-codegen-preset`
- Understanding app structure, directory layout, and lifecycle
- Error troubleshooting and common failure patterns

## Installation and Setup

### Install Shopify CLI

```bash
npm install -g @shopify/cli@latest
```

**Node.js Requirements:**
- `>=20.19 <22` OR `>=22.12`
- Check version: `node --version`

### Verify Installation

```bash
shopify version
shopify app --help
```

## Command Reference

| Command | Flags | Purpose |
|---------|-------|---------|
| `shopify app init` | `--template remix` | Initialize new Shopify app with Remix template |
| `shopify app dev` | `--reset`, `--build`, `--no-update` | Start local dev server with hot reload |
| `shopify app deploy` | `--force`, `--no-release` | Deploy app to Shopify Partner dashboard |
| `shopify app release` | `--version X.Y.Z`, `--force` | Release deployed version to live |
| `shopify app generate` | `extension`, `webhook` | Generate boilerplate for extensions/webhooks |
| `shopify generate extension` | `--type admin_action`, `--api-version 2026-07` | Create app extension with a currently supported API version |
| `shopify app push` | `--force`, `--no-release` | Push config updates without full deploy |
| `shopify config show` | | Display loaded config from shopify.app.toml |
| `shopify env pull` | | Fetch environment variables from Partner dashboard |
| `shopify app open` | | Open app dashboard in browser |
| `shopify theme dev` | `--store example.myshopify.com` | Start theme development server |
| `shopify theme pull` | `--theme-id 123456789` | Download theme files from store |
| `shopify theme push` | `--force`, `--no-delete` | Upload theme files to store |
| `shopify auth logout` | | Clear stored authentication |
| `shopify auth login` | `--shop example.myshopify.com` | Authenticate with specific store |

## shopify app init Workflow (6-Step Process)

### Step 1: Launch Init Command
```bash
shopify app init --template remix
```

### Step 2: Provide Org and App Name
```
? App name
> my-shopify-app

? Org
> Select from: [list of partner orgs]
```

### Step 3: Select Package Manager
```
? Package manager
> npm / yarn / pnpm
```

### Step 4: Create Local Tunnel
```
? Local tunnel authentication
> Cloudflare / ngrok / skip
```

### Step 5: Install Dependencies
```bash
cd my-shopify-app
npm install
```

### Step 6: Start Dev Server
```bash
npm run dev
```

Output:
```
✓ Tunnel started at https://RANDOMHASH.lhr.life
✓ App URL: https://RANDOMHASH.lhr.life/api/auth
✓ Admin API access scopes configured
✓ Listening on port 3000
```

## Remix Template Deep Dive

### Directory Structure

```
my-shopify-app/
├── shopify.app.toml              # App configuration (CRITICAL)
├── remix.config.js               # Remix build config
├── package.json                  # Dependencies
├── .env.example                  # Environment template
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Database migrations
├── app/
│   ├── shopify.server.ts        # Shopify API setup (CRITICAL)
│   ├── db.server.ts             # Database connection
│   ├── root.tsx                 # Root layout
│   ├── routes/
│   │   ├── _index.tsx           # Dashboard
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── callback.ts  # OAuth callback
│   │   │   │   └── login.ts     # OAuth initiate
│   │   │   └── webhooks/
│   │   │       └── orders.ts    # Webhook handler
│   │   ├── app/
│   │   │   └── dashboard/
│   │   │       └── _index.tsx   # App dashboard
│   │   └── admin-actions/
│   │       └── bulk-operation.tsx
│   ├── components/
│   │   └── Navigation.tsx
│   └── styles/
│       └── app.css
└── public/
    └── images/
```

### shopify.server.ts (Authentication Setup)

```typescript
import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2026-07";
import { prisma } from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecret: process.env.SHOPIFY_API_SECRET!,
  scopes: (process.env.SCOPES || "").split(","),
  host: process.env.HOST!,
  isEmbeddedApp: false,
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: {
    saleChannel: "2152896513",
    surface: "admin_home_surfaces",
  },
  restResources,
  webhooks: {
    APP_INSTALLED: {
      deliveryMethod: "Http",
      callbackUrl: "/api/webhooks/app-installed",
    },
    APP_UNINSTALLED: {
      deliveryMethod: "Http",
      callbackUrl: "/api/webhooks/app-uninstalled",
    },
  },
});

export default shopify;
```

### db.server.ts (Database Connection)

```typescript
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

declare global {
  var __db: PrismaClient | undefined;
}

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__db) {
    global.__db = new PrismaClient();
  }
  prisma = global.__db;
}

export { prisma };
```

### prisma/schema.prisma (Data Models)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Session {
  id    String @id
  shop  String
  state String
  isOnline Boolean @default(false)
  scope String?
  expires Int?
  accessToken String
  refreshToken String?
  user Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Product {
  id        String  @id
  shopifyId String  @unique
  title     String
  handle    String
  status    String
  vendor    String?
  productType String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Order {
  id        String  @id
  shopifyId String  @unique
  email     String
  totalPrice String
  createdAt DateTime @default(now())
}
```

### Environment Variables (.env)

```env
SHOPIFY_API_KEY=YOUR_API_KEY
SHOPIFY_API_SECRET=YOUR_API_SECRET
SHOPIFY_APP_ID=YOUR_APP_ID
SCOPES=write_products,read_orders,write_inventory
HOST=https://RANDOMHASH.lhr.life
DATABASE_URL=file:./dev.db
NODE_ENV=development
```

### package.json (Key Dependencies)

```json
{
  "dependencies": {
    "@shopify/shopify-app-remix": "^4.1.0",
    "@shopify/polaris": "^12.0.0",
    "remix": "^2.0.0",
    "react-router": "^7.0.0",
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "@shopify/api-codegen-preset": "^1.0.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "dev": "remix dev --manual",
    "build": "remix build",
    "start": "remix-serve build",
    "type-check": "tsc --noEmit",
    "graphql-codegen": "graphql-codegen --config codegen.ts"
  }
}
```

## shopify.app.toml Schema Reference

### Complete Example with All Sections

```toml
scopes = "write_products,read_orders,write_inventory,read_fulfillments"
title = "My Shopify App"
description = "App that manages products and inventory"

[build]
automatically_update_urls_on_dev = true
dev_store_url = "dev-store.myshopify.com"

[auth]
redirect_urls = [
  "https://example.com/api/auth/callback"
]

[webhooks]
api_version = "2026-07"

[[webhooks.subscriptions]]
topics = ["products/create", "products/update"]
uri = "api/webhooks/products"
filter_query = "status:active"
include_fields = ["id", "title", "handle", "status"]

[[webhooks.subscriptions]]
topics = ["orders/create"]
uri = "api/webhooks/orders"

[pos]
embedded = false

[admin]
embedded = true

[[app_extensions]]
type = "admin_action"
handle = "bulk-edit-products"
label = "Bulk Edit Products"

[[app_extensions]]
type = "checkout_ui"
handle = "post-purchase-upsell"
configuration = "checkout.json"

[[app_extensions]]
type = "theme_app_extension"
handle = "theme-blocks"

[[app_extensions]]
type = "product_discount"
handle = "volume-discount"

[[app_extensions]]
type = "shipping_discount"
handle = "free-shipping"

[settings]
fields = [
  { key = "sync_enabled", type = "boolean", default = true },
  { key = "max_products", type = "number", default = 100 },
  { key = "webhook_delay", type = "number", default = 5 }
]
```

## Extension Types Reference

### admin_action
Extends Admin UI with custom buttons/actions in product, order, or customer pages.

```typescript
// extensions/admin-action/src/index.tsx
import { extend, Button, Section } from "@shopify/ui-extensions/admin";

export default extend("admin.product-details.action.render", (root, api) => {
  root.appendChild(
    root.createElement(Button, {
      onPress: () => {
        api.toast.show("Action triggered!");
      },
    }, "Custom Action")
  );
});
```

### checkout_ui
Customize checkout flow. Limited to specific UI points.

```typescript
// extensions/checkout-ui/src/index.tsx
import { extend, TextField } from "@shopify/ui-extensions/checkout";

export default extend("purchase.checkout.contact-email.render-before", (root) => {
  root.appendChild(
    root.createElement(TextField, {
      label: "Referral Code",
      onChange: (value) => console.log(value),
    })
  );
});
```

### theme_app_extension
Add liquid blocks/sections to theme editor.

```json
// extensions/theme/blocks/custom-section.json
{
  "name": "Custom Section",
  "target": "section",
  "settings": [
    {
      "type": "text",
      "id": "title",
      "label": "Section Title"
    }
  ]
}
```

### product_discount / shipping_discount / payment_customization
Pricing functions—JavaScript executed server-side during checkout.

```javascript
// extensions/product-discount/src/index.js
export function run(input) {
  return input.lines
    .filter(line => line.quantity > 5)
    .map(line => ({
      cartLineId: line.id,
      percentageDecrease: {
        value: 10.0
      }
    }));
}
```

### post_purchase_ui
Show custom page after purchase confirmation.

```typescript
// extensions/post-purchase/src/index.tsx
import { extend, Heading, Button } from "@shopify/ui-extensions/post_purchase";

export default extend("purchase.post-purchase.block.render", (root, api) => {
  root.appendChild(
    root.createElement(Heading, {}, "Thank you for your purchase!")
  );
});
```

## Local Development Workflow

### Start Dev Server

```bash
npm run dev
```

Expected output:
```
✓ Tunnel created at https://RANDOMHASH.lhr.life
✓ App URL: https://RANDOMHASH.lhr.life/api/auth
✓ Admin API credentials loaded
✓ Database: SQLite (dev.db)
✓ Webhooks: 3 subscriptions configured
✓ HMR active on port 3000
✓ Listening on all interfaces
```

### Hot Module Replacement (HMR)

HMR is enabled by default. Changes to:
- `.tsx` files in `/app/routes` → auto-reload
- `.ts` files in `/app` → server restart
- `shopify.app.toml` → restart required

Do NOT manually restart; HMR handles reloads.

### Environment Injection During Dev

The tunnel URL is automatically injected as:
- `HOST=https://RANDOMHASH.lhr.life`
- `SHOPIFY_APP_ID` from shopify.app.toml
- Scopes from shopify.app.toml

### Webhook Testing in Local Dev

Configure webhooks in Partner dashboard to point to tunnel URL:
```
https://RANDOMHASH.lhr.life/api/webhooks/products
```

Test webhook delivery:
```bash
curl -X POST https://RANDOMHASH.lhr.life/api/webhooks/products \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-SHA256: SIGNATURE" \
  -d '{
    "id": "1234567890",
    "title": "Test Product",
    "handle": "test-product"
  }'
```

### 5 Common Dev Failures and Fixes

**Failure 1: Tunnel Connection Lost**
```
Error: Tunnel disconnected
```
Fix: Restart dev server (Ctrl+C, then npm run dev)

**Failure 2: PORT 3000 Already in Use**
```
Error: EADDRINUSE :::3000
```
Fix: lsof -i :3000 | kill -9 <PID> or use PORT=3001 npm run dev

**Failure 3: Database Not Found**
```
PrismaClientInitializationError: Can't reach database server
```
Fix: Run migrations: npx prisma migrate dev

**Failure 4: Invalid Scopes in shopify.app.toml**
```
Error: Invalid scope 'read_prodcuts'
```
Fix: Check spelling in scopes = "..." line (e.g., read_products)

**Failure 5: Webhook Signature Mismatch**
```
Error: HMAC verification failed
```
Fix: Ensure webhook secret in handler matches SHOPIFY_API_SECRET in .env

## Deployment Workflow

### Pre-Deployment Checklist

- Update version in shopify.app.toml: version = "1.0.1"
- Run tests: npm test
- Build: npm run build
- Check for errors: npm run type-check
- Commit changes: git commit -am "Release v1.0.1"

### Deploy Command

```bash
shopify app deploy
```

Output:
```
✓ Validating shopify.app.toml
✓ Building production bundle
✓ Uploading to Partner dashboard
✓ Deployment ID: dpl_XXXXX
✓ View dashboard: https://partners.shopify.com/dashboard/apps
```

### Release (Make Live)

```bash
shopify app release --version 1.0.1
```

This makes the deployed version available to merchants. Without release, the app only exists in your Partner dashboard.

### Rollback to Previous Version

```bash
shopify app deploy --version 1.0.0
shopify app release --version 1.0.0
```

### Environment Management

Set environment variables in Partner dashboard:
1. Go to App Settings → Environment Variables
2. Add: WEBHOOK_QUEUE_URL, ANALYTICS_API_KEY, etc.
3. Redeploy to apply

Access in code:
```typescript
const queueUrl = process.env.WEBHOOK_QUEUE_URL;
```

## Theme CLI

### Theme Development Server

```bash
shopify theme dev --store example.myshopify.com
```

Uploads theme files to live store and watches for changes.

### Pull Theme from Store

```bash
shopify theme pull --theme-id 123456789
```

Downloads all theme files to /theme directory.

### Push Theme to Store

```bash
shopify theme push --force --no-delete
```

Uploads local theme files to store. --no-delete prevents deleting files in store.

### Theme File Structure

```
theme/
├── config/
│   └── settings_schema.json
├── sections/
│   ├── header.liquid
│   └── product.liquid
├── templates/
│   ├── index.json
│   └── product.json
├── snippets/
│   └── product-card.liquid
├── assets/
│   ├── styles.css
│   └── main.js
└── locales/
    └── en.json
```

## GraphQL Codegen Setup

### Installation

```bash
npm install -D @shopify/api-codegen-preset graphql-codegen
```

### codegen.ts Configuration

```typescript
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "https://shopify.dev/admin-api-explorer/latest/graphql.json",
  documents: ["app/**/*.{ts,tsx}"],
  generates: {
    "generated/graphql.ts": {
      preset: "@shopify/api-codegen-preset",
      presetConfig: {
        apiVersion: "2026-07",
        module: "graphql-request",
      },
    },
  },
};

export default config;
```

### Usage Example

```typescript
// app/routes/products.tsx
import { graphql } from "../generated/graphql";
import { client } from "../shopify.server";

const GetProductsQuery = graphql(`
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          handle
          status
        }
      }
    }
  }
`);

export async function loader({ context }) {
  const data = await client.query({
    query: GetProductsQuery,
    variables: { first: 10 },
  });
  return data.products.edges;
}
```

### Generate Types

```bash
npm run graphql-codegen
```

Generates fully-typed GraphQL operations in generated/graphql.ts.

## Common Errors Playbook

### Error 1: "Cannot find module '@shopify/shopify-app-remix'"

**Cause:** Missing package in node_modules

**Fix:**
```bash
npm install
npm install @shopify/shopify-app-remix@^4.1.0
npm run build
```

### Error 2: "Invalid SHOPIFY_API_KEY or SHOPIFY_API_SECRET"

**Cause:** Environment variables not set or incorrect

**Fix:**
1. Verify in .env: SHOPIFY_API_KEY=xxx and SHOPIFY_API_SECRET=yyy
2. Check Partner dashboard App Credentials tab
3. If using Codespace/CI: Add secrets to GitHub Secrets or deployment platform

### Error 3: "Prisma: Could not find the 'libquery_engine' runtime"

**Cause:** Prisma binaries not compiled for your platform

**Fix:**
```bash
node <plugin-root>/scripts/reset-shopify-cache.mjs --include prisma/.prisma
npm install
npx prisma generate
npx prisma migrate dev
```

### Error 4: "Tunnel URL expires in X minutes"

**Cause:** Cloudflare free tier tunnel expires after inactivity

**Fix:**
```bash
shopify app dev --reset
# or switch to ngrok:
shopify app dev --tunnel-provider ngrok
```

### Error 5: "No session found for shop example.myshopify.com"

**Cause:** User not authenticated or session expired

**Fix:**
```typescript
// Ensure middleware is loaded:
import { sessionMiddleware } from "@shopify/shopify-app-remix/server";

export const loader = async ({ context }) => {
  const { session } = context;
  if (!session) {
    return redirect("/api/auth/login");
  }
};
```

### Error 6: "Webhook subscription already exists"

**Cause:** Duplicate webhook registration

**Fix:**
```bash
shopify app auth logout
rm dev.db
npm run dev
# Recreates from scratch
```

### Error 7: "Extension type 'admin_action' not supported in API version 2024-10"

**Cause:** Admin actions require API version 2025-01+

**Fix:** Update shopify.app.toml:
```toml
api_version = "2026-07"
```

### Error 8: "CORS error: Origin not allowed"

**Cause:** Admin API CORS policy blocking requests

**Fix:**
1. Ensure requests come from authenticated app context (not localhost)
2. Use shopify.sessionStorage for session retrieval
3. Use shopify.rest.api(session) to create authenticated client

### Error 9: "Cannot read property 'shop' of undefined"

**Cause:** Session object not populated

**Fix:**
```typescript
const session = await shopify.sessionStorage.loadSession(sessionId);
if (!session) throw new Error("Session not found");
const { shop } = session;
```

### Error 10: "Database migration pending"

**Cause:** Schema changes not applied

**Fix:**
```bash
npx prisma migrate dev --name "describe migration"
npm run build
npm run dev
```

## Decision Tree (Command Selection)

User wants to create a new app? Use: shopify app init --template remix

User wants to start local dev? Use: npm run dev (includes tunnel auto-setup)

User wants to generate extension? Options:
- Admin action: shopify generate extension --type admin_action
- Checkout UI: shopify generate extension --type checkout_ui
- Theme extension: shopify generate extension --type theme_app_extension
- Function: shopify generate extension --type shipping_discount

User wants to deploy app? Options:
- First time: shopify app deploy (creates version)
- Update existing: shopify app deploy --force

User wants to make version live? Use: shopify app release --version X.Y.Z

User wants to work with themes? Options:
- Download: shopify theme pull --theme-id 123456789
- Upload: shopify theme push
- Dev server: shopify theme dev --store example.myshopify.com

User wants to test webhooks? Already running in dev server, use curl or Webhook Tester

User wants to generate GraphQL types? Use: npm run graphql-codegen

User wants to troubleshoot? Options:
- Tunnel broken: shopify app dev --reset
- DB broken: rm dev.db && npm run dev
- Auth broken: shopify auth logout && npm run dev
- Port in use: PORT=3001 npm run dev

## Recipes & Cookbook

### Recipe 1: Scaffold New Shopify App from Scratch

Goal: Create a working Shopify app in 5 minutes

```bash
# 1. Init with Remix template
shopify app init --template remix
cd my-app

# 2. Install deps
npm install

# 3. Create .env
cp .env.example .env
# Edit .env: add SHOPIFY_API_KEY and SHOPIFY_API_SECRET from Partner dashboard

# 4. Setup database
npx prisma migrate dev --name "init"

# 5. Start dev server
npm run dev

# 6. Open in browser
# Visit tunnel URL shown in terminal
```

Key Files Created:
- shopify.app.toml (app config)
- app/shopify.server.ts (Shopify setup)
- app/db.server.ts (DB connection)
- prisma/schema.prisma (data models)
- Tunnel automatically created and running

### Recipe 2: Add Admin Action Extension

Goal: Add a "Bulk Edit" button to product details page

```bash
# 1. Generate extension
shopify generate extension --type admin_action

# 2. When prompted:
# Extension handle: bulk-edit-products
# Surface: admin.product-details.action.render

# 3. Generated file: extensions/admin-action/src/index.tsx
# Edit to include proper API calls

# 4. Add to shopify.app.toml:
[[app_extensions]]
type = "admin_action"
handle = "bulk-edit-products"
label = "Bulk Edit Products"

# 5. Deploy
shopify app deploy
```

### Recipe 3: Add Checkout UI Extension

Goal: Add upsell prompt after purchase

```bash
# 1. Generate extension
shopify generate extension --type checkout_ui

# 2. When prompted:
# Extension handle: post-purchase-upsell
# API version: 2026-07 (verify latest stable before use)

# 3. Edit extensions/checkout-ui/src/index.tsx with custom logic

# 4. Add to shopify.app.toml:
[[app_extensions]]
type = "checkout_ui"
handle = "post-purchase-upsell"

# 5. Deploy
shopify app deploy
```

### Recipe 4: Add Discount Function

Goal: Apply 10% discount to orders over $100

```bash
# 1. Generate function
shopify generate extension --type product_discount

# 2. Edit extensions/product-discount/src/index.js with business logic

# 3. Add to shopify.app.toml:
[[app_extensions]]
type = "product_discount"
handle = "min-order-discount"

# 4. Create function config file:
# extensions/product-discount/shopify.function.toml:
type = "product_discount"
api_version = "2026-07"

# 5. Deploy
shopify app deploy
```

### Recipe 5: Set Up Webhook Handler for Orders

Goal: Sync orders to external system when created

```bash
# 1. Add webhook subscription to shopify.server.ts with proper callbacks

# 2. Update shopify.app.toml scopes:
scopes = "read_orders,write_inventory"

# 3. Create webhook handler: app/routes/api/webhooks/orders-create.ts
# with proper signature validation and external sync logic

# 4. Test with curl or Webhook Tester in Partner dashboard

# 5. Deploy
shopify app deploy
```

### Recipe 6: Migrate Config from PHP to Remix

Goal: Move from legacy PHP app to new Remix app

```bash
# 1. Export old PHP app config
# In old app, run: php export-config.php > old-config.json

# 2. Create new Remix app
shopify app init --template remix

# 3. Map config to shopify.app.toml structure

# 4. Map environment variables from old to new format

# 5. Copy and refactor webhook handlers from PHP to TypeScript

# 6. Test thoroughly
npm run dev

# 7. Deploy both side-by-side during transition period
```

---

Version note: examples were refreshed for Admin API 2026-07. Verify current Shopify CLI and package versions before installation.
