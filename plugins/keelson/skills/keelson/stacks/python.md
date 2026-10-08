# Stack: Python

The Python-specific rewrites. Read this together with `core/DECISION.md` (which
recipe applies and why) and `core/KEELSON_YAML.md` (the config contract). This
file is self-contained for Python — you do not need `stacks/node.md` or
`stacks/go.md`.

Runtimes: `python-slim` (default) / `python-media`. Dependencies come from
`requirements.txt`, or `pyproject.toml` with `[project]` / `[build-system]`.

## Recipe: bind to `PORT` and `0.0.0.0`

The deployed server must listen on the injected `PORT` and bind `0.0.0.0`. A
hard-coded port or a `127.0.0.1` / `localhost` bind will not receive traffic.
Choose the production server from the framework-specific sections below; binding
the framework's development server correctly does not make that server suitable
for deployment.

```python
# contract:skip — local Flask entrypoint only (not the deployed command)
import os

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
```

This keeps `python app.py` useful locally. On Keelson, Flask is started by the
Gunicorn command in **Production Hardening → Flask**; do not use `python app.py`
as the deployed `command`.

## Recipe: SQLite file → Keelson Managed SQLite (libSQL)

Replace the direct-file SQLite client with a libSQL client that reads
`KEELSON_DB_URL` / `KEELSON_DB_AUTH_TOKEN`, and set `db.mode: libsql`. Keep a
`file:` URL as the **local-dev fallback** so the app still runs without an
injected managed DB.

```yaml
# keelson.yaml — fragment. Merge into your file; required fields are in core/KEELSON_YAML.md.
db:
  mode: libsql
```

Use the `libsql` package (import name `libsql`). Do **not** pick
`libsql-client`, `libsql-experimental`, or `pysqlite`; the transcribed-correct
package is `libsql` (see `resources/sample-apps/libsql-crud`).

```text
# contract:skip — requirements.txt
Flask==3.0.0
libsql==0.1.11
```

```python
# contract:skip — Python before/after
# BEFORE
import sqlite3
conn = sqlite3.connect("app.db")

# AFTER
import os, libsql
url = os.environ.get("KEELSON_DB_URL", "file:local.db")  # file: = local fallback
conn = libsql.connect(url, auth_token=os.environ.get("KEELSON_DB_AUTH_TOKEN", ""))
conn.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, note TEXT)")
conn.execute("INSERT INTO items (note) VALUES (?)", ("hello",))
conn.commit()
count = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
```

After rewriting: no `import sqlite3` should remain in the data path, and the app
must read `KEELSON_DB_URL`. The environment-leak rules that come with holding
`KEELSON_DB_AUTH_TOKEN` are in `core/DECISION.md` → SQLite→libSQL.

### Four stdlib behaviours that do NOT come with the connection

`libsql` is not a drop-in for `sqlite3`, and these four are the gap. They are
**measured** on `libsql==0.1.11` (`reference/SUPPORT_LEDGER.md` →
`py-raw-sqlite3`, trial `chores--claude--01`), not predicted.

First, what you must NOT touch: `executemany`, `cursor.lastrowid`,
`cursor.rowcount` (including 0 for a no-match `UPDATE`/`DELETE`) and the
`with conn:` transaction context (commits on exit, rolls back on exception) all
carry across **unchanged**. Rewriting those is churn that risks a regression for
no gain.

**1. There is no `row_factory`.** The connection has no such attribute (assigning
one raises `AttributeError`) and `fetchone()`/`fetchall()` return plain tuples,
so `row["title"]` is a `TypeError`. `cursor.description` is available, so rebuild
name-addressed rows there and leave the templates and call sites untouched:

```python
# contract:skip — the row_factory replacement
def _rows(cur) -> list[dict]:
    names = [d[0] for d in cur.description]
    return [dict(zip(names, r)) for r in cur.fetchall()]

def _row(cur) -> dict | None:
    rows = _rows(cur)
    return rows[0] if rows else None
```

**2. `sqlite3.register_adapter` does not reach this client.** Passing a
`datetime` raises a bare `ValueError` about the parameter type. Format at the
call site instead — `datetime.now().isoformat(timespec="seconds")`.

**3. The file-DB PRAGMAs stop meaning anything against the managed store — but
do NOT just delete them.** `journal_mode=WAL` and `busy_timeout` tune a local
file, and your `file:` fallback is still a local file: the client honours them
there (`PRAGMA journal_mode=WAL` returns `wal`). Deleting them outright changes
the locking and concurrency behaviour of the local-development path this recipe
requires you to keep. Move them onto the local branch instead of dropping them:

```python
# contract:skip — keep the file-DB tuning on the local path only
conn = libsql.connect(url, auth_token=token)
if url.startswith("file:"):
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
```

**4. There is no DBAPI exception hierarchy — this is the one that fails
silently.** Every failure arrives as a bare `builtins.ValueError`, whatever it
would have been. Measured against stdlib on the same statements:

| Failure | stdlib `sqlite3` raises | `libsql` raises |
|---|---|---|
| `NOT NULL` / `UNIQUE` violation | `sqlite3.IntegrityError` | `builtins.ValueError` |
| missing table / column, SQL syntax error | `sqlite3.OperationalError` | `builtins.ValueError` |
| bad parameter type | `sqlite3.ProgrammingError` | `builtins.ValueError` |

So **every** `except sqlite3.<Anything>Error:` in the app stops catching —
including a catch-all `except sqlite3.Error:`, and including handlers reached
through `from sqlite3 import IntegrityError` or an alias. Nothing tells you: the
app keeps working until that path is first hit, and then 500s instead of showing
the user their error.

Behaviours 1 and 2 break on the first request and cannot be missed. This one can,
so make it a step: **before you finish, search the app for `sqlite3.` and for
imported error names, and account for every handler you find.** The wiring lint
(`keelson deploy --check`) also flags residual `sqlite3` references under
`db.mode: libsql` — including `from sqlite3 import …` and import aliases — as a
warning; it detects, it does not rewrite. For each one:

- Prefer resolving it in SQL so no exception is raised at all — `INSERT ... ON
  CONFLICT DO NOTHING/DO UPDATE` for the duplicate case.
- Otherwise catch `ValueError` **around the specific `execute` call only** and
  match on the message. Do not wrap a broad block in `except ValueError:` — that
  swallows the parameter-type errors from behaviour 2 and turns a bug into a
  silently wrong branch.
- **If you cannot preserve what the handler did, stop and ask.** A handler that
  turned a duplicate into "that email is already registered" and now cannot is a
  change to the app's public behaviour, which is an invasiveness trigger in
  `core/DECISION.md` — so that app is an `ask` even where the route is not.

Keep the `file:` default. It is what lets `python app.py` still start on the
user's machine, and `core/DECISION.md` → Local Development Parity makes that a
success condition of the adaptation. The wiring lint reports `no-local-dev-path`
if it goes missing.

**Where the connection lives matters on a scale-to-zero platform.** The snippet
above opens one at import for brevity; in a web app, open it **per request** (in
Flask, `flask.g` plus a `teardown_appcontext` close) and let the module hold only
the URL and token. Instances are torn down when idle, so a connection held across
that gap is a remote stream nobody is keeping alive. The one route measured here
end to end through a scale-to-zero wake
(`reference/SUPPORT_LEDGER.md` → `py-raw-sqlite3`, `cold_start`) used the
per-request shape; the held shape has not been measured on this client, and the
SQLAlchemy route below also uses `NullPool`, so it does not keep a remote stream
across an idle period.

### Moving an existing file's data (there is no path for it)

The rewrite above moves the *code*, not the *rows*. The managed database starts
**empty**: the app recreates its schema (the `CREATE TABLE IF NOT EXISTS` runs
against libSQL), and the rows already in `app.db` are **not** carried over.
Keelson does not ship a data-move step today — an agent can produce a SQL dump of
the old file locally (`sqlite3 app.db .dump > dump.sql`), and load it with
`keelson db apply dump.sql --app <slug>` (`reference/DB_APPLY.md`: 16 MiB per
apply; once the database is non-empty an apply needs the user's approval). So if
the existing file holds data the user would miss, this is an `ask`, and the proposal
must say plainly that existing rows will not come across (`core/DECISION.md` →
the existing-data trigger). Do not point a populated app at an empty database
silently.

## Recipe: SQLAlchemy → `sqlalchemy-libsql-native`

SQLAlchemy (directly, or under **SQLModel** / **Flask-SQLAlchemy**) reaches a
file with `create_engine("sqlite:///app.db")`. Move only the engine wiring to
the public `sqlalchemy-libsql-native==0.1.0` package. **This is an `ask`, not an
`auto`** (`core/DECISION.md` → Grading): the package is published and owned by
Keelson, but it is upstream-**experimental** — a 0.x single release that pins the
`libsql` client upstream files under "Experimental Drivers" — and the new route
has no citeable ledger verification yet. Treat this whole recipe as an
experimental route and tell the user so. The models, `select()`/query
expressions and schema do **not** change.

```yaml
# keelson.yaml — fragment. Merge into your file; required fields are in core/KEELSON_YAML.md.
db:
  mode: libsql
```

```text
# contract:skip — requirements.txt
SQLAlchemy>=2.0.51,<2.1
sqlalchemy-libsql-native==0.1.0
```

```python
# contract:skip — Python before/after
# BEFORE
from sqlalchemy import create_engine
engine = create_engine("sqlite:///app.db")

# AFTER
import os
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

def _libsql_url_and_args():
    url = os.environ.get("KEELSON_DB_URL")
    if not url:
        return "sqlite+libsql_native:///local.db", {}   # local-dev fallback
    host = url.removeprefix("libsql://").removeprefix("https://")
    return (
        f"sqlite+libsql_native://{host}?secure=true",
        {"auth_token": os.environ.get("KEELSON_DB_AUTH_TOKEN", "")},
    )

url, connect_args = _libsql_url_and_args()
engine = create_engine(url, connect_args=connect_args, poolclass=NullPool)
```

Keep these constraints with that wiring:

- **`poolclass=NullPool` is required, not optional.** Version 0.1.0 also chooses
  NullPool for remote URLs by default, but spell it out in application code so a
  later default or copied engine option cannot create a held remote stream.
  `pool_pre_ping=True` is not a substitute and explicit QueuePool remains a
  verification-only opt-in until its separate promotion gate passes.
- **Ordinary `except IntegrityError:` works on this dialect.** The facade maps
  UNIQUE / FOREIGN KEY / NOT NULL failures onto SQLAlchemy's typed exception and
  preserves the raw driver `ValueError` as the cause. Catch the SQLAlchemy type
  around the specific transaction; the raw `libsql` recipe above still has no
  typed DBAPI exceptions.

```python
# contract:skip — typed constraint handling
from sqlalchemy.exc import IntegrityError

try:
    with engine.begin() as conn:
        conn.execute(insert_statement)
except IntegrityError:
    handle_constraint_violation()
```

**Do not turn disconnect classification into blind transaction retry.** A lost
commit acknowledgement can mean the row was committed even though the caller
received an error. Retry only an operation that is idempotent by construction
(for example, a request key protected by a UNIQUE constraint plus an upsert),
and restart the whole unit of work on a fresh connection. Never resume a
half-open transaction or automatically retry an ambiguous commit.

**Serialise write producers across replicas.** A process-local lock coordinates
one instance only. Do not fan out write transactions; put bulk/background writes
through one `cron` Job execution path, and keep each request transaction short. If
the app requires concurrent request writers and has no cross-replica
serialization or idempotency design, stop and ask rather than claiming this
connection swap preserves its behaviour.

Keep the `sqlite+libsql_native:///local.db` fallback so `python app.py` still
starts locally (Local Development Parity). The token-in-`connect_args` detail,
return shapes and the dialect URL are in `reference/LIBSQL_CLIENTS.md`.

### Async SQLAlchemy (`create_async_engine` / `aiosqlite`) — the `to_thread` bridge

There is **no supported async libSQL dialect**. The supported bridge is to
**de-async** onto `sqlalchemy-libsql-native==0.1.0` and call that sync engine
from async handlers through a worker thread. This remains `ask` and
**experimental**, same as the sync route: the rewrite reaches past the
connection boundary, and the sync target underneath is upstream-experimental.

**A worked example is checked in — copy its `to_thread` STRUCTURE, not its
configuration:** `resources/sample-apps/fastapi-sqlalchemy-tickets-keelson` (`db.py` for
the engine/session, `app.py` for the `to_thread` wiring). It keeps every route
`async def`, keeps the ORM, `select()`, validation and HTML, and moves only the
engine, the session, the lifespan, and each DB block onto the bridge. The
discipline it follows — and that you must preserve — is: **one Session per thread
per transaction**; build the Session inside the sync function and commit/close it
there; materialise ORM rows to plain dicts before returning them to the async
side; never split one transaction across two `to_thread` calls.

> **⚠ That sample is a Tier 3 VERIFICATION fixture, not proof that this route is
> remotely verified.** Its 2026-08-16 deployment stopped at the health check
> before the acceptance endpoints ran. Copy its thread/unit-of-work structure,
> but keep the explicit **`poolclass=NullPool`** and write-serialization rules
> above; do not infer a QueuePool promotion or a staging pass from the fixture.
>
> **Its migration setup is fixture-only — do NOT copy it.** The sample runs
> `alembic upgrade head` at startup behind a hand-rolled DB mutex (`app.py`), and
> its `keelson.yaml` declares no `db.migrate`, because the fixture has to boot
> and self-diagnose as one unit. The shipping recipe is the opposite: put the
> migration command in **`db.migrate`** (below), and keep startup work to
> bootstrap-only DDL. Take the thread/unit-of-work structure from the sample;
> take the pool and migration decisions from this recipe.

**Do not run schema migrations by racing them at startup.** Alembic does not
protect itself from concurrent execution, so several cold-starting replicas can
run the same DDL at once. Put the migration command in `keelson.yaml` as
`db.migrate` (`core/KEELSON_YAML.md`): it runs once on the new image before
traffic moves, and a failure keeps traffic on the old revision. Use the same
native dialect URL and exact dependency there. Startup DDL is only the lighter
alternative for small, idempotent bootstrap schemas.

## Recipe: File I/O → `files` SDK / `media` SDK

Which of the two applies (or whether it belongs in the database) is decided by
`core/DECISION.md` → Recipe: local file I/O. This is the Python call shape.

Declare `keelson-sdk` wherever the app already declares dependencies. If it
uses `requirements.txt`, add `keelson-sdk` there. If it uses only
`pyproject.toml`, add `keelson-sdk` to `[project].dependencies`. For a
pyproject-only app, do not add a requirements.txt: doing so changes the build
away from installing the project and can omit the app's existing dependencies.

### `files` — a file the app names and updates (`auto`)

`from keelson import files`, then swap the filesystem call for the SDK call. The
key is the old filename, so the rewrite reads the same:

```python
# contract:skip — Python before/after
# BEFORE
import json
json.dump(d, open("seen_urls.json", "w"))
seen = json.load(open("seen_urls.json")) if os.path.exists("seen_urls.json") else []

# AFTER
import json
from keelson import files
files.write("seen_urls.json", json.dumps(d))
seen = json.loads(files.read("seen_urls.json") or "[]")
```

`files.read()` returns `None` for a key that was never written, so the
`or "[]"` replaces the `os.path.exists` check — a first run is the normal path,
not an error. `files.write()` overwrites and returns once the write is durable;
`files.delete(key)` is idempotent and `files.list(prefix)` enumerates keys.

`pathlib` / `open()` / `os.makedirs` calls that were only there to manage the
file's directory disappear with it — there is no directory to create.

### `media` — uploads and generated media served by ID (`ask`)

Flask's `send_from_directory` and Django's `MEDIA_ROOT` / `MEDIA_URL` are the
signals. Store the ID `put()` returns; serve the file from
`/__keelson/media/<id>` rather than from a static directory:

```python
# contract:skip — Python before/after
# BEFORE
path = os.path.join("uploads", filename)
upload.save(path)
db.execute("INSERT INTO photos (path) VALUES (?)", (path,))

# AFTER
from keelson import media
file_id = media.put(upload.read(), filename=filename, content_type=upload.mimetype)
db.execute("INSERT INTO photos (media_id) VALUES (?)", (file_id,))
# template: <img src="{{ media.url(photo.media_id) }}">  ->  /__keelson/media/<id>
```

The new `media_id` column and the changed URL are why this one is `ask` — get the
user's approval before doing it.

### Local development parity

Both SDKs write real files on the user's machine with no environment set:
`files` under `./.keelson/files/<key>`, `media` under `MEDIA_DIR` (default
`./media`). `python app.py` keeps working, which
`core/DECISION.md` → Local Development Parity requires. Add `.keelson/` and
`media/` to `.gitignore`.

## Production Hardening

Apps written to run locally default to *developer-friendly*: debug consoles,
auto-reload, a hard-coded secret. On Keelson those defaults are a production
incident — a debug error page renders `os.environ`, and `KEELSON_DB_AUTH_TOKEN`
is in there (`core/DECISION.md` → SQLite→libSQL).

**The rule: production-safe is the default; local opts INTO dev.** Read the flag
from the environment with the safe value as its default:

```python
# contract:skip — the direction that fails safe
# CORRECT — unset env means production-safe. Local sets DEBUG=true explicitly.
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
# WRONG — a forgotten env var is now an unsafe production deploy.
DEBUG = os.environ.get("DEBUG", "true").lower() == "true"
```

The two are one character apart and fail in opposite directions. The correct one
still satisfies Local Development Parity: with no env at all the app starts —
just in its production-safe mode, which is exactly what you want a default to be.

### Am I on Keelson? — `KEELSON_MODE`

Two of the rules below need to know. "Fail fast when `SECRET_KEY` is unset"
(hardening) and "start with no env at all" (parity) are only compatible if the
app can tell production from a laptop — otherwise fail-fast fires on the
developer's machine and parity is gone.

The platform always injects `KEELSON_MODE=keelson`
(`core/KEELSON_YAML.md` → Auto-set Environment Variables), and nothing sets it
locally. That is the signal:

```python
# contract:skip — the production discriminator
ON_KEELSON = os.environ.get("KEELSON_MODE") == "keelson"
```

Do **not** use `DEBUG` for this. `DEBUG` defaults to False — correctly, on the
laptop too — so gating fail-fast on `not DEBUG` makes the app refuse to start
locally, which is exactly the parity break C-14 exists to stop.

### Framework support boundary

**Streamlit is currently unsupported.** Its UI requires a persistent WebSocket,
but the current Keelson gateway rejects WebSocket Upgrade requests with `501`.
Do not add a `streamlit run` command or present a successful HTML/health response
as a working deployment; the application UI cannot operate through the gateway.

**Gradio is under verification, and only Gradio >=4 is eligible.** Gradio 3.x's
queue uses WebSockets and hits the same gateway blocker. Gradio >=4 uses SSE, so
it avoids that specific blocker, but its streaming/reconnect behaviour across
Keelson's 300-second request boundary and scale-to-zero has not completed canary
verification. Do not describe Gradio as supported yet; explain that >=4 is the
version being verified and treat deployment as an unverified path.

Both Gunicorn recipes are capped below version 27. The cap used to be `<26`,
from a real symptom — Gunicorn 26 creates a control socket under `$HOME` at
startup and the unprivileged app user could not write there — but the cause was
a missing home directory, not the Gunicorn version: Keelson-generated images now
create `/home/appuser` and chown it to the runtime UID. Both the Flask and
external-database Django recipes were then deployed and verified on Gunicorn 26
(2026-08-26): HTTP 200, `$HOME` writable, and zero `runtime_errors`, so the cap
moved to `<27`. Every dependency this skill documents carries a version bound —
widen this one the same way it was widened here: deploy both recipes on the next
major and record the result.

### Django

This hardening is for the **external-database** Django route — the only way
Django deploys to Keelson. Django on a file SQLite backend is `unsupported`
(`core/DECISION.md` → the routing decision): there is no supported libSQL backend
for its ORM, and Keelson keeps no SQLite file on disk. Django reaches the
platform only by pointing at an external database (`db.mode: none` + connection
details via `secrets`, e.g. hosted PostgreSQL). None of that makes the hardening
below optional: `DEBUG` default False, a real `SECRET_KEY`, and
`CSRF_TRUSTED_ORIGINS` apply in full to the external-DB Django app.

That external-DB route must use Gunicorn in deployment; Django's `runserver` is
for local development only. Add Gunicorn to `requirements.txt`:

```text
# contract:skip — requirements.txt (external-database Django only)
gunicorn>=21,<27
```

Set the deployed command to the WSGI module used by the project (replace
`config` when the settings package has a different name):

```yaml
# keelson.yaml — complete file. Copy it, then change slug.
slug: my-app
runtime: python-slim
# workspace: acme-corp    # uncomment and set your workspace slug if you belong to more than one
command: "gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 --graceful-timeout 9 config.wsgi:application"
env:
  PYTHONUNBUFFERED: "1"
db:
  mode: none            # switch to libsql if the app stores data (see core/DECISION.md)
```

One worker avoids multiplying startup and memory cost on Keelson's 1 vCPU
instance; eight threads provide bounded I/O concurrency. The nine-second
graceful timeout stays inside the platform's ten-second SIGTERM window so the
worker can drain in-flight requests before forced termination. Keep
`PYTHONUNBUFFERED: "1"` in the deployed environment so application output is
not held in a buffer under Gunicorn.

```python
# contract:skip — settings.py (external-database Django; db.mode: none + secrets)
import os

ON_KEELSON = os.environ.get("KEELSON_MODE") == "keelson"

DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Fail fast on Keelson rather than shipping a committed literal (one key shared
# by every deploy). Off Keelson, fall back so `python manage.py runserver`
# still works with no env set at all.
SECRET_KEY = os.environ.get("SECRET_KEY") or (None if ON_KEELSON else "dev-only-insecure-local-key")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set (declare it in keelson.yaml secrets)")

# The app is private and only the gateway can reach it, and the gateway strips
# the inbound Host — so the Host Django sees is the internal *.run.app one, not
# your public URL. Pinning ALLOWED_HOSTS to the public host would 400 every
# request, including the deploy health probe. Host is not attacker-controlled
# here; leave it open and get the public origin from KEELSON_APP_URL instead.
ALLOWED_HOSTS = ["*"]

# KEELSON_APP_URL is this app's own public origin (absent locally). Use it for
# CSRF trust and for any absolute URL you build (emails, password resets):
# request.get_host() returns the internal host and must not go in a link.
APP_URL = os.environ.get("KEELSON_APP_URL")
# Scope CSRF trust to THIS app's origin. Do not widen it to `https://*.keelson.run`:
# every Keelson app is same-site under keelson.run, so a wildcard trusts other
# workspaces' apps and SameSite=Lax will not stop them.
CSRF_TRUSTED_ORIGINS = [APP_URL] if APP_URL else []

# TLS terminates at the edge, so Django sees plain HTTP; without this it builds
# http:// URLs and thinks the connection is insecure.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Secure cookies on Keelson (always HTTPS). Locally the app is served over
# http://, where a Secure cookie is silently dropped and login stops working —
# so gate them, or parity is broken for every session-based app.
SESSION_COOKIE_SECURE = ON_KEELSON
CSRF_COOKIE_SECURE = ON_KEELSON
```

Declare `SECRET_KEY` in `keelson.yaml` `secrets` (see `core/DECISION.md` →
hard-coded API keys). Static files are not served for you: add `whitenoise` to
`MIDDLEWARE`, set `STATIC_ROOT`, and run `collectstatic` in the build — Django's
own static serving is disabled when `DEBUG=False`, so this is the step whose
absence makes a deployed site come up unstyled.

If the app uses a **custom domain**, `KEELSON_APP_URL` still holds the platform
host, so add the custom origin to `CSRF_TRUSTED_ORIGINS` as well or form POSTs
will 403.

### Flask

Flask's `app.run()` starts Werkzeug's development server. It may remain behind
the local `if __name__ == "__main__"` entrypoint shown above, but it must not be
the deployed server even when `debug=False`. Add Gunicorn to
`requirements.txt`:

```text
# contract:skip — requirements.txt
gunicorn>=21,<27
```

Use the app's real module/object name in the final argument (`app:app` below):

```yaml
# keelson.yaml — complete file. Copy it, then change slug.
slug: my-app
runtime: python-slim
# workspace: acme-corp    # uncomment and set your workspace slug if you belong to more than one
command: "gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 --graceful-timeout 9 app:app"
env:
  PYTHONUNBUFFERED: "1"
secrets:
  items:
    - name: SECRET_KEY
      description: "Flask session signing key"
db:
  mode: none            # switch to libsql if the app stores data (see core/DECISION.md)
```

This preserves the required `0.0.0.0:$PORT` bind while replacing the development
server. One worker fits the 1 vCPU instance, eight threads provide bounded I/O
concurrency, and the nine-second graceful timeout lets Gunicorn drain in-flight
requests within the platform's ten-second SIGTERM window. Keep
`PYTHONUNBUFFERED: "1"` in the deployed environment so application output is
not held in a buffer under Gunicorn.

```python
# contract:skip — app configuration and local-only entrypoint
import os

ON_KEELSON = os.environ.get("KEELSON_MODE") == "keelson"

# Same rule as Django: fail fast on Keelson, still start on a laptop with no env.
secret = os.environ.get("SECRET_KEY") or (None if ON_KEELSON else "dev-only-insecure-local-key")
if not secret:
    raise RuntimeError("SECRET_KEY must be set (declare it in keelson.yaml secrets)")
app.secret_key = secret

# Keep this only for `python app.py` during local development. Keelson starts
# app:app with the Gunicorn command above. Never pass debug=True.
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), debug=False)
```

Declare `SECRET_KEY` in `keelson.yaml` `secrets` — the block above already does,
because the snippet raises on Keelson when it is unset. This is the same rule as
Django. Declaring a secret does not set its value: supply it on the first deploy
with `keelson deploy --new --secrets-from-env-file <path>` (see
`core/DECISION.md` → hard-coded API keys). Copying the file above without
supplying the value makes the first deploy fail at startup.

`app.run(debug=True)` must not survive the adaptation. If the app gates it on an
env var, the default must be off.

### FastAPI / uvicorn

Start the server without `--reload` (it is a filesystem watcher — wasted memory
on Keelson and it can double-start the app), bind `0.0.0.0:$PORT`, and keep the
default single worker unless the app is genuinely CPU-bound: instances scale to
zero, so extra workers multiply cold-start cost. Leave the interactive docs
(`/docs`) only if the app should expose its API surface — every request is
authenticated at the gate, so this is a product decision, not a security one.

```yaml
# keelson.yaml — complete file. Copy it, then change slug.
slug: my-app
runtime: python-slim
# workspace: acme-corp    # uncomment and set your workspace slug if you belong to more than one
command: "uvicorn main:app --host 0.0.0.0 --port $PORT"
db:
  mode: none            # switch to libsql if the app stores data (see core/DECISION.md)
```

<!--
Client-level detail (return types, auth_token passing) lives in
`reference/LIBSQL_CLIENTS.md`; route verification status in
`reference/SUPPORT_LEDGER.md`.
-->
