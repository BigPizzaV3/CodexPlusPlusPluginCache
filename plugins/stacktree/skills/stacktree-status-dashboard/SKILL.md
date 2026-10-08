---
name: stacktree-status-dashboard
description: 'Publish a live status or health page that anyone can check at a clean public URL, refreshed in place as conditions change. Use for a public status page, uptime/health dashboard, or "is it up" page meant to be linked from a footer or shared widely with no login. This is the one job where a public slug is the right call. Produces a page in the Status dashboard shape, gives it a public {slug}.stacktr.ee URL, and updates the same site on every refresh.'
---

# stacktree-status-dashboard

Publish a live status or health page to **stacktr.ee** at a public, memorable URL and
refresh it in place as conditions change. This is the publish path for the
`status-dashboard` job, and the one case in this library where a public slug is
correct.

## When to invoke

- The user wants a public status page, uptime/health dashboard, or "is the service
  up" page that anyone can check with no login.
- It will be linked widely (a docs footer, a support page, a status link) and
  refreshed as health changes.
- The user says "give it a public status URL", "put up a status page", or "a health
  page anyone can check".

For a private run report shareable by link, use `stacktree-agent-run-report`. For a
private dated digest, use `stacktree-daily-brief`. For a client deliverable, use
`stacktree-deliverable`.

## The page shape

Produce a self-contained HTML document in the Status dashboard shape: a `.sheet`
with a `.topbar` ("System status" plus a `.status ok` pill reading the overall state,
e.g. "All systems operational"), an `<h1>` of the headline state, a `.lede`, a
`.meta` row (updated-at, region), and a `.kpis` strip (uptime %, avg response, open
incidents). Then `.section` blocks: an `.uptime` bar strip (90 day cells, with
`.warn`/`.down` for off days), a Services list (`.svc` rows, each with a `.spark`
and a per-service `.status ok|warn`), and a Recent incidents note. Close with a
`.foot` that states the link is public and shareable and refreshes in place. The
overall pill and the updated-at must reflect real current state on each run.
Canonical reference: the `status-dashboard` template in `apps/web/src/templates.ts`.

## Account

A public slug and refresh-in-place both need a site the user owns. The Stacktree
tools in this plugin publish under the user's own Stacktree account. If the tools
are not connected yet, ask the user to connect Stacktree. A public slug may not be
on the account's plan; if the slug is rejected, fall back to the unlisted URL and
tell the user a public address is not available on their current plan.

## The judgment this skill encodes

1. **A public slug is right here, and only here.** A status page exists to be found
   and linked, so give it a clean address with `--public-slug <slug>` (e.g.
   `status` for `status.stacktr.ee`, or the product's own name). This is the
   deliberate exception to the library's private-by-default posture. Confirm the slug
   with the user, since it is public and memorable.

2. **Public means a hard PII and secrets bar.** Because anyone can read it, a status
   page must contain only what is safe for the world: service names, states, uptime,
   response times, incident notes. Never put internal hostnames, customer data,
   tokens, or stack traces on it. Keep `--pii-check block`, and if it trips, treat it
   as a real leak on a public page, not a nuisance, and fix the content. Do not relax
   the scan on a public page.

3. **No password, no email gate.** Gating defeats the job ("anyone can check"). If the
   user actually wants a private health view for the team only, that is the
   daily-brief or agent-run-report pattern with a gate, not this skill. Keep this one
   open.

4. **Refresh in place, never a new URL.** The page's whole value is one stable
   address that always shows current state. On the first run, publish with the slug
   and record the `id`. On every later run, update the same site:
   call `update_site` with the saved id. For a live page this update typically runs on a tight loop
   or scheduler (the template copy says "refreshed every minute"); persist the
   `id`/slug so the loop always targets the same page, and recover it with
   `list_sites` if lost rather than re-creating.

5. **Never expire.** A status page is permanent infrastructure. Publish and update
   with `--expires-never`.

## Steps

1. First run: build the status page as a complete HTML document in the page shape
   above, reflecting real current health. Publish with the public slug, no expiry:
   `publish_html` with `public_slug: 'status'` and `expires_in_hours: 'never'`.
   Record the `id` and the public `url`. If the slug is rejected because the plan
   does not include it, fall back to the unlisted URL and tell the user.
2. Hand the user the public URL to link from their site/footer.
3. Every later run (usually scheduled, often per-minute): regenerate the page with
   current state and the new updated-at, then update in place:
   `update_site` with the saved id. Keep the same site id.
4. To run live, wire step 3 into the user's scheduler/agent loop at the cadence they
   want.

## What to tell the user

Give them the public URL, confirm it is open to anyone (no login) and stays at one
address as it refreshes, and state the refresh cadence if you set one up. Remind them
that because it is public, only world-safe data should go on it, and confirm the PII
scan stayed strict. If the public slug was not available on their plan, say so.
