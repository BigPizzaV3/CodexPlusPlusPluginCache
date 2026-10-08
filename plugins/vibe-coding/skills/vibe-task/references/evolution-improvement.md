# Evolution & Improvement

## Operation

Analyze and return an actionable brief in the current conversation. Planning does not create a new assistant task or edit product code. Carry the full requested objective into the plan; separate independent work without silently discarding it.

## Goal

Produce an optimal, realistic, repo-grounded improvement path for 1–3 iterations. The plan should increase correctness, product quality, regression resistance, delivery speed, or hot-path performance without inventing work just to fill a template.

## Audit focus

Map the current project from repository evidence:

- key domains/modules, source-of-truth layers, public surfaces, critical user/admin/system flows;
- business invariants, state transitions, tenant/role/plan rules, integration contracts, migrations, jobs, and tests;
- UX friction in core flows: unclear navigation, missing states, unsafe copy, form/table/destructive/action ambiguity;
- regression risks: duplicated logic, weak tests, generated/docs drift, brittle boundaries;
- performance and operability issues only when a reachable path is visible.

## Planning rules

- Every major recommendation and task spec must cite `path:line[-line]` evidence plus symbol when possible.
- Distinguish direct evidence from inference. Do not present inferred traffic, business priority, or product intent as repo fact.
- Do not elevate theoretical risks into plan items without a concrete reachable path, contract exposure, or observable inconsistency.
- Collapse symptoms with the same behavior owner and authoritative fix unless separate rollout units are clearly required.
- Use exactly one solution direction per task; no alternatives.
- Optimize for maximum impact per unit of risk/cost, accounting for dependencies and incremental delivery.
- Omit empty phases. If the audit finds no actionable items, state what was checked and say no actionable evolution items were found by static audit.

## Artifact structure

`evolution_plan.md` should be practical, compact, and scannable. Include sections that fit the repo:

- **Baseline:** architecture map, critical flows, current pain points, constraints.
- **North Star:** UX/domain/engineering outcomes, using measurable or proxy metrics when available.
- **Roadmap:** 1–3 phases with goal, scope, deliverables, dependencies, validation, and rollback/migration notes when relevant.
- **Task Specs:** atomic roadmap tasks with ID, priority, theme, problem, evidence, root cause, impact, fix direction, steps, acceptance criteria, and validation commands when they exist in the repo.
- **Explicit Non-Goals:** what is intentionally excluded to avoid scope creep.

Keep task specs implementation-ready, but these are roadmap specs, not task briefs output. If a future step needs task briefs, use [Synthesis](synthesis.md) or [Task Shaping](task-shaping.md).
