#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from _common import (
    STATE_DIR_NAME,
    atomic_write_bytes,
    atomic_write_json,
    codex_home,
    find_git_root,
    isoformat,
    load_json,
    normalize_text,
    sha256_bytes,
    stable_id,
)
from reconcile_agents import (
    MUTATING_ACTIONS,
    ReconcileError,
    apply_decisions,
    decision_fingerprint,
    evidence_ref_record_ids,
    evidence_ref_scopes,
    encode_agents,
    normalized_effective_lines,
    path_key,
    read_agents,
    unified_diff,
)


def append_jsonl(path: Path, items: list[dict[str, Any]]) -> None:
    if not items:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        for item in items:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


@contextmanager
def optimizer_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("a+b")
    try:
        if handle.seek(0, os.SEEK_END) == 0:
            handle.write(b"\0")
            handle.flush()
        handle.seek(0)
        if os.name == "nt":
            import msvcrt

            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as error:
                raise RuntimeError("another optimizer apply is already running") from error
        else:
            import fcntl

            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as error:
                raise RuntimeError("another optimizer apply is already running") from error
        yield
    finally:
        try:
            handle.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        handle.close()


def set_confirmed_suggest_commit_preference(state_dir: Path, enabled: bool) -> dict[str, Any]:
    with optimizer_lock(state_dir / ".apply.lock"):
        state_path = state_dir / "state.json"
        state = load_json(state_path, {"version": 1})
        state.setdefault("preferences", {})["confirmed_suggest_git_commit"] = enabled
        state["preferences_updated_at"] = isoformat()
        atomic_write_json(state_path, state)
    return {"confirmed_suggest_git_commit": enabled, "state_path": str(state_path)}


def commit_agents(project_root: Path, target: Path) -> dict[str, Any]:
    git_root = find_git_root(project_root)
    if git_root is None:
        return {"committed": False, "reason": "target is not in a Git repository"}
    try:
        relative = target.resolve().relative_to(git_root.resolve())
    except ValueError:
        return {"committed": False, "reason": "target is outside detected Git root"}
    index_snapshot = subprocess.run(
        ["git", "-C", str(git_root), "ls-files", "--stage", "-z", "--", str(relative)],
        capture_output=True,
        check=False,
    )
    if index_snapshot.returncode != 0:
        raise RuntimeError(f"failed to inspect AGENTS.md index state: {index_snapshot.stderr.decode('utf-8', 'replace').strip()}")
    index_entries: list[tuple[str, str, str]] = []
    for raw_entry in index_snapshot.stdout.split(b"\0"):
        if not raw_entry:
            continue
        metadata, raw_path = raw_entry.split(b"\t", 1)
        mode, object_id, stage = metadata.decode("ascii").split()
        if stage != "0":
            raise RuntimeError("cannot commit an unmerged AGENTS.md index entry")
        index_entries.append((mode, object_id, raw_path.decode("utf-8", "surrogateescape")))

    def restore_index() -> None:
        removed = subprocess.run(
            ["git", "-C", str(git_root), "update-index", "--force-remove", "--", str(relative)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if removed.returncode != 0:
            raise RuntimeError(f"failed to restore AGENTS.md index state: {removed.stderr.strip()}")
        for mode, object_id, indexed_path in index_entries:
            restored = subprocess.run(
                ["git", "-C", str(git_root), "update-index", "--add", "--cacheinfo", mode, object_id, indexed_path],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
            if restored.returncode != 0:
                raise RuntimeError(f"failed to restore AGENTS.md index entry: {restored.stderr.strip()}")

    add = subprocess.run(["git", "-C", str(git_root), "add", "--", str(relative)], capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
    if add.returncode != 0:
        restore_index()
        raise RuntimeError(f"git add failed: {add.stderr.strip()}")
    status = subprocess.run(["git", "-C", str(git_root), "diff", "--cached", "--quiet", "--", str(relative)], check=False)
    if status.returncode == 0:
        restore_index()
        return {"committed": False, "reason": "no staged AGENTS.md change"}
    commit = subprocess.run(
        ["git", "-C", str(git_root), "commit", "--only", "-m", "chore: update learned Codex preferences", "--", str(relative)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if commit.returncode != 0:
        restore_index()
        raise RuntimeError(f"git commit failed: {commit.stderr.strip() or commit.stdout.strip()}")
    revision = subprocess.run(["git", "-C", str(git_root), "rev-parse", "HEAD"], capture_output=True, text=True, encoding="utf-8", check=True).stdout.strip()
    return {"committed": True, "commit": revision, "git_root": str(git_root)}


def select_decisions(decisions: list[dict[str, Any]], identifiers: set[str] | None) -> list[dict[str, Any]]:
    if identifiers is None:
        return decisions
    return [item for item in decisions if item.get("decision_id") in identifiers]


def resolve_review_selectors(plan: dict[str, Any], selectors: set[str] | None) -> set[str] | None:
    """Resolve user-facing plan-local numbers while retaining internal ID compatibility."""
    if selectors is None:
        return None
    decisions = [item for item in plan.get("decisions", []) if isinstance(item, dict)]
    internal_ids = {str(item.get("decision_id")) for item in decisions}
    number_to_id = {
        str(item["selection_number"]): str(item.get("decision_id"))
        for item in decisions
        if isinstance(item.get("selection_number"), int) and not isinstance(item.get("selection_number"), bool)
    }
    return {
        selector if selector in internal_ids else number_to_id.get(selector, selector)
        for selector in map(str, selectors)
    }


def rule_provenance_key(decision: dict[str, Any], instruction: str) -> str:
    return stable_id(
        str(decision.get("target")),
        str(decision.get("project_root")),
        normalize_text(instruction),
        prefix="P-",
    )


def decision_scope_key(decision: dict[str, Any]) -> str:
    if decision.get("target") == "global":
        return "global"
    return f"project:{path_key(Path(str(decision.get('project_root') or '.')))}"


def update_state(
    state_dir: Path,
    plan_path: Path,
    plan: dict[str, Any],
    mode: str,
    applied_ids: set[str],
    rejected_ids: set[str],
    failed_ids: set[str],
    checkpoint_record_ids: set[str],
    results: list[dict[str, Any]],
    checkpoint_batch: dict[str, Any] | None = None,
) -> None:
    state_path = state_dir / "state.json"
    state = load_json(
        state_path,
        {
            "version": 1,
            "processed_record_ids": [],
            "pending_decisions": {},
            "rejected_candidates": {},
            "tombstones": {},
            "rule_provenance": {},
            "constraint_revision": 0,
            "scope_revisions": {},
        },
    )
    state["processed_record_ids"] = sorted(set(state.get("processed_record_ids", [])) | checkpoint_record_ids)
    if checkpoint_record_ids and plan.get("review_protocol") == "project-then-global-v1":
        state["pending_global_candidates"] = dict(plan.get("pending_global_candidates", {}))
    if checkpoint_record_ids and isinstance(checkpoint_batch, dict):
        indexed = {
            str(item["record_id"]): item
            for item in state.get("record_index", [])
            if isinstance(item, dict) and item.get("record_id")
        }
        for record in checkpoint_batch.get("records", []):
            if isinstance(record, dict) and str(record.get("record_id")) in checkpoint_record_ids:
                indexed[str(record["record_id"])] = record
        state["record_index"] = sorted(
            indexed.values(), key=lambda item: (item.get("timestamp") or "", item.get("session_id") or "", item.get("turn_ordinal") or 0)
        )
        state["source_cursors"] = dict(checkpoint_batch.get("source_cursors", state.get("source_cursors", {})))
        state["session_scan_cache"] = dict(checkpoint_batch.get("scan_cache", state.get("session_scan_cache", {})))
    pending = state.setdefault("pending_decisions", {})
    rejected_candidates = state.setdefault("rejected_candidates", {})
    tombstones = state.setdefault("tombstones", {})
    provenance = state.setdefault("rule_provenance", {})
    now = isoformat()
    changed_scopes: set[str] = set()
    log_items: list[dict[str, Any]] = []
    application_by_id: dict[str, dict[str, Any]] = {}
    for result in results:
        for identifier in result.get("decision_ids", []):
            application_by_id[identifier] = result

    for decision in plan.get("decisions", []):
        identifier = decision["decision_id"]
        status = "no-op" if decision.get("action") == "no-op" else "needs-evidence" if decision.get("action") == "needs_evidence" else "pending"
        if identifier in rejected_ids:
            status = "rejected"
            rejected_candidates[decision_fingerprint(decision)] = {
                "at": now,
                "decision_id": identifier,
                "target": decision.get("target"),
                "project_root": decision.get("project_root"),
                "instruction": decision.get("instruction"),
                "evidence_refs": decision.get("evidence_refs", []),
            }
            pending.pop(identifier, None)
            changed_scopes.add(decision_scope_key(decision))
        elif identifier in failed_ids:
            status = "error"
        elif identifier in applied_ids:
            action = decision.get("action")
            supersedes = str(decision.get("supersedes_decision_id") or "").strip()
            if supersedes:
                status = "edited-accepted"
                pending.pop(supersedes, None)
            elif action == "no-op":
                status = "no-op"
            elif mode == "auto":
                status = "auto-applied"
            elif action == "remove":
                status = "withdrawn"
            else:
                status = "accepted"
            pending.pop(identifier, None)
            if action in MUTATING_ACTIONS:
                changed_scopes.add(decision_scope_key(decision))
            if action == "remove":
                existing = str(decision.get("existing_instruction") or "")
                provenance_key = rule_provenance_key(decision, existing)
                previous_provenance = provenance.get(provenance_key, {})
                inherited_evidence = (
                    previous_provenance.get("evidence_refs", []) if isinstance(previous_provenance, dict) else []
                )
                tombstone_evidence = sorted(
                    {str(value) for value in [*decision.get("evidence_refs", []), *inherited_evidence]}
                )
                tombstones[decision_fingerprint(decision, existing)] = {
                    "at": now,
                    "decision_id": identifier,
                    "target": decision.get("target"),
                    "project_root": decision.get("project_root"),
                    "instruction": existing,
                    "evidence_refs": tombstone_evidence,
                }
                provenance.pop(provenance_key, None)
            if decision.get("restore_tombstone") and decision.get("instruction"):
                explicit_ids = {str(value) for value in decision.get("restore_tombstone_ids", [])}
                evidence = {str(value) for value in decision.get("evidence_refs", [])}
                for key, entry in list(tombstones.items()):
                    same_target = isinstance(entry, dict) and entry.get("target") == decision.get("target")
                    same_project = decision.get("target") == "global" or (
                        same_target
                        and entry.get("project_root")
                        and decision.get("project_root")
                        and path_key(Path(str(entry["project_root"]))) == path_key(Path(str(decision["project_root"])))
                    )
                    overlapping_evidence = isinstance(entry, dict) and bool(evidence.intersection(str(value) for value in entry.get("evidence_refs", [])))
                    explicit_match = key in explicit_ids or (
                        isinstance(entry, dict) and str(entry.get("decision_id") or "") in explicit_ids
                    )
                    if same_target and same_project and (explicit_match or overlapping_evidence):
                        tombstones.pop(key, None)
                tombstones.pop(decision_fingerprint(decision, str(decision["instruction"])), None)
            if decision.get("override_prior_rejection") and decision.get("instruction"):
                explicit_ids = {str(value) for value in decision.get("override_rejection_ids", [])}
                evidence = {str(value) for value in decision.get("evidence_refs", [])}
                for key, entry in list(rejected_candidates.items()):
                    same_target = isinstance(entry, dict) and entry.get("target") == decision.get("target")
                    same_project = decision.get("target") == "global" or (
                        same_target
                        and entry.get("project_root")
                        and decision.get("project_root")
                        and path_key(Path(str(entry["project_root"]))) == path_key(Path(str(decision["project_root"])))
                    )
                    overlapping_evidence = isinstance(entry, dict) and bool(evidence.intersection(str(value) for value in entry.get("evidence_refs", [])))
                    explicit_match = key in explicit_ids or (
                        isinstance(entry, dict) and str(entry.get("decision_id") or "") in explicit_ids
                    )
                    if same_target and same_project and (explicit_match or overlapping_evidence):
                        rejected_candidates.pop(key, None)
                rejected_candidates.pop(decision_fingerprint(decision, str(decision["instruction"])), None)
            if decision.get("instruction") and action in {"add", "merge", "narrow", "replace"}:
                inherited_evidence = {str(value) for value in decision.get("evidence_refs", [])}
                replaced_instructions: list[str] = []
                if action in {"narrow", "replace"}:
                    replaced_instructions.append(str(decision.get("existing_instruction") or ""))
                elif action == "merge":
                    replaced_instructions.extend(str(value) for value in decision.get("existing_instructions", []))
                for old_instruction in replaced_instructions:
                    old_key = rule_provenance_key(decision, old_instruction)
                    old_entry = provenance.pop(old_key, {})
                    if isinstance(old_entry, dict):
                        inherited_evidence.update(str(value) for value in old_entry.get("evidence_refs", []))
                key = rule_provenance_key(decision, str(decision["instruction"]))
                current_entry = provenance.get(key, {})
                if isinstance(current_entry, dict):
                    inherited_evidence.update(str(value) for value in current_entry.get("evidence_refs", []))
                provenance[key] = {
                    "decision_id": identifier,
                    "evidence_refs": sorted(inherited_evidence),
                    "updated_at": now,
                }
        elif mode in {"suggest", "confirmed-suggest"} and status == "pending":
            pending[identifier] = {"plan_path": str(plan_path), "decision": decision, "created_at": now}
        log_items.append(
            {
                "timestamp": now,
                "mode": mode,
                "status": status,
                "decision": decision,
                "application": application_by_id.get(identifier),
            }
        )

    if changed_scopes:
        state["constraint_revision"] = int(state.get("constraint_revision", 0)) + 1
        scope_revisions = state.setdefault("scope_revisions", {})
        for scope_key in changed_scopes:
            scope_revisions[scope_key] = int(scope_revisions.get(scope_key, 0)) + 1
    state["last_run_at"] = now
    state["last_mode"] = mode
    state["last_run_metadata"] = plan.get("run_metadata", {})
    append_jsonl(state_dir / "decisions.jsonl", log_items)
    reports = state_dir / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    report_name = now.replace(":", "-") + ".json"
    atomic_write_json(reports / report_name, {"timestamp": now, "mode": mode, "plan_path": str(plan_path), "results": results})
    atomic_write_json(state_path, state)


def validation_error(mode: str, message: str) -> dict[str, Any]:
    return {"mode": mode, "mutated_targets": 0, "results": [{"status": "error", "error": message}]}


def lexical_path_key(path: Path) -> str:
    return os.path.normcase(os.path.abspath(os.path.expanduser(str(path))))


def validate_plan_structure(plan: dict[str, Any]) -> str | None:
    top_decisions = plan.get("decisions", [])
    if not isinstance(top_decisions, list):
        return "plan decisions must be a list"
    if plan.get("record_ids") and not top_decisions:
        return "a non-empty batch plan requires at least one explicit decision, including no-op"
    if plan.get("review_protocol") == "project-then-global-v1":
        pending_candidates = plan.get("pending_global_candidates")
        if not isinstance(pending_candidates, dict):
            return "project-then-global plan has invalid pending global candidates"
        if any(
            not isinstance(candidate, dict) or str(candidate.get("candidate_id") or "") != str(identifier)
            for identifier, candidate in pending_candidates.items()
        ):
            return "pending global candidate keys must match candidate_id values"
    edited_acceptance = plan.get("edited_acceptance", False)
    if not isinstance(edited_acceptance, bool):
        return "plan edited_acceptance must be a boolean"
    superseding = [item for item in top_decisions if isinstance(item, dict) and str(item.get("supersedes_decision_id") or "").strip()]
    if edited_acceptance != bool(superseding) or (edited_acceptance and len(superseding) != len(top_decisions)):
        return "plan edited_acceptance is inconsistent with superseding decisions"
    allowed_values = plan.get("allowed_project_roots", [])
    explicit_values = plan.get("explicit_project_roots", [])
    if not isinstance(allowed_values, list) or not isinstance(explicit_values, list):
        return "plan project root allowlists must be lists"
    allowed_keys = {path_key(Path(str(value))) for value in allowed_values}
    explicit_keys = {path_key(Path(str(value))) for value in explicit_values}
    if not explicit_keys.issubset(allowed_keys):
        return "explicit project roots must be part of the target allowlist"
    top_by_id: dict[str, dict[str, Any]] = {}
    selection_numbers: list[int] = []
    for decision in top_decisions:
        if not isinstance(decision, dict):
            return "plan decision must be an object"
        identifier = str(decision.get("decision_id") or "")
        if not identifier or identifier in top_by_id:
            return "plan has a missing or duplicate top-level decision_id"
        top_by_id[identifier] = decision
        decision_target = decision.get("target")
        project_root_value = decision.get("project_root")
        if decision_target == "global":
            if project_root_value is not None:
                return f"global decision {identifier} must not contain project_root"
        elif decision_target == "project":
            if not isinstance(project_root_value, str) or not project_root_value.strip():
                return f"project decision {identifier} has no project_root"
            if path_key(Path(project_root_value)) not in allowed_keys:
                return f"project decision {identifier} root is outside the target allowlist"
        else:
            return f"decision {identifier} has an invalid target"
        selection_number = decision.get("selection_number")
        if decision.get("action") in MUTATING_ACTIONS:
            if not isinstance(selection_number, int) or isinstance(selection_number, bool) or selection_number < 1:
                return "each reviewable decision must have a positive integer selection_number"
            selection_numbers.append(selection_number)
        elif selection_number is not None:
            return "non-reviewable decisions must not have a selection_number"
    if selection_numbers != list(range(1, len(selection_numbers) + 1)):
        return "reviewable decision selection_numbers must be unique and consecutive"

    seen: set[str] = set()
    home = Path(str(plan.get("codex_home") or ""))
    for target in plan.get("targets", []):
        if not isinstance(target, dict) or not isinstance(target.get("decision_ids"), list):
            return "plan target must contain a decision_ids list"
        scope = target.get("scope")
        target_path = Path(str(target.get("path") or ""))
        project_root_value = target.get("project_root")
        if scope == "global":
            if project_root_value is not None or lexical_path_key(target_path) != lexical_path_key(home / "AGENTS.md"):
                return "global target structure is inconsistent"
        elif scope == "project":
            if not isinstance(project_root_value, str) or not project_root_value.strip():
                return "project target has no project_root"
            project_root = Path(project_root_value)
            if lexical_path_key(target_path) != lexical_path_key(project_root / "AGENTS.md"):
                return "project target path is inconsistent with project_root"
        else:
            return "plan target has an unknown scope"

        for value in target["decision_ids"]:
            identifier = str(value or "")
            top = top_by_id.get(identifier)
            if top is None or identifier in seen:
                return "target decision_id is missing from top level or duplicated"
            if scope == "global" and top.get("target") != "global":
                return f"target decision {identifier} has inconsistent global scope"
            if scope == "project" and (
                top.get("target") != "project"
                or lexical_path_key(Path(str(top.get("project_root") or ""))) != lexical_path_key(Path(str(project_root_value)))
            ):
                return f"target decision {identifier} has inconsistent project scope"
            seen.add(identifier)

    expected = {identifier for identifier, decision in top_by_id.items() if decision.get("action") in MUTATING_ACTIONS}
    if seen != expected:
        return "plan targets do not contain each top-level mutating decision exactly once"
    return None


def validate_application(
    plan: dict[str, Any],
    mode: str,
    decision_ids: set[str] | None,
    rejected_ids: set[str],
    accept_all: bool,
    authorization: dict[str, Any] | None,
) -> str | None:
    plan_mode = plan.get("mode")
    expected_plan_mode = "suggest" if mode in {"suggest", "confirmed-suggest"} else "auto"
    if plan_mode != expected_plan_mode:
        return f"{mode} requires a {expected_plan_mode} plan, got {plan_mode!r}"
    if plan.get("errors"):
        return "plan contains reconciliation errors"
    quota = plan.get("run_metadata", {}).get("quota")
    if quota is not None and quota.get("allowed") is not True:
        return "plan quota is blocked or unknown"
    if quota is not None and plan.get("run_metadata", {}).get("reasoning_effort") != "high":
        return "Scheduled plans require reasoning_effort=high"
    structure_error = validate_plan_structure(plan)
    if structure_error:
        return structure_error
    if not isinstance(authorization, dict):
        return "apply requires an independent trusted batch authorization"
    authorization_home = authorization.get("codex_home")
    if not isinstance(authorization_home, str) or not authorization_home.strip():
        return "trusted batch authorization has no codex_home"
    if path_key(Path(str(plan.get("codex_home") or ""))) != path_key(Path(authorization_home)):
        return "plan codex_home differs from trusted batch authorization"
    plan_roots = {path_key(Path(str(value))) for value in plan.get("allowed_project_roots", [])}
    authorized_roots = {path_key(Path(str(value))) for value in authorization.get("allowed_project_roots", [])}
    if plan_roots != authorized_roots:
        return "plan project roots differ from trusted batch authorization"
    plan_explicit = {path_key(Path(str(value))) for value in plan.get("explicit_project_roots", [])}
    authorized_explicit = {path_key(Path(str(value))) for value in authorization.get("explicit_project_roots", [])}
    if plan_explicit != authorized_explicit:
        return "plan explicit project roots differ from trusted batch authorization"
    plan_record_ids = set(map(str, plan.get("record_ids", [])))
    authorized_record_ids = set(map(str, authorization.get("record_ids", [])))
    if plan.get("edited_acceptance") is True:
        if not plan_record_ids.issubset(authorized_record_ids):
            return "edited plan record IDs are outside trusted batch authorization"
    elif plan_record_ids != authorized_record_ids:
        return "plan record IDs differ from trusted batch authorization"
    if any(item.get("action") == "needs_evidence" for item in plan.get("decisions", [])):
        return "plan contains unresolved needs_evidence decisions"
    known_ids = {str(item.get("decision_id")) for item in plan.get("decisions", [])}
    requested = (decision_ids or set()) | rejected_ids
    unknown = requested - known_ids
    if unknown:
        return f"unknown decision ids: {sorted(unknown)}"
    if (decision_ids or set()) & rejected_ids:
        return "the same decision cannot be accepted and rejected"
    if mode == "confirmed-suggest":
        if accept_all and decision_ids:
            return "use either explicit decision ids or --all, not both"
        if not accept_all and not decision_ids:
            return "confirmed-suggest requires at least one --decision-id or explicit --all"
    if plan.get("edited_acceptance") is True and (mode != "confirmed-suggest" or not accept_all):
        return "edited acceptance plan requires confirmed-suggest --all"
    if mode == "auto":
        if decision_ids or accept_all or rejected_ids:
            return "Auto applies the complete freshly reconciled Auto plan and does not accept review selectors"
        for decision in plan.get("decisions", []):
            if decision.get("action") in MUTATING_ACTIONS and (
                decision.get("confidence") != "high" or decision.get("risk_of_overconstraint") != "low"
            ):
                return f"Auto decision {decision.get('decision_id')} is not high-confidence/low-risk"
    trusted_scope_sets = evidence_ref_scopes(authorization)
    trusted_refs = set(trusted_scope_sets)
    ref_scopes = {ref: sorted(scopes) for ref, scopes in trusted_scope_sets.items()}
    record_ids = plan_record_ids
    records_by_ref = evidence_ref_record_ids(authorization)
    covered_records: set[str] = set()
    explicit_project_roots = {path_key(Path(str(value))) for value in plan.get("explicit_project_roots", [])}
    for decision in plan.get("decisions", []):
        evidence_refs = decision.get("evidence_refs")
        if not isinstance(evidence_refs, list) or not evidence_refs:
            return f"decision {decision.get('decision_id')} has no evidence_refs"
        unknown_refs = sorted({str(value) for value in evidence_refs if str(value) not in trusted_refs})
        if unknown_refs:
            return f"decision {decision.get('decision_id')} has untrusted evidence_refs: {unknown_refs}"
        for value in evidence_refs:
            covered_records.update(records_by_ref.get(str(value), set()))
        if decision.get("action") == "no-op" and not str(decision.get("explanation") or "").strip():
            return f"no-op decision {decision.get('decision_id')} has no specific explanation"
        if decision.get("action") not in MUTATING_ACTIONS:
            evidence_projects = {
                scope for value in evidence_refs for scope in trusted_scope_sets.get(str(value), set())
            }
            if len(evidence_projects) > 1:
                return f"decision {decision.get('decision_id')} has evidence spanning multiple projects"
            if decision.get("target") == "project" and decision.get("project_root"):
                target_scope = path_key(Path(str(decision["project_root"])))
                wrong_scope = sorted(
                    {
                        str(value)
                        for value in evidence_refs
                        if not trusted_scope_sets.get(str(value)) or target_scope not in trusted_scope_sets[str(value)]
                    }
                )
                if wrong_scope:
                    return f"decision {decision.get('decision_id')} has evidence_refs from another project: {wrong_scope}"
            continue
        if mode == "auto" and decision.get("target") == "global":
            evidence_projects = {
                scope for value in evidence_refs for scope in trusted_scope_sets.get(str(value), set())
            }
            if len(evidence_projects) < 2:
                return f"Auto global decision {decision.get('decision_id')} requires evidence from two project roots"
        if decision.get("target") == "project" and decision.get("project_root"):
            target_scope = path_key(Path(str(decision["project_root"])))
            wrong_scope = []
            if target_scope not in explicit_project_roots:
                wrong_scope = sorted(
                    {
                        str(value)
                        for value in evidence_refs
                        if not ref_scopes.get(str(value)) or target_scope not in ref_scopes[str(value)]
                    }
                )
            if wrong_scope:
                return f"mutating decision {decision.get('decision_id')} has evidence_refs from another project: {wrong_scope}"
    uncovered_records = sorted(record_ids - covered_records)
    if uncovered_records:
        return f"batch records lack explicit decision coverage: {uncovered_records}"
    return None


def validate_current_state(
    plan: dict[str, Any], state_dir: Path, mode: str, decision_ids: set[str] | None, accept_all: bool
) -> str | None:
    if mode == "suggest":
        return None
    state = load_json(state_dir / "state.json", {})
    if plan.get("edited_acceptance") is True:
        if mode != "confirmed-suggest" or not accept_all:
            return "edited acceptance plan requires confirmed-suggest --all"
        pending = state.get("pending_decisions", {}) if isinstance(state.get("pending_decisions"), dict) else {}
        seen_superseded: set[str] = set()
        for decision in plan.get("decisions", []):
            supersedes = str(decision.get("supersedes_decision_id") or "").strip()
            prior_entry = pending.get(supersedes)
            prior = prior_entry.get("decision") if isinstance(prior_entry, dict) else None
            if not supersedes or supersedes in seen_superseded or not isinstance(prior, dict):
                return f"edited decision {decision.get('decision_id')} no longer supersedes one unique pending decision"
            seen_superseded.add(supersedes)
            if decision.get("target") != prior.get("target"):
                return f"edited decision {decision.get('decision_id')} changed target scope"
            if decision.get("target") == "project" and path_key(Path(str(decision.get("project_root") or "."))) != path_key(
                Path(str(prior.get("project_root") or "."))
            ):
                return f"edited decision {decision.get('decision_id')} changed project scope"
            if not set(map(str, decision.get("evidence_refs", []))).issubset(set(map(str, prior.get("evidence_refs", [])))):
                return f"edited decision {decision.get('decision_id')} changed evidence scope"
    guard = plan.get("state_guard")
    if mode == "auto":
        if not isinstance(guard, dict):
            return "Auto plan has no state freshness guard"
        current_guard = {
            "tombstones": sorted(state.get("tombstones", {})),
            "rejected_candidates": sorted(state.get("rejected_candidates", {})),
            "constraint_revision": int(state.get("constraint_revision", 0)),
        }
        expected_guard = {
            "tombstones": sorted(guard.get("tombstones", [])),
            "rejected_candidates": sorted(guard.get("rejected_candidates", [])),
            "constraint_revision": int(guard.get("constraint_revision", 0)),
        }
        if current_guard != expected_guard:
            return "Auto plan is stale because tombstone or rejection state changed after planning"
        selected = plan.get("decisions", [])
    elif accept_all:
        selected = [
            decision
            for decision in plan.get("decisions", [])
            if plan.get("edited_acceptance") is True or decision.get("action") in MUTATING_ACTIONS
        ]
    else:
        selected = [decision for decision in plan.get("decisions", []) if decision.get("decision_id") in (decision_ids or set())]
    tombstones = state.get("tombstones", {})
    rejected = state.get("rejected_candidates", {})
    for decision in selected:
        if mode == "confirmed-suggest" and decision.get("action") in {"remove", "merge", "narrow", "replace"}:
            if not isinstance(guard, dict):
                return f"decision {decision.get('decision_id')} has no state freshness guard"
            scope_key = decision_scope_key(decision)
            expected_scope_revision = int(guard.get("scope_revisions", {}).get(scope_key, 0))
            current_scope_revision = int(state.get("scope_revisions", {}).get(scope_key, 0))
            if current_scope_revision != expected_scope_revision:
                return f"decision {decision.get('decision_id')} is stale because its rule scope changed after planning"
        if decision.get("action") not in {"add", "merge", "narrow", "replace"}:
            continue
        fingerprint = decision_fingerprint(decision)
        if fingerprint in tombstones and not decision.get("restore_tombstone"):
            return f"decision {decision.get('decision_id')} is blocked by a tombstone created after planning"
        if fingerprint in rejected and not decision.get("override_prior_rejection"):
            return f"decision {decision.get('decision_id')} is blocked by a rejection created after planning"
        decision_evidence = {str(value) for value in decision.get("evidence_refs", [])}
        target_scope = str(decision.get("target") or "")
        project_scope = (
            path_key(Path(str(decision.get("project_root"))))
            if target_scope == "project" and decision.get("project_root")
            else None
        )

        def same_scope(entry: Any) -> bool:
            if not isinstance(entry, dict) or entry.get("target") != target_scope:
                return False
            if target_scope == "global":
                return True
            value = entry.get("project_root")
            return isinstance(value, str) and project_scope == path_key(Path(value))

        tombstone_match = any(
            same_scope(entry)
            and bool(decision_evidence.intersection(str(value) for value in entry.get("evidence_refs", [])))
            for entry in tombstones.values()
        )
        rejection_match = any(
            same_scope(entry)
            and bool(decision_evidence.intersection(str(value) for value in entry.get("evidence_refs", [])))
            for entry in rejected.values()
        )
        if tombstone_match and not decision.get("restore_tombstone"):
            return f"decision {decision.get('decision_id')} reuses feedback evidence withdrawn after planning"
        if rejection_match and not decision.get("override_prior_rejection"):
            return f"decision {decision.get('decision_id')} reuses feedback evidence rejected after planning"
    return None


def _apply_plan_locked(
    plan_path: Path,
    plan: dict[str, Any],
    mode: str,
    decision_ids: set[str] | None,
    rejected_ids: set[str],
    commit: bool,
    state_dir: Path,
    accept_all: bool = False,
    authorization: dict[str, Any] | None = None,
) -> dict[str, Any]:
    decision_ids = resolve_review_selectors(plan, decision_ids)
    rejected_ids = resolve_review_selectors(plan, rejected_ids) or set()
    invalid = validate_application(plan, mode, decision_ids, rejected_ids, accept_all, authorization)
    if invalid is None:
        invalid = validate_current_state(plan, state_dir, mode, decision_ids, accept_all)
    if invalid:
        return validation_error(mode, invalid)

    if mode == "suggest":
        applied_ids: set[str] = set()
        results = [
            {
                "path": item["path"],
                "status": "suggested",
                "diff": item.get("diff", ""),
                "base_sha256": item.get("base_sha256"),
                "new_sha256": item.get("new_sha256"),
                "agents_md_dirty": item.get("agents_md_dirty"),
            }
            for item in plan.get("targets", [])
        ]
        update_state(
            state_dir,
            plan_path,
            plan,
            mode,
            applied_ids,
            rejected_ids,
            set(),
            set(plan.get("record_ids", [])),
            results,
            authorization,
        )
        return {"mode": mode, "mutated_targets": 0, "results": results}

    allowed_roots = {
        path_key(Path(value)): Path(value).expanduser().resolve()
        for value in (authorization or {}).get("allowed_project_roots", [])
    }
    home = Path(str((authorization or {}).get("codex_home"))).expanduser().resolve()
    top_by_id = {str(item["decision_id"]): item for item in plan.get("decisions", [])}
    applied_ids: set[str] = set()
    failed_ids: set[str] = set()
    results: list[dict[str, Any]] = []
    selected_ids = decision_ids
    if mode == "confirmed-suggest" and accept_all:
        selected_ids = {
            item["decision_id"]
            for item in plan.get("decisions", [])
            if plan.get("edited_acceptance") is True or item.get("action") in MUTATING_ACTIONS
        }
    if plan.get("edited_acceptance") is True:
        for decision in plan.get("decisions", []):
            identifier = str(decision["decision_id"])
            if identifier in (selected_ids or set()) and identifier not in rejected_ids and decision.get("action") == "no-op":
                applied_ids.add(identifier)
                results.append(
                    {
                        "status": "no-op",
                        "decision_ids": [identifier],
                        "notes": [str(decision.get("explanation") or "edited instruction is already effective")],
                        "committed": False,
                        "reason": "not required",
                    }
                )
    for target in plan.get("targets", []):
        target_decisions = [top_by_id[str(identifier)] for identifier in target.get("decision_ids", [])]
        target_ids = {item["decision_id"] for item in select_decisions(target_decisions, selected_ids)}
        if mode == "confirmed-suggest" and not target_ids:
            continue
        path = Path(target["path"]).absolute()
        scope = target.get("scope")
        if scope == "global":
            expected = (home / "AGENTS.md").absolute()
            if lexical_path_key(path) != lexical_path_key(expected) or path.is_symlink():
                failed_ids.update(target_ids)
                results.append({"path": str(path), "status": "error", "decision_ids": sorted(target_ids), "error": "global target path mismatch"})
                continue
            project_root = None
        elif scope == "project":
            project_root_value = target.get("project_root")
            project_root = Path(project_root_value).resolve() if project_root_value else None
            if (
                project_root is None
                or not project_root.is_dir()
                or path_key(project_root) not in allowed_roots
                or lexical_path_key(path) != lexical_path_key(project_root / "AGENTS.md")
                or path.is_symlink()
            ):
                failed_ids.update(target_ids)
                results.append({"path": str(path), "status": "error", "decision_ids": sorted(target_ids), "error": "project root no longer exists, is outside trusted roots, or target is not root AGENTS.md"})
                continue
        else:
            failed_ids.update(target_ids)
            results.append({"path": str(path), "status": "error", "decision_ids": sorted(target_ids), "error": "unknown target scope"})
            continue

        decisions = select_decisions(target_decisions, selected_ids)
        decisions = [item for item in decisions if item.get("decision_id") not in rejected_ids]
        if not decisions:
            continue
        current_raw = b""
        current = ""
        updated = ""
        actual_diff = ""
        target_existed = path.exists()
        wrote_target = False
        try:
            current_raw, current = read_agents(path)
            effective_lines = normalized_effective_lines(current)
            if project_root is not None:
                global_path = home / "AGENTS.md"
                if global_path.exists():
                    try:
                        effective_lines.update(normalized_effective_lines(global_path.read_text(encoding="utf-8-sig")))
                    except (OSError, UnicodeDecodeError) as error:
                        raise ReconcileError(f"cannot inspect effective global AGENTS.md: {error}") from error
            runtime_notes: list[str] = []
            for decision in decisions:
                if decision.get("action") != "add":
                    continue
                instruction = str(decision.get("instruction") or "")
                if normalize_text(instruction) in effective_lines:
                    decision["action"] = "no-op"
                    decision["explanation"] = "an equivalent instruction became effective after planning"
                    runtime_notes.append(f"{decision['decision_id']}: latest effective rule made add a no-op")
            updated, notes = apply_decisions(current, decisions)
            notes = [*runtime_notes, *notes]
            actual_diff = unified_diff(path, current, updated)
            if updated != current:
                atomic_write_bytes(path, encode_agents(updated, current_raw))
                wrote_target = True
            should_commit = commit and project_root is not None and wrote_target
            commit_result = commit_agents(project_root, path) if should_commit else {"committed": False, "reason": "not required"}
            ids = {item["decision_id"] for item in decisions}
            applied_ids.update(ids)
            results.append(
                {
                    "path": str(path),
                    "status": "applied" if updated != current else "no-op",
                    "decision_ids": sorted(ids),
                    "notes": notes,
                    "diff": actual_diff,
                    "base_sha256": sha256_bytes(current_raw),
                    "new_sha256": sha256_bytes(encode_agents(updated, current_raw)),
                    **commit_result,
                }
            )
        except (OSError, ReconcileError, RuntimeError, subprocess.SubprocessError) as error:
            rollback_error: str | None = None
            if wrote_target:
                try:
                    if target_existed:
                        atomic_write_bytes(path, current_raw)
                    elif path.exists():
                        path.unlink()
                except OSError as rollback:
                    rollback_error = str(rollback)
            ids = {item["decision_id"] for item in decisions}
            failed_ids.update(ids)
            failure: dict[str, Any] = {"path": str(path), "status": "error", "decision_ids": sorted(ids), "error": str(error)}
            if rollback_error:
                failure["rollback_error"] = rollback_error
            if actual_diff:
                failure.update(
                    {
                        "diff": actual_diff,
                        "base_sha256": sha256_bytes(current_raw),
                        "new_sha256": sha256_bytes(encode_agents(updated, current_raw)),
                    }
                )
            results.append(failure)

    checkpoint_record_ids = set() if failed_ids else set(plan.get("record_ids", []))
    update_state(
        state_dir,
        plan_path,
        plan,
        mode,
        applied_ids,
        rejected_ids,
        failed_ids,
        checkpoint_record_ids,
        results,
        authorization,
    )
    return {"mode": mode, "mutated_targets": sum(item.get("status") == "applied" for item in results), "results": results}


def apply_plan(
    plan_path: Path,
    plan: dict[str, Any],
    mode: str,
    decision_ids: set[str] | None,
    rejected_ids: set[str],
    commit: bool | None,
    state_dir: Path,
    accept_all: bool = False,
    authorization: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        with optimizer_lock(state_dir / ".apply.lock"):
            if commit is None:
                state = load_json(state_dir / "state.json", {})
                preferences = state.get("preferences", {}) if isinstance(state.get("preferences"), dict) else {}
                commit = mode == "confirmed-suggest" and preferences.get("confirmed_suggest_git_commit") is True
            return _apply_plan_locked(
                plan_path,
                plan,
                mode,
                decision_ids,
                rejected_ids,
                commit,
                state_dir,
                accept_all,
                authorization,
            )
    except (OSError, RuntimeError) as error:
        return validation_error(mode, str(error))


def main() -> int:
    parser = argparse.ArgumentParser(description="Record suggestions or safely apply a reconciled AGENTS.md update plan.")
    parser.add_argument("--plan")
    parser.add_argument("--batch", help="Independent trusted batch used to authorize Codex home and project roots.")
    parser.add_argument("--mode", choices=("suggest", "auto", "confirmed-suggest"))
    parser.add_argument(
        "--selection",
        "--decision-id",
        action="append",
        dest="decision_ids",
        help="Accept a visible Suggest number; internal decision IDs remain supported for compatibility.",
    )
    parser.add_argument("--all", action="store_true", dest="accept_all", help="Explicitly accept every mutating decision in a Suggest plan.")
    parser.add_argument(
        "--reject-selection",
        "--reject-id",
        action="append",
        dest="reject_id",
        default=[],
        help="Reject a visible Suggest number; internal decision IDs remain supported for compatibility.",
    )
    parser.add_argument("--state-dir")
    parser.add_argument(
        "--set-confirmed-suggest-commit",
        choices=("yes", "no"),
        help="Persist whether accepted Suggest changes should commit only the target AGENTS.md in Git projects.",
    )
    parser.add_argument("--model")
    parser.add_argument("--reasoning-effort", choices=("low", "medium", "high"))
    parser.add_argument("--output")
    args = parser.parse_args()
    if args.set_confirmed_suggest_commit:
        if args.plan or args.batch:
            parser.error("configure the confirmed-Suggest commit preference separately from applying a plan")
        home = codex_home()
        state_dir = Path(args.state_dir).expanduser().resolve() if args.state_dir else home / STATE_DIR_NAME
        result = set_confirmed_suggest_commit_preference(
            state_dir, args.set_confirmed_suggest_commit == "yes"
        )
        if args.output:
            atomic_write_json(Path(args.output).expanduser().resolve(), result)
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if not args.plan or not args.batch:
        parser.error("--plan and --batch are required when applying or recording a plan")
    plan_path = Path(args.plan).expanduser().resolve()
    plan = load_json(plan_path, {})
    authorization = load_json(Path(args.batch).expanduser().resolve(), {})
    if args.model or args.reasoning_effort:
        metadata = plan.setdefault("run_metadata", {})
        if args.model:
            metadata["model"] = args.model
        if args.reasoning_effort:
            metadata["reasoning_effort"] = args.reasoning_effort
    mode = args.mode or plan.get("mode") or "suggest"
    home = codex_home(authorization.get("codex_home"))
    state_dir = Path(args.state_dir).expanduser().resolve() if args.state_dir else home / STATE_DIR_NAME
    commit = True if mode == "auto" else None if mode == "confirmed-suggest" else False
    result = apply_plan(
        plan_path,
        plan,
        mode,
        set(args.decision_ids) if args.decision_ids else None,
        set(args.reject_id),
        commit,
        state_dir,
        args.accept_all,
        authorization,
    )
    if args.output:
        atomic_write_json(Path(args.output).expanduser().resolve(), result)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if all(item.get("status") != "error" for item in result["results"]) else 2


if __name__ == "__main__":
    raise SystemExit(main())
