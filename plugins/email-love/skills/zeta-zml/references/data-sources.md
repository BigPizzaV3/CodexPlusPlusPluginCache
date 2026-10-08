# Zeta ZML — Data Sources and Field Paths

Where each value comes from, the exact tag that fetches it, and the ways each one returns nothing.

## Contents

1. [The profile namespace](#1-the-profile-namespace)
2. [System objects](#2-system-objects)
3. [Resources — `{% resource %}` and `{% resources %}`](#3-resources--resource-and-resources)
4. [Recommendations](#4-recommendations)
5. [Event data](#5-event-data)
6. [Content feeds](#6-content-feeds)
7. [Media assets](#7-media-assets)
8. [Coupons](#8-coupons)
9. [Segments](#9-segments)
10. [Limits](#10-limits)

---

## 1. The profile namespace

**Every example in Zeta's ZML reference section references a People Property bare, with no namespace prefix.**

```zml
{{ first_name }}                                     ZML overview page
{% if first_name %}Hello {{ first_name }}!{% endif %}  Tags page, Types page
{% if color_preference == "red" %}                   Operators page
{% if subscription_preferences contains "newsletter" %}  Operators page
{% for preference in subscription_preferences %}     Types page, Tags page
{% assign pre_date = last_contacted | date: '%s' %}  Skip Message page
{% recommendation d | count: 5 | filter: 'keywords', '=', '{{animal_preference_2}}' %}
```

`loyalty_points` is named on the Types page as *"a common number [property]"* and is likewise shown bare. The Look-Ups page reinforces it from the other direction, warning that a `{% resources %}` variable name *"should not conflict with property names that may be available on the profile"* — a collision that can only exist if profile properties occupy the bare namespace.

**Zeta never states this as a rule.** There is no sentence anywhere in the ZML section saying "profile properties are referenced without a prefix." It is inferred from consistent example usage, which is weaker evidence than a specification.

**And one first-party page contradicts it.** The Campaign Proofing page — an operational page outside the ZML reference section — writes:

> *"dynamic user attributes such as `{{user.first_name}}`, `{{user.location}}`, or `{{user.last_purchase}}`"*

with worked examples using `{{user.first_name}}`, `{% if user.tier == "Gold" %}`, and `{{user.first_name | default: "there"}}`. The Content Script Converter page adds a third form, describing migration mappings into *"`properties`, `person`, or `event.properties` paths in ZMP."*

**How to handle it.** Write bare — it is what the reference section, the Objects page, and every ZML worked example do, and it is the form the account's own property list produces. But say you assumed it, and tell the user to confirm in a preview against a dedicated seed or test `uid` before the campaign is activated. A wrong namespace here does not error; it renders nothing (`references/syntax.md` §2), so a preview that shows a blank name is the *only* signal you will get.

**Property naming rules:** names *"cannot contain spaces and cannot be changed"* once created, and properties cannot be deleted. The HTML editor's autocomplete is authoritative for what exists — *"typing out double curly braces `{{` will open an auto-suggestion of available properties for use."* That is the fastest way to settle a spelling question.

**Two generated property families** are worth knowing because they look like typos:

| Prefix | Meaning |
|---|---|
| `ns_` | Populated by ZMP from the user agent and geo-IP — `ns_city`, `ns_country`, `ns_device_type`, `ns_utm_source`, and so on |
| `z_` | Same fields, but customer-supplied data is preferred and `ns_` is the fallback. *"The `z_` field mapping logic will not mix sources"* |

Implicit properties available on every profile include `created_at`, `signed_up_at`, `last_contact`, `last_opened`, `last_clicked`, `last_seen`, `last_updated`, `has_active_email`, `has_active_phone`, `has_active_push_device`, `has_active_subscription`, `known_to_customer`. Dates among them are ISO 8601 strings.

---

## 2. System objects

Bare, no namespace, documented on the Objects page.

```zml
{{uid}}                        user_id of the individual being mailed
{{recipient_email}}            email address being mailed
{{recipient_contact}}          contact-level object — see below
{{account.account_key}}        {{account.site_id}}  {{account.content_site_id}}
{{current_date}}               UTC, YYYYMMDD
{{account_current_date}}       account timezone, YYYYMMDD
{{current_timestamp}}          Unix epoch ms, UTC
{{account_current_timestamp}}  Unix epoch ms, account timezone
{{campaign_name}}              {{campaign_token}}
{{account_company_address}}    the CAN-SPAM mailing address from Settings
{{unsubscribe_link}}           {{manage_preferences_link}}  {{optin_link}}
{{view_email_in_browser_link}}
{{images_path}}
{{message_uid}}                unique ID for this copy of the message
{{nudgespot_message_id}}       same value as message_uid
```

**`recipient_contact` properties:** `contact_type` · `contact_value` · `subscription_status` · `inactivity_reason` · `created_at` · `updated_at` · `preferences` · `last_inactivity_updated_at` · `last_clicked` · `last_opened` · `last_sent` · `last_purchased` · `domain` · `is_scoped` · `signed_up_at` · `double_opt_in_status` · `country_code` · `area_code` · `timezone` · `geolocation` · `phone_type`

The HTML Editor page notes: *"You must call the `contact_value` to get the email of the users."*

**Campaign object:**

```zml
{{campaign.id}}  {{campaign.name}}  {{campaign.campaign_token}}
{{campaign.campaign_type}}  {{campaign.channel}}  {{campaign.recurrence_index}}
{{version.name}}  {{version.id}}
{{targeted_segment_name}}  {{targeted_segment_id}}
```

Two documented traps here:

- *"The implementation of liquid `campaign.targeted_segment_name` is not supported."* Use `campaign.targeted_segment_id`.
- **`targeted_segment_id` does not work in previews.** *"This liquid variable will only be functional during the actual campaign send, as audience evaluation takes place at that time… the recipient generated for preview/proof is a mock version without specific details."* A blank there in preview is expected, not a bug.

---

## 3. Resources — `{% resource %}` and `{% resources %}`

Resources are Zeta's catalog/feed layer: *"product listings of a client's domain like e-commerce, arts, banking, and more. This list is synced to ZMP daily."* Fields are **account-specific custom schema**, so no field name below is universal — `resource-type`, `pubDate`, `category`, `title` are Zeta's illustrative examples.

### Single resource

```zml
{% resource product | id: sku | resource_type: 'item' %}
{{product.title}}
```

`id` is the resource ID. `resource_type` is optional but *"recommended… for faster lookup performance during campaign delivery."*

**Variants** are child nodes of a product, reachable by key:

```zml
{% resource product | id: "9097" %}
{% assign get_v_p = product["variants"]["100083508"] %}
```

### Multiple resources

```zml
{% resources adrec
  | count: 3
  | filter: 'resource-type', '=', 'article|product'
  | filter: 'pubDate', 'AFTER', '-P1D'
  | sort_field: 'pubDate'
  | sort_order: 'desc'
%}
```

| Option | Required | Repeatable | Notes |
|---|---|---|---|
| variable name | Yes | — | First token. Stores the results |
| `count` | No | Last wins | *"Max 10 (best practice)"* |
| `filter` | No | **Appends** | Multiple `filter:` options are **AND'd** together |
| `sort_field` | No | Last wins | Special values `bt_updated_at`, `recency`, `bt_statistics.viewed.cumulative.P7D`, `bt_statistics.viewed.cumulative.P1D`. *"The timestamp field… No other data type is supported"* |
| `sort_order` | No | Last wins | `'asc'` / `'desc'`. Only applies when `sort_field` is a **custom schema field** |
| `group_filters` | No | Appends | Resource Group UIDs, combined with an implicit **OR** |
| `expression` | No | Last wins | `(OR, (AND, 'uid1', 'uid2'), 'uid3')` |

**Only one filtering mechanism is used per tag.** *"A `{% resources %}` tag can only filter on one of the following types at a time: `expression`, `group_filters`, `filter`. If all are present, only the `expression` will be used to return resources."* The other two are dropped without a warning.

### Filter grammar — three parts, and the middle one is optional

```
filter: '<field_name>', '<operator>', '<value1>|<value2>|…'
```

Values are **always split on the pipe** into an array. Quotes around any part are stripped during parsing.

| Written | Parsed as |
|---|---|
| `filter: 'category', '=', 'shoes\|boots'` | field `category`, operator `=`, values `[shoes, boots]` |
| `filter: 'category', 'shoes\|boots'` | field `category`, **no operator sent**, values `[shoes, boots]` |
| `filter: 'category', '', 'shoes\|boots'` | field `category`, operator normalized to `=` in `{% resources %}`; **no operator sent** in `{% recommendation %}` |

> *"`filter: 'resource-type', 'article'` has two comma-separated parts — `resource-type` is the field name and `article` is the value. This is the 'without an operator' case, not the 'empty operator' case."*

That two-part form is the one people write by accident when they delete an operator, and it changes the query rather than failing.

### The operator allowlist — and the silent drops

| Operator | `{% resources %}` | `{% recommendation %}` |
|---|---|---|
| `=` | Yes | Yes |
| `NOT` | Yes | Yes |
| `CONTAINS` | Yes | Yes |
| `AFTER` | Yes | Yes |
| `BEFORE` | Yes | Yes |
| `EXISTS` | Yes | Yes (passed through) |
| `EQUAL` | **Not in the allowlist** | Yes (passed through) |
| `OR` | **Not in the allowlist** | Yes (passed through) |
| `BETWEEN` | **Not in the allowlist — silently dropped** | Yes (passed through) |

Two rules that produce a wrong result set rather than an error:

1. **`BETWEEN` does not work in `{% resources %}`.** It parses, it is dropped, and the query runs without that constraint. A price band or a date window written with `BETWEEN` returns the unfiltered set. Express the bound as `AFTER` plus `BEFORE`, or move the query to `{% recommendation %}`, or build it as a Resource Group in the UI and reference it by `group_filters:`.
2. **Operators must be UPPERCASE.** *"Lowercase like `after` will be silently dropped."* `'contains'` is not `'CONTAINS'`.

`{% recommendation %}` does the opposite and is no safer: *"No validation — any string passes through."* A misspelled operator reaches the API, which decides what to do with it.

### Date and duration values

Bounds take **ISO 8601 duration strings**, relative to now, not dates:

```zml
| filter: 'pubDate', 'AFTER', '-P7D'          published in the last 7 days
| filter: 'sku_last_updated', 'BEFORE', '-PT13H'
```

Zeta calls out the natural-language version explicitly: *"`sku_last_updated GREATER THAN 13 hours ago` won't return any results because it's not a valid format."* Both endpoints of a range are inclusive.

### Points Zeta itself flags

- **Variable names must be unique** and must not collide with a value used elsewhere in the tag, or with a profile property name. Zeta's example: do not name the variable `product` in a tag that filters on the value `product`.
- **`bt_created_at` and `bt_updated_at` filters only work for resources uploaded after 2025-01-01.**
- **Resource Group membership lags.** *"It may take up to 30 minutes for resources to be qualified as part of the resource group."* A group created minutes before a send can be empty.
- A Resource Group's **Recs UID** is generated from its name at creation and **never changes** when the group is renamed. `Recs UID` is also called `recs_group_uid`, `group_filters`, or `named_filter`.

### When it fails

`resource_fetch` — *"The system encounters an error while fetching a resource from the resources API"* — is a per-recipient `error` status, not a template error. A query that simply matches nothing is not an error at all: the variable is empty and the loop over it renders nothing.

---

## 4. Recommendations

```zml
{% recommendation articles | count: 3 %}
{{articles[0].title}}

{% recommendation example-cars | count: 3
   | filter: 'resource-type', '=', 'product'
   | filter: 'brand', 'CONTAINS', 'General' %}
```

The tag *"creates a variable called `articles` and assigns it an array of resource objects based on the entered count."* Filters take the same three-part grammar as `{% resources %}`.

**The behaviour that surprises people:** *"Filtering could reduce the quality of personalization. The Recommendations engine will override the filter if it cannot retrieve the requested number of recommendations."* So a `{% recommendation %}` with a filter can return items that do not match the filter. If a constraint is a hard requirement — in stock, in the right region, not already purchased — `{% resources %}` is the tag that respects it. Recommendations optimise for filling the slot.

**Field types** decide which operators are legal, and *"if an operator is not valid for that field's type, the API returns an error."*

| Type | Holds | Operator notes |
|---|---|---|
| TEXT | Freeform string | `CONTAINS` is **text only** |
| TAGSET | Set of string tags | Matching lowercases for comparison |
| FLAG | Boolean | For booleans use `EXISTS`, not `NOT` |
| COUNT / USD / SCORE | Integer / currency / float | Range operators |
| DATETIME | Numeric instant, epoch seconds | Compact filters accept **ISO-8601 durations only**, with `AFTER` / `BEFORE` / `BETWEEN` |
| URI | String URI | |
| GEO_POINT | `{"lat":…, "lon":…}` | *"only `EXISTS` is practical here"* in the simple filter format |

`EXISTS` requires **real JSON booleans**: *"The literal strings `"true"`, `"True"`, `"1"`… are strings, not booleans. Similarly, the numbers `1` and `0` are integers, not booleans. All of these will be rejected."*

**Other documented notes:**

- Filter names depend entirely on the account's resource schema. *"If a resource has an author, you can filter by it. If not, it doesn't work."*
- *"The image URLs are hosted on the client's server, not on Zeta's infrastructure"* — a recommendation block with broken images is usually the client CDN, not ZMP.
- Recommendations fire trackable events when *requested, served, viewed, or clicked*, visible in Report Builder as an Events report.
- The Advanced Recommendation API returns **422** — *"There are not enough recommendable resources to satisfy this request"* — when a group cannot be filled.
- When a recommendation cannot be fetched for a recipient, that recipient gets `error` / `recommendation_fetch`: *"This usually indicates strict meta-filters or not enough recommendable content."*

**Resource Groups** replace inline filters with a saved, UI-built rule set:

```zml
{% recommendation products | count: 3 | group_filters: "out_of_stock_products" %}
{% resources products | count: 3 | group_filters: "out_of_stock_products" %}
```

---

## 5. Event data

### The trigger event object

For a triggered campaign, an `event` object carries *"the same properties passed in the payload of the event."* Path shape is `event.<event_name>.<payload path>`:

```zml
{{event.purchased.last_purchased.items[0].productname}}
```

against a `purchased` payload of:

```json
{
  "session": "…",
  "last_purchased": {
    "items": [{"productsku": "J9834RHJ", "productname": "Some Cool Pants", "quantity": 1, "price": 45.68}],
    "total": 45.68,
    "cartuserdata": {"first_name": "Ryan", "last_name": "Malone", "email": "rmalone@example.com"}
  }
}
```

Two things follow. The **event name is part of the path**, so the same template cannot serve two differently named triggers without branching. And the payload shape is entirely the sender's, so nothing about it is guaranteed — index `[0]` on an empty `items` array yields nil and renders nothing.

Event data reaches non-content fields too. A campaign FAQ documents an SMS override written as `to_sms_override: "{{event.text_signup.phone}}"`, and the failure when it is nil: `message_dispatch_error` with `undefined method 'start_with?' for nil:NilClass`.

### The event lookup tag

Past events, independent of what triggered the send:

```zml
{% event purchases | event_type: 'purchase' | count: 3 %}
{% for purchase in purchases %}{{purchase}}<br/>{% endfor %}
```

| Parameter | Meaning |
|---|---|
| `event_type` | *"The exact name of the account event to look up"* |
| `count` | How many past events to retrieve |

Newest-first ordering is not documented. Neither is the behaviour when the person has fewer events than `count` — expect a shorter array and guard the loop rather than indexing directly.

---

## 6. Content feeds

A Content Feed is an uploaded CSV of non-user metadata — stores, products, offers — keyed by a required `key_name` column.

```zml
{% feeds include: 'urls' %}
{{feeds['FeedName']['key_name']['column name']}}
{% assign feed = feeds['urls'] %}
```

**The `{% feeds include: %}` declaration must come first.** *"When referencing a feed, this code must be added above the individual references… to indicate to the system which feeds will be used."* A feed reference with no matching `include` above it has nothing to resolve against.

The key can be a literal or a variable: *"You can declare the `key_name` value explicitly or use a Liquid variable from a user or event property here to reference the correct row."* That is the join — a profile property naming the row.

| Rule | Detail |
|---|---|
| Row limit | *"less than 100K records"* |
| `key_name` | Required column, unique per row, **must not be empty** or whitespace |
| Quoting | *"the items in the file must not be surrounded by quotation marks"* — a quoted header row is shown as the wrong way |

**Failure mode:** when ZMP cannot fetch the feed, the recipient gets `error` / `external_content_fetch` — *"The system fails to fetch data from an external content feed. This usually indicates an error with the feed."* An empty feed lookup, by contrast, is silent; Zeta's own `skip_message` example guards it:

```zml
{% if ext_feed == empty %}{% skip_message message:"No data in feed" %}{% endif %}
```

---

## 7. Media assets

`{% media_asset %}` turns an Asset Library path plus filename into the hashed CDN URL, so templates can reference assets by human-readable names.

```zml
{% media_asset image_1 | path: '/campaign_images/12345' | name: 'funhotel' | type: 'png' %}
<img src="{{image_1}}">
```

| Option | Value |
|---|---|
| variable name | Arbitrary; how you reference the URL later |
| `path` | Exact Asset Library path in single quotes. Root is `'/'` |
| `name` | Exact filename, no extension |
| `type` | Exact file extension |

**The tag is bound to the original location.** *"You cannot move the asset to a new folder nor rename it without breaking the `{% media_asset %}` tag."* Zeta's own advice is to create a fresh folder per campaign rather than reuse one.

**It is account-scoped.** *"The media asset tag can only generate URL outputs for its own account"* — unlike a public asset URL, which is portable. This is the thing that breaks when a template is shared to a sibling account.

Combined with a feed, tags can be built from feed columns — and the ordering rule is strict: the `{% feeds %}` include and the `assign` must come **above** the `{% media_asset %}` tags that consume them.

In the Visual Editor the variable goes in the **Dynamic Url** field, not the URL field.

---

## 8. Coupons

```zml
{% coupon my_coupon | category: 'test' %}
Use {{my_coupon.coupon_code}} for {{my_coupon.description}}.
Expires {{my_coupon.expiration_date}}.
```

Zeta ingests coupon codes; it does not generate them. They arrive as CSV on the account FTP in `/coupon_codes`, with fields `category`, `coupon_code`, and optional `start_date`, `end_date`, `description`.

**Call the tag once and reuse the variable.** *"Make sure to use the coupon liquid tag only once and assign it to a variable, then use the same variable that was assigned first at other places instead of using the liquid tag and calling/assigning it again. This will ensure only one coupon is allocated per user."* Calling `{% coupon %}` twice allocates twice — and allocation is consumption.

| Rule | Detail |
|---|---|
| One-time use | *"These coupon codes are meant to be one-time-use coupons"* |
| Uniqueness | *"Coupon codes are unique regardless of category. Coupons can only be assigned to one category"* |
| Re-upload | Keyed by the code itself, so re-uploading **overwrites** its details including category. Already-assigned codes are recognised and suppressed |
| TTL | Max **12 months** from the **upload date**, not `start_date`. No `end_date` supplied means 12 months by default |
| Purge | 90 days after `end_date` — a 15-month maximum lifespan |
| Date format | ISO 8601, `yyyymmdd` |

**Running out is a skip, not a blank.** *"If coupon codes run out for a particular category, we will fail those sends with a `campaign_skipped` event with a reason of `coupon_allocation`."* The Campaign States page lists `coupon_allocation` under `error` rather than `skipped`; the two pages disagree on the status, but both agree the message does not go out. A preview error can be the same cause: *"it might be due to its allocated coupons being exhausted in the category."*

After a send, a `coupon_allocated` event is written to the profile with the campaign details and the code.

Barcodes are generated from a code via the barcode generator page, which emits a sample image URL. Roughly 35 symbologies are supported including CODE 128, QR-CODE, DATAMATRIX, PDF417, UPC-A, EAN 13, and POSTNET.

---

## 9. Segments

```zml
{% segments segment_names %}
```

Fetches *"all segments that the targeted user is part of"*, each as `{"id":nnn, "name":"sss", "token":"ttt", "type":"static/dynamic"}`.

Zeta's own idiom flattens it with `map` and tests with `contains`:

```zml
{% segments segment_names | map: "name" %}
{% assign segment_join = segment_names | join: "*" %}
{% if segment_join contains "Yankees" %}
  User is a Yankees Fan
{% elsif segment_join contains "Phillies" %}
  User is a Phillies Fan
{% endif %}
```

Note what the join-and-`contains` idiom costs: it is a **substring** test on the concatenated names, so a segment named `Yankees Lapsed` also matches `"Yankees"`. Where names overlap, iterate the mapped array and compare with `==` instead.

---

## 10. Limits

| Limit | Value |
|---|---|
| `{% resources %}` `count` | **10** (documented as best practice) |
| Content Feed rows | *"less than 100K records"* |
| HTML payload | No hard limit, but **over 102 KB** may be clipped by ISPs, *"notably Gmail"* |
| Snippet name | 50 characters; only hyphens and dashes as special characters |
| Snippet description | 200 characters |
| Coupon TTL | 12 months from upload; purged 90 days after `end_date` |
| Resource Group qualification lag | Up to **30 minutes** |
| Communication dispatch retries | **5**, then `communication_dispatch` error |
| `bt_created_at` / `bt_updated_at` filters | Only for resources uploaded after **2025-01-01** |
| Max send rate | 100K per hour, metered hourly |
| SMS segment | 160 GSM-7 characters; 70 if any non-ASCII character is present. GSM-7 extended characters count double *"except when they are used in liquid or merge tags"* |

**Snippet reference counting stops at one level.** *"Nested snippets beyond the first layer of code will not be included in this list"* — so the References tab under-reports where a deeply nested snippet is actually used. Renaming a snippet does **not** update its references.

---

## Sources

Zeta Knowledge Base: [Objects](https://knowledgebase.zetaglobal.com/kb/objects) · [Look-Ups](https://knowledgebase.zetaglobal.com/kb/look-ups) · [Recommendations](https://knowledgebase.zetaglobal.com/kb/recommendations) · [Resource Groups](https://knowledgebase.zetaglobal.com/kb/resource-groups) · [Tags](https://knowledgebase.zetaglobal.com/kb/tags) · [Skip Message](https://knowledgebase.zetaglobal.com/kb/skip-message) · [Content Feeds](https://knowledgebase.zetaglobal.com/kb/content-feeds) · [Media Asset Tag](https://knowledgebase.zetaglobal.com/kb/media-asset-zml-tag-user-guide) · [Coupon Code Setup](https://knowledgebase.zetaglobal.com/kb/coupon-code-setup) · [People Properties](https://knowledgebase.zetaglobal.com/kb/people-properties) · [ZMP Implicit People and Attribute Properties](https://knowledgebase.zetaglobal.com/kb/implicit-people-properties) · [Campaign States and Errors](https://knowledgebase.zetaglobal.com/kb/campaign-states-and-errors) · [Content Snippets](https://knowledgebase.zetaglobal.com/kb/content-snippets) · [HTML Editor](https://knowledgebase.zetaglobal.com/kb/html-editor) · [Campaign Proofing](https://knowledgebase.zetaglobal.com/kb/campaign-proofing) · [SMS and MMS Campaigns](https://knowledgebase.zetaglobal.com/kb/sms-and-mms-campaigns) · [FAQs (Campaigns)](https://knowledgebase.zetaglobal.com/kb/faqs-campaigns)
