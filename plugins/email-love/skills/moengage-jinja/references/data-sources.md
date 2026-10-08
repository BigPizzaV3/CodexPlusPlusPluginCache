# MoEngage — Data Sources and Field Paths

Namespaces, exact paths, availability by channel, and the reserved names that silently break a campaign.

## Contents

1. [`UserAttribute`](#1-userattribute)
2. [`EventAttribute` and business events](#2-eventattribute-and-business-events)
3. [Campaign attributes](#3-campaign-attributes)
4. [`ProductSet` and recommendations](#4-productset-and-recommendations)
5. [`ContentApi`](#5-contentapi)
6. [Auxiliary data and `getAuxData`](#6-auxiliary-data-and-getauxdata)
7. [Content blocks and coupons](#7-content-blocks-and-coupons)
8. [Which namespace exists where](#8-which-namespace-exists-where)
9. [Where personalization is allowed](#9-where-personalization-is-allowed)

---

## 1. `UserAttribute`

```jinja
{{UserAttribute['First Name']}}
{{UserAttribute['Location']}}
{{UserAttribute['Email']}}
{{UserAttribute['uid']}}
{{UserAttribute['User Time Zone Offset (Mins)']}}
{{UserAttribute['Mobile Number'][-10:]}}
```

Subscript notation, using the **readable name** exactly as it appears in the personalization editor. There is no separate custom-attribute namespace: MoEngage's own tracked attributes and your custom ones share `UserAttribute`, and that is where the worst failure mode on the platform comes from.

### Reserved standard attribute names — the campaign-killer

MoEngage tracks its own standard attributes under these readable names:

```
Name              First Name        Last Name         Birthday
Gender            Location          Mobile Number     Email
ID                Advertising Identifier
```

If you also track a **custom** attribute with one of those names, personalization resolves to the **MoEngage-tracked** one. From MoEngage's own support write-up of a live incident:

> *"All the users targeted via an Email campaign were removed due to personalization failure… As the readable names of both the attributes, i.e. custom attribute 'First Name' and MoEngage Tracked attribute 'First Name', are the same, the personalization resolves to look into MoEngage tracked attribute and not the custom attribute."*

The template was `{{UserAttribute['First Name']|default('MOE_NOT_SEND')}}`, the tracked attribute was empty for the whole segment, and every single targeted user was dropped. Nothing in the UI warns you, and the preview against a user who happens to have both looks correct.

**When a campaign reaches zero or near-zero users, check this first.** MoEngage's guidance is blunt: *"It is not recommended to track custom attributes with same names as the MoEngage tracked attributes as these are reserved keywords."*

Both the Email and Push personalization pages repeat the warning independently.

---

## 2. `EventAttribute` and business events

```jinja
{{EventAttribute['Product Name']}}
{{EventAttribute['StoreName']}}
{% set y = EventAttribute['amount'] %}
```

**Event attributes exist only in event-triggered campaigns.** MoEngage: *"Event attribute-based personalization is available only for event-triggered campaigns."* Write `EventAttribute[…]` into a one-time or periodic campaign and every value is null, which on email means every user is dropped.

The attribute names available are the attributes of **the event configured as the campaign's trigger**. A different event's attributes are not reachable.

### Business event attributes

Business events are a separate source with their own personalization entry in the editor, and a narrower channel list: **Push, SMS, and Email only**, and only in **business event-triggered campaigns**. In the editor they appear under a *Business Event Attribute* heading rather than with user or event attributes.

### Reserved event attribute names

MoEngage reserves a long list of event attribute names for its own campaign bookkeeping, and personalization against one of them fails *after publish* while working fine in preview. The list includes `Campaign Id`, `Readable Campaign Id`, `Campaign Name`, `Campaign Type`, `Campaign Channel`, `Campaign Tags`, `Variation Id`, `Locale Id`, `Locale Name`, `Delivery Type`, `Goal Type`, `Goal Name`, `Revenue`, `Time to convert`, `Flow Id`, `Flow Name`, `Flow Trip Id`, `Stage Name`, `Transaction ID`, `Request ID`, `Alert ID`, `Notification Type`, `Message Parts`, `Time to deliver`, `Time to Send`, `MOE Event Category`, `MOE Event Source`, `email subject`, plus the Facebook and Google Ads audience-sync attributes. The [full list is published](https://help.moengage.com/hc/en-us/articles/32227149442324-Why-Does-Personalization-Not-Work-for-Some-Event-Attributes) — check it if one attribute out of several behaves differently from the rest.

The signature: *"everything works properly except for one specific attribute… after publishing the campaign, despite no problems during testing or preview."*

---

## 3. Campaign attributes

```jinja
{{ campaign name / campaign ID / campaign tags — inserted from the editor }}
```

**Email only.** MoEngage's channel matrix gives campaign attributes a `Yes` for Email and `No` everywhere else. Documented members: **Campaign ID**, **Campaign name**, **Campaign tags**.

Two behaviours worth knowing before you use them:

- **Campaign attributes cannot be edited in personalized previews.**
- **Campaign ID is a dummy value in preview**, because *"the campaign ID gets generated only after the campaign is created."* So a link built on campaign ID cannot be verified before publish.
- A missing campaign tag produces its own error category — **Campaign Attribute** — in the personalization failure analysis.

---

## 4. `ProductSet` and recommendations

`ProductSet` is an array of item records — from a user action (Product Viewed, Added to Cart) or from a configured Recommendation. The key is the set's own name:

```jinja
{{ProductSet.MyRecommendation[0].title}}
{{ProductSet.Recommendation_recommended_items[0].sub_category}}
{% for product in ProductSet.MyRecommendation[-1:] %}{{product.title|e}}{% endfor %}
{% for product in ProductSet.MyRecommendation[:-1] %}{{product.title|e}}{% endfor %}
```

Item fields (`title`, `price`, `description`, `image`, `sub_category`, and so on) come from **your catalog**, not from MoEngage — the attribute list in the editor is populated from the catalog's fields.

### Always guard the set before looping

Every MoEngage-published ProductSet example is written as a guard:

```jinja
{% if ProductSet.MyRecommendation %}
  {% for product in ProductSet.MyRecommendation[:3] %}
    <td>{{product.title|e}} — {{product.price}}</td>
  {% endfor %}
{% else %}
  {% MOE_NOT_SEND("recommendation set empty for this user") %}
{% endif %}
```

Their own snippets use a bare `MOE_NOT_SEND` in the `else`; prefer the tag form with a reason string so the drop is labelled in the Error breakdown.

**A missing field on an individual item is its own failure category.** *"If the image attribute is unavailable for a specific product in a product set, this will result in an `Undefined` error."* So an item that exists but has no image URL can drop the recipient even though the set was non-empty. Guard the field, not just the set, for anything that goes into an `src` or an `href`.

### Aggregations MoEngage publishes

```jinja
{{ y|map(attribute='title')|join(',') }}                        BTC,DOT
{{ y|map(attribute='price')|sum }}                              60
{{ y|selectattr('title','equalto','DOT')|list|length }}          occurrences
{% for i in y|groupby('title') %}…{% endfor %}                  highest occurrence
```

All of these are pre-2.8 Jinja and safe under either version reading.

### Drag-and-drop product rows

Outside the HTML editor, recommendations are inserted as a **Product Sets row** (ROWS tab → Product Sets), where you pick the set, a row layout, a product-block layout, and an **Information Mapper** that binds catalog attributes to the design — including *"what happens if any of the available properties are missing in the catalog."* Only Layout 3 supports fetching more than one item. If someone is working in the drag-and-drop editor, that mapper is where the missing-field behaviour is configured and it is easy to leave at its default.

---

## 5. `ContentApi`

A Content API is registered once in the dashboard (**Settings → APIs → Content API**, or **Settings → Advanced Settings → Content API**) with a name, method, URL, headers, and key-value parameters. Parameter values can be static or personalized with `@` — but **parameters cannot be personalized with event attributes**, only user attributes.

The template then calls it by that registered name:

```jinja
{% set weatherAPI = ContentApi.Weather({({"params":{"q":"London,uk","appid":""},
     "static_params":{},"dynamic_params":{},"request_body":{}})}) %}
{% for weather in weatherAPI.weather %}{{weather.description|e}}{% endfor %}
```

and the short form, when the parameters are all configured dashboard-side:

```jinja
{% for cart_item in ContentApi.cart().items %}
  <h2>{{ cart_item.name|e }}: {{ cart_item.price|round(2) }}</h2>
  {# a complete image URL: allowlist-check the domain, then escape for the attribute — |urlencode would mangle the scheme #}
  <img src="{{ cart_item.image|e }}" alt="">
{% endfor %}
```

The response is parsed JSON — address it with ordinary dot and index notation.

### Timeouts, retries, and the gap

> *"If a Content API call fails due to a timeout, MoEngage retries the request up to three times. The maximum API timeout limit is five seconds."*

**What happens after the third retry is not documented.** MoEngage does not say whether the message is dropped, whether the null propagates and the user is removed under the null rule, or whether an empty value renders. Do not tell anyone which of those it is. What *is* documented is that Content API failures surface as a **Content API errors** row under **Failed to Deliver** in the Error breakdown, described as occurring *"when the personalized attributes are not available for some users or when a connection could not be established with the Content API endpoint"* — which is the same bucket for both causes and so cannot distinguish them for you.

Design the endpoint to answer inside five seconds for the worst case, not the median, and to be idempotent, because retries are automatic.

### Volume

MoEngage batches campaign users and calls the endpoint **sequentially within a batch, in parallel across batches**. Their published worked example: 3M users at a batch size of 500 is 6,000 batches, and with 100 machines × 10 processes, *"1000 API calls can go out in parallel."* Batch size and machine count vary by channel and are not published. Size the endpoint for parallel load, not for the campaign's send rate.

### Operational

- **VPC or non-public endpoints** must allowlist MoEngage's published IP ranges for your workspace's region.
- **PII masking** is configurable per API: set *Mask PII fields* to Yes and choose the field names to mask in MoEngage logs and UI.
- **OAuth** (Authorization Code and Client Credentials) exists but is enabled by CSM/Support, not self-serve. Token expiry must be returned in the auth response so MoEngage can refresh.
- Content APIs are **not available in Cards**. They are available in Push, Email, SMS, In-App, OSM, WhatsApp, and Connectors.

---

## 6. Auxiliary data and `getAuxData`

Auxiliary data is an imported file — a lookup table keyed by a user identifier — for data you do not want stored on the MoEngage profile at all. MoEngage's own example is a bank's credit-card statement file: user ID, first name, last four digits, amount due.

```jinja
{% set aux = UserAttribute['uid']|getAuxData('aux_data_cc_due_info_list') %}
{{ aux.First_Name|default('Customer', true) }}
{{ aux.Last_4_Digits_of_CC }}
{{ aux.Amount_Due }}
```

The filter's shape: **the piped value is the lookup key, the argument is the imported file's name**, and the result is a record whose fields are the file's column headers. Column names become attribute names verbatim, underscores and all.

MoEngage's editor emits the `{% set %}` **once per field**, repeating the whole lookup for every value it inserts. Hoist it: one `{% set %}` at the top of the template, then address `aux.*` throughout.

Supported on Push, Email, SMS, In-App, OSM, Cards, Connectors, and WhatsApp — **not** Facebook or Google Ads audiences.

Aux data errors are reported under the **Uncategorized** category in the personalized preview, not under User Attribute, which makes them harder to spot in the preview pane than a plain missing profile field.

---

## 7. Content blocks and coupons

**Content blocks** are reusable text or HTML fragments — headers, footers, T&Cs — inserted from the personalization editor (`@` → Content blocks tab), not via a Jinja tag. Both HTML and text blocks are available for email; HTML blocks are **not** available for Push, SMS, or WhatsApp.

Jinja written **inside** a content block resolves against the campaign that uses it, with a condition: for an event-attribute personalization to work, *"ensure the event used for personalization is selected in the trigger criteria of the event-triggered campaign."* The same applies to business events. A block that works in one campaign can therefore be null in another — and null drops the user.

There is a toggle to insert **only the content** of a block rather than a live reference. Doing that freezes it: *"any updates to the content block that happen later won't get reflected in this campaign."*

Preview reports a missing block as a **Content Block** error, e.g. `Content Blocks ['whaapp_cb_1'] not found`.

**Coupons** are their own personalization type in the editor and are previewable. A user-level coupon code stored as a custom attribute is just a `UserAttribute` lookup, and MoEngage documents that pattern for both Email and Push. Coupon-data errors show under the **Unknown attribute** category in the preview pane.

---

## 8. Which namespace exists where

MoEngage publishes this matrix. Read the row before writing the code.

| Source | Push | SMS | Email | WhatsApp | In-App | OSM | Cards | Connectors |
|---|---|---|---|---|---|---|---|---|
| User attributes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Event attributes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Business event attributes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Campaign attributes** | ❌ | ❌ | **✅** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Recommendations / product sets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auxiliary data | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Content API | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** | ✅ |
| Text content block | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HTML content block | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |

Two more availability facts that are not in the matrix:

- **Personalized preview** exists for Push, Email, SMS, RCS, MMS, and WhatsApp. It does **not** exist for In-App, OSM, Cards, or Connectors — for those channels the only test is a real send.
- **Event attributes require an event-triggered campaign**, and **business event attributes require a business-event-triggered campaign**, regardless of what the channel column says.

---

## 9. Where personalization is allowed

For **email**, MoEngage supports personalization in:

- **Email Subject**
- **Email Content** (both the drag-and-drop editor and the Custom HTML editor)
- **Sender Name** — note *"the No fallback option is not available for the Sender Name field"*
- **From email address**
- **Reply-to email address**
- **Image URLs**, via Image personalization — with its own fallback choice: a fallback image, or do-not-send. This fires *"if the attribute is not correctly resolved or there is no image present at the URL after resolving the attribute."* Match the fallback image's dimensions to the real one or the layout distorts.
- **Link destinations**, via Link personalization — **with no fallback of any kind.** *"If the personalized URL fails to find/resolve the user attribute, the email will not be sent to the user. There is no fallback mechanism for personalized URLs."*

The preheader / **Preview Text** field sits in the same Sender Details block as Subject and Sender Name and is personalized the same way; MoEngage's auxiliary-data walkthrough configures it alongside them.

For **push**: message title, body, and summary; rich content (images and coupon codes); and **click actions — deep-link URI, and the values of key-value pairs**, on both Android and iOS. Personalized push notifications *"are not sent to iOS Inbox as of now."*

For **SMS**: any content field showing the *Type @ to personalize* placeholder. Note the SMS fallback wording differs from email's — with **No fallback**, *"the personalized attribute will be substituted with an empty string in case of personalization failure"* and the message still goes. The null-drops-the-user rule is documented specifically for **email templates**; do not assume the other channels behave identically in either direction, and confirm on a test send.

---

## Sources

MoEngage: [Message Personalization Overview](https://help.moengage.com/hc/en-us/articles/30926654573972-Overview) · [Jinja Templating Language](https://help.moengage.com/hc/en-us/articles/115002757783-Jinja-Templating-Language) · [Use Cases for Jinja](https://help.moengage.com/hc/en-us/articles/26117413479828-Use-Cases-for-Jinja) · [Personalize Email Content](https://help.moengage.com/hc/en-us/articles/360058752932-Personalize-Email-Content) · [Personalize Push Campaigns](https://help.moengage.com/hc/en-us/articles/206630173-Personalize-Push-Campaigns) · [Personalize SMS Campaign](https://help.moengage.com/hc/en-us/articles/8999394705556-Personalize-SMS-Campaign) · [Personalize Content Using Recommendations](https://help.moengage.com/hc/en-us/articles/30958493514644-Personalize-Content-Using-Recommendations) · [Using Recommendations in Email](https://help.moengage.com/hc/en-us/articles/17598910966804-Using-Recommendations-in-Email) · [Content APIs](https://help.moengage.com/hc/en-us/articles/115003622346-Content-APIs) · [Personalize Content Using Content APIs](https://help.moengage.com/hc/en-us/articles/30958494853652-Personalize-Content-Using-Content-APIs) · [Personalize Content Using Auxiliary Data](https://help.moengage.com/hc/en-us/articles/30958529175316-Personalize-Content-Using-Auxiliary-Data) · [Personalize Content Using Content Blocks](https://help.moengage.com/hc/en-us/articles/30958528203156-Personalize-Content-Using-Content-Blocks) · [Users are removed due to Personalization Failure](https://help.moengage.com/hc/en-us/articles/360044391052-Users-are-removed-due-to-Personalization-Failure) · [Why Does Personalization Not Work for Some Event Attributes?](https://help.moengage.com/hc/en-us/articles/32227149442324-Why-Does-Personalization-Not-Work-for-Some-Event-Attributes) · [Personalized Preview](https://help.moengage.com/hc/en-us/articles/30958544839828-Personalized-Preview)
