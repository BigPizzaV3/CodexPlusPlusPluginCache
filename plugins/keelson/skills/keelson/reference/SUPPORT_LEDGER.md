# Reference: Support Ledger

<!-- GENERATED FILE — DO NOT EDIT.
     Source of truth: apps/cli/internal/skill/support_ledger.yaml
     Regenerate:      cd apps/cli && go test ./internal/skill/ \
                        -run TestSupportLedgerViewIsGenerated -update
     Editing this file directly is lost on the next regeneration. -->

Which ORM / driver routes onto **Keelson Managed SQLite** (`db.mode: libsql`)
have actually been verified here, and what evidence backs each claim.

## This file does not decide anything

It holds **facts and evidence**. There is no recommendation column. Whether a
route is applied silently (`auto`), proposed and confirmed (`ask`), or refused
(`unsupported`) is decided by the **Adaptation Decision Function** in
`core/DECISION.md`, from these facts plus the invasiveness of the app in front
of you, with priority **`unsupported` > `ask` > `auto`**.

The **Derived** column below is that function applied to this row's facts —
shown so you can see where a grading comes from, not as a second opinion. It is
a **ceiling**: it knows the route, not your app. An app-specific trigger (an
existing `.db` file holding data the user would miss, a schema change) makes the
real call **stricter**, never looser. Read `core/DECISION.md` for the rule.

**`upstream_maturity: stable` does not imply `auto`.** A route whose
`local_crud` is not `pass` stays `ask`, however obvious its rewrite looks. That
is the whole point of this file: `node-raw-better-sqlite3` is a mature, widely
used library whose swap is the same shape as `node-raw-node-sqlite`'s — and only
one of the two has been run here. **The rewrites resemble each other; the
evidence does not.** Never promote a route because it resembles one.

## Routes

| Route | Lang | Upstream | Rewrite scope | `local_crud` | `remote_deploy` | Derived |
|---|---|---|---|---|---|---|
| `node-raw-node-sqlite` | node | stable | `connection_only` | `pass` | `pass` | **`auto`** |
| `node-raw-better-sqlite3` | node | stable | `connection_only` | `untested` | `untested` | **`ask`** |
| `node-drizzle` | node | stable | `connection_only` | `pass` | `pass` | **`auto`** |
| `py-raw-sqlite3` | python | experimental | `connection_only` | `pass` | `pass` | **`ask`** |
| `py-sqlalchemy-sync` | python | experimental | `connection_only` | `untested` | `untested` | **`ask`** |
| `py-sqlalchemy-async` | python | experimental | `beyond_connection` | `untested` | `untested` | **`ask`** |
| `py-django-file-sqlite` | python | none | `no_libsql_path` | `untested` | `untested` | **`unsupported`** |
| `go-databasesql` | go | stable | `beyond_connection` | `fail` | `pass` | **`ask`** |
| `go-gorm-cgo` | go | none | `beyond_connection` | `untested` | `untested` | **`ask`** |
| `prisma-v6` | node | stable | `beyond_connection` | `unknown` | `pass` | **`ask`** |
| `prisma-v7` | node | unknown | `beyond_connection` | `untested` | `untested` | **`ask`** |

## Verification fields

Each field is an **independent** observation, not a stage. A route can deploy
and serve while its data path has never been exercised, and for most routes here
that is still the state: `remote_crud` was `untested` on every route until
`py-raw-sqlite3` (no trial could write a row through its own deployed app past
the auth gate — `REPORT.md` §7.1), and it is `pass` on 1 of 11 today.
"It deployed" is not "the data survives", and this table keeps the two from
being read as one number.

| Field | Means |
|---|---|
| `static` | The static wiring lint / `deploy --check` was run on the rewritten app. |
| `local_crud` | The rewritten app's CRUD path was exercised on a developer machine with no Keelson environment. core/DECISION.md's condition 2 reads this field. |
| `remote_deploy` | The rewritten app was deployed to Keelson and served through the edge. Proves it starts — NOT that data survives. |
| `remote_crud` | A write was made against the managed database THROUGH the deployed app, and read back. |
| `restart_readback` | Data written before a restart / scale-to-zero was readable after it. |
| `redeploy_readback` | Data written before a redeploy was readable after it. |
| `migration` | The route's schema-migration path was exercised against a remote managed database. |
| `cold_start` | The route's connection behaviour was observed on a cold start. |

| Status | Means |
|---|---|
| `pass` | Exercised, and it worked. |
| `fail` | Exercised, and it did not. |
| `unknown` | Exercised, but the result does not settle the field. |
| `untested` | Not exercised. **The default** — an absent record is never support. |

## Route detail

### `node-raw-node-sqlite` — Node raw `node:sqlite` (stdlib) → `@libsql/client`

**Derived by `core/DECISION.md`: `auto`.**

| | |
|---|---|
| From | `import { DatabaseSync } from "node:sqlite"` + `new DatabaseSync("data.db")`, raw SQL |
| To | `@libsql/client` |
| Detection signals | `node:sqlite`, `DatabaseSync` |
| Upstream maturity | `stable` — Turso's first-party Node client, 0.x, actively maintained, and the client the spec's own Node recipe is written against. That is the whole basis for this label: it is a statement about what Turso ships. Our trials are NOT cited here — they are Keelson observations and they live in the verification fields below, where they can be read for what they actually cover. |
| Rewrite scope | `connection_only` — Client swap only. SQL and schema unchanged; the sync→async conversion adds `await` at the call sites and the file-DB PRAGMAs (WAL / busy_timeout) drop out. bookmarks--claude--01 measured +81/-52 in server.js, confined to the DB layer and its async plumbing — routing, HTML, search and paging untouched (REPORT.md §5.1). |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `pass` | `trial:bookmarks--claude--01` — Full local CRUD smoke over the `file:` fallback, run before deploy (REPORT.md §5.1). |
| `remote_deploy` | `pass` | `trial:bookmarks--claude--01` — completed / serving:true / traffic_converged:true (Tokyo); `db_env_injected=true` confirmed in the logs (REPORT.md §5.1). |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

bookmarks--claude--02 (DS-P2b) re-ran the fixture under the libSQL-only bundle: the `node:sqlite` → `@libsql/client` rewrite was produced with zero confirmation requests raised. That is DECISION-FUNCTION evidence and it is NOT route verification: the run stopped at the `keelson login` device-code flow, and its grade.json records "NOT executed: remote deploy, edge probe, persistence proof". Every verification field above therefore rests on bookmarks--claude--01 alone.

### `node-raw-better-sqlite3` — Node raw `better-sqlite3` (no ORM) → `@libsql/client`

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | `new Database("data.db")` from `better-sqlite3`, called directly (`.prepare().get/all/run`) |
| To | `@libsql/client` |
| Detection signals | `better-sqlite3`, `new Database(` |
| Upstream maturity | `stable` — Same target client as node-raw-node-sqlite: Turso's first-party `@libsql/client`, 0.x. The `stable` label is about the client, and it says nothing about whether this SOURCE library's call sites have been rewritten onto it here — that is what the verification fields below are for. |
| Rewrite scope | `connection_only` — Client swap; SQL and schema unchanged. `better-sqlite3` is synchronous, so the same sync→async conversion applies as in node-raw-node-sqlite. There is a second reason to remove it beyond persistence: it is a native module and carries the build risk tasks--claude--01 cited when it dropped it (REPORT.md §5.2). |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `untested` | — |
| `remote_deploy` | `untested` | — |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

> **Evidence that is NOT this route's — `trial:tasks--claude--01`.** tasks--claude--01 did remove `better-sqlite3` and add `@libsql/client` — but UNDER Drizzle: the call sites it rewrote were the ORM's, and `better-sqlite3`'s own API was never touched. That evidence is node-drizzle's. "The dependency was swapped in a trial" is not the same claim as "this library's call sites were rewritten onto the new client here" (REPORT.md §5.2).

No trial has rewritten raw `better-sqlite3` call sites onto `@libsql/client` here: every verification field is `untested`. The shape of the rewrite is near-identical to node-raw-node-sqlite — near-identical enough that the first draft of this ledger put both libraries in one row and let bookmarks' `node:sqlite` measurement stand for both. It does not: bookmarks--claude--01.grade.json records `node:sqlite -> @libsql/client`.

### `node-drizzle` — Node Drizzle on `better-sqlite3` → `drizzle-orm/libsql`

**Derived by `core/DECISION.md`: `auto`.**

| | |
|---|---|
| From | `drizzle-orm/better-sqlite3` + `new Database(path)` |
| To | `drizzle-orm/libsql` + `createClient({url, authToken})` |
| Detection signals | `drizzle-orm/better-sqlite3`, `drizzle.config.ts` |
| Upstream maturity | `stable` — `drizzle-orm/libsql` is a first-party Drizzle driver riding on `@libsql/client` (itself `stable` — see node-raw-node-sqlite). |
| Rewrite scope | `connection_only` — Driver-layer swap. The schema definition (schema.ts) and every query builder expression survive untouched; sync→async adds `await` in the Express handlers. tasks--claude--01 kept the ORM entirely (REPORT.md §5.2). |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `pass` | `trial:tasks--claude--01` — Local smoke covering all CRUD, search, validation and 404 paths before deploy (REPORT.md §5.2). |
| `remote_deploy` | `pass` | `trial:tasks--claude--01` — completed / serving (REPORT.md §5.2). |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

Re-run under the libSQL-only bundle as tasks--claude--05 (DS-P2b): zero confirmation requests raised, local CRUD passed. Its deploy did not run (the `keelson login` device-code flow blocked it), so it adds no remote evidence — see trials/DS-P2b-RESULTS.md.

### `py-raw-sqlite3` — Python raw `sqlite3` (stdlib) → libSQL client

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | stdlib `sqlite3` against a file path |
| To | the `libsql` Python client |
| Detection signals | `import sqlite3`, `sqlite3.connect` |
| Upstream maturity | `experimental` — The stdlib `sqlite3` SOURCE side is as stable as software gets. The TARGET client is not, and this field is about the target. libSQL's own driver list (github.com/tursodatabase/libsql README) has two sections — "Official Drivers" (TypeScript/JS, Rust, Go, Go-no-CGO) and "Experimental Drivers" — and **Python is in the second, written "Python (experimental)"**. That is upstream labelling its own Python driver, which is exactly what this field records. Checked 2026-07-27. The link under that entry points at `libsql-experimental-python` rather than `libsql-python`, which invites the reading that the label belongs to some other package — it does not: BOTH repositories declare `name = "libsql"` in `[project]`, and `libsql-python` declares `version = "0.1.11"`, which is the version on PyPI. The experimental label and the package this route installs are the same artifact. Nothing else on the PyPI side supports `stable` either: `libsql==0.1.11` shipped 2025-09-02 and is still the newest release ~11 months later, the project page carries **no description at all** ("The author of this package has not provided a project description") and **no `Development Status` classifier**, and the version is 0.x. This row previously read `stable` on the basis "it is Turso's first-party client". That is the reasoning rule 4 above rules out — first-party is a statement about who wrote it, not about how upstream labels its maturity. Correcting this field is what changed the grading the decision function derives for this row; see notes. |
| Rewrite scope | `connection_only` — Connection swap; SQL and schema unchanged. chores--claude--01 measured +40/-21 in `app.py` (plus one line in `requirements.txt`) on a Flask CRUD app: every SQL string, the table definition, the routes, the validation and the templates were left as they stood. Four stdlib behaviours do NOT come across with the connection, and they are most of what the diff is made of. They were measured against the client (0.1.11), not predicted: (1) there is no `row_factory` — the connection object has no such attribute and `fetchone`/`fetchall` return plain tuples, so name-addressed rows are rebuilt from `cursor.description` (a six-line helper here); (2) `sqlite3.register_adapter` does not reach this client — handing it a `datetime` raises a bare `ValueError` ("...supported parameter type"), so the value is formatted at the call site; (3) the file-DB PRAGMAs (`journal_mode=WAL`, `busy_timeout`) stop being meaningful against the managed store — but they are NOT inert everywhere, and deleting them outright is a mistake this trial made and had corrected in review: on the `file:` fallback the client still honours them (`PRAGMA journal_mode=WAL` returns `wal`, `busy_timeout=5000` returns `5000`), so removing them changes the locking and concurrency behaviour of the local-development path the recipe requires be kept; (4) **there is no DBAPI exception hierarchy at all** — the same trait already recorded for the SQLAlchemy dialect, and the one that does not announce itself. Measured against stdlib on the same six failures, same SQL both sides: `sqlite3` raises `IntegrityError` (NOT NULL, UNIQUE), `OperationalError` (missing table, missing column, syntax error) and `ProgrammingError` (bad parameter type); the client lets a bare `builtins.ValueError` escape for **all six**. So every `except sqlite3.<Anything>Error:` clause an app already had — including a catch-all `except sqlite3.Error:` — silently stops catching, and the app keeps working until that path is first hit. `stacks/python.md` therefore makes finding those clauses a step of the recipe rather than a footnote. Of the four, (1) and (2) fail on the first request and cannot be missed; (3) is inert on the managed side but still live on the `file:` fallback; only (4) is silent. What did carry over unchanged, and needed no edit: `executemany`, `cursor.lastrowid`, `cursor.rowcount` (including 0 for a no-match UPDATE/DELETE), and the `with conn:` transaction context — commit on exit, rollback on exception. |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `pass` | `trial:chores--claude--01` — `keelson deploy --check --json` over the rewritten tree reported no checks. Run as a controlled comparison, because a silent lint and a passing lint look identical: the same `keelson.yaml` over the un-rewritten fixture source reports three `db_wiring_fail` warnings (two `local-store-in-data-path`, one `db-url-not-read`). |
| `local_crud` | `pass` | `trial:chores--claude--01` — 25/25 CRUD checks against `python app.py` started with KEELSON_DB_URL, KEELSON_DB_AUTH_TOKEN, KEELSON_MODE and the TURSO_* aliases all unset, over the `file:local.db` fallback — the same 25 checks the un-rewritten `sqlite3` fixture passes, so the comparison is like for like. Covers list, search, paging (LIMIT/OFFSET), create, edit, update, status toggle, delete, three validation rejections, and the two 404s that are decided by `cursor.rowcount == 0`. |
| `remote_deploy` | `pass` | `trial:chores--claude--01` — Staging deploy 0214d911 (python-slim, Tokyo): completed / serving:true / traffic_converged:true. |
| `remote_crud` | `pass` | `trial:chores--claude--01` — 22/22 of the same CRUD checks driven THROUGH the deployed app at dev-shin--chores.keelson-stage.run (paging excluded), carrying a proxy-session cookie; the identical requests without it are 401 at the edge. Writes, reads, updates and deletes all landed. REPORT.md §7.1 counted zero routes with a proven remote write; this is the first. |
| `restart_readback` | `pass` | `trial:chores--claude--01` — The service runs minScale=0, and after ~15 minutes idle the serving container logged `persist.entrypoint.app-exited signal=SIGTERM` and went away. The next request was served by a DIFFERENT container (instance ...29701701abadffd30bbc, not ...296fae82193bf251) and returned the same row, with the row count still 8. |
| `redeploy_readback` | `pass` | `trial:chores--claude--01` — A row written through revision -0214d911 was still served by revision -75a2e3c8 after a full redeploy (new image, new container, new filesystem), and the app's total held at 8 = 7 seeded + 1 written, so the startup bootstrap neither lost the row nor re-seeded over it. This is the check that separates "the data path works" from "the data path reaches the managed store": a row on the container's own disk could not have survived it. |
| `migration` | `untested` | — |
| `cold_start` | `pass` | `trial:chores--claude--01` — The scale-to-zero wake above was a cold start: the process booted, ran its `CREATE TABLE IF NOT EXISTS` bootstrap against the managed store, opened a connection and answered in 1.9s wall clock end to end (through the edge). The app under test builds its connection per request from the injected env rather than holding one at module level, so that is the shape this measurement covers; the held-connection shape was NOT exercised here. |

**The verification below is real, and the grading this row derives did not change. That combination is the point of this file.** T-0134 set out to close condition 2 and did: seven of the eight fields are `pass`, including the first proven remote write in this ledger. An attempt to upgrade the grading followed, and it was caught in review — not on the evidence, which stands, but on condition 1, which nobody had audited. `upstream_maturity` had read `stable` since this row was written, justified by "it is Turso's first-party client"; upstream's own driver list files Python under **Experimental Drivers**. Seven measured passes cannot move that field — rule 5 above says so, and this is the case that tested it. Corrected to `experimental`. chores--claude--01 (2026-07-27, T-0134) is the fixture this row had been missing. The eight DS-P2b trials put every Python app behind an ORM, so the stdlib-direct column was carried entirely by Node's `node:sqlite`, and this route sat on a resemblance to it. The trial starts from `import sqlite3` + `sqlite3.connect("chores.db")` with no ORM anywhere, so its evidence belongs to this route and to no other. **What would actually change this row's grading is upstream moving Python out of its experimental list** — not another trial here. If Keelson ever wants to certify an upstream-experimental route on its own measurements, that needs the new field and decision-rule change described in rule 5; it must not be done by relabelling this one, which is precisely what almost happened here. Two limits of the run, recorded rather than rounded off. The managed database refuses connections from outside the platform's egress ranges (Turso answers `ip_not_allowed`), so the written row was confirmed by reading it back through the app across a redeploy rather than by querying the store directly — `redeploy_readback` is doing the work a direct query would have done. And Cloudflare answers a `Python-urllib` User-Agent with `error code: 1010` before the request reaches the gateway, so the remote driver has to send a browser agent; that is a property of the edge, not of this route.

### `py-sqlalchemy-sync` — Sync SQLAlchemy / SQLModel / Flask-SQLAlchemy → `sqlalchemy-libsql-native`

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | SQLAlchemy's sync file dialect (`sqlite:///app.db`), directly or via SQLModel / Flask-SQLAlchemy |
| To | `sqlalchemy-libsql-native==0.1.0` (`sqlite+libsql_native://<host>?secure=true`), auth token via `connect_args` |
| Detection signals | `create_engine("sqlite:///`, `SQLALCHEMY_DATABASE_URI`, `SQLModel` |
| Upstream maturity | `experimental` — Keelson is the upstream for this target, which makes the temptation to grade it by our own test results acute; rule 5 rules that out, so this field is read off the published artifact alone. PyPI publishes `sqlalchemy-libsql-native==0.1.0` with Apache-2.0, Python `>=3.12,<3.13`, SQLAlchemy `>=2.0.51,<2.1`, and exact dependency `libsql==0.1.11`. Four properties of that artifact carry the label: it is a 0.x package with a single release; it carries no `Development Status` classifier; its README calls it a bridge rather than a permanent artifact and does not claim full PEP 249 conformance; and it pins `libsql==0.1.11`, which libSQL's own driver list files under "Experimental Drivers" (see py-raw-sqlite3 for that basis). The facade changes how the driver's errors surface — it does not change what upstream ships underneath it, and wrapping an experimental client does not produce a stable one. `unknown` would be the value if the artifact had not been examined; it has been, and the examination lands on `experimental`. Keelson's own tests cannot move this field in either direction. |
| Rewrite scope | `connection_only` — The engine URL and the auth-token argument move; the ORM, models, queries and schema do not. The target package owns the DBAPI facade, remote URL, typed exception mapping, disconnect classification, and remote NullPool default. The token still goes in `connect_args={"auth_token": ...}`; `?authToken=` is not the dialect contract. These are connection details, not a reach past the connection. |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `untested` | — |
| `remote_deploy` | `untested` | — |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

Evidence from the former `sqlalchemy-libsql` target is not transferred to this target. T-0053's 2026-08-16 Tier 3 attempt confirmed the staging target and provisioned its fixture, but the new application failed the deployment health check and traffic remained on the old revision. The run therefore never reached connect 10/10 or any of the seven acceptance items. Under evidence rules 1 and 3, every verification field for this route remains `untested`; the blocked task-doc attempt is recorded here as context, not converted into a `pass`.

### `py-sqlalchemy-async` — Async SQLAlchemy (async engine over `aiosqlite`) → `sqlalchemy-libsql-native` bridge

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | `create_async_engine("sqlite+aiosqlite:///app.db")`, async routes throughout |
| To | `sqlalchemy-libsql-native==0.1.0`, called from the async handlers through a worker thread (`to_thread` bridge) |
| Detection signals | `create_async_engine`, `sqlite+aiosqlite`, `async_sessionmaker` |
| Upstream maturity | `experimental` — This bridge's target is the same published sync package as py-sqlalchemy-sync, reached through a worker thread, so it carries the same label for the same reasons: `sqlalchemy-libsql-native==0.1.0` is a 0.x single release with no `Development Status` classifier, its README limits its claim to the SQLAlchemy compatibility surface and calls it a bridge rather than a permanent artifact, and it pins `libsql==0.1.11`, which upstream files under "Experimental Drivers" (see py-sqlalchemy-sync for the full basis). The DIRECT async paths do not exist at all — `create_async_engine` over a libSQL dialect raises, the undocumented `sqlite+aiolibsql` dialect raises `AwaitRequired` on first execute, and the one real async client (`libsql-client`) was archived 2025-06-11 (research-request-async-sqlalchemy-libsql.md §8.2, §8.3, §8.4). The bridge is the route BECAUSE the direct ones are absent — but the bridge's own upstream is the experimental sync package, and that is what this field records. |
| Rewrite scope | `beyond_connection` — The unit of work has to become synchronous: engine/session construction, the lifespan, and each DB block move onto the bridge (tickets: 6 blocks). Models, `select()` expressions, validation and HTML survive. The research doc is precise that this is neither end of the scale — "not a full rebuild of the heart, but not a one-line connection-string swap either" (§8.5). It is past the connection, so it is not a mechanical swap. |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `untested` | — |
| `remote_deploy` | `untested` | — |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

Evidence from the former target and its bridge is not transferred to this target. T-0053's 2026-08-16 Tier 3 run used the new package but stopped at deployment health-check failure before connect 10/10 or any acceptance endpoint; traffic stayed on the old revision. Because that task-doc is not a verification-field artifact under evidence rule 1, and because the run did not exercise the acceptance items anyway, every field remains `untested`. Its rewrite scope remains `beyond_connection`; the worked new-target fixture is `resources/sample-apps/fastapi-sqlalchemy-tickets-keelson`.

### `py-django-file-sqlite` — Django with a file SQLite `DATABASES` backend

**Derived by `core/DECISION.md`: `unsupported`.**

| | |
|---|---|
| From | `DATABASES.default.ENGINE == "django.db.backends.sqlite3"` |
| To | — no supported route exists — |
| Detection signals | `django.db.backends.sqlite3`, `DATABASES` |
| Upstream maturity | `none` — `django-libsql` is community-maintained, pinned to Django 5.0.x, and depends on `libsql-experimental`; the vendor's own support for it is Beta. None of that can carry a platform guarantee (§4-4 of the source task). expenses--claude--01 independently reached the same conclusion and rejected `django-libsql` for exactly this reason (REPORT.md §5.7). |
| Rewrite scope | `no_libsql_path` — Django's ORM reaches SQLite through a backend, and no supported libSQL backend exists — so there is no rewrite to grade. Owner ruling §13-2-3 records this route as having no path to libSQL. |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `untested` | — |
| `remote_deploy` | `untested` | — |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

> **External-database route (the only way this stack deploys):** `db.mode: none` + connection details via `secrets` (e.g. hosted PostgreSQL).
>
> This is the ONLY way Django deploys to Keelson. It is not a fallback for the file-SQLite case — it is a different app configuration, and it requires the user to have an external database to point at. The production-hardening rules (DEBUG default False, SECRET_KEY, CSRF_TRUSTED_ORIGINS) still apply to it in full: this row narrows Django's reachable paths to one, it does not make Django's hardening moot. expenses--claude--01 solved the CSRF/Origin and DEBUG/SECRET_KEY problems on its own (REPORT.md §5.7).

> **Evidence that is NOT this route's — `trial:expenses--claude--01`.** expenses--claude--01 deployed successfully, but onto the withdrawn file-replication mode with the Django ORM intact. It is zero evidence that Django can reach libSQL.

Re-run under the libSQL-only bundle as expenses--claude--04 (DS-P2b): the agent said the app cannot be deployed and offered only the external-DB route — the refusal §13-3 requires, with no half-deploy.

### `go-databasesql` — Go file SQLite driver → `database/sql` + pure-Go libSQL driver

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | a file SQLite driver (typically cgo `mattn/go-sqlite3`) |
| To | `database/sql` + `github.com/tursodatabase/libsql-client-go` (pure Go, builds with CGO_ENABLED=0) |
| Detection signals | `mattn/go-sqlite3`, `database/sql` |
| Upstream maturity | `stable` — Turso's first-party Go client, and pure Go: rooms--claude--01 built it with `CGO_ENABLED=0 GOOS=linux GOARCH=amd64` (REPORT.md §5.6). The cgo-free build is a property of what upstream ships, which is why it is cited here; that the deployed app then served is a Keelson observation and is recorded under `remote_deploy` below, not as a basis for this label. |
| Rewrite scope | `beyond_connection` — Go is the asymmetric stack: the pure-Go client cannot open `file:` URLs, so there is no local-dev fallback to swap to. Meeting Local Development Parity means GENERATING AND VERIFYING a local libSQL endpoint (`sqld` / `turso dev`) — that is not a swap, it is new work outside the data layer (core/DECISION.md → Stacks with no `file:` mode). |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `fail` | `trial:rooms--claude--01` — `local_dev_preserved.pass: false` in rooms--claude--01.grade.json: the adapted app requires `KEELSON_DB_URL` and can no longer start under `go run .`. The trial deployed a green app that no longer ran on its owner's machine — this is the incident that made Local Development Parity a first-class norm (core/DECISION.md), and it is recorded as `fail` rather than `untested` because the local path was not merely unexercised, it was removed. |
| `remote_deploy` | `pass` | `trial:rooms--claude--01` — completed, `GET /` → 200, seed rows confirmed via libSQL — but only after working around the `deploy --new` CreateApp flake by hand (5–6 consecutive `code:transient` failures; REPORT.md §5.6, F7). |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

The seed rows in rooms--claude--01 were written VIA libSQL directly, not through the deployed app, so they are not `remote_crud`. Nothing in that trial proves a write made through the app survives.

### `go-gorm-cgo` — Go GORM on a cgo-only SQLite driver (`gorm.io/driver/sqlite`)

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | `gorm.Open(sqlite.Open("data.db"))` (mattn cgo driver, CGO_ENABLED=1) |
| To | — no libSQL path for GORM; the ORM has to be dropped for go-databasesql — |
| Detection signals | `gorm.Open(sqlite.Open`, `gorm.io/driver/sqlite` |
| Upstream maturity | `none` — GORM has no libSQL driver, official or otherwise. Its SQLite driver is the cgo `mattn` one, which also cannot build under the CGO_ENABLED=0 runtime. |
| Rewrite scope | `beyond_connection` — The ORM leaves: GORM's calls become SQL and `AutoMigrate` becomes hand-written `CREATE TABLE IF NOT EXISTS`. rooms--claude--01 changed 197 lines of main.go doing it (REPORT.md §5.6). |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `untested` | — |
| `remote_deploy` | `untested` | — |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

> **Evidence that is NOT this route's — `trial:rooms--claude--01`.** THIS ROUTE CARRIES NO PASS EVIDENCE, AND THE rooms TRIAL IS NOT ITS EVIDENCE. rooms--claude--01 started on GORM and REMOVED it — it verified `database/sql` + the pure-Go libSQL driver instead. That evidence belongs to go-databasesql, where it is recorded (including its `local_crud: fail`). Reading "rooms deployed green" as "GORM works on Keelson" inverts what the trial actually established: GORM could not come.

Every verification field is `untested` and that is correct — there is nothing to run, because no GORM route to libSQL exists. The rewrite on record is the one rooms performed: drop the ORM and land on go-databasesql.

### `prisma-v6` — Prisma 6 (SQLite provider) → `@prisma/adapter-libsql`

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | `datasource db { provider = "sqlite" url = "file:./dev.db" }`, Prisma Client 6.x |
| To | `@prisma/adapter-libsql` + `@libsql/client`, adapter pinned to the client's major |
| Detection signals | `prisma/schema.prisma`, `provider = "sqlite"` |
| Upstream maturity | `stable` — Prisma driver adapters went GA in Prisma 6.16.0 (official docs). The version actually measured working on Keelson is 6.19.3 (deals--claude--01). NOTE: REPORT.md records the trial operator's claim of "GA in 6.7+" as an error corrected in review — 6.16.0 is the GA, 6.19.3 is the measurement. The 6.7 figure is not a fact about this route. |
| Rewrite scope | `beyond_connection` — Three changes past the connection, all measured in deals--claude--01 (REPORT.md §5.8): the adapter has to be version-pinned to the client's major (npm resolved 7.x against a 6.x client and broke); Next.js/webpack needs the native client in `serverExternalPackages`; and the migration path moves, because `prisma migrate deploy` does not work against a remote libSQL database. |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `unknown` | `trial:deals--claude--01` — INCONCLUSIVE, not passing. The local production build + startup smoke covered schema creation, seeding and list rendering (REPORT.md §5.8) — create and read. Update and delete were not exercised, so it does not establish the CRUD path this field records. |
| `remote_deploy` | `pass` | `trial:deals--claude--01` — completed / serving / traffic_converged; `keelson diagnose` reported `db_mode: libsql` (REPORT.md §5.8). |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `fail` | `trial:deals--claude--01` — `prisma migrate deploy` does not support a remote libSQL database. deals--claude--01 removed it from `start` and applied idempotent startup DDL (`CREATE TABLE IF NOT EXISTS` via `$executeRawUnsafe`) kept in sync with migration.sql by hand (REPORT.md §5.8). This is a real, reproducible upstream limit, not a trial artefact. |
| `cold_start` | `untested` | — |

deals--claude--01 is EXCLUDED from REPORT.md's analysis of agent CHOICE (the orchestrator's pane-move dismissed the agent's AskUserQuestion, and the agent recorded it as a user decision — §3, §9). That contamination is about which path was chosen; the technical facts the trial then measured (the three traps above, the deploy) are unaffected and are what this row records. The startup-DDL workaround it used is bootstrap-only: idempotent `CREATE TABLE IF NOT EXISTS` on a single-table greenfield schema, kept in sync with migration.sql by hand. It is not a migration path, which is why the `migration` field above stays `fail`.

### `prisma-v7` — Prisma 7 (SQLite provider) → `@prisma/adapter-libsql`

**Derived by `core/DECISION.md`: `ask`.**

| | |
|---|---|
| From | `datasource db { provider = "sqlite" ... }`, Prisma Client 7.x |
| To | `@prisma/adapter-libsql` 7.x |
| Detection signals | `prisma/schema.prisma`, `provider = "sqlite"` |
| Upstream maturity | `unknown` — NOT ASSESSED — and note that means the upstream itself has not been assessed, not merely that Keelson has not run it (that second fact is what the `untested` verification fields below record; the two are different claims and this field only makes the first). Prisma 7 changes connection configuration and how driver adapters are handled, so v6's GA does not carry across — which is exactly why this is a separate id from prisma-v6 and not a version note on it. The only v7 datum in evidence is negative: npm pulling adapter 7.x against a 6.x client is what BROKE deals--claude--01 until it pinned 6.19.3 (REPORT.md §5.8). |
| Rewrite scope | `beyond_connection` — Assumed at least as invasive as prisma-v6 (adapter + bundler config + migration path). Unverified here. |

| Verification | Status | Evidence |
|---|---|---|
| `static` | `untested` | — |
| `local_crud` | `untested` | — |
| `remote_deploy` | `untested` | — |
| `remote_crud` | `untested` | — |
| `restart_readback` | `untested` | — |
| `redeploy_readback` | `untested` | — |
| `migration` | `untested` | — |
| `cold_start` | `untested` | — |

Nothing has been run on Prisma 7 here. The ids are separate because the major moved the parts v6's evidence is about — connection configuration and driver-adapter handling — so v6's measurement says nothing about this row.

## Scope, and a known gap

This ledger covers **database routes onto libSQL**. The `files` / `media` SDK
rows in `core/DECISION.md`'s grading table are **not** here: their grading rests
on the shape of the SDK call (a key-addressed overwrite is one-for-one; a minted
ID needs a column to hold it), not on route evidence.

**State that plainly**: the `files` SDK state-file rewrite is graded `auto` with
**no verification evidence in this ledger** because this ledger's scope is
database routes, not file SDK calls. That is a real gap between this file's rule
("`auto` needs `local_crud: pass`") and that row. It is recorded here rather
than papered over.
