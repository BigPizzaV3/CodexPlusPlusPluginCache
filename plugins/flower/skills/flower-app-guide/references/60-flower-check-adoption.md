# Flower Check Adoption

Use this when adding `flower-check` to a host application or fixing findings in
application code.

## Contents

- [Purpose](#purpose)
- [Common Findings To Fix](#common-findings-to-fix)
- [Adoption Pattern](#adoption-pattern)
- [Parser Integrity](#parser-integrity)
- [Fixing Findings](#fixing-findings)

## Purpose

`flower-check` is a build-time guardrail for Flower application code. It helps
reject known anti-patterns before generated or handwritten workflow code is
merged.

It is not a replacement for tests.

## Common Findings To Fix

- Blocking inside Step ticks, such as `Thread.sleep`.
- Direct LLM/provider calls inside Steps.
- Hidden orchestration outside Flow/Step boundaries.
- Wait-style Steps without timeout or cancellation behavior.
- Durable Steps without recovery policy.
- Guard callbacks that write, publish, dispatch, subscribe, signal, or perform
  other business side effects (`FLOWER-CHECK-017`).
- Finite EventStep waits without a deadline (`FLOWER-CHECK-018`).
- Durable EventStep waits without `onRecover(...)`, or with predicate-based
  event waits (`FLOWER-CHECK-019`).

## Adoption Pattern

For exact Maven and Gradle installation blocks, read
`references/05-build-and-module-selection.md`. For Maven host applications,
add the check plugin to the build and run:

```powershell
mvn verify
```

If the host app has existing findings, create a baseline intentionally and then
work it down. Do not silence new findings casually.

## Parser Integrity

Flower `0.1.3` emits `FLOWER-CHECK-PARSE` when a Java source file falls back to
conservative non-AST analysis. Treat that diagnostic as incomplete coverage,
not as proof that the file has no findings. It is deliberately outside
suppression and baseline acceptance.

Enable strict parsing in CI when incomplete structural analysis must fail the
build:

```yaml
strictParsing: true
```

The equivalent CLI flag is `--strict-parsing`; Maven and Gradle integrations
also expose `strictParsing`. Fix the source syntax or parser compatibility
instead of trying to baseline the diagnostic. A strict parse error prevents
baseline generation.

## Fixing Findings

When fixing a finding:

1. Read the finding's what/why/fix text.
2. Prefer a Flower-native pattern over suppressing the rule.
3. Add or update a deterministic Flow test.
4. Re-run the host build check.

Before accepting the result, confirm that there are no parse diagnostics, then
search the changed workflow source for every
`flower-check` suppression or ignore directive, including directives that were
already present. `flower-check: no findings` only describes unsuppressed
findings; it is not proof that the suppressions are justified.

Use official suppression or acknowledgement annotations only when the pattern is
intentional and documented. A wait is not safe merely because it is described
as "intentional" or "unbounded." Do not suppress a wait finding unless:

1. the checker-recognized native alternative is incompatible or unsuitable for
   the selected persistence, semantics, or operational model and the source
   records the concrete reason;
2. the wait has a cancellation, deadline/timeout, max-bound, or other terminal
   path appropriate to its semantics; durable controls live in persisted
   state, and a durable time-bounded wait persists its deadline before
   waiting; and
3. deterministic tests prove the selected terminal control, duplicate
   delivery, and restart behavior where recovery is supported.

The explanation in item 1 must be written next to the suppression. Merely
stating that domain state contains a cancellation flag or deadline does not
explain why `EventStep`, a timeout, or another Flower-native alternative cannot
be used with the selected persistence mode.

For example, when the current core durable mode rejects
`StepContext.startTimeout(...)`, a persisted domain deadline can be the correct
alternative, but the suppression must say that and the test must prove the
deadline survives restart. A truly indefinite monitor needs a reason that
documents its ownership, liveness, and shutdown model.

A suppression is not justified when durable completion still depends on a
Step-local `Future`, `CompletionStage`, or callback handle. Persist the external
operation lifecycle and prove that recovery observes the same operation without
submitting a second provider/business request for a dispatch-once contract.

For item 3, actually deliver the same logical signal or event more than once.
Assert that no business side effect is repeated and that the final domain and
Flow state remain correct. Repeated worker ticks alone are not
duplicate-delivery evidence.

Apply these three conditions to every suppression independently. Maintain a
suppression-to-test map when multiple waits are present: duplicate delivery,
terminal-control, or recovery coverage for one wait cannot justify another
wait. In particular, recovery from a later Step does not cover a suppressed
earlier Step, and new work must preserve existing suppression-specific tests.

Otherwise fix the design and keep the finding active until the complete
verification passes.
