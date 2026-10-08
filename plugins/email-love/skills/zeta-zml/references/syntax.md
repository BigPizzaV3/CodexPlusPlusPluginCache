# Zeta ZML — Tag and Filter Reference

ZML is *"based on the open-source template language Liquid created by Shopify."* Everything below is from Zeta's Knowledge Base. Where a construct exists in Shopify Liquid but Zeta never documents it, that is stated rather than assumed.

## Contents

1. [Delimiters](#1-delimiters)
2. [Types, truthiness, and nil](#2-types-truthiness-and-nil)
3. [Operators — and the second operator set](#3-operators--and-the-second-operator-set)
4. [Control flow](#4-control-flow)
5. [Iteration](#5-iteration)
6. [Variables: assign, capture, increment, global](#6-variables-assign-capture-increment-global)
7. [Platform tags](#7-platform-tags)
8. [Filters](#8-filters)
9. [Dates and numbers](#9-dates-and-numbers)
10. [Escaping](#10-escaping)
11. [Does not exist in ZML](#11-does-not-exist-in-zml)
12. [Whitespace and comments](#12-whitespace-and-comments)

---

## 1. Delimiters

| Construct | Delimiter | Produces output |
|---|---|---|
| Object | `{{ … }}` | Yes |
| Tag | `{% … %}` | No, with documented exceptions |
| Filter | `\|` inside `{{ }}` | Modifies the output |

```zml
{{ first_name }}                              → Ryan
{% if first_name %}Hello {{ first_name }}!{% endif %}   → Hello Ryan!
{{ first_name | default: "Valued Customer" }}
{{ "ryan!" | capitalize | prepend: "Hello " }} → Hello Ryan!
```

Filters chain left to right.

**Profile properties are referenced bare** — `{{ first_name }}`, not `{{ user.first_name }}`. That is what every example in the ZML reference section does, but the rule is never stated and one operational page contradicts it. See `references/data-sources.md` §1 before writing profile references.

**Property names cannot contain spaces**, and once created a People Property *"cannot be renamed or deleted."*

---

## 2. Types, truthiness, and nil

Five types: **String**, **Number**, **Boolean**, **Nil**, **Array**.

```zml
{% assign a_string = "Hello World!" %}     quotes → string
{% assign a_number = 25 %}                 no quotes → number
{% assign foo = true %}                    no quotes → boolean
```

*"When assigning a number to a variable, do not wrap the number in quotes or it will be considered a string."*

### Truthiness

*"All values in ZML are truthy except `nil` and `false`. Strings, even when empty, are truthy."*

| Truthy | Falsy |
|---|---|
| `true`, any string **including `""`**, `0`, any integer, any float, any array **including `[]`**, page, EmptyDrop | `nil`, `false` |

Two consequences that produce wrong output rather than errors:

- **`{% if some_string %}` is true for an empty string.** A profile property set to `""` passes the guard and then renders nothing. Compare explicitly — `{% if some_string != "" %}` — or use `| default:`, which *does* fire on empty.
- **`0` is truthy.** `{% if loyalty_points %}` is true for a member with zero points.

### Nil

*"Nil is a special empty value that is returned when the ZML code has no results. It is **not** a string with the characters 'nil'."*

```zml
Hello {{ first_name }}!     → Hello !          when first_name is nil
```

**Nil renders as nothing and nothing is logged.** No error, no raw tag, no placeholder. This is the default failure mode of the whole language: a typo in a property name is indistinguishable from a profile that genuinely lacks the property.

### Arrays

Zero-indexed, square-bracket access, `for` to iterate.

```zml
{{ subscription_preferences[0] }}
{% for preference in subscription_preferences %}{{ preference }}{% endfor %}
```

*"You cannot initialize arrays using only ZML."* Build one with `split`:

```zml
{% assign sizes = "S,M,L" | split: "," %}
```

---

## 3. Operators — and the second operator set

ZML has **two unrelated operator vocabularies** and mixing them is a common failure.

### 3a. Conditional operators — inside `{% if %}` / `{% unless %}`

| Operator | Meaning |
|---|---|
| `==` | equals |
| `!=` | does not equal |
| `>` `<` `>=` `<=` | numeric comparison |
| `or` | logical or |
| `and` | logical and |
| `contains` | substring, or membership in an array **of strings** |

These are **lowercase**, as documented.

```zml
{% if color_preference == "red" or color_preference == "blue" %}…{% endif %}
{% if recipient_email contains "@gmail.com" %}You use gmail!{% endif %}
{% if subscription_preferences contains "newsletter" %}…{% endif %}
```

*"`contains` can only search strings. You cannot use it to check for an object in an array of objects."*

Zeta's operator table does not list any grouping construct, and no documented example uses parentheses in a condition. Nest `{% if %}` blocks, or precompute with `assign`, rather than reaching for `( )`.

### 3b. Query operators — inside `{% resources %}` and `{% recommendation %}`

Completely different set, **UPPERCASE**, and the two tags do not accept the same ones.

| Operator | `{% resources %}` | `{% recommendation %}` |
|---|---|---|
| `=` | Yes | Yes |
| `NOT` | Yes | Yes |
| `CONTAINS` | Yes | Yes |
| `AFTER` | Yes | Yes |
| `BEFORE` | Yes | Yes |
| `EXISTS` | Yes | Yes (passed through) |
| `EQUAL` | **No** — not in the allowlist | Yes (passed through) |
| `OR` | **No** — not in the allowlist | Yes (passed through) |
| `BETWEEN` | **No** — silently dropped | Yes (passed through) |

> *"Operator must be UPPERCASE to pass validation: `CONTAINS`, `AFTER`, `BEFORE`, `NOT`, `EXISTS`, `=`. Lowercase like `after` will be silently dropped."*

`{% recommendation %}` performs **no operator validation at all** — *"any string passes through"* — so a typo there reaches the API instead of failing locally. Full query semantics, including the three-part filter grammar and what happens when the operator position is omitted, are in `references/data-sources.md` §3.

---

## 4. Control flow

```zml
{% if COND %} … {% elsif COND %} … {% else %} … {% endif %}
{% unless COND %} … {% endunless %}
{% case EXPR %}{% when 'a' %} … {% when 'b' %} … {% else %} … {% endcase %}
{% comment %} … {% endcomment %}
```

### `elsif` — the missing 'e' is deliberate

Zeta states it outright: *"Note the missing 'e' in `elsif`; it is intentional."*

| Written | Result |
|---|---|
| `{% elsif %}` | Correct |
| `{% elseif %}` | Wrong — not a ZML tag |
| `{% elif %}` | Wrong — not a ZML tag |

A model reaching for `elseif` or `elif` produces a template that does not do what it reads like. Check every `else`-chain in pasted code before anything else.

### `unless`

*"The opposite of `if` — executes a block of code only if a certain condition is not met."* Closes with `{% endunless %}`.

### `case` / `when`

```zml
{% assign handle = 'cake' %}
{% case handle %}
  {% when 'cake' %}This is a cake
  {% when 'cookie' %}This is a cookie
  {% else %}This is not a cake nor a cookie
{% endcase %}
```

Closes with `{% endcase %}`, not `{% endif %}`. Zeta documents one value per `{% when %}`; the comma/`or` multi-value form used by Shopify Liquid is not shown and is unverified here.

### `comment`

```zml
Anything you put between {% comment %} and {% endcomment %} tags is turned into a comment.
```

*"Any text within the opening and closing `comment` blocks will not be output, and any ZML code within will not be executed."*

**Use `{% comment %}`, not HTML comments, to disable ZML.** Zeta's own examples use `<!-- … -->` for *annotating* sample data, and its HTML editor troubleshooting section shows unresolved tags being a live problem inside HTML — nothing in the docs says an HTML comment prevents ZML inside it from executing. Treat `<!-- {% skip_message … %} -->` as live code until you have proved otherwise on your own account.

---

## 5. Iteration

```zml
{% for preference in subscription_preferences %}{{ preference }}{% endfor %}
{% for i in (1..5) %}{{ i }}{% endfor %}
{% for i in (1..num) %}{{ i }}{% endfor %}          range from a variable
{% break %}                                          stop iterating
{% continue %}                                       skip this iteration
```

### Parameters

| Parameter | Effect | Example |
|---|---|---|
| `limit:` | Cap the iteration count | `{% for item in array limit:2 %}` → `1 2` |
| `offset:` | Start at an index | `{% for item in array offset:2 %}` → `3 4 5 6` |
| `reversed` | Reverse the order — **no colon, no argument** | `{% for item in array reversed %}` → `6 5 4 3 2 1` |

Zeta flags the spelling trap itself: *"Note that the flag's spelling is different from the filter `reverse`."* The loop flag is `reversed`; the filter is `reverse`.

### `cycle` and `tablerow`

`{% cycle 'one', 'two', 'three' %}` must be used inside a `for` loop and outputs the next string on each call. `cycle` accepts a named *cycle group* when a template needs more than one. `{% tablerow %}` is listed by name, with Zeta linking to Shopify's documentation rather than documenting behaviour of its own.

### Loop limits

**Zeta documents no cap on iterations, no timeout, and no maximum array length for a `for` loop.** What it does document is a downstream ceiling: HTML over **102 KB** is clipped by some mailbox providers, *"notably Gmail."* A loop over an unbounded resource or event array is the usual way an email crosses that line. Use `limit:` on every loop whose length you do not control, and pass `count:` to the tag that fetched the array — `{% resources %}` documents a **max of 10** items as best practice.

---

## 6. Variables: assign, capture, increment, global

```zml
{% assign foo = "bar" %}                         local scope
{% capture about_me %}I am {{ age }}.{% endcapture %}    always a string
{% increment my_counter %}                       starts at 0
{% decrement my_counter %}                       starts at -1
{% global displayed = 'store' %}                 cross-component scope
```

`capture` is how you build a string from other variables — *"Using `capture`, you can create complex strings using other variables created with `assign`."*

`increment` / `decrement` live in **their own namespace**. Zeta's example: `{% assign var = 10 %}` followed by three `{% increment var %}` calls leaves `{{ var }}` as `10`. *"Variables created through the `increment` tag are independent from variables created through `assign` or `capture`."*

### `global` versus `assign` — four documented rules

`global` exists because `assign` does not cross message components. Place a `global` tag in the campaign's standalone **Global Variables** field and the variable is available in *"the subject line, preheader, content, and any other component that uses ZML in the message."*

| Rule | Detail |
|---|---|
| **Single quotes only** | `{% global displayed = 'store' %}`. Double quotes *"can produce unexpected output because the double quote may be treated as part of the stored value"*, giving output like `"store` |
| **Scope, not parsing** | *"The primary difference is scope, not how string values are parsed"* |
| **No filters** | *"the `global` tag does not evaluate filters when assigning values"*. `{% global first_name_upper = first_name \| upcase %}` stores the literal text `first_name \| upcase` |
| **Snippets in that field must use `global`** | *"The `assign` tag will not work in the other parts of the message"* |

So the fix for a filtered value that several components need is: `assign` it (or apply the filter at the output site) in each component, or store the unfiltered value globally and filter it where it is printed.

---

## 7. Platform tags

The tags below are Zeta's own, not Liquid's. Syntax here; semantics, parameters, and failure modes in `references/data-sources.md`.

```zml
{% resource product | id: sku | resource_type: 'item' %}
{% resources adrec | count: 3 | filter: 'resource-type', '=', 'article|product' %}
{% recommendation articles | count: 3 %}
{% event purchases | event_type: 'purchase' | count: 3 %}
{% feeds include: 'FeedName' %}
{% media_asset image_1 | path: '/campaign_images/12345' | name: 'funhotel' | type: 'png' %}
{% coupon my_coupon | category: 'test' %}
{% segments segment_names %}
{% skip_message message:"<user defined message>" %}
```

Two shapes to notice. Most of these take a **variable name first, then pipe-separated named options** — the pipe here is an option separator, not a filter. And `{% skip_message %}` and `{% feeds %}` do not follow that shape: they take `key:"value"` and `include: 'name'` respectively.

`{% skip_message %}` is the one with a side effect: it suppresses the message for the **person**, across every channel in the campaign, and records a Message Skipped event with `reason = custom_skip`.

---

## 8. Filters

Zeta's Filters page documents **56 entries covering 57 filter names** (`encrypt/decrypt` is one entry, two filters). Two of them — `ascii_to_hex` and `hex_to_ascii` — are listed by name with **no description, no syntax, and no example**; treat those as unverified.

### Math

`abs` · `at_least` · `at_most` · `ceil` · `divided_by` · `floor` · `minus` · `modulo` · `plus` · `round` · `times`

```zml
{{ -17 | abs }}              → 17
{{ "-19.86" | abs }}         → 19.86      works on numeric strings
{{ 4 | at_least: 5 }}        → 5          clamp to a minimum
{{ 4 | at_most: 3 }}         → 3          clamp to a maximum
{{ 183.357 | round: 2 }}     → 183.36
{{ "3.5" | ceil }}           → 4          coerces strings
```

**`divided_by` returns the type of the divisor.** `{{ 20 | divided_by: 7 }}` → `2`; `{{ 20 | divided_by: 7.0 }}` → `2.857142857142857`. You cannot append `.0` to a variable, so Zeta's documented workaround is to multiply by `1.0` first:

```zml
{% assign my_float = my_integer | times: 1.0 %}
{{ 20 | divided_by: my_float }}
```

### String

`append` · `capitalize` · `downcase` · `lstrip` · `newline_to_br` · `prepend` · `remove` · `remove_first` · `replace` · `replace_first` · `rstrip` · `size` · `slice` · `split` · `strip` · `strip_html` · `strip_newlines` · `title_case` · `truncate` · `truncatewords` · `upcase`

```zml
{{ "my great title" | capitalize }}   → My great title    first character only
{{ "my great title" | title_case }}   → My Great Title    every word
{{ "Liquid" | slice: 2, 5 }}          → quid
{{ "Liquid" | slice: -3, 2 }}         → ui                negative index counts from the end
```

**`truncate` counts the ellipsis.** *"The length of the second argument counts against the number of characters specified by the first argument."* `{{ "Ground control to Major Tom." | truncate: 20 }}` → `Ground control to...` — 17 characters plus three. Pass `""` as the second argument for a hard cut with no ellipsis. Same rule for `truncatewords`, whose first argument is a word count.

`title_case` is Zeta's own; it is not a Shopify Liquid filter.

### Array

`compact` · `concat` · `first` · `join` · `last` · `map` · `reverse` · `size` · `sort` · `sort_natural` · `uniq` · `where`

```zml
{% assign everything = fruits | concat: vegetables | concat: furniture %}
{% assign categories = site.pages | map: "category" | compact %}
{% assign kitchen = products | where: "type", "kitchen" %}
{% assign available = products | where: "available" %}      truthy-value form
{% assign new_shirt = products | where: "type", "shirt" | first %}
```

`first`, `last`, and `size` also work as **dot properties**, which is how you use them inside a tag: `{% if my_array.first == "zebra" %}`, `{% if site.pages.size > 10 %}`.

*"`reverse` cannot reverse a string."* Split it first: `{{ "…" | split: "" | reverse | join: "" }}`.

`sort` and `sort_natural` are documented with identical text and an identical example that calls `sort` in both. **Zeta's own page does not actually show what `sort_natural` does differently** — assume the Shopify meaning (case-insensitive) only after testing.

### Date and locale

`date` · `currency`

```zml
{{ article.published_at | date: "%a, %b %d, %y" }}   → Fri, Jul 17, 15
{{ "now" | date: "%Y-%m-%d %H:%M" }}                 "now" or "today"
{{ "March 14, 2016" | date: "%b %d, %y" }}           parses well-formed date strings
{{ 1000.5 | currency:2, 'fr-CA' }}                   → $1,000.50
```

`date` takes `strftime` format strings; input parsing follows *"Ruby's `Time.parse`."* `currency` takes a decimal-place count and a language/country code from a list of roughly 100, including `en-US`, `en-GB`, `fr-CA`, `de-DE`, `es-MX`, `ja`, `pt-BR`, `zh-CN`.

### Encoding, escaping, and URLs

`escape` · `escape_once` · `url_encode` · `url_decode` · `base64_encode` · `base64_decode` · `ascii_to_hex` · `hex_to_ascii`

```zml
{{ "Have you read 'James & the Giant Peach'?" | escape }}
  → Have you read &#39;James &amp; the Giant Peach&#39;?
{{ "1 &lt; 2 &amp; 3" | escape_once }}   → 1 &lt; 2 &amp; 3      does not double-escape
{{ "john@liquid.com" | url_encode }}     → john%40liquid.com
{{ "Tetsuro Takara" | url_encode }}      → Tetsuro+Takara        space becomes +
```

Note Zeta's `escape` description says it escapes *"so that the string can be used in a URL, for example"* — but its own output is **HTML entities**, not percent-encoding. It is an HTML-escaping filter. Use `url_encode` for URLs. See §10.

### Cryptographic

`sha256` · `encrypt` · `decrypt`

```zml
{{ data | sha256 }}
{{ data | encrypt: 'AES' }}
{{ data | decrypt: 'AES' }}
{{ data | encrypt: 'DES','key','mode','iv','padding' }}
```

*"This is a one-way function and cannot be reversed"* — of `sha256`. AES and DES are the two documented methods. **Never write a key into a template**; the DES argument list takes one literally, and a template is not a secret store.

### Fallback

`default`

```zml
{{ product_price | default: 2.99 }}
```

*"`default` will show its value if the left side is `nil`, `false`, or empty."* Zeta's own examples show it firing for an undefined variable and for `""`. It is the only guard that catches both nil and empty string in one expression — which matters because `{% if %}` does not (§2).

---

## 9. Dates and numbers

**System date and time objects** — all documented on the Objects page:

| Object | Value |
|---|---|
| `{{current_date}}` | Current **UTC** date, `YYYYMMDD` |
| `{{account_current_date}}` | Current date for the account, `YYYYMMDD` |
| `{{current_timestamp}}` | Unix epoch ms, UTC by definition |
| `{{account_current_timestamp}}` | Unix epoch ms in the **account timezone** |

So there are two clocks, and the UTC pair is not the one your marketer means by "today." Use the `account_current_*` pair for anything a recipient will read as a date.

**Zeta documents no per-recipient timezone filter.** There is no `time_zone`-style filter on the Filters page, and `recipient_contact.timezone` is listed as a contact property but never shown being applied to a date. Recipient-local date formatting is not a documented capability.

**Date arithmetic goes through epoch seconds.** Zeta's own `skip_message` example is the canonical pattern:

```zml
{% assign today_date = 'now' | date: '%s' %}
{% assign pre_date   = last_contacted | date: '%s' %}
{% assign diffSeconds = today_date | minus: pre_date %}
{% assign diffDays = diffSeconds | divided_by: 3600 | divided_by: 24 %}
{% if diffDays < 2 %}{% skip_message message:"Last contacted within last 2 days" %}{% endif %}
```

Both `divided_by` calls take integer divisors, so both floor. That is intentional here and a bug anywhere you wanted a fraction.

**Number formatting:** `currency` for money, `round` for precision. There is **no `number_with_delimiter` or thousands-separator filter** on Zeta's list — `currency` is the only documented way to get grouped digits, and it emits a currency symbol with them.

---

## 10. Escaping

ZML does not document an automatic output escaping policy. Assume values are inserted as-is and escape by destination:

| Where the value lands | Filter |
|---|---|
| HTML text or an attribute | `\| escape` (or `\| escape_once` if the source may already contain entities) |
| A URL path or query value | `\| url_encode` |
| Inside `<script>` or a JSON blob | **No documented filter does this.** Do not put profile, event, feed, or resource values into a script or JSON context |

`escape` emits HTML entities; `url_encode` emits percent-encoding and turns a space into `+`. Neither substitutes for the other, and neither makes a value safe for JavaScript.

Values arriving from a resource, a content feed, an event payload, or a recommendation are third-party data. `strip_html` before printing anything from those that is meant to be plain text.

---

## 11. Does not exist in ZML

**Documented as absent or impossible:**

| Construct | Reality |
|---|---|
| Array literals | *"You cannot initialize arrays using only ZML."* Use `split` |
| Filters in `{% global %}` | Stored as literal text, not evaluated |
| `contains` against an array of objects | *"`contains` can only search strings"* |
| `BETWEEN`, `EQUAL`, `OR` in `{% resources %}` | Not in the allowlist — silently dropped |
| Lowercase query operators | Silently dropped in `{% resources %}` |
| `campaign.targeted_segment_name` | *"The implementation of liquid `campaign.targeted_segment_name` is not supported"* — use `campaign.targeted_segment_id` |
| Thousands separator without a currency symbol | No such filter documented |
| Per-recipient timezone date rendering | No such filter documented |

**Reached for by habit, never documented by Zeta — do not write these:**

| Assumed | Status in ZML |
|---|---|
| `{% elseif %}` / `{% elif %}` | Neither exists. `{% elsif %}` |
| `{% include %}` / `{% render %}` | Not documented. Snippets are referenced by their platform merge tag, not included |
| `{% liquid %}` (tag-per-line block) | Not documented |
| `{% echo %}` | Not documented |
| `{% ifchanged %}` | Not documented |
| `{% abort_message %}` | Braze's tag, not Zeta's. ZML's suppression tag is `{% skip_message %}` |
| `json`, `to_json`, `jsonify` | No JSON filter of any kind on Zeta's Filters page |
| `money`, `money_with_currency` | Not documented. `currency` is the money filter |
| `pluralize`, `handleize`, `camelize` | Not documented |
| `md5`, `sha1`, `hmac_*` | Not documented. `sha256` is the only hash |
| `sum`, `find`, `find_index`, `sort_by` | Not documented |
| `date_add`, `plus: 1 day` | No date arithmetic filter. Go through `date: '%s'` and `minus` |

The pattern: ZML is a **subset** of Shopify Liquid with a handful of Zeta additions (`title_case`, `currency`, `encrypt`/`decrypt`, `sha256`, `base64_*`) and a set of platform tags. Anything a general Liquid model reaches for that is not on Zeta's Filters or Tags page should be treated as absent until proven otherwise, because the failure mode is silence.

---

## 12. Whitespace and comments

**Whitespace control is undocumented.** `{%- … -%}` and `{{- … -}}` appear nowhere in Zeta's ZML pages. Shopify Liquid supports them and ZML is derived from it, so they may work — but nothing first-party says so. Where blank lines from multi-line ZML matter, put the tags on one line rather than relying on hyphen trimming.

**Line breaks inside a tag break it.** Zeta's HTML editor troubleshooting page shows exactly this failure and calls it *"Broken Logic Tags"*:

```zml
{% if campaign_preferences_fathers_day.subsc
ription_status == "False" %}          ← wrong: the identifier is split
{% if campaign_preferences_fathers_day.subscription_status == "False" %}   ← correct
```

This is worth checking first on any template that was pasted through a word processor, a ticket, or a chat client, because the wrap is invisible in a rendered view.

**`{% raw %}`** disables tag processing for a block — *"useful for generating content (eg, Mustache, Handlebars) that uses conflicting syntax."*

---

## Sources

Zeta Knowledge Base: [Zeta Markup Language (ZML)](https://knowledgebase.zetaglobal.com/kb/zeta-markup-language-zml) · [Objects](https://knowledgebase.zetaglobal.com/kb/objects) · [Operators](https://knowledgebase.zetaglobal.com/kb/operators) · [Truthy and Falsy](https://knowledgebase.zetaglobal.com/kb/truthy-and-falsy) · [Tags](https://knowledgebase.zetaglobal.com/kb/tags) · [Types](https://knowledgebase.zetaglobal.com/kb/types) · [Filters](https://knowledgebase.zetaglobal.com/kb/filters) · [Look-Ups](https://knowledgebase.zetaglobal.com/kb/look-ups) · [Recommendations](https://knowledgebase.zetaglobal.com/kb/recommendations) · [Skip Message](https://knowledgebase.zetaglobal.com/kb/skip-message) · [Coupon Code Setup](https://knowledgebase.zetaglobal.com/kb/coupon-code-setup) · [Media Asset Tag](https://knowledgebase.zetaglobal.com/kb/media-asset-zml-tag-user-guide) · [Content Feeds](https://knowledgebase.zetaglobal.com/kb/content-feeds) · [HTML Editor](https://knowledgebase.zetaglobal.com/kb/html-editor) · [People Properties](https://knowledgebase.zetaglobal.com/kb/people-properties)
