# Agent Harness Replay & Failure Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Crash immediately before and after tool side effects, checkpoint commits, child joins, and terminal publication; resume each history.
- Duplicate the same run/step/tool request and prove stable deduplication or safe repeatability.
- Lose a worker lease during a long tool call and verify fencing blocks stale completion.
- Saturate fan-out/downstream capacity and verify bounded admission, fair progress, cancellation, and recovery.
- Replay a stored run and compare decisions, events, state versions, and externally committed effects.
