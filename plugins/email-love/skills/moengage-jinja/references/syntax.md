# MoEngage Jinja — Tag and Filter Reference

Standard Jinja2, plus MoEngage's own filters and the `MOE_NOT_SEND` tag, minus a version guarantee.

## Contents

1. [Which Jinja is this, actually](#1-which-jinja-is-this-actually)
2. [Delimiters and variables](#2-delimiters-and-variables)
3. [Operators, tests, and comparisons](#3-operators-tests-and-comparisons)
4. [Tags](#4-tags)
5. [`MOE_NOT_SEND`](#5-moe_not_send)
6. [Standard filters](#6-standard-filters)
7. [MoEngage's custom filters](#7-moengages-custom-filters)
8. [Defaults, null, and truthiness](#8-defaults-null-and-truthiness)
9. [Escaping and autoescape](#9-escaping-and-autoescape)
10. [Whitespace and comments](#10-whitespace-and-comments)
11. [Does not exist here — do not reach for it](#11-does-not-exist-here--do-not-reach-for-it)

---

## 1. Which Jinja is this, actually

**MoEngage's own documentation gives two different answers, on both of its documentation domains.**

| Page | Claim |
|---|---|
| [Jinja Templating Language](https://help.moengage.com/hc/en-us/articles/115002757783-Jinja-Templating-Language) | *"MoEngage currently supports Jinja version 3.1."* |
| [Message Personalization — Overview](https://help.moengage.com/hc/en-us/articles/30926654573972-Overview) | *"MoEngage currently supports Jinja version 2.8."* |

The same split appears on the newer developer docs site, which `developers.moengage.com` now redirects to: [jinja-templating-language](https://www.moengage.com/docs/user-guide/campaigns-and-channels/getting-started/message-personalization/jinja-templating-language) says 3.1, [overview](https://www.moengage.com/docs/user-guide/campaigns-and-channels/getting-started/message-personalization/overview) says 2.8. Both pages are current.

**Write to the 2.8 intersection.** A 3.1-only construct that turns out to be running on 2.8 does not raise a helpful error — it produces an undefined value, and an undefined value on MoEngage drops the user from the send. The cost of assuming 2.8 is losing a couple of conveniences. The cost of assuming 3.1 is a silently shorter campaign.

Two supporting signals that the real engine is old: MoEngage's own use-cases library builds a "unique values" routine out of `groupby`, `append`, and manual list juggling rather than using `|unique`, and builds a running collection with `{% set my_list = [] %}` plus `.append()` rather than `namespace()`. Both are the idioms you write when `unique` and `namespace` are unavailable.

### Constructs to avoid because they postdate 2.8

| Construct | Added in | Write instead |
|---|---|---|
| `namespace()` | 2.10 | A one-element list plus `.append()` — MoEngage's own documented pattern |
| `loop.previtem`, `loop.nextitem`, `loop.changed()` | 2.10 | Index arithmetic on `loop.index0` |
| `\|unique`, `\|min`, `\|max` | 2.10 | `\|groupby` / `\|sort(attribute=…)` then take an end element |
| `\|tojson` | 2.9 | Build the JSON by hand, or return it pre-formed from the Content API |
| `\|items` | 3.1 | Iterate the mapping directly |
| `\|trim(chars)` with an argument | 3.x | `\|replace(…)` |
| `{% set %}` … `{% endset %}` block form | 2.8 (borderline) | Safe in principle; verify in a preview before relying on it |

Everything MoEngage's own examples use — `map(attribute=…)`, `selectattr`, `groupby`, `sort(attribute=…, reverse=true)`, `sum`, `round`, `length`, `join`, `reverse`, `range`, `string`, slicing, `'{:,}'.format(x)` — predates 2.8 and is safe under either reading.

---

## 2. Delimiters and variables

```jinja
{{ … }}     output
{% … %}     statement / expression
{# … #}     comment
```

### Subscript, not dot

```jinja
{{UserAttribute['First Name']}}       ✅ MoEngage's recommended form
{{UserAttribute.membership}}          ✅ works, single-word names only
{{UserAttribute.First Name}}          ❌ cannot parse
```

MoEngage: *"It is recommended to use the subscript notation when using Jinja. If the defined attribute that you are using contains spaces, you must use the subscript notation."* Treat subscript as the house rule and stop thinking about it.

Attribute names are the **readable names** shown in the personalization editor, and they are case- and space-sensitive. Type `@` in the field and pick from the list rather than typing a name from memory — a typo here is not a syntax error, it is a null, and a null is a dropped user.

### Indexing and slicing

```jinja
{{ProductSet.Recs[0].title}}
{{ProductSet.Recs[-1].title}}                last item
{% for p in ProductSet.Recs[:-1] %}…{% endfor %}   all but the last
{{UserAttribute['Mobile Number'][-10:]}}     last ten characters
```

Python slice semantics, zero-indexed, negatives from the end.

### Literals

Strings in single or double quotes, ints and floats, `['lists']`, `{'dicts': 'like this'}`, `true` / `false`. Note MoEngage documents the lowercase `true`/`false` spelling.

---

## 3. Operators, tests, and comparisons

**Math:** `+` `-` `*` `/` `%`. `/` always returns a float — `{{ 1 / 2 }}` is `0.5`.

**Comparison:** `==` `!=` `>` `>=` `<` `<=`

**Logic:** `and` `or` `not`, and `( )` for grouping — parentheses are supported here, unlike some other ESP dialects.

**Membership and tests:** `in`, `is`

```jinja
{% if 'true' in UserAttribute['eligible'] %}…{% endif %}
{% if name is defined %}…{% endif %}
{% if loop.index is divisibleby 3 %}…{% endif %}
{{ UserAttribute.name or UserAttribute.email }}     documented as a poor-man's default
```

### The `<` and `>` problem

MoEngage's default email editor is **Froala** — its Campaign Content API takes `email_editor` as `"Froala Editor"` (the default) or `"Ace Editor"`. Froala is a rich-text HTML editor, and rich-text editors HTML-encode bare `<` and `>` typed into content, turning `{% if score > 5 %}` into `{% if score &gt; 5 %}`. The condition then never matches and no error is raised.

**MoEngage does not document this behaviour either way**, so treat what follows as a defensive rule rather than as their published guidance:

- Prefer `==`, `!=`, `in`, and `is` where the logic allows it.
- Where a magnitude comparison is genuinely required, write it in the **HTML source view** or the Ace editor, save, then re-open and confirm the operator is still an operator.
- Check any pasted template for `&gt;` and `&lt;` inside `{% %}` before doing anything else.

An illustration of how easily the character goes missing: MoEngage's own published example of aggregated `MOE_NOT_SEND` validation reads `{% set has_first_name = UserAttribute['First Name'] and UserAttribute['First Name']|length  0 %}` — the `>` that belongs between `|length` and `0` is simply not there in the rendered documentation.

---

## 4. Tags

### Control flow

```jinja
{% if COND %} … {% elif COND %} … {% else %} … {% endif %}
```

It is `elif`, not `elsif` (Liquid) and not `else if`.

### Iteration

```jinja
{% for product in products %}
  <li><a href="{{ product.href }}">{{ product.name|e }}</a></li>
{% endfor %}

{% for row in rows %}
  <li class="{% cycle('odd', 'even') %}">{{ row|e }}</li>
{% endfor %}
```

`{% break %}` and `{% continue %}` are both documented as working, with a worked example — unusual, since they require the `loopcontrols` extension and are off by default in a stock Jinja environment.

`loop.index` (1-based), `loop.index0`, and `loop.length` are available. `loop.previtem` / `loop.nextitem` / `loop.changed()` are 2.10 additions — avoid.

**In an HTML table, the loop tags must live in their own hidden rows.** See §6 of `references/troubleshooting.md`; this is not a Jinja rule, it is an editor rule, and it breaks templates that are otherwise perfect.

### Assignment

```jinja
{% set firstName = UserAttribute['First name'] %}
{% set navigation = [('index.html', 'Index'), ('about.html', 'About')] %}
{% set key, value = call_something() %}
```

MoEngage documents the mutable-list idiom explicitly, and you will need it in place of `namespace()`:

```jinja
{% set collected = [] %}
{% for p in ProductSet.Recs %}
  {{ collected.append(p.title)|replace('None','') }}
{% endfor %}
{{ collected|join(', ') }}
```

The `|replace('None','')` is there because `.append()` returns `None` and Jinja would otherwise print it. This is MoEngage's own published pattern, not a workaround invented here.

---

## 5. `MOE_NOT_SEND`

The one construct that is MoEngage's and nobody else's. It exists in two shapes.

### As a `default` argument

```jinja
Dear {{UserAttribute['u_fn']|default('MOE_NOT_SEND')}}
```

*"`default('MOE_NOT_SEND')` will suppress the message from going out."* The user is dropped and counted under Personalization Failed, but with no reason attached.

### As a tag, with a reason

```jinja
{% if (UserAttribute['brand'] == 'Puma') %}
Brand is Puma!
{% else %}
{% MOE_NOT_SEND("Brand name doesn't exist for user") %}
{% endif %}
```

*"In the Error breakdown section of the campaign's Analytics page, MoEngage tracks all users for whom the content personalization failed. The custom error message you defined, along with the count of users who triggered that specific error based on your campaign's segmentation, is displayed here."*

This is the form to write. It is the only one that produces a labelled, counted row you can read afterwards.

### Multiple checks: independent `if`s, not an `elif` chain

MoEngage's Personalized Preview documentation is explicit about this:

```jinja
{% if not EventAttribute['order_id'] %}
  {% MOE_NOT_SEND("order_id missing on the trigger event") %}
{% endif %}
{% if not UserAttribute['First Name'] %}
  {% MOE_NOT_SEND("First Name is missing") %}
{% endif %}
{% if not UserAttribute['Loyalty Tier'] %}
  {% MOE_NOT_SEND("Loyalty Tier is missing") %}
{% endif %}
```

*"To validate multiple attributes simultaneously, use independent if statements rather than elif chains. This ensures the Preview Pane aggregates all validation failures into a single list, allowing you to debug multiple missing data points at once."* An `elif` chain reports only the first failure, so you fix one attribute, re-preview, and find the next — one round trip per missing field.

The reason string is a plain quoted string. MoEngage's examples never put Jinja inside it, and nothing documents whether interpolation works — keep it static.

---

## 6. Standard filters

MoEngage documents these directly, and adds: *"MoEngage currently supports all other standard functions of Jinja."* Treat that sentence as covering the pre-2.8 standard library and nothing later.

**String:** `title` `capitalize` `upper` `lower` `replace(old, new)` `striptags` `length` `string` `join` `reverse` `trim` `truncate`

```jinja
{{UserAttribute['FirstName']|title}}          joHn doE  → John Doe
{{UserAttribute['FirstName']|capitalize}}     joHn doE. his age is 20. → John doe. His age is 20.
{{UserAttribute['FirstName']|upper}}
{{UserAttribute['Mobile Number']|replace("jo","ma")}}
{{ '<p>Hello!</p>'|striptags }}               Hello!
```

Note `capitalize` capitalizes the first letter and lowercases the rest — it is not a title-caser.

**Numeric:** `round(n)` `sum` `abs` `int` `float`

```jinja
{{ cart_item.price|round(2) }}
{{ items|map(attribute='price')|sum }}
```

**List:** `count` `index` `pop` `map(attribute=…)` `selectattr(attr, test, value)` `groupby(attr)` `sort(attribute=…, reverse=true)` `join` `length` `first` `last` `random`

```jinja
{{ [{"title":"BTC"},{"title":"DOT"}]|map(attribute='title')|join(',') }}       BTC,DOT
{{ y|selectattr('title', 'equalto', 'DOT')|list|length }}                      2
{% for i in y|groupby('title') %}{{ i.grouper }} {{ i.list|length }}{% endfor %}
```

**Formatting:** Python string methods are reachable, which is how MoEngage documents thousands separators:

```jinja
{% set y = EventAttribute['amount'] %}
{{ '{:,}'.format(y) }}                          1000000 → 1,000,000
{{ '{:,}'.format(y)|replace(',','.') }}         1000000 → 1.000.000
```

`'{:,}'.format(x)` raises on a string. If the attribute might arrive as text, coerce it first, and guard it — MoEngage's documented parse error `Error expected token ',', got 'integer'` is exactly this class of mistake seen from the other side.

---

## 7. MoEngage's custom filters

These do not exist in stock Jinja2. Nothing outside MoEngage will recognise them.

### Date and time

| Filter | Usage | Output |
|---|---|---|
| `dateFormatter(toFormat)` | `{{'14/10/2020'\|dateFormatter('%m/%d/%Y')}}` | `10/14/2020` |
| `days(other)` | `{{'12/10/2020'\|days('14/10/2020')}}` | `2` — may be positive, zero, or negative |
| `today(tz)` | `{{'%m/%d/%Y'\|today('EST')}}` | current date, in that timezone |
| `dateTimeFormatter(…)` | see below | formatted datetime |

```jinja
{{ "2012-01-19 17:21:00 CST"|dateTimeFormatter(toFormat='%Y-%m-%d %H:%M:%S %p') }}
{{ "2012-01-19 17:21:00 CST"|dateTimeFormatter(tzOffset=-330) }}
{{ "2012-01-19 17:21:00 CST"|dateTimeFormatter(timeZone='Asia/Kolkata') }}

{{UserAttribute['First Seen']|dateTimeFormatter(
     toFormat='%Y-%m-%d %H:%M',
     timeZone='Asia/Kolkata',
     tzOffset=UserAttribute['User Time Zone Offset (Mins)']) }}
```

Note the argument shape on `today`: the **format string is the subject** and the timezone is the argument, which is backwards from every other filter here.

**Per-recipient local time** is the combination worth knowing: pass the user's own offset attribute as `tzOffset`. MoEngage's precedence rule is documented — *"If both the timeZone and tzOffset methods are used, tzOffset is given priority irrespective of the sequence. If the tzOffset value is not available or is -1000, the timeZone method will be used."* So a `timeZone=` argument is a working fallback for users whose offset is unset, which makes it worth always supplying both.

### Hashing and encoding

| Filter | Usage |
|---|---|
| `convertToSHA256('secret')` | `{% set e = UserAttribute['Email'] %}{{e\|convertToSHA256('6ABC89P3FXYW')}}` |
| `convertToSHA256NoSalt()` | `{{e\|convertToSHA256NoSalt()}}` |
| `base64encode` / `base64decode` | `{{e\|base64encode}}` |
| `urlencode` / `urldecode` | `{{e\|urlencode}}` |

The salted form takes a literal secret in the template. Anyone who can open the campaign can read it — treat it as a shared identifier salt, never as a credential, and never paste a real key into a template you are sharing for review.

### Auxiliary data

```jinja
{% set aux = UserAttribute['uid']|getAuxData('aux_data_cc_due_info_list') %}
{{ aux.Amount_Due }}
```

`getAuxData` is a lookup filter: the piped value is the key, the argument is the imported file name, and the result is a record you address by column. See `references/data-sources.md` §6.

---

## 8. Defaults, null, and truthiness

```jinja
{{UserAttribute['First name']|default('Guest')}}
{{UserAttribute['First name']|default('MOE_NOT_SEND')}}
{{UserAttribute['Mobile Number']|default('NA')}}
```

**The stakes are different here than anywhere else.** *"In the MoEngage email templates, a message containing a null value will not be sent."* An unguarded null is not a cosmetic bug; it removes the recipient.

### The `default` gap you must plan around

In stock Jinja2, `|default(x)` substitutes only when the variable is **undefined**. It does *not* fire on `''`, and it does *not* fire on `None` — `{{ none|default('Guest') }}` renders `None`. The two-argument form `|default('Guest', true)` fires on any falsy value, including `''`, `0`, and `None`.

**MoEngage's documentation never shows the two-argument form and never states which case its `|default` covers.** It also never states whether a tracked-but-empty attribute reaches the template as Undefined, as `None`, or as `''`, and those three behave differently.

Practical rule: **write `|default('Guest', true)`**, and confirm it on a test send against a user whose attribute is present but empty. If you write the one-argument form and MoEngage hands you a `None`, you print the string `None` into the inbox — or, worse, the null propagates and the user is dropped.

### Truthiness in conditionals

```jinja
{% if UserAttribute['interests'] %}…{% endif %}
{% if not UserAttribute['First Name'] %}{% MOE_NOT_SEND("no first name") %}{% endif %}
{% if UserAttribute['First Name']|length > 0 %}…{% endif %}
```

`{% if x %}` is false for undefined, `None`, `''`, `0`, and `[]` alike, which makes it the more predictable guard — prefer it to `|default` when what you actually need is a branch.

---

## 9. Escaping and autoescape

**Autoescape is off.** MoEngage states the responsibility explicitly:

> *"It's your responsibility to escape variables if needed. What to escape? If you have a variable that may include any of the following characters `>`, `<`, `&`, or `"` you must escape it unless the variable contains well-formed and trusted HTML. Escaping works by piping the variable through the `|e` filter."*

| Where the value lands | What it needs |
|---|---|
| HTML text | `\|e` |
| An HTML attribute | `\|e`, and the attribute quoted |
| A URL path or query value you are inserting into a URL you wrote | `\|urlencode` — never piped over a complete URL, where it can mangle the `://` separator |
| A complete URL arriving from data | validate against an HTTPS allowlist of expected domains, then `\|e` for the attribute |
| Inside a `<script>` or JSON blob | JSON encoding — `\|e` does not provide it, and there is no `\|tojson` on 2.8 |

Values that arrive from an event payload, a Content API response, a catalog item, or an auxiliary data file are markup written by someone other than you. Escape them. A product title containing a stray `<` breaks the layout for exactly the recipients who have that product; a title containing an anchor tag does something worse.

To output a literal delimiter, MoEngage documents the expression trick rather than `{% raw %}`:

```jinja
{{ '{{' }}
```

---

## 10. Whitespace and comments

**Comments are `{# … #}`.** MoEngage's prose says so — and then its published code example shows `{% # note … # %}`, which is not valid Jinja in any version. Ignore the example, use the prose form:

```jinja
{# this block is disabled while we A/B the header #}
```

Do **not** comment out Jinja with an HTML comment. `<!-- {{UserAttribute['x']}} -->` is still rendered by the Jinja pass before the HTML is ever parsed, so a null inside it still drops the user. Delete the code or wrap it in `{# #}`.

**Whitespace control** — `{%- … -%}` and `{{- … -}}` are standard Jinja from well before 2.8 and should work, but MoEngage never mentions them and the auto-format pass normalises whitespace on save anyway. Do not build a layout that depends on them; put the Jinja on one line where the spacing matters.

---

## 11. Does not exist here — do not reach for it

A model trained on Liquid, Django templates, or HubL will produce every one of these. None of them work.

| Written as | Reality on MoEngage |
|---|---|
| `{% assign x = 1 %}` | Liquid. It is `{% set x = 1 %}` |
| `{% elsif %}` | Liquid. It is `{% elif %}` |
| `{% unless %}` / `{% endunless %}` | Liquid. Use `{% if not … %}` |
| `{% capture %}` | Liquid. Use `{% set x %}…{% endset %}`, and verify it in a preview |
| `{{ x \| default: 'y' }}` | Liquid/Django colon-argument form. Jinja uses parentheses: `\|default('y')` |
| `{{ items.size }}` | Liquid. It is `{{ items\|length }}` |
| `{% for %}…{% empty %}` | Django. Jinja spells it `{% for %}…{% else %}…{% endfor %}` |
| `{{ d\|date:"Y-m-d" }}` | Django. Use `dateFormatter` / `dateTimeFormatter` |
| `{{ x\|safe }}` | Django. Irrelevant — autoescape is off, so everything is already "safe" and the risk runs the other way |
| `{{ contact.firstname }}`, `personalization_token(…)`, `{% module %}`, `{% widget_block %}` | HubL. HubSpot only |
| `{{${first_name}}}`, `{% abort_message %}`, `{% connected_content %}` | Braze. The MoEngage equivalents are `UserAttribute[…]`, `{% MOE_NOT_SEND() %}`, and `ContentApi.<Name>(…)` |
| `{{customer.email}}`, `{% liquid %}` | Customer.io / Shopify Liquid |
| `{% include %}`, `{% extends %}`, `{% import %}`, `{% macro %}` | Real Jinja tags, but there is no template store for them to resolve against and MoEngage documents none of them. The substitute for reusable markup is a **Content Block**, inserted from the personalization editor. Do not write `{% include %}` |
| `{% raw %}` | Undocumented. Use `{{ '{{' }}` |
| `\|tojson`, `\|unique`, `\|min`, `\|max`, `namespace()`, `loop.nextitem` | Post-2.8 Jinja. See §1 |

**And one that does not exist as a fallback at all:** personalized URLs. *"If the personalized URL fails to find/resolve the user attribute, the email will not be sent to the user. There is no fallback mechanism for personalized URLs."* An attribute inside a link destination is an unconditional `MOE_NOT_SEND` with no reason string. If a URL must be personalized, guard the attribute with an explicit `{% MOE_NOT_SEND("…") %}` earlier in the template so at least the Error breakdown says why.

---

## Sources

MoEngage: [Jinja Templating Language](https://help.moengage.com/hc/en-us/articles/115002757783-Jinja-Templating-Language) · [Message Personalization Overview](https://help.moengage.com/hc/en-us/articles/30926654573972-Overview) · [Use Cases for Jinja](https://help.moengage.com/hc/en-us/articles/26117413479828-Use-Cases-for-Jinja) · [Personalize Email Content](https://help.moengage.com/hc/en-us/articles/360058752932-Personalize-Email-Content) · [Common Personalization Errors and FAQs](https://help.moengage.com/hc/en-us/articles/30958502449300-Common-Personalization-Errors-and-FAQs) · [Personalized Preview](https://help.moengage.com/hc/en-us/articles/30958544839828-Personalized-Preview) · [Why Does Parsing Jinja Template Format in the Personalization Preview Fail?](https://help.moengage.com/hc/en-us/articles/28720664391188-Why-Does-Parsing-Jinja-Template-Format-in-the-Personalization-Preview-Fail) · [Rendering Issues in HTML Templates](https://help.moengage.com/hc/en-us/articles/13546215631508-Rendering-Issues-in-HTML-Templates) · [Campaign content reference (`email_editor`)](https://www.moengage.com/docs/api/campaigns/campaign-content-reference) · [Dynamic Content Personalization](https://help.moengage.com/hc/en-us/articles/39719238781716-Dynamic-Content-Personalization)
