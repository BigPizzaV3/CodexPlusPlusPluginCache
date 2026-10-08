# Allocation, Memory, sync.Pool, and Struct Layout

The Go garbage collector is fast but not free. Every allocation costs CPU at allocation time, costs CPU again at GC time, and contributes to GC pauses. Reducing allocations is usually the highest-ROI optimisation available.

## What Allocates

| Construct | Allocates? |
|---|---|
| `make([]T, n)` | yes |
| `make(map[K]V, n)` | yes |
| `new(T)` | yes |
| `&T{}` literal | usually yes (escape analysis decides) |
| `interface{}` boxing | yes (one alloc per box) |
| Closures capturing variables by reference | usually |
| `append` past capacity | yes |
| `fmt.Sprintf` with `%v` of a value | often (via interface boxing) |

## Escape Analysis Heuristics

```bash
go build -gcflags='-m -l' ./pkg/... 2>&1 | grep escapes
```

Common causes of escape:

- Returning a pointer to a local.
- Storing in a `[]*T` or `map[K]*V`.
- Capturing in a closure that itself escapes.
- Passing to `fmt.Println` / anything that takes `any` (the boxing escapes).

When eliminating an escape:

- Return a value instead of a pointer if the type is small.
- Use `slices.Index` instead of a closure-based search.
- Pass `*Logger` once at construction instead of through every call site.

## Preallocation

```go
out := make([]Result, 0, len(input))
for _, x := range input {
    out = append(out, transform(x))
}
```

For maps:

```go
m := make(map[string]*User, len(users))
```

For `strings.Builder`:

```go
var b strings.Builder
b.Grow(estimated)
```

For `bytes.Buffer`:

```go
var buf bytes.Buffer
buf.Grow(estimated)
```

## `sync.Pool`

`sync.Pool` keeps a per-P (per-CPU) cache of reusable objects. Best for things that are expensive to allocate, used briefly, and discarded.

```go
var bufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

func writeReport(w io.Writer, r Report) error {
    buf := bufPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufPool.Put(buf)
    }()
    // ... write into buf, then copy to w ...
    _, err := w.Write(buf.Bytes())
    return err
}
```

Rules:

- **Reset before `Put`.** Otherwise the next user gets stale state.
- **Never assume the pool keeps your object.** The GC can drop pool entries between cycles.
- **Pool large objects, not tiny ones.** For 16-byte structs, the pool overhead dominates.

## Struct Field Alignment

Go aligns fields to their natural alignment, padding between misaligned fields. Reordering can shrink structs.

```go
// 24 bytes on 64-bit (3 words, with 7 bytes of padding)
type Bad struct {
    a bool   // 1 byte + 7 padding
    b int64  // 8
    c bool   // 1 byte + 7 padding
}

// 16 bytes (2 words)
type Good struct {
    b int64
    a bool
    c bool   // adjacent bools pack into the same word
}
```

`go vet` includes a `fieldalignment` analyser:

```bash
go install golang.org/x/tools/go/analysis/passes/fieldalignment/cmd/fieldalignment@latest
fieldalignment ./...
```

Apply this on hot structs that appear in large slices/maps; the savings multiply.

## Backing-Array Leaks

When you return a sub-slice of a larger buffer to a caller, the **whole backing array is retained** for as long as the caller holds the sub-slice.

```go
// Bug — keeps the entire 1MB buffer alive
func ParseHeader(b []byte) []byte {
    big := make([]byte, 1<<20)
    parse(big, b)
    return big[:headerLen]
}

// Fix — copy out the part that escapes
func ParseHeader(b []byte) []byte {
    big := make([]byte, 1<<20)
    parse(big, b)
    out := make([]byte, headerLen)
    copy(out, big[:headerLen])
    return out
}
```

The `slices.Clip(s)` helper (Go 1.21+) reduces cap to len, releasing the unused tail to GC.

## Boxing Into Interfaces

Each conversion of a non-interface value to an interface allocates a small (16-byte) header on the heap.

```go
// Hidden allocation — 1 alloc per call
log.Print(n) // n boxed into ...any

// Better when hot — avoid boxing
slog.Info("count", slog.Int("n", n)) // typed Attr, no boxing
```

`slog.LogAttrs` is specifically designed for hot paths because it accepts typed `Attr` instead of `...any`.

## GC Tuning

Two main knobs:

- **`GOGC`** (default 100) — trigger GC when heap doubles vs after last GC. Higher = less GC CPU, more memory.
- **`GOMEMLIMIT`** (Go 1.19+) — soft cap on total memory. The runtime trades extra CPU to stay below it. **Always set this in containers** to about 80-90% of the container limit — without it, the GC waits too long and the kernel OOM-kills the process.

```bash
GOMEMLIMIT=900MiB GOGC=100 ./server
```

## Anti-Patterns

- `sync.Pool` for tiny objects — overhead dominates.
- `sync.Pool.Get` then forgetting to `Put` — defeats the purpose.
- Returning a sub-slice of a large internal buffer to callers — retains the whole array.
- Storing primitives in `map[string]any` to "be generic" — every value box allocates.
- Setting `GOGC=off` in production — runs out of memory under any sustained load.
- Tuning `GOGC` based on a single load test on a developer laptop.
