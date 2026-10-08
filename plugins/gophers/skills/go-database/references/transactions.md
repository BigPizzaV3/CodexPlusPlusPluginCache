# Transactions, Isolation, and Locking

A transaction is a fence: writes inside it are atomic, writes outside it are not. Get the isolation level right and you avoid the worst concurrency bugs.

## The Basic Wrapper

```go
func withTx[T any](ctx context.Context, db *sqlx.DB, fn func(tx *sqlx.Tx) (T, error)) (T, error) {
    var zero T

    tx, err := db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
    if err != nil {
        return zero, fmt.Errorf("begin: %w", err)
    }

    out, err := fn(tx)
    if err != nil {
        if rbErr := tx.Rollback(); rbErr != nil && !errors.Is(rbErr, sql.ErrTxDone) {
            return zero, fmt.Errorf("rollback after %v: %w", err, rbErr)
        }
        return zero, err
    }
    if err := tx.Commit(); err != nil {
        return zero, fmt.Errorf("commit: %w", err)
    }
    return out, nil
}
```

Three guarantees:

- Rollback on any error from `fn`.
- Commit only when `fn` returned nil.
- Ignore `sql.ErrTxDone` on rollback (the tx might have ended already).

## Isolation Levels

| Level | Prevents | Allows | Use for |
|---|---|---|---|
| Read Uncommitted | Nothing (rarely supported) | Dirty reads | Don't |
| Read Committed (default) | Dirty reads | Non-repeatable reads, phantoms | Most workloads |
| Repeatable Read | Non-repeatable reads | Phantoms (Postgres: snapshot isolation, also prevents phantoms in many cases) | Reports, exports |
| Serializable | Everything | — but conflicts return `40001` errors | Financial, inventory, anywhere "the answer must be right" |

Default in Postgres is Read Committed. Move to Serializable when correctness beats throughput, and wrap calls in a retry loop for `40001 serialization_failure`.

```go
const maxRetries = 3
for i := 0; i < maxRetries; i++ {
    err = withTx(ctx, db, func(tx *sqlx.Tx) (struct{}, error) {
        return struct{}{}, doMoney(ctx, tx)
    })
    var pgErr *pgconn.PgError
    if errors.As(err, &pgErr) && pgErr.Code == "40001" {
        time.Sleep(backoff(i))
        continue
    }
    break
}
```

## SELECT FOR UPDATE

When you read a row you intend to update, lock it inside the transaction:

```sql
SELECT balance FROM accounts WHERE id = $1 FOR UPDATE;
```

This blocks concurrent transactions from reading the same row with `FOR UPDATE` until the lock holder commits or rolls back. Without it, two transfers can each read the same balance, both compute "balance - 100", and both write — losing 100 dollars.

Variants:

- `FOR UPDATE` — exclusive, blocks readers using `FOR UPDATE`.
- `FOR SHARE` — shared, blocks other `FOR UPDATE` but allows other `FOR SHARE`.
- `FOR UPDATE SKIP LOCKED` — skip rows already locked; useful for queue-style workers.
- `FOR UPDATE NOWAIT` — fail immediately if the row is locked.

## Optimistic Locking

Alternative to `FOR UPDATE`: add a `version` column, write `UPDATE ... WHERE version = $1`, and check `RowsAffected`.

```go
res, err := tx.ExecContext(ctx,
    "UPDATE accounts SET balance = $1, version = version + 1 WHERE id = $2 AND version = $3",
    newBalance, id, expectedVersion)
if err != nil { return err }
n, _ := res.RowsAffected()
if n == 0 {
    return ErrConflict // someone else updated concurrently; caller retries
}
```

Optimistic is cheaper than locks when conflicts are rare. Pessimistic (`FOR UPDATE`) is safer when conflicts are common.

## Transaction Scope

```go
// Bad — external service call inside a transaction.
err := withTx(ctx, db, func(tx *sqlx.Tx) (struct{}, error) {
    if _, err := tx.ExecContext(ctx, "UPDATE orders SET status = 'paid' WHERE id = $1", id); err != nil { return struct{}{}, err }
    if err := stripeClient.Capture(ctx, id); err != nil { return struct{}{}, err } // ← holds DB lock during HTTP call
    return struct{}{}, nil
})
```

The transaction holds row locks the entire time the HTTP call runs — seconds, possibly tens of seconds. Concurrent updates queue, p99 latency climbs.

Pattern: do external work first, then a short transaction that records the result.

```go
charge, err := stripeClient.Capture(ctx, id)
if err != nil { return err }
return withTx(ctx, db, func(tx *sqlx.Tx) (struct{}, error) {
    _, err := tx.ExecContext(ctx,
        "UPDATE orders SET status='paid', stripe_charge_id=$1 WHERE id=$2",
        charge.ID, id)
    return struct{}{}, err
})
```

## Read-Only Transactions

For multi-statement reports that must see a consistent snapshot:

```go
tx, _ := db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
```

The `ReadOnly` flag lets Postgres skip some bookkeeping and is a clear hint to reviewers.

## Distributed Transactions

`database/sql` does not support 2-phase commit across databases. If you need cross-resource consistency:

- Use the outbox pattern: write to a local outbox table in the same transaction as your business write, and let a separate process publish from the outbox.
- Or accept eventual consistency and design for compensating actions (Saga).

Avoid XA / 2PC unless you have specific operational expertise.

## Common Mistakes

| Mistake | Effect |
|---|---|
| Forgetting `tx.Rollback()` on early return | Tx held until connection idles out; pool exhaustion |
| Using `db.QueryContext` inside a tx | Query runs on a different connection — outside the tx |
| Committing in a `defer` | Commits even on panic; lost atomicity |
| Long-running tx waiting on external I/O | Lock contention, p99 explosion |
| Treating Read Committed like Serializable | Race conditions invisible until production load |
