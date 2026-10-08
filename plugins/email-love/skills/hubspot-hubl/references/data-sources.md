# HubSpot — Data Sources and Field Paths

Where a value in a marketing email comes from, what it is called, and what it costs you against the limits.

## Contents

1. [The five sources](#1-the-five-sources)
2. [Personalization tokens](#2-personalization-tokens)
3. [`contact` and `account`](#3-contact-and-account)
4. [CRM functions](#4-crm-functions)
5. [Programmable email](#5-programmable-email)
6. [Workflow-automated email](#6-workflow-automated-email)
7. [Single-send API](#7-single-send-api)
8. [Required email variables](#8-required-email-variables)
9. [Default email modules](#9-default-email-modules)
10. [Smart content](#10-smart-content)
11. [Limits](#11-limits)

---

## 1. The five sources

| Source | Shape | Available in |
|---|---|---|
| Personalization tokens | `{{ contact.firstname }}`, or the Personalize menu | Every marketing email |
| `personalization_token()` | Function with a fallback argument | Every marketing email — **the fallback idiom for email** |
| CRM functions | `crm_object()` `crm_objects()` `crm_associations()` | Programmable email only. Counted against limits |
| Workflow custom tokens | `{{ custom.key }}` | Automated emails sent from the workflow that defines them. Marketing Hub Enterprise |
| Single-send API properties | `{{ custom.NAME }}`, plus `contactProperties` | Single-send API sends. **Not usable inside `{% if %}`** |

Smart content is a sixth mechanism but is not HubL at all — see §10.

---

## 2. Personalization tokens

HubSpot does not publish a canonical reference of token paths for email. The authoritative list for a given portal is the **Personalize** menu in the email editor, which inserts the token for you. Ask the user to copy it from there rather than guessing: internal property names diverge from labels routinely (`firstname` with no underscore, `hs_object_id`, `hs_persona`, `hs_lead_status`).

Token types HubSpot documents as available in marketing email:

| Type | Notes |
|---|---|
| Contact properties | Default and custom |
| Company properties | From the contact's associated company |
| Office location | From the email footer settings |
| Subscription type | The subscription the email is sent against |
| Deal, ticket, custom object, custom event, invoice, quote, cart, user | *"in automated emails with appropriate subscriptions"* — not in an ordinary campaign send |

### Fallbacks

Three places a fallback can live, and only one of them is code:

1. **Global default** — Settings → Marketing → Email → Personalization, per property. *"Default values can be set globally for pages and marketing emails."*
2. **Per-token fallback** — the **Fallback value** field in the editor's Personalize dialog, which overrides the global default when you clear the *Use this property's global default value* checkbox.
3. **`personalization_token("contact.firstname", "there")`** — in code.

**What does not work in email is the filter form.** `{{ contact.firstname|default("there") }}` is documented as a CMS-and-blog capability: *"You can apply HubL filters to personalization tokens, such as contact and company tokens, on HubSpot CMS and blog pages, but not in emails."*

### Empty, missing, and unknown

HubSpot does not document the difference between a contact whose property is an empty string, a contact who has no value for the property at all, and a recipient HubSpot cannot resolve to a contact. All three are commonly reported as rendering the same blank. Treat them as one case, set a fallback, and verify with a preview as a seed or test contact in each state rather than reasoning about it.

---

## 3. `contact` and `account`

The variables reference documents exactly two CRM dictionaries:

| Variable | HubSpot's description |
|---|---|
| `contact` | *"A dictionary that stores contact property values for a known contact."* |
| `account` | *"A dictionary that stores company property values from a known contact's primary associated company."* |

Note the name: **`account`**, not `company`. HubSpot's knowledge base talks about "company tokens" in the email editor, and the editor inserts them for you, but the developer reference names the dictionary `account` and does not state whether `{{ company.name }}` resolves in a coded email template. If a user has `{{ company.* }}` in a template, do not assume it works and do not assume it fails — have them preview it against a contact with an associated company.

Both dictionaries carry a documented CMS-side caveat that using them *"will disable page caching"*. That is a pages concern; it has no email equivalent.

---

## 4. CRM functions

### `crm_object`

```hubl
{% set product = crm_object("product", 2444498793, "name,description,price") %}
{% set person = crm_object("contact", "email=someone@example.com", "firstname,lastname", false) %}
```

| Parameter | Type | Notes |
|---|---|---|
| `object_type` | String | **Case-sensitive.** `contact`, `company`, `deal`, `product`, a custom object's fully-qualified name |
| `query` | String | A record ID, or a query string |
| `properties` | String | Comma-separated. Omitting it returns a default common set |
| `formatting` | Boolean | Format dates and currency to account settings. `false` gives raw values |

Returns a **property dictionary** — access fields directly, `{{ product.name }}`.

### `crm_objects`

```hubl
{% set people = crm_objects("contact", "firstname__not_null=&limit=3", "firstname,lastname") %}
{% for person in people.results %}{{ person.firstname }}{% endfor %}
```

Returns a **wrapper**:

```
{ has_more: Boolean, offset: Integer, total: Integer, results: Array }
```

**Iterate `.results`.** Looping the wrapper renders nothing and raises nothing — the most common HubL CRM bug there is.

Maximum **100** objects returned; the default is **10**. `limit`, `offset` and `orderBy` go in the query string.

### `crm_associations`

```hubl
{% set related = crm_associations(847943847, "HUBSPOT_DEFINED", 2, "limit=3&years_at_company__gt=2", "firstname,email", false) %}
{% for r in related.results %}{{ r.firstname }}{% endfor %}
```

| Parameter | Notes |
|---|---|
| `id` | The source record's ID |
| `association_category` | `HUBSPOT_DEFINED`, `USER_DEFINED`, or `INTEGRATOR_DEFINED` |
| `association_type_id` | Integer association definition ID |
| `query` | Filters plus `limit` / `offset` / `orderBy` |
| `properties` | Comma-separated |
| `formatting` | Boolean |

Same wrapper shape. Same 100-object ceiling.

### Query operators

Appended to the property name with a double underscore: `property__operator=value`.

`eq` · `neq` · `lt` · `lte` · `gt` · `gte` · `is_null` · `not_null` · `in` · `nin` · `contains`

```hubl
{% set query = "price__lte=" ~ contact.budget_max ~ "&price__gte=" ~ contact.budget_min ~ "&limit=3&order=listing_name" %}
```

Build query strings with `~`, HubL's concatenation operator. Note that HubSpot's published version of this example applies `|int` to the contact tokens — a filter on a personalization token in an email, which the filters reference says does not happen there. The two pages disagree; see `references/troubleshooting.md`.

### Property metadata

```hubl
{{ crm_property_definition("contact", "firstname").label }}
{{ crm_property_definitions("contact", "firstname,lastname") }}
```

Returns `{label, type}` per property. Useful for rendering a picklist's display label rather than its internal value.

### A CMS-side restriction worth knowing

On public pages, only `product` and `marketing_event` are retrievable without password protection or membership login. That is a pages rule, not an email rule — but the *web version* of a marketing email is a public page, so a CRM-driven email whose web version must also work needs testing on that surface specifically.

---

## 5. Programmable email

**Marketing Hub Professional or Enterprise.**

Two ways to turn it on:

- **A custom module:** in the module editor's right column, *"toggle the Use module for programmable email switch on"* and agree to the sending limits.
- **A coded template:** add `isEnabledForEmailV3Rendering: true` to the annotation comment block at the top of the file, alongside `templateType: email`.

What requires it:

1. Any use of `crm_object`, `crm_objects`, or `crm_associations`.
2. **Personalization tokens inside a conditional.** *"If you're using personalization tokens within a conditional statement of your email module, you must enable programmable email for the module."* This is the one people miss — an `{% if %}` wrapped around a token in a module without the toggle does not behave.
3. Arrays passed through the single-send API's `customProperties`: *"The `customProperties` field only supports arrays when used with programmable email content."*

Documented operational restrictions:

- *"You cannot conduct an A/B test for a programmable email that includes a `crm_object`, `crm_objects`, or `crm_associations`"* function, because sends are slower.
- *"If you clone a programmable email, it cannot be sent while the original is still in a processing state."*
- *"Programmable emails with CRM functions should be sent at least one hour apart."*
- Include fallback data, so a query that matches nothing does not produce a blank email.

---

## 6. Workflow-automated email

Custom tokens let a workflow-sent email read data the contact record does not carry directly — *"enrolled record data, associated record data, or information retrieved from external sources via integrator actions."*

```hubl
{{ custom.key }}
```

**Marketing Hub Enterprise.** The binding is to the workflow, not the email: *"Tokens will only apply when the email is used with the specified workflow."* HubSpot recommends using each customized email with a single workflow, which is the honest way of saying the same email reused in a second workflow will render those tokens empty.

HubSpot does not document what renders when the association a custom token depends on is missing. Assume blank and set a fallback.

---

## 7. Single-send API

Two property maps in the request body:

| Field | Behaviour |
|---|---|
| `contactProperties` | *"a JSON map of contact property values. Each contact property value contains a `name` and `value`."* Written to the contact record |
| `customProperties` | *"a JSON map of key-value properties … not stored in HubSpot and will only be included in the sent email"* |

Referenced in the template as `{{ custom.NAME_OF_PROPERTY }}`.

**The restriction that defines this integration:**

> *"Information passed via the v3 or v4 single send APIs will not function within `if` statements, as the templates compile before the information populates."*

So every branch of the email has to be decided by something other than the payload — a contact property, a smart rule, or a different template per case. Design around it early; discovering it after the template is built means a rewrite.

Arrays in `customProperties` work only with programmable email content, and iterate normally:

```hubl
{% for item in custom.exampleArray %}{{ item.name }}{% endfor %}
```

If the template references a property the request omits, the API returns *"There are properties set up in the template that have not been included in the `customProperties`"*.

---

## 8. Required email variables

An email template that omits these will not publish. HubSpot's required set:

```hubl
{{ site_settings.company_name }}
{{ site_settings.company_street_address_1 }}
{{ site_settings.company_street_address_2 }}
{{ site_settings.company_city }}
{{ site_settings.company_state }}
{{ site_settings.company_zip }}
{{ site_settings.company_country }}
```

plus **either** `{{ unsubscribe_link }}` **or** `{{ unsubscribe_link_all }}`. Values come from the account's marketing email settings, not from the template.

Related email variables:

| Variable | Purpose |
|---|---|
| `unsubscribe_link` | *"the page that allows recipients to manage subscription preferences or unsubscribe"* |
| `unsubscribe_link_all` | Unsubscribe from all commercial email |
| `unsubscribe_link_single` | Unsubscribe from this email type only |
| `subscription_confirmation_url` | *"Dynamically generated on send"* |
| `subscription_name` | The email type's name |
| `view_as_page_url` | *"Generates a link that leads to a webpage version of an email"* |
| `content.email_body` | *"The main body of the email. This variable renders a rich text module."* |
| `content.subject` · `content.from_name` · `content.reply_to` | Header fields |
| `content.emailbody_plaintext` | Plain-text override |
| `content.name` · `content.absolute_url` | Email name, and the URL of the web version |

The design manager also expects preview-text markup for the clients that display it.

---

## 9. Default email modules

Reachable from a coded template with `{% module "name" path="@hubspot/module_path" %}`:

`@hubspot/email_body` · `@hubspot/email_can_spam` (office location information) · `@hubspot/email_subscriptions` · `@hubspot/email_subscriptions_confirmation` · `@hubspot/email_simple_subscription` (unsubscribe backup) · `@hubspot/email_header` · `@hubspot/email_text` · `@hubspot/email_section_header` · `@hubspot/email_cta` · `@hubspot/email_logo` · `@hubspot/image_email` · `@hubspot/email_linked_image` · `@hubspot/video_email` · `@hubspot/raw_html_email` · `@hubspot/email_social_sharing` · `@hubspot/email_post_listing` · `@hubspot/email_post_filter`

`@hubspot/email_can_spam` and one of the subscription modules are the module-shaped equivalent of §8's required variables. HubSpot does not state which modules are mandatory — the requirement is expressed against the variables, not the modules.

---

## 10. Smart content

Smart content is a UI rule set, not HubL, and it is the right tool when the branch is audience-shaped rather than data-shaped.

Across HubSpot content, rules can key on ad source, country, device type, referral source, preferred language, contact list membership, lifecycle stage, and query parameter. **In marketing email only two of those apply:** contact list membership and lifecycle stage. HubSpot's reason is that *"emails are sent to known contacts, you can't use smart content categories based on anonymous information like device type or referral source."*

Choose between them on this basis:

| Use smart content when | Use a HubL conditional when |
|---|---|
| The branch is "which list is this contact on" or "what lifecycle stage" | The branch is any other property, or a computed comparison |
| A marketer needs to edit both variants without touching code | The variants share most of their markup |
| You want the rendered variant recoverable on the contact record afterwards | — |

That last row is a real operational difference: **View sent email** on a contact record covers emails built with smart content or programmable modules, and does **not** cover emails that only use personalization tokens.

HubSpot does not document a maximum number of smart rules per module.

---

## 11. Limits

### The two regimes, which do not reconcile

**Developer changelog** — *Breaking Change: HubL Function Limits for Marketing Emails*, announced 27 Feb 2025, live 28 May 2025:

> *"a limit of 10 function invocations per each listed function per email"*

across 23 listed functions, including `crm_object`, `crm_objects`, `crm_associations`, `hubdb_table` and the `blog_*` family. Enforcement was staged: Review Panel warnings first, hardening to errors after 90 days.

**Knowledge base** — *Create programmable emails*:

> *"No more than 5 CRM functions can be added to a programmable email."*

with recipient ceilings per CRM-function count:

| CRM functions in the email | Maximum recipients |
|---|---|
| 1 | 500,000 |
| 2 | 250,000 |
| 3 | 165,000 |
| 4 | 125,000 |
| 5 | 100,000 |

**These are different units and neither page acknowledges the other.** Ten invocations *of each listed function* is not five *CRM functions total*. Report both, design to the stricter reading, and check the live pages before promising a large send.

### What happens when you exceed them

| Stage | Behaviour |
|---|---|
| Creating a new email | *"New emails exceeding the HubL function limit will prompt an error notification in the Review Panel and will not be published."* |
| An already-published email at send | *"if an email uses more than 10 function invocations, it will be dropped for that email recipient."* |
| The web version | *"The web version will return a 500 error if the limit is exceeded."* |

A dropped recipient is not a bounce and not a suppression. It is a per-recipient non-send, and §9 of `references/troubleshooting.md` covers how little of it is visible from the contact timeline.

### Function return limits

| Limit | Value |
|---|---|
| `crm_object` calls | 10 per page or email |
| `crm_objects` / `crm_associations` calls | 10 per page or email |
| Objects returned by `crm_objects` / `crm_associations` | 100 maximum, 10 by default |
| Macro nesting | 20 levels |

### Not documented

HubSpot publishes **no render timeout** for HubL in email, no maximum template size, and no cap on total HubL execution time. Do not claim one. A programmable email that renders slowly is described only through the operational advice to space CRM sends an hour apart.

---

## Sources

HubSpot: [HubL functions](https://developers.hubspot.com/docs/reference/cms/hubl/functions) · [HubL variables](https://developers.hubspot.com/docs/reference/cms/hubl/variables) · [HubL filters](https://developers.hubspot.com/docs/reference/cms/hubl/filters) · [If statements](https://developers.hubspot.com/docs/reference/cms/hubl/if-statements) · [Create emails with programmable content](https://developers.hubspot.com/docs/cms/guides/email/hubdb-crm-objects) · [Create programmable emails](https://knowledge.hubspot.com/marketing-email/create-programmable-emails) · [Breaking change: HubL function limits for marketing emails](https://developers.hubspot.com/changelog/breaking-change-hubl-function-limits-for-marketing-emails) · [Single send API](https://developers.hubspot.com/docs/api-reference/legacy/marketing/single-send/guide) · [Use personalization tokens](https://knowledge.hubspot.com/marketing-email/use-personalization-tokens) · [Create default values for personalization tokens](https://knowledge.hubspot.com/marketing-email/create-default-values-for-personalization-tokens) · [Use custom tokens in automated emails](https://knowledge.hubspot.com/workflows/use-custom-tokens-in-automated-emails) · [Default email modules](https://developers.hubspot.com/docs/reference/cms/modules/default-email-modules) · [Create and manage smart content rules](https://knowledge.hubspot.com/website-and-landing-pages/create-and-manage-smart-content-rules) · [Build a custom coded template](https://knowledge.hubspot.com/design-manager/build-a-custom-coded-template)
