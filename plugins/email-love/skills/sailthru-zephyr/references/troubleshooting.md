# Sailthru Zephyr — Troubleshooting

Symptom first, then the suppression mechanisms, then the pre-ship checklist, then an honest account of what Sailthru does not document.

## Contents

1. [Symptom lookup](#1-symptom-lookup)
2. [The email sent but was empty](#2-the-email-sent-but-was-empty)
3. [The email never arrived](#3-the-email-never-arrived)
4. [Suppression: `assert()` vs `cancel()`](#4-suppression-assert-vs-cancel)
5. [The Lifecycle Optimizer asymmetry](#5-the-lifecycle-optimizer-asymmetry)
6. [Feed failure modes](#6-feed-failure-modes)
7. [Rendering and syntax faults](#7-rendering-and-syntax-faults)
8. [Preview and test sends, and their limits](#8-preview-and-test-sends-and-their-limits)
9. [Pre-ship checklist](#9-pre-ship-checklist)
10. [What Sailthru does not document](#10-what-sailthru-does-not-document)

---

## 1. Symptom lookup

| Symptom | Likely cause | Fix |
|---|---|---|
| **Email sent, content area empty** | The feed returned successfully with too few items, or a filter removed everything | Guard in Setup: `{assert(length(content) > n, '…')}`. See §2 |
| **Email sent, one row empty, rest fine** | The loop ran past the end of a short feed | Slice to the number the layout needs, and assert on that number |
| **Email never sent, no error** | An `assert()` or `cancel()` in Setup fired | Read the Setup field first. See §4 |
| **Message suppressed but the journey kept going** | Expected behaviour | `assert()` and `cancel()` *"will not stop a Lifecycle Optimizer flow"*. See §5 |
| **Literal `{ name }` in the inbox** | A space after the opening brace | `{name}`. Nothing else is wrong with it |
| **Literal `{name}` in the inbox** | Zephyr in a field that does not parse it, or an unclosed `{if}`/`{foreach}` | Check every `{/if}` and `{/foreach}` |
| **A value renders blank in a campaign, fine in preview** | Static mode with `{single}` braces — evaluated at campaign creation, before there is a user | `{{profile.vars.x}}` |
| **A default never fires** | There is no `default` function in Zephyr | `{x ?: 'fallback'}` |
| **Guard behaves backwards** | `assert()` sends when true; `cancel()` cancels when true | See §4 |
| **A pinned hero item disappeared** | `filter()` or `dedupe()` on the feed | `filter_content()` |
| **A loop above your `sort()` came out reordered** | `sort()` sorts the global `content` array wherever it is called | Do all sorting once, in Setup |
| **Prices render as `1500`** | Prices are integers in cents | `{number(c.price/100, 2)}` |
| **Dates render wrong or unformatted** | strftime codes instead of Java `SimpleDateFormat` | `{date('MMM dd, yyyy', ts)}` |
| **A time is off by hours** | There is no timezone control in `time()` | Nothing to set. See §10 |
| **A link's Zephyr resolves to nothing** | Links evaluate in their own scope, not the body's | Assign the variable in the **Setup** field |
| **A link breaks on a value with a space or `&`** | Missing URL encoding | `{u(value)}` |
| **Quotes break in Email Composer** | *"Double quotes are not supported in Email Composer"* | Single quotes everywhere |
| **`{content.real-estate}` returns nothing** | Hyphenated keys cannot use dot notation | `{content['real-estate']}` |
| **Preview Text shows raw Zephyr in Email Composer** | Documented: *"Any Zephyr used in the Preview Text will not render in preview mode"* | Verify on a test send instead |
| **Template broke after someone renamed a snippet** | *"While you can rename a Code Snippet, doing so will break any template in which it is used"* | Rename back, or update every `{include}` |
| **Interest-based content is empty for some users** | `horizon_*` and the interest algorithms need the Personalize JavaScript and prior browsing | Provide a non-personalized fallback branch |

---

## 2. The email sent but was empty

This is the highest-value diagnosis in Sailthru work, because the platform's default behaviour is to send.

**The documented shape of the problem.** Sailthru documents exactly one feed condition that stops a campaign: a Content Feed configured with **If Minimum Not Found → Return a 404 (not found) error**, which *"would prevent a scheduled campaign from sending if it is returned at the scheduled send time."* The alternative setting on the same control, **Go further back in time**, carries the opposite note: *"If you select 'Go further back in time' and the Minimum Items quantity is still unavailable, a feed with fewer content items than the minimum will be returned."*

So a feed that comes back successfully with two items for a template that renders six is not an error state anywhere in the platform. Neither is a feed that comes back with none. The loop runs zero times, the layout collapses, and the message goes out.

Everything else that empties a template is your own code:

| Cause | How to spot it |
|---|---|
| `filter()` / `filter_content()` predicate matched nothing | Preview with **View As User** set to an affected user; print `{length(content)}` temporarily |
| A `personalize()` call with tag filters that exclude everything for this user | Same; try the same call with the tag filters removed |
| `image_required` excluding items silently | Add `'image_required': false` and compare counts |
| `expire_date` cutting the feed at a date boundary | The feed's own Preview icon shows what it returns *now* |
| A merged-feed key typo — `{Custom.content}` vs `{custom.content}` | Case sensitivity |
| Interest data absent for a user who has never browsed | Provide a fallback branch |

**The guard.** Put it in Setup, above everything that renders:

```zephyr
{content = filter_content(content, lambda c: length(c.image) > 0)}
{content = dedupe(content, 'url')}
{assert(length(content) >= 6, 'fewer than six renderable items in the feed')}
```

or, inverted:

```zephyr
{cancel(length(content) < 6, 'fewer than six renderable items in the feed')}
```

Assert on the number the **layout** needs, not on `> 0`. A three-across grid with one item is still a broken email.

For cart and profile-driven sends, guard the data the design assumes:

```zephyr
{assert(profile.purchase_incomplete, 'user has nothing in shopping cart')}
{assert(length(profile.purchases) > 0, 'no purchase history to reference')}
```

---

## 3. The email never arrived

Work in this order.

1. **Read the Setup field.** An `assert()` or `cancel()` there is the most likely explanation and the easiest to miss, because the body looks complete. `assert()` *"will prevent the campaign from being sent to a specific user"* with no other signal in the message itself.
2. **Establish whether it is all users or some.** All users points at the campaign, the list, or a Setup guard that is always true. Some users is always data-dependent — a var, a cart, an interest score, or a feed that differs per recipient.
3. **Preview as one of the affected users.** The Preview tab's **View As User** field takes any address. A failed `assert()` in preview *"will cause an error preventing rendering the page"*, so a preview that errors where another user's previews fine has told you the answer.
4. **Check the user profile.** A Test Send *"shows up on the User Profile as a transactional email"* and is *"logged in the Transactional Log Report"*, so previous test traffic is visible there.
5. **Check opt-out state.** `{profile.optout}` returns `all`, `basic`, or `blast`.
6. **Check whether this is a Lifecycle Optimizer flow**, and if so, whether the flow itself is Inactive — *"Setting a flow to Inactive immediately terminates the flow. Entries will not be allowed, and all users in the flow will immediately exit."*

Ask which of these the person has already done before theorizing. "What does Preview show with View As User set to one of the affected addresses?" ends most of these conversations.

---

## 4. Suppression: `assert()` vs `cancel()`

Two functions, opposite polarity. Both live in the **Setup** field (Advanced tab of the template editor).

| | `assert(expression [, message])` | `cancel(expression [, message])` |
|---|---|---|
| Sends when | expression is **true** | expression is **false** |
| Stops when | expression is `false`, `null`, `0`, or `""` | expression is **true** |
| Reads as | "this must be true to send" | "cancel if this is true" |

```zephyr
{assert(profile.purchase_incomplete, 'user has nothing in shopping cart')}
{cancel(profile.purchase_incomplete == null, "user's cart is empty")}
```

Those two lines do the same job. Mixing up the polarity produces a guard that suppresses exactly the audience you meant to reach, and nothing in the platform flags it — so say out loud which one you used and in which direction it reads.

**What terminating actually does**, by context, in Sailthru's words:

| Context | Effect of a failed `assert()` |
|---|---|
| Transactional messages | *"will prevent the message from sending"* |
| Triggers | *"will prevent any further execution of the trigger"* |
| Hosted pages or preview | *"will cause an error preventing rendering the page"* |
| Campaigns | *"will prevent the campaign from being sent to a specific user"* |

Note the last row: it is a **per-user** suppression, not a campaign-level stop. Other recipients still get the email.

`cancel()`'s published signature is `cancel(mixed input)` — one argument — yet every documented example passes a reason string as a second argument. Treat the reason string as supported and the signature as under-documented, and always pass one: the string is what a colleague reads when they inherit the template.

The canonical shape of the pattern (string single-quoted and apostrophe-free — double-quoted values are not reliably supported in Composer fields):

```zephyr
{content = filter_content(content, lambda c: c.vars.sailthru_vertical && c.vars.sailthru_topic == profile.vars.favorite_topic)}
{cancel(length(content) < 1, 'no content in the preferred topic')}
```

---

## 5. The Lifecycle Optimizer asymmetry

Both function pages carry the same note, in the same words:

> *"Note: `assert()` will not stop a Lifecycle Optimizer flow."*
> *"Note: `cancel()` will not stop a Lifecycle Optimizer flow."*

This is a real production trap, because it separates two things people assume are the same:

- **The message is suppressed.** The template's guard fired, that recipient does not receive that email.
- **The user's journey continues.** They advance to the next step, hit the next wait, receive the next message, and the flow's reporting shows them as having passed through.

So an abandoned-cart flow whose first email asserts on `profile.purchase_incomplete` will correctly skip the customer who checked out — and will then send them email two and email three, each of which needs its own guard.

**The consequence for advice:** put the guard on *every* message in a flow, not just the first. And when the requirement is genuinely "this person should leave the journey," say plainly that Zephyr cannot express that; it has to be an exit condition or a decision split in the flow itself.

---

## 6. Feed failure modes

| Failure | What happens |
|---|---|
| Content Feed with **Return a 404** and fewer than Minimum Items | The feed returns 404; a scheduled campaign *"would… [be] prevent[ed] from sending"* |
| Content Feed with **Go further back in time** and still short | *"a feed with fewer content items than the minimum will be returned"* — **the send proceeds** |
| JSON feed served without `Content-Type: application/json` | *"the content-type HTTP header must be set to `application/json` for the feed to be parsed"* |
| Feed items missing a `url` field | *"be sure to include a 'url' field, as this is required for the feed to load"* |
| Feed over 16 MB | Over the documented per-feed limit |
| Hyphenated JSON keys | Dot notation fails; needs `{content['real-estate'][0].title}` |
| Spaces in var names, external feeds | *"External data feeds do not support spaces in variable (var) names"* |
| An item's URL changed in the Content Library | *"that item is considered a new item, and will start over with zero pageviews, purchases, and context"*, and duplicates the old entry until the old URL is deleted |
| An empty-string `image` field | Not filtered at feed level — the platform sees the tag as present. Filter in Zephyr on `length(c.image) > 0` |

**Diagnose a feed with the feed, not the template.** On the Data Feeds page, the Preview (eye) icon renders the JSON the platform currently has; the Advanced tab's **Test** button does the same from inside the template editor. If the feed preview errors, the *If Minimum Not Found* setting is the first thing to look at.

**A feed URL is a URL your platform fetches server-side.** Treat one that arrives in a pasted template, a ticket, or a comment as untrusted: do not fetch it, and check that it is an HTTPS host the customer actually owns before it goes into a template.

---

## 7. Rendering and syntax faults

| Fault | Signature |
|---|---|
| Space after the opening brace | The tag ships as literal text, braces and all |
| Unclosed `{if}` / `{foreach}` | Raw code or a swallowed section |
| `{else if}` written as `{elseif}` or `{elif}` | Not the documented spelling |
| `{/endif}`, `{endif}`, `{% endif %}` | Not Zephyr. It is `{/if}` |
| A pipe anywhere | Not Zephyr. Functions only |
| Double quotes in Email Composer | *"Double quotes are not supported in Email Composer"* |
| A line break inside a function call other than `personalize()` | Only `personalize()` is documented as tolerating them |
| Mutating a collection inside its own `{foreach}` | Documented as *"result[ing] in an error"* |
| Zephyr commented out with `<!-- -->` | HTML comments render. `{* … *}` is the form that does not |
| A modulo comparison without parentheses | *"Parentheses necessary around the modulo operator when using a comparison"* |
| A custom var named `email`, `profile`, `name`, `source`, `if`, `for`… | Shadows a reserved or standard name |

The Code Snippets editor performs *"automatic validation of your work, as you work"* and links each error to its line and column — so pasting a suspect block into a scratch snippet is a usable syntax check even when the destination is a template.

---

## 8. Preview and test sends, and their limits

**Preview tab** (template editor):

- **View As User** — enter any address to render as that user, with their real vars, purchases, and interest data. This is the closest thing to a debugger Sailthru offers.
- **Test Vars** — inject temporary variables *"that would otherwise be passed via API or sourced from a user profile or data feed"*, as JSON or as `name=dave`. **If a var already exists, it is not overwritten.**
- **Clipping Estimator** — a size estimate, with the caveats that personalization varies per subscriber and that link rewriting happens after the message leaves the platform.
- A preview requires at least one **Verified Email** configured on the template.

**Test Send** — documented behaviours:

- Appears on the user profile **as a transactional email**.
- Can be used to test triggers.
- Is logged in the **Transactional Log Report**.
- Produces a working opt-out link, but *"opt-out actions on that page will not be recorded"*; the page *"will redirect as if this was a live send."*

**What preview will not tell you:**

- **Static-mode brace behaviour.** Single-brace evaluation happens at campaign creation, which is not a thing preview simulates.
- **Zephyr in Email Composer's Preview Text field** — *"Any Zephyr used in the Preview Text will not render in preview mode."*
- **Whether a feed will be short at send time.** Preview shows the feed as it is now; a scheduled campaign resolves the feed at the scheduled send.
- **Which recipients an `assert()` will suppress.** Preview tells you about one user at a time.
- **`time()` in the web view.** *"When the user is viewing the web/browser-based version of an email, the page-load time is used"* — so a countdown in the web view differs from the same countdown in the inbox. Use `date()` for send time.

**Test deliberately, not incidentally.** Three preview runs answer most questions: a user missing the key var, a feed with fewer items than the design needs, and a feed with none.

---

## 9. Pre-ship checklist

**Will it parse**

- [ ] No space after any opening brace
- [ ] Every `{if}` has `{/if}`, every `{foreach}` has `{/foreach}`
- [ ] `{else if}`, two words
- [ ] No `|` anywhere
- [ ] No `{% %}` — that is ZML or Liquid, not Zephyr
- [ ] Single quotes throughout, mandatory in Email Composer
- [ ] Every function call other than `personalize()` on one line
- [ ] Zephyr commented with `{* *}`, never `<!-- -->`
- [ ] No custom var shadows a reserved or standard name
- [ ] Hyphenated feed keys use `['bracket-quote']` notation

**Will it send the right thing**

- [ ] The brace style matches the campaign mode — `{{ }}` for per-user values in a static campaign
- [ ] Every guard is in the **Setup** field, not the body
- [ ] `assert()`/`cancel()` polarity checked out loud, in both directions
- [ ] Every message in a Lifecycle Optimizer flow carries its own guard, because neither function stops the flow
- [ ] `length(content)` asserted against the number the **layout** needs, not against zero
- [ ] Cart-dependent sends assert on `profile.purchase_incomplete`

**Will it be correct**

- [ ] `filter_content()` on the feed's `content` array; `filter()` only on other arrays
- [ ] `dedupe()` replaced with `filter_content()` where Recommendations pinning is in use
- [ ] All `sort()` calls done once, in Setup, before anything renders
- [ ] Every price divided by 100 and formatted with `number(…, 2)`
- [ ] Dates use Java `SimpleDateFormat` letters
- [ ] Every fallback uses `?:` or `{if}` — there is no `default`
- [ ] Every value in a query string wrapped in `u()`
- [ ] Every value that came from a feed, profile, or partner and lands in HTML wrapped in `h()`
- [ ] Any variable a link depends on assigned in **Setup**, not the body
- [ ] No `api_user()` / `api_send()` / `api_event()` / `append_user_var()` in code you did not write deliberately
- [ ] `{optout_confirm_url}` present; `{beacon}` or `{beacon_src_ssl}` present in an HTML template

**Verified**

- [ ] Previewed with **View As User** on a user missing the key var
- [ ] Previewed against a short feed and an empty feed
- [ ] Test Vars used to simulate the send-API payload
- [ ] Test sent, and the plain-text version checked
- [ ] Any temporary `{length(content)}` debug output removed

---

## 10. What Sailthru does not document

Stated plainly, because guessing here is how wrong advice enters a template.

**There is no Zephyr error catalogue.** No enumerated list of runtime errors, no error-code table, no per-error meaning. The Code Snippets editor surfaces validation messages inline, and a failed `assert()` errors in preview — beyond that, a broken template's diagnosis is empirical.

**There is no per-message render log.** Nothing comparable to another platform's message activity log or abort-reason enum. The Transactional Log Report records transactional traffic; there is no documented surface that says "this recipient was suppressed by an `assert()` at 14:02."

**What an undefined variable renders as has no stated general rule.** The tutorial says an unset var *"will return false"* in a conditional, and one static-mode example shows a missing profile var rendering as nothing at all. There is no documented contract for the printed form across contexts. Guard the value rather than relying on the blank.

**There is no namespace matrix.** Standard variables, profile vars, send-API vars, and feed top-level keys all occupy the same global scope, and no published table says which wins on a name collision, or which of them exist in which context (subject line vs body vs link vs Setup vs hosted page). Qualify paths, and prefix integration-supplied vars.

**Lifecycle Optimizer Zephyr is largely undocumented.** The Zephyr overview names Lifecycle Optimizer push notifications as a Zephyr surface, and `assert()`/`cancel()` both carry the note that they do not stop a flow. Beyond that there is no LO-specific Zephyr reference: no documented list of flow-scoped variables, no statement of what data an LO-triggered message can see that a campaign cannot, no error surface. Treat LO Zephyr as "template Zephyr, running inside a flow that will not stop," and verify anything more specific on the account.

**Whether Zephyr inside an HTML comment is evaluated is not stated.** The docs say only that Zephyr comments, *unlike* HTML comments, do not render. Use `{* *}` and the question does not arise.

**Precedence, coercion, and error-on-type are undocumented.** Comparing a string to a number, adding an object to a list, and comparing timestamps of different types are all reachable and none are specified. Cast explicitly with `int()` or `number()`.

**Rate and volume behaviour for external feeds is unstated** — no documented timeout, retry count, or caching TTL for a feed URL fetched at send time, beyond the 16 MB size limit and the recommendation to import feeds so the platform caches them.

When any of these comes up, say it is undocumented rather than filling the gap. The repository's standing rule applies: do not claim a platform behaviour is fixed unless current first-party documentation or a recorded test supports it.

---

## Sources

Zeta Engage by Sailthru: [assert](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/assert.html) · [cancel](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/cancel.html) · [filter_content](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/filter-content.html) · [filter](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/filter.html) · [dedupe](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/dedupe.html) · [sort](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/sort.html) · [time](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/time.html) · [Create a Content Feed](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/create-feed.html) · [Set Up a Data Feed](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/set-up.html) · [Call an External Data Feed](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/call-external-data-feed.html) · [Template Editor](https://products.zetaglobal.com/sailthru/Content/messaging/email/html-templates/template-editor.html) · [Email Composer Overview](https://products.zetaglobal.com/sailthru/Content/messaging/email/emco-templates/overview.html) · [Code Snippets](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/code-snippets.htm) · [Expressions and Operators](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/expressions-operators.html) · [Control Structures](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/control-struc.html) · [Single Vs. Double Braces](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/single-double-braces.html) · [Lifecycle Optimizer Flow Builder](https://products.zetaglobal.com/sailthru/Content/lo/overview/flow-builder.html)
