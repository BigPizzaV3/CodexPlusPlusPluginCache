# Reference: Deploy, Verify, Operate

How to run the deploy, confirm it actually succeeded, and debug a live app.

The **contract** this runbook is judged against — the definition of a successful
deploy (`SD-*`), the spec↔test traceability table, and the pre-deploy checklist —
stays in `core/DECISION.md`. Read that first; this file is the procedure.

---

## Deploy

```bash
# contract:skip — deploy command sequence
keelson deploy --new --ndjson --yes --timeout 60s --retry 3 [--workspace <id>]
```

For an existing app:

```bash
# contract:skip — deploy command sequence
keelson deploy --ndjson --yes
```

`--ndjson` implies watch mode, cannot be combined with `--no-watch`, and streams
one JSON object per line until a final result. `--json` is a separate mode that
returns immediately with the deploy ID; it cannot be combined with `--watch`.
`--timeout 60s` limits one request; `--watch-timeout` limits the whole wait.
They are separate limits. Leave `--watch-timeout` unset: its default already
outlasts the server's own build and rollout deadlines, and pinning a shorter
value reports `client_timeout` on a deploy that went on to succeed.

Before upload, `keelson deploy --check --json` returns the same archive walk in
`archive`. It has `files`, `excluded`, `excluded_env_files`,
`secret_like_files`, `embedded_credentials`, `unscanned_files`, and
`unscanned_binary_count`, with `excluded_truncated` and `ignore_warnings` when
applicable; only `bytes` is absent because the offline check does not write a
tar. Inspect this object even when top-level `ok` is false. An ordinary
`keelson deploy --json` final object also has `archive` and includes `bytes`.
Plain deploy output prints the archive summary and separate env/secret-like
warnings, while `--quiet` suppresses them.

## Verify completion

- **Read the stream as forward-compatible NDJSON.** Ignore keys you do not
  recognize; more may be added later. Records have these shapes (`?` means the
  key is optional):
  - Stage start — `{"stage", "status":"started", "timestamp"}`. It has no
    `duration_ms`.
  - Stage completion — `{"stage", "status":"completed", "timestamp",
    "duration_ms"}`.
  - Progress — `{"stage", "status":"progress", "timestamp", "elapsed_ms",
    "waiting_for"?, "message"?}`. For example,
    `{"stage":"health_check","status":"progress",…}`. These records can appear
    while any stage is running; `waiting_for` and `message` appear only when the
    server supplies a waiting reason. A progress record never has `result` and
    does not declare success or failure.
  - Scheduled retry — `{"stage":"retry", "status":"retry_scheduled",
    "timestamp", "failure_code"?, "retry_after_seconds"?}`. This is not a
    failure: the server is continuing the same deploy.
  - Secret application — `{"stage":"secrets", "status":"completed", "keys",
    "timestamp", "file_excluded"?}`. This appears only with
    `--secrets-from-env-file`.
  - Archive upload — `{"stage":"archive", "status":"completed", "files",
    "bytes", "excluded", "excluded_env_files", "timestamp",
    "embedded_credentials", "unscanned_files", "unscanned_binary_count",
    "excluded_truncated"?, "secret_like_files"?, "ignore_warnings"?}`.
    `files` counts regular files in the tar and `bytes` is the uploaded tar.gz
    size. `excluded` contains project-root-relative paths actually omitted by
    archive rules, sorted lexically and limited to 100 entries; an excluded
    directory has a trailing `/`, represents its whole unvisited subtree, and
    `excluded_truncated` reports the number beyond the limit.
    `excluded_env_files` is always present and contains every omitted path whose
    final element starts with `.env` or ends with `.env` (case-insensitive),
    without the 100-entry limit. `secret_like_files` lists included paths that
    need review because either their names look suspicious or they were used by
    an earlier `--secrets-from-env-file` deploy but were not selected for
    exclusion this time. The CLI remembers only those project-relative paths,
    never secret values, in the automatically excluded
    `.keelson-config/previous-secrets-files.json` file. `embedded_credentials`
    is sorted by path and contains only paths and credential kinds
    (`preview_read`, `preview_write`, `app_token`, or `webhook_signing`), never
    credential values. Any kind other than `webhook_signing` blocks upload; a
    `webhook_signing`-only match is a warning. `unscanned_files` lists included
    files over 16 MiB that content scanning skipped, while
    `unscanned_binary_count` counts included files treated as binary because a
    NUL byte appeared in their first 8 KiB. An empty list means no match or
    oversize skip; it does not mean excluded files or binary files were scanned.
    `ignore_warnings` reports invalid `.keelsonignore` patterns that were ignored.
  - Success — `{"result":"success", "deploy_id", "duration_ms", "url"?,
    "verification", "execution_findings"?}`. `verification` is the same object
    returned by status and is `null` when no verdict was recorded.
  - Failure — `{"result":"failed", "deploy_id", "failure_summary",
    "error_message", "suggested_command", "verification"}` plus, according to
    the failure,
    `failure_code`?, `failure_hint`?, `logs`?, `request_id`?, `start_command`?,
    or `execution_findings`?. If a newly created app fails, the record also has
    `created`, `app_id`, `app_slug`, and `resume_command`; use that recovery
    information and do not rerun with `--new`.
  The `verification` object's `method` distinguishes a public-path
  `edge-probe` from an offline static-release `assets-manifest` check. Its `url`
  is the URL verification actually targeted, **not** the app's canonical public
  URL; use the response's top-level `url` where one is provided for the latter.
  An `assets-manifest` result has `status: null` and
  `unauthenticated_status: null` because it records no HTTP exchange, while
  `checked_paths` lists `/` followed by the deduplicated declared `verify:`
  paths. `path_results` lists the paths actually reached before verification
  stopped, in the same order. Each item has `path`, final `url`, final `status`,
  response `content_type`, `declared`, and `ok`. Static `assets-manifest` items
  use an empty `url`, `status: null`, and an empty `content_type` because they do
  not perform an HTTP exchange. If an HTML entry's subresource check fails, that
  entry path has `ok: false` even when its release file itself resolved.
  For both Cloud Run server-process and static-release deploys, each declared
  path must be servable: a final response other than 2xx or 3xx (including 404,
  401, 403, and 405), or failure to resolve the path in a static release, fails
  with `verification_declared_path_unreachable`. The default `/` remains
  tolerant even when it is also declared, so an API-only app may return 404 at
  `/`. Put only paths that do not require the app's own user login in `verify:`;
  the candidate proof does not supply an app user identity, and an app-level 401
  or 403 therefore fails verification.
  `health.path` is separate from `verify`. It is probed on the candidate revision
  at its internal URL and never through the public host or the auth gate; unlike
  a declared `verify:` path, it accepts 404 as evidence that the process started.
  For a server-process deploy, `verify` is the public-path `edge-probe` described
  above.
- **Use only the final line and exit status to decide the outcome.** The final
  line is either a `result`
  record or, when failure occurs before watch starts, `{"error":{...}}` (the
  same structured error shape as `--json`). Exit status is zero only when the
  final record has `"result":"success"`.
- **`result: "success"` is stronger than deploy status `completed`.** It is
  emitted only after the traffic switch converges, so it confirms the new
  revision is serving. `completed` alone only means the candidate passed
  verification; traffic switches afterward. Once the route is published,
  an unauthenticated request to a completed deploy is rejected by the auth gate with
  `401`, including after a first deploy.
- **Not every `result: "failed"` means the app deploy failed.** Inspect
  `failure_summary` for these client/traffic outcomes:
  - `traffic_switch_discarded` — the revision was created but traffic did not
    switch. Use the redeploy command in `suggested_command`.
  - `client_timeout` — the CLI stopped waiting; follow the timeout recovery
    below.
  - `poll_failed` — repeated status requests from the CLI failed. The server
    may still be processing the deploy.
- **The watch limit defaults to 30 minutes** (`--watch-timeout`); the commands
  above leave it unset. A limit produces `failure_summary: "client_timeout"` but does not
  cancel server work. It can mean either the build was still running when the
  overall limit expired, or the deploy had reached `completed` but the separate
  60-second traffic convergence wait expired. `error_message` distinguishes
  those cases. Do not infer the server-side outcome from this record alone;
  check `keelson status <deploy_id>`.
- **On failure** — Run `keelson diagnose <deploy_id> --limit 200 --json`.
  The report combines the failure verdict, your build's log tail, stored app
  startup logs, current runtime logs, and common hints. Read the verdict in
  this order:
  - `failure_code` — a stable code (`deploy.config.invalid`,
    `deploy.build.failed`, `deploy.runtime.start_failed`, …). Branch on this,
    never on the wording of `failure_summary`.
  - `failure_summary` / `failure_hint` — the statement of what failed and the
    single next action.
  - `failure_logs` — the evidence for failures **you** can fix: the build log
    tail, the `keelson.yaml` parse error, the failing verification URL.
  - `startup_logs` — app stdout / stderr saved when the deployed revision
    failed to start or pass its health check. Read these startup logs first for
    a traceback, `Error:`, `panic:`, or exited-process message; unlike current
    runtime logs, they stay attached to this deploy.
  - `build_logs` — deploy progress lines addressed to you. The platform's own
    progress/audit lines are not included, so an empty `build_logs` is normal
    and is not a sign that anything is missing.
  For `deploy.artifact.assets_invalid`, read `failure_logs`, fix
  `assets.dir` / `assets.fallback` or the archive contents, then deploy again.
  This is a project-side artifact failure; do not report it as a platform
  failure.
  A `deploy.platform.*` code means the platform failed, not your app: nothing in
  your project will fix it and no detail is returned. Retry if
  `retryable: true`, otherwise stop and report the `deploy_id` — that is the key
  support correlates against the platform's own logs.
  The runtime section remains a current, app-wide view and can differ from the
  deploy-scoped `startup_logs` after another deploy or after log retention
  expires.
  There is no separate previous-instance log: output from a crashed previous
  instance is included in the normal log stream, so `--previous` is not
  supported. For a server-process edge-verification failure (`method:
  "edge-probe"`), `diagnose` **re-runs the probe on demand** against the deploy's
  candidate and returns a fresh `verification` object (`verification_source:
  "live"`) with the per-subresource table (`url`, `expected_kind`, `status`,
  `content_type`, `ok`); when the probe transport is unavailable it returns the
  verdict stored at deploy time (`verification_source: "cached"`). Static
  release verification (`method: "assets-manifest"`) is a pre-publication check
  of the release contents, so `diagnose` never replaces it with a network probe
  and always reports the stored verdict (`verification_source: "cached"`). If
  no verification verdict was stored for a deploy — for example, in an
  environment where edge verification does not run — `diagnose` returns no
  `verification` object (`verification_source: "unavailable"`). The absence of
  a result proves neither that the app is healthy nor that edge verification
  passed.
- **On HTTP 429** — If deploy creation returns `build_rate_limit_exceeded`, no
  deploy was queued. Surface `current_count`, `limit`,
  `active_apps_allowance`, and `reset_at`, then stop instead of retrying.

### Alternative: recover with status

Do not write a polling loop for a normal deploy; use `deploy --ndjson`. Use this
alternative only when you already obtained a deploy ID with `deploy --json`, or
when an NDJSON stream was interrupted. Progress records do not contain the
deploy ID, so after an interrupted stream first run
`keelson status --app <slug> --json` to find the latest deploy.

Poll `keelson status <deploy_id> --json` until `status` is one of `completed`,
`failed`, or `rolled_back`. If it is `completed`, do not assume the new revision
is live: require `traffic_converged` (`serving` means its revision is the active
serving revision; `traffic_converged` additionally means the edge switch has no
outstanding reconciliation).

## Verify the authenticated app response

After traffic converges, fetch a real app path through Keelson authentication:

```bash
# contract:skip — authenticated live-app verification
keelson app curl -i / [--app <slug>] [--confirmation <id>]

# contract:skip — authenticated subresource verification
keelson app curl -i /path/to/app.js [--app <slug>] [--confirmation <id>]

# contract:skip — authenticated write-path verification
keelson app curl /api/items --method POST --data '{"name":"probe"}' \
  --header 'Content-Type: application/json' [--app <slug>] [--confirmation <id>]

# contract:skip — authenticated multipart upload verification
keelson app curl --form title=probe --form photo=@sample.png \
  --form 'raw=@sample.bin;type=application/octet-stream' /upload \
  [--app <slug>] [--confirmation <id>]
```

`app curl` issues a short-lived preview credential in its internal credential
slot and sends an authenticated request. It does not replace or revoke a
credential that the user issued with `keelson preview`. For GET and HEAD, the
default `--retry 2` permits up to three app requests with the same credential,
but only when no HTTP response arrives or a marked platform error is retryable.
It does not retry an unmarked HTTP response or a write method. Use `--retry 0`
to send only one app request and disable credential-issuance retries as well.

Before each app-request retry, the CLI reports the attempt, reason, and delay on
stderr. It honors `Retry-After` when present; otherwise the default delays are 1
then 2 seconds. Waiting and requests after the first result share a 15-second
budget. Only the final response body and, with `-i`, final response headers are
printed.

`app curl` writes the response body to stdout and writes the method, URL, and
HTTP status to stderr. It never prints the credential and does not follow
redirects.
Add `-i` (or `--include`) to write the response protocol/status line and every
response header to stderr before the body is transferred. The body remains alone
on stdout, so it is safe to redirect it to a file while inspecting headers. The
usual `GET <URL> -> <status>` summary remains on stderr after the body transfer.
When the response has no `x-keelson-platform-error` header, the CLI observed an
app response: it writes the body and exits zero even when the app returned 4xx or
5xx. Test every path and operation needed to support the claim you make rather
than treating one successful `/` response as proof of all routes or business
logic.

Use `-i` on the page and on each important script, stylesheet, image, or other
subresource. Check both the status and `Content-Type`; a 200 alone is not proof
that the requested resource was served. For example, a missing JavaScript file
that receives an SPA fallback may return `200` with `Content-Type: text/html`,
which is a failed verification rather than a working script. Header names are
printed in their conventional form (for example, `Content-Type`).

Authenticated GET and HEAD checks also work for Keelson's reserved media and
asset URLs. Copy the exact paths emitted by the app and verify them directly:

For media, use the URL returned by the SDK's `url()` method; do not construct
the path yourself. On Keelson, the platform injects
`KEELSON_MEDIA_URL_PREFIX=/__keelson/media/`. The `/media/` prefix shown as a
default in SDK documentation applies when the SDK runs outside Keelson, not to
a deployed Keelson app.

```bash
# contract:skip — authenticated reserved-path verification
keelson app curl -i /__keelson/media/<id> [--app <slug>] [--confirmation <id>]
keelson app curl -i /__keelson/assets/<version-hash>/<file> \
  [--app <slug>] [--confirmation <id>]
```

Require the expected media type and, when byte identity matters, redirect stdout
to a file and compare it with the source artifact. Reserved paths remain
read-only: POST, PUT, PATCH, and DELETE are rejected even when the preview
credential permits writes.

`GET /health` and `GET /_health` are gateway platform routes and do not reach
the app.
`/__keelson` and every path below it are platform routes for every HTTP method.
Therefore, the response from the default `keelson app curl /health` is the
platform health response, not evidence that the app's own health handler works.
HEAD and other methods are not reserved by the two GET-only routes and may
reach the app through the gateway; for example,
`--method POST` may execute app code and its side effects. The app hosting
platform intercepts the exact paths `/healthz`, `/varz`, `/statusz`, `/rpcz`,
`/threadz`, `/quitquitquit`, and `/abortabortabort` before they reach the app.
To verify an app-owned health handler, use a different path such as
`/api/healthz` and test that path instead.

Cloudflare Web Analytics automatically injects a beacon script served from
`static.cloudflareinsights.com` into delivered HTML. The browser therefore
contacts that external domain even when the script is absent from the app's
source or build artifact. Account for this platform-injected request when
checking the delivered HTML, network destinations, privacy claims, or a Content
Security Policy; do not attribute the injected tag to the app.

The default method is `GET`, which uses the existing read-only credential with a
30-minute lifetime. `--method` accepts `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, and
`DELETE` (case-insensitive). A write method explicitly requests a write-enabled
credential; it lasts 5 minutes. `app curl` does not accept `--ttl`. Use `--data`
only with a write method. A value beginning with `@` is read from that file before
credential issuance, while any other value is sent literally. Repeat `--header
'Name: value'` to add headers, including multiple values for the same name.

Use repeated `--form name=value` options to send multipart form fields, and use
`--form name=@path` to attach files. When `--form` is present and `--method` is
omitted, the method defaults to `POST`. The CLI sets the multipart `Content-Type`
with its boundary, so do not also pass a `Content-Type` with `--header`. A file's
type is inferred from its extension; append `;type=<media-type>` to override it,
for example `--form 'photo=@sample.bin;type=image/png'`.

An unreadable data or form file, unsupported method, or invalid method/body
combination fails locally before a new credential replaces the previous one.

When Keelson generates a refusal or cannot observe an upstream response, it
sets `x-keelson-platform-error` to a stable code. `app curl` then suppresses the
platform response body, prints a structured error after the HTTP status line,
and exits nonzero. Read `code`, `retryable`, `hint`, optional
`retry_after_seconds`, and optional `request_id`; branch on the code, never on
the message wording. The codes currently used by authenticated app checks are:

| Kind | Codes |
|---|---|
| Credential or authorization rejection | `authentication-required`, `authorization-denied`, `auth_required`, `auth_invalid`, `missing-auth`, `invalid-auth`, `invalid-app-preview`, `app-preview-expired`, `app-preview-revoked`, `forbidden-membership`, `forbidden-permission`, `authorization_temporarily_unavailable` |
| Platform routing or service refusal | `app-preview-verification-unavailable`, `route-not-found`, `route-configuration-invalid`, `invalid-host`, `invalid-host-map`, `files-worker-boundary`, `app-suspended`, `gateway-not-configured`, `gateway-auth-required`, `invalid-route-payload`, `invalid-gateway-request`, `invalid-platform-request`, `platform-route-not-found`, `platform-http-error`, `gateway-request-rejected`, `platform-unavailable`, `app-not-found`, `kv-read-failed`, `files-worker-no-binding`, `auth-secret-unconfigured`, `storage-config-missing`, `storage-selector-unknown`, `missing-assets-bucket`, `app-starting`, `origin-credential-rejected` |
| Project or account action required before forwarding | `route-disabled`, `method-not-allowed`, `asset-not-found`, `file-not-found`, `reserved_path_prefix_container`, `capacity-full`, `capacity-zero`, `app-start-failed`, `origin-path-intercepted` |
| No app response observed; app receipt is unknown | `platform-internal-error`, `origin-unreachable`, `origin-timeout`, `files-worker-unreachable`, `files-worker-timeout` |

For a platform-owned refusal, do not change app code: follow the hint and report
the code and request ID when instructed. A pre-forward refusal can still be
project-owned; for example, `asset-not-found` means the deployed output lacks
the requested asset. For an upstream-observation failure, inspect runtime and
deploy logs because the CLI cannot prove whether the app received the request.
Unknown platform codes are treated this same cautious way and are not
retryable. If `authorization_temporarily_unavailable` remains after several
attempts for more than one minute, stop and report it instead of changing the
app. `origin-credential-rejected` means the app hosting platform rejected
Keelson's credential before the request reached the app process; this is a
platform-side event, not an app response. Retry it only when `retryable: true`,
waiting for `retry_after_seconds` when present. If it persists, stop and report
the code and request ID instead of changing app code.

For preview credential failures, `app-preview-expired` means its lifetime ended;
issue a fresh credential. `app-preview-revoked` means a newer preview credential
or an administrator revoked it; issue a fresh credential and do not assume that
expiry caused the rejection. `invalid-app-preview` means the credential does not
match this app, environment, or a known credential; check that the complete
value and intended app were used, then issue a fresh credential if needed.

If no HTTP response headers arrive, the CLI cannot identify the stopping layer
and exits nonzero without a status line. The default app-response timeout is
130 seconds so the platform's own deadline response can arrive. An explicitly
shorter timeout may expire first; in that case follow the hint before drawing
conclusions about app health.

The path must start with one `/`, must not start with `//`, and must not contain
a scheme, host, or fragment. This keeps the credential on the selected Keelson
app. App selection follows the normal `--app` / `keelson.yaml` / single-app
rules.

Prefer `keelson app curl` for authenticated verification; it is the reliable
path. When a separate client, a custom lifetime, or multiple requests are
required, issue the credential directly:

```bash
# contract:skip — short-lived credential issuance
keelson preview [--app <slug>] [--ttl <duration>] [--confirmation <id>]

# contract:skip — short-lived write-enabled credential issuance
keelson preview --allow-writes [--app <slug>] [--ttl <duration>] [--confirmation <id>]
```

With `--json`, send `token` to `app_url` as `Authorization: Bearer <token>`.
The edge recognizes the credential by its prefix and translates it for internal
routing, so add no internal header of your own.

Requests from a separate client can be rejected before they reach Keelson based
on their `User-Agent`. In observed tests, Python's default
`Python-urllib/3.x` User-Agent received Cloudflare 403 `error code: 1010` before
the request reached Keelson. Do not treat that response as a preview credential
failure. Whether an arbitrary custom User-Agent passes the edge has not yet been
established; use `keelson app curl` when a reliable check is required.

Without `--allow-writes`, the credential allows GET and HEAD and rejects every
other method. Its lifetime defaults to 30 minutes; `--ttl` accepts a whole-second
duration from 1 to 30 minutes. `--allow-writes` explicitly permits POST, PUT,
PATCH, and DELETE as well as reads, changes the default to 5 minutes, and
restricts `--ttl` to 1 through 10 minutes. Plain output is the credential alone.
`--json` writes the credential, app URL, and expiry to stdout. Keelson does not
save the raw credential to disk, and it is returned only once; handle stdout as a
secret and do not put the value in logs or reports. Issuing either kind replaces
the user's previous `preview` credential for that app, even when it has not
expired. Each app therefore has at most one user-issued credential per user.
The command reports the replacement on stderr in interactive output, but not
with `--json` or `--quiet`. `app curl` uses a separate internal slot and does not
replace or revoke this user-issued credential.

If the current user did not create the active deploy, issuance returns a browser
confirmation URL. After approval, repeat the same command with
`--confirmation <id>`. The approval can be consumed only once.
If the app has no completed deploy, `preview` and `app curl` instead fail
immediately with `app_never_served` (exit 2): there is nothing to inspect, so no
browser confirmation is opened. Deploy the app, wait for that deploy to
succeed, and then run the command again.

An automatically created deploy has no creator recorded, so while such a deploy
is active, every user is asked for browser approval.

Write-enabled credentials work only on container routes that pass through the
authorization gateway. Static delivery and the cf-container path reject writes;
a write-enabled credential can still read a static page. A default credential is
read-only at the HTTP-method boundary, but this is not a rollback mechanism or a
proof that application code is side-effect free. Keelson cannot prevent side
effects implemented by the app in a GET handler. Do not use preview verification
on such a route.

## Wiring verification for `db.mode: libsql`

A non-500 from a data endpoint does **not** show the managed DB is wired — an
app still reading a local SQLite file under `/tmp` returns data just as happily,
right up until scale-to-zero discards it.

Keep two things apart, because only one of them is your problem:

- **Durability is the platform's guarantee.** Under `db.mode: libsql` the
  managed libSQL store keeps what it is given. You are not asked to prove that,
  and you cannot.
- **Wiring is the adaptation's responsibility** — that *this app's* data path
  actually connects to that store instead of to an ephemeral local file. This is
  the part an adaptation gets wrong, so this is the part to check.

### What is actually verified, and what is not

| Check | What it actually observes | Kind | Ships |
|---|---|---|---|
| **Static wiring lint** | Source text: the production branch prefers `KEELSON_DB_URL`; a local-dev branch exists; no residual path opens a local store; `db.mode` agrees with the connection target selected | Wiring (partial — **not** proof) | **Now** |
| **Local parity check** (required) | The app really starts with no Keelson env and a CRUD round-trip runs against the local path | Parity (**real execution**) | **Now** |
| **`db_env_injected` log** | The libSQL connection env reached the process | Partial evidence | **Now** |
| Production CRUD (write-enabled preview credential) | The deployed app's real write and read paths work end to end | Wiring (partial — **not** proof of the storage target) | **Now** |
| Managed-DB query | A canary row really exists in libSQL | Wiring | Separate RFC |
| Hard-kill RPO bench | Seconds lost on an abnormal exit | Platform guarantee | Separate |

The former warning that **nothing in the shipping set observes a real write** no
longer applies: a production CRUD round-trip observes a real write through the
deployed app. **The remaining gap is the real connection target.** The row could
still have landed in an ephemeral local store. The lint reads text and the log
line only shows that an env var arrived. Proving the target requires a managed-DB
query or a survival check across replacement, neither of which is part of this
procedure.

So: a clean result means *"nothing contradicts the declaration"*, **not**
*"persistence confirmed"*. Do not report to the user that their data is proven
safe — say what was checked.

### 1. Static — the wiring lint

`keelson deploy --check --json` runs this lint over the app source and reports
what it finds as warnings, with code `db_wiring_fail` or `db_wiring_unknown`
(checklist step 7 in `core/DECISION.md`). A clean tree emits nothing.

It confirms the URL the database client actually receives derives from
`KEELSON_DB_URL` **and prefers it**: the injected env must win, with any local
URL used only as the fallback. It also confirms no residual `sqlite3.connect` /
`better-sqlite3` / pure-Go file driver opens a local file, and that the
connection target matches the declared `db.mode`.

Note what the question is *not*: "does the app mention `KEELSON_DB_URL`?".
Code can log the env var on startup — even print a truthful `db_env_injected`,
satisfying check 2 below — and still hand its client a hardcoded
`file:local.db`. Only the URL that reaches the client answers the question.

**A `file:` fallback is correct in Python and Node — do not "fix" it.** The
recipes in `stacks/python.md` and `stacks/node.md` recommend
`os.environ.get("KEELSON_DB_URL", "file:local.db")` precisely so the app still
runs on the user's laptop without Keelson's env. Removing it breaks local
development, which `core/DECISION.md` → Local Development Parity forbids. What matters is
*precedence*, not the mere presence of a local path. **Go is the exception**:
`stacks/go.md` prohibits the `file:` fallback, because the pure-Go libSQL client
cannot open `file:` URLs and the fallback would relink a file-SQLite driver into
the deployed binary.

The lint enforces that fallback as well as tolerating it. In Python/Node a
connection URL that is **definitively** env-only (`os.environ["KEELSON_DB_URL"]`,
with no alternative) reports `no-local-dev-path` (`fail`): the wiring is right,
but the app can no longer start off Keelson, which is the parity norm in
`core/DECISION.md`. Fix it by **adding** the local default — never by weakening
the env read, which still wins on Keelson.

A fallback that is *visibly empty* — `os.environ.get("KEELSON_DB_URL", "")`,
`?? ""`, `?? undefined`, `or None` — is the same `fail`. It satisfies the shape
of the recipe and none of its purpose: with no env the client is handed nothing
and the app does not start. Adding a default only counts if the default is a real
local URL.

Where the env read has a fallback the lint *cannot resolve* to a local URL
(`?? config.localUrl`, `or settings.get("LOCAL_DB_URL")`), the answer is
`local-dev-path-opaque`
(`unknown`), not `fail`. The local branch is probably fine; nobody can tell from
the text. Confirm it with check 3 rather than restructuring working code.

Go is exempt from this rule alone: its local path is a real libSQL endpoint that
source text cannot show, so check 3 is the only thing that covers it there.

What counts as a defect depends on the declared mode: under `libsql` a local
SQLite open is the defect, while under `none` an intentional local cache is fine
once declared with `db.local_sqlite` (`core/DECISION.md`) — a declared path
silences its own connection and no other. The warning's `hint` carries the
remediation for the mode you actually declared.

The lint is **three-valued**:

| Verdict | Meaning | What to do |
|---|---|---|
| `pass` | Nothing statically contradicts `db.mode` | Proceed |
| `fail` | A check positively contradicts it (e.g. `libsql` declared, nothing reads `KEELSON_DB_URL`) | Warn the user loudly and re-apply the recipe |
| `unknown` | Wiring could not be determined statically (e.g. built through a config layer) | Say so; do not treat it as broken |

`unknown` is **not** a soft failure — it means "I could not tell". This is a
**warning, never a deploy block**: a false positive that stops a good deploy
costs more than the miss it would have prevented.

### 2. Runtime — the env var is present

Check `keelson logs app <slug> --json` for a **masked** env echo that the app
prints on startup. After importing `os`, use this exact line so the URL and token
themselves are never printed:

```python
print(f"db_env_injected={bool(os.environ.get('KEELSON_DB_URL'))}", flush=True)
```

Production servers such as Gunicorn may buffer standard output, leaving the log
empty unless this one-time check uses `flush=True`. Never print
`KEELSON_DB_AUTH_TOKEN`.

This shows the env var *arrived*. It does not show the app *used* it.

### 3. Local parity check — the app still runs without Keelson (required)

Start the app with **no** Keelson env (`KEELSON_DB_URL` and friends unset) and
exercise its main CRUD path. It must start and work.

**This is a required, named check** — checklist step 8 in `core/DECISION.md` —
not an optional smoke test. It is the only one in this table that runs the app,
and the only one that sees what the *user* sees: the norm is Local Development
Parity (`core/DECISION.md`), and the failure it catches is an adaptation that
leaves behind an app which only runs on Keelson. That failure is invisible to
every other check here, because on Keelson the app is fine.

Do not substitute the lint for it. The lint reads text and can only see whether a
local branch *exists*; this check sees whether it *works*. And do not skip it for
a stack with no `file:` mode — that is precisely where it bites. In Go, run the
app against the local libSQL endpoint (`sqld` / `turso dev`) you generated for
the user; if you have not run it, you have not verified it, and `stacks/go.md`
requires you to stop rather than hand over an unverified path.

---

## Common Failure Patterns

| Symptom | Cause | Fix |
|---|---|---|
| Build succeeds, crashes on start | Not listening on `0.0.0.0` | Set `host="0.0.0.0"` explicitly |
| Cannot connect to port | Port is hardcoded | Read from `PORT` env var |
| Module not found | Dependency manifest (`requirements.txt`, `package.json`, `go.mod`) missing or misnamed at project root | Place the correct manifest at the project root so the platform can auto-install at build time. Do not work around this by adding `pip install` / `npm install` to `command` |
| Native module build failure | Missing system libraries | Switch to `-media` runtime or review dependencies |
| Data gone after redeploy / scale-to-zero | Wrote a SQLite file or app files to the local disk, which is entirely ephemeral | Use `db.mode: libsql` for the database; route files through the `files` SDK (app-named files) or the `media` SDK (media served by ID). No path persists — `storage:` is retired and `/data` does not exist |
| A `cron` run cannot see a file the web instance wrote (or vice versa) | Separate containers, separate disks | Same fix: the `files` SDK for an app-named file, the database for structured data |
| Start command not found | Wrong entrypoint path | Check filename and path |

### Troubleshooting Steps

1. **Check build logs** — Did dependency installation succeed?
2. **Check runtime logs** — Any startup or runtime errors?
3. **Check `keelson.yaml`** — Are `runtime`, `command`, and `env` correct?

---

## Operate & Debug (Day 2)

Once an app is deployed and serving, use these commands to observe and debug it
at runtime. They accept `--app <slug>`, `--json`, and `--workspace <id>`.

### The app deployed but misbehaves

The deploy reached `completed`, but the running app errors or behaves wrong.
Work the tree top-down:

1. **Check runtime state** — `keelson app info --app <slug> --json` (app-scoped
   runtime + last deploy), or `keelson status --app <slug> --json` for the last
   deploy. Confirms the app is up and shows the runtime `state`.
   Static sites have no long-running process, so their status is `published`
   (配信中), not `sleeping`.
2. **Pull the diagnostics bundle** — `keelson diagnose --app <slug> --json`.
   One call returns the running-app bundle: runtime state **including the
   revision failure reason** (`revision_failed` / `revision_reason`), the
   persistence mode (`db_mode`), the most recent runtime `ERROR` logs, and
   recent cron failures. This is the app twin of the deploy-scoped
   `keelson diagnose <deploy_id>` — pass `--app <slug>` with no `deploy_id`.
3. **Read the error logs** — `keelson logs app <slug> --severity error --json`.
   Returns recent runtime stderr / stdout filtered to error level, as structured
   entries (`timestamp` / `severity` / `source` / `message`).
4. **Fix and redeploy** — apply the fix, then `keelson deploy`. A code fix is
   only live after a successful redeploy.

### Restarting an app

`keelson app restart` queues one redeploy of the last completed artifact for
every persistence mode. It does not stop and start the runtime ingress. The
redeploy creates a new revision while retaining the source deploy's version,
and adds exactly one entry to deploy history, marked as a restart. It normally
reuses a registry image without rebuilding; an older artifact without a
registry image reference requires a full build and uses one build-rate-limit
slot. Any configured pre-deploy migration runs again. Other redeploy operations,
including applying secret changes, still create a new version.

Restart waits for that deploy to reach a terminal status by default, including
with `--json`, and reports failure or timeout with a non-zero exit code. Retain
the returned `deploy_id` when diagnosing the result. Use `--no-watch` only when
acceptance is enough: exit 0 then does not mean the restarted revision is
serving. Restart refuses an app whose runtime state prevents publication; for a
manually stopped app, run `keelson app start` before retrying the restart.

### A cron job failed

1. **List crons** — `keelson crons list --app <slug> --json` shows each cron and
   its state.
2. **Get the failures** — `keelson diagnose --app <slug> --json` bundles recent
   cron failures (cron name, `exit_code`, failure message) under
   `cron_failures`. Crons are the only background-work surface, so this is the
   only failure list in the bundle.
3. **Read cron output** — `keelson logs cron <slug> --severity error --json` for
   the cron stderr. `--severity` is accepted on `logs app` and
   `logs cron` only.
4. **Re-run after a fix** — `keelson crons trigger <name> --app <slug>` fires the
   cron once on demand.

### Log surfaces

| Command | Source |
|---|---|
| `keelson logs app <slug>` | App runtime stdout / stderr |
| `keelson logs cron <slug>` | Cron output |
| `keelson logs access [--app <slug>]` | Edge / gateway request logs |
| `keelson logs deploy <deploy_id>` | Deploy progress lines plus stored failure details and app startup logs for a failed deploy |

- `--severity error` filters `logs app` / `logs cron` to error level (applied
  server-side).
- `--since` accepts up to `30d` (the log retention window); it is mutually
  exclusive with `--previous`.
- `--since` on `logs deploy` filters progress lines only. Stored failure
  details and startup logs have no per-line timestamps and remain in the
  response.
- `--quiet` on `logs deploy` emits progress, failure-detail, and startup log
  lines without a heading. `--json` always includes `logs`, `failure_logs`,
  `startup_logs`, and `empty_reason`; all three log fields are arrays, including
  when empty. `empty_reason` is set only when all three arrays are empty.
- For an empty `logs deploy --json` result, `empty_reason` is
  `no_logs_for_successful_deploy` for a completed deploy,
  `failure_details_not_stored` for a failed or rolled-back deploy,
  `deploy_in_progress` for a non-terminal deploy, or `deploy_outcome_unknown`
  when the outcome cannot be determined. With `--since`, it is
  `filters_applied` instead. A non-empty result uses `null`.
- When no deploy logs are available, non-quiet output explains the empty result
  according to the deploy outcome.
- `--json` on `logs app` / `logs cron` emits structured entries
  (`timestamp` / `severity` / `source` / `message`).

### `--previous` is not supported

`keelson logs app <slug> --previous` returns a 422. Output from a crashed
previous instance is included in the normal log stream, so read a crash loop
with plain `keelson logs app <slug>` (optionally `--severity error`) — there is
no separate "previous instance only" view.

### Streaming / follow is not supported

There is no `--follow`. Fetch a snapshot with a single `logs` call and poll if
you need to watch; one call returns an accurate, structured result.
