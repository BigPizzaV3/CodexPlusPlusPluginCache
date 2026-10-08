# Function Signatures

## Wrapping Rules

`gofmt` does not wrap signatures automatically — you choose. The convention:

```go
// One line preferred
func Open(name string) (*File, error)

// Wrapping: every parameter on its own line, trailing comma
func (s *Server) Handle(
    ctx context.Context,
    req *Request,
    opts ...HandleOption,
) (*Response, error) {
    ...
}
```

Half-wrapped signatures (some params on the first line, some on the next) churn under future edits. Pick one or the other.

## Return Values

Multiple returns are fine; mind the order. The conventional shapes:

```go
func F(...) (T, error)        // value + error
func F(...) (T, bool)         // value + ok (comma-ok idiom)
func F(...) error             // only error
func F(...)                   // void
```

When several return values share a type, name them or split into a struct:

```go
// Hard to read
func Stat(path string) (int64, int64, int64, error)

// Better
func Stat(path string) (FileStat, error)

type FileStat struct {
    Size    int64
    ModTime int64
    Inode   int64
}
```

## Named Result Parameters

```go
func Split(path string) (dir, file string)
```

Use named results only when:

- The names document the return values better than the type alone (`(min, max int)` vs `(int, int)`).
- The function is short enough that a naked `return` is still readable.

Don't use them just to enable `return` without arguments in long functions — explicit returns read better there.

## Function-Typed Parameters

```go
func Walk(root string, fn func(path string, info fs.FileInfo, err error) error) error
```

Format the parameter type on a single line when possible. Multi-line types in a parameter list are unreadable; if the callback type is gnarly, name it:

```go
type WalkFn func(path string, info fs.FileInfo, err error) error

func Walk(root string, fn WalkFn) error
```

Bonus: the named type can carry its own godoc.

## Variadic Parameters

```go
func New(name string, opts ...Option) *Thing
```

Variadics must be the last parameter. Pass a slice with `slice...`:

```go
New("x", optsSlice...)
```

Avoid mixing required and optional parameters via variadics; required parameters should remain positional. See [go-functional-options](../../go-functional-options/SKILL.md).

## Naked Bool / Int

```go
// Hard to read at the call site
NewServer(":8080", true, 30, false)

// Better at the call site
NewServer(":8080", true /* tls */, 30 /* maxConn */, false /* readonly */)

// Best — eliminate the bool/int entirely
NewServer(":8080", WithTLS(), WithMaxConn(30))
```

If a single bool *is* the natural API (`SetVerbose(true)`), keep it.

## Return-then-Cleanup

A function that returns a resource should return a cleanup function as well, not rely on the caller's discipline:

```go
func OpenDB() (*DB, func(), error) {
    db, err := open()
    if err != nil {
        return nil, nil, err
    }
    return db, func() { _ = db.Close() }, nil
}

db, closeDB, err := OpenDB()
if err != nil { ... }
defer closeDB()
```

## Receiver Style

Pick value or pointer receivers per type, and stick with it:

- Pointer when methods mutate, the struct is large, or the struct contains a `sync.Mutex` (copying it would be a bug).
- Value when the type is small, immutable, and behaves like a primitive (e.g., `time.Time`).
- Never mix — once any method has a pointer receiver, every method should.

The receiver name is one or two lowercase letters, never `this`/`self`/`me`, and consistent across methods of the same type.
