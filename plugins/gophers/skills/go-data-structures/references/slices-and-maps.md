# Slices and Maps: Internals and the slices/maps Packages

## Slice Header

A slice value is three machine words:

```
struct {
    ptr *T   // backing array
    len int
    cap int
}
```

Passing a slice copies the header (cheap), not the array. Both copies see the same elements; both can grow independently up to `cap`.

## Aliasing

`s[1:3]` produces a new header pointing into the same array. Writes through one slice are visible through the other.

```go
a := []int{1, 2, 3, 4, 5}
b := a[1:4]   // b shares a's array
b[0] = 99
fmt.Println(a) // [1 99 3 4 5]
```

This is fast and powerful, but also the source of subtle bugs. When handing a slice out to a caller who may mutate it, **clone**:

```go
out := slices.Clone(internal)
return out
```

## Growth and `append`

`append(s, x)` may or may not reallocate. If `cap(s) - len(s) >= 1`, it writes in place. Otherwise it allocates a new larger array, copies, and returns the new header.

Therefore:

```go
s = append(s, x) // always reassign — the old s may be stale
```

Capacity growth (current Go):

- `len < 256` → roughly doubles.
- `len ≥ 256` → grows by ~25%.
- Round up to size class boundary.

**Do not depend on the exact growth schedule.** It changed between versions and may change again.

### Pre-growing

```go
s = slices.Grow(s, 1000)            // ensure capacity for 1000 more (Go 1.21+)
for _, x := range incoming {
    s = append(s, x)                // zero reallocations
}
```

Equivalent older idiom:

```go
s := make([]T, 0, len(input))
for _, x := range input { s = append(s, transform(x)) }
```

## 2-D Slices

Two patterns, picked by access pattern:

```go
// Independent rows (can grow each row)
rows := make([][]int, n)
for i := range rows {
    rows[i] = make([]int, m)
}

// Single allocation (more cache-friendly, fixed shape)
backing := make([]int, n*m)
rows := make([][]int, n)
for i := range rows {
    rows[i] = backing[i*m : (i+1)*m]
}
```

The second form is one allocation and one contiguous array — preferred for math/matrix workloads.

## `slices` Package Cheat Sheet (Go 1.21+)

```go
slices.Sort(ints)
slices.SortFunc(users, func(a, b User) int { return cmp.Compare(a.Name, b.Name) })

idx, ok := slices.BinarySearch(sorted, target)

s = slices.Clone(s)                   // shallow copy
ok := slices.Equal(a, b)              // ==

s = slices.Compact(s)                 // remove consecutive duplicates
s = slices.DeleteFunc(s, isDeleted)   // remove by predicate

s = slices.Grow(s, n)                 // ensure cap
```

Prefer these to hand-rolled loops — they're generic, tested, and benchmarked.

## Map Internals

Maps are hash tables. Each "bucket" holds 8 entries; overflow chains handle collisions. The runtime grows the map when load factor exceeds ~6.5 entries per bucket.

Key properties:

- **Iteration order is randomised.** Never depend on it. If you need sorted output, sort the keys.
- **Maps never shrink.** Deleting all entries leaves the buckets allocated. For a workload that grows then shrinks dramatically, allocate a fresh map.
- **Reference type.** Assigning copies the header; both names see the same data.

### Preallocation

```go
m := make(map[string]*User, len(users))
for _, u := range users {
    m[u.ID] = u
}
```

The hint is approximate — the runtime picks bucket counts in powers of two — but it still avoids the most expensive rehash steps in the steady-state case.

### Iteration

```go
for k, v := range m { ... }       // order random
for k := range m { ... }          // keys only
for _, v := range m { ... }       // values only
```

For sorted output:

```go
keys := slices.Collect(maps.Keys(m))   // Go 1.23+
slices.Sort(keys)
for _, k := range keys { use(m[k]) }
```

## `maps` Package (Go 1.21+)

```go
m2 := maps.Clone(m)
ok := maps.Equal(a, b)

maps.DeleteFunc(m, func(k string, v int) bool { return v < 0 })

for k := range maps.Keys(m)   { ... } // Go 1.23+ iterators
for v := range maps.Values(m) { ... }
```

## Aliasing Pitfalls

```go
// Bug: storing the loop variable address
type Index map[string]*User
idx := Index{}
for _, u := range users {
    idx[u.ID] = &u   // all values point to the same loop variable (pre Go 1.22)
}

// Fix
for _, u := range users {
    u := u
    idx[u.ID] = &u
}
```

Go 1.22 changed the loop variable to per-iteration scope, which removes this trap for new code — but mixed-version codebases still hit it.

## Anti-Patterns

- Reading `cap(s)` to decide algorithmic behaviour — the growth schedule is not API.
- Returning a sub-slice of an internal buffer to a caller who may retain it (caller pins the whole backing array).
- Iterating a map and assuming order across runs or across machines.
- Storing very large values directly in a map (`map[K]BigStruct`) — every lookup copies the value; use `map[K]*BigStruct`.
- Manual `for i, x := range s { ... }` followed by `s = append(s[:i], s[i+1:]...)` — use `slices.Delete`.
