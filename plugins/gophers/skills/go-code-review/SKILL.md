---
name: go-code-review
description: "Invoke this skill to systematically review a Go change against community style standards before merging. Walks the diff topic by topic — formatting, errors, naming, concurrency, interfaces, data structures, security, declarations, functions, style, logging, imports, generics, testing — flagging issues with line references and severity (must-fix / should-fix / nit). Apply proactively before any Go PR ships."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Examples assume Go 1.21+ for log/slog references."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Code Review

A repeatable, opinionated review pass for Go code. Read the diff file by file, walk each topic in order, flag findings with file:line references, then group by severity.

## Core Rules

1. **Mechanical checks first.** Never start a human review until `gofmt`, `go vet`, and `golangci-lint` are clean. They free your attention for what tools cannot catch.
2. **One file at a time, topic by topic.** Walk the diff in order and apply each topic checklist below. Switching topics mid-file loses the thread.
3. **Every finding cites a rule.** `file:line` plus the rule name (`go-naming: initialisms`) — never a bare opinion.
4. **Severity is non-negotiable.** Must-Fix (correctness/security/data-loss/broken contract) blocks merge; Should-Fix (significant design or style issue); Nit (small preference, flag once).
5. **Drop what you cannot defend.** After flagging, re-read and remove any finding you would not stand behind in a thread.
6. **Praise non-trivial improvements.** A review without acknowledgement teaches only avoidance.

## Review Procedure

1. Run mechanical checks: `gofmt -d ./...`, `go vet ./...`, `golangci-lint run ./...`, `go test ./... -race -short`.
2. Read the diff one file at a time. For each file, walk the topic checklists below in order.
3. Flag every issue with `file:line` and the rule name that justifies it.
4. After all files are reviewed, re-read flagged items and drop any you cannot justify.
5. Group findings by **Must Fix / Should Fix / Nit** using the rubric below.

> Use [references/review-template.md](references/review-template.md) when writing up the review for consistent severity grouping and tone.

## Automated Checks

```bash
gofmt -l ./... && go vet ./... && golangci-lint run ./... && go test ./... -race -short
```

Fix anything the tools find before continuing. See [go-linting](../go-linting/SKILL.md) for setup.

## Formatting

- [ ] `gofmt`/`goimports` clean; long lines break by semantics, not column count

## Documentation

- [ ] Exported symbols documented (starts with name, ends with `.`); package comment adjacent to `package` clause; non-trivial unexported have intent comments; named returns only when they clarify

See [go-documentation](../go-documentation/SKILL.md).

## Error Handling

- [ ] No discarded errors (`_ = f()`) without a written justification
- [ ] Error strings are lowercase with no trailing punctuation
- [ ] Errors wrap with `%w` when the caller may want to inspect; `%v` only when hiding is deliberate
- [ ] No in-band magic values (`-1`, `""`, `nil`) for failure — multi-return with an `error` or `ok bool`
- [ ] Error path comes first; the success path stays unindented
- [ ] Each error is handled exactly once (log **or** return, not both)

See [go-error-handling](../go-error-handling/SKILL.md).

## Naming

- [ ] `MixedCaps` / `mixedCaps` only — no underscores or `SCREAMING_SNAKE`
- [ ] Initialisms are uniformly cased: `URL`, `ID`, `HTTP`, `XMLHTTPRequest`, `serveHTTP`
- [ ] Short names for short scopes (`i`, `r`, `ctx`); longer names for wider scopes
- [ ] Receiver names are one or two letters, consistent across methods; no `this`/`self`/`me`
- [ ] Packages don't stutter (`http.Server`, not `http.HTTPServer`)
- [ ] Package names avoid `util`, `helpers`, `common`, `misc`
- [ ] No identifiers shadow builtins (`len`, `error`, `cap`, `new`, `make`, `copy`, `any`)

See [go-naming](../go-naming/SKILL.md) and [go-packages](../go-packages/SKILL.md).

## Declarations

- [ ] Related `var`/`const`/`type` are in grouped blocks; unrelated kept separate
- [ ] `var` for intentional zero values; `:=` for computed locals
- [ ] Variables scoped as narrowly as is readable (if-init where it fits)
- [ ] Struct literals use field names; zero-value fields are omitted
- [ ] Enums start at `iota + 1` (or zero is explicitly meaningful)
- [ ] `any` instead of `interface{}` in new code

See [go-declarations](../go-declarations/SKILL.md).

## Control Flow

- [ ] No `else` after a returning/breaking/continuing `if`; no `:=` shadowing of outer `ctx`/`err`; map iteration is order-agnostic; labeled `break`/`continue` for switch-in-loop

See [go-control-flow](../go-control-flow/SKILL.md).

## Functions

- [ ] File order: type → constructor → exported → unexported → utilities; wrapped signatures one-per-line; no pointer-to-interface; bool/int params renamed via type or commented; printf-style helpers end in `f`

See [go-functions](../go-functions/SKILL.md).

## Interfaces

- [ ] Defined in the consumer package; not "just for mocking" on the implementor; consistent receivers per type; compile-time `var _ I = (*T)(nil)` on exported implementations

See [go-interfaces](../go-interfaces/SKILL.md).

## Concurrency

- [ ] Goroutine lifetimes clear (bounded by `ctx.Done()` or documented); APIs synchronous by default; `context.Context` first param, never struct field; lock order documented; sender closes channels

Example to flag (`pkg/worker/worker.go:42`):

```go
go s.process(req)   // ✗ no ctx, no done signal — leak on shutdown
```

vs. acceptable:

```go
s.wg.Add(1)
go func() { defer s.wg.Done(); s.process(ctx, req) }()
```

See [go-concurrency](../go-concurrency/SKILL.md).

## Data Structures

- [ ] `var t []T` for nil slices, `[]T{}` only when empty non-nil is required (JSON output); copies of structs containing `sync.Mutex` flagged; slice/map at API boundaries copied or borrowing documented

See [go-data-structures](../go-data-structures/SKILL.md).

## Security & Logging

- [ ] `crypto/rand` for secret material (never `math/rand`); no library `panic` for ordinary failures
- [ ] `log/slog` (not `log`/`fmt.Println`); static message + structured attrs; secrets and PII never logged

See [go-defensive](../go-defensive/SKILL.md) and [go-logging](../go-logging/SKILL.md).

## Imports

- [ ] Grouped: stdlib → external → local; no rename unless collision; no blank import outside `main`/tests; no dot imports

See [go-packages](../go-packages/SKILL.md).

## Generics

- [ ] Justified by ≥2 real call sites; constraint is the loosest that compiles; no generics-just-for-an-interface

See [go-generics](../go-generics/SKILL.md).

## Testing

- [ ] Tests cover the new behavior at the right level; failure messages include what/inputs/got/want
- [ ] `httptest.NewServer` over hand-rolled mocks; `TestMain` only when truly necessary; `Example*` for non-trivial APIs

> Read [references/integrative-example.md](references/integrative-example.md) to see the rules applied together on a small HTTP server.
>
> Read [references/severity-rubric.md](references/severity-rubric.md) when deciding whether to label a finding must-fix, should-fix, or nit.

## Quick Severity Rubric

| Severity | Examples |
|---|---|
| Must Fix | Race, security bug, swallowed error, broken API, data loss |
| Should Fix | Wrong layer for an interface, panic in a library, leaky goroutine |
| Nit | Name preference, comment phrasing, ordering within a block |

## Anti-Patterns

These are reviewer anti-patterns — bad habits to avoid when *writing* the review itself:

| Anti-pattern | Do this instead |
|---|---|
| "I would have written this differently" | drop it, or cite a concrete rule |
| Listing every `nit` you noticed | flag once, note "× N similar" |
| No severity labels; comment without `file:line` | label Must / Should / Nit; anchor with `path:line` |
| Reviewing the author, not the code | write about the change, not the person |
| Re-doing the work in the review | point to the rule and let them write it |
| Approving without reading tests | tests are part of the diff |

## Verification Checklist

- [ ] Every finding has `file:line` + a rule citation; no bare opinions
- [ ] No duplicates (note "× N similar" if widespread); severity matches the rubric
- [ ] Tests were read, not just counted
- [ ] Praise included for non-trivial improvements; tone is about the change, never the author

## References

- [review-template.md](references/review-template.md) — markdown shape for posting a review
- [severity-rubric.md](references/severity-rubric.md) — extended must/should/nit guidance
- [integrative-example.md](references/integrative-example.md) — sample HTTP server walked through
