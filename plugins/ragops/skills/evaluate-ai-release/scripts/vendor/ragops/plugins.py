from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from ragops.models import EvalCase, Finding, RecordedResponse


@dataclass(frozen=True)
class PluginResult:
    metrics: dict[str, float]
    findings: tuple[Finding, ...] = ()


@runtime_checkable
class CaseEvaluator(Protocol):
    """Stable extension point for deterministic or provider-backed evaluators."""

    name: str

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult: ...


class EvaluatorRegistry:
    def __init__(self) -> None:
        self._evaluators: dict[str, CaseEvaluator] = {}

    def register(self, evaluator: CaseEvaluator) -> None:
        if not evaluator.name or evaluator.name in self._evaluators:
            raise ValueError(f"Evaluator name must be unique: {evaluator.name!r}")
        self._evaluators[evaluator.name] = evaluator

    def values(self) -> tuple[CaseEvaluator, ...]:
        return tuple(self._evaluators.values())


class RetrievalRecallEvaluator:
    name = "retrieval_recall"

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult:
        relevant = set(case.required_citation_ids)
        if not relevant:
            score = 1.0
        else:
            score = len(relevant.intersection(response.retrieved_ids)) / len(relevant)
        return PluginResult(metrics={"score": score})


class CitationCorrectnessEvaluator:
    """Measure cited IDs that belong to the case's trusted evidence contract."""

    name = "citation_correctness"

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult:
        supplied = set(response.citation_ids)
        required = set(case.required_citation_ids)
        if not supplied:
            score = 1.0 if not required else 0.0
        else:
            score = len(supplied.intersection(required)) / len(supplied)
        findings = ()
        if score < 1.0:
            findings = (
                Finding(
                    rule="unsupported_citation",
                    severity="high",
                    message="Response includes a citation outside the case evidence contract",
                ),
            )
        return PluginResult(metrics={"score": score}, findings=findings)


class ClaimSupportEvaluator:
    """Transparent claim-level lexical support baseline.

    Sentences are treated as claims. A claim is supported when its meaningful
    tokens overlap trusted evidence above ``min_overlap``. This is intentionally
    not described as semantic entailment.
    """

    name = "claim_support"

    def __init__(self, *, min_overlap: float = 0.5) -> None:
        if not 0 <= min_overlap <= 1:
            raise ValueError("min_overlap must be between 0 and 1")
        self.min_overlap = min_overlap

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult:
        evidence_tokens = _meaningful_tokens(" ".join(case.evidence))
        claims = [part.strip() for part in re.split(r"[.!?。！？]+", response.answer) if part.strip()]
        if not claims:
            return PluginResult(metrics={"score": 0.0, "unsupported_claims": 1.0})
        supported = 0
        for claim in claims:
            tokens = _meaningful_tokens(claim)
            overlap = len(tokens.intersection(evidence_tokens)) / len(tokens) if tokens else 0.0
            supported += overlap >= self.min_overlap
        score = supported / len(claims)
        unsupported = len(claims) - supported
        findings = ()
        if unsupported:
            findings = (
                Finding(
                    rule="unsupported_claim",
                    severity="high",
                    message=f"{unsupported} of {len(claims)} answer claims lack lexical support",
                ),
            )
        return PluginResult(
            metrics={"score": score, "unsupported_claims": float(unsupported)},
            findings=findings,
        )


class AnswerLengthBudgetEvaluator:
    """Report a deterministic Unicode code-point answer-length budget."""

    name = "answer_length_budget"

    def __init__(self, *, max_characters: int = 500) -> None:
        if isinstance(max_characters, bool) or not isinstance(max_characters, int):
            raise TypeError("max_characters must be an integer")
        if max_characters <= 0:
            raise ValueError("max_characters must be positive")
        self.max_characters = max_characters

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult:
        character_count = len(response.answer)
        within_budget = character_count <= self.max_characters
        findings = ()
        if not within_budget:
            findings = (
                Finding(
                    rule="answer_length_budget_exceeded",
                    severity="medium",
                    message=(
                        f"Answer contains {character_count} Unicode code points; "
                        f"configured budget is {self.max_characters}"
                    ),
                ),
            )
        return PluginResult(
            metrics={
                "character_count": float(character_count),
                "within_budget": 1.0 if within_budget else 0.0,
            },
            findings=findings,
        )


class SourceFreshnessEvaluator:
    """Check the explicit current-source ID contract for tagged cases.

    This evaluator does not infer recency from dates or document content. A
    scenario author marks a case with ``freshness`` and declares the complete
    current source set through ``required_citation_ids``.
    """

    name = "source_freshness"

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult:
        if "freshness" not in case.tags:
            return PluginResult(metrics={"score": 1.0, "applicable": 0.0})
        required = set(case.required_citation_ids)
        supplied = set(response.citation_ids)
        union = required | supplied
        score = len(required & supplied) / len(union) if union else 1.0
        findings = ()
        if score < 1.0:
            findings = (
                Finding(
                    rule="stale_source_contract_violation",
                    severity="high",
                    message="Response does not cite exactly the scenario's current source IDs",
                ),
            )
        return PluginResult(metrics={"score": score, "applicable": 1.0}, findings=findings)


class AbstentionContractEvaluator:
    """Check a transparent lexical abstention contract for tagged cases."""

    name = "abstention_contract"

    def __init__(self, *, min_overlap: float = 0.5) -> None:
        if not 0 <= min_overlap <= 1:
            raise ValueError("min_overlap must be between 0 and 1")
        self.min_overlap = min_overlap

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult:
        if "abstain" not in case.tags:
            return PluginResult(metrics={"score": 1.0, "applicable": 0.0})
        required = set(case.required_citation_ids)
        supplied = set(response.citation_ids)
        citation_score = (
            len(required & supplied) / len(required) if required else 1.0
        )
        evidence_tokens = _meaningful_tokens(" ".join(case.evidence))
        answer_tokens = _meaningful_tokens(response.answer)
        overlap = (
            len(answer_tokens & evidence_tokens) / len(answer_tokens)
            if answer_tokens
            else 0.0
        )
        score = min(citation_score, overlap)
        findings = ()
        if citation_score < 1.0 or overlap < self.min_overlap:
            findings = (
                Finding(
                    rule="abstention_contract_violation",
                    severity="high",
                    message=(
                        "Response does not satisfy the case's cited lexical "
                        "abstention contract"
                    ),
                ),
            )
        return PluginResult(metrics={"score": score, "applicable": 1.0}, findings=findings)


def _meaningful_tokens(value: str) -> set[str]:
    return {token.casefold() for token in re.findall(r"[\w\-]+", value) if len(token) > 1}
