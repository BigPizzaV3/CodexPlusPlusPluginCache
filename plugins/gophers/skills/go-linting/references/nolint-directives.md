# //nolint Directives

`//nolint` exists for the cases where the linter is wrong or the right fix is out of scope. Every use of it is a small bet that the suppression will outlive the reason. `nolintlint` enforces the format; this reference covers the *judgment* part.

## The format

```go
//nolint:linter1,linter2 // reason that explains why fixing is wrong
expression()
```

Rules:

- Always name the linter. Bare `//nolint` is forbidden by `nolintlint`.
- Always include a reason after `//`. "Intentional" is not a reason.
- One directive per line of code, attached to that line.

## Scopes

| Scope | How to write it | Use when |
|---|---|---|
| Single line | `code // nolint:errcheck // reason` | Default. Narrowest blast radius. |
| Block / construct | `//nolint:errcheck // reason` on its own line, immediately above the construct | The construct spans multiple lines and the finding applies to all of them. |
| Function | `//nolint:gocyclo // legacy parser; refactor tracked in #1234` directly before the `func` keyword | The whole function is exempt; rare. |
| File | `//nolint:all` at the top of the file | Almost never. Use only for generated code that you cannot regenerate cleanly. |

For generated files, prefer `//go:build` exclusion or the `exclusions.paths` config in `.golangci.yml` over file-scope suppressions.

## Good and bad reasons

```go
// Good — concrete, names the trade-off
//nolint:errcheck // Sync on shutdown can return EAGAIN; nothing to do with it.
_ = logger.Sync()

// Good — points to an issue
//nolint:gocyclo // legacy parser; refactor tracked in #1234
func parseLegacy(...) { ... }

// Bad — circular
//nolint:errcheck // ignored intentionally
_ = something()

// Bad — lies
//nolint:gosec // false positive
cmd := exec.Command("sh", "-c", userInput) // it's not a false positive
```

A reason should answer "why is the linter wrong, *here*?" or "why is the right fix not happening today?".

## Patterns by linter

| Linter | Common legitimate reason |
|---|---|
| `errcheck` | Fire-and-forget on shutdown (`logger.Sync`, `Close` on a discarded body). |
| `gosec` `G404` | Use of `math/rand` for non-security-sensitive randomness (jitter, sampling). |
| `gosec` `G115` | Integer conversion that is provably safe from upstream invariants. |
| `gocyclo` | Hand-written state machines and parsers where complexity is essential. |
| `wrapcheck` | Returning an error from a function in the same package without wrapping. |
| `paralleltest` | Tests that mutate process-wide state (`os.Setenv`, `flag.CommandLine`). |
| `lll` | Long URLs in comments. |

## Anti-patterns

| Anti-pattern | Why it's bad |
|---|---|
| `//nolint` with no linter name | Disables every check on that line. `nolintlint` flags it. |
| `//nolint:all // ` at the top of every file | The linter is now decorative. |
| `//nolint:errcheck` on a security-sensitive call | A missing error check is the bug; the linter found it. |
| `//nolint:gosec // false positive` with no explanation | Reviewers cannot verify the claim. |
| Stale suppressions | Code changes underneath the directive; the reason no longer applies. Audit periodically. |

## Auditing existing suppressions

A useful periodic chore: run `nolintlint` with `allow-unused: false`. It flags suppressions that no longer apply (the underlying finding is gone). Delete those.

For "rotting reasons" (the code changed but the directive stayed), grep for `//nolint:` and re-read each one. If the reason no longer makes sense, fix the code or rewrite the directive.

## File-level alternatives

If you find yourself adding the same suppression in many files, push it into `.golangci.yml` once:

```yaml
linters:
  exclusions:
    rules:
      - path: _test\.go
        linters:
          - errcheck
          - gosec
      - path: cmd/legacy/
        linters:
          - gocyclo
          - funlen
```

This is reviewable, auditable, and survives refactors better than scattered `//nolint`.
