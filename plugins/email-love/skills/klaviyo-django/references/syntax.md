# Klaviyo — Tag and Filter Reference

Klaviyo runs the **Django template language** plus a Klaviyo tag library and a set of Liquid-*named* filter aliases. Syntax rules below are verified against Klaviyo's render API where marked ✅.

## Contents

1. [Syntax rules that hard-error](#1-syntax-rules-that-hard-error)
2. [Liquid → Klaviyo translation table](#2-liquid--klaviyo-translation-table)
3. [Tags](#3-tags)
4. [Klaviyo-specific tags](#4-klaviyo-specific-tags)
5. [Filters](#5-filters)
6. [Dates](#6-dates)
7. [Escaping](#7-escaping)
8. [Tags that do NOT exist](#8-tags-that-do-not-exist)

---

## 1. Syntax rules that hard-error

**No space after a filter colon.** ✅ verified

```django
{{ person|lookup:'Name' }}      ✅
{{ person | lookup:'Name' }}    ✅  (spaces around the pipe are fine)
{{ person | lookup: 'Name' }}   ❌  HTTP 400
```

Klaviyo's own [custom objects doc](https://help.klaviyo.com/hc/en-us/articles/35146367972763) publishes the broken form. Treat it as a doc typo.

**Straight single quotes only.** `'` not `’`. Paste as plain text (Cmd/Ctrl+Shift+V) to avoid smart quotes.

**Variable names:** no spaces, no hyphens or special characters. Underscores allowed but not as the first character. Applies to row aliases, product feed names, and web feed names too.

**Everything is case-sensitive.** `first_name` ≠ `First_Name`. Event variables especially — copy them from the preview panel rather than typing them.

**Dot vs lookup:** dot notation for names with no spaces or special characters; `|lookup:'…'` when the name has a space, a `$`, or other special characters. **Once you switch to `lookup` in a chain, every later step must also use `lookup`.**

```django
{{ event.extra.line_items.0.title }}                    ✅  array index is a dot segment
{{ event|lookup:'Collection Names'|lookup:'0' }}        ✅  index as a quoted string
{{ event|lookup:'Collection Names'.0 }}                 ❌
```

---

## 2. Liquid → Klaviyo translation table

The most useful table in this file when someone arrives with Liquid habits.

| Liquid | Klaviyo (Django) |
|---|---|
| `{% elsif %}` | `{% elif %}` |
| `{% assign x = 1 %}` | `{% with x=1 %}…{% endwith %}` |
| `{% capture %}` | No equivalent. Use `{% with %}`, or `{% today "%Y-%m-%d" as today %}` style `as` binding |
| `{% unless c %}` | `{% if not c %}` |
| `{% raw %}` | `{% verbatim %}` |
| `{% for %}…{% else %}…{% endfor %}` | `{% for %}…{% empty %}…{% endfor %}` |
| `forloop.index` | `forloop.counter` (1-based) / `forloop.counter0` |
| `{{ arr.size }}` | `{{ arr\|length }}` (also `\|size`, `\|count`) |
| `{{ x \| default: 'y' }}` | `{{ x\|default:'y' }}` — **no space after the colon** |
| `{{ obj["My Key"] }}` | `{{ obj\|lookup:'My Key' }}` |
| `{% include %}` / `{% layout %}` | Not exposed |

---

## 3. Tags

Django control flow, all ✅ verified working.

```django
{% if CONDITION %} … {% elif CONDITION %} … {% else %} … {% endif %}
{% for alias in collection %} … {% empty %} … {% endfor %}
{% with name=expr %} … {% endwith %}
{% comment %} … {% endcomment %}
{% verbatim %} … {% endverbatim %}
{% spaceless %} … {% endspaceless %}
{% autoescape off %} … {% endautoescape %}
{% firstof a b 'fallback' %}
{% cycle 'a' 'b' %}
{% ifchanged x %} … {% endifchanged %}
{% widthratio value max width %}
{% templatetag openbrace %}
{% now "Y" %}
```

Unlimited `{% elif %}`, at most one `{% else %}`. `{% endif %}` required.

**`forloop` object** (all ✅ verified): `forloop.counter`, `.counter0`, `.revcounter`, `.revcounter0`, `.first`, `.last`, `.parentloop`.

**Limit a loop** with `slice` (Python slice syntax):

```django
{% for item in event.extra.line_items|slice:':3' %} … {% endfor %}
```

**Comma-separated list idiom** (from the docs):

```django
{% for item in event.grocery_list.items %}{% if not forloop.last %}{{ item.name }}, {% else %}and {{ item.name }}{% endif %}{% endfor %}
```

**Operators:** `==`, `!=`, `>`, `>=`, `<`, `<=`, `and`, `or`, `not`, `in`.

---

## 4. Klaviyo-specific tags

| Tag | Purpose |
|---|---|
| `{% unsubscribe %}` / `{% unsubscribe 'click here' %}` | Unsubscribe link. **Required on every email** |
| `{% unsubscribe_link %}` | Unsubscribe URL only |
| `{% manage_preferences %}` / `{% manage_preferences 'Click here' %}` | Preference-center link |
| `{% manage_preferences_link %}` | Preference-center URL only |
| `{% web_view %}` / `{% web_view 'Open in browser' %}` | View-in-browser link |
| `{% web_view_link %}` | View-in-browser URL only |
| `{% render_variable preview_text %}` | Render the message's preview text into the body |
| `{% current_day %}` `{% current_month %}` `{% current_year %}` | Numeric date parts |
| `{% current_weekday %}` `{% current_month_name %}` | Names — **English only** |
| `{% today "%Y-%m-%d" as today %}{{ today }}` | Today. **Both halves required** — `{{ today }}` alone renders nothing |
| `{% currency_format VARIABLE %}` | Currency symbol + correct decimals. **Numbers only** — a string like `$40` won't format |
| `{% catalog ITEM_ID %} … {% endcatalog %}` | Catalog lookup block |
| `{% has_category catalog_item "cat" as alias %}` | Category test, inside `{% catalog %}`. **Partial matches count** — "sale" matches "on-sale" |
| `{% coupon_code 'CouponName' cut=# %}` | Unique coupon code |
| `{% barcode 'value' width=200 height=100 mode=html %}` | Barcode (email, MMS, RCS, WhatsApp) |
| `{% update_property_link 'prop' 'value' 'redirect_url' %}` | Link that writes a profile property on click. **UTM parameters are not supported on these** |
| `{% customobject event.pet_id object_type_title="Pet" as pet %} … {% endcustomobject %}` | Fetch one custom object |
| `{% customobjects object_type_title="Pet Profile" as pets %} … {% endcustomobjects %}` | Fetch all records of a type |

These are **tags**, not variables. `{{ unsubscribe_link }}` renders nothing; `{% unsubscribe_link %}` is correct.

### `{% catalog %}` in full

```django
{% catalog itemID %}
  {{ catalog_item.title }}
  {{ catalog_item.description }}
  {{ catalog_item.url }}
  {{ catalog_item.featured_image.full.src }}
  {{ catalog_item.featured_image.thumbnail.src }}
  {{ catalog_item.metadata.color }}
  {% currency_format catalog_item.metadata|lookup:"price" %}
{% endcatalog %}

{% catalog itemID unpublished="cancel" %} … {% endcatalog %}

{% catalog "SKU-15" integration="api" catalog_id="1060935" %} … {% endcatalog %}
{% catalog "SKU-15" integration="api" catalog_id="1060935" language='fr' region='CA' %} … {% endcatalog %}
```

`itemID` is the **Product ID as synced**, not the SKU — though for event-driven lookups it may be either depending on the integration.

**A failed lookup skips the entire message.** `unpublished="cancel"` extends that to items that exist but are unpublished. Skips appear under Analytics → Recipient Activity → Other → *"Skipped: Catalog Item Unavailable"*.

Debug an item by dumping it: `{% catalog itemID %}{{ catalog_item }}{% endcatalog %}`

Enrich event items from the catalog:

```django
{% for item in event.Items %}
  {% catalog item.SKU %}
    <img src="{{ catalog_item.featured_image.full.src }}">
    {{ catalog_item.title }}
  {% endcatalog %}
{% endfor %}
```

---

## 5. Filters

Syntax: `{{ variable|filter:argument }}`. String args in straight single quotes; numeric args unquoted. Chain with more pipes.

### Math / numeric

| Filter | Example → Output |
|---|---|
| `abs` | `{{ -1.2\|abs }}` → `1.2` |
| `at_least` | `{{ 1\|at_least:5.0 }}` → `5.0` |
| `at_most` | `{{ 1\|at_most:-1.0 }}` → `-1.0` |
| `ceil` | `{{ 5.01\|ceil }}` → `"6.0"` |
| `floor` | `{{ 5.9\|floor }}` → `"5.0"` |
| `round` | `{{ 5.05\|round }}` → `"6.0"` |
| `round_up` / `round_down` | `{{ 5.123\|round_up:2 }}` → `"5.13"` |
| `divide` | `{{ "10"\|divide:"2" }}` → `5.0` |
| `multiply` | `{{ "10"\|multiply:"2" }}` → `20.0` (non-numeric → `0.0`) |
| `floatadd` (alias `plus`) | `{{ 1\|floatadd:1.1 }}` → `2.1` |
| `floatsub` (alias `minus`) | `{{ 1.1\|floatsub:1 }}` → `0.1` |
| `modulo` / `remainder` | `{{ 5\|remainder:2 }}` → `1.0` |
| `floatformat` | `{{ "5.0003"\|floatformat:2 }}` |
| `percentize` | `{{ ".25"\|percentize:2 }}` → `25.00%` |
| `sum_list` | `{{ [1,2,3]\|sum_list }}` → `6.0` |
| `gt` `gte` `lt` `lte` | `{{ 3\|gt:2 }}` → `true` |

**Coerce text-stored numbers before comparing:** `{{ person.Age|multiply:"1" }}`.

### String

`append:' world'` · `prepend:'world '` · `concat:'x'` · `capitalize` (alias `capfirst`) · `downcase` (alias `lower`) · `upcase` (alias `upper`) · `title` · `truncate:5` (default 50, adds ellipsis) · `truncatechars:10` · `strip` · `lstrip` · `rstrip` · `strip_html` (alias `striptags`) · `strip_newlines` · `newline_to_br` (alias `linebreaksbr`) · `remove:'hello'` · `remove_first` · `remove_last` · `replace_first` · `replace_last` · `split:","` · `resplit:'\s+'` (regex) · `escape` · `escape_once` · `urlencode` / `urlencodeplus` / `urldecode` / `urldecodeplus` · `base64_encode` / `base64_decode` · `md5_hash` / `sha_1` / `sha_256` · `httpize` / `httpsize` / `trim_slash` · `stringformat` · `yesno:'a,b,c'` · `pluralize`

**`find_replace` has an unusual argument shape** — one string with an internal pipe:

```django
{{ "Hi, there,"|find_replace:",|-" }}   →  Hi- there-
```

Same for `replace_first` and `replace_last`.

### List / array

`count` / `length` / `size` (aliases) · `compact` (drops nulls) · `concat:[4,5,6]` · `join:" & "` · `list_to_string` (→ `apple, banana and orange`) · `list_where:"name=a"` · `dictfilter:"a>2"` (operators `< <= == != => >`) · `map:"name"` · `reverse` · `slice:":2"` · `sort` / `sort:"name"` · `sort_natural` (case-insensitive; not for numbers) · `uniq` / `uniq:"name"`

### Other

`default:'x'` · `lookup:'key'` · `safe` · `missing_image` · `missing_product_image`

Beyond the glossary, **most Django built-in filters work** (`add`, `slice`, `date`, `linebreaksbr`, `urlencode`, …). If unsure, test-render before shipping.

---

## 6. Dates

**Event timestamps arrive as ISO 8601 strings and must be parsed before formatting.** The canonical recipe:

```django
{{ your_variable|format_date_string|date:'F d, o' }}
```

`2016-02-11T16:46:08-05:00` → `February 11, 2016`

| Pattern | Output |
|---|---|
| `'F d, o'` | February 26, 2016 |
| `'d F o'` | 26 February 2016 |
| `'m-d-Y'` | 02-26-2016 |
| `'n/j/y'` | 2/26/16 (no leading zeros) |
| `'M d'` | Feb 11 |
| `'m-d-Y g:i a'` | 02-26-2016 4:46 p.m. |
| `'m-d-Y g:i A'` | 02-26-2016 4:46 PM |

Other date filters: `datetime_from_string` · `days_later:5` · `weeks_since` / `weeks_since:"2025-04-21"` (UTC assumed if no timezone given)

Today plus an offset — note `{% today %}` requires the `as` binding:

```django
{% today "%Y-%m-%d" as today %}{{ today }}
{% today '%Y-%m-%d' as today %}{{ today|days_later:5|format_date_string|date:'M d' }}
```

### Timezones — the honest limitation

`{% today %}` and `{% current_* %}` use the **account** timezone (Settings → Organization). Event timestamps render in UTC. **There is no per-recipient timezone conversion filter.** `{{ person|lookup:"$timezone" }}` exposes the recipient's timezone as data, but nothing converts a date with it.

If someone asks for "in their local time," the answer is that Klaviyo can't do it in-template.

---

## 7. Escaping

**Autoescaping is ON by default.** ✅ verified: a value of `<b>bold</b> & "quote"` renders as `&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quote&quot;`. A URL `https://x.com/?a=1&b=2` renders `?a=1&amp;b=2`.

Inside an `href` that's harmless — browsers decode it, so it needs no fix. It breaks:

- inside `<script>`
- inside JSON
- when the URL is concatenated in a non-HTML context

`{{ url|safe }}` and `{% autoescape off %}{{ url }}{% endautoescape %}` (both ✅ verified to disable escaping) are **not** the fix for those contexts: they only turn HTML escaping off — they do not JSON- or JavaScript-encode anything, and Klaviyo's filter glossary documents no filter that does. Untrusted dynamic values (profile, event, feed, webhook data) must not be interpolated into inline `<script>` or JSON at all — assemble them upstream as structured, validated fields in the event payload or profile. Reserve `|safe` / `{% autoescape off %}` for markup you wrote and control yourself.

---

## 8. Tags that do NOT exist

Commonly assumed, absent from all Klaviyo documentation. Do not write these:

| Not real | What to use instead |
|---|---|
| `{% elsif %}` | `{% elif %}` — the Liquid form is a hard error |
| `{% assign %}` | `{% with x=y %}…{% endwith %}` — hard error |
| `{% capture %}` | `{% with %}` or an `as` binding |
| `{% media %}` | Image block → *Dynamic variable or dynamic URL*, or `{% barcode … mode=html %}` |
| `{% trending_products %}` | Product feeds + Product block (UI, not a tag) |
| `{% recommended_products %}` | Same — Product feeds + Product block |
| `{{ unsubscribe_link }}` | `{% unsubscribe_link %}` — it's a tag |
| `{{ arr.size }}` | `{{ arr\|length }}` |

`{% load … %}` is internal — it appears in Klaviyo product-block output and surfaces in Shopify export errors. Don't hand-write it.

**Shopify notification templates authored in Klaviyo are a different case.** Those are rendered by *Shopify's* real Liquid, which is why Klaviyo's error docs list genuine Liquid errors like `Unknown tag 'elsif'`. Shopify does not support Klaviyo's `{% unsubscribe %}`, `{% manage_preferences %}`, or `{% web_view %}`.

---

## Sources

Klaviyo: [Message design overview (Django)](https://developers.klaviyo.com/en/docs/django_message_design) · [Message personalization reference](https://help.klaviyo.com/hc/en-us/articles/4408802648731) · [Glossary of variable filters](https://help.klaviyo.com/hc/en-us/articles/360058466052) · [How to use filters to customize variables](https://help.klaviyo.com/hc/en-us/articles/360058907911) · [Use conditionals in messages](https://developers.klaviyo.com/en/docs/use_conditionals_in_messages) · [Catalog lookup tag reference](https://help.klaviyo.com/hc/en-us/articles/360004785571) · [Date personalization reference](https://help.klaviyo.com/hc/en-us/articles/115005257788) · [Barcodes](https://help.klaviyo.com/hc/en-us/articles/48971655463067) · [Custom objects in templates](https://help.klaviyo.com/hc/en-us/articles/35146367972763)
