# Outbox and inbox protocols

## Outbox row

An outbox row commonly contains:

- stable event ID;
- aggregate/key and event type;
- schema version;
- serialized payload or a reference with clear consistency semantics;
- creation time and relay progress fields.

Insert it in the same transaction as the state transition. Do not reconstruct an event later from mutable current state unless that is the explicit event contract.

## Relay

The relay may poll with row locking or consume a database change stream. In either case:

- multiple relays need claiming/fencing;
- publish acknowledgment can be lost;
- marking sent before publish loses events;
- marking sent after publish permits duplicates;
- consumers therefore remain idempotent.

Bound batch size and lock duration. Observe oldest unpublished age, attempts, publish latency, and terminal failures.

## Inbox

An inbox row or domain-specific idempotency record should be inserted under a unique constraint in the same transaction as the local effect. Store a payload fingerprint or operation type so an identity collision cannot silently alias a different command.

## Cleanup

Cleanup is part of the protocol. Base retention on maximum broker replay, incident recovery, audit, and regulatory requirements. Delete in bounded batches and avoid contending with the hot processing path.

## Alternatives

Use a broker-native transaction when every relevant effect is inside its supported boundary. Use change-data capture when operational ownership and schema coupling are acceptable. Use a workflow/saga when multiple services own durable state and compensation is a real business action. None removes the need to define idempotency at each boundary.
