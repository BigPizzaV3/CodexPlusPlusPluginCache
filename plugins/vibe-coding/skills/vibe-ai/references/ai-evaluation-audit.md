# AI Evaluation Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit an AI evaluation system as a release gate across task definition, datasets, scorers/judges, uncertainty, slices, regressions, and online correlation.

## Domain invariants

- The evaluated task, unit, input context, reference/acceptable outcomes, failure taxonomy, and decision threshold match the shipped product behavior.
- Evaluation data has provenance, consent/retention, deduplication, contamination/leakage controls, versioning, and representative risk slices.
- Deterministic scorers, human rubrics, and model judges expose validity limits; judge prompts/models/settings are versioned and calibrated against human labels.
- Comparisons use paired examples where possible, report uncertainty and practical effect, and do not tune repeatedly against a held-out release set.
- Safety, latency, cost, tool/grounding, abstention, and product outcome metrics are separated instead of collapsed into one opaque score.
- Regression gates define allowed variance, flaky/nondeterministic handling, ownership, artifact lineage, and what blocks release.

## Audit method

1. Map the production decision path to evaluation cases, scorers, rubrics, datasets, model/config identity, reports, and release gates.
2. Inspect sampling, duplicates, contamination, slice coverage, reference quality, annotator/judge disagreement, and missing/error handling.
3. Re-run a representative subset to measure scorer determinism and compare judge/human labels by failure class.
4. Check statistical unit, paired comparison, confidence/uncertainty, multiple variants, threshold selection, and test-set reuse.
5. Compare offline failures with available online incidents/feedback without claiming causal equivalence.

## Priority model

- **P0:** unsafe action, privacy or tenant leak, materially wrong irreversible decision, corrupted model/data lineage, or critical service failure.
- **P1:** a reachable quality, grounding, evaluation, serving, cost, or governance defect with clear product impact.
- **P2:** a lower-risk but concrete robustness, observability, dataset, or maintainability issue.
