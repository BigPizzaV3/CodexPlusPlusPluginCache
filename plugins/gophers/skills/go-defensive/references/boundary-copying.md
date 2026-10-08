# Boundary Copying

Slices and maps in Go carry references to backing storage. Passing them across a boundary is passing a handle, not a value. Copying is the only way to make the boundary honest.

## When You Must Copy

### Incoming, retained

You receive a slice and hold onto it for later. The caller can mutate the backing array; you have no idea what they will do:

```go
func (s *Store) Append(items []Item) {
    s.items = append(s.items, items...) // copies elements
}

// Or explicitly:
func (s *Store) Set(items []Item) {
    s.items = make([]Item, len(items))
    copy(s.items, items)
}
```

### Outgoing, shared with internal state

You return a slice or map that points at your internal storage. Callers can mutate your state through it:

```go
// Bad
func (s *Store) Items() []Item { return s.items }

// Good
func (s *Store) Items() []Item {
    out := make([]Item, len(s.items))
    copy(out, s.items)
    return out
}
```

## When You Don't Need to Copy

- **Read-once parameters.** If your function reads `items` and returns before the caller's next statement, no copy is needed.
- **Documented borrow semantics.** When the API contract states "the slice must remain unchanged for the lifetime of X", you can skip the copy and document the contract.
- **Returning fresh allocations.** Anything constructed inside your function is already yours to return.

## Deep vs Shallow Copy

`copy()` and a `for-range` map walk are shallow. If your element type contains pointers, slices, or maps, you have only copied the references:

```go
type Node struct {
    Children []*Node
}

// Shallow copy: nodes are shared with the caller
out := make([]Node, len(in))
copy(out, in)
```

For deep ownership transfer, copy recursively or expose immutable types.

## Map Iteration

```go
clone := make(map[K]V, len(src))
for k, v := range src {
    clone[k] = v
}
```

Go 1.21+ offers `maps.Clone`, which performs the same shallow copy.

## Cost Considerations

Copying is O(n) in elements. For small slices (< 1KB), the cost is invisible. For very large or hot-path data, consider:

- An immutable slice type that only exposes index/len.
- Copy-on-write structures.
- Documenting the borrowing contract instead.

The default, though, is: copy at the boundary, then stop thinking about it.
