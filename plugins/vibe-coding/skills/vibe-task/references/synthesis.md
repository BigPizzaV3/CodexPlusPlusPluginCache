# Synthesis

## Operation

Analyze and return an actionable brief in the current conversation. Planning does not create a new assistant task or edit product code. Carry the full requested objective into the plan; separate independent work without silently discarding it.

## Goal

Merge two or more audit outputs into a deduplicated, prioritized batch of task briefs. Preserve the strongest repository evidence as exact `path:line[-line]` anchors and remove duplicates, conflicts, weak findings, and non-actionable recommendations.

## Inputs

Use available outputs from this workflow, especially:

- [Scoped Audit](../../vibe-workflow/references/scoped-audit.md) or the relevant domain audit
- [Security Audit](../../vibe-security/references/security-audit.md)
- [API Audit](../../vibe-backend/references/api-audit.md)
- [Product UI Audit](../../vibe-product/references/product-ui-audit.md)
- [Product Requirements Audit](../../vibe-product/references/product-requirements-audit.md)
- [RBAC ABAC Policy Audit](../../vibe-domain/references/rbac-abac-policy-audit.md)
- [Payments Provider Audit](../../vibe-payments/references/payments-provider-audit.md)
- [Notification Delivery Audit](../../vibe-notifications/references/notification-delivery-audit.md)
- [Cache Invalidation Audit](../../vibe-cache/references/cache-invalidation-audit.md)
- [Search Index Audit](../../vibe-search/references/search-index-audit.md)
- [Feature Flags Rollout Audit](../../vibe-flags/references/feature-flags-rollout-audit.md)
- [Mobile App Audit](../../vibe-mobile/references/mobile-app-audit.md), [Browser Extension Audit](../../vibe-desktop/references/browser-extension-audit.md), or [Desktop App Audit](../../vibe-desktop/references/desktop-app-audit.md)
- [Bot Audit](../../vibe-backend/references/bot-audit.md)
- [Test Coverage Audit](../../vibe-quality/references/test-coverage-audit.md)
- [Performance Audit](../../vibe-reliability/references/performance-audit.md)
- [Evolution & Improvement](evolution-improvement.md)
- [Map Synthesis](map-synthesis.md) when map conflicts or stale map areas were normalized first

Generated maps, docs, and old audit outputs are hints. When an input lacks `path:line[-line]` evidence or looks stale, verify the relevant repository files before keeping the task. Map IDs alone are never enough to keep an implementation task.

## Reconciliation rules

- Merge findings that share the same behavior owner and authoritative fix, even if they came from different audits.
- Keep separate tasks when fixes belong to different owners, rollout units, validation strategies, product requirements, policy decisions, roles, attributes, plans, tenants, or contracts.
- Re-rank by actual impact using repository evidence, not by the source audit’s label.
- Every kept task brief must retain exact `path:line[-line]` anchors plus symbol when possible.
- Preserve dependencies when one task enables another; do not hide a dependent task if both remain useful.
- Drop tasks that are already solved, speculative, cosmetic without impact, duplicated, stale, or based only on generated maps.
- Surface unresolved conflicts only when sources disagree on facts, scope, or fix direction and repository evidence does not resolve it.
- Prefer a complete high-value queue over a tiny set of obvious fixes; stop when remaining findings are weak or duplicative.
