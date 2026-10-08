# Memory and GC diagnosis

## Reconcile measurement domains

Process RSS, Go heap profiles, and Go runtime-managed memory answer different questions. Compare RSS with `/memory/classes/total:bytes - /memory/classes/heap/released:bytes`, then account for the remaining process footprint. The runtime total excludes the binary, memory owned by C code, `syscall.Mmap` mappings, and memory the operating system holds on the process's behalf.

Within the Go runtime, separate live heap, cumulative allocation churn, reserved-but-unused spans, releasable pages, released pages, goroutine stacks, profiling data, and runtime metadata. An allocation profile locates allocation pressure; an in-use heap profile approximates sampled live ownership. Neither proves that all RSS belongs to the Go heap.

Compare the same workload, Go version, `GOMAXPROCS`, container limit, traffic phase, and profile sampling configuration. A forced collection changes the system being measured; use it as a controlled diagnostic, not as the baseline workload.

## Treat the memory limit as a runtime budget

`GOMEMLIMIT` and `debug.SetMemoryLimit` set a soft limit for memory managed by the Go runtime, not a process RSS or container hard limit. Derive headroom from observed non-Go memory, binary and mapping footprint, kernel or sidecar overhead, traffic bursts, and the consequence of an OOM kill. Do not copy a universal container percentage between services.

A limit below the workload's live runtime footprint can drive nearly continuous collection. Inspect heap live versus goal, GC CPU and assist time, forced-cycle count, the GC limiter signal, throughput, and tail latency. The GC limiter may trade memory for CPU to keep the program making progress; the absence of an immediate OOM is not proof that the limit is healthy.

## Change the causal owner

- Growing live heap: find retaining owners and lifetime before pooling or tuning GC.
- High allocation churn with stable live heap: remove or amortize hot allocations only after profiles identify them.
- Runtime-reserved memory: inspect free, unused, and released classes before calling it a leak.
- Stable runtime footprint with rising RSS: inspect cgo, mmap, thread stacks, native allocators, and OS accounting.

`debug.FreeOSMemory` requests a collection and aggressive return of free pages. A periodic production loop can add CPU and latency while hiding the real owner; use it only when a measured workload and operational constraint justify that trade.

After a change, verify process RSS, runtime classes, OOM events, GC CPU, application CPU, achieved throughput, deadline failures, and tail latency together.
