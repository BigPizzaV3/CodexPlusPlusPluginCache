# Localization Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Improve a coherent localization surface: missing strings, inconsistent keys, hardcoded user-facing copy, pluralization, interpolation, locale formatting, and translated state coverage.

## Scope selection

- If the user named a locale, surface, namespace, component, or issue, polish that area and directly affected states.
- If the request is broad, inspect high-traffic user-facing surfaces and i18n catalogs, then apply the highest-confidence fixes.
- Include directly related empty/loading/error/no-access/validation/destructive copy when they belong to the same namespace or journey.
- Avoid broad translation rewrites, new locales, vendor integrations, and tone changes unless requested.

## Localization targets

- Hardcoded user-facing strings where the repo uses catalogs.
- Missing, stale, duplicate, or inconsistent translation keys/namespaces.
- Interpolation, pluralization, gender/case-sensitive phrasing where supported.
- Locale-aware dates, numbers, currencies, percentages, sorting, and relative time.
- Validation/error/status copy, accessibility labels, metadata, notifications, and bot/web platform-specific copy.
- Fallback behavior and key naming consistency.
- Explicit locale/default precedence, persistence when storage is unavailable, and locale-preserving links.
- Shared translation ownership for web, offline and generated interfaces when the product ships them.

## Implementation principles

- Reuse existing i18n library, namespace strategy, key style, formatting helpers, and content vocabulary.
- Preserve business meaning and avoid unsupported marketing/product claims.
- Keep untranslated placeholders explicit if a real translation cannot be safely inferred.
- Update directly affected tests, snapshots, docs, and generated catalogs when the repo uses them.

## Validation

Run relevant repository-native checks. When explaining non-obvious repo facts, skipped adjacent work, or detected behavior, cite `path:line[-line]` where useful.

Verify the reported locale and the default path. For a selector or routing change, include a saved preference, an explicit language link and the affected search or generated prompt. Inspect a representative long translation on the supported narrow layout when text expansion can affect the change.
