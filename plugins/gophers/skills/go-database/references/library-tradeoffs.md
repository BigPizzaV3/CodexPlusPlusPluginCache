# Library Trade-offs: sqlx, sqlc, pgx, GORM

There is no single best choice. The right answer depends on team size, schema stability, database vendor, and how much SQL the team is comfortable owning.

## database/sql

The standard library. Driver-agnostic, minimal, verbose.

```go
row := db.QueryRowContext(ctx, "SELECT id, email FROM users WHERE id = $1", id)
var u User
if err := row.Scan(&u.ID, &u.Email); err != nil { ... }
```

Pick it when:

- You are writing a tiny tool with one query.
- You want zero external dependencies beyond the driver.

Avoid for production services — the boilerplate compounds.

## sqlx

`github.com/jmoiron/sqlx` adds struct scanning, named parameters, and `In()` expansion on top of `database/sql`. Zero codegen. Works with any driver.

```go
err := db.GetContext(ctx, &u,
    "SELECT id, email, name FROM users WHERE id = $1", id)

err := db.SelectContext(ctx, &users,
    "SELECT id, email FROM users WHERE created_at > $1", since)

q, args, _ := sqlx.In("SELECT * FROM users WHERE id IN (?)", ids)
err := db.SelectContext(ctx, &users, db.Rebind(q), args...)
```

Pick sqlx when:

- The team already knows SQL and wants only better ergonomics.
- You need multi-driver portability (Postgres + MySQL + SQLite in tests).
- Codegen is a non-starter for the team.

Trade-off: queries are strings; typos surface only at runtime.

## sqlc

`github.com/sqlc-dev/sqlc` parses `.sql` files and generates strongly-typed Go functions. The SQL is the source; Go code is derived.

```sql
-- queries.sql
-- name: GetUser :one
SELECT id, email, name FROM users WHERE id = $1;

-- name: ListActiveUsers :many
SELECT id, email FROM users WHERE active = true ORDER BY id LIMIT $1;
```

```go
// generated
func (q *Queries) GetUser(ctx context.Context, id string) (User, error) { ... }
func (q *Queries) ListActiveUsers(ctx context.Context, limit int32) ([]User, error) { ... }
```

Pick sqlc when:

- Schema is stable enough that regeneration is rare.
- The team values compile-time safety over flexibility.
- You want SQL in `.sql` files for DBA review.

Trade-off: dynamic queries (variable filters) require either many query variants or hand-written `sqlx` alongside. Hybrid is fine.

## pgx

`github.com/jackc/pgx` is a Postgres-only driver with two modes: as a `database/sql` driver (`stdlib`), or as a native API. Native pgx is 30-50% faster than `database/sql` because it skips the abstraction and uses Postgres binary protocol.

```go
pool, _ := pgxpool.New(ctx, dsn)

var u User
err := pool.QueryRow(ctx, "SELECT id, email FROM users WHERE id = $1", id).
    Scan(&u.ID, &u.Email)

rows, _ := pool.Query(ctx, "SELECT id, email FROM users WHERE created_at > $1", since)
users, err := pgx.CollectRows(rows, pgx.RowToStructByName[User])
```

Pick pgx (native) when:

- The project is Postgres-only and likely to remain so.
- You need first-class support for `LISTEN/NOTIFY`, `COPY`, arrays, or PostGIS.
- Performance matters.

Pick pgx (stdlib) when you want pgx as a driver underneath `database/sql`/`sqlx` for easy migration.

## GORM / ent

Both are full-featured ORMs.

GORM trade-offs:

- Generated SQL is unpredictable; debugging requires turning on query logging.
- Eager loading hides N+1 problems until production load reveals them.
- Hooks (`BeforeSave`, `AfterCreate`) make state machines implicit.
- Migrations are coupled to model definitions.

ent trade-offs:

- More structured than GORM but still abstracts SQL behind a fluent API.
- Schema is Go code; SQL is generated.
- Strong for graph-shaped data (relations); awkward for window functions or CTEs.

Both can be reasonable for prototypes, internal tools, or schemas where the relational model is genuinely the bottleneck. For production services that need to evolve over years, the SQL-first stack (sqlc + sqlx + pgx) wins on debuggability.

## Decision Matrix

| Concern | sqlx | sqlc | pgx | GORM |
|---|---|---|---|---|
| Compile-time safety | No | Yes | No | Partial |
| Multi-DB | Yes | Yes (per dialect) | No (Postgres) | Yes |
| Codegen step | No | Yes | No | No |
| Performance | Baseline | Baseline | Best | Worst |
| Dynamic queries | Easy | Awkward | Easy | Easy |
| SQL visibility | High | Highest (.sql files) | High | Low |
| Onboarding | Low (SQL+Go) | Medium (SQL+codegen) | Low | High (ORM API) |

## Hybrid Patterns

- **sqlc + sqlx.** Use sqlc for stable, named queries; drop to sqlx for one-off dynamic ones. They compose because sqlc's generated `Queries` accepts any `DBTX` interface.
- **pgx native + raw SQL files.** Use pgx for performance but keep queries in `.sql` files reviewed by the team.
- **Repository interface, swap implementations.** Define `UserRepository` in domain; have `sqlxUserRepo` and `pgxUserRepo`; pick at startup. Useful during migration.

## Drivers

| DB | Driver | Notes |
|---|---|---|
| PostgreSQL | `github.com/jackc/pgx/v5` (stdlib or native) | The right choice. |
| MySQL/MariaDB | `github.com/go-sql-driver/mysql` | Mature, simple. |
| SQLite | `modernc.org/sqlite` (pure-Go) or `github.com/mattn/go-sqlite3` (CGO) | Pure-Go avoids the CGO toolchain. |
| MS SQL Server | `github.com/microsoft/go-mssqldb` | Adequate; less polish than pgx. |
