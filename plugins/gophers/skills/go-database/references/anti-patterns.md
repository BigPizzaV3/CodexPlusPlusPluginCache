# Database Anti-Patterns

## 1. String-Concatenated Queries

```go
// Bad — classic SQL injection.
q := "SELECT * FROM users WHERE email = '" + email + "'"
db.QueryContext(ctx, q)
```

Even with "trusted" inputs, the next refactor passes user input through the same path. Always use placeholders.

```go
db.GetContext(ctx, &u, "SELECT id FROM users WHERE email = $1", email)
```

## 2. `db.Query` Without Context

```go
// Bad — no timeout; cannot be canceled.
rows, _ := db.Query("SELECT ...")
```

When the client disconnects, the query runs to completion against the DB anyway, holding a pool connection.

```go
rows, err := db.QueryContext(ctx, "SELECT ...")
```

## 3. Forgetting `rows.Close()`

```go
// Bad — connection returned to the pool only when the rows are garbage-collected.
rows, _ := db.QueryContext(ctx, "SELECT ...")
for rows.Next() { ... }
```

Under load, the pool exhausts; subsequent queries block. Defer immediately.

```go
rows, err := db.QueryContext(ctx, "SELECT ...")
if err != nil { return err }
defer rows.Close()
```

## 4. Missing `rows.Err()`

```go
// Bad — iteration may have stopped early due to network error.
for rows.Next() {
    _ = rows.Scan(&u)
    out = append(out, u)
}
return out, nil  // ← caller thinks the list is complete
```

```go
if err := rows.Err(); err != nil { return nil, err }
return out, nil
```

## 5. `db.Query` for INSERT/UPDATE/DELETE

`Query` returns `*Rows` that must be closed; if you don't, the connection leaks. `Exec` returns `Result` and releases the connection on return.

```go
// Bad
db.Query("UPDATE users SET active = false WHERE id = $1", id)

// Good
db.ExecContext(ctx, "UPDATE users SET active = false WHERE id = $1", id)
```

## 6. Returning `*sql.DB` from Repositories

```go
// Bad — every caller knows it's database/sql.
type UserRepo struct{}
func (r *UserRepo) DB() *sql.DB { return r.db }
```

Now swapping to pgx requires touching every caller. Repositories should return domain types and accept `context.Context` — the underlying driver stays private.

## 7. ORM Hooks for Business Logic

```go
// Bad — BeforeSave fires a notification, but only sometimes (depending on bulk vs single save).
func (u *User) BeforeSave(tx *gorm.DB) error {
    notify("user created")
    return nil
}
```

State machines living in framework lifecycle hooks are invisible at the call site. Move logic into a service function with explicit steps.

## 8. Unlimited Connection Pool

```go
// Bad — Go default is unlimited; a load spike exhausts pg_max_connections.
db, _ := sql.Open("postgres", dsn)
```

```go
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(10)
db.SetConnMaxLifetime(5 * time.Minute)
```

A reasonable starting point: `MaxOpenConns ≤ pg_max_connections / replica_count - headroom`.

## 9. External Calls Inside a Transaction

```go
// Bad — Stripe call inside the tx holds the row lock for seconds.
withTx(ctx, db, func(tx *sqlx.Tx) (struct{}, error) {
    tx.ExecContext(ctx, "UPDATE orders ...")
    stripe.Capture(ctx, id)
    return struct{}{}, nil
})
```

Do the external work first; record the result in a short transaction afterwards. See [transactions.md](transactions.md).

## 10. ORM-Generated Migrations

```go
db.AutoMigrate(&User{})
```

The ORM picks index strategies, types, and constraints based on Go tags. A column type that's "fine" on toy data may cause table rewrites on production. Indexes that the ORM omits cause table scans.

Write migrations as SQL, version them with `golang-migrate` or Atlas, review them as humans.

## 11. Scanning NULL into Non-Pointer

```go
type User struct {
    Bio string `db:"bio"` // ← bio can be NULL
}
db.GetContext(ctx, &u, "SELECT id, bio FROM users WHERE id = $1", id)
// → "sql: Scan error: converting NULL to string is unsupported"
```

Use `*string` or `sql.NullString`.

## 12. Wildcard `SELECT *`

```go
db.SelectContext(ctx, &users, "SELECT * FROM users")
```

Adding a column to the table now breaks scanning, and the binary ships unnecessary bytes. Spell out columns:

```go
db.SelectContext(ctx, &users, "SELECT id, email, name, created_at FROM users")
```

## 13. Reusing the Same `*sql.Tx` Across Goroutines

`*sql.Tx` is not safe for concurrent use. Spawning goroutines that share a tx will silently produce errors or use different connections from the pool. Run statements sequentially within a tx.

## 14. Logging the SQL String at Info Level

In production, the SQL string contains personally-identifying data (email, IDs) once the placeholder is substituted by the driver. Log query templates and parameter shapes, not values. (See go-logging skill.)

## 15. ORM `Find` Without Pagination

```go
var users []User
db.Find(&users) // ← all users, no LIMIT
```

A "small" table at launch becomes a 5M-row table 18 months later; the same line now OOMs the process. Always paginate list queries, even when you "know" the data is small.
