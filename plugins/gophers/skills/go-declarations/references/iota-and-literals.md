# iota Patterns and Composite Literals

## Enums with iota + 1

```go
type Severity int

const (
    Info Severity = iota + 1
    Warn
    Error
)
```

Zero value (`Severity(0)`) is reserved for "uninitialized" — invalid input is now distinguishable from a valid `Info`.

## Bitmask Enums

```go
type Perm uint8

const (
    Read Perm = 1 << iota
    Write
    Exec
)

mode := Read | Exec // 5
```

For bitmasks, zero often *is* meaningful (no permissions), so plain `iota` is fine.

## Stringer Methods

Add a `String()` method (or generate it with `stringer`) so log lines are readable:

```go
//go:generate stringer -type=Severity
```

Without it, `fmt.Printf("%v", Info)` prints `1` instead of `Info`.

## Skipping Values

Use `_` to skip an iota slot:

```go
const (
    KB = 1 << (10 * (iota + 1))
    MB
    GB
    _
    PB
)
```

## Composite Literal Formatting

### Field-named multi-line struct

```go
cfg := Config{
    Host:    "localhost",
    Port:    8080,
    Timeout: 30 * time.Second,
}
```

Closing brace aligns with the opening line. The trailing comma is required.

### Slices and maps with elided type

`gofmt -s` removes redundant inner types:

```go
// Before
points := []Point{Point{X: 1}, Point{X: 2}}

// After (gofmt -s)
points := []Point{{X: 1}, {X: 2}}
```

### Nil vs empty

```go
var xs []int       // nil, len 0, cap 0
ys := []int{}      // non-nil, len 0, cap 0
```

JSON encodes nil slices as `null` and empty slices as `[]`. Prefer `var` unless the API contract specifically requires `[]`.

## Raw String Literals

Backtick strings preserve newlines and do no escape processing — perfect for:

- Regular expressions: `` `^\d{3}-\d{4}$` ``
- SQL: `` `SELECT * FROM users WHERE id = ?` ``
- JSON test fixtures
- Multi-line error templates

The one limitation: a raw string cannot contain a backtick.
