# Reference: libSQL Clients

Per-language libSQL client detail — package names, connection strings, return
shapes, and the sync→async call mapping. The stack recipes
(`stacks/{python,node,go}.md`) show where these go; this file is the client-level
detail so an agent never has to discover it by writing a smoke test.

The connection contract shared by all three (`KEELSON_DB_URL` /
`KEELSON_DB_AUTH_TOKEN`, the `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`
compatibility aliases, and the environment-leak rules) is in `core/DECISION.md`
→ SQLite→libSQL. `db.mode` selection is in `core/DECISION.md` → Data &
Persistence. A worked, deploy-tested Python example is
`resources/sample-apps/libsql-crud`.

| Language | Client | Recipe |
|---|---|---|
| Python | `libsql` (import name `libsql`) | `stacks/python.md` → SQLite→libSQL |
| Node.js | `@libsql/client` | `stacks/node.md` → SQLite→libSQL |
| Go | `github.com/tursodatabase/libsql-client-go/libsql` (pure Go) | `stacks/go.md` → SQLite→libSQL |

## Write discipline — the 5-second interactive-transaction budget

The managed store is SQLite reached over the network, and it holds two limits
that no client setting relaxes. Write **every** app against them, from the first
line — retrofitting a write path that ignores them means rewriting it under a
live incident.

| Limit | Value | Source |
|---|---|---|
| Interactive write transaction timeout | **5 seconds** (fixed, not tunable) | Turso docs |
| Connection / stream idle expiry | **~10 seconds** with no queries | Observed + GitHub issues (tursodatabase/libsql#925) |
| Write concurrency | **single writer** (primary serialises writes) | Turso docs |

The 5-second cap is the one that decides how you write code: **libSQL aborts an
interactive write transaction that stays open for 5 seconds** and blocks every
other writer for that whole window. Measured behaviour on the managed store has
been more lenient than 5 seconds — do **not** rely on that. The docs say 5, the
runtime can tighten to 5 without notice, and code that only works because the
runtime is currently generous is code that breaks the moment it stops being.

### The six absolute rules

1. **Never hold one write transaction open for 5 seconds or more.** libSQL
   aborts it at the boundary and blocks other writers for the whole window.
2. **Batch every bulk write** — CSV import, seed, backfill, backup restore.
   Use a multi-row `INSERT`, `executemany`, or the client's batch API in chunks
   of a few hundred to a few thousand rows, and commit each chunk. Each chunk
   must fit comfortably inside the 5-second budget.
3. **Validate and transform outside the transaction.** By the time a `BEGIN`
   runs there should be nothing left to compute or check.
4. **Never wait for a slow thing while a write transaction is open** — no
   outbound HTTP, no heavy CPU, no waiting on user input.
5. **Serialise writes.** libSQL has a single writer per primary; adding
   concurrent write paths only turns collisions into `SQLITE_BUSY` retries.
6. **Make bulk work idempotent and resumable.** Upsert on a business key
   (`INSERT ... ON CONFLICT DO UPDATE`) and record progress, so a failed chunk
   can safely re-run from where it stopped.

### Bulk-write recipe (CSV / seed / backfill)

```text
❌ anti-pattern
   BEGIN
   for row in tens_of_thousands:
       validate(row)
       INSERT(row)
   COMMIT
   # one transaction held for the whole loop → aborted at 5s, blocks every
   # other writer for that window, and per-row round-trips are slow anyway.

⭕ recipe
   1. parse and validate the whole file OUTSIDE any transaction
   2. group rows into chunks of 500–1000
   3. INSERT each chunk as ONE multi-row statement, then commit
      (INSERT ... ON CONFLICT DO UPDATE for idempotency)
   4. record the last chunk you finished, so a resume starts from it
   5. present the upload as one operation to the user; split internally
```

Batching is not "for a slow platform" — it is what makes bulk writes fast here.
Measured: millions of rows copy in seconds when written as multi-row batches
(a 2-million-row copy finishes in single-digit seconds; a 5-million-row rebuild
runs ~1.3 s). "Large data unsupported" is the wrong message; the message is
**"large data goes in batches."**

### Schema migration recipe

Use `db.migrate` in `keelson.yaml` for schema that must converge on every deploy
(`core/KEELSON_YAML.md`). The command runs once on the new image before traffic
moves, so a non-zero exit leaves the old revision serving. Small, idempotent
bootstrap DDL may still run at app startup; that path must be safe under
concurrent replicas cold-starting together. The write and batching rules below
apply to either path.

- **Prefer additive DDL** — `ADD COLUMN`, `CREATE INDEX`, `CREATE TABLE`. A
  single DDL statement is not held under the interactive-write cap and completes
  as fast as the store can do the work. Measured: `CREATE INDEX` on 2 million
  rows finishes in ~10 seconds as one statement; single statements have
  completed up to ~28 seconds without the cap firing. Prefer forms that are
  safe to run twice — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT
  EXISTS` — because two replicas can race the same DDL on boot.
- **Type / constraint changes still need a table rebuild** (`CREATE new` →
  `INSERT ... SELECT` → `DROP` → `RENAME`). The `INSERT ... SELECT` is one
  statement and stays fast. What breaks the migration is wrapping the whole
  sequence in one long-running client transaction while doing slow work in the
  app between statements — the connection can hit the ~10-second idle expiry.
  For very large tables, move the data copy into batches (`INSERT ... SELECT`
  with a `WHERE id BETWEEN ...` range, committed per range) rather than one
  monster statement. A table rebuild is **not** idempotent under a boot race
  and does not belong on the startup path; run it through `db.migrate` or
  serialise it out of band.
- **Truly enormous tables** (tens of millions of rows) are bounded by
  wall-clock, memory, and instance runtime — not by the 5-second interactive
  cap. Design for it, or say plainly that the migration will take minutes.

Bootstrap DDL is safe as-is only for a single-table, greenfield schema that a
concurrently-booting replica could also run without harm. Racing Alembic on
boot is the shape that is **not** safe (Alembic does not protect itself from
concurrent execution) — put migrations in `db.migrate`, or use an operator-run
`keelson db apply` for a one-off change.

### Errors — how they arrive, and how to recover

The raw Python `libsql` client does not raise a PEP 249 / DBAPI exception
hierarchy, so matching on Python's `sqlite3.*Error` classes does **not** catch
its errors. The `sqlalchemy-libsql-native` facade is the exception: it maps
constraints to SQLAlchemy's typed exceptions as described below.

| Error message | Cause | Recovery |
|---|---|---|
| `stream not found` / `stream has expired due to inactivity` | Connection idled past ~10 s with no queries; the underlying Hrana stream was dropped | Discard the connection. Retry the **whole** operation from its start only when it is idempotent and the possible commit result has been resolved — never resume a half-open transaction on a fresh stream. Do not hold connections idle; take one per unit of work (Python: use `NullPool`, see the SQLAlchemy section) |
| `TRANSACTION_TIMEOUT` / `Transaction timed out` | Interactive write transaction stayed open ≥ 5 s, or lost a write conflict | Shorten the transaction, split it into batches, and drop any concurrent write paths |
| `SQLITE_BUSY` / `database is locked` | Two writers collided | Serialise app writes; retry with capped exponential backoff |
| `UNIQUE constraint failed` raised as bare `ValueError` | The raw Python `libsql` client has no typed DBAPI exceptions | With the raw client, resolve the duplicate in SQL — `INSERT ... ON CONFLICT DO NOTHING / DO UPDATE` — or match on the message string. With `sqlalchemy-libsql-native`, ordinary `except sqlalchemy.exc.IntegrityError:` works. See `stacks/python.md` → "Four stdlib behaviours" and the SQLAlchemy section below |
| `NOT NULL constraint failed` raised as bare `ValueError` (not `IntegrityError`) | Same driver trait — no DBAPI exception hierarchy | This is an **input** bug, not a conflict: `ON CONFLICT` does not handle it (the SQLite engine raises `NOT NULL` before the conflict clause runs, verified against the client). Validate the row before `execute()` and either default the missing column or reject the write with a caller-side error. If you must catch, catch `ValueError` around the specific `execute()` and match on the message |

The stream-not-found row is the one that trips retries. Retry logic that reuses
the same connection because "the driver said it was disconnected" hits the
error again on the next call — a stream is per-connection state, and the
connection has to be rebuilt, not pinged.

## Node.js — `@libsql/client`

`createClient({ url, authToken })`. **Every call is async** — `execute`,
`batch`, `transaction` all return promises. There is no synchronous API, so the
sync→async conversion is part of any swap from `better-sqlite3` / `node:sqlite`.

`execute(sql)` or `execute({ sql, args })` resolves to a **ResultSet**:

| Field | Shape |
|---|---|
| `rows` | array of row objects — column name → value (also index-accessible) |
| `columns` | array of column-name strings |
| `rowsAffected` | number of rows an `INSERT`/`UPDATE`/`DELETE` changed |
| `lastInsertRowid` | `bigint` of the last inserted rowid (or `undefined`) |

The sync→async mapping from the synchronous drivers:

| better-sqlite3 / node:sqlite | `@libsql/client` |
|---|---|
| `stmt.get(...)` (one row) | `(await db.execute({ sql, args })).rows[0]` |
| `stmt.all(...)` (all rows) | `(await db.execute({ sql, args })).rows` |
| `stmt.run(...)` (write) | `(await db.execute({ sql, args })).rowsAffected` / `.lastInsertRowid` |

- **`intMode`.** Integer columns come back as JavaScript `number` by default;
  values beyond `Number.MAX_SAFE_INTEGER` are lossy. If the app stores large
  integer ids or bitfields, construct with `intMode: "bigint"` (or `"string"`)
  and handle the returned type accordingly.
- **Placeholders.** Positional `?` with an `args` array, or named `:name` with an
  `args` object — the same SQL the file drivers used.
- **Next.js build.** The native client must be externalized:
  `serverExternalPackages: ["@libsql/client"]` (`stacks/node.md` → Prisma / Next).

## Python — `libsql`

Import name is `libsql` (not `libsql-client`, not `libsql-experimental`, not
`pysqlite`). `libsql.connect(url, auth_token=...)` returns a DB-API-style
connection:

- `conn.execute(sql, params)` returns a cursor; `.fetchone()` / `.fetchall()`
  return tuples (`.fetchone()[0]` for a scalar), like stdlib `sqlite3` in its
  default configuration. **There is no `row_factory`** to change that — the
  connection has no such attribute, so `sqlite3.Row`-style access by column name
  has to be rebuilt from `cursor.description`.
- **`conn.commit()` is explicit** — writes are not autocommitted. Call it before
  reading the row back through a fresh connection.
- Positional params are a `?`-placeholder tuple, same as `sqlite3` — but the
  stdlib **type adapters do not apply**: `sqlite3.register_adapter` has no effect
  here and a `datetime` parameter raises a bare `ValueError`.
- `executemany`, `cursor.lastrowid`, `cursor.rowcount` and `with conn:`
  (commit on exit / rollback on exception) behave as the stdlib does.
- **No DBAPI exception hierarchy.** A constraint violation is a bare
  `builtins.ValueError` ("NOT NULL constraint failed: ..."), not
  `sqlite3.IntegrityError` — so duplicate handling must not depend on catching a
  typed error. The SQLAlchemy facade below deliberately maps this raw error to
  a typed exception.

All measured on `libsql==0.1.11` (`reference/SUPPORT_LEDGER.md` →
`py-raw-sqlite3`). The rewrite that carries them is `stacks/python.md` →
SQLite→libSQL → "Four stdlib behaviours that do NOT come with the connection".

### SQLAlchemy — `sqlalchemy-libsql-native`

For SQLAlchemy / SQLModel / Flask-SQLAlchemy (`stacks/python.md` → SQLAlchemy),
the connection differs from the raw client:

- **Dependency:** exact-pin `sqlalchemy-libsql-native==0.1.0`; it supports Python
  `>=3.12,<3.13`, SQLAlchemy `>=2.0.51,<2.1`, and pins `libsql==0.1.11`. The
  package is upstream-**experimental** (0.x single release, no `Development
  Status` classifier, and the `libsql` client it pins is one upstream files
  under "Experimental Drivers"). The facade below changes how that client's
  errors surface; it does not make the client underneath a stable one.
- **Dialect URL:** `sqlite+libsql_native://<host>?secure=true`. Derive `<host>` from
  `KEELSON_DB_URL` by stripping the `libsql://` (or `https://`) scheme;
  `?secure=true` selects the HTTPS transport.
- **The auth token goes in `connect_args`, not the URL.** Pass
  `create_engine(url, connect_args={"auth_token": token})`.
- **`poolclass=NullPool` is required** on Keelson, and `pool_pre_ping=True` does
  **not** substitute for it. Version 0.1.0 also defaults remote URLs to NullPool;
  keep the application setting explicit. QueuePool remains an opt-in verification
  path, not the shipping recipe.
- **Typed constraint errors work.** UNIQUE / FOREIGN KEY / NOT NULL failures
  surface as `sqlalchemy.exc.IntegrityError`, with the raw `ValueError` retained
  as the cause. This mapping does not make an ambiguous commit safe to retry:
  retry only an idempotent whole unit of work on a fresh connection.
- **Serialise write producers across replicas.** Put bulk/background writes
  through one Job path; a process-local lock alone does not coordinate replicas.

## Go — `github.com/tursodatabase/libsql-client-go/libsql`

Pure Go: importing it for side effects registers the `libsql` driver, and it
builds under the runtime's `CGO_ENABLED=0`.

```go
// contract:skip — driver registration + DSN
import (
    "database/sql"
    _ "github.com/tursodatabase/libsql-client-go/libsql"
)

// DSN = the libsql:// URL with the token as a query parameter (Go's client
// takes it in the DSN, unlike Python's connect_args).
dsn := os.Getenv("KEELSON_DB_URL") + "?authToken=" + os.Getenv("KEELSON_DB_AUTH_TOKEN")
db, err := sql.Open("libsql", dsn)
```

- **Not the cgo client.** `github.com/tursodatabase/go-libsql` (similar name) is
  cgo-based and fails the `CGO_ENABLED=0` build with `build constraints exclude
  all Go files`. `mattn/go-sqlite3` compiles but only as a stub that errors on
  first query. Neither is the client above (`stacks/go.md` → the four Go traps).
- **No `file:` fallback.** This client cannot open `file:` URLs, so Go keeps
  local-dev parity with a real local libSQL endpoint (`sqld` / `turso dev`), not
  a file (`stacks/go.md` → the local development path).
- Standard `database/sql` from there: `db.Query` / `db.QueryRow` / `db.Exec`,
  `rows.Scan` into typed destinations.
