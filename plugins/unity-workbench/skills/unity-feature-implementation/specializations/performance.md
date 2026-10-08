# Performance Specialization

## Use when

Use when the explicit task is profiling, optimization, allocation reduction,
rendering optimization, network optimization, or performance regression work.

## Inspect first

- target hardware
- frame budget
- baseline profiler data
- CPU, GPU, memory, rendering, or network bottleneck
- representative scene
- current quality settings
- build type

## Implementation rules

- Measure before changing.
- Change one factor at a time.
- Preserve behavior.
- Avoid speculative micro-optimization.
- Document tradeoffs.
- Prefer fixes at the actual bottleneck.
- Re-measure after changes.
- Keep diagnostics removable.

## Validation

- before and after metrics
- representative hardware
- representative scene
- frame timing
- allocations
- memory
- draw calls or overdraw
- network traffic when relevant
