# Notification Content Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit product/email/push/chat notifications across trigger semantics, audience, deduplication, preferences, privacy, and destination.

## Domain invariants

- The notification trigger represents a durable semantic event and is not emitted twice by retries or competing owners.
- Audience, tenant scope, preferences/consent, suppression, frequency, and channel fallback are authoritative.
- Content describes current state, redacts sensitive data, localizes correctly, and links to an authorized destination.
- Delivery, bounce/failure, retry, dedupe, unsubscribe, and operator observability are explicit.

## Audit method

1. Trace event production through template selection, audience resolution, provider call, delivery state, and deep link.
2. Check duplicate/reordered events, stale state, preference changes, tenant boundaries, provider retry, and partial failure.
3. Compare templates across channels and locales with the product state they claim.
4. Identify transactional/marketing classification and any required approval boundary from repository evidence.

## Priority model

- **P0:** content that creates legal, security, billing, consent, or destructive-action risk.
- **P1:** a material comprehension, conversion, localization, notification, or discoverability defect.
- **P2:** a lower-risk but concrete consistency, tone, metadata, or secondary-content issue.
