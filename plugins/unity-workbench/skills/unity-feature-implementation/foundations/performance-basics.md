# Unity Performance Basics

Apply this guidance to runtime code and systems with meaningful update,
allocation, rendering, networking, loading, or UI impact.

## Avoid obvious hot-path costs

Inspect for:

- allocations in `Update`, `FixedUpdate`, or `LateUpdate`
- repeated `GetComponent`
- repeated hierarchy searches
- repeated LINQ
- frequent `Instantiate` and `Destroy`
- repeated material instantiation
- repeated shader property lookup
- synchronous asset loads
- repeated UI layout rebuilds
- per-frame network messages
- unbounded collections
- event listener leaks
- blocking file access

## Caching

Cache references when lifetime and invalidation are understood.

Do not cache stale or dynamically replaced objects without a refresh strategy.

## Polling versus events

Use events when state changes infrequently and ownership is clear.

Do not introduce an event system solely to avoid a cheap local check.

## Object pooling

Use pooling when object churn is measurable or the project already uses it.

Do not add pooling to low-frequency objects without evidence.

## Collections

Choose collection types based on access patterns.

Avoid repeated list reconstruction in hot paths.

## Rendering

Consider:

- material instances
- shader variants
- batching
- overdraw
- transparent effects
- VFX particle counts
- render texture resolution
- camera stacking
- dynamic allocations

## Networking

Prefer compact state or event updates over per-frame RPCs.

Consider send rate, ownership, late joiners, and redundant synchronization.

## Measurement

When the task is explicitly optimization:

1. establish a baseline
2. identify the hot path
3. change one factor
4. measure again
5. report the tradeoff

Do not claim performance improvement without measurement.
