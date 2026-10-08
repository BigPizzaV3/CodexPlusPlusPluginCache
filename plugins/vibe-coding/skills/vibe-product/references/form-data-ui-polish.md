# Form & Data UI Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Form & Data UI improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Keep one validation source where architecture permits and map server errors to stable field/form states.
- Use stable record identity and explicit query/mutation ownership; do not infer saved state from optimistic UI alone.
- Preserve user input across recoverable failure and prevent stale responses from overwriting newer edits.
- Update affected schemas, generated types, fixtures, analytics, and copy with the field contract.

## Validation

- Run form/table/component/type/e2e checks for changed contracts.
- Exercise invalid input, server rejection, duplicate submit, slow/stale response, conflict, pagination/filter, and keyboard paths.
- Verify serialized payload and stored result, not only rendered success state.
