"""Optional dependency-free integration adapters."""

from .external_metrics import (
    ExternalMetricEvaluator,
    load_external_metric_evaluator,
    validate_external_metric_pair,
)
from .http import AdapterError, post_json

__all__ = [
    "AdapterError",
    "ExternalMetricEvaluator",
    "load_external_metric_evaluator",
    "post_json",
    "validate_external_metric_pair",
]
