# Keelson Deploy Spec — `keelson.yaml` Contract

The config contract every deploy is validated against: the required file, the
runtimes, how the deploy mode is derived, the reserved URL namespace, the hard
limits, background work, authentication, secrets, and access control.

Read this together with `core/DECISION.md` (deploy/adapt/refuse + `db.mode`
selection) and `core/ROUTER.md` (which `stacks/<lang>.md` to open).

> **Section order in this file is load-bearing.** Three doc↔parser contract
> tests slice a section by finding its start heading and reading to a specific
> end heading: the runtimes table (supported → unsupported), the deploy-mode
> vocabulary (deploy modes → configuration constraints), and the auto-set env
> table (auto-set env → required secrets). Both headings of each pair must stay
> in this file, in the order they appear below. Reordering or relocating one
> does not fail loudly — it silently widens or empties the parsed section.
> For the same reason, never quote one of those headings verbatim in prose:
> the slicers match the first occurrence of the heading text, so a mention
> above the real heading would hijack the section start.

---

## Required File

Every deploy requires a `keelson.yaml` at the project root.

Minimum example:

```yaml
slug: my-app
runtime: python-slim
command: "python app.py"
db:
  mode: none
```

Do NOT set `PORT` in `env`. The platform injects `PORT` at runtime and any
`PORT` you set is silently dropped. The app must **read** `PORT` from the
environment and bind to `0.0.0.0` — never hard-code it.

**Always quote `env` values.** An unquoted value is rejected
(`env_value_not_string`) and the deploy never starts:

```yaml
db:
  mode: none
env:
  NODE_ENV: "production"   # correct
  PORT_HINT: "8080"        # quote numbers too
  DEBUG: "true"            # quote booleans too
```

`NODE_ENV: production`, `RETRIES: 3`, and `DEBUG: true` are all rejected. The
manifest is parsed by two different YAML implementations (the CLI reads YAML 1.2,
the API reads YAML 1.1) which type unquoted scalars differently — `K: 0o123`
used to deploy as `"83"` or `"0o123"` depending on the path, with no error either
way. Quoting removes the ambiguity, so it is required for every value.

**Keys** are constrained too, for the same reason. An unquoted key must be an
ordinary identifier — starts with a letter or `_`, then letters/digits/`_` — and
must not be one of these YAML boolean/null words:

```
yes Yes YES no No NO true True TRUE false False FALSE on On ON off Off OFF null Null NULL
```

Normal env names (`NODE_ENV`, `DB_POOL`, `PORT_HINT`) need no quoting. **Quote
the key** for anything else:

```yaml
db:
  mode: none
env:
  NODE_ENV: "production"   # fine unquoted
  "MY-VAR": "x"            # hyphen -> quote the key
  "yes": "x"               # reserved word -> quote the key
```

Do not build `env` with a YAML merge key (`<<`), and do not declare `env` — or
any key inside it — twice. Both are rejected: only the last one survives the
load, so the two parsers can end up deploying different variables.

See the keelson.yaml reference for all fields: https://keelson.dev/docs/reference/keelson-yaml-reference/

### App Description (`description`) — always write it on a new deploy

`description` is an optional top-level string that fills the "what is this app"
line in the Keelson app ledger (the console app list and the app header).

**On a new deploy, always write it.** You just built this app, so you are the one
who knows what it does — the user is never asked to type it in.

- **1–2 sentences, max 300 characters.** Characters are counted as
  Unicode code points, not UTF-8 bytes. A longer value is rejected and the
  deploy fails; nothing is silently truncated.
- Write it in **the language you are conversing with the user in** (a Japanese
  user gets a Japanese description). The platform does not translate.
- Say **who it is for and what it does**, not how it is built. Example:
  「営業チーム向けの日報・週報作成アプリ。週次サマリーを自動集計します」
- It is applied **only while the app's ledger entry is still empty**. Once
  someone edits the description in the console, later deploys never overwrite it
  — so writing one costs nothing on redeploys of an already-described app.

```yaml
slug: my-app
description: "営業チーム向けの日報・週報作成アプリ。週次サマリーを自動集計します"
runtime: python-slim
command: "python app.py"
db:
  mode: none
```

### Default Workspace (`workspace`) — optional for multi-workspace accounts

Set the optional top-level `workspace` field when your account belongs to multiple
workspaces and you want commands run from this project to use the same workspace
without repeating `--workspace`. Prefer the workspace slug because display names can
change and IDs are long. If your account belongs to only one workspace, omit this
field; the CLI selects that workspace automatically. An explicit `--workspace` always
overrides the value in `keelson.yaml`.

The value can be a workspace slug, display name, or ID. Quote Japanese display
names and any other values that start with a non-ASCII character. Also quote IDs
or other values that start with a digit (for example,
`workspace: "550e8400-e29b-41d4-a716-446655440000"`). A typical setting is:

```yaml
slug: my-app
runtime: python-slim
command: "python app.py"
workspace: acme-corp
db:
  mode: none
```

The former top-level `tenant` field remains accepted as a compatibility alias.
No removal date is set. If both names are present, their raw string values must
match exactly.

### Placement Region (`region`) — optional

Set `region` when creating a new app to select its placement. Use a
vendor-neutral Keelson logical key: `jp-tokyo` (display name "Japan") or
`us-oregon` (display name "US West"). Do not use a cloud-provider region name.
Opening a region to new apps is rolled out separately from defining it: as of
this spec version `us-oregon` is still closed to new apps in production, so an
explicit `region: us-oregon` is rejected there. Leave `region` unset unless the
user asked for a specific region.

- Selection priority is `keelson deploy --region` > `keelson.yaml` `region` >
  the workspace default. `--region` changes only the submitted configuration;
  it does not rewrite the local file.
- An unknown or not-yet-available region is rejected. Do not silently substitute
  another region for an explicit selection. Unknown keys are checked locally before the deploy request.
  If a newly documented key is rejected, run `keelson upgrade` and try again.
- An app's region is **fixed when the app is created and cannot be changed**. A
  later deploy whose `region` disagrees with the app is rejected. There is no
  cross-region move; create a new app to relocate it.

```yaml
slug: my-app
runtime: python-slim
command: "python app.py"
region: us-oregon
db:
  mode: none
```

---

## Supported Runtimes

| Runtime | Language | Use case |
|---|---|---|
| `python-slim` | Python | Lightweight. APIs, text processing, automation |
| `python-media` | Python | Media processing. Includes image/video libraries |
| `node-slim` | Node.js | Lightweight. Web apps, APIs |
| `node-media` | Node.js | Media processing. Includes image processing libraries |
| `go-slim` | Go | Lightweight |
| `go-media` | Go | Media processing |

Set via the `runtime` field in `keelson.yaml`. Start with `-slim`; switch to `-media` only if you need media processing libraries.

The `runtime` field is still required for a static-only deploy, even though a static release never builds a container.
A `go-` runtime also drops root-level build outputs from the archive (`app`, `target/`, `*.exe`, and `*.test`), except for the configured `assets.dir` and its parents.
Choose a valid runtime whose archive preview retains every intended static asset.

### slim vs media

- **slim** — Language runtime and standard library only. Faster builds, smaller images.
- **media** — slim + pre-installed system libraries for image processing (Pillow, sharp, etc.) and video processing.

### Supported Frameworks

Keelson is framework-agnostic. Any app that can be started via `command` and accepts HTTP requests will work.

Examples: FastAPI, Flask, Express, Next.js, Hono, Gin, etc.

## Unsupported Runtimes

The following languages/runtimes are NOT supported:

- Ruby
- Java / Kotlin / Scala
- PHP
- Rust
- .NET / C#
- Elixir / Erlang
- Swift

Apps whose runtime process uses an unsupported runtime cannot be deployed to
Keelson, even with modifications (see `core/DECISION.md` → Refusal Policy). A
runtime used only as a build tool does not trigger this restriction when the
repository already contains the prebuilt static files and no process handles
requests at runtime.

---

## Deploy Modes

The deploy mode is **derived** from `command` / `assets` — you never set it
directly. Decide the fields with this procedure:

1. **Is there a backend process?** (an app that serves requests at runtime)
   → set `command`. If not, leave `command` unset.
2. **Are there prebuilt static files to serve?** → set `assets.dir`. If not,
   omit `assets`.
3. **Does the static frontend do client-side routing (a SPA)?** → set
   `assets.fallback` (e.g. `index.html`).
4. **Backend + static together (hybrid)?** → `assets.fallback` is **required** when `type: web` is explicit (optional when `type` is omitted),
   and set `assets.api` to the prefix that bypasses static serving and hits the
   backend (defaults to `/api`).

Use `type: web` for an app that contains only static files.
A static-only app must declare it, or the deploy is rejected.

The resulting mode, and the raw `deploy_mode` label the CLI/API return, follow
directly:

| Mode | `deploy_mode` raw label | `command` | `assets` | Description |
|---|---|---|---|---|
| Container | `container` | Yes | No | Standard app deploy (a web app) |
| Scheduled jobs only | `container` | No (requires `crons`) | No | Runs `crons` without starting a web server |
| Static site | `edge-static` | No | Yes (no `fallback`) | Static files only |
| SPA | `edge-spa` | No | Yes (with `fallback`) | Single-page app with fallback |
| Hybrid | `hybrid` | Yes | Yes (`fallback` required when `type: web` is explicit) | Static files + backend API |

The **raw label** column is the value the CLI and API return in `deploy_mode`
(e.g. `keelson status --json`). It is a derived, read-only classification, not
an input. Map it back to the human name using this table: `container` →
Container (Web app), `edge-static` → Static site, `edge-spa` → SPA, `hybrid` →
Hybrid.

Static redeploys can take up to about 60 seconds before new files appear at the
edge and removed files stop resolving. The delay varies a lot between deploys —
production measurements range from 1 to 57 seconds with a median around 30 — so
treat 60 seconds as the wait, not 30. This delay is specific to `edge-static`
and `edge-spa` redeploys and is caused by Cloudflare KV eventual-consistency
propagation, not a cache that can be purged. Adding a query string does not make
the propagation faster.

Cross-field rules baked into the procedure above:

- `assets.fallback` is **required** for hybrid (`command` + `assets`) when `type: web` is explicit; optional when `type` is omitted.
- `assets.api` is only allowed when `command` is set.
- `type: web` may not combine with `crons`.

The CLI excludes paths containing any of these names when it creates the deploy
archive: `.git`, `.venv`, `__pycache__`, `.pytest_cache`, `node_modules`,
`dist`, `build`, `.idea`, `.vscode`, and `.DS_Store`. The declared `assets.dir`
and each of its ancestor directories are exempt from that built-in exclusion,
except that `.git` is always excluded wherever it appears and is never exempt.
Thus the `dist` examples below are archived, but `assets.dir: .git`,
`assets.dir: .git/objects`, and `dist/.git/**` are not. Built-in exclusions
still apply below `assets.dir`: for example, `dist/index.html` is included while
`dist/node_modules/**` is excluded.

Env-style names are excluded independently of `--secrets-from-env-file`: the
final path element is compared case-insensitively and is an env name when it
starts with `.env` or ends with `.env`. This includes `.env`, `.env.production`,
`.envrc`, `.secrets.env`, and directories named `.env`. The rule also applies
inside `assets.dir`, because those files could otherwise become public static
assets. To deliberately archive a non-secret build-time env file, add a
negation such as `!.env.production` to the project-root `.keelsonignore`.
A file named by `--secrets-from-env-file` cannot be re-included; that flag still
controls secret registration, not the general env-name exclusion.

The optional project-root `.keelsonignore` excludes additional paths. It uses a
gitignore-like subset: one pattern per line; blank lines and lines beginning
with `#` are ignored; `/` anchors to the project root or separates path
components; a trailing `/` matches directories only; `*`, `?`, `**`, `[abc]`,
and `[a-z]` are supported; and the last matching rule wins. A leading `!` can
undo an earlier ignore rule or the env-name rule, but cannot undo the secret-file,
`.git`, built-in-name, runtime-specific, or `.keelsonignore` exclusions. Pattern
matching is case-sensitive, directory traversal cannot re-include descendants
of an excluded directory, and invalid patterns are ignored with a warning.
`.keelsonignore` itself is never archived. Symlinks and other non-regular files
are also not archived.

For a static app — `assets` is set and neither string nor array-form `command`
is set — the archive contains only files under `assets.dir` and `keelson.yaml`
by default; ancestor directories remain traversable so the CLI can reach the
asset directory. Files outside that publishing tree are not needed by the
static release and are excluded from upload. To deliberately restore an outside
file, negate the static-scope exclusion in `.keelsonignore`, for example
`!NOTICE.txt`. Restoring a directory and its contents requires both `!keep/` and
`!keep/**`, because traversal stops at an excluded directory. This static scope
does not apply to container or hybrid apps, whose source is needed for builds.

Avoid `assets.dir: .` (including equivalent forms such as `./`): it publishes
the project root, so every otherwise archived file can be served publicly. The
CLI warns before deploy but does not reject this existing configuration.

Keelson does not read .gitignore. Put deployment exclusions in
`.keelsonignore` instead. This keeps entries such as `dist/` from removing a
static app's output from its deployment archive.

Run `keelson deploy --check --json` before deploying and inspect `archive`,
especially `excluded`, `excluded_env_files`, and `secret_like_files`. The last
field warns about files that are still included, including suspicious names
such as `credentials.json`, `service-account.json`, `id_rsa`, `id_ed25519`, and
names ending in `.pem`, `.key`, `.p12`, or `.pfx`. It also warns when a file
selected by an earlier `--secrets-from-env-file` deploy still exists but was
not selected for exclusion this time. Keelson remembers only the
project-relative path, never secret values, in the automatically excluded
`.keelson-config/previous-secrets-files.json` file. Move actual secrets to
Keelson secrets or explicitly exclude the file. The `assets.dir` exemption
requires Keelson CLI `v0.1.1` or later; run `keelson version` and upgrade before
using a `dist` or `build` assets directory with an older release.

Examples:

```yaml
# Static site (edge-static): prebuilt files, no backend
slug: docs-site
type: web
runtime: node-slim
db:
  mode: none
assets:
  dir: dist
```

```yaml
# SPA (edge-spa): client-side routing → fallback
slug: spa-app
type: web
runtime: node-slim
db:
  mode: none
assets:
  dir: dist
  fallback: index.html
```

```yaml
# Hybrid: backend API + static frontend
slug: my-app
runtime: node-slim
command: "node server.js"
db:
  mode: none
assets:
  dir: dist
  fallback: index.html
  api: /api
```

---

## Reserved URL Paths

Some URL paths are handled by the platform before a request can reach your app:

- **`/__keelson` and every path below it are platform-internal for all HTTP
  methods.** This namespace carries platform-served assets, file downloads, and
  internal endpoints. Do not define app routes under it.
- **On delivery paths that pass through the gateway, GET requests to `/health`
  and `/_health` are platform-internal exact-path routes.** HEAD and every other
  method may reach the app. These GET routes do not apply to apps delivered
  directly as static files.
- **The edge rejects every HTTP method to `/api/webhooks/email` and
  `/api/webhooks/email-events` with 403.** Do not choose either exact path as an
  entry point for an external system.
- **The whole `/api/webhooks/` and `/api/external/` subtrees are
  non-interactive.** The edge routes every request under them to the webhook /
  machine credential check before interactive login is ever tried; a logged-in
  browser user gets 401 there. Put only externally-called endpoints under these
  prefixes (see `auth.endpoints`), never a normal app route.
- **`/assets`, `/files`, `/static`, `/uploads`, the rest of `/api`, `/docs`, and
  `/media` are app-owned paths.** Requests to these paths reach the app
  normally. A Vite app that references `/assets/index-*.js` needs no
  configuration change.
- **A build must not emit a top-level `__keelson` directory into its served
  output.** For Node builds (a `package.json` is present) the builder scans `.`,
  `dist`, `build`, `public` and `out` and rejects the deploy at build time with
  **`reserved_path_conflict`**. Python, Go and static releases are not scanned,
  but the path is still platform-owned at the edge and such files are simply
  unreachable; rename the directory and redeploy in every case.
- Two related rules live elsewhere in this spec: `auth.endpoints` paths may not
  begin with `/__keelson` (they must start with `/api/external/` or
  `/api/webhooks/`), and the `slug` value cannot be a reserved word (see
  Configuration Constraints).

### Framework static-path collision matrix (reference)

Common frameworks emit their static bundles under these default paths. **None
collide with `/__keelson/*`**, so no Keelson-specific configuration is needed to
serve them. This table is informational only. **`Verified`** = confirmed in this
repository; **`Estimate`** = a knowledge-base expectation that has **not** been
verified here — confirm it before relying on it, and do not treat it as
authoritative.

| Framework | Default static path | Collides with `/__keelson` | Status |
|---|---|---|---|
| Vite (Vue / Svelte / React / Solid / Preact) | `/assets/*` | No | Verified |
| Remix v2 / VitePress | `/assets/*` | No (expected) | Estimate |
| Angular | `/assets/*` | No (expected) | Estimate |
| Next.js | `/_next/static/*` | No (expected) | Estimate |
| Nuxt / SvelteKit / Astro | `/_nuxt/*` · `/_app/*` · `/_astro/*` | No (expected) | Estimate |
| CRA / Django / Flask | `/static/*` | No (expected) | Estimate |

Because no default framework path collides with `/__keelson/*`, the build-time
reserved-path guard only trips on a hand-authored `__keelson` directory.

---

## Constraints Reference

The limits the recipes are respecting. Consult when a deploy is rejected.

### OS / Architecture

- **OS:** Linux
- **CPU:** x86_64 (amd64)

### Root Access

Apps run as a non-root user. `sudo`, `apt-get install`, and system-level changes are not available.

### Dockerfile

Ignored, not a blocker. Keelson builds from runtime selection + `command`, not
from a `Dockerfile`. A `Dockerfile` in the project is simply ignored — its
presence does **not** prevent a deploy as long as the app otherwise satisfies
this spec. Do not refuse to deploy an app just because it ships a `Dockerfile`.

### Filesystem

| Path | Writable | Persistent | Purpose |
|---|---|---|---|
| App directory | Yes (temporary) | No | Source code, dependencies |
| `/tmp` | Yes (temporary) | No | Temporary files |
| `/data` | **No** — does not exist and cannot be created (the app runs as UID 1000 and cannot mkdir under the root-owned `/`) | — | Nothing. Never write there; use `/tmp` for scratch |
| Other | No | — | — |

- **No path on this filesystem is persistent.** Every write is lost at
  scale-to-zero, on redeploy, and between containers — a `cron` run never sees
  what the web instance wrote. There is no field that changes this: `storage:`
  is retired (below) and `/data` is not special.
- **Durable state has exactly three homes**, none of them a path: the managed
  database (`db.mode: libsql`), the `files` SDK, and the `media` SDK. See
  `core/DECISION.md` → Recipe: local file I/O for which one, and
  `reference/RPO_CONTRACT.md` for what each promises.
- **A SQLite file on `/data` is never durable.** No `db.mode` persists a
  database file: the durable database is the injected libSQL connection
  (`db.mode: libsql`), not a path. See `core/DECISION.md` → Data & Persistence.
- Neither SDK exposes an external interface for listing, downloading, replacing,
  or deleting a running app's files. Implement user downloads as an
  authenticated app endpoint.

### Port

- The app must listen on the port specified by the `PORT` environment variable.
- Must bind to `0.0.0.0` — binding to `127.0.0.1` or `localhost` will not receive requests.
- HTTPS termination is handled by Keelson. The app should listen on HTTP.

### Process Model

- The `command` starts a single process
- systemd and daemon management are not available
- For scheduled processing, use `crons` and follow the **Background Work** rules
  below. Event-driven background tasks are not currently supported.

### Dependencies (package managers)

Pure language packages installed via these package managers work fine:

- **Python:** pip (`requirements.txt`, or `pyproject.toml` with `[project]` / `[build-system]`)
- **Node.js:** npm (`package-lock.json` or `package.json`)
- **Go:** go mod (`go.mod`)

Dependencies are installed at image build time. The platform detects manifest files in the project root and runs the appropriate install/build step before the runtime image is finalized — do NOT include `pip install` / `npm install` / `go build` in `command`.

| Runtime | Detected file | Auto-run at build time |
|---|---|---|
| `python-slim` / `python-media` | `requirements.txt` | `python -m pip install --user -r requirements.txt` |
| `python-slim` / `python-media` | `pyproject.toml` (with `[project]` or `[build-system]`), **only when `requirements.txt` is absent** | `python -m pip install --user .` |
| `node-slim` / `node-media` | `package-lock.json` or `package.json` | `npm ci` (with lockfile) or `npm install`, then `npm run build --if-present` |
| `go-slim` / `go-media` | `go.mod` / `go.sum` | `go mod download`, then `go build -o /workspace/app .` (the produced binary is started via `command: "./app"`) |

The `command` field should only start the app:

```yaml
# contract:skip — illustrative snippets (one command: per runtime), not a full keelson.yaml
# Python
command: "python app.py"

# Node.js
command: "npm start"

# Go (binary built at /workspace/app)
command: "./app"
```

### Build Constraints

The build runs in a restricted, offline-registry environment. The following are
**not** supported and must be resolved before deploying:

- **Node lockfiles other than npm.** Only `package-lock.json` is honored.
  A repository whose only lockfile is `pnpm-lock.yaml` or `yarn.lock` is stopped
  by `keelson deploy --check` (`lockfile_unsupported`, an error); add
  `package-lock.json` first (see the npm lockfile recipe in `stacks/node.md`).
- **Private package registries / authenticated installs.** Dependencies must
  resolve from the public registry. Packages from private npm/PyPI registries,
  git+ssh dependencies, or anything needing an auth token at install time will
  fail. Vendor the code or publish to a public registry instead.
- **Go with `CGO_ENABLED=1`.** Go builds run with `CGO_ENABLED=0`.
  `github.com/mattn/go-sqlite3` still compiles and registers its driver, but is
  a runtime stub whose first real query fails; the deploy lint rejects it early.
  Pure-Go file drivers such as `modernc.org/sqlite`, `glebarez/*`, and
  `ncruces/go-sqlite3` run successfully but lose local data at scale-to-zero,
  so they are also rejected. Use the pure-Go libSQL client from the
  SQLite→libSQL recipe in `stacks/go.md` instead.
- **Non-amd64 targets.** Builds target `linux/amd64` only. Do not pin an image
  or dependency to `arm64`.
- **No build-time secrets.** There is no way to inject a secret into the build
  step. Anything needed only at build time must come from public sources.

### Native Dependencies

- **Works on `-media` runtime:** Pillow, opencv-python, sharp, ffmpeg-related packages.
- **May not work:** Packages depending on system libraries not included in the runtime.
- `apt-get` and similar package managers are not available (non-root).

### Unsupported Patterns

| Pattern | Reason |
|---|---|
| Requires `apt-get install` | Non-root, cannot add packages |
| Depends on uncommon C libraries | May not be in the runtime |
| GPU-based inference libraries | No GPU instances |
| Database servers (PostgreSQL, MySQL, Redis) | Cannot run on Keelson (connect to external services instead) |
| systemd / background daemons | Different process model |

### Configuration Constraints

Hard limits enforced by the `keelson.yaml` parser. Violating any of these makes
the config invalid.

#### `slug`

- Pattern `[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?` — lowercase alphanumeric and
  hyphens, 1–63 characters, cannot start/end with a hyphen.
- Cannot contain `--` (double hyphen).
- Reserved slugs (rejected): `api`, `console`, `www`, `admin`, `auth`,
  `static`, `assets`, `health`.

#### `type`

- The only accepted value is `web` (or omit `type` entirely).
- Omit it only when command or crons is present.
- Omit `type` when the app has both a web surface and scheduled work; `command`
  and `crons` may then be declared together.
- `type: web` is for a web-only app and does **not** allow `crons`; declaring
  both is rejected.

#### `crons`

- The number of cron entries per app is **plan-bound**: Starter 3 / Plus 5 / Team 10.
  More than the plan allows is rejected at deploy (`plan_cron_limit`).
- `schedule` must be a **5-field** cron expression.
- Each `schedule` is evaluated in the workspace's IANA timezone, which is set from
  the owner's browser when the workspace is created (server fallback: UTC);
  daylight-saving transitions follow that zone.
- The timezone can only be set when the workspace is created and cannot currently be
  changed later. For a deployed cron, check the effective value in the `timezone`
  field from `keelson crons list --json`; add `--include-disabled` to include a
  disabled cron. Do not assume UTC or the user's local zone — read that field.
- `timeout` is 1–600 seconds; the ceiling per run is **plan-bound**: Starter 180 s /
  Plus 300 s / Team 600 s. Omitting `timeout` gives 300 s or the plan ceiling,
  whichever is shorter; a value above the plan ceiling is rejected at deploy
  (`plan_schedule_timeout`).
- `enabled` (default `true`): `enabled: false` keeps the entry but stops scheduling it.
  For a jobs-only app this is the way to pause it (it has no Suspend in the console).
- `name` follows the slug pattern and must be unique.
- A cron run executes in a **separate container** from the web instance, so its
  durable state must be in the managed database (`db.mode: libsql`) — see
  Background Work.

```yaml
# cron-only app (no HTTP surface)
slug: cron-logger
runtime: python-slim
db:
  mode: libsql
crons:
  - name: hourly
    schedule: "0 * * * *"
    command: "python job.py"
    timeout: 300
```

#### `databases` (retired — never write one)

`databases:` declared the on-disk SQLite files for the withdrawn file-replication
mode. **That mode no longer exists, and any `databases:` key — even an empty one —
now fails the deploy at parse (`DB_DATABASES_REMOVED`).** Never add one. If an existing `keelson.yaml` has a `databases`
block, delete it and move the app to `db.mode: libsql` (`core/DECISION.md` →
Data & Persistence).

#### `storage` (retired — never write one)

`storage:` declared app-relative directories to be linked into a persistent
`/data` zone. **That zone no longer exists, so the block buys nothing: a declared
directory is discarded exactly like any other local path.** Never add one. If an
existing `keelson.yaml` has a `storage` block, delete it and route the app's
files through the `files` / `media` SDK (`core/DECISION.md` → Recipe: local
file I/O).

The parser accepts only the deprecated `storage.disk_id` key (ignored); any
other key under `storage:` (`files`, `dirs`, …) is rejected as an unknown field
and fails the deploy. Remove the block rather than leaving it in place as
documentation of an intent the platform will not honour.

#### `assets` (static / SPA / hybrid)

- `assets.fallback` is **required** for hybrid deploys (`command` + `assets`) when `type: web` is explicit; optional when `type` is omitted.
- `assets.api` is only allowed when `command` is set.
- `assets.dir` cannot contain `..`.

Unknown / misspelled top-level keys are **rejected by the CLI parser before
upload** and by the API on upload — see the Pre-Deploy Checklist note in
`core/DECISION.md`.

---

## Health Check (`health.path`)

For a web app whose `/` route is expensive, depends on a database, or is not a
useful liveness signal, declare an optional lightweight endpoint for Keelson's
deploy-time synthetic health check:

```yaml
slug: my-app
runtime: python-slim
command: "python app.py"
db:
  mode: libsql
health:
  path: /health
```

The `health` block is optional and may contain only `path`. If `health`,
`health.path`, or its value is omitted, Keelson probes `/` as before. The path:

- must be a non-empty string beginning with `/`;
- must not contain `..` as a path element;
- must not begin with the reserved `/__keelson` prefix; and
- may contain at most 2048 characters.

The platform sends a GET directly to the candidate revision's own Cloud Run URL,
not through the public host or its authentication path. The deploy gate accepts
HTTP 2xx, 3xx, or 404; other 4xx and all 5xx responses fail the deploy. Because
404 passes, the gate can succeed even when the declared route is not implemented;
success proves that the candidate started, not that the path works.
`health.path` affects only this synthetic health check. Public-path verification
remains configured separately with `verify`.

---

## Background Work

How and when app code is allowed to run is a hard contract. Generate apps that
respect it — background work that ignores it fails silently (the code looks fine,
the work just never happens).

### Execution guarantee (the contract)

**Code is guaranteed to run only in two windows:**

1. **while a request is being handled**, and
2. **during a platform-initiated execution** — a `cron` run.

Anything outside those two windows — a warm instance's idle tail after the last
request, a background thread you spawned, an in-process timer — is **not
guaranteed** to run and **must be treated as not running**. Idle apps scale to
zero, so you cannot depend on any process staying alive between a request and
the next request or tick.

**Work scheduled to run *after* the response returns is not guaranteed and must
be treated as not running** — a spawned thread, a deferred task, or an
in-process timer looks fine in the code and then simply never does its job
(the app scales to zero between requests; you cannot count on any tail after
you respond). **This is unconditional — no `keelson.yaml` setting turns it into
a guarantee**: no persistence flag, no storage declaration, no `db.mode` value
makes the app an always-on instance that finishes post-response work. Do not
architect around a task completing "later". Scheduled work belongs in a `cron`;
event-driven background tasks are not currently supported.

### First rule: finish inside the request

**Post-processing that completes within the request must be done synchronously,
inside the request handler, before the response is returned.** Do not defer it to
a background thread / task that runs "after" the response — that work is **not
guaranteed** to run and must be treated as not running. If the work is too slow
to finish before responding, redesign the request or use an external task
service; Keelson does not currently provide event-driven background tasks.

### Generation rules for scheduled work

When an app needs scheduled work, follow all three:

1. **Make each cron command idempotent and bounded.** A run may be interrupted
   or delivered more than once, so repeated execution must be safe and the
   command must finish within its configured timeout.

2. **No in-process schedulers.** Do not embed APScheduler, `node-cron`,
   FastAPI `BackgroundTasks`, `setInterval`, `threading.Timer`, or any "run this
   later / on a loop" mechanism inside the app process. They rely on a resident
   process that does not exist here. Declare a `crons` entry for scheduled work.
   Event-driven background tasks are not currently supported.

3. **Background executions may only touch the database and the `files` /
   `media` SDK.** A `cron` run executes in a **separate container** from the web
   instance — it does not share the web instance's
   disk. Its durable state must live in the managed database
   (`db.mode: libsql`), the `files` SDK, or the `media` SDK
   (`core/DECISION.md` → Recipe: local file I/O). **Files written to any local
   path — including `/data` — during a background execution are discarded** and
   are never visible to the web instance.

   This is the failure that looks like it works: a cron job that writes
   `seen_urls.json` next to its script re-reads it successfully **within the same
   run**, then starts from empty on the next tick, and the web instance never
   sees the file at all. `files.write("seen_urls.json", ...)` is the fix, and it
   is a one-line swap.

   The per-app libSQL database is provisioned automatically. The agent that
   writes the app must also create the queue/cursor/history table in code; this
   requires no setup from the user. A local file is never the easier user path.

## Database (`db.mode`)

Set the `db` block in `keelson.yaml` to select how the app's SQLite database is managed:

```yaml
db:
  mode: libsql   # required: libsql | none
```

| `db.mode` | Meaning | When to use |
|---|---|---|
| `libsql` | **Keelson Managed SQLite** (recommended). A per-app managed libSQL DB is provisioned automatically and isolated per workspace/app. Connection is injected via `KEELSON_DB_URL` / `KEELSON_DB_AUTH_TOKEN` (plus `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` aliases for compatibility). Scales to zero. | New apps that use a libSQL client (JS/TS, Python, Go). **The only durable database.** |
| `none` | Keelson does not manage a durable database. | Stateless apps, external DB clients, or declared ephemeral SQLite. |

`db` and `db.mode` are required in every new config. For cache-only SQLite, use
`db.mode: none` with `db.local_sqlite.policy: ephemeral`, a non-empty reason,
and paths restricted to `/tmp/**` or `:memory:`; `/workspace` and `/data` are
rejected.

Routing guidance (normative):

- **`libsql` is the only durable database.** No mode persists a SQLite file on
  disk. When you find an app that writes one for data that matters, it moves to
  a libSQL client or it does not deploy — `core/DECISION.md` → Adaptation
  Decision Function decides which, and whether you may do it without asking.
- **New apps: author against libSQL from the first line** (see the Decision
  Tree). Do not write file-SQLite code and migrate it afterwards.
- External database connections are allowed; use `none` (or your own client)
  for those. This is also the only route for a stack with no libSQL client
  (e.g. Django): point it at an external database and supply the credentials
  through `secrets`. Outbound SMTP on ports 25, 465, 587, and 2525 is blocked;
  send mail through a mail provider's HTTPS API.

**Prohibited:** Do not mutate a running app's SQLite database, WAL, or journal
files out of band through local file writes. Change data through the app itself
or the managed libSQL connection.

### `db.migrate` — run a migration before traffic moves

```yaml
db:
  mode: libsql              # required: migrate is only valid on a managed DB
  migrate: python migrate.py
```

The command runs as a one-off Cloud Run Job on **the image being deployed**,
after the candidate revision has already started and passed its deploy-time
health and public-path checks, but **before any traffic moves to it**. Therefore,
the app's startup code runs against the pre-migration schema and must not require
new columns or tables to exist yet. The credentials are injected exactly as they
are for the app (`KEELSON_DB_URL` / `KEELSON_DB_AUTH_TOKEN`), so the migration
script connects the same way the app does — see `reference/LIBSQL_CLIENTS.md`
for the client per language.

**The gate is fail-closed.** A non-zero exit fails the deploy with
`deploy.runtime.migration_failed` and **traffic stays on the previous
revision**. Unmigrated code is never promoted. Measured on staging 2026-08-09:
a migration that referenced a missing table exited 1, the deploy failed with
that code, and the old revision kept 100% of traffic.

**Write it idempotently — it runs on every deploy.** There is no "already
applied" bookkeeping around it: Keelson runs the command each time and only
looks at the exit code. Make re-running a no-op.

```python
# migrate.py — safe to run on every deploy
import os, libsql

conn = libsql.connect(
    os.environ["KEELSON_DB_URL"],
    auth_token=os.environ.get("KEELSON_DB_AUTH_TOKEN", ""),
)
conn.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations ("
    "  name TEXT PRIMARY KEY,"
    "  applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
)
conn.execute("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)")
# ON CONFLICT DO NOTHING, not try/except: the client raises a bare ValueError on
# a UNIQUE violation, so idempotency has to be expressed in SQL.
conn.execute(
    "INSERT INTO schema_migrations (name) VALUES (?) ON CONFLICT DO NOTHING",
    ("001_init",),
)
conn.commit()
```

**When to use it, and when not:**

- **Use `db.migrate`** when the schema must converge on every deploy and the app
  should not carry that logic at startup.
- **Use startup DDL instead** for a small self-contained schema — one less
  moving part, and no separate Job.
- **Use `keelson db apply`** (`reference/DB_APPLY.md`) for a one-off correction
  or an initial schema an operator sends by hand. That is an operator path, not
  a deployment step, and every use after the first needs a human approval.

An ORM migration runner must use a supported remote driver; a file URL only
changes the Job's ephemeral disk. For Python SQLAlchemy, exact-pin
`sqlalchemy-libsql-native==0.1.0` and configure Alembic with
`sqlite+libsql_native://...` plus the injected auth token. Other ORM runners
remain unsupported unless `reference/SUPPORT_LEDGER.md` records a remote route.

## Authentication

Every request to a Keelson app passes through the platform authentication gate
before it reaches the app. Unauthenticated requests are rejected at the edge
(HTTP 401) and never reach the app process. Because of this:

- **The app does not implement its own login, session, or auth layer.** Do not
  add one, and do not refuse to deploy an app just because it has no
  authentication of its own (see the X-Keelson-User-Id recipe in
  `core/DECISION.md`).
- **The authenticated user's identity arrives as the `X-Keelson-User-Id`
  request header** (with `X-Keelson-User-Email` and `X-Keelson-User-Name`
  alongside it; client-supplied copies of these are stripped and replaced).
  Read that header to attribute a request to a user; there is no token for the
  app to verify itself.

The identity header is injected by the platform edge, not by the app. The app
never mints, verifies, or refreshes a session — it trusts `X-Keelson-User-Id`
as already-authenticated.

### `verify` (optional verification paths)

`verify` is a top-level key, not part of the authentication block. For example,
this single-path form verifies `/dashboard`:

```yaml
slug: my-app
runtime: python-slim
command: "python app.py"
db:
  mode: none
verify: /dashboard
```

`verify: [/path, …]` names entry documents whose same-origin script, stylesheet,
and module-preload references must resolve with matching content-types. Use it
when an entry document is not reachable from the default page, such as a
client-rendered route reached only after navigation. Declare at most 20 paths.
Each path must begin with `/` and must not contain `..`; for one path, either a
single string as above or a one-item list is accepted.

For every supported deploy mode, a declared path must resolve or return 2xx or 3xx.
A final 404, 401, 403, 405, or any other response outside those ranges fails
with `verification.error_code` set to
`verification_declared_path_unreachable`. Put only paths that do not require the
app's own user login in `verify`: candidate verification carries no app user
identity, so an app-level 401 or 403 fails the deploy. The default `/` remains
tolerant even when it is explicitly listed in `verify`; an API-only app may
legitimately return 404 there.

This is intentionally different from `health.path`. The health probe targets
the candidate's internal URL and accepts 404 as evidence that the process
started; a declared `verify` path checks actual public-path availability, so 404
does not pass.

For a server-process deploy, Keelson fetches these paths through the public host
and attaches platform-issued, single-use proof for the candidate revision. This
does not require the user's interactive login or any credential setup in the
app. The verification method otherwise depends on the deploy mode (see
`reference/VERIFICATION.md`):

- For a Cloud Run server-process deploy (`container` or `hybrid`), the
  platform probes the candidate revision through the real public host →
  Cloudflare edge → origin path. It always probes `/` first, then appends
  declared paths in declaration order with duplicates removed.
- For `edge-static` and `edge-spa`, the platform checks the release manifest
  before publication instead of making network requests. It always checks `/`
  **plus** every declared path. If a declared path cannot resolve to either a
  release file or the configured `assets.fallback`, the deploy fails with
  `verification.error_code` set to
  `verification_declared_path_unreachable`. Thus an `edge-spa` client route may
  resolve through its fallback even without a same-named physical file. An
  unresolved `/` alone remains valid for a static release used only as a file
  store.

The archived experimental `cf-container` mode does not run candidate
public-path verification and is outside this contract.

`verify` is optional. Omitting it still checks the default `/` entry document.

#### Machine / webhook endpoints (`auth.endpoints`)

The interactive gate rejects any request without a logged-in user session, which
also blocks server-to-server callers that have no browser session — payment
webhooks, cron pings from a third party, an external API client. Two prefixes
are reserved for such callers, and they work differently:

- **`/api/webhooks/…`** — the edge routes the whole subtree to webhook
  authentication by prefix alone. The sender presents an app token with scope
  `webhook` (`X-Webhook-Secret` header, or `/api/webhooks/<secret>/…` in the URL
  for senders that cannot set headers). **No `auth.endpoints` entry is needed**;
  an entry for a `/api/webhooks/` path is accepted but has no runtime effect, and
  `methods` is not enforced there — check the method in the handler.
- **`/api/external/…`** — machine API. The caller presents an app token with
  scope `api` as a bearer token, **and** the path must match a declared
  `auth.endpoints` prefix (`methods` is enforced here). Undeclared paths under
  this prefix are denied.

In both cases the call is authenticated by the app token, not by a browser
session, and a request carrying only the sender's own signature is rejected (401).

- Each entry is a path string, or an object with `path` and an optional
  `methods` list (restrict to specific verbs; omit to allow all). Paths match by
  **prefix** (`/api/external/status` also matches `/api/external/status-old`).
- Tokens are issued with `keelson apps tokens create --app <slug> --name <name>
  --scope webhook|api`.
- Paths must begin with `/api/external/` or `/api/webhooks/` — no other prefix
  is accepted, and the reserved `/__keelson` prefix is rejected.
- Requests to these paths carry `X-Keelson-User-Id` as an **empty string** (the
  gateway always sets the identity headers, empty when there is no interactive
  user). Do not branch on the header's presence; treat an empty value as "no
  user", and do not rely on it on an `auth.endpoints` route.
- The two exact paths `/api/webhooks/email` and `/api/webhooks/email-events`
  are platform-reserved and rejected at the edge; do not declare or use them.

```yaml
# Expose machine/webhook routes that skip the interactive auth gate
auth:
  endpoints:
    - /api/webhooks/stripe          # any HTTP method
    - path: /api/external/status    # restrict to specific methods
      methods: [GET]
db:
  mode: none
```

Only declare an endpoint here when an external system must reach it directly.
Everything else stays behind the interactive gate by default.

### Environment Variables and Secrets

- `keelson.yaml` `env` — Values safe to commit to version control.
- Console / CLI secrets — API keys, tokens, and sensitive values.

#### Auto-set Environment Variables

The platform injects these into every app container. Do **not** declare them in
`env`: any `KEELSON_*` name in `env` or `secrets` is rejected at parse
(`invalid_keelson_config`), and `PORT` is silently dropped if you set it — see
Required File.

| Variable | Description |
|---|---|
| `PORT` | The port the app must listen on. Read it; do not set it |
| `TZ` | Timezone (workspace setting, e.g. `Asia/Tokyo`) |
| `KEELSON_MODE` | Platform mode marker (`keelson`) |
| `KEELSON_APP_ID` | App internal ID |
| `KEELSON_WORKSPACE_ID` | Workspace internal ID |
| `KEELSON_TENANT_ID` | Compatibility alias for `KEELSON_WORKSPACE_ID` (same value) |
| `KEELSON_DEPLOY_ID` | Current deploy internal ID |

The former tenant-named variable remains a compatibility alias. No removal date
is set.

When `db.mode: libsql`, the platform additionally injects `KEELSON_DB_URL` and
`KEELSON_DB_AUTH_TOKEN` (read them in the SQLite→libSQL recipe), plus the
compatibility aliases `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` with the same
values. These are not listed above because they are conditional on the DB mode,
not injected into every container.

`KEELSON_APP_URL` — the app's **own public origin**
(`https://<workspace>--<app>.<domain>`) — is injected the same conditional way,
whenever the app's host is resolvable (which includes the first deploy; it is
derived from the workspace and app slugs, not from a published route). It is
reserved: declaring it in `env` or `secrets` is rejected at parse.

The domain varies with the connected environment. Do not predict the URL: read
`url` from the deploy output, or use `KEELSON_APP_URL` from inside the app.

Reach for it whenever the app needs to know its own public address, because it
**cannot work that out from the request**: the gateway strips the inbound `Host`
and `X-Forwarded-Host` before forwarding, so `request.get_host()` /
`req.headers.host` return the *internal* service host, not your `keelson.run`
URL. Absolute links (password-reset emails, redirects, `og:` tags) and Django's
`CSRF_TRUSTED_ORIGINS` must come from `KEELSON_APP_URL`. A custom domain is the
exception: `KEELSON_APP_URL` always holds the platform host.

Note it is **not** set locally, which is the intended signal — see
`core/DECISION.md` → Local Development Parity. For "am I running on Keelson?",
use `KEELSON_MODE` (always injected) rather than this.

#### Declaring Required Secrets (`secrets`)

Use the `secrets` block to declare which secret values the app needs. This is
how an agent tells the user "this app needs `OPENAI_API_KEY`" up front. Declaring
a secret does **not** set its value — the value is supplied out of band by the
user through a local env file, the Console, or `keelson secrets`.

```yaml
secrets:
  items:
    - name: OPENAI_API_KEY
      description: "OpenAI API key"
    - name: ANTHROPIC_API_KEY
      description: "Anthropic API key"
  required:
    # exactly one of any_of / all_of per rule
    - any_of: [OPENAI_API_KEY, ANTHROPIC_API_KEY]
      message: "Set at least one AI provider key."
    # - all_of: [DB_USER, DB_PASSWORD]
    #   message: "Both database credentials are required."
db:
  mode: none
```

- `items[]` — the secrets the app reads. Each `name` is required; `description`
  is shown to the user.
- `required[]` — validation rules. Each rule has **exactly one** of `any_of`
  (at least one must be set) or `all_of` (all must be set), plus an optional
  `message`. Every key referenced must be defined in `items`.

Operational flow:

1. The agent declares `secrets` in `keelson.yaml`.
2. For a new app, the agent asks the user for a local env file containing the
   values, then runs
   `keelson deploy --new --secrets-from-env-file <path>`. This creates the app,
   sets its secrets, and deploys it once. The specified env file is excluded
   from the upload artifact.
3. For an existing app, use
   `keelson deploy --secrets-from-env-file <path>` to set the values and deploy
   in one command. Alternatively, set them through `keelson secrets` or the
   Console and redeploy so they are injected.

Secret values are injected at deploy time only — a value set after a deploy is
not live until the next deploy.

### Timeouts

| Target | Limit |
|---|---|
| HTTP requests | 120 seconds to start responding (first response header); exceeded → **504 Gateway Timeout** |
| Response streaming | not cut at 120s once started; bounded by ≤ 120s idle gap between chunks and ≤ 300s total request lifetime |
| Cron jobs | 1–600 seconds per run (`timeout` field); the ceiling is plan-bound — Starter 180 s / Plus 300 s / Team 600 s. Omitted → 300 s or the plan ceiling, whichever is shorter |
| Builds | 600 seconds (10 minutes) |

Notes for sync HTTP handlers:

- Sync handlers must start responding within **120 seconds**. Design for
  **≤ 15 seconds** for good UX.
- A **504 does NOT mean rollback** — the handler may have completed after the
  deadline. The platform never auto-retries POST. Make writes that a client may
  retry **idempotent**.
- Work that cannot start responding within 120 seconds: split it into smaller
  client-driven chunks, or move it to `crons` (per-run cap 600s).
- Streaming (SSE etc.): send response headers early; once the stream has
  started it is bounded only by the **120s idle-gap** between chunks and the
  **300s total request** lifetime.

---

## Access Control

Every authenticated workspace member who has **view** permission on an app can
reach it; the platform gate enforces that before the request arrives. Use access
control to narrow *who* gets in and to separate *viewers* from *managers*. There
are two layers — pick the coarsest one that satisfies the requirement.

### Layer 1 — coarse: permission bindings + `X-Keelson-User-App-Perms` (no group key in code)

Grant a workspace group **view** or **manage** on the app, then branch on the
perms header the platform injects. This covers "only this group can open the app"
and "only managers see the admin screen" **without the app ever knowing a group
key** — it is exactly what the shipped templates do.

- The platform injects **`X-Keelson-User-App-Perms`** on every interactive
  request. Its value is `view` or `view,manage` (comma-separated, lowercased). A
  user with manage always also has view. Group → permission is resolved on the
  server; no group id/key/name is ever put on a header.
- The app reads the header and checks for `manage`; it never parses group names.

```ts
const perms = (req.headers["x-keelson-user-app-perms"] ?? "").split(",");
const canManage = perms.includes("manage");
if (needsAdmin && !canManage) return res.status(403).end();
```

Bind groups from the Console (Members → group → app access) or the CLI:

```bash
keelson access show --app my-app                     # current view/manage bindings + authz_version
keelson access set  --app my-app --manage admins     # only the `admins` system group manages
keelson access set  --app my-app --view sales --view support   # restrict who can view
keelson access set  --app my-app --view none         # clear the view set (explicit `none`)
```

`access set` reads the current bindings first and sends the observed
`authz_version` for optimistic concurrency (a stale write is rejected). Omitting
`--view` / `--manage` leaves that set unchanged; `--view none` empties the view
set. At least one manage binding must always remain: `--manage none` is rejected
even with `--allow-self-lockout`. Management also cannot be assigned only to
groups with no active workspace members. Removing your own manage permission
while leaving another manage group with an active member is refused unless you
pass `--allow-self-lockout`.

### Layer 2 — fine: `attributes.groups` (group keys in code)

When you need three or more tiers, or per-group logic the perms header cannot
express, read the caller's group membership. The full identity — including a
`groups` list — is available through the Directory / identity API (SDK
`getCurrentIdentity` / `get_current_identity` / `GetCurrentIdentity`).
`identity.attributes.groups` is a list of **group keys**.

Prerequisite: the app must be allowed to read the Directory API. Run
`keelson apps directory enable --app <slug>` once, then redeploy; the app then
receives `KEELSON_DIRECTORY_TOKEN`, which the SDK reads. Without it the SDK
raises an identity error. Pass the request headers to the call (the SDK
reads the user from `X-Keelson-User-*`).

Shape of `attributes.groups`:

- **Keys only** — never ids or display names.
- Contains the **system groups the caller holds by role** — a subset of
  `owners` / `admins` / `developers` / `everyone`, not all four. An OWNER gets
  `owners`, `developers`, `everyone`; an ADMIN gets `admins`, `developers`,
  `everyone`; a BUILDER gets `developers`, `everyone`; an app user gets only
  `everyone`. These are exposed regardless of app binding — but do **not**
  assume a system group the caller does not hold (e.g. an app user never
  carries `admins`).
- **Plus** any custom group that is **bound to this app** (via a view/manage
  permission binding or an app-role binding) and that the user belongs to. A
  custom group that exists in the workspace but is **not bound to this app never
  appears** — bind it to the app if you want to branch on it.
- Keys are stable and immutable, and may be non-ASCII: a group key can be
  Japanese (e.g. `経理`). Match on the exact key string.

```python
identity = identity_sdk.get_current_identity(headers=request.headers)  # from keelson import identity as identity_sdk
groups = set(identity.attributes.groups)   # e.g. {"everyone", "developers", "経理"}
if "経理" in groups:
    ...
```

### CLI reference and typical flow

```bash
keelson groups list [--json]                         # key / name / kind / members / usage
keelson groups create <key> [--name ...] [--description ...] [--if-not-exists]
keelson groups members list <key> [--json]
keelson groups members add <key> <email>...          # idempotent
keelson groups members remove <key> <email>...       # idempotent
keelson access show --app <app> [--json]
keelson access set  --app <app> [--view <key>...|--view none] [--manage <key>...] [--allow-self-lockout]
```

Typical end-to-end flow an agent runs:

1. `keelson groups list --json` — discover existing group keys, kinds, and member
   / usage counts. Copy the exact key rather than typing it from memory.
2. Create and populate a group if needed: `keelson groups create <key>
   [--if-not-exists]` (idempotent), then `keelson groups members add <key>
   <email>...`.
3. `keelson access set --app <app> --view <key>... --manage <key>...` — bind the
   group(s) to the app.
4. Generate app code against the chosen layer: the `X-Keelson-User-App-Perms`
   header for Layer 1, or `attributes.groups` keys for Layer 2.

Groups and access bindings are managed through the Console / CLI above — there is
**no `groups:` or `access:` block in `keelson.yaml`**; do not invent one.
