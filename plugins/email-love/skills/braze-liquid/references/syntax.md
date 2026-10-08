# Braze Liquid — Tag and Filter Reference

Braze supports Shopify Liquid up to Liquid 5, minus specific pieces, plus its own `${...}` variable syntax and custom tags.

## Contents

1. [Variable syntax](#1-variable-syntax)
2. [Where operators and filters are allowed](#2-where-operators-and-filters-are-allowed)
3. [Tags](#3-tags)
4. [Braze-specific tags](#4-braze-specific-tags)
5. [Filters](#5-filters)
6. [Defaults and truthiness](#6-defaults-and-truthiness)
7. [Not supported](#7-not-supported)
8. [Whitespace control](#8-whitespace-control)

---

## 1. Variable syntax

The rule: `{{`, then `namespace.` (optional), then `${name}`, then `}}`.

```liquid
{{${first_name}}}                              standard attribute — no namespace
{{custom_attribute.${plan}}}                   custom attribute
{{custom_attribute.${zip code}}}               spaces are allowed inside ${}
{{event_properties.${item_count}}}             custom event property
{{context.${cart_id}}}                         Canvas entry property
{{api_trigger_properties.${order_id}}}         API-triggered campaign
{{campaign.${name}}}                           campaign metadata
{{content_blocks.${footer}}}                   Content Block
```

Nested paths and array indices go **outside** the `${}`:

```liquid
{{custom_attribute.${most_played_song}[0].artist_name}}
{{custom_attribute.${most_played_song}[0].play_analytics.count}}
{{event_properties.${songs}[0].album.name}}
{{context.${order_summary}.shipping.carrier}}
```

Both `{{custom_attribute.${address.city}}}` (path inside) and `{{custom_attribute.${address}.city}}` (path outside) appear in Braze's docs and both work.

**API trigger properties nest with a second `${}`:**

```liquid
{{api_trigger_properties.${details}.${color}}}
{{api_trigger_properties.${related_skus}[0]}}
```

### The double-brace exception

Inside another Liquid tag, the inner `{{ }}` is **optional**. All four documented forms are valid:

```liquid
{% if custom_attribute.${Games_Attended} == 1 %}
{% if {{custom_attribute.${Games_Attended}}} == 1 %}
{% assign one = {{custom_attribute.${one}}} %}
{% assign one = custom_attribute.${one} %}
```

But **do not wrap a filtered expression in an extra pair** — that produces `Unexpected end token`:

```liquid
{{custom_attribute.${date_of_birth} | date: '%s'}}      ✅
{{{custom_attribute.${date_of_birth}} | date: '%s'}}    ❌
```

**Triple braces are never valid Braze syntax.** Braze calls this out specifically for API trigger properties: *"Triple braces (for example `{{{...}}}`) are not valid Braze personalization syntax."*

### Naming rules

- Attribute names inside `${}` may contain spaces and non-ASCII characters.
- Liquid variable names created by `assign`/`capture` are **ASCII letters, digits, and underscores only**.
- Attribute keys are **case-sensitive**. API and SDK strip leading/trailing spaces from names; **dashboard-created names do not auto-trim** — a documented cause of duplicate-looking attributes.
- Avoid naming a variable after a personalization tag (`language`, etc.) — it will shadow it.

---

## 2. Where operators and filters are allowed

This is Braze's most distinctive restriction and the highest-frequency source of bugs.

| Context | Operators | Filters |
|---|---|---|
| `{% assign %}` | ❌ | ✅ |
| `{% if %}` `{% elsif %}` `{% unless %}` | ✅ | ❌ |
| `{% case %}` `{% when %}` | equality only | ❌ |
| `{% for %}` | ❌ | ❌ |
| Array access `[ ]` | ❌ | ❌ |

```liquid
{% if my_array | size > 3 %}                    ❌
{% assign n = my_array | size %}{% if n > 3 %}  ✅

{% assign is_vip = total_spend > 100 %}         ❌ (operator in assign)

{% for item in my_array | reverse %}            ❌
{{ my_array[my_var | minus: 1] }}               ❌
```

**Supported operators:** `==` `!=` `>` `<` `>=` `<=` `or` `and` `contains`

`&&` appears in one official Braze code example but is absent from the operator table. Prefer `and`.

**No parentheses.** *"Parentheses are invalid characters in Liquid and prevent your tags from working."* Rewrite `(a and b) or c` as nested `{% if %}` blocks or intermediate variables.

**You cannot reference two custom attributes in one expression:**

```liquid
{{custom_attribute.${rewards} | plus: {{custom_attribute.${giftcard}}}}}   ❌

{% assign balance = {{custom_attribute.${rewards}}} %}
{{custom_attribute.${giftcard} | plus: {{balance}}}}                        ✅
```

---

## 3. Tags

### Control flow

```liquid
{% if COND %} … {% elsif COND %} … {% else %} … {% endif %}
{% unless COND %} … {% endunless %}
{% case EXPR %}{% when 'a' %} … {% when 'b' or 'c' %} … {% else %} … {% endcase %}
```

`case`/`when` is **equality only** — no operators, no filters. Multiple values per `when` separated by comma or `or`. **Match the data type**: `{% when 'es' %}` for a string, `{% when 2 %}` for a number. Close with `{% endcase %}`, not `{% endif %}`.

### Iteration

```liquid
{% for item in ARRAY %} … {% endfor %}
{% for item in {{custom_attribute.${Brands Viewed}}} limit: 5 %} … {% endfor %}
{% for i in (0..5) %} … {% endfor %}
{% break %}
```

`{% continue %}`, `{% cycle %}`, `{% tablerow %}` are **not documented** by Braze either way. Test before relying on them.

### Variables

```liquid
{% assign var = value %}
{% capture var %} … block … {% endcapture %}
```

`assign` holds a single value plus at most one filter chain. `capture` holds a block — Braze recommends it for Connected Content bodies and complex URLs.

**Single-quoted strings in `assign` are literal.** Liquid inside them is NOT interpolated:

```liquid
{% assign intro = 'My name is {{${first_name}}}' %}
{{ intro }}
```

outputs the raw text `My name is {{${first_name}}}`. Use `capture`, or `append`.

### Misc

```liquid
{% comment %} … {% endcomment %}
{% echo EXPR %}
{% liquid %}          one tag per line, no delimiters
{% random %}          float in [0,1)
{% random 10 %}       integer 0..9
```

`{% random %}` must be captured and coerced:

```liquid
{% capture roll_str %}{% random %}{% endcapture %}
{% assign roll = roll_str | plus: 0 %}
{% if roll < 0.5 %}Variant A{% else %}Variant B{% endif %}
```

---

## 4. Braze-specific tags

```liquid
{% abort_message %}
{% abort_message() %}
{% abort_message('static reason string') %}

{% connected_content URL
     :method post
     :headers { "Content-Type": "application/json" }
     :body key1=value1&key2=value2
     :content_type application/json
     :basic_auth credential_name
     :auth_credentials token_name
     :cache_max_age 900
     :no_cache
     :retry
     :save variable_name %}

{% catalog_items CATALOG_NAME ID [ID2 ID3] [:rerender] %}
{% catalog_selection_items CATALOG_NAME SELECTION_NAME %}
{% shopping_cart CART_ID :abort_if_not_abandoned false %}
{% message_extras :key KEY :value VALUE %}
{% promotion('list-name') %}
```

Content Blocks use **output syntax**, not a tag: `{{content_blocks.${name}}}`

### `abort_message`

Braze's only abort mechanism. Single or double quotes both work. **The reason must be a static string — Liquid inside it is not supported.**

Behavior: no send, no user-profile record, no delivery count, no frequency-cap consumption, not counted in Currents sends. In a Canvas, an aborted Message step does **not** exit the user.

Evaluation timing: push, email, SMS, webhooks, Content Cards at **send time**; in-app messages at **trigger time** on the device, since IAMs are cached at session start.

Message Activity Log shows `{% abort_message %} called`, or the exact snippet with your reason string.

---

## 5. Filters

Syntax: `{{ value | filter: arg }}`, applied left to right. `{{ "Big Sale" | upcase | remove: "BIG" }}` → `SALE`.

### Array

Supported: `join` `first` `last` `compact` `concat` `map` `reverse` `size` `slice` `sort` `sort_natural` `uniq` `where`

**Not supported:** `find_index`

### Math

Supported: `abs` `at_most` `at_least` `ceil` `divided_by` `floor` `minus` `plus` `round` `times` `modulo`

Integer division rounds down: `{{15 | divided_by: 2}}` → `7`; `{{15 | divided_by: 2.0}}` → `7.5`.

### Money — differs from Shopify

| Filter | Braze |
|---|---|
| `money` | ✅ **but no implicit /100.** `145 \| money` → `$145.00` (Shopify would give `$1.45`) |
| `money_with_currency` | ❌ |
| `money_without_currency` | ❌ |

If your values are in cents: `| divided_by: 100.00 | money`. Strip commas and coerce first for string-typed values:

```liquid
{% assign n = "350000.25" | plus: 0 %}
{{ n | money }}
```

### String

Supported: `append` `capitalize` `downcase` `escape` `md5` `sha1` `hmac_sha1_hex` `hmac_sha256` `hmac_sha512` `newline_to_br` `prepend` `remove` `remove_first` `replace` `replace_first` `slice` `split` `strip` `strip_html` `strip_newlines` `truncate` `truncatewords` `upcase`

**Not supported:** `camelize` `handleize` `pluralize` `lstrip` `rstrip` `format_address` `highlight`

**All color filters and all font filters are unsupported.**

### Encoding and hashing

| Filter | Example | Output |
|---|---|---|
| `md5` | `{{'hey' \| md5}}` | `6057f13c496ecf7fd777ceb9e79ae285` |
| `sha1` | `{{'hey' \| sha1}}` | `7f550a9f4c44173a37664d938f1355f0f92a47a7` |
| `sha2` | `{{'hey' \| sha2}}` | SHA-256 hex |
| `base64_encode` | `{{'blah' \| base64_encode}}` | `YmxhaA==` |
| `hmac_sha1_hex` | `{{'hey' \| hmac_sha1_hex: 'key'}}` | hex digest |
| `hmac_sha1_base64` | `{{'hey' \| hmac_sha1_base64: 'key'}}` | base64 digest |
| `hmac_sha256_hex` / `hmac_sha256_base64` | same shape | |

### URL

| Filter | Example | Output |
|---|---|---|
| `url_escape` | `{{'hey<>hi' \| url_escape}}` | `hey%3C%3Ehi` |
| `url_param_escape` | `{{'hey<&>hi' \| url_param_escape}}` | `hey%3C%26%3Ehi` (escapes `&` too) |
| `url_encode` | `{{'google search' \| url_encode}}` | `google+search` |

**Campaign names in URLs must be encoded** — they can contain spaces, `%`, and `&`:

```liquid
https://example.com/?utm_campaign={{ campaign.${name} | url_encode }}
```

### JSON — note there is no `to_json`

| Filter | Purpose |
|---|---|
| `json_escape` | Escape a string for a JSON value. *"Should always be used when personalizing a string in a JSON dictionary"* — webhooks especially |
| `json_parse` | JSON string → object/array |
| `as_json_string` | Object/array → JSON string. **This is Braze's `to_json`** |

```liquid
{% assign s = '[{"id":"1","store":"demo"}]' %}
{% assign data = s | json_parse %}
{% for item in data %}{{ item.id }}{% endfor %}
{{ context.${object_array} | as_json_string }}
```

### Other

`date` ✅ · `default` ✅ · `number_with_delimiter` (`{{123456 | number_with_delimiter}}` → `123,456`) · `property_accessor`

```liquid
{{ hash | property_accessor: 'a' }}     hash {"a" => 42} → 42
```

*"There is no way to instantiate a hash as a variable in Liquid within Braze"* — `property_accessor` only works on hashes you received from Connected Content, catalogs, or profile data.

### Date and time

```liquid
{{custom_attribute.${date_attribute} | date: '%b %d'}}
{{custom_attribute.${date_attribute} | date: '%s'}}       Unix time — Braze extension
{% assign hour_utc = 'now' | date: '%H' | plus: 0 %}
```

`'now'` is the current UTC timestamp. **Everything renders in UTC by default.**

**`time_zone` must come before `date`:**

```liquid
{% assign local = 'now' | time_zone:{{${time_zone}}} | date: '%B %e, %Y' %}
{{custom_attribute.${expires} | time_zone: 'America/Chicago' | date: '%B %d %Y %z' }}
{{context.${appointment} | time_zone: "America/Los_Angeles" | date: "%Y-%m-%d %l:%M %p"}}
```

The argument accepts a tz database name or a numeric offset, quoted or unquoted, with or without inner braces. Note `time_zone` is documented only in Braze's use-case library and Context step pages, not on the filter reference.

---

## 6. Defaults and truthiness

```liquid
{{ ${first_name} | default: 'Valued User' }}
{{ custom_attribute.${address.city} | default: 'Unknown' }}
```

**No default + missing field = blank string.** Braze does not error or print the raw tag.

**`default` fires on `empty`, `nil`/undefined, and `false`.** It works on strings, booleans, arrays, objects, and numbers.

**The critical caveat:** *"The default value will show for empty values, but not for blank values."*

- **Empty** = `""` → `default` fires
- **Blank** = `" "` (whitespace only) → `default` does **not** fire

Braze separately defines `blank` for `if` comparisons as "not set, set with a whitespace string, or set as `false`", and recommends checking blank **before** other variables.

```liquid
{% if ${first_name} == null %}
{% if ${first_name} == blank %}
{% if {{custom_attribute.${upcoming_trips}}} == empty %}
```

Braze's own recommended alternative to a default is a conditional plus an abort — for personalization-critical content, not sending beats sending something wrong:

```liquid
{% if {{custom_attribute.${balance}}} > 0 %}
  Your balance is {{custom_attribute.${balance}}}
{% else %}
  {% abort_message('no balance to report') %}
{% endif %}
```

---

## 7. Not supported

**Explicitly unsupported:**

- All **color filters** and all **font filters**
- Filters: `find_index` `money_with_currency` `money_without_currency` `camelize` `handleize` `pluralize` `lstrip` `rstrip` `format_address` `highlight`
- **Parentheses** for grouping in conditionals
- **Arrays of arrays.** *"Store values as an array of comma-separated strings and use the `split` filter"*
- **Hash literals** — no way to instantiate a hash inline
- Two custom attributes in one expression
- Operators in `assign`; filters in `if`/`elsif`/`unless`/`case`/`when`/`for`/`[ ]`
- Liquid inside `abort_message()`
- Liquid interpolation inside single-quoted `assign` strings
- Nested Liquid tags inside `message_extras`
- `:rerender` on Banners; `:retry` on in-app messages
- Cross-field variable persistence (subject / body / preheader render separately)

**Does not exist in Braze despite being widely assumed:**

| Assumed | Reality |
|---|---|
| `{% cancel_message %}` | **No such tag.** `abort_message` is the only abort mechanism |
| `to_json` | Use `as_json_string` |
| `{% response_cache %}` | Caching is via `:cache_max_age` / `:no_cache` arguments |
| `{% audio %}` | Not documented |

**Undocumented, neither supported nor forbidden** — test before relying on: `{% raw %}` · `{% continue %}` · `{% cycle %}` · `{% tablerow %}` · `{% increment %}` / `{% decrement %}` · `{{- … -}}` output-tag whitespace control.

---

## 8. Whitespace control

Supported on **tag** delimiters, documented form:

```liquid
{%- assign event_date = {{custom_attribute.${PickupDate}}} | date: "%s" -%}
{%- assign today = 'now' | date: "%s" -%}
{%- assign difference = event_date | minus: today -%}
Only {{ difference }} days to go!
```

`{{- … -}}` on **output** tags is never shown in Braze's docs. Liquid 5 whitespace control is claimed generally, so it likely works — unverified.

Braze's alternative recommendation: put all the Liquid on one continuous line.

This matters most in drag-and-drop editors, where multi-line Liquid renders as visible blank lines.

---

## Sources

Braze: [Liquid reference](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid) · [Use Liquid](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/using_liquid) · [Supported personalization tags](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/supported_personalization_tags) · [Operators](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/operators) · [Filters](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/filters) · [Advanced filters](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/advanced_filters) · [Set default values](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/setting_default_values) · [Conditional logic](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/conditional_logic) · [Abort messages](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/aborting_messages) · [Liquid FAQ](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/faq)
