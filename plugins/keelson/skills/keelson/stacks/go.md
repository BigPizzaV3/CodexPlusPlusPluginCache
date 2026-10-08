# Stack: Go

The Go-specific rewrites. Read this together with `core/DECISION.md` (which
recipe applies and why) and `core/KEELSON_YAML.md` (the config contract). This
file is self-contained for Go — you do not need `stacks/node.md` or
`stacks/python.md`.

Runtimes: `go-slim` (default) / `go-media`. Dependencies come from `go.mod` /
`go.sum`; the build runs `go mod download`, then
`go build -o /workspace/app .`, and the binary is started via `command: "./app"`.

**Go builds run with `CGO_ENABLED=0`.** That single fact drives every rule below.

## Recipe: bind to `PORT` and `0.0.0.0`

The app must listen on the injected `PORT` and bind `0.0.0.0`. A hard-coded port
or a `127.0.0.1` / `localhost` bind will not receive traffic.

```go
// contract:skip — Go before/after
// BEFORE
http.ListenAndServe("127.0.0.1:8080", nil)
// AFTER
port := os.Getenv("PORT"); if port == "" { port = "8080" }
http.ListenAndServe("0.0.0.0:"+port, nil)
```

## Recipe: graceful shutdown on `SIGTERM`

Do not leave `ListenAndServe` as a blocking one-liner. Keelson sends `SIGTERM`
before stopping an instance; stop accepting new connections, let in-flight
requests finish, and keep the drain deadline inside the platform's ten-second
termination window. This standard-library shape also works when a Gin or Echo
router is passed as `handler`:

```go
// contract:skip — graceful HTTP server lifecycle
func run(handler http.Handler) error {
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    server := &http.Server{
        Addr:    "0.0.0.0:" + port,
        Handler: handler,
    }
    serveErr := make(chan error, 1)
    go func() { serveErr <- server.ListenAndServe() }()

    signalCtx, stop := signal.NotifyContext(
        context.Background(), os.Interrupt, syscall.SIGTERM,
    )
    defer stop()

    select {
    case err := <-serveErr:
        if errors.Is(err, http.ErrServerClosed) {
            return nil
        }
        return err
    case <-signalCtx.Done():
        shutdownCtx, cancel := context.WithTimeout(context.Background(), 9*time.Second)
        defer cancel()
        if err := server.Shutdown(shutdownCtx); err != nil {
            _ = server.Close()
            return err
        }
        return nil
    }
}
```

Import `context`, `errors`, `net/http`, `os`, `os/signal`, `syscall`, and
`time`. `http.Server.Shutdown` closes listeners and idle connections, then waits
for active requests; do not replace it with an immediate `os.Exit` or
`server.Close`, which cuts those requests off.

## Recipe: SQLite file → Keelson Managed SQLite (libSQL)

Replace the direct-file SQLite driver with the libSQL client and set
`db.mode: libsql`.

```yaml
# keelson.yaml — fragment. Merge into your file; required fields are in core/KEELSON_YAML.md.
db:
  mode: libsql
```

Use `github.com/tursodatabase/libsql-client-go/libsql`. It is pure Go, it
registers the `libsql` driver, and it builds under the runtime's `CGO_ENABLED=0`.
Use the measured module version `github.com/tursodatabase/libsql-client-go v0.0.0-20260528064733-9d5d30a29a60`.

Install that version using the module path (the dependency unit), not the
`/libsql` package path used by the Go import below:

```bash
# contract:skip — pinned libSQL module dependency
go get github.com/tursodatabase/libsql-client-go@v0.0.0-20260528064733-9d5d30a29a60
```

```go
import (
    "database/sql"
    _ "github.com/tursodatabase/libsql-client-go/libsql"
)

// KEELSON_DB_URL is a libsql:// URL; pass the token as a query parameter.
dsn := os.Getenv("KEELSON_DB_URL") + "?authToken=" + os.Getenv("KEELSON_DB_AUTH_TOKEN")
db, err := sql.Open("libsql", dsn)
```

**Do not add a `file:` local-dev fallback in Go.** The Node client can do
`?? "file:local.db"` because `@libsql/client` speaks `file:` natively. The Go client
does not: `sql.Open("libsql", "file:local.db")` then fails with `no sqlite driver
present. Please import sqlite or sqlite3 driver`, so the fallback forces you to link a
pure-Go **file** SQLite driver back into the deployed binary — the very thing this
recipe removes. Under `db.mode: libsql` the platform always injects
`KEELSON_DB_URL`; if it is missing, fail loudly rather than silently writing to an
ephemeral local file.

> This is the one place Go is asymmetric with the other stacks: every other
> stack keeps a `file:` fallback, and Go must not. Do not copy the fallback
> pattern across from `stacks/node.md` or `stacks/python.md`.

## Recipe: the local development path (required with the libSQL swap)

Go cannot keep parity with a `file:` fallback, so it keeps it with a **real local
libSQL endpoint**. This recipe is not optional decoration on the swap above — it
is the other half of it. Ship all three parts:

**1. A local server.** `sqld` (or `turso dev`) speaks the same protocol as the
managed store, so the app's code path is identical locally and on Keelson —
no build tags, no second driver, nothing to diverge.

```bash
# contract:skip — local dev, from the project root
turso dev --db-file local.db --port 18180  # or: sqld --http-listen-addr 127.0.0.1:18180
# leaves a libSQL endpoint on http://127.0.0.1:18180
```

`sqld --db-path` takes a **directory**, not a database file. Passing an existing
`.db` file makes `sqld` fail with `File exists (os error 17)`. This is asymmetric
with `turso dev --db-file`, which takes a file path.

**2. The env that points at it**, committed where the user will find it (a
`.env.example`, a `Makefile`/`justfile` target, and a line in the README):

```bash
# contract:skip — .env.example
KEELSON_DB_URL=http://127.0.0.1:18180
KEELSON_DB_AUTH_TOKEN=
```

Note the app needs no code change for this: the same `os.Getenv("KEELSON_DB_URL")`
reads the local endpoint here and the managed one on Keelson. That is the point
of the asymmetry — Go trades the `file:` fallback for an identical code path.

**3. Verification — you must actually run it.** Start the endpoint, start the
app with that env, and exercise the main CRUD path (`core/DECISION.md` checklist
step 8). Generating instructions is not verification: an unverified local path is
a guess handed to the user as a fact, and the guess is what broke `rooms`.

If you cannot get it running — the tool will not install, the app needs something
`sqld` does not provide — **stop and report why**. Do not deploy an app whose
author can no longer run it and say nothing.

Four Go traps, all verified against `CGO_ENABLED=0` (2026-07-10):

- `github.com/tursodatabase/go-libsql` is **cgo-based** and does not build here —
  it fails with `build constraints exclude all Go files`. Despite the similar name,
  it is not the client above.
- `github.com/mattn/go-sqlite3` **does** compile under `CGO_ENABLED=0`, but only as a
  stub. It registers the `sqlite3` driver and `sql.Open` succeeds, then the first
  query fails with `requires cgo to work. This is a stub`. It is broken, not rejected.
- A pure-Go **file** SQLite package (`modernc.org/sqlite`, `glebarez/*`,
  `ncruces/go-sqlite3`) builds and runs perfectly. That is exactly why it is the
  worst choice: the file lives on an ephemeral disk, so every write is **silently
  lost** on scale-to-zero, with a green build and no error. Never use one as the
  app's database — there is no mode that would make that file durable (see
  `core/DECISION.md` → Data & Persistence). The only exception is a database the
  app is *meant* to lose, declared with `db.local_sqlite`.
- Re-linking one of those drivers "just for the local `file:` fallback" reintroduces
  the same hazard into the shipped binary. Don't.

After rewriting: no cgo or pure-Go **file** SQLite driver should remain in the
data path, and the app must read `KEELSON_DB_URL`. The environment-leak rules
that come with holding `KEELSON_DB_AUTH_TOKEN` are in `core/DECISION.md` →
SQLite→libSQL.

### Moving an existing file's data (there is no path for it)

The swap moves the *code*, not the *rows*. The managed database starts **empty**:
the app recreates its schema (the `CREATE TABLE IF NOT EXISTS` runs against
libSQL), and the rows already in the old `.db` file are **not** carried over.
Keelson does not ship a data-move step today — an agent can produce a SQL dump of
the old file locally (`sqlite3 app.db .dump > dump.sql`), and load it with
`keelson db apply dump.sql --app <slug>` (`reference/DB_APPLY.md`: 16 MiB per
apply; once the database is non-empty an apply needs the user's approval). If the
existing file holds data the user would miss, this is an `ask`, and the proposal
must say plainly that existing rows will not come across (`core/DECISION.md` → the
existing-data trigger).

## Recipe: GORM on a cgo SQLite driver → `database/sql` + libSQL

GORM (`gorm.Open(sqlite.Open("data.db"))`, driver `gorm.io/driver/sqlite`) has
**no** libSQL path: its only SQLite driver is the cgo `mattn` one, which does not
build under the runtime's `CGO_ENABLED=0`, and there is no libSQL GORM driver
official or otherwise. So there is nothing to swap — **the ORM has to be dropped**
and the data layer rewritten onto `database/sql` with the pure-Go libSQL driver
above. That is invasive, so this is an **`ask`**: propose it and wait for approval
(`core/DECISION.md` → Grading / Wording templates).

What the rewrite touches:

- `gorm.Open(...)` becomes `sql.Open("libsql", dsn)` (the DSN from the
  SQLite→libSQL recipe above).
- GORM model methods (`db.Create`, `db.Find`, `db.Where(...).First`, …) become
  hand-written SQL through `database/sql` (`db.Exec`, `db.Query`, `db.QueryRow`).
- `AutoMigrate` becomes explicit `CREATE TABLE IF NOT EXISTS` statements. The
  same startup-DDL caveat applies: it is safe only as a bootstrap of a greenfield
  schema, not as a migration path.
- The struct tags GORM read (`gorm:"..."`) no longer do anything; the field
  mapping moves into the `Scan`/`Exec` argument lists.

The tables' shape stays the same — this changes *how* the app talks to the
database, not the schema. Follow the local-dev path recipe above (a real local
libSQL endpoint), since the pure-Go client still cannot open a `file:` URL.

## Recipe: File I/O → `files` SDK / `media` SDK

Which of the two applies (or whether it belongs in the database) is decided by
`core/DECISION.md` → Recipe: local file I/O. This is the Go call shape.

Declare the SDK before importing either package: run
`go get github.com/keelsonhq/go-sdk`, then commit the resulting `go.mod` and
`go.sum` changes.

### `files` — a file the app names and updates (`auto`)

Replace `os.WriteFile` / `os.ReadFile` with the `files` package. The key is the
old filename:

```go
// contract:skip — Go before/after
// BEFORE
b, err := json.Marshal(d)
os.WriteFile("seen_urls.json", b, 0o644)
b, err = os.ReadFile("seen_urls.json")
if os.IsNotExist(err) { b = []byte("[]") }

// AFTER
import "github.com/keelsonhq/go-sdk/files"

// Like every Keelson Go package, files is client-based. New() resolves the mode
// from the environment: on Keelson (KEELSON_MODE=keelson) missing config is an
// error, never a silent local write; with no Keelson env it is local mode and
// writes ./.keelson/files/ — so `go run .` still works.
client, err := files.New()
if err != nil { return err }

b, err := json.Marshal(d)
err = client.Write("seen_urls.json", b)

b, ok, err := client.Read("seen_urls.json")
if err != nil { return err }
if !ok { b = []byte("[]") }   // never written yet — the normal first run
```

`Read` reports a missing key through `ok`, not an error, so the
`os.IsNotExist` check maps straight across; a real failure still arrives as
`err` and must not be treated as "missing". `Write` overwrites and returns once
the write is durable; `Delete(key)` is idempotent and `List(prefix)` enumerates
keys.

### `media` — uploads and generated media served by ID (`ask`)

`http.FileServer(http.Dir("uploads"))` over a directory the app writes is the
signal. Store the ID `Upload` returns and serve `/__keelson/media/<id>`.
**`Upload` is Go's `media.put`** — it mints the ULID and hands it back. (Go also
exposes a low-level `Put(fileID, body, ...) error`, which is the opposite shape:
it *takes* an ID you supply and returns no ID. It is not the media-put verb and
not a way to get app-named keys — use `Upload`.)

```go
// contract:skip — Go before/after
// BEFORE
os.WriteFile(filepath.Join("uploads", name), data, 0o644)
db.Exec("INSERT INTO photos (path) VALUES (?)", "uploads/"+name)

// AFTER
import (
    "bytes"
    "github.com/keelsonhq/go-sdk/media"
)

// Same mode contract as files.New(): on Keelson a missing/inconsistent config is
// an error, never a silent local write; with no Keelson env it is local mode and
// writes MEDIA_DIR (default ./media).
client, err := media.New("", "")
if err != nil { return err }

// Upload mints the ID and returns it (NOT Put — see above).
id, err := client.Upload(bytes.NewReader(data), media.WithFilename(name), media.WithContentType(ct))
if err != nil { return err }
db.Exec("INSERT INTO photos (media_id) VALUES (?)", id)
// the page now links client.URL(id) -> /__keelson/media/<id>
```

Note `Upload` takes an `io.Reader`, not a `[]byte` — hence the
`bytes.NewReader`. Both Keelson Go SDKs are client-based, so the `media` shape
above mirrors the `files` shape: construct once, then call methods on it.

The new `media_id` column, the removed `FileServer` route, and the changed URL
are why this one is `ask` — get the user's approval before doing it.

### Local development parity

**Unlike the database recipe above, file I/O is not asymmetric in Go.** Both SDKs
fall back to real files on the user's machine with no environment set: `files`
under `./.keelson/files/<key>`, `media` under `MEDIA_DIR` (default `./media`).
`go run .` keeps working with no local endpoint to stand up — the `sqld` recipe
above is required for the *database*, not for files. Add `.keelson/` and `media/`
to `.gitignore`.

<!--
Client-level detail (driver registration, DSN) lives in
`reference/LIBSQL_CLIENTS.md`; route verification status in
`reference/SUPPORT_LEDGER.md`.
-->
