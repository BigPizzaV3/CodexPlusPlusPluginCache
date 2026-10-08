# HubL — Tag, Filter, and Function Reference

HubL is Jinjava: *"HubSpot's extension of Jinjava, a templating engine based on Jinja."* Jinja-shaped syntax, HubSpot-named filters, and a set of tags that exist nowhere else. HubSpot's own caveat — *"HubL uses a fair amount of markup that is unique to HubSpot and does not support all features of Jinja"* — is the honest summary, and HubSpot does not publish the list of what it drops.

## Contents

1. [Delimiters and comments](#1-delimiters-and-comments)
2. [Control flow](#2-control-flow)
3. [Loops](#3-loops)
4. [Variables, scope, and macros](#4-variables-scope-and-macros)
5. [Operators](#5-operators)
6. [Expression tests](#6-expression-tests)
7. [Filters](#7-filters)
8. [Functions](#8-functions)
9. [Escaping, `raw`, and dynamic evaluation](#9-escaping-raw-and-dynamic-evaluation)
10. [Whitespace control](#10-whitespace-control)
11. [Email-only restrictions](#11-email-only-restrictions)
12. [Does not exist in HubL](#12-does-not-exist-in-hubl)

---

## 1. Delimiters and comments

Three delimiters, and only three:

| Delimiter | Purpose |
|---|---|
| `{% … %}` | **Statements.** Logic, loops, variables, modules. Produce no output of their own |
| `{{ … }}` | **Expressions.** Print a value |
| `{# … #}` | **Comments.** Not rendered |

```hubl
{# this never reaches the recipient #}
{% set greeting = "Hello" %}
{{ greeting }}
```

**An HTML comment is not a HubL comment.** `<!-- {{ contact.firstname }} -->` is ordinary markup: it ships inside the email's HTML, and nothing in HubSpot's documentation says the HubL inside one is skipped. To disable code, use `{# #}`. To ship literal braces, use `{% raw %}`.

There is also a `{% do %}` statement, documented on the syntax overview for expressions evaluated for their side effect rather than their output.

---

## 2. Control flow

### if / elif / else

```hubl
{% if number <= 2 %}
  less than or equal to 2
{% elif number <= 4 %}
  less than or equal to 4
{% else %}
  greater than 4
{% endif %}
```

**It is `elif`.** Not `elsif` (that is Liquid), not `elseif` (that is nothing). This is the highest-frequency cross-platform typo in HubL and it is a hard error, not a silent one.

Multiple `elif` branches are allowed; exactly one `else`.

### unless

```hubl
{% unless widget_data.my_content.html %}
  <h1>This page is under construction.</h1>
{% endunless %}
```

Inverse of `if`, closed with `{% endunless %}`. Accepts `else`. **Does not accept `elif`.**

### Inline conditionals and the ternary

```hubl
{% set color = "Blue" if is_blue is truthy else "Red" %}
{{ "Blue" if is_blue is truthy else "Red" }}

{{ is_blue is truthy ? "blue" : "red" }}
{% set is_red = is_blue is truthy ? false : true %}
```

A one-armed inline `if` is also valid inside an attribute: `<a href="…" {{ "download" if dl }}>`.

### There is no `case` / `when`

HubL has no switch construct. Chain `elif`, or use the `in` operator against a list.

---

## 3. Loops

```hubl
{% for item in items %}
  {{ item }}
{% endfor %}
```

Loops nest; the inner loop runs once per outer iteration.

### Loop variables

| Variable | Meaning |
|---|---|
| `loop.index` | *"The current iteration of the loop. This variable starts counting at 1."* |
| `loop.index0` | Same, starting at 0 |
| `loop.revindex` | Iterations remaining, counting down to 1 |
| `loop.revindex0` | Iterations remaining, counting down to 0 |
| `loop.first` | *"true, if it is the first iteration"* |
| `loop.last` | *"true, if it is the last iteration"* |
| `loop.length` | *"The number of items in the sequence."* |
| `loop.depth` | Recursion depth, starting at 1 |
| `loop.depth0` | Recursion depth, starting at 0 |
| `loop.cycle` | *"A helper function to cycle between a list of sequences"* |

`loop.first` and `loop.last` are the clean way to handle separators and closing table rows in email markup without arithmetic.

### The scope rule

> *"Any variables defined within loops are limited to the scope of that loop and cannot be called from outside of the loop."*

Variables set **outside** a loop are readable inside it. Variables set **inside** are gone after `{% endfor %}`. So the accumulator pattern every other language teaches does not work:

```hubl
{% set total = 0 %}
{% for line in order.results %}
  {% set total = total + line.amount %}   {# lost at endfor #}
{% endfor %}
{{ total }}                                {# prints 0 #}
```

Do it with a filter on the collection instead — `{{ order.results|sum(attribute="amount") }}`, `{{ order.results|length }}`, `{{ order.results|selectattr("status","equalto","open")|list|length }}`.

**`{% break %}` and `{% continue %}` are not documented by HubSpot either way.** They are not on the loops page. Do not rely on them in an email; restructure with a filtered collection or an `{% if %}` inside the loop body.

---

## 4. Variables, scope, and macros

```hubl
{% set my_variable = "A string value" %}
{{ my_variable }}
```

Variable names are single words or underscore-separated. **Hyphens are not supported.**

At template top level a `{% set %}` stays in scope for the rest of that template render — including markup that appears later in the document, which is why a declaration placed in a template's head is still readable in its body. Only loops (and macro bodies) create a narrower scope.

### Macros

```hubl
{% macro name(arg1, arg2) %}
  {{ arg1 }} {{ arg2 }}
{% endmacro %}
```

Macros nest **20 levels deep** before HubSpot raises an error.

Reuse across files:

- `{% import %}` — imports all macros from a file, namespaced
- `{% from %}` — imports named macros only

Call blocks pass a body into a macro:

```hubl
{% call my_macro() %}
  block content
{% endcall %}
```

with `{{ caller() }}` inside the macro body.

### Template composition

`{% include %}`, `{% extends %}` and `{% block %}` are documented for template inheritance and partials. In email work they matter mostly for shared footers; a coded email template is usually one file.

---

## 5. Operators

**Math:** `+` `-` `*` `/` `%` (remainder) `//` (floor division) `**` (exponent)

**Comparison:** `==` / `eq` · `!=` / `ne` · `>` / `gt` · `>=` / `gte` · `<` / `lt` · `<=` / `lte`

Both spellings are documented — `{% if a gte b %}` and `{% if a >= b %}` are the same thing. Prefer the symbols; the word forms read like Liquid and confuse reviewers.

**Logical:** `and` · `or` · `not` · `is` · `(expr)` grouping · `?` ternary

**Other:** `in` (membership in a sequence) · `~` (string and list concatenation) · `|` (filter)

Two things that surprise people:

**`and` returns a boolean.** HubSpot states it *"does not behave like the `and` operator in Python or the `&&` operator in JavaScript"* — it yields `true`/`false`, never one of the operands. `or` does return the first truthy operand.

**Parentheses work.** Unlike some ESP template languages, `(a and b) or c` is valid and documented.

Concatenation is `~`, not `+`:

```hubl
{% set query = "price__lte=" ~ contact.budget_max ~ "&limit=3" %}
```

---

## 6. Expression tests

Used with `is` (and negated with `is not`):

`boolean` · `containing` · `containingall` · `defined` · `divisibleby` · `equalto` · `even` · `float` · `integer` · `iterable` · `lower` · `mapping` · `none` · `number` · `odd` · `sameas` · `sequence` · `string` · `string_containing` · `string_startingwith` · `truthy` · `undefined` · `upper` · `within`

```hubl
{% if contact.firstname is string_startingwith "Dr" %}…{% endif %}
{% if listings.results is iterable %}…{% endif %}
{% if promo_code is not defined %}…{% endif %}
```

`defined` versus `truthy` is the distinction that matters in email: a property that exists but is empty is `defined` and not `truthy`.

---

## 7. Filters

Syntax is Jinja's: `{{ value|filter(arg) }}`, chained left to right. HubSpot documents roughly ninety filters. The ones that come up in email:

### Strings and HTML

| Filter | Notes |
|---|---|
| `upper` / `lower` | Not `upcase` / `downcase` |
| `title` / `capitalize` | |
| `trim` | |
| `replace` / `regex_replace` | |
| `truncate` | *"Cuts off text after a certain number of characters"* |
| `truncatehtml` | *"Truncates a given string, respecting HTML markup"* — the safe one inside a designed email |
| `striptags` | *"Strips SGML/XML tags and replaces adjacent whitespace by one space"* |
| `wordcount` / `wordwrap` | |
| `split` / `join` | |
| `urlize` | Turns bare URLs into links |
| `format` / `indent` / `center` / `pprint` | |

### Numbers, dates, and money

| Filter | Notes |
|---|---|
| `int` / `float` / `round` / `abs` | |
| `add` / `minus_time` / `plus_time` / `multiply` / `divide` | |
| `format_number` | |
| `format_currency_value` | `format_currency` is **deprecated** |
| `format_datetime` | `{{ value\|format_datetime('medium', 'America/New_York', 'en-US') }}` — format is `short`/`medium`/`long`/`full` or a Unicode LDML pattern |
| `format_date` / `format_time` | Date-only and time-only variants |
| `datetimeformat` | **Deprecated.** `format_datetime` replaces it, *"has a more standardized syntax"* |
| `strtodate` / `strtotime` / `unixtimestamp` / `between_times` | |

### Collections

`length` · `first` · `last` · `sort` · `reverse` · `unique` · `shuffle` · `random` · `slice` · `batch` · `sum` · `map` · `select` / `reject` · `selectattr` / `rejectattr` · `groupby` · `dictsort` · `list` · `union` / `intersect` / `difference` / `symmetric_difference`

`selectattr` and `rejectattr` are the workaround for every loop-scope problem in §3.

### Escaping and serialization

`escape_html` · `escape_attr` · `escapejson` · `escape_url` · `escape_js` · `escape_jinjava` · `forceescape` · `safe` · `sanitize_html` · `urlencode` · `urldecode` · `tojson` · `fromjson` · `render`

See §9 — these are the ones with security consequences.

### Encoding and misc

`md5` · `bool` · `string` · `attr` · `filesizeformat` · `convert_rgb` · `geo_distance` · `ipaddr` · `xmlattr` · `log` · `root` · `default` · `cut` · `divisible`

---

## 8. Functions

Functions are called, not piped. The ones that matter in marketing email:

```hubl
{{ personalization_token("contact.firstname", "there") }}

{% set product = crm_object("product", 2444498793, "name,description,price") %}
{% set people = crm_objects("contact", "firstname__not_null=&limit=3", "firstname,lastname") %}
{% set related = crm_associations(847943847, "HUBSPOT_DEFINED", 2, "limit=3", "firstname,email", false) %}

{{ crm_property_definition("contact", "firstname").label }}
```

`crm_objects()` and `crm_associations()` return **`{has_more, offset, total, results}`** — iterate `.results`.

`oembed()` is documented as working **only in emails**, returning `type`, `html`, `thumbnailUrl` and friends for a media URL.

Every one of these counts against the function limits. `references/data-sources.md` has the parameters, query operators, and the two limit regimes in full.

---

## 9. Escaping, `raw`, and dynamic evaluation

### `{% raw %}`

```hubl
{% raw %}
  {{"Code you want to escape"}}
{% endraw %}
```

Everything between the tags is emitted literally. Use it for JavaScript template literals, for documentation of HubL inside an email, and for any third-party syntax that collides with `{{ }}`.

### Escaping is context-dependent, and HubSpot does not say what the default is

HubL has a full escaping toolkit — `escape_html`, `escape_attr`, `escape_url`, `escape_js`, `escapejson`, `sanitize_html` — and `safe` is described as marking a value safe *"in auto-escape environments"*. **HubSpot never documents whether marketing email templates render in an auto-escape environment.** Do not infer one from the other. Escape explicitly for where the value lands:

| Destination | Filter |
|---|---|
| HTML text | `escape_html` |
| An HTML attribute | `escape_attr`, and quote the attribute |
| A URL path or query value | `urlencode` (or `escape_url`, which enforces protocols) |
| Inside a `<script>` block | `escape_js` |
| A JSON value | `escapejson` |
| Rich text from a CRM property | `sanitize_html`, which *"strips HTML tags that are not allowed"* |

### `render` and `escape_jinjava`

`|render` *"renders strings containing HubL early so that the output can be passed into other filters."* That is template evaluation of a stored string, with all the consequences that implies. Pass it author-written content only — never a CRM property, a form submission, an integration field, or model output. `|escape_jinjava` is the counterpart that neutralizes HubL delimiters in a string you do not control.

---

## 10. Whitespace control

A hyphen inside a tag delimiter strips adjacent whitespace, documented on the variables-and-macros page in the form `{%- endmacro -%}`:

```hubl
{%- set discount = 20 -%}
```

`{{- … -}}` on **output** tags is standard Jinja but is not shown anywhere in HubSpot's documentation. It very likely works; treat it as unverified and prefer tag-level control or a single line.

This matters more in email than on a page: stray blank lines from multi-line HubL land inside `<td>` elements and open gaps that only some clients render.

---

## 11. Email-only restrictions

Everything above is the language. These four rules apply *only* in marketing email, and each one is the difference between working code and code that looks fine and does nothing:

1. **Filters do not apply to personalization tokens.** *"You can apply HubL filters to personalization tokens, such as contact and company tokens, on HubSpot CMS and blog pages, but not in emails."* Use `personalization_token("contact.firstname", "there")` for a fallback.
2. **A personalization token inside a conditional needs programmable email.** *"If you're using personalization tokens within a conditional statement of your email module, you must enable programmable email for the module."*
3. **Single-send API values are not available to conditionals.** *"Information passed via the v3 or v4 single send APIs will not function within `if` statements, as the templates compile before the information populates."*
4. **Function invocations are capped**, with two published and non-matching limit regimes. See `references/data-sources.md`.

HubSpot's own programmable-content guide breaks rule 1 in a published example (`contact.budget_max|int` inside an email query string). Both pages are current. Flag the conflict rather than resolving it silently.

---

## 12. Does not exist in HubL

Constructs a model trained on Liquid or Django will reach for. The left column is wrong in HubSpot:

| Reached for | Reality in HubL |
|---|---|
| `{% elsif %}` | **`{% elif %}`** |
| `{% assign x = 1 %}` | **`{% set x = 1 %}`** |
| `{% capture %}` … `{% endcapture %}` | Not documented. Use `{% set %}` with a filter, or a macro |
| `{% case %}` / `{% when %}` | No switch construct. Chain `elif`, or use `in` |
| `{% with %}` (Django) | Not documented. `{% set %}` is template-scoped anyway |
| `{% autoescape %}` (Django) | Not documented |
| `{{ x \| default: 'y' }}` (colon args) | Jinja call syntax: `{{ x\|default("y") }}` — and see §11, this is the wrong idiom in email regardless |
| `{{ items.size }}` | `{{ items\|length }}` |
| `\|upcase` / `\|downcase` | `\|upper` / `\|lower` |
| `\|strip_html` | `\|striptags` |
| `\|truncatewords` | `\|truncate`, `\|truncatehtml`, `\|wordcount` |
| `\|append` / `\|prepend` | The `~` operator |
| `\|json` / `\|to_json` | `\|tojson` (and `\|fromjson` back) |
| `\|date: '%b %d'` | `\|format_datetime(...)` |
| `{% increment %}` / `{% decrement %}` | Not documented |
| `{% abort %}` / any send-cancel tag | **HubSpot has none.** You cannot cancel a marketing email from inside the template. The only comparable outcome is being dropped for exceeding the function limit, which is not something you can invoke deliberately |

**Undocumented — neither supported nor forbidden. Test before relying on any of these in a send:**

`{% break %}` · `{% continue %}` · `{% filter %}` blocks · `{% set %}` block form (`{% set x %}…{% endset %}`) · `namespace()` · `loop.previtem` / `loop.nextitem` / `loop.changed()` · `{{- … -}}` output-tag whitespace control · whether HubL inside an HTML comment is evaluated.

---

## Sources

HubSpot: [HubL syntax overview](https://developers.hubspot.com/docs/reference/cms/hubl/overview) · [Variables and macros](https://developers.hubspot.com/docs/reference/cms/hubl/variables-macros-syntax) · [If statements](https://developers.hubspot.com/docs/reference/cms/hubl/if-statements) · [Loops](https://developers.hubspot.com/docs/reference/cms/hubl/loops) · [Operators and expression tests](https://developers.hubspot.com/docs/reference/cms/hubl/operators-and-expression-tests) · [Filters](https://developers.hubspot.com/docs/reference/cms/hubl/filters) · [Functions](https://developers.hubspot.com/docs/reference/cms/hubl/functions) · [Variables](https://developers.hubspot.com/docs/reference/cms/hubl/variables) · [Jinjava](https://github.com/HubSpot/jinjava)
