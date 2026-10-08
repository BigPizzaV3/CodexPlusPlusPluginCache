---
name: liquid-themes
description: "Use this skill for Liquid Theme Development (Online Store 2.0). Triggers include: 'liquid theme development', 'shopify theme online store 2.0', 'liquid section schema', 'liquid blocks', 'liquid filters', 'liquid objects', 'json template shopify', 'theme preset', 'liquid include snippet', 'theme-check linting', 'liquid forloop iteration', 'liquid if conditions', 'liquid assign variable', 'shopify theme app extension', 'liquid capture variable', 'theme metafields', 'liquid date filter', 'liquid money filter', 'liquid array filters', 'liquid string manipulation', 'liquid product page', 'liquid collection page', 'liquid cart page', 'liquid header footer', 'liquid for loop break continue', 'liquid unless statement', 'liquid case when'."
---

# Liquid Theme Development (Online Store 2.0)

Liquid is Shopify's templating language for building themes and sections on Online Store 2.0. This skill covers Liquid syntax, section schema definition, JSON templates, blocks, filters (20+ common), objects, theme file structure, presets, and real-world section and template patterns.

## When Asked

**When asked to build a Liquid section with settings:**
Provide a complete section file with schema (settings array, presets, locales), CSS, and JavaScript; explain how settings map to template variables.

**Before returning any section, app block, or theme schema:**
Run the Shopify schema dedupe check mentally or with `scripts/validate-shopify-schema-ids.mjs <theme-or-file>`. Every `settings[].id` must be unique within its own schema scope, every block's `settings[].id` must be unique inside that block type, and every `blocks[].type` should be unique unless you are intentionally defining different block entries. Do not paste settings from multiple examples until you merge and dedupe IDs.

**When asked to implement product filters or sorting:**
Use the collection product pagination, filters by attribute, sorting with Liquid forloop and if/case statements; explain faceting.

**When asked to add custom fields to products:**
Use metafields in Liquid (product.metafields.namespace.key), explain metafield definitions, and show rendering in sections.

**When asked to create reusable components:**
Use include/render snippets with passed parameters; explain snippet vs. render differences and variable scope.

**When asked about Liquid filters and string manipulation:**
Provide examples of 20+ filters (split, join, size, capitalize, downcase, strip_html, truncate, money, date, etc.) with use cases.

**When asked to optimize theme performance:**
Discuss lazy loading, critical CSS, reducing render-blocking resources, and using theme-check for linting.

---

## Liquid & Online Store 2.0 Architecture

Liquid provides:
- **Section-Based Editing**: Drag-and-drop sections with live customization
- **Schema System**: Settings (text, select, checkbox, range, color), preset configurations
- **Blocks**: Repeatable content blocks within sections (e.g., carousel slides, testimonials)
- **JSON Templates**: Structured page templates with sections array
- **Filters**: 50+ filters for formatting (string, date, money, array, math)
- **Objects**: Global objects (shop, page, product, collection, cart, customer)
- **Include & Render**: Reusable snippets with parameter passing
- **Forloop & Control**: for, if, unless, case/when, break, continue statements
- **Metafields**: Custom product/collection/order data fields

### Schema Dedupe Guardrail

Shopify section schemas use arrays, so JSON itself will not protect you from duplicated visible inputs. A duplicated setting object with the same `id` can make Theme Editor show repeated controls or make generated Liquid read the wrong setting.

Hard rules before emitting schema:

- Keep section-level `settings[].id` unique.
- Keep `blocks[].type` unique within a section or app block.
- Keep each block's `settings[].id` unique inside that block.
- In `config/settings_schema.json`, keep setting IDs unique across theme setting groups unless Shopify's own template intentionally scopes them.
- If you copy a "padding", "heading", "text", "image", "color", or "button_label" setting from another example, rename it by purpose: `hero_padding`, `card_padding`, `button_label_primary`, not another generic `padding`.
- Preset `settings` keys must match real setting IDs. Delete stale preset keys after renaming.
- After generation, run:

```bash
node <plugin-root>/scripts/validate-shopify-schema-ids.mjs path/to/theme-or-section.liquid
```

Treat any duplicate as a blocker before handoff.

### Theme Directory Structure

```
theme/
├── assets/                  # CSS, JS, images, fonts
│   ├── base.css
│   ├── custom.js
│   └── logo.png
├── config/
│   ├── settings_schema.json # Theme-wide settings
│   └── settings_data.json   # Store settings values
├── layout/
│   ├── theme.liquid         # Root layout
│   └── password.liquid      # Password-protected layout
├── sections/                # Customizable sections
│   ├── product.liquid
│   ├── collection.liquid
│   ├── hero.liquid
│   └── newsletter.liquid
├── snippets/                # Reusable components
│   ├── product-card.liquid
│   ├── breadcrumbs.liquid
│   └── pagination.liquid
├── templates/               # Page templates (JSON)
│   ├── product.json
│   ├── collection.json
│   ├── index.json
│   ├── page.json
│   ├── cart.json
│   └── 404.json
└── locales/
    ├── en.json              # English translations
    └── fr.json              # French translations
```

---

## Liquid Syntax Fundamentals

### Variables & Output

```liquid
{{ product.title }}
{{ product.price | money }}
{{ 'Hello World' | upcase }}
{{ section.settings.text_field }}
```

### Assign & Capture

```liquid
{% assign name = 'John' %}
Hello {{ name }}!

{% assign price_times_two = product.price | times: 2 %}

{% capture my_variable %}
  I am being captured.
{% endcapture %}
{{ my_variable }}
```

### Forloop

```liquid
{% for product in collection.products %}
  <div class="product-card">
    <h3>{{ product.title }}</h3>
    <p>${{ product.price | money }}</p>
  </div>
{% endfor %}

{% for i in (1..5) %}
  Item {{ i }}
{% endfor %}

{% for item in array %}
  {% if forloop.first %}
    <p>First item: {{ item }}</p>
  {% elsif forloop.last %}
    <p>Last item: {{ item }}</p>
  {% else %}
    <p>Item {{ forloop.index }} of {{ forloop.length }}: {{ item }}</p>
  {% endif %}
{% endfor %}

{% for item in array limit: 5 %}
  {{ item }}
{% endfor %}

{% for item in array offset: 10 %}
  Item number {{ forloop.index }}
{% endfor %}
```

**Forloop Properties:**
- `forloop.index` — 1-based position
- `forloop.index0` — 0-based position
- `forloop.first`, `forloop.last` — boolean
- `forloop.length` — total items
- `forloop.rindex` — reverse index

### Conditionals

```liquid
{% if customer %}
  Hello, {{ customer.first_name }}!
{% elsif customer.email %}
  Hello, {{ customer.email }}!
{% else %}
  Hello, guest!
{% endif %}

{% unless product.available %}
  <p>Out of stock</p>
{% endunless %}

{% case handle %}
  {% when 'electronics' %}
    <p>Electronics category</p>
  {% when 'clothing' %}
    <p>Clothing category</p>
  {% else %}
    <p>Other category</p>
{% endcase %}

{% if product.available and product.price > 100 %}
  Premium item in stock
{% endif %}

{% if product.available or customer %}
  Available or customer logged in
{% endif %}
```

---

## Filters (20+ Common)

### String Filters

```liquid
{{ 'hello world' | upcase }}                    # HELLO WORLD
{{ 'HELLO' | downcase }}                        # hello
{{ 'hello' | capitalize }}                      # Hello
{{ 'hello world' | replace: 'world', 'liquid' }} # hello liquid
{{ 'hello world' | split: ' ' | join: '-' }}   # hello-world
{{ 'hello world' | slice: 0, 5 }}               # hello
{{ product.title | truncate: 20, '...' }}      # Truncates to 20 chars with ellipsis
{{ '<p>hello</p>' | strip_html }}               # hello
```

### Math Filters

```liquid
{{ 16 | plus: 4 }}          # 20
{{ 16 | minus: 4 }}         # 12
{{ 4 | times: 5 }}          # 20
{{ 16 | divided_by: 4 }}    # 4
{{ 5.4 | ceil }}            # 6
{{ 5.4 | floor }}           # 5
{{ 5.4 | round }}           # 5
{{ 4 | modulo: 2 }}         # 0
```

### Money Filter

```liquid
{{ product.price | money }}          # $29.99 (formatted per shop currency)
{{ product.price | money_with_currency }}  # $29.99 USD
{{ 10 | times: product.price | money }}   # $299.90
```

### Array Filters

```liquid
{{ array | size }}                     # Length of array
{{ array | first }}                    # First element
{{ array | last }}                     # Last element
{{ array | join: ', ' }}               # 'item1, item2, item3'
{{ array | reverse | join: ', ' }}    # Reverse order
{{ array | sort | join: ', ' }}       # Sort array
{{ array | uniq | join: ', ' }}       # Remove duplicates
{{ array | map: 'title' | join: ', '}} # Extract 'title' from each item
{% assign sorted = collection.products | sort: 'price' %}
```

### Date Filters

```liquid
{{ 'now' | date: '%Y-%m-%d' }}       # 2024-05-04
{{ product.created_at | date: '%B %d, %Y' }} # May 04, 2024
{{ order.created_at | date: '%I:%M %p' }}    # 03:45 PM
```

---

## Liquid Objects

### Shop Object

```liquid
{{ shop.name }}               # Store name
{{ shop.currency }}           # USD
{{ shop.url }}                # mystore.myshopify.com
{{ shop.email }}              # contact@mystore.com
{{ shop.phone }}              # +1-800-123-4567
{{ shop.customer_accounts_enabled }} # true/false
```

### Product Object

```liquid
{{ product.id }}              # Shopify product ID
{{ product.title }}           # Product name
{{ product.description }}     # Product description
{{ product.price }}           # Price (in cents)
{{ product.price | money }}   # Formatted: $29.99
{{ product.compare_at_price | money }}  # Original price
{{ product.available }}       # true/false
{{ product.variants.size }}   # Number of variants
{{ product.featured_image.src }} # Image URL
{{ product.handle }}          # URL slug
{{ product.type }}            # Product type
{{ product.vendor }}          # Brand/vendor
{{ product.tags | join: ', '}} # CSV tags

{% for variant in product.variants %}
  <p>{{ variant.title }} - {{ variant.price | money }}</p>
{% endfor %}
```

### Collection Object

```liquid
{{ collection.id }}
{{ collection.title }}
{{ collection.url }}
{{ collection.description }}
{{ collection.image.src }}
{{ collection.products_count }}
{{ collection.handle }}

{% for product in collection.products %}
  {% include 'product-card', product: product %}
{% endfor %}

{% if collection.previous_product %}
  <a href="{{ collection.previous_product.url }}">← {{ collection.previous_product.title }}</a>
{% endif %}

{% if collection.next_product %}
  <a href="{{ collection.next_product.url }}">{{ collection.next_product.title }} →</a>
{% endif %}
```

### Cart Object

```liquid
{{ cart.item_count }}         # Total items in cart
{{ cart.total_price | money }} # Cart subtotal
{{ cart.total_price | money_with_currency }}

{% for item in cart.items %}
  <p>{{ item.title }} x {{ item.quantity }} = {{ item.final_line_price | money }}</p>
{% endfor %}

{{ cart.note }}               # Cart note/comments
```

### Customer Object

```liquid
{% if customer %}
  Hello, {{ customer.first_name }}!
  Email: {{ customer.email }}
  Phone: {{ customer.phone }}
  {{ customer.orders_count }} orders
  Loyal since: {{ customer.created_at | date: '%B %Y' }}
{% endif %}
```

---

## Section Schema & Settings

### Basic Section with Settings

```liquid
{%- stylesheet %}
  .section-hero {
    background: {{ section.settings.bg_color }};
    padding: {{ section.settings.padding }}px;
  }
  .hero-title {
    color: {{ section.settings.title_color }};
    font-size: {{ section.settings.title_size }}px;
  }
{%- endstylesheet %}

<section class="section-hero">
  <h1 class="hero-title">{{ section.settings.heading }}</h1>
  <p>{{ section.settings.description }}</p>
  {% if section.settings.show_button %}
    <a href="{{ section.settings.button_link }}" class="button">
      {{ section.settings.button_text }}
    </a>
  {% endif %}
</section>

{% schema %}
{
  "name": "Hero Banner",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Welcome to our store"
    },
    {
      "type": "textarea",
      "id": "description",
      "label": "Description",
      "default": "Share your store's story"
    },
    {
      "type": "color",
      "id": "bg_color",
      "label": "Background Color",
      "default": "#ffffff"
    },
    {
      "type": "color",
      "id": "title_color",
      "label": "Title Color",
      "default": "#000000"
    },
    {
      "type": "range",
      "id": "padding",
      "min": 0,
      "max": 100,
      "step": 5,
      "label": "Padding (px)",
      "default": 40
    },
    {
      "type": "range",
      "id": "title_size",
      "min": 24,
      "max": 72,
      "label": "Title Size (px)",
      "default": 48
    },
    {
      "type": "checkbox",
      "id": "show_button",
      "label": "Show Button",
      "default": true
    },
    {
      "type": "text",
      "id": "button_text",
      "label": "Button Text",
      "default": "Shop Now"
    },
    {
      "type": "url",
      "id": "button_link",
      "label": "Button Link"
    },
    {
      "type": "select",
      "id": "alignment",
      "label": "Alignment",
      "options": [
        { "value": "left", "label": "Left" },
        { "value": "center", "label": "Center" },
        { "value": "right", "label": "Right" }
      ],
      "default": "center"
    }
  ]
}
{% endschema %}
```

### Section with Blocks

```liquid
<section class="testimonials">
  <h2>What Our Customers Say</h2>
  <div class="testimonials-grid">
    {%- for block in section.blocks -%}
      <div class="testimonial" {{ block.shopify_attributes }}>
        <p class="quote">{{ block.settings.quote }}</p>
        <p class="author">— {{ block.settings.author }}</p>
        <div class="rating">
          {%- for i in (1..block.settings.stars) -%}
            ⭐
          {%- endfor -%}
        </div>
      </div>
    {%- endfor -%}
  </div>
</section>

{% schema %}
{
  "name": "Testimonials",
  "blocks": [
    {
      "type": "testimonial",
      "name": "Testimonial",
      "settings": [
        {
          "type": "textarea",
          "id": "quote",
          "label": "Quote",
          "default": "Great product!"
        },
        {
          "type": "text",
          "id": "author",
          "label": "Author",
          "default": "John Smith"
        },
        {
          "type": "range",
          "id": "stars",
          "min": 1,
          "max": 5,
          "label": "Rating",
          "default": 5
        }
      ]
    }
  ]
}
{% endschema %}
```

### Presets (Default Configuration)

```liquid
{% schema %}
{
  "name": "Featured Product",
  "settings": [...],
  "presets": [
    {
      "name": "Featured Product",
      "settings": {
        "product": "gid://shopify/Product/123456",
        "show_rating": true,
        "show_reviews": true
      }
    },
    {
      "name": "Featured Product - Minimal",
      "settings": {
        "show_rating": false,
        "show_reviews": false
      }
    }
  ]
}
{% endschema %}
```

---

## Snippets & Reusable Components

### Include vs. Render

```liquid
{%- include 'product-card', product: product -%}
```

vs.

```liquid
{%- render 'product-card', product: product -%}
```

**Include:** Shares scope with parent template (slower, backwards-compat)
**Render:** Isolated scope, faster, recommended for components

### Product Card Snippet

```liquid
{%- comment -%}
  Reusable product card component
  Usage: {% render 'product-card', product: product, show_price: true %}
{%- endcomment -%}

<div class="product-card">
  <a href="{{ product.url }}" class="product-image">
    {% if product.featured_image %}
      <img
        src="{{ product.featured_image.src | img_url: '300x300' }}"
        alt="{{ product.featured_image.alt }}"
        loading="lazy"
      />
    {% endif %}
  </a>

  <h3 class="product-title">
    <a href="{{ product.url }}">{{ product.title }}</a>
  </h3>

  <p class="product-vendor">{{ product.vendor }}</p>

  {% if show_price %}
    <div class="product-price">
      {% if product.compare_at_price > product.price %}
        <span class="original-price">{{ product.compare_at_price | money }}</span>
        <span class="sale-price">{{ product.price | money }}</span>
      {% else %}
        <span class="price">{{ product.price | money }}</span>
      {% endif %}
    </div>
  {% endif %}

  {% if product.available %}
    <button class="btn-add-to-cart" data-product-id="{{ product.id }}">
      Add to cart
    </button>
  {% else %}
    <p class="out-of-stock">Out of Stock</p>
  {% endif %}
</div>

<style>
  .product-card {
    border: 1px solid #ddd;
    padding: 16px;
    border-radius: 8px;
  }
  .product-title a {
    text-decoration: none;
    color: #000;
  }
</style>

<script>
  document.querySelectorAll('.btn-add-to-cart').forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.dataset.productId;
      fetch('/cart/add.js', {
        method: 'POST',
        body: JSON.stringify({ id: productId, quantity: 1 })
      });
    });
  });
</script>
```

---

## JSON Templates

### Product Page Template

```json
{
  "sections": {
    "main": {
      "type": "product",
      "settings": {
        "enable_sticky_add_to_cart": true,
        "gallery_layout": "thumbnail",
        "media_size": "medium",
        "image_zoom": true,
        "show_vendor": true,
        "show_sku": true,
        "enable_video_looping": false
      }
    },
    "product-recommendations": {
      "type": "product-recommendations",
      "settings": {
        "heading": "You might also like",
        "products_per_row": 4
      }
    }
  },
  "order": ["main", "product-recommendations"]
}
```

### Collection Page Template

```json
{
  "sections": {
    "collection-header": {
      "type": "collection-header",
      "settings": {
        "show_image": true,
        "show_description": true
      }
    },
    "collection-filters": {
      "type": "collection-filters",
      "settings": {
        "enable_filters": true,
        "enable_sorting": true
      }
    },
    "collection-products": {
      "type": "collection-products",
      "settings": {
        "products_per_page": 12,
        "columns_desktop": 4,
        "columns_mobile": 2
      }
    }
  },
  "order": ["collection-header", "collection-filters", "collection-products"]
}
```

---

## Metafields in Liquid

### Displaying Metafields

```liquid
{%- if product.metafields.custom.care_instructions -%}
  <div class="care-instructions">
    <h3>Care Instructions</h3>
    <p>{{ product.metafields.custom.care_instructions.value }}</p>
  </div>
{%- endif -%}

{%- if product.metafields.custom.size_chart -%}
  <img src="{{ product.metafields.custom.size_chart.value }}" alt="Size Chart" />
{%- endif -%}

{%- for item in product.metafields.custom.ingredients.value -%}
  <li>{{ item }}</li>
{%- endfor -%}
```

### Defining Metafields (in Admin or via API)

```
Namespace: custom
Key: care_instructions
Type: single_line_text_field

Namespace: custom
Key: ingredients
Type: list.single_line_text_field
```

---

## Worked Example: Product Section

```liquid
<section class="section-product" id="product-{{ section.id }}">
  <div class="product-container">
    <div class="product-gallery">
      {%- for image in product.images -%}
        <img
          src="{{ image.src | img_url: '500x500' }}"
          alt="{{ image.alt }}"
          loading="{{ 'lazy' if forloop.index > 1 else 'eager' }}"
          class="product-image"
        />
      {%- endfor -%}
    </div>

    <div class="product-info">
      <h1 class="product-title">{{ product.title }}</h1>

      {% if section.settings.show_vendor %}
        <p class="product-vendor">{{ product.vendor }}</p>
      {% endif %}

      <div class="product-price">
        {% if product.compare_at_price > product.price %}
          <span class="original-price">{{ product.compare_at_price | money }}</span>
          <span class="sale-badge">Sale</span>
        {% endif %}
        <span class="price">{{ product.price | money }}</span>
      </div>

      <p class="product-description">{{ product.description }}</p>

      <form action="/cart/add" method="post">
        {%- for option in product.options -%}
          <fieldset>
            <legend>{{ option.name }}</legend>
            <select name="options[{{ option.name }}]" required>
              {%- for value in option.values -%}
                <option value="{{ value }}">{{ value }}</option>
              {%- endfor -%}
            </select>
          </fieldset>
        {%- endfor -%}

        <input type="hidden" name="id" value="{{ product.variants.first.id }}" />

        <input
          type="number"
          name="quantity"
          value="1"
          min="1"
          max="{{ product.selected_or_first_available_variant.inventory_quantity }}"
          class="quantity-input"
        />

        <button type="submit" class="btn-add-to-cart">
          {% if product.available %}
            Add to cart
          {% else %}
            Out of stock
          {% endif %}
        </button>
      </form>

      {% if section.settings.show_reviews %}
        <div class="product-reviews">
          <p>⭐⭐⭐⭐⭐ ({{ product.reviews_count }} reviews)</p>
        </div>
      {% endif %}
    </div>
  </div>
</section>

{%- stylesheet %}
  .section-product {
    padding: {{ section.settings.padding }}px;
  }
  .product-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
  .product-price {
    font-size: 20px;
    font-weight: bold;
  }
  .sale-badge {
    background: red;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    margin-left: 8px;
  }
  @media (max-width: 768px) {
    .product-container {
      grid-template-columns: 1fr;
    }
  }
{%- endstylesheet %}

{% schema %}
{
  "name": "Product",
  "settings": [
    {
      "type": "checkbox",
      "id": "show_vendor",
      "label": "Show vendor",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_reviews",
      "label": "Show reviews",
      "default": true
    },
    {
      "type": "range",
      "id": "padding",
      "min": 0,
      "max": 100,
      "step": 5,
      "label": "Padding (px)",
      "default": 40
    }
  ]
}
{% endschema %}
```

---

## Theme Linting with theme-check

```bash
npm install -g @shopify/theme-check
theme-check --help
theme-check .  # Lint entire theme
```

Common rules:
- Unused snippets
- Missing alt text on images
- Deprecated Liquid tags
- Missing schema translations
- Performance issues (large assets, render-blocking)

---

## Performance & Optimization Tips

- Use `{{ image.src | img_url: '300x300' }}` for responsive images
- Set `loading="lazy"` on below-fold images
- Minimize CSS in sections (use scoped `{% stylesheet %}`)
- Defer non-critical JS with `defer` attribute
- Use `capture` and `assign` to avoid multiple API calls
- Lazy load sections with `{% section 'footer' %}`
- Cache computed values: `{% assign sorted = array | sort %}`
- Use `unless` instead of `{% if not %}` for readability
- Limit forloop iterations with `limit` and `offset`
- Use theme-check to identify performance issues

---

## Common Patterns Checklist

- [ ] Define section schema with at least 3 settings
- [ ] Use `section.settings` to access customizable values
- [ ] Include blocks for repeating content (testimonials, gallery)
- [ ] Use `render` instead of `include` for components
- [ ] Pass parameters to snippets: `render 'card', item: product`
- [ ] Add `.shopify_attributes` to block divs for editor selection
- [ ] Use filters for formatting (money, date, string manipulation)
- [ ] Check product.available before showing "Add to cart"
- [ ] Use `img_url` filter for responsive image sizing
- [ ] Add `loading="lazy"` to below-fold images
- [ ] Define presets with sensible defaults
- [ ] Add translations (JSON files in locales/)
- [ ] Use theme-check to lint for errors
- [ ] Test with product variants, multiple images, long titles
