# Braze — Data Sources and Field Paths

Namespaces, availability by channel, and the exact paths.

## Contents

1. [Standard attributes](#1-standard-attributes)
2. [Namespaces and availability](#2-namespaces-and-availability)
3. [Nested objects and arrays](#3-nested-objects-and-arrays)
4. [Commerce and abandoned cart](#4-commerce-and-abandoned-cart)
5. [Catalogs and selections](#5-catalogs-and-selections)
6. [Connected Content](#6-connected-content)
7. [Content Blocks](#7-content-blocks)
8. [Limits](#8-limits)

---

## 1. Standard attributes

No namespace — bare `${}`.

```liquid
{{${city}}}                  {{${country}}}              {{${date_of_birth}}}
{{${email_address}}}         {{${first_name}}}           {{${gender}}}
{{${language}}}              {{${last_name}}}            {{${last_used_app_date}}}
{{${most_recent_app_version}}}  {{${most_recent_locale}}}  {{${most_recent_location}}}
{{${phone_number}}}          {{${time_zone}}}            {{${user_id}}}
{{${braze_id}}}              {{${random_bucket_number}}}
```

Note it is **`email_address`, not `email`**, and **`phone_number`, not `phone`**. There is no `${external_id}` tag — the documented pair is `${user_id}` and `${braze_id}`.

**Subscription state**

```liquid
{{subscribed_state.${email_global}}}
{{subscribed_state.${subscription_group_id}}}
```

**Email list / subscription URLs** — email campaigns and Canvases only:

```liquid
{{${set_user_to_unsubscribed_url}}}            replaces the legacy {{${unsubscribe_url}}}
{{${set_user_to_one_click_list_unsubscribe}}}
{{${set_user_to_subscribed_url}}}
{{${set_user_to_opted_in_url}}}
```

A template must contain `{{${set_user_to_unsubscribed_url}}}` to save. To temporarily remove it, comment it out with an HTML comment: `<!-- {{${set_user_to_unsubscribed_url}}} -->`.

---

## 2. Namespaces and availability

| Source | Syntax | Available in |
|---|---|---|
| Custom attributes | `{{custom_attribute.${attr}}}` | Everywhere |
| Custom event properties | `{{event_properties.${prop}}}` | Action-based campaigns; **first step only** of an action-based Canvas |
| API trigger properties | `{{api_trigger_properties.${prop}}}` | **Campaigns only** |
| Canvas entry properties | `{{context.${prop}}}` | Canvas |
| Canvas entry properties (legacy alias) | `{{canvas_entry_properties.${prop}}}` | Canvas — see note below |
| Most recent device | `{{most_recently_used_device.${…}}}` | All channels |
| Targeted device | `{{targeted_device.${…}}}` | Push, in-app, Banners — **not** email or Content Cards |
| Targeted app | `{{app.${api_id}}}` `{{app.${name}}}` | In-app messages |
| Campaign | `{{campaign.${api_id}}}` `${dispatch_id}` `${name}` `${message_name}` `${message_api_id}` | Messaging channels — **not** in-app or Banners |
| Canvas | `{{canvas.${name}}}` `${api_id}` `${variant_name}` `${variant_api_id}` | Canvas |
| Content Card | `{{card.${api_id}}}` `{{card.${name}}}` | Content Cards |
| SMS inbound | `{{sms.${inbound_message_body}}}` `{{sms.${inbound_media_urls}}}` | SMS |
| WhatsApp inbound | `{{whats_app.${inbound_message_body}}}` `${inbound_media_urls}` `${inbound_flow_response}` `${inbound_product_id}` `${inbound_catalog_id}` `${inbound_profile_name}` | WhatsApp |
| Geofence | `{{event_properties.${geofence_name}}}` `${geofence_set_name}` | Geofence-triggered |
| Content Blocks | `{{content_blocks.${block_name}}}` | Everywhere except email footers |

**On `context.` vs `canvas_entry_properties.`:** both appear in current Braze docs. `context.${…}` is on the canonical supported-tags table; `canvas_entry_properties.${…}` appears on the Operators and Purchase Events pages. Prefer `context.` and treat the other as a legacy alias.

**On `api_triggered_property` (singular):** appears in one FAQ line. It's a doc typo. The working namespace is `api_trigger_properties`.

### Behavioral quirks worth knowing

- In a Canvas, `{{campaign.${name}}}` returns the **Canvas component (step) name**, not the Canvas name.
- `dispatch_id` differs in Canvases because Braze treats Canvas steps as triggered events.
- Device attributes are `null` for users who never used the app (REST-imported users).
- `${platform}` values: `ios`, `android`, `kindle`, `android_china`, `web`, `tvos`.
- API trigger properties are **not written to the user profile** by default.

### Purchase properties — a documented ambiguity

Braze has no `purchase_properties.` namespace. Purchase event properties reach templates via `{{event_properties.${…}}}` on Make Purchase-triggered sends. Braze's own Purchase Events page is internally inconsistent about this — one example uses bare `${last_purchased_product}` (the standard-attribute form), another describes `${purchase_product_name}` as a custom attribute. **Verify against a real payload before relying on it.**

Reserved purchase property keys that cannot be used as names: `time`, `product_id`, `quantity`, `event_name`, `price`, `currency`.

---

## 3. Nested objects and arrays

```liquid
{{custom_attribute.${attr}.property_name}}
{{custom_attribute.${most_played_song}[0].artist_name}}
{{custom_attribute.${most_played_song}[0].play_analytics.count}}
{{event_properties.${songs}[0].album.name}}
{{context.${order_summary}.shipping.carrier}}
```

Array indices are zero-based.

**Looping:**

```liquid
{% assign pets = {{custom_attribute.${pets}}} %}
{% for pet in pets %}
  I have a {{pet.type}} named {{pet.name}}.
{% endfor %}

{% for item in {{custom_attribute.${Brands Viewed}}} limit: 5 %} … {% endfor %}
```

**Escaping in property paths:** *"If your event property contains the `[]` or `.` characters, escape them by wrapping the chunk in double-quotes"* — e.g. `"songs[].album".yearReleased`.

**Silent data-loss traps:**

- An array-of-objects update exceeding 100 KB is **silently dropped while the API still returns success**.
- *"When a nested custom attribute in your request contains any invalid values (such as invalid time formats or null values), Braze drops **all** nested custom attribute updates in the request."*
- Arrays of objects **cannot be CSV-imported** — commas break parsing. API or Cloud Data Ingestion only.
- Nested event properties require a **generated schema** (Data Settings → Custom Events → Manage Properties), sampled from the last 24 h and regenerable every 24 h.

**Nulls vs empty strings:** `""` sets the attribute to empty and it stays visible on the profile; `null` **removes** it. **Neither matches the `IS NOT BLANK` segment filter.** For non-string types with an explicitly set data type you must use `null` to unset. CSV import does not support `null`, and Booleans must be `TRUE`/`FALSE`.

---

## 4. Commerce and abandoned cart

Cart data arrives via Braze's **eCommerce recommended events** (`ecommerce.cart_updated`, `ecommerce.checkout_started`, `ecommerce.product_viewed`, `ecommerce.order_placed`) and is accessed through a **dedicated tag**, not raw event properties.

```liquid
{% shopping_cart CART_ID :abort_if_not_abandoned false %}
```

`CART_ID` is templated, typically `{{context.${cart_id}}}`.

### The canonical documented cart loop

```liquid
<table role="presentation" style="width:100%">
{% shopping_cart {{context.${cart_id}}} %}
{% for item in shopping_cart.products %}
{% catalog_items YOUR_CATALOG_NAME {{item.variant_id}} %}
  <tr>
    <th><img src="{{items[0].variant_image_url}}" width="200" height="200"></th>
    <th align="left">
      <ul style="list-style-type: none">
        <li>Item: {{item.product_name}}</li>
        <li>Price: ${{item.price}}</li>
        <li>Quantity: {{item.quantity}}</li>
        <li>Product URL: {{item.product_url}}</li>
        <li>SKU: {{item.metadata.sku}}</li>
      </ul>
    </th>
  </tr>
{% endfor %}
</table>
```

Fields on each `shopping_cart.products` item: `product_name` · `price` · `quantity` · `variant_id` · `product_url` · `metadata.<key>`

### `abort_if_not_abandoned`

Applies **only** to the abandoned-*checkout* use case with `ecommerce.checkout_started`. **Not applicable to abandoned cart.**

| Value | Behavior |
|---|---|
| `true` (default) | Message is **aborted** if the user completed the order |
| `false` | Sends regardless |

### Cart and checkout URLs

```liquid
{{context.${metadata}.cart_url}}
{{context.${metadata}.checkout_url}}
{{context.${source}}}/checkouts/cn/{{context.${cart_id}}}     Shopify pattern
```

---

## 5. Catalogs and selections

```liquid
{% catalog_items Games 1234 %}
Get {{ items[0].title }} for {{ items[0].price }}!

{% catalog_items Games 1234 1235 1236 %}
{{items[0].title}}, {{items[1].title}}, {{items[2].title}}

{% assign wishlist = {{custom_attribute.${wishlist}}} %}
{% catalog_items Games {{wishlist[0]}} %}

{% catalog_selection_items Games cheap_games %}
{% for item in items %}{{ item.title }}{% endfor %}

{% catalog_selection_items item-list selections %}{{ items | size }}
```

Items land in an implicit zero-indexed array named **`items`**. The tag must be declared **before** `items` is referenced.

### Rules that bite

- **A nonexistent ID returns an empty `items` array — no error.** Braze explicitly recommends checking `items | size` before rendering.
- **No whitespace or line breaks between the tag and the print expression in HTML.** `<img src="{% catalog_items Games 1234 %}{{ items[0].image_link }}">` — extra whitespace prevents the URL resolving. This one is easy to introduce while formatting.
- `:rerender` renders Liquid stored *inside* a catalog field, **one level deep only**, and is not recursive. Without it, the raw Liquid is output. Profile fields used inside catalog Liquid must be defined earlier in the message.
- Up to **3 catalog items** per Add Personalization insertion (repeat to add more).
- Up to **30 selections per catalog**, **10 filters per selection**, results limit **50 items**.
- Geolocation selections: `geo within` / `geo outside`, center point can be `{{${most_recent_location}}}`, results sorted nearest-first.
- Connected Content Liquid is **not supported** in selection filter settings.
- Preview shows up to 3 selection results regardless of the configured limit.
- Banners do not support `catalog_items :rerender`.
- Braze's own FAQ: *"If a catalog Liquid snippet aborts during send, recreate the snippet from the personalization menu by selecting individual catalog items instead of using a bulk or fully dynamic selection."*

---

## 6. Connected Content

```liquid
{% connected_content
     URL
     :method post
     :headers { "Content-Type": "application/json", "Authorization": "{{token}}" }
     :body key1=value1&key2=value2
     :content_type application/json
     :basic_auth credential_name
     :auth_credentials token_name
     :cache_max_age 900
     :no_cache
     :retry
     :save variable_name %}
```

The URL is **unquoted and comes first**. All named arguments are `:`-prefixed.

**`:save`** — if the endpoint returns JSON and you omit `:save`, the result is auto-parsed into a variable named `connected`. Non-JSON text is inserted inline in place of the tag. With `:save myvar`, access as `{{myvar.field}}` / `{{myvar.data[0].field}}`.

**Scope:** *"The stored variable can only be accessed within the field that contains the request."* Subject line, HTML body, plain-text body, and preheader render separately — repeat the call in each.

Calls execute **sequentially top to bottom**, so later calls can use earlier results:

```liquid
{% connected_content https://api.example.com/user :save user_data %}
{% connected_content https://api.example.com/prefs?t={{user_data.prefs_token}} :save prefs %}
```

⚠️ Never put a recipient identifier (email, user ID, phone) in a GET query string — URL-encoding it does not prevent disclosure, it only formats it, and the value still lands in your endpoint's access logs, any proxy in front of it, analytics, and browser history, with Braze retries putting it there repeatedly. Send identifiers in a POST body where the endpoint allows one, or — as above — have the first call mint an **opaque, short-lived token** that later calls pass instead. Pass only that reference, not the profile fields the endpoint can look up itself.

**Method and body:** GET and POST only. GET defaults to `Content-Type: application/json` with `Accept: */*`. POST body defaults to `application/x-www-form-urlencoded` (`key1=value1&key2=value2`). Setting `:content_type application/json` with a form-urlencoded body makes Braze auto-JSON-encode it. **Inline JSON bodies cannot contain spaces** — use `capture` or `assign`.

**Email gotcha:** HTML parsing converts `&` inside `{% capture %}` to `&amp;`, producing parameter names like `amp;username`. Workaround: `:body {{body | replace: "amp;", ""}}`.

**Status codes:**

```liquid
{% connected_content https://example.com/api :save connected %}
{% if connected.__http_status_code__ != 200 %}
  {% abort_message('Connected Content returned non-200') %}
{% endif %}
```

`__http_status_code__` is added **only when the endpoint returns a JSON object** — not an array or other type.

**Failure behavior:** 404 renders an **empty string**. 500/502 falls to retry logic. Response must be **2XX** to be consumed. Only ports 80 and 443. **Redirects are not followed.** Non-breaking spaces (`&nbsp;` / U+00A0) are stripped from URLs before the request — a common cause of blank renders when a URL was pasted from a document.

**`:retry`** — 5 attempts with exponential backoff, then the message is **aborted**. Not available for in-app messages. Applies to live and test sends but **not previews**, where you'll see *"This message would not have been shown because retry functionality was triggered."* If abort logic and retry logic target the same condition, **abort wins** and retries never run.

**Caching:** GET cached by default at **300 s**; POST not cached unless `:cache_max_age` is set. Min 5 min, max 4 h. **Cache key = workspace + URL + content type + body — not user or campaign**, so cached responses cross users. Caching is **skipped** when the tag markup contains `{{${user_id}}}`, `{{${braze_id}}}`, `{{${email}}}`, `{{${email_address}}}`, `{{${phone_number}}}`, or `{{${date_of_birth}}}`. Responses over 1 MB won't cache. Memcached-backed and volatile — TTLs are suggestions.

**Volume:** *"One send does not equal one Connected Content call."* A single email can trigger separate rendering passes for HTML, plain text, and AMP. Braze suggests sizing endpoints at recipients × 2 or × 3. Braze applies no rate limit of its own. **Design endpoints to be idempotent.**

**Unhealthy host detection:** on >3,000 failures **and** >90% error rate in a one-minute window (per hostname, per app group), Braze halts requests for a minute and simulates a **598** response, continuing to render Liquid as if it got an error. Contributing codes: 408, 429, 502, 503, 504, 529.

Credentials live at **Settings → Connected Content** and are referenced by name. Deleting one aborts calls that use it. They apply to `{% connected_content %}` only — not a webhook step's primary request.

`User-Agent` is `Braze Sender <hash>`; the hash rotates, so filter on the `Braze Sender` prefix.

---

## 7. Content Blocks

```liquid
{{content_blocks.${your_content_block}}}
```

**Nesting limit is one level.** *"You can nest Content Block A into Content Block B, but you can't then nest Content Block B into Content Block C."* Nothing in the UI stops a third level — it silently fails and *"the content and the Liquid snippet are removed from the message."*

Specs: name ≤ 100 chars, `[A-Za-z0-9\-_]` only (spaces become underscores), **name is immutable after save and never reusable even after archiving**. Description ≤ 250 chars. **Content max 50 KB.** Cannot be used in an email footer.

**Linkage:** inserted **via Liquid** → linked, updates propagate. Inserted **via drag-and-drop** → an unlinked static copy.

Whitespace hygiene:

```liquid
{% capture block %}
{{content_blocks.${your_block}}}
{% endcapture %}{{block | strip}}
```

Other: `<head>` styles are dropped when a drag-and-drop block is inserted via Liquid. Canvas entry properties inside a Content Block don't populate in campaigns. Links inside nested blocks count toward the parent message's link total.

---

## 8. Limits

| Limit | Value |
|---|---|
| Nested custom attribute object | 100 KB |
| Key names & string values | 255 characters |
| Array custom attribute | 100 KB; default 500 items (FIFO eviction) |
| Segmentation array nesting | **one level only** — `pets[].name` works, `pets[].nicknames[]` does not |
| Event property payload | 102,400 bytes (100 KiB) |
| Purchase `properties` object | 50 KB |
| Canvas `context` / `canvas_entry_properties` | 50 KB (FAQ advises keeping under ~1 KB for render performance) |
| `trigger_properties` object | 50 KB |
| Canvas Context step | ≤10 variables, ≤50 KB per step, names ≤100 chars, definitions ≤10,240 chars |
| Catalog string array field | 100 elements |
| Catalog cell value | 5,000 characters |
| Catalog CSV | 1,000 fields; column names ≤250 chars |
| Content Block | 50 KB; 1 level of nesting |
| `message_extras` key+value | 1,000 bytes; whitespace counts; excess truncated |
| Connected Content response | 1 MB (larger won't cache) |
| Connected Content **server response time** | **2 seconds** — slower and the content is not inserted |
| Connected Content cache | default 300 s; min 5 min; max 4 h |
| Push payload | Braze max 3,807 bytes (iOS 3,960 / Android 3,930 / Kindle 5,985; provider limit 4 KB) |
| Content Card | **2 KB pre-compression** across title, message, image URL, link text, link URLs, key-value pairs. Exceeding → not sent |
| Active Content Card campaigns | 500 |
| Banner placements | 25 messages per workspace per placement |
| Message Activity Log retention | **60 hours** |
| Connected Content request-metadata log retention | 30 days |
| Custom event distinct properties | 256 |

**Push + Liquid warning:** *"Braze can't determine if a push payload will exceed the size limit when Liquid is included."* The composer character counter doesn't count Liquid. Test on a real device.

No documented overall email message size limit, and no numeric Liquid render-time limit — only a qualitative "Liquid rendering timeout" abort outcome and a ~11-minute render worker job timeout.

---

## Sources

Braze: [Supported personalization tags](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/supported_personalization_tags) · [User profile](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/sources/user_profile) · [Canvas entry properties](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/sources/canvas_entry_properties) · [Context variables](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/sources/context_variables) · [Nested custom attributes](https://www.braze.com/docs/user_guide/data/activation/attributes/nested_custom_attribute_support) · [Array of objects](https://www.braze.com/docs/user_guide/data/activation/custom_data/custom_attributes/array_of_objects) · [eCommerce events](https://www.braze.com/docs/user_guide/data/activation/events/recommended_events/ecommerce_events) · [Abandoned intent template](https://www.braze.com/docs/user_guide/messaging/templates/canvas_templates/braze_templates/abandoned_cart) · [Use catalogs](https://www.braze.com/docs/user_guide/data/activation/catalogs/use) · [Selections](https://www.braze.com/docs/user_guide/data/activation/catalogs/selections) · [Connected Content API call](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/connected_content/making_an_api_call) · [Caching](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/connected_content/caching_responses) · [Retries](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/connected_content/connected_content_retries) · [Content Blocks](https://www.braze.com/docs/user_guide/messaging/design_and_edit/content_blocks) · [API limits](https://www.braze.com/docs/api/api_limits)
