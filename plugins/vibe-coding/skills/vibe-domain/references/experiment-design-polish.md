# Experiment Design Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Experiment Design improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Fix assignment/exposure/metric semantics before changing estimators or declaring a result.
- Version experiment configuration and analysis; make eligibility, allocation, windows, exclusions, and stopping rules deterministic.
- Add SRM and data-quality gates that stop interpretation rather than silently filtering anomalies.
- Use an estimator compatible with the randomization/analysis unit and report effect with uncertainty and practical threshold.
- Synchronize rollout/flag, telemetry, dashboard, analysis, guardrails, and reversal criteria.

## Validation

- Run assignment determinism/allocation/SRM and event-semantic tests on representative identities and windows.
- Reproduce analysis from versioned inputs and compare sensitivity to exclusions, clustering, windows, and missing data.
- Exercise treatment delivery/exposure failure and rollback; list duration/seasonality/business-signoff gates separately.
