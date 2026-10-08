# Experiment Design Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a product experiment from estimand and randomization through exposure, outcomes, guardrails, analysis, and rollout decision.

## Domain invariants

- Population, unit of randomization/analysis, intervention, exposure, outcome window, estimand, baseline, minimum practical effect, and decision rule are explicit.
- Assignment is stable and independent at the chosen unit; eligibility, mutual exclusion, bucketing, and cross-device/account identity do not create contamination.
- Exposure is recorded at the authoritative point where treatment can affect behavior and remains distinct from assignment and outcome.
- Sample-ratio mismatch, missing/late events, bot/internal traffic, attrition, novelty/seasonality, and clustered/repeated observations are checked before effect estimation.
- Power/sample duration and uncertainty match the statistical unit and variance; sequential looks, multiple variants/metrics, and stopping are pre-specified or adjusted.
- Primary outcome, guardrails, heterogeneous effects, practical significance, and rollout/reversal criteria are interpreted together without cherry-picking.

## Audit method

1. Trace eligibility → assignment → delivery → exposure → outcome/guardrail events → dataset/model → decision artifact.
2. Verify deterministic assignment, unit identity, allocation, exclusions, mutual groups, and treatment leakage across clients/services.
3. Inspect SRM, pre-period balance, missingness, exposure timing, event semantics, windows, outliers, repeated users, and clustering.
4. Reproduce power/uncertainty and analysis choices, including sequential/multiple-comparison handling and sensitivity checks.
5. Check rollback/rollout policy, operational guardrails, data freshness, and who owns the final decision.

## Priority model

- **P0:** cross-tenant access, incorrect billing/entitlement, corrupted canonical data, or decision-critical analytical error.
- **P1:** a material business-rule, data-quality, experiment, or analytics defect.
- **P2:** a lower-risk but concrete lineage, instrumentation, reproducibility, or maintainability issue.
