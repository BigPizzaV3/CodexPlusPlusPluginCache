# Product Requirements Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one product requirement, feature slice, journey, or release objective for clarity, traceability, acceptance, measurable outcome, and implementation consistency. Limit the audit to the selected product surface and current repository/supplied evidence.

## Domain invariants

- The requirement has an explicit actor, problem, expected outcome, acceptance criteria, non-goals, and owner.
- Implemented UI/API/data/runtime behavior matches the current product decision or marks missing decisions as blockers.
- No-access, plan, quota, empty, error, loading, retry, destructive, and success states are intentionally specified where reachable.
- Analytics, copy, localization, tests, release gates, and docs remain traceable to the same accepted behavior.
- The audit does not invent strategy, pricing, personas, legal policy, metrics, or launch scope.

## Audit method

1. Locate canonical product evidence: specs, docs, issues supplied by the user, existing maps, route behavior, tests, analytics, and copy.
2. Trace requirement → surfaces → contracts → states → acceptance → validation.
3. Compare user-visible behavior with implementation owners and tests.
4. Identify missing product decisions separately from code defects.
