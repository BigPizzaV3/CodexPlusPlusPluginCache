# Synchronization decisions

## Mutex

Place a mutex next to the fields whose invariant it protects. Document the invariant when it is not obvious from the data. Prefer a plain `Mutex` until measured read contention justifies `RWMutex`; reader preference and longer critical sections can make `RWMutex` worse.

Copy data out before slow I/O when the invariant permits. If an external call must occur while locked, account for reentrancy, cancellation, and unbounded latency.

## Atomic operations

Atomics are suitable for independent counters, flags, or whole immutable snapshots. They are not a substitute for a lock when multiple fields must change together. Define the state transition and use typed atomics from `sync/atomic`; avoid clever lock-free structures without measured need and a rigorous memory-ordering argument.

## Channels

A channel is most useful when a protocol transfers a value or ownership. Buffer capacity changes scheduling and overload behavior. It must come from an explicit bound such as maximum tolerated queue latency or memory—not “one is idiomatic” and not a staging constant copied to production.

Nil channels permanently block in `select`; this can intentionally disable a case, but make the state transition obvious. A closed channel receives immediately with the element zero value, so use the two-value receive when zero is meaningful.

## Publication

Do not rely on “the goroutine probably started later.” Establish happens-before through channel send/receive, close/receive, lock/unlock, atomic publication, or another contract defined by the Go memory model. Initialization before starting a goroutine is ordered for that goroutine, but later unsynchronized mutation is not.

## Maps and slices

Concurrent map access is unsafe when any access writes unless synchronization or ownership excludes overlap. Slices copy a descriptor and can share a backing array; concurrent appends or element mutation may race even when slice variables are distinct. Copy when ownership must transfer independently.
