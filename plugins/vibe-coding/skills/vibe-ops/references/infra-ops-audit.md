# Infra Ops Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit operational readiness across CI/CD, runtime config, deployment, migrations, jobs, health checks, secrets, backups, observability, and recovery. This complements [Deploy Bootstrap](deploy-bootstrap.md): it finds repo-proven ops tasks instead of bootstrapping one opinionated deploy path.

## Inspect

CI workflows, deploy scripts, Docker/Compose/IaC files, package/build scripts, env examples and validation, secret handling, database migrations, rollback notes, queues/workers/cron, health/readiness endpoints, logging/metrics/tracing, alert hooks, backup/restore docs, rate limits, external services, runtime docs, tests, and `infra/README.md` when present.

## Issue classes

- CI/CD: required checks not running, deploy uses branch head instead of immutable commit, unsafe deploy triggers, missing build artifacts, lockfile drift, and unvalidated workflow syntax.
- Runtime config and secrets: required env not validated, insecure defaults, secret values printed/logged, env docs drift, and production debug behavior.
- Deploy and migrations: non-idempotent deploy scripts, unsafe cleanup, migrations without ordering/rollback notes, worker/web version skew, and health checks that mask degraded service.
- Jobs and queues: missing concurrency/idempotency controls, retry amplification, dead-letter gaps, stale cron assumptions, and unobservable background failures.
- Reliability and recovery: no backup/restore path for stateful services, absent runbooks for critical failures, missing readiness/liveness separation, and public errors exposing internals.
- Observability: logs lack correlation/user-safe context, missing metrics for critical paths, no alertable signal for known failure modes, and telemetry that leaks sensitive data.

## Priority model

Deploy path can ship wrong code, secret exposure, destructive migration/cleanup risk, backup/restore gap for critical data, public production outage path with no safe rollback, or cross-tenant/state corruption risk.

Important CI/deploy/runtime gap that can cause failed releases, unobserved worker failures, misleading health checks, missing required env validation, or unreliable migration/job behavior.

Lower-risk but concrete ops hygiene: stale env docs, weak runbook, missing non-critical metric, minor workflow ambiguity, or config coupling that blocks safe operation.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the operational owner and affected runtime/release path, plus symbol when possible.
- Include expected operational behavior, acceptance criteria, validation command or manual verification direction, and rollback/recovery note when relevant.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same operational owner unless rollout, validation, or risk boundaries differ.
- Do not propose new infrastructure platforms, vendors, or broad observability stacks without repo/user evidence.
