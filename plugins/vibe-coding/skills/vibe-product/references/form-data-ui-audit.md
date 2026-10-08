# Form & Data UI Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a form, editor, table, search, filter, pagination, or data-entry surface against validation and persistence contracts.

## Domain invariants

- Field names, types, units, nullability, defaults, normalization, and validation agree with the authoritative API/schema.
- Dirty state, autosave, submit, duplicate submit, optimistic state, server errors, and conflict recovery are explicit.
- Sorting, filtering, pagination, selection, and bulk actions retain stable identity and tenant/permission scope.
- Labels, instructions, errors, focus, keyboard use, and screen-reader relationships remain accessible.

## Audit method

1. Trace each changed field or data operation from UI representation to serialized request and persisted result.
2. Check client/server validation drift, timezone/locale/unit conversion, partial edit, refresh, back navigation, and conflicts.
3. Inspect table identity, cursor/page semantics, selection across pages, and stale query behavior.
4. Identify data loss, duplicate submission, misleading success, and inaccessible error recovery.

## Priority model

- **P0:** a reachable flow that causes data loss, unsafe action, access leakage, or blocks a critical user journey.
- **P1:** a material task-completion, state, accessibility, or activation defect.
- **P2:** a lower-risk but concrete comprehension, consistency, or secondary-flow issue.
