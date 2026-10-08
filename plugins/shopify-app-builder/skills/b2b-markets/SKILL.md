---
name: b2b-markets
description: "Use when building Shopify B2B catalogs, multi-storefront B2B, company location pricing, wholesale checkout, Shopify Markets (multi-region), multi-currency pricing with @inContext, currency formatting, market-specific catalogs, payment terms (NET 30/60), or anything involving B2B Plus / Markets / international commerce features. Triggers: B2B, wholesale, company, locations, customer accounts B2B, Markets, @inContext, country code, currency code, market, catalog, price list, payment terms, NET 30, draft order B2B, vaulted card, 'shopify b2b', 'shopify markets'."
---

# Shopify B2B + Markets

## When to use this skill

Call this skill when:
- Merchant is setting up wholesale, B2B, or bulk ordering
- Building company catalogs, price lists, or location-based pricing
- Implementing payment terms (NET 30, NET 60, etc.) or vaulted card checkout
- Handling Shopify Markets setup, multi-region, multi-currency, or multi-language storefronts
- Using @inContext directive for currency/language-specific Storefront API queries
- Displaying multi-currency prices in Liquid, handling exchange rates, or market-aware inventory
- Building customer account UI extensions for B2B contacts
- Webhook listeners for B2B events: company.created, companyLocation.created, companyContact.created, draftOrder.created
- Checking which features require B2B Plus plan vs Shopify Markets standard vs core Shopify

## B2B on Shopify: the fundamentals

Shopify B2B Plus enables merchants to:
- Create **companies** (e.g., "Acme Corp") with multiple **company locations** (warehouses, branches)
- Assign **catalogs** (product + pricing rules) to each location
- Set **price lists** with percentage or fixed discounts, currency-specific pricing, date ranges
- Define **payment terms** (NET 30, NET 60, custom) and enable **vaulted card** recurring payments
- Create **draft orders** for company contacts, convert to paid orders with payment terms
- Use **customer account B2B** login (company contact sign-in) with location-switching UI

**B2B Plus-only features:**
- Company object and CompanyLocation hierarchy
- PriceList and Catalog system
- PaymentTerms (NET 30+, custom days)
- DraftOrder for B2B checkout
- Customer Account B2B extensions (login UI, location switching)

**Core Shopify (all plans can do):**
- Multiple currencies (requires Shopify Markets)
- Shopify Markets regions, domains, subfolders
- @inContext for Storefront API (language/country override)

**When to recommend B2B Plus:**
- Merchant has >2 wholesale partners
- Needs tiered pricing by location or customer segment
- Wants self-service company portal (contact management, order history, payment vaults)
- Needs recurring NET-term invoicing (vaulted cards)

---

## Core B2B objects

### Company

A company record represents a wholesale customer (e.g., a distributor, retailer, or reseller).

```graphql
query {
  companies(first: 10) {
    edges {
      node {
        id                  # gid://shopify/Company/12345
        name                # "Acme Corp"
        externalId          # Sync ID to your CRM
        metafields {
          key
          value
          namespace
        }
        locations(first: 10) {
          edges {
            node {
              id
              name          # "Acme - Chicago"
            }
          }
        }
      }
    }
  }
}
```

Mutations:
```graphql
mutation {
  companyCreate(input: {
    name: "Acme Corp"
    externalId: "crm-12345"
  }) {
    company {
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

### CompanyLocation

Represents a specific address/warehouse for a company. Each location can have its own catalog + price list assignment.

```graphql
query {
  companyLocationConnection(first: 5) {
    edges {
      node {
        id
        name
        address {
          address1
          city
          province
          zip
          country
        }
        contact {
          title
          lastName
          firstName
          email
          phone
        }
        catalogs(first: 5) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }
  }
}
```

Create a location:
```graphql
mutation {
  companyLocationCreate(input: {
    companyId: "gid://shopify/Company/12345"
    name: "Acme - Chicago"
    address: {
      address1: "123 Main St"
      city: "Chicago"
      province: "IL"
      zip: "60601"
      country: "US"
    }
  }) {
    companyLocation {
      id
      name
    }
  }
}
```

### CompanyContact

Represents a person at a company (authorized buyer, approver, etc.). They log in via Customer Account B2B to place orders.

```graphql
query {
  companyContactConnection(first: 10) {
    edges {
      node {
        id
        email
        firstName
        lastName
        role            # ADMIN, BUYER, APPROVER
        company {
          id
          name
        }
        companyLocations(first: 5) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  }
}
```

Add a contact:
```graphql
mutation {
  companyContactCreate(input: {
    email: "buyer@acme.com"
    firstName: "John"
    lastName: "Doe"
    companyId: "gid://shopify/Company/12345"
    role: BUYER
  }) {
    companyContact {
      id
      email
    }
  }
}
```

### Catalog

A catalog is a collection of products available to a company location, with associated prices + discounts.

```graphql
query {
  catalogs(first: 5) {
    edges {
      node {
        id
        title
        description
        publishedAt
        status            # ACTIVE, ARCHIVED, DRAFT
        companyLocationCount
        priceLists {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  }
}
```

Create a catalog:
```graphql
mutation {
  catalogCreate(input: {
    title: "Wholesale - Acme"
    description: "Exclusive products and pricing for Acme Corp"
  }) {
    catalog {
      id
      title
    }
  }
}
```

Assign catalog to locations:
```graphql
mutation {
  catalogPublish(input: {
    catalogId: "gid://shopify/Catalog/999"
    companyLocationIds: [
      "gid://shopify/CompanyLocation/111"
      "gid://shopify/CompanyLocation/222"
    ]
  }) {
    catalog {
      id
      publishedAt
    }
  }
}
```

### PriceList

Defines pricing rules for a catalog: fixed discounts, percentage reductions, or absolute prices. Currency-specific and date-range aware.

```graphql
query {
  priceList(id: "gid://shopify/PriceList/555") {
    id
    name
    currency              # USD, CAD, EUR, etc.
    parent {
      __typename
    }
    prices(first: 10) {
      edges {
        node {
          id
          variantId: variantId
          amount
          isRelative         # true = %, false = absolute
          startsAt
          endsAt
        }
      }
    }
  }
}
```

Create a price list:
```graphql
mutation {
  priceListCreate(input: {
    name: "10% Wholesale Discount - USD"
    currency: USD
    parent: {
      catalogId: "gid://shopify/Catalog/999"
    }
  }) {
    priceList {
      id
      name
    }
  }
}
```

Add prices to the list:
```graphql
mutation {
  priceListPriceAddOrUpdate(input: {
    priceListId: "gid://shopify/PriceList/555"
    prices: [
      {
        variantId: "gid://shopify/ProductVariant/111"
        amount: "-10"
        isRelative: true   # 10% discount
      }
      {
        variantId: "gid://shopify/ProductVariant/222"
        amount: "99.99"
        isRelative: false  # Absolute USD price
        startsAt: "2026-06-01T00:00:00Z"
        endsAt: "2026-06-30T23:59:59Z"
      }
    ]
  }) {
    prices {
      id
    }
  }
}
```

### PaymentTerms

Defines NET payment options (NET 30, NET 60, COD, etc.) available to a company.

```graphql
query {
  paymentTerms(first: 5) {
    edges {
      node {
        id
        name                # "NET 30"
        translatedName
        dueInDays: dueInDays     # 30 for NET 30
        standardTemplate
      }
    }
  }
}
```

Assign payment terms to a company:
```graphql
mutation {
  companyAssignPaymentTerms(input: {
    companyId: "gid://shopify/Company/12345"
    paymentTermsIds: [
      "gid://shopify/PaymentTerms/NET_30"
      "gid://shopify/PaymentTerms/NET_60"
    ]
  }) {
    company {
      id
      paymentTerms {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
}
```

### BuyerExperience

Defines checkout behavior (payment methods, vaulted cards, etc.) for B2B customers.

```graphql
query {
  buyerExperience(companyLocationId: "gid://shopify/CompanyLocation/111") {
    id
    paymentMethods      # Vaulted cards, NET terms enabled
    checkoutTouchPoint
  }
}
```

---

## Catalog + price list patterns

### Multi-location pricing

Assign the same catalog to multiple locations, each with its own price list (same products, different discounts per location):

```graphql
mutation {
  # Create base catalog
  catalogCreate(input: {
    title: "Premium Products"
  }) {
    catalog {
      id
    }
  }
}

# Then create 2 price lists (one per currency or region)
mutation {
  priceListCreate(input: {
    name: "Premium - USD (5% off)"
    currency: USD
    parent: { catalogId: "gid://shopify/Catalog/BASE" }
  }) {
    priceList { id }
  }
}

mutation {
  priceListCreate(input: {
    name: "Premium - CAD (3% off)"
    currency: CAD
    parent: { catalogId: "gid://shopify/Catalog/BASE" }
  }) {
    priceList { id }
  }
}

# Assign catalog, but each location sees its own currency
mutation {
  catalogPublish(input: {
    catalogId: "gid://shopify/Catalog/BASE"
    companyLocationIds: [
      "gid://shopify/CompanyLocation/US_HQ"
      "gid://shopify/CompanyLocation/CA_HQ"
    ]
  }) {
    catalog { id }
  }
}
```

**Key insight:** PriceList is currency-scoped. If a company location operates in CAD, query the CAD price list. The catalog is location-scoped but currency-agnostic; pricing is attached via the price list.

### Percentage + tiered discounts

Use `isRelative: true` for percentage, `isRelative: false` for absolute:

```graphql
mutation {
  priceListPriceAddOrUpdate(input: {
    priceListId: "gid://shopify/PriceList/555"
    prices: [
      # Tier 1: 5% off
      { variantId: "v111", amount: "-5", isRelative: true }
      # Tier 2: 10% off (active June 1 - 30)
      {
        variantId: "v111"
        amount: "-10"
        isRelative: true
        startsAt: "2026-06-01T00:00:00Z"
        endsAt: "2026-06-30T23:59:59Z"
      }
      # Absolute wholesale price
      { variantId: "v222", amount: "49.99", isRelative: false }
    ]
  }) {
    prices { id }
  }
}
```

---

## B2B mutations: draft orders & payment terms

### Create a draft order for a company contact

```graphql
mutation {
  draftOrderCreate(input: {
    lineItems: [
      {
        variantId: "gid://shopify/ProductVariant/111"
        quantity: 100
        customAttributes: [
          {
            key: "special_instructions"
            value: "Ship to warehouse"
          }
        ]
      }
    ]
    companyContactId: "gid://shopify/CompanyContact/buyer1"
    billingAddress: {
      firstName: "John"
      lastName: "Doe"
      address1: "123 Main St"
      city: "Chicago"
      province: "IL"
      zip: "60601"
      country: "US"
    }
    shippingAddress: {
      firstName: "Warehouse"
      lastName: "Receiving"
      address1: "456 Dock St"
      city: "Chicago"
      province: "IL"
      zip: "60602"
      country: "US"
    }
    customAttributes: [
      {
        key: "po_number"
        value: "PO-2026-001"
      }
    ]
  }) {
    draftOrder {
      id
      lineItemsCount
      subtotalPrice {
        amount
        currencyCode
      }
    }
  }
}
```

### Complete draft order with payment terms

```graphql
mutation {
  draftOrderComplete(input: {
    id: "gid://shopify/DraftOrder/12345"
    paymentPending: false    # Set true for NET terms (invoice model)
    paymentTerms: {
      paymentTermsId: "gid://shopify/PaymentTerms/NET_30"
      dueAt: "2026-07-01T23:59:59Z"
    }
  }) {
    draftOrder {
      id
      completedAt
      order {
        id
        name
        paymentTerms {
          paymentTermsTemplate
          dueAt
        }
      }
    }
  }
}
```

### Order with vaulted card (recurring payment)

```graphql
mutation {
  orderCreate(input: {
    lineItems: [
      {
        variantId: "gid://shopify/ProductVariant/111"
        quantity: 50
      }
    ]
    customer: {
      id: "gid://shopify/Customer/cust123"
    }
    paymentTerms: {
      paymentTermsId: "gid://shopify/PaymentTerms/NET_30"
    }
    billingAddress: {
      firstName: "John"
      lastName: "Doe"
      address1: "123 Main"
      city: "Chicago"
      province: "IL"
      country: "US"
    }
    shippingAddress: {
      firstName: "Warehouse"
      lastName: "Receiving"
      address1: "456 Dock"
      city: "Chicago"
      province: "IL"
      country: "US"
    }
  }) {
    order {
      id
      name
      paymentTerms {
        dueAt
        paymentTermsTemplate
      }
    }
  }
}
```

---

## Customer Account B2B

Shopify provides **Customer Account B2B** login UI extension that lets company contacts:
1. Sign in with email + password
2. Switch between assigned company locations
3. View order history and payment status
4. Place orders with location-specific catalogs

### Implementation

Install the `customer-account-ui-extensions` API and define a location switcher:

```javascript
// extensions/location-switcher/src/index.tsx
import { useCustomer } from "@shopify/customer-account-ui-extensions-react";

export default function LocationSwitcher() {
  const { customer } = useCustomer();

  if (!customer?.companyContact) {
    return <p>Not a B2B contact</p>;
  }

  return (
    <div>
      <h2>Company: {customer.companyContact.company.name}</h2>
      <select onChange={(e) => switchLocation(e.target.value)}>
        {customer.companyContact.assignedLocations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

The Customer Account context automatically adjusts catalog visibility + pricing based on selected location.

---

## Shopify Markets overview

Shopify Markets enables multi-region, multi-currency, multi-language, and multi-domain storefronts from a single product catalog.

**Markets vs separate stores:**
- **One storefront, multiple markets:** Single catalog, region-specific domains/currencies/languages
- **Separate stores:** Isolated inventory, multiple checkouts, more operational overhead
- **Recommendation:** Use Markets if you want to share inventory and simplify management; use separate stores if you need full isolation per region

**Key capabilities:**
- Define regions (US, Canada, EU, Asia, etc.)
- Assign currencies, languages, and tax settings per region
- Publish to multiple domains or use subfolders (/en, /fr, etc.)
- Automatic currency conversion or fixed exchange rates
- Region-specific shipping and payment methods

---

## Markets data model

### Market

Represents a regional storefront (e.g., "Europe - EUR - DE/FR/IT").

```graphql
query {
  markets(first: 5) {
    edges {
      node {
        id
        name
        handle
        enabled
        primary
        regions {
          edges {
            node {
              id
              name
            }
          }
        }
        webPresences {
          edges {
            node {
              id
              domain
              subfolderRoot
            }
          }
        }
      }
    }
  }
}
```

Create a market:
```graphql
mutation {
  marketCreate(input: {
    name: "Europe"
    handle: "europe"
    regions: {
      DE: "Germany"
      FR: "France"
      IT: "Italy"
    }
  }) {
    market {
      id
      name
    }
  }
}
```

### MarketRegion

A country or region within a market (e.g., Germany, France).

```graphql
query {
  marketRegion(id: "gid://shopify/MarketRegion/DE") {
    id
    name
    country
    currency
    taxIncluded
    shippingZones {
      id
      name
    }
  }
}
```

### MarketWebPresence

Maps a market to a domain or subfolder (e.g., example.eu for Europe, example.com/fr for France).

```graphql
query {
  marketWebPresences(first: 10) {
    edges {
      node {
        id
        domain              # example.eu
        subfolderRoot       # /en, /fr (if subfolderRoot is set, ignores domain)
        market {
          id
          name
        }
        published
      }
    }
  }
}
```

Create web presence:
```graphql
mutation {
  marketWebPresenceCreate(input: {
    marketId: "gid://shopify/Market/EU"
    domain: "example.eu"
  }) {
    marketWebPresence {
      id
      domain
    }
  }
}
```

### MarketCurrencySettings

Configure auto-conversion or fixed exchange rates.

```graphql
query {
  marketCurrencySettingsByCountry(countryCode: "DE") {
    id
    currency              # EUR
    market { id }
    exchangeRateMode      # AUTO, FIXED
    exchangeRate          # Only set if FIXED
  }
}
```

Set fixed exchange rate:
```graphql
mutation {
  marketCurrencySettingsUpdate(input: {
    marketId: "gid://shopify/Market/EU"
    countryCode: "DE"
    exchangeRateMode: FIXED
    exchangeRate: 0.92    # 1 USD = 0.92 EUR
  }) {
    marketCurrencySetting {
      id
      exchangeRate
    }
  }
}
```

### MarketLocalization

Sets language preferences per market/region.

```graphql
query {
  marketLocalizations(first: 10) {
    edges {
      node {
        id
        market { id }
        locale              # de, fr, it
        language            # German, French, Italian
        default
      }
    }
  }
}
```

---

## @inContext directive: Storefront API currency + language override

When querying the Storefront API (client-side), use `@inContext` to fetch prices and content in a specific market/currency/language.

**Exact syntax:**
```graphql
query {
  products(first: 10) @inContext(country: DE, language: DE) {
    edges {
      node {
        id
        title
        variants(first: 5) {
          edges {
            node {
              id
              price {
                amount
                currencyCode     # EUR (because country=DE)
              }
            }
          }
        }
      }
    }
  }
}
```

**Valid country codes:** US, CA, DE, FR, IT, JP, AU, etc. (ISO 3166-1 alpha-2)

**Valid language codes:** EN, DE, FR, IT, JA, etc.

**What @inContext changes:**
- Product prices (converted to region currency)
- Shipping rates (region-specific)
- Tax calculations
- Content translations (if available)

**When NOT to use @inContext:**
- Admin API queries (use normal queries; Admin already knows store context)
- Server-side commerce context (use currency/country from request headers)

**When to use:**
- Storefront API (client-side, JavaScript/GraphQL)
- Multiple currencies on same domain (auto-detect from request headers)
- Multi-region storefronts (subfolder or domain-based)

Example: auto-detect country from geolocation and fetch prices:
```javascript
// client-side
const country = geoip.country(request.ip);  // "DE"
const language = country === "DE" ? "DE" : "EN";

const query = `
  query {
    products(first: 10) @inContext(country: ${country}, language: ${language}) {
      edges {
        node {
          variants {
            priceV2 {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;
```

---

## Currency handling in Shopify

### MoneyV2 format

All prices return as `MoneyV2` objects:
```graphql
{
  amount: "99.99"
  currencyCode: "EUR"
}
```

The `amount` is always a string (to preserve decimal precision). Always parse as `BigDecimal` or similar; avoid floating-point math.

### Liquid money filters

In theme Liquid templates:

```liquid
{{ product.variants[0].price | money }}
{# Output: $99.99 (uses store currency) #}

{{ product.variants[0].price | money_with_currency }}
{# Output: $99.99 USD #}

{{ product.variants[0].price | money_without_currency }}
{# Output: 99.99 #}

{{ product.variants[0].price | money_without_trailing_zeros }}
{# Output: 99.99 (or 100 if ends in .00) #}
```

### Shopify auto-conversion behavior

If a market is set to **AUTO** exchange rate mode:
- Shopify fetches real-time rates daily
- Prices are converted automatically for display
- Transactions settle in store currency; customer is charged in market currency
- Conversion loss/gain is absorbed by merchant

If **FIXED** exchange rate:
- You set the rate (e.g., 1 USD = 0.92 EUR)
- Shopify uses only that rate (no real-time updates)
- Useful for stability over accuracy

### Currency in apps

If you're building a Shopify app (not a theme):
1. **Fetch shop currency** from shop object:
   ```graphql
   query {
     shop {
       currency
       currencyCode          # USD, EUR, etc.
     }
   }
   ```

2. **For multi-currency stores**, query available currencies:
   ```graphql
   query {
     shop {
       currencies {
         isoCode
         name
        weight
       }
     }
   }
   ```

3. **Charge app fees** in shop currency only:
   ```graphql
   mutation {
     appSubscriptionCreate(input: {
       returnUrl: "https://example.com/..."
       name: "Silver Plan"
       price: {
         amount: "29.99"
         currencyCode: USD        # Always shop currency
       }
       trialDays: 7
     }) {
       appSubscription {
         id
       }
     }
   }
   ```

4. **In webhooks**, check `currencyCode` on prices and amounts. Multi-currency stores may send prices in different currencies depending on market context.

---

## i18n in Liquid

### Translation files

Store translations in `/locales/` (theme root):
```
locales/
  en.default.json
  de.json
  fr.json
```

**en.default.json:**
```json
{
  "header": {
    "menu": "Menu",
    "search": "Search"
  },
  "product": {
    "add_to_cart": "Add to cart",
    "price": "Price: {{ price }}"
  }
}
```

**de.json:**
```json
{
  "header": {
    "menu": "Menü",
    "search": "Suche"
  },
  "product": {
    "add_to_cart": "In den Warenkorb",
    "price": "Preis: {{ price }}"
  }
}
```

### Using translations

```liquid
{{ 'header.menu' | t }}
{# Output: "Menu" (if English) or "Menü" (if German) #}

{{ 'product.price' | t: price: product.variants[0].price | money }}
{# Output: "Price: $99.99" or "Preis: 99,99€" #}
```

### Detecting language

Shopify reads `request.locale` from URL or browser headers:

```liquid
{% if request.locale.iso_code == 'de' %}
  <p>Willkommen</p>
{% else %}
  <p>Welcome</p>
{% endif %}
```

### Fallback language

If no translation exists in the requested locale, Shopify falls back to the default language (en.default.json). Ensure all keys exist in the default file.

---

## Markets-aware checkout

### Server-side: detect market from request

```javascript
// Node.js / Next.js
export default async function handler(req, res) {
  const domain = req.headers.host;  // example.eu or example.com
  const country = req.headers['cloudflare-ipcountry'] || 'US';

  // Query market + currency for this domain
  const market = await getMarketByDomain(domain);
  const currency = market?.currency || 'USD';

  // Pass to Storefront API with @inContext
  const products = await storefrontQuery({
    country: market?.countryCode,
    language: market?.locale,
    currency
  });

  res.json({ products, currency });
}
```

### Client-side: @inContext + checkout

```javascript
// Fetch cart with market context
const cartQuery = `
  query Cart($cartId: ID!) @inContext(country: ${countryCode}, language: ${language}) {
    cart(id: $cartId) {
      cost {
        totalAmount {
          amount
          currencyCode
        }
      }
      lines {
        merchandise {
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;
```

### Payment methods per market

In checkout settings, assign payment methods per region:
- US: Stripe, PayPal, Shopify Payments
- EU: Stripe, SEPA Direct Debit, iDEAL, Sofort
- JP: Stripe, Konbini, Bank Transfer

Shopify handles filtering automatically based on request origin (Cloudflare geo-IP).

---

## Common gotchas

### Unfulfillable orders due to wrong catalog

**Problem:** Company contact places order for a product that isn't in their assigned catalog.

**Cause:** Catalog assignment is stale; location's price list doesn't include the variant.

**Fix:** Always validate against the location's active catalog before showing checkout:
```graphql
query {
  companyLocationCatalogAssignments(companyLocationId: "loc123") {
    catalogs {
      id
      priceLists {
        prices(variantId: "var456") {
          id
          amount
        }
      }
    }
  }
}
```

### Currency rounding

Shopify uses **bankers' rounding** for some internal calculations (round-to-even). If you're doing your own math:
- Store amounts as strings or BigDecimal, NOT floats
- 99.995 rounds to 100.00 (round-to-even)
- Always respect the 2-decimal-place format; don't truncate

### Missing payment_terms webhooks

**Problem:** You set `paymentTerms` on an order, but no webhook fires.

**Cause:** The `orders/create` webhook doesn't always include `payment_terms` in the payload.

**Fix:** Query the order directly to get payment terms:
```graphql
query {
  order(id: "gid://shopify/Order/123") {
    id
    paymentTerms {
      paymentTermsId
      paymentTermsTemplate
      dueAt
    }
  }
}
```

### Scope requirements for B2B

Your app must request these scopes:
```toml
# shopify.app.toml
scopes = [
  "write_products",
  "read_companies",      # Read B2B company data
  "write_companies",     # Create/update companies
  "read_orders",
  "write_draft_orders",
  "read_customer_payment_methods"
]
```

Without `read_companies` / `write_companies`, you cannot access B2B objects.

### Markets webfront detection

If a request comes from your Markets storefront, Shopify adds a header:
```
X-Shop-Market-Id: gid://shopify/Market/eu-market
```

Use this to detect which market the user is browsing and apply locale/currency accordingly.

---

## Decision tree

| Merchant says... | Do this |
|---|---|
| "I need to sell wholesale at different prices by location" | Set up Company > CompanyLocation > Catalog > PriceList hierarchy. Assign same catalog, different price lists per currency/location. |
| "I want NET 30 invoicing for my B2B customers" | Enable B2B Plus, assign PaymentTerms to Company, use draftOrderComplete with paymentTerms (paymentPending: true). |
| "I sell in 5 countries with different currencies" | Use Shopify Markets. Create one Market per region, assign currencies + domains/subfolders. Use @inContext in Storefront queries. |
| "My theme shows wrong prices for different visitors" | Add @inContext(country: AUTO_DETECT) to Storefront queries, or detect country server-side and pass to Storefront API. |
| "I need my B2B contacts to log in and switch locations" | Install Customer Account B2B extension. It automatically detects companyContact + assigned locations and provides UI for switching. |
| "Exchange rates are wrong; I want to lock them" | Set MarketCurrencySettings to FIXED mode and specify the exchange rate. Shopify won't auto-convert. |
| "I'm getting duplicate products in my Markets setup" | Markets share the same product catalog. If a product has variant overrides per market, use PriceList (not separate SKUs). |
| "Vaulted card payments aren't working for my B2B customer" | Ensure customer has a stored payment method (vault) + company has PaymentTerms assigned + draftOrder is completed with paymentTerms payload. |

---

## Worked recipes

### Recipe 1: Show wholesale-only products to logged-in B2B contacts

**Scenario:** You have a "Wholesale Only" collection that should only be visible to company contacts.

```graphql
# Liquid template
{% if customer and customer.email %}
  {% assign is_b2b = customer.metafields.custom.is_company_contact.value %}

  {% if is_b2b %}
    <!-- Show wholesale collection -->
    {% for product in collections.wholesale_only.products %}
      <div>
        <h3>{{ product.title }}</h3>
        <p>{{ product.variants[0].price | money }}</p>
      </div>
    {% endfor %}
  {% else %}
    <p>This collection is for wholesale partners only. Contact us for access.</p>
  {% endif %}
{% else %}
  <p>Please sign in to view wholesale pricing.</p>
{% endif %}
```

**In the app:** Set the metafield when a company contact is created:
```graphql
mutation {
  companyContactCreate(input: {
    email: "buyer@acme.com"
    companyId: "gid://shopify/Company/12345"
    metafields: [
      {
        namespace: "custom"
        key: "is_company_contact"
        value: "true"
        type: "boolean"
      }
    ]
  }) {
    companyContact {
      id
      metafields {
        value
      }
    }
  }
}
```

### Recipe 2: Multi-currency price display using @inContext

**Scenario:** Single domain, multiple currencies. Detect visitor country and show prices in their currency.

**Storefront API query (client-side):**
```javascript
const detectCountry = async (request) => {
  const cfCountry = request.headers.get('cf-ipcountry') || 'US';
  return cfCountry;
};

const fetchProducts = async (countryCode) => {
  const query = `
    query {
      products(first: 10) @inContext(country: ${countryCode}) {
        edges {
          node {
            id
            title
            variants(first: 3) {
              edges {
                node {
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
    }
  `;

  const response = await fetch('https://example.myshopify.com/api/2026-01/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': 'your-token'
    },
    body: JSON.stringify({ query })
  });

  return response.json();
};

// On page load
const country = await detectCountry(request);
const { data } = await fetchProducts(country);
// data.products[0].variants[0].price will be in the country's currency
```

**Liquid (fallback):**
```liquid
<div class="product">
  <h2>{{ product.title }}</h2>
  <p class="price">
    {{ product.variants[0].price | money }}
    <span class="currency">({{ shop.currency }})</span>
  </p>
</div>
```

### Recipe 3: Webhook listener for new company contacts; provision in your app

**Scenario:** When a company contact is created in Shopify, you want to sync them to your CRM or user system.

**Webhook registration (in your app setup):**
```graphql
mutation {
  webhookSubscriptionCreate(topic: COMPANY_CONTACT_CREATED, webhookSubscription: {
    callbackUrl: "https://yourapp.com/webhooks/company-contact-created"
    format: JSON
  }) {
    webhookSubscription {
      id
      topic
      endpoint {
        __typename
      }
    }
  }
}
```

**Webhook handler (Node.js):**
```javascript
import crypto from 'crypto';

export default async function handler(req, res) {
  const { body } = req;
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];

  // Verify webhook authenticity
  const message = body;
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(message, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (topic === 'company_contacts/create') {
    const companyContact = JSON.parse(body);

    // Provision in your CRM
    await provisionInCRM({
      email: companyContact.email,
      firstName: companyContact.first_name,
      lastName: companyContact.last_name,
      companyId: companyContact.company_id,
      shopifyId: companyContact.id
    });

    // Send welcome email
    await sendWelcomeEmail(companyContact.email, {
      company: companyContact.company,
      role: companyContact.role
    });
  }

  res.json({ ok: true });
}
```

**Related webhooks to subscribe:**
- `company_contacts/create`
- `company_contacts/update`
- `companies/create`
- `company_locations/create`
- `draft_orders/create` (for order tracking)
- `orders/create` (to capture payment terms settlement)

---

## Resources and references

- **B2B Plus overview:** https://shopify.dev/docs/apps/b2b-beyond (via Shopify Admin)
- **Company GraphQL:** https://shopify.dev/docs/api/admin-graphql/2026-01/objects/Company
- **PriceList API:** https://shopify.dev/docs/api/admin-graphql/2026-01/objects/PriceList
- **Draft Orders:** https://shopify.dev/docs/api/admin-graphql/2026-01/mutations/draftOrderCreate
- **Shopify Markets:** https://shopify.dev/docs/apps/markets (multi-region setup)
- **@inContext directive:** https://shopify.dev/docs/api/storefront/2026-01#directive-inContext
- **Customer Account B2B:** https://shopify.dev/docs/apps/customer-accounts/b2b
- **Liquid i18n:** https://shopify.dev/docs/themes/architecture/localization
- **Webhook topics:** https://shopify.dev/docs/api/admin-rest/2026-01#webhook_topics
- **Admin API scopes:** https://shopify.dev/docs/api/admin-rest/2026-01#api_access_scopes

---

## Summary for app developers

**B2B Plus + Markets = powerful international B2B:**
1. Use **Companies + Locations + Catalogs + PriceLists** for location-aware wholesale pricing
2. Use **PaymentTerms + vaulted cards** for NET invoicing and recurring payments
3. Use **Shopify Markets** for multi-region, multi-currency, multi-language support
4. Use **@inContext** in Storefront API queries to fetch prices in the customer's market currency
5. Use **Customer Account B2B** extensions for company contact login + location switching
6. Listen to B2B webhooks to keep your CRM, ERP, and fulfillment systems in sync
7. Always validate catalogs before fulfillment; currency mismatches and rounding errors are the main gotchas

This skill covers the full B2B + Markets stack as of May 2026. Refer to https://shopify.dev for the latest API versions and feature updates.