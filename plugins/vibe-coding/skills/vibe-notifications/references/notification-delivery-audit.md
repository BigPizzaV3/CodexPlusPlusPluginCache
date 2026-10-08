# Notification Delivery Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one notification delivery boundary across email, SMS, push, in-app, webhook, or provider delivery status. Focus on correctness, consent, deduplication, retries, localization, observability, and user-visible state.

## Domain invariants

- Notification eligibility, consent/unsubscribe, locale, template data, and channel selection are owned and tested.
- Delivery side effects are idempotent and not duplicated by retries, job redelivery, or concurrent triggers.
- Provider errors, bounces, suppressions, rate limits, and webhooks update local state intentionally.
- Sensitive data in templates, logs, and provider payloads is minimized and safe.
- Critical notifications have observable delivery/failure paths and manual recovery where required.

## Audit method

Trace the selected notification from trigger through eligibility, template rendering, queue/job, provider adapter, status webhook, user preferences, logs, UI state, and tests.
