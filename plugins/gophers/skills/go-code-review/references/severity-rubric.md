# Severity Rubric

Calibrating severity is half the value of the review. A "must fix" used liberally trains authors to ignore them; a "nit" used too loudly stalls the merge.

## Must Fix

Block the PR. The change is incorrect, unsafe, or breaks contracts.

Examples:

- **Race / unsynchronized state** detectable by `-race`.
- **Swallowed errors** (`_ = f()`) where failure leaves the system in an inconsistent state.
- **Security:** secrets logged, keys generated from `math/rand`, SQL/HTML injection, missing TLS.
- **API break** without a major-version bump (signature change on an exported function, struct field tag rename).
- **Resource leaks:** missing `Close`/`Unlock`/`cancel` on a return path.
- **Wrong wrap verb** that breaks `errors.Is`/`As` on a sentinel the codebase relies on.
- **Data loss:** transaction not committed, write buffered then discarded.

## Should Fix

Strongly recommend before merge; mergeable if there's time pressure but author follow-up is expected.

Examples:

- **Interface defined on the implementor side.** Functional, but harder to evolve.
- **Mutable global** where dependency injection would work as well.
- **Goroutine lifetime unclear** but apparently bounded in practice.
- **Tests missing a clearly relevant case** (e.g., empty input).
- **Naming inconsistency** within a single feature (one method takes `id`, another `userID`).
- **Logging at wrong level** (Info for noisy retries, Error for expected end-of-stream).

## Nit

A preference. Flag once and move on; do not stall a PR over nits.

Examples:

- **Variable name shading**: `usr` → `user`.
- **Comment phrasing**: "// Fetches user" → "// FetchUser returns the user with id."
- **Ordering inside a block**: helper at the top of the file instead of the bottom.
- **Grouping**: two adjacent `var` decls that could be a single block.
- **Receiver letter choice** when the file is already consistent.

## Edge Cases

### "It's not wrong, but I would have done it differently"

That's a nit, at most a should-fix if the alternative has a measurable benefit (testability, performance). If you can't articulate the benefit, drop it.

### "This whole file should be restructured"

Out of scope for review of a feature PR. File a follow-up issue. Do not add a "this whole file should be rewritten" comment to a 50-line change.

### "This already existed before the PR"

If the PR didn't touch it, generally skip. Exception: the PR makes the existing pattern worse (third use of a smell often justifies cleanup).

## Calibration Tips

- A change with 8 must-fixes is either really bad or your rubric is off. Re-read your finding list and ask: "Would I block merge on this alone?"
- A change with 30 nits is signal noise. Group them: "Several nits in the comment phrasing — happy to discuss as a follow-up if you'd like."
- When in doubt, default down a severity. Authors take Must Fix seriously; reserving the label preserves its meaning.

## Quick Examples

| Finding | Severity |
|---|---|
| `mu.Lock()` without paired `Unlock()` on error return | Must Fix |
| `panic` in library code for ordinary failure | Must Fix |
| `Set` returning the internal map directly | Should Fix |
| Interface defined alongside its only implementor | Should Fix |
| Receiver named `this` instead of one letter | Nit |
| `var x int = 0` | Nit |
