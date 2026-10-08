# Fencing and sagas

## Stale-owner schedule

1. Owner A acquires lease token 10 and pauses.
2. Lease expires; owner B acquires token 11 and writes.
3. Owner A resumes and writes.

Without the storage layer rejecting token 10, mutual exclusion has failed even if the coordination service behaved correctly.

## Saga evidence

Persist step identity, attempt, input fingerprint, provider evidence, output, and next legal states. A timeout is not a failed step when the remote effect may have succeeded. Reconcile before compensation when outcome is ambiguous.
