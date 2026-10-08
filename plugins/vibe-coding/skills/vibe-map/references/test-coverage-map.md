# Test Coverage Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/test_map.md` as a coverage navigation artifact linking critical behaviors, invariants, acceptance criteria, fixtures, test harnesses, commands, and remaining verification gates.

## Inspect

Unit/integration/e2e tests, fixtures, factories, snapshots, golden masters, contract tests, generated clients, CI workflows, package scripts, test docs, runtime check prompts, coverage reports if present, and recent patch evidence supplied by the user.

## Map content

### Evidence and IDs

- Write or update `docs/test_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: test anchor `TEST-*`, suite `SUITE-*`, fixture `FIX-*`, acceptance gap `GAP-*`, external gate `GATE-*`, flaky risk `FLAKE-*`.
- Anchor tests to files/symbols and commands. Do not claim coverage from names alone; identify the behavior actually asserted.

### Coverage

Cover critical flows, domain invariants, permission/plan states, data lifecycle, API contracts, runtime failure/recovery, integrations, UI states, accessibility, performance gates, security checks, CI commands, fixtures, mocks/fakes, flaky or skipped tests, and missing validation.

### Entry details

For each behavior, capture owner invariant, test files/symbols, command, fixture data, asserted states, untested states, related maps/docs, and whether external/manual verification remains required.

## Markdown structure

Use summary, conventions, behavior-to-test matrix, suite index, fixtures/mocks, command index, coverage gaps, skipped/flaky tests, external gates, assumptions.
