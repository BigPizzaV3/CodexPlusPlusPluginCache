from __future__ import annotations

import json
import math
import os
import stat
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Protocol

from ragops.loader import ContractError
from ragops.models import MetricObservation, ReplayBundle, ReplayProvenance
from ragops.statistical import load_replay_bundle

MAX_CASES = 10_000
MAX_REPEATS = 1_000
MAX_OBSERVATIONS = 100_000
MAX_COMMAND_OUTPUT_BYTES = 1_000_000


@dataclass(frozen=True)
class RepeatedRunPlan:
    schema_version: str
    scenario_id: str
    scenario_digest: str
    case_ids: tuple[str, ...]
    repeats: int
    provenance: ReplayProvenance


class MetricRunAdapter(Protocol):
    def collect(self, case_id: str, repeat_id: str) -> dict[str, float]: ...


class CommandMetricAdapter:
    """Run one explicit command per observation without invoking a shell."""

    def __init__(self, command: tuple[str, ...], *, timeout_seconds: float = 60.0) -> None:
        if not command or any(not isinstance(part, str) or not part for part in command):
            raise ValueError("Repeated-run command must contain non-empty arguments")
        if not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
            raise ValueError("Repeated-run timeout must be finite and positive")
        self.command = command
        self.timeout_seconds = timeout_seconds

    def collect(self, case_id: str, repeat_id: str) -> dict[str, float]:
        environment = os.environ.copy()
        environment["RAGOPS_CASE_ID"] = case_id
        environment["RAGOPS_REPEAT_ID"] = repeat_id
        try:
            completed = subprocess.run(
                self.command,
                check=False,
                capture_output=True,
                env=environment,
                timeout=self.timeout_seconds,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ContractError(
                f"Repeated-run command failed for {case_id}/{repeat_id}: {exc}"
            ) from exc
        if len(completed.stdout) > MAX_COMMAND_OUTPUT_BYTES:
            raise ContractError(
                f"Repeated-run command output exceeds {MAX_COMMAND_OUTPUT_BYTES} bytes"
            )
        if completed.returncode != 0:
            error = completed.stderr[:2000].decode("utf-8", errors="replace").strip()
            raise ContractError(
                f"Repeated-run command exited {completed.returncode} for "
                f"{case_id}/{repeat_id}: {error}"
            )
        try:
            payload = json.loads(completed.stdout.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ContractError(
                f"Repeated-run command returned invalid JSON for {case_id}/{repeat_id}"
            ) from exc
        if not isinstance(payload, dict) or set(payload) != {"metrics"}:
            raise ContractError("Repeated-run command output must contain only a metrics object")
        return _metric_map(payload["metrics"], f"command output {case_id}/{repeat_id}")


def load_repeated_run_plan(path: str | Path) -> RepeatedRunPlan:
    try:
        data = json.loads(
            Path(path).read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {value}")
            ),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ContractError(f"Cannot load repeated-run plan from {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ContractError("Repeated-run plan must be an object")
    unknown = set(data) - {
        "schema_version",
        "scenario_id",
        "scenario_digest",
        "case_ids",
        "repeats",
        "provenance",
    }
    if unknown:
        raise ContractError(f"Unknown repeated-run plan fields: {sorted(unknown)}")
    try:
        provenance_data = data["provenance"]
        if not isinstance(provenance_data, dict):
            raise TypeError("provenance must be an object")
        if set(provenance_data) != {
            "dataset",
            "evidence",
            "evaluator",
            "application",
            "model",
            "model_config",
            "environment",
        }:
            raise ValueError("provenance fields must match the replay-bundle contract")
        plan = RepeatedRunPlan(
            schema_version=data["schema_version"],
            scenario_id=data["scenario_id"],
            scenario_digest=data["scenario_digest"],
            case_ids=tuple(data["case_ids"]),
            repeats=data["repeats"],
            provenance=ReplayProvenance(**provenance_data),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ContractError(f"Invalid repeated-run plan contract: {exc}") from exc
    _validate_plan(plan)
    return plan


def collect_repeated_runs(
    plan: RepeatedRunPlan,
    adapter: MetricRunAdapter,
    *,
    existing: ReplayBundle | None = None,
    checkpoint: Callable[[ReplayBundle], None] | None = None,
    stop_when: Callable[[ReplayBundle], bool] | None = None,
) -> ReplayBundle:
    _validate_plan(plan)
    records = list(existing.records) if existing is not None else []
    if existing is not None:
        _validate_resume(plan, existing)
    completed = {(record.case_id, record.repeat_id) for record in records}
    expected_metric_names = set(records[0].metrics) if records else None
    for repeat_number in range(1, plan.repeats + 1):
        for case_id in plan.case_ids:
            repeat_id = f"run-{repeat_number:04d}"
            if (case_id, repeat_id) in completed:
                continue
            metrics = _metric_map(
                adapter.collect(case_id, repeat_id), f"adapter result {case_id}/{repeat_id}"
            )
            if expected_metric_names is None:
                expected_metric_names = set(metrics)
            elif set(metrics) != expected_metric_names:
                raise ContractError("Every repeated-run observation must use the same metrics")
            records.append(MetricObservation(case_id, repeat_id, metrics))
            bundle = _bundle(plan, tuple(records))
            if checkpoint is not None:
                checkpoint(bundle)
            if stop_when is not None and stop_when(bundle):
                return bundle
    return _bundle(plan, tuple(records))


def load_resume_bundle(path: str | Path, *, resume: bool) -> ReplayBundle | None:
    destination = Path(path)
    if not destination.exists():
        return None
    if destination.is_symlink():
        raise ContractError("Repeated-run output must not be a symlink")
    if not resume:
        raise ContractError("Repeated-run output already exists; pass --resume to continue")
    return load_replay_bundle(destination)


def write_replay_bundle(path: str | Path, bundle: ReplayBundle) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink():
        raise ContractError("Repeated-run output must not be a symlink")
    payload = json.dumps(asdict(bundle), ensure_ascii=False, indent=2) + "\n"
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=destination.parent,
            prefix=f".{destination.name}.",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            os.chmod(temporary_name, stat.S_IRUSR | stat.S_IWUSR)
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, destination)
    finally:
        if temporary_name and Path(temporary_name).exists():
            Path(temporary_name).unlink()


def _validate_plan(plan: RepeatedRunPlan) -> None:
    if plan.schema_version != "0.1":
        raise ContractError(f"Unsupported repeated-run plan schema: {plan.schema_version}")
    for name, value in (
        ("scenario_id", plan.scenario_id),
        ("scenario_digest", plan.scenario_digest),
        ("provenance.dataset", plan.provenance.dataset),
        ("provenance.evidence", plan.provenance.evidence),
        ("provenance.evaluator", plan.provenance.evaluator),
        ("provenance.application", plan.provenance.application),
        ("provenance.model", plan.provenance.model),
        ("provenance.model_config", plan.provenance.model_config),
        ("provenance.environment", plan.provenance.environment),
    ):
        if not isinstance(value, str) or not value:
            raise ContractError(f"{name} must be a non-empty string")
    if not plan.case_ids or len(plan.case_ids) > MAX_CASES:
        raise ContractError(f"Repeated-run plan needs between 1 and {MAX_CASES} cases")
    if any(not isinstance(case_id, str) or not case_id for case_id in plan.case_ids):
        raise ContractError("Repeated-run case IDs must be non-empty strings")
    if len(set(plan.case_ids)) != len(plan.case_ids):
        raise ContractError("Repeated-run case IDs must be unique")
    if isinstance(plan.repeats, bool) or not isinstance(plan.repeats, int):
        raise ContractError("Repeated-run repeats must be an integer")
    if not 1 <= plan.repeats <= MAX_REPEATS:
        raise ContractError(f"Repeated-run repeats must be between 1 and {MAX_REPEATS}")
    if len(plan.case_ids) * plan.repeats > MAX_OBSERVATIONS:
        raise ContractError(
            f"Repeated-run plan exceeds the {MAX_OBSERVATIONS} observation limit"
        )


def _validate_resume(plan: RepeatedRunPlan, existing: ReplayBundle) -> None:
    if (
        existing.scenario_id != plan.scenario_id
        or existing.scenario_digest != plan.scenario_digest
        or existing.provenance != plan.provenance
    ):
        raise ContractError("Resume bundle metadata does not match the repeated-run plan")
    allowed_cases = set(plan.case_ids)
    for record in existing.records:
        if record.case_id not in allowed_cases:
            raise ContractError(f"Resume bundle contains unknown case {record.case_id!r}")
        if not record.repeat_id.startswith("run-"):
            raise ContractError("Resume bundle repeat IDs must use run-NNNN format")
        try:
            repeat_number = int(record.repeat_id.removeprefix("run-"))
        except ValueError as exc:
            raise ContractError("Resume bundle repeat IDs must use run-NNNN format") from exc
        if not 1 <= repeat_number <= plan.repeats:
            raise ContractError("Resume bundle contains a repeat outside the plan")


def _metric_map(value: object, name: str) -> dict[str, float]:
    if not isinstance(value, dict) or not value:
        raise ContractError(f"{name} must be a non-empty metric object")
    metrics: dict[str, float] = {}
    for metric_name, metric_value in value.items():
        if not isinstance(metric_name, str) or not metric_name:
            raise ContractError(f"{name} metric names must be non-empty strings")
        if isinstance(metric_value, bool) or not isinstance(metric_value, (int, float)):
            raise ContractError(f"{name}.{metric_name} must be numeric")
        numeric = float(metric_value)
        if not math.isfinite(numeric):
            raise ContractError(f"{name}.{metric_name} must be finite")
        metrics[metric_name] = numeric
    return metrics


def _bundle(plan: RepeatedRunPlan, records: tuple[MetricObservation, ...]) -> ReplayBundle:
    return ReplayBundle(
        schema_version="0.1",
        scenario_id=plan.scenario_id,
        scenario_digest=plan.scenario_digest,
        provenance=plan.provenance,
        records=records,
    )
