# AI Safety & Governance Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed AI Safety & Governance improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Place deterministic restrictions and side-effect approvals outside model behavior.
- Use risk-proportionate review, user transparency, correction, and operator escalation without exposing sensitive internals.
- Version and retain release evidence; block rollout when required evaluation or owner approval is absent.
- Add explicit kill switch/rollback and incident observability for the selected capability.

## Validation

- Run safe adversarial/misuse fixtures, policy boundary tests, human-review/override, logging/redaction, and disable/rollback checks.
- Verify evaluation and release evidence names the exact model/prompt/tool/config version.
- List legal, policy, specialist review, live-provider, and production monitoring gates separately.
