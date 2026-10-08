# Structs, Tags, and Embedding

## Initialization Forms

| Form | When |
|---|---|
| `var u User` | Zero value is meaningful and ready |
| `u := User{Name: "Ada"}` | Some fields set, others left zero |
| `&User{Name: "Ada"}` | Need a pointer (e.g., to mutate or share) |
| `new(User)` | Avoid — prefer `&User{}` for symmetry |

## Many-Field Literals

When a struct has many fields, group, align with `gofmt`, and stick to field names:

```go
srv := &http.Server{
    Addr:              ":8080",
    Handler:           mux,
    ReadHeaderTimeout: 5 * time.Second,
    WriteTimeout:      10 * time.Second,
    IdleTimeout:       60 * time.Second,
}
```

Resist the temptation to inline; multi-line literals diff cleanly.

## Field Tags as Serialization Contract

Any struct that crosses a serialization boundary (JSON, YAML, protobuf, BSON) needs explicit tags. Without them, the field name is the wire name — rename a Go field, silently break the wire format.

```go
type User struct {
    ID    string `json:"id"    yaml:"id"`
    Name  string `json:"name"  yaml:"name"`
    Email string `json:"email" yaml:"email"`
}
```

Treat tags as part of the public API of the type.

## Common Tag Options

- `json:"name,omitempty"` — omit zero values
- `json:"-"` — never serialize
- `json:",string"` — encode numeric fields as strings (for JS clients)

## Embedding

Embedding promotes the embedded type's methods and fields:

```go
type ReadWriter struct {
    io.Reader
    io.Writer
}
```

Use embedding when you genuinely want the outer type to *be* the inner type. Avoid embedding to get access to private state of a dependency — that is misuse.

### Embedding Pitfalls

- Promoted method sets pollute documentation; readers wonder where a method came from.
- Tagged fields of an embedded type may collide with the outer struct on JSON encode.
- Pointer vs value embedding changes when the outer type's method set includes the inner type's pointer methods.

## Struct Comparison and Hashing

A struct is comparable iff all its fields are. Comparable structs can be map keys; non-comparable ones (containing slices, maps, funcs) cannot.

```go
type Key struct {
    Tenant string
    Bucket string
}
cache := map[Key]Value{}
```
