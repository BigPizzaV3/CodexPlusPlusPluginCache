# container/*, Generic Wrappers, unsafe.Pointer, weak.Pointer

## `container/heap`

A min-heap. Implement `heap.Interface` (length, less, swap, push, pop) and use the package functions.

```go
type PQ []*Item

func (p PQ) Len() int            { return len(p) }
func (p PQ) Less(i, j int) bool  { return p[i].Priority < p[j].Priority }
func (p PQ) Swap(i, j int)       { p[i], p[j] = p[j], p[i] }
func (p *PQ) Push(x any)         { *p = append(*p, x.(*Item)) }
func (p *PQ) Pop() any {
    old := *p
    n := len(old)
    x := old[n-1]
    *p = old[:n-1]
    return x
}

pq := &PQ{}
heap.Init(pq)
heap.Push(pq, &Item{Priority: 3})
top := heap.Pop(pq).(*Item)
```

For a max-heap, reverse the `Less` comparison.

The `any` in `Push`/`Pop` is unfortunate — a generic wrapper is worth it in any non-trivial codebase.

## `container/list`

Doubly-linked list. Useful for LRU caches and workloads with frequent middle insertions/removals. Poor cache locality — every node is a heap allocation. Benchmark before choosing it over a slice.

```go
l := list.New()
e := l.PushBack(value)
l.Remove(e)
```

For most "list" needs, a slice with `slices.Delete` is faster.

## `container/ring`

Circular doubly-linked list with no head/tail. Useful for rolling windows and round-robin scheduling when the size is fixed.

```go
r := ring.New(5)
for i := 0; i < r.Len(); i++ {
    r.Value = i
    r = r.Next()
}
```

Niche but exactly right for its niche.

## Generic Wrappers

The `container/*` packages predate generics; their `any` API loses type safety. Wrap them.

```go
type Heap[T any] struct {
    less func(a, b T) bool
    data []T
}

// implement heap.Interface internally, expose typed Push/Pop
```

For sets and queues, generics make the API clean:

```go
type Set[T comparable] map[T]struct{}

func (s Set[T]) Add(v T)         { s[v] = struct{}{} }
func (s Set[T]) Has(v T) bool    { _, ok := s[v]; return ok }
func (s Set[T]) Remove(v T)      { delete(s, v) }
func (s Set[T]) Len() int        { return len(s) }
```

## Generic Constraints: Pick the Tightest

- `comparable` — for map keys and `==` use.
- `cmp.Ordered` (Go 1.21+) — `int`, `float`, `string`, anything `<`.
- Custom interface — for domain-specific ordering.

```go
func Min[T cmp.Ordered](s []T) T {
    m := s[0]
    for _, x := range s[1:] {
        if x < m { m = x }
    }
    return m
}
```

`any` should be the last resort — at that point you've given up most of what generics offer.

## Pointer Flavours

| Type | Use | Zero value |
|---|---|---|
| `*T` | normal indirection, mutation, optional | `nil` |
| `unsafe.Pointer` | FFI, low-level layout — six valid spec patterns only | `nil` |
| `weak.Pointer[T]` (Go 1.24+) | caches, canonicalisation | (no `nil`) |

## `unsafe.Pointer`

The six valid conversion patterns from the Go spec (paraphrased):

1. Conversion of `*T1` to `unsafe.Pointer` to `*T2`.
2. Conversion of `unsafe.Pointer` to `uintptr` (only for printing / system calls — see #4).
3. Conversion of `uintptr` to `unsafe.Pointer` — only when the `uintptr` was produced from a valid pointer that is still live.
4. Conversion of `unsafe.Pointer` to `uintptr` and back **in the same expression** for pointer arithmetic.
5. Conversion of `unsafe.Pointer` to `unsafe.SliceData`/`unsafe.StringData` results.
6. Conversion to `reflect.Value.UnsafePointer()` results.

The crucial rule: **never store a converted `uintptr` in a variable across statements**. The GC can move the underlying object between statements — the `uintptr` becomes a dangling reference with no way to know.

```go
// Bad — uintptr survives across statements; object may move
p := uintptr(unsafe.Pointer(&x))
doSomething()
*(*int)(unsafe.Pointer(p)) = 42

// Good — entirely within one expression
*(*int)(unsafe.Pointer(uintptr(unsafe.Pointer(&x)) + offset)) = 42
```

Reach for `unsafe` only after profiling proves it's worth the cost.

## `weak.Pointer[T]` (Go 1.24+)

A weak reference does **not** prevent the GC from collecting the target. Use for caches and canonicalisation maps where holding entries forever would be a leak.

```go
import "weak"

type Cache struct {
    m map[string]weak.Pointer[Entry]
}

func (c *Cache) Get(k string) *Entry {
    if wp, ok := c.m[k]; ok {
        if e := wp.Value(); e != nil {
            return e
        }
    }
    return nil
}
```

When the strong reference goes away and GC runs, `wp.Value()` returns `nil`. The cache shrinks naturally without a custom eviction policy.

## Anti-Patterns

- `container/list` for an append-mostly workload — slice is faster.
- `any` in a generic API when a constraint would do.
- Storing a `uintptr` across statements.
- `unsafe.Pointer` "for performance" without a benchmark proving > 10% improvement on a verified hot path.
- A weak cache where every entry has a strong reference held elsewhere — the weakness does nothing.
