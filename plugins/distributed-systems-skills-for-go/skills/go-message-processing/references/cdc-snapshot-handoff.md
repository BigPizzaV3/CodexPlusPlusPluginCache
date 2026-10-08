# CDC snapshot-to-stream handoff

A change-data-capture bootstrap joins two histories: a finite snapshot and an unbounded commit stream. Correctness requires a source-defined boundary between them. Starting a table scan and then asking for the latest log position can permanently lose writes committed during the scan; starting the stream early without collision rules can let an older snapshot row overwrite a newer update or resurrect a delete.

## Define the handoff contract

Record:

1. source cluster or timeline generation, database, publication/filter, and schema contract;
2. a source-consistent snapshot and the log position whose later changes are all retained for this consumer;
3. stable table keys plus source transaction, ordering, and position metadata;
4. how inserts, updates, deletes, truncates, key changes, and schema changes are represented;
5. the sink's comparison or buffering rule when snapshot and stream records for one key collide;
6. the durable sink effect and the offset/acknowledgment transaction boundary;
7. restart checkpoints, log-retention capacity, failover behavior, and resnapshot policy.

The primitive is source-specific. PostgreSQL can export a snapshot when creating a logical replication slot; that snapshot shows the database state after which the slot's stream includes changes. Debezium's initial PostgreSQL workflow reads a log position within its snapshot transaction and streams from that position after snapshot completion. Do not emulate either contract with an unrelated Read Committed scan plus a wall-clock timestamp.

## Prevent gaps and stale overwrite

For a stop-then-stream initial load, use one consistent snapshot aligned with the retained start position, finish and durably record the snapshot, then replay from that position. Duplicates at the boundary are acceptable only when the sink is idempotent and rejects conflicting reuse of an identity.

For snapshot and streaming in parallel, introduce a per-chunk or per-key window/high-water protocol. Buffer, compare, or suppress snapshot records whose keys received a later streamed update or delete. Snapshot completion alone is not serving cutover: require durable snapshot completion and stream progress through the declared handoff fence before claiming a replica state as current to that fence.

Do not use arrival time as source order. Carry the source position and transaction identity needed by the deployed connector. Preserve delete ordering with tombstones or equivalent version state; deleting both the value and its ordering evidence permits an older snapshot or replay to resurrect it.

## Couple apply progress to durability

Advance or acknowledge the source offset only after the corresponding sink state is durable. If sink state and progress cannot share one transaction, make replay safe and define the crash windows explicitly. A PostgreSQL slot knows nothing about receiver durability and may resend recent changes after a crash, so downstream idempotency remains required.

Monitor retained log bytes and oldest required position. A stalled slot or connector can retain enough WAL or other log data to exhaust the source. Never drop or advance retention merely to recover capacity unless the lost interval is proven irrelevant or a new snapshot replaces it under a fenced generation.

## Restart and failover

- Before snapshot completion is durably recorded, restart from a connector-supported checkpoint or restart the snapshot; do not silently continue from a newer log head.
- Bind checkpoints to the source generation and filter/schema contract. A position from an old primary, slot, or publication is not automatically meaningful after failover or reconfiguration.
- Fence the old source before consuming a promoted source. If retained history or slot state cannot prove continuity, stop and resnapshot rather than splice two uncertain histories.
- Mark the replica ready only after its base generation and applied-stream frontier satisfy the reader's promised freshness contract.

Primary evidence: [PostgreSQL logical decoding concepts](https://www.postgresql.org/docs/current/logicaldecoding-explanation.html) and the [Debezium PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html). Debezium collision and watermark behavior is product-specific evidence, not a guarantee of arbitrary CDC libraries.
