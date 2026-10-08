# Product & Landing Copy Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit selected product or landing copy against actual behavior, audience intent, evidence, and conversion path.

## Domain invariants

- Claims, capabilities, prices, plans, limits, permissions, timing, and outcomes match authoritative behavior.
- Labels and calls to action describe the action and destination without dark patterns, ambiguity, or premature success.
- Copy remains concise, accessible, translatable, consistent with product vocabulary, and appropriate to user state.
- Analytics and experiments do not become hidden sources of copy truth or misrepresent causal impact.

## Audit method

1. Trace each changed claim or CTA to product behavior, plan/config, destination, and success/failure state.
2. Identify conflicting terminology across UI, docs, emails, pricing, metadata, and support surfaces.
3. Check audience, intent, evidence, legal/privacy sensitivity, localization constraints, and accessibility.
4. Separate messaging opportunities from factual contract defects.

## Priority model

- **P0:** content that creates legal, security, billing, consent, or destructive-action risk.
- **P1:** a material comprehension, conversion, localization, notification, or discoverability defect.
- **P2:** a lower-risk but concrete consistency, tone, metadata, or secondary-content issue.
