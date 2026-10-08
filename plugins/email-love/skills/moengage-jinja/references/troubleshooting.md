# MoEngage — Troubleshooting

Symptom → cause → fix, where the evidence lives, and an honest list of what MoEngage does not tell you.

## Contents

1. [Symptom lookup](#1-symptom-lookup)
2. [The delivery funnel](#2-the-delivery-funnel)
3. [Error breakdown and the failure categories](#3-error-breakdown-and-the-failure-categories)
4. [The fallback forms and what each costs you](#4-the-fallback-forms-and-what-each-costs-you)
5. [Exact error strings](#5-exact-error-strings)
6. [Editor traps](#6-editor-traps)
7. [Preview and test sends](#7-preview-and-test-sends)
8. [Testing the user who is missing the attribute](#8-testing-the-user-who-is-missing-the-attribute)
9. [Documented gotchas](#9-documented-gotchas)
10. [What MoEngage does not document](#10-what-moengage-does-not-document)
11. [Pre-ship checklist](#11-pre-ship-checklist)

---

## 1. Symptom lookup

### The campaign reached fewer users than the segment

This is the MoEngage symptom, and nine times in ten it is a null attribute with no fallback. *"In the MoEngage email templates, a message containing a null value will not be sent."*

| Check | Where | What it tells you |
|---|---|---|
| **After Personalization Removal** | Campaign Analytics → Campaign Delivery funnel | The exact count removed for personalization, isolated from bounces, duplicates, and frequency capping |
| **Personalization Failed** | Error breakdown → Failed to Send | The same users, with a *See breakdown* link |
| **Personalization failure analysis** | That link | Split by **User Attribute / Event Attribute / Campaign Attribute / Undefined / Unknown / Custom Error Message** |

If the drop is at a *different* funnel stage — After B/U/C removal, After Invalid/Duplicate removal, After FC Removal — the template is not the problem and no amount of Jinja will fix it.

### Nobody received it at all

Not a gradual drop but a total one. Two causes, both documented:

- **A custom attribute colliding with a reserved MoEngage name** — `First Name` and friends. Personalization resolves to the empty MoEngage-tracked attribute for every user. See `references/data-sources.md` §1.
- **An attribute name that does not exist**, from a typo or a copy-paste. MoEngage classes this the same way as a per-user miss: *"not available in the system (for example, copy-paste errors)."*

### `Hi ,` arrived in the inbox

The opposite failure: the fallback was set to **No fallback**, so *"the user attribute will be removed if not present/resolved for that user"* and the message sent anyway. That is a deliberate setting, not a bug — someone chose it in the overlay. Switch to a Replace text fallback or to `MOE_NOT_SEND`.

### A condition never matches

Almost always `>` or `<` encoded to `&gt;` / `&lt;` by the rich-text editor. See §6.

### A table renders one row, or the loop tags appear at the top of the email

The `{% for %}` was placed between table content rather than inside hidden rows. See §6.

### Personalization works for one attribute but not another, only after publish

A **reserved event attribute name**. It previews fine and fails live. The [published list](https://help.moengage.com/hc/en-us/articles/32227149442324-Why-Does-Personalization-Not-Work-for-Some-Event-Attributes) is long — `Campaign Name`, `Revenue`, `Flow Id`, `Transaction ID`, `email subject`, and dozens more.

### An email with a personalized link never arrives

There is no fallback mechanism for personalized URLs at all. If the attribute inside the link does not resolve, the email is not sent, and nothing labels it.

### A product image is missing for some recipients

An item field absent from the catalog → the **Undefined** error category. The set was non-empty; the field inside one item was null. Guard the field, not just the set.

---

## 2. The delivery funnel

Campaign Analytics → Campaign Delivery. Read it top to bottom; each stage subtracts from the one above.

| Stage | What it represents |
|---|---|
| **Users with Email** | Users in the segment who have an email attribute |
| **After B/U/C removal** | Minus addresses that previously bounced, unsubscribed, or complained |
| **After Invalid/Duplicate removal** | Minus invalid addresses (no `@`, no `.`) and duplicates across profiles |
| **After FC Removal** | Minus users over the frequency cap |
| **After Personalization Removal** | **Minus users whose email could not be sent due to personalization failure** |
| **Sent** | Emails handed to the sender |
| **Delivered** | Confirmed by the delivery partner |

**Counting traps, before anyone tries to reconcile numbers:**

- **Sent already excludes** frequency-capped and personalization-failed users. It is not "targeted".
- The **campaign stats donut** computes failures as `Sent − Delivered`, a different population from the Error breakdown. MoEngage documents the mismatch and its cause: *"Those excluded errors could relate to a failure in personalization."*
- A user with both a user-attribute and an event-attribute failure is counted **twice** in the failure analysis and **once** under Personalization Failed. So the sub-categories can sum to more than the headline.

---

## 3. Error breakdown and the failure categories

Two top-level buckets, and knowing which one you are in halves the search space.

**Failed to Send** — the email never left MoEngage. Documented causes: control-group members; users removed for earlier bounces, unsubscribes, or complaints; invalid or duplicate addresses; and *"users for whom personalization attributes were not available and thus were dropped from the campaign."*

**Failed to Deliver** — MoEngage sent it and the transport failed: `SMTPException`, `SMTPDataError`, `SMTPSenderRefused`, `SMTPRecipientRefused`, `InvalidSMTPHostDetails`, `SMTPAuthenticationError`, `EncryptedConnectionFailed`, `Error in Attachments`, `CustomAPI`, `MaximumLimitExceeded`, and **Content API errors**.

Note where Content API failures land: **Failed to Deliver**, not Failed to Send, and the row covers both *"the personalized attributes are not available for some users"* and *"a connection could not be established with the Content API endpoint"* — one bucket for two different problems.

### Personalization failure categories

| Category | Means |
|---|---|
| **User Attribute** | A `UserAttribute[…]` value unavailable — for that user, or system-wide from a typo |
| **Event Attribute** | An `EventAttribute[…]` value unavailable |
| **Campaign Attribute** | Campaign-specific info missing, e.g. a campaign tag that was never set |
| **Undefined** | MoEngage could not fetch the value at all — the documented example is an item field missing from a product set |
| **Unknown** | Anything else |
| **Custom Error Message** | Your `{% MOE_NOT_SEND("reason") %}` strings, each with its own count |

That last row is the whole argument for the tag form. Everything above it tells you *a* user attribute failed. Only Custom Error Message tells you *which one, and why you decided it mattered*.

### One more failure mode worth knowing

If a Push campaign personalizes both the template **and** the backup notification, and neither has a fallback, *"the notification will not be sent to any users… because the template and backup are considered to be part of one payload."* Both need a fallback, not just the primary.

---

## 4. The fallback forms and what each costs you

| Form | Sends? | Shows in analytics as | Use it for |
|---|---|---|---|
| **UI: No fallback** | ✅ — value removed / empty string | Nothing | Genuinely optional decoration. Rare |
| **UI: Replace text** | ✅ — your text | Nothing | Cosmetic personalization: a greeting, a city name |
| **UI: Do not send** | ❌ | Personalization Failed, unlabelled | Quick guard when you cannot edit Jinja |
| `\|default('Guest')` | ✅ — the literal | Nothing | The Jinja equivalent of Replace text |
| `\|default('MOE_NOT_SEND')` | ❌ | Personalization Failed, unlabelled | Compact suppression inline in an expression |
| `{% MOE_NOT_SEND("reason") %}` | ❌ | **Your reason string + user count** | **Everything the email is actually about** |

Five fallback forms — three in the overlay, two in Jinja — plus the tag. MoEngage also documents a seventh shape that is a branch rather than a fallback:

```jinja
{% set firstName = UserAttribute['First name'] %}
{% if firstName %}Welcome, {{ firstName }}{% else %}Welcome!{% endif %}
```

That is the right form when the alternative is *different copy* rather than *no email*.

**The decision rule.** Ask what the email is for. If it is a promotion whose personalization is garnish, fall back and send. If it is a statement, a receipt, a booking, a balance, a cart, or an order status, `MOE_NOT_SEND` with a reason — because the alternative is an email that says "Your order has shipped" with a blank where the order number goes, and that generates a support ticket per recipient.

---

## 5. Exact error strings

| String | Meaning |
|---|---|
| `Error in parsing jinja template format. Error expected token ',', got 'integer'` | Documented two causes: *"String operators are applied to the integer data type values"*, or *"a double quotation mark is used instead of two single quotation marks"* |
| `Error in parsing jinja template format. Error expected token ':', got '}'` | Jinja syntax error, reported by the preview's error pane |
| `Field First Name expected string object, but got integer value` | Data Type Mismatch — the attribute's stored type is not what the template treats it as |
| `No matching value/attribute found for the user` | Uncategorized — aux data, or an attribute used in `{% if %}` logic without braces |
| `Content Blocks ['name'] not found` | The referenced content block does not exist in this workspace |
| `Content API with name 'X' not found in the database` | The API name in the template does not match a registered Content API |
| `Product Set X not found` | The product set name in the template does not match a configured set |
| `No event found for event name : X in the last 15 days` | Preview could not find a qualifying event for the selected user |
| `Unable to resolve personalization` | Test-send failure: *"the chosen user profile lacks the necessary attribute values required for the personalization fields"* |
| `There are errors that are preventing the preview to load.` | A `MOE_NOT_SEND` fired, or a required value is missing, for the previewed user |
| `Email content failed to resolve to valid HTML code.` | `<html>` or `<body>` missing — surfaces on test send when View-in-Browser is enabled |

**On save-time validation.** The **Custom Jinja Editor** does validate: *"An automatic syntax validation check is performed when you click Done… MoEngage prevents the chip from saving and displays an error message. The message specifies the line number of the first error."* It reports one error at a time — fix, save, get the next. The Custom **HTML** editor is not documented as doing the same, so a template pasted whole can save with Jinja that only fails later. Do not treat "it saved" as "it renders."

---

## 6. Editor traps

These break templates whose Jinja is perfectly correct. None of them raise a Jinja error.

### `<` and `>` in a rich-text field

MoEngage's default email editor is **Froala** — the Campaign Content API takes `email_editor` as `"Froala Editor"` (default) or `"Ace Editor"`. Rich-text editors HTML-encode bare `<` and `>` typed into content, so `{% if score > 5 %}` becomes `{% if score &gt; 5 %}` and the branch stops matching, silently.

**MoEngage does not document this behaviour**, so treat the fix as defensive:

- Prefer `==`, `!=`, `in`, `is`, and `not` over magnitude comparisons.
- Where a magnitude comparison is unavoidable, write it in the **HTML source view** or the Ace editor, then re-open the template after saving and confirm the operator survived.
- Grep any pasted template for `&gt;` and `&lt;` inside `{% %}` before reviewing anything else.

### BeautifulSoup rewrites the HTML on save

MoEngage publishes what it does. **Regardless of the Auto-format toggle**, it:

- adds a `<head>` if there isn't one, and injects `charset`, `robots`, and `googlebot` meta tags into it;
- inserts the **View in Browser** link and the **open tracking pixel**;
- runs **BeautifulSoup** to *"correct incomplete or malformed HTML tags"* — closing unclosed tags, converting `<b />` to `<b></b>`, and dropping a closing tag that has no opener.

With **Auto-format HTML code** on (Email → General Settings) it additionally removes empty tags, normalises whitespace, inserts `<br>` "where structurally required", **auto-inserts `<tbody>` inside `<table>`**, cleans up redundant `<br>` and `<div>`, converts deprecated tags to HTML5, removes unknown attributes, and *"fixes nested structures that are non-compliant with HTML rules."*

Consequence: **the saved template is not byte-identical to what you pasted.** A `{% for %}` sitting between a `<table>` and its first `<tr>` is in exactly the position a tidy-up pass will move. Re-open the template after the first save and read the Jinja before doing anything else.

### A `{% for %}` must wrap complete `<tr>` elements

MoEngage documents this directly: *"HTML editors move the JINJA code away from the table to the top if you place the JINJA code between the table content."* Their prescribed fix is a hidden dummy row per loop tag:

```html
<table>
  <tr style="display:none;"><td>{% for item in items %}</td></tr>
  <tr><td>{{item.name|e}}</td></tr>
  <tr style="display:none;"><td>{% endfor %}</td></tr>
</table>
```

The repeated unit is then a whole `<tr>`, and the loop tags are in cells the tidy-up pass has no reason to relocate. Same rule for `{% if %}` wrapping rows.

### Reserved attribute-name collisions

Covered in full in `references/data-sources.md` §1. It belongs on this list because the symptom — a campaign that reaches nobody — reads like an infrastructure failure rather than a naming one.

### Gmail clipping

MoEngage recommends keeping the template **under 90 KB**, and separately notes that `&nbsp;`, `&copy;`, `&reg;`, `&yen;`, `&pound;`, and `&cent;` can make Gmail show "Message has been clipped" even when it hasn't clipped. Conditional branches multiply template size — an email with four variants is four bodies in one file.

---

## 7. Preview and test sends

### Personalized preview

Available for **Push, Email, SMS, RCS, MMS, and WhatsApp**. Not available for In-App, OSM, Cards, or Connectors.

Select a user by an identifier (ID, email) and click **Fetch user data**. MoEngage loads every attribute the campaign uses, shows the configured fallback next to each, and lets you **edit the value or switch between the actual value and the fallback**, then Refresh to re-render. Product sets appear as editable JSON; Content API responses are fetched live and are editable as JSON, and *"if the endpoint is not reachable, an empty response is displayed"* so you can supply your own.

Then turn on **"Use sample data from the personalized preview for the test"** and send a real test with the same data.

**Limits worth stating up front:**

- **Update Preview** — the edit-and-refresh capability — is gated. *"To enable Update Preview for your account, please contact your MoEngage Customer Success Manager (CSM) or the Support team."*
- The **error-detection pane** is an **Early Access** feature, also CSM-gated.
- **Campaign attributes cannot be edited** in preview, and **campaign ID is a dummy value** because it does not exist until the campaign is created.
- If a product set, Content API, content block, or aux-data error occurs, *"the first error category encountered is shown on the UI"* — one at a time, unlike attribute errors which aggregate.

### Test sends

**Send via** takes: Custom Segment (max 50 users, randomly sampled if the segment is larger), Email ID for registered users, Email ID for non-registered users, Unique ID, or Mobile Number. With PII tokenized sending enabled, the Email ID (registered) and Mobile Number options disappear.

**"Personalise with a random user"** is auto-enabled for non-registered recipients and **overrides the selected user's real attributes** when it is on. If you are testing personalization against a specific profile, make sure it is off — this is the single most common way a MoEngage personalization test tests nothing.

Locale and variation combinations each get their own test email — two locales × three variations is six emails per recipient. Subjects are prefixed `[TEST]` or `[TEST - <Locale> - <Variation>]`. There is no daily limit on test sends.

The **Test results** page gives a per-recipient `Status`, `Failure reason`, and `Corrective action`.

### The standalone Jinja surface

**Test & Debug → Jinja AI → Test Code** renders a snippet against a fetched user profile outside any campaign — use a seed or test user's identifier — pick the identifier type, enter the value, click Fetch user data, read the Output. It is the fastest loop for iterating on one expression, and it does not require a campaign in draft.

---

## 8. Testing the user who is missing the attribute

The single test everyone skips, and the one that finds the bug.

**Preferred, if Update Preview is enabled for the workspace:** fetch a seed or test user in the personalized preview, then **clear the attribute's value in the preview pane** and click Refresh. If the preview blocks with an error, your guard is working. If it renders `Hi ,`, your fallback is "No fallback". If it renders `None`, your `|default` is the one-argument form and it did not fire.

**If Update Preview is not enabled**, you need a profile without the attribute — a seed user created without it, or, failing that, a throwaway segment:

1. Build a throwaway segment filtered on *attribute does not exist* for the attribute in question.
2. Test-send via **Custom Segment** against it — MoEngage samples up to 50 users.
3. Read the Test results table for `Unable to resolve personalization`.

**Three profiles, every time:** one with the value, one with the attribute absent, one where the attribute exists but is an empty string. The third is the one that separates a real fallback from an apparent one, because Jinja's one-argument `|default` does not fire on `''`.

For loops, test **zero items, one item, and many** — an empty product set and a set whose first item is missing an image are different bugs with the same-looking symptom.

---

## 9. Documented gotchas

1. **Null drops the user.** *"In the MoEngage email templates, a message containing a null value will not be sent."* Everything else on this list is downstream of it.
2. **Personalized URLs have no fallback.** An unresolved attribute in a link kills the email, unlabelled.
3. **Reserved user attribute names** — `Name`, `First Name`, `Last Name`, `Birthday`, `Gender`, `Location`, `Mobile Number`, `Email`, `ID`, `Advertising Identifier`. A same-named custom attribute loses.
4. **Reserved event attribute names** — a long published list. Fails after publish, previews fine.
5. **Event attributes only exist in event-triggered campaigns**; business event attributes only in business-event-triggered ones.
6. **Campaign attributes are Email-only**, and campaign ID is a dummy in preview.
7. **Autoescape is off.** *"It's your responsibility to escape variables if needed."* Pipe untrusted values through `|e`.
8. **Comments are `{# #}`**, and MoEngage's own published example of the comment syntax is not valid Jinja.
9. **HTML comments do not disable Jinja.** The Jinja pass runs first — a null inside `<!-- -->` still drops the user.
10. **Push template and backup are one payload.** Personalize both, fall back on both, or neither sends.
11. **Content API: five-second timeout, three retries**, batched in parallel across users.
12. **A duplicate email address across two profiles** produces an `Email Unsubscribe Drop`: one profile is dropped at the B/U/C check, the other is dropped by the provider, which identifies recipients by address.
13. **AMP tags render a blank preview** — MoEngage strips `<script>` for security, so AMP components never initialise.
14. **`use independent if statements rather than elif chains`** for multiple `MOE_NOT_SEND` guards, so the preview aggregates all failures at once.
15. **Attribute names are readable names, case- and space-sensitive.** Insert them with `@` rather than typing them.

---

## 10. What MoEngage does not document

Stated plainly, because guessing at any of these is how a campaign loses recipients.

**Which Jinja version is actually running.** Two current first-party pages say 3.1 and 2.8 respectively, on both documentation domains. Write to the 2.8 intersection; a 3.1-only construct on a 2.8 engine produces an undefined value, and undefined drops the user.

**Whether `|default('Guest')` fires on an empty string.** In stock Jinja2 it does not — only `|default('Guest', true)` covers `''`, `0`, and `None`. MoEngage never shows the two-argument form and never states the semantics. **Write `|default('Guest', true)` and verify it on a test send against a user whose attribute is present but empty.** This is the highest-value unknown on the platform, because the difference between the two forms is the difference between a fallback and a dropped recipient.

**Whether a missing attribute reaches the template as Undefined, as `None`, or as `''`.** All three are possible, they behave differently under `|default`, and nothing says which it is. `{% if x %}` is false for all three, which is why an explicit `{% if %}` guard is more predictable than a `|default`.

**What happens after the third Content API retry.** MoEngage documents *"retries the request up to three times"* and a *"five seconds"* timeout, and stops. Whether the message is dropped, whether the null propagates into the null rule, or whether an empty value renders is unstated. Do not assert one.

**Whether the `<`/`>` encoding actually happens, and in which editors.** That MoEngage's default email editor is Froala is documented. That Froala encodes typed `<` and `>` is Froala behaviour, not MoEngage documentation. The workaround costs nothing; the claim should carry the caveat.

**Whether `{% raw %}`, `{%- -%}` whitespace control, `{% include %}`, `{% macro %}`, and `{% set %}…{% endset %}` work.** All are standard Jinja and none appear anywhere in MoEngage's documentation. MoEngage's blanket line — *"MoEngage currently supports all other standard functions of Jinja"* — is about filters and global functions, not tags. Test before relying on any of them.

**Whether `{% set %}` at the top of a template stays in scope through the whole message.** Jinja's own semantics say a top-level `set` is not block-scoped, and MoEngage's aux-data examples re-declare the same variable in every field rather than hoisting it — which is what you would do if you were not sure either. Hoist within one field; do not assume a variable set in the subject line is visible in the body.

**Whether the subject line, body, and preheader render as one template pass or several.** Not stated. Assume separate, and repeat any `{% set %}` each field needs.

**Any published limit on template size for Jinja purposes, on loop iterations, or on render time.** The only size number MoEngage publishes is the 90 KB Gmail-clipping recommendation, which is a deliverability guideline rather than a platform limit.

---

## 11. Pre-ship checklist

**Will it render**

- [ ] `{% elif %}`, not `{% elsif %}`; `{% set %}`, not `{% assign %}`
- [ ] Filter arguments in parentheses — `|default('x')`, never `|default: 'x'`
- [ ] Subscript notation on every attribute containing a space
- [ ] No `&gt;` or `&lt;` anywhere inside `{% %}`
- [ ] No post-2.8 constructs: `namespace()`, `|tojson`, `|unique`, `loop.nextitem`
- [ ] Comments are `{# #}` — no Jinja hiding inside HTML comments
- [ ] Every loop and conditional in a table wraps whole `<tr>` elements, with the tags in hidden rows
- [ ] Template re-opened after the first save and the Jinja re-read

**Will it send**

- [ ] Every printed value has a decided answer for null
- [ ] Anything the email is *about* is guarded with `{% MOE_NOT_SEND("reason") %}`, not left to a silent default
- [ ] Multiple guards written as independent `{% if %}` blocks, not an `elif` chain
- [ ] Product sets guarded for emptiness **and** every item field used in an `src` or `href` guarded individually
- [ ] Any attribute used inside a personalized link is guarded earlier in the template — links have no fallback
- [ ] No custom attribute shares a name with a MoEngage standard or reserved event attribute
- [ ] `EventAttribute[…]` used only in an event-triggered campaign
- [ ] Push only: the backup notification is personalized and guarded too

**Will it be correct**

- [ ] Attribute names inserted with `@`, not typed from memory
- [ ] `|default('x', true)` rather than `|default('x')` wherever an empty string is possible
- [ ] Every value from an event, Content API, catalog, or aux-data file piped through `|e`; `|urlencode` only on path segments or query values, and every complete URL from data checked against an HTTPS allowlist
- [ ] `dateTimeFormatter` given both `tzOffset` and `timeZone` so users without an offset still localise
- [ ] Content API endpoint answers inside five seconds at load and is idempotent

**Verified**

- [ ] Previewed against a user who **has** the attribute
- [ ] Previewed against a user **missing** it — the guard fires
- [ ] Previewed with the value set to an **empty string** — the fallback still fires
- [ ] Loop previewed with zero, one, and many items
- [ ] Test sent with **"Personalise with a random user" turned off**
- [ ] After publish: **After Personalization Removal** checked against the expected number

---

## Sources

MoEngage: [Common Personalization Errors and FAQs](https://help.moengage.com/hc/en-us/articles/30958502449300-Common-Personalization-Errors-and-FAQs) · [Email Analytics and Info](https://help.moengage.com/hc/en-us/articles/16242513761556-Email-Analytics-and-Info) · [Campaign Analytics Page](https://help.moengage.com/hc/en-us/articles/206541483-Campaign-Analytics-Page) · [Why Do the Failed Counts in the Campaign Stats Donut and the Error Breakdown Not Match?](https://help.moengage.com/hc/en-us/articles/28721208369300-Why-Do-the-Failed-Counts-in-the-Campaign-Stats-Donut-and-the-Error-Breakdown-Not-Match) · [Users are removed due to Personalization Failure](https://help.moengage.com/hc/en-us/articles/360044391052-Users-are-removed-due-to-Personalization-Failure) · [Why Does Personalization Not Work for Some Event Attributes?](https://help.moengage.com/hc/en-us/articles/32227149442324-Why-Does-Personalization-Not-Work-for-Some-Event-Attributes) · [Why Does Parsing Jinja Template Format in the Personalization Preview Fail?](https://help.moengage.com/hc/en-us/articles/28720664391188-Why-Does-Parsing-Jinja-Template-Format-in-the-Personalization-Preview-Fail) · [Rendering Issues in HTML Templates](https://help.moengage.com/hc/en-us/articles/13546215631508-Rendering-Issues-in-HTML-Templates) · [What are the auto-formats MoEngage performs on an HTML template](https://help.moengage.com/hc/en-us/articles/39361162268820-What-are-the-auto-formats-MoEngage-performs-on-an-HTML-template-added-in-the-MoEngage-email-editor-Custom-HTML-Editor) · [Personalized Preview](https://help.moengage.com/hc/en-us/articles/30958544839828-Personalized-Preview) · [Test Email Campaign](https://help.moengage.com/hc/en-us/articles/41887668242964-Test-Email-Campaign) · [Dynamic Content Personalization](https://help.moengage.com/hc/en-us/articles/39719238781716-Dynamic-Content-Personalization) · [Merlin AI Jinja Assistant](https://help.moengage.com/hc/en-us/articles/37903498332436-Merlin-AI-Jinja-Assistant) · [Content APIs](https://help.moengage.com/hc/en-us/articles/115003622346-Content-APIs) · [Jinja Templating Language](https://help.moengage.com/hc/en-us/articles/115002757783-Jinja-Templating-Language)
