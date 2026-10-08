# Terraform Plan & State Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Initialize against a safe backend or fixture and verify backend/workspace/provider lock identity.
- Generate a saved plan from the exact change; assert expected addresses and reject unapproved destroy/replacement/unknown expansion.
- Exercise a moved/import refactor against representative state and prove stable remote identity.
- Model interrupted/failed apply and verify lock release, partial-state refresh, rerun convergence, and operator recovery steps.
- Run module contract/policy tests for required inputs, outputs, provider aliases, and sensitive handling.
