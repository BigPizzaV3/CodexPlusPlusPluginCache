---
name: shopify-functions
description: "Build WebAssembly functions for the Shopify checkout and order pipeline. Rust or JavaScript, 5ms execution window, 256KB binary limit. Targets cart transform, discount, validation, payment customization, delivery customization, order routing, fulfillment constraints, and localization. Triggers include: 'Shopify Function', 'WASM', 'Rust function', 'JavaScript function', 'function-runner', 'cart.transform.run', 'discount.run', 'cart.checkout-validation.run', 'cart.delivery-customization.run', 'cart.payment-customization.run', 'cart.lines.discounts.generate.run', 'order.routing.location.rank.run', 'fulfillment-constraints.run', 'localization.generate.run', 'metafield function', 'shopify function'."
---

# Shopify Functions

Shopify Functions are WebAssembly (WASM) units of business logic that extend the Shopify checkout, order, and fulfillment pipelines. They execute in a sandboxed runtime on Shopify's servers and have strict constraints: 5ms execution window, 256KB binary limit, no async I/O, no outbound HTTP to unknown hosts, and 30-point GraphQL query complexity ceiling.

## Architecture & Execution Model

**Function Lifecycle:**
1. Merchant installs your app; metafield definitions are registered
2. App reads merchant configuration from metafields (Shop, Product, Collection scopes)
3. On checkout/order event, Shopify invokes your function with Input JSON payload
4. Function executes WASM bytecode, applies business logic, returns JSON output
5. Output mutations are applied atomically to the checkout/order state

**Execution Constraints (Hard Limits):**
- Max execution time: 5ms (timeout failure = no operation)
- Max binary size: 256KB gzipped
- Max instructions: 11 million
- Max memory: 256KB heap
- Max output JSON: 256KB
- Max GraphQL query complexity: 30 points (estimate 1pt per simple field)
- No async I/O, no event loops, no multi-threading
- No network access except allowed_hosts (NEW 2025-01)
- Deterministic execution only

**Why WASM?** Shopify Functions run in Wasmtime, a fast WebAssembly runtime. This provides:
- Language flexibility: Compile Rust, JavaScript (via AssemblyScript), or Go to WASM
- Isolation: No access to host filesystem, process, or network (except whitelisted hosts)
- Performance: Near-native execution speed; optimized just-in-time compilation
- Security: Sandboxed; input/output validation by Shopify platform

## Function Targets & Checkout Pipeline

The Shopify checkout and order pipeline has **8 invocation points** (targets). Each target receives a specific input schema and must return a specific output schema:

| Target | Phase | Purpose | Input | Output | Latency Budget |
|--------|-------|---------|-------|--------|-----------------|
| `cart.transform.run` | 1. Cart | Transform line items (bundle, rename, change quantity) | Cart items, metafields | Modified items | 5ms |
| `cart.checkout-validation.run` | 2. Validation | Validate cart before payment (inventory, rules) | Cart state, attributes | Errors/blocks (optional) | 5ms |
| `cart.delivery-customization.run` | 3. Delivery | Customize rates, hide options, rank (shipping, pickup) | Delivery options, cart | Customized rates/ranking | 5ms |
| `cart.payment-customization.run` | 4. Payment | Hide payment methods, customize amounts | Payment methods, total | Customized methods/amounts | 5ms |
| `discount.run` | 5. Discount | Apply discounts (% off, $ off, free shipping, gift) | Cart items, rules | Discount targets + value | 5ms |
| `fulfillment-constraints.run` | 6. Fulfillment | Constrain what locations can fulfill each line | Cart items, locations | Location fulfillment rules | 5ms |
| `order.routing.location.rank.run` | 7. Order Routing | Rank locations for fulfillment (priority, cost) | Locations, order lines | Ranked location order | 5ms |
| `localization.generate.run` | 8. Localization | Generate translated/localized checkout labels | Buyer locale, shop context | Localized strings | 5ms |
| `cart.lines.discounts.generate.run` | 5b. Line Discounts | NEW 2025+: Per-line discounts with allocation strategy | Line items, rules | Per-line discounts with allocation | 5ms |

**Pipeline Execution:**
1. Cart Transform → Validation → Delivery/Payment Customization → Discount → Fulfillment → Order Routing → Localization
2. If any function returns error/blocks, pipeline halts and transaction fails
3. All function outputs are applied transactionally; no partial states

## Rust Project Structure (Recommended)

**Shopify CLI v4.0.0+ generates this scaffold:**

```bash
shopify app function create --template rust --name my-function
# Creates:
# my-function/
#   ├── Cargo.toml
#   ├── src/
#   │   ├── main.rs (entry point)
#   │   └── input.graphql (input query)
#   └── shopify.extension.toml (manifest)
```

**Cargo.toml (Rust 1.75+):**
```toml
[package]
name = "my-discount-function"
version = "0.1.0"
edition = "2021"

[dependencies]
shopify_function = { version = "1.0", features = ["wasm"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true

[lib]
crate-type = ["cdylib"]
```

**src/main.rs (Discount Function Example):**
```rust
use shopify_function::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct Input {
    pub cart: Cart,
    pub metafield: Option<ConfigMetafield>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Cart {
    pub lines: Vec<CartLine>,
    pub cost: CartCost,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CartLine {
    pub id: String,
    pub quantity: i32,
    pub cost: Cost,
    pub merchandise: Merchandise,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Merchandise {
    pub id: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Cost {
    pub amount: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CartCost {
    pub subtotal_amount: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ConfigMetafield {
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub discounts: Vec<Discount>,
    pub all_lines: bool,
}

#[derive(Debug, Serialize)]
pub struct Discount {
    pub targets: Vec<Target>,
    pub value: Value,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Target {
    pub line_item_group: LineItemGroup,
}

#[derive(Debug, Serialize)]
pub struct LineItemGroup {
    pub id: String,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum Value {
    #[serde(rename_all = "camelCase")]
    PercentageValue { percentage: String },
    #[serde(rename_all = "camelCase")]
    FixedAmountValue { fixed_amount: String },
}

#[shopify_function]
fn discount(input: Input) -> FunctionResult<Output> {
    let subtotal = input
        .cart
        .cost
        .subtotal_amount
        .parse::<f64>()
        .unwrap_or(0.0);

    if subtotal >= 100.0 {
        return Ok(Output {
            discounts: vec![Discount {
                targets: input
                    .cart
                    .lines
                    .iter()
                    .map(|line| Target {
                        line_item_group: LineItemGroup {
                            id: line.id.clone(),
                        },
                    })
                    .collect(),
                value: Value::PercentageValue {
                    percentage: "10.0".to_string(),
                },
                message: Some("10% off orders over $100".to_string()),
            }],
            all_lines: true,
        });
    }

    Ok(Output {
        discounts: vec![],
        all_lines: false,
    })
}
```

**src/input.graphql (Input Query for Discount Function):**
```graphql
query Input {
  cart {
    lines {
      id
      quantity
      cost {
        amount
      }
      merchandise {
        id
      }
    }
    cost {
      subtotal_amount
    }
  }
  metafield(namespace: "my-app", key: "discount-config") {
    value
  }
}
```

**shopify.extension.toml (Function Manifest):**
```toml
name = "My Discount Function"
description = "Applies percentage discount on orders over $100"

type = "function"
api_version = "2025-01"

[[targets]]
target = "discount.run"

[[metafields]]
namespace = "my-app"
key = "discount-config"
description = "JSON config: {\"thresholdAmount\": 100, \"discountPercentage\": 10}"
owner_type = "SHOP"

[[metafields]]
namespace = "my-app"
key = "enabled"
description = "Enable/disable discount"
owner_type = "SHOP"

[network]
allowed_hosts = ["api.external-service.com"]
```

**Build & Test:**
```bash
cd my-discount-function
shopify app function build
# Output: dist/index.wasm (gzipped, typically 50-100KB)

shopify app function run --input input.json
# Run locally with test payload
```

## JavaScript/TypeScript Project Structure

**Scaffold (Remix app with TypeScript):**
```bash
shopify app function create --template javascript --name my-function
```

**package.json:**
```json
{
  "name": "my-cart-transform",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "shopify app function build",
    "test": "shopify app function run --input test/input.json",
    "dev": "shopify app function run --watch"
  },
  "dependencies": {
    "@shopify/function-runner": "^1.0.0",
    "@shopify/type-generator": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "@types/node": "^20.0.0"
  }
}
```

**src/run.ts (Cart Transform Example: Bundle Related Items):**
```typescript
import { FunctionResult, TargetProduct } from "@shopify/function-runner";

interface Input {
  cart: {
    lines: Array<{
      id: string;
      quantity: number;
      cost: { amount: string };
      merchandise: { id: string; product?: { id: string; title: string } };
    }>;
  };
  metafield?: { value: string };
}

interface Output {
  lines: Array<{
    id: string;
    quantity?: number;
    merchandiseId?: string;
  }>;
  operations: Array<{
    add?: {
      merchandiseId: string;
      quantity: number;
    };
    remove?: {
      lineId: string;
    };
  }>;
}

export default function run(input: Input): FunctionResult<Output> {
  const bundleConfig = input.metafield
    ? JSON.parse(input.metafield.value)
    : { bundleName: "Starter Pack", items: [] };

  const lines = input.cart.lines;
  const operations: Output["operations"] = [];

  // Example: If cart has item A and item B, add item C at discount
  const hasItemA = lines.some((l) => l.merchandise.id === "gid://product/A");
  const hasItemB = lines.some((l) => l.merchandise.id === "gid://product/B");

  if (hasItemA && hasItemB) {
    operations.push({
      add: {
        merchandiseId: "gid://product/C",
        quantity: 1,
      },
    });
  }

  return {
    lines: lines.map((l) => ({ id: l.id })),
    operations,
  };
}
```

**src/input.graphql:**
```graphql
query Input {
  cart {
    lines {
      id
      quantity
      cost {
        amount
      }
      merchandise {
        id
        product {
          id
          title
        }
      }
    }
  }
  metafield(namespace: "my-app", key: "bundle-config") {
    value
  }
}
```

## Metafield Configuration Pattern

**Define Metafield in shopify.extension.toml:**
```toml
[[metafields]]
namespace = "my-app"
key = "discount-rules"
description = "JSON: {\"thresholdAmount\": 100, \"percentage\": 10, \"enabled\": true}"
owner_type = "SHOP"

[[metafields]]
namespace = "my-app"
key = "product-discount-rules"
description = "Product-specific discount config"
owner_type = "PRODUCT"

[[metafields]]
namespace = "my-app"
key = "collection-rules"
description = "Collection-specific rules"
owner_type = "COLLECTION"
```

**Query Metafield in input.graphql:**
```graphql
query Input {
  shop {
    id
  }
  metafield(namespace: "my-app", key: "discount-rules") {
    value
  }
  cart {
    lines {
      id
      merchandise {
        id
        product {
          id
          metafield(namespace: "my-app", key: "product-discount-rules") {
            value
          }
          collections(first: 5) {
            nodes {
              id
              metafield(namespace: "my-app", key: "collection-rules") {
                value
              }
            }
          }
        }
      }
    }
  }
}
```

**Parse & Use in Rust/JS Code:**
```rust
#[derive(Deserialize)]
struct DiscountConfig {
    threshold_amount: f64,
    percentage: f64,
    enabled: bool,
}

let config: DiscountConfig = serde_json::from_str(
    input.metafield.as_ref().map(|m| m.value.as_str()).unwrap_or("{}")
)?;

if !config.enabled {
    return Ok(Output { discounts: vec![] });
}

if subtotal >= config.threshold_amount {
    // Apply discount...
}
```

## Network Access (NEW 2025-01)

**Limited Outbound HTTP is Now Available:**

Functions can make HTTP requests to whitelisted hosts. This enables:
- Real-time inventory checks from external systems
- Currency conversion APIs
- Machine learning model inference
- Third-party rule engines

**Declare Allowed Hosts in shopify.extension.toml:**
```toml
[network]
allowed_hosts = [
  "api.inventory-service.com",
  "ml-models.example.com",
  "currency-api.service.io"
]
```

**Rust HTTP Example (using `reqwest` compiled to WASM):**
```rust
use shopify_function::prelude::*;

#[shopify_function]
fn validate(input: Input) -> FunctionResult<Output> {
    // Make HTTP call (sync only, no async/await in WASM)
    let inventory_url = format!(
        "https://api.inventory-service.com/stock/{}",
        input.cart.lines[0].merchandise.id
    );

    // Note: Real WASM HTTP is still limited; most functions use metafield-driven rules
    // True HTTP in functions is still experimental; verify with Shopify CLI

    Ok(Output { /* ... */ })
}
```

**Timeout & Fallback:**
- HTTP requests timeout at 500ms (must complete within function's 5ms window if combined with other logic)
- If HTTP fails, return safe default (e.g., allow delivery option, skip discount)
- Never block checkout on external HTTP failure

## Testing Functions

**Test Input File (input.json):**
```json
{
  "cart": {
    "lines": [
      {
        "id": "gid://shopify/CartLine/1",
        "quantity": 2,
        "cost": {
          "amount": "150.00"
        },
        "merchandise": {
          "id": "gid://shopify/ProductVariant/123"
        }
      }
    ],
    "cost": {
      "subtotal_amount": "150.00"
    }
  },
  "metafield": {
    "value": "{\"thresholdAmount\": 100, \"percentage\": 10}"
  }
}
```

**Run Function Locally:**
```bash
shopify app function run --input input.json

# Output:
# ✓ Function executed successfully
# {
#   "discounts": [
#     {
#       "targets": [{ "lineItemGroup": { "id": "gid://shopify/CartLine/1" } }],
#       "value": { "percentage": "10.0" },
#       "message": "10% off orders over $100"
#     }
#   ],
#   "all_lines": true
# }
```

**Replay Recorded Invocations:**
```bash
shopify app function run --replay
# Re-run against real checkout data captured from production
```

**Explain Query Complexity:**
```bash
shopify app function explain-query
# Analyzes input.graphql and reports complexity score (max 30)
```

**Golden Tests Pattern (Recommended):**
Create test cases in `tests/` directory:

```rust
// tests/discount_test.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discount_applied_over_100() {
        let input = Input {
            cart: Cart {
                lines: vec![CartLine {
                    id: "line1".to_string(),
                    quantity: 1,
                    cost: Cost {
                        amount: "150.00".to_string(),
                    },
                    merchandise: Merchandise {
                        id: "variant1".to_string(),
                    },
                }],
                cost: CartCost {
                    subtotal_amount: "150.00".to_string(),
                },
            },
            metafield: None,
        };

        let result = discount(input).unwrap();
        assert_eq!(result.discounts.len(), 1);
        assert_eq!(result.discounts[0].value, Value::PercentageValue { percentage: "10.0".to_string() });
    }

    #[test]
    fn test_no_discount_under_100() {
        let input = Input {
            cart: Cart {
                lines: vec![],
                cost: CartCost {
                    subtotal_amount: "50.00".to_string(),
                },
            },
            metafield: None,
        };

        let result = discount(input).unwrap();
        assert_eq!(result.discounts.len(), 0);
    }
}
```

Run tests:
```bash
cargo test
```

## Full Working Examples

**Example 1: Rust Discount Function (10% off orders > $100)**

File structure:
```
rust-discount/
├── Cargo.toml
├── shopify.extension.toml
├── src/
│   ├── main.rs
│   └── input.graphql
└── tests/
    └── discount_test.rs
```

`Cargo.toml`:
```toml
[package]
name = "rust-discount"
version = "0.1.0"
edition = "2021"

[dependencies]
shopify_function = "1.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
opt-level = "z"
lto = true
strip = true
```

`src/main.rs`:
```rust
use shopify_function::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Input {
    pub cart: Cart,
}

#[derive(Debug, Deserialize)]
pub struct Cart {
    pub lines: Vec<CartLine>,
    pub cost: CartCost,
}

#[derive(Debug, Deserialize)]
pub struct CartLine {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct CartCost {
    pub subtotal_amount: String,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub discounts: Vec<Discount>,
    pub all_lines: bool,
}

#[derive(Debug, Serialize)]
pub struct Discount {
    pub targets: Vec<Target>,
    pub value: DiscountValue,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Target {
    pub line_item_group: LineItemGroup,
}

#[derive(Debug, Serialize)]
pub struct LineItemGroup {
    pub id: String,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum DiscountValue {
    Percentage { percentage: String },
}

#[shopify_function]
fn discount(input: Input) -> FunctionResult<Output> {
    let subtotal = input.cart.cost.subtotal_amount.parse::<f64>().unwrap_or(0.0);

    if subtotal >= 100.0 {
        return Ok(Output {
            discounts: vec![Discount {
                targets: input.cart.lines.iter().map(|line| Target {
                    line_item_group: LineItemGroup { id: line.id.clone() },
                }).collect(),
                value: DiscountValue::Percentage { percentage: "10.0".to_string() },
                message: Some("10% off orders over $100".to_string()),
            }],
            all_lines: true,
        });
    }

    Ok(Output { discounts: vec![], all_lines: false })
}
```

**Example 2: JavaScript Cart Transform (Auto-Add Bundle Item)**

`src/run.ts`:
```typescript
export default function run(input) {
  const cart = input.cart;
  const operations = [];

  // If cart has specific product, auto-add complementary item
  const hasMainProduct = cart.lines.some(
    (line) => line.merchandise.id === "gid://shopify/ProductVariant/main123"
  );

  if (hasMainProduct && cart.lines.length === 1) {
    operations.push({
      add: {
        merchandiseId: "gid://shopify/ProductVariant/bundle456",
        quantity: 1,
      },
    });
  }

  return {
    lines: cart.lines.map((line) => ({ id: line.id })),
    operations,
  };
}
```

**Example 3: Rust Validation Function (Check Inventory)**

`src/main.rs`:
```rust
use shopify_function::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Input {
    pub cart: Cart,
}

#[derive(Debug, Deserialize)]
pub struct Cart {
    pub lines: Vec<CartLine>,
}

#[derive(Debug, Deserialize)]
pub struct CartLine {
    pub quantity: i32,
    pub merchandise: Merchandise,
}

#[derive(Debug, Deserialize)]
pub struct Merchandise {
    pub id: String,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub errors: Vec<ValidationError>,
}

#[derive(Debug, Serialize)]
pub struct ValidationError {
    pub message: String,
    pub target: String,
}

#[shopify_function]
fn validate(input: Input) -> FunctionResult<Output> {
    let mut errors = vec![];

    for line in &input.cart.lines {
        // Mock inventory check
        if line.quantity > 10 {
            errors.push(ValidationError {
                message: "Quantity exceeds available inventory".to_string(),
                target: line.merchandise.id.clone(),
            });
        }
    }

    Ok(Output { errors })
}
```

## Deployment & Verification

**Build & Deploy:**
```bash
# 1. Build WASM binary
shopify app function build

# 2. Verify binary size
ls -lh dist/index.wasm
# Should be <256KB (gzipped)

# 3. Test against sample input
shopify app function run --input test-input.json

# 4. Deploy with app
shopify app deploy
# Shopify CLI creates function version + deploys extension

# 5. Enable function in Shopify Admin
# Apps > Your App > Functions > [Function Name] > Enable
```

**Monitor Function Health:**
- Shopify Admin: Apps > Your App > Functions > [Name] > Metrics
- Track: execution count, error rate, latency percentiles
- Set alerts: >5% error rate, >90th percentile latency >3ms

**Version Management:**
- Functions are versioned by Shopify CLI deployment timestamp
- Active version runs on all new checkouts
- Rollback: Admin > Functions > [Name] > Versions > Select Previous
- No breaking changes: Always ship backward-compatible input/output

## Decision Tree: Which Function Target?

```
What do you need to do?

├─ Transform cart items (bundle, rename, remove)?
│  └─ target: cart.transform.run
│     Input: cart.lines (id, quantity, merchandise)
│     Output: modified lines

├─ Validate cart before checkout (inventory, rules)?
│  └─ target: cart.checkout-validation.run
│     Input: cart state
│     Output: validation errors (blocks checkout if present)

├─ Customize delivery options (hide, rate override)?
│  └─ target: cart.delivery-customization.run
│     Input: deliveryOptions[]
│     Output: customized/ranked options

├─ Hide payment methods or customize amounts?
│  └─ target: cart.payment-customization.run
│     Input: paymentMethods[]
│     Output: customized methods

├─ Apply discounts (% off, $ off, free shipping)?
│  └─ target: discount.run
│     Input: cart state, metafield config
│     Output: discount[] with targets & value

├─ Apply per-line discounts (2025+)?
│  └─ target: cart.lines.discounts.generate.run
│     Input: line items
│     Output: per-line discount with allocation

├─ Constrain which locations can fulfill items?
│  └─ target: fulfillment-constraints.run
│     Input: locations[], cart.lines
│     Output: fulfillment rules

├─ Rank locations for order routing (cost, priority)?
│  └─ target: order.routing.location.rank.run
│     Input: locations[], order
│     Output: ranked location[] order

└─ Generate localized checkout labels?
   └─ target: localization.generate.run
      Input: buyer locale, shop context
      Output: localized strings
```

## Troubleshooting & Common Issues

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| **WASM binary exceeds 256KB** | Heavy dependencies, unoptimized build | Set `opt-level = "z"`, `lto = true`, `strip = true` in Cargo.toml; remove unused deps; use `wasm-opt` post-processor |
| **Function timeout (5ms exceeded)** | Complex GraphQL query (30+ points) or heavy loop logic | Simplify input query; pre-aggregate in metafield; reduce loop iterations; profile with `shopify app function run --explain-query` |
| **Syntax error in input.graphql** | Invalid field names or nesting | Verify schema against latest API version; use `shopify app function explain-query` to validate |
| **Metafield returns null/empty** | Metafield not set on Shop/Product/Collection | Check Admin > Settings > Custom data; confirm namespace/key match shopify.extension.toml; set test value |
| **Discount doesn't apply in checkout** | Function returns OK but no discount output | Verify function is enabled in Admin > Apps > Your App > Functions; check discount logic (threshold check, target IDs match) |
| **Cart transform operation fails** | Invalid merchandiseId or operation structure | Verify merchandiseId format (gid://shopify/ProductVariant/XXX); check input query includes variant IDs; test with `shopify app function run` first |
| **Error: "Output exceeds 256KB"** | Returning too much data | Reduce output fields; compress message strings; avoid returning full cart state |
| **Validation function blocks all checkouts** | Always returning errors in Output | Add condition to only return errors when validation fails; default to empty errors[] |
| **Network request from function fails silently** | HTTP request to non-whitelisted host | Add host to `[network] allowed_hosts` in shopify.extension.toml; verify DNS resolution |
| **Graphql query complexity > 30 points** | Too many fields or nested selections | Remove unnecessary fields from input.graphql; use aliases to reduce redundant queries; check Admin API complexity docs |
| **Function runs but output ignored** | Wrong output format or missing required field** | Verify output JSON schema matches target spec (e.g., Discount must have targets[], value); test against sample input |
| **Type mismatch in Rust/TS** | Serde/TypeScript serialization error | Ensure struct field names match GraphQL response (snake_case vs camelCase); add #[serde(rename)] if needed |

## Performance Optimization

**Binary Size Reduction:**
```toml
[profile.release]
opt-level = "z"        # Maximum size optimization
lto = true             # Link-time optimization
codegen-units = 1      # Single codegen unit for better optimization
strip = true           # Strip debug symbols
panic = "abort"        # Use abort instead of unwind
```

**Query Optimization:**
- Request only fields needed for logic (each field ≈ 1 complexity point)
- Move repeated queries to metafield (query once, store in metadata)
- Use `first: 1` or `first: 5` limits instead of full collections
- Combine related fields into single query rather than separate queries

**Code Optimization (Rust):**
- Use `&str` instead of `String` where possible
- Pre-allocate Vec capacity if size is known
- Avoid cloning; use references
- Profile with `wasm-opt` post-processor:
  ```bash
  cargo install wasm-opt
  wasm-opt -Oz dist/index.wasm -o dist/index.wasm
  ```

**Output Optimization:**
- Serialize only required fields
- Use compact JSON (no whitespace)
- Limit discount message length
- Pre-compute values before serialization

## API Version & Changelog

**Version note:** The examples below document capabilities introduced in `2025-01`. Use the latest stable version supported by the specific Function target when creating a new extension.

**2025-01 New Features:**
- Network access via `allowed_hosts` declaration
- Per-line discounts via `cart.lines.discounts.generate.run`
- Improved error messages in function runtime
- Function async/await still NOT supported; purely synchronous

**2024-10 (Previous):**
- Original 8 function targets stable
- Metafield support
- GraphQL query complexity ceiling (30 points)

**Upgrading:**
```toml
# In shopify.extension.toml
api_version = "2026-07"  # Confirm the latest version supported by this Function target
```

Functions written for 2024-10 continue to work in 2025-01; no breaking changes.

## Resources

- **Shopify Functions Docs:** https://shopify.dev/docs/apps/functions
- **GraphQL Admin API:** https://shopify.dev/docs/api/admin-graphql/latest
- **CLI Reference:** `shopify app function --help`
- **WASM in Rust:** https://www.rust-lang.org/what/wasm/
- **Shopify Community:** https://community.shopify.com/c/shopify-apis-sdks/ct-p/apis-sdks
