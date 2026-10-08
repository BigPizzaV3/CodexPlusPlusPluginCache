# Instrumentation

## Purpose

Use temporary diagnostics to answer a specific question.

## Good diagnostics

Include only fields needed to distinguish hypotheses:

- object instance ID
- scene
- frame or network tick
- timestamp
- authority
- current state
- previous state
- input value
- branch decision
- serialized configuration
- lifecycle callback

## Logging

Avoid logs every frame.

Prefer:

- state-change logs
- one-shot assertions
- conditional logs
- structured prefixes
- sampling
- profiler markers

## Timing impact

Instrumentation can change race conditions and frame timing.

For timing-sensitive bugs:

- prefer counters and timestamps
- avoid heavy formatting
- use profiler markers
- compare instrumented and uninstrumented runs

## Cleanup

Before completion:

- remove temporary logs
- remove temporary UI
- remove test shortcuts
- remove forced states
- remove added delays
- keep only diagnostics that provide durable project value

## Sensitive data

Never log:

- tokens
- passwords
- personal information
- full save contents when sensitive
- private server payloads
