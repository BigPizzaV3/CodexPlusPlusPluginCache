from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from ragops import __version__
from ragops.adapter_sdk import AdapterContext, discover_adapters
from ragops.adapters.external_metrics import (
    load_external_metric_evaluator,
    validate_external_metric_pair,
)
from ragops.adapters.import_profiles import convert_import
from ragops.adapters.otel_genai import otel_spans_to_trace_graph
from ragops.adapters.repeated_runs import (
    CommandMetricAdapter,
    collect_repeated_runs,
    load_repeated_run_plan,
    load_resume_bundle,
    write_replay_bundle,
)
from ragops.adapters.signing import sign_baseline_manifest, verify_baseline_signature
from ragops.baseline import (
    create_baseline_manifest,
    load_baseline_manifest,
    verify_baseline_manifest,
    write_baseline_manifest,
)
from ragops.benchmarks import scenario_summary
from ragops.calibration import calibrate_evaluator, load_calibration_set
from ragops.ci import render_ci
from ragops.config import (
    load_evaluation_policy,
    load_evaluator_drift_policy,
    load_regression_policy,
    load_sequential_policy,
    load_statistical_policy,
)
from ragops.contracts import diff_contract, migrate_contract, validate_contract
from ragops.control_plane import ControlPlane
from ragops.datasets import (
    create_dataset_manifest,
    diff_dataset_manifests,
    load_dataset_manifest,
    validate_dataset_manifest,
    write_dataset_manifest,
)
from ragops.demo import DEFAULT_DEMO_SCENARIO, DEMO_BUNDLES, write_demo
from ragops.drift import detect_evaluator_drift
from ragops.engine import compare, evaluate
from ragops.evidence import create_evidence_bundle, verify_evidence_bundle
from ragops.explain import explain_decision
from ragops.governance import GovernanceStore
from ragops.loader import ContractError, load_responses, load_scenario
from ragops.pilot import (
    PilotContractError,
    load_pilot_economics,
    load_pilot_manifest,
    load_pilot_observations,
    pilot_markdown,
    summarize_pilot,
)
from ragops.plugins import (
    AbstentionContractEvaluator,
    AnswerLengthBudgetEvaluator,
    CaseEvaluator,
    CitationCorrectnessEvaluator,
    ClaimSupportEvaluator,
    RetrievalRecallEvaluator,
    SourceFreshnessEvaluator,
)
from ragops.policy_v2 import apply_release_policy, load_release_decision, load_release_policy_v2
from ragops.provenance import diagnose_provenance
from ragops.reporters import (
    comparison_html,
    comparison_markdown,
    evaluation_markdown,
    evaluator_drift_markdown,
    sequential_comparison_markdown,
    statistical_comparison_markdown,
)
from ragops.sequential import compare_replay_bundles_sequentially
from ragops.statistical import compare_replay_bundles, load_replay_bundle
from ragops.store import ExperimentStore
from ragops.trace_graph import evaluate_trace_graph, load_trace_expectation, load_trace_graph
from ragops.traces import load_trace_jsonl
from ragops.usage import UsageContractError, record_local_usage, summarize_local_usage


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ragops")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    commands = parser.add_subparsers(dest="command", required=True)
    contract_parser = commands.add_parser("contract", help="Validate and migrate contracts")
    contract_commands = contract_parser.add_subparsers(dest="contract_command", required=True)
    contract_validate = contract_commands.add_parser("validate", help="Validate a JSON contract")
    contract_validate.add_argument("--kind", choices=("auto", "scenario", "trace"), default="auto")
    contract_validate.add_argument("--input", required=True)
    contract_diff = contract_commands.add_parser("diff", help="Compare contract versions")
    contract_diff.add_argument("--kind", choices=("scenario", "trace"), required=True)
    contract_diff.add_argument("--from", dest="from_version", required=True)
    contract_diff.add_argument("--to", dest="to_version", required=True)
    contract_migrate = contract_commands.add_parser("migrate", help="Migrate a JSON contract")
    contract_migrate.add_argument("--kind", choices=("scenario", "trace"), required=True)
    contract_migrate.add_argument("--from", dest="from_version", required=True)
    contract_migrate.add_argument("--to", dest="to_version", required=True)
    contract_migrate.add_argument("--input", required=True)
    contract_migrate.add_argument("--output", required=True)
    contract_migrate.add_argument("--question", default="")
    evidence_parser = commands.add_parser("evidence", help="Create and verify evidence bundles")
    evidence_commands = evidence_parser.add_subparsers(dest="evidence_command", required=True)
    evidence_create = evidence_commands.add_parser("create", help="Create an evidence bundle")
    evidence_create.add_argument("--bundle", required=True)
    evidence_create.add_argument("--decision", choices=("PASS", "WARN", "BLOCK"), required=True)
    evidence_create.add_argument("--artifact", action="append", required=True, metavar="NAME=PATH")
    evidence_create.add_argument("--limitation", action="append", required=True)
    evidence_create.add_argument("--created-at")
    evidence_create.add_argument("--metadata-json", default="{}")
    evidence_verify = evidence_commands.add_parser("verify", help="Verify an evidence bundle")
    evidence_verify.add_argument("--bundle", required=True)
    gate_v2 = commands.add_parser("gate-v2", help="Apply slice-aware release policy v2")
    gate_v2.add_argument("--scenario", required=True)
    gate_v2.add_argument("--baseline", required=True)
    gate_v2.add_argument("--candidate", required=True)
    gate_v2.add_argument("--policy", required=True)
    gate_v2.add_argument("--now")
    gate_v2.add_argument("--output")
    calibrate = commands.add_parser("calibrate", help="Calibrate an evaluator against human labels")
    calibrate.add_argument("--input", required=True)
    calibrate.add_argument("--output")
    trace_parser = commands.add_parser("trace", help="Convert and evaluate agent trace graphs")
    trace_commands = trace_parser.add_subparsers(dest="trace_command", required=True)
    trace_evaluate = trace_commands.add_parser("evaluate", help="Evaluate a trace graph")
    trace_evaluate.add_argument("--trace", required=True)
    trace_evaluate.add_argument("--expectation", required=True)
    trace_evaluate.add_argument("--output")
    trace_convert = trace_commands.add_parser("convert-otel", help="Convert OpenTelemetry JSON")
    trace_convert.add_argument("--input", required=True)
    trace_convert.add_argument("--output", required=True)
    dataset_parser = commands.add_parser("dataset", help="Manage benchmark dataset manifests")
    dataset_commands = dataset_parser.add_subparsers(dest="dataset_command", required=True)
    dataset_create = dataset_commands.add_parser("create", help="Create a dataset manifest")
    dataset_create.add_argument("--scenario", required=True)
    dataset_create.add_argument("--dataset-id", required=True)
    dataset_create.add_argument("--version", required=True)
    dataset_create.add_argument(
        "--source-classification", choices=("synthetic", "public", "production-derived"), required=True
    )
    dataset_create.add_argument("--owner", action="append", required=True)
    dataset_create.add_argument("--split", action="append", required=True, metavar="NAME=ID,ID")
    dataset_create.add_argument("--reviewed", action="store_true")
    dataset_create.add_argument("--output", required=True)
    dataset_validate = dataset_commands.add_parser("validate", help="Validate a dataset manifest")
    dataset_validate.add_argument("--manifest", required=True)
    dataset_validate.add_argument("--minimum-slice", action="append", default=[], metavar="SELECTOR=COUNT")
    dataset_diff = dataset_commands.add_parser("diff", help="Diff dataset manifests")
    dataset_diff.add_argument("--before", required=True)
    dataset_diff.add_argument("--after", required=True)
    explain_parser = commands.add_parser("explain", help="Explain failed release gates")
    explain_parser.add_argument("--input", required=True)
    explain_parser.add_argument("--output")
    ci_render = commands.add_parser("ci-render", help="Render release decisions for CI systems")
    ci_render.add_argument("--input", required=True)
    ci_render.add_argument("--format", choices=("junit", "sarif", "github"), required=True)
    ci_render.add_argument("--output", required=True)
    adapter_parser = commands.add_parser("adapter", help="Discover and run portable import adapters")
    adapter_commands = adapter_parser.add_subparsers(dest="adapter_command", required=True)
    adapter_commands.add_parser("list", help="List built-in and installed adapters")
    adapter_convert = adapter_commands.add_parser("convert", help="Convert vendor JSON to a portable envelope")
    adapter_convert.add_argument("--profile", required=True)
    adapter_convert.add_argument("--input", required=True)
    adapter_convert.add_argument("--case-id", action="append", default=[])
    adapter_convert.add_argument("--output", required=True)
    governance = commands.add_parser("governance", help="Manage governed artifacts and blind reviews")
    governance_commands = governance.add_subparsers(dest="governance_command", required=True)
    governance_register = governance_commands.add_parser("register")
    governance_register.add_argument("--store", required=True)
    governance_register.add_argument("--artifact-id", required=True)
    governance_register.add_argument("--kind", required=True)
    governance_register.add_argument("--digest", required=True)
    governance_register.add_argument("--metadata", required=True)
    governance_register.add_argument("--blinded-metadata")
    governance_register.add_argument("--actor", required=True)
    governance_transition = governance_commands.add_parser("transition")
    governance_transition.add_argument("--store", required=True)
    governance_transition.add_argument("--artifact-id", required=True)
    governance_transition.add_argument("--state", choices=("reviewed", "accepted", "superseded"), required=True)
    governance_transition.add_argument("--actor", required=True)
    governance_review = governance_commands.add_parser("review")
    governance_review.add_argument("--store", required=True)
    governance_review.add_argument("--artifact-id", required=True)
    governance_review.add_argument("--reviewer", required=True)
    governance_review.add_argument("--verdict", choices=("approve", "block"), required=True)
    governance_review.add_argument("--note", default="")
    governance_queue = governance_commands.add_parser("queue")
    governance_queue.add_argument("--store", required=True)
    governance_queue.add_argument("--reviewer", required=True)
    governance_audit = governance_commands.add_parser("audit")
    governance_audit.add_argument("--store", required=True)
    governance_audit.add_argument("--artifact-id")
    serve = commands.add_parser("serve", help="Run the optional local API and workbench")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")
    demo_parser = commands.add_parser("demo", help="Generate a credential-free release-gate demo")
    demo_parser.add_argument("--output", default="ragops-demo")
    demo_parser.add_argument(
        "--scenario",
        choices=tuple(sorted(DEMO_BUNDLES)),
        default=DEFAULT_DEMO_SCENARIO,
        help="Credential-free workflow scenario to generate",
    )
    demo_parser.add_argument(
        "--profile", choices=("executive", "engineer", "auditor"), default="engineer"
    )
    demo_parser.add_argument(
        "--force",
        action="store_true",
        help="Replace regular demo files in an existing non-symlink directory",
    )
    evaluate_parser = commands.add_parser("evaluate", help="Evaluate recorded responses")
    evaluate_parser.add_argument("--scenario", required=True)
    evaluate_input = evaluate_parser.add_mutually_exclusive_group(required=True)
    evaluate_input.add_argument("--responses")
    evaluate_input.add_argument("--traces", help="Portable JSONL trace input")
    evaluate_parser.add_argument("--output")
    evaluate_parser.add_argument("--format", choices=("json", "markdown"), default="json")
    evaluate_parser.add_argument("--store")
    evaluate_parser.add_argument("--label", default="")
    evaluate_parser.add_argument("--evaluation-policy", help="TOML evaluator gate policy")
    evaluate_parser.add_argument(
        "--external-metrics",
        help="Portable per-case metric envelope from Ragas, DeepEval, Langfuse, or custom",
    )
    evaluate_parser.add_argument(
        "--evaluator",
        action="append",
        choices=(
            "retrieval_recall",
            "citation_correctness",
            "claim_support",
            "answer_length_budget",
            "source_freshness",
            "abstention_contract",
        ),
        default=[],
    )
    evaluate_parser.add_argument(
        "--answer-length-limit",
        type=int,
        default=500,
        help="Unicode code-point limit for answer_length_budget (default: 500)",
    )
    compare_parser = commands.add_parser("compare", help="Compare candidate responses to baseline")
    compare_parser.add_argument("--scenario", required=True)
    baseline_input = compare_parser.add_mutually_exclusive_group(required=True)
    baseline_input.add_argument("--baseline")
    baseline_input.add_argument("--baseline-traces")
    candidate_input = compare_parser.add_mutually_exclusive_group(required=True)
    candidate_input.add_argument("--candidate")
    candidate_input.add_argument("--candidate-traces")
    compare_parser.add_argument("--output")
    compare_parser.add_argument("--format", choices=("json", "markdown", "html"), default="markdown")
    compare_parser.add_argument("--store")
    compare_parser.add_argument("--label", default="")
    compare_parser.add_argument("--policy", help="TOML regression policy")
    compare_parser.add_argument("--evaluation-policy", help="TOML evaluator gate policy")
    compare_parser.add_argument(
        "--baseline-external-metrics",
        help="Portable baseline per-case external metric envelope",
    )
    compare_parser.add_argument(
        "--candidate-external-metrics",
        help="Portable candidate per-case external metric envelope",
    )
    compare_parser.add_argument(
        "--evaluator",
        action="append",
        choices=(
            "retrieval_recall",
            "citation_correctness",
            "claim_support",
            "answer_length_budget",
            "source_freshness",
            "abstention_contract",
        ),
        default=[],
    )
    compare_parser.add_argument(
        "--answer-length-limit",
        type=int,
        default=500,
        help="Unicode code-point limit for answer_length_budget (default: 500)",
    )
    compare_runs_parser = commands.add_parser(
        "compare-runs",
        help="Compare repeated metric observations with uncertainty-aware gates",
    )
    compare_runs_parser.add_argument("--baseline-bundle", required=True)
    compare_runs_parser.add_argument("--candidate-bundle", required=True)
    compare_runs_parser.add_argument("--policy", required=True)
    compare_runs_parser.add_argument("--output")
    compare_runs_parser.add_argument(
        "--format", choices=("json", "markdown"), default="markdown"
    )
    collect_runs_parser = commands.add_parser(
        "collect-runs",
        help="Collect a resumable replay bundle from an explicit metric command",
    )
    collect_runs_parser.add_argument("--plan", required=True)
    collect_runs_parser.add_argument("--output", required=True)
    collect_runs_parser.add_argument("--resume", action="store_true")
    collect_runs_parser.add_argument("--timeout-seconds", type=float, default=60.0)
    collect_runs_parser.add_argument("--baseline-bundle")
    collect_runs_parser.add_argument("--sequential-policy")
    collect_runs_parser.add_argument("--sequential-report")
    collect_runs_parser.add_argument(
        "--command",
        dest="runner_command",
        nargs=argparse.REMAINDER,
        required=True,
        help="Command to run; receives RAGOPS_CASE_ID and RAGOPS_REPEAT_ID",
    )
    drift_parser = commands.add_parser(
        "detect-evaluator-drift",
        help="Compare frozen anchors across evaluator versions",
    )
    drift_parser.add_argument("--reference-bundle", required=True)
    drift_parser.add_argument("--current-bundle", required=True)
    drift_parser.add_argument("--policy", required=True)
    drift_parser.add_argument("--output")
    drift_parser.add_argument("--format", choices=("json", "markdown"), default="markdown")
    sequential_parser = commands.add_parser(
        "compare-sequential",
        help="Apply predeclared sequential looks to repeated metric bundles",
    )
    sequential_parser.add_argument("--baseline-bundle", required=True)
    sequential_parser.add_argument("--candidate-bundle", required=True)
    sequential_parser.add_argument("--policy", required=True)
    sequential_parser.add_argument("--output")
    sequential_parser.add_argument(
        "--format", choices=("json", "markdown"), default="markdown"
    )
    baseline_create = commands.add_parser(
        "baseline-create", help="Create a content-addressed accepted-baseline manifest"
    )
    baseline_create.add_argument("--bundle", required=True)
    baseline_create.add_argument("--policy", required=True)
    baseline_create.add_argument("--owner", required=True)
    baseline_create.add_argument("--accepted-at", required=True)
    baseline_create.add_argument("--output", required=True)
    baseline_sign = commands.add_parser(
        "baseline-sign", help="Sign a baseline manifest with an SSH key"
    )
    baseline_sign.add_argument("--manifest", required=True)
    baseline_sign.add_argument("--key", required=True)
    baseline_sign.add_argument("--output", required=True)
    baseline_verify = commands.add_parser(
        "baseline-verify", help="Verify baseline integrity and optional SSH signature"
    )
    baseline_verify.add_argument("--manifest", required=True)
    baseline_verify.add_argument("--bundle", required=True)
    baseline_verify.add_argument("--policy", required=True)
    baseline_verify.add_argument("--signature")
    baseline_verify.add_argument("--allowed-signers")
    baseline_verify.add_argument("--identity")
    provenance_parser = commands.add_parser(
        "diagnose-provenance",
        help="Classify model, evaluator, dataset, and infrastructure changes",
    )
    provenance_parser.add_argument("--reference-bundle", required=True)
    provenance_parser.add_argument("--current-bundle", required=True)
    history_parser = commands.add_parser("history", help="List saved experiment runs")
    history_parser.add_argument("--store", required=True)
    history_parser.add_argument("--limit", type=int, default=20)
    review_parser = commands.add_parser("review", help="Review a saved experiment run")
    review_parser.add_argument("--store", required=True)
    review_parser.add_argument("--run-id", required=True)
    review_parser.add_argument(
        "--status", required=True, choices=("accepted", "rejected", "needs_changes")
    )
    review_parser.add_argument("--reviewer", required=True)
    review_parser.add_argument("--note", default="")
    trend_parser = commands.add_parser("trend", help="Read a saved metric trend")
    trend_parser.add_argument("--store", required=True)
    trend_parser.add_argument("--scenario-id", required=True)
    trend_parser.add_argument("--metric", required=True)
    trend_parser.add_argument("--limit", type=int, default=50)
    inspect_parser = commands.add_parser("inspect", help="Inspect scenario benchmark coverage")
    inspect_parser.add_argument("--scenario", required=True)
    workspace_create = commands.add_parser("workspace-create", help="Create an alpha workspace")
    workspace_create.add_argument("--root", required=True)
    workspace_create.add_argument("--workspace-id", required=True)
    workspace_create.add_argument("--name", required=True)
    workspace_rotate = commands.add_parser("workspace-rotate-key", help="Rotate a workspace key")
    workspace_rotate.add_argument("--root", required=True)
    workspace_rotate.add_argument("--workspace-id", required=True)
    workspace_rotate.add_argument("--current-key", required=True)
    workspace_audit = commands.add_parser("workspace-audit", help="Read workspace audit events")
    workspace_audit.add_argument("--root", required=True)
    workspace_audit.add_argument("--workspace-id", required=True)
    workspace_audit.add_argument("--limit", type=int, default=100)
    pilot_parser = commands.add_parser(
        "pilot-report", help="Summarize design-partner adoption and ROI evidence"
    )
    pilot_parser.add_argument("--manifest", required=True)
    pilot_parser.add_argument("--observations", required=True)
    pilot_parser.add_argument("--economics")
    pilot_parser.add_argument("--output")
    pilot_parser.add_argument("--format", choices=("json", "markdown"), default="markdown")
    usage_parser = commands.add_parser(
        "usage-report", help="Summarize explicitly enabled local CLI usage events"
    )
    usage_parser.add_argument("--events", required=True)
    usage_parser.add_argument("--output")
    usage_parser.add_argument("--format", choices=("json",), default="json")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "contract":
        try:
            if args.contract_command == "diff":
                payload = diff_contract(args.kind, args.from_version, args.to_version).to_dict()
            else:
                source = Path(args.input)
                data = json.loads(source.read_text(encoding="utf-8"))
                if args.contract_command == "validate":
                    payload = validate_contract(data, args.kind).to_dict()
                else:
                    output = Path(args.output)
                    if source.resolve() == output.resolve():
                        raise SystemExit("contract input and output must differ")
                    migrated = migrate_contract(
                        data,
                        args.kind,
                        args.from_version,
                        args.to_version,
                        question=args.question,
                    )
                    output.parent.mkdir(parents=True, exist_ok=True)
                    output.write_text(
                        json.dumps(migrated, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8",
                    )
                    payload = {
                        "kind": args.kind,
                        "from_version": args.from_version,
                        "to_version": args.to_version,
                        "output": str(output),
                    }
        except (ContractError, OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"contract error: {exc}") from exc
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "evidence":
        try:
            if args.evidence_command == "verify":
                manifest = verify_evidence_bundle(args.bundle)
                payload = {"verified": True, **manifest.to_dict()}
            else:
                artifact_paths = {}
                for value in args.artifact:
                    if "=" not in value:
                        raise ContractError("Evidence artifacts must use NAME=PATH")
                    name, raw_path = value.split("=", 1)
                    if name in artifact_paths:
                        raise ContractError(f"Duplicate evidence artifact name: {name}")
                    artifact_paths[name] = raw_path
                created_at = args.created_at or datetime.now(UTC).isoformat().replace("+00:00", "Z")
                metadata = json.loads(args.metadata_json)
                manifest = create_evidence_bundle(
                    args.bundle,
                    artifact_paths,
                    args.decision,
                    tuple(args.limitation),
                    created_at,
                    metadata,
                )
                payload = manifest.to_dict()
        except (ContractError, FileExistsError, OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"evidence error: {exc}") from exc
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "gate-v2":
        try:
            scenario = load_scenario(args.scenario)
            report = apply_release_policy(
                load_release_policy_v2(args.policy),
                evaluate(scenario, load_responses(args.baseline)),
                evaluate(scenario, load_responses(args.candidate)),
                scenario,
                now=args.now or datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            )
        except (ContractError, OSError, ValueError) as exc:
            raise SystemExit(f"release policy error: {exc}") from exc
        rendered = json.dumps(report.to_dict(), ensure_ascii=False, indent=2) + "\n"
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(rendered, encoding="utf-8")
        else:
            print(rendered, end="")
        return 2 if report.decision == "BLOCK" else 0
    if args.command == "calibrate":
        try:
            calibration_set = load_calibration_set(args.input)
            report = calibrate_evaluator(
                calibration_set.evaluator,
                calibration_set.records,
                calibration_set.policy,
            )
        except (ContractError, OSError, ValueError) as exc:
            raise SystemExit(f"calibration error: {exc}") from exc
        rendered = json.dumps(report.to_dict(), ensure_ascii=False, indent=2) + "\n"
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(rendered, encoding="utf-8")
        print(rendered, end="")
        return 0 if report.decision == "PASS" else 2
    if args.command == "trace":
        try:
            if args.trace_command == "convert-otel":
                raw_spans = json.loads(Path(args.input).read_text(encoding="utf-8"))
                graph = otel_spans_to_trace_graph(raw_spans)
                output = Path(args.output)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(
                    json.dumps(graph.to_dict(), ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                payload = {"converted": True, "trace_id": graph.trace_id, "output": str(output)}
                exit_code = 0
            else:
                report = evaluate_trace_graph(
                    load_trace_graph(args.trace), load_trace_expectation(args.expectation)
                )
                payload = report.to_dict()
                rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
                if args.output:
                    output = Path(args.output)
                    output.parent.mkdir(parents=True, exist_ok=True)
                    output.write_text(rendered, encoding="utf-8")
                exit_code = 0 if report.decision == "PASS" else 2
        except (ContractError, OSError, json.JSONDecodeError, ValueError) as exc:
            raise SystemExit(f"trace error: {exc}") from exc
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return exit_code
    if args.command == "dataset":
        try:
            if args.dataset_command == "create":
                scenario = load_scenario(args.scenario)
                splits = _named_csv_values(args.split, "dataset split")
                cases = tuple(
                    {
                        "id": item.id,
                        "question": item.question,
                        "evidence": list(item.evidence),
                        "required_citation_ids": list(item.required_citation_ids),
                        "category": item.category,
                        "severity": item.severity,
                        "language": item.language,
                        "tags": list(item.tags),
                        "source": f"scenario:{scenario.id}",
                        "reviewed": args.reviewed,
                    }
                    for item in scenario.cases
                )
                manifest = create_dataset_manifest(
                    args.dataset_id,
                    args.version,
                    cases,
                    splits=splits,
                    source_classification=args.source_classification,
                    owners=tuple(args.owner),
                )
                write_dataset_manifest(args.output, manifest)
                payload = manifest.to_dict()
                exit_code = 0
            elif args.dataset_command == "validate":
                minimum_slices = _named_int_values(args.minimum_slice, "dataset minimum slice")
                manifest = load_dataset_manifest(args.manifest)
                issues = validate_dataset_manifest(manifest, minimum_slice_counts=minimum_slices)
                payload = {"valid": not issues, "issues": [item.to_dict() for item in issues]}
                exit_code = 0 if not issues else 2
            else:
                difference = diff_dataset_manifests(
                    load_dataset_manifest(args.before), load_dataset_manifest(args.after)
                )
                payload = difference.to_dict()
                exit_code = 0
        except (ContractError, OSError, ValueError) as exc:
            raise SystemExit(f"dataset error: {exc}") from exc
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return exit_code
    if args.command in {"explain", "ci-render"}:
        try:
            decision = load_release_decision(args.input)
            if args.command == "explain":
                rendered = json.dumps(explain_decision(decision).to_dict(), ensure_ascii=False, indent=2) + "\n"
            else:
                rendered = render_ci(decision, args.format)
            if args.output:
                output = Path(args.output)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(rendered, encoding="utf-8")
            else:
                print(rendered, end="")
        except (ContractError, OSError, ValueError) as exc:
            raise SystemExit(f"release explanation error: {exc}") from exc
        return 0
    if args.command == "adapter":
        try:
            if args.adapter_command == "list":
                payload = {"adapters": [item.to_dict() for item in discover_adapters()]}
            else:
                raw = json.loads(Path(args.input).read_text(encoding="utf-8"))
                converted = convert_import(
                    args.profile, raw, AdapterContext(case_ids=tuple(args.case_id))
                )
                payload = converted.to_dict()
                output = Path(args.output)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )
        except (ContractError, OSError, json.JSONDecodeError, ValueError) as exc:
            raise SystemExit(f"adapter error: {exc}") from exc
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "governance":
        try:
            governance_store = GovernanceStore(args.store)
            if args.governance_command == "register":
                public = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
                blinded = (
                    json.loads(Path(args.blinded_metadata).read_text(encoding="utf-8"))
                    if args.blinded_metadata else {}
                )
                governance_store.register_artifact(
                    args.artifact_id, kind=args.kind, digest=args.digest,
                    public_metadata=public, blinded_metadata=blinded, actor=args.actor,
                )
                payload = governance_store.get_artifact(args.artifact_id)
            elif args.governance_command == "transition":
                governance_store.transition(args.artifact_id, args.state, actor=args.actor)
                payload = governance_store.get_artifact(args.artifact_id)
            elif args.governance_command == "review":
                governance_store.record_review(
                    args.artifact_id, reviewer=args.reviewer, verdict=args.verdict, note=args.note
                )
                payload = {"recorded": True}
            elif args.governance_command == "queue":
                payload = {"artifacts": governance_store.review_queue(args.reviewer)}
            else:
                payload = {"events": governance_store.audit_events(args.artifact_id)}
        except (KeyError, ValueError, OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"governance error: {exc}") from exc
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "serve":
        if not 1 <= args.port <= 65535:
            raise SystemExit("serve error: port must be between 1 and 65535")
        try:
            import uvicorn
        except ImportError as exc:
            raise SystemExit("serve requires the API extra: pip install 'ragops[api]'") from exc
        uvicorn.run("ragops.api.main:app", host=args.host, port=args.port, reload=args.reload)
        return 0
    if args.command == "demo":
        try:
            summary = write_demo(
                args.output, force=args.force, scenario_id=args.scenario, profile=args.profile
            )
        except (OSError, ValueError) as exc:
            raise SystemExit(f"demo output error: {exc}") from exc
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    if args.command == "inspect":
        try:
            summary = scenario_summary(load_scenario(args.scenario))
        except ContractError as exc:
            raise SystemExit(f"contract error: {exc}") from exc
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    if args.command == "workspace-create":
        try:
            key = ControlPlane(args.root).create_workspace(args.workspace_id, args.name)
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        print(json.dumps({"workspace_id": args.workspace_id, "api_key": key}))
        return 0
    if args.command == "workspace-rotate-key":
        try:
            key = ControlPlane(args.root).rotate_key(args.workspace_id, args.current_key)
        except (PermissionError, ValueError) as exc:
            raise SystemExit(str(exc)) from exc
        print(json.dumps({"workspace_id": args.workspace_id, "api_key": key}))
        return 0
    if args.command == "workspace-audit":
        events = ControlPlane(args.root).audit_events(args.workspace_id, limit=args.limit)
        print(json.dumps(events, ensure_ascii=False, indent=2))
        return 0
    if args.command == "pilot-report":
        try:
            report = summarize_pilot(
                load_pilot_manifest(args.manifest),
                load_pilot_observations(args.observations),
                load_pilot_economics(args.economics) if args.economics else None,
            )
        except PilotContractError as exc:
            raise SystemExit(f"pilot contract error: {exc}") from exc
        rendered = (
            json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
            if args.format == "json"
            else pilot_markdown(report)
        )
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered.rstrip() + "\n", encoding="utf-8")
        else:
            print(rendered.rstrip())
        return 0
    if args.command == "usage-report":
        try:
            report = summarize_local_usage(args.events)
        except UsageContractError as exc:
            raise SystemExit(f"usage contract error: {exc}") from exc
        rendered = json.dumps(report, ensure_ascii=False, indent=2)
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered + "\n", encoding="utf-8")
        else:
            print(rendered)
        return 0
    if args.command == "compare-runs":
        try:
            report = compare_replay_bundles(
                load_replay_bundle(args.baseline_bundle),
                load_replay_bundle(args.candidate_bundle),
                load_statistical_policy(args.policy),
            )
        except (ContractError, ValueError) as exc:
            raise SystemExit(f"contract error: {exc}") from exc
        rendered = (
            json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
            if args.format == "json"
            else statistical_comparison_markdown(report)
        )
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered.rstrip() + "\n", encoding="utf-8")
        else:
            print(rendered.rstrip())
        return 0 if report.passed else 2
    if args.command == "collect-runs":
        command = tuple(
            args.runner_command[1:]
            if args.runner_command[:1] == ["--"]
            else args.runner_command
        )
        try:
            plan = load_repeated_run_plan(args.plan)
            existing = load_resume_bundle(args.output, resume=args.resume)
            if bool(args.baseline_bundle) != bool(args.sequential_policy):
                raise ContractError(
                    "Sequential collection requires both --baseline-bundle and "
                    "--sequential-policy"
                )
            sequential_reports = []
            stop_when = None
            if args.baseline_bundle:
                sequential_baseline = load_replay_bundle(args.baseline_bundle)
                sequential_policy = load_sequential_policy(args.sequential_policy)
                if plan.repeats != sequential_policy.maximum_repeats:
                    raise ContractError(
                        "Repeated-run plan repeats must equal sequential maximum_repeats"
                    )

                def stop_when(current):
                    if {record.case_id for record in current.records} != set(plan.case_ids):
                        return False
                    decision = compare_replay_bundles_sequentially(
                        sequential_baseline,
                        current,
                        sequential_policy,
                    )
                    sequential_reports[:] = [decision]
                    return decision.decision in {"pass", "block"}

            bundle = collect_repeated_runs(
                plan,
                CommandMetricAdapter(command, timeout_seconds=args.timeout_seconds),
                existing=existing,
                checkpoint=lambda current: write_replay_bundle(args.output, current),
                stop_when=stop_when,
            )
            write_replay_bundle(args.output, bundle)
            if sequential_reports:
                report_path = Path(
                    args.sequential_report or f"{args.output}.sequential.json"
                )
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(
                    json.dumps(
                        sequential_reports[-1].to_dict(), ensure_ascii=False, indent=2
                    )
                    + "\n",
                    encoding="utf-8",
                )
        except (ContractError, ValueError) as exc:
            raise SystemExit(f"collection error: {exc}") from exc
        print(
            json.dumps(
                {
                    "output": str(args.output),
                    "cases": len(plan.case_ids),
                    "repeats": plan.repeats,
                    "observations": len(bundle.records),
                    "sequential_decision": (
                        sequential_reports[-1].decision if sequential_reports else None
                    ),
                },
                ensure_ascii=False,
            )
        )
        return (
            2
            if sequential_reports and sequential_reports[-1].decision != "pass"
            else 0
        )
    if args.command == "detect-evaluator-drift":
        try:
            report = detect_evaluator_drift(
                load_replay_bundle(args.reference_bundle),
                load_replay_bundle(args.current_bundle),
                load_evaluator_drift_policy(args.policy),
            )
        except (ContractError, ValueError) as exc:
            raise SystemExit(f"drift contract error: {exc}") from exc
        rendered = (
            json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
            if args.format == "json"
            else evaluator_drift_markdown(report)
        )
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered.rstrip() + "\n", encoding="utf-8")
        else:
            print(rendered.rstrip())
        return 0 if report.passed else 2
    if args.command == "compare-sequential":
        try:
            report = compare_replay_bundles_sequentially(
                load_replay_bundle(args.baseline_bundle),
                load_replay_bundle(args.candidate_bundle),
                load_sequential_policy(args.policy),
            )
        except (ContractError, ValueError) as exc:
            raise SystemExit(f"sequential contract error: {exc}") from exc
        rendered = (
            json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
            if args.format == "json"
            else sequential_comparison_markdown(report)
        )
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered.rstrip() + "\n", encoding="utf-8")
        else:
            print(rendered.rstrip())
        return 0 if report.passed else 2
    if args.command == "baseline-create":
        try:
            manifest = create_baseline_manifest(
                args.bundle,
                args.policy,
                owner=args.owner,
                accepted_at=args.accepted_at,
            )
            write_baseline_manifest(args.output, manifest)
        except ContractError as exc:
            raise SystemExit(f"baseline contract error: {exc}") from exc
        print(json.dumps({"manifest": str(args.output), "verified": True}))
        return 0
    if args.command == "baseline-sign":
        try:
            load_baseline_manifest(args.manifest)
            sign_baseline_manifest(args.manifest, args.key, args.output)
        except ContractError as exc:
            raise SystemExit(f"baseline signing error: {exc}") from exc
        print(json.dumps({"signature": str(args.output)}))
        return 0
    if args.command == "baseline-verify":
        signature_options = (args.signature, args.allowed_signers, args.identity)
        if any(signature_options) and not all(signature_options):
            raise SystemExit(
                "baseline contract error: signature verification requires --signature, "
                "--allowed-signers, and --identity"
            )
        try:
            manifest = load_baseline_manifest(args.manifest)
            verify_baseline_manifest(manifest, args.bundle, args.policy)
            if args.signature:
                verify_baseline_signature(
                    args.manifest,
                    args.signature,
                    args.allowed_signers,
                    args.identity,
                )
        except ContractError as exc:
            raise SystemExit(f"baseline verification error: {exc}") from exc
        print(
            json.dumps(
                {
                    "verified": True,
                    "signature_verified": bool(args.signature),
                    "owner": manifest.acceptance.owner,
                }
            )
        )
        return 0
    if args.command == "diagnose-provenance":
        try:
            diagnosis = diagnose_provenance(
                load_replay_bundle(args.reference_bundle),
                load_replay_bundle(args.current_bundle),
            )
        except ContractError as exc:
            raise SystemExit(f"provenance contract error: {exc}") from exc
        print(json.dumps(diagnosis.to_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.command == "history":
        runs = ExperimentStore(args.store).list_runs(limit=args.limit)
        print(json.dumps(runs, ensure_ascii=False, indent=2))
        return 0
    if args.command == "review":
        try:
            ExperimentStore(args.store).review(
                args.run_id,
                status=args.status,
                reviewer=args.reviewer,
                note=args.note,
            )
        except (KeyError, ValueError) as exc:
            raise SystemExit(str(exc)) from exc
        print(json.dumps({"run_id": args.run_id, "review_status": args.status}))
        return 0
    if args.command == "trend":
        points = ExperimentStore(args.store).metric_trend(
            args.scenario_id,
            args.metric,
            limit=args.limit,
        )
        print(json.dumps(points, ensure_ascii=False, indent=2))
        return 0
    try:
        scenario = load_scenario(args.scenario)
        if args.command == "evaluate":
            evaluators = _evaluators_from_names(
                args.evaluator,
                answer_length_limit=args.answer_length_limit,
            )
            if args.external_metrics:
                evaluators += (load_external_metric_evaluator(args.external_metrics, scenario),)
            report = evaluate(
                scenario,
                load_trace_jsonl(args.traces) if args.traces else load_responses(args.responses),
                evaluators=evaluators,
                policy=(
                    load_evaluation_policy(args.evaluation_policy)
                    if args.evaluation_policy
                    else None
                ),
            )
        else:
            if bool(args.baseline_external_metrics) != bool(args.candidate_external_metrics):
                raise ContractError(
                    "Compare needs both --baseline-external-metrics and "
                    "--candidate-external-metrics"
                )
            evaluators = _evaluators_from_names(
                args.evaluator,
                answer_length_limit=args.answer_length_limit,
            )
            if args.baseline_external_metrics:
                baseline_external = load_external_metric_evaluator(
                    args.baseline_external_metrics, scenario
                )
                candidate_external = load_external_metric_evaluator(
                    args.candidate_external_metrics, scenario
                )
                validate_external_metric_pair(baseline_external, candidate_external)
            report = compare(
                scenario,
                (
                    load_trace_jsonl(args.baseline_traces)
                    if args.baseline_traces
                    else load_responses(args.baseline)
                ),
                (
                    load_trace_jsonl(args.candidate_traces)
                    if args.candidate_traces
                    else load_responses(args.candidate)
                ),
                policy=load_regression_policy(args.policy) if args.policy else None,
                evaluators=evaluators,
                baseline_evaluators=(
                    evaluators + (baseline_external,)
                    if args.baseline_external_metrics
                    else None
                ),
                candidate_evaluators=(
                    evaluators + (candidate_external,)
                    if args.candidate_external_metrics
                    else None
                ),
                evaluation_policy=(
                    load_evaluation_policy(args.evaluation_policy)
                    if args.evaluation_policy
                    else None
                ),
            )
    except (ContractError, ValueError) as exc:
        raise SystemExit(f"contract error: {exc}") from exc
    if args.format == "json":
        rendered = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
    elif args.command == "evaluate":
        rendered = evaluation_markdown(report)
    elif args.format == "html":
        rendered = comparison_html(report)
    else:
        rendered = comparison_markdown(report)
    if args.store:
        ExperimentStore(args.store).save(report, label=args.label)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered.rstrip() + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if report.passed else 2


def _named_csv_values(values: list[str], label: str) -> dict[str, tuple[str, ...]]:
    result = {}
    for value in values:
        if "=" not in value:
            raise ContractError(f"{label} must use NAME=VALUE,VALUE")
        name, raw_items = value.split("=", 1)
        items = tuple(item for item in raw_items.split(",") if item)
        if not name or not items or name in result:
            raise ContractError(f"{label} names must be non-empty and unique")
        result[name] = items
    return result


def _named_int_values(values: list[str], label: str) -> dict[str, int]:
    result = {}
    for value in values:
        if "=" not in value:
            raise ContractError(f"{label} must use SELECTOR=COUNT")
        selector, raw_count = value.rsplit("=", 1)
        try:
            count = int(raw_count)
        except ValueError as exc:
            raise ContractError(f"{label} count must be an integer") from exc
        if not selector or selector in result or count <= 0:
            raise ContractError(f"{label} selectors must be non-empty, unique, and positive")
        result[selector] = count
    return result


def _evaluators_from_names(
    names: list[str],
    *,
    answer_length_limit: int = 500,
) -> tuple[CaseEvaluator, ...]:
    factories = {
        "retrieval_recall": RetrievalRecallEvaluator,
        "citation_correctness": CitationCorrectnessEvaluator,
        "claim_support": ClaimSupportEvaluator,
        "answer_length_budget": lambda: AnswerLengthBudgetEvaluator(
            max_characters=answer_length_limit
        ),
        "source_freshness": SourceFreshnessEvaluator,
        "abstention_contract": AbstentionContractEvaluator,
    }
    return tuple(factories[name]() for name in names)


def _usage_command(arguments: list[str]) -> str:
    if not arguments or arguments[0] in {"-h", "--help"}:
        return "help"
    if arguments[0] == "--version":
        return "version"
    candidate = arguments[0]
    for action in build_parser()._actions:
        if isinstance(action, argparse._SubParsersAction):
            return candidate if candidate in action.choices else "unknown"
    return "unknown"


def cli_entrypoint() -> int:
    exit_code = 1
    try:
        exit_code = main()
        return exit_code
    except SystemExit as exc:
        if isinstance(exc.code, int) and not isinstance(exc.code, bool):
            exit_code = exc.code
        elif exc.code is None:
            exit_code = 0
        raise
    finally:
        usage_log = os.environ.get("RAGOPS_USAGE_LOG")
        if usage_log:
            try:
                record_local_usage(
                    usage_log,
                    ragops_version=__version__,
                    command=_usage_command(sys.argv[1:]),
                    exit_code=exit_code if 0 <= exit_code <= 255 else 1,
                )
            except (OSError, UsageContractError) as exc:
                print(f"usage log warning: {exc}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(cli_entrypoint())
