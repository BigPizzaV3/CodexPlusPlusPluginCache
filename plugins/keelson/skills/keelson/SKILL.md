---
name: keelson
description: Deploy and operate web apps on Keelson (keelson.run). Use when the user asks to deploy, publish, or host an app, mentions Keelson or keelson.run, or needs keelson.yaml written or fixed. Covers login, deploy, status, logs, diagnose, secrets, and adapting apps to run on Keelson (SQLite -> managed libSQL, PORT binding).
allowed-tools: Bash(keelson:*)
---

# Keelson CLI

Use `keelson` to authenticate, deploy, configure, inspect, and operate the current Keelson app from the terminal.

## Installing the Keelson CLI

Before running Keelson commands, check whether `keelson` is available. If it is not installed, use the official installer:

- macOS / Linux: `curl -fsSL https://keelson.dev/install.sh | sh`
- Windows PowerShell: `irm https://keelson.dev/install.ps1 | iex`

## Installing This Skill

If this skill came from a plugin marketplace, the AI tool manages its installation. Otherwise, use `keelson install-agent` to install the skill for your AI tool. The legacy `keelson skill install` alias still works.

## Keeping This Skill Current

For a plugin installation, use the AI tool's plugin update mechanism to update this skill, and run `keelson upgrade` separately to keep the CLI current.

For a CLI-managed installation, this skill ships inside the `keelson` binary. `keelson login` auto-updates an unmodified installed skill to match the CLI. The CLI signals a stale skill three ways:

- a stderr line like `keelson: installed skill differs from this CLI ...`
- a `meta.skill_outdated` object (with an `action` field) at the top level of `--json` output. When present, `meta` is a sibling of the command's named data key. List commands use stable object shapes: `apps list` returns `{"apps": [...]}` with `--workspace` and `{"workspaces": [...]}` without it, `workspaces list` returns `{"workspaces": [...]}`, `groups list` returns `{"groups": [...]}`, and `doctor` returns `{"checks": [...]}`.
- a `keelson doctor` check named "Skill freshness ..." with `code: skill_outdated`

When you see any of these, run `keelson install-agent --yes` (updates every installed skill in place) and re-read this file — the CLI you are calling is newer than the instructions you loaded.

## Core Contract

Always read the deploy spec in this skill directory before deploying. It ships as a bundle, not one file — read it in this order:

Which document wins when they disagree: for how to operate the CLI (commands,
flags, JSON shapes) the bundled skill matches the installed binary and wins. For
what the service currently supports (limits, plans, runtimes) the web docs and
Deploy Spec describe the live service; if the bundle says something newer or
older than the web, the CLI is out of date — tell the user to update it
(`keelson version`) rather than guessing.

1. `core/DECISION.md` — deploy / adapt / refuse, `db.mode` selection, and the definition of a successful deploy.
2. `core/KEELSON_YAML.md` — required `keelson.yaml` fields, supported runtimes, limits, auth, secrets.
3. `core/ROUTER.md` — detection signals → the **one** `stacks/<lang>.md` file to read for this app.

Then read only that stack file (`stacks/node.md`, `stacks/python.md`, or `stacks/go.md`); each is self-contained, so do not read the other two. Pull `reference/*` (`VERIFICATION.md`, `LIBSQL_CLIENTS.md`, `SUPPORT_LEDGER.md`, `RPO_CONTRACT.md`) only on demand.

If this directory still contains a single `DEPLOY_SPEC.md`, it is a pre-2026-07-15 leftover that the CLI could not remove because it was edited locally. It is stale — read the `core/` files above instead, and delete it once you have salvaged any local notes.

When building a new app that needs durable data, author it against a libSQL client (`db.mode: libsql`) from the first line — do not write fresh `sqlite3` / `better-sqlite3` file code and adapt it later (see `core/DECISION.md` → Decision Tree).

Every `keelson.yaml` must explicitly contain `db:` and `db.mode` (`libsql` or
`none`; legacy `turso` normalizes to `libsql`); there is no
implicit `none`. File-SQLite signatures are a hard deploy error unless the
database is declared as intentionally ephemeral with `db.local_sqlite` (policy,
paths, and reason). `db.mode: libsql` is the only durable database — no mode
persists a SQLite file on disk — so an app that writes one either moves to a
libSQL client or cannot be deployed (see `core/DECISION.md` → Adaptation
Decision Function, which also decides when you must ask the user first).

Every machine-checkable contract this skill declares carries a stable ID (`SD-*`, `DC-*`) that maps to an executable test — see `core/DECISION.md` → Spec–Test Traceability. `scripts/check_spec_test_traceability.py` fails when a declared contract has no test, so a promise made in these docs cannot ship untested. The structured-error contract just below is tracked there as `DC-8`.

Keelson keeps `/__keelson` and everything below it for platform use on every
HTTP method. On delivery paths that pass through the gateway, GET requests to
`/health` and `/_health` are also platform routes; HEAD and other methods may
reach the app. The whole `/api/webhooks/` and `/api/external/` subtrees are
non-interactive (credential-authenticated, never a browser session), and the
edge blocks all methods to `/api/webhooks/email` and `/api/webhooks/email-events`.
`/assets`, `/files`, `/static`, `/uploads`, the rest of `/api`, `/docs`, and
`/media` remain app-owned. A Node build that emits a top-level `__keelson`
directory is rejected with `reserved_path_conflict`. See
`core/KEELSON_YAML.md` → Reserved URL Paths for the complete rules.

### Reserved URL path errors — fix recipes

These error codes concern conflicts with the `/__keelson` namespace above.
Match on the code, apply the fix, redeploy. Do not string-match the
human-readable message.

- **`reserved_path_conflict`** — surfaces from `keelson deploy` / `keelson status --json`
  (`error.code`) when your build output contains a top-level `__keelson`
  directory. Fix: rename that directory (and any route that emits it) to a
  non-reserved name — e.g. put your bundle under `/static` or `/assets` instead
  of `/__keelson`. Keep `assetsDir`/output-dir settings off `__keelson`. Redeploy.
- **`reserved_path_prefix_container`** — a runtime error from the edge: a request
  to a path your **container** app owns (e.g. `/assets/index-*.js`) came back
  `404` from files-worker with `x-keelson-error: reserved_path_prefix_container`
  and a JSON body `{ error, path, hint, doc }`. Your app is fine — a container
  app serves every route from its own origin, so this path should never reach the
  platform edge. It means an edge route shadowed a path your app owns. Fix: make
  sure your app defines **no** routes under `/__keelson/*`, then redeploy to
  reconverge edge routing. If it persists after a clean redeploy, it is a
  platform routing issue, not an app bug — report it rather than editing the app.

When an error carries a `doc` field (structured edge errors) or a `hint`
(`--json` CLI errors), follow it before trying anything else.

Prefer non-interactive CLI usage:

- Use `--json` for commands whose output you need to parse.
- Use `--quiet` only when a single machine-readable line is enough.
- Use `--timeout` and `--retry` for transient network or API failures.
- Before starting work, run `keelson whoami --json` from the project directory and confirm both `active_workspace` and `active_workspace_source`.
- Do not use `last_active_workspace_id` to choose the CLI workspace; it is the Console's pinned workspace, not the CLI's active workspace.
- Workspace resolution depends on the current working directory. After moving to another project directory, run `keelson whoami --json` again before continuing.
- Use `--workspace <workspace>` with an exact workspace slug, name, or ID when the account has more than one workspace.
- To avoid repeating `--workspace` for one project, a multi-workspace account can set the optional top-level `workspace` field in `keelson.yaml`; prefer the workspace slug. Do not add it when the account has only one workspace, because the CLI selects that workspace automatically. An explicit `--workspace` overrides the file.
- If you do not know the exact workspace, run `keelson workspaces list --query <text>` to search workspace slugs and names with a case-insensitive partial match, then pass the exact slug, name, or ID to `--workspace`.
- The former tenant-named flag, command, config field, and JSON keys remain compatibility aliases. Prefer the workspace names; no removal date is set.
- Use `--app <slug>` to override the app resolved from the current directory.

When a command exits non-zero with `--json`, stdout contains:

```json
{"error":{"code":"example_code","message":"Human readable message.","hint":"Actionable next step.","retryable":false}}
```

Schema shorthand: `{"error":{"code","message","hint","retryable"}}`.

Follow `error.hint`. If `error.retryable` is `false`, do not rerun the same command unchanged. Unknown `error.code` values are forward-compatible; rely on `message`, `hint`, and `retryable` instead of string-matching stderr.

## App Context

Most app-scoped commands can infer their target from the current directory's `keelson.yaml`. Run them from the project root, or pass `--app <slug>`. Pass `--workspace <workspace>` with an exact workspace slug, name, or ID when the CLI reports multiple workspaces. If a name matches multiple workspaces, use the slug or ID.

For agent, CI, and scripted workflows, capture explicit identifiers from JSON responses when a later step depends on the exact resource. Do not rely on "latest" if concurrent deploys might be running.

## Confirmations (destructive operations)

Destructive operations (deleting an app, restoring a snapshot) require a human to
approve them in the browser. When one is needed, the command exits non-zero with:

```json
{"error":{"code":"confirmation_required","message":"...","confirm_url":"https://console.../confirm/<id>","confirmation_id":"<id>","retryable":false}}
```

Handle it like this:

- **Do not block.** Present `error.confirm_url` to the user and ask them to open
  it and approve. Under `--json` or any non-interactive (non-TTY) shell the CLI
  returns immediately; it never waits for approval, so your tool call will not
  hang.
- **Approval executes the operation server-side.** Once the user approves in the
  browser, the operation runs automatically — you do **not** re-run the command
  with the confirmation id, and execution does not depend on the CLI process
  staying alive.
- **Track the outcome via a real read path**, not by blocking:
  - *Delete*: teardown runs in the background. Poll `keelson apps list` — the app
    disappears once teardown finishes. (`keelson status` is deploy/runtime status
    for one app and does not track confirmations or teardown.)
  - *Restore*: acceptance is asynchronous — the CLI/confirmation reports the
    restore was **accepted (`queued`)**; there is no completion-tracking read path
    in the CLI. Treat `queued` as success and re-check the running app's own data.
  - Re-running the original destructive command instead creates a brand-new
    confirmation request — do not use it to poll.
- **If a delete's teardown fails**, the app stays in the `deleting` state and
  cannot start. Re-approving is rejected — recovery requires an **administrator to
  re-enqueue the teardown**. Tell the user to contact an administrator rather than
  retrying yourself.
- `--wait` (default only on an interactive TTY) polls until the approved
  operation finishes and prints the result/error; it never re-sends the request.
  Reserve it for humans at a terminal; agents should stay non-blocking.

## Secrets

Never put secret values in argv. Send a single value through stdin, or import a
local env file when setting several values.

For a new app, put the values in a local env file and run
`keelson deploy --new --secrets-from-env-file <path>`. The CLI creates the app,
sets the secrets, and completes the initial deploy in one command; it also
excludes that file from the upload artifact. Do not try `keelson secrets set`
first, because the app does not exist yet.

For an existing app, secret changes are injected at deploy time, so they are not
active until a redeploy. Use `keelson deploy --secrets-from-env-file <path>` to
set several values and deploy in one command, or use the secrets command's apply
option when the user wants the CLI to queue that redeploy immediately.

## Access Control

Every authenticated workspace member with **view** permission can reach an app;
narrow access with two layers (see `core/KEELSON_YAML.md` → Access Control). Coarse
control (this group opens the app / only managers see the admin screen) = bind a
group's view/manage permission via the Console or `keelson access set`, then have
the app branch on the injected `X-Keelson-User-App-Perms` header (`view` /
`view,manage`) — **no group key in the app code**. Fine control (three or more
tiers, arbitrary logic) = read `identity.attributes.groups` (a list of group
keys) through the Directory/identity API. Manage groups with `keelson groups ...`
and app bindings with `keelson access ...`; there is no `groups:`/`access:` block
in `keelson.yaml`.

## Deploy And Operate

When you write `keelson.yaml` for a **new** app, include a top-level
`description`: 1–2 sentences in the user's language saying who the app is for and
what it does (max 300 characters). It fills the app ledger's "what is this app"
line, and it is applied only while that line is still empty — a console edit is
never overwritten. See `core/KEELSON_YAML.md` → App Description.

Use `keelson deploy --ndjson --yes` as the standard way to
wait for deployment completion. It streams one JSON object per line and ends
with `{"result":"success"|"failed",...}`; only `success` exits zero. A failure
before watching starts ends with `{"error":{...}}` instead. Do not write your
own deploy-status polling loop except for the recovery paths in
`reference/VERIFICATION.md` → Alternative: recover with status. `--json` is for
capturing a deploy ID and returns immediately; it cannot be combined with
`--watch`. Fetch diagnostics when a deploy does not complete successfully.
Runtime, rollback, access log, deploy history, identity, and workspace-context
commands follow the same app-context and structured-error conventions.

While a stage is running, the stream may include
`{"stage":"health_check","status":"progress",…}` records. They report elapsed
time and may include a server-provided waiting reason. Do not use progress
records to decide the outcome; only a record containing `result` declares
success or failure.

After a successful deploy, verify the delivered app with
`keelson app curl -i /`. An unauthenticated `curl` proves nothing about your app:
it returns 401.
For deeper checks (write paths, sub-resources), read
`reference/VERIFICATION.md`.

## Background Work

Apps scale to zero: code runs only while handling a request or during a
platform-initiated `cron` execution. Do post-processing that finishes
within a request synchronously, before responding. Work scheduled to run *after*
you respond is not guaranteed and must be treated as not running. This is
unconditional — no `keelson.yaml` setting turns it into a guarantee. For
scheduled work, declare a `crons` entry — never an in-process scheduler
(APScheduler, node-cron, `BackgroundTasks`, `setInterval`). Event-driven
background tasks are not currently supported.
Background executions run in a separate container: their durable state must live
in the managed database (`db.mode: libsql`), the `files` SDK, or the `media`
SDK — never on the local disk, `/data` included. See `core/KEELSON_YAML.md` →
Background Work for the full contract.

The per-app managed libSQL database is provisioned automatically. The agent
writing the app also writes the small table/schema needed for cron history,
cursors, or queues; the user has no database setup work. Never choose a local
file merely to avoid asking the user to configure a database.

Managed libSQL enforces a **5-second interactive write transaction budget** and
drops idle connections after ~10 seconds — non-negotiable. Before writing any
bulk insert / seed / backfill / import path, or any schema migration that
touches data, read `reference/LIBSQL_CLIENTS.md` → "Write discipline — the
5-second interactive-transaction budget" and its error table. Bulk work is
supported (millions of rows in seconds when batched); a single long transaction
is not (aborted at 5 s and blocks every other writer for that window). The same
file lists the four error shapes an agent must recognise —
`stream not found`, `TRANSACTION_TIMEOUT`, `SQLITE_BUSY`, and constraint
violations arriving as bare `ValueError` rather than `IntegrityError` — with the
recovery for each.

## Files

The instance filesystem is entirely ephemeral — a file the app writes to any
local path is gone at scale-to-zero, on redeploy, and between
the web instance and a `cron` run. Route every file the app keeps by what it is:
a file the app names and updates (`state.json`, `seen_urls.json`) → the `files`
SDK (`write` / `read`); uploaded or generated media referenced by ID → the
`media` SDK (`put` / `get`, served at `/__keelson/media/<id>`); data read and
written on every request → the managed database. See `core/DECISION.md` →
Recipe: local file I/O for the routing rule and the per-language rewrites.

When users need to retrieve a generated file, implement a download endpoint in
the app and return it from a normal authenticated app route with the appropriate
`Content-Type` and `Content-Disposition` headers. There is no supported CLI path
for inspecting or mutating a running app's files. Read-only store retrieval and
Console download are post-launch work, so do not promise them.
