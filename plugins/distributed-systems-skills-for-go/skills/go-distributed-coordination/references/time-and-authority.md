# Time and distributed authority

Go deliberately combines wall and monotonic readings in values returned by `time.Now`. When both operands retain monotonic readings in one process, comparisons and subtraction use them and resist wall-clock adjustment. Serialization, parsing, `UTC`, `Local`, `In`, `Round`, and wall-time construction remove the monotonic reading. A timestamp read from a database or message therefore compares by wall time.

This yields two separate contracts:

- use monotonic elapsed time for in-process deadline and duration measurement when both values originate in the process;
- use a documented distributed authority for ownership after communication, persistence, restart, pause, or clock skew.

A stored `expires_at` generated and interpreted independently by replicas is not exclusive ownership merely because each comparison is internally consistent. Define which authority decides acquisition and renewal, the permitted clock-error model if wall time is involved, and the compare-and-swap or revision that orders owners. Stop admitting new irreversible work early enough to preserve the safety margin; an unknown renewal is loss of evidence, not an extension.

Even an authoritative lease decision leaves a pause between check and effect. Carry a monotonically ordered ownership epoch or fencing token to the target and make it reject stale effects. If the target cannot fence, use stable target-enforced idempotency or a fenceable outbox and state the weaker duplicate/recovery guarantee.
