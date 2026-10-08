# Test Harness Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Test Harness improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Add or repair the nearest stable test at the contract boundary; avoid duplicating the implementation in test code.
- Use controllable clocks, deterministic IDs, bounded retries, and explicit synchronization for async/concurrent paths.
- Make skipped or environment-dependent checks visible and fail closed where the repository contract requires them.
- Keep fixtures minimal, representative, privacy-safe, and versioned with the contract they encode.

## Validation

- Demonstrate the test fails on the original defect when safely possible, then passes after the fix.
- Run the narrow test plus the directly affected suite/type/build checks.
- Report flaky, skipped, service-dependent, browser, or production-only gates separately.
