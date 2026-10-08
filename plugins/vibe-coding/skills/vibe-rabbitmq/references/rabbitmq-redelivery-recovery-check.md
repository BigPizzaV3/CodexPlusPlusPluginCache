# RabbitMQ Redelivery & Recovery Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Publish routable and unroutable messages with confirms; drop the connection around acknowledgement and verify retry/duplicate contract.
- Crash a consumer before and after the side effect/ack boundary; verify redelivery safety and bounded in-flight work.
- Inject poison messages and prove delivery-limit/TTL/DLX behavior, cycle prevention, observability, and controlled re-drive.
- Restart broker/client connections and verify topology, consumers, channel ownership, and no duplicate subscription.
- Drive representative backlog and broker flow control; measure queue age, unacked work, memory/disk alarms, fairness, and recovery.
