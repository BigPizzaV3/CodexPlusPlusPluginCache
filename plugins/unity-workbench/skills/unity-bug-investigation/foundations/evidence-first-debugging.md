# Evidence-First Debugging

## Purpose

Use evidence to decide what to inspect and change.

## Evidence hierarchy

Prefer, roughly in this order:

1. Reproducible failing test
2. Direct runtime observation
3. Stack trace with source context
4. Serialized object or configuration state
5. Profiler or network capture
6. Git diff or regression range
7. Consistent logs with object identity and timing
8. Static code reasoning
9. User recollection
10. Intuition

Lower-ranked evidence can still be useful, but should not be presented as
confirmation.

## Symptom versus cause

Examples:

- `NullReferenceException` is a symptom.
- A prefab variant losing a required reference may be the cause.

- Player rubber-banding is a symptom.
- Writing movement from a non-authoritative client may be the cause.

- Pink materials are a symptom.
- An incompatible shader pipeline may be the cause.

## Useful questions

- Where does expected behavior first diverge?
- Which value first becomes invalid?
- Who owns this state?
- What changed recently?
- Is failure deterministic?
- Is it tied to scene, platform, timing, data, or authority?
- What observation would disprove the leading hypothesis?

## Avoid confirmation bias

Actively seek evidence that could disprove the favored explanation.

Do not stop at the first plausible cause.

## Evidence log

Record:

- source
- timestamp or run
- observation
- relevance
- associated hypothesis

Keep the log concise and decision-oriented.
