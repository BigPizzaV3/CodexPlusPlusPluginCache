---
name: engineering-suite
description: Use whenever the EngineeringSuite plugin is selected, the user writes EngineeringSuite, @EngineeringSuite, or a command like EngineeringSuite /research. Routes explicit slash commands to the exact installed upstream skill before any response or action, and otherwise selects the smallest relevant set of installed skills.
license: MIT
---

# EngineeringSuite Router

EngineeringSuite contains the complete vendored skill sets from AI Hero / Matt Pocock, Ponytail, Addy Osmani Agent Skills, and Taste Skill. This router does not replace those skills. It selects and invokes them.

## Mandatory routing rule

Before answering or taking any action, inspect the user's message for an Engineering Suite command.

Accepted forms include `EngineeringSuite /research ...`, `@EngineeringSuite /research ...`, and a slash command supplied while this plugin is explicitly selected.

When an explicit command is present:

1. Resolve the command before doing anything else.
2. Invoke the exact installed skill named by the route.
3. Read and follow that target skill as written. Do not summarize it into a substitute workflow.
4. The explicit route overrides automatic routing. Do not silently replace it with a different methodology.
5. If several commands are supplied, invoke them left-to-right unless their own instructions establish a different process order.

## Exact-name routing

Every installed upstream skill is addressable directly by its `name:` value:

`EngineeringSuite /<skill-name> <request>` → invoke the exact installed skill `<skill-name>`.

Examples:

- `EngineeringSuite /research Compare two current libraries` → `research`
- `EngineeringSuite /tdd Implement this behavior` → `tdd`
- `EngineeringSuite /code-review Review this diff` → `code-review`
- `EngineeringSuite /design-taste-frontend Redesign this page` → `design-taste-frontend`
- `EngineeringSuite /ponytail-audit Audit this codebase` → `ponytail-audit`
- `EngineeringSuite /security-and-hardening Threat-model this endpoint` → `security-and-hardening`

## Convenience aliases

These shorter routes are aliases only; the target remains the original installed skill:

- `/research` → `research`
- `/review` → `code-review`
- `/debug` → `diagnosing-bugs`
- `/tdd` → `tdd`
- `/spec` → `to-spec`
- `/tickets` → `to-tickets`
- `/implement` → `implement`
- `/prototype` → `prototype`
- `/wayfinder` → `wayfinder`
- `/grill` → `grill-with-docs`
- `/handoff` → `handoff`
- `/architecture` → `improve-codebase-architecture`
- `/taste` → `design-taste-frontend`
- `/redesign` → `redesign-existing-projects`
- `/minimal` → `minimalist-ui`
- `/brutalist` → `industrial-brutalist-ui`
- `/ponytail` → `ponytail`
- `/audit` → `ponytail-audit`
- `/debt` → `ponytail-debt`
- `/gain` → `ponytail-gain`
- `/quality` → `code-review-and-quality`
- `/simplify` → `code-simplification`
- `/security` → `security-and-hardening`
- `/performance` → `performance-optimization`
- `/ship` → `shipping-and-launch`
- `/plan` → `planning-and-task-breakdown`
- `/ui-engineering` → `frontend-ui-engineering`

## Source-qualified routing

Source prefixes are optional and are useful for clarity:

- `EngineeringSuite /aihero:research` → `research`
- `EngineeringSuite /aihero:tdd` → `tdd`
- `EngineeringSuite /ponytail:audit` → `ponytail-audit`
- `EngineeringSuite /addy:test-driven-development` → `test-driven-development`
- `EngineeringSuite /taste:frontend` → `design-taste-frontend`
- `EngineeringSuite /taste:redesign` → `redesign-existing-projects`

If a source-qualified command does not map to a skill from that source, report the mismatch and suggest exact valid names. Do not guess.

## Automatic routing when there is no slash command

Choose the smallest useful set. Prefer a process skill first, then a domain skill only when needed.

- Open-ended engineering question or current technical investigation: `research`.
- Unclear feature or requirements: `grill-with-docs`, then `to-spec` if the user wants a durable spec.
- Implementation from an accepted spec: `implement`; use `tdd` when behavior changes.
- Bug investigation: `diagnosing-bugs`, then `tdd` for the fix.
- Code review: `code-review`; add `code-review-and-quality` when production-quality gates are explicitly relevant.
- Architecture exploration: `wayfinder` or `improve-codebase-architecture` depending on whether the goal is discovery or refactoring.
- Simplification / YAGNI / unnecessary complexity: `ponytail`, `ponytail-review`, or `code-simplification` according to the request.
- Frontend creation: `design-taste-frontend`; existing UI redesign: `redesign-existing-projects`; implementation quality concerns: `frontend-ui-engineering`.
- Security, performance, observability, CI/CD, release, API design, migrations: use the matching Addy skill only when the task actually needs it.

Do not invoke all skill families by default. Explicit user commands always win.

## Help

For `EngineeringSuite /help` or `/skills`, read `../../references/command-catalog.md` and present the relevant routes grouped by source.
