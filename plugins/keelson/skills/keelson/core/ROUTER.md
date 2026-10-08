# Keelson Deploy Spec — Router

You have read `core/DECISION.md` and `core/KEELSON_YAML.md`. This file tells you
the **one** stack file to open next.

Read **only your app's stack file**. Each is self-contained: core + your stack
file is everything you need to write `keelson.yaml` and make the DB adaptation
call. Do not read another language's stack file "for context" — it costs budget
and its rules do not transfer (Go, in particular, is deliberately asymmetric).

## Detect the stack, then read one file

Work top to bottom and stop at the first match. Detect from what is actually in
the repo — a manifest, an import, or a connection string — not from the user's
description.

| If you see | Stack | Read |
|---|---|---|
| Prebuilt web files only, with no process that handles requests at runtime | Static site | Skip the stack files; read `core/KEELSON_YAML.md` → Deploy Modes |
| `package.json` / `package-lock.json`, `import`/`require` of `express`, `next`, `hono`, `fastify` | Node.js | `stacks/node.md` |
| `requirements.txt`, `pyproject.toml`, `import flask` / `fastapi` / `django` | Python | `stacks/python.md` |
| `import streamlit` / `gradio` | Python | `stacks/python.md` → framework support boundary |
| `go.mod`, `package main`, `net/http`, `gin`, `echo` | Go | `stacks/go.md` |
| None of the above | — | Not a supported runtime → `core/DECISION.md` → Refusal Policy |

A site is still static when it has build-tool configuration such as
`package.json`, as long as no process handles requests at runtime.

A repo with more than one manifest (e.g. a Node frontend built into `assets.dir`
plus a Python API serving `command`) is **one** app: pick the stack of the
process named by `command`, and treat the other tree as build output.

## Database signals → the adaptation you owe

Once you know the stack, the DB signal decides which recipe in that stack file
applies. `db.mode` selection itself is in `core/DECISION.md` → Data &
Persistence; this table only maps the *signal* to the *page*.

| Signal in the repo | Stack | What it means |
|---|---|---|
| `better-sqlite3`, `node:sqlite`, `new Database(...)` | Node.js | File SQLite → `stacks/node.md` → SQLite→libSQL |
| `drizzle-orm/better-sqlite3`, `sqlite-core` | Node.js | ORM on file SQLite → `stacks/node.md` |
| `@prisma/client` with a `sqlite` provider | Node.js | ORM on file SQLite → `stacks/node.md` |
| `import sqlite3`, `sqlite3.connect(...)` | Python | File SQLite → `stacks/python.md` → SQLite→libSQL |
| `create_engine("sqlite:///...")`, SQLModel | Python | Sync ORM on file SQLite → `stacks/python.md` |
| `create_async_engine`, `aiosqlite` | Python | Async ORM — no direct libSQL path → `stacks/python.md` |
| `django.db.backends.sqlite3` | Python | Django → `stacks/python.md` |
| `mattn/go-sqlite3`, `gorm.io/driver/sqlite` | Go | cgo driver — does not build here → `stacks/go.md` |
| `modernc.org/sqlite`, `glebarez/*`, `ncruces/go-sqlite3` | Go | Pure-Go **file** driver — builds, silently loses data → `stacks/go.md` |
| `@libsql/client`, `libsql`, `libsql-client-go` | any | Already on libSQL — no DB rewrite; still set `db.mode: libsql` |
| An external DB URL (`postgres://`, `mysql://`, `mongodb://`) | any | Not our concern → `db.mode: none`, keep the app's own client |
| No DB at all | any | `db.mode: none` |

## On-demand references

Read these only when the core + your stack file leaves the question open:

| File | Answers |
|---|---|
| `reference/VERIFICATION.md` | How to verify the app you just deployed, including write paths, sub-resources, and platform failures |
| `reference/LIBSQL_CLIENTS.md` | Per-language libSQL client details beyond the stack recipe |
| `reference/DB_APPLY.md` | Getting schema INTO the managed database from outside the app (`keelson db apply`) |
| `reference/SUPPORT_LEDGER.md` | Whether a given ORM/driver route is verified on Keelson |
| `reference/RPO_CONTRACT.md` | The durability contract behind `db.mode` |
