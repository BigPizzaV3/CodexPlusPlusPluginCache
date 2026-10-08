# Braze — Troubleshooting

Symptom → cause → fix, the abort reason codes, and what preview won't tell you.

## Contents

1. [Symptom lookup](#1-symptom-lookup)
2. [Currents abort_type — the full enum](#2-currents-abort_type--the-full-enum)
3. [Message Activity Log](#3-message-activity-log)
4. [Messaging Diagnostics](#4-messaging-diagnostics)
5. [Exact error strings](#5-exact-error-strings)
6. [Preview and test sends](#6-preview-and-test-sends)
7. [Why didn't a user receive a message](#7-why-didnt-a-user-receive-a-message)
8. [Documented gotchas](#8-documented-gotchas)
9. [Pre-ship checklist](#9-pre-ship-checklist)

---

## 1. Symptom lookup

### Blank where a value should be

| Cause | Check | Fix |
|---|---|---|
| Wrong namespace | Is it standard or custom? | `{{${x}}}` for standard, `{{custom_attribute.${x}}}` for custom |
| Case mismatch | The profile | `Home_City` ≠ `home_city`. Dashboard-created names aren't auto-trimmed of whitespace |
| Attribute genuinely unset | Preview against that user | Add `\| default: 'x'` |
| `default:` not firing | The value | It fires on `""` but **not** on `" "` (whitespace only) |
| Event property in the wrong place | Message type | `event_properties` only in action-based campaigns and the **first step** of an action-based Canvas |
| `api_trigger_properties` in a Canvas | Message type | Campaigns only |
| `targeted_device` in email | Channel | Push, in-app, Banners only — email renders before send |
| Connected Content 404 | The endpoint | 404 renders an empty string with no error |
| Non-breaking space in a CC URL | The raw URL | U+00A0 is stripped before the request — retype the URL |

### Literal `{{${first_name}}}` in the sent message

| Cause | Fix |
|---|---|
| Liquid inside an HTML comment | *"HTML comments are removed before any Liquid is read"* — use `{% comment %}` |
| Single-quoted string in `assign` | `{% assign s = 'Hi {{${first_name}}}' %}` is literal. Use `capture` or `append` |
| Classic editor | Parses Liquid as plaintext — use the HTML editor, keep Liquid inside `<body>` |

### Message never sent, no delivery record

That's an abort. Go to §2 and §3. The most common causes are `abort_message` firing on a condition you didn't expect, exhausted Connected Content retries, or a `required=true` lookup miss.

**Affecting only part of the audience** is the signature of a data-dependent problem — the template is fine for users who have the attribute.

### Catalog image URL broken

Whitespace between `{% catalog_items %}` and `{{ items[0].image_link }}`. Keep them adjacent inside `src="…"`.

### Blank lines in a drag-and-drop message

Multi-line Liquid. Use `{%- -%}` whitespace control or put it on one line.

### Works in subject line but not body (or vice versa)

Braze renders each message field separately. An `assign` or `connected_content :save` in one field is invisible in the others. Repeat the call.

---

## 2. Currents `abort_type` — the full enum

The precise, machine-readable reason. Paired with `abort_log` (128 chars for Banners, up to 2,000 for Content Cards).

**General (any channel):** `liquid_abort_message` · `template_parse_error` · `rate_limit` · `campaign_disabled` · `campaign_does_not_exist` · `campaign_action_does_not_exist` · `message_variation_does_not_exist` · `user_not_in_segment` · `trigger_event_blacklisted` · `exhausted_retries` · `frequency_capped`

**Content and rendering:** `exhausted_cc_retries` · `connected_content_not_supported` · `promo_codes_not_supported` · `catalog_items_rerender_not_supported` · `blacklisted_media_url` · `blocked_media_url` · `invalid_media_url` · `ssl_error` · `invalid_http_status` · `http_timeout` · `missing_hostname`

**Email:** `exhausted_link_shortening_retries` · `missing_email` · `invalid_domain`

**Push:** `invalid_push_payload` · `sdk_not_supported`

**SMS/MMS:** `exhausted_link_shortening_retries` · `sms_empty_payload` · `sms_no_sending_numbers` · `sms_fatal_provider_error` · `sms_gateway_domain_not_allowed` · `blocked_recipient_country` · `mms_not_supported` · `no_current_messaging_service`

**WhatsApp:** `whats_app_no_sending_numbers` · `whats_app_invalid_template_message` · `whats_app_invalid_response_message` · `whats_app_fatal_provider_error`

**LINE / Kakao:** `line_fatal_provider_error` · `kakao_fatal_provider_error`

**Content Cards:** `content_card_size_exceeded` (>2 KB) · `content_card_content_invalid` · `content_card_expiration_invalid` · `content_card_general`

**In-app messages:** `no_longer_in_availability_window` · `maximum_impressions_reached`

**Webhooks:** `blocked_webhook_url`

`frequency_capped` puts the rule in `abort_log`, e.g. `Frequency cap rule: 5 email messages every 1 week`.

The two that mean "your Liquid is wrong": **`template_parse_error`** (syntax/render error — *"the message template could not be parsed due to a syntax or rendering error, so the send was canceled"*) and **`liquid_abort_message`** (your own `abort_message` fired).

---

## 3. Message Activity Log

Settings → Setup and Testing → Message Activity Log.

**Retention: 60 hours only.** Pull what you need before it ages out.

Aborted messages appear under message type **"Aborted Message Error"**, showing `{% abort_message %} called` or the exact snippet including your reason string. Note this category also catches non-Liquid causes.

**It samples, and this matters when judging scale:**

| Scope | Cap |
|---|---|
| Same error type + campaign/Canvas step + clock hour — Connected Content, Abort Message, Webhook, SMS rejection/failure, WhatsApp failure, A/B testing | **20** |
| Push errors per type + step + app + hour | 20 |
| Live Activity, APNS feedback per type + app + hour | 100 |
| Email bounce/block per type + step + hour | 100 |
| User aliasing per workspace + hour | 100 |

So "only 20 errors" may be 20,000. Use Currents or a connected warehouse for true counts.

Filterable categories include: push notification errors · aborted templated in-app message errors · webhook errors · mail errors · API message records · Connected Content errors · REST API connected audience errors · user aliasing errors · A/B testing errors · SMS/MMS errors · WhatsApp errors · Live Activity errors · bad user trigger errors.

**Not logged:** Content Card, in-app message, push, and email **test sends**. Only SMS, WhatsApp, LINE, Kakao, and webhook test sends are logged (prefixed `[TEST SEND]`, though the prefix isn't guaranteed for all error types).

---

## 4. Messaging Diagnostics

Analytics → Dashboard Builder → Messaging Diagnostics. GA but **gated** — contact your CSM. Requires "View Dashboard Reports" permission. **Last 7 days only.**

Braze warns these are human-readable dashboard labels, not raw event values, and *"counts or naming can differ between Currents and Messaging Diagnostics."*

**Content and rendering:** Content Card expired · Content Card invalid · Connected Content failed · In-app-message rendering timeout · **Liquid abort** · **Liquid rendering timeout** (*"It took too long to render the Liquid template. Most likely to occur for Banners, in-app messages, and email"*) · **Liquid syntax error** · Media URL failure

**Campaign and Canvas state:** Delay step failure · Exception or exit event · Inactive campaign · Inactive Canvas · Inactive Canvas step · Volume limited

**Rate limiting and timing:** Frequency capped · Quiet Hours abort · Rate limited over 72 hours

**User eligibility:** Duplicate user identifier · User failed pre-check for Message step · User failed pre-check for triggered message · User no longer eligible · User not eligible for step · User not re-eligible · User profile not found

**Channel and delivery:** Partner delivery error · Push credentials invalid · Subscription group failure · User not eligible for channel · Webhook failed

Plus an "Other" bucket.

---

## 5. Exact error strings

| Error | Meaning |
|---|---|
| `Unexpected end token` | Extra or missing braces. Usually `{{ }}` nested inside another Liquid tag's expression |
| `Liquid Error: Comparison of Time with String Failed` | A time attribute compared to `blank`/`""`. Fix: `{% assign d = {{custom_attribute.${expires}}} \| default: "" %}` then compare |
| `Invalid from email address for recipient:` | Liquid in the From address rendered invalid syntax |
| `Invalid 'properties' field` | A reserved purchase key used as a property name (`time`, `product_id`, `quantity`, `event_name`, `price`, `currency`) |
| HTTP **598** | Host Unhealthy — Braze *simulated* this; the host was circuit-broken |
| HTTP **599** | Connection error / network connect timeout |

Endpoint codes that trigger Braze's automated daily error email: **4XX** 400, 401, 403, 404, 405, 408, 409, 429 · **5XX** 500, 502, 503, 504, 598, 599.

**Note on save-time validation:** Braze documents no save-time Liquid validation. Every documented syntax failure is at **send time**. Do not assume a campaign that saves is a campaign that renders.

---

## 6. Preview and test sends

Four preview modes from the **Preview & Test** tab:

1. **Random user**
2. **Select Existing User** — enter a user ID or email; renders that user's stored data. Use a dedicated seed/test user, not a production recipient
3. **Preview as Custom User** — type mock values for standard and custom attributes
4. **Customize an existing user** — select a user, click **Edit** to make them editable

### Testing with event properties

Three documented methods:

1. **Trigger the campaign manually** — action-based delivery, target yourself, perform the event. For iOS push, add a 1-minute delay so you can background the app.
2. **Test send as Customized User** — add the property at the bottom of the page, your address at the top, Send Test.
3. **Preview as Custom User** — Braze's FAQ answer for previewing event property values, and *"also useful for messages with abort logic when you need preview values that do not trigger an abort."*

**There is no JSON payload editor for preview.** Braze's documented workaround is mock JSON via `capture` + `json_parse`:

```liquid
{% capture mock %}
{ "listings": [ { "name": "Summit Jacket", "price": {"actual":"89.00","currency":"USD"} } ] }
{% endcapture %}
{% assign response = mock | json_parse %}
{% for l in response.listings %}{{l.name}} — {{l.price.actual}}{% endfor %}
```

*"Without `json_parse`, dot notation on the captured string typically renders blank in preview."* **Remove mock blocks before launch.**

### What does NOT work in preview or test sends

- **Preview type coercion is wrong for untyped namespaces.** For `api_trigger_properties`, `canvas_entry_properties`, and `context`, *"the preview attempts to infer the type from the value — a string `"3"` may be coerced to the integer `3`."* Force with `| plus: 0` or `| append: ""`. Real types are preserved at send time.
- **Nested objects in Preview as Custom User** can only be mocked as a string or an array of strings.
- **Connected Content `:retry`** doesn't run in previews — you'll see *"This message would not have been shown because retry functionality was triggered."*
- **Preference center** — the Save Preferences button is disabled and preference-center Liquid may not resolve to valid links.
- **`List-Unsubscribe` header** is not included in test emails.
- **In-app messages and Content Cards** need a valid push token on the target device (test Content Cards arrive inside a push payload and expire in ~5 min). Banner tests are viewable for 5 minutes.
- **Action-based in-app messages require events logged through the SDK**, not the REST API.
- **Seed group emails** don't update the profile's Campaign Received list or increment Sends analytics.

On the Test Send tab, tick **"Override recipients' attributes with current preview user's attributes"** when abort logic or personalization depends on profile data.

---

## 7. Why didn't a user receive a message

The documented investigation path:

1. Confirm the campaign/Canvas is active — not draft, stopped, or archived.
2. Confirm the entry schedule or trigger matches expectations.
3. **Audience → Search users → profile → Messaging History** (last 30 days). No record at the expected time means an **entry** problem, not a message problem.
4. Check the Canvas Changelog and segment changelogs.
5. **Analytics → Dashboard Builder → Messaging Diagnostics** for abort and drop reasons.
6. If a step shows **zero entries** (not zero sends), inspect the preceding Action Path / Delay / Audience Path / Decision Split step.
7. Settings → Event User Log (Developer Console) for SDK-level debugging.
8. Contact Support **within 30 days** with Canvas ID, user IDs, timestamps with timezone, and screenshots.

---

## 8. Documented gotchas

1. **Smart quotes.** The most-documented "looks correct, doesn't work" cause. `default: ‘Torchie’` fails. Root cause: macOS System Settings → Keyboard → Text Input → *Use smart quotes and dashes*.
2. **HTML comments strip Liquid.** Use `{% comment %}`.
3. **`{{${...}}}` vs `{{custom_attribute.${...}}}`.** Standard attributes take no namespace; custom ones require it.
4. **Triple braces are never valid.** Called out twice in Braze's docs for API-triggered properties.
5. **Don't nest `{{ }}` inside a tag expression** — `Unexpected end token`. But inside `{% assign %}` / `{% if %}`, both the braced and unbraced forms are valid; it's only a standalone tag that must be braced.
6. **Whitespace in drag-and-drop editors** creates visible blank lines. `{%- -%}` or one line.
7. **Two custom attributes in one expression** don't work — assign one first.
8. **Variables don't cross message fields.**
9. **Variable name shadowing** — naming an `assign` variable `language` (or another tag name) breaks messaging logic.
10. **Type matching.** String `== 'true'` quoted; boolean `== true` unquoted. Preview mis-infers types for the untyped namespaces.
11. **`""` vs `null`.** `""` keeps the attribute visible; `null` removes it. Neither matches `IS NOT BLANK`. Non-string typed attributes must use `null` to unset. CSV import doesn't support `null`.
12. **`does not equal` on arrays** — *"only matches if none of the properties in your array equal the provided value."* Braze's docs give a worked example of two Canvases both firing unexpectedly.
13. **Nested-property escaping** — wrap chunks containing `[]` or `.` in double quotes: `"songs[].album".yearReleased`.
14. **Liquid does not log data points.** (Explicit FAQ answer.)
15. **Catalog whitespace** breaks image URL resolution.
16. **Editor switching** between HTML and Classic can shift Liquid snippet positions.
17. **Cache key excludes the user** — a Connected Content response cached for one user can be served to another unless the tag markup contains a high-cardinality attribute.

---

## 9. Pre-ship checklist

**Will it render**

- [ ] No filters inside `{% if %}` / `{% elsif %}` / `{% unless %}` / `{% case %}` / `{% for %}` / `[ ]`
- [ ] No operators inside `{% assign %}`
- [ ] No parentheses in conditionals
- [ ] No two custom attributes in one expression
- [ ] No extra `{{ }}` around a filtered expression
- [ ] Straight quotes, not smart quotes
- [ ] No Liquid inside HTML comments
- [ ] `assign`/`capture` variable names are ASCII letters, digits, underscores only
- [ ] HTML editor, not Classic; Liquid inside `<body>`

**Will it send**

- [ ] Every `abort_message` reason is a static quoted string with no Liquid
- [ ] Connected Content has a status-code guard or `:retry`
- [ ] Catalog lookups check `items | size` before rendering
- [ ] `required=true` used only where skipping is preferable
- [ ] Push payload tested on a real device (the character counter ignores Liquid)

**Will it be correct**

- [ ] Correct namespace for every value
- [ ] Attribute names match the profile exactly, including case and trailing spaces
- [ ] `default:` on anything that can be missing — remembering it won't fire on whitespace
- [ ] Time attributes assigned with `| default: ""` before comparison
- [ ] Types matched: `== 'true'` for strings, `== true` for booleans
- [ ] `time_zone` before `date` in any localized timestamp
- [ ] URLs in query strings passed through `url_encode` / `url_param_escape`
- [ ] Connected Content calls repeated in every field that needs them
- [ ] No whitespace between a catalog tag and its print expression
- [ ] Whitespace control (`{%- -%}`) on multi-line Liquid in drag-and-drop

**Verified**

- [ ] Previewed as a custom user with the key attribute missing
- [ ] Previewed with a whitespace-only value
- [ ] Previewed with an empty array
- [ ] Test-sent with "Override recipients' attributes" ticked
- [ ] Mock JSON blocks removed

---

## Sources

Braze: [Liquid FAQ](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/faq) · [Operators](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/operators) · [Abort messages](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/liquid/aborting_messages) · [Message Activity Log](https://www.braze.com/docs/user_guide/administer/global/workspace_settings/logs_and_alerts/message_activity_log) · [Messaging Diagnostics dashboard](https://www.braze.com/docs/user_guide/analytics/dashboards/dashboard_builder/diagnostics_dashboard) · [SQL Segments tables — abort types](https://www.braze.com/docs/user_guide/audience/segments/segment_extension/sql_segments/sql_segments_tables) · [Troubleshoot Canvases](https://www.braze.com/docs/user_guide/messaging/canvas/troubleshooting) · [Troubleshoot webhook and Connected Content requests](https://www.braze.com/docs/user_guide/messaging/design_and_edit/personalize/connected_content/troubleshooting_webhooks_and_connected_content) · [Send test messages](https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/sending_test_messages) · [Test messages with mock JSON](https://www.braze.com/docs/user_guide/example_library/personalize/test_messages_with_mock_json)
