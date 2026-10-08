# Security Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Security improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Place the control at the authoritative boundary and keep denial behavior consistent across all reachable paths.
- Use least privilege and explicit capability/tenant scope; avoid hidden allowlists, UI-only guards, and broad service credentials.
- Preserve non-enumerating user responses while retaining actionable internal audit evidence.
- Treat dependencies, build inputs, webhook payloads, files, URLs, and model/tool outputs as untrusted.

## Validation

- Run affected authz/validation/session/secret tests plus safe negative and replay cases.
- Inspect logs, metrics, and user-visible errors for sensitive data and account/tenant enumeration.
- Verify denial before irreversible side effects and verify rollback/recovery for partially started work.
