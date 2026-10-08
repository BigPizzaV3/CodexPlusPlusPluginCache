from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from ragops.loader import ContractError


@dataclass(frozen=True)
class DatasetCaseRecord:
    id: str
    digest: str
    normalized_content_digest: str
    category: str
    severity: str
    language: str
    tags: tuple[str, ...]
    source: str
    reviewed: bool


@dataclass(frozen=True)
class DatasetManifest:
    schema_version: str
    dataset_id: str
    version: str
    source_classification: str
    owners: tuple[str, ...]
    review_state: str
    cases: tuple[DatasetCaseRecord, ...]
    splits: dict[str, tuple[str, ...]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "dataset_id": self.dataset_id,
            "version": self.version,
            "source_classification": self.source_classification,
            "owners": list(self.owners),
            "review_state": self.review_state,
            "cases": [asdict(item) | {"tags": list(item.tags)} for item in self.cases],
            "splits": {name: list(case_ids) for name, case_ids in sorted(self.splits.items())},
        }


@dataclass(frozen=True)
class DatasetIssue:
    code: str
    message: str
    case_ids: tuple[str, ...] = ()
    observed: int | None = None
    required: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class DatasetDiff:
    dataset_id: str
    from_version: str
    to_version: str
    added_case_ids: tuple[str, ...]
    removed_case_ids: tuple[str, ...]
    changed_case_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def create_dataset_manifest(
    dataset_id: str,
    version: str,
    cases: Iterable[Mapping[str, Any]],
    *,
    splits: Mapping[str, tuple[str, ...]],
    source_classification: str,
    owners: tuple[str, ...],
    review_state: str = "draft",
) -> DatasetManifest:
    if not isinstance(dataset_id, str) or not dataset_id:
        raise ContractError("Dataset ID must be a non-empty string")
    if not isinstance(version, str) or not version:
        raise ContractError("Dataset version must be a non-empty string")
    raw_cases = tuple(cases)
    if not raw_cases:
        raise ContractError("Dataset manifest requires at least one case")
    records = tuple(_case_record(item, index) for index, item in enumerate(raw_cases))
    identifiers = [item.id for item in records]
    if len(set(identifiers)) != len(identifiers):
        raise ContractError("Dataset case IDs must be unique")
    normalized_splits = _splits(splits, set(identifiers))
    manifest = DatasetManifest(
        schema_version="1.0",
        dataset_id=dataset_id,
        version=version,
        source_classification=source_classification,
        owners=tuple(owners),
        review_state=review_state,
        cases=records,
        splits=normalized_splits,
    )
    _validate_manifest_contract(manifest)
    return manifest


def validate_dataset_manifest(
    manifest: DatasetManifest,
    *,
    minimum_slice_counts: Mapping[str, int] | None = None,
) -> tuple[DatasetIssue, ...]:
    _validate_manifest_contract(manifest)
    issues = []
    split_by_case: dict[str, set[str]] = {}
    for split_name, case_ids in manifest.splits.items():
        for case_id in case_ids:
            split_by_case.setdefault(case_id, set()).add(split_name)
    for case_id, split_names in sorted(split_by_case.items()):
        if len(split_names) > 1:
            issues.append(
                DatasetIssue(
                    "split_membership_leakage",
                    f"Case {case_id!r} appears in multiple splits: {sorted(split_names)}",
                    (case_id,),
                )
            )
    grouped: dict[str, list[DatasetCaseRecord]] = {}
    for case in manifest.cases:
        grouped.setdefault(case.normalized_content_digest, []).append(case)
    for matching in grouped.values():
        if len(matching) < 2:
            continue
        case_ids = tuple(sorted(item.id for item in matching))
        split_names = {
            split
            for case_id in case_ids
            for split in split_by_case.get(case_id, set())
        }
        code = "normalized_content_leakage" if len(split_names) > 1 else "duplicate_content"
        issues.append(
            DatasetIssue(code, f"Normalized duplicate cases detected: {list(case_ids)}", case_ids)
        )
    missing_source = tuple(sorted(item.id for item in manifest.cases if not item.source))
    if missing_source:
        issues.append(
            DatasetIssue("missing_provenance", "Dataset cases are missing source provenance", missing_source)
        )
    if manifest.source_classification == "production-derived":
        unreviewed = tuple(sorted(item.id for item in manifest.cases if not item.reviewed))
        if unreviewed:
            issues.append(
                DatasetIssue(
                    "review_required",
                    "Production-derived cases must remain quarantined until reviewed",
                    unreviewed,
                )
            )
    for selector, required in sorted((minimum_slice_counts or {}).items()):
        if isinstance(required, bool) or not isinstance(required, int) or required <= 0:
            raise ContractError(f"Dataset slice {selector!r} minimum must be positive")
        selected = tuple(item.id for item in manifest.cases if _slice_match(item, selector))
        if len(selected) < required:
            issues.append(
                DatasetIssue(
                    "slice_coverage",
                    f"Dataset slice {selector!r} has {len(selected)} cases; requires {required}",
                    selected,
                    len(selected),
                    required,
                )
            )
    return tuple(sorted(issues, key=lambda item: (item.code, item.case_ids)))


def diff_dataset_manifests(before: DatasetManifest, after: DatasetManifest) -> DatasetDiff:
    if before.dataset_id != after.dataset_id:
        raise ContractError("Dataset diff requires matching dataset IDs")
    before_cases = {item.id: item.digest for item in before.cases}
    after_cases = {item.id: item.digest for item in after.cases}
    shared = set(before_cases) & set(after_cases)
    return DatasetDiff(
        dataset_id=before.dataset_id,
        from_version=before.version,
        to_version=after.version,
        added_case_ids=tuple(sorted(set(after_cases) - set(before_cases))),
        removed_case_ids=tuple(sorted(set(before_cases) - set(after_cases))),
        changed_case_ids=tuple(
            sorted(case_id for case_id in shared if before_cases[case_id] != after_cases[case_id])
        ),
    )


def write_dataset_manifest(path: str | Path, manifest: DatasetManifest) -> None:
    _validate_manifest_contract(manifest)
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(manifest.to_dict(), ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def load_dataset_manifest(path: str | Path) -> DatasetManifest:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"Cannot load dataset manifest from {path}: {exc}") from exc
    if not isinstance(data, dict) or set(data) != {
        "schema_version",
        "dataset_id",
        "version",
        "source_classification",
        "owners",
        "review_state",
        "cases",
        "splits",
    }:
        raise ContractError("Dataset manifest fields do not match schema 1.0")
    if data["schema_version"] != "1.0":
        raise ContractError(f"Unsupported dataset manifest schema: {data['schema_version']}")
    raw_cases = data["cases"]
    if not isinstance(raw_cases, list):
        raise ContractError("Dataset manifest cases must be an array")
    records = []
    expected_case_fields = {
        "id",
        "digest",
        "normalized_content_digest",
        "category",
        "severity",
        "language",
        "tags",
        "source",
        "reviewed",
    }
    for index, item in enumerate(raw_cases):
        if not isinstance(item, dict) or set(item) != expected_case_fields:
            raise ContractError(f"Dataset case record {index} fields are invalid")
        records.append(
            DatasetCaseRecord(
                id=item["id"],
                digest=item["digest"],
                normalized_content_digest=item["normalized_content_digest"],
                category=item["category"],
                severity=item["severity"],
                language=item["language"],
                tags=tuple(item["tags"]),
                source=item["source"],
                reviewed=item["reviewed"],
            )
        )
    raw_splits = data["splits"]
    if not isinstance(raw_splits, dict):
        raise ContractError("Dataset splits must be an object")
    manifest = DatasetManifest(
        "1.0",
        data["dataset_id"],
        data["version"],
        data["source_classification"],
        tuple(data["owners"]),
        data["review_state"],
        tuple(records),
        {name: tuple(case_ids) for name, case_ids in raw_splits.items()},
    )
    _validate_manifest_contract(manifest)
    return manifest


def _case_record(value: Mapping[str, Any], index: int) -> DatasetCaseRecord:
    required = {"id", "question", "evidence", "required_citation_ids"}
    missing = sorted(required - set(value))
    if missing:
        raise ContractError(f"Dataset case {index} missing fields: {missing}")
    try:
        canonical = json.dumps(dict(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise ContractError(f"Dataset case {index} must contain finite JSON values") from exc
    normalized_payload = {
        "question": _normalize_text(value["question"]),
        "evidence": sorted(_normalize_text(item) for item in value["evidence"]),
    }
    normalized = json.dumps(normalized_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    tags = value.get("tags", [])
    if not isinstance(tags, (list, tuple)) or any(not isinstance(item, str) for item in tags):
        raise ContractError(f"Dataset case {index} tags must be a string array")
    reviewed = value.get("reviewed", False)
    if not isinstance(reviewed, bool):
        raise ContractError(f"Dataset case {index} reviewed must be boolean")
    return DatasetCaseRecord(
        id=value["id"],
        digest=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        normalized_content_digest=hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
        category=value.get("category", "unspecified"),
        severity=value.get("severity", "medium"),
        language=value.get("language", "und"),
        tags=tuple(tags),
        source=value.get("source", ""),
        reviewed=reviewed,
    )


def _splits(value: Mapping[str, tuple[str, ...]], case_ids: set[str]) -> dict[str, tuple[str, ...]]:
    if not isinstance(value, Mapping) or not value:
        raise ContractError("Dataset splits must be a non-empty mapping")
    result = {}
    for name, identifiers in value.items():
        if not isinstance(name, str) or not name:
            raise ContractError("Dataset split names must be non-empty strings")
        if not isinstance(identifiers, (list, tuple)) or not identifiers:
            raise ContractError(f"Dataset split {name!r} must contain case IDs")
        if any(not isinstance(item, str) or not item for item in identifiers):
            raise ContractError(f"Dataset split {name!r} case IDs must be non-empty strings")
        if len(set(identifiers)) != len(identifiers):
            raise ContractError(f"Dataset split {name!r} case IDs must be unique")
        unknown = sorted(set(identifiers) - case_ids)
        if unknown:
            raise ContractError(f"Dataset split {name!r} has unknown case IDs: {unknown}")
        result[name] = tuple(identifiers)
    return dict(sorted(result.items()))


def _validate_manifest_contract(manifest: DatasetManifest) -> None:
    if manifest.schema_version != "1.0":
        raise ContractError(f"Unsupported dataset manifest schema: {manifest.schema_version}")
    if not manifest.dataset_id or not manifest.version:
        raise ContractError("Dataset ID and version must be non-empty")
    if manifest.source_classification not in {"synthetic", "public", "production-derived"}:
        raise ContractError("Dataset source classification is invalid")
    if not manifest.owners or any(not owner for owner in manifest.owners):
        raise ContractError("Dataset owners must be non-empty strings")
    if manifest.review_state not in {"draft", "reviewed", "accepted", "superseded"}:
        raise ContractError("Dataset review state is invalid")
    identifiers = [item.id for item in manifest.cases]
    if not identifiers or len(set(identifiers)) != len(identifiers):
        raise ContractError("Dataset case IDs must be unique")
    digest_pattern = re.compile(r"^[0-9a-f]{64}$")
    for item in manifest.cases:
        if not item.id or digest_pattern.fullmatch(item.digest) is None or digest_pattern.fullmatch(item.normalized_content_digest) is None:
            raise ContractError(f"Dataset case record {item.id!r} is invalid")
    _splits(manifest.splits, set(identifiers))


def _slice_match(item: DatasetCaseRecord, selector: str) -> bool:
    if "=" not in selector:
        field, expected = "severity", selector
    else:
        field, expected = selector.split("=", 1)
    if field == "tag":
        return expected in item.tags
    if field not in {"category", "severity", "language"} or not expected:
        raise ContractError(f"Invalid dataset slice selector: {selector!r}")
    return getattr(item, field) == expected


def _normalize_text(value: object) -> str:
    if not isinstance(value, str):
        raise ContractError("Dataset question and evidence must be strings")
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())
