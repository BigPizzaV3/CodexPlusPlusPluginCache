---
name: stacktree-deliverable
description: 'Hand a finished report or proposal to a client at a private link. Use when the user says "send this to the client", "share this with <company>", "this is for a customer", or is handing a polished deliverable to someone outside their team. Produces a page in the Client deliverable shape (a clean editorial "sheet" prepared-for-a-named-recipient), gates it to the recipient, removes the auto-expiry so the link stays live, and refuses to ship if the page leaks PII.'
---

# stacktree-deliverable

Publish a client-facing deliverable to **stacktr.ee** and return a private link the
client can open in a browser, no account needed. This is the publish path for the
`client-deliverable` job: work that leaves the building and should look finished,
stay reachable, and only open for the intended recipient.

## When to invoke

- User is handing a finished artifact to a named client or customer ("send this to
  Acme", "this goes to the client tomorrow").
- The page is a deliverable, not a scratch draft: a proposal, audit, report, or
  pitch.
- The recipient is outside the user's own org and will not have a Stacktree account.

For an agent-generated report meant for "anyone with the link", use
`stacktree-agent-run-report`. For a dated digest refreshed in place, use
`stacktree-daily-brief`. For a public status page, use `stacktree-status-dashboard`.

## The page shape

Produce a single self-contained HTML document in the Client deliverable shape: a
centered white `.sheet` with a `.topbar` (the studio/sender name on the left, a
`.pill` reading "Private deliverable" on the right), then a `.pad` body with an
`.eyebrow` "Prepared for <Client>", an `<h1>` title, a `.lede`, and a `.meta` row
(prepared by, date, version). Use `.section` blocks for Overview, the one
recommendation (in a `.callout`), an at-a-glance `<dl>`, and next steps
(`<ol class="steps">`). Close with a `.foot`. The published page is what the client
sees, so the craft is the point: keep it editorial, content-first, no broken
assets. The canonical reference is the `client-deliverable` template in the
Stacktree app (`apps/web/src/templates.ts`); match its structure and restraint.

## Account

The Stacktree tools in this plugin publish under the user's own Stacktree
account, so they keep ownership and can revoke the link later. If the tools are
not connected yet, ask the user to connect Stacktree rather than publishing any
other way.

## The judgment this skill encodes

1. **It must not auto-delete.** Publish with `--expires-never` (or `set_expiry` to
   never). A link that 404s a week after you send it is worse than not sending it.
   Only set an expiry if the user wants access to lapse on purpose (e.g. "this quote
   is valid 30 days"), then set it to that date, not the 7-day default.

2. **It must be gated to the recipient, not the whole internet.** The unlisted token
   alone is "anyone with the link", and links get forwarded. Pick the gate from what
   the user has:
   - **Recipient email or company domain known:** use the email gate
     (`set_email_gate`). The client enters their email, gets a one-time code, and is
     in. This ties access to a person and gives the user a record of who opened it.
   - **Only a side channel (the user will pass a secret over Slack/SMS):** use a
     password (`--password` or `set_password`). Generate a strong one, never reuse
     the user's own secrets, and surface it on its own line so it travels separately
     from the link.
   The template's footer line ("This link is unguessable. Add a password if it
   should be.") is the prompt: act on it, do not ship a bare link for a real
   deliverable unless the user says "anyone with the link is fine".

3. **It must not leak PII.** Keep the PII scan in `block` mode (the default). Client
   deliverables are exactly where an embedded API key, internal thread, or customer
   record does real damage. If the scan trips, stop and show the user what it caught
   before relaxing anything. Only drop to `--pii-check warn` when the user confirms
   the flagged content is intentional and safe (e.g. the client's own contact
   details on the proposal).

4. **The URL can read as professional.** A raw `stacktr.ee/p/<token>/` link is fine
   and private, but for an external deliverable a custom domain (e.g.
   `proposals.theiragency.com`) reads better. A custom domain is set up in the
   Stacktree dashboard, not with a tool, and depends on the account's plan. Do not
   block the hand-off on it; ship the private link now and mention the domain as a
   follow-up.

## Steps

1. Build the deliverable as a complete HTML document in the page shape above. If you
   only have Markdown or a fragment, wrap and style it so it renders standalone.
2. Decide the gate from what the user has. If unclear, ask one short question: "Do
   you have the client's email, or will you send them a password separately?"
3. Publish with `publish_html`, `expires_in_hours: 'never'`, and the PII scan on
   (the default). Capture the `id` and `url`.
4. Apply the gate:
   - Email gate: `set_email_gate` on the returned id with the client's email or
     `@their-domain.com`.
   - Password: pass `password` to `publish_html` in step 3, or call
     `set_password` after. Prefer generating the password over asking the user
     to invent one.
5. For a draft the client should review, call `set_client_feedback` with
   `comments: true` (skip it for a final, signed deliverable). The client selects
   words or clicks an image, chart or video and comments, with no account. Own the
   loop: pull their comments with `list_feedback`, apply the changes with
   `update_site` so the revision lands at the link they already have (its response
   says which open comments no longer match the page), then `resolve_feedback` each
   answered item with a short note: the client sees it next to their comment.
6. Reply with: the link, the gate type and how the client gets in (the allowed
   email/domain, or the password on its own line), the fact that it will not expire,
   and any PII warning that was surfaced.
   If the page has a page video (the owner adds one from the dashboard), the link
   ending `#watch` opens straight into it, and the dashboard gives a picture of it
   to paste into the email above that link.

## What to tell the user

State plainly who can open it (the gate), that the link will stay live, and what the
PII scan caught if anything. If they wanted a custom domain, say it is set up in
the Stacktree dashboard rather than holding up the hand-off.
