# Risk & Release Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/risk_release_map.md` as a map of material release, rollout, rollback, migration, security, privacy, data, provider, and operational risks tied to repository evidence and validation gates.

## Inspect

Release docs, CI/CD workflows, deployment manifests, migrations, feature flags, config/env changes, schemas, API/event contracts, data jobs, observability, runbooks, backup/restore docs, incident notes supplied by the user, and tests/checks.

## Map content

### Evidence and IDs

- Write or update `docs/risk_release_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: risk `RISK-*`, release gate `REL-*`, rollout `ROL-*`, rollback `RB-*`, migration `MIG-*`, operator action `OPS-*`.
- Anchor every risk or gate to current repository evidence. Do not invent production capacity, compliance status, SLA, or operator capability.

### Coverage

Cover migrations, mixed-version compatibility, rollback/forward-fix, feature flags, provider dependencies, secrets/config, capacity/performance, data integrity, privacy/security, observability, runbooks, backup/restore, manual gates, and release blockers.

### Entry details

For each risk, capture affected contract, owner, trigger, impact, likelihood only when evidence supports it, prevention/mitigation, validation gate, rollout/rollback/forward-fix path, and residual unknowns.

## Markdown structure

Use summary, release readiness matrix, risks by domain, rollout/rollback plan index, migration gates, operator checklist, external gates, unknowns, assumptions.
