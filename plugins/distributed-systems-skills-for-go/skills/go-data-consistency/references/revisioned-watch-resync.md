# Revisioned watch and resynchronization

## Close the snapshot-to-watch gap

A list followed by a watch "from now" can miss every update committed between the two operations. For a store with a documented historical revision contract such as etcd, obtain a consistent range snapshot at revision `R`, build the candidate projection from that snapshot, and request the watch starting at `R+1`. Starting at `R` can replay the last observed revision; starting at the current head after the list can skip history.

Bind the checkpoint to the exact watched range, filters, schema or decoder version, cluster identity, and logical lineage. A numeric revision from a restored or different cluster is not automatically comparable.

## Apply revisions, not disconnected callbacks

Respect the source's documented ordering and atomicity unit. etcd orders watch events by revision and keeps all events from one operation together. Do not fan events out in a way that publishes a partially applied revision or lets a later dependent revision become visible first.

Advance the applied checkpoint only after every event in the revision is accepted by the local projection. Preserve deletion ordering with a tombstone, source revision, or replacement snapshot; removing both value and ordering evidence can let older work resurrect state.

Progress notifications are bookmarks: under etcd's contract they show delivery through a revision. They do not prove that application callbacks finished, that the projection is durable, or that the watch will remain current after the notification. Readiness must be based on the locally applied revision and an explicit staleness budget, not receipt time alone.

## Recover from cancellation and compaction

Treat watch cancellation, stream error, decode failure, authorization loss, and a compacted start revision as explicit states. Retrying the same compacted revision forever cannot recover. Build a new private snapshot generation from a fresh consistent read, record its revision, and resume from the following revision. If the new watch cannot be established before that history is compacted, repeat with bounded backoff and surface the retention or lag failure.

Keep the last known-good projection only when the consumer's staleness contract permits it. Do not clear or mutate the active map while a replacement snapshot is incomplete. Validate and catch up the candidate generation, then atomically publish it; stop and join the old watch owner so two generations cannot concurrently mutate one projection.

After etcd disaster recovery or another lineage-changing event, resnapshot and establish a new application generation. When external controllers cache etcd revisions, use the documented recovery revision-bump mechanism where applicable and still bind application checkpoints to the restored cluster identity; a bumped number is a notification aid, not proof that old side effects were fenced.

## Bound resources and expose evidence

Bound snapshot memory, buffered events, apply concurrency, reconnect rate, and time spent serving stale state. Observe source header revision, locally applied revision, watch lag, compaction revision, resync count and duration, active generation, decode failures, and readiness transitions. Avoid high-cardinality key labels.

Test the gap between snapshot and watch creation, disconnect after receiving but before applying a revision, multi-key atomic revisions, deletion followed by recreation, compaction during recovery, slow consumers, candidate snapshot failure, watch cancellation, and restored-cluster lineage change.
