# Imports and `main`

## Import Grouping

The minimum grouping is two: stdlib, then everything else.

```go
import (
    "fmt"
    "os"

    "github.com/foo/bar"
    "rsc.io/goversion/version"
)
```

`goimports` automates this. Run it on save in your editor; check it in CI.

### Extended Grouping

Larger projects often add more groups:

```go
import (
    // stdlib
    "context"
    "fmt"

    // external
    "github.com/foo/bar"

    // internal modules
    "example.com/myapp/internal/store"

    // protobufs
    pb "example.com/myapp/api/v1"

    // side effects
    _ "github.com/lib/pq"
)
```

`goimports -local example.com/myapp` keeps internal imports grouped separately from third-party.

### Renaming

Only rename on collision, and rename the more-local import:

```go
import (
    "context"

    "example.com/legacy/context" // bad
    legacyctx "example.com/legacy/context" // good
)
```

Proto packages conventionally get a `pb` suffix: `pb "example.com/api/v1"`.

### Blank and Dot Imports

```go
import _ "net/http/pprof"        // side effect: registers handlers
import _ "github.com/lib/pq"     // side effect: registers driver
```

Restrict blank imports to `main` packages and tests. They are invisible at use sites and surprising to library consumers.

Dot imports (`import . "pkg"`) hide where a name came from. They are forbidden by most lint configs and used essentially nowhere outside specific test cases (e.g., to break import cycles in `internal/testing` setups).

## The `run()` Pattern

```go
func main() {
    if err := run(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}

func run() error {
    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
    defer cancel()

    cfg, err := loadConfig()
    if err != nil {
        return fmt.Errorf("load config: %w", err)
    }

    return server.Run(ctx, cfg)
}
```

Why:

- A single exit point makes deferred cleanup reliable.
- `run` is unit-testable; `main` is not.
- Setting the exit code is one place, not scattered through the program.

## Flags

Conventions:

- Defined in `package main`, not in libraries.
- `snake_case` names (`--output_dir`, `--max_workers`).
- Group definitions, parse once, then never read flags again — pass values into the library code.

```go
var (
    outputDir = flag.String("output_dir", ".", "directory for output files")
    workers   = flag.Int("workers", 4, "number of parallel workers")
)

func main() {
    flag.Parse()
    if err := mylib.Run(*outputDir, *workers); err != nil {
        log.Fatal(err)
    }
}
```

Use `pflag` only when you specifically need POSIX semantics (double-dash long options, single-character short options).

## CLI Subcommands

Standard `flag` does not support subcommands gracefully. Options:

- `flag.NewFlagSet` per subcommand and a hand-written dispatcher — fine for 2–3 commands.
- `cobra` or `urfave/cli` — appropriate for richer CLIs.

For both, the rule stays: subcommands live in `package main`. Library code never reads flags.
