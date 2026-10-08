# Performance Regressions

## Inspect first

- baseline capture
- representative scene
- target hardware
- CPU, GPU, memory, render, or network bottleneck
- recent related changes
- development versus release build

## Rules

- Measure before changing.
- Compare equivalent runs.
- Separate CPU and GPU bottlenecks.
- Track allocations and spikes.
- Avoid speculative optimization.
- Change one factor and re-measure.

## Validation

- before and after metrics
- representative hardware
- stable capture conditions
- regression test or budget when practical
