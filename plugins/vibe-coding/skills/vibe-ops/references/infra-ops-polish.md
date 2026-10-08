# Infra Ops Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Infra Ops improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Keep configuration ownership singular and fail safely on missing or incompatible critical values.
- Make readiness distinct from process liveness and include graceful drain/cancel for accepted work.
- Bound retries, pools, queues, memory, and downstream concurrency; expose saturation and recovery.
- Update CI/deploy config, examples, tests, runbooks, alerts, and rollback instructions directly affected.

## Validation

- Run repository-native config/build/smoke/lifecycle checks and render generated deployment artifacts.
- Exercise restart, missing config/secret, degraded dependency, drain, and rollback where safe.
- List environment-only IAM/network/provider gates precisely.
