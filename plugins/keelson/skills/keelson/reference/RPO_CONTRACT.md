# Reference: Durability Contract

What Keelson promises about durability, and what it deliberately does not
promise. Read this before telling a user their data is safe — the answer differs
per store, and one of the four stores is designed to lose data.

**Keelson stores exactly four kinds of state**, and this document is the
contract for those four:

| Store | Durable? | The contract |
|---|---|---|
| **Managed database** (`db.mode: libsql`) | **Yes** | A committed write is durable. This is the only durable database Keelson runs |
| **`files` SDK** | **Yes** | Write-through: once `write()` returns, the write is committed |
| **`media` SDK** | **Yes** | Write-through: once `put()` returns with an ID, the object is committed and served by that ID |
| **`db.local_sqlite`** (declared `/tmp` / `:memory:`) | **No — by design** | Explicitly ephemeral. It is discarded, and the app declared that it may be |

Within that set there is no fifth entry, and in particular **no mode persists a
SQLite file on disk**. A `.db` file under `/tmp` is ephemeral under every mode
(`/data` does not exist and cannot be created).

**`media` SDK contract.** `put()` uploads the bytes to the remote media store and
returns the ID only after the object is committed; a later `get`/URL by that ID
serves the same bytes. There is no local-disk stage to lose. Media objects are
not included in the managed database's backups — deleting one is final.

**An app may also use a store Keelson does not run** — an external PostgreSQL,
a hosted Mongo, an object store of its own — via `db.mode: none` plus `secrets`
(`core/DECISION.md` → Data & Persistence). That is a supported, first-class
route, and for a stack with no libSQL client it is the only one. Its durability
is that provider's contract, not Keelson's, and nothing in this document
describes it: if the user asks "is my data safe?" about an external database,
the honest answer names the provider, not Keelson.

---

## 1. Managed database (`db.mode: libsql`) — durable

The per-app managed libSQL database is the durable store for relational data.
It is a **network database**, not a file: the app reaches it over the injected
connection (`KEELSON_DB_URL` / `KEELSON_DB_AUTH_TOKEN`), and the data does not
live on the instance's disk. That is precisely why it survives — scale-to-zero
discards the container's filesystem and never touches the database.

A committed transaction is durable. There is no replication lag for the app to
reason about and no window in which an acknowledged write can be rolled back by
the platform.

**What this does not cover:** durability is not availability, and it is not a
backup of the user's mistakes. A committed `DELETE` is durably deleted as far as
this contract goes. Recovering from such mistakes is the job of the managed
database's backups, which are a separate feature: daily automatic backups,
manual snapshots, and point-in-time restore are available on every plan
(`keelson snapshots list / create / restore`; the restore window depends on the
plan). Files and media are not covered by those backups.

## 2. `files` SDK — durable, write-through

The `files` SDK is **write-through to object storage**: `write()` returns after
the object is committed. There is no local buffer, no background flush, and no
sync interval between the app and the durable copy.

**Therefore there is no RPO to state.** RPO (recovery point objective) measures
how much recent work a store can lose when a process dies abruptly. That
question presupposes a replication lag — a window of writes that have been
acknowledged locally but not yet made durable. `files` has no such window: the
call does not return until the write is durable. So the honest answer to "how
much could I lose?" is **not a number — the concept does not apply**.

The single rule this places on the app:

> **A `write()` that has not returned has not happened.** Await it (or check its
> error) before telling the user their work is saved. Fire-and-forget — an
> un-awaited promise, a write started after the response was sent — is the one
> way to lose data here, and it is the app's bug, not the platform's.

The second half matters on Keelson specifically: work started after the response
is not guaranteed to run at all (`core/KEELSON_YAML.md` → Background Work). A
write deferred to "after the response" may never be attempted.

## 3. `db.local_sqlite` — explicitly ephemeral

`db.local_sqlite` declares a `/tmp` / `:memory:` SQLite database that the app
**intends** to lose: a rebuildable cache, a scratch index, a memoization table.

Its contract is that it has none. The file is discarded whenever the instance
goes away (scale-to-zero, redeploy, a restart), with no warning and no recovery,
and a background execution never sees what the web instance wrote — they are
different containers.

The declaration is what makes this safe: it is the app author stating on the
record that this data is disposable, which is why the platform stops warning
about it. **Never use it to silence a lint about data that actually matters** —
the declaration does not create durability, it only records that you do not want
any. Data that must survive belongs in the managed database.

---

## Answering a user's "is my data safe?"

Say which store the data is in and give that store's contract. Do not
generalise across them, and do not soften case 3 — an app author who declared
`local_sqlite` was promised loss, and they should hear it the same way twice.

Three claims to never make, because none of them is true:

- **"Your SQLite file is backed up / replicated."** No mode does this for a
  file on disk. (The managed database has backups and point-in-time restore —
  that is a different claim about a different store.)
- **"You could lose the last few seconds of writes."** There is no such window
  in any of the durable stores. If data was lost, the cause is elsewhere — an
  un-awaited `write()`, work deferred past the response, or `local_sqlite`.
- **"It's saved"** — said before a `write()` resolved or a transaction
  committed.
