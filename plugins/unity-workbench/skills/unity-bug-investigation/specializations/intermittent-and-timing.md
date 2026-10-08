# Intermittent and Timing Bugs

## Inspect first

- frequency
- timing window
- frame rate
- async operations
- race candidates
- scene transitions
- object lifetime
- network latency
- instrumentation timing impact

## Common causes

- initialization order
- async continuation after destruction
- duplicate callback
- race between load and use
- stale cancellation token
- delayed network ownership
- time-source mismatch

## Rules

- Record attempt counts.
- Add timestamps and object identity.
- Avoid fixing with arbitrary delays.
- Stress repeated lifecycle transitions.
- Compare fast and slow machines or frame rates.

## Validation

- repeated automated run
- varied frame rates
- scene reload loops
- delayed network conditions
- instrumentation removed
