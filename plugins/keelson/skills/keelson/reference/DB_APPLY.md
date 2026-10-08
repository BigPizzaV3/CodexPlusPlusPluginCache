# `keelson db apply` — applying SQL to the managed database

Read this when you need to put **schema** into an app's managed libSQL database
(`db.mode: libsql`) from outside the app: an initial `CREATE TABLE` set, or a
one-off correction. It is an operator command, not part of the app's runtime.

For how the app's own code should read and write that database — the client per
language, and the 5-second interactive-transaction budget — read
`reference/LIBSQL_CLIENTS.md` instead. That discipline is not repeated here.

```
keelson db apply schema.sql --app <slug>
keelson db apply --app <slug> < schema.sql     # stdin when the path is omitted or "-"
```

## When to use it

- **Initial schema for a new app.** The provisioned database starts empty; this
  is how the first `CREATE TABLE` lands without shipping a migration runner.
- **A one-off fix** an operator has decided on: a missing index, a corrective
  `UPDATE`, a column added by hand.

## When NOT to use it

- **Schema the app owns and evolves.** If the schema must converge on every
  deploy, declare `db.migrate` in `keelson.yaml` (`core/KEELSON_YAML.md`) or put
  idempotent DDL in the app's startup path. A human running a CLI command is not
  a repeatable deployment step, and — see the approval rule below — it stops
  being unattended after the very first time.
- **Application data writes.** Inserting rows the app should insert bypasses
  every check the app makes. Go through the app.
- **A path you cannot re-run.** Nothing here is transactional across *invocations*
  (see the timeout note below), so scripts that assume "it either ran or it did
  not" must be written to be safe on re-run — which is what idempotent SQL buys.

## Two paths, decided by the database — not by a flag

The API inspects the target database and picks:

| Database state | What happens |
|---|---|
| **Empty** — no user-defined table, index, view or trigger | Applied immediately. `Status: SQL applied.` |
| **Non-empty** — anything user-defined exists | **403 `confirmation_required`.** The CLI prints an approval URL and opens the console; a human approves there, and the SQL is applied on approval. With `--wait` the CLI polls and prints the result. |

Emptiness is judged inside the same write transaction as the apply, so there is
no "it was empty a moment ago" window. Keelson's own receipt table and SQLite's
reserved `sqlite_%` objects do not count as user schema; everything else does.

**Consequences for you as an agent:**

- The **first** apply on a fresh app succeeds unattended. Every apply after it
  needs a human. Plan the initial schema as one file rather than discovering it
  across five applies — each of applies 2..5 costs an approval round trip.
- You cannot approve. Do not poll waiting for it to clear on its own; report the
  approval URL to the user and stop.

## Idempotency: re-sending the identical SQL is safe

Idempotency is anchored by a **checksum of the SQL text**, recorded in a receipt
row inside the target database in the same transaction as the SQL itself.

- Re-sending byte-identical SQL returns `already_applied` and changes nothing.
- **Whitespace counts.** Reformatting the file makes it a *different* apply, and
  a re-run of "the same" schema then executes for real — against a database that
  is no longer empty, so it needs approval, and `CREATE TABLE` without
  `IF NOT EXISTS` fails. Keep the file byte-stable, or write SQL that is
  idempotent on its own terms (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT
  EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`).
- The receipt lives in the app's database, so a restore that rewinds the database
  also rewinds what counts as already applied.

## Limits

- **16 MiB** per apply. Larger input is rejected with HTTP `413` (a plain HTTP
  error, not one of the codes below); split the file.
- Empty / whitespace-only / comment-only input is rejected before anything runs.

## Reading failures

The CLI reports the API's own reason and a machine-readable `code`
(`--json` puts it under `error`). Match on the code, never the prose.

| `code` | Meaning | What to do |
|---|---|---|
| `sql_failed` | A statement failed; **the whole apply was rolled back**. The message carries the SQLite error verbatim (`no such table: …`, `syntax error near …`). | Fix the SQL and re-run. Nothing was applied. |
| `usage` (no managed database) | The app has no managed database. | Declare `db.mode: libsql`, redeploy, then re-run. |
| `usage` (app suspended / stopped) | The app is not running, so the apply cannot reach its database. | Start the app (`keelson app start`), then re-run the same apply. |
| `confirmation_required` | The non-empty path above. | Give the user the approval URL. |
| `transient` | The database was unreachable, the endpoint is disabled, or the apply timed out. | See the timeout rule below before retrying. |

**On a timeout, re-send the IDENTICAL SQL.** A timeout is *indeterminate* — the
apply may have committed just before the deadline. Re-sending the same bytes is
the defined reconciliation: the receipt makes it return `already_applied` if it
did land, and applies it if it did not. Editing the SQL first destroys that
guarantee, because the checksum no longer matches the receipt.

## A worked initial schema

```sql
-- schema.sql — safe to re-apply verbatim
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS notes_created_at ON notes (created_at);
```

```
$ keelson db apply schema.sql --app notes
SQL applied.
  checksum: 3f2a…
  statements: 2
```

Then verify through the app, not through another apply: a `SELECT` sent as an
apply would need an approval round trip and tells you nothing the app cannot.
