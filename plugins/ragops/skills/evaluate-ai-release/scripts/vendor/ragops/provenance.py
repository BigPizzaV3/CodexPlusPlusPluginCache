from __future__ import annotations

from ragops.models import ProvenanceDiagnosis, ReplayBundle
from ragops.statistical import classify_provenance_changes


def diagnose_provenance(
    reference: ReplayBundle, current: ReplayBundle
) -> ProvenanceDiagnosis:
    changes = classify_provenance_changes(reference, current)
    evidence_changed = "evidence" in changes
    causal: list[str] = []
    if "scenario" in changes or "dataset" in changes:
        causal.append("dataset")
    if "evaluator" in changes:
        causal.append("evaluator")
    if any(name in changes for name in ("application", "model", "model_config")):
        causal.append("model")
    if "infrastructure" in changes:
        causal.append("infrastructure")

    if len(causal) > 1:
        classification = "confounded"
        comparable = False
        message = "Multiple causal axes changed; isolate one axis before gating."
    elif causal == ["dataset"]:
        classification = "dataset_drift"
        comparable = False
        message = "Scenario or dataset provenance changed; run a dedicated dataset review."
    elif causal == ["evaluator"]:
        if evidence_changed:
            classification = "confounded"
            comparable = False
            message = "Evaluator and evidence changed together; replay frozen anchors first."
        else:
            classification = "evaluator_drift"
            comparable = True
            message = "Only evaluator provenance changed; use the evaluator drift gate."
    elif causal == ["model"]:
        classification = "model_regression"
        comparable = True
        message = "Only application/model configuration changed; model regression is isolated."
    elif causal == ["infrastructure"]:
        classification = "infrastructure_noise"
        comparable = False
        message = "Only execution environment changed; normalize infrastructure before gating."
    elif evidence_changed:
        classification = "stochastic_output_variance"
        comparable = True
        message = "Provenance is fixed but recorded evidence changed across stochastic runs."
    else:
        classification = "repeated_measurement_variance"
        comparable = True
        message = "All provenance and evidence identifiers match; only repeated measurement varies."

    return ProvenanceDiagnosis(
        schema_version="0.1",
        scenario_id=reference.scenario_id,
        classification=classification,
        comparable=comparable,
        changed_axes=changes,
        causal_axes=tuple(causal),
        evidence_changed=evidence_changed,
        message=message,
    )
