---
name: metafields-metaobjects
description: "Custom data fields and objects specification, namespace/key management, definition creation, querying, and Liquid theme access. Triggers include: 'metafield', 'metaobject', 'custom field', 'custom data', 'namespace key', 'metafield definition', 'metaobject type', 'product metafield', 'variant metafield', 'customer custom field', 'order metafield'."
---

# Shopify Metafields and Metaobjects Guide

## Metafields vs Metaobjects: When to Use Each

### Metafields

**Purpose:** Store custom key-value data on existing resources (products, orders, customers, etc.)

**Use Metafields When:**
- Adding custom attributes to existing resources
- Simple key-value relationships
- Data is tightly coupled to the resource
- Needed in themes (Liquid access)
- Examples: size chart URL, custom color, warranty period, gift message

**Characteristics:**
- Attached to existing resource types
- Simple string or typed values
- Queryable via GraphQL
- Accessible in Liquid templates
- Max 2,500 metafields per resource
- Namespace + key = unique identifier
- Supports display in admin UI via definitions

### Metaobjects

**Purpose:** Define custom data types/records independent of resources

**Use Metaobjects When:**
- Creating independent data structures
- Multi-field records needed
- Reusable data types across shop
- Complex relationships
- Data referenced by multiple resources
- Examples: FAQs, reviews, testimonials, size guides, lookbooks, staff profiles

**Characteristics:**
- Independent data type (like custom table)
- Multiple fields with defined types
- Queryable via GraphQL
- Can be referenced by products/collections via metafield
- Organized in admin UI
- Supports indexing and search
- Better for data that stands alone

**Comparison Table:**

| Feature | Metafield | Metaobject |
|---------|-----------|-----------|
| Attached to resources | Yes | No (standalone) |
| Multi-field support | No (single value) | Yes |
| Admin UI form | Via definition | Native editor |
| Liquid access | Direct | Via reference metafield |
| Relationship support | One-way (to resource) | One-way (reference metafield) |
| Reusability | Per resource type | Across shop |
| Use case | Quick attributes | Structured data |

## Metafield Resource Types

The following resources support metafields:

1. **Product** - 2,500 max metafields per product
2. **Product Variant** - 2,500 max metafields
3. **Order** - Custom order data
4. **Customer** - Customer profiles
5. **Collection** - Collection attributes
6. **Draft Order** - Pre-order metadata
7. **Shop** - Store-wide settings
8. **Location** - Warehouse/store details
9. **Company** - B2B company info
10. **Company Location** - B2B location data
11. **Market** - Market-specific metadata
12. **File** - Asset metadata

## Metafield Type System

### Supported Types

**Text Types:**
- `single_line_text_field` - Max 255 chars (search enabled, sortable)
- `multi_line_text_field` - Max 5,000 chars (search enabled)
- `rich_text_field` - HTML + Markdown (max 100,000 chars)

**Numeric Types:**
- `number_integer` - 64-bit signed integer
- `number_decimal` - Decimal number (up to 8 decimal places)

**Date/Time Types:**
- `date_field` - ISO 8601 date (YYYY-MM-DD)
- `date_time_field` - ISO 8601 datetime (2026-05-04T14:30:00Z)

**Boolean:**
- `boolean` - true/false

**Reference Types:**
- `product_reference` - Reference to Shopify product
- `collection_reference` - Reference to collection
- `file_reference` - Reference to file in Files API
- `metaobject_reference` - Reference to metaobject

**Display Types:**
- `color` - Color value (hex #RRGGBB)
- `weight` - Weight with unit (grams, kilograms, pounds, ounces)
- `volume` - Volume with unit
- `dimension` - Dimension with unit
- `url` - Full URL (max 2,048 chars)

**JSON Type:**
- `json` - Valid JSON object/array (max 100,000 chars, searchable)

**List Type:**
- `list.*` - Array of type (e.g., `list.metaobject_reference`)

### Type Examples

**Single Line Text:**
```graphql
{
  namespace: "app",
  key: "manufacturer_id",
  type: "single_line_text_field",
  value: "MFG-12345"
}
```

**JSON for Complex Structure:**
```graphql
{
  namespace: "app",
  key: "compatibility_matrix",
  type: "json",
  value: "{\"platforms\": [\"iOS\", \"Android\"], \"min_version\": \"12.0\"}"
}
```

**Weight:**
```graphql
{
  namespace: "app",
  key: "shipping_weight",
  type: "weight",
  value: "{\"value\": 2.5, \"unit\": \"kg\"}"
}
```

**Product Reference:**
```graphql
{
  namespace: "app",
  key: "replacement_product",
  type: "product_reference",
  value: "gid://shopify/Product/123456789"
}
```

**List of Metaobject References:**
```graphql
{
  namespace: "app",
  key: "related_guides",
  type: "list.metaobject_reference",
  value: "[\"gid://shopify/Metaobject/12345\", \"gid://shopify/Metaobject/67890\"]"
}
```

## Namespace and Key Conventions

### Namespace Rules
- Unique to your app/vendor
- Used to organize related metafields
- Immutable once set
- Best practice: use `app` or your app handle
- Example namespaces: `app`, `seo`, `loyalty`, `inventory_tracking`

### Key Rules
- Lowercase alphanumeric + underscores
- Max 64 characters
- Immutable once set
- Should be descriptive
- Examples: `custom_size`, `warranty_months`, `supplier_sku`

### Naming Convention Table

| Use Case | Namespace | Key | Full Name |
|----------|-----------|-----|-----------|
| App custom fields | `app` | `custom_color` | app.custom_color |
| SEO metadata | `seo` | `meta_description` | seo.meta_description |
| Loyalty program | `loyalty` | `points_balance` | loyalty.points_balance |
| B2B company | `b2b` | `account_manager` | b2b.account_manager |
| Inventory tracking | `inventory` | `reorder_point` | inventory.reorder_point |
| Theme customization | `theme` | `custom_layout` | theme.custom_layout |

### Best Practices
1. Group related metafields under same namespace
2. Use descriptive, business-friendly key names
3. Avoid generic names (`data`, `meta`, `custom`)
4. Document namespace/key mapping in app
5. Consider storefront visibility needs (use `visible_to_storefront` flag)

## Metafield Definition Creation

Definitions enable admin UI forms and validation.

### Creating Definition via GraphQL

```graphql
mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    metafieldDefinition {
      id
      name
      namespace
      key
      type
      validations {
        name
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

**Input Variables:**
```json
{
  "definition": {
    "name": "Product Color",
    "namespace": "app",
    "key": "product_color",
    "description": "Custom color classification for storefront filters",
    "type": "single_line_text_field",
    "ownerType": "PRODUCT",
    "visibleToStorefront": true,
    "validations": [
      {
        "name": "max_length",
        "value": "50"
      }
    ]
  }
}
```

### Definition with Rich Validation

```graphql
mutation {
  metafieldDefinitionCreate(definition: {
    name: "Reorder Point"
    namespace: "inventory"
    key: "reorder_point"
    type: "number_integer"
    ownerType: "PRODUCT_VARIANT"
    description: "Minimum inventory level before reorder needed"
    validations: [
      { name: "min", value: "1" }
      { name: "max", value: "10000" }
    ]
  }) {
    metafieldDefinition { id }
    userErrors { field message }
  }
}
```

### Definition for Metaobject Reference

```graphql
mutation {
  metafieldDefinitionCreate(definition: {
    name: "Related Reviews"
    namespace: "app"
    key: "related_reviews"
    type: "list.metaobject_reference"
    ownerType: "PRODUCT"
    description: "Customer reviews for this product"
    validations: [
      {
        name: "metaobject_definition_id"
        value: "gid://shopify/MetaobjectDefinition/1234567"
      }
    ]
  }) {
    metafieldDefinition { id }
    userErrors { field message }
  }
}
```

## Metaobject Type Definition

Create custom data structures for shop.

### Creating Metaobject Definition

```graphql
mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionInput!) {
  metaobjectDefinitionCreate(definition: $definition) {
    metaobjectDefinition {
      id
      type
      displayNameKey
      fields {
        key
        type
        required
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

**Input Variables:**
```json
{
  "definition": {
    "type": "faq_item",
    "displayNameKey": "question",
    "description": "Frequently asked questions",
    "fields": [
      {
        "key": "question",
        "type": "single_line_text_field",
        "required": true,
        "description": "FAQ question text"
      },
      {
        "key": "answer",
        "type": "rich_text_field",
        "required": true,
        "description": "FAQ answer (HTML + Markdown)"
      },
      {
        "key": "category",
        "type": "single_line_text_field",
        "required": false,
        "description": "Topic category"
      },
      {
        "key": "display_order",
        "type": "number_integer",
        "required": false,
        "description": "Sort order in list"
      }
    ]
  }
}
```

### Creating Metaobject Instances

Once definition created, create records:

```graphql
mutation CreateMetaobject($input: MetaobjectCreateInput!) {
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

**Variables:**
```json
{
  "input": {
    "type": "faq_item",
    "fields": [
      {
        "key": "question",
        "value": "How do I return an item?"
      },
      {
        "key": "answer",
        "value": "<p>Returns accepted within 30 days. Visit our <a href=\"/policies/returns\">returns page</a>.</p>"
      },
      {
        "key": "category",
        "value": "Returns & Exchanges"
      },
      {
        "key": "display_order",
        "value": "1"
      }
    ]
  }
}
```

## Querying Metafields

### Product Metafields

```graphql
query GetProductWithMetafields($id: ID!) {
  product(id: $id) {
    id
    title
    metafields(first: 10) {
      edges {
        node {
          id
          namespace
          key
          type
          value
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "id": "gid://shopify/Product/123456789"
}
```

### Filtered Metafields

```graphql
query GetSpecificMetafield($id: ID!) {
  product(id: $id) {
    id
    customColor: metafield(namespace: "app", key: "custom_color") {
      value
      type
    }
    sizeChart: metafield(namespace: "app", key: "size_chart_url") {
      value
    }
  }
}
```

### Metaobject Query

```graphql
query GetMetaobject($id: ID!) {
  metaobject(id: $id) {
    id
    type
    displayName
    fields {
      key
      value
      type
    }
  }
}
```

### List Metaobjects

```graphql
query ListFAQs {
  metaobjects(type: "faq_item", first: 10) {
    edges {
      node {
        id
        displayName
        question: field(key: "question") { value }
        answer: field(key: "answer") { value }
        category: field(key: "category") { value }
      }
    }
  }
}
```

### Metaobject References in Products

```graphql
query GetProductWithReferences($id: ID!) {
  product(id: $id) {
    id
    title
    relatedGuides: metafield(
      namespace: "app",
      key: "related_guides"
    ) {
      value
      type
      reference {
        ... on Metaobject {
          id
          displayName
          type
        }
      }
    }
  }
}
```

## Storefront API Access

### Public Metafield Access

Metafields with `visible_to_storefront: true` accessible via Storefront API:

```graphql
query GetProductStorefront($handle: String!) {
  productByHandle(handle: $handle) {
    id
    title
    metafields(first: 10) {
      edges {
        node {
          namespace
          key
          value
          type
        }
      }
    }
  }
}
```

### Storefront Query Example

```typescript
// Client-side storefront API query
const query = `
  query GetProductMetafields($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      productColor: metafield(namespace: "app", key: "product_color") {
        value
      }
      manufacturerId: metafield(namespace: "app", key: "manufacturer_id") {
        value
      }
    }
  }
`;

const response = await fetch('https://myshop.myshopify.com/api/2026-01/graphql.json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': PUBLIC_ACCESS_TOKEN
  },
  body: JSON.stringify({
    query,
    variables: { handle: 'blue-t-shirt' }
  })
});

const { data } = await response.json();
console.log(data.productByHandle.productColor.value);
```

## Liquid Theme Access

### Product Metafield in Liquid

```liquid
{%- assign custom_color = product.metafields.app.custom_color.value -%}
<p>Color: {{ custom_color }}</p>

{%- assign warranty = product.metafields.app.warranty_months.value -%}
<p>Warranty: {{ warranty }} months</p>

{%- assign size_chart = product.metafields.app.size_chart_url.value -%}
<a href="{{ size_chart }}">View Size Chart</a>
```

### Metaobject Reference in Liquid

```liquid
{%- assign faq_list = product.metafields.app.related_faqs.value -%}
<div class="faqs">
  {%- for faq in faq_list -%}
    <div class="faq-item">
      <h3>{{ faq.question.value }}</h3>
      <p>{{ faq.answer.value }}</p>
    </div>
  {%- endfor -%}
</div>
```

### Conditional Display

```liquid
{%- if product.metafields.app.is_discontinued.value -%}
  <div class="alert">This product is discontinued</div>
{%- endif -%}
```

### JSON Metafield in Liquid

```liquid
{%- assign compatibility = product.metafields.app.compatibility_matrix.value -%}
<ul>
  {%- for platform in compatibility.platforms -%}
    <li>{{ platform }}</li>
  {%- endfor -%}
</ul>
```

## Visible vs Hidden Metafields

### visible_to_storefront: true

**Accessible:**
- Storefront API (public queries)
- Liquid templates
- Customer-facing applications
- Search engines (SEO indexing)

**Use for:**
- Product colors, sizes
- SEO metadata
- Customer-facing attributes
- Storefront display data

### visible_to_storefront: false

**Accessible:**
- Admin GraphQL API only
- Admin dashboard
- Backend systems

**Use for:**
- Internal tracking IDs
- Supplier information
- Cost/margin data
- Backend workflow flags

## Setting Metafields via GraphQL

### metafieldsSet Mutation

```graphql
mutation SetMetafields($input: MetafieldsSetInput!) {
  metafieldsSet(input: $input) {
    metafields {
      id
      namespace
      key
      value
      type
    }
    userErrors {
      field
      message
    }
  }
}
```

**Input Variables:**
```json
{
  "input": {
    "ownerId": "gid://shopify/Product/123456789",
    "metafields": [
      {
        "namespace": "app",
        "key": "custom_color",
        "type": "single_line_text_field",
        "value": "navy-blue"
      },
      {
        "namespace": "app",
        "key": "warranty_months",
        "type": "number_integer",
        "value": "24"
      },
      {
        "namespace": "seo",
        "key": "meta_description",
        "type": "single_line_text_field",
        "value": "Premium navy blue t-shirt with guaranteed quality"
      }
    ]
  }
}
```

### Bulk Setting via GraphQL

```graphql
mutation BulkSetMetafields($input: [MetafieldsSetInput!]!) {
  metafieldsSet(input: $input) {
    metafields { id }
    userErrors { field message }
  }
}
```

## Common Gotchas

| Issue | Cause | Solution |
|-------|-------|----------|
| Metafield not visible in Liquid | `visible_to_storefront: false` | Set to true in definition |
| JSON parse error | Invalid JSON string | Validate JSON before setting |
| Reference broken | Referenced object deleted | Add referential integrity checks |
| Type mismatch on update | Changing type after creation | Create new key, deprecate old |
| Admin UI doesn't show | Definition not created | Create definition via mutation |
| Max length exceeded | Value too long | Check validation rules |
| List reference empty | Metaobject definition ID invalid | Verify definition exists |
| Storefront query fails | Missing scopes | Ensure read_products scope |
| Slow metafield queries | Querying too many fields | Limit first parameter, use pagination |
| Cost explosion | Querying all metafields | Limit first parameter, use pagination |

## Performance Considerations

### Querying Efficiently

**Bad - Expensive Cost:**
```graphql
query {
  products(first: 100) {
    edges {
      node {
        metafields(first: 250) {  # 250 metafields per product!
          edges { node { value } }
        }
      }
    }
  }
}
```

**Good - Optimized:**
```graphql
query {
  products(first: 100) {
    edges {
      node {
        id
        customColor: metafield(namespace: "app", key: "custom_color") {
          value
        }
        warranty: metafield(namespace: "app", key: "warranty_months") {
          value
        }
      }
    }
  }
}
```

### Rate Limit Impact

Metafield operations incur API cost:
- Querying metafield: 1 point
- Setting metafield: 10 points per metafield
- Bulk operations: batch multiple sets

## Best Practices

1. **Define metafields upfront** - Creates admin UI automatically
2. **Use consistent namespacing** - Group related fields logically
3. **Plan for storefront visibility** - Design with customer access in mind
4. **Validate data types** - Use appropriate types to prevent errors
5. **Document your metafields** - Maintain namespace/key reference
6. **Consider performance** - Query only needed metafields
7. **Use metaobjects for reusable data** - More organized than scattered metafields
8. **Prefer references over IDs** - Use product_reference type, not storing IDs
9. **Implement fallbacks** - Handle missing metafields in themes
10. **Version your definitions** - Plan for future schema changes
