---
name: stacktree-agent-run-report
description: 'Publish what your agent just produced as a private web page, shareable with anyone who has the link. Use right after a run produces a report, audit, analysis, or a dashboard the agent built on demand, the kind that reads better in a browser than dumped in the chat, and the user wants a link to send to colleagues with no account or workspace required. Fits the throwaway, on-demand dashboard pattern (gather the data, render the HTML, share a private link that expires on its own) as well as longer run reports. Produces a page in the Agent run report shape (KPI header, findings, recommended order), keeps it unlisted with a sensible default expiry, and is built to be refreshed in place on re-run.'
---

# stacktree-agent-run-report

Publish a report or dashboard your agent just generated to **stacktr.ee** and return
a private URL, so it is read in a browser and shareable with anyone, instead of
scrolling a wall of text in the chat. This is the publish path for the
`agent-run-report` job.

## When to invoke

- A run just produced a long-form report, audit, analysis, or dashboard that is
  genuinely better as a styled page than as inline text.
- The user wants a link they can forward to colleagues who have no Stacktree account
  and no access to the workspace the agent ran in.
- The user says "publish what you just did", "give me a link to this", or "put this
  somewhere I can look at it".
- The user is following the build-it-then-throw-it-away pattern: rather than maintain a
  standing dashboard, the agent gathers the data and renders a single-use HTML view to
  answer one question right now. This skill is the publish step, and the expiry is what
  makes the page genuinely disposable.

For a deliverable headed to a named external client, use
`stacktree-deliverable` (it adds recipient gating). For a dated digest on a
schedule, use `stacktree-daily-brief`. For a public health page, use
`stacktree-status-dashboard`.

## The page shape

Produce a self-contained HTML document in the Agent run report shape: a `.sheet`
with a `.topbar` ("Run report" plus a `.pill` reading "Completed"), an `.eyebrow`
"Automated by your agent", an `<h1>`, a `.lede`, a `.meta` row (completed-at, model,
duration), and a `.kpis` strip of three figures with the at-risk one marked
`class="kpi alert"`. Follow with `.section` blocks: Summary, Key findings
(`<ul class="clean">`), Recommended order (`<ol class="steps">`), and a Notes
section that states the page came straight from the run and can be refreshed in
place at the same URL. Charts must be self-contained (inline SVG, as the template
does, or a pinned CDN script, never a local file path that 404s). The canonical
reference is the `agent-run-report` template in `apps/web/src/templates.ts`.

## Account

The Stacktree tools in this plugin publish under the user's own Stacktree
account, so the report is listable (`list_sites`), editable and refreshable
later. If the tools are not connected yet, ask the user to connect Stacktree.

## The judgment this skill encodes

1. **It pulled in data, so the PII scan stays strict.** Reports built from tool
   output, scraped pages, logs, or query results are the most likely to carry an
   embedded key, a customer email, or a token. Keep `--pii-check block` (the
   default). If it trips, do not relax it reflexively, show the user the finding. A
   report is read later by a human who assumes it is safe; make that true first.

2. **Shareable with anyone is the point, but unlisted, not public.** The job is "no
   account, no workspace needed to view", which the default unlisted token already
   delivers (the link works for anyone you send it to). Do not add a `--public-slug`
   here, that is for the status-dashboard job. A run report is for the people the
   user forwards it to, not for search engines. Only gate it (`set_password` /
   `set_email_gate`) if the user says the findings are sensitive.

3. **Default to a sensible expiry; offer permanence.** Most run reports are snapshots
   ("findings as of this run"). The 7-day default expiry fits them. Pass
   `--expires-never` when the user signals it is a keeper (a baseline, a reference).
   When unsure, keep the expiry and say how to make it permanent. For a throwaway
   dashboard built to answer one question, the expiry is the feature, not a limit: it
   lets a single-use page remove itself instead of piling up as a dead link, which is
   the whole reason the user stopped maintaining a standing dashboard.

4. **Build it to be refreshed in place.** Re-running the task should update the same
   URL, not mint a new one. Keep the returned `id`/slug and, on the next run, publish
   with `--update <id-or-slug>` (or the `update_site` MCP tool). The template's own
   copy promises this ("Re-run the task to refresh it in place at the same URL"), so
   honor it.

## Steps

1. Build the report as a complete, self-styled HTML document in the page shape
   above. If you only have Markdown or a fragment, wrap and style it.
2. Decide lifecycle: snapshot (keep the 7-day default) vs keeper
   (`--expires-never`). If the user did not say, default to snapshot and mention how
   to keep it.
3. Publish with `publish_html`. Pass `expires_in_hours: 'never'` for a keeper.
   Capture the `id` and `url`.
4. To refresh on a later run, call `update_site` with the saved `id`, so the
   report updates in place at the same URL.
5. Reply with the URL, when it expires (or that it is permanent), the fact that
   anyone with the link can open it with no account, and any PII warning before the
   user forwards it.

## What to tell the user

State the link, the expiry (and how to make it permanent if it is a snapshot), that
no account or workspace is needed to view it, and the same-URL refresh path. If the
PII scan flagged anything, say what it caught before they share.
