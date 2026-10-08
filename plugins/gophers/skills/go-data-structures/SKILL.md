---
name: go-data-structures
description: "Use when choosing or operating on Go slices, maps, arrays, strings, or container/* types — including slice internals, capacity growth, preallocation, map buckets, sets via map[T]struct{}, strings.Builder vs bytes.Buffer, generic containers, and the slices/maps standard packages (Go 1.21+). Apply proactively whenever data is being collected, transformed, or copied, even if the user has not asked about allocation."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. slices/maps packages need Go 1.21+; iterator helpers need 1.23+; weak.Pointer needs 1.24+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Data Structures

Pick the structure that fits the access pattern — not the most familiar one. Slices and maps are the workhorses; arrays, container types, and the `slices`/`maps` packages cover the rest. Understanding the **header layout**, **growth costs**, and **copy semantics** of each turns most performance questions into one-line decisions.

## Core Rules

1. **Slices and maps are reference types** — assigning copies the header, not the data. Use `slices.Clone` / `maps.Clone` for a true copy.
2. **Preallocate** with `make([]T, 0, n)` and `make(map[K]V, n)` whenever the size is known or estimable.
3. **Always assign the result of `append`** — the backing array may move.
4. **Use `slices` and `maps` packages** (Go 1.21+) instead of hand-rolled helpers.
5. **`map[K]struct{}` is the canonical set** — zero-byte values, no boolean ambiguity.
6. **`strings.Builder` for string building**, `bytes.Buffer` when you need `io.Reader`/`io.Writer`.

## Picking a Structure

```
What do you need?
├─ Ordered, fixed compile-time size      → [N]T  array
├─ Ordered, dynamic size                 → []T   slice
│  ├─ Known size               → make([]T, 0, n)
│  └─ JSON output must be []   → []T{} literal (not nil)
├─ Key/value lookup                      → map[K]V
│  ├─ Need a set            → map[K]struct{}
│  └─ Known size            → make(map[K]V, n)
├─ Priority queue / top-k                → container/heap
├─ Frequent middle insertion             → container/list
├─ Fixed-size rolling window             → container/ring
├─ Pure string building                  → strings.Builder
└─ Read+write of bytes                   → bytes.Buffer
```

## Slice Internals

A slice is a 3-word header: pointer, length, capacity. Multiple slices can alias the same backing array — `s[1:4]` shares memory with `s`.

### Capacity Growth

The exact algorithm has changed across versions; do **not** rely on it. As of recent Go:

- `len < 256` → capacity roughly doubles.
- `len ≥ 256` → grows by ~25%.
- Each growth allocates a new backing array and copies — O(n) per growth.

### Preallocation

```go
users := make([]User, 0, len(ids))         // exact size
results := make([]Result, 0, estimated)    // approximate
s = slices.Grow(s, additional)             // pre-grow before bulk append (Go 1.21+)
```

### `slices` Package (Go 1.21+)

| Function | Purpose |
|---|---|
| `Sort`, `SortFunc`, `SortStableFunc` | sorting |
| `BinarySearch`, `BinarySearchFunc` | sorted lookup |
| `Contains`, `Index`, `IndexFunc` | search |
| `Compact`, `CompactFunc` | dedupe adjacent equals |
| `Clone`, `Equal` | safe copy / comparison |
| `Delete`, `DeleteFunc` | removal preserving order |
| `Grow` | preallocate before append |
| `Concat` (1.22+) | concatenate slices |

Prefer these over hand-rolled loops — they're tested, generic, and use the fastest available paths.

> Read [references/slices-and-maps.md](references/slices-and-maps.md) for capacity growth, aliasing pitfalls, and 2-D slice patterns.

## nil vs Empty Slice: The JSON Trap

Both have `len == 0` and `cap == 0`, but they encode differently:

```go
var nilSlice []string         // → JSON: null
emptySlice := []string{}      // → JSON: []
```

API contracts almost always want `[]`. **Initialise the slice explicitly** in any struct that gets marshaled to JSON, and treat nil/empty as identical when *reading* (use `len(s) == 0`).

For internal computation where nil is never marshaled, the nil slice is conventional and slightly cheaper (no allocation until first append).

## Maps

Maps are hash tables with 8-entry buckets and overflow chains. They are reference types — assigning a map copies a pointer.

### Preallocation

```go
m := make(map[string]*User, len(users)) // avoids rehashing during population
```

The size hint is *approximate* (it's about bucket count), but it still saves repeated rehashing in the common case.

### Sets

```go
type Set[T comparable] map[T]struct{}

func (s Set[T]) Add(v T)         { s[v] = struct{}{} }
func (s Set[T]) Has(v T) bool    { _, ok := s[v]; return ok }
func (s Set[T]) Remove(v T)      { delete(s, v) }
```

`struct{}` is zero bytes; the set is just the key set of the underlying map.

`map[K]bool` is also common but ambiguous: did `false` mean "explicitly excluded" or "not present"? `struct{}` removes the question.

### `maps` Package (Go 1.21+)

`Clone`, `Equal`/`EqualFunc`, `DeleteFunc`; `Keys`, `Values`, `Collect`, `Insert` since 1.23 (iterators).

> Read [references/strings-bytes-builder.md](references/strings-bytes-builder.md) for string-vs-bytes, `Builder` vs `Buffer`, and rune handling.

## Arrays

Fixed-size, value type, copied on assignment. Useful for compile-time-known sizes:

```go
type Digest [32]byte
type IP4 [4]byte
cache := map[[2]int]Result{} // arrays are comparable → usable as map keys
```

For anything dynamic, use a slice.

## container/* and Third-Party

| Package | Use case | Caveat |
|---|---|---|
| `container/heap` | priority queue, top-K | implement the interface yourself |
| `container/list` | LRU, frequent middle splice | poor cache locality |
| `container/ring` | rolling window, round-robin | fixed size |
| `bufio` | I/O with many small reads/writes | always check `Flush` errors |

For typed sets/queues/trees beyond the stdlib, prefer well-tested libraries (`emirpasic/gods`, `gammazero/deque`) and benchmark before optimising.

> Read [references/containers-and-pointers.md](references/containers-and-pointers.md) for heap implementation, `unsafe.Pointer`'s six valid patterns, and `weak.Pointer[T]`.

## Copy Semantics Cheat Sheet

| Type | Copy behaviour |
|---|---|
| primitives, arrays, structs | value (deep for contained value fields) |
| slice | header copied, backing array shared — use `slices.Clone` |
| map, channel | reference copied — use `maps.Clone` for maps |
| `*T`, `interface` | address / (type, value) pair copied |

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `s := append(s, x)` ignoring return | Backing array may move; `s` becomes stale | Always reassign |
| `var m map[K]V; m[k] = v` | nil map panic | `m := make(map[K]V)` or `map[K]V{}` |
| `var s []T` then marshal to JSON as `[]` | Encodes as `null` | `s := []T{}` |
| `make([]T, 0, 10000)` "just in case" | Wasted memory | Size by actual data |
| `m := map[K]bool{}` as a set | `false` is ambiguous | `map[K]struct{}` |
| `bytes.Buffer` for pure string building | Extra copy in `String()` | `strings.Builder` |
| Large struct values in a map | Each lookup copies the value | `map[K]*V` |

## Verification Checklist

- [ ] Every `make([]T, ...)` and `make(map[K]V, ...)` has a capacity hint when the size is known.
- [ ] Every `append` reassigns its result.
- [ ] Slices marshaled to JSON are initialised as `[]T{}`, not `var s []T`.
- [ ] All "sets" use `map[K]struct{}` (or a generic `Set[T]` wrapper).
- [ ] No `bytes.Buffer` used purely for `String()` output.
- [ ] No `*sync.Mutex` copied via struct assignment (`go vet copylocks`).
- [ ] `slices.Clone` / `maps.Clone` used when handing data to callers that may mutate.

## References

- [references/slices-and-maps.md](references/slices-and-maps.md) — internals, growth, aliasing, `slices`/`maps` packages
- [references/strings-bytes-builder.md](references/strings-bytes-builder.md) — `strings.Builder`, `bytes.Buffer`, rune handling
- [references/containers-and-pointers.md](references/containers-and-pointers.md) — `container/heap`, generic wrappers, `unsafe.Pointer`, `weak.Pointer`
