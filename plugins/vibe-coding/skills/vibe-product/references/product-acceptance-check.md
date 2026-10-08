# Product Acceptance Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one selected product requirement, acceptance criterion, or release slice through bounded, reproducible evidence without reopening broad product discovery or unrelated implementation work.

## Required input

Provide the requirement/acceptance ID or description, expected behavior, actor/state matrix, implementation summary or patch boundary, safe environment, and available repository-native commands or manual scenarios.

## Scenarios

- Exercise the happy path and the most important negative path for the selected actor.
- Verify loading, empty, error, retry, no-access, over-quota/no-plan, and success states only when reachable for this requirement.
- Confirm UI/API/data/copy/analytics/test behavior matches the same acceptance wording.
- Check that docs/maps are not contradicting the implemented behavior when they are part of the workflow.
