---
name: go-database
description: "Use when writing, reviewing, or debugging Go code that talks to a SQL database (PostgreSQL, MySQL, MariaDB, SQLite). Covers library choice (database/sql, sqlx, sqlc, pgx, GORM trade-offs), parameterized queries, context propagation, NULL handling, scanning, transactions and isolation, connection pool tuning, and migration tooling. Apply when adding repository code, refactoring SQL, or auditing for missing rows.Close()/QueryContext."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.21+. Library-agnostic: applies to database/sql, sqlx, sqlc, pgx."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Database

Go's `database/sql` is a thin, driver-pluggable foundation. Most projects layer one of `sqlx`, `sqlc`, or `pgx` on top for ergonomics. ORMs (GORM, ent) trade SQL visibility for one less line of code — a bad trade in production.

## Core Rules

1. **SQL is the source of truth.** It is reviewed, version-controlled, and explained in code. Magic ORM queries are the opposite.
2. **Always parameterize.** `$1`/`?` placeholders, never string concatenation. The driver handles escaping; you cannot.
3. **Every I/O call takes `ctx`.** `QueryContext`, `ExecContext`, `GetContext`. No context = no timeout = a stuck handler.
4. **Distinguish "not found" from "error".** `errors.Is(err, sql.ErrNoRows)` is a domain signal, not a failure.
5. **Close rows.** `defer rows.Close()` immediately after `QueryContext`. Forgetting it leaks a pool connection.
6. **Configure the pool.** Default `MaxOpenConns` is unlimited — a runaway request rate exhausts the DB.

## Library Decision

| Library | Best for | Struct scanning | Code-gen |
|---|---|---|---|
| `database/sql` | Minimal deps, multi-driver portability | Manual `Scan` | No |
| `sqlx` | Sweetens `database/sql` ergonomics | `StructScan`, `Get`, `Select` | No |
| `sqlc` | Type-safe queries derived from `.sql` files | Generated structs and funcs | Yes |
| `pgx` (v5) | PostgreSQL-only, 30-50% faster, native types | `pgx.RowToStructByName` | No |
| GORM / ent | **Avoid** in new code | Reflection | Yes |

**Why not ORMs.**

- Generated queries are unpredictable; N+1 problems are invisible at the call site.
- Hooks (`BeforeCreate`, `AfterUpdate`) create implicit state machines.
- Schema migrations entangle with application code.
- Learning the ORM API is harder than learning SQL, and the abstraction leaks at every interesting query.

> Read [references/library-tradeoffs.md](references/library-tradeoffs.md) when picking between sqlx, sqlc, and pgx for a new project.

## Parameterized Queries

```go
// VERY BAD — SQL injection.
q := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)

// Good — placeholder, driver-escaped.
err := db.GetContext(ctx, &u, "SELECT id, email FROM users WHERE email = $1", email)
```

### Dynamic `IN` clauses

```go
q, args, err := sqlx.In("SELECT * FROM users WHERE id IN (?)", ids)
if err != nil { return fmt.Errorf("expanding IN: %w", err) }
q = db.Rebind(q)                            // $1, $2, ... for Postgres
err = db.SelectContext(ctx, &users, q, args...)
```

### Dynamic column names

Placeholders cannot stand in for identifiers. Use an allowlist:

```go
allowed := map[string]bool{"name": true, "email": true, "created_at": true}
if !allowed[sortCol] {
    return fmt.Errorf("invalid sort column: %s", sortCol)
}
q := fmt.Sprintf("SELECT id, name FROM users ORDER BY %s", sortCol)
```

## Context Propagation

```go
// Bad — query runs to completion even if the client disconnected.
rows, err := db.Query("SELECT ...")

// Good — driver cancels the query on ctx.Done().
rows, err := db.QueryContext(ctx, "SELECT ...")
```

Every I/O method takes `ctx` first. Pass the request context through service → repository.

## Error Handling

```go
err := r.db.GetContext(ctx, &u, "SELECT ... WHERE id = $1", id)
switch {
case errors.Is(err, sql.ErrNoRows):
    return nil, ErrUserNotFound           // domain error
case err != nil:
    return nil, fmt.Errorf("get user %s: %w", id, err)
}
```

### Always close rows

```go
rows, err := db.QueryContext(ctx, "SELECT id, name FROM users")
if err != nil { return fmt.Errorf("query: %w", err) }
defer rows.Close()
for rows.Next() {
    var u User
    if err := rows.Scan(&u.ID, &u.Name); err != nil { return fmt.Errorf("scan: %w", err) }
    users = append(users, u)
}
if err := rows.Err(); err != nil { return fmt.Errorf("iterate: %w", err) }
```

Three error checks (`Query`, `Scan`, `rows.Err()`) — missing the third hides truncated iteration.

## NULL Columns and Scanning

```go
type User struct {
    ID    string         `db:"id"`
    Email string         `db:"email"`
    Bio   *string        `db:"bio"`      // nullable → pointer
    Login sql.NullTime   `db:"last_login"`
}
```

Pointer fields work cleanly with JSON marshaling and with sqlx `StructScan`. Use `sql.NullXxx` when you need to distinguish "not set" from "zero value" at the SQL layer.

> Read [references/scanning.md](references/scanning.md) for sqlx tags, pgx `RowToStructByName`, and `sql.Null*` patterns.

## Transactions and Isolation

Wrap related writes in `db.BeginTxx(ctx, &sql.TxOptions{Isolation: ...})`, rollback on every error path, commit only on success. Use `SELECT ... FOR UPDATE` when reading data you intend to modify — otherwise a concurrent writer races you. See [references/transactions.md](references/transactions.md) for isolation levels, retryable serialization errors, and the UnitOfWork pattern.

## Connection Pool

```go
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(10)
db.SetConnMaxLifetime(5 * time.Minute)
db.SetConnMaxIdleTime(1 * time.Minute)
```

`MaxOpenConns` should be ≤ the DB server's `max_connections` divided by replica count, with headroom for migrations and other consumers.

## Migrations

Do **not** generate migration SQL with this skill. Schema design needs human judgment about indexes, foreign keys, and data volume.

Recommended tools:

- [golang-migrate](https://github.com/golang-migrate/migrate) — Go library + CLI.
- [Atlas](https://atlasgo.io/) — declarative, supports diff and lint.
- [Flyway](https://flywaydb.org/) — JVM, common in heterogeneous shops.

Run migrations in CI/CD, not from application code at startup.

## Avoid Hidden SQL Features

Triggers, views, materialized views, stored procedures, row-level security — all create invisible state changes. The application code looks correct; debugging takes hours. Keep behavior in Go where it is testable and reviewable.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `fmt.Sprintf` building queries | SQL injection | Always `$1`/`?` placeholders |
| `db.Query` (no context) | No timeout, no cancellation | `db.QueryContext(ctx, ...)` |
| Forgetting `defer rows.Close()` | Connection leak; pool exhaustion | Defer immediately after `QueryContext` |
| Missing `rows.Err()` check | Truncated iteration treated as success | Always check after the `for rows.Next()` loop |
| `db.Query` for INSERT/UPDATE/DELETE | `*Rows` must be closed; easy to leak | Use `db.ExecContext` |
| Returning raw `*sql.DB` from repos | Couples service to driver | Return domain types; keep `*sql.DB` private |
| ORM with hooks for business logic | Magic side effects, untraceable bugs | Move logic into a service layer |
| `MaxOpenConns(0)` (unlimited) | Stampede exhausts the DB | Cap below `pg_max_connections` |

## Verification Checklist

- [ ] No string-concatenated SQL
- [ ] Every DB call uses a `*Context` method
- [ ] Every `QueryContext` is followed by `defer rows.Close()`
- [ ] Every iteration loop ends with `rows.Err()` check
- [ ] `sql.ErrNoRows` is translated to a domain error at the repository boundary
- [ ] Connection pool limits set; not relying on defaults
- [ ] Transactions roll back on every error path; commit only on success
- [ ] Migrations live in `migrations/`, not in Go code

## References

- [references/library-tradeoffs.md](references/library-tradeoffs.md) — sqlx vs sqlc vs pgx vs GORM with concrete examples
- [references/transactions.md](references/transactions.md) — isolation levels, FOR UPDATE, retryable errors
- [references/scanning.md](references/scanning.md) — sqlx, pgx, NULL handling, JSON columns
- [references/anti-patterns.md](references/anti-patterns.md) — detailed walkthrough of each anti-pattern
