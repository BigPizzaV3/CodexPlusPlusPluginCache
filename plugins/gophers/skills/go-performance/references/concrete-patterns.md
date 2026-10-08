# Concrete Hot-Path Patterns

The catalogue of small changes that consistently move the needle when applied to verified hot paths. Each row's numbers are illustrative and version-dependent — re-measure on your machine before believing them.

## Conversions: `strconv` over `fmt`

```go
// Bad
s := fmt.Sprint(n)
i, _ := strconv.Atoi(fmt.Sprintf("%d", n))

// Good
s := strconv.Itoa(n)
i, _ := strconv.Atoi(input)
```

| Operation | ns/op | allocs |
|---|---|---|
| `fmt.Sprint(int)` | ~143 | 2 |
| `strconv.Itoa(int)` | ~64 | 1 |
| `fmt.Sprintf("%d", n)` | ~165 | 2 |
| `fmt.Sprintf("%s: %d", s, n)` | ~250 | 3 |

Use `fmt` for complex formatted strings; use `strconv` for primitives.

## Avoid Repeated `[]byte("…")` in Loops

```go
// Bad — allocates on every iteration
for i := 0; i < n; i++ {
    w.Write([]byte("delimiter"))
}

// Good — convert once outside
delim := []byte("delimiter")
for i := 0; i < n; i++ {
    w.Write(delim)
}
```

About 7x faster on tight loops, no per-iteration allocation.

For constants, declare at package level:

```go
var newlineBytes = []byte{'\n'}
```

## Slice Capacity

`make([]T, 0, n)` allocates exactly `n` slots. Subsequent `append` is free until capacity is reached.

```go
// Bad
out := []int{}
for _, x := range input {
    out = append(out, x*2)
}

// Good
out := make([]int, 0, len(input))
for _, x := range input {
    out = append(out, x*2)
}
```

| | Time (100M iterations, synthetic) |
|---|---|
| No capacity | ~2.48s |
| With capacity | ~0.21s |

About 12x faster when growth dominated the original.

## Map Capacity Hint

Map capacity is approximate (bucket count rounded to a power of two), but still avoids the most expensive rehashes.

```go
m := make(map[string]int, len(items))
for _, it := range items {
    m[it.Key] = it.Value
}
```

## `strings.Builder` for Loop Concatenation

```go
// Bad — O(n²)
s := ""
for _, w := range words {
    s += w
}

// Good — O(n)
var b strings.Builder
b.Grow(estimatedTotalLen)
for _, w := range words {
    b.WriteString(w)
}
s := b.String()
```

For 100 small strings, the difference is roughly two orders of magnitude.

| Strategy | Best for |
|---|---|
| `+` | 2-3 strings, simple concat |
| `fmt.Sprintf` | complex formatted output |
| `strings.Builder` | loop-built strings |
| `strings.Join` | joining a slice with a separator |
| backtick literal | constant multi-line text |

## Pass Values, Not Pointers, for Small Types

```go
// Bad — pointer to a small fixed-size header
func process(s *string)
func count(r *io.Reader)

// Good
func process(s string)
func count(r io.Reader) // io.Reader is already an interface (2 words)
```

Pointer receivers are required for:

- Mutation: `func (b *Buffer) Write(p []byte)`.
- Large structs (~128B+).
- Types containing sync primitives.
- Optional values where `nil` is meaningful.

`*string`, `*int`, `*time.Time` are usually wrong.

## Avoid Reflection on Hot Paths

```go
// Bad — 50-200x slower than typed comparison
if reflect.DeepEqual(a, b) { ... }

// Good — Go 1.21+
if slices.Equal(a, b) { ... }
if maps.Equal(a, b) { ... }
if bytes.Equal(a, b) { ... }
```

If you cannot avoid reflection entirely, cache `reflect.Type` and `reflect.Value` results outside the loop.

## Reuse JSON Decoders

```go
// Bad — fresh decoder per item
for _, raw := range rawLines {
    var v Item
    _ = json.Unmarshal([]byte(raw), &v)
    use(v)
}

// Good — decoder over a streaming reader
dec := json.NewDecoder(reader)
for dec.More() {
    var v Item
    _ = dec.Decode(&v)
    use(v)
}
```

For very hot JSON paths, consider `encoding/json/v2` (when stable) or alternatives like `easyjson`/`segmentio/encoding/json`.

## HTTP Client Tuning

The default `http.Client` is fine for casual use but terrible at high concurrency: `MaxIdleConnsPerHost` defaults to 2, so a worker pool of 100 will constantly recreate connections.

```go
client := &http.Client{
    Timeout: 5 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 100,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

Match `MaxIdleConnsPerHost` to your real concurrency.

## Logging in Hot Paths

```go
// Bad — boxing into ...any, allocates even when level is disabled
slog.Info("processed", "id", id, "took", d)

// Better — typed Attr, no boxing
slog.LogAttrs(ctx, slog.LevelInfo, "processed",
    slog.String("id", id),
    slog.Duration("took", d),
)
```

Avoid logging at all inside the tightest inner loops; aggregate and log per batch.

## Inlining

The compiler inlines small functions automatically. Things that block inlining include:

- Calls to `recover`.
- `defer`.
- `select` (sometimes).
- Functions over the inliner budget (~80 nodes).

If a benchmark shows a tiny function dominating CPU and you can't inline it manually, check `go build -gcflags='-m'` — it tells you "can inline" / "cannot inline" per function.

## Anti-Patterns

- `fmt.Sprint(intVar)` in a hot path.
- `[]byte("constant")` inside a loop.
- `make([]T, 0)` immediately followed by an `append` loop of known length.
- `+` concatenation of 10+ strings in a loop.
- `*int` parameter "to save copying".
- `reflect.DeepEqual` instead of `slices.Equal` / `bytes.Equal`.
- Default `http.Client` with high concurrency.
- `slog.Info("…", "k", v)` in inner loops; use `LogAttrs` or skip entirely.
