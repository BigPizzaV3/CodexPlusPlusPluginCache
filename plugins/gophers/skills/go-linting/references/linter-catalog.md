# Linter Catalog

A practical guide to the linters in `golangci-lint`. Pick by category. Do not enable everything at once on a legacy codebase — start with the minimum set, then add categories as they go green.

## Correctness (always on)

| Linter | Checks |
|---|---|
| `errcheck` | Errors returned from function calls that are silently dropped. |
| `govet` | A bundle of vet checks: bad printf, atomic alignment, lost cancel, shadow, etc. |
| `staticcheck` | The largest correctness bundle: misuse of stdlib, dead code, redundant checks, broken `errors.Is`/`As`, etc. |
| `ineffassign` | Assignments whose value is never read. |
| `unused` | Unused functions, types, variables, fields, constants. |

These five (plus formatters) are the realistic "minimum" for any project.

## Error handling

| Linter | When to enable |
|---|---|
| `nilerr` | Catches `if err != nil { return nil }`. Useful everywhere. |
| `wrapcheck` | Forces every external error to be wrapped on return. Strict — pair with `errcheck-config` rules. |
| `errorlint` | Flags `err == io.EOF` and similar identity comparisons that should use `errors.Is`. |
| `err113` | Forbids `errors.New`/`fmt.Errorf` outside `var` blocks. Often too strict; enable only on new packages. |

## Resource leaks and concurrency

| Linter | When to enable |
|---|---|
| `bodyclose` | Any code that calls `http.Client.Do` or similar. Cheap, very high signal. |
| `sqlclosecheck` | Any code using `database/sql`. Catches `rows`/`stmt` leaks. |
| `rowserrcheck` | Use with `database/sql`. Catches missing `rows.Err()`. |
| `noctx` | Net/http and database calls without context. |
| `contextcheck` | Functions that drop or replace the inbound context. |

## Security

| Linter | When to enable |
|---|---|
| `gosec` | Any service. Tunable via `excludes`/`includes`. Common false positives: G104 (duplicates `errcheck`), G115 (integer conversion). |
| `gosmopolitan` | Catches locale-sensitive APIs in places they shouldn't be. |

## Style

| Linter | When to enable |
|---|---|
| `revive` | The modern `golint` replacement. Rule-based. See the assets file for a sensible default rule set. |
| `gocritic` | Diagnostic checks for performance and style. Tune by enabling rule classes. |
| `gofumpt` | Stricter `gofmt`. Run as a formatter, not a linter. |
| `goimports` | Manages imports and groupings. Set `local-prefixes` to your module path. |
| `misspell` | Spelling in comments and strings. |
| `unconvert` | Useless type conversions. |
| `whitespace` | Leading/trailing blank lines. |
| `gci` | Sort imports into groups. Conflicts with `goimports` — pick one. |

## Complexity

| Linter | When to enable |
|---|---|
| `gocyclo` | Cyclomatic complexity ceiling per function. Typical limit: 15. |
| `gocognit` | Cognitive complexity (nesting-aware). Typical limit: 20. |
| `funlen` | Length of functions. Catches helpers that grew. |
| `nestif` | Deeply nested `if`s. |
| `cyclop` | Modern alternative to `gocyclo`. |

Pick **one** complexity linter — they overlap heavily.

## Tests

| Linter | When to enable |
|---|---|
| `thelper` | Test helpers must call `t.Helper()`. |
| `paralleltest` | Tests that can be parallel should call `t.Parallel()`. |
| `testifylint` | Catches common `testify` misuses (e.g., `assert.Equal(t, got, want)` order). |
| `tparallel` | Detects mixing of parallel and sequential subtests in one parent. |
| `testpackage` | Tests in `pkg_test` rather than `pkg`. Opinionated. |

## Suppression hygiene

| Linter | When to enable |
|---|---|
| `nolintlint` | Always. Requires `//nolint` to name a linter and include a reason. |

## Modernization

| Linter | When to enable |
|---|---|
| `predeclared` | Catches shadowing of builtins (`new`, `len`, `error`). |
| `exhaustive` | Enforces full coverage of `iota` enums in `switch`. |
| `revive` rule `unused-receiver` | Methods that ignore their receiver. |
| `tagliatelle` | Struct tag naming conventions. Opinionated. |

## When to enable what

- **New project:** the minimum set + `nolintlint` + formatters from day one.
- **Service handling untrusted input:** add `gosec`, `bodyclose`, `sqlclosecheck`, `noctx`.
- **Database-heavy code:** add `sqlclosecheck`, `rowserrcheck`.
- **Test suite:** add `thelper`, `paralleltest`, `testifylint` (if applicable).
- **Legacy codebase:** start with `--new-from-rev=origin/main` so old code is grandfathered.
