#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from _common import load_json, normalize_text, stable_id, write_json_output
from reconcile_agents import MUTATING_ACTIONS, coverage_errors, ensure_decision_ids, evidence_ref_scopes, path_key


VALID_GLOBAL_STATUSES = {"candidate", "project-only", "already-global"}
VALID_OUTCOMES = {"promote", "keep", "reject", "already-global"}


class GlobalAggregationError(ValueError):
    pass


def candidate_key(instruction: str, semantic_scope: str) -> str:
    return stable_id(normalize_text(instruction), normalize_text(semantic_scope), prefix="G-")


def _pending_candidates(state: dict[str, Any]) -> list[dict[str, Any]]:
    value = state.get("pending_global_candidates", {})
    items = value.values() if isinstance(value, dict) else value if isinstance(value, list) else []
    result: list[dict[str, Any]] = []
    for raw in items:
        if not isinstance(raw, dict):
            raise GlobalAggregationError("pending global candidate must be an object")
        candidate = dict(raw)
        identifier = str(candidate.get("candidate_id") or "").strip()
        instruction = str(candidate.get("instruction") or "").strip()
        scope = str(candidate.get("semantic_scope") or "").strip()
        sources = candidate.get("sources")
        if not identifier or identifier != candidate_key(instruction, scope) or not isinstance(sources, list) or not sources:
            raise GlobalAggregationError(f"invalid pending global candidate: {identifier or '<missing>'}")
        candidate["sources"] = [{**source, "current": False} for source in sources if isinstance(source, dict)]
        result.append(candidate)
    return result


def prepare_bundle(decisions_value: Any, batch: dict[str, Any], state: dict[str, Any] | None = None) -> dict[str, Any]:
    raw_decisions = decisions_value.get("decisions") if isinstance(decisions_value, dict) else decisions_value
    if not isinstance(raw_decisions, list):
        raise GlobalAggregationError("project decisions must be an array or an object containing decisions")
    decisions = ensure_decision_ids(raw_decisions)
    ref_scopes = evidence_ref_scopes(batch)
    errors = coverage_errors(decisions, batch, ref_scopes)
    if errors:
        raise GlobalAggregationError("project review is incomplete: " + "; ".join(item["error"] for item in errors))

    candidates = {item["candidate_id"]: item for item in _pending_candidates(state or {})}
    for decision in decisions:
        identifier = str(decision["decision_id"])
        refs = [str(value) for value in decision.get("evidence_refs", [])]
        if decision.get("target") == "project" and str(decision.get("project_root") or "").strip():
            project_root: str | None = str(Path(str(decision["project_root"])).expanduser().resolve())
            target_scope = path_key(Path(project_root))
            if any(not ref_scopes.get(ref) or target_scope not in ref_scopes[ref] for ref in refs):
                raise GlobalAggregationError(f"project review decision {identifier} uses evidence from another project")
        elif decision.get("target") == "global" and decision.get("project_root") is None:
            project_root = None
            if any(ref not in ref_scopes or ref_scopes[ref] for ref in refs):
                raise GlobalAggregationError(f"global-context decision {identifier} requires unscoped evidence")
        else:
            raise GlobalAggregationError(f"review decision {identifier} has an invalid target scope")
        disposition = decision.get("global_disposition")
        if not isinstance(disposition, dict) or disposition.get("status") not in VALID_GLOBAL_STATUSES:
            raise GlobalAggregationError(f"project review decision {identifier} requires a valid global_disposition")
        status = str(disposition["status"])
        if status != "candidate":
            if project_root is None and decision.get("action") in MUTATING_ACTIONS:
                raise GlobalAggregationError(
                    f"mutating global-context decision {identifier} must enter global aggregation as a candidate"
                )
            if not str(disposition.get("reason") or "").strip():
                raise GlobalAggregationError(f"global disposition for {identifier} requires a reason")
            continue
        instruction = str(disposition.get("instruction") or "").strip()
        semantic_scope = str(disposition.get("semantic_scope") or "").strip()
        reason = str(disposition.get("reason") or "").strip()
        explicit = disposition.get("explicit_global_intent")
        if not instruction or not semantic_scope or not reason or not isinstance(explicit, bool):
            raise GlobalAggregationError(
                f"global candidate for {identifier} requires instruction, semantic_scope, reason, and explicit_global_intent"
            )
        if project_root is None and explicit is not True:
            raise GlobalAggregationError(f"global-context candidate for {identifier} requires explicit_global_intent")
        candidate_id = candidate_key(instruction, semantic_scope)
        candidate = candidates.setdefault(
            candidate_id,
            {
                "candidate_id": candidate_id,
                "instruction": instruction,
                "semantic_scope": semantic_scope,
                "reason": reason,
                "explicit_global_intent": explicit,
                "sources": [],
            },
        )
        candidate["explicit_global_intent"] = bool(candidate.get("explicit_global_intent")) or explicit
        source = {
            "decision_id": identifier,
            "project_root": project_root,
            "evidence_refs": refs,
            "local_action": decision.get("action"),
            "current": True,
        }
        existing_source_keys = {
            (
                str(item.get("decision_id")),
                path_key(Path(str(item.get("project_root")))) if item.get("project_root") else "",
            )
            for item in candidate["sources"]
            if isinstance(item, dict)
        }
        source_scope = path_key(Path(project_root)) if project_root else ""
        if (identifier, source_scope) not in existing_source_keys:
            candidate["sources"].append(source)

    return {
        "version": 1,
        "project_decisions": decisions,
        "global_candidates": sorted(candidates.values(), key=lambda item: item["candidate_id"]),
    }


def _source_projects(candidates: list[dict[str, Any]]) -> set[str]:
    return {
        path_key(Path(str(source["project_root"])))
        for candidate in candidates
        for source in candidate.get("sources", [])
        if isinstance(source, dict) and source.get("project_root")
    }


def finalize_bundle(bundle: dict[str, Any], global_review: dict[str, Any]) -> dict[str, Any]:
    project_decisions = bundle.get("project_decisions")
    candidates_value = bundle.get("global_candidates")
    groups = global_review.get("groups") if isinstance(global_review, dict) else None
    if not isinstance(project_decisions, list) or not isinstance(candidates_value, list) or not isinstance(groups, list):
        raise GlobalAggregationError("bundle and global review have invalid structure")
    candidates = {str(item.get("candidate_id")): item for item in candidates_value if isinstance(item, dict)}
    if len(candidates) != len(candidates_value) or not all(candidates):
        raise GlobalAggregationError("bundle has a missing or duplicate candidate_id")

    seen: set[str] = set()
    promoted: list[dict[str, Any]] = []
    pending: dict[str, dict[str, Any]] = {}
    suppressed_source_decisions = {
        str(source.get("decision_id"))
        for candidate in candidates.values()
        for source in candidate.get("sources", [])
        if isinstance(source, dict) and source.get("current") is True and source.get("project_root") is None
    }
    for group in groups:
        if not isinstance(group, dict) or group.get("outcome") not in VALID_OUTCOMES:
            raise GlobalAggregationError("each global review group requires a valid outcome")
        ids = [str(value) for value in group.get("candidate_ids", [])]
        if not ids or len(ids) != len(set(ids)):
            raise GlobalAggregationError("each global review group requires unique candidate_ids")
        unknown = set(ids) - set(candidates)
        reused = set(ids) & seen
        if unknown or reused:
            raise GlobalAggregationError(f"global review has unknown or repeated candidate_ids: {sorted(unknown | reused)}")
        seen.update(ids)
        members = [candidates[identifier] for identifier in ids]
        outcome = str(group["outcome"])
        if outcome == "keep":
            for candidate in members:
                stored = dict(candidate)
                stored["sources"] = [
                    {key: value for key, value in source.items() if key != "current"}
                    for source in candidate.get("sources", [])
                    if isinstance(source, dict)
                ]
                pending[stored["candidate_id"]] = stored
            continue
        if outcome != "promote":
            continue
        source_projects = _source_projects(members)
        explicit = any(bool(item.get("explicit_global_intent")) for item in members)
        if len(source_projects) < 2 and not explicit:
            raise GlobalAggregationError("global promotion requires two project roots or explicit global intent")
        decision = group.get("decision")
        if not isinstance(decision, dict):
            raise GlobalAggregationError("promote outcome requires a decision")
        decision = dict(decision)
        if decision.get("target") != "global" or decision.get("action") not in MUTATING_ACTIONS:
            raise GlobalAggregationError("promoted decision must be a mutating global decision")
        current_refs = sorted(
            {
                str(ref)
                for candidate in members
                for source in candidate.get("sources", [])
                if isinstance(source, dict) and source.get("current") is True
                for ref in source.get("evidence_refs", [])
            }
        )
        if not current_refs:
            raise GlobalAggregationError("global promotion requires evidence from the current batch")
        decision["evidence_refs"] = current_refs
        decision["global_candidate_ids"] = ids
        decision["global_evidence_project_roots"] = sorted(source_projects)
        decision["explicit_global_intent"] = explicit
        promoted.append(decision)
        suppressed_source_decisions.update(
            str(source.get("decision_id"))
            for candidate in members
            for source in candidate.get("sources", [])
            if isinstance(source, dict) and source.get("current") is True
        )

    missing = set(candidates) - seen
    if missing:
        raise GlobalAggregationError(f"global review did not disposition every candidate: {sorted(missing)}")

    final_project_decisions: list[dict[str, Any]] = []
    for original in project_decisions:
        decision = dict(original)
        if decision.get("decision_id") in suppressed_source_decisions and decision.get("action") in MUTATING_ACTIONS:
            decision["action"] = "no-op"
            decision["explanation"] = "source mutation is deferred to the completed global aggregation"
        final_project_decisions.append(decision)
    return {
        "review_protocol": "project-then-global-v1",
        "decisions": [*final_project_decisions, *promoted],
        "pending_global_candidates": pending,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare and finalize the mandatory cross-project global-candidate review.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    prepare = subparsers.add_parser("prepare")
    prepare.add_argument("--decisions", required=True)
    prepare.add_argument("--batch", required=True)
    prepare.add_argument("--state")
    prepare.add_argument("--output")
    finalize = subparsers.add_parser("finalize")
    finalize.add_argument("--bundle", required=True)
    finalize.add_argument("--global-review", required=True)
    finalize.add_argument("--output")
    args = parser.parse_args()
    if args.command == "prepare":
        value = prepare_bundle(
            load_json(Path(args.decisions).expanduser().resolve(), []),
            load_json(Path(args.batch).expanduser().resolve(), {}),
            load_json(Path(args.state).expanduser().resolve(), {}) if args.state else {},
        )
    else:
        value = finalize_bundle(
            load_json(Path(args.bundle).expanduser().resolve(), {}),
            load_json(Path(args.global_review).expanduser().resolve(), {}),
        )
    write_json_output(value, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
