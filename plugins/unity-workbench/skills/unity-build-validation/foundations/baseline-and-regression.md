# Baseline and Regression Handling

## Baseline

Before validation, record:

- commit
- working tree
- Unity version
- package versions
- target platform
- Console errors and warnings
- failing tests
- build configuration
- scenes
- existing known issues

## Regression classification

Classify failures as:

- introduced by current change
- pre-existing
- environment-specific
- flaky
- unrelated but newly discovered
- unresolved origin

## Comparison

Use equivalent conditions:

- same scene
- same platform
- same build type
- same test filter
- same device
- same networking topology
- same data
- same performance capture conditions

## Do not normalize failure

A pre-existing failure is still a failure.

It may not block the current change, but it must be reported when relevant.

## Working tree

Inspect uncommitted changes before and after validation.

Identify files created by:

- Unity import
- test results
- builds
- profiler captures
- platform tooling

Do not confuse generated local changes with source changes.
