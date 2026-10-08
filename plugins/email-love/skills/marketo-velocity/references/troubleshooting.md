# Marketo — Troubleshooting

## Contents

1. [Reserved words — check this first](#1-reserved-words--check-this-first)
2. [What renders when a value is missing](#2-what-renders-when-a-value-is-missing)
3. [Symptom lookup](#3-symptom-lookup)
4. [Things that fail the send outright](#4-things-that-fail-the-send-outright)
5. [Testing — Send Sample and Preview](#5-testing--send-sample-and-preview)
6. [What renders where](#6-what-renders-where)
7. [Documented gotchas](#7-documented-gotchas)
8. [Pre-ship checklist](#8-pre-ship-checklist)

---

## 1. Reserved words — check this first

**Every Marketo email is assembled using Velocity under the hood**, so these 13 strings are reserved *anywhere* in an email — including plain body copy and URL fragments, in emails containing no scripting at all:

```
#if  #else  #elseif  #foreach  #end  #set  #define
#macro  #include  #parse  #break  #stop  #evaluate
```

Documented real-world breakage: a link to `https://example.com/legal/#end-user-privacy-policy`, or body text reading "all the way to the #end". Both produce fatal validation errors.

**Fixes:**

- **In URLs** — percent-encode the first character after `#`: `#end` → `#%65nd`, `#if` → `#%69f`
- **In visible text** — insert a word joiner after `#`: `#&#8288;end`

When an email won't validate and contains no scripting, look here before anywhere else.

---

## 2. What renders when a value is missing

The two mechanisms differ completely. This is the most important operational distinction in Marketo.

### Tokens

| Situation | Renders |
|---|---|
| `{{lead.First Name}}`, field empty, no default | **Blank** — not the literal token |
| `{{lead.First Name:default=there}}`, field empty | `there` |
| Token name **misspelled or non-existent** | The **literal `{{lead.Frist Name}}`** ships to the inbox |
| My Token exists but the email is **outside its program/folder** | Literal token text; also absent from the Insert Token picker |
| My Token **deleted** but still referenced | **A blank space** |
| My Token in an **MSI / Sales Insight** send | Doesn't resolve — **but the default value does** |
| Nested token inside a My Token, in a **batch campaign** | **Not resolved** |
| Velocity `{{my.script}}` in **View as Web Page** or **Forward to a Friend** | **The raw token name is shown to the recipient** |

**Missing values render blank; missing names render raw.** That distinction is the fastest way to tell a data problem from a typo.

Token values are **HTML-encoded automatically** — `<` becomes `&lt;`. You cannot emit markup through a token.

### Velocity

Base Velocity: *"Velocity leaves the reference string in place when a reference is undefined."* `$baz` prints `$baz`; `$!baz` prints nothing.

But the Marketo-specific nuance changes the practical answer: **Marketo ensures lead field references are always Strings, never null.**

| Situation | Renders |
|---|---|
| `$lead.FirstName`, field empty in Marketo | **Empty string** — nothing prints |
| `$lead.Frist_Name` — wrong Velocity name | The **literal `$lead.Frist_Name`** |
| Correct name, field **not activated** in the editor tree | **Script fails at runtime** |
| `$CustomObjectList.get(0).Field` with a real null | Can be genuinely `null` — **custom objects can contain real nulls, unlike lead fields** |
| `$UndefinedList` when no records exist | Literal `$UndefinedList` unless `$!` is used |
| Boolean field, false | `""`; true is `"1"`. **Both truthy** |

Velocity output is **not** HTML-encoded — the inverse of token behavior. Use `$esc.html()` on anything that could contain markup.

---

## 3. Symptom lookup

### A default value is being ignored

| Cause | Fix |
|---|---|
| It's on an **Email Script token** | `:default=` doesn't work there at all. Handle the fallback inside the Velocity with `#if`/`#else` |
| The field isn't actually empty | Defaults fire only on empty. Whitespace, `"0"`, `"null"`, `"unknown"` all render literally |
| It's in the **preheader** | Tokens don't work in the preheader in Marketo's editor |

### A Velocity fallback never fires

Almost certainly `$display.alt` on a lead field. Those are empty strings, not null, so `alt` never substitutes. Use `.isEmpty()`:

```velocity
#if( $lead.FirstName.isEmpty() )Friend#else${esc.html($lead.FirstName)}#end
```

### A boolean branch always takes the same path

`""` and `"1"` are both truthy. Compare explicitly: `#if( $lead.myBool == "1" )`.

### A script does nothing, or fails at runtime

The referenced field wasn't **activated** by dragging it into the editor tree. Free-typed references are treated as plain text or fail at runtime. This is the single most common Velocity failure.

### Literal `$lead.Something` in the email

Either the Velocity name is wrong — it's the **SOAP API name**, which may retain spaces and need bracket notation — or `$!` quiet notation is missing.

### A comparison gives the wrong answer

String comparison is **lexical**: `"80" >= "100"` is true. Everything from Marketo is a String. Convert before comparing two values.

### Links are broken or untracked

| Symptom | Cause |
|---|---|
| Raw script in the address bar | An Email Script token inside a **tracked link** — the rewrite happens before Velocity compiles. Use a person token, or `class="mktNoTrack"` |
| Links in a loop aren't tracked | **Documented** — links output from a `#foreach` are not tracked |
| A link from a `#macro` is broken | The tracking server gets the literal `${var}`. Use `#define` |
| Clicks on a My Token URL aren't tracked | `https://` was stored **inside** the token value. Store the URL bare and put the protocol in the email |

### Tokens are empty on a form-triggered email

The form hasn't finished writing field values. **Add a Wait step as the first flow step** before Send Email.

### My Tokens stopped resolving after a reorganization

**Moving programs or folders affects token inheritance.** Re-verify references after any move.

---

## 4. Things that fail the send outright

Most Marketo personalization problems degrade. These do not:

- **`$TriggerObject` in a batch campaign.** *"The object is not available in batch campaigns, and the email send fails."*
- **More than 40 custom fields referenced by Velocity tokens in one email.** Exceed it and the email fails to send.
- **A reserved word** in body copy or a URL — fatal validation error.
- **`$class`, `$context`, or `resourceTool`** — permanently disabled June 2019; scripts using them fail compilation and the send fails.
- **A Velocity script referencing an unactivated field** — fails at runtime.

---

## 5. Testing — Send Sample and Preview

### Send Sample

Email Actions → **Send Sample**, from the asset list or within Edit Draft. Requires the **Access Database – Run Single Flow Actions** permission.

- **Person drop-down** — *"If you want to resolve tokens as a specific person, choose said person."* For Velocity, *"Select an existing lead in the Lead field so the script processes correctly."* Without one, Velocity won't process.
- **Trigger field** — *"only applicable for those utilizing email scripting."* When testing `$TriggerObject`, select the triggering object here; **Marketo uses the most recently updated object of that type.**
- **My Tokens resolve to the value appropriate to the email's program.**
- Multiple addresses are comma-separated and **all are visible to every recipient** — the first is the main recipient, the rest are CC.

### Preview

**View As: Lead Detail**, then pick a lead from a static list.

**The preview displays exceptions from script execution.** This is the primary Velocity debugging surface — the only place errors surface before a live send.

**View By** previews Dynamic Content segmentations; the arrows scroll through segments. Dynamic content can also be previewed under Content → Dynamic.

### The newline discrepancy

*"When an email is sent via Send Sample or via a Batch Campaign, newline characters in tokens are replaced with spaces. When email is sent via Trigger Campaign, newline characters are left untouched."*

**Your sample will not match your trigger send.** Worth knowing before someone debugs a spacing difference that isn't real.

---

## 6. What renders where

| | Send Sample | Preview (Lead Detail) | Real send | View as Web Page / F2F |
|---|---|---|---|---|
| `{{lead.}}` / `{{Company.}}` | Yes (pick a person) | Yes | Yes | Yes |
| `{{my.}}` simple tokens | Yes — the email's program value | Yes | Yes | Yes |
| `{{program.}}` | Yes | Yes | Yes | Yes |
| **Velocity `{{my.script}}`** | Yes (must pick a Lead) | Yes — **plus exceptions** | Yes | **Shows the raw token name** |
| `$TriggerObject` | Only via the **Trigger** parameter | Not documented | Trigger campaigns only; **batch send fails** | — |
| `{{trigger.}}` | No trigger context | No | Trigger campaigns only | — |
| `{{SP_Send_Alert_Info}}` | No — needs the Send Alert flow step | No | Send Alert only | — |
| `{{member.webinar url}}` | Needs an Event Program child campaign | Partial | Yes | — |

---

## 7. Documented gotchas

1. **Reserved words break unscripted emails.** See §1.
2. **`:default=` does not work on Email Script tokens.**
3. **`$display.alt` does not work on lead fields.**
4. **Marketo booleans are `""` and `"1"`, both truthy.**
5. **Everything arrives in Velocity as a String** — dates, numbers, booleans alike.
6. **String comparison is lexical.**
7. **A field's Velocity name is its SOAP API name**, not the display name minus spaces. Bracket notation when it contains spaces.
8. **Dragging fields is mandatory; typing them is dangerous.**
9. **Nested tokens don't resolve in batch campaigns.**
10. **Tokens don't work in the preheader** in Marketo's editor — use your own HTML in a template.
11. **PMCF tokens can't be used in the preheader, Date Tokens in Wait Steps, or Snippets.** Program Member Status isn't supported as a member token.
12. **Add a literal space between adjacent tokens** — Marketo doesn't insert one.
13. **Newlines in tokens** are replaced with spaces on Send Sample and batch, preserved on trigger.
14. **Velocity's default timezone is the server's.** Set an explicit IANA zone for any Date or Calendar work.
15. **Custom object list order is unreliable** — Adobe says last-updated, practitioners observe creation-date descending. Sort explicitly with `$sorter`.
16. **Deleting a referenced My Token leaves a blank space.**
17. **My Tokens don't resolve from Sales Insight sends** — defaults still do.
18. **An email must be a child of the program owning a token**, or inherit it from a marketing folder.
19. **Multiple Email Script tokens execute top to bottom and share scope** — this is the workaround for the unusable `#parse`/`#include`.
20. **The real editor hazard is the text-only version.** The commonly repeated "WYSIWYG mangles Velocity" claim is mostly a myth — scripts live in the My Tokens editor, not the email body, so the rich-text editor never touches them. Hand-editing the **text version** of an email containing script tokens *is* a documented source of compile errors. Regenerate it from HTML instead.
21. **There is no formatting option on a date token** — reformatting requires Velocity.
22. **`{{lead.Full Name}}` population is undocumented.** Prefer explicit First + Last with defaults.

---

## 8. Pre-ship checklist

**Will it validate and send**

- [ ] No reserved word (`#end`, `#if`, …) in body copy or a URL fragment
- [ ] No `$TriggerObject` in a batch campaign
- [ ] Fewer than 40 custom fields referenced across Velocity tokens
- [ ] No `$class`, `$context`, or `resourceTool`
- [ ] **Every field referenced in Velocity is activated in the editor tree**

**Will it be correct**

- [ ] `:default=` only on simple tokens, never on Email Script tokens
- [ ] Velocity fallbacks use `.isEmpty()`, not `$display.alt`
- [ ] Booleans compared to `"1"`, never tested directly
- [ ] `$!{...}` quiet notation on every output reference
- [ ] Velocity field names are SOAP API names; bracket notation where they contain spaces
- [ ] Dates parsed with `$convert.parseDate` before formatting
- [ ] An explicit IANA timezone set for any Date or Calendar work
- [ ] Lists sorted explicitly rather than trusting arrival order
- [ ] `$esc.html()` on any Velocity output that could contain markup
- [ ] The email lives inside the program or folder that owns its tokens

**Links**

- [ ] No Email Script token inside a tracked link — or `class="mktNoTrack"` applied
- [ ] Links needing tracking are not emitted from a `#foreach`
- [ ] Links emitted via `#define`, not `#macro`
- [ ] Complete `<a>` tags, protocol outside the variable
- [ ] My Token URLs stored without `https://`

**Verified**

- [ ] Send Sample with a seed or test person selected — not a production customer (and the Trigger field set, if using `$TriggerObject`)
- [ ] Preview → View As: Lead Detail, checked for script exceptions
- [ ] Previewed against a person **with** the key field and one **without**
- [ ] Aware the sample's newline handling differs from a trigger send
- [ ] Aware Velocity tokens show raw in View as Web Page

---

## Sources

Adobe: [Email Scripting](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/email-scripting) · [Send a Sample Email](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/creating-an-email/send-a-sample-email) · [Preview an Email with Dynamic Content](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/functions-in-the-editor/preview-an-email-with-dynamic-content) · [Understanding My Tokens](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/core-marketo-concepts/programs/tokens/understanding-my-tokens-in-a-program) · [KB ka-28507 — 40-field limit](https://experienceleague.adobe.com/en/docs/experience-cloud-kcs/kbarticles/ka-28507) · [KB ka-29217 — script token in URL](https://experienceleague.adobe.com/en/docs/experience-cloud-kcs/kbarticles/ka-29217) · [KB ka-29291 — form-triggered emails](https://experienceleague.adobe.com/en/docs/experience-cloud-kcs/kbarticles/ka-29291) · [Email Script my.tokens and defaults](https://nation.marketo.com/t5/knowledgebase/email-script-velocity-my-tokens-not-displaying-default-values/ta-p/251383) · [Unsupported Velocity Tools Disabled June 2019](https://nation.marketo.com/t5/knowledgebase/unsupported-velocity-tools-disabled-in-june-2019-release/ta-p/251177)

Practitioner reference (Sanford Whiteman / TEKNKL): [reserved words in Marketo emails](https://blog.teknkl.com/vtl-reserved-word-in-url-hash-marketo-part-1/) · [strings all the way down](https://blog.teknkl.com/marketo-vtl-strings-all-the-way-down/) · [hide email script tokens in web page view](https://blog.teknkl.com/hide-email-script-my-tokens-in-marketos-web-page-view/) · [dates and timezones](https://blog.teknkl.com/velocity-days-and-weeks/)
