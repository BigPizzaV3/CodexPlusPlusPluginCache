# Localization Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a selected localization surface for key ownership, interpolation safety, locale semantics, fallback, and layout impact.

## Domain invariants

- Keys have stable semantic ownership; code does not assemble translatable sentences from fragments.
- Interpolation, escaping, plural/select rules, dates, numbers, currencies, units, and timezones are locale-correct.
- Fallback and missing-key behavior are observable and do not expose internal identifiers.
- An explicit locale, stored preference, browser negotiation and the product's default have a defined precedence. Do not replace an explicitly requested English default with automatic browser-language detection.
- Website, offline/exported artifacts and generated catalogs use the same owned translations or have a checked synchronization boundary. A translated header does not establish translated search, prompts, metadata or accessible names.
- Expansion, RTL, font, truncation, email/channel rendering, and accessibility are preserved.

## Audit method

1. Trace changed strings from source key through catalogs, interpolation values, renderers, and fallback.
2. Check all semantic variants, plural categories, markup, untrusted values, and locale-sensitive formatting.
3. Identify duplicate keys, English-in-code, stale translations, and key reuse across incompatible meanings.
4. Inspect layout and channel constraints for representative long and RTL locales where supported.

## Priority model

- **P0:** content that creates legal, security, billing, consent, or destructive-action risk.
- **P1:** a material comprehension, conversion, localization, notification, or discoverability defect.
- **P2:** a lower-risk but concrete consistency, tone, metadata, or secondary-content issue.
