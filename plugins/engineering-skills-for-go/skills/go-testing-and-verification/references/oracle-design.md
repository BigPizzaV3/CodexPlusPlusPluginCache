# Oracle design

## Concurrency

Observe bounded admission, completion after cancellation, and stable goroutine counts. Coordinate schedules with barriers or deterministic facilities; avoid relying on scheduler luck.

## Persistence

Run conflicting transactions against the actual engine and isolation level. Assert constraints and final state, not only returned errors.

## Messaging

Inject redelivery and crashes around effect and acknowledgement. Assert no lost required work and no duplicate business effect.

## Finance

Assert balanced journals per currency, immutable history, exact rounding, legal state transitions, same-key replay, and item-level reconciliation exceptions.
