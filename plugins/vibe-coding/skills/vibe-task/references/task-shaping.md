# Task Shaping

## Operation

Analyze and return an actionable brief in the current conversation. Planning does not create a new assistant task or edit product code. Carry the full requested objective into the plan; separate independent work without silently discarding it.

## Goal

Turn the user request into implementation-ready in-chat briefs. Use one coherent brief when sufficient; preserve all explicitly requested outcomes when several are needed.

## Inspect

- User intent and the concrete behavior change or behavior problem.
- Owner layer / source of truth for that behavior, using generated maps only as discovery aids when present.
- Main affected modules, files, symbols, routes, commands, schemas, tests, docs, generated artifacts, or mapped contracts.
- Reachable surface that matters for this task, including direct consumers and user/system states.
- Existing maps or traceability docs only as discovery aids; verify risky or stale claims against current owner evidence.
- Product requirement, actor/journey state, metric/event, policy decision, role/attribute/tenant/plan scope, or runtime flow when those dimensions affect acceptance.

## Shaping rules

- Ground the task in current repository evidence with `path:line[-line]` anchors plus symbol when possible. A map ID alone is not sufficient evidence for a task.
- Distinguish direct repository facts from assumptions or inference.
- Make the task atomic enough for one execute run / one PR, but complete enough to solve the behavior across directly affected surfaces.
- Include problem/change, owner/source of truth, affected surface, expected result, acceptance criteria, validation, and out-of-scope boundaries in the task briefs content.
- Preserve existing contracts and unrelated behavior unless the requested change explicitly requires a contract change.
- For user-facing work, include relevant product requirement, UX/UI/copy expectations, analytics/metric implications, and affected states.
- For access-policy work, express the decision as subject/action/resource/scope plus roles, attributes, relationships, plan/entitlement gates, and backend enforcement points.
- For API/integration work, include contract, validation, error, idempotency, versioning, and consumer impact when relevant.
- For new functionality, extend existing seams and patterns before introducing a new boundary.
- If the request bundles independent fixes, separate them into coherent briefs and preserve the full requested objective.
- Ask a concise clarifying question only when proceeding would be unsafe or would require a missing business/contract decision that the repo cannot resolve.
