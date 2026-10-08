# Compatibility Golden Master Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Replay a versioned corpus against reference and candidate; compare semantic output, state, errors, ordering, and side effects.
- Mutate boundaries and malformed/unknown fields safely; verify parser limits and reference-compatible rejection/recovery.
- Run duplicate, concurrent, timeout, and restart cases to expose hidden identity, retry, persistence, and ordering contracts.
- Test multiple reference versions/configurations and classify stable contract versus version-specific behavior.
- Review every normalized golden field and prove why it is nondeterministic rather than masking a regression.
