# Keelson Deploy Spec — Decisions

This is the **core** of the deploy spec: how an agent decides whether an app can
go to Keelson, how to adapt one that almost can, and what "deployed
successfully" means. **Always consult the core before attempting a deploy.**

The core is three files, and you read all three:

1. **`core/DECISION.md`** (this file) — deploy / adapt / refuse, the refusal
   wording, the adaptation rules, `db.mode` selection, and the definition of a
   successful deploy.
2. **`core/KEELSON_YAML.md`** — the `keelson.yaml` contract: required fields,
   runtimes, deploy modes, reserved paths, limits, auth, secrets.
3. **`core/ROUTER.md`** — detection signals → the one `stacks/<lang>.md` file to
   read for your app. Read **only** your stack's file; each is self-contained.

Everything else is on-demand: `stacks/*` for the per-language rewrites,
`reference/*` for client details, the support ledger, the durability contract,
and the verify/operate runbook.

---

## Decision Tree

Classify every app into exactly one of three outcomes before doing anything
else. Work top to bottom; the first matching rule wins.

**There is exactly one durable database on Keelson: Keelson Managed SQLite
(`db.mode: libsql`).** There is no mode that persists a SQLite file on disk. So
an app whose data must survive either reaches libSQL, or it does not deploy —
"deploy it anyway and let the data be silently ephemeral" is never an outcome.
The Adaptation Decision Function below is how you decide which.

### New app that needs a database — author against libSQL from the first line

Before the deploy/adapt/refuse split: if the task is to **build a new app from
scratch** and it needs durable relational data, do **not** write fresh
`sqlite3` / `better-sqlite3` file code and adapt it afterward. Author against a
libSQL client (read `KEELSON_DB_URL` / `KEELSON_DB_AUTH_TOKEN`, keep a `file:`
URL as the local-dev fallback) and set `db.mode: libsql` in `keelson.yaml` from
the first line. The SQLite→libSQL recipe below exists for **pre-existing** apps;
a from-scratch app should never create the file-SQLite code it would just have
to remove. This is the single source for the new-app rule — the Data &
Persistence notes only point back here.

### Refuse — cannot deploy, even with changes

Stop and refuse (see Refusal Policy for the wording) if ANY of these is true:

- **Unsupported language/runtime.** Not one of Python, Node.js, Go (see
  `core/KEELSON_YAML.md` → Supported Runtimes). Ruby, Java/Kotlin, PHP, Rust,
  .NET/C#, Elixir, Swift cannot run as the app process on Keelson. A runtime
  used only as a build tool to produce prebuilt static files does not trigger
  this refusal when no process handles requests at runtime.
- **Not an HTTP server.** The app never listens for HTTP requests (a desktop
  GUI, an Electron app, a one-shot CLI with no server, a native mobile app).
  Exceptions: a `crons`-only job app is fine — it has no HTTP surface by design
  — and a prebuilt static site can use a static deploy mode. A static site is not
  a refusal.
- **Bundles its own database/queue server.** The app expects to run
  PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, etc. **in the same
  container.** Connecting to an *external* managed instance is fine; running the
  server process on Keelson is not.
- **Multi-service compose topology.** A `docker-compose.yml` that brings up
  several long-running services (web + db + worker + cache) as one unit. Keelson
  runs one app process (plus optional scheduled `crons`), not a compose graph.
  There is no resident background-worker declaration.
- **Needs a GPU.** GPU-based inference / training (CUDA, local LLM weights that
  require a GPU). There are no GPU instances.
- **Durable data that cannot reach libSQL.** The app needs data to survive, but
  its data layer cannot be moved onto a libSQL client — and no file-SQLite mode
  exists to fall back to. The ruling case is **Django with a file SQLite
  `DATABASES` backend** (see Adaptation Decision Function → the `unsupported`
  cases). Django deploys here only against an **external** database
  (`db.mode: none` + `secrets`).

### Adapt — deploy after a mechanical rewrite

Deploy is possible once you apply the matching Adaptation Recipe. Adapt, don't
refuse, when the only problems are:

- Hard-coded port / binds to `127.0.0.1` → **PORT binding recipe**.
- Writes a local **SQLite file** for data that must survive → **SQLite→libSQL
  recipe** (the default; see Data & Persistence). Whether you apply it silently
  or ask first is the Adaptation Decision Function's call, below.
- Reads API keys from hard-coded literals or a committed `.env` → **secrets
  recipe**.
- Reads/writes files on the local disk (state files, uploads, generated
  artifacts) → **file I/O → `files` / `media` SDK recipe**. Which of the two (or
  the database) it lands on is the three-way routing rule below; a state file is
  mechanical, locally-saved media is not.
- Ships only `pnpm-lock.yaml` / `yarn.lock` → **npm lockfile recipe**
  (`stacks/node.md`).
- Implements its own login/session layer → **X-Keelson-User-Id recipe**.
- Runs work on a process that has to stay alive — an in-process scheduler
  (APScheduler, `node-cron`, `setInterval` + a clock check, `threading.Timer`)
  or work deferred until after the response has been sent (FastAPI
  `BackgroundTasks`, a fire-and-forget promise, a 202-then-poll flow backed by
  an in-process task) → **background work recipe**. Unlike every other trigger
  here, this one has no symptom: the deploy goes green, no error is logged, and
  the work simply never happens.
- Ships a `Dockerfile` → not a problem at all; it is ignored. Do not refuse.

A single app often needs several recipes at once. Apply all that match, then
re-check with the decision tree.

### Deploy — ready as-is

A supported-runtime HTTP app that already reads `PORT`, binds `0.0.0.0`, keeps
durable data in a managed DB or external service, and needs no build-time
secrets is ready. Write `keelson.yaml` and deploy.

---

## Adaptation Decision Function

An app that keeps state on the local disk has to move off it — durable data in a
SQLite file has to reach `db.mode: libsql`, and files have to reach the `files`
or `media` SDK (Recipe: local file I/O). **How far you may go on your own**
depends on how invasive that rewrite is. Grade every such app into exactly one of
three values and act on it. When more than one applies, the strictest wins:
**`unsupported` > `ask` > `auto`.**

An app often lands on several rows at once — a SQLite database *and* an uploads
directory. Grade each rewrite separately, then act on the strictest: one `ask`
makes the whole adaptation an `ask`, and the proposal covers every change
together rather than asking twice.

| Value | Meaning | What you do |
|---|---|---|
| **`unsupported`** | The data layer cannot be moved onto a libSQL client at all | **Say the app cannot be deployed to Keelson, and stop.** Do not deploy it in a degraded form |
| **`ask`** | It can be moved, but the rewrite reaches beyond the connection (async conversion, ORM swap, schema/migration changes) | **Propose the rewrite, state what changes, and wait for the user to approve.** Only then do it |
| **`auto`** | A mechanical swap of the client/driver — schema, SQL, and behaviour all unchanged (adding `await` still counts as mechanical) | **Just do it.** Do not ask for confirmation |

Three rules govern the whole function:

1. **`unsupported` means refuse, not degrade.** Never deploy an app whose data
   silently will not survive, and never "partially" adapt one. A green deploy
   that loses the user's data is a worse outcome than an honest refusal.
2. **`ask` means propose one course of action, not a menu.** There is no
   alternative database mode to offer as a plan B — the choice is this rewrite
   or no deploy. Present the rewrite and ask to proceed; if the user declines,
   the app does not deploy.
3. **`auto` means no confirmation.** Asking about a mechanical driver swap
   trains the user to rubber-stamp prompts and buries the cases that genuinely
   need a decision. Do not manufacture a question for an `auto` case.

### `auto` has three conditions, and all three must hold

A route earns `auto` **only** when all of these are true. Any one missing makes
it `ask`:

1. **The upstream client/driver is stable** — not experimental, not a preview.
2. **The route's `local_crud` is verified `pass` on Keelson** — someone has
   actually run this rewrite's CRUD path here. See `reference/SUPPORT_LEDGER.md`.
3. **No app-specific invasiveness trigger fires** — see the trigger list below.

**Condition 2 is the one that catches people.** "The library is popular and the
swap looks obvious" is not evidence. A route that is upstream-stable but
unverified on Keelson stays `ask`.

Node's raw **`better-sqlite3`** is exactly that: a mature, widely used library
whose libSQL rewrite is the same shape of swap as one that *has* been verified —
but nobody has run **this** library's call sites onto the client here, so it
stays `ask`. Node's **`node:sqlite`** — a stdlib driver with a near-identical
synchronous API — *has* been run here, so it is `auto`. **The two rewrites
resemble each other; the evidence does not.** Read the ledger row for the driver
actually in front of you, not the one it looks like. **Never promote a route to
`auto` because it resembles one.**

**Condition 1 is the one that catches US.** Python's raw `sqlite3` route is the
worked example, and it is worth knowing before you argue with a grading. It has
been run here more thoroughly than anything else in the ledger — seven of eight
verification fields pass, including the only proven remote write — and it is
still `ask`, because the `libsql` Python client is upstream-experimental. The
conditions are ANDed and they measure different things: condition 2 asks "has
anyone run this here", condition 1 asks "does upstream stand behind it". **No
quantity of the first substitutes for the second.** A route whose upstream stays
experimental cannot be carried to `auto` by evidence, however good the evidence
is; that takes upstream changing its own label.

### Grading the case

Every database row below **follows from** the facts recorded for its route in
`reference/SUPPORT_LEDGER.md` — it is not graded here by hand. The **Ledger row**
column names the route so you can read the evidence behind the value, and the
derivation is checked mechanically (`support_ledger_contract_test.go`), so this
table and the ledger cannot disagree: change a fact and the value changes with
it. The two file-I/O rows have no ledger row — see the note under the table.

| Case | Value | Ledger row | Why |
|---|---|---|---|
| **Node** raw `node:sqlite` (stdlib `DatabaseSync`) → `@libsql/client` | `auto` | `node-raw-node-sqlite` | Client swap; verified route (`local_crud` pass). SQL and schema unchanged |
| **Node** raw `better-sqlite3`, no ORM → `@libsql/client` | `ask` | `node-raw-better-sqlite3` | The same shape of swap as the stdlib row above — but **unverified here** (condition 2). The trial that dropped `better-sqlite3` did it under an ORM, so that evidence belongs to the row below, not this one |
| **Node** Drizzle on `better-sqlite3` → `drizzle-orm/libsql` | `auto` | `node-drizzle` | Driver swap; verified route. Schema and query expressions unchanged |
| **Python** raw `sqlite3` (stdlib) → libSQL client | `ask` | `py-raw-sqlite3` | **Verified here** — `local_crud` and six more fields pass — but the `libsql` Python client is upstream-**experimental** (libSQL's driver list files Python under "Experimental Drivers"), so condition 1 fails and no amount of our evidence moves it. The rewrite itself is a client swap: SQL and schema unchanged, with rows and datetime params rebuilt at the call site |
| Async SQLAlchemy (async engine over `aiosqlite`) | `ask` | `py-sqlalchemy-async` | No async libSQL driver exists, so the unit of work has to move onto a thread bridge (engine/session setup, lifespan, each DB block) — past the connection. The published `sqlalchemy-libsql-native==0.1.0` sync target underneath is upstream-**experimental** |
| Sync SQLAlchemy / SQLModel / Flask-SQLAlchemy | `ask` | `py-sqlalchemy-sync` | The rewrite itself is small (engine URL + `connect_args`), `sqlalchemy-libsql-native==0.1.0` is upstream-**experimental** (0.x single release, no `Development Status` classifier, and it pins the `libsql` client upstream files under "Experimental Drivers") and this new target is unverified here — conditions 1 **and** 2 both fail |
| **Go** file SQLite driver → `database/sql` + libSQL | `ask` | `go-databasesql` | Go has no `file:` fallback, so parity means generating *and verifying* a local libSQL endpoint (`stacks/go.md`) — not a swap |
| ORM with a cgo-only SQLite driver (Go GORM via `mattn/go-sqlite3`) | `ask` | `go-gorm-cgo` | The ORM has no libSQL path; it has to be dropped for `database/sql` |
| Prisma | `ask` | `prisma-v6`, `prisma-v7` | Adapter, `serverExternalPackages`, and a changed migration path. **The majors are separate routes**: v6 is measured at 6.19.3, v7 is unverified here |
| **Django with a file SQLite `DATABASES` backend** | **`unsupported`** | `py-django-file-sqlite` | No supported libSQL backend for Django. Refuse; offer the external-DB route |
| **State file** the app names and updates (`seen_urls.json`, a cache) → `files` SDK | `auto` | — | One-for-one call swap. No ID, no schema, no URL, no behaviour change |
| **Locally-saved media** the app serves itself (`./uploads/`, `MEDIA_ROOT`, multer `diskStorage`) → `media` SDK | `ask` | — | `put()` mints an ID that needs a column to hold it, and the serving URL moves to `/__keelson/media/<id>` — schema **and** public behaviour change |

> **The two file-I/O rows are graded structurally, not by evidence.** The support
> ledger covers database routes onto libSQL; the `files` / `media` rows are graded
> on the shape of the SDK call (a key-addressed overwrite is one-for-one; a minted
> ID needs a column to hold it). So the `files` row is `auto` **without** the
> `local_crud` evidence condition 2 asks for. This ledger has no verification
> evidence for either row because its scope is database routes, not file SDK calls.
> That gap is recorded rather than hidden.

### Invasiveness triggers (condition 3) — any one forces `ask`

Check these against **the app in front of you**, even when its route is `auto` in
the table above:

- **The existing SQLite file holds data the user would miss.** See the rule
  below — this one is easy to miss and expensive to get wrong.
- The rewrite changes the schema, adds a column, or moves the migration path.
  **A `media` SDK rewrite always does** — the generated ID needs somewhere to
  live.
- The rewrite removes or replaces an ORM.
- The rewrite changes URLs, routes, or the app's public behaviour. **A `media`
  SDK rewrite always does** — the file's URL becomes `/__keelson/media/<id>`.

#### The existing-data trigger

**A libSQL rewrite moves the code, not the rows.** The new managed database
starts **empty**: the schema is recreated by the app, and **the rows in the old
`.db` file are not carried over**. Migrating existing data is not part of this
recipe and Keelson does not promise it today.

So before applying an `auto` swap, check whether the app's SQLite file actually
holds data that matters (a seeded demo table it rebuilds on boot does not; a
file the user has been writing to does). **If it does, the case is `ask`** — the
strictest value wins — and the proposal must say plainly that existing rows will
not come across. Silently pointing a populated app at an empty database is data
loss, and it is worse than the refusal it disguises itself as, because the
deploy goes green.

**`auto` is not defeated by `await`.** The libSQL clients are async while
`better-sqlite3` / `sqlite3` are synchronous, so a swap normally means adding
`await` at the call sites and making their callers async. **That is part of the
mechanical swap — it is not a reason to ask.** It touches many lines, but it
changes no schema, no SQL, no URL, and no behaviour, and it is exactly what the
recipe in your stack file prescribes. What earns an `ask` is a change to the
*shape* of the data layer (an ORM leaves, a migration path moves, an async
architecture inverts) or an unmet condition 1–3 — never the size of the diff.

Grade on **the data layer you actually found**, not on the framework's
reputation, and not on the line count. When a case is not in the table, it has
no verified `local_crud`, so it is `ask` by default.

### Wording templates

Use these shapes verbatim (fill in the specifics). Two properties matter: the
**stop reason** is one concrete sentence, and the ask ends in a plain question.

**`ask` — propose the rewrite and wait**

> This app {reason it cannot go to libSQL as written}. To run it on Keelson's
> managed database it needs {the change: scope, and what stays the same}. Shall
> I go ahead?

**`unsupported` — say it cannot be deployed**

> This app cannot be deployed to Keelson, because {reason}.

Worked examples, one per case in the grading table:

- **Sync SQLAlchemy / SQLModel** (`ask`)
  > This app reaches SQLite through SQLAlchemy's file dialect. To run it on
  > Keelson's managed database the engine needs to move to the SQLAlchemy libSQL
  > dialect and take its URL and auth token from the environment. Your models
  > and queries stay as they are. Shall I go ahead?

- **Flask-SQLAlchemy** (`ask`)
  > This app reaches SQLite through Flask-SQLAlchemy's file dialect. To run it
  > on Keelson's managed database, `SQLALCHEMY_DATABASE_URI` needs to point at
  > the libSQL dialect with the injected credentials, keeping a local file URL
  > for your own machine. Your models and queries stay as they are. Shall I go
  > ahead?

- **Node raw `better-sqlite3`** (`ask` — unverified route)
  > This app uses `better-sqlite3` against a local file. Moving it to Keelson's
  > managed database means swapping in `@libsql/client`, which is a small
  > change — but this particular rewrite has **not been verified on Keelson**,
  > so I would rather not do it without telling you first. Your SQL and schema
  > stay as they are. Shall I go ahead?

- **Python raw `sqlite3`** (`ask` — upstream-experimental client). Note the
  reason differs from the row above: this one *is* verified here, so do not tell
  the user it is untested.
  > This app uses Python's `sqlite3` against a local file. Moving it to
  > Keelson's managed database means swapping in the `libsql` client — we have
  > run that rewrite here and it works, but Turso still lists its Python client
  > as experimental, so I would rather you decided. Your SQL and schema stay as
  > they are; what changes is that rows come back as plain tuples and any
  > `except sqlite3.…Error` handling has to be rewritten. Shall I go ahead?

- **The existing database holds real data** (`ask` — overrides `auto`)
  > This app already has data in `{file}`. Moving it to Keelson's managed
  > database recreates the tables but **does not bring the existing rows
  > across** — the app would start empty on Keelson, and your local file would
  > be left untouched. Migrating the data is not something I can do as part of
  > this change. Shall I go ahead on that basis?

- **Async SQLAlchemy** (`ask`)
  > This app uses SQLAlchemy's async engine, which has no libSQL driver. To run
  > it on Keelson's managed database the session layer needs to move to the
  > synchronous SQLAlchemy libSQL dialect, with the request handlers calling it
  > through a worker thread. Your models and queries stay as they are. Shall I
  > go ahead?

- **Go + GORM on cgo SQLite** (`ask`)
  > This app reaches SQLite through GORM's cgo driver, which cannot build on
  > Keelson and has no libSQL equivalent. To run it on the managed database the
  > data layer needs to move to `database/sql` with the pure-Go libSQL driver,
  > which means rewriting GORM's calls as SQL. Your tables stay as they are.
  > Shall I go ahead?

- **Prisma** (`ask`)
  > This app uses Prisma against a SQLite file. To run it on Keelson's managed
  > database it needs the libSQL adapter, a build setting change, and a
  > different way of applying migrations. Your schema and queries stay as they
  > are. Shall I go ahead?

- **Locally-saved media** (`ask` — the app saves uploads to a directory and
  serves them itself). Detection signals: `express.static("uploads")`, multer
  `diskStorage`, Flask `send_from_directory`, Django `MEDIA_ROOT` / `MEDIA_URL`,
  or any `save()` / `writeFile` of an upload followed by a route that reads the
  same directory back.
  > This app saves uploaded files to `{directory}` on the local disk, which is
  > discarded whenever the app restarts or scales to zero — the uploads would
  > disappear. To keep them, the app needs to store them through Keelson's media
  > API, which returns an ID for each file: that means adding a column to hold
  > the ID, and the files would then be served from `/__keelson/media/<id>`
  > instead of `{current path}`. Your upload form and the rest of the app stay as
  > they are. Shall I go ahead?

- **Django on file SQLite** (`unsupported`)
  > This app cannot be deployed to Keelson, because Django cannot use Keelson's
  > managed database — there is no supported libSQL backend for it — and Keelson
  > has no mode that keeps a SQLite file on disk. Django can be deployed here if
  > it points at an external database (e.g. hosted PostgreSQL): set
  > `db.mode: none` and supply the connection details through `secrets`. I can
  > do that if you have a database to point it at.

Three failure modes these templates exist to prevent, all observed in practice:

- **Do not offer to "keep the SQLite file as-is."** No such mode exists. An
  offer the platform cannot honour is worse than a refusal.
- **Do not soften `unsupported` into a half-deploy.** "I'll deploy it and the
  data will reset sometimes" is not a compromise; it is the failure the refusal
  exists to prevent.
- **Do not offer `db.local_sqlite` as a way out of `unsupported`.** It is for a
  database the app is *designed* to lose — a cache, a scratch index — and
  declaring it does not create durability, it only records that none is wanted.
  Using it to get an `unsupported` app deployed converts "we cannot keep your
  data" into "we will silently discard your data", with the user's own
  declaration as cover. If the data matters, the only offers are the rewrite
  (`ask`) or the external-database route. **An app whose durable data has no
  home does not deploy.**

---

## Refusal Policy

When the decision tree lands on **Refuse**, do not attempt a deploy and do not
half-adapt. State the reason plainly, factually, and offer the realistic
alternative. Use these templates (fill in the specifics):

- **Unsupported runtime**
  > This app is written in **{language}**, which Keelson does not support.
  > Keelson runs Python, Node.js, and Go. To deploy here it would need to be
  > rewritten in one of those; otherwise use a host that supports {language}.

- **Not an HTTP server**
  > Keelson hosts web apps that serve HTTP. This app is a **{desktop/CLI/…}**
  > program with no HTTP server, so there is nothing for Keelson to route to. A
  > prebuilt static web frontend is deployable without an HTTP server, and an
  > HTTP API is deployable with one. A static site is not a refusal.

- **Bundled database/queue server**
  > This app runs **{PostgreSQL/Redis/…}** inside the app container. Keelson
  > runs a single app process and cannot host a database or queue server. Use
  > **Keelson Managed SQLite (`db.mode: libsql`)** for relational data, or connect
  > to an external managed **{PostgreSQL/Redis/…}** instance.

- **Multi-service compose**
  > This project is a multi-service `docker-compose` stack ({list services}).
  > Keelson deploys one app (plus optional scheduled `crons`), not a compose
  > graph. Deploy the web service here and move its datastores to managed
  > services.

- **GPU inference**
  > This app requires a GPU ({framework}). Keelson has no GPU instances. Call a
  > hosted inference API from a supported runtime instead, and keep the API key
  > in `secrets`.

Never refuse for these — they are adapt-or-ignore, not blockers: a missing
`PORT` read, a local SQLite file, hard-coded secrets, a `Dockerfile`, no
built-in authentication, pnpm/yarn lockfiles.

---

## Adaptation Recipes

The mechanical rewrites that turn an "almost" app into a deployable one. This
file carries the **rules** (what must be true after the rewrite); the concrete
before → after code for your language lives in `stacks/<lang>.md` — find it via
`core/ROUTER.md`. Apply every recipe that matches, then re-run the decision
tree. The persistence choices these recipes assume are spelled out in Data &
Persistence; the limits they respect are in `core/KEELSON_YAML.md` →
Constraints Reference.

### Recipe: bind to `PORT` and `0.0.0.0`

The app must listen on the injected `PORT` and bind `0.0.0.0`. A hard-coded port
or a `127.0.0.1` / `localhost` bind will not receive traffic.

Per-language before/after: `stacks/python.md`, `stacks/node.md`, `stacks/go.md`.

### Recipe: SQLite file → Keelson Managed SQLite (libSQL)

The flagship adaptation. Replace the direct-file SQLite client with a libSQL
client that reads `KEELSON_DB_URL` / `KEELSON_DB_AUTH_TOKEN`, and set
`db.mode: libsql`. Keep a `file:` URL as the **local-dev fallback** so the app
still runs without an injected managed DB.

For backward compatibility the platform also injects `TURSO_DATABASE_URL` /
`TURSO_AUTH_TOKEN` with the same values, so ecosystem sample code that reads
those names keeps working. New code should read the `KEELSON_DB_*` names.

`keelson.yaml`:

```yaml
db:
  mode: libsql
```

The per-language client, package name, and before/after rewrite are in your
stack file — `stacks/python.md`, `stacks/node.md`, or `stacks/go.md`. Read only
yours; each is self-contained. (Go is the one asymmetric case: it has **no**
`file:` local-dev fallback — see `stacks/go.md`.)

After rewriting: no `import sqlite3` / `better-sqlite3` should remain in the
data path, and the app must read `KEELSON_DB_URL`.

> **Do not leak the environment.** `KEELSON_DB_AUTH_TOKEN` (and every other
> secret) is injected as an environment variable, so anything that ships the
> whole environment off-box hands out a live database credential: an error
> tracker configured to attach env/PII, a debug error page that renders
> `os.environ` (e.g. Django `DEBUG=True`, `phpinfo()`), or a log line that dumps
> the full env. The platform bounds a leaked token's lifetime (finite TTL +
> operator-triggered rotation), but the app must not create the leak.
> - Never log or print the full environment. Reference secrets by the specific
>   key you need, not by dumping `process.env` / `os.environ`.
> - Run with debug/verbose error pages **off** in production
>   (`DEBUG = False`, no `display_errors`).
> - If you add Sentry (or similar), disable env/PII capture and scrub secrets:
>   set `send_default_pii=False` (its default) and keep a scrubber that drops
>   `*_TOKEN` / `*_AUTH_*` / `*_KEY` / `*_SECRET` keys from the event context.
>   `KEELSON_DB_AUTH_TOKEN` uses the `_AUTH_TOKEN` suffix precisely so default
>   secret scanners / scrubbers match it.

### Recipe: hard-coded API keys → `secrets`

Move any hard-coded key or committed `.env` secret into a `secrets` declaration.
Declaring a secret does not set its value — the user supplies it out of band and
the value is injected at deploy time.

```python
# contract:skip — before/after
# BEFORE
client = OpenAI(api_key="sk-abc123...")   # hard-coded, do not commit
# AFTER
import os
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
```

```yaml
secrets:
  items:
    - name: OPENAI_API_KEY
      description: "OpenAI API key"
  required:
    - any_of: [OPENAI_API_KEY]
      message: "Set an AI provider key before deploying."
db:
  mode: none
```

For a new app, move the value into an uncommitted local env file and run
`keelson deploy --new --secrets-from-env-file <path>`. This creates the app,
sets the secret, and completes the initial deploy in one command; the CLI
excludes that env file from the upload artifact. Do not run `keelson secrets
set` first because the app does not exist yet.

For an existing app, run
`keelson deploy --secrets-from-env-file <path>` to set the secret and deploy in
one command. Alternatively, set it with `keelson secrets` or in the Console,
then redeploy because secret values are injected at deploy time only.

### Recipe: local file I/O → `files` SDK / `media` SDK

**Every local path is ephemeral.** A file written to the working directory,
`/tmp`, or anywhere else on the instance's disk is gone at scale-to-zero, on
redeploy, and between a web request and a `cron` run (they are different
containers). There is no declaration that changes this — the retired `storage:`
block did not persist anything and no replacement exists. An app that writes a
file it expects to read back later either moves to one of the two SDKs below, or
it loses the data.

#### The three-way routing rule

Route every file the app reads or writes by **how the data is accessed**, not by
what the file is called. The three rows are mutually exclusive:

| What the app holds | Goes to | Why |
|---|---|---|
| A file the app names and rewrites **as a whole value**, read and written **occasionally — never per request** (`state.json`, `last_run.json`, `seen_urls.json`, a settings blob) | **`files` SDK** | The app picks the key, overwriting is the normal case, and nothing serves it over HTTP |
| **Uploaded or generated media referenced by ID** (an image, a PDF, an export the user downloads) | **`media` SDK** | The SDK issues the ID, the object is immutable, and it is served at `/__keelson/media/<id>` |
| **Structured data read or written on every request**, or any set of records the app queries, filters, or sorts (records, orders, users, a queue) | **libSQL** (`db.mode: libsql`) | Per-request access is a database's job — see the SQLite→libSQL recipe |

**Do not read these rows in order and stop at the first that seems to fit.** The
deciding fact is the access pattern, and it beats the file's name every time:
**almost every per-request record set starts life in a file the app named**
(`orders.json`, `users.json`), so a rule that matched on "the app names and
updates it" first would sweep whole CRUD apps into `files` — the exact opposite
of this spec. If the app reads or writes it on **every request**, or treats it as
**records to query**, it is the third row and it goes to the database, no matter
how the file is named or how small it looks today.

That boundary is not a style preference, it is the SDK's stated scale: `files`
targets small whole-value writes (a few KB–MB, hard cap 10 MiB per file; `media`
objects are capped at 50 MiB — send larger objects to external object storage) at
roughly **one update per key per second**, and per-request read/write is explicitly out of scope for it. A
request-rate counter, a per-request session write, or a list re-read on every
page render outgrows it immediately — the database is both faster and correct
there.

The two SDKs are **not interchangeable**, and their vocabulary is the tell:

- **`files` = `write` / `read`** — the app supplies the key, `write()` overwrites,
  `read()` returns `None`/`null` when the key does not exist (a first run is the
  normal case, not an error). Private: no URL, never served.
- **`media` = `put` / `get`** — the SDK generates a ULID, objects are write-once,
  and the ID is how the app refers to it afterwards.

Do not reach for `media.put()` to store `state.json` (it would mint a new ID
every write and orphan the last one), and do not expect a `files` key to have a
URL.

#### State file → `files` SDK (mechanical — `auto`)

A file the app names and updates is a **one-for-one call swap**. No schema, no
URL, no behaviour changes, so it needs no confirmation
(Adaptation Decision Function → `auto`):

```python
# contract:skip — before/after
# BEFORE
json.dump(d, open("seen_urls.json", "w"))
# AFTER
keelson.files.write("seen_urls.json", json.dumps(d))
```

Reading back is the same shape, and the `None` return is what makes the first run
work without a special case:

```python
# contract:skip — the first-run read
seen = json.loads(keelson.files.read("seen_urls.json") or "[]")
```

Per-language imports and call shapes: `stacks/python.md`, `stacks/node.md`,
`stacks/go.md` → File I/O.

#### Locally-saved media → `media` SDK (invasive — `ask`)

An app that saves uploads to `./uploads/` and serves them itself is **not** a
one-for-one swap: `media.put()` mints an ID the app has to store, and the serving
route moves to `/__keelson/media/<id>`. That is a schema change plus a URL change
— two invasiveness triggers — so it is `ask`. See the grading table and the
worked wording below.

#### Local development parity

Both SDKs fall back to real files on the user's machine with no configuration:
`files` writes `./.keelson/files/<key>`, `media` writes `MEDIA_DIR` (default
`./media`). The app keeps starting and working with no Keelson environment set,
which Local Development Parity (below) requires of every adaptation. Add the
fallback directory to `.gitignore`.

On Keelson (`KEELSON_MODE=keelson`) there is no such fallback: if the SDK's
configuration is missing it raises a configuration error rather than silently
writing to a local disk that is about to disappear.

#### What does not change

Neither SDK gives an operator or CLI a way to inspect or mutate a running app's
files. When users need to retrieve a generated file, implement a download
endpoint in the app and return it from an authenticated app route. Read-only
store retrieval and Console download are post-launch work — do not promise them.

### Recipe: own login → `X-Keelson-User-Id`

Every request already passed the platform auth gate before it reaches the app,
so an app-level login/session layer is redundant. Remove it and read the
authenticated user id from the `X-Keelson-User-Id` request header.

```python
# contract:skip — before/after
# BEFORE
user = verify_session(request.cookies.get("session"))
if not user: return redirect("/login")
# AFTER
user_id = request.headers["X-Keelson-User-Id"]   # set by the platform gate
```

Do not add a login page, and do not refuse to deploy an app just because it has
no authentication of its own — Keelson provides it.

### Recipe: in-process scheduler / post-response work → `crons`

The app assumes a process that stays alive between requests. There is none:
code is guaranteed to run only while a request is in flight and during a
declared `cron` run (`core/KEELSON_YAML.md` → Background Work). A scheduler or
a deferred task inside the app process is not an error — it is a **silent
no-op**, and it is the only adaptation whose omission produces a green deploy,
no error log, and no symptom until the user notices the work never happened.

Route the work by what it is:

| The work is… | Rewrite to |
|---|---|
| Time-of-day / periodic (a 9:00 report, a nightly cleanup, polling a feed) | A **`crons`** entry |
| Part of the request's success condition (validate, persist, a short external call) | Do it **before the response** |
| Output the user watches while connected (generation, progress) | **Stream the response** (SSE / chunked) |
| An audit / history record | The **same transaction** as the business write (`db.mode: libsql`) |
| A durable side effect the user should not wait for (email, webhook, sync) | A **claim table in the managed database, drained by a `crons` entry** — and tell the user the wait is up to one interval |

**Time-of-day schedule → a `crons` entry.** Extract the job body into its own
entrypoint that runs to completion and exits, then delete the in-process
scheduler. The entrypoint is a plain script, not a server.

```js
// contract:skip — before/after (server.js → report.js)
// BEFORE — never fires: no process exists between requests
cron.schedule("0 9 * * *", sendDailyReport);

// AFTER — report.js runs once and exits naturally. Close held resources
// (DB clients, pools) so the event loop can drain; do NOT call
// process.exit(0), which can cut unflushed logs and I/O.
await sendDailyReport();
await db.close();
```

```yaml
# contract:skip — fragment
crons:
  - name: daily-report
    schedule: "0 9 * * *"
    command: "node report.js"
    timeout: 300
```

**Post-response work → move it before the response**, and let its failure show
in the response.

```python
# contract:skip — before/after (FastAPI)
# BEFORE — the deferred task is not guaranteed to run; treat it as never running
@app.post("/signup")
async def signup(req: SignupReq, background: BackgroundTasks):
    background.add_task(send_welcome_email, req.email)
    return {"ok": True}

# AFTER — finish inside the request window; surface failure
@app.post("/signup")
async def signup(req: SignupReq):
    await send_welcome_email(req.email)   # raise → the client sees the error
    return {"ok": True}
```

**A side effect that must survive the response → a claim table plus a `crons`
drain.** There is no platform queue and no way for the app to trigger an
execution: event-driven background tasks are not currently supported. What the
app *can* do is write the work down and let a scheduled run pick it up. The
request handler inserts a row; a `crons` entrypoint selects the unclaimed rows,
does the work, and marks them done. Both halves live in the managed database
(`db.mode: libsql`) — the web instance and the cron run share no disk.

Three rules make this safe, and none of them is optional:

- **The drain body must be idempotent.** A run can be killed at `timeout` after
  the side effect but before the row is marked done, and the next run will see
  that row again.
- **Count attempts and give up.** There is no platform retry and no dead-letter
  queue: a row that fails forever is drained forever. Cap the attempts, record
  the failure, and make it visible in the app.
- **State the delay to the user before you build it.** The row waits until the
  next run. The minimum interval is plan-bound (60 minutes on the lowest plan),
  so "we'll email you right away" is not a promise this shape can keep. If the
  UX needs it to be immediate, do it before the response instead.

**Output the user watches while connected → stream the response.** SSE /
chunked streaming keeps the work inside the request window. Two limits, and
they are separate: the gap between chunks may not exceed **120 seconds**, and
the whole request may not exceed **300 seconds**. The window also ends when the
client disconnects, so streaming is not a substitute for durable work.

**Execution contract to design against** (the platform limits live in
`core/KEELSON_YAML.md` → `crons` and Constraints Reference; the per-plan
interval and cron count come from the user's plan):

- A run may start late. Never assume exact-time execution.
- A run does not overlap itself: if the previous run is still going, this one is
  **skipped, not queued**. There is **no retry** — recovery is the next run.
- A run still executing at `timeout` is killed (`timeout` 1–600s; the plan
  ceiling is Starter 180 s / Plus 300 s / Team 600 s, and an omitted value is
  300 s or the ceiling, whichever is shorter).
- When the workspace's monthly Scheduled Jobs allowance is exhausted, the
  month's remaining runs are **skipped, not queued** — and skipped runs still
  count. A frequent drain spends that allowance on every tick whether or not
  there is work, so add up the ticks of every cron in the app before choosing an
  interval.
- The schedule is evaluated in the workspace's timezone, fixed when the
  workspace was created (set from the owner's browser; server fallback UTC).
  Confirm the effective value with `keelson crons list --json` rather than
  assuming UTC or the user's local time. Cron count and per-run timeout are
  plan-bound (Starter 3 / 180 s, Plus 5 / 300 s, Team 10 / 600 s).
- A cron run executes in a **separate container** and shares no disk with the
  web instance. Its durable state goes to the managed database or the `files` /
  `media` SDK (Recipe: local file I/O). Files written to a local path during a
  cron run — `/data` included — are discarded.
- Interval and cron count are plan-bound. If the design needs a tighter interval
  than the user's plan allows, say so before deploying instead of declaring a
  schedule that will be rejected.

**What does NOT need this recipe** (do not over-rewrite):

- `setInterval` / timers in **frontend** (browser) code — unaffected.
- Async work that is **awaited before the response is returned**.
- In-memory caches used as a pure optimization, where losing the cache at
  scale-to-zero is acceptable.
- A queue library (Celery, BullMQ) used **only as a producer** against a
  consumer the user actually runs elsewhere. Verify that consumer exists and is
  reachable — a producer with no live consumer is a silent failure, not a safe
  classification.

**How far you may go on your own** (Adaptation Decision Function): deleting a
scheduler and moving its body into a `crons` entrypoint changes no schema, no
SQL, no URL, and no public behaviour — it is mechanical, so do it (`auto`). Two
shapes are not: a **202-then-poll flow**, because the response contract and the
client's polling loop both change, and any work whose **timing the user can
observe**, because "sent immediately" becoming "sent within the hour" is a
product change, not a refactor. Those are `ask` — state the new worst case and
get approval before rewriting.

---

## Local Development Parity

**An app that ran on the user's machine before the adaptation must still run on
the user's machine after it.** This is a success condition of the adaptation, not
a courtesy — rank it with `db.mode` selection and the invasiveness judgement, and
apply it to every recipe in this file.

The reason is what Keelson is for. The user did not hand over their app; they
asked for it to be *deployed*. They keep building it, keep fixing it, keep
running it locally with their agent. An adaptation that produces "works on
Keelson, dead on my laptop" has taken the app away from them and called it a
success. This has actually happened — the Go/GORM trial (`rooms`) came back
adapted, deployed, green, and unable to start under `go run .` without
`KEELSON_DB_URL`.

### The pattern: production-safe defaults, local works anyway

Read configuration from the environment with **defaults that are safe for
production**, and make the app start with **no environment set at all**. The two
are not in tension; the default just has to be both.

- **Connections:** env if present (Keelson), local otherwise.
  `os.environ.get("KEELSON_DB_URL", "file:local.db")` — see your stack file.
- **Behaviour flags:** the safe value is the default and local opts *in*, never
  the reverse. `DEBUG = os.environ.get("DEBUG", "false").lower() == "true"` is
  correct; defaulting `DEBUG` to `"true"` and relying on Keelson to set it false
  means a forgotten env var ships a debug console to production.
  Framework-by-framework minimums are in your stack file → Production Hardening.

Both directions matter, and a rule that only enforces one is worse than useless:
a default that breaks local dev fails this norm, and a default that is unsafe in
production fails the deploy. The wiring lint checks the connection half of this
(`reference/VERIFICATION.md`) — under `db.mode: libsql` it reports
`no-local-dev-path` when the URL is env-only in Python/Node.

**Where the two rules genuinely collide, `KEELSON_MODE` is the tie-breaker.**
Some hardening is fail-fast by nature ("refuse to boot without `SECRET_KEY`"),
which would also refuse to boot on the user's laptop. The platform always injects
`KEELSON_MODE=keelson` and nothing sets it locally, so
`os.environ.get("KEELSON_MODE") == "keelson"` tells the app which side it is on:
fail fast there, fall back to a dev value here. Both rules hold at once. Do not
reach for `DEBUG` as that signal — it is correctly False on the laptop too, so
gating on it re-breaks local startup.

### Required check: local parity

**Before deploying, start the app with no Keelson environment and exercise its
main CRUD path.** This is a named, required step — checklist item 8 below and
step 3 of `reference/VERIFICATION.md` — not an optional smoke test. It is the
only check that sees what the user will see. Nothing else in the pre-deploy set
runs the app the way they will run it.

### Stacks with no `file:` mode

Go has no `file:` fallback (`stacks/go.md`: the pure-Go libSQL client cannot open
`file:` URLs, and adding a file-SQLite driver back reintroduces the ephemeral
data loss the recipe removes). Parity still holds — it is just met differently:

1. **Generate an equivalent local path** — a local libSQL endpoint (`sqld` /
   `turso dev`) with `KEELSON_DB_URL` pointed at it, plus the setup steps, in the
   repo where the user will find them.
2. **Verify it runs.** Generating instructions is not meeting the norm; starting
   the app against them is. An unverified local path is a guess handed to the
   user as a fact.
3. **If you cannot do both, stop.** Do not deploy, and report to the user why the
   local path could not be verified, rather than shipping an app that only runs
   on Keelson.

---

## Data & Persistence (libSQL-first)

Pick the persistence mechanism from **what the app holds**, then apply the
matching recipe. The default for durable relational data is **Keelson Managed
SQLite (`db.mode: libsql`)**.

### One-look decision table

| What the app holds | Choose | Fields |
|---|---|---|
| Durable relational data (records, orders, users) | **`db.mode: libsql`** | `db.mode: libsql` + a libSQL client in code |
| An **existing** SQLite file holding data that must survive | **`db.mode: libsql`** | Apply the SQLite→libSQL recipe. There is no mode that persists the file itself |
| A file the app names and updates (`state.json`, a cache) | **`files` SDK** | `files.write(key, data)` / `files.read(key)` — no `keelson.yaml` field to declare |
| Uploaded / generated media served by ID (image, PDF) | **`media` SDK** | `media.put(...)` returns an ID; store the ID, serve `/__keelson/media/<id>` |
| An already-external database (Postgres, hosted Mongo, …) | `db.mode: none` | connect with your own client |
| Throwaway / cache data | `db.mode: none` | `/tmp` or `:memory:` plus `db.local_sqlite` |

### libSQL is the only durable database

- **`libsql` is the only mode that keeps data.** There is no mode that persists
  a SQLite file on disk: under every other mode the filesystem is ephemeral and
  the file is gone at scale-to-zero. So "this app writes a SQLite file" always
  resolves one of two ways — the SQLite→libSQL recipe, or the app does not
  deploy (Adaptation Decision Function).
- **Moving to libSQL is not "dropping SQLite".** libSQL *is* SQLite, reached
  over the network instead of through the filesystem. The SQL and the schema
  survive the move; what changes is the client.
- **New apps: author against libSQL from the first line.** This is the
  top-level norm — see the Decision Tree. For a "build me an app and deploy it"
  request, start with `db.mode: libsql`; do not generate fresh `sqlite3` /
  `better-sqlite3` file code and then migrate it.
- **How far you may go without asking is the Decision Function's call.** A
  mechanical client swap is `auto` — do it. A rewrite that reaches past the
  connection is `ask`. A data layer that cannot reach libSQL at all is
  `unsupported`: say so and stop.

### Anti-patterns

- **`db.mode: libsql` while writing a `.db` file to local disk.** The managed
  store is the injected libSQL connection, not a local file. A `.db` file under
  `/tmp` is ephemeral and is not the managed DB.
- **Writing a `databases:` block.** `databases:` is a **retired** field from the
  withdrawn file-replication mode. Its presence fails the deploy at parse
  (`DB_DATABASES_REMOVED`). Never write one; if
  you find one in an existing `keelson.yaml`, remove it and move the app to
  `db.mode: libsql`.
- **Writing a `storage:` block (`storage.files` / `storage.dirs`).** Also
  **retired**. It never made a path durable, and declaring it now fails the
  deploy: only the deprecated `storage.disk_id` key is still parsed (and ignored);
  `files` / `dirs` are rejected as unknown fields. Never write one; if an existing `keelson.yaml` has one,
  remove it and route the app's files through the `files` / `media` SDK
  (Recipe: local file I/O).
- **Writing files to `/data`.** `/data` does not exist and cannot be created:
  the app runs as UID 1000 and `mkdir /data` fails with `PermissionError`. Do not
  propose it as a place to keep anything, and do not "fix" a lost-file report by
  moving the write there — the write itself will fail.
- **Deploying a file-SQLite app "for now".** If the data must survive and the
  rewrite has not happened, the app is not deployable yet. Say that, rather than
  shipping an app that loses writes.

The deploy artifact inspector hard-fails high-confidence file-SQLite signals
when `db.mode` is `none` or `libsql`; changing only YAML cannot bypass it. Low
signals such as a Prisma SQLite provider, Drizzle `sqlite-core`, or a lone
Python `import sqlite3` are warnings only. Comments and TypeScript type-only
imports do not count, and a libSQL client suppresses the low tier.

### `db.mode`

Set the `db` block in `keelson.yaml` to select how the app's SQLite database is managed:

```yaml
db:
  mode: libsql   # required: libsql | none
```

| `db.mode` | Meaning | When to use |
|---|---|---|
| `libsql` | **Keelson Managed SQLite** (recommended). A per-app managed libSQL DB is provisioned automatically and isolated per workspace/app. Connection is injected via `KEELSON_DB_URL` / `KEELSON_DB_AUTH_TOKEN` (plus `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` aliases for compatibility). Scales to zero. | New apps and any app that can use a libSQL client. **The only durable database.** |
| `none` | Keelson does not manage a durable database. | Stateless apps, external DB clients, or explicitly declared ephemeral SQLite. |

The `db` block and `db.mode` are mandatory; omission and empty strings are
schema errors.

An intentionally ephemeral local SQLite database must use the structured escape:

```yaml
db:
  mode: none
  local_sqlite:
    policy: ephemeral
    paths: [/tmp/cache.db] # /tmp/** or :memory: only
    reason: Rebuilt HTTP cache
```

`/workspace` and `/data` are rejected in `db.local_sqlite.paths`. The declared
path suppresses its matching SQLite lint finding; the declaration does not
waive any other file DB. `keelson deploy --check` enforces this: the wiring lint
(`reference/VERIFICATION.md`) matches a declared path against the connection's
own URL **exactly**, so declaring `/tmp/cache.db` silences the connection that
opens `/tmp/cache.db` and nothing else.

### Getting the schema in

A newly provisioned managed database is **empty** — Keelson creates the database,
never its tables. Something has to put the schema there, and there are exactly
two supported routes:

- **The app creates it at startup** (`CREATE TABLE IF NOT EXISTS` on boot). Fine
  for a small, self-contained schema.
- **`keelson db apply <file.sql>`** — an operator sends SQL to the app's database
  from outside. This is the route for an initial schema you do not want in
  application code, and for one-off corrections. Read `reference/DB_APPLY.md`
  before using it: the first apply on an empty database is unattended, but every
  apply after that requires a **human approval in the console** — which you
  cannot perform, so a plan that needs five sequential applies needs five
  approvals.

Neither route is a migration system. If the schema must converge on every
deploy, declare **`db.migrate`** (`core/KEELSON_YAML.md` → `db.migrate`): the
command runs on the new image before traffic moves, and a non-zero exit fails
the deploy instead of promoting unmigrated code. Idempotent startup DDL is the
lighter alternative. An ORM migration runner pointed at a file URL is not an
option — that file is on the Job's ephemeral disk. For Python SQLAlchemy, exact-pin
`sqlalchemy-libsql-native==0.1.0`, use its remote dialect URL, and run Alembic
through `db.migrate`; the route remains `ask` (`reference/SUPPORT_LEDGER.md`).

**Prohibited (out-of-band file mutation only):** Do not mutate a running app's
SQLite database, WAL, or journal file **out of band**. No supported external
file-operation interface reaches the live disk, and direct writes would corrupt
the database. This does **not** restrict the app itself — an app writes to its
own declared storage normally. To change data, go through the app or the managed
libSQL connection.

---

## Deploy & Verify Runbook

The commands, the post-deploy checks, and the Day-2 operate/debug tree are in
`reference/VERIFICATION.md`. The three sections below stay here, in the core,
because they are the contract every deploy is judged against.

> **The three sections below must remain in this file, adjacent and in this
> order** (`Definition of a Successful Deploy` → `Spec–Test Traceability` →
> `Agent Pre-Deploy Checklist`). Both traceability checkers slice a section by
> finding its heading and reading to the *next* heading; splitting them across
> files removes the terminator and the table parse silently widens instead of
> failing. See `scripts/check_spec_test_traceability.py` and
> `apps/cli/internal/skill/deploy_spec_contract_test.go`.

### Definition of a Successful Deploy

A deploy is successful only when ALL of the following are true. Each condition
carries a stable ID (`SD-*`) so that every one maps to an executable test in the
Spec–Test Traceability table below — the guard that stops a declared success
condition from shipping without a test (the exact gap behind the 2026-07-09
blank-page incident, where SD-5 had no test).

1. **[SD-1]** The app build has completed
2. **[SD-2]** The app process has started
3. **[SD-3]** The health check has passed
4. **[SD-4]** The app URL (`https://<workspace>--<app>.<domain>`) has been issued.
   The domain varies with the connected environment, so do not predict the URL:
   read `url` from the deploy output, or use `KEELSON_APP_URL` from inside the app
5. **[SD-5]** The candidate can serve its checked entry documents and their
   same-origin subresources through the edge. How Keelson proves this depends on
   the deploy mode:
   - For a Cloud Run app with a server process (`container` or `hybrid`),
     Keelson probes the candidate revision through the real public path (public
     host → Cloudflare edge → gateway → candidate), NOT through the internal
     service URL. An unauthenticated `GET /` must also prove the auth path is
     alive: on a **redeploy** (a public route already exists) it must return
     `401`; on a **first deploy** the route is not published until after
     completion, so it legitimately `404`s at the edge before the auth gate.
     That `404` is accepted only while the public route is still unpublished.
     After completion,
     the route is published and an unauthenticated request is rejected by the auth gate
     with `401`, including after a first deploy.
     Either way, a served `2xx` means the auth gate was bypassed and fails. `/`
     itself may return anything under authentication (an API-only app
     legitimately 404s at `/`).
   - For a static release (`edge-static` or `edge-spa`), no server process or
     unpublished public preview route exists. Before publishing the release,
     Keelson deterministically resolves `/` and the declared `verify:` paths
     against the uploaded release manifest and reads the resolved HTML locally.
     It does not make an HTTP request or test the authentication gate. An
     unresolved `/` remains allowed for file-only sites, but an explicitly
     declared path that cannot resolve to either a release file or the configured
     `assets.fallback` fails the deploy. An `edge-spa` route may therefore
     resolve successfully through its fallback without a same-named file.

   Across both methods, an explicitly declared `verify:` path must be servable.
   For a server-process deploy, a final response other than 2xx or 3xx—including
   404, 401, 403, and 405—fails with
   `verification_declared_path_unreachable`; static-release resolution failure
   uses the same error. This rule does not apply to `/`, even if `/` is explicitly
   declared. Put only paths that do not require the app's own user login in
   `verify:` because candidate verification carries no app user identity and an
   app-level 401 or 403 therefore fails. This is distinct from `health.path`,
   whose internal candidate probe accepts 404 as proof that the process started.
   The archived experimental `cf-container` mode has no candidate public-path
   probe and is outside this contract.

   With either method, every checked path that resolves to HTML requires each
   same-origin `<script src>`, `<link rel=stylesheet>`, and
   `<link rel=modulepreload>` reference to resolve with a **content-type
   consistent with its kind**. A `<script>` that resolves to `text/html` (an SPA
   fallback serving the index page for an asset URL) therefore fails even when
   it would return HTTP 200.

A successful build alone does NOT mean a successful deploy.

> **Verification coverage limit.** Verification only sees the entry graph
> reachable from the checked HTML (script/stylesheet/modulepreload references).
> Code-splitting bundlers emit dynamic `import()` chunks that are fetched at
> runtime and are **not** referenced from `index.html`, so a broken lazy-loaded
> route chunk is invisible: **a passing verification does not prove every route
> works.** Use keelson.yaml `verify: [/path, …]` (optional) to cover additional
> entry documents. For static releases, `/` is always checked in addition to
> every declared path; a declared path that neither matches a release file nor
> resolves through `assets.fallback` fails before publication.
> For server-process deploys, `keelson status --json` reports how far the edge
> probe actually got in `verification.coverage`: `unauthenticated_gate_only`
> means no authenticated HTTP response was observed; `document_not_served`
> means at least one authenticated response was observed but no probed path
> returned a `2xx` HTML document; and `subresources_checked` means at least one
> probed path returned a `2xx` HTML document and its set of referenced
> subresources was checked (even when that set was empty). `ok: true` reports
> the probe verdict under its acceptance rules; it does **not** guarantee broad
> coverage. Always inspect `coverage` before deciding what the verdict proves.
> For server-process deploys, `/` is always probed first; declared `verify:`
> paths are appended in declaration order, with duplicates removed. A declared
> path outside `/` must return 2xx or 3xx; 404, 401, 403, and 405 fail with
> `verification_declared_path_unreachable`. Artifact
> Verification failures expose their cause in `verification.error_code`:
> `verification_declared_path_unreachable`,
> `verification_subresource_mime_mismatch`,
> `verification_subresource_unreachable`,
> `verification_root_unreachable`, or
> `verification_candidate_unreachable`. The first four artifact and reachability
> failures use public `failure_code: "deploy.verify.failed"`. The auth-gate-only cause
> `verification_unauthenticated_not_rejected` instead uses public
> `failure_code: "deploy.platform.error"`, because it indicates a platform
> edge/gateway fault rather than a workspace artifact fault. When transport retries
> produce no authenticated response, `verification_candidate_unreachable` uses
> public `failure_code: "deploy.platform.temporarily_unavailable"`; retrying the
> deploy is the correct next action. The failing URL,
> status, and content-type are in `keelson status --json`'s `verification`
> object.

### Spec–Test Traceability

Every machine-checkable assertion in this spec carries a stable ID and maps to at
least one executable test. This is the anti-regression mechanism for a whole class
of incident — **"the spec declared a contract that no test enforced"** (the
2026-07-09 blank-page ship: success condition SD-5 was written down but had no
test, so a deploy that failed it still reported `completed`).

The mapping is enforced mechanically by
`scripts/check_spec_test_traceability.py` (pure stdlib, no test harness — run it
directly). It **fails** when:

- a declared `SD-*` ID has no row here, or its test cell is `TODO` (the
  "condition without a test" state made reviewable), or
- a referenced test (`path::name`) no longer exists in the repo.

The doc-internal half (every `SD-*` in *Definition of a Successful Deploy* has a
non-`TODO` row) is additionally pinned by the offline Go contract test
`apps/cli/internal/skill/deploy_spec_contract_test.go::TestDeploySpecSuccessConditionsAreTraceable`.

Reference a test as `<repo-relative-path>::<test-func>` (Python `test_*` or Go
`Test*`). A cell may list several, comma-separated. Use `TODO` (only) when a
declared assertion genuinely has no test yet — that is a deliberate, reviewable
red flag, not a way to silence the check.

#### Definition of a Successful Deploy (`SD-*`)

| ID | Assertion | Enforced by (test) |
|---|---|---|
| SD-1 | The app build has completed | `apps/api/src/keelson/deploys/tests/test_worker.py::test_process_deploy_happy_path_completes` |
| SD-2 | The app process has started (startup probe: candidate revision is ready) | `apps/api/src/keelson/deploys/tests/test_cloud_run_deploy.py::test_synthetic_health_raises_when_candidate_failed` |
| SD-3 | The health check has passed (HTTP probe accepted) | `apps/api/src/keelson/deploys/tests/test_cloud_run_deploy.py::test_synthetic_health_retries_http_until_accepted`, `apps/api/src/keelson/deploys/tests/test_cloud_run_deploy.py::test_synthetic_health_returns_service_url_on_pass` |
| SD-4 | The app URL has been issued (edge route published) | `apps/api/src/keelson/deploys/tests/test_cloud_run_deploy.py::test_synthetic_health_returns_service_url_on_pass`, `apps/api/src/keelson/deploys/tests/test_worker.py::test_process_deploy_container_syncs_kv_without_route_crud` |
| SD-5 | Checked entry documents and their subresources are edge-servable (server process: candidate edge probe and auth gate; `edge-static` / `edge-spa`: pre-publication release-manifest verification) | `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_happy_path_passes`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_spa_fallback_mime_mismatch_fails`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_phase0_revert_404_subresource_fails`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_unauthenticated_2xx_is_auth_bypass_and_fails`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_redeploy_unauthenticated_401_passes`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_authenticated_403_reports_document_not_served`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_root_5xx_fails_reachability`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_authenticated_transport_error_reports_gate_only`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_html_without_subresources_reports_subresources_checked`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_declared_path_404_fails`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_declared_path_auth_rejection_fails`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_declared_path_2xx_and_3xx_pass`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_declared_root_404_remains_tolerated`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_declared_path_500_stays_root_unreachable`, `apps/api/src/keelson/deploys/tests/test_verify_probe.py::test_declared_path_platform_error_is_not_declared_failure`, `apps/api/src/keelson/deploys/tests/test_worker_edge_verify_unit.py::test_edge_verification_paths_always_keep_root_first`, `apps/api/src/keelson/deploys/tests/test_worker_edge_verify_unit.py::test_diagnose_derives_declared_paths_from_checked_paths_tail`, `apps/api/src/keelson/deploys/tests/test_worker_edge_verify_unit.py::test_failure_reason_names_code_and_url`, `apps/api/src/keelson/deploys/tests/test_assets_verify.py::test_broken_subresource_fails_with_404`, `apps/api/src/keelson/deploys/tests/test_assets_verify.py::test_spa_fallback_exposes_script_mime_mismatch`, `apps/api/src/keelson/deploys/tests/test_assets_verify.py::test_missing_declared_path_fails_but_missing_root_is_permitted`, `apps/api/src/keelson/deploys/tests/test_worker_phase4.py::test_static_assets_verification_failure_is_persisted_before_publication` |

#### Other doc–parser contracts (`DC-*`)

The same ID+test discipline, extended to the other assertions this spec (and
`SKILL.md`) make about the CLI/API surface. These were already enforced; giving
them IDs makes the coverage auditable in one place.

| ID | Assertion | Enforced by (test) |
|---|---|---|
| DC-1 | Every `keelson.yaml` field is documented here | `apps/api/src/keelson/deploys/tests/test_skill_deploy_spec_contract.py::test_every_keelson_config_field_is_documented` |
| DC-2 | Auto-set env table == platform-injected set | `apps/api/src/keelson/deploys/tests/test_skill_deploy_spec_contract.py::test_auto_set_env_table_matches_injected_set` |
| DC-3 | Deploy-mode vocabulary == config-derived modes | `apps/api/src/keelson/deploys/tests/test_skill_deploy_spec_contract.py::test_deploy_mode_vocabulary_matches_config` |
| DC-4 | Every `yaml` example validates against the real parser | `apps/api/src/keelson/deploys/tests/test_skill_deploy_spec_contract.py::test_deploy_spec_yaml_blocks_validate_against_keelson_config`, `apps/cli/internal/skill/deploy_spec_contract_test.go::TestSkillDocYAMLExamplesAreValid` |
| DC-5 | Supported-runtimes table == parser runtimes | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestDeploySpecRuntimeTableMatchesParser` |
| DC-6 | Reserved slugs + numeric limits are documented | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestDeploySpecDocumentsLimitsAndReservedSlugs` |
| DC-7 | Day-2 (Operate & Debug) command surface is pinned | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestSkillDocsPinDay2Commands` |
| DC-8 | `SKILL.md` steers agents to structured `error.hint`/`retryable`, not string-matching | `apps/cli/internal/skill/skill_contract_test.go::TestSkillMDErrorContractUsesStructuredErrorHint` |
| DC-9 | The shipped spec bundle installs as a whole and retires the pre-split monolith | `apps/cli/internal/skill/agent_install_test.go::TestInstallAgent_InstallsWholeSpecBundle`, `apps/cli/internal/skill/agent_install_test.go::TestInstallAgent_RetiresPristineDeploySpecMonolith`, `apps/cli/internal/skill/agent_install_test.go::TestInstallAgent_KeepsEditedDeploySpecMonolith` |
| DC-14 | The `db.mode: libsql` check is framed as a 3-valued, warning-only **wiring lint** — never as a persistence proof — and states the coverage gap it leaves | `apps/cli/internal/skill/dbwiring_contract_test.go::TestVerificationDocFramesLintAsWiringNotProof` |
| DC-15 | The shipped SQLite→libSQL recipes pass that wiring lint (it does not flag the spec's own recommended `file:` fallback), and the Go no-fallback asymmetry holds | `apps/cli/internal/skill/dbwiring_contract_test.go::TestStackRecipesPassTheWiringLint`, `apps/cli/internal/skill/dbwiring_contract_test.go::TestPythonNodeRecipesKeepLocalFallback`, `apps/cli/internal/skill/dbwiring_contract_test.go::TestGoRecipeHasNoFileFallback` |
| DC-16 | `deploy --check` actually runs the wiring lint (step 7), for every stack, and its findings are warnings that never block a deploy | `apps/cli/internal/deploy/db_wiring_check_test.go::TestDBWiringFailIsAWarningAndNeverBlocks`, `apps/cli/internal/deploy/db_wiring_check_test.go::TestDBWiringRunsForEveryStack` |
| DC-17 | A `db.local_sqlite`-declared path suppresses its **matching** wiring finding and waives no other file DB; the wiring remediation is mode-specific | `apps/cli/internal/deploy/db_wiring_check_test.go::TestDeclaredEphemeralSQLiteIsNotWarned`, `apps/cli/internal/deploy/db_wiring_check_test.go::TestDBWiringHintsAreModeSpecific` |
| DC-18 | Local development parity is a first-class norm: the adapted app still runs with no Keelson env, the check is required (not optional), and a stack with no `file:` mode must generate **and verify** an equivalent local path | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestSkillDocsRequireLocalDevParity` |
| DC-19 | The wiring lint enforces the connection half of that norm, judging the fallback by value: env-only **or a visibly empty fallback** (`""`/`None`/`undefined`) is `no-local-dev-path` in Python/Node, a fallback it cannot resolve is `unknown`, and Go (whose parity is a local libSQL endpoint no source read can see) stays `pass` | `apps/cli/internal/skill/dbwiring/dbwiring_test.go::TestMissingLocalDevBranchIsFail`, `apps/cli/internal/skill/dbwiring/dbwiring_test.go::TestEmptyFallbackIsFailNotUnknown`, `apps/cli/internal/skill/dbwiring/dbwiring_test.go::TestWiringLintAcceptsHelperExtractedURL`, `apps/cli/internal/skill/dbwiring/dbwiring_test.go::TestGoEnvOnlyPasses`, `apps/cli/internal/deploy/db_wiring_check_test.go::TestNoLocalDevPathIsAWarningWithAnAddNotDeleteHint` |
| DC-20 | Every stack file ships its frameworks' production-hardening minimum, states the safe-by-default direction (opt **in** to dev, never opt out), and its examples still start with no env — fail-fast is gated on `KEELSON_MODE`, never on `DEBUG` | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestStacksShipProductionHardening`, `apps/cli/internal/skill/deploy_spec_contract_test.go::TestHardeningDefaultsAreProductionSafe`, `apps/cli/internal/skill/deploy_spec_contract_test.go::TestPythonHardeningStillStartsWithNoEnv` |
| DC-21 | No doc claims the platform sets an env var it does not set; `NODE_ENV` (not injected) ships as a `keelson.yaml` declaration | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestBundleDoesNotInventAutoSetEnv`, `apps/cli/internal/skill/deploy_spec_contract_test.go::TestNodeRecipeDeclaresNodeEnv` |
| DC-22 | Django's host/CSRF advice matches the gateway: CSRF trust is scoped to this app's own origin, and `ALLOWED_HOSTS` stays open because the gateway strips the inbound `Host` | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestDjangoHostAndCSRFAdviceMatchesTheGateway` |
| DC-23 | The support ledger's source of truth is `support_ledger.yaml`; `reference/SUPPORT_LEDGER.md` is its generated view (never hand-edited); the YAML ships neither into an install directory nor into the CLI binary; and the schema is closed — unknown keys are rejected, and so is a second YAML document (which would bypass that check entirely) | `apps/cli/internal/skill/support_ledger_contract_test.go::TestSupportLedgerViewIsGenerated`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestSupportLedgerShipsTheViewNotTheSource`, `apps/cli/internal/skill/ledger_source_test.go::TestLedgerSourceIsNotEmbeddedInTheBinary`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestSupportLedgerSchemaIsClosed`, `apps/cli/internal/skill/ledger_source_test.go::TestParseLedgerRequiresExactlyOneDocument` |
| DC-24 | The ledger holds facts + evidence and **no** verdict: `auto`/`ask`/`unsupported` is derived from its facts by the decision function at priority `unsupported` > `ask` > `auto`, and the Grading table agrees with that derivation row for row | `apps/cli/internal/skill/support_ledger_contract_test.go::TestLedgerHoldsNoJudgement`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestDecisionTableMatchesLedgerDerivedVerdicts`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestVerdictDerivationPrioritisesStrictness`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestEveryLedgerRouteIsGradedByTheDecisionTable` |
| DC-25 | No route reaches `auto` without a verified `local_crud` pass on a stable upstream; an unrecorded verification field reads as `untested` (absence is never support) | `apps/cli/internal/skill/support_ledger_contract_test.go::TestNoRouteIsAutoWithoutVerification`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestOmittedVerificationDefaultsToUntested` |
| DC-26 | Ledger evidence is real and correctly attributed: every cited id names an artifact that exists — **including ids named only in prose** — `go-gorm-cgo` carries no pass evidence (the rooms trial removed GORM and verified `database/sql`), and Prisma majors are separate routes | `apps/cli/internal/skill/support_ledger_contract_test.go::TestLedgerEvidenceArtifactsExist`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestLedgerProseTrialMentionsExist`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestGoGormCarriesNoPassEvidence`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestPrismaMajorsAreSeparateRoutes` |
| DC-27 | Django + file SQLite is `unsupported` (§13-2-3) and the external-DB route (`db.mode: none` + `secrets`) stays recorded, so the refusal does not read as "Django cannot deploy"; the async-SQLAlchemy route is settled after its staging measurement (§13-2-1) — no longer `pending`, verdict `ask`, verification permanently `untested` because the remote run is a task-doc (not citeable) rather than fabricated as a pass | `apps/cli/internal/skill/support_ledger_contract_test.go::TestDjangoFileSQLiteIsUnsupported`, `apps/cli/internal/skill/support_ledger_contract_test.go::TestAsyncSQLAlchemyIsSettledWithoutFabrication` |
| DC-28 | Every stack-recipe `keelson.yaml` block is fenced as YAML and explicitly labelled as either a parser-valid complete file with all required fields and the optional workspace hint, or a fragment that points to the full contract | `apps/cli/internal/skill/deploy_spec_contract_test.go::TestStackRecipeKeelsonYAMLBlocksAreCompleteOrLabelled` |

### Agent Pre-Deploy Checklist

Before running `keelson deploy`, verify the following in order:

1. **Decision tree** — Is the app Deploy / Adapt / Refuse? Apply every matching
   Adaptation Recipe before proceeding.
2. **Runtime check** — Is the app's language in the supported runtimes list?
3. **Dependency check** — Are native dependencies compatible with the runtime constraints?
4. **keelson.yaml check** — Does the file exist? Are `slug`, `runtime`, explicit `db.mode`, and `command` set correctly?
5. **Environment variables** — Are required env vars and `secrets` configured?
6. **Port binding** — Does the app read `PORT` and bind to `0.0.0.0`?
7. **Static pre-deploy check** — Run `keelson deploy --check --json` and confirm
   it passes. This is an offline check (no auth, no upload) that reports missing
   dependency manifests, `install`/`build` commands wrongly placed in `command`,
   runtime/command mismatches, and static assets that would not be deployable. A
   missing `go.mod` is an error. For Python and Node.js, a missing manifest is a
   warning: add one when the app uses external libraries; standard-library-only
   apps do not need one.
   Treat `assets_dir_empty` as an instruction to build or correct `assets.dir`
   so the archive contains at least one regular file. Treat
   `assets_fallback_missing` as an instruction to correct or generate the
   fallback file inside `assets.dir`. Both are errors and set `ok: false`.
   Other errors it can raise: `lockfile_unsupported` (pnpm / yarn lockfile
   without `package-lock.json`) and `assets_dir_project_root`.
   It also runs the **db wiring lint** and the **file wiring lint**
   (`reference/VERIFICATION.md`), which report `db_wiring_fail` /
   `db_wiring_unknown` / `file_wiring_fail` / `file_wiring_unknown` as **warnings**: they do not
   set `ok: false` and never block a deploy, because a static lint cannot prove
   wiring. Read them anyway — `db_wiring_fail` is the silent-data-loss shape
   (`db.mode: libsql` declared while the code writes to an ephemeral local
   file). Do not "fix" a warning by deleting a `file:` local-dev fallback in
   Python/Node: that fallback is the recommended recipe. Read the returned
   `archive` object even when `ok` is false: verify that `excluded` and
   `excluded_env_files` contain only intended omissions, and review every
   `secret_like_files` entry because those files will be uploaded. Always inspect
   `embedded_credentials`: it reports paths and credential kinds without
   exposing values. Any `preview_read`, `preview_write`, or `app_token` match
   sets `ok: false` and blocks upload; a `webhook_signing`-only match warns but
   does not block. Also review `unscanned_files` and
   `unscanned_binary_count`; an empty credential list is not proof that skipped
   or excluded content was scanned. Fix `.keelsonignore` or move secrets to the
   Keelson secret store before deploying if the preview is wrong.
8. **Local parity check** — start the app with **no Keelson environment**
   (`KEELSON_DB_URL` and friends unset) and exercise its main CRUD path. It must
   start and work. This is required, not optional: it is the only step that runs
   the app the way the user will (Local Development Parity above). For a stack
   with no `file:` mode, run it against the local libSQL endpoint you generated —
   generating that path does not count until it has started the app. If you
   cannot make it pass, do not deploy — report to the user why the app can no
   longer run locally.
9. **Background work audit** — go looking for work that needs a live process,
   and do it actively: grep the dependency manifest for `apscheduler`,
   `celery`, `schedule`, `node-cron`, `agenda`, `bull`, `bullmq`; grep the
   source for `new CronJob(`, `BackgroundTasks`, `threading.Timer`, and
   server-side `setInterval`; and read the request handlers for work that runs
   after the response is returned. Every hit must end up either rewritten under
   **Recipe: in-process scheduler / post-response work → `crons`** or
   classified as safe — frontend timers, work already awaited before the
   response, a cache that may vanish at scale-to-zero, or a producer whose
   consumer really runs elsewhere and is reachable. Nothing else on this list
   catches these: the deploy goes green and the runtime is silent, so this
   audit is the only gate.

If any check fails, **do not attempt the deploy**. Report the issue to the user with the specific reason.

### Send feedback after the work

After the deploy attempt is finished, submit structured feedback for both
successes and failures with `keelson feedback --app <slug>` (optionally add
`--deploy <id>`). Send only events you actually encountered; do not add general
advice or speculate about problems you did not observe. The JSON on stdin must
describe the verdict, frictions, configuration confusion, error-message
quality, wanted commands, Skill gaps, verification method, and what worked
well.

Use this exact shape (arrays may be empty):

```json
{
  "verdict": {"score": 8, "summary": "one-sentence assessment"},
  "friction": [
    {
      "step": "deploy step where it happened",
      "command": "command actually run",
      "output_quote": "relevant output actually observed",
      "expected": "expected behavior",
      "lost_minutes": 3,
      "recovered": true
    }
  ],
  "yaml_confusions": [],
  "error_message_reviews": [],
  "wanted_commands": [],
  "skill_gaps": "",
  "verification_method": "how the deployed app was checked",
  "kept_good": []
}
```

Never include tokens, secrets, source code, or environment-variable values.
The workspace owner controls sharing. When sharing is disabled the command is a
silent no-op before it reads stdin; do not retry it and do not create a local
feedback file as a substitute.

> **Note:** the CLI validates the persistence declaration (`db`, `db.mode`, and
> `db.local_sqlite`) before upload. The API repeats the validation and remains
> authoritative for the full schema.
