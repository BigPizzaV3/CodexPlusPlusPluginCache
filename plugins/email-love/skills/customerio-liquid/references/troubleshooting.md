# Customer.io — Troubleshooting

## Contents

1. [The core behavior: missing data fails the send](#1-the-core-behavior-missing-data-fails-the-send)
2. [Delivery statuses](#2-delivery-statuses)
3. [Composer error strings](#3-composer-error-strings)
4. [Symptom lookup](#4-symptom-lookup)
5. [Preview and testing](#5-preview-and-testing)
6. [Documented gotchas](#6-documented-gotchas)
7. [Known documentation defects](#7-known-documentation-defects)
8. [Pre-ship checklist](#8-pre-ship-checklist)

---

## 1. The core behavior: missing data fails the send

> **"If your liquid statements don't evaluate properly—like if a profile doesn't have a `first_name` attribute—the message won't send. This is to prevent profiles from receiving incomplete messages! You'll see `Failed` in your message logs."**

The documented flow: missing attribute → is there a fallback? → yes = renders the fallback; **no = message failure**.

Design Studio adds: *"Sample data won't render if any of your liquid has errors. Messages with liquid errors will also fail to send."*

This is the opposite of Klaviyo and Braze, where missing data renders blank and the message ships. Customers migrating in are frequently surprised — worth stating explicitly rather than just adding the fallback.

### The silent exception

Referencing a **namespace that doesn't exist for that workflow type** — `{{trigger.relationship.x}}` on an event-triggered campaign, or `{{object.x}}` (singular root) anywhere — **renders empty with no error, and the message sends.**

So there are two distinct bugs with opposite symptoms:

- **Missing attribute inside a valid namespace** → `Failed`, loud.
- **Wrong namespace entirely** → blank, silent.

When a value is missing but the message went out, suspect the prefix, not the attribute.

---

## 2. Delivery statuses

| Status | Meaning |
|---|---|
| **Queued** | Being processed, not yet attempted |
| **Drafted** | Generated but requires manual send (Queue Draft) |
| **Attempted** | Handoff to the delivery provider started; can indicate a **retry-able** failure. Transient errors auto-retry with exponential backoff **up to 11 times over ~1 hour** |
| **Failed** | *"This message did not leave Customer.io for the delivery provider."* — *"In many cases, messages fail due to missing liquid variables, or a failure in liquid logic, resulting in an empty field or a misshapen message"* |
| **Undeliverable** | Recipient unsubscribed, hit a message limit, or was deleted. **From June 22, 2026** also: `from address does not belong to a verified sending domain` |
| **Suppressed** | Prior hard bounce, or the person marked a previous message as spam |
| **Sent / Delivered / Bounced / Opened / Clicked / Converted / Spammed** | Post-handoff, provider-reported |

**Workflow:** Message activity → filter by status → click the subject → the delivery detail page names the reason (e.g. the customer's name was missing) → **Fix** jumps into the template → after fixing, **Retry** on the delivery detail page. Retrying a webhook action sends a new request.

---

## 3. Composer error strings

Shown in the "Review Errors" modal. Not exhaustive, per Customer.io.

| Error | Cause |
|---|---|
| `Variable 'customer.eemail' is missing` | Typo, or the preview profile lacks the attribute |
| `subject can not be blank` | Required field empty |
| `header 'Content-Type' cannot be set to a custom value` | Denylisted mail header |
| `Header name can't contain whitespace` | Space in a custom header name |
| `if tag was never closed` | Missing `{% endif %}` |
| `capture tag does not expect else tag` | `{% else %}` inside `{% capture %}` |
| **`Unidentified method`** | **Filter applied to the wrong type — usually math on a string attribute. Fix with `\| plus: 0`** |
| `Syntax Error in tag 'if' - Valid syntax: if [expression]` | `{% if %}` with no condition |
| `Syntax Error in tag 'assign' - Valid syntax: assign [var] = [source]` | `{% assign = "apple" %}` |
| `Syntax Error in tag 'capture' - Valid syntax: capture [var]` | `{% capture %}` with no variable name |
| `Syntax Error in 'case' - Valid syntax: case [condition]` | `{% case %}` with no condition |
| `Syntax Error in tag 'case' - Valid else condition: {% else %} (no parameters)` | Malformed `when`/`else` |
| `Syntax Error in 'cycle' - Valid syntax: cycle [name :] var [, var2, var3 …]` | Bad `cycle` arguments |
| `Syntax Error in 'for loop' - Valid syntax: for [item] in [collection]` | Bad `for` form |
| `Unknown tag 'coyotes'` | Unrecognized tag |
| `'end' is not a valid delimiter for if tags. use endif` | `{% end %}` instead of `{% endif %}` |
| `Variable {{ customer.trial_expires } was not properly terminated with regexp: /}}/` | Missing closing brace |
| `Tag '{%' was not properly terminated with regexp: /\%}/` | Missing `%}` |

**`Unidentified method` is the one to recognize on sight.** Customer.io stores attributes as strings; any math or numeric comparison without `| plus: 0` produces it.

---

## 4. Symptom lookup

### Message shows `Failed`

| Cause | Fix |
|---|---|
| Attribute missing on that profile, no fallback | `\| default: "…"` (latest) or `{% if x != blank %}` (legacy) |
| Math or numeric comparison on a string attribute | `\| plus: 0` first |
| **Empty Liquid in a URL parameter** | A `utm_campaign` resolving empty with `cio_link` url_params on **fails the message** |
| Liquid logic error producing an empty required field | Check the delivery detail page's stated reason |

### Value renders empty but the message sent

**Wrong namespace for the workflow type.** Check the trigger:

- `{{event.x}}` in a segment-triggered or transactional campaign → no `event` namespace
- `{{trigger.x}}` in an event-triggered campaign → no `trigger` namespace
- `{{object.x}}` singular root → doesn't exist; it's `{{objects.<plural>[0].x}}`
- `{{trigger.<plural_slug>}}` → object triggers use the **singular** slug
- `{{trigger.relationship_attributes.x}}` → doesn't exist

### Unsubscribe link missing or dead

`{{unsubscribe_url}}` renders empty — it's the tag `{% unsubscribe_url %}`. Same for `{% view_in_browser_url %}` and `{% manage_subscription_preferences_url %}`.

`{% view_in_browser %}` must be **present in the email** for the hosted page to be generated at all. Email only.

### Links broken, or dates off, after nothing changed

Suspect a **Liquid version change**. `escape` stops URL-encoding in latest; timezone offsets change from hours to minutes. Hover the "last saved" date to check the message's version.

### Snippet renders literal Liquid

Liquid inside a **JSON array** in a snippet renders as literal text. Objects and strings are fine.

### Variable assigned in one place is empty in another

Snippet ↔ message scope is isolated in both directions. So is the version-detection idiom.

### `{% if objects.x.size == 0 %}` never matches

Documented — `.size` dot notation can't be compared with `==`. Use `> 0`.

### Attribute value contains visible `{{ }}`

The value itself contains Liquid. If it is an author-written template string your own workflow stored, `{% render_liquid journey.body %}` renders it. If it came from an LLM action, webhook, partner feed, or a profile/event value, the literal `{{ }}` is the safe outcome — do **not** render it; that would execute untrusted content as template code. Rebuild the message from author-written copy with allowlisted placeholders.

### Message sent to the wrong person's data

In a relationship-triggered workflow, `{{trigger.customer.x}}` is **the person whose relationship fired**, not the recipient. The recipient is `{{customer.x}}`.

---

## 5. Preview and testing

**Sample Data panel** in every editor — search for a profile by email or attribute values. Design Studio: personalization icon → "Previewing As" → dropdown or magnifying glass. Toggle **Preview** in the canvas toolbar (you can view sample data there but not add new Liquid); it also offers device sizes and visual-impairment simulation.

Customer.io's own advice, and the right thing to tell a user: **"Preview profiles that have your attribute data and who don't so you know how your fallback content renders."** Given that missing data fails the send here, the without-data preview is the important one.

### Send test emails

1. Select the email block → **Edit Content**
2. Choose a profile from **Sample Data** (this replaces `customer.*` Liquid)
3. **Send test…**
4. Up to **25 email addresses**, comma-separated
5. Optionally prefix `[TEST]` in the subject
6. Translated emails: send all languages, or just the default

Test sends never reach the sampled customer. **BCC and Fake BCC addresses do not receive test messages.** Same-domain From→To tests may be blocked by your own mail server — test to an external domain or allowlist Customer.io's IPs.

### Testing with event data

**You can only test with profiles who already performed the event.** Otherwise the Preview tab shows `event or event.<DATA_NAME> is missing`. The personalization panel can't surface event data if **no profile has performed the event in the last 30 days** — same window for API-triggered broadcast trigger data.

### Testing with trigger data

**API-triggered broadcasts** — paste representative JSON into the **JSON Sample** box. Watch the shape: you paste the *inner* object, not the `data` wrapper.

```json
{ "data": { "headline": "...", "date": 1511315635 } }   ← what you POST
{ "headline": "...", "date": 1511315635 }               ← what you paste
```

Then reference `{{trigger.headline}}`. Per-recipient data via `per_user_data` (matched by `id` or `email`) or `data_file_url` → `{{trigger.voucher_code}}`.

**Transactional** — Design Studio → Personalization panel → **Transactional Data (JSON)**, representing the `message_data` object of the API request.

**Journey attributes** — you must supply your own values: Sample data panel → **Journey** tab.

### What doesn't work in preview

- `{{delivery_id}}` renders **`unsent`**
- Redacted (admin-hidden) attribute values don't appear in previews or test sends

---

## 6. Documented gotchas

1. **Attributes are strings.** `| plus: 0` before math or numeric comparison, or `Unidentified method`.
2. **Missing attribute = Failed message**, not a blank.
3. **Wrong namespace = silent empty**, message sends.
4. **Unsubscribe and view-in-browser are `{% %}` tags.** `{{unsubscribe_url}}` renders empty.
5. **`{% view_in_browser %}` must exist in the email** or the hosted page is never generated.
6. **`{{ objects.x.size }}` can't be compared with `==`** — use `> 0`.
7. **`sort` is case-sensitive** and won't reorder arrays containing nulls.
8. **Snippet ↔ message variable scope is isolated** in both directions.
9. **Liquid in a JSON array inside a snippet renders as literal text.**
10. **Nested Liquid in attribute values needs `{% render_liquid %}` — but only for author-written template strings.** LLM-action and webhook-generated values are untrusted data: leave them unrendered and escaped.
11. **Drag-and-drop editor:** use the **Add Liquid** dropdown for anything with `&`, `>`, `<`, or a conditional.
12. **Empty Liquid in URL parameters fails the message.**
13. **Don't name object types "Customers" or "Relationships."** If you did, use `trigger._customer` / `trigger._relationship`.
14. **Attribute names are case-sensitive.** Avoid spaces, periods, hyphens, and special characters.
15. **`event_timestamp` ≠ `now`.**
16. **Anonymous in-app messages have no profile** — profile Liquid in shared snippets needs fallbacks.
17. **You cannot use Liquid inside the JavaScript option** in Create Event / Create-or-Update Profile actions.
18. **Sending in recipient timezone is incompatible with A/B variants** on one-time sends.
19. **Snippet edits need a couple of minutes to propagate** before activating a workflow.
20. **Snippets cannot be renamed** after creation.
21. **Journey attributes cap at 100 per journey** — further updates fail silently and the profile moves on.
22. **HTML does not render in subject lines** — a snippet with HTML shows raw code.
23. **A profile with an invalid (not empty) timezone** receives the message during the last date/time sent across all timezones.

---

## 7. Known documentation defects

Worth knowing because people copy from these pages:

- The **SMS dynamic-Sender-ID example** uses `{% else if customer.CSM == "zack" %}`. **`else if` is not valid Liquid** — it must be `{% elsif %}`.
- The **`from_json` example** on the tag list assigns to `greeting` but then reads `intro[0].greeting`.
- The **js-in-actions page** shows `{{ created_at | 'date: %B %d, %Y'}}` with the pipe and quote misplaced. Correct: `{{ created_at | date: "%B %d, %Y" }}`.

The official Customer.io MCP skill also conflicts with the public docs in three places. **Prefer the public docs:**

| Item | MCP skill says | Public docs (correct) |
|---|---|---|
| Snippets | `{% snippet "footer" %}` | `{{snippets.<name>}}` |
| Subscription prefs | `{% manage_subscription_preferences %}` | `{% manage_subscription_preferences_url %}` |
| View in browser | `{{view_in_browser_url}}` | `{% view_in_browser_url %}` |

The MCP skill is nonetheless the only source for three genuinely useful facts, all reflected in this skill: collections aren't addressable in Liquid, object triggers use singular-vs-plural slugs, and nonexistent namespaces render empty without error.

Note also that `/journeys/*` doc URLs still resolve but redirect to `/messaging/*`.

---

## 8. Pre-ship checklist

**Will it send**

- [ ] Every attribute reference has a fallback — missing data fails the message here
- [ ] Every math or numeric comparison has `| plus: 0` first
- [ ] No URL parameter can resolve to empty Liquid
- [ ] Subject line is not blank
- [ ] Dynamic From address resolves to a verified sending domain

**Will it be correct**

- [ ] Namespace matches the workflow trigger type (check the table in `data-sources.md` §2)
- [ ] `event.x` not `event.data.x`
- [ ] Singular slug under `trigger.`, plural under `objects.`
- [ ] Attribute names match exactly, including case
- [ ] `{% unsubscribe_url %}` as a tag, not a variable
- [ ] `{% view_in_browser %}` present if the hosted page is needed
- [ ] `.size` compared with `> 0`, not `== 0`
- [ ] Correct Liquid version assumed for `escape`, `default`, and timezone offsets
- [ ] `{% render_liquid %}` only on author-written template strings — never on model, webhook, feed, profile, or event values
- [ ] No variable assigned in one scope and read in another

**Verified**

- [ ] Previewed against a profile **with** the attribute
- [ ] Previewed against a profile **without** it — confirm the fallback renders and the message would send
- [ ] For event-triggered: previewed against someone who actually fired the event in the last 30 days
- [ ] For API-triggered: JSON Sample pasted as the inner object, not the `data` wrapper
- [ ] Test-sent to an external domain

---

## Sources

Customer.io: [Composer errors](https://docs.customer.io/messaging/liquid/composer-errors/) · [Message failed](https://docs.customer.io/messaging/metrics/message-failed/) · [Message statuses](https://docs.customer.io/messaging/channels/message-statuses/) · [Message activity](https://docs.customer.io/messaging/channels/message-activity/) · [Using Liquid](https://docs.customer.io/messaging/liquid/using-liquid/) · [Upgrade Liquid](https://docs.customer.io/messaging/liquid/upgrade/) · [Snippets](https://docs.customer.io/messaging/liquid/snippets/) · [Testing emails](https://docs.customer.io/messaging/channels/email/testing-emails/) · [Previewing broadcast data](https://docs.customer.io/messaging/send/broadcasts/previewing-broadcast-data/) · [Liquid in the visual editor](https://docs.customer.io/messaging/design-studio/emails/visual-editor/liquid-visual-editor/) · [Multiple from addresses](https://docs.customer.io/messaging/channels/email/headers/multiple-from-addresses/)
