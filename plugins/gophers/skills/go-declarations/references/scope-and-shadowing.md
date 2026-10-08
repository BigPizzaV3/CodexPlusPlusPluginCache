# Scope and Shadowing

Go has lexical scoping with block-level granularity. The short declaration `:=` interacts with scope in a way that surprises newcomers and seasoned engineers alike.

## Rule of `:=` Redeclaration

`:=` may redeclare a variable, but only when **all three** hold:

1. The redeclaration is in the **same scope** as the existing variable.
2. The value is **assignable** to that variable's type.
3. At least **one other variable** on the left is new.

```go
f, err := os.Open(name) // declares f and err
d, err := f.Stat()      // declares d, reassigns err — same scope, OK
```

## The Shadowing Trap

When the inner scope already contains the name, `:=` creates a **new** variable. The outer name is unchanged after the block ends:

```go
ctx := context.Background()

if needTimeout {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
    // this inner ctx dies at the closing brace
}

doWork(ctx) // still the original Background context!
```

### Fix

Assign with `=`, declaring any new locals separately:

```go
var cancel context.CancelFunc
if needTimeout {
    ctx, cancel = context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
}
doWork(ctx)
```

## Scope by Construct

| Construct | Variables live until |
|---|---|
| Package | Program exit |
| Function | Function return |
| Block `{ ... }` | Closing `}` |
| `if`/`for`/`switch` init | End of the statement (including all branches) |
| `for` range/clause | End of the loop body |

## Reducing Scope Deliberately

Pull a variable into the narrowest scope where it is meaningful:

```go
// Wider scope than necessary
err := os.WriteFile(name, data, 0644)
if err != nil {
    return err
}
return nil

// Tighter
if err := os.WriteFile(name, data, 0644); err != nil {
    return err
}
return nil
```

Don't fight indentation, though — if narrowing scope creates a deeply nested success path, prefer the wider scope.

## Tools

- `go vet -shadow` (or `shadow` in golangci-lint) catches the common cases.
- Code review: any `:=` introducing a `ctx` or `err` that shares a name with the function's outer one deserves a second look.
