# Design System Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit the implementation design system: tokens, components, variants, styles, layout primitives, interaction states, documentation, and test/story coverage. Keep only repo-visible issues that make UI work slower, inconsistent, inaccessible, fragile, or visibly divergent.

## Inspect

Theme config, tokens, CSS/Tailwind/styled-system files, shared components, page-level variants, icons/assets, Storybook or component docs, `DESIGN.md`, screenshots/previews, tests/snapshots, forms/tables/modals, layout primitives, i18n/copy patterns, and generated UI artifacts.

## Issue classes

- Token ownership: duplicated hardcoded values, mixed units, drift between theme/config/docs, missing semantic tokens for repeated UI decisions.
- Component variants: inconsistent sizes/states, forked implementations, duplicated patterns, missing disabled/loading/error/focus/destructive variants.
- Style architecture: ad-hoc CSS, one-off Tailwind/class soup where a component owner exists, conflicting responsive patterns, fragile specificity, and style leakage.
- Accessibility baked into system: shared components missing accessible names, focus handling, keyboard support, status announcements, contrast-friendly variants, or semantic defaults.
- Documentation and regression resistance: stale `DESIGN.md`, missing stories/examples for core variants, fragile snapshots, no visual/test coverage for shared components.
- Implementation drift: public surfaces bypass the system, docs promise unavailable variants, or owner components do not match actual route usage.

## Priority model

Shared component or token defect that can cause destructive user mistakes, inaccessible critical paths, permission/plan confusion, broken core route layout, or widespread UI/API contradiction.

Component-system drift or missing shared state likely to cause repeated regressions, important accessibility gaps, inconsistent variants on main flows, or maintainability issues blocking safe UI work.

Lower-risk but concrete system issue: stale docs, duplicated styling, weak variant naming, minor responsive inconsistency, missing story/example, or local drift that has a clear owner.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the owner token/component and at least one affected usage.
- Include expected system behavior, affected surfaces, acceptance criteria, and validation direction including preview/story/screenshot when available.
- Merge symptoms under one owner when they share source of truth and validation.
- Do not report taste-only preferences without system consistency, accessibility, maintainability, or user-impact evidence.
