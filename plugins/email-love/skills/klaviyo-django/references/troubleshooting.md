# Klaviyo — Troubleshooting

Symptom → cause → fix, the exact error strings, and what preview can't tell you.

## Contents

1. [The three failure classes](#1-the-three-failure-classes)
2. [Symptom lookup](#2-symptom-lookup)
3. [Exact error strings](#3-exact-error-strings)
4. [Preview and testing](#4-preview-and-testing)
5. [Documented gotchas](#5-documented-gotchas)
6. [Pre-ship checklist](#6-pre-ship-checklist)

---

## 1. The three failure classes

Do not conflate these — they have different symptoms and different fixes.

### A. Missing property → silent blank, message still sends

An undefined variable renders as an empty string. Inside `{% if %}` it's falsy. Klaviyo's API doc states it directly: *"Variables without corresponding context values are treated as FALSE."* Nothing is logged, nothing is skipped.

This is the class that reaches the inbox as "Hi ,". Fallbacks are the only defence.

### B. Malformed tag → the template won't render at all

Unknown tag, unknown filter, space after a filter colon, unclosed block. The render API returns HTTP 400. In the UI, preview shows:

> **"Message displayed without tags or variables — Fix invalid template tags or variables to preview the message with actual profiles and events."**

Note that this replaces the *entire* preview, so a single bad character makes every tag in the message look broken.

### C. Lookup failure → the send is skipped

- **`{% catalog %}` miss.** *"If the lookup can't find the item it's looking for, the message is skipped and does not send."*
- **`unpublished="cancel"`** extends this to items that exist but are unpublished.
- **Coupon exhaustion.** Campaigns are blocked from sending if available codes < expected recipients. In flows, *"if a flow email contains a coupon with no available codes, the email will be skipped"* — and a flow email with zero codes can't be set live.

Skips appear under **Analytics → Recipient Activity → Other**, e.g. *"Skipped: Catalog Item Unavailable"*.

---

## 2. Symptom lookup

### Blank where a value should be

| Cause | Check | Fix |
|---|---|---|
| **Event data in a campaign** | Is this a campaign or a metric-triggered flow? | `event.*` only exists in metric-triggered flows. Campaigns have no event context at all |
| Flow triggered by the wrong thing | Trigger type | List-, segment-, and date-property-triggered flows have no `event` data either |
| Wrong integration path | Which platform? | Shopify `extra.line_items`, WooCommerce `extra.Items`, Magento 2 `Items.0.Product.FullURL` — see `data-sources.md` §4 |
| Case mismatch | The preview panel | Every tag is case-sensitive. Copy, don't type |
| Property name has a space or `$` | The raw name | Needs `\|lookup:'…'`, not dot notation |
| Mixed dot and lookup in one chain | The chain | Once you use `lookup`, every later step must too |
| Property genuinely missing on this profile | Preview against that profile | Add `\|default:'…'` |
| `\|default:''` left as inserted | The code | The Personalization menu attaches an *empty* default; it needs filling in |
| Number stored as text, compared numerically | The value | Coerce: `\|multiply:"1"` |
| Boolean compared as a string | The value | Klaviyo booleans are `1`/`0` unquoted; cover `'true'`/`'True'` if the source is mixed |

### Nothing renders — every tag looks broken

That's class B. One malformed tag kills the whole render. Look for, in order of likelihood:

1. A space after a filter colon — `|default: 'x'`
2. `{% elsif %}` (should be `{% elif %}`)
3. `{% assign %}` (should be `{% with %}`)
4. Smart quotes instead of straight quotes
5. An unclosed `{% if %}` / `{% for %}` / `{% with %}`
6. A filter that doesn't exist in Klaviyo

### Message never sent, shows as skipped

Class C. Check **Analytics → Recipient Activity → Other**. Almost always a `{% catalog %}` miss or an exhausted coupon.

### `&amp;` in a URL, or broken JSON

Autoescaping. Inside a plain `href` the `&amp;` is harmless and doesn't need fixing — browsers decode it. Broken JSON or `<script>` content is a design problem, not an escaping toggle: `|safe` and `{% autoescape off %}` only disable HTML escaping and JSON-encode nothing, so untrusted dynamic values don't belong in those contexts at all — restructure the data upstream as structured, validated fields.

### A conditional appears twice, or nested wrong

`{% if %}`, `{% for %}`, `{% with %}` and their closers are **invisible in the rich-text inline editor** while still being live. The user saw nothing, re-added the tag, and now it's doubled. Fix via the Django Tag Builder or move the content to an HTML block.

### Works in preview, wrong in the inbox

See §4 — coupons, link tags, and SMS link shortening all behave differently in preview.

### Dates are off by hours

Klaviyo renders event timestamps in UTC and `{% today %}` / `{% current_* %}` in the *account* timezone. There is no per-recipient conversion. This isn't a bug to fix; it's a limitation to communicate.

---

## 3. Exact error strings

| Error | Meaning |
|---|---|
| `Unable to render given template with provided context. Please check included django syntax and ensure it is compatible with provided context.` | Render API 400 — malformed tag or filter |
| `Message displayed without tags or variables` | Same, surfaced in the preview UI |
| `Could not parse the remainder: 'Z' from 'XYZ'` | Custom-HTML upload: a tag Klaviyo doesn't recognize |
| `An {% unsubscribe %} tag is required.` | Custom-HTML upload with no unsubscribe tag |
| `Unable to find item with code: __. It may have been deleted.` | `{% catalog %}` lookup miss, seen in preview |
| `We couldn't find an unsubscribe link in your email. Klaviyo will automatically add an unsubscribe link when sending…` | Campaign warning — a footer gets appended |
| `We found # blocks in your email that either still have the default text unmodified or are blank.` | Pre-send content check |
| `We couldn't find the following images: … Make sure they are included in the zip file you uploaded.` | Template zip upload |

**Shopify-export-only errors** — these come from *Shopify's* Liquid renderer, not Klaviyo's, when a Klaviyo-authored template is exported as a Shopify notification:

```
Body html Liquid syntax error: Unknown tag 'unsubscribe'
Liquid syntax error: Unknown tag 'web_view'
Liquid syntax error: Unknown tag "Load"
Liquid syntax error: Unknown tag 'elsif'
'if' tag was never closed
```

Shopify does not support `{% unsubscribe %}`, `{% manage_preferences %}`, or `{% web_view %}`. Strip them from templates destined for Shopify.

**Show/hide builder:** non-alphanumeric characters (`=`, `<`, `>`) in referenced properties or values are unsupported. Klaviyo's guidance: *"use only letters, numbers, underscores (_), or dashes (-)."*

---

## 4. Preview and testing

**Preview & test** is the documented source of truth for tags. Hovering a property lets you copy the exact tag — arriving with `|default:''` attached.

| Context | What preview gives you |
|---|---|
| Templates (Content → Templates) | Toggle between profile and event data; pick a specific profile or event |
| **Campaigns** | **Profile personalization only.** *"Event data is not supported for campaigns, because campaigns cannot be associated with a specific event"* |
| Metric-triggered flows | Profile + event. The profile comes from those who most recently took the trigger action; toggle through the **last 10 events** |
| List / segment / date-property flows | Use *Search profiles* |

**The default preview profile is your own login profile**, which has almost no properties. Switching to a dedicated seed/test profile that has the relevant properties (and triggered the event, for a flow) is usually the fix for "why is everything blank in preview."

**If nobody has triggered the event yet, there's no preview data.** You have to go perform the action on the site first.

### Limits

- **30 recipients per preview send.**
- Monthly preview cap: 100 (free / 0–250 contacts), 500 (251–500), or 1/10th of plan sending capacity (501+).
- Share-preview links: paid accounts, expire after 6 days.

### What does NOT work in preview or test sends

- **Link and preview tags are inert.** *"These tags are only supported for email templates. If you click one of these links from a preview email, you'll be directed to a placeholder page."*
- **Coupons render as a placeholder**, not a real assigned code.
- **Event data will not populate a campaign** — to see live event content you must actually trigger the flow.
- **SMS test sends don't shorten links.**
- General: *"some dynamic content does not behave the same way it does in a live send."*

### Programmatic testing

`POST /api/template-render` renders a template against an arbitrary JSON context and returns HTML/text/AMP **without sending anything**. Rate limited 3/s burst, 60/m steady. This is the fastest way to settle a syntax question definitively — and how the syntax claims in this skill were verified.

**Flow logic testing:** use the trigger preview setup tool, or set a message to **Manual** mode and inspect the **Needs Review** tab.

---

## 5. Documented gotchas

1. **Case sensitivity everywhere.** *"All personalization tags are case sensitive and must exactly match the property names they reference."* Integration payloads mix conventions within a single tree. Never guess; copy from preview.

2. **Space after a filter colon is fatal**, spaces around the pipe are fine. Klaviyo's own custom-objects doc publishes the broken form — a user may have copied it verbatim.

3. **Autoescaping is on.** Correct in HTML, including `href` values. `|safe` / `{% autoescape off %}` disable it without JSON- or JS-encoding anything, so they never make a value safe for `<script>` or JSON — keep untrusted values out of those contexts and use them only on author-written markup.

4. **`lookup` is sticky.** Once used in a chain, everything after must use it too.

5. **Variable naming:** no spaces, no hyphens; underscores allowed but not leading. Same for row aliases and feed names (feed names also can't start with `_`).

6. **Straight quotes only.** Paste as plain text to avoid smart quotes.

7. **Booleans are `1`/`0` unquoted.** For mixed data: `p|lookup:'VIP' == 1 or p|lookup:'VIP' == 'true' or p|lookup:'VIP' == 'True'`.

8. **Text-stored numbers won't compare.** `person.Birthday|multiply:"1" > 21`.

9. **`{{ today }}` alone renders nothing** — `{% today "%Y-%m-%d" as today %}` is mandatory first.

10. **`currency_format` only works on numbers.** *"Properties with the currency symbol included (e.g., $40, $76.30) are strings, and the currency_format tag cannot alter them."*

11. **Conditional tags vanish from the inline text editor** while remaining live.

12. **`{% current_weekday %}` and `{% current_month_name %}` are English-only.**

13. **`has_category` matches partially** — "sale" matches a product tagged "on-sale".

14. **One metric per template.** *"Only use properties from a single metric in a template. However, you may also use profile variables in a template that uses event variables."*

15. **Product feed price/inventory filters apply to variants, but blocks render items** — a block can show a price outside your filter range.

16. **`Placed Order` and `Ordered Product` sync seconds apart.** Filtering one by the other skips everyone; use `Placed Order` for both trigger and filter.

17. **UTM parameters are not supported on `{% update_property_link %}`** buttons or links.

18. **Product blocks don't support custom HTML** — a coded template needs a hybrid template.

19. **"Convert to code" on show/hide logic is not reversible.**

---

## 6. Pre-ship checklist

**Will it render at all**

- [ ] No space after any filter colon
- [ ] `{% elif %}`, not `{% elsif %}`
- [ ] `{% with %}`, not `{% assign %}`
- [ ] Straight quotes throughout
- [ ] Every `{% if %}` / `{% for %}` / `{% with %}` closed
- [ ] Every filter used exists in Klaviyo (check `syntax.md` §5)

**Will it send**

- [ ] `{% catalog %}` lookups are expected to hit — or skipping is deliberate
- [ ] Coupon has enough codes for the audience
- [ ] `{% unsubscribe %}` present (required; custom HTML won't upload without it)

**Will it be correct**

- [ ] Every variable has a `|default:'…'` with a real value, not `''`
- [ ] Field paths match the actual integration
- [ ] Case copied from the preview panel, not typed
- [ ] `event.*` used only in a flow triggered by that metric
- [ ] `lookup` used consistently once introduced
- [ ] No untrusted dynamic values interpolated into `<script>` or JSON — that data assembled upstream as structured fields (`|safe` does not JSON-encode)
- [ ] Dates parsed with `|format_date_string` before `|date:`
- [ ] Numbers coerced with `|multiply:"1"` before comparison

**Verified**

- [ ] Previewed against a dedicated seed/test profile that triggered the event — not a production customer, not your own login profile
- [ ] Previewed against a profile missing the key property
- [ ] Previewed with one cart item and with several
- [ ] Coupons and link tags checked with a live test, since preview fakes them

---

## Sources

Klaviyo: [Troubleshooting email template error messages](https://help.klaviyo.com/hc/en-us/articles/4402386684187) · [Catalog lookup tag reference](https://help.klaviyo.com/hc/en-us/articles/360004785571) · [Getting started with coupon codes](https://help.klaviyo.com/hc/en-us/articles/115005084727) · [How to show or hide template blocks](https://help.klaviyo.com/hc/en-us/articles/7655965301531) · [How to use the preview panel](https://help.klaviyo.com/hc/en-us/articles/27843522951707) · [How to preview and send test emails](https://help.klaviyo.com/hc/en-us/articles/115005081907) · [How to test and preview flow messages](https://help.klaviyo.com/hc/en-us/articles/115002774972) · [Message personalization reference](https://help.klaviyo.com/hc/en-us/articles/4408802648731) · [Conditional logic reference](https://help.klaviyo.com/hc/en-us/articles/7655926841499)
