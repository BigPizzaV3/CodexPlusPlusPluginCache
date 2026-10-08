# Standard Library Interface Cheatsheet

Match these canonical signatures exactly. If your method does what one of these names implies, use the standard signature — even if the name happens to be `String`, `Read`, or `Close`. Anything else breaks discovery and tooling.

## I/O

| Interface | Package | Methods |
|---|---|---|
| `io.Reader` | `io` | `Read(p []byte) (n int, err error)` |
| `io.Writer` | `io` | `Write(p []byte) (n int, err error)` |
| `io.Closer` | `io` | `Close() error` |
| `io.ReaderFrom` | `io` | `ReadFrom(r Reader) (n int64, err error)` |
| `io.WriterTo` | `io` | `WriteTo(w Writer) (n int64, err error)` |
| `io.Seeker` | `io` | `Seek(offset int64, whence int) (int64, error)` |
| `io.ReadWriter` | `io` | embeds `Reader`, `Writer` |
| `io.ReadCloser` | `io` | embeds `Reader`, `Closer` |
| `io.ReadWriteCloser` | `io` | embeds `Reader`, `Writer`, `Closer` |

Honour `Read`'s subtle contract: a `Read` that returns `n > 0` and `err == io.EOF` is **valid**. Callers must handle bytes-then-EOF before the next call.

## Strings and printing

| Interface | Package | Method |
|---|---|---|
| `fmt.Stringer` | `fmt` | `String() string` |
| `fmt.GoStringer` | `fmt` | `GoString() string` |
| `fmt.Formatter` | `fmt` | `Format(f State, verb rune)` |
| `encoding.TextMarshaler` | `encoding` | `MarshalText() ([]byte, error)` |
| `encoding.TextUnmarshaler` | `encoding` | `UnmarshalText(text []byte) error` |
| `encoding.BinaryMarshaler` | `encoding` | `MarshalBinary() ([]byte, error)` |
| `encoding.BinaryUnmarshaler` | `encoding` | `UnmarshalBinary(data []byte) error` |

If your type has a `String()` method whose signature is `(...) string`, `fmt` will use it. Do not invent `ToString()`.

## JSON / XML / YAML

| Interface | Package | Method |
|---|---|---|
| `json.Marshaler` | `encoding/json` | `MarshalJSON() ([]byte, error)` |
| `json.Unmarshaler` | `encoding/json` | `UnmarshalJSON(data []byte) error` |
| `xml.Marshaler` | `encoding/xml` | `MarshalXML(e *Encoder, start StartElement) error` |
| `xml.Unmarshaler` | `encoding/xml` | `UnmarshalXML(d *Decoder, start StartElement) error` |

## Errors

| Interface | Package | Method |
|---|---|---|
| `error` | builtin | `Error() string` |
| `Unwrap` (single) | — | `Unwrap() error` |
| `Unwrap` (multi, Go 1.20+) | — | `Unwrap() []error` |

`errors.Is`/`errors.As` walk these in order. If your error type wraps a cause, implement `Unwrap`. See the `go-error-handling` skill.

## HTTP

| Interface | Package | Methods |
|---|---|---|
| `http.Handler` | `net/http` | `ServeHTTP(ResponseWriter, *Request)` |
| `http.HandlerFunc` | `net/http` | function adapter for `Handler` |
| `http.Flusher` | `net/http` | `Flush()` |
| `http.Hijacker` | `net/http` | `Hijack() (net.Conn, *bufio.ReadWriter, error)` |
| `http.CloseNotifier` (deprecated) | `net/http` | use `Request.Context()` instead |

`http.Handler` is the standard plugin point. If you're writing middleware, return an `http.Handler`, not a custom interface.

## sort and slices

| Interface | Package | Methods |
|---|---|---|
| `sort.Interface` | `sort` | `Len() int`, `Less(i, j int) bool`, `Swap(i, j int)` |

Most code should use `slices.Sort` / `slices.SortFunc` (Go 1.21+) and ignore `sort.Interface` entirely.

## Context

| Interface | Package | Methods |
|---|---|---|
| `context.Context` | `context` | `Deadline() (time.Time, bool)`, `Done() <-chan struct{}`, `Err() error`, `Value(key any) any` |

Never implement `context.Context` yourself. Derive contexts with `context.WithCancel`, `WithTimeout`, `WithValue`.

## Sync

`sync.Locker` (`Lock()`, `Unlock()`) is the only interface in `sync`. `sync.Mutex` and `sync.RWMutex` satisfy it. Functions that take a `Locker` are rare and usually a sign you should pass the concrete mutex.

## Reflection / equality

| Interface | Package | Method |
|---|---|---|
| `comparable` (constraint) | builtin | enables `==`/`!=` for generics |
| `cmp.Comparer` | `cmp` (Go 1.21+) | n/a (use `cmp.Compare[T cmp.Ordered]`) |

Use `comparable` in generics rather than declaring an `Equaler` interface.

## A rule of thumb

Before declaring a new interface, search the standard library for a method with the same shape. If it exists, use it. The compatibility you get with `fmt`, `io`, `encoding/json`, and `net/http` is enormous, and it costs nothing.
