# Zeta ZML — Troubleshooting

Symptom first, then the reason catalogue, then the failures that produce no symptom at all.

## Contents

1. [Symptom lookup](#1-symptom-lookup)
2. [The recipient pipeline](#2-the-recipient-pipeline)
3. [Error reasons](#3-error-reasons)
4. [Skipped and unsubscribed reasons](#4-skipped-and-unsubscribed-reasons)
5. [Failures that produce no error](#5-failures-that-produce-no-error)
6. [Diagnosing "some messages were skipped"](#6-diagnosing-some-messages-were-skipped)
7. [Preview and proofs](#7-preview-and-proofs)
8. [Pre-ship checklist](#8-pre-ship-checklist)
9. [What Zeta does not document](#9-what-zeta-does-not-document)

---

## 1. Symptom lookup

| Symptom | Where it lives | Likely cause |
|---|---|---|
| **Some messages were skipped** | Recipient status `skipped` | `custom_skip` from your own `{% skip_message %}`; or `frequency_settings`, `filtered`, or `throttled` — none of which are template bugs. **Read the reason before touching the template** (§6) |
| Messages errored for part of the audience | Recipient status `error` | `liquid_internal` (bad ZML), `email_subject_missing` (subject rendered empty), `coupon_allocation`, `external_content_fetch`, `recommendation_fetch`, `resource_fetch` |
| Campaign will not activate | Activation-time | `liquid_syntax_error`. Zeta's guidance: *"validate the HTML code before proceeding with the campaign activation"* |
| A value renders as nothing at all | Everywhere | The value is `nil`. Wrong property name, wrong namespace, empty array index, or a query that matched nothing. **Nothing is logged** (§5) |
| A greeting reads `Hello !` | Body | The exact documented nil case — `{{ first_name }}` on a profile without one. Add `\| default:` |
| Subject line blank, message errored | `email_subject_missing` | *"Normally happens when the subject uses a template variable and turns out to be empty after substitution"* |
| Literal `{{ … }}` or `{% … %}` in the sent email | Body | A tag the engine could not parse — most often an identifier broken across a line, or a construct that is not ZML (`{% elseif %}`, `{% include %}`) |
| A filter did nothing in a `global` | Any component | `global` *"does not evaluate filters"*; it stored `first_name \| upcase` as literal text |
| A variable is empty in the subject but fine in the body | Cross-component | `assign` is component-scoped. Use `{% global %}` in the Global Variables field |
| Resource query returns too many items | Query | A dropped operator — `BETWEEN`, or a lowercase one, in `{% resources %}` (§5) |
| Recommendation block shows off-filter products | Query | Documented: the engine *"will override the filter if it cannot retrieve the requested number of recommendations"* |
| Recommendation images broken, everything else fine | Images | *"The image URLs are hosted on the client's server, not on Zeta's infrastructure"* |
| Whole email cut off in Gmail | Rendering | Over **102 KB**. Usually an unbounded loop or several conditional variants shipping together |
| Works in preview, empty on send — or the reverse | Preview | `campaign.targeted_segment_id` is preview-blank by design; event-based dynamic images do not render in real-time preview |
| SMS with a merge tag miscounted its length | SMS | GSM-7 extended characters count double *"except when they are used in liquid or merge tags"* |
| SMS dispatch error, `nil:NilClass` | SMS | An override field resolved to nil — e.g. `to_sms_override: "{{event.text_signup.phone}}"` with no phone in the payload |

---

## 2. The recipient pipeline

Every member of the computed audience becomes a **campaign recipient entity** and moves through documented states. Knowing which state a failure sits in tells you whether it is a template problem at all.

| State | What has happened |
|---|---|
| `pending` | Audience computed |
| `out_of_sample` | Held back from an A/B/n test; receives the winner later |
| `control_group` | Deliberately not sent |
| `sto_pending` | Send-time optimisation still computing the slot |
| **`prepared`** | *"All external data (feed, recommendations, file variables) is captured beforehand"* |
| **`scheduled`** | Frequency settings and unsubscribed/not-opted-in contacts checked. Pre-processing starts **30–90 minutes before launch** for scheduled broadcasts |
| **`generated`** | The message was successfully generated — this is where ZML renders |
| `queued` | Handed to the provider (Momentum, SendGrid, Twilio) |
| `unsubscribed` / `not_opted_in` | No subscribed / opted-in contact |
| `error` | *"Any recipients with bad/missing data or system errors"* |
| `skipped` | *"Any recipients that are intentionally suppressed as part of the campaign"* |
| `overlap` | De-duplicated against another contact or an earlier version |

Two things fall out of this ordering.

**External data is fetched before generation, not during it.** Feed, recommendation, and file-variable failures therefore land at `prepared`, as `external_content_fetch` / `recommendation_fetch` / `resource_fetch` — before any ZML in your template has run. A template fix cannot repair them.

**`{% skip_message %}` is evaluated before personalization.** *"Before a message is personalized or prepared for delivery, the platform evaluates recipient eligibility criteria, including suppressions, contact validity, de-duplication rules, control groups, audience filters, and any `skip_message` conditions."* So a skipped recipient never reaches content generation — which is why a skip costs nothing and why Zeta's advice is *"apply skip logic as early as possible within your personalization code."*

---

## 3. Error reasons

Recipient status `error`, with the documented reason and what the author can do about it.

| Reason | Zeta's description | Yours to fix? |
|---|---|---|
| **`liquid_internal`** | *"The system encounters an error due to bad liquid tags"* | **Yes.** This is the ZML bug bucket |
| **`email_subject_missing`** | *"The email subject is missing. Normally happens when the subject uses a template variable and turns out to be empty after substitution"* | **Yes.** An unguarded merge tag in the subject line |
| `coupon_allocation` | *"Not enough coupons are available for the recipient to be used in the template"* | Partly — load more codes, or guard the block |
| `external_content_fetch` | *"The system fails to fetch data from an external content feed"* | Feed side |
| `recommendation_fetch` | *"Strict meta-filters or not enough recommendable content"* | Loosen the filters, or use `{% resources %}` |
| `resource_fetch` | Error fetching from the resources API | Resources side |
| `invalid_email_address` | Format is incorrect | Data side |
| `communication_dispatch` | Provider transmission failed after **5** retries | Platform side |
| `communication_generation` | *"A system error occurs while generating the message"* | Platform side |
| `aws_throttling` | SES throttled transmission | SES accounts only |
| `socket_error` | Temporary error in an external service used in the content; retried in the pipeline | Usually transient |
| `standard` | *"Default error category when none of the known errors are captured"* | Unknown — escalate |
| `bad_data` | *"Default error category for missing data"* | Data side |

Zeta's FAQ says of `messaging_missing_identity_error`, `no_method_error`, and `socket_error`: *"Our system is designed to handle these scenarios automatically by retrying… there is no need to be concerned about these errors."*

**`liquid_syntax_error` is a different thing.** It appears at **activation**, not per recipient, and blocks the launch. So ZML has two error surfaces: one that stops the campaign before it starts, and one that drops individual recipients mid-send. Which of the two a report is about changes the whole diagnosis — ask.

---

## 4. Skipped and unsubscribed reasons

| Status | Reason | Meaning |
|---|---|---|
| `skipped` | **`custom_skip`** | *"Message skipped due to user-defined conditions"* — your `{% skip_message %}` fired. `reason_detail` carries the string you passed |
| `skipped` | `frequency_settings` | Account- or segment-level frequency cap |
| `skipped` | `filtered` | *"The recipient was excluded by campaign/message filtering rules"* — a campaign filter they did not satisfy |
| `skipped` | `throttled` | *"System throttling… due to a high bounce rate"* |
| `unsubscribed` | `missing_contact_address` | No contact applicable to the channel |
| `unsubscribed` | `unsubscribed` | Contacts exist but none are active for this campaign's opt-in settings |
| `unsubscribed` | `cascade` | Another profile with the same email unsubscribed, deactivating this one |

**`filtered` versus *excluded*** is a distinction Zeta's FAQ draws explicitly, and confusing them wastes an afternoon: excluded means the person was in an excluded segment; filtered means a campaign filter (a keycode filter, for example) rejected them even though they were in the included audience.

### `{% skip_message %}` versus a message that errors

| | `{% skip_message %}` | `liquid_internal` error |
|---|---|---|
| Intent | Deliberate | Accidental |
| Recipient status | `skipped` | `error` |
| Reason | `custom_skip`, plus your `reason_detail` | `liquid_internal`, no author-supplied detail |
| Journey record | *"Recorded as a Message Skipped event in the person's journey"* | An error state |
| Personalization | Never runs — evaluated before it | Failed during it |
| Scope | **Person-level, all channels in the campaign** | Per message |

**The person-level scope is the one that catches people out.** *"If a `skip_message` condition is met for that person during campaign execution, the message is skipped for the person rather than for a specific contact method… the person will not receive the campaign message through any channel included in the campaign, even if the skip condition was evaluated using data associated with only one contact method."* A skip written for an email-only condition suppresses that person's SMS in the same campaign.

**Zeta does not document what a skip does to journey progression** in an Experience — whether a skipped Campaign Action Node advances the person to the next node or holds them. Do not assert either. Confirm on the account.

---

## 5. Failures that produce no error

This is the section to read first when someone says "it looks fine but it's wrong."

| Silent failure | What actually happens |
|---|---|
| **`BETWEEN` in `{% resources %}`** | *"Not in allowlist… Silently dropped in `{% resources %}`."* The tag runs, the constraint vanishes, you get the unfiltered set. `{% recommendation %}` passes it through instead |
| **Lowercase query operators** | *"Operator must be UPPERCASE to pass validation… Lowercase like `after` will be silently dropped."* `'contains'` ≠ `'CONTAINS'` |
| `EQUAL` or `OR` in `{% resources %}` | Not in the allowlist either. Use `=` |
| **A nil value** | Renders as nothing. *"Tags or outputs that return `nil` will not print anything to the content."* A misspelled property and an absent one are indistinguishable |
| **An empty string is truthy** | `{% if some_string %}` passes for `""`, then prints nothing. `\| default:` fires on empty; `{% if %}` does not |
| **`0` is truthy** | `{% if points %}` is true at zero balance |
| **Filters inside `{% global %}`** | Stored as literal text, unevaluated. No warning |
| **Double quotes in `{% global %}`** | *"The double quote may be treated as part of the stored value"* — output like `"store` |
| **A two-part `filter:`** | `filter: 'category', 'shoes'` sends **no operator**. It parses fine and queries differently |
| **Mixed filter mechanisms** | With `expression`, `group_filters`, and `filter` all present, *"only the `expression` will be used"* — the others are dropped |
| **A recommendation filter under-filling** | The engine *"will override the filter"* rather than return fewer items |
| **Resource Group lag** | *"Up to 30 minutes for resources to be qualified"* — a fresh group can be legitimately empty |
| **A duplicated `{% coupon %}` tag** | Allocates a second code to the same person rather than reusing the first |
| **A `{% media_asset %}` after a file move or rename** | *"You cannot move the asset to a new folder nor rename it without breaking the tag"* |
| **A `{% feeds %}` reference with no `include` above it** | The declaration must come first; nothing warns you it did not |
| **An identifier wrapped across a line** | Zeta's own example of a *"Broken Logic Tag."* Invisible in a rendered view |

The common shape: ZML's default response to something it cannot satisfy is to produce nothing and carry on. Assume nothing about a value you have not seen render.

---

## 6. Diagnosing "some messages were skipped"

Skipped is not one thing. Work down this list in order and most reports resolve before you open the template.

**1. Get the skip reason, not the skip count.** `custom_skip`, `frequency_settings`, `filtered`, `throttled`. Three of the four are not template problems. Ask: *"What reason is shown against the skipped recipients?"*

**2. If it is `custom_skip`, read the `reason_detail`.** That string is the one your own `{% skip_message message:"…" %}` passed. It names the branch that fired. This is why descriptive detail strings are worth writing — Zeta's own best practice is *"use descriptive `reason_detail` values to make reporting and troubleshooting easier."*

**3. Check the person's journey.** A skip is *"recorded as a Message Skipped event in the person's journey"*, so a single affected profile tells you which condition matched and what their data looked like.

**4. Rule out person-level scope.** If the campaign is multi-channel and only one channel's data drives the condition, the skip still suppresses every channel for that person. A cross-channel campaign with an email-shaped skip condition will look like an SMS bug.

**5. Distinguish skipped from errored.** If the reason is not in the skip list, you are looking at `error` instead — go to §3. `liquid_internal` and `email_subject_missing` are the two an author caused.

**6. Only then read the template**, and read it for §5's silent failures first: a dropped operator, a nil that never rendered, an empty-string guard that passed.

**7. Check what changed.** Frequency settings, an added campaign filter, a coupon category running dry, and a feed that stopped updating all produce skips or errors with no template edit at all.

---

## 7. Preview and proofs

| Surface | What it does |
|---|---|
| **Template preview** | *"Generated based on a random user in the platform."* Update the `uid` above the preview to render for a specific person; refresh re-randomises |
| **Send Test / proof** | Sends the visible preview to any valid address, from Content Templates, Campaigns, or an Experience's Campaign Action Node |
| **Litmus preview** | Client/OS/device renders as PNGs |
| **Push preview** | Select a user profile and target device; *"ZMP resolves the Liquid Script using the selected user's profile attributes, event history, and metadata"* |

**Preview by `uid`, not by email.** *"When you preview the content, you must use the `uid` instead of the `email`."*

**What preview will not show you:**

- `campaign.targeted_segment_id` — *"the recipient generated for preview/proof is a mock version without specific details."*
- Event-based dynamic images — *"If you're using event-based dynamic content, the images will not be displayed on a real-time preview."*
- The **View online link** — *"does not work for test campaigns."*
- Whether the shortcode/longcode in the From field is the real one — it is randomly assigned until send.
- A/B variants — *"Seed users only receive one piece of content in an A/B testing campaign."*

**A preview error can be a data error.** Coupons are the documented case: *"If you encounter an error in a campaign's preview, it might be due to its allocated coupons being exhausted in the category."*

The right instruction to give a user is: **preview against three specific `uid`s** — one with the property populated, one without it, and one whose value is an empty string — and then send a proof. A random preview user proves nothing about the branch you are worried about.

---

## 8. Pre-ship checklist

1. **Every `else`-chain uses `{% elsif %}`.** Not `elseif`, not `elif`.
2. **Every merge tag has a `| default:`**, especially in the **subject line** — an empty subject is `email_subject_missing`, a per-recipient error.
3. **Every query operator is UPPERCASE**, and no `{% resources %}` tag uses `BETWEEN`, `EQUAL`, or `OR`.
4. **Every `filter:` has three parts** unless the two-part form is what you meant.
5. **Only one of `expression`, `group_filters`, `filter`** per `{% resources %}` tag.
6. **Every `{% feeds include: %}` sits above the references that use it**, and every `{% media_asset %}` sits below the feed values that build it.
7. **`{% coupon %}` appears exactly once**, assigned to a variable that is reused.
8. **Every loop over data you do not control has `limit:`**, and the fetching tag has `count:`.
9. **Guards use the right test.** `| default:` for nil-or-empty; an explicit `!= ""` where an empty string must fail; never a bare `{% if %}` on a string or a number that can be zero.
10. **Anything that must not send half-personalized has a `{% skip_message %}`** with a descriptive `reason_detail` — and you have accepted that it suppresses the person on every channel in the campaign.
11. **Values from feeds, events, resources, and recommendations are escaped** for where they land: `| escape` into HTML, `| url_encode` into a URL, `| strip_html` for plain text.
12. **The rendered HTML is under 102 KB** with every conditional branch expanded.
13. **Preview against three `uid`s** — populated, missing, empty — then send a proof.
14. **Activate and watch the first minutes.** `liquid_syntax_error` blocks activation; `liquid_internal` only shows up once recipients start generating.

---

## 9. What Zeta does not document

Stated plainly because guessing here is how wrong advice gets written. None of the following is claimed either way by first-party documentation as of the check date.

**Whether template errors surface before send.** Two surfaces exist — a `liquid_syntax_error` that blocks activation, and per-recipient `liquid_internal` errors during generation — but **no page describes what the activation check actually validates**. Zeta's own remedy for `liquid_syntax_error` is *"validate the HTML code before proceeding"*, which suggests the check is not exhaustive. So: assume a template can save, pass activation, and still error for a subset of recipients at generation time. Do not tell a user their template is validated because it activated.

**The profile namespace as a rule.** Bare in every ZML-section example, `{{user.*}}` on the Campaign Proofing page, `properties` / `person` / `event.properties` in the Content Script Converter page. Three forms, no specification. See `references/data-sources.md` §1.

**Whitespace control.** `{%- -%}` and `{{- -}}` appear nowhere in the ZML pages.

**Whether an HTML comment suppresses the ZML inside it.** Nothing says either way. `{% comment %}` is the documented way to disable code; use it.

**Loop and render limits.** No documented maximum iterations, no render timeout, no maximum array size. The only ceiling stated is the 102 KB clipping threshold, which is a mailbox-provider limit rather than a ZMP one.

**Recipient-local dates.** No timezone filter is documented. `recipient_contact.timezone` exists as a property but is never shown being applied to a date.

**Journey progression after a skip.** Whether a `{% skip_message %}` in an Experience's Campaign Action Node advances the person to the next node is not stated.

**`sort_natural`.** Documented with the same text and the same `sort` example as `sort`, so the page does not actually describe a difference.

**`ascii_to_hex` and `hex_to_ascii`.** Listed on the Filters page with no description, no syntax, and no example.

**`{% event %}` ordering and short results.** Neither newest-first ordering nor the behaviour when a person has fewer events than `count` is stated.

**`case` / `when` with multiple values.** Only the one-value-per-`when` form is shown.

**Where the `coupon_allocation` failure is classified.** The Coupon page calls it a `campaign_skipped` event; the Campaign States page lists it under `error`. The two pages disagree.

Where a user needs one of these answers, the honest reply is that the documentation does not say, followed by the specific test that would settle it on their account.

---

## Sources

Zeta Knowledge Base: [Campaign States and Errors](https://knowledgebase.zetaglobal.com/kb/campaign-states-and-errors) · [Skip Message](https://knowledgebase.zetaglobal.com/kb/skip-message) · [Look-Ups](https://knowledgebase.zetaglobal.com/kb/look-ups) · [Recommendations](https://knowledgebase.zetaglobal.com/kb/recommendations) · [Tags](https://knowledgebase.zetaglobal.com/kb/tags) · [Truthy and Falsy](https://knowledgebase.zetaglobal.com/kb/truthy-and-falsy) · [Types](https://knowledgebase.zetaglobal.com/kb/types) · [Filters](https://knowledgebase.zetaglobal.com/kb/filters) · [Coupon Code Setup](https://knowledgebase.zetaglobal.com/kb/coupon-code-setup) · [Content Feeds](https://knowledgebase.zetaglobal.com/kb/content-feeds) · [Media Asset Tag](https://knowledgebase.zetaglobal.com/kb/media-asset-zml-tag-user-guide) · [Content Templates](https://knowledgebase.zetaglobal.com/kb/content-templates) · [Campaign Proofing](https://knowledgebase.zetaglobal.com/kb/campaign-proofing) · [HTML Editor](https://knowledgebase.zetaglobal.com/kb/html-editor) · [Push Notifications](https://knowledgebase.zetaglobal.com/kb/push-notifications) · [SMS and MMS Campaigns](https://knowledgebase.zetaglobal.com/kb/sms-and-mms-campaigns) · [FAQs (Campaigns)](https://knowledgebase.zetaglobal.com/kb/faqs-campaigns)
