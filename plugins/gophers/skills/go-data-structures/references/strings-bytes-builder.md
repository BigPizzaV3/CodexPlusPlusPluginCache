# Strings, Bytes, and Builders

A `string` is a 2-word header (`ptr`, `len`) over **immutable** bytes. A `[]byte` is a 3-word slice over **mutable** bytes. Conversion between them allocates and copies — choose the right base type upfront.

## When to Use Which

| Need | Use |
|---|---|
| Read-only text, map key, return value | `string` |
| Build text incrementally | `strings.Builder` |
| Mutable byte buffer | `[]byte` |
| Read + write via `io.Reader`/`io.Writer` | `bytes.Buffer` |
| Unicode codepoint iteration | `for _, r := range s` (rune by rune) |
| Indexing single bytes (ASCII) | `s[i]` (byte) |

## `strings.Builder`

The canonical way to build a string from many pieces. Internally it uses a `[]byte`; calling `String()` returns the buffer without copying (the builder promises not to mutate after).

```go
var b strings.Builder
b.Grow(estimatedSize)        // preallocate (optional)
b.WriteString("hello, ")
b.WriteString(name)
b.WriteByte('!')
return b.String()            // single allocation total
```

Rules:

- **Do not copy a non-zero Builder.** Pass `*strings.Builder` if you need to share.
- **`Grow(n)`** if you can estimate the final size — avoids reallocations.
- After `String()`, the builder is dead — further writes work but invalidate the returned string in subtle cases. Reuse via `b.Reset()`.

## `bytes.Buffer`

Use when you need both directions — `io.Reader` and `io.Writer` — or when you're working with byte slices.

```go
var buf bytes.Buffer
io.Copy(&buf, src)              // Buffer is an io.Writer
data := buf.Bytes()             // direct view, no copy
str := buf.String()             // copy (Buffer doesn't promise immutability)
```

For *just* building a string, `strings.Builder` is preferable because `String()` doesn't copy.

## String ↔ Byte Conversions

`[]byte(s)` and `string(b)` allocate and copy. In hot paths, this matters.

Tricks (safe in current Go, may break with internal changes):

- `strings.Builder.Write(b)` accepts a byte slice without copying.
- `bytes.Buffer.WriteString(s)` writes a string without converting first.

The cleanest practice is: **pick one base type for a flow** and convert only at the boundaries.

```go
// Bad — converting both ways in a loop
for _, s := range parts {
    buf = append(buf, []byte(s)...)
}

// Good — write strings directly into a byte buffer
var bb bytes.Buffer
for _, s := range parts {
    bb.WriteString(s)
}
```

## Runes and Bytes

`for i, r := range s` decodes UTF-8 one rune at a time. `i` is the byte index of the start of that rune — not a rune index.

```go
s := "héllo"
for i, r := range s {
    fmt.Println(i, r)
}
// 0 'h'
// 1 'é'   (byte index)
// 3 'l'
// 4 'l'
// 5 'o'
```

`len(s)` returns bytes, not runes. For rune count, use `utf8.RuneCountInString(s)`.

`[]rune(s)` allocates a slice of runes — useful when you need random access by character.

## `strings` Package Highlights

```go
strings.Contains, Index, HasPrefix, HasSuffix, Replace, ReplaceAll
strings.Split, Join, Fields
strings.ToLower, ToUpper, Title, ToValidUTF8
strings.NewReader(s)               // io.Reader over a string
strings.Cut(s, sep)                // single-split (Go 1.18+)
strings.CutPrefix, CutSuffix       // remove and report ok (Go 1.20+)
```

`strings.Cut` is preferred over `Split` when you want exactly one separator — it returns `(before, after, found)`.

## `bytes` Package Highlights

Mirrors `strings` for `[]byte`. Use it when working with raw byte streams (network protocols, binary parsers) so you don't pay the conversion cost.

## Performance Notes

- `strings.Builder.Grow(n)` if you can estimate size — biggest single win.
- `fmt.Sprintf("%s%s", a, b)` allocates and is ~10x slower than `a + b` for two known strings.
- `+` chaining of many strings allocates O(n²) — switch to `Builder` at ~3+ pieces in a loop.
- `strconv.Itoa(n)` is faster than `fmt.Sprint(n)` for integer-to-string.

## Anti-Patterns

- `bytes.Buffer` used only to build a string — extra copy in `String()`. Use `strings.Builder`.
- Building a string by `s = s + part` in a loop — quadratic.
- `len(s)` to count characters in unicode text — counts bytes, not runes.
- Copying a non-zero `strings.Builder` — invalid; pass a pointer.
- Repeated `[]byte("constant")` in a hot loop — convert once outside.
