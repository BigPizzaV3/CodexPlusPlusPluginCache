# Sailthru — Data Sources and Field Paths

Where every value in a Zephyr template comes from, what shape it arrives in, and the rules that quietly change the output.

## Contents

1. [Scopes and where Zephyr runs](#1-scopes-and-where-zephyr-runs)
2. [Standard template variables](#2-standard-template-variables)
3. [The `profile` object](#3-the-profile-object)
4. [User vars](#4-user-vars)
5. [Purchases, returns, and the cart](#5-purchases-returns-and-the-cart)
6. [Prices are integers in cents](#6-prices-are-integers-in-cents)
7. [Content feeds and the `content` array](#7-content-feeds-and-the-content-array)
8. [Recommendations pinning, and why `filter_content()` exists](#8-recommendations-pinning-and-why-filter_content-exists)
9. [The Personalization Engine and `personalize()`](#9-the-personalization-engine-and-personalize)
10. [The `feed`, `blast`, and `message` objects](#10-the-feed-blast-and-message-objects)
11. [Send-API vars and transactional data](#11-send-api-vars-and-transactional-data)
12. [Code Snippets](#12-code-snippets)
13. [Limits](#13-limits)

---

## 1. Scopes and where Zephyr runs

Zephyr appears in more places than most people realize, and the scope rules differ between them.

| Where | What runs there | Scope note |
|---|---|---|
| **Template body** (Code tab) | Presentation | Sees Setup variables |
| **Setup** (Advanced tab) | *"Zephyr code to run when Sailthru generates each message, prior to rendering code in the template body"* | Runs per recipient. **The only place `assert()` and `cancel()` belong** |
| **Subject line** | Merge tags and feed data | Documented as supporting variables and feed content |
| **Links** | Dynamic query parameters | *"evaluated in its own scope, outside of the regular HTML body"* — body variables are **not** visible; Setup variables are |
| **Auto-Append Link Parameters** | e.g. `user_hash={md5(email)}` | Appended to every link |
| **Text Version** | `date()` and similar | |
| **Code Snippets** | Reusable blocks, referenced with `{include 'name'}` | |
| **Hosted pages / opt-out pages** | Full Zephyr | A failed `assert()` here *"will cause an error preventing rendering the page"* |
| **Triggers** | Custom Zephyr, including `api_send()` / `api_user()` | Has the `message` object |
| **Lifecycle Optimizer** | Named as a Zephyr surface in the overview | **Barely documented.** See `references/troubleshooting.md` |
| **Email Composer (Visual templates)** | Setup Zephyr via Template Settings → third tab; HTML content blocks in the body | **Double quotes unsupported** |

The Setup-versus-body split is the first question to settle on any Sailthru task. Preparation — `personalize()`, `filter_content()`, `sort()`, suppression — goes in Setup. The body should only render.

---

## 2. Standard template variables

Set automatically; no configuration required.

| Variable | What it is |
|---|---|
| `{beacon}` | Open-tracking beacon image. **Required** in HTML templates |
| `{beacon_src}` | The beacon URL, for use in your own `<img>` |
| `{beacon_ssl}` / `{beacon_src_ssl}` | HTTPS versions |
| `{beacon_url}` | Target URL when the beacon is clicked |
| `{email}` | Recipient's email address |
| `{emailnum}` | The recipient's position in a mass campaign (1 for the first user). `{if emailnum <= 5000}` is the documented use |
| `{optout_confirm_url}` | Hosted opt-out page. **Required**; auto-appended if absent |
| `{signup_confirm_url}` | Revalidates a previously opted-out user on click |
| `{profile}` | The whole profile object |
| `{profile.id}` | Profile identifier |
| `{public_url}` | Shareable, non-personalized version of the email |
| `{view_url}` | Personalized "view in browser" URL |
| `{text_url}` | Plain-text version URL |

Email Composer turns open tracking on automatically — no beacon to embed.

**Special user variables** — not set automatically, but with defined behaviour if you set them: `name` (used in the To: field), `source` (recorded in the Source Report), `text_only` (sends only the text version; *"strongly discouraged"*).

---

## 3. The `profile` object

*"Within any Zephyr context, the `profile` object contains a number of useful pieces of data about the current user."* Access with dot notation.

| Field | Type | Description |
|---|---|---|
| `profile.id` | string | Unique identifier |
| `profile.email` | string | Also global as `{email}` |
| `profile.lists` | array | Natural Lists the user belongs to |
| `profile.lists_signup` | object | Signup timestamp per list |
| `profile.vars` | object | Custom fields; **also in global scope** |
| `profile.optout` | string | `all`, `basic`, or `blast` |
| `profile.signup_time` | integer | Earliest list signup, UNIX |
| `profile.open_time` | integer | Most recent open |
| `profile.click_time` | integer | Most recent click |
| `profile.horizon_time` | integer | Most recent site pageview (Personalization Engine required) |
| `profile.purchase_time` | integer | Most recent purchase |
| `profile.purchases` | array | **Last 100 completed purchases** |
| `profile.return_time` | integer | Most recent return |
| `profile.returns` | array | Last 100 returns |
| `profile.purchase_incomplete` | object | **The current cart** |
| `profile.keys` | object | Additional identity keys — `extid`, `fb`, `twitter`, `sms`. *"requires activation via your Account Manager"* |

All the `_time` fields are UNIX timestamps, so comparisons go through `time()`:

```zephyr
{if profile.click_time > time('-4 weeks')}
  This user has clicked within the past four weeks
{/if}
```

```zephyr
{if profile.optout}Click here to opt back in.{/if}
{if contains(profile.lists, 'Main')}…{/if}
```

**A documentation inconsistency worth knowing:** the field table names the returns array `return`, while the sample profile object uses `returns`. Check against a seed or test profile before relying on either.

---

## 4. User vars

Custom fields are called **vars**. *"User vars (a.k.a. custom fields) can be referenced one of two ways (either produces the same behavior): `{customvariable}` or `{profile.vars.customvariable}`."*

The bare form is convenient and dangerous. Send-API vars, feed top-level keys, standard variables, and profile vars all occupy the same global scope, and **Sailthru does not document the precedence when two of them share a name.** In anything beyond a one-line greeting, qualify it: `{profile.vars.first_name}`.

Zephyr variable names are case sensitive.

Vars can hold JSON. An array of objects passed as `vars={"products":[{"name":"Widget A","qty":3}]}` is referenced as `{products[0].qty}`.

Dates stored on a profile must be written in `yyyy-MM-dd`:

```zephyr
{api_user({'vars': {'canceled_date': date('yyyy-MM-dd', time('now'))}})}
```

`api_user()` writes to the profile and is documented as *"for use only within a trigger custom Zephyr script."*

---

## 5. Purchases, returns, and the cart

```zephyr
{profile.purchase_incomplete}          the cart, or null
{profile.purchase_incomplete.items}    line items
{profile.purchase_incomplete.price}    order total, in cents
{profile.purchase_incomplete.qty}
{profile.purchase_incomplete.time}
```

Each item carries `qty`, `title`, `price`, `id`, `url`, `tags`, `images.thumb`, `images.full`, and `vars`.

`profile.purchases` has the same shape per order, plus `id`, `price`, `qty`, `time`.

The canonical abandoned-cart guards:

```zephyr
{* Setup — do not send an abandoned-cart email to someone with an empty cart *}
{assert(profile.purchase_incomplete, 'user has nothing in shopping cart')}
```

```zephyr
{* Or, on a later message in the series *}
{cancel(profile.purchase_incomplete == null, "user's cart is empty")}
```

Lifetime value, since there is no aggregate field:

```zephyr
{* Setup *}
{total = 0}
{foreach profile.purchases as i, p}{total = total + p.price}{/foreach}
```

```zephyr
{* Body *}
{if total > 20000}You've spent ${number(total/100, 2)} with us!{/if}
```

Most recent order:

```zephyr
{purchases = sort(profile.purchases, '-time')}
{purchases[0]}
```

Remember `sort()` mutates — see §7.

---

## 6. Prices are integers in cents

Sailthru *"requires [price] to be in cents."* A $15.00 book has `"price": 1500`. A $450.00 jacket has `"price": 45000`.

```zephyr
{c.title} for ${number(c.price/100, 2)}!        ✅  $15.00
{c.title} for ${c.price}!                       ❌  $1500
{c.title} for ${number(c.price, 2)}!            ❌  $1,500.00
```

This applies to feed items, purchase items, cart items, and order totals alike. It is the most common cosmetic bug in Sailthru templates and it ships to the inbox looking plausible.

A content var such as `membership_price` set by the merchant may be in dollars as a string — those are *your* fields, with your conventions, and `int()`/`number()` casting may be needed. Only the platform's own `price` field is guaranteed to be cents.

---

## 7. Content feeds and the `content` array

*"Your feed data will be made available to the template via an array named `content`."*

```zephyr
{content[0].title}
{content[0].url}
{content[0].image}
{content[0].tags}
{content[0].vars.sailthru_category}
{date('MMMM dd, yyyy', content[0].date)}
```

`date` is added automatically on spider, as a UNIX timestamp.

Three feed types:

- **Content Feeds** — generated from your Content Library (Google Product Sync, the Personalize JavaScript spider, or the Content API), filtered by tags and vars.
- **External (URL) Data Feeds** — your own feed, added on the Data Feeds page so the platform caches it and provides a proxy URL. JSON recommended.
- **Merged Feeds** — up to seven feeds combined, each behind a key: `{Custom.content[0].url}`, `{Personalized.content[0].url}`.

### Feed format rules

- JSON needs the `Content-Type` header `application/json` (or `text/javascript`); *"the content-type HTTP header must be set to `application/json` for the feed to be parsed."*
- A `url` field is required on each item — *"be sure to include a 'url' field, as this is required for the feed to load."*
- Top-level keys of a JSON feed become template variables directly: a feed with `"main_title"` gives you `{main_title}`.
- XML and RSS are converted to JSON. Attributes become `@attribute`, mixed content becomes `#text`. RSS loops as `{foreach rss.channel.item as item}`.
- Serving `text/html` puts the whole body into `{html}`. Documented but *"discouraged."*
- **Hyphens in keys break dot notation.** `{stream[0].vars.sailthru_doctor}` is fine; `{content['real-estate'][0].title}` is the escape hatch.
- **External feeds do not support spaces in var names.**

### Content Feed configuration that changes template behaviour

| Setting | Effect worth knowing |
|---|---|
| **Maximum Items** | Ceiling 3,000 |
| **Minimum Items** (Fresh) | Paired with *If Minimum Not Found* |
| **If Minimum Not Found → Go further back in time** | *"a feed with fewer content items than the minimum will be returned"* — **the send proceeds** |
| **If Minimum Not Found → Return a 404** | *"would prevent a scheduled campaign from sending if it is returned at the scheduled send time"* — **the only documented feed condition that stops a send** |
| **Repeat Chance** (Evergreen) | 1–100; lower means less likely to repeat across calls |
| **Weight Items** | `Unweighted`, `Popularity`, `Reduced Heat` (`log(pageviews)/time`), `Heat` (`pageviews/time`). All but Unweighted need the Personalize JavaScript on your site |
| **Ignore Expire Date** | `No` makes the `expire_date` meta tag a hard cutoff |
| **Remove Out of Stock** | Commerce accounts; drops items whose `inventory` is 0 |

**Feeds are not sorted by weight for you.** *"Content feeds are not automatically sorted by Weight. When selecting a Weight value, use the `sort()` function to order the results."*

**Tag normalization**: a tag entered as `Demo tag` is stored as `demo-tag` — lowercased, spaces to dashes. Meta names with a period store the period as an underscore; `og:` tags keep the colon.

### `sort()` mutates the global content array

```zephyr
{content = sort(content, '-price')}
```

Sailthru's own note: *"Calling `sort()` anywhere in the template will sort the entire content array, regardless if it's assigned to a specified variable."* And *"the `sort()` function cannot sort nested values. It only sorts top-level values."*

Two consequences:

1. A `sort()` written in the middle of the body silently reorders a loop that already ran above it in your mental model — and the loop below it too.
2. `{featured = sort(slice(content, 0, 3), 'date')}` does not leave `content` alone.

Do all sorting once, in Setup, before anything renders.

---

## 8. Recommendations pinning, and why `filter_content()` exists

Before a campaign goes out, a merchandiser can open **Recommendations** and *"edit your feed's content and sequence to customize the campaign. For example, pin a featured item to the first slot in your template and customize its title."*

That pinning lives outside your Zephyr, and your Zephyr can destroy it.

| Function | Effect on pinned items |
|---|---|
| `filter_content(array, lambda)` | *"returns a new list with only the elements that evaluated to true **as well as any items that were saved as a pinned item in Recommendations**"* |
| `filter(list, lambda)` | Filters without regard to pinning |
| `dedupe(array [, field])` | Drops duplicates without regard to pinning. *"If you want to deduplicate a content feed while maintaining the locations of content items that are pinned using Recommendations, use `filter_content()` instead"* |
| A list comprehension | No pinning awareness |

**Rule: on the feed's `content` array, reach for `filter_content()`. On any other array, `filter()`.** Sailthru's own framing: *"If you want to filter objects other than a data feed, such as arrays, use `filter()` instead of `filter_content()`. You should also use `filter()` if you want to filter data feed content without regard to whether items are pinned."*

```zephyr
{content = filter_content(content, lambda x: contains(x.tags, 'furniture'))}
{content = filter_content(content, lambda x: !contains(x.tags, 'explicit-content'))}
{content = filter_content(content, lambda c: length(c.image) > 0)}
```

Deduplicating by title while keeping pins — Sailthru's documented idiom:

```zephyr
{duplicates = []}
{content = filter_content(content, lambda x: contains(duplicates, x.title) ? false : duplicates = duplicates + [x.title] || true)}
```

`dedupe()` defaults to the `url` field and accepts any Content API attribute, including vars: `{content = dedupe(content, 'vars.item_id')}`.

The failure mode is invisible in preview if you happen not to be the user whose recommendation the pin affects, and invisible to the merchandiser until the send. Ask whether Recommendations is used on the campaign before recommending `filter()`.

---

## 9. The Personalization Engine and `personalize()`

`personalize()` *"returns an array of the best-matching content or products for the user whose template is currently being rendered."* It belongs in Setup.

```zephyr
{content = personalize({
  'algorithm': 'interest',
  'content': content,
  'size': 20,
  'include_tags_all': ['boots', 'child']
})}
```

| Algorithm | Source | Needs |
|---|---|---|
| `popular` | Content Library — purchases all-time, or views if no purchase data | Email use requires Support to enable |
| `trending` | Gained popularity in the past week | Email use requires Support to enable |
| `context` | Items co-viewed/co-purchased with a given `context_key` URL. **Does not use user data** — good for unknown users and cart reminders | Email use requires Support to enable |
| `purchased` | Similar to what this user bought | Email use requires Support to enable |
| `viewed` | Similar to what this user browsed | Email use requires Support to enable |
| `interest` | The feed's items matched to the user's interest tags — the same engine as legacy `horizon_select()` | **Requires a data feed** |
| `random` | Randomized from a feed | Site Personalization Manager only |
| `custom` | Up to 100 items you preselected, by URL, SKU, title, or `content_id`, e.g. from `profile.vars.recommendations` | Email use requires Support to enable |

Notes that matter:

- *"For all algorithms except `interest`, the content is sourced directly from your Content Library"* — no feed needed.
- `include_tags_any` + `include_tags_all` together form an **AND**. `exclude_tags_any` + `exclude_tags_all` together form an **OR**.
- `image_required: false` is needed to include items without images.
- `allow_expired: true` ignores `expire_date`.
- **When an item's URL changes it becomes a new item**, starting at zero pageviews and purchases, and duplicating the old one until the old URL is deleted from the Content Library.
- Line breaks are supported inside `personalize()` and — explicitly — not inside other functions.

Interest data is also reachable directly: `horizon_interest('tag')` returns a float where `1` is the average user's interest and `2` is twice that; `horizon_count('tag')` returns pageviews; `horizon_set_interest()` adjusts a score *"only… within the current message scope."* Any of these requires the Personalize JavaScript on the site.

---

## 10. The `feed`, `blast`, and `message` objects

**`feed`** — metadata about the feed powering this send.

```zephyr
{feed.name}
{feed.url}
{feed.filter_tags[0]}
{feed.filter_out_tags}
{feed.filter_vars}
{feed.filter_out_vars}
```

Useful for swapping a header per feed: `{if feed.name == 'Sports Feed'}…{else if feed.name == 'Politics Feed'}…{/if}`.

**`blast`** — campaign sends only.

| Field | Type |
|---|---|
| `blast.id` | integer |
| `blast.name` | string |
| `blast.list` | string — the target list |
| `blast.suppress_list` | string |
| `blast.from_email` | string |

The documented use is a list-level opt-down: `{optout_confirm_url}&list={blast.list}`, then read `{list}` on the opt-out page.

**`message`** — transactional messages and triggers. *"intended for use with Triggers that require a custom Zephyr script… the message object applies only to a sent email, so it would refer to the first transactional email that hosts the trigger."*

| Field | Type |
|---|---|
| `message.template` | string |
| `message.revision_id` | integer |
| `message.send_time` | integer |
| `message.open_time` | integer |
| `message.click_time` | integer |
| `message.purchase_time` | integer |
| `message.opens` / `message.clicks` | arrays of `{ts, ip}` |
| `message.sample` | A/B sample string |

```zephyr
{if message.open_time}{api_send('Welcome 2A - Openers')}{else}…{/if}
```

`message.opens` and `message.clicks` contain recipient IP addresses. Do not render them, log them, or forward them anywhere.

---

## 11. Send-API vars and transactional data

Variables passed on a Send API call land in the **global scope**, referenced bare: a send with `vars={"order_id":"1234"}` gives `{order_id}`.

This is the same namespace as profile vars and feed top-level keys, with no documented precedence between them. Two practical rules:

1. Prefix transactional vars distinctly at the integration layer (`txn_order_id`) rather than hoping the collision never happens.
2. On the **Preview** tab, **Test Vars** injects exactly this kind of data — JSON, or a simple `name=dave` — so you can render the template as the API will. Note that *"if a var already exists, it will not be overwritten."*

---

## 12. Code Snippets

Reusable blocks under **Content → Code Snippets**, referenced by name:

```zephyr
{include 'footer'}
```

- In an HTML template, paste the include where the block should appear. In a Visual template, add it to an HTML content block, or use **Use Snippet** in Email Settings → Advanced to drop it into Setup.
- More complex snippets — anything containing a personalization function — *"need to be placed in the Advanced tab in your template settings."*
- **Includes cannot be nested.** *"Include syntax is not dynamically evaluated, so an include can't be nested inside another include."*
- Names must be unique, ≤150 characters, and **renaming or deleting a snippet breaks every template using it**. The editor lists affected templates on delete.
- Version history keeps the last 20 changes; up to 15 can be favourited so they are not overwritten.

---

## 13. Limits

| Limit | Value |
|---|---|
| Data feed size | **16 MB** per feed |
| Feeds in a Merged Feed | 7 |
| Content Feed Maximum Items | 3,000 |
| `profile.purchases` | last 100 completed purchases |
| `profile.returns` | last 100 returns |
| `personalize` `custom` algorithm keys | 100 items |
| Code Snippet name | 150 characters, unique, immutable in practice |
| Code Snippet version history | 20 changes, 15 favouritable |
| Repeat Chance | 1–100 |

Sailthru recommends minifying feeds — *"Blank spaces in feeds unnecessarily increase the size of data feeds."*

The **Clipping Estimator** on the Preview tab gives a size estimate, with the caveat that *"personalization content can vary between subscribers"* and that link rewriting happens after the message leaves the platform, so the final size differs.

---

## Sources

Zeta Engage by Sailthru: [Zephyr Overview](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/syntax-overview.html) · ["Profile" Object](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/profile-object.html) · ["Blast" Object](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/blast-object.html) · ["Message" Object](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/message-object.html) · ["Feed" Object](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/feed-object.html) · [Template Variables](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/template-variables.html) · [Link Rewriting With Zephyr](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/link-rewriting.html) · [Data Feeds Overview](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/overview.html) · [Set Up a Data Feed](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/set-up.html) · [Create a Content Feed](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/create-feed.html) · [Call an External Data Feed](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/call-external-data-feed.html) · [Use Feeds and Content Data in Templates](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/feeds-content-data-templates.html) · [Code Snippets](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/code-snippets.htm) · [personalize](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/personalize.html) · [filter_content](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/filter-content.html) · [filter](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/filter.html) · [dedupe](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/dedupe.html) · [sort](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/sort.html) · [number](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/number.html) · [horizon_interest](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/horizon-interest.html) · [Template Editor](https://products.zetaglobal.com/sailthru/Content/messaging/email/html-templates/template-editor.html)
