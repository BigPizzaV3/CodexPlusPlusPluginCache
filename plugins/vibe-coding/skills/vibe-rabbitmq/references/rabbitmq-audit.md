# RabbitMQ Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit RabbitMQ topology, publisher guarantees, acknowledgements, prefetch, quorum durability, dead lettering, and recovery as one delivery contract.

## Domain invariants

- Exchange, queue, binding, routing key, durability, exclusivity, auto-delete, arguments, and ownership are declared consistently; redeclaration cannot fail due to inequivalent arguments.
- Publisher confirms and mandatory/unroutable handling distinguish broker acceptance from consumer completion; persistent messages are paired with suitable durable queue semantics.
- Consumers acknowledge only after the selected side-effect boundary and remain safe under redelivery, connection loss, worker crash, and acknowledgement uncertainty.
- Prefetch and consumer concurrency bound in-flight work and memory while respecting ordering/fairness requirements.
- Quorum queue replication, delivery limit, leader placement, availability, and storage/capacity assumptions match the durability requirement.
- Dead-letter/TTL policies avoid cycles, preserve x-death and origin context, bound retries, and expose a controlled re-drive path.
- Connections and channels have explicit ownership; channels are not shared unsafely across concurrent publishers/consumers, and recovery re-establishes required topology/subscriptions.
- Backpressure, blocked connections, flow control, queue depth/age, unacked messages, disk/memory alarms, and consumer health are observable.

## Audit method

1. Map publish → exchange/binding → queue type/policy → delivery → side effect → ack/nack/requeue → DLX/re-drive.
2. Inspect effective broker policy and client declaration together, including quorum arguments, TTL, delivery limit, overflow, and dead-letter routing.
3. Trace unroutable publish, confirm timeout, connection/channel loss, consumer crash at ack boundaries, poison redelivery, and broker alarm behavior.
4. Calculate in-flight capacity from consumers × prefetch × task footprint and compare it with downstream capacity and ordering requirements.
5. Verify automatic recovery does not duplicate consumers or omit declarations and that shutdown cancels consumption and settles in-flight work deliberately.

## Priority model

- **P0:** message loss, duplicate irreversible effect, poison-loop outage, unsafe topology change, or quorum recovery failure.
- **P1:** a material acknowledgement, redelivery, routing, dead-letter, capacity, or recovery defect.
- **P2:** a lower-risk but concrete operability, observability, or efficiency issue.
