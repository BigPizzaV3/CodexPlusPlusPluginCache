# DataLoaders

The DataLoader pattern coalesces many per-field `Load(id)` calls within a single execution tick into one batched call, eliminating N+1 queries. It also caches results within the request to avoid duplicate loads.

## The Problem

```graphql
{
  users {
    id
    posts { id title }   # one resolver call per user
  }
}
```

A naive resolver calls `db.Query("SELECT * FROM posts WHERE user_id = ?", id)` once per user. For 100 users you make 101 queries (the initial + 100). A DataLoader collapses the 100 into one `WHERE user_id IN (?, ?, ?, ...)`.

## Anatomy

```go
loader := dataloader.NewBatchedLoader[string, []*Post](
    func(ctx context.Context, keys []string) []*dataloader.Result[[]*Post] {
        rows, err := db.QueryContext(ctx,
            "SELECT user_id, id, title FROM posts WHERE user_id = ANY($1)", keys)
        if err != nil {
            return errorPerKey(keys, err)
        }
        defer rows.Close()

        byUser := make(map[string][]*Post)
        for rows.Next() {
            var p Post
            var uid string
            _ = rows.Scan(&uid, &p.ID, &p.Title)
            byUser[uid] = append(byUser[uid], &p)
        }

        out := make([]*dataloader.Result[[]*Post], len(keys))
        for i, k := range keys {
            out[i] = &dataloader.Result[[]*Post]{Data: byUser[k]} // nil slice is OK
        }
        return out
    },
)
```

Three invariants:

1. **Returned slice length == keys length.** Order matters; each result aligns to its key.
2. **A nil result for a missing key is fine** as long as the slice slot exists.
3. **Errors are per-key**, not per-batch — set `Result.Error` on the specific slot.

## Per-Request Construction

```go
type loadersKey struct{}
type Loaders struct {
    PostsByUser *dataloader.Loader[string, []*Post]
}

func DataLoaderMiddleware(db *sql.DB, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        l := &Loaders{
            PostsByUser: newPostsByUserLoader(r.Context(), db),
        }
        ctx := context.WithValue(r.Context(), loadersKey{}, l)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func For(ctx context.Context) *Loaders { return ctx.Value(loadersKey{}).(*Loaders) }
```

Why per-request? Three reasons:

- **Tenant isolation.** A package-level loader caches `user:42 → posts` and may return those posts to a different request, possibly a different tenant.
- **Cache freshness.** A request-scoped loader's cache lives for the request; the next request sees fresh data.
- **Context propagation.** The loader's batch function uses `ctx`. A global loader is stuck with `context.Background()` — no deadlines, no tracing.

## Cache Lifecycle

- Within one request, repeated `Load("u1")` returns the same cached result. This is the point.
- Across requests, the loader is discarded. Same key on a new request triggers a fresh batch.
- If you mutate data inside the request (e.g., the mutation `createPost(userId: u1)`), call `loader.Clear("u1")` so the next read in the same request sees the new post.

## Many-to-Many / Variable Keys

For loaders keyed by composite values (e.g., `(userID, sinceTime)`), encode the key as a struct:

```go
type postsKey struct {
    UserID string
    Since  time.Time
}
loader := dataloader.NewBatchedLoader[postsKey, []*Post](batchFn)
```

The library hashes struct keys — works as long as the key type is comparable.

## Common Mistakes

| Mistake | Effect |
|---|---|
| Package-level loader | Stale cache, cross-tenant leak |
| Batch fn returns shorter slice | Panic or wrong-key results |
| Batch fn ignores `ctx` | Slow tenant queries don't honor deadline |
| Mutating cached slice in a resolver | Future loads see mutated data |
| Forgetting to `Close()` rows in batch fn | Connection leak |

## With gqlgen

Mark the batched field as `resolver: true` so gqlgen emits a resolver method instead of a struct field accessor. Implement it as `loaders.For(ctx).<Field>.Load(parent.ID)`.

## With graph-gophers

Use `github.com/graph-gophers/dataloader/v7`. The library returns a thunk:

```go
thunk := loaders.For(ctx).PostsByUser.Load(ctx, dataloader.StringKey(userID))
posts, err := thunk()
```

Call the thunk inside the resolver method body.

## Verifying It Worked

Turn on SQL query logging and request `{ users { posts { id } } }` for 100 users. You should see two queries:

1. `SELECT * FROM users LIMIT 100`
2. `SELECT * FROM posts WHERE user_id = ANY('{...}')`

If you see 101 queries, the loader is not wired correctly — most often a forgotten `resolver: true` in gqlgen.yml.
