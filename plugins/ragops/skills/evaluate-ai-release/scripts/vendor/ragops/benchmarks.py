from __future__ import annotations

from collections import Counter
from typing import Any

from ragops.models import Scenario


def scenario_summary(scenario: Scenario) -> dict[str, Any]:
    """Return deterministic benchmark coverage metadata for authoring and review."""
    categories = Counter(case.category for case in scenario.cases)
    severities = Counter(case.severity for case in scenario.cases)
    languages = Counter(case.language for case in scenario.cases)
    attacks = Counter(
        case.attack_category for case in scenario.cases if case.attack_category is not None
    )
    return {
        "schema_version": scenario.schema_version,
        "scenario_id": scenario.id,
        "case_count": len(scenario.cases),
        "categories": dict(sorted(categories.items())),
        "severities": dict(sorted(severities.items())),
        "languages": dict(sorted(languages.items())),
        "attack_categories": dict(sorted(attacks.items())),
    }
