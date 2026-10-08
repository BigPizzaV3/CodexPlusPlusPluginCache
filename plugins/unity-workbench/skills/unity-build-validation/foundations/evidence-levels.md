# Validation Evidence Levels

## Level 0: Not validated

No meaningful execution evidence.

Static reasoning may exist, but no compilation or runtime result is known.

## Level 1: Static validation

Includes:

- code inspection
- usage search
- assembly and namespace checks
- serialized compatibility review
- configuration inspection

Does not prove compilation or runtime behavior.

## Level 2: Compilation validation

Includes:

- Unity Editor compilation
- CI compilation
- generated solution compilation
- target assembly compilation

Record the exact method.

## Level 3: Automated tests

Includes:

- EditMode tests
- PlayMode tests
- integration tests
- framework-specific tests
- CI suites

Record counts and failures.

## Level 4: Runtime validation

Includes:

- Play Mode scenario
- scene interaction
- lifecycle behavior
- actual feature exercise
- Console inspection

Record the exact scenario.

## Level 5: Target environment validation

Includes:

- player build
- target device
- multiplayer peers
- XR hardware
- dedicated server
- performance profiling
- visual inspection
- save migration

Use the level required by the risk and acceptance criteria.

## Evidence rules

- Higher levels do not replace missing domain-specific checks.
- A player build does not prove every feature works.
- A passing test suite does not prove visual quality.
- A single local instance does not prove multiplayer correctness.
- Static inspection does not prove compilation.
