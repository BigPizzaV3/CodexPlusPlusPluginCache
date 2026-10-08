---
name: draft-and-send-invoice
description: Draft, check, issue and send an Invoice in Essentio through the Essentio connector's tools, in that order, stopping at a refusal. Use this whenever the person asks to invoice or bill a Client, charge someone for work or products, prepare or send an Invoice, Proforma Invoice, Quote or Credit Note, or says things like "invoice ACME 500 euros and send it" — even when they do not name Essentio or say "draft".
---

# Draft, check, issue and send an Invoice

The Essentio connector (`essentio_*` tools) acts for one Business, the one the person chose when they
connected it, with the Role they gave it there. Every figure on a document is computed by Essentio when
the Draft is saved: your job is to put the right Client and Lines into a Draft, let the person see
what Essentio computed, and then issue and send only what they approved.

Work in this order. Each step says why, so you can adapt when the person asks for less (only a Draft,
or issue without sending).

## 1. Find the Client

Call `essentio_search_clients` with `search` set to the name, email, VAT number or account code the
person gave. Use the `id` of the Client that matches.

- Several match: show their names and emails and ask which one. Guessing would bill the wrong Client.
- None matches: ask whether to create one. `essentio_create_client` needs an `email`, a `country` and a
  `name` or `legal_name`; a VAT number is optional and is checked with the EU's VIES service. Create it
  only after the person confirms the details.

If you need the Client's currency or payment terms, `essentio_get_client` reads them.

## 2. Read the Business's setup

Call `essentio_get_business_setup` once. It gives the reporting currency, the active VAT rates (each
with the VAT category a Line takes at it) and the bank accounts. Take each Line's `vat_rate` and
`vat_category` from those rates rather than from memory: a rate the Business does not use is a
different document. A 0 rate in a category other than `S` and `Z` needs a `vat_exemption_code`
(a VATEX code) — ask the person for it rather than choosing one.

When the person names a Product or service they sell, `essentio_search_products` gives its name, unit,
price and VAT rate.

## 3. Create the Draft

Call `essentio_create_draft` with:

- `document_type`: `invoice` unless the person asked for a `proforma`, `quote` or `credit_note`;
- `client_id` from step 1;
- `currency`: the Client's currency if it has one, otherwise the Business's; ask if the person said
  another;
- `due_date` (YYYY-MM-DD): today plus the Client's payment terms, unless the person gave a date;
- `lines`: each with `description`, `quantity`, `unit_price` (VAT excluded) and `vat_rate`, all as
  decimal strings such as `"500.00"` and `"19"` — never as numbers.

A Draft has no number and no issue date, is not sent and counts in no report, so creating it commits
the person to nothing. A second identical `essentio_create_draft` within about ten minutes is answered
with the first Draft, marked as a replay, and creates nothing new; if the person really wants two
identical Drafts, send a fresh `idempotency_key` with the second.

## 4. Check the figures with the person

The person is shown the Draft as a card with its Client, Lines, VAT and Total. Read the same answer
yourself and compare it with what they asked for: the Client's name, each Line, `vat_groups`,
`subtotal`, `total_vat`, `total` and `currency`.

- Quote Essentio's figures as they are in the answer. Do not recompute VAT or totals and present your
  own numbers: Essentio's rounding is the one the document will carry.
- If something is not what the person meant (a price, a quantity, a rate, the wrong Client), change the
  Draft with `essentio_update_draft`. Only the fields you send change, and `lines`, when sent, replace
  every Line — so send them all.

Then read the answer's `actions`. Each Action is `{open, code, remedy}`:

- `actions.issue.open` false: the Draft cannot be issued as it stands. Say so, with its `code`, before
  asking to issue.
- `actions.send.open` false with `remedy` `connect_mail_provider`: Essentio cannot email the
  document for the Business right now — it has no email address of its own, its recipients through
  Essentio for today are all emailed (`sending_limit_reached`), or its connected mailbox was lost. Tell
  the person now, in the refusal's words, and give them the `remedy_url`, Essentio's email settings.
  Issuing still works.

## 5. Issue, once the person says so

Ask before issuing, and say what it means: the Draft takes its document number for good and today's
issue date, a due date already passed becomes today plus the payment terms, and an issued document can
no longer be deleted — only cancelled, or corrected with a Credit Note.

Then call `essentio_issue_document` with the `document_id`. It does not email anything.

The card has its own Issue and Send buttons. If the person pressed one, the card already shows what
happened: call `essentio_get_document` to read the document as it is now instead of issuing again.

## 6. Send, once the person says so

Ask before sending: `essentio_send_document` emails the document, attached, to the Client's address on
record, through the Business's connected mail account. It cannot send to any other address. `subject`
and `message` are optional; left out, the Business's own template is used. If the document is still a
Draft, sending issues it first.

An identical `essentio_send_document` call within about ten minutes emails nothing: it is answered with
the first call's answer, and a second text says "Nothing was written again: an identical
essentio_send_document call was made less than 10 minutes ago…". When you see that, tell the person the
document was not emailed again. If they do want it sent a second time, call it again with a fresh
`idempotency_key` of your choosing (a UUID). The same holds for `essentio_create_draft` and
`essentio_create_client`: an answer that says "Nothing was written again" is the first call's record,
not a new one.

Finish by telling the person the document number, its status and Total, and its `public_url`.

## When a tool fails

A failed call answers a tool error whose text is JSON: `{"error": {"type", "message", ...}}`. Tell the
person what happened in `message`'s words, and act on `type`:

- `refusal`: the Action is not open for the document as it stands. Quote `message`, which is written
  for the person, and name the `code`. Stop there — do not retry with other values on your own.
  Nothing was written, with one exception: a Send refused `mail_account_lost` (the connected mail
  account refused to renew its access) may have issued its Draft on the way — when the error carries
  a `document_number`, the Draft is now issued under that number and stays issued, unsent. With the
  `remedy` `connect_mail_provider`, Essentio cannot email for the Business right now, as the refusal's
  words say: the person puts it right in Essentio's settings (the document's `actions.send.remedy_url`
  leads there) — or, past the day's limit, waits for tomorrow — then asks to send again.
- `not_delivered`: the mail provider did not take the email. This is not "nothing written": a Send of a
  Draft issued it on the way. When the error carries a `document_number`, the Draft is now issued under
  that number and stays issued, unsent. Say so plainly, so the person does not think it is still a
  Draft, and do not issue it again.
- `permission`: the connection's Role may not do this (a Viewer's connection writes nothing). Someone
  with a higher Role in the Business has to do it, or the person reconnects with that Role.
- `invalid_request`: `errors` names each field at fault and what is wrong with it — a `client_id` that
  is not one of the Business's Clients is answered this way by `essentio_create_draft`. Fix what the
  person can confirm, and ask about the rest.
- `not_found`: a tool that names a record by its id — for example `essentio_issue_document`,
  `essentio_send_document` or `essentio_get_document` — did not find it in this Business. `message`
  names the search tool that lists them; find it again there.
- `idempotency_in_flight`: an identical call is still being performed, and nothing more was done. Make
  the same call again, unchanged, a few seconds later: it answers what the first one did. If the first
  call was refused or failed, it kept nothing, and the call again is a new attempt — before sending
  again, read the document with `essentio_get_document` to see whether it was issued or sent.
- `idempotency`: an `idempotency_key` you sent was used before with other arguments, and nothing was
  done. A new call takes a new key.

Two failures carry no such tool error:

- **The connector refused the request** (HTTP 429, a rate limit): the connection made more requests in
  the last minute than it may — every request counts, listing the tools included — and the request
  did not reach any tool. Wait about a minute. Before making a write again, read back with
  `essentio_get_document` or a search whether it happened.
- **An internal or server error**: a fault on Essentio's side, and it does not tell you what was
  written. Read the document back with `essentio_get_document`, or search for it, before calling
  anything again.

## In a Test business

When the connection is to a Test business, its documents are marked as samples and everything it sends
goes to its Owner, never to the Client. It is the place to try this workflow first.
`essentio_get_business_setup` and every document say so with `is_test: true`, and every number it
issues carries `TEST-`, such as `TEST-INV-2026-0007`. It issues no more Invoices a year than the
Free plan: past that, Issue and Send are refused `issuing_limit_reached`, which its Owner clears by
resetting it in Essentio. Tell the person it is a sample, not a real Invoice.
