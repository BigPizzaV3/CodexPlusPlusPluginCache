# Stack: Node.js

The Node-specific rewrites. Read this together with `core/DECISION.md` (which
recipe applies and why) and `core/KEELSON_YAML.md` (the config contract). This
file is self-contained for Node — you do not need `stacks/python.md` or
`stacks/go.md`.

Runtimes: `node-slim` (default) / `node-media`. Dependencies come from
`package-lock.json` or `package.json`; the build runs `npm ci` (with lockfile) or
`npm install`, then `npm run build --if-present`.

## Recipe: bind to `PORT` and `0.0.0.0`

The app must listen on the injected `PORT` and bind `0.0.0.0`. A hard-coded port
or a `127.0.0.1` / `localhost` bind will not receive traffic.

```js
// contract:skip — Node before/after
// BEFORE
app.listen(3000, "localhost");
// AFTER
const server = app.listen(process.env.PORT || 8080, "0.0.0.0");
```

## Recipe: graceful shutdown on `SIGTERM`

An app that owns its Node HTTP server (Express, Hono's Node adapter, Fastify, or
plain `node:http`) must stop accepting new connections on `SIGTERM`, let
in-flight requests finish, and exit within Keelson's ten-second termination
window. Keep the server returned by `listen()` and install the handler once:

```js
// contract:skip — Node HTTP server shutdown
let shuttingDown = false;

process.on("SIGTERM", () => {
  if (shuttingDown) return;
  shuttingDown = true;

  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
  // Drop idle keep-alive sockets now; active requests continue until complete.
  server.closeIdleConnections?.();

  setTimeout(() => {
    // Leave one second inside the platform's ten-second SIGKILL deadline.
    server.closeAllConnections?.();
    process.exit(1);
  }, 9_000).unref();
});
```

Close database clients and other resources in the `server.close` callback
before allowing the process to exit. Use the framework equivalent where it owns
the server (`await fastify.close()`, for example), with the same nine-second
upper bound. Do not call `process.exit()` immediately in the signal handler:
that cuts off in-flight writes. A framework-managed command such as `next start`
owns its signal handling; do not wrap it in a second ad-hoc HTTP server.

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

Replace `better-sqlite3` / `node:sqlite` with `@libsql/client`.

```js
// contract:skip — Node before/after
// BEFORE
import Database from "better-sqlite3";
const db = new Database("app.db");

// AFTER
import { createClient } from "@libsql/client";
const db = createClient({
  url: process.env.KEELSON_DB_URL ?? "file:local.db", // file: = local fallback
  authToken: process.env.KEELSON_DB_AUTH_TOKEN,
});
await db.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, note TEXT)");
await db.execute({ sql: "INSERT INTO items (note) VALUES (?)", args: ["hello"] });
```

Note `@libsql/client` is async (`await`), whereas `better-sqlite3` is
synchronous. So the swap also means putting `await` on the calls and making
their callers `async`. **That conversion is part of this recipe — do not ask a
separate question about it.** Whether the swap as a whole is `auto` or `ask` is
decided by the decision table (`core/DECISION.md` → Adaptation Decision Function):
`node:sqlite` and Drizzle derive `auto`; raw `better-sqlite3` derives `ask`
because its local CRUD is untested in the ledger. The `await` rewrite
touches every route handler, but it changes no SQL, no schema, and no
behaviour; a confirmation prompt here is noise, and there is no alternative
outcome to offer if the user says no. The same holds for Drizzle: swap
`better-sqlite3` for `drizzle-orm/libsql` and `await` the queries — the schema
and the query expressions are untouched.

After rewriting: no `better-sqlite3` import should remain in the data path, and
the app must read `KEELSON_DB_URL`. The environment-leak rules that come with
holding `KEELSON_DB_AUTH_TOKEN` are in `core/DECISION.md` → SQLite→libSQL.

Keep the `?? "file:local.db"` default. It is what lets `node server.js` still
start on the user's machine, and `core/DECISION.md` → Local Development Parity
makes that a success condition of the adaptation. The wiring lint reports
`no-local-dev-path` if it goes missing.

### Moving an existing file's data (there is no path for it)

The swap moves the *code*, not the *rows*. The managed database starts **empty**:
the app recreates its schema, and the rows already in `app.db` are **not** carried
over. Keelson does not ship a data-move step today — an agent can produce a SQL
dump of the old file locally (`sqlite3 app.db .dump > dump.sql`), and load it with
`keelson db apply dump.sql --app <slug>` (`reference/DB_APPLY.md`: 16 MiB per
apply; once the database is non-empty an apply needs the user's approval). If the
existing file holds data the user would miss, this is an `ask`, and the proposal
must say plainly that existing rows will not come across (`core/DECISION.md` → the
existing-data trigger).

## Recipe: Prisma → `@prisma/adapter-libsql`

Prisma against a SQLite file (`provider = "sqlite"`) moves to the libSQL driver
adapter. This is an `ask` (`core/DECISION.md` → Grading): three things past the
connection change, and one of them (migrations) has no clean answer yet.

**Pin the adapter to the Prisma Client's major.** Driver adapters went GA in
Prisma **6.16.0** (official docs); the version measured working on Keelson is
**6.19.3** (deals--claude--01). `npm` will resolve `@prisma/adapter-libsql` 7.x
against a 6.x client and break at runtime — pin the adapter to the same major as
`@prisma/client`. Prisma 7 changes connection configuration and adapter handling
and has **not** been verified here; do not assume the 6.x recipe carries across.

```jsonc
// contract:skip — package.json (adapter pinned to the client's major)
"dependencies": {
  "@prisma/client": "6.19.3",
  "@prisma/adapter-libsql": "6.19.3",
  "@libsql/client": "^0.14.0"
}
```

`@libsql/client` sits alongside the adapter here, as the upstream docs and the
measured trial both do — npm resolves the app's `0.14.x` and the adapter's own
`0.8.x` at different tree levels without conflict. The version that matters to pin
is the **adapter → client major** (`@prisma/adapter-libsql` to `@prisma/client`);
`npm` otherwise resolves the adapter at 7.x against a 6.x client and breaks.

```prisma
// contract:skip — schema.prisma: keep provider = "sqlite"; the adapter supplies the connection
datasource db {
  provider = "sqlite"
}
```

```js
// contract:skip — Prisma Client construction (adapter 6.19.3)
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// PrismaLibSQL takes the libSQL CONFIG object ({ url, authToken }) and builds the
// client itself. Do NOT pass a `createClient(...)` instance here — 6.19.3's
// constructor reads `.url` off the argument, so a client instance yields
// `URL_INVALID: The URL 'undefined'`.
const adapter = new PrismaLibSQL({
  url: process.env.KEELSON_DB_URL ?? "file:local.db",   // file: = local fallback
  authToken: process.env.KEELSON_DB_AUTH_TOKEN,
});
export const prisma = new PrismaClient({ adapter });
```

- **Externalize the native client** or the bundler build fails. On Next.js set
  `serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"]` in
  `next.config.js`; on a plain Node build, do not let the bundler inline it.
- **Migrations do not run against the managed database.** `prisma migrate
  deploy` does not work against a remote libSQL database (measured — a
  reproducible upstream limit, not a trial artefact). Generate migrations
  locally with `prisma migrate dev`; there is **currently no** supported way to
  apply them to the managed database at deploy time. For a **single-table,
  greenfield** schema you may bootstrap it once at startup with idempotent
  `CREATE TABLE IF NOT EXISTS` DDL (via `$executeRawUnsafe`), kept in sync with
  `migration.sql` by hand — this is a bootstrap, **not** a migration path, and it
  does not generalise to schema changes or multiple concurrently-booting
  instances. Do not build a deploy-time migration path into the app.

## Recipe: File I/O → `files` SDK / `media` SDK

Which of the two applies (or whether it belongs in the database) is decided by
`core/DECISION.md` → Recipe: local file I/O. This is the Node call shape.

Declare each SDK that the app uses as a dependency: run
`npm install @keelsonhq/media` for `media` and `npm install @keelsonhq/files`
for `files`. If the repository commits `package-lock.json`, commit the updated
`package.json` and `package-lock.json` together; the build runs `npm ci`, which
fails when those files disagree. If the repository has no lockfile, updating
`package.json` is sufficient and the build runs `npm install`.

### `files` — a file the app names and updates (`auto`)

Replace `node:fs` calls with `@keelsonhq/files`. The key is the old filename:

```js
// contract:skip — Node before/after
// BEFORE
import fs from "node:fs/promises";
await fs.writeFile("seen_urls.json", JSON.stringify(d));
const seen = JSON.parse(await fs.readFile("seen_urls.json", "utf8").catch(() => "[]"));

// AFTER
import { write, read } from "@keelsonhq/files";
await write("seen_urls.json", JSON.stringify(d));
const raw = await read("seen_urls.json");
const seen = JSON.parse(raw ? Buffer.from(raw).toString("utf8") : "[]");
```

`read()` resolves to `null` for a key that was never written — that replaces the
`.catch(() => …)` guard, since a first run is the normal path rather than an
error. `write()` overwrites and resolves once the write is durable; `del(key)` is
idempotent and `list(prefix)` enumerates keys. Both are `async`: **await them.**
An un-awaited `write()` is the one way to lose data here
(`reference/RPO_CONTRACT.md`).

### `media` — uploads and generated media served by ID (`ask`)

`express.static("uploads")` and multer's `diskStorage` are the signals. Store the
ID `put()` returns and serve from `/__keelson/media/<id>`; multer moves to
`memoryStorage` so the bytes never touch the disk:

```js
// contract:skip — Node before/after
// BEFORE
const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));
app.post("/photos", upload.single("photo"), (req, res) => {
  db.prepare("INSERT INTO photos (path) VALUES (?)").run(req.file.path);
});

// AFTER
import { put, url } from "@keelsonhq/media";
const upload = multer({ storage: multer.memoryStorage() });   // no static route
app.post("/photos", upload.single("photo"), async (req, res) => {
  const id = await put(req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });
  await db.execute({ sql: "INSERT INTO photos (media_id) VALUES (?)", args: [id] });
  // the page now links url(id) -> /__keelson/media/<id>
});
```

The new `media_id` column, the dropped `express.static` route, and the changed
URL are why this one is `ask` — get the user's approval before doing it.

### Local development parity

Both SDKs write real files on the user's machine with no environment set:
`files` under `./.keelson/files/<key>`, `media` under `MEDIA_DIR` (default
`./media`). `node server.js` keeps working, which
`core/DECISION.md` → Local Development Parity requires. Add `.keelson/` and
`media/` to `.gitignore`.

## Recipe: add an npm lockfile alongside pnpm / yarn

The Node builder only runs npm. `package-lock.json` is honored (`npm ci`); with
no lockfile at all the build runs `npm install`. A repository whose only
lockfile is `pnpm-lock.yaml` or `yarn.lock` is stopped by `keelson deploy --check`
with `lockfile_unsupported` (an error, `ok: false`), so add `package-lock.json`
first. The pnpm / yarn lockfiles may remain in the repository alongside it.

```bash
# contract:skip — from the project root
npm install            # generates package-lock.json
```

Commit the resulting `package-lock.json`; do not remove the existing pnpm or
yarn lockfile.

## Production Hardening

Node apps carry their production/dev split in `NODE_ENV` and in which server
command runs. Both must land on the production side here, and neither should
require an env var to be *remembered*: **production-safe is the default, local
opts INTO dev.** A flag defaulted to dev means a forgotten env var ships stack
traces to a public URL.

**`NODE_ENV` is not one of the platform's auto-set variables** — the injected set
is `PORT` / `TZ` / `KEELSON_*` only (`core/KEELSON_YAML.md` → Auto-set
Environment Variables). Nothing sets it for you, and Node defaults to
development, so **declare it yourself**:

```yaml
# keelson.yaml — fragment. Merge into your file; required fields are in core/KEELSON_YAML.md.
env:
  NODE_ENV: "production"
db:
  mode: libsql
```

This is what Express reads to disable its dev-mode stack-trace error page, what
Next.js and most middleware branch on, and what npm uses to skip devDependencies.
Leaving it out is the quiet half of this section: the app runs, and every error
response carries a stack trace.

`NODE_ENV` is the one exception to "local opts INTO dev" here, and it is not a
real one: the value is declared in `keelson.yaml`, which only applies on Keelson.
Locally the variable is simply unset and Node's own default (development) takes
over — the safe value still wins where it matters, and local dev still works.

### Express

```js
// contract:skip — production error handling
// The default handler prints the stack in dev. Do not send it to the client:
// it exposes file paths, dependency versions, and query text.
app.use((err, _req, res, _next) => {
  console.error(err);                       // logs: yours, via keelson logs app
  res.status(500).json({ error: "Internal Server Error" });  // response: no stack
});
```

- Do not enable verbose/debug middleware by default (`errorhandler`, a
  `DEBUG=*` default). If it is env-gated, the default must be off.
- Session/JWT secrets come from `secrets`, never a literal
  (`core/DECISION.md` → hard-coded API keys).
- The app sits behind the edge and the gateway, so configure `trust proxy` for
  that actual proxy path and the forwarded headers before relying on `req.ip` /
  `req.protocol`. A fixed `app.set("trust proxy", 1)` may not match; verify with
  a deployed request rather than assuming a hop count.

### Next.js

Next must be **built**, and started with `next start` — not `next dev`. The dev
server compiles per request, watches the filesystem, and serves unminified
sources with full error overlays; it is the single most common Next.js
misdeploy.

```yaml
# keelson.yaml — complete file. Copy it, then change slug.
slug: my-app
runtime: node-slim
# workspace: acme-corp    # uncomment and set your workspace slug if you belong to more than one
command: "npm run start"        # package.json: "start": "next start -p $PORT"
db:
  mode: none            # switch to libsql if the app stores data (see core/DECISION.md)
```

- `"start": "next dev"` in `package.json` must be corrected, not worked around.
- Confirm `npm run build` exists and produces `.next/` — `next start` fails
  without it.
- Server-side code reads `KEELSON_DB_URL` at runtime; do not inline it into a
  `NEXT_PUBLIC_*` variable, which is baked into the client bundle and shipped to
  every browser.
- The native libSQL client must be externalized or the build fails:
  `serverExternalPackages: ["@libsql/client"]` in `next.config.js`. A **Prisma**
  app externalizes the adapter too — `["@libsql/client", "@prisma/adapter-libsql"]`
  (see the Prisma recipe above).

<!--
Client-level detail (`result.rows` shape, intMode, the sync→async call mapping)
lives in `reference/LIBSQL_CLIENTS.md`; route verification status in
`reference/SUPPORT_LEDGER.md`.
-->
