# Time, Enums, and Tags

## time.Time vs Unix Ints

```go
// Bad
type Job struct {
    StartedAt int64 // seconds? milliseconds? UTC? local?
}

// Good
type Job struct {
    StartedAt time.Time
}
```

`time.Time` carries timezone and monotonic clock readings — comparing two values is meaningful without external context.

## time.Duration vs Numbers

```go
// Bad
const Timeout = 5 // seconds? ms?

// Good
const Timeout = 5 * time.Second
```

Use the units the standard library exports (`time.Millisecond`, `time.Second`, ...). When parsing user input, `time.ParseDuration("5s")` is friendlier than handcrafted parsers.

## Monotonic Time

`time.Now()` includes a monotonic reading. Subtraction between two `time.Time` values from the same process gives accurate elapsed time even across wall-clock adjustments:

```go
start := time.Now()
work()
elapsed := time.Since(start)
```

`time.Now().UTC()` strips the monotonic reading. Avoid it unless you specifically want wall-clock semantics (e.g., serializing).

## Injecting a Clock

```go
type Clock interface {
    Now() time.Time
    NewTimer(d time.Duration) *time.Timer
}
```

Or, simpler — accept a single function:

```go
type Service struct {
    now func() time.Time
}
```

Production wires `time.Now`; tests wire a deterministic stub.

## Enum Zero Values

```go
type State int

const (
    StateUnknown State = iota // explicit "unset"
    StateActive
    StatePaused
)
```

Either start at `iota + 1` (so 0 is invalid) or give the zero value a named "unknown" identity. Don't let the zero value silently mean a valid case — bugs hide there.

### Stringer

```go
//go:generate stringer -type=State
```

Without `String()`, log lines print `1`, `2`, `3` — useless when debugging at 3 a.m.

## Struct Tags

Tags are the wire contract. Renaming a field without updating the tag breaks serialization silently:

```go
type Event struct {
    ID        string    `json:"id"`
    Type      string    `json:"type"`
    CreatedAt time.Time `json:"created_at"`
}
```

Add `omitempty` thoughtfully — zero `time.Time` and zero ints are common bug sources.

## Embedding

Embed when the outer type *is* the inner one (composition over inheritance). Avoid embedding to "borrow" methods you don't actually want exposed — every promoted method enlarges your API surface.
