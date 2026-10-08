# Evidence and Confidence

## Evidence quality

Prefer:

1. Reproducible failures
2. Test or build output
3. Unity Editor state
4. Profiler or memory capture
5. Serialized project configuration
6. Direct first-party code evidence
7. Package and assembly metadata
8. Consistent static indicators
9. General heuristic

## Confirmed versus smell

A confirmed issue has a demonstrated negative effect or violated invariant.

A smell indicates increased risk but may be intentional or harmless.

Examples:

- Confirmed: a required prefab reference is missing.
- Smell: a MonoBehaviour has many responsibilities.

Do not report smells as confirmed defects.

## Evidence references

Important findings should cite:

- file path
- class or asset
- Console message
- test name
- build log
- profiler marker
- package version
- scene or prefab object

## Confidence

Use:

- Confirmed
- Likely
- Possible

Do not use false precision.

## Unknowns

Record missing evidence that could change the conclusion.

Example:

> Likely high-frequency allocation risk. Profiler validation was unavailable.
