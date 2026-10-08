from __future__ import annotations

import itertools
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import fmean
from typing import Any

from ragops.loader import ContractError


@dataclass(frozen=True)
class HumanLabel:
    reviewer: str
    label: int


@dataclass(frozen=True)
class CalibrationRecord:
    case_id: str
    automated_score: float
    human_labels: tuple[HumanLabel, ...]


@dataclass(frozen=True)
class CalibrationPolicy:
    threshold: float
    minimum_coverage: float
    minimum_accuracy: float
    maximum_mae: float
    maximum_false_pass_rate: float
    minimum_agreement: float


@dataclass(frozen=True)
class CalibrationSet:
    schema_version: str
    evaluator: str
    records: tuple[CalibrationRecord, ...]
    policy: CalibrationPolicy


@dataclass(frozen=True)
class CalibrationReport:
    schema_version: str
    evaluator: str
    decision: str
    case_count: int
    labeled_case_count: int
    coverage: float
    accuracy: float
    mae: float
    false_pass_rate: float
    false_block_rate: float
    reviewer_agreement: float | None
    reviewer_pair_count: int
    failed_gates: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def load_calibration_set(path: str | Path) -> CalibrationSet:
    try:
        data = json.loads(
            Path(path).read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {value}")
            ),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ContractError(f"Cannot load calibration set from {path}: {exc}") from exc
    if not isinstance(data, dict) or set(data) != {
        "schema_version",
        "evaluator",
        "policy",
        "records",
    }:
        raise ContractError("Calibration set fields do not match schema 1.0")
    if data["schema_version"] != "1.0":
        raise ContractError(f"Unsupported calibration set schema: {data['schema_version']}")
    evaluator = data["evaluator"]
    if not isinstance(evaluator, str) or not evaluator:
        raise ContractError("Calibration evaluator must be a non-empty string")
    raw_policy = data["policy"]
    policy_fields = {
        "threshold",
        "minimum_coverage",
        "minimum_accuracy",
        "maximum_mae",
        "maximum_false_pass_rate",
        "minimum_agreement",
    }
    if not isinstance(raw_policy, dict) or set(raw_policy) != policy_fields:
        raise ContractError("Calibration policy fields do not match schema 1.0")
    policy = CalibrationPolicy(**raw_policy)
    raw_records = data["records"]
    if not isinstance(raw_records, list) or not raw_records:
        raise ContractError("Calibration records must be a non-empty array")
    records = []
    for index, raw_record in enumerate(raw_records):
        if not isinstance(raw_record, dict) or set(raw_record) != {
            "case_id",
            "automated_score",
            "human_labels",
        }:
            raise ContractError(f"Calibration record {index} fields do not match schema 1.0")
        raw_labels = raw_record["human_labels"]
        if not isinstance(raw_labels, list):
            raise ContractError(f"Calibration record {index} human_labels must be an array")
        labels = []
        for label_index, raw_label in enumerate(raw_labels):
            if not isinstance(raw_label, dict) or set(raw_label) != {"reviewer", "label"}:
                raise ContractError(
                    f"Calibration record {index} label {label_index} fields are invalid"
                )
            labels.append(HumanLabel(raw_label["reviewer"], raw_label["label"]))
        records.append(
            CalibrationRecord(
                raw_record["case_id"], raw_record["automated_score"], tuple(labels)
            )
        )
    calibration_set = CalibrationSet("1.0", evaluator, tuple(records), policy)
    _validate_inputs(calibration_set.evaluator, calibration_set.records, calibration_set.policy)
    return calibration_set


def calibrate_evaluator(
    evaluator: str,
    records: tuple[CalibrationRecord, ...],
    policy: CalibrationPolicy,
) -> CalibrationReport:
    _validate_inputs(evaluator, records, policy)
    labeled = tuple(record for record in records if record.human_labels)
    coverage = len(labeled) / len(records)
    human_scores = {
        record.case_id: fmean(label.label for label in record.human_labels) for record in labeled
    }
    human_binary = {
        case_id: int(score >= policy.threshold) for case_id, score in human_scores.items()
    }
    automated_binary = {
        record.case_id: int(record.automated_score >= policy.threshold) for record in labeled
    }
    accuracy = (
        sum(automated_binary[item.case_id] == human_binary[item.case_id] for item in labeled)
        / len(labeled)
        if labeled
        else 0.0
    )
    mae = (
        fmean(abs(item.automated_score - human_scores[item.case_id]) for item in labeled)
        if labeled
        else 1.0
    )
    false_passes = sum(
        automated_binary[item.case_id] == 1 and human_binary[item.case_id] == 0
        for item in labeled
    )
    false_blocks = sum(
        automated_binary[item.case_id] == 0 and human_binary[item.case_id] == 1
        for item in labeled
    )
    denominator = len(labeled) if labeled else 1
    agreement, pair_count = _reviewer_agreement(records)
    failed = []
    if coverage < policy.minimum_coverage:
        failed.append("coverage")
    if accuracy < policy.minimum_accuracy:
        failed.append("accuracy")
    if mae > policy.maximum_mae:
        failed.append("mae")
    if false_passes / denominator > policy.maximum_false_pass_rate:
        failed.append("false_pass_rate")
    if agreement is None:
        if policy.minimum_agreement > 0:
            failed.append("reviewer_agreement_insufficient")
    elif agreement < policy.minimum_agreement:
        failed.append("reviewer_agreement")
    return CalibrationReport(
        schema_version="1.0",
        evaluator=evaluator,
        decision="PASS" if not failed else "BLOCK",
        case_count=len(records),
        labeled_case_count=len(labeled),
        coverage=coverage,
        accuracy=accuracy,
        mae=mae,
        false_pass_rate=false_passes / denominator,
        false_block_rate=false_blocks / denominator,
        reviewer_agreement=agreement,
        reviewer_pair_count=pair_count,
        failed_gates=tuple(failed),
    )


def _reviewer_agreement(
    records: tuple[CalibrationRecord, ...],
) -> tuple[float | None, int]:
    by_reviewer: dict[str, dict[str, int]] = {}
    for record in records:
        for label in record.human_labels:
            by_reviewer.setdefault(label.reviewer, {})[record.case_id] = label.label
    kappas = []
    for first, second in itertools.combinations(sorted(by_reviewer), 2):
        shared = sorted(set(by_reviewer[first]) & set(by_reviewer[second]))
        if len(shared) < 2:
            continue
        first_values = [by_reviewer[first][case_id] for case_id in shared]
        second_values = [by_reviewer[second][case_id] for case_id in shared]
        observed = sum(a == b for a, b in zip(first_values, second_values)) / len(shared)
        first_yes = sum(first_values) / len(shared)
        second_yes = sum(second_values) / len(shared)
        expected = first_yes * second_yes + (1 - first_yes) * (1 - second_yes)
        kappa = 1.0 if expected == 1.0 and observed == 1.0 else (observed - expected) / (1 - expected)
        kappas.append(kappa)
    return (fmean(kappas), len(kappas)) if kappas else (None, 0)


def _validate_inputs(
    evaluator: str,
    records: tuple[CalibrationRecord, ...],
    policy: CalibrationPolicy,
) -> None:
    if not isinstance(evaluator, str) or not evaluator:
        raise ContractError("Calibration evaluator must be a non-empty string")
    if not records:
        raise ContractError("Calibration requires at least one record")
    case_ids = [record.case_id for record in records]
    if any(not isinstance(case_id, str) or not case_id for case_id in case_ids):
        raise ContractError("Calibration case IDs must be non-empty strings")
    if len(set(case_ids)) != len(case_ids):
        raise ContractError("Calibration case IDs must be unique")
    for record in records:
        _ratio(record.automated_score, f"Calibration score for {record.case_id}")
        reviewers = [label.reviewer for label in record.human_labels]
        if len(set(reviewers)) != len(reviewers):
            raise ContractError(f"Calibration case {record.case_id} has duplicate reviewer labels")
        for label in record.human_labels:
            if not isinstance(label.reviewer, str) or not label.reviewer:
                raise ContractError("Calibration reviewer must be a non-empty string")
            if isinstance(label.label, bool) or label.label not in {0, 1}:
                raise ContractError("Calibration human label must be 0 or 1")
    for field_name, value in asdict(policy).items():
        _ratio(value, f"Calibration policy {field_name}")


def _ratio(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractError(f"{label} must be a number between 0 and 1")
    number = float(value)
    if not math.isfinite(number) or not 0 <= number <= 1:
        raise ContractError(f"{label} must be between 0 and 1")
    return number
