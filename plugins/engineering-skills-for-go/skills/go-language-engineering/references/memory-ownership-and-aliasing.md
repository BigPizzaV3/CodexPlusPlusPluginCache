# Memory ownership and aliasing

Go copies slice and map descriptors, not the storage they reach. A lock around one descriptor does not protect aliased storage that another owner can mutate. Before retaining or returning reference-bearing data, choose an explicit contract:

- **borrow:** valid only during the call; the callee neither retains nor mutates unless stated;
- **transfer:** the recipient becomes the sole mutator and the sender stops using the value;
- **shared:** later mutation is permitted only through a documented synchronization protocol;
- **snapshot:** the recipient receives independently mutable storage.

Go's type system does not encode these choices. Enforce them by construction and document exported contracts whose safe use depends on the caller.

## Copy the reachable mutable graph

A copied slice is still a view of the same array. A copied map has independent map metadata but the same entries, and its values may themselves contain slices, maps, pointers, or other mutable references. Copy every reachable layer whose later mutation would violate the boundary; an outer `maps.Clone` is not a deep copy.

Use `slices.Clone`, `bytes.Clone`, `copy`, or a domain-specific copier when a snapshot is required. Preserve `nil` versus empty only if it is observable in the contract. Reject unconditional copying as a style rule: a synchronous borrow can be clearer and cheaper when retention and mutation are excluded.

## Treat capacity as authority

A subslice can expose more mutation authority than its length suggests. Appending to `base[i:j]` may overwrite elements in the shared backing array when capacity remains. A full slice expression such as `base[i:j:j]` prevents that append from reusing the exposed capacity, but it does not prevent element mutation, concurrent access, or retention of the backing array. Use it to narrow append authority, not as a substitute for an ownership boundary.

A small long-lived subslice can retain a much larger allocation. Clone at the lifetime boundary when the retained capacity is materially disproportionate and memory evidence justifies it; do not add copies speculatively to every slice operation.

## End pooled lifetimes deliberately

Treat returning an object to `sync.Pool` as the end of the borrow. No goroutine, callback, queued write, encoder, or returned value may still reach the object or its buffers. Join asynchronous consumers before `Put`, or clone the required bytes into independently owned storage. Reset sensitive or logically significant state before reuse when the threat model requires it.

`sync.Pool` is a temporary allocation-reuse mechanism: the runtime may remove items at any time. It is not durable storage, a capacity guarantee, or a lifecycle owner. Never put short-lived request objects into a pool while another request can still observe them.

## Review the failure schedule

Trace aliases across constructors, getters, caches, encoders, pools, goroutines, and interface values. For each mutation, identify the sole owner or the happens-before edge. Test the dangerous schedule rather than only equality: mutate the caller's input after the call, mutate every returned nesting level, append through views, reuse the pooled object, and run overlapping readers and writers under the race detector when authorized.
