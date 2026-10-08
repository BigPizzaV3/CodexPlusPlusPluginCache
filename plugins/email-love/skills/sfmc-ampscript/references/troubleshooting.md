# SFMC — Troubleshooting

## Contents

1. [The failure classes](#1-the-failure-classes)
2. [Email send error codes](#2-email-send-error-codes)
3. [Where errors surface](#3-where-errors-surface)
4. [Silent exclusions](#4-silent-exclusions)
5. [Symptom lookup](#5-symptom-lookup)
6. [Preview and test sends](#6-preview-and-test-sends)
7. [Documented gotchas](#7-documented-gotchas)
8. [What is not documented](#8-what-is-not-documented)
9. [Pre-ship checklist](#9-pre-ship-checklist)

---

## 1. The failure classes

**The headline fact: an AMPscript failure produces a non-send, not a broken email and not a bounce.** Nothing leaves the platform for that subscriber.

| Situation | Behavior |
|---|---|
| Field exists but is **null/empty** | Renders **blank**. Message **sends**. *"If you insert a personalization string, and the subscriber attribute isn't populated, the string will appear blank in the email."* |
| Field **does not exist in the sending context** | **Runtime error; the send terminates for that subscriber.** *"If you reference a Profile Attribute or Data Extension column name that does not exist in your sending audience, your send will terminate with a runtime error."* Surfaces as *"An unrecognized expression appears in a script block"* |
| A function raises | Errored/NotSent — error **100** or **103** |
| Recursion | **104 RecursiveScriptError.** These *"are considered 'Errored/NotSent,' and count against the subscriber error limit threshold"* |
| `Lookup()` / `LookupRows()` finds nothing | **Not an error.** `RowCount()` is 0, `Lookup()` returns empty, the send proceeds with blank output unless handled |
| `RaiseError(msg, true)` | Skips **only this subscriber**, job continues |
| `RaiseError(msg)` — default `false` | **Stops the entire email job.** In journeys it removes subscribers from the current send only, not the journey |
| Resolved subject empty | **127 Empty Subject** |
| Resolved body too short | **128 Resolved Email Body Too Short** |
| `HTTPGet` returns empty | **112** / **113** |

**The defensive pattern:**

```
%%[
  SET @tier = AttributeValue("RewardTierPoints")
  IF Empty(@tier) THEN
    SET @msg = "Welcome"
  ELSE
    SET @msg = Concat("You have ", @tier, " points")
  ENDIF
]%%
```

`AttributeValue()` *"is a better option than making a direct reference to the attribute because it returns null if no data is found."*

**Note on the non-existent-field claim:** the "hard failure" wording comes from ampscript.guide, the community reference, not from Salesforce's own docs — Salesforce only documents the *unpopulated* case. No Salesforce page states what a bare `%%NonExistentField%%` in raw HTML (outside a script block) renders as. The commonly observed behavior is that it renders literally, but that is undocumented. Test rather than assume.

---

## 2. Email send error codes

The content-relevant subset of the official list:

| Code | Name | Meaning |
|---|---|---|
| 26 | Build Email Error | An error occurred building an email for the subscriber |
| 46 | Message Render Failure | Subscriber's message didn't render properly |
| 54 | Validation Error | Validation error when evaluating the message |
| **100** | Error | An error occurred when building the email for the subscriber |
| **103** | Message Build Error | An error occurred when building the subscriber message |
| **104** | Recursive Script Error | A script contains a self-reference that can lead to infinite recursion |
| 106 | Missing Send DE Source Row | Missing source row for the subscriber in the send source |
| **111** | Script RaiseError | Subscriber excluded by a `RaiseError` call |
| 112 | Empty HTTPGet Return Error | An HTTPGet request returned an empty result |
| 113 | Empty HTTPGet Function Return Error | An HTTPGet function request returned an empty result |
| 127 | Empty Subject | The resolved subject is empty |
| 128 | Resolved Email Body Too Short | The resolved body is too short |
| 130 | Payload Exceeds Maximum | Payload too large |
| 131 | Link Data Exceeds Maximum Size | Compressed job subscriber link data too large |
| 136 | Subscriber Key Mismatch | Subscriber/contact key doesn't match the send DE key |

**Exclusion family** (not content errors, but they show up in the same extract): 1 Unsubscribed · 2 Held · 4 Missing Email Address · 5 Invalid Email Address · 10 Missing Required Attributes · 19 Missing Required Fields · 20 Invalid Field Value · 23 Domain Exclusion · 24 List Detective · 27 Suppression List · 33 Account Level Opt Out · 1000/1010/1020/1030/1040 unsub/held/deleted.

**Triggered send timing:** 43 Expired triggered send request · **138** Expired after **72 hours** · 139 Timed out in the queue.

**Triggered send definition errors** run 17000–17205 and 18000–18008. Note **17112 Invalid Personalization String** — a *definition-time* validation failure, caught before any send.

---

## 3. Where errors surface

**1. NotSent Tracking Extract — the primary mechanism.**
Automation Studio → Data Extract Activity → **Tracking Extract**, tick **Extract Not Sent**, **Extract Subscribers**, **Extract Unsubs**, supply SendIDs/JobIDs, then a File Transfer Activity to FTP. Output is a .zip.

For triggered sends the data appears shortly after each send. For bulk sends it appears **only after the whole job completes**.

**2. Send Logging Data Extension** — runtime send attributes, *"access to data not available via standard tracking functions."*

**3. Email Studio Tracking → Subscribers Not Sent To report.**

**4. Start from the JobID** — *"this unique identifier links all send-level data and is essential for investigation."*

### What you cannot read

**`RaiseError`'s own message is not available in Send Tracking.** *"Error messages output by arguments 1, 3, and 4 are not available from Send Tracking in Email Studio"* — retrieving them requires Marketing Cloud Support.

**The consequence: write your own log row to a Data Extension before calling `RaiseError`.** Salesforce's own documentation example does exactly this. If someone is relying on RaiseError messages for diagnostics, they are not getting them.

RaiseError-suppressed sends aren't counted toward billing usage, and Salesforce recommends using it *"only to handle errors, not as a method of segmenting subscribers."*

---

## 4. Silent exclusions

These produce **no error, no delivery, and no bounce** — a recipient simply isn't there:

- **Non-active subscribers.** *"The system silently skips any subscriber who is not in an Active state (Unsubscribed, Bounced, or Held)."*
- **Exclusion and suppression lists** — applied **before** email building.
- **List Detective** — *"email addresses are validated at send time"*; invalid, inactive and spam-trap addresses are dropped silently.
- **Contacts in the Contact Delete pipeline.**

When a count doesn't reconcile and the error extract is clean, this is where the missing recipients went.

---

## 5. Symptom lookup

### Subscriber shows Errored / NotSent

| Cause | Check |
|---|---|
| Reference to a column not in the sending audience | The sendable DE's actual schema vs every attribute referenced |
| A function raised | Error code 100 / 103 in the NotSent extract |
| Recursion | Code 104 |
| `RaiseError` fired | Code 111 — and check whether the second argument was omitted, which stops the whole job |
| Missing send DE source row | Code 106 |
| Subscriber key mismatch | Code 136 |

**Affecting only part of the audience** is the signature of a data-dependent build failure — the template is fine for subscribers who have the field.

### Blank where a value should be

The field exists and is empty. Benign — add a fallback with `AttributeValue()` + `Empty()`, or `IsNullDefault()`.

If it's a `{{ }}` binding rendering blank instead, check **case** (JB bindings are case-sensitive), **quoting** for names with spaces, and whether the contact exists in **all linked data extensions**.

### Subject line empty (code 127)

Almost always a variable set only in the HTML body, rendering for a **text-preference** subscriber. AMPscript processes HTML body → text body → subject line, and a text-preference subscriber never executes the HTML part. Set the variable in both parts, or compute inline.

### Duplicate-key error on a data write during a send

Send-time AMPscript writes are **batched to the end of the send**, so a check-then-`InsertDE` doesn't work. Use `UpsertDE`.

### A write happened for some subscribers only

Writes execute only in the subscriber's **preferred email type**. If the write lives in the HTML part, text-preference subscribers never run it.

### Journey won't activate

Publish-time validation. For date-based entry events, *"Without matching Profile Attributes, emails fail validation and journeys won't activate."*

Also: JB *"only passes the Subscriber Key/Contact Key, Email Address, and Salesforce Mapped Profile Attributes when creating new subscribers."* If the account has other **required** Profile Attributes, subscriber creation fails and so does the send. Fix with default values on all required attributes, or pre-import via Automation Studio.

### Reporting shows the wrong URL for AMPscript-built links

In the `_Click` data view, `URL` does **not** contain resolved AMPscript — `LinkContent` does.

---

## 6. Preview and test sends

**Preview and Test** lets you pick a list, group, Data Extension, or audience, then a subscriber. *"Marketing Cloud Engagement uses the selected subscriber's data strictly to render personalization and dynamic content."* Selecting a subscriber does **not** email them; test mail goes only to addresses on the Recipients tab, **max 5**.

Personalization modes: *Based on \<subscriber\>* · *Based on \<list or data extension\>* (renders a version per subscriber) · *Based on \<recipient test data extension\>*.

### Things to warn users about

- **A test send counts as a send** against your contracted volume.
- **Side effects are real.** Changes made during preview — subscriber attributes, unsubscribes, profile centre changes — *"permanently apply to that subscriber."* Preview against a dedicated seed or test subscriber, never a production customer, and point any `UpsertDE`/`DeleteDE`/`InsertDE` write or `HTTPGet`/`HTTPPost` call at an isolated test Data Extension or test endpoint before previewing the block at all.
- **Content Builder test sends are not recorded** on the Send Log DE by default.
- If the previewed subscriber is unsubscribed, bounced or held, *"the generated preview doesn't deliver any test send."*

### What does not work in preview

- **Client/OS rendering** — *"doesn't display in a particular operating system or email client."* Not a rendering test; use Litmus for that.
- **Thumbnails render no personalization at all** — *"Thumbnails don't include a rendering of any personalization or AMPscript."*
- **Journey `{{ }}` bindings do not resolve** — preview supplies subscriber context only, with no journey or event context. (Follows from the documented preview data sources; not stated explicitly.)
- Whether `RaiseError` aborts a preview is only documented on ampscript.guide (*"the error message displays before send abortion"*) — unverified against Salesforce docs.

### Syntax validation

**Classic Content** has a toolbar **Validate** button that *"will provide additional details on any syntactical issues."* In **Content Builder** this validation is built in and *"displayed in red in the Preview and Test step."*

---

## 7. Documented gotchas

1. **Gate rowsets on `RowCount(@rows) > 0`** — the clearest canonical guard, and it feeds the loop bound directly. Salesforce also documents `Empty(@rows)` / `IsNull(@rows)` as valid empty-rowset checks, so an existing `IF NOT Empty(@rows)` guard is working style, not the bug.
2. **`IIf()` evaluates both branches.** Never nest a `Lookup()` or `HTTPGet()` in a branch you expect skipped.
3. **`DateDiff(startDate, endDate, unit)` returns `endDate − startDate`** (documented). Pass the earlier date first for a positive count.
4. **`RaiseError`'s second argument defaults to `false`, which stops the whole job.**
5. **No arithmetic operators.** `Add()`, `Subtract()`, `Multiply()`, `Divide()`, `Concat()`.
6. **Personalization strings are case-insensitive; `{{ }}` bindings are case-sensitive.** Two syntaxes, two rules.
7. **Square brackets for attribute names with spaces** in AMPscript; **double quotes** for the same in `{{ }}` bindings.
8. **Smart quotes are not recognized.** Paste as plain text.
9. **Send-time writes are batched to the end** and execute only in the preferred email type.
10. **`Field()` errors on a missing column** unless you pass `0` as the third argument.
11. **Content block functions default to erroring** when the block isn't found — pass `0` and a fallback.
12. **Content block functions in subject/from lines must target a Code Snippet block.**
13. **`Lookup()` returns the first match with no guaranteed order** — *"it's best to use this function to search for identifiers that are unique."*
14. **`LookupRows()` returns an unordered rowset** capped at 2,000. Use `LookupOrderedRows()` for determinism.
15. **`Now()` is CST with no daylight saving.**
16. **A `FOR`/`NEXT` pair must live in the same named or typed script block.**
17. **Recursion errors** — 104, no workaround.
18. **Date-based journey entry events pass no journey data.**
19. **Dynamic link aliases cap at 100 unique resolved names**; excess tracks under the unresolved name.

---

## 8. What is not documented

Worth knowing so you don't over-claim:

- **No published AMPscript execution timeout.** No per-subscriber script time limit, no per-message lookup cap. Commonly cited figures (30s, 60s) do not appear in Salesforce's docs.
- **No documented cap on the number of `Lookup*` calls per message.**
- **Divide-by-zero behavior is undocumented.** Assume it throws to 100/103, but that's unverified.
- **Type-mismatch behavior is undocumented.** The parameters page states only that order matters and that null or `""` skips a parameter.
- **The numeric subscriber error limit threshold is not published**, though errors are documented as counting against it.
- **The SendLog template's column list is not published.**
- **No emailed error report** for AMPscript failures is documented. Alert Manager exists but isn't documented as covering content errors.

---

## 9. Pre-ship checklist

**Will it build**

- [ ] Every attribute referenced exists in the sending audience — or goes through `AttributeValue()`
- [ ] Every rowset gated before looping — `RowCount(@rows) > 0` preferred
- [ ] No `Lookup()` or `HTTPGet()` inside an `IIf()` branch
- [ ] `Field()` on possibly-missing columns passes `0` as the third argument
- [ ] Content block calls pass `0` plus a fallback if the block could move
- [ ] Every `RaiseError` that should skip one subscriber passes `true` as the second argument
- [ ] `ELSEIF` / `ENDIF` spelled as single words, `THEN` present
- [ ] `FOR` and its `NEXT` in the same script block
- [ ] Straight quotes, not smart quotes
- [ ] Comments are `/* */`, not `//`

**Will it be correct**

- [ ] `DateDiff(startDate, endDate, unit)` — earlier date first for a positive count
- [ ] Math via `Add`/`Subtract`/`Multiply`/`Divide`, concatenation via `Concat`
- [ ] Prices through `FormatCurrency()` or `FormatNumber()`
- [ ] `{{ }}` bindings match case exactly; names with spaces in double quotes
- [ ] Subject-line variables set in **both** HTML and text parts
- [ ] Content blocks in subject/from lines are Code Snippets
- [ ] Send-time writes use `UpsertDE`, not check-then-`InsertDE`
- [ ] Journey data assumptions valid — not a date-based entry event
- [ ] `Lookup()` only used on genuinely unique keys

**Verified**

- [ ] Previewed against a subscriber **with** the key attribute
- [ ] Previewed against a subscriber **without** it
- [ ] Content Builder shows no red validation errors
- [ ] For a journey: the journey validates and activates
- [ ] Aware that the test send counts against volume and mutates the previewed subscriber

---

## Sources

Salesforce: [Email send error codes](https://help.salesforce.com/s/articleView?id=mktg.mc_es_email_send_error_codes.htm&type=5) · [Personalization strings](https://help.salesforce.com/s/articleView?id=sf.mc_es_personalization_strings.htm&type=5) · [AttributeValue()](https://developer.salesforce.com/docs/marketing/marketing-cloud-ampscript/references/mc-ampscript-utilities/mc-ampscript-reference-utilities-attribute-value.html) · [RaiseError()](https://developer.salesforce.com/docs/marketing/marketing-cloud-ampscript/references/mc-ampscript-utilities/mc-ampscript-reference-utilities-raise-error.html) · [AMPscript function parameters](https://developer.salesforce.com/docs/marketing/marketing-cloud-ampscript/guide/mc-ampscript-guide-language-basics-parameters.html) · [Subscriber preview and test send](https://help.salesforce.com/s/articleView?id=mktg.mc_es_subscriber_preview_test_send.htm&type=5) · [Triggered email error codes](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/triggered_email_scenario_guide_for_developers_errors.html) · [Send logging](https://help.salesforce.com/s/articleView?id=mktg.mc_es_send_logging.htm&type=5) · [Data views](https://help.salesforce.com/s/articleView?id=sf.mc_as_data_views.htm&type=5) · plus [ampscript.guide](https://ampscript.guide/) best-practice pages.
