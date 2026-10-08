---
name: go-performance-and-diagnostics
description: "Use for measured Go CPU, memory, allocation, contention, latency, and benchmarks. Do not use speculatively."
license: Apache-2.0
compatibility: "Go 1.24 or newer; runtime profiles and tool output are version-sensitive."
---

# Go performance and diagnostics

Optimize a measured constraint, not a code pattern.

## Establish the workload

Record input distribution, offered arrival rate, open- versus closed-loop generation, concurrency, duration, warmup, dependencies, hardware, Go version, `GOMAXPROCS`, achieved throughput, dropped/deadline-expired work, allocations, and error rate. Measure latency from intended arrival when production queueing matters; closed-loop generators can hide stalls through coordinated omission. Reproduce the symptom before changing code.

## Follow the dominant resource

- CPU profile: inspect cumulative and flat cost, then verify inlining and call context.
- Heap/allocation profile: distinguish live memory from allocation churn and retained ownership.
- Mutex/block profiles: find contention and waiting, not merely hot functions.
- Goroutine profile: inspect leaks, fan-out, and blocked resource owners.
- Trace: diagnose scheduler latency, GC interaction, network blocking, and critical paths.
- Database/network evidence: local CPU profiles cannot explain remote queueing alone.

## Change one causal mechanism

Common valid moves include capacity hints for known sizes, avoiding repeated conversions, batching within latency bounds, reducing contention scope, changing algorithms, and removing avoidable reflection or formatting from hot paths. Preserve ownership and correctness; pooling can retain memory or create races.

Compare before and after with repeated benchmarks and confidence-aware tooling. Report effect size, allocations, variance, and costs transferred to memory, tail latency, complexity, or dependencies.

Read [references/diagnostic-tree.md](references/diagnostic-tree.md) for profile selection and benchmark traps. For rising RSS, container OOMs, GC pressure, or `GOMEMLIMIT` changes, read [references/memory-and-gc.md](references/memory-and-gc.md). Before exposing or collecting live diagnostics, read [references/production-profiling.md](references/production-profiling.md) for access, sampling, interference, cohort, and artifact controls.

## Output contract

Lead with the measured bottleneck and evidence. Do not claim improvement from code appearance or one noisy benchmark run.
