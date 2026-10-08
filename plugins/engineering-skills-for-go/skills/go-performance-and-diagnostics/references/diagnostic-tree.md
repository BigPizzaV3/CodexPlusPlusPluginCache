# Diagnostic tree

- High CPU with stable throughput: CPU profile, algorithmic work, serialization, runtime overhead.
- Rising RSS: heap in-use profile, goroutine stacks, caches, buffers, mmap, cgo, and retained references.
- High allocations/GC: allocation profile and object lifetime before pooling.
- Tail latency only under load: queueing, contention, downstream capacity, GC pauses, and retry amplification.
- Low CPU and low throughput: block/mutex profiles, goroutine dump, network/database waits, admission limits.

Microbenchmarks must exclude irrelevant setup, prevent compiler elimination, control parallelism, and compare identical semantics.
