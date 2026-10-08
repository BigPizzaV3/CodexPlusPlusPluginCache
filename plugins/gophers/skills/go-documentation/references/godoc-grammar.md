# Godoc Grammar and Formatting

The `go doc` tool, `pkg.go.dev`, and modern IDEs all parse the same comment format. Following the rules makes those views readable; ignoring them makes them ugly.

## Sentence Rules

- Start with the name of the symbol being described.
- Articles (`A`, `An`, `The`) may precede the name.
- Use full sentences, capitalised, ending with a period.
- Use **present tense** active voice ("Encode writes …", not "This function will encode …").

```go
// Encode writes the JSON encoding of req to w.
// It returns an error if req is nil.
func Encode(w io.Writer, req *Request) error
```

For variables and types, the same rule applies but the verb is "is" / "represents":

```go
// MaxIdleConns is the maximum number of idle connections kept open.
const MaxIdleConns = 64

// Request represents a parsed HTTP request.
type Request struct { ... }
```

## Paragraph Separation

A blank `//` line separates paragraphs in godoc. Without it, lines collapse into one paragraph.

```go
// Decode parses JSON from r into v.
//
// v must be a non-nil pointer. Unknown fields are ignored unless
// DisallowUnknownFields is set on the decoder.
func Decode(r io.Reader, v any) error
```

## Headings (Go 1.19+)

A line consisting of a single capitalised phrase, surrounded by blank lines, becomes a heading on `pkg.go.dev`:

```go
// Package store provides a key-value store.
//
// Concurrency
//
// All exported methods are safe for concurrent use.
//
// Errors
//
// Methods return ErrNotFound when a key is missing.
package store
```

The heading text **must not end with a colon** and the line must be otherwise plain text.

## Links

A bracketed identifier becomes a link to that symbol on `pkg.go.dev`:

```go
// See also [Decode] and [json.Decoder].
```

URLs in comments are autolinked. Use them for external references; for internal symbols prefer the bracket form so navigation works in `go doc` too.

## Lists

Unordered lists use a leading `-`:

```go
// Returns the cached value. Cache misses are handled by:
//   - looking up the persistent store,
//   - populating the cache with the result,
//   - returning the new value.
```

Ordered lists use `1.`:

```go
// Steps:
//   1. Parse input.
//   2. Validate constraints.
//   3. Write to disk.
```

## Code Blocks

Indent lines with at least one tab (or three spaces) to render as `pre`-formatted code:

```go
// Example:
//
//	cfg := &Config{Name: "demo"}
//	if err := cfg.Validate(); err != nil {
//	    log.Fatal(err)
//	}
```

Used inside doc comments, this is the only way to include Go snippets — the actual `Example*` test functions are preferred when the snippet should run.

## Deprecation

A paragraph starting with `Deprecated:` triggers deprecation handling in `pkg.go.dev`, `staticcheck`, and most IDEs.

```go
// Foo does the old thing.
//
// Deprecated: use [NewFoo] instead. Foo will be removed in v2.
func Foo() { ... }
```

The paragraph **must** start with `Deprecated:` exactly — the colon and the leading capital are part of the marker.

## BUG and Known Issues

Comments starting with `// BUG(author):` show up on `pkg.go.dev` in a "Bugs" section:

```go
// BUG(rsc): Foo crashes on inputs longer than 2^31 bytes.
```

Use when you know about an issue and want it visible to consumers.

## Field Documentation

For struct fields, put the comment on the line above. End-of-line comments are reserved for short clarifications.

```go
type Options struct {
    // Name is the user-visible label. Required.
    Name string

    // Group identifies the parent group. Optional.
    Group *FooGroup

    LargeGroupThreshold int // optional; default: 10
}
```

Group related fields with a section heading comment:

```go
type Options struct {
    // General setup:
    Name  string
    Group *FooGroup

    // Customisation:
    LargeGroupThreshold int // optional; default: 10
}
```

## Anti-Patterns

- Mixed past/future tenses ("This function will encode and has encoded …").
- Sentences without a starting symbol name ("Encodes the request." — the comment must start with `Encode`).
- Trailing comments on long fields, pushing past 100 columns.
- Headings ending in a colon (will not be recognised as a heading).
- `Deprecated.` without the body — tooling reads the rationale.
