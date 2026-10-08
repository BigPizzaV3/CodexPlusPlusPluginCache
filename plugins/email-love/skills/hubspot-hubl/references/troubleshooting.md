# HubSpot HubL — Troubleshooting

Symptom → cause → fix, where the evidence lives, and an honest list of what HubSpot leaves undocumented.

## Contents

1. [Symptom lookup](#1-symptom-lookup)
2. [Publish time versus send time](#2-publish-time-versus-send-time)
3. [Blank, dropped, or 500](#3-blank-dropped-or-500)
4. [Where the evidence is](#4-where-the-evidence-is)
5. [Exact strings HubSpot publishes](#5-exact-strings-hubspot-publishes)
6. [Reviewing a pasted template](#6-reviewing-a-pasted-template)
7. [Preview and test sends](#7-preview-and-test-sends)
8. [Where HubSpot's docs contradict each other](#8-where-hubspots-docs-contradict-each-other)
9. [Why didn't a contact receive it](#9-why-didnt-a-contact-receive-it)
10. [Documented gotchas](#10-documented-gotchas)
11. [Pre-ship checklist](#11-pre-ship-checklist)
12. [What HubSpot does not document](#12-what-hubspot-does-not-document)

---

## 1. Symptom lookup

### Blank where a value should be

| Cause | Check | Fix |
|---|---|---|
| Property genuinely unset on that contact | Preview as that contact | Set a fallback — global default, per-token fallback, or `personalization_token()` |
| Wrong internal property name | The contact record, or the Personalize menu | Internal names diverge from labels: `firstname`, `hs_object_id`, `hs_persona` |
| A filter used as the fallback | The template | Filters do not apply to personalization tokens **in email**. Use `personalization_token("contact.firstname", "there")` |
| Loop iterating the wrapper | The template | `crm_objects()` returns `{has_more, offset, total, results}` — iterate `.results` |
| Query matched nothing | Preview against a contact whose data should match | Write an `{% else %}` branch. HubSpot's own guidance is to include fallback data |
| Workflow custom token in the wrong email | Which workflow sends it | *"Tokens will only apply when the email is used with the specified workflow"* |
| `{{ company.* }}` in a coded template | The variables reference | The documented dictionary is `account`. Verify by preview before assuming either way |

### A conditional behaves wrong

| Cause | Fix |
|---|---|
| Personalization token inside `{% if %}`, programmable email off | Toggle **Use module for programmable email** on the module, or set `isEnabledForEmailV3Rendering: true` on a coded template |
| `{% elsif %}` | It is `{% elif %}`. `elsif` is Liquid |
| `{% elif %}` inside `{% unless %}` | `unless` accepts `else` but not `elif`. Rewrite as `if` |
| Single-send API value in the condition | *"will not function within `if` statements, as the templates compile before the information populates"* — branch on a contact property instead |
| `{% set x = a and b %}` returning `true` rather than `b` | Documented: HubL's `and` returns a boolean, unlike Python or JavaScript |

### A variable is empty after a loop

Loop scope. *"Any variables defined within loops are limited to the scope of that loop and cannot be called from outside of the loop."* Replace the accumulator with a filter on the collection — `|sum(attribute="amount")`, `|length`, `|selectattr(...)|list|length`.

### The template will not publish

Either a missing required variable — the CAN-SPAM set plus `{{ unsubscribe_link }}` or `{{ unsubscribe_link_all }}` — or a HubL function limit breach, which surfaces in the email's **Review Panel**. For the template case, click **Show details** at the bottom left of the code editor to open the error console.

### Raw `{{ … }}` in the inbox

The code is somewhere HubL is not evaluated, or it is inside `{% raw %}`. Check which surface it is on: the drag-and-drop editor's rich text is for tokens inserted through the Personalize menu, not for authored logic.

### Only some recipients got nothing

The signature of a per-recipient drop, not a template error — the template compiled, published, and rendered for everyone else. Check the function count against §11 of `references/data-sources.md`.

---

## 2. Publish time versus send time

HubSpot splits failure across two moments, and knowing which one you are in halves the search space.

| Caught at publish | Caught at send, or not at all |
|---|---|
| Missing required CAN-SPAM variables | A property that is empty for this contact |
| Missing `unsubscribe_link` / `unsubscribe_link_all` | A CRM query that returns no results |
| HubL function limit exceeded on a **new** email | Function limit exceeded on an **already published** email |
| Syntax errors surfaced by the error console | A workflow custom token used by the wrong workflow |
| — | Single-send `customProperties` referenced inside `{% if %}` |

The asymmetry matters: **a published email is not a validated email for every recipient.** Publishing proves the template compiles against the account's settings. It proves nothing about the data.

The single-send case is the sharpest version of this. The template compiles *before* the payload populates, so the payload cannot influence which branch compiles. This is not a bug you can work around with better syntax.

---

## 3. Blank, dropped, or 500

Three distinct outcomes that get reported to you as "the email is broken".

| Outcome | Trigger | What the recipient sees |
|---|---|---|
| **Blank** | Missing property, empty query result, unresolved token | The email, with a hole in it. It sends |
| **Dropped for that recipient** | Function limit exceeded at send: *"it will be dropped for that email recipient"* | Nothing |
| **500 on the web version** | Same limit breach: *"The web version will return a 500 error if the limit is exceeded"* | An error page behind the "view in browser" link |

The dropped case is the dangerous one because it is silent from the marketer's side and the contact timeline does not name it (§7).

---

## 4. Where the evidence is

- **Design manager error console.** Click **Show details** at the bottom left of the code editor. Publish-time HubL errors and the missing-required-tags error land here. **Show output** toggles a render of the template as you work.
- **The email's Review Panel.** Function-limit errors appear here before publish — as warnings during the 2025 rollout period, as blocking errors after.
- **Preview as a specific contact.** The editor's preview takes a contact. This is the only way tokens, conditionals and CRM queries resolve against stored contact data — use a dedicated seed/test contact — and it settles every property-name argument in seconds.
- **Send test email → Preview as contact.** *"To receive the test email as a specific contact, click the Preview as contact dropdown menu and select a contact."*
- **The contact record → Activities → View sent email.** The exact rendered copy that recipient got. **30 days** of retention, and — importantly — *"applies only to emails created with smart content or programmable modules"*. An email that only uses personalization tokens leaves no recoverable rendered copy. For longer retention HubSpot points at compliance copy emails.
- **The web version of the email.** A 500 there is the tell for a function-limit breach.

Ask which of these the user has actually looked at. "What does the preview show when you preview as one of the affected contacts?" resolves most reports on its own.

---

## 5. Exact strings HubSpot publishes

The messages you can actually match against, and what each one means:

| String | Where it appears | Means |
|---|---|---|
| *"You are missing the following required tags in your template"* | Design manager, on publish — HubSpot's support article is named for this error | One or more of the seven `site_settings` CAN-SPAM variables, or both unsubscribe variables, are absent |
| *"New emails exceeding the HubL function limit will prompt an error notification in the Review Panel and will not be published."* | Review Panel | Too many HubL function invocations. Count them |
| *"it will be dropped for that email recipient"* | Changelog, describing send behaviour | An already-published email over the limit. Silent, per recipient |
| *"The web version will return a 500 error if the limit is exceeded."* | Changelog | The view-in-browser link is your cheapest confirmation of a limit breach |
| *"There are properties set up in the template that have not been included in the `customProperties`"* | Single-send API response | The template references `{{ custom.x }}` and the request omitted `x` |
| *"This email wasn't sent"* | Contact timeline | HubSpot's catch-all. *"HubSpot was unable to determine a specific reason for the failure"* — this is where a render problem would surface if it surfaces at all |

HubSpot does not publish a catalogue of HubL parse-error strings for email the way some platforms do. The error console is free-form; read what it says rather than pattern-matching it.

---

## 6. Reviewing a pasted template

A fixed order, because the expensive bugs are not the ones that catch the eye:

1. **Which surface is this?** Coded template, custom module, or something typed into the drag-and-drop editor. The same code is valid on one and inert on another, and nothing in the snippet tells you which.
2. **Is programmable email on?** Look for `isEnabledForEmailV3Rendering: true`, or ask about the module toggle. Then look for tokens inside conditionals and CRM functions — either one needs it.
3. **Count the function invocations.** `crm_object`, `crm_objects`, `crm_associations`, `hubdb_table`, `blog_*`. Do this before reading the logic; it is the only thing that silently drops recipients.
4. **Every `crm_objects()` loop: does it iterate `.results`?**
5. **Every fallback: is it a filter or a function?** A filter on a token is the documented no-op in email.
6. **Every `{% set %}`: is it inside a loop and read outside it?**
7. **Spelling pass:** `elif` not `elsif`, `~` not `+`, no hyphens in variable names, `{# #}` not `<!-- -->`.
8. **The CAN-SPAM block.** Seven `site_settings` variables plus an unsubscribe link, or it does not publish.
9. **Escaping.** Anything from a CRM property that lands in a URL, an attribute, a script, or JSON. And any use of `|render` on data.
10. **The empty case.** Every CRM query and every loop needs a branch for zero results.

---

## 7. Preview and test sends

What preview and test sends do **not** tell you:

- **Test sends come from `noreply@hubspot.com`**, with the from name *Marketing Email Preview Send*. Sender configuration, DKIM alignment and reply-to behaviour are untested by a test send.
- **HubSpot does not document how personalization tokens render in a test send** beyond the *Preview as contact* selector, nor whether programmable content renders identically to a real send. Verify against a seed contact in a real send before a large campaign.
- **Preview does not exercise the function limits.** A preview renders one contact; the limit is enforced per email at send.
- **Preview does not tell you which branch the rest of the audience takes.** Preview at least three contacts: full data, missing the key property, and a CRM query that returns nothing.
- **HubSpot documents no limit on test recipients** and no statement about tracking on test sends. Do not assume either way.

---

## 8. Where HubSpot's docs contradict each other

Three live contradictions. Name them rather than resolving them silently — a user who has read the other page will otherwise think you are wrong.

**1. Filters on tokens in email.** The filters reference says *"You can apply HubL filters to personalization tokens, such as contact and company tokens, on HubSpot CMS and blog pages, but not in emails."* The programmable-content guide's own example builds an email query out of `"price__lte="~contact.budget_max|int~"&price__gte="~contact.budget_min|int`. Both pages are current. The safe reading is the filters reference; if a user's working template relies on the other, they have evidence you do not, and the resolution is a preview, not an argument.

**2. Function limits.** Ten invocations per listed function per email (developer changelog, live 28 May 2025) versus no more than five CRM functions per programmable email with recipient ceilings (knowledge base). Different units, neither page citing the other.

**3. Where company data lives.** The variables reference documents `account` as the company dictionary. The knowledge base describes "company tokens" available in the email editor. Whether `{{ company.* }}` is a supported spelling in a coded email template is not stated anywhere.

---

## 9. Why didn't a contact receive it

Work the documented path first: the email is published and not draft; the contact is on the list or matched the workflow; the contact is not unsubscribed, bounced, or suppressed; the send actually ran.

Then note the gap. HubSpot's article on why a send shows as not sent on the contact timeline lists thirty-odd reasons — bounces, spam flags, unsubscribes, invalid formats, domain blocks, engagement suppression, account limits, authentication failures — and **none of them is a template-rendering failure**. The closest entry is the catch-all: *"This email wasn't sent: this message appears when the contact cannot be sent an email and HubSpot was unable to determine a specific reason for the failure."*

So: **the absence of a template error on the timeline is not evidence the template rendered.** A recipient dropped for a function-limit breach is not going to announce itself there. If a subset of recipients got nothing and the deliverability reasons do not fit, count the function invocations before looking anywhere else.

---

## 10. Documented gotchas

1. **Filters do not apply to personalization tokens in email.** The single most important line in this skill.
2. **`{% elif %}`, not `{% elsif %}`.** Liquid muscle memory, hard error.
3. **`crm_objects()` returns a wrapper.** Iterate `.results`. Iterating the wrapper renders nothing and errors nothing.
4. **A `{% set %}` inside a `{% for %}` dies at `{% endfor %}`.**
5. **Tokens in conditionals require programmable email** on the module.
6. **Single-send `customProperties` cannot drive an `{% if %}`.** The template compiles first.
7. **`and` returns a boolean**, not an operand.
8. **`~` concatenates, not `+`.**
9. **Hyphens are not allowed in HubL variable names.**
10. **`|datetimeformat` and `|format_currency` are deprecated** in favour of `|format_datetime` and `|format_currency_value`.
11. **An HTML comment is not a HubL comment.** `{# #}` is the non-rendered form; `<!-- -->` ships in the source.
12. **Object type names in CRM functions are case-sensitive.**
13. **A/B tests are unavailable** on a programmable email that uses a CRM function.
14. **A cloned programmable email cannot send while the original is processing.**
15. **Space CRM-function sends at least an hour apart.**
16. **The web version of a CRM-driven email is a public page**, where only `product` and `marketing_event` are retrievable without password protection or membership login.

---

## 11. Pre-ship checklist

**Will it publish**

- [ ] All seven `site_settings` CAN-SPAM variables present
- [ ] `{{ unsubscribe_link }}` or `{{ unsubscribe_link_all }}` present
- [ ] Function invocations counted against **both** published limit regimes
- [ ] `templateType: email` set, and `isEnabledForEmailV3Rendering: true` if anything needs programmable email
- [ ] Error console checked via **Show details** after the last edit

**Will it render**

- [ ] `{% elif %}` everywhere, no `elsif`
- [ ] Every `crm_objects()` / `crm_associations()` loop iterates `.results`
- [ ] No `{% set %}` inside a loop that is read after it
- [ ] Every conditional containing a token is inside a programmable-email module
- [ ] No filter used as the fallback on a personalization token
- [ ] `~` for concatenation, not `+`
- [ ] No hyphens in variable names
- [ ] `{# #}` for comments, not `<!-- -->`

**Will it be correct**

- [ ] Every token has a fallback — global default, per-token fallback, or `personalization_token()`
- [ ] Every CRM query has an `{% else %}` branch for the empty case
- [ ] Values landing in a URL passed through `urlencode`
- [ ] Values landing in a script or JSON context escaped for that context, not just HTML-escaped
- [ ] Nothing from a CRM property, form field, or integration passed through `|render`
- [ ] Nothing in the single-send payload used to decide a branch

**Verified**

- [ ] Previewed as a contact with full data
- [ ] Previewed as a contact missing the key property
- [ ] Previewed as a contact whose CRM query returns nothing
- [ ] Test-sent with **Preview as contact** set
- [ ] Web version opened and checked for a 500
- [ ] Sender configuration verified by a real seed send, not a test send

---

## 12. What HubSpot does not document

Stated plainly because guessing here is how bad advice gets shipped.

- **No render timeout is published.** Not for HubL generally, not for CRM functions in email, not for a whole template. The only related guidance is operational — space CRM-function sends an hour apart.
- **Empty versus missing versus unknown contact.** HubSpot does not distinguish a property set to an empty string, a property never set, and a recipient it cannot resolve to a contact. They are all reported as blanks. Set a fallback and stop reasoning about it.
- **`{% break %}` and `{% continue %}`** are absent from the loops page in both directions. Not documented as supported, not documented as unsupported.
- **`{{- … -}}` output-tag whitespace control** appears nowhere in HubSpot's docs; only the `{%- … -%}` tag form does.
- **Whether HubL inside an HTML comment is evaluated.** Nothing states it is skipped. Assume it renders and ships.
- **Whether email templates auto-escape.** The `safe` filter refers to *"auto-escape environments"* without ever saying whether email is one.
- **Whether `{{ company.* }}` resolves in a coded email template.** `account` is the documented dictionary.
- **`{% capture %}`, `{% with %}`, `{% filter %}` blocks, `{% set %}` block form, `namespace()`.** Jinja or Django constructs absent from HubSpot's reference. Absent from the docs is not the same as absent from Jinjava — but an email send is the wrong place to find out.
- **Template rendering as a send-failure reason.** It is not on the contact-timeline "not sent" list at all.

When one of these comes up, the honest answer is that HubSpot does not say, followed by the test that would settle it: a preview as a seed or test contact, or a seed send.

---

## Sources

HubSpot: [HubL filters](https://developers.hubspot.com/docs/reference/cms/hubl/filters) · [If statements](https://developers.hubspot.com/docs/reference/cms/hubl/if-statements) · [Loops](https://developers.hubspot.com/docs/reference/cms/hubl/loops) · [HubL functions](https://developers.hubspot.com/docs/reference/cms/hubl/functions) · [HubL variables](https://developers.hubspot.com/docs/reference/cms/hubl/variables) · [Breaking change: HubL function limits for marketing emails](https://developers.hubspot.com/changelog/breaking-change-hubl-function-limits-for-marketing-emails) · [Create programmable emails](https://knowledge.hubspot.com/marketing-email/create-programmable-emails) · [Create emails with programmable content](https://developers.hubspot.com/docs/cms/guides/email/hubdb-crm-objects) · [Build a custom coded template](https://knowledge.hubspot.com/design-manager/build-a-custom-coded-template) · [Send a test marketing email](https://knowledge.hubspot.com/marketing-email/send-a-test-marketing-email) · [View personalized marketing emails on contact records](https://knowledge.hubspot.com/marketing-email/view-personalized-marketing-emails-on-contact-records) · [Email error: 'There was an issue sending an email to this contact'](https://knowledge.hubspot.com/email/why-does-my-email-send-show-not-sent-on-the-contact-timeline) · [Single send API](https://developers.hubspot.com/docs/api-reference/legacy/marketing/single-send/guide) · [Use custom tokens in automated emails](https://knowledge.hubspot.com/workflows/use-custom-tokens-in-automated-emails)
