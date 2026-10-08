# AI Safety & Governance Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit an AI release for misuse, harmful output, privacy, accountability, evaluation evidence, human control, and rollback governance.

## Domain invariants

- Intended use, excluded use, affected users, risk owners, human control, and escalation paths are explicit.
- Safety and policy controls are enforced at input/tool/output/product boundaries and tested against reachable misuse.
- Data/model/prompt/tool provenance, evaluation results, approvals, release identity, monitoring, and incident evidence are retained appropriately.
- Disable, rollback, correction, user reporting, and remediation paths exist for harmful or materially wrong behavior.

## Audit method

1. Define the concrete harm/misuse scenarios and map them to feature capabilities, users, data, tools, and side effects.
2. Inspect policy implementation, refusal/guardrails, human review, overrides, logging, appeal/correction, and incident ownership.
3. Review evaluation coverage by risk slice, adversarial inputs, false-positive/negative tradeoffs, and model/provider change.
4. Check privacy, retention, consent, third-party terms, and cross-tenant exposure from repository evidence.

## Priority model

- **P0:** unsafe action, privacy or tenant leak, materially wrong irreversible decision, corrupted model/data lineage, or critical service failure.
- **P1:** a reachable quality, grounding, evaluation, serving, cost, or governance defect with clear product impact.
- **P2:** a lower-risk but concrete robustness, observability, dataset, or maintainability issue.
