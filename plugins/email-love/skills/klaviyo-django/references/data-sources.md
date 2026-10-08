# Klaviyo — Data Sources and Field Paths

Where values come from and the exact paths. Klaviyo's shapes differ **per integration**, so this file is mostly a lookup table — never derive one platform's paths from another's.

## Contents

1. [Namespaces and where each is available](#1-namespaces-and-where-each-is-available)
2. [Profile properties](#2-profile-properties)
3. [Event data — the general shape](#3-event-data--the-general-shape)
4. [Cart and order paths per integration](#4-cart-and-order-paths-per-integration)
5. [Building a dynamic block](#5-building-a-dynamic-block)
6. [Catalog and product feeds](#6-catalog-and-product-feeds)
7. [Custom objects and web feeds](#7-custom-objects-and-web-feeds)
8. [Editor surfaces](#8-editor-surfaces)

---

## 1. Namespaces and where each is available

| Namespace | Syntax | Available in |
|---|---|---|
| Bare profile | `{{ first_name }}` `{{ last_name }}` `{{ full_name }}` `{{ email }}` | Everywhere |
| Profile | `{{ person.X }}` / `{{ person\|lookup:'X' }}` | Everywhere |
| Organization | `{{ organization.X }}` | Everywhere |
| **Event** | `{{ event.X }}` | **Metric-triggered flows ONLY** |
| Custom object | `{{ object.X }}`, `{{ object_filter.X }}` | Object-triggered flows only |
| Catalog item | `{{ catalog_item.X }}`, `{{ catalog_id }}` | Inside `{% catalog %}` |
| Web feed | `{{ feeds.FEED_NAME }}` | Everywhere |

**The `event` namespace does not exist in campaigns.** Klaviyo states it plainly: *"Event personalization is only supported for flows triggered by that event. If you use a personalization tag from an event, but send that email another way (e.g., a campaign, a flow triggered by a different event, or a flow triggered by a list), the personalization will not render."*

It renders blank, not as an error. This is the single most common cause of "my cart block is empty."

Flows triggered by a **list, segment, or date property** also have no `event` data.

---

## 2. Profile properties

| Tag | Property |
|---|---|
| `{{ email }}` | Email |
| `{{ first_name }}` / `{{ last_name }}` / `{{ full_name }}` | Name |
| `{{ person.id }}` | Unique ID (`$id` / external ID) |
| `{{ person.KlaviyoID }}` | Klaviyo ID |
| `{{ person.organization }}` | Recipient organization |
| `{{ person.title }}` | Title |
| `{{ person.phone_number }}` | Phone number |
| `{{ person.City }}` / `{{ person.Region }}` / `{{ person.Country }}` / `{{ person.Zipcode }}` | Location |
| `{{ person\|lookup:"$address1" }}` / `{{ person\|lookup:'$address2' }}` | Street address |
| `{{ person\|lookup:"$latitude" }}` / `{{ person\|lookup:"$longitude" }}` | Coordinates |
| `{{ person\|lookup:"$timezone" }}` | Recipient timezone (data only — nothing converts with it) |
| `{{ person\|lookup:"$source" }}` | Source |
| `{{ person\|lookup:"$consent" }}` | Consent |
| `{{ person\|lookup:'$consent_form_id' }}` / `'$consent_form_version'` / `'$consent_method'` / `'$consent_timestamp'` | Consent detail |
| `{{ person\|lookup:'$phone_number_region' }}` | Phone region |
| `{{ person.ViewedItems }}` | Recently viewed items |
| `{{ person\|lookup:"Expected Date Of Next Order" }}` | Predicted next order date |

Custom properties: `{{ person.property_name }}` or `{{ person|lookup:'property name' }}` when the name has spaces or a `$`.

**Organization** (Settings → Organization → Contact Information): `{{ organization.name }}` · `{{ organization.url }}` · `{{ organization.full_address }}` · `{{ organization.street_address }}` · `{{ organization.street_address2 }}` · `{{ organization.city }}` · `{{ organization.region }}` · `{{ organization.zip_code }}`

`{{ organization.url }}` is load-bearing — several integrations don't provide absolute product URLs, so you build them from this plus a handle.

---

## 3. Event data — the general shape

Klaviyo events have **top-level properties** and a nested **`extra`** blob holding the platform's raw payload.

```django
{{ event.Items }}                    a shallow list of item NAMES
{{ event.extra.line_items }}         the rich array you actually build tables from
{{ event|lookup:'$value' }}          cart/order total
{{ event|lookup:'Item Count' }}
{{ event|lookup:'$currency_code' }}
```

Klaviyo's own description: *"`Items` — A top-level array containing a simple list of each item's name. `line_items` — An array nested within the `extra` array containing more detail, including each item's title, price, SKU, and image URL."*

Documented top-level properties on Shopify **Checkout Started / Placed Order**: `$value`, `Items`, `Collections`, `Item Count`, `Discount Codes`, `Total Discounts`, `Customer Locale`, `Location Name`, `Location ID`, `$extra`. Placed Order adds `Source Name`, `OptedInToSmsOrderUpdates`.

**`Ordered Product`** fires once per item and exposes `$value`, `Name`, `Variant Name`, `SKU`, `ProductID`, `Quantity`, `Collections`.

**Only use properties from a single metric in one template.** Profile variables can be mixed in freely, but two different events' properties in one template will not both render.

---

## 4. Cart and order paths per integration

**These do not follow a pattern.** Note that Shopify uses `line_items` (lowercase), WooCommerce uses `Items` (capitalized) inside `extra`, and Magento 2 puts some paths at the top level with different capitalization again. Copy from the preview panel when you can.

### Shopify

```django
{{ event.extra.line_items.0.title }}                      line title
{{ event.extra.line_items.0.product.title }}              product title
{{ event.extra.line_items.0.variant_price }}
{{ event.extra.line_items.0.line_price }}
{{ event.extra.line_items.0.quantity }}
{{ event.extra.line_items.0.product.handle }}             URL handle
{{ event.extra.line_items.0.product.images.0.src }}
{{ event.extra.line_items.0.product.variant.images.0.src }}
{{ event.extra.checkout_url }}                            return-to-cart URL
{{ event.extra.presentment_currency }}                    currency the customer used
{{ event|lookup:'$currency_code' }}                       store base currency
{{ event.extra.customer.total_spent }}
{{ event.extra.customer.default_address.address1 }}
{{ event.ShippingAddress.address1 }}
```

Product URL — Shopify's payload has no absolute URL, so build it:

```django
{{ organization.url }}products/{{ item.product.handle }}
```

### WooCommerce — note the capitalized `Items`

```django
{{ event.extra.Items.0.Name }}
{{ event.extra.Items.0.URL }}
{{ event.extra.Items.0.Images.0.URL }}
{{ event.extra.Items.0.LineTotal }}
{{ event.extra.Items.0.Quantity }}
{{ event.extra.Items.0.TotalWithTax }}
```

Cart rebuild: `{{ organization.url|trim_slash }}/cart?wck_rebuild_cart={{ event.extra.CartRebuildKey }}`

⚠️ The rebuild key restores someone's cart to whoever holds it, and a query string is readable in the Referer header, browser history, and proxy logs. Treat it as a credential, not an identifier.

### BigCommerce — mixes `line_items` and `items`

```django
{{ event.extra.line_items.0.product.name }}
{{ event.extra.line_items.0.product.price }}
{{ event.extra.line_items.0.quantity }}
{{ event.extra.items.0.product.url }}          note: items, not line_items, for the URL
{{ event.extra.items.0.product.images.0.src }}
{{ event.extra.total_inc_tax }}
```

Product URL: `{{ organization.url }}{{ item.product.url }}`

### Magento 1

```django
{{ event.extra.line_items.0.product.name }}
{{ event.extra.line_items.0.product.key }}          URL key
{{ event.extra.line_items.0.product.images.0.url }}
{{ event.extra.line_items.0.quantity }}
{{ event.extra.items.0.base_original_price }}
{{ event.extra.base_grand_total }}
```

Product URL: `{{ organization.url }}{{ item.product.key }}`

### Magento 2 — capitalized top-level `Items` for the URL

```django
{{ event.extra.line_items.0.product.name }}
{{ event.extra.line_items.0.product.price }}
{{ event.extra.line_items.0.product.images.0.url }}
{{ event.Items.0.Product.FullURL }}
{{ event.extra.base_grand_total }}
```

Cart rebuild: `{{ organization.url }}/reclaim/checkout/cart?quote_id={{ event.Extra.QuoteID }}`

⚠️ Same as the WooCommerce key above — `quote_id` in a query string is a bearer token for that cart.

### PrestaShop

```django
{{ event.ReclaimCartUrl }}
```

---

## 5. Building a dynamic block

The documented workflow, and the one to walk a user through:

1. In **Preview & test**, copy two sibling tags from the same item.
2. Find the common prefix and drop the trailing `.0` — that's your **Row collection**.
3. Pick a **Row alias** (e.g. `item`).
4. Inside the block, reference `{{ item.<remainder> }}`.

```
{{ event.extra.line_items.0.variant_price }}
{{ event.extra.line_items.0.title }}
    ↓
Row collection:  event.extra.line_items
Row alias:       item
In the block:    {{ item.title }}   {{ item.variant_price }}
```

Same derivation in a hand-written loop:

```django
{% for item in event.extra.line_items|slice:':3' %}
  <tr>
    <td><img src="{{ item.product.images.0.src }}" width="120"></td>
    <td>
      <a href="{{ organization.url }}products/{{ item.product.handle }}">{{ item.title }}</a><br>
      Qty {{ item.quantity }} &middot; {% currency_format item.line_price %}
    </td>
  </tr>
{% endfor %}
```

**Which events need a repeating block:**

- **Dynamic (repeating):** Placed Order, Started Checkout / Checkout Started, Fulfilled Order, Cancelled Order — anything with a list of products.
- **Static (single):** Added to Cart, Viewed Product — always one product.

The table block's **Fallback content** toggle covers the empty-collection case; in raw code that's `{% empty %}`.

---

## 6. Catalog and product feeds

**`{% catalog %}`** is covered in `syntax.md` §4. The load-bearing fact: a failed lookup **skips the whole message**.

**Product feeds** are configured at *Content → Products → Product feed* and consumed by a **Product block** in the editor. There is no tag for them — anyone asking for `{% recommended_products %}` or `{% trending_products %}` needs the UI, not code.

Recommenders available: best-selling, most-viewed, newest, recently viewed (last 90 days), added-to-cart, "customers may also like."

**Hard exclusions from recommendations** (worth knowing when a block looks under-filled): items with no image, items the recipient already purchased, out-of-stock items, and **items present in the flow's trigger event**. That last one surprises people building "you might also like" into an abandoned cart.

Feed names: no spaces, no special characters, must not start with `_`. Model retrains every 2–7 days.

**Product blocks do not support custom HTML.** A coded template that needs one requires a hybrid template.

A documented mismatch worth flagging: product feed **price and inventory filters apply to variants**, but the block renders **items** — so a block can display a price outside the range you filtered on.

---

## 7. Custom objects and web feeds

**Custom objects** — object-triggered flows only:

```django
{{ object.Name }}
{{ object|lookup:'Name' }}
{{ object_filter.oldest_dog.Name }}
{{ object_filter.count_of_dogs }}

{% customobject event.pet_id object_type_title="Pet" as pet %}{{ pet.Name }}{% endcustomobject %}
{% customobjects object_type_title="Pet Profile" as pets %}{% for p in pets %}{{ p.Name }}{% endfor %}{% endcustomobjects %}
```

`{% object %}`, `{% object_filter %}`, and `{% customobject %}` are supported in **subject lines**.

**Web feeds** (external JSON/XML) are the escape hatch for arbitrary data:

```django
{% for item in feeds.MY_FEED.articles|slice:':3' %}
  {{ item.title }}
  <img src="{{ item.images.thumbnail_url }}">
  {{ item.summary|truncatechars:250 }}
{% endfor %}
```

---

## 8. Editor surfaces

| Surface | Notes |
|---|---|
| **Table block → Styles → Dynamic** | UI wrapper around `{% for alias in collection %}`. Exposes Row collection + Row alias + optional Fallback content |
| **Content Repeat / Repeat Block** | Repeat rules on any block: *Repeat For* (e.g. `feeds.Help_Center.articles\|slice:':3'`) + *Item Alias* |
| **Display tab → Show/hide logic** | No-code conditional builder. **Profile data only**, as text / numbers / lists. Does NOT support event data, dates, or booleans. Non-alphanumeric characters (`=`, `<`, `>`) in property names or values error out |
| **Use code / Convert to code** | Switches show/hide to a raw Django condition. **Not reversible** |
| **Image block → Dynamic Image** | *Dynamic variable or dynamic URL* field takes a tag like `{{ item.product.images.0.src }}` |
| **Personalization menu** | Inserts a tag with `\|default:''` pre-attached |
| **Django Tag Builder** | How to view and edit conditionals that are invisible in the inline editor |
| **HTML block / `</>` in a table cell** | Raw code inside a drag-and-drop template |
| **Custom HTML (CODE) template** | Must be `.html` and **must contain `{% unsubscribe %}` or `{% unsubscribe_link %}`** or the upload fails |
| **Hybrid (USER_DRAGGABLE)** | Editable regions marked `data-klaviyo-region="true"`; blocks `class="klaviyo-block klaviyo-text-block"` / `klaviyo-image-block`; universal content `data-klaviyo-universal-block="block_id"` |

**The invisible-tag trap:** conditional tags placed in a rich-text block are **not shown** in the inline text editor although they're still live. The documented list of hidden-but-present tags:

```
{% for %} {% endfor %}
{% if %} {% elif %} {% else %} {% endif %}
{% with %} {% endwith %}
```

Users add them again because they look missing, and end up double-nested. Edit via the Django Tag Builder or move the content into an HTML block.

---

## Sources

Klaviyo: [Message personalization reference](https://help.klaviyo.com/hc/en-us/articles/4408802648731) · [How to use event data to personalize email and SMS flows](https://help.klaviyo.com/hc/en-us/articles/115002779071) · [How to build dynamic blocks in a flow email](https://help.klaviyo.com/hc/en-us/articles/4408802597659) · [How to create an abandoned cart flow](https://help.klaviyo.com/hc/en-us/articles/115002779411) · [Shopify data reference](https://help.klaviyo.com/hc/en-us/articles/115005080447) · [Catalog lookup tag reference](https://help.klaviyo.com/hc/en-us/articles/360004785571) · [Product feeds and recommendations](https://help.klaviyo.com/hc/en-us/articles/115005082787) · [Custom web feeds](https://help.klaviyo.com/hc/en-us/articles/115005258768) · [Custom objects in templates](https://help.klaviyo.com/hc/en-us/articles/35146367972763) · [Show or hide template blocks](https://help.klaviyo.com/hc/en-us/articles/7655965301531) · [How to use the preview panel](https://help.klaviyo.com/hc/en-us/articles/27843522951707)
