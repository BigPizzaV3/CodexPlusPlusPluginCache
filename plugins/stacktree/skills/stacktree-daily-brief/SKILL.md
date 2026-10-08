---
name: stacktree-daily-brief
description: 'Publish a dated morning brief or digest to one stable link and refresh it in place each day, rather than minting a new URL every time. Use for a recurring digest (a market/news brief, a standup summary, a metrics digest) the user wants to bookmark once and re-read each morning. Suits a scheduled or agent-loop refresh. Produces a page in the Daily brief shape and always updates the same site via update_site, so the bookmark never breaks.'
---

# stacktree-daily-brief

Publish a dated digest to **stacktr.ee** and, crucially, refresh it in place at the
same URL on every run. This is the publish path for the `daily-brief` job: a brief
the user bookmarks once and re-reads each morning, not a fresh link per day.

## When to invoke

- The user wants a recurring digest: an overnight market/news brief, a standup
  summary, a watchlist roundup, a daily metrics digest.
- It will be produced repeatedly (often on a schedule or an agent loop) and read at
  one stable address.
- The user says "refresh it every morning", "same link, new content daily", or "set
  up a daily brief".

For a one-off run report, use `stacktree-agent-run-report`. For a deliverable to a
client, use `stacktree-deliverable`. For a public live-status page, use
`stacktree-status-dashboard`.

## The page shape

Produce a self-contained HTML document in the Daily brief shape: a `.sheet` with a
`.topbar` ("Morning Brief" plus a `.status ok` pill showing the update time, e.g.
"Updated 06:00"), a dated `.eyebrow` ("Tuesday, 25 June 2026"), an `<h1>`, and a
`.lede` promising a short read. Then `.section` blocks for the day's content, for
example Markets (`.mover` rows with inline-SVG `.spark` sparklines and `.fig`
up/down deltas), Top stories (`<ul class="clean">` with linked sources), and a
watchlist. Close with a `.foot` that states it is published from a scheduled agent
and refreshed at the same link. The date and the update-time must change on every
run, the URL must not. Canonical reference: the `daily-brief` template in
`apps/web/src/templates.ts`.

## Account

Refresh-in-place needs a site the user owns. The Stacktree tools in this plugin
publish under the user's own Stacktree account, so every page they make can be
updated later. If the tools are not connected yet, ask the user to connect
Stacktree.

## The judgment this skill encodes

1. **One site, updated in place. This is the whole point.** On the first run,
   publish once and record the returned `id` (and slug, if any). On every later run,
   do not publish a new site, update the existing one:
   call `update_site` with the saved id. The user's bookmark, and any link they
   shared, must keep resolving. Minting a new URL each day is the failure mode this
   skill exists to prevent.

2. **Persist the site id so the loop is stateless-safe.** A scheduled run starts
   fresh with no memory of yesterday. Store the brief's `id`/slug somewhere the next
   run can read it (a project note, an env var, a tiny state file). If the id is
   genuinely lost, recover it with `list_sites` and match by title/slug rather than
   creating a duplicate. Never let "I forgot the id" become "publish a new link".

3. **Never expire.** A brief that is refreshed daily should not also be racing an
   expiry clock. Publish and update with `--expires-never`. The content goes stale by
   design and is replaced each morning; the site itself stays put.

4. **Keep it unlisted by default; gate if it is personal.** A personal brief
   (watchlist, internal metrics) should stay on the unlisted token and, if it holds
   anything private, get a `set_password` or `set_email_gate`. Do not give a daily
   brief a public slug unless the user explicitly wants a public digest; that is the
   status-dashboard pattern, not this one.

5. **PII scan stays on (`block`).** Briefs assembled from feeds, inboxes, or internal
   metrics can pick up addresses or tokens. Keep the default and surface anything it
   catches before the brief goes out.

## Steps

1. First run: build the brief as a complete HTML document in the page shape above,
   with today's date and update-time. Publish once:
   `publish_html` with `expires_in_hours: 'never'`.
   Record the returned `id` and `url`. Gate it if the content is private.
2. Hand the user the URL to bookmark, and note that it will refresh at this same
   address.
3. Every later run (manual or scheduled): regenerate the brief with the new date and
   content, then update in place:
   `update_site` with the saved id. Confirm the id resolved; if not, `list_sites` and match rather
   than re-create.
4. To run unattended, wire this into the user's scheduler or agent loop so step 3
   fires each morning. The update is idempotent: same site, new content.

## What to tell the user

Give them the single link to bookmark, confirm it refreshes at the same address
(never a new URL), and state whether it is unlisted or gated. If you set up a
scheduled refresh, say when it runs and where the site id is persisted so the loop
keeps targeting the same page.
