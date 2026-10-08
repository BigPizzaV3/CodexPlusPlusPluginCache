# ML Pipeline Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit machine-learning pipeline behavior across data contracts, feature generation, training, inference, evaluation, deployment, monitoring, and rollback. Keep only issues with current repository impact; do not turn generic ML advice into tasks.

## Inspect

Datasets/loaders, feature definitions, schemas, training scripts, notebooks only when wired into repo workflows, model artifacts, registry/versioning, inference services, batch jobs, config/env, preprocessing/postprocessing, thresholds, metrics, tests/evals, drift/monitoring hooks, CI/CD, docs, and downstream consumers.

## Issue classes

- Data and features: schema drift, train/serve skew, duplicated feature logic, leakage, missing null/category handling, unstable splits, non-reproducible sampling, and locale/timezone bugs.
- Training and evaluation: undocumented or unrunnable training path, metrics that do not match product risk, stale baselines, missing regression fixtures, threshold changes without validation, and untracked model/config versions.
- Inference behavior: pre/post-processing mismatch, invalid output ranges, no confidence/uncertainty state where product depends on it, batch/online inconsistency, and unsafe fallback behavior.
- Deployment and rollback: model artifact not pinned, incompatible model/code versions, migration gaps, missing warmup/health check, and no safe rollback path for changed predictions.
- Monitoring and operations: absent prediction/error metrics, drift signals, data-quality checks, alert/runbook gaps, and cost/latency hot paths.
- Privacy/compliance: training or logs include sensitive data without repo-visible guardrails, retention/deletion mismatch, or cross-tenant data mixing.

## Priority model

Data/tenant leakage, model output corrupting payments/legal/security/destructive decisions, train/serve bug causing critical wrong predictions, unpinned model artifact in production-critical path, or privacy exposure.

Important model quality/regression risk, missing critical eval, feature/schema drift, unsafe fallback, weak rollback, batch/online mismatch, or unobservable high-impact inference path.

Lower-risk but concrete ML maintainability issue: stale docs, minor metric gap, unclear threshold owner, weak data-quality check, or coupling that blocks safe model updates.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the data/feature/model/inference owner and affected consumer, plus symbol when possible.
- Include model/artifact/version owner, expected behavior, acceptance criteria, and validation/eval direction when discoverable.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same pipeline owner unless fixes, rollout units, eval strategy, or deployment boundary differ.
- Do not propose research experiments, model-family swaps, or metric redesigns without repo-visible product need and validation path.
