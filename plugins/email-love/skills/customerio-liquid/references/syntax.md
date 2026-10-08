# Customer.io Liquid — Tag and Filter Reference

## Contents

1. [Legacy vs latest](#1-legacy-vs-latest)
2. [Tags](#2-tags)
3. [Customer.io-specific tags](#3-customerio-specific-tags)
4. [Filters](#4-filters)
5. [Dates and timezones](#5-dates-and-timezones)
6. [Escaping and URLs](#6-escaping-and-urls)
7. [Snippets and layouts](#7-snippets-and-layouts)
8. [Liquid in non-body places](#8-liquid-in-non-body-places)

---

## 1. Legacy vs latest

| | Engine | Who |
|---|---|---|
| **Latest** | **LiquidJS** | Accounts created on/after **Nov 28, 2023**; **all Design Studio messages** regardless of account age |
| **Legacy** | **Ruby (Shopify) Liquid** | Accounts created before that date, per-message opt-in |

Set **per message**. Check by hovering the "last saved" date in the editor. Workspace default: General Workspace Settings → *"What liquid version do you want to use by default for new messages?"* — **affects new messages only**; there is no bulk upgrade and no account-level (multi-workspace) setting. Translations and language variants upgrade individually.

**Snippets and layouts have no version** — they render under the host message's version.

### What changes on upgrade

**Deprecated in latest:** `timezone` (use `date`'s 2nd argument) · `htmlencode` (use `escape`)

**New in latest:** `default` · `json_array_uniq` · `break` · `== empty` for arrays

**Same name, different behavior — these break silently:**

| Filter | Change |
|---|---|
| `escape` | **No longer URL-encodes.** Use `url_encode`. This is the most dangerous upgrade regression |
| `timezone` offset | **Minutes, not hours.** `-8` → `-480` |
| `currency` / `rounded_currency` | Accept locale **and** currency code |
| `sort` | No longer throws on null-containing arrays, but won't reorder them |
| `concat` | Accepts an object or an array |
| `sha256` | Now matches `hmac_sha256` output |
| `times` / `divided_by` | Drop trailing decimals on whole numbers |
| `modulo` | Always returns positive |
| `sum` | Casts all values to number instead of concatenating |

Locales added in latest: `gsw-CH, ja-JP, kk, mg, sv-FI, sv-SE, uk, zh-Hant-MO, zh-MO`. `zh-YUE` is legacy-only. Latest supports `Asia/Riyadh` but drops `Asia/Riyadh87/88/89` and `Mideast/Riyadh87/88/89`.

### Version detection idiom

Documented, works in both. **Assign and read must be in the same scope** — you cannot assign in a snippet and read in the template.

```liquid
{% assign liquid_version = nil | default: "latest" %}{% unless liquid_version == "latest" %}{% assign liquid_version = "legacy" %}{% endunless %}

{% if liquid_version == "latest" %}{{ product_color | default: "red" }}{% else %}{% if product_color != blank %}{{ product_color }}{% else %}red{% endif %}{% endif %}
```

---

## 2. Tags

### Conditionals

```liquid
{% if customer.lastEventType == "sports" %}
…
{% elsif customer.lastEventType == "theater" %}
…
{% else %}
…
{% endif %}

{% unless product.name == "cool beans" %}The beans are not cool.{% endunless %}

{% case condition %}
{% when "value1" %}…
{% when "value2" or "value3" %}…
{% else %}…
{% endcase %}
```

Operators: `==` `!=` `>` `>=` `<` `<=` `and` `or` `contains`

Special comparands: `blank` · `nil` · `empty` (latest only, for arrays)

> **`blank` vs `nil`:** `== blank` is true when the value is missing, null, false, or an empty string. `== nil` is true only when it doesn't exist. Use `nil` when `false` is a legitimate value.

**Note:** Customer.io's own SMS documentation publishes `{% else if … %}` — that is **not valid Liquid**. It must be `{% elsif %}`.

### Loops

```liquid
{% for item in array %}{{ item }}{% endfor %}

{% for i in (1..5) %}
  {% if i == 4 %}{% break %}{% else %}{{ i }}{% endif %}
{% endfor %}

{% for item in customer.products %}
  <div class="product-{% cycle 'odd', 'even' %}">{{ item }}</div>
{% endfor %}
```

`{% break %}` is **latest only**.

**Not documented by Customer.io:** `limit:` / `offset:` / `reversed` as for-loop parameters, `forloop.index` / `.first` / `.last` / `.length`, `{% increment %}` / `{% decrement %}`, `{% tablerow %}`, `{% ifchanged %}`, `{% else %}` inside `for`. Both underlying engines support them and Customer.io's docs link out to the Shopify iteration reference — but Customer.io neither lists nor guarantees them. **Test before shipping.**

`limit` *does* exist as a standalone filter: `{{ beatles | limit: 2 | join: ", " }}`.

### Variables and misc

```liquid
{% assign favorite_food = 'apples' %}
{% capture about_me %}I am 28 and my favorite food is pasta.{% endcapture %}
{% comment %}Don't display me!{% endcomment %}
{% raw %}{{This}} is displayed exactly as typed.{% endraw %}
```

`{% else %}` inside `{% capture %}` throws `capture tag does not expect else tag`.

**Whitespace control:** hyphens strip whitespace before/after a tag.

```liquid
Hello, {{ username -}} !          →  Hello, Charlie!
{% if condition -%} … {%- endif %}
```

---

## 3. Customer.io-specific tags

```liquid
{% cio_link url:https://example.com %}
{% cio_link url:https://example.com track:true url_params:true %}
{% cio_link url:"https://example.com" url_params:false %}
{% cio_link_id %}
{% view_in_browser_url %}
{% unsubscribe %}
{% unsubscribe_url %}
{% manage_subscription_preferences_url %}
{% tracking_consent_url %}
{% subscription_topic_name %}
{% subscription_topic_name lang='pt' %}
{% generate_uuid %}
{% random 100 %}
{% render_liquid <liquid-key-name>.<attribute_name> %}
{% countdown point:64 font:roboto weight:light fg:000000 bg:f2f6f9 time:"2022-07-04 12:00:00 (GMT)" locale:en looping:true resolution:S frames:2 %}
```

**These are `{% %}` tags, not `{{ }}` variables.** `{{unsubscribe_url}}` renders empty — this is the most common single mistake in Customer.io templates.

`{% view_in_browser %}` **must exist in the email** for the hosted page to be generated at all; otherwise the link is dead. Email only — not supported in push or WhatsApp.

**`{% render_liquid %}`** renders Liquid stored *inside an attribute value*: without it, `{{journey.body}}` prints `Hello {{customer.first_name}}!` as literal text. It executes the stored string as template code, so point it **only at author-written template strings** your own workflow stored. LLM-action output, webhook payloads, partner feeds, and profile/event values are data — never render them with this tag; output them escaped and compose dynamic copy from a fixed allowlist of author-written placeholders instead.

**Countdown parameters:** `point` (required, int, font size) · `time` (required, `"YYYY-MM-DD hh:mm:ss (GMT)"`, **no Liquid variables allowed**) · `fg` (required hex) · `bg` (required hex) · `apng` (bool, default false) · `font` (inter / roboto) · `weight` (default normal) · `locale` (`en ru jp zh pt es fr`) · `looping` (bool) · `resolution` (`S|M|H|D`) · `frames` (int, default 1). **Max 60 frames.** At `resolution:S` it stops 60 s after image load and reloads on each open.

**SMS/WhatsApp:** URL parameters are **not** auto-appended — you must use `{% cio_link url:"…" %}`.

---

## 4. Filters

### String

`append` `prepend` `capitalize` `upcase` `downcase` `titlecase` `truncate` `truncatewords` `replace` `replace_first` `replace_last` `remove` `remove_first` `remove_last` `split` `strip` `lstrip` `rstrip` `strip_html` `strip_newlines` `normalize_whitespace` `newline_to_br` `slice` `slugify` `pluralize` `number_of_words` `array_to_sentence_string` `contains` `escape` `escape_once` `xml_escape` `cgi_escape` `uri_escape` `url_encode` `url_decode` `base64` `base64_encode` `base64_decode` `base64_url_safe_encode` `base64_url_safe_decode` `hex_base64` `md5` `sha1` `sha256` `hmac_sha1` `hmac_sha256`

```liquid
{{ "What's all the hubbub, " | append: "bub?" }}
{{ "I knew I shoulda taken that left turn." | truncate: 20 }}
{{ "Customer.io" | slice: 3, 3 }}        → tom
{{ "Customer.io" | slice: '-4', 3 }}     → r.i
{{ event.item_count | pluralize: 'item', 'items' }}   → 3 items
{{ customer.groceries | split:"," | array_to_sentence_string: "or" }}
{{ "Customer.io" | hmac_sha256: "some_key" | hex_base64 }}
```

### Number and currency

`abs` `ceil` `floor` `round` `at_least` `at_most` `plus` `minus` `times` `divided_by` `modulo` `format_number` `currency` `rounded_currency` `random`

```liquid
{{ 4.32 | round: 1 }}                            → 4.3
{{ 41 | at_least: 42 }}                          → 42
{{ 10000 | format_number }}                      → 10,000
{{ 123456.78 | format_number: "fr" }}            → 123 456,78
{{ 1234567.896 | currency }}                     → $1,234,567.90
{{ 1234567.896 | currency: 'en-GB' }}            → £1,234,567.90
{{ 1234567.896 | currency: 'en', 'EUR' }}        → €1,234,567.90
{{ 1234567.896 | rounded_currency: 'en', 'EUR' }} → €1,234,568
```

`format_number` replaces the old `number_with_delimeter`. A currency code is only accepted **after** a locale.

**Attributes are stored as strings.** Coerce before any math or numeric comparison, or you get `Unidentified method`:

```liquid
{% assign n = customer.my_attribute | plus: 0 %}
{% if n > 0 %}…{% endif %}
```

### Array

`compact` `concat` `find` `find_exp` `first` `last` `group_by` `group_by_exp` `join` `json_array_uniq` `limit` `map` `pop` `push` `shift` `unshift` `remove` `reverse` `size` `sort` `sort_natural` `sum` `uniq` `where` `where_exp` `where_not`

```liquid
{{ customer.purchases | find: "type", "kitchen" | json }}
{{ members | find_exp: "item", "item.graduation_year == 2014" | json }}
{% assign groups = customer.purchases | group_by: "type" %}
{% assign groups = customer.purchases | group_by_exp: "item", "item.type contains 'kitchen'" %}
{% assign names = customer.characters | map: 'name' %}
{% assign players = customer.players | where: "sport", "baseball" %}
{% assign available = customer.products | where: "available" %}
{% assign kitchen = customer.products | where_exp: "item", "item.size > 30 and item.type == 'kitchen'" %}
{% assign others = customer.players | where_not: "sport", "baseball" %}
{{ cart.products | sum: 'total_number' }}
{{ customer.colors | concat: customer.other | json_array_uniq: 'name' | to_json }}
```

`size` works as a filter **or** dot notation:

```liquid
{{ objects.online_classes | size }}
{{ objects.online_classes.size }}
```

⚠️ **`.size` dot-notation cannot be compared with `==`.** Use `> 0`.

⚠️ `sort` is **case-sensitive** and won't reorder an array containing nulls.

### Utility

```liquid
{{ product_color | default: "red" }}                    latest only
{{ product_price | default: 2.99 }}
{% assign v = '{"key":"value","number":123}' | from_json %}
{{ customer.purchases | to_json }}
{{ arr | json: 4 }}
{{snippets.footer}}
```

`from_json` is only for **stringified** JSON — profile, event, and object JSON is already parsed.

⚠️ `to_json` on a whole namespace — `{{ customer | to_json }}`, `{{ event | to_json }}` — serializes every attribute on it, including ones added to the schema after you wrote the template. Name the fields you want.

---

## 5. Dates and timezones

**Customer.io stores date-times as Unix epoch in SECONDS.** Explicitly unsupported: milliseconds, ISO 8601 strings, RFC 2822 strings, negative timestamps, and any value between `0` and `100000000`.

```
Correct:               1461866400
Incorrect (ms):        1461866400000
Incorrect (ISO 8601):  2016-04-28T18:00:00Z
Incorrect (RFC 2822):  Thu, 28 Apr 2016 18:00:00 +00:00
```

### Formatting

```liquid
{{ 1483272000 | date: '%H:%M, %a, %b %d, %Y' }}
{{ customer.expiration | date: "%B %-d, %Y" }}          → July 31, 2020
{{ 'now' | date: "%B %-d, %Y" }}
```

`%Y` year · `%m` month 01–12 · `%B` full month · `%d` day 01–31 · `%-d` day unpadded · `%A` weekday · `%H:%M` 24h · `%I:%M %P` 12h · `%Z` tz abbreviation · `%s` epoch

Also: `date_to_long_string` · `date_to_string` · `date_to_rfc822` · `date_to_xmlschema`

```liquid
{{ site.time | date_to_long_string: "ordinal", "US" }}   → November 7th, 2008
{{ site.time | date_to_string: "ordinal" }}              → 07th Nov 2008
```

Offsets: `add_day` `add_month` `add_year` `subtract_day` `subtract_month` `subtract_year`

```liquid
{{ <unix_timestamp> | add_day: 5 }}
{{ 'now' | date: '%s' | plus: 0 | add_day: 1 | date: '%I:%M %p %B %d, %Y'}}
```

To use `add_*` / `subtract_*` on `now`, you must first convert with `date: '%s'` **and** cast with `| plus: 0`.

### Timezones — version-dependent

```liquid
{% comment %}LATEST — timezone is the SECOND argument to date{% endcomment %}
{{ customer.appointment_time | date: "%H:%M %A %b %d, %Y", customer.timezone }}

{% comment %}LEGACY — separate timezone filter{% endcomment %}
{{ customer.appointment_time | timezone: customer.timezone | date: "%H:%M %A %b %d, %Y" }}
```

**Numeric offsets are in minutes in latest, hours in legacy.** `360` = −6:00, `-360` = +6:00 in latest.

Unix timestamps and `{{ 'now' }}` default to **UTC**.

Accepted timezone values: **Region format** (IANA, `America/Los_Angeles`) or **Detailed format** (`(GMT-11:00) Hawaii`). Detailed format works in Liquid and attributes but **not** in Time Zone Match sending.

### Timezone-aware sending

Uses the `timezone` attribute, falling back to system-set `cio_timezone` (geolocation), then to a fallback timezone you configure. Available as a **Time Window delay** in workflows and **"Send in recipient's timezone"** in the Review step of one-time sends. **Cannot be combined with A/B test variants** on a one-time send.

A profile with an *invalid* (not empty) timezone receives the message **during the last date/time sent across all timezones**. `timezone_valid` is a read-only computed boolean — segment on `timezone_valid equals false AND timezone exists` to build a repair automation.

### Days remaining

```liquid
{% assign current_date = 'now' | date: '%s' %}
{% assign future_date = customer.trial_end %}
{{ future_date | minus: current_date | divided_by: 86400 }}
```

Integer division — rounds down.

---

## 6. Escaping and URLs

```liquid
{{ "cool.person@example.com" | url_encode }}       → cool.person%40example.com
{{ "%27Customer.io+is+great%27" | url_decode }}    → Customer.io is great
{{ "1 < 2 & 3" | escape_once }}
{{ "overview: account" | cgi_escape }}             → overview%3A+account
{{ "https://example.com/?q=foo, \bar?" | uri_escape }}
{{ "Eh, what's <i>up</i>?" | strip_html }}         → Eh, what's up?
{{ "a \n b" | normalize_whitespace }}              → a b
```

> **"Escaping a string removes special characters. To encode a URL, use `url_encode` instead."**

In latest Liquid, `escape` **no longer URL-encodes**. If a template relied on that, it breaks silently on upgrade.

`xml_escape` in HTML messages may produce different final output due to HTML processing.

### When personalization breaks links

1. **Empty Liquid in URL parameters is fatal.** *"If you leave the `utm_campaign` set to `campaign.name` and try to use `cio_link` to include URL parameters on links in a broadcast, one-time send, or transactional message, your message will fail."*
2. **Fully personalized transactional URLs pollute link metrics.** *"Customer.io will track a new link for each transactional message you send."* Use `{{trigger.custom_url}}` inside the href and group with `data-cio-tag`:
   ```html
   <a href="https://mydomain.com?token=123abc" data-cio-tag="YOUR-LINK-GROUP">CLICK HERE</a>
   ```
   ⚠️ A token in a query string is readable in the Referer header, browser history, and any proxy or analytics log on the way. Keep it short-lived and single-use, and never put an email address or raw profile ID there.
3. **Opt a link out of tracking or params:**
   ```html
   <a href="https://mydomain.com" class="untracked">CLICK HERE</a>
   ```
   Drag-and-drop classes: `untracked`, `disable-url-params` — both may be used together, space-separated.
4. **Deep links use `{% cio_link_id %}`, not `{% cio_link %}`:**
   ```html
   <a href="https://yourwebsite.com/confirm?link_id={% cio_link_id %}" class="untracked">Text</a>
   ```
5. Shorten long UTM values: `{{ campaign.name | truncate: 15, "" }}`
6. Auto-identify on click: append `ajs_uid=cio_{{customer.cio_id}}` — ⚠️ this puts the profile identifier in the query string of every link it is added to. Add it to the specific links that need it, not site-wide.

---

## 7. Snippets and layouts

```liquid
{{snippets.<name_of_your_snippet>}}
{{snippets.address}}
{{snippets["main address"]}}
```

Usable anywhere Liquid works — layouts, bodies, subjects, Slack messages.

**Rules and traps:**

- **Liquid inside snippets renders normally**, including in JSON objects and strings. **Exception: Liquid inside a JSON *array* in a snippet renders as literal text.**
- **Snippet scope is isolated in both directions** — a snippet can't see variables assigned in the message body, and vice versa.
- **Snippet names cannot be renamed** after creation. Avoid spaces.
- HTML in a snippet used in a **subject line** shows as raw code.
- Wait a couple of minutes after editing a snippet before activating a workflow.
- **Size: 16 KB per snippet** (raisable on request), **5 MB total per workspace**.
- Snippets have no Liquid version of their own.
- For snippets shared between identified and anonymous messages, always add fallbacks — anonymous in-app messages have no profile.

Random-pick-from-JSON pattern, verbatim from the docs:

```liquid
{% capture randomize %}{% random 3 %}{% endcapture %}
{% for g in snippets.random_greetings %}
{% if g.version == randomize %}{{g.greeting}}{% endif %}
{% endfor %}
```

**Layouts:** `{{content}}` marks the insertion point. `{{layout.id}}` and `{{layout.name}}` are available in code and rich-text editors only.

---

## 8. Liquid in non-body places

Customer.io's position: **"Any part of your message can contain liquid."**

| Surface | Notes |
|---|---|
| **Subject line** | Full Liquid. **HTML does not render** — a snippet with HTML shows raw code. Blank subject is a hard composer error |
| **Preheader** | Full Liquid. `{{message.preheader}}` echoes it |
| **From (name and address)** | Both accept Liquid. **From June 22, 2026:** a dynamic from-address that doesn't resolve to a **verified sending domain** marks the message `Undeliverable: from address does not belong to a verified sending domain`. Before that date it silently fell back to a Customer.io domain |
| **To** | `{{customer.name}} <{{customer.email}}>` |
| **SMS** | To: `{{customer.phone}}`. Sender ID accepts Liquid. **URL params are not auto-appended** — use `{% cio_link %}` |
| **Push** | Full Liquid in title and body. Device-token targeting can be Liquid. `{% view_in_browser_url %}` **not supported** |
| **Webhook JSON body** | Name the fields the endpoint needs: `{"id":"{{customer.id}}","email":"{{customer.email}}"}`. When a field genuinely needs to be a serialized structure, serialize it properly with `\| to_json` / `\| json` on that **named field** — never fake JSON by string-replacing over the whole `customer` object, which is not real serialization and ships every attribute on the profile, including ones nobody added when the endpoint was written. Use `strip`, `strip_newlines`, `escape`, `normalize_whitespace` to keep hand-built JSON valid |
| **In-app** | Full Liquid, including page rules (`/{{event.product_family}}/*`). **Anonymous in-app messages have no profile** — always add fallbacks |
| **WhatsApp** | Links go in template variable fields and **must** use `{% cio_link %}`. No `{% view_in_browser_url %}` |
| **URL parameter settings** | Workspace-level UTM values accept `{{campaign.name}}`, `{{message.id}}`, `{{delivery_id}}`, `{{customer.id}}`. ⚠️ These are appended to **every** link in the email, so `{{customer.id}}` leaks the identifier to every destination site, its analytics, and its referrer chain — prefer `{{delivery_id}}` |
| **Create Event / Create-or-Update Profile actions** | Liquid **or** JavaScript (V8, no network calls). **You cannot use Liquid inside the JavaScript option** — returning a snippet value containing Liquid throws an error |
| **Drag-and-drop editor** | Merge Tags for a single attribute; use the **Add Liquid** dropdown for anything with `&`, `>`, `<`, or a conditional |

---

## Sources

Customer.io: [Using Liquid](https://docs.customer.io/messaging/liquid/using-liquid/) · [Tag list](https://docs.customer.io/messaging/liquid/tag-list/) · [Recipes](https://docs.customer.io/messaging/liquid/recipes/) · [Snippets](https://docs.customer.io/messaging/liquid/snippets/) · [Upgrade Liquid](https://docs.customer.io/messaging/liquid/upgrade/) · [Timestamps FAQ](https://docs.customer.io/messaging/segmentation/faq-timestamps/) · [Timezone match](https://docs.customer.io/messaging/send/timezones/match/) · [Link tracking](https://docs.customer.io/messaging/channels/links/tracking/) · [URL parameters](https://docs.customer.io/messaging/channels/links/url-parameters/) · [Multiple from addresses](https://docs.customer.io/messaging/channels/email/headers/multiple-from-addresses/)
