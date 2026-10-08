---
name: shopify-mcp
description: "Use this skill for shopify mcp. Triggers include: 'shopify mcp', 'shopify dev mcp', 'storefront mcp', 'merchant-facing mcp', 'well-known mcp', 'shopify mcp configuration', 'custom mcp shopify', 'agentic commerce', 'shopify agent', 'claude code shopify integration', 'mcp.json', 'shopify mcp setup'."
---

# Shopify MCP Integration Guide

Model Context Protocol (MCP) servers connect Claude to Shopify data and operations. There are three deployment patterns: Shopify Dev MCP (developer-centric), Storefront MCP (merchant-centric), and custom MCPs (specialized workflows). This guide covers setup, configuration, implementation patterns, and agentic commerce use cases.

## Shopify Dev MCP: Developer Tools for Claude Code

Shopify Dev MCP is a read-only developer toolkit integrated into Claude Code. It provides access to admin APIs, schema introspection, development store management, and app testing utilities without building a custom MCP.

### Installation and Setup

The Shopify Dev MCP is installed via command-line setup:

```bash
npx -y @shopify/dev-mcp setup
```

This command:
1. Prompts for Shopify organization/store selection
2. Creates a development app or reuses existing one
3. Stores authentication tokens securely in system keychain
4. Registers the MCP server in `~/.claude.json/mcpServers`
5. Restarts Claude Code to load the new MCP

No additional configuration is required post-setup. The MCP automatically handles token refresh and scope validation.

### Claude Code Configuration

After setup, `~/.claude.json/mcpServers` contains:

```json
{
  "mcpServers": {
    "shopify": {
      "command": "npx",
      "args": ["-y", "@shopify/dev-mcp", "run"],
      "env": {
        "SHOPIFY_AUTH_TOKEN": "shpat_...",
        "SHOPIFY_STORE": "dev-store-name.myshopify.com",
        "SHOPIFY_ORG_ID": "gid://shopify/Organization/12345"
      }
    }
  }
}
```

Manual configuration is unnecessary unless you need environment-specific tokens or custom server paths. For advanced setups (air-gapped networks, custom HTTP proxies), edit the env dict directly.

### Dev MCP Capabilities

The Shopify Dev MCP provides these read-only tools:

**Admin API Query Tool**
- Execute GraphQL queries against the API version configured for the connected development store
- Full schema support (Products, Orders, Customers, Fulfillments, Inventory, etc.)
- Automatic scope validation (app must have required scopes)
- Response size limit: 5MB per query
- Query complexity limit: 100 points (Admin API default)

```graphql
query GetProductMetafields($id: ID!) {
  product(id: $id) {
    id
    title
    metafields(first: 10) {
      edges {
        node {
          namespace
          key
          value
        }
      }
    }
  }
}
```

**REST API Endpoint Tool**
- Use legacy Admin REST endpoints only when the connected tool and existing app explicitly support them
- Bearer token authentication handled automatically
- Useful for bulk operations, webhooks, flow triggers
- Rate limit: standard REST bucket holds 40 requests and restores 2 requests/second; read response headers and retry safely

**Store Introspection Tool**
- List installed apps, extensions, functions, webhooks
- Retrieve store metadata (plan, currency, timezone, brand settings)
- Useful for understanding store configuration before building
- No rate limiting

**App Testing Tool**
- Trigger test webhooks (app/installed, app/uninstalled, orders/create)
- List development app credentials
- Rotate API credentials securely
- Simulate store events without live transactions

**Schema Browser Tool**
- Explore GraphQL schema interactively
- Get field descriptions, arguments, return types
- Filter by type (Query, Mutation, Subscription, Object, Enum)
- Search for fields by name or description

### When to Recommend Dev MCP Installation

Recommend Dev MCP when:
- User is building a Shopify app in Claude Code
- User needs to test queries against their dev store without leaving Claude
- User is debugging function behavior or app logic
- User is prototyping Admin API integrations
- User needs quick schema lookups during development

Do NOT recommend if:
- User needs custom logic beyond Admin API (use custom MCP)
- User is building a public app without a Shopify org (no auth available)
- User needs to connect multiple stores (use Storefront MCP + app routes)

### Dev MCP Workflow Example

```
User: "Add a debug webhook that logs all order updates to my app"

Claude uses Dev MCP to:
1. Query store's webhook endpoints (Admin API GET /webhooks.json)
2. Check existing webhooks for duplicates
3. Create new webhook via Admin API POST /webhooks.json
4. Confirm creation and return webhook ID

Claude: "I've registered webhook ID gid://shopify/Webhook/123456
to POST order/update events to your app. Test it by placing an order."
```

## Storefront MCP: Merchant-Facing Agent Tools

Storefront MCP is a custom MCP deployed at `/.well-known/mcp.json` on your storefront. It enables AI agents (Claude, OpenAI Operator, Perplexity Shopping) to browse products, manage carts, apply discounts, and complete purchases on behalf of customers.

### Architecture

Storefront MCP is a lightweight HTTP server serving MCP protocol at `/.well-known/mcp.json`. When an AI agent visits your storefront, it discovers the MCP server via well-known endpoint and establishes communication for tool access.

```
Customer Browser / AI Agent
         ↓
    Storefront (Remix/Next)
         ↓
  /.well-known/mcp.json
         ↓
   MCP Server (Node.js)
         ↓
   Storefront API / Backend DB
```

### Required Storefront API Scopes

Your MCP server must have a Storefront API access token with these scopes:

```
customer-account-api:customer
storefront-api:read_products
storefront-api:read_product_variants
storefront-api:read_collections
storefront-api:read_carts
storefront-api:write_carts
storefront-api:read_customers
```

Scopes are configured in `shopify.app.toml`:

```toml
scopes = "customer-account-api:customer,storefront-api:read_products,storefront-api:read_product_variants,storefront-api:read_collections,storefront-api:read_carts,storefront-api:write_carts,storefront-api:read_customers"
```

### Core Tools

**search_catalog**
- Text search across products/collections
- Returns 10 highest-relevance results
- Includes images, pricing, availability
- Filters by collection/vendor/price range optional

```json
{
  "name": "search_catalog",
  "description": "Search storefront products by keyword",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {"type": "string"},
      "limit": {"type": "number", "default": 10},
      "filter": {"type": "string", "enum": ["in_stock", "sale", "new"]}
    }
  }
}
```

**get_product**
- Fetch full product details by product ID
- Includes variants, metafields, recommendations, ratings
- Returns available inventory counts per variant
- Shows subscription/prepaid options if available

**lookup_product**
- Find product by SKU, barcode, or vendor ID
- Useful when AI agent has partial product info
- Returns product ID for use with get_product

**get_cart_state**
- Retrieve current customer cart
- Shows line items, subtotal, taxes, shipping estimates
- Includes applied discounts, gift cards, notes
- Returns cart ID for mutations

**add_to_cart**
- Add product variant to cart with quantity
- Creates cart if none exists
- Returns updated cart state
- Validates variant availability before adding

**apply_discount**
- Apply discount code to active cart
- Returns updated totals after discount
- Shows discount description and terms
- Validates code and customer eligibility

**create_checkout**
- Initiate checkout flow for current cart
- Returns checkout URL (redirects to payment)
- Captures customer email if known
- Applies language/currency preferences

### Storefront MCP Implementation (Remix)

Create `/routes/.well-known/mcp.json.ts`:

```typescript
import { json, type LoaderFunction } from "@remix-run/node";
import { storefront } from "~/lib/shopify.server";

export const loader: LoaderFunction = async ({ request }) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  return json({
    protocolVersion: "2024-11-05",
    name: "my-storefront-mcp",
    version: "1.0.0",
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
    tools: [
      {
        name: "search_catalog",
        description: "Search products by keyword",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", default: 10 },
            filter: {
              type: "string",
              enum: ["in_stock", "sale", "new"],
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_product",
        description: "Get product details by ID",
        inputSchema: {
          type: "object",
          properties: {
            productId: {
              type: "string",
              description: "Shopify product ID (gid://...)",
            },
          },
          required: ["productId"],
        },
      },
      {
        name: "get_cart_state",
        description: "Retrieve current cart",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "add_to_cart",
        description: "Add variant to cart",
        inputSchema: {
          type: "object",
          properties: {
            variantId: { type: "string" },
            quantity: { type: "number", default: 1 },
          },
          required: ["variantId"],
        },
      },
      {
        name: "apply_discount",
        description: "Apply discount code",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string" },
            cartId: { type: "string" },
          },
          required: ["code"],
        },
      },
    ],
  });
};
```

Create `/routes/api/mcp/tool-call.ts` to handle tool invocations:

```typescript
import { json, type ActionFunction } from "@remix-run/node";
import { storefront } from "~/lib/shopify.server";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { tool, input, meta } = await request.json();
  const cartId = meta?.cartId;

  switch (tool) {
    case "search_catalog": {
      const query = `query SearchProducts($query: String!) {
        search(first: ${input.limit || 10}, query: $query) {
          edges {
            node {
              ... on Product {
                id
                title
                handle
                featuredImage { url }
                priceRange {
                  minVariantPrice { amount currency }
                }
              }
            }
          }
        }
      }`;

      const result = await storefront.query(query, {
        variables: { query: input.query },
      });

      return json({
        products: result.search.edges.map((e: any) => ({
          id: e.node.id,
          title: e.node.title,
          handle: e.node.handle,
          image: e.node.featuredImage?.url,
          price: e.node.priceRange.minVariantPrice.amount,
          currency: e.node.priceRange.minVariantPrice.currency,
        })),
      });
    }

    case "add_to_cart": {
      const cartAddQuery = `mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart { id lines(first: 10) { edges { node { id quantity variant { id } } } } }
          userErrors { message field }
        }
      }`;

      const cartResult = await storefront.mutate(cartAddQuery, {
        variables: {
          cartId,
          lines: [{ variantId: input.variantId, quantity: input.quantity }],
        },
      });

      if (cartResult.cartLinesAdd.userErrors.length > 0) {
        return json(
          { error: cartResult.cartLinesAdd.userErrors[0].message },
          { status: 400 }
        );
      }

      return json({ cart: cartResult.cartLinesAdd.cart });
    }

    case "apply_discount": {
      const discountQuery = `mutation ApplyDiscount($cartId: ID!, $discountCode: String!) {
        cartDiscountCodesUpdate(cartId: $cartId, discountCodes: [$discountCode]) {
          cart { id cost { totalAmount { amount } } }
          userErrors { message }
        }
      }`;

      const result = await storefront.mutate(discountQuery, {
        variables: { cartId, discountCode: input.code },
      });

      if (result.cartDiscountCodesUpdate.userErrors.length > 0) {
        return json(
          { error: result.cartDiscountCodesUpdate.userErrors[0].message },
          { status: 400 }
        );
      }

      return json({ cart: result.cartDiscountCodesUpdate.cart });
    }

    default:
      return json({ error: "Unknown tool" }, { status: 400 });
  }
};
```

## Custom MCP for Shopify Apps

Build a custom MCP when you need specialized agent tools beyond standard Admin API or Storefront API access. Common use cases: workflow automation, data aggregation, custom business logic, integration with third-party systems.

### Custom MCP Structure

```
shopify-app-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP server main entry
│   ├── tools/
│   │   ├── inventory.ts  # Inventory management tools
│   │   ├── reporting.ts  # Custom reporting tools
│   │   └── automation.ts # Workflow automation tools
│   └── lib/
│       ├── shopify.ts    # Admin API client
│       └── db.ts         # Database queries
└── stdio.mjs             # Node.js stdio transport
```

### Example: Custom Inventory MCP

```typescript
// src/tools/inventory.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  Tool,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";

export const inventoryTools: Tool[] = [
  {
    name: "adjust_inventory",
    description: "Adjust inventory levels for a variant",
    inputSchema: {
      type: "object",
      properties: {
        variantId: { type: "string" },
        quantityAdjustment: { type: "number" },
        reason: {
          type: "string",
          enum: [
            "damaged",
            "lost",
            "count_correction",
            "restock",
            "donation",
          ],
        },
      },
      required: ["variantId", "quantityAdjustment", "reason"],
    },
  },
  {
    name: "get_low_stock_variants",
    description: "Find variants below minimum threshold",
    inputSchema: {
      type: "object",
      properties: {
        threshold: { type: "number", default: 5 },
        warehouseId: { type: "string" },
      },
    },
  },
];

export async function handleInventoryTool(
  toolName: string,
  input: Record<string, any>
): Promise<TextContent> {
  const adminClient = createAdminClient(); // use app's admin token

  if (toolName === "adjust_inventory") {
    const query = `
      mutation AdjustInventory($variantId: ID!, $quantity: Int!, $reason: String!) {
        inventoryAdjustQuantities(
          input: {
            changes: [
              {
                inventoryItemId: "gid://shopify/InventoryItem/${input.variantId}"
                availableDelta: ${input.quantityAdjustment}
              }
            ]
            reason: "${input.reason.toUpperCase()}"
          }
        ) {
          inventoryAdjustmentGroup {
            reason
            changes { inventoryItem { sku } }
          }
          userErrors { message }
        }
      }
    `;

    const result = await adminClient.mutate(query);
    return {
      type: "text",
      text: `Adjusted inventory: ${JSON.stringify(result, null, 2)}`,
    };
  }

  if (toolName === "get_low_stock_variants") {
    const query = `
      query LowStockVariants($threshold: Int!) {
        productVariants(first: 100, query: "inventory_quantity:<${input.threshold}") {
          edges {
            node {
              id
              title
              inventoryQuantity
            }
          }
        }
      }
    `;

    const result = await adminClient.query(query, {
      variables: { threshold: input.threshold },
    });
    return {
      type: "text",
      text: `Low stock variants: ${JSON.stringify(result, null, 2)}`,
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
```

### Registering Custom MCP in Claude Code

Add to `~/.claude.json/mcpServers`:

```json
{
  "mcpServers": {
    "shopify-inventory": {
      "command": "node",
      "args": ["path/to/shopify-app-mcp/stdio.mjs"],
      "env": {
        "SHOPIFY_ACCESS_TOKEN": "shpat_...",
        "SHOPIFY_SHOP": "mystore.myshopify.com",
        "DATABASE_URL": "postgres://..."
      }
    }
  }
}
```

## Agentic Commerce: AI-Powered Shopping

Agentic commerce uses AI agents (Claude, OpenAI Operator, Perplexity Shopping) to browse storefronts, understand products, manage carts, and complete purchases autonomously. The Storefront MCP enables this workflow.

### Shop AI (Shopify Native Agent)

Shopify's Shop AI is a managed agent available to merchants via Shop app. It enables:
- Natural language search ("show me sustainable leather jackets")
- Product comparison ("compare these two options")
- Customer service ("where's my order?", "return this item")
- Purchase assistance ("add bundle to cart", "apply code SAVE20")

Shop AI uses Storefront API directly (no custom MCP required). Optimize product descriptions and metafields for AI comprehension.

### OpenAI Operator (Agentic Browsing)

OpenAI Operator is an agentic browser that can interact with websites like a human. When Operator visits your storefront:

1. Operator discovers MCP at `/.well-known/mcp.json`
2. Operator loads available tools (search_catalog, add_to_cart, etc.)
3. Operator executes user requests autonomously
4. Requests like "find a gift under $50 and add it" work natively

To optimize for Operator:
- Ensure product metadata is complete (descriptions, tags, ratings)
- Include clear pricing and availability indicators
- Support discount codes discoverable in footer/header
- Test Storefront MCP endpoints for latency < 500ms
- Provide fallback HTML for legacy browsers

### Perplexity Shopping (AI Shopping Assistant)

Perplexity's shopping agent crawls your storefront and catalogs products for shopper recommendations. It:
- Synthesizes product comparisons across results
- Recommends bundles and alternatives
- Applies coupon codes automatically
- Offers price match guarantees (via integrations)

To optimize for Perplexity:
- Use structured data (JSON-LD) for products
- Publish sitemap.xml with all product URLs
- Include original/discounted pricing clearly
- Add customer review counts and ratings
- Avoid JavaScript-only product loading

### Building for Agentic Commerce

Product metadata shapes agent behavior. Ensure:

```json
{
  "product": {
    "id": "gid://shopify/Product/123456",
    "title": "Organic Cotton T-Shirt",
    "description": "100% certified organic cotton, GOTS certified. Features: breathable, hypoallergenic, sustainable. Care: machine wash cold, line dry.",
    "tags": ["organic", "sustainable", "cotton", "unisex"],
    "category": "Clothing > Tops > T-Shirts",
    "rating": 4.7,
    "reviewCount": 234,
    "variants": [
      {
        "id": "gid://shopify/ProductVariant/789",
        "title": "Black / XS",
        "price": "32.00",
        "compareAtPrice": "45.00",
        "available": true,
        "sku": "OCTT-BLACK-XS"
      }
    ],
    "collections": ["Summer Collection", "Bestsellers"],
    "seo": {
      "title": "Organic Cotton T-Shirt | Sustainable Fashion",
      "description": "Breathable, hypoallergenic organic cotton tees. GOTS certified, ethically made."
    }
  }
}
```

## Troubleshooting MCP Issues

| Issue | Symptom | Root Cause | Fix |
|-------|---------|------------|-----|
| MCP not discovered | "/.well-known/mcp.json 404" in Claude | Storefront route not created | Create `routes/.well-known/mcp.json.ts` and restart server |
| Authentication failed | "Invalid access token" in tool errors | Outdated token, scope mismatch | Regenerate token, verify scopes in shopify.app.toml |
| Tool call timeout | Tools don't respond after 10s | Slow Storefront API, N+1 queries | Batch queries, add caching, optimize GraphQL |
| CORS blocked | "Cross-Origin Request Blocked" | MCP endpoint enforcing CORS | Add CORS headers: Access-Control-Allow-Origin: * |
| Cart not persisting | Cart ID changes between calls | Stateless cart creation | Store cartId in session/localStorage, reuse in mutations |
| Discount code fails | "Code not valid for this customer" | Code restricted to segments | Test code eligibility, check customer tags match |
| Search returns empty | "Zero results for common query" | Products not indexed, missing tags | Ensure products published, rebuild search index |
| Agent loops indefinitely | Tool calls repeat without progress | Missing error handling in tool | Add explicit error messages, max iteration count |
| Storefront API rate limited | "Rate limit exceeded" after 10 calls | Too many parallel requests | Implement request queue, batch mutations |
| Schema not updating | New fields unavailable in queries | Admin API cache, schema change pending | Restart MCP server, verify API version matches |

## Best Practices

**MCP Server Reliability**
- Implement request queuing to avoid rate limits
- Add exponential backoff for transient failures
- Cache schema queries (schema rarely changes)
- Monitor tool latency; alert if > 1s
- Log all tool calls for debugging agentic behavior

**Security for Agentic Access**
- Storefront MCP should NOT have write access to orders
- Limit tool scope to read + cart mutations only
- Validate cart ownership before mutations (check customer ID)
- Require explicit customer consent for purchase-triggering tools
- Rate limit tool calls per IP (50 calls/minute per user agent)

**Agent Optimization**
- Provide clear tool descriptions (agents use these for routing)
- Return structured, machine-readable responses
- Include confidence scores for search results
- Offer tool combinations (e.g., "search + get_product" for details)
- Test agent flow: search → filter → add → discount → checkout

## Quick Reference: When to Use Which MCP

| Scenario | Recommended MCP | Reason |
|----------|-----------------|--------|
| Developer building Shopify app | Shopify Dev MCP | Read-only, zero config, full schema |
| Enabling AI shopping on storefront | Storefront MCP | Merchant-facing, tool-based, standard setup |
| Custom reporting dashboard | Custom MCP | Specialized queries, app-specific logic |
| Admin agent for store ops | Hybrid (Dev + Custom) | Dev MCP for queries, Custom for mutations |
| AI-powered product recs | Storefront MCP | Catalog search, product details, cart state |
| Workflow automation (reordering) | Custom MCP | Business logic beyond standard APIs |
