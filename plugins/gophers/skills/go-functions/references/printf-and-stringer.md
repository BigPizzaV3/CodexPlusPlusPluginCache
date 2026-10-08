# Printf, Stringer, and Format

## Common Verbs

| Verb | Use |
|---|---|
| `%v` | Default value formatting |
| `%+v` | Struct with field names |
| `%#v` | Go syntax representation |
| `%T` | Type of the value |
| `%s` | String / byte slice / `Stringer` |
| `%q` | Double-quoted, escaped string |
| `%d` | Decimal integer |
| `%x` `%X` | Hex (lower / upper) |
| `%w` | Wrap error (only in `fmt.Errorf`) |

When formatting user input or arbitrary keys into an error, use `%q`. It quotes and escapes — your error stays readable even when the input contains tabs, newlines, or quotes.

```go
return fmt.Errorf("unknown key %q", key)
// → unknown key "weird\nname"
```

## Naming Format Functions

Functions accepting a `format string` end in `f`:

```go
func Logf(format string, args ...any)
func Errorf(format string, args ...any) error
```

`go vet` checks the format/argument match — but only when the function name ends in `f`.

Use a `const` for format strings reused outside `Printf` calls; `vet` validates the constant.

## Stringer

```go
type Severity int

const (
    Info Severity = iota + 1
    Warn
    Error
)

func (s Severity) String() string {
    switch s {
    case Info:
        return "INFO"
    case Warn:
        return "WARN"
    case Error:
        return "ERROR"
    default:
        return fmt.Sprintf("Severity(%d)", int(s))
    }
}
```

Notes:

- The default case must never recurse into `%s`/`%v` of `s` — that would call `String()` again.
- Generate with `//go:generate stringer -type=Severity` for enums where order is stable.

## Infinite Recursion in String()

```go
type Bad struct{ N int }
func (b Bad) String() string { return fmt.Sprintf("%v", b) } // infinite recursion
```

`%v` on `b` calls `String()`. The fix:

```go
func (b Bad) String() string { return fmt.Sprintf("Bad(%d)", b.N) }
```

Or to print the underlying type without recursion:

```go
func (b Bad) String() string {
    type alias Bad
    return fmt.Sprintf("%+v", alias(b))
}
```

## fmt.GoStringer

`%#v` invokes `GoString()`. Implement it when the default Go syntax representation isn't useful (sensitive data, custom debug shapes).

## fmt.Formatter

For full control, implement:

```go
func (b Big) Format(f fmt.State, verb rune) { ... }
```

This is rare. Reach for it when you need to:

- Distinguish between `%v`, `%s`, `%q`, and `%d` for the same type.
- Honor width / precision flags (`%10.2v`).

## Errors and Format

`%w` only works in `fmt.Errorf`, and it must wrap a single error:

```go
return fmt.Errorf("opening %s: %w", path, err)
```

`errors.Is` and `errors.As` then walk the wrapped chain. Use `%v` instead of `%w` when you specifically want to *hide* the underlying error type from callers.

## Don't Concatenate Strings into Errors

```go
// Bad
return errors.New("opening " + path + ": " + err.Error())

// Good
return fmt.Errorf("opening %s: %w", path, err)
```

The wrap preserves identity; the concatenation throws it away.
