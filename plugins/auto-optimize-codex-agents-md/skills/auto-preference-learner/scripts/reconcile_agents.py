#!/usr/bin/env python3
from __future__ import annotations

import argparse
import difflib
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from _common import (
    END_MARKER,
    START_MARKER,
    codex_home,
    load_json,
    normalize_text,
    sha256_bytes,
    stable_id,
    write_json_output,
)


HEADING = "## Learned working preferences"
MAX_AGENTS_BYTES = 32 * 1024
UTF8_BOM = b"\xef\xbb\xbf"
VALID_ACTIONS = {"add", "merge", "narrow", "replace", "remove", "no-op", "needs_evidence"}
MUTATING_ACTIONS = {"add", "merge", "narrow", "replace", "remove"}


class ReconcileError(ValueError):
    pass


def read_agents(path: Path) -> tuple[bytes, str]:
    if path.is_symlink():
        raise ReconcileError(f"refusing symbolic-link AGENTS.md target: {path}")
    if not path.exists():
        return b"", ""
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ReconcileError(f"{path} is not valid UTF-8") from error
    return raw, text


def encode_agents(text: str, original_raw: bytes) -> bytes:
    encoded = text.encode("utf-8")
    return UTF8_BOM + encoded if original_raw.startswith(UTF8_BOM) else encoded


def newline_for(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


def parse_rules(text: str) -> tuple[list[str], tuple[int, int] | None]:
    start_count = text.count(START_MARKER)
    end_count = text.count(END_MARKER)
    if start_count == 0 and end_count == 0:
        return [], None
    if start_count != 1 or end_count != 1:
        raise ReconcileError("managed block markers must occur exactly once")
    start = text.find(START_MARKER)
    end = text.find(END_MARKER)
    if end < start:
        raise ReconcileError("managed block end marker precedes start marker")
    end_after = end + len(END_MARKER)
    body = text[start + len(START_MARKER) : end]
    rules: list[str] = []
    current: list[str] | None = None
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped or stripped == HEADING:
            continue
        if stripped.startswith("- "):
            if current:
                rules.append(" ".join(current).strip())
            current = [stripped[2:].strip()]
        elif current is not None:
            current.append(stripped)
    if current:
        rules.append(" ".join(current).strip())
    return rules, (start, end_after)


def managed_block(rules: list[str], newline: str) -> str:
    lines = [START_MARKER, HEADING, ""]
    lines.extend(f"- {rule.strip()}" for rule in rules if rule.strip())
    lines.append(END_MARKER)
    return newline.join(lines)


def render_text(original: str, rules: list[str], bounds: tuple[int, int] | None) -> str:
    newline = newline_for(original)
    block = managed_block(rules, newline)
    if bounds is not None:
        return original[: bounds[0]] + block + original[bounds[1] :]
    if not rules:
        return original
    if not original:
        return block + newline
    separator = newline if original.endswith(("\n", "\r")) else newline * 2
    if original.endswith(newline):
        separator = newline
    return original + separator + block + newline


def locate_rule(rules: list[str], expected: str) -> int:
    needle = normalize_text(expected)
    for index, rule in enumerate(rules):
        if normalize_text(rule) == needle:
            return index
    raise ReconcileError(f"managed rule not found: {expected}")


def normalized_effective_lines(text: str) -> set[str]:
    result: set[str] = set()
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("<!--") or line.startswith("#"):
            continue
        line = re.sub(r"^(?:[-+*]|\d+[.)])\s+", "", line).strip()
        normalized = normalize_text(line)
        if normalized:
            result.add(normalized)
    return result


def apply_decisions(original: str, decisions: list[dict[str, Any]]) -> tuple[str, list[str]]:
    rules, bounds = parse_rules(original)
    notes: list[str] = []
    for decision in decisions:
        action = decision.get("action")
        if action not in VALID_ACTIONS:
            raise ReconcileError(f"invalid action: {action}")
        if action in {"no-op", "needs_evidence"}:
            continue
        instruction = str(decision.get("instruction") or "").strip()
        text_fields = [instruction, str(decision.get("existing_instruction") or "")]
        text_fields.extend(str(value) for value in decision.get("existing_instructions") or [])
        if any(marker in value for value in text_fields for marker in (START_MARKER, END_MARKER)):
            raise ReconcileError("decision text must not contain managed block markers")
        if action == "add":
            if not instruction:
                raise ReconcileError("add requires instruction")
            if normalize_text(instruction) in {normalize_text(rule) for rule in rules}:
                notes.append(f"{decision['decision_id']}: exact duplicate became no-op")
            else:
                rules.append(instruction)
        elif action == "remove":
            existing = str(decision.get("existing_instruction") or "").strip()
            if not existing:
                raise ReconcileError("remove requires existing_instruction")
            rules.pop(locate_rule(rules, existing))
        elif action in {"narrow", "replace"}:
            existing = str(decision.get("existing_instruction") or "").strip()
            if not existing or not instruction:
                raise ReconcileError(f"{action} requires existing_instruction and instruction")
            index = locate_rule(rules, existing)
            equivalent_exists = any(
                other_index != index and normalize_text(rule) == normalize_text(instruction)
                for other_index, rule in enumerate(rules)
            )
            if equivalent_exists:
                rules.pop(index)
                notes.append(f"{decision['decision_id']}: replacement consolidated into equivalent existing rule")
            else:
                rules[index] = instruction
        elif action == "merge":
            existing_values = decision.get("existing_instructions")
            if not isinstance(existing_values, list) or not existing_values or not instruction:
                raise ReconcileError("merge requires existing_instructions and instruction")
            indices = sorted({locate_rule(rules, str(value)) for value in existing_values}, reverse=True)
            insert_at = min(indices)
            for index in indices:
                rules.pop(index)
            if normalize_text(instruction) in {normalize_text(rule) for rule in rules}:
                notes.append(f"{decision['decision_id']}: merge consolidated into equivalent existing rule")
            else:
                rules.insert(min(insert_at, len(rules)), instruction)
    updated = render_text(original, rules, bounds)
    parse_rules(updated)
    if len(updated.encode("utf-8")) > MAX_AGENTS_BYTES and len(updated.encode("utf-8")) > len(original.encode("utf-8")):
        raise ReconcileError("AGENTS.md would exceed 32 KiB; merge, narrow, replace, or remove rules instead of growing it")
    return updated, notes


def ensure_decision_ids(decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in decisions:
        decision = dict(raw)
        identifier = str(decision.get("decision_id") or "").strip()
        generated = not identifier or identifier.isdecimal()
        if generated:
            semantic_text = str(
                decision.get("instruction")
                or decision.get("existing_instruction")
                or "|".join(map(str, decision.get("existing_instructions") or []))
                or decision.get("semantic_scope")
                or decision.get("explanation")
                or ""
            )
            identifier = stable_id(
                str(decision.get("action")),
                str(decision.get("target")),
                str(decision.get("project_root")),
                semantic_text,
                prefix="D-",
            )
            base_identifier = identifier
            occurrence = 2
            while identifier in seen:
                identifier = f"{base_identifier}-{occurrence}"
                occurrence += 1
        if identifier in seen:
            raise ReconcileError(f"duplicate decision_id: {identifier}")
        decision["decision_id"] = identifier
        seen.add(identifier)
        result.append(decision)
    return result


def assign_selection_numbers(decisions: list[dict[str, Any]]) -> None:
    """Assign compact, plan-local numbers only to user-reviewable changes."""
    next_number = 1
    for decision in decisions:
        decision.pop("selection_number", None)
        if decision.get("action") in MUTATING_ACTIONS:
            decision["selection_number"] = next_number
            next_number += 1


def decision_fingerprint(decision: dict[str, Any], instruction: str | None = None) -> str:
    target = str(decision.get("target") or "")
    scope = "global" if target == "global" else path_key(Path(str(decision.get("project_root") or ".")).expanduser())
    text = instruction
    if text is None:
        text = str(decision.get("instruction") or decision.get("existing_instruction") or "")
    return stable_id(target, scope, normalize_text(text), prefix="C-")


def evidence_ref_scopes(batch: dict[str, Any]) -> dict[str, set[str]]:
    scopes = {str(value): set() for value in batch.get("record_ids", []) if str(value).strip()}

    def add_ref(value: Any, project_root: Any) -> None:
        ref = str(value or "").strip()
        if not ref:
            return
        roots = scopes.setdefault(ref, set())
        if isinstance(project_root, str) and project_root.strip():
            roots.add(path_key(Path(project_root)))

    def add_record(record: dict[str, Any]) -> None:
        record_id = str(record.get("record_id") or "").strip()
        session_id = str(record.get("session_id") or "").strip()
        turn_id = str(record.get("turn_id") or "").strip()
        project_root = record.get("project_root")
        add_ref(record_id, project_root)
        if session_id and turn_id:
            add_ref(f"{session_id}:{turn_id}", project_root)
            add_ref(f"{session_id}/{turn_id}", project_root)
        source = record.get("source") if isinstance(record.get("source"), dict) else {}
        for key in ("user_event_refs", "final_event_refs"):
            for value in source.get(key, []):
                add_ref(value, project_root)

    for record in batch.get("records", []):
        if isinstance(record, dict):
            add_record(record)
    for episode in batch.get("feedback_episode_candidates", []):
        if not isinstance(episode, dict):
            continue
        for record in episode.get("context_records", []):
            if isinstance(record, dict):
                add_record(record)
    return scopes


def evidence_ref_record_ids(batch: dict[str, Any]) -> dict[str, set[str]]:
    records_by_ref: dict[str, set[str]] = {}

    def add_ref(value: Any, record_id: str) -> None:
        ref = str(value or "").strip()
        if ref and record_id:
            records_by_ref.setdefault(ref, set()).add(record_id)

    def add_record(record: dict[str, Any]) -> None:
        record_id = str(record.get("record_id") or "").strip()
        if not record_id:
            return
        add_ref(record_id, record_id)
        session_id = str(record.get("session_id") or "").strip()
        turn_id = str(record.get("turn_id") or "").strip()
        if session_id and turn_id:
            add_ref(f"{session_id}:{turn_id}", record_id)
            add_ref(f"{session_id}/{turn_id}", record_id)
        source = record.get("source") if isinstance(record.get("source"), dict) else {}
        for key in ("user_event_refs", "final_event_refs"):
            for value in source.get(key, []):
                add_ref(value, record_id)

    for record in batch.get("records", []):
        if isinstance(record, dict):
            add_record(record)
    for episode in batch.get("feedback_episode_candidates", []):
        if not isinstance(episode, dict):
            continue
        for record in episode.get("context_records", []):
            if isinstance(record, dict):
                add_record(record)
    for value in batch.get("record_ids", []):
        record_id = str(value).strip()
        add_ref(record_id, record_id)
    return records_by_ref


def apply_state_gates(
    decisions: list[dict[str, Any]],
    state: dict[str, Any],
    mode: str,
    ref_scopes: dict[str, set[str]],
    explicit_project_roots: set[str] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    tombstones = state.get("tombstones", {})
    rejected = state.get("rejected_candidates", {})
    result: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for original in decisions:
        decision = dict(original)
        action = decision.get("action")
        identifier = decision["decision_id"]
        if action not in VALID_ACTIONS:
            errors.append({"decision_id": identifier, "error": f"invalid action: {action}"})
            result.append(decision)
            continue
        if action in {"add", "merge", "narrow", "replace"}:
            fingerprint = decision_fingerprint(decision)
            if fingerprint in tombstones and not decision.get("restore_tombstone"):
                decision["action"] = "no-op"
                decision["explanation"] = "blocked by a scoped tombstone; explicit restore is required"
            elif fingerprint in rejected and not decision.get("override_prior_rejection"):
                decision["action"] = "no-op"
                decision["explanation"] = "equivalent scoped candidate was previously rejected"
            else:
                decision_evidence = {str(value) for value in decision.get("evidence_refs", [])}
                target_scope = str(decision.get("target") or "")
                project_scope = path_key(Path(str(decision.get("project_root")))) if target_scope == "project" and decision.get("project_root") else None

                def same_scope(entry: Any) -> bool:
                    if not isinstance(entry, dict) or entry.get("target") != target_scope:
                        return False
                    if target_scope == "global":
                        return True
                    value = entry.get("project_root")
                    return isinstance(value, str) and project_scope == path_key(Path(value))

                tombstone_match = next(
                    (
                        key
                        for key, entry in tombstones.items()
                        if same_scope(entry) and decision_evidence.intersection(str(value) for value in entry.get("evidence_refs", []))
                    ),
                    None,
                )
                rejection_match = next(
                    (
                        key
                        for key, entry in rejected.items()
                        if same_scope(entry) and decision_evidence.intersection(str(value) for value in entry.get("evidence_refs", []))
                    ),
                    None,
                )
                if tombstone_match and not decision.get("restore_tombstone"):
                    decision["action"] = "no-op"
                    decision["explanation"] = "feedback evidence was already withdrawn; explicit restore is required"
                elif rejection_match and not decision.get("override_prior_rejection"):
                    decision["action"] = "no-op"
                    decision["explanation"] = "feedback evidence already produced a rejected candidate"
        action = decision.get("action")
        if action in MUTATING_ACTIONS:
            evidence_refs = decision.get("evidence_refs")
            if not isinstance(evidence_refs, list) or not evidence_refs:
                errors.append({"decision_id": identifier, "error": "mutating decision requires at least one evidence_ref"})
            else:
                unknown_refs = sorted({str(value) for value in evidence_refs if str(value) not in ref_scopes})
                if unknown_refs:
                    errors.append({"decision_id": identifier, "error": f"untrusted evidence_refs: {unknown_refs}"})
                if decision.get("target") == "project" and decision.get("project_root"):
                    target_scope = path_key(Path(str(decision["project_root"])))
                    wrong_scope = []
                    if target_scope not in (explicit_project_roots or set()):
                        wrong_scope = sorted(
                            {
                                str(value)
                                for value in evidence_refs
                                if not ref_scopes.get(str(value)) or target_scope not in ref_scopes[str(value)]
                            }
                        )
                    if wrong_scope:
                        errors.append({"decision_id": identifier, "error": f"evidence_refs belong to another project: {wrong_scope}"})
            if mode == "auto" and (decision.get("confidence") != "high" or decision.get("risk_of_overconstraint") != "low"):
                errors.append(
                    {
                        "decision_id": identifier,
                        "error": "Auto mutation requires confidence=high and risk_of_overconstraint=low",
                    }
                )
            if mode == "auto" and decision.get("target") == "global":
                evidence_projects = {
                    scope
                    for value in (evidence_refs if isinstance(evidence_refs, list) else [])
                    for scope in ref_scopes.get(str(value), set())
                }
                if len(evidence_projects) < 2:
                    errors.append(
                        {
                            "decision_id": identifier,
                            "error": "Auto global mutation requires evidence from two project roots",
                        }
                    )
        result.append(decision)
    return result, errors


def coverage_errors(
    decisions: list[dict[str, Any]],
    batch: dict[str, Any],
    ref_scopes: dict[str, set[str]],
    required_record_ids: set[str] | None = None,
) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    covered_records: set[str] = set()
    record_ids = (
        required_record_ids
        if required_record_ids is not None
        else {str(value) for value in batch.get("record_ids", []) if str(value).strip()}
    )
    records_by_ref = evidence_ref_record_ids(batch)
    for decision in decisions:
        identifier = str(decision.get("decision_id") or "")
        evidence_refs = decision.get("evidence_refs")
        if not isinstance(evidence_refs, list) or not evidence_refs:
            errors.append({"decision_id": identifier, "error": "every decision requires at least one evidence_ref"})
            continue
        refs = {str(value) for value in evidence_refs}
        unknown_refs = sorted(refs - set(ref_scopes))
        if unknown_refs:
            errors.append({"decision_id": identifier, "error": f"untrusted evidence_refs: {unknown_refs}"})
        for ref in refs:
            covered_records.update(records_by_ref.get(ref, set()))
        if decision.get("action") not in MUTATING_ACTIONS:
            evidence_projects = {scope for ref in refs for scope in ref_scopes.get(ref, set())}
            if len(evidence_projects) > 1:
                errors.append(
                    {
                        "decision_id": identifier,
                        "error": "non-mutating decision evidence spans multiple projects",
                    }
                )
            if decision.get("target") == "project" and decision.get("project_root"):
                target_scope = path_key(Path(str(decision["project_root"])))
                wrong_scope = sorted(ref for ref in refs if not ref_scopes.get(ref) or target_scope not in ref_scopes[ref])
                if wrong_scope:
                    errors.append(
                        {
                            "decision_id": identifier,
                            "error": f"evidence_refs belong to another project: {wrong_scope}",
                        }
                    )
        if decision.get("action") == "no-op" and not str(decision.get("explanation") or "").strip():
            errors.append({"decision_id": identifier, "error": "no-op decision requires a specific explanation"})
    uncovered = sorted(record_ids - covered_records)
    if uncovered:
        errors.append(
            {
                "decision_id": "batch-coverage",
                "error": f"batch records lack explicit decision coverage: {uncovered}",
            }
        )
    return errors


def edited_acceptance_errors(decisions: list[dict[str, Any]], state: dict[str, Any]) -> tuple[bool, list[dict[str, str]]]:
    superseding = [item for item in decisions if str(item.get("supersedes_decision_id") or "").strip()]
    if not superseding:
        return False, []
    errors: list[dict[str, str]] = []
    if len(superseding) != len(decisions):
        errors.append({"decision_id": "edited-acceptance", "error": "an edited acceptance plan cannot mix superseding and ordinary decisions"})
        return False, errors
    pending = state.get("pending_decisions", {}) if isinstance(state.get("pending_decisions"), dict) else {}
    seen: set[str] = set()
    for decision in decisions:
        identifier = str(decision.get("decision_id") or "")
        supersedes = str(decision.get("supersedes_decision_id") or "").strip()
        prior_entry = pending.get(supersedes)
        prior = prior_entry.get("decision") if isinstance(prior_entry, dict) else None
        if supersedes in seen:
            errors.append({"decision_id": identifier, "error": f"superseded pending decision is reused: {supersedes}"})
        seen.add(supersedes)
        if not isinstance(prior, dict):
            errors.append({"decision_id": identifier, "error": f"superseded decision is not pending: {supersedes}"})
            continue
        if decision.get("target") != prior.get("target"):
            errors.append({"decision_id": identifier, "error": "edited decision target differs from the pending decision"})
        if decision.get("target") == "project" and path_key(Path(str(decision.get("project_root") or "."))) != path_key(
            Path(str(prior.get("project_root") or "."))
        ):
            errors.append({"decision_id": identifier, "error": "edited decision project differs from the pending decision"})
        if not set(map(str, decision.get("evidence_refs", []))).issubset(set(map(str, prior.get("evidence_refs", [])))):
            errors.append({"decision_id": identifier, "error": "edited decision introduces evidence not present in the pending decision"})
    return not errors, errors


def path_key(path: Path) -> str:
    return os.path.normcase(str(path.resolve()))


def target_for(decision: dict[str, Any], allowed_roots: dict[str, Path], home: Path) -> tuple[Path, str, Path | None]:
    target = decision.get("target")
    if target == "global":
        if decision.get("project_root") is not None:
            raise ReconcileError("global decision must not contain project_root")
        return home / "AGENTS.md", "global", None
    if target != "project":
        raise ReconcileError(f"invalid target: {target}")
    root_value = decision.get("project_root")
    if not isinstance(root_value, str) or not root_value.strip():
        raise ReconcileError("project decision requires project_root")
    requested = Path(root_value).expanduser().resolve()
    root = allowed_roots.get(path_key(requested))
    if root is None:
        raise ReconcileError(f"project root was not derived from trusted session metadata: {requested}")
    return root / "AGENTS.md", "project", root


def agents_dirty(root: Path | None) -> bool:
    if root is None:
        return False
    result = subprocess.run(
        ["git", "-C", str(root), "status", "--porcelain", "--", "AGENTS.md"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return result.returncode == 0 and bool(result.stdout.strip())


def active_override(target: Path) -> str | None:
    override = target.with_name("AGENTS.override.md")
    try:
        if override.exists() and override.read_text(encoding="utf-8-sig").strip():
            return str(override)
    except (OSError, UnicodeDecodeError):
        return str(override)
    return None


def unified_diff(path: Path, old: str, new: str) -> str:
    before = old.splitlines(keepends=True)
    after = new.splitlines(keepends=True)
    return "".join(difflib.unified_diff(before, after, fromfile=f"a/{path.name}", tofile=f"b/{path.name}", n=0))


def reconcile(decisions_value: Any, batch: dict[str, Any], home: Path, mode: str, state: dict[str, Any] | None = None) -> dict[str, Any]:
    batch_quota = batch.get("quota_gate")
    if batch_quota is not None and batch_quota.get("allowed") is not True:
        raise ReconcileError("batch quota gate is blocked or unknown")
    if isinstance(decisions_value, dict) and "decisions" not in decisions_value:
        raise ReconcileError("decision object must contain a decisions array")
    aggregation_state: dict[str, Any] | None = None
    if isinstance(decisions_value, dict) and decisions_value.get("review_protocol") == "project-then-global-v1":
        pending_candidates = decisions_value.get("pending_global_candidates")
        if not isinstance(pending_candidates, dict):
            raise ReconcileError("completed global aggregation requires pending_global_candidates")
        for identifier, candidate in pending_candidates.items():
            if not isinstance(candidate, dict) or str(candidate.get("candidate_id") or "") != str(identifier):
                raise ReconcileError("pending global candidate keys must match candidate_id values")
            if not str(candidate.get("instruction") or "").strip() or not str(candidate.get("semantic_scope") or "").strip():
                raise ReconcileError(f"pending global candidate {identifier} is incomplete")
            if not isinstance(candidate.get("sources"), list) or not candidate["sources"]:
                raise ReconcileError(f"pending global candidate {identifier} has no sources")
        aggregation_state = pending_candidates
    raw_decisions = decisions_value.get("decisions") if isinstance(decisions_value, dict) else decisions_value
    if not isinstance(raw_decisions, list):
        raise ReconcileError("decisions must be a JSON array or an object containing decisions")
    if batch.get("record_ids") and not raw_decisions:
        raise ReconcileError("a non-empty batch requires at least one explicit decision, including no-op")
    decisions = ensure_decision_ids(raw_decisions)
    ref_scopes = evidence_ref_scopes(batch)
    explicit_project_roots = {path_key(Path(value)) for value in batch.get("explicit_project_roots", [])}
    current_state = state or {}
    decisions, gate_errors = apply_state_gates(decisions, current_state, mode, ref_scopes, explicit_project_roots)
    edited_acceptance, edit_errors = edited_acceptance_errors(decisions, current_state)
    records_by_ref = evidence_ref_record_ids(batch)
    edited_record_ids = {
        record_id
        for decision in decisions
        for ref in map(str, decision.get("evidence_refs", []))
        for record_id in records_by_ref.get(ref, set())
    }
    batch_record_ids = {str(value) for value in batch.get("record_ids", []) if str(value).strip()}
    plan_record_ids = sorted(edited_record_ids & batch_record_ids) if edited_acceptance else list(batch.get("record_ids", []))
    allowed_roots = {path_key(Path(value)): Path(value).expanduser().resolve() for value in batch.get("allowed_project_roots", [])}

    grouped: dict[str, dict[str, Any]] = {}
    decision_errors: list[dict[str, str]] = [
        *gate_errors,
        *edit_errors,
        *coverage_errors(decisions, batch, ref_scopes, set(plan_record_ids)),
    ]
    for decision in decisions:
        try:
            path, scope, root = target_for(decision, allowed_roots, home)
        except ReconcileError as error:
            decision_errors.append({"decision_id": decision["decision_id"], "error": str(error)})
            continue
        if decision.get("action") in {"no-op", "needs_evidence"}:
            continue
        key = path_key(path)
        grouped.setdefault(key, {"path": path, "scope": scope, "project_root": root, "decisions": []})["decisions"].append(decision)

    targets: list[dict[str, Any]] = []
    for group in grouped.values():
        path: Path = group["path"]
        try:
            raw, current = read_agents(path)
            existing_rules, _ = parse_rules(current)
            normalized_existing = {
                *{normalize_text(rule) for rule in existing_rules},
                *normalized_effective_lines(current),
            }
            if group["scope"] == "project":
                global_path = home / "AGENTS.md"
                if global_path.exists():
                    try:
                        global_text = global_path.read_text(encoding="utf-8-sig")
                    except (OSError, UnicodeDecodeError) as error:
                        raise ReconcileError(f"cannot inspect effective global AGENTS.md: {error}") from error
                    normalized_existing.update(normalized_effective_lines(global_text))
            for decision in group["decisions"]:
                if decision.get("action") == "add":
                    normalized_instruction = normalize_text(str(decision.get("instruction") or ""))
                    if normalized_instruction in normalized_existing:
                        decision["action"] = "no-op"
                        decision["explanation"] = "existing or earlier batch rule already exactly covers this instruction"
                    else:
                        normalized_existing.add(normalized_instruction)
            active_decisions = [decision for decision in group["decisions"] if decision.get("action") in MUTATING_ACTIONS]
            if not active_decisions:
                continue
            updated, notes = apply_decisions(current, active_decisions)
        except (OSError, ReconcileError) as error:
            decision_errors.extend({"decision_id": item["decision_id"], "error": str(error)} for item in group["decisions"])
            continue
        targets.append(
            {
                "path": str(path.absolute()),
                "scope": group["scope"],
                "project_root": str(group["project_root"]) if group["project_root"] else None,
                "existed": path.exists(),
                "base_sha256": sha256_bytes(raw),
                "new_sha256": sha256_bytes(encode_agents(updated, raw)),
                "diff": unified_diff(path, current, updated),
                "changed": current != updated,
                "decision_ids": [decision["decision_id"] for decision in active_decisions],
                "notes": notes,
                "agents_md_dirty": agents_dirty(group["project_root"]) if mode == "suggest" else None,
                "inactive_due_to_override": active_override(path),
            }
        )

    assign_selection_numbers(decisions)
    plan = {
        "version": 1,
        "mode": mode,
        "codex_home": str(home),
        "decisions": decisions,
        "record_ids": plan_record_ids,
        "edited_acceptance": edited_acceptance,
        "trusted_evidence_refs": sorted(ref_scopes),
        "evidence_ref_scopes": {ref: sorted(scopes) for ref, scopes in ref_scopes.items()},
        "state_guard": {
            "tombstones": sorted((state or {}).get("tombstones", {})),
            "rejected_candidates": sorted((state or {}).get("rejected_candidates", {})),
            "constraint_revision": int((state or {}).get("constraint_revision", 0)),
            "scope_revisions": dict((state or {}).get("scope_revisions", {})),
        },
        "allowed_project_roots": [str(path) for path in allowed_roots.values()],
        "explicit_project_roots": sorted(explicit_project_roots),
        "targets": targets,
        "errors": decision_errors,
    }
    if aggregation_state is not None:
        plan["review_protocol"] = "project-then-global-v1"
        plan["pending_global_candidates"] = aggregation_state
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(description="Reconcile structured memory decisions against managed AGENTS.md blocks and produce a reviewable plan.")
    parser.add_argument("--decisions", required=True)
    parser.add_argument("--batch", required=True)
    parser.add_argument("--codex-home")
    parser.add_argument("--state")
    parser.add_argument("--mode", choices=("suggest", "auto", "confirmed-suggest"), default="suggest")
    parser.add_argument("--model")
    parser.add_argument("--reasoning-effort", choices=("low", "medium", "high"), default="high")
    parser.add_argument("--quota-result")
    parser.add_argument("--output")
    args = parser.parse_args()
    decisions = load_json(Path(args.decisions).expanduser().resolve(), [])
    batch = load_json(Path(args.batch).expanduser().resolve(), {})
    state = load_json(Path(args.state).expanduser().resolve(), {}) if args.state else {}
    quota = load_json(Path(args.quota_result).expanduser().resolve(), {}) if args.quota_result else None
    if quota is not None and quota.get("allowed") is not True:
        parser.error("quota result is blocked or unknown; refusing to reconcile")
    if quota is not None and args.reasoning_effort != "high":
        parser.error("Scheduled runs require --reasoning-effort high")
    if batch.get("record_ids") and (
        not isinstance(decisions, dict)
        or decisions.get("review_protocol") != "project-then-global-v1"
    ):
        parser.error("run aggregate_global_candidates.py prepare and finalize before reconciliation")
    try:
        result = reconcile(decisions, batch, codex_home(args.codex_home), args.mode, state)
    except ReconcileError as error:
        parser.error(str(error))
    result["run_metadata"] = {
        "model": args.model,
        "reasoning_effort": args.reasoning_effort,
        "quota": quota,
    }
    write_json_output(result, args.output)
    return 0 if not result["errors"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
