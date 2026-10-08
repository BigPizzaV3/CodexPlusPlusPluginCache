# Iterable Handlebars — Helper Reference

Iterable runs **handlebars.java (jknack)**. The helpers below are the ones Iterable actually ships. Argument order matters and is not consistent between helpers — check it here rather than guessing.

## Contents

1. [Syntax primitives](#1-syntax-primitives)
2. [Fallbacks and truthiness](#2-fallbacks-and-truthiness)
3. [Conditional logic](#3-conditional-logic)
4. [Text helpers](#4-text-helpers)
5. [Math and number helpers](#5-math-and-number-helpers)
6. [Date and time helpers](#6-date-and-time-helpers)
7. [Loops and array helpers](#7-loops-and-array-helpers)
8. [Encoding and hashing](#8-encoding-and-hashing)
9. [Variables, lookup, send control](#9-variables-lookup-send-control)
10. [What Iterable does NOT support](#10-what-iterable-does-not-support)
11. [Whitespace control](#11-whitespace-control)

---

## 1. Syntax primitives

| Element | Purpose |
|---|---|
| `{{ }}` | Merge tag, HTML-escaped — **the default for every value that came from data**, URLs and product names included |
| `{{{ }}}` | Merge tag, raw — for markup you authored (snippets, your own HTML fields). Never for profile, event, catalog, feed, or webhook values. See `troubleshooting.md` §4 |
| `[ ]` | Field names with spaces/periods/leading digits; array indices |
| `[[ ]]` | Data feed values (when feed and user contexts are NOT merged) |
| `#` / `/` | Open / close a block helper |
| `.` | Nested field access |
| `' '` | String literals inside math ops, and inside double-quoted HTML attributes |
| `( )` | Subexpressions — **supported** |
| `as \|name\|` | Block parameters — **supported** |

```handlebars
{{fieldName}}                  <!-- user profile or event field -->
{{profile.fieldName}}          <!-- force the profile value over an event field -->
{{objectName.fieldName}}       <!-- nested -->
{{[First Name]}}               <!-- space in name -->
{{[1stName]}}                  <!-- leading digit -->
{{[User Signed Up.First Name]}} <!-- period in name -->
{{shoppingCartItems.[1].name}} <!-- array index, zero-based -->
{{shoppingCartItems.size}}     <!-- array length -->
```

**Precedence:** at send time, if the triggering event or API call contains a field with the same name as a profile field, the **event value wins**. Use `{{profile.fieldName}}` to force the profile value.

**Field names are case-sensitive.**

**Quote rule:** inside an HTML attribute or JSON value already wrapped in double quotes, use single quotes for string literals in the expression.

```handlebars
<img src="{{defaultIfEmpty product.imageUrl 'https://cdn.example.com/fallback.png'}}">
```

---

## 2. Fallbacks and truthiness

```handlebars
{{defaultIfEmpty fieldName "fallback value"}}
```

Argument order is `value` then `fallback`. Fires on `null`, `undefined`, and empty string. Nestable as a subexpression:

```handlebars
{{#ifEq (defaultIfEmpty selectedCity city) "New York"}}I ♥ NY{{/ifEq}}
```

**Falsy values in Iterable:** `null`, `""`, `[]`, `false`, and any zero (`0`, `0.0`). Everything else is truthy. Note that `0` being falsy bites on quantity/count fields.

Inline `yes=`/`no=` fallbacks work on the non-block comparison helpers:

```handlebars
{{eq  a b yes="Same"        no="Different"}}
{{and a b yes="Both true"   no="Not both"}}
{{or  a b yes="At least one" no="Neither"}}
{{not a   yes="False"       no="True"}}
```

---

## 3. Conditional logic

```handlebars
{{#if fieldName}}content{{else}}alternate{{/if}}
{{#if likesCats}}Cats{{else if likesDogs}}Dogs{{/if}}
{{#unless fieldName}}content{{/unless}}

{{#and a b}}…{{else}}…{{/and}}
{{#or  a b}}…{{else}}…{{/or}}
{{#not a}}…{{else}}…{{/not}}

{{#ifEq   a b}}…{{else}}…{{/ifEq}}      <!-- works for strings AND numbers -->
{{#ifGt   a b}}…{{/ifGt}}
{{#ifGte  a b}}…{{/ifGte}}
{{#ifLt   a b}}…{{/ifLt}}
{{#ifLte  a b}}…{{/ifLte}}
{{#ifModEq fieldName divisor remainder}}…{{/ifModEq}}
{{#ifContainsStr string "substring"}}…{{/ifContainsStr}}
{{#ifMatchesRegexStr fieldName "pattern"}}…{{else}}…{{/ifMatchesRegexStr}}

{{#and likesCats (gte age 18)}}Adult cat lover{{/and}}   <!-- subexpression -->
```

Naming convention: `#if`-prefixed helpers are **block-only**. Bare `eq`/`gt`/`gte`/`lt`/`lte`/`and`/`or`/`not` work as blocks *and* as inline value helpers with `yes=`/`no=`.

### Null landmines — these skip the send

- `#lt`, `lt`, `#lte`, `lte`, `#gt`, `gt`, `#gte`, `gte` referencing a **non-existent or null field** → template fails, message not sent to that user.
- `#ifContainsStr` referencing an **empty or missing field** → template fails, message not sent.

Guard with an outer `{{#if fieldName}}` or pass through `defaultIfEmpty` first.

```handlebars
{{#if lifetimeValue}}{{#ifGt lifetimeValue 500}}VIP{{/ifGt}}{{/if}}
{{#ifGt (defaultIfEmpty lifetimeValue 0) 500}}VIP{{/ifGt}}
```

`#ifEq` is safe against nulls — prefer it when you only need equality.

### Regex behaviour

- Case-**sensitive**, no modifier flags (`/i` unsupported).
- Matches the **full string** — use `.*camera.*` to match a substring.
- `{{^ifMatchesRegexStr}}` inverse block form is **not supported**; use `{{else}}` or `{{#unless}}`.

---

## 4. Text helpers

| Helper | Signature | Result |
|---|---|---|
| `length` | `{{fieldName.length}}` | Character count (property access, not a call) |
| `eq` | `{{eq a b}}` | Exact string match |
| `lt` / `gt` | `{{lt a b}}` | Alphabetical before / after |
| `capitalizeFirst` | `{{capitalizeFirst fieldName}}` | Sentence case — first word only |
| `capitalize` | `{{capitalize fieldName}}` | Title case — first letter of each word |
| `upper` | `{{upper fieldName}}` | UPPERCASE |
| `lower` | `{{lower fieldName}}` | lowercase |
| `cut` | `{{cut fieldName "text"}}` | Removes all instances of "text" |
| `replace` | `{{replace fieldName "searchFor" "replaceWith"}}` | Replaces all occurrences |
| `abbreviate` | `{{abbreviate fieldName length}}` | Truncate with ellipsis |
| `center` | `{{center fieldName size=# pad=character}}` | Pad to width |
| `slugify` | `{{slugify fieldName}}` | lowercase-hyphenated |
| `substring` | `{{substring fieldName startIndex endIndex}}` | Slice |
| `join` | `{{join arrayField ", " prefix="Start - " suffix=" - End"}}` | Array → string; `prefix`/`suffix` optional |
| `#breaklines` | `{{#breaklines}}{{fieldName}}{{/breaklines}}` | `\n` → `<br>` |

`abbreviate` is the one to reach for on product names in a constrained layout.

---

## 5. Math and number helpers

```handlebars
{{math fieldName '+' 2}}     <!-- operator is the MIDDLE arg and must be single-quoted -->
{{math fieldName '-' 2}}
{{math fieldName '*' 3}}
{{math fieldName '/' 2}}
{{math fieldName '%' 2}}
```

### numberFormat

```handlebars
{{numberFormat price "currency"}}                       <!-- 29.99 → $29.99 -->
{{numberFormat price "currency" "fr_FR"}}               <!-- → 29,99 € -->
{{numberFormat rate "percent"}}                         <!-- 0.23 → 23% -->
{{numberFormat n "integer"}}
{{numberFormat n "pattern"}}                            <!-- 1234.5678 → 1,234.57 -->
{{numberFormat n maximumFractionDigits=3}}
{{numberFormat n minimumFractionDigits=5}}
{{numberFormat n groupingUsed=true}}                    <!-- 200000000 → 200,000,000 -->
{{numberFormat n "integer" roundingMode="half_up"}}
```

`roundingMode` accepts: `up`, `down`, `ceiling`, `floor`, `half_up`, `half_down`, `half_even`.

Use `numberFormat … "currency"` for any price you display. Raw `{{price}}` prints `29.9` for a value of 29.90, which looks wrong in an inbox.

### Inline numeric comparisons

```handlebars
{{eq  a b yes="X" no="Y"}}
{{gt  a b yes="X" no="Y"}}
{{gte a b yes="X" no="Y"}}
{{lt  a b yes="X" no="Y"}}
{{lte a b yes="X" no="Y"}}
```

(Same null landmine as the block forms — see §3.)

---

## 6. Date and time helpers

**Input dates must be ISO 8601.**

```handlebars
{{dateFormat myDate format="full"}}     <!-- Tuesday, June 19, 2017 -->
{{dateFormat myDate format="long"}}     <!-- June 19, 2017 -->
{{dateFormat myDate format="medium"}}   <!-- Jun 19, 2017 -->
{{dateFormat myDate format="short"}}    <!-- 6/19/17 -->
{{dateFormat myDate "long" "de_DE"}}    <!-- positional: format, locale -->
{{dateFormat myDate format="yyyy-MM-dd HH:mm:ss Z" tz="America/Denver"}}
{{dateFormat myDate tz="userTimezoneField"}}  <!-- tz accepts a TZ code OR a field holding one -->
```

Pattern letters: `y|yy|yyyy` year · `M|MM|MMM|MMMM` month (4, 04, Apr, April) · `d|dd` day of month · `D|DD|DDD` day of year · `E|EEEE` day of week (Tue, Tuesday) · `H` hour 0–23 · `m` minute · `s` second · `z` timezone name (PST) · `Z` numeric offset.

### dateMath

Operators: `+` add, `-` subtract, `/` round. Units chain in one string: `y M w d h m s`.

```handlebars
{{dateMath dateField "+1y-1M+1w-1d+1h-1m+1s"}}
{{dateMath dateField "-5h" format="yyyy-MM-dd HH:mm:ss Z" tz="America/New_York"}}
{{dateMath "now" "-24h" format="yyyyMMddHHmmss"}}
```

### now / timestamp

```handlebars
{{now}}                   <!-- built-in merge tag: "Oct 24, 2024" -->
{{now format="yyyy"}}     <!-- current year, evaluated at send time -->
{{now format="EEEE"}}     <!-- Tuesday -->
{{timestamp}}             <!-- epoch milliseconds -->
```

### Comparing dates — the format trap

Date comparison requires a **numeric-only** format string. Any hyphen, slash, or space breaks the comparison silently. Use `yyyyMMddHHmmss`, and pin both sides to the same timezone.

```handlebars
{{#ifGte (dateFormat signupDate format="yyyyMMddHHmmss" tz="UTC")
         (dateMath "now" "-1M" format="yyyyMMddHHmmss" tz="UTC")}}
  Signed up within the last month
{{/ifGte}}
```

Days-between idiom:

```handlebars
{{dateMath myDateField (now format="-y'y'+1'y'-M'M'+1'M'-d'd'+1'd'-H'H'-m'm'-s's'" tz="UTC") format="D"}}
```

---

## 7. Loops and array helpers

```handlebars
{{#each arrayName}}
  <div>{{fieldName}}</div>
{{/each}}

{{#each shoppingCartItems}}
  {{#if @first}}First item: {{name}}{{/if}}
  {{#if @last}}Last item: {{name}}{{/if}}
  Item {{math @index '+' 1}}: {{name}}          <!-- @index is zero-based -->
{{/each}}

{{#each objectName}}
  {{@key}} = {{this}}                            <!-- iterating an object -->
{{/each}}

{{#each rows}}
  {{#ifModEq @index 2 0}}<tr class="alt">{{/ifModEq}}   <!-- zebra striping -->
{{/each}}
```

### Limiting a loop

There is no `limit` argument. Nest a comparison on `@index`:

```handlebars
{{#each recommendations}}
  {{#lt @index 4}}
    <td>{{name}}</td>
  {{/lt}}
{{/each}}
```

### Array helpers

```handlebars
{{arrayName.size}}

{{#ifContains shoppingCartItems '{"productName":"chips"}'}}Chips in cart!{{/ifContains}}

{{#minInList shoppingCartItems "price"}}Cheapest: {{price}}{{/minInList}}
{{#maxInList shoppingCartItems "price"}}Priciest: {{price}}{{/maxInList}}

{{#eq  array1 array2}}Equal{{/eq}}
{{#neq array1 array2}}Not equal{{/neq}}

{{#sortBy arrayName field="price" order="asc" as |sorted|}}
  {{#each sorted}}<div>{{name}} — {{numberFormat price "currency"}}</div>{{/each}}
{{/sortBy}}

{{#groupBy arrayName field="category" as |groups|}}
  {{#each groups as |group|}}
    <h3>{{group.key.category}} ({{group.count}})</h3>
    {{#each group.items as |product|}}<div>{{product.name}}</div>{{/each}}
  {{/each}}
{{/groupBy}}
```

`sortBy` `order` accepts `asc` / `desc`. `groupBy` groups a **maximum of 100 items** — beyond that only the first 100 are included. `#ifContains` takes a single-quoted JSON string for object matching.

---

## 8. Encoding and hashing

```handlebars
{{#urlEncode}}{{fieldName}}{{/urlEncode}}   <!-- block form only -->
{{toJson fieldName}}
{{toUrlEncodedJson fieldName}}
{{#base64}}{{fieldName}}{{/base64}}         <!-- block form only -->
{{hexEncode fieldName}}  <!-- also available as a block -->
{{md5 fieldName}}
{{sha1 fieldName}}
{{sha256 fieldName}}
{{hmacSHA1 fieldName}}    <!-- key comes from the project's HMAC secret -->
{{hmacSHA256 fieldName}}

{{#sha1}}{{userName}}@{{host}}{{/sha1}}     <!-- block form concatenates before hashing -->
```

`urlEncode` applies standard URL formatting — spaces become `+`, special characters become their ASCII escapes. Wrap **every dynamic value that lands in a query string**; escaping alone does not URL-encode.

```handlebars
https://example.com/preferences?token={{#urlEncode}}{{prefToken}}{{/urlEncode}}&campaignId={{#urlEncode}}{{campaignId}}{{/urlEncode}}
https://example.com/search?q={{#urlEncode}}{{lastSearchTerm}}{{/urlEncode}}
```

(`prefToken` is an opaque, short-lived signed token synced to the profile — put that in the URL, never the email address or user ID: URL-encoding formats an identifier but does not stop it reaching logs, analytics, history, and referrers.)

Because spaces become `+`, it is right for a query value and wrong for a path segment, where `+` stays a literal plus. `toJson` is the encoding for a value inside `<script>` or a JSON body — HTML escaping does not make a value JSON-safe, and neither does turning it off. `toUrlEncodedJson` is the URL-safe variant. Check any encoded value in Preview: a helper stacked on already-escaped output can double-encode, and Preview shows it straight away.

---

## 9. Variables, lookup, send control

```handlebars
{{#assign "myVar"}}Iterable{{/assign}}
Greetings from {{myVar}}

{{#lookup greetings language as |lang|}}{{lang.greeting_1}}{{/lookup}}
{{#lookup greetings email resolveKey=false as |row|}}…{{/lookup}}
<!-- resolveKey=false when the key itself contains periods, e.g. an email address -->

{{#ifLt creditAvailable product.price}}
  {{sendSkip cause="insufficient credit" creditAvailable=creditAvailable creditRequired=product.price}}
{{/ifLt}}
```

`{{#assign}}` is the documented way to hoist a value computed outside a loop into the loop body, since `../` parent-scope access is undocumented in Iterable (see §10).

`{{sendSkip}}` deliberately aborts the send; the event is logged with reason `SendAborted`. Use it when sending would be worse than not sending — no inventory, no valid offer, a broken feed.

---

## 10. What Iterable does NOT support

**Documented as unsupported:**

- Inverse block sections `{{^helperName}}` — use `{{else}}` or `{{#unless}}`.
- Regex modifier flags in `ifMatchesRegexStr`.
- Periods in user/event field names — Handlebars reads `.` as property access.

**Absent from all Iterable documentation — treat as unavailable and route around:**

| Standard Handlebars | Iterable substitute |
|---|---|
| `{{#with}}` | Block params: `{{#lookup … as \|x\|}}`, `{{#catalog … as \|item\|}}` |
| Partials `{{> name}}` | `{{snippet "name"}}` |
| Custom registered helpers | No mechanism — restructure or use a data feed |
| `../` parent scope | `{{#assign}}` before the loop, or block params |
| `{{#each}}…{{else}}` empty fallback | `{{#if array}}{{#each array}}…{{/each}}{{else}}…{{/if}}` |
| `{{lookup a b}}` (JS-style) | Iterable's `#lookup` is a **block** helper with different semantics |

`<!-- comment -->` is standard Handlebars and works in handlebars.java, but Iterable does not document it. In HTML template bodies the documented-safe choice is an HTML comment `<!-- … -->`, which also survives the WYSIWYG editor. Note HTML comments ship in the sent message and count toward Gmail's ~102 KB clipping threshold, so keep them short.

**Confirmed supported:** subexpressions `( )`, block params `as |x|`, `{{else if}}`.

---

## 11. Whitespace control

Whitespace — spaces, tabs, newlines — is **preserved by default**, which breaks URLs, deep links, and JSON payloads.

| Action | Syntax |
|---|---|
| Strip leading whitespace | `{{~tag}}` |
| Strip trailing whitespace | `{{tag~}}` |
| Strip both | `{{~tag~}}` |

```handlebars
<a href="{{~#if isSummerCampaign~}}https://example.com/summer?cid={{~campaignId~}}
{{~else~}}https://example.com/winter?cid={{~campaignId~}}
{{~/if~}}">Shop</a>
```

---

## Sources

Iterable Support: [Handlebars Overview](https://support.iterable.com/hc/en-us/articles/35601631606036) · [Personalizing Templates with Handlebars](https://support.iterable.com/hc/en-us/articles/205480365) · [Conditional Logic Helpers](https://support.iterable.com/hc/en-us/articles/115003884806) · [Text Helpers](https://support.iterable.com/hc/en-us/articles/36488450881044) · [Math Helpers](https://support.iterable.com/hc/en-us/articles/36282964645396) · [Date and Time Helpers](https://support.iterable.com/hc/en-us/articles/36267178160788) · [Looping Over Objects and Arrays](https://support.iterable.com/hc/en-us/articles/36531450481300) · [Encoding and Hashing Helpers](https://support.iterable.com/hc/en-us/articles/209732326) · [Regular Expressions](https://support.iterable.com/hc/en-us/articles/211728403) · [Troubleshooting Handlebars Code](https://support.iterable.com/hc/en-us/articles/36530857619348)
