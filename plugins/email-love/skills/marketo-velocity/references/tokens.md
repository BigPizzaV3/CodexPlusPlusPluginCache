# Marketo — Token Reference

## Contents

1. [Person tokens](#1-person-tokens)
2. [Company tokens](#2-company-tokens)
3. [Program, campaign and system tokens](#3-program-campaign-and-system-tokens)
4. [Trigger tokens](#4-trigger-tokens)
5. [Member tokens](#5-member-tokens)
6. [Sales Insight tokens](#6-sales-insight-tokens)
7. [Default values](#7-default-values)
8. [My Tokens](#8-my-tokens)
9. [Where tokens work](#9-where-tokens-work)
10. [Token families that do NOT exist](#10-token-families-that-do-not-exist)

---

## 1. Person tokens

`{{lead.Display Name}}` — **spaces preserved exactly as in the field's Token Name.**

```
{{lead.Acquisition Date}}          {{lead.Acquisition Program Name}}   {{lead.Acquisition Program}}
{{lead.Address}}                   {{lead.Anonymous IP}}               {{lead.Black Listed}}
{{lead.City}}                      {{lead.Country}}                    {{lead.Created At}}
{{lead.Date of Birth}}             {{lead.Department}}                 {{lead.Do Not Call}}
{{lead.Do Not Call Reason}}        {{lead.Email Address}}              {{lead.Email Invalid}}
{{lead.Email Invalid Cause}}       {{lead.Fax Number}}                 {{lead.First Name}}
{{lead.Full Name}}                 {{lead.Id}}                         {{lead.Inferred City}}
{{lead.Inferred Company}}          {{lead.Inferred Country}}           {{lead.Inferred Metropolitan Area}}
{{lead.Inferred Phone Area Code}}  {{lead.Inferred Postal Code}}       {{lead.Inferred State Region}}
{{lead.Is Customer}}               {{lead.Is Employee}}                {{lead.Is Partner}}
{{lead.Job Title}}                 {{lead.Last Name}}                  {{lead.Lead Source}}
{{lead.Marketing Suspended}}       {{lead.Middle Name}}                {{lead.Mobile Phone Number}}
{{lead.Original Referrer}}         {{lead.Original Search Engine}}     {{lead.Original Search Phrase}}
{{lead.Original Source Info}}      {{lead.Original Source Type}}       {{lead.Person Notes}}
{{lead.Phone Number}}              {{lead.Registration Source Info}}   {{lead.Registration Source Type}}
{{lead.Salutation}}                {{lead.SFDC Created Date}}          {{lead.SFDC Is Deleted}}
{{lead.SFDC Type}}                 {{lead.Unsubscribed}}               {{lead.Unsubscribed Reason}}
{{lead.Custom Field Name}}
```

**Owner tokens** — used for From / From Address:

```
{{lead.Lead Owner First Name}}   {{lead.Lead Owner Last Name}}   {{lead.Lead Owner Email Address}}
```

**On `{{lead.Full Name}}`:** it's a documented person token, but Adobe never states how it's populated — it is not a guaranteed runtime concatenation of First + Last. Practitioners widely report it unreliable. **Prefer `{{lead.First Name:default=…}} {{lead.Last Name:default=…}}`.**

**Person token values are HTML-encoded automatically.** `<` becomes `&lt;`. You cannot inject markup through a person token — that requires Velocity.

---

## 2. Company tokens

Adobe writes these with a **capital C**:

```
{{Company.Account Owner Email Address}}   {{Company.Address}}          {{Company.Annual Revenue}}
{{Company.City}}                          {{Company.Company Name}}     {{Company.Company Notes}}
{{Company.Country}}                       {{Company.Industry}}         {{Company.Main Phone}}
{{Company.Num Employees}}                 {{Company.Parent Company Name}}
{{Company.Postal Code}}                   {{Company.SFDC Account Num}} {{Company.SFDC Created Date}}
{{Company.SFDC Type}}                     {{Company.SIC Code}}         {{Company.Site}}
{{Company.State}}                         {{Company.Website}}
{{Company.Custom Field Name}}
```

Note the company-name token is `{{Company.Company Name}}`, not `{{company.Name}}`. Token names are case-insensitive in practice, but matching Adobe's casing avoids argument.

---

## 3. Program, campaign and system tokens

**Program** (capital N):

```
{{program.Name}}   {{program.Description}}   {{program.id}}
```

**Campaign** (lowercase):

```
{{campaign.name}}   {{campaign.id}}   {{campaign.description}}
```

**System:**

```
{{system.date}}                  →  Aug 08, 2013
{{system.time}}                  →  04:34 PM (GMT -0700)
{{system.dateTime}}              →  2013-08-08 16:36:13
{{system.unsubscribeLink}}
{{system.viewAsWebpageLink}}
{{system.forwardToFriendLink}}
```

**These formats are fixed and not configurable.**

`{{system.date}}`, `{{system.time}}`, `{{system.dateTime}}` work in the **Change Data Value**, **Interesting Moment** and **Create Task** flow steps, and in an email or template body.

`{{system.unsubscribeLink}}` and `{{system.viewAsWebpageLink}}` work **only as links** in an email or template.

**Your account time zone setting affects when date and time tokens run.**

`{{system.forwardToFriendLink}}` appears in Tokens Overview but is absent from the System Tokens Glossary — its supported contexts are undocumented.

---

## 4. Trigger tokens

Availability is **per-trigger** — Adobe publishes a full trigger × token matrix.

```
{{trigger.Trigger Name}}   the trigger itself, e.g. "Clicks Link in Email"
{{trigger.Name}}           the asset that triggered it, e.g. the URL or SFDC subject
{{trigger.Link}}           {{trigger.Subject}}          {{trigger.Category}}
{{trigger.Details}}        {{trigger.Web Page}}         {{trigger.Client IP Address}}
{{trigger.Sent By}}        {{trigger.Received By}}      {{trigger.Referrer}}
{{trigger.Search Engine}}  {{trigger.Search Query}}     {{trigger.Browser}}
```

MSI / sales extras from the same matrix: `{{trigger.Agent Email}}` · `{{trigger.Agent Name}}` · `{{trigger.Conversation Status}}` · `{{trigger.Conversation Summary}}` · `{{trigger.Conversation Transcript}}` · `{{trigger.Document Downloaded}}` · `{{trigger.Document Name}}` · `{{trigger.Document Opened}}` · `{{trigger.Document URL}}` · `{{trigger.Goal name}}` · `{{trigger.Page URL}}` · `{{trigger.Scheduled For}}` · `{{trigger.meeting status}}` · `{{trigger.routing queue name}}` · `{{trigger.source name}}` · `{{trigger.source type}}` · `{{trigger.ui type}}`

Trigger tokens resolve **only in trigger campaigns**. They have no value in a batch send or a sample.

---

## 5. Member tokens

Two distinct uses under one namespace.

**Service-partner values:**

```
{{member.webinar url}}          the person's unique webinar confirmation URL
{{member.registration code}}    registration code from the provider
```

`{{member.webinar url}}` only populates if the smart campaign sending the email is a **child asset of the Event Program**.

**Program Member Custom Fields (PMCF)** — every PMCF gets a `{{member.<field>}}` token.

- Usable in emails, landing pages, SMS, push, webhooks, and the **Create Task**, **Create Task in Microsoft**, **Interesting Moments**, **Change Data Value** and **Webhooks** flow steps.
- **Cannot** be used in the email **preheader**, in **Date Tokens in Wait Steps**, or in **Snippets**.
- **Program Member Status is not supported** as a member token.
- They only work **in the context of a program**.
- If empty, the default value substitutes when one is provided.

---

## 6. Sales Insight tokens

Only one is documented on current Experience League:

```
{{SP_Send_Alert_Info}}
```

It renders a block containing the person's name as a link to their Marketo detail, a link to the person in your CRM (only when they exist there; **not available with Dynamics**), the Marketo campaign name that sent the alert, and the time it was sent.

**It only works when the email is sent via the Send Alert flow step** — it will not work in a Send Email flow step. URLs inside alerts expire, per Admin → link expiration in reports and alerts.

Other `{{SP_...}}` tokens exist in legacy MSI documentation but are **not documented on current Experience League**. Don't rely on them without testing.

---

## 7. Default values

```
{{lead.First Name:default=there}}
{{lead.City:default=edit me}}
{{my.Alert Recipient:default=sales@example.com}}
```

Usually the Insert Token dialog's **Default Value** field writes the `:default=` suffix for you.

### Where it works

Email body · **subject line** · From / From Address / Reply-to · landing pages (rich text elements) · SMS · push notification bodies and Launch App URIs · Program Member Custom Field tokens · **Sales Insight sends** (where My Tokens themselves do *not* resolve, but defaults do).

### Where it does NOT work

**Email Script (Velocity) tokens.** Adobe is explicit: *"Email Script tokens are not designed to work with the `{{my.token:default=Some Value}}` syntax, which is for simple tokens."* Handle the fallback **inside the Velocity** with `#if`/`#else`, then reference the token bare as `{{my.myScript}}`.

**The email preheader** in Marketo's editor — the token doesn't work there at all.

Anywhere tokens don't work at all, such as Smart List filters.

### The gotcha

**A default fires only when the field is empty.** A field containing whitespace, `"0"`, `"null"`, or `"unknown"` renders that literal value. There is no documented blank-ish handling.

---

## 8. My Tokens

`{{my.Name Of Token}}`

### The eight types

| Type | Notes |
|---|---|
| **Calendar File** | Adds an .ics calendar event to emails and landing pages |
| **Date** | **Displays as year-month-day** (`2016-05-23`). Not configurable |
| **Email Script** | Executes a **Velocity script** in your emails |
| **Number** | Any integer, including negative |
| **Rich Text** | HTML, for emails and landing pages |
| **Score** | For the Change Score flow step |
| **SFDC Campaign** | Adds program members to an SFDC campaign |
| **Text** | Plain text. **Limit 524,288 characters (UTF-8) / 2 MB** |

### Where they're defined

1. **Program** — Marketing Activities → program → **My Tokens** tab → drag a type onto the canvas → name → value → Save.
2. **Campaign folder** — same flow on a folder. This is how you share a token across programs.
3. **Global** — **Admin → My Tokens** (Admin permissions required). Available tree-wide.

### Inheritance

- **Local Token** — created in that program or folder
- **Inherited Token** — created higher up the tree
- **Overridden Token** — inherited, then given an exception here

You can set global variables and override them at lower levels. **Moving programs or folders affects tokens — verify references after any move.**

### Resolution rules and traps

- **Nested tokens are not supported in batch campaigns.** A My Token whose value contains another token resolves only in triggers.
- An email sent from an **engagement program** that is a child email of a **default program** resolves My Tokens **from the default program the email lives in**.
- **My Tokens do not resolve when sending from Sales Insight** (Dynamics or Salesforce). Only standard tokens populate — though default values still work.
- **My Tokens won't appear in the Insert Token list** if the email isn't inside the owning program or campaign folder. An email in Design Studio can never see a program My Token.
- **Deleting a My Token that's still referenced leaves a blank space** where it was used.
- On **Send Sample**, *"My Tokens resolves to the value appropriate to the email's program."*

### URLs in My Tokens

Store the URL **without** the protocol and put `https://` outside the token, so Marketo can build a trackable link:

```
Token value:   www.example.com/landing-page
In the email:  https://{{my.My URL Token}}
```

Putting `https://` inside the token value means clicks aren't tracked. Omitting the protocol entirely can make the **View as Web Page** version render incorrectly.

---

## 9. Where tokens work

**Valid in:** email body, subject line, From / From Address / Reply-to, Marketo landing pages, snippets, SMS, push notifications, web campaigns, and the flow steps below.

**Not valid in:** the email **preheader** when using Marketo's editor (use your own HTML in a template instead), and the **Smart List** section of a Smart Campaign.

**Flow steps that accept tokens — these only:**

- Change Data Value
- Change Program Member Data
- Interesting Moment
- Salesforce Campaign steps (add, remove, change status)
- Create Task
- **Send Alert — in trigger campaigns only**

In **To Other Emails** on Send Alert you may use tokens like `{{lead.Territory Owner}}` or `{{my.Alert Recipient}}` **as long as the values are valid email addresses, and only in a trigger campaign, not a batch campaign.**

**Tokens cannot be used in the Smart List section of Smart Campaigns** — doing so yields errors or the campaign fails to trigger.

---

## 10. Token families that do NOT exist

**`{{list.}}`** — no such namespace in any Adobe documentation. Tokens Overview enumerates exactly seven families (Person, Company, Campaign, System, Trigger, Program, My Tokens) plus Member. Nothing on Experience League, developers.marketo.com, or the REST asset token API mentions a list namespace.

---

## Sources

Adobe: [Tokens Overview](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/demand-generation/landing-pages/personalizing-landing-pages/tokens-overview) · [System Tokens Glossary](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/using-tokens/system-tokens-glossary) · [Understanding My Tokens](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/core-marketo-concepts/programs/tokens/understanding-my-tokens-in-a-program) · [Managing My Tokens](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/core-marketo-concepts/programs/tokens/managing-my-tokens) · [Program Member Custom Field Tokens](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/core-marketo-concepts/programs/tokens/program-member-custom-field-tokens) · [Using URLs in My Tokens](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/using-tokens/using-urls-in-my-tokens) · [Use the Send Alert Info Token](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/using-tokens/use-the-send-alert-info-token) · [Use Tokens in Flow Steps](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/core-marketo-concepts/smart-campaigns/flow-actions/use-tokens-in-flow-steps) · [Trigger Tokens for Interesting Moments](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/marketo-sales-insight/msi-for-salesforce/features/tabs-in-the-msi-panel/interesting-moments/trigger-tokens-for-interesting-moments)
