---
name: go-linting
description: "Use when setting up linting for a Go project, configuring golangci-lint, picking a linter set, suppressing findings with //nolint, or wiring lint checks into CI. Apply proactively whenever a project lacks .golangci.yml, when lint output is unclear, or when a new package needs the project's quality bar. Does not cover code review process (see go-code-review)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Targets golangci-lint v2.x and Go 1.21+. Some commands (golangci-lint fmt) require v2."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Linting

The single most important property of a linting setup is **consistency**: every contributor and every CI run uses the same rules. `golangci-lint` is the tool; a checked-in `.golangci.yml` is the contract.

## Core Rules

1. **Every Go project has a `.golangci.yml`** at the repository root. It is the source of truth for which linters run.
2. **Lint runs in CI on every PR.** A green build means lint is green.
3. **Lint runs locally before commit.** A pre-commit hook or `make lint` keeps the feedback loop fast.
4. **Suppress with reasons.** `//nolint:linter // why` — never bare `//nolint`.
5. **Fix the cause first.** A suppression should be the last resort, not the default reaction.
6. **Never silence security linters** (`gosec`, `bodyclose`, `sqlclosecheck`) without a strong, documented reason.

## Setup Procedure

1. Install: `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest` (or `brew install golangci-lint`).
2. Drop a baseline [`.golangci.yml`](assets/.golangci.yml) at the repo root.
3. Run `golangci-lint run ./...`.
4. Fix the findings in order — formatting first, `govet` next, style last.
5. Re-run until clean. Commit `.golangci.yml` and any source fixes together.
6. Add the CI workflow (see [references/ci-integration.md](references/ci-integration.md)).

## Minimum Linter Set

These five catch the most common issues and have the lowest noise rate. Start here:

| Linter | Catches |
|---|---|
| `errcheck` | Unchecked error returns |
| `govet` | Mistakes that compile but are wrong (printf args, shifts, etc.) |
| `staticcheck` | Bug-prone patterns, dead code, simplifications |
| `ineffassign` | Assignments whose value is never read |
| `revive` | Style issues (modern replacement for `golint`) |

Add formatting on top: `gofmt` / `goimports` (or `gofumpt` for stricter rules). With golangci-lint v2 these run via `golangci-lint fmt`.

## Recommended Additional Linters

Enable these once the baseline is clean:

| Linter | When to enable |
|---|---|
| `gosec` | Any service that handles untrusted input |
| `bodyclose` | Any code that calls `http.Client.Do` |
| `sqlclosecheck` | Any code using `database/sql` |
| `nilerr` | Any code that does `if err != nil { return nil }` style returns |
| `misspell` | Always — comments and strings |
| `unconvert` | Always — flags useless type conversions |
| `nolintlint` | Always — enforces the `//nolint` rules below |
| `paralleltest` | If most tests can use `t.Parallel()` |
| `thelper` | If you write test helpers (enforces `t.Helper()`) |
| `testifylint` | If the project uses `testify` |
| `gocyclo` / `gocognit` | When you want a complexity ceiling |
| `exhaustive` | When you use `iota`-based enums and want full `switch` coverage |

> Read [references/linter-catalog.md](references/linter-catalog.md) when picking from the long tail of correctness, style, security, and complexity linters, or when deciding which ones to enable on legacy code.

## Development Workflow

```makefile
lint:
	golangci-lint run ./...

lint-fix:
	golangci-lint run --fix ./...

fmt:
	golangci-lint fmt ./...

ci-lint:
	golangci-lint run --new-from-rev=origin/main ./...
```

| Task | Command |
|---|---|
| Run all enabled linters | `golangci-lint run ./...` |
| Auto-fix everything fixable | `golangci-lint run --fix ./...` |
| Format the tree (v2+) | `golangci-lint fmt ./...` |
| Lint only changed code | `golangci-lint run --new-from-rev=origin/main ./...` |
| Run one linter | `golangci-lint run --enable-only=govet ./...` |
| Show which linters exist | `golangci-lint linters` |

`--new-from-rev` is what makes incremental adoption work: legacy code stays untouched, new and changed code must meet the bar.

> Read [references/ci-integration.md](references/ci-integration.md) when wiring GitHub Actions, pre-commit hooks, or selective linting on PRs.

## Suppressing Findings

```go
// Good: specific linter + a reason
//nolint:errcheck // fire-and-forget; Sync error is not actionable on shutdown
_ = logger.Sync()
```

```go
// Bad: blanket, no reason — nolintlint will flag this
//nolint
_ = logger.Sync()
```

Rules (enforced by `nolintlint`):

- Name the linter: `//nolint:errcheck`, not `//nolint`.
- Include a justification after `//`.
- Place the directive on the same line as the finding, or immediately above the construct it applies to.
- Prefer per-line suppressions over file-level `//nolint:all`.

> Read [references/nolint-directives.md](references/nolint-directives.md) when deciding between inline, block, and file-scope suppressions, or when reviewing existing `//nolint` for stale rationale.

## Interpreting Output

Each finding looks like:

```
path/to/file.go:42:10: message describing the issue (linter-name)
```

The linter name in parentheses is the key — look it up in the catalog to see what it actually checks, then either fix the code or suppress with a reason that names the same linter.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| No `.golangci.yml` in the repo | Each contributor lints differently or not at all | Commit a baseline config; CI enforces it |
| `//nolint` with no linter name | Disables every check on that line, silently | `//nolint:errcheck // reason` |
| `//nolint:all` at the top of a file | Whole file escapes review | Suppress per construct with a reason |
| Lint failures non-blocking in CI | "Green build" becomes meaningless | Block merges on lint failure |
| Enabling 100 linters on day one | Noise drowns signal; team gives up | Start with the minimum set, add gradually |
| Suppressing `gosec` / `bodyclose` without justification | Silently hides real bugs | Fix the cause; if you can't, document why in the suppression |
| Different lint versions in dev vs CI | "Works on my machine" comes back | Pin the version in CI and document it in the README |
| Linting after the fact, only in CI | Slow iteration; PRs ping-pong | Run locally via `make lint` or a pre-commit hook |

## Verification Checklist

Before merging a linting change:

- [ ] `.golangci.yml` exists at the repo root and is checked in
- [ ] `golangci-lint run ./...` is clean (or `--new-from-rev` reports no new issues)
- [ ] CI runs `golangci-lint` and blocks merges on failure
- [ ] `nolintlint` is enabled; no bare `//nolint` remains
- [ ] Every `//nolint` includes a linter name and a one-line reason
- [ ] Security linters (`gosec`, `bodyclose`, `sqlclosecheck`) are enabled where applicable

## References

- [assets/.golangci.yml](assets/.golangci.yml) — production-ready baseline configuration
- [references/linter-catalog.md](references/linter-catalog.md) — what each linter checks and when to enable it
- [references/nolint-directives.md](references/nolint-directives.md) — suppression patterns, scoping rules, anti-patterns
- [references/ci-integration.md](references/ci-integration.md) — GitHub Actions, pre-commit hooks, incremental adoption
