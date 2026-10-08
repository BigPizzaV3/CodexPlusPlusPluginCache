# Iterable Handlebars — Data Sources and Field Paths

Where values come from, how they're namespaced, and the exact paths. Getting the path right is more than half of getting a template right.

## Contents

1. [The four data sources and precedence](#1-the-four-data-sources-and-precedence)
2. [Built-in merge tags](#2-built-in-merge-tags)
3. [Commerce and shoppingCartItems](#3-commerce-and-shoppingcartitems)
4. [Catalogs and collections](#4-catalogs-and-collections)
5. [Data feeds](#5-data-feeds)
6. [Snippets](#6-snippets)
7. [Channel and campaign-type availability](#7-channel-and-campaign-type-availability)
8. [Worked patterns](#8-worked-patterns)

---

## 1. The four data sources and precedence

| Source | Syntax | Notes |
|---|---|---|
| User profile | `{{fieldName}}` | Always available |
| Triggering event / API call | `{{fieldName}}` | Only in triggered and journey campaigns |
| Catalog | `{{#catalog "Name" key as \|item\|}}` | Message templates only |
| Data feed | `[[fieldName]]` or `{{fieldName}}` | Depends on the template's merge setting — see §5 |

**Event beats profile.** At send time, if the triggering event or API call contains a field with the same name as a profile field, Iterable renders the **event** value. Force the profile value with `{{profile.fieldName}}`.

```handlebars
{{firstName}}          <!-- event value if the event has one, else profile -->
{{profile.firstName}}  <!-- always the profile value -->
```

This is a frequent source of "the wrong name is showing" — the event carried a stale or differently-cased `firstName`.

**Field names are case-sensitive.** `firstName` ≠ `FirstName` ≠ `firstname`.

**Bracket notation** is required for names containing spaces, periods, or a leading digit:

```handlebars
{{[First Name]}}
{{[User Signed Up.First Name]}}
{{[1stName]}}
```

Avoid periods in field names when designing a schema — Handlebars reads `.` as property access and the bracket workaround is easy to forget.

---

## 2. Built-in merge tags

Available without any profile or event data.

**Unsubscribe / preference**

```handlebars
{{unsubscribeUrl}}              <!-- Iterable-hosted one-click unsubscribe -->
{{hostedUnsubscribeUrl}}        <!-- your own hosted preference centre -->
{{unsubscribeMessageTypeUrl}}   <!-- unsubscribe from this message type only -->
{{unsubscribeByPhoneUrl}}       <!-- SMS, for international alphanumeric sender IDs -->
```

**Campaign and message**

```handlebars
{{campaignName}}  {{campaignId}}  {{recurringCampaignId}}
{{templateName}}  {{templateId}}  {{clientTemplateId}}
{{channelId}}     {{messageTypeId}}  {{workflowId}}
{{sendListIds}}   <!-- an array; render with {{join sendListIds ","}} -->
```

**Brand and compliance**

```handlebars
{{brandName}}            <!-- max 50 chars -->
{{companyName}}
{{physicalAddress}}
{{messagingInitiative}}  <!-- max 100 chars -->
{{smsDisclaimerLink}}
```

**Recipient**

```handlebars
{{email}}  {{userId}}
```

**Time**

```handlebars
{{now}}      <!-- current date at send time, format MMM DD, YYYY -->
{{sentAt}}   <!-- original send time, ISO 8601 UTC — EMAIL TEMPLATES ONLY -->
```

**Links**

```handlebars
{{viewInBrowserUrl}}   <!-- email only -->
```

**Journey Live Data**

```handlebars
{{liveData.objectName.fieldName}}   <!-- e.g. {{liveData.product.name}} — journey campaigns only -->
```

**Abort the send**

```handlebars
{{sendSkip cause="reason" extraKey=extraValue}}   <!-- logs skip reason SendAborted -->
```

### Preference centre link construction

```handlebars
https://www.example.com/preferences?token={{#urlEncode}}{{prefToken}}{{/urlEncode}}&campaignId={{#urlEncode}}{{campaignId}}{{/urlEncode}}&templateId={{#urlEncode}}{{templateId}}{{/urlEncode}}
```

Identify the recipient with an **opaque, short-lived signed token** (here `prefToken`, minted server-side and synced to the profile) or use Iterable's hosted unsubscribe/preference links — never the email address or user ID itself. URL-encoding an identifier only formats it; it does not prevent disclosure, and the value still lands in server logs, analytics, browser history, and referrer headers.

If you append query params **in the template** rather than in project settings, start with `&`, not `?` — the base URL already carries a query string. Getting this wrong produces `InvalidHostedUnsubscribeUrl` send skips.

---

## 3. Commerce and shoppingCartItems

**Three different paths for what feels like the same data. This is the most common cart-template bug.**

| Context | Path |
|---|---|
| User profile (abandoned cart, browse abandonment) | `profile.shoppingCartItems` — or bare `shoppingCartItems` in a blast |
| `updateCart` event | `updatedShoppingCartItems` |
| `purchase` event | `shoppingCartItems` |

Iterable maintains `shoppingCartItems` on the user profile, reflecting current cart contents. An `updateCart` event replaces it; a `purchase` event **empties** it.

An abandoned-cart campaign triggered by `updateCart` therefore has both `updatedShoppingCartItems` (from the event, current) and `profile.shoppingCartItems` (from the profile). If the campaign fires on a delay, the profile version is the one that reflects the cart at send time.

### Item fields

Each element of the array exposes:

```
id  sku  name  description  categories (array)  price  quantity  imageUrl  url
```

Plus any custom fields under `dataFields`.

### Purchase event top level

```
eventType ("purchase")  shoppingCartItems  total  campaignId  templateId  createdAt  email  itblInternal
```

### Looping a cart

```handlebars
{{#if shoppingCartItems}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  {{#each shoppingCartItems}}
  <tr>
    <td width="120" valign="top">
      <img src="{{imageUrl}}" alt="{{name}}" width="120" style="display:block;">
    </td>
    <td valign="top" style="padding-left:16px;">
      <a href="{{url}}" style="font-weight:bold; text-decoration:none;">{{name}}</a><br>
      Qty {{quantity}} &middot; {{numberFormat price "currency"}}
    </td>
  </tr>
  {{/each}}
</table>
{{else}}
  <!-- no cart data: show an evergreen bestsellers block instead -->
{{/if}}
```

Note the double braces on `imageUrl`, `url`, and `name`. Cart items are data — the recipient's own cart, populated from your catalog — so they stay escaped. A query-string `&` escaped to `&amp;` inside an `href` is the correct HTML spelling and the mail client decodes it before navigating; an apostrophe escaped to `&#x27;` displays as `'`. Neither breaks. Raw output here would put whatever a catalog import wrote straight into the message. If you need to *add* a parameter whose value is dynamic, URL-encode that value: `{{url}}?ref={{#urlEncode}}{{campaignName}}{{/urlEncode}}`. See `troubleshooting.md` §4.

Index and count:

```handlebars
{{shoppingCartItems.[0].name}}
{{shoppingCartItems.size}}
```

---

## 4. Catalogs and collections

Catalog helpers work **only in message templates**.

```handlebars
<!-- single item by literal key -->
{{#catalog "Restaurants" "JoesRestaurant" as |restaurant|}}
  Average price: {{numberFormat restaurant.averagePrice "currency"}}
{{/catalog}}

<!-- key from a profile field, with a fallback -->
{{#catalog "Products" favoriteProductId as |item|}}
  {{item.name}}
{{else}}
  Our bestsellers this week
{{/catalog}}

<!-- required=true: a failed lookup SKIPS THE SEND instead of rendering empty -->
{{#catalog "Products" productId required=true as |item|}}{{item.name}}{{/catalog}}

<!-- multiple items from an array of keys -->
{{#catalogKeys "Products" recentlyViewedIds as |items|}}
  {{#each items}}<div>{{this.name}}</div>{{/each}}
{{/catalogKeys}}

<!-- a collection defined in the Collection Builder -->
{{#catalogCollection "DeliveryBelowDinnerBudget" as |collection|}}
  {{#each collection}}<div>{{this.name}}</div>{{/each}}
{{/catalogCollection}}
```

Argument order for `#catalog` is `"CatalogName"` then item key. Without `required=true` a missed lookup renders empty; with it, the send is skipped and logged as `CatalogLookupError` / `CatalogCollectionLookupError`.

In the Collection Builder, the **Use in Template** button generates the exact Handlebars for a collection — quicker and less error-prone than hand-writing it.

Large or complex collections increase render time and can cause timeouts or send skips.

---

## 5. Data feeds

### The brace style depends on one template setting

**"Merge the Data Feed and User Contexts"** — found in template settings:

| Setting | Syntax | Behaviour |
|---|---|---|
| Disabled (default) | `[[fieldName]]` | Data feed context only |
| Enabled | `{{fieldName}}` | Single merged context; **user profile fields win** on a name collision |

This setting applies to **all** data feeds in a template — it can't be set per feed. A mismatch between the setting and the braces used is the number one reason "the data feed doesn't render."

### Aliases

An alias is a short label assigned to a feed, used to disambiguate when several feeds — or a feed and the profile — share field names:

```handlebars
[[alias.fieldName]]     <!-- merge disabled -->
{{alias.fieldName}}     <!-- merge enabled -->
```

Aliases are how you address one specific feed among several.

### Looping and limiting

```handlebars
[[#each items]]
  <h3>[[this.name]]</h3>
[[/each]]

[[#each items]]
  {{#lt @index 5}}         <!-- helpers stay in {{ }} even inside a [[ ]] loop -->
    [[this.name]]
  {{/lt}}
[[/each]]
```

Index access: `[[items.[0].name]]`

### Namespaced fields (RSS/XML)

`content:encoded` is one of the few feed fields that legitimately takes raw output — it is publisher-authored article markup, and escaping it would show the tags as text. That holds when the feed is your own publication. Every other feed field is data and takes `{{ }}`; a third-party feed's `content:encoded` is not markup you control, and rendering it raw hands that publisher the message.

```handlebars
[[item.[0].["content:encoded"]]]        <!-- brackets + quotes for a colon in the name -->
{{rssFeed.item.[0].["media:thumbnail"]}}
[[{item.[0].["content:encoded"]}]]      <!-- raw HTML, unmerged feed -->
{{{rssFeed.item.[0].["content:encoded"]}}}  <!-- raw is correct only for your own publication's article HTML -->
```

Note the raw-output form for unmerged feeds is `[[{ … }]]`, not `[[[ … ]]]`.

### Skip the send when the feed is empty

```handlebars
{{#if items}}{{else}}{{invalid.reference}}{{/if}}
```

Deliberately referencing an invalid path forces a template failure and skips the send — better than mailing an empty recommendation grid. `{{sendSkip cause="empty feed"}}` is the cleaner, more explicit equivalent.

### Static vs dynamic

Static feeds use the same URL for every recipient. Dynamic feeds put merge tags in the URL and personalise per user — when previewing one, use a profile whose fields actually satisfy the URL.

### Limits

| Limit | Value |
|---|---|
| Response timeout | 10 seconds |
| Retries before failure | 5 attempts → `RetriesExhaustedError` |
| Cache TTL | 1 hour, non-configurable |
| Total feed data per template | 4 MB across **all** feeds, not per feed |
| Feed URL length | ~2048 chars including path and query string |
| Formats | JSON, XML, RSS, Atom |

Enable caching for static feeds; disable it when freshness matters (inventory, pricing).

---

## 6. Snippets

Reusable blocks of HTML/CSS/Handlebars inserted at send time.

```handlebars
{{{ snippet "snippet_name" }}}    <!-- renders HTML as HTML — usually what you want -->
{{  snippet "snippet_name" }}     <!-- HTML-escaped, renders as visible text -->
```

Raw output is right here because a snippet body is markup your team wrote and maintains in Content → Snippets — the one case that meets the "markup you authored" bar. That does **not** extend to the values you pass into it: a profile field passed as a parameter is still data, and inside the snippet body it renders with `{{ }}` like anything else.

**Positional parameters:**

```handlebars
{{{ snippet "hero" "Fall Sale" }}}      <!-- string: quoted -->
{{{ snippet "hero" "#FF0000" }}}        <!-- hex colour is a string: quoted -->
{{{ snippet "hero" 3 }}}                <!-- integer: unquoted -->
{{{ snippet "hero" true }}}             <!-- boolean: unquoted -->
{{{ snippet "hero" favoriteColor }}}    <!-- profile field: unquoted -->
```

**Named parameters:**

```handlebars
{{{ snippet "login_switcher" login_type="sign_up" color="#FF0000" }}}
```

Inside the snippet body, reference them as ordinary merge tags: `{{color}}`. Variables are declared in Content → Snippets → **Add variable**.

**Gotchas**

- Named params use `=`, never `:`.
- An unquoted bare word in a named param is a **field lookup**, not a string: `login_type=sign_up` looks for a profile field called `sign_up`.
- Provide values for **all** of a snippet's variables, not just some.
- Wrong brace count (double vs triple) is the most common snippet bug.
- Don't put HTML snippets in non-HTML fields — subject lines, SMS bodies.
- Stray whitespace inside the snippet expression causes rendering issues.
- A snippet cannot reference itself. Nesting is allowed but risks timeouts and send skips.
- `required=true` turns a missing snippet into a `SnippetLookupError` send skip instead of silent omission.
- Editing an active snippet immediately affects every template and campaign referencing it. There is no versioning safety net.

Snippets support data feeds, which makes them a good home for a reusable dynamic content block.

---

## 7. Channel and campaign-type availability

| Tag / feature | Availability |
|---|---|
| `{{sentAt}}` | Email templates only — not SMS, push, or in-app |
| `{{viewInBrowserUrl}}` | Email only |
| `{{liveData.*}}` | Journey campaigns only |
| Event fields | Triggered and journey campaigns only — a blast has no event context |
| `{{unsubscribeByPhoneUrl}}` | SMS with international alphanumeric sender IDs |
| Catalog helpers | Message templates only |

Personalisable surfaces: email subject, preheader, body, sender email; SMS; WhatsApp; push; in-app; web push; embedded; snippets; and link/URL query strings.

---

## 8. Worked patterns

### Greeting with a graceful fallback

```handlebars
Hi {{defaultIfEmpty firstName "there"}},
```

### VIP tier block, null-safe

```handlebars
<!-- outer #if is required: a comparison helper on a null field skips the send -->
{{#if lifetimeValue}}
  {{#ifGte lifetimeValue 1000}}
    <p>As one of our top customers, here's early access.</p>
  {{else}}
    <p>Spend {{numberFormat (math 1000 '-' lifetimeValue) "currency"}} more to reach VIP.</p>
  {{/ifGte}}
{{/if}}
```

### Top 4 recommendations from a data feed (merge disabled)

```handlebars
[[#each recommendations]]
  {{#lt @index 4}}
    <td width="25%" valign="top">
      <a href="[[this.url]]"><img src="[[this.image]]" width="140" style="display:block;"></a>
      <p>[[this.title]]<br>{{numberFormat this.price "currency"}}</p>
    </td>
  {{/lt}}
[[/each]]
```

### Expiry countdown

```handlebars
<!-- both sides pinned to UTC and a numeric-only format, or the comparison fails silently -->
{{#ifGte (dateFormat offerExpiresAt format="yyyyMMddHHmmss" tz="UTC")
         (dateMath "now" "+0h" format="yyyyMMddHHmmss" tz="UTC")}}
  Offer ends {{dateFormat offerExpiresAt format="EEEE, MMMM d" tz="America/Los_Angeles"}}.
{{else}}
  This offer has expired — see what's new.
{{/ifGte}}
```

### Conditional link without whitespace corruption

```handlebars
<a href="{{~#if isVip~}}https://example.com/vip{{~else~}}https://example.com/sale{{~/if~}}?cid={{~campaignId~}}">Shop</a>
```

---

## Sources

Iterable Support: [Handlebars Overview](https://support.iterable.com/hc/en-us/articles/35601631606036) · [Personalizing Templates with Handlebars](https://support.iterable.com/hc/en-us/articles/205480365) · [Built-In Merge Tags](https://support.iterable.com/hc/en-us/articles/206514205) · [Managing Commerce Events and Shopping Cart Items](https://support.iterable.com/hc/en-us/articles/8698012206612) · [Iterable Commerce Event Properties](https://support.iterable.com/hc/en-us/articles/26732012099348) · [Using Catalogs & Collections in Messages](https://support.iterable.com/hc/en-us/articles/360033215032) · [Using Data Feeds in Templates](https://support.iterable.com/hc/en-us/articles/39206002278932) · [Managing Data Feeds](https://support.iterable.com/hc/en-us/articles/39205474652948) · [Snippets Overview](https://support.iterable.com/hc/en-us/articles/4414807441556) · [Customizing Snippets with Variables](https://support.iterable.com/hc/en-us/articles/4414796078868)
