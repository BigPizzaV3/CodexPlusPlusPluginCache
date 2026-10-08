"""RAGOps public API."""

from ragops.drift import detect_evaluator_drift
from ragops.engine import compare, evaluate
from ragops.evidence import create_evidence_bundle, verify_evidence_bundle
from ragops.loader import load_responses, load_scenario, responses_from_data, scenario_from_dict
from ragops.provenance import diagnose_provenance
from ragops.sequential import compare_replay_bundles_sequentially
from ragops.statistical import (
    compare_replay_bundles,
    load_replay_bundle,
    replay_bundle_from_dict,
)

__version__ = "2.0.2"

__all__ = [
    "compare",
    "compare_replay_bundles_sequentially",
    "detect_evaluator_drift",
    "diagnose_provenance",
    "evaluate",
    "create_evidence_bundle",
    "compare_replay_bundles",
    "load_replay_bundle",
    "load_responses",
    "load_scenario",
    "responses_from_data",
    "replay_bundle_from_dict",
    "scenario_from_dict",
    "verify_evidence_bundle",
    "__version__",
]
