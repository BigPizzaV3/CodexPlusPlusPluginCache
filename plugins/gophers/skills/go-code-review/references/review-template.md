# Review Template

Use this shape when writing up a review. Consistent structure makes findings easy to scan and addresses each severity in priority order.

## Header

```markdown
# Review: <PR title> (<branch>)

Reviewer: <name> · Commit: <sha> · Files: <N>

## Summary

<2–4 sentences: what the change does, the overall verdict, and the most important next step.>
```

## Findings

```markdown
## Must Fix

- `internal/store/db.go:42` — Wrapped error drops identity. `errors.Is(err, sql.ErrNoRows)` will never match. Use `%w` instead of `%v`. (go-error-handling)
- `cmd/server/main.go:88` — `mu.Lock()` taken but never `Unlock()`'d on the early `return err` path. Use `defer mu.Unlock()`. (go-defensive)

## Should Fix

- `internal/api/handler.go:15` — Interface `Store` defined alongside its only implementation. Move to the consumer package. (go-interfaces)
- `internal/store/db.go:120` — Returning the internal `s.cache` map allows external mutation. Return a copy. (go-defensive)

## Nits

- `internal/store/db.go:60` — Receiver name `this` → `s` for consistency. (go-naming)
- `internal/store/db.go:18` — Group adjacent `var` declarations. (go-declarations)

## Praise

- The new `Open` constructor now returns an error instead of panicking — exactly the right call.
- Test table-driven coverage in `db_test.go` is excellent.
```

## Tone Guidelines

- **Be specific.** "Use `errors.Is`" beats "Better error handling here."
- **Cite the rule.** Either a skill name (`go-error-handling`) or a doc link (`Effective Go § Errors`).
- **Quote the line if it helps.** A short snippet saves the author from opening the file again.
- **Praise non-trivial improvements.** Reviews that are 100% criticism are exhausting to receive.

## When to Skip Sections

- No Must Fix? Write `## Must Fix\n\n_None._`
- No Praise possible? It's still polite to acknowledge effort: "Thanks for the rapid turnaround on the rebase."

## Posting Etiquette

- Prefer line comments in the platform over a giant bottom-of-PR comment when there are >5 findings.
- Keep the top-level summary short — reviewers reading it on a phone benefit.
- If you ran tools (`golangci-lint`, race), say so. It tells the author what is already covered.
