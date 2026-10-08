# Sync Primitives Deep Dive

How to choose between mutexes, atomics, and the higher-level helpers in `sync` / `golang.org/x/sync`.

## sync.Mutex vs sync.RWMutex

`sync.Mutex` is the default. `sync.RWMutex` is only worth it when reads dominate writes by a wide margin and the critical section is long enough that the extra bookkeeping pays for itself. Benchmark before reaching for it.

```go
type Cache struct {
    mu   sync.RWMutex
    data map[string]Entry
}

func (c *Cache) Get(k string) (Entry, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    e, ok := c.data[k]
    return e, ok
}

func (c *Cache) Set(k string, e Entry) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[k] = e
}
```

Never upgrade an `RLock` to a `Lock` — that path deadlocks.

## Atomics

Prefer typed atomics over raw `sync/atomic` operations on `int32`/`int64`:

```go
// Good: type prevents non-atomic access by mistake
var ready atomic.Bool
var hits  atomic.Uint64

ready.Store(true)
hits.Add(1)

// Bad: nothing stops a future reader from doing `running == 1` directly
var running int32
atomic.StoreInt32(&running, 1)
```

Use atomics for **independent** values (counters, single flags). The moment two atomics need to change together, you need a mutex.

## sync.Map

`sync.Map` is optimised for either:

- write-once, read-many keys, or
- keys whose sets of writers and readers are disjoint.

For workloads with frequent overlapping reads and writes, a plain `map` guarded by `sync.RWMutex` is faster *and* easier to reason about. Concurrent `map` access without synchronisation is a hard runtime crash, not a race warning — `go test -race` catches it before production.

## sync.Pool

`sync.Pool` recycles short-lived allocations. Two rules:

1. Reset the object before `Put`, so the next `Get` sees a clean state.
2. Never assume `Get` returns the object you put in — the GC may have reclaimed it.

```go
var bufPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}

func render(v any) []byte {
    b := bufPool.Get().(*bytes.Buffer)
    b.Reset()
    defer bufPool.Put(b)
    json.NewEncoder(b).Encode(v)
    return append([]byte(nil), b.Bytes()...) // copy out; pool may reuse
}
```

## sync.Once and friends (Go 1.21+)

`sync.Once.Do` runs a function exactly once. Go 1.21 added higher-level helpers that read better:

```go
var loadConfig = sync.OnceValue(func() Config {
    return mustReadConfig()
})
// every caller gets the same Config; the loader runs once
```

Use `OnceFunc`, `OnceValue`, or `OnceValues` when the wrapped function is pure (no errors that change between calls).

## singleflight

`x/sync/singleflight` collapses duplicate in-flight calls for the same key into a single execution, returning the same result to every caller. It is the standard fix for cache stampedes:

```go
var g singleflight.Group

func GetUser(ctx context.Context, id string) (*User, error) {
    v, err, _ := g.Do(id, func() (any, error) { return fetchUser(ctx, id) })
    if err != nil { return nil, err }
    return v.(*User), nil
}
```

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Embedding `sync.Mutex` in an exported struct | Make `mu` unexported; do not expose `Lock`/`Unlock` |
| `sync.RWMutex` with very short critical sections | Use `sync.Mutex`; RWMutex bookkeeping costs more |
| Mixing atomic + non-atomic access on the same field | Pick one access mode for the whole field |
| Holding a mutex across an RPC | Copy under the lock, release, then call |
| `sync.Pool` without `Reset` | Stale data leaks into the next caller |
