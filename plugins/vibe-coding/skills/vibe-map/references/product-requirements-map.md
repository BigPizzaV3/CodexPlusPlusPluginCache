# Product Requirements Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/product_requirements_map.md` as a traceable map of product intent, users, jobs-to-be-done, acceptance criteria, measurable outcomes, non-goals, and implemented surfaces.

## Inspect

Product specs, README/design docs, issue text supplied by the user, route/component/API behavior, analytics events, feature flags, tests, copy/localization, onboarding states, pricing/plan docs, release notes, and existing traceability or project maps.

## Map content

### Evidence and IDs

- Write or update `docs/product_requirements_map.md` when allowed. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: requirement `REQ-*`, acceptance criterion `AC-*`, persona/actor `ACT-*`, job/outcome `JOB-*`, metric `MET-*`, product state `STATE-*`, non-goal `NG-*`.
- Anchor each requirement to repository or supplied evidence. Distinguish canonical product decisions from inferred behavior and implementation details.
- Do not invent product strategy, pricing, legal policy, launch date, or metric targets. Mark missing business decisions as unknowns.

### Coverage

Cover target actors, problem statement, expected behavior, user journeys, critical states, access/plan/no-access states, success metrics, analytics events, acceptance criteria, tests, docs, implementation owners, release gates, non-goals, assumptions, and unresolved product decisions.

### Entry details

For each requirement, capture actor, trigger, expected user/system outcome, owner surface, impacted API/data/auth/runtime contracts, acceptance criteria, tests or validation route, metric/event links, release/rollout notes, and explicit exclusions.

## Markdown structure

Use summary first, then actor/job map, requirements table, acceptance criteria, implemented surfaces, metrics/events, release gates, non-goals, unknown decisions, and evidence appendix.
