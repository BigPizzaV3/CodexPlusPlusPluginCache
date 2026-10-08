#!/usr/bin/env python3
"""Atomic lead-state operations with lifecycle-aware deduplication."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


ALLOWED_STATUSES = {"to_apply", "monitor", "applied", "archived", "deleted"}
IDENTITY_QUERY_KEYS = {
    "currentjobid",
    "gh_jid",
    "id",
    "jid",
    "jk",
    "jl",
    "job",
    "job_id",
    "jobid",
    "jobposting_id",
    "jobpostingid",
    "position_id",
    "positionid",
    "posting_id",
    "postingid",
    "requisition_id",
    "requisitionid",
    "vacancy_id",
    "vacancyid",
}
GENERIC_JOB_PATHS = {
    "",
    "/",
    "/careers",
    "/job-search",
    "/jobs",
    "/jobs/search",
    "/open-positions",
    "/positions",
    "/search",
    "/vacancies",
}
ASSESSMENT_FIELDS = (
    "match_strengths",
    "fit_gaps",
    "eligibility_constraints",
    "application_requirements",
    "search_notes",
)
APPLICATION_TERMS = (
    "transcript",
    "degree certificate",
    "diploma",
    "referee",
    "reference letter",
    "merged application pdf",
    "application pdf",
    "upload",
    "online submission",
    "application asks",
    "application form",
    "application is by email",
    "apply flow",
    "fallback email",
    "cover letter",
    "motivation letter",
    "letter of motivation",
    "curriculum vitae",
    "submit a cv",
    "requires a cv",
    "portfolio",
    "publication list",
    "supporting document",
    "application material",
    "writing sample",
    "research proposal",
    "statement of purpose",
    "academic record",
    "proof of degree",
    "deadline",
)
ELIGIBILITY_TERMS = (
    "contract role",
    "fixed-term",
    "temporary",
    "maternity-cover",
    "maternity cover",
    "on-site",
    "onsite",
    "relocation",
    "travel",
    "driving licence",
    "driver licence",
    "driver's license",
    "full-time",
    "part-time",
    "work permit",
    "sponsorship",
    "german required",
    "french required",
    "fluent german",
    "german proficiency",
    "german level",
    "fluent french",
    "french proficiency",
    "french level",
    "italian required",
    "citizenship",
)
SEARCH_NOTE_TERMS = (
    "legacy package",
    "do not reuse",
    "keep as monitor",
    "manual review",
    "package deferred",
    "human review",
    "not an automatic",
    "worth reviewing",
    "lower strategic priority",
    "security checkpoint",
    "canonical lead",
)


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=True)
            handle.write("\n")
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def normalized_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def normalized_url(value: str) -> str:
    if not value:
        return ""
    if value.startswith("mailto:"):
        return ""
    parts = urlsplit(value)
    host = parts.netloc.lower().removeprefix("www.")
    if not host:
        return ""
    path = re.sub(r"/+", "/", parts.path).rstrip("/")
    identity_query = sorted(
        (key.lower(), item)
        for key, item in parse_qsl(parts.query, keep_blank_values=False)
        if key.lower() in IDENTITY_QUERY_KEYS and item
    )
    if path.lower() in GENERIC_JOB_PATHS and not identity_query:
        return ""
    return urlunsplit(("https", host, path, urlencode(identity_query), ""))


def dedupe_keys(record: dict) -> set[str]:
    keys: set[str] = set()
    for field in ("id", "source_job_id"):
        value = str(record.get(field) or "").strip().lower()
        if value:
            keys.add(f"id:{value}")
    for field in ("job_url", "apply_url"):
        value = normalized_url(str(record.get(field) or ""))
        if value:
            keys.add(f"url:{value}")
    organization = normalized_text(str(record.get("organization") or record.get("company") or ""))
    title = normalized_text(str(record.get("title") or ""))
    location = normalized_text(str(record.get("location") or ""))
    if organization and title:
        keys.add(f"role:{organization}|{title}|{location}")
    return keys


def intersects(left: dict, right: dict) -> bool:
    return not dedupe_keys(left).isdisjoint(dedupe_keys(right))


def unique_strings(values: object) -> list[str]:
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, list):
        return []
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        cleaned = value.strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            output.append(cleaned)
            seen.add(key)
    return output


def assessment_bucket(value: str) -> str:
    text = value.lower()
    if any(term in text for term in APPLICATION_TERMS):
        return "application_requirements"
    if any(term in text for term in SEARCH_NOTE_TERMS):
        return "search_notes"
    if any(term in text for term in ELIGIBILITY_TERMS):
        return "eligibility_constraints"
    return "fit_gaps"


def assessment_clauses(value: str) -> list[str]:
    text = value.replace("; ", ";\n").replace(". ", ".\n")
    prefixes = ("manual check before applying:", "manual check:", "stretch role:", "high stretch:")
    output: list[str] = []
    for clause in text.splitlines():
        cleaned = clause.strip()
        lowered = cleaned.lower()
        for prefix in prefixes:
            if lowered.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
                break
        if cleaned:
            output.append(cleaned)
    return output


def normalize_assessment(record: dict) -> bool:
    before = {key: record.get(key) for key in ASSESSMENT_FIELDS}
    before["assessment_schema_version"] = record.get("assessment_schema_version")
    had_structured = any(key in record for key in ASSESSMENT_FIELDS)
    buckets = {key: unique_strings(record.get(key)) for key in ASSESSMENT_FIELDS}

    rationale = str(record.get("rationale") or "").strip()
    if rationale and not buckets["match_strengths"]:
        buckets["match_strengths"] = [rationale]

    concerns = str(record.get("concerns") or "").strip()
    if concerns and not had_structured:
        for clause in assessment_clauses(concerns):
            buckets[assessment_bucket(clause)].append(clause)

    corrected_gaps: list[str] = []
    for item in buckets["fit_gaps"]:
        destination = assessment_bucket(item)
        if destination == "application_requirements":
            buckets[destination].append(item)
        else:
            corrected_gaps.append(item)
    buckets["fit_gaps"] = corrected_gaps

    for key in ASSESSMENT_FIELDS:
        record[key] = unique_strings(buckets[key])
    record["assessment_schema_version"] = 2
    after = {key: record.get(key) for key in ASSESSMENT_FIELDS}
    after["assessment_schema_version"] = record.get("assessment_schema_version")
    return before != after


def validate_state(state: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(state.get("leads"), list):
        errors.append("leads must be an array")
    if not isinstance(state.get("deleted_leads", []), list):
        errors.append("deleted_leads must be an array")
    if not isinstance(state.get("lead_tombstones", []), list):
        errors.append("lead_tombstones must be an array")
    seen: list[dict] = []
    for record in state.get("leads", []) + state.get("deleted_leads", []):
        status = str(record.get("status") or "to_apply")
        if status not in ALLOWED_STATUSES:
            errors.append(f"invalid status {status!r} for {record.get('id')}")
        if any(intersects(record, previous) for previous in seen):
            errors.append(f"duplicate lead detected: {record.get('id')}")
        for field in ASSESSMENT_FIELDS:
            if field in record and not isinstance(record[field], list):
                errors.append(f"{field} must be an array for {record.get('id')}")
        for item in unique_strings(record.get("fit_gaps")):
            if assessment_bucket(item) == "application_requirements":
                errors.append(
                    f"application logistics found in fit_gaps for {record.get('id')}: {item}"
                )
        seen.append(record)
    return errors


def upsert(state_path: Path, candidate: dict) -> dict:
    state = load_json(state_path)
    candidate = dict(candidate)
    status = str(candidate.get("status") or "to_apply").lower().replace(" ", "_")
    candidate["status"] = status if status in ALLOWED_STATUSES else "to_apply"
    candidate.setdefault("created_at", timestamp())
    candidate["updated_at"] = timestamp()
    normalize_assessment(candidate)

    for record in state.get("deleted_leads", []):
        if intersects(candidate, record):
            return {"result": "skipped", "reason": "recently_deleted", "id": record.get("id")}
    for marker in state.get("lead_tombstones", []):
        if intersects(candidate, marker):
            return {"result": "skipped", "reason": "tombstoned", "id": marker.get("id")}

    leads = state.setdefault("leads", [])
    for index, record in enumerate(leads):
        if not intersects(candidate, record):
            continue
        existing_status = str(record.get("status") or "to_apply")
        if existing_status in {"applied", "archived"}:
            return {"result": "skipped", "reason": existing_status, "id": record.get("id")}
        protected = {
            key: record[key]
            for key in (
                "id",
                "source_job_id",
                "status",
                "user_notes",
                "created_at",
                "applied_at",
                "archived_at",
            )
            if key in record
        }
        merged = dict(record)
        merged.update({key: value for key, value in candidate.items() if value not in (None, "", [])})
        merged.update(protected)
        merged["updated_at"] = timestamp()
        normalize_assessment(merged)
        leads[index] = merged
        state["version"] = max(int(state.get("version") or 1), 3)
        state["updated_at"] = timestamp()
        atomic_write(state_path, state)
        return {"result": "updated", "id": merged.get("id")}

    leads.append(candidate)
    state["version"] = max(int(state.get("version") or 1), 3)
    state["updated_at"] = timestamp()
    atomic_write(state_path, state)
    return {"result": "added", "id": candidate.get("id")}


def consolidate(state_path: Path, keep_id: str, remove_id: str) -> dict:
    if keep_id == remove_id:
        raise ValueError("keep and remove IDs must differ")
    state = load_json(state_path)
    leads = state.get("leads", [])
    canonical = next((dict(record) for record in leads if record.get("id") == keep_id), None)
    duplicate = next((dict(record) for record in leads if record.get("id") == remove_id), None)
    if canonical is None:
        raise ValueError(f"canonical lead not found: {keep_id}")
    if duplicate is None:
        raise ValueError(f"duplicate lead not found: {remove_id}")
    if not intersects(canonical, duplicate) and duplicate.get("duplicate_of") != keep_id:
        raise ValueError("records do not share a dedupe key and duplicate_of does not name the canonical lead")

    conflicts: dict[str, object] = {}
    for key, value in duplicate.items():
        existing = canonical.get(key)
        if existing in (None, "", []):
            canonical[key] = value
        elif isinstance(existing, list) and isinstance(value, list):
            canonical[key] = list(dict.fromkeys(existing + value))
        elif isinstance(existing, dict) and isinstance(value, dict):
            canonical[key] = {**value, **existing}
        elif existing != value:
            conflicts[key] = value

    merged_ids = list(canonical.get("merged_legacy_ids") or [])
    for identifier in [remove_id] + list(duplicate.get("merged_legacy_ids") or []):
        if identifier not in merged_ids:
            merged_ids.append(identifier)
    canonical["merged_legacy_ids"] = merged_ids
    if conflicts:
        preserved = dict(canonical.get("legacy_merge_conflicts") or {})
        preserved[remove_id] = conflicts
        canonical["legacy_merge_conflicts"] = preserved
    canonical["updated_at"] = timestamp()

    state["leads"] = [
        canonical if record.get("id") == keep_id else record
        for record in leads
        if record.get("id") != remove_id
    ]
    normalize_assessment(canonical)
    state["version"] = max(int(state.get("version") or 1), 3)
    state["updated_at"] = timestamp()
    atomic_write(state_path, state)
    return {"result": "consolidated", "kept": keep_id, "removed": remove_id}


def record_run(workspace: Path, payload: dict) -> Path:
    output = workspace / "Automation/automation_status.json"
    payload = dict(payload)
    payload.setdefault("last_run_at", timestamp())
    payload.setdefault("leads_added", 0)
    payload.setdefault("packages_created", 0)
    atomic_write(output, payload)
    return output


def migrate_assessments(state_path: Path) -> dict:
    state = load_json(state_path)
    changed = 0
    for collection in ("leads", "deleted_leads"):
        for record in state.get(collection, []):
            if normalize_assessment(record):
                changed += 1
    state["version"] = max(int(state.get("version") or 1), 3)
    state["updated_at"] = timestamp()
    atomic_write(state_path, state)
    return {"result": "migrated", "records_changed": changed, "version": state["version"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)
    upsert_parser = subparsers.add_parser("upsert")
    upsert_parser.add_argument("--lead-file", type=Path, required=True)
    subparsers.add_parser("validate")
    subparsers.add_parser("migrate-assessments")
    subparsers.add_parser("dedupe-keys")
    consolidate_parser = subparsers.add_parser("consolidate")
    consolidate_parser.add_argument("--keep-id", required=True)
    consolidate_parser.add_argument("--remove-id", required=True)
    run_parser = subparsers.add_parser("record-run")
    run_parser.add_argument("--run-file", type=Path, required=True)
    args = parser.parse_args()

    workspace = args.workspace.expanduser().resolve()
    state_path = workspace / "State/cv_command_center_state.json"
    if args.command == "upsert":
        result = upsert(state_path, load_json(args.lead_file))
        print(json.dumps(result, indent=2))
        return 0
    if args.command == "validate":
        errors = validate_state(load_json(state_path))
        print(json.dumps({"valid": not errors, "errors": errors}, indent=2))
        return 0 if not errors else 2
    if args.command == "migrate-assessments":
        print(json.dumps(migrate_assessments(state_path), indent=2))
        return 0
    if args.command == "dedupe-keys":
        state = load_json(state_path)
        records = state.get("leads", []) + state.get("deleted_leads", []) + state.get("lead_tombstones", [])
        print(json.dumps(sorted(set().union(*(dedupe_keys(record) for record in records))), indent=2))
        return 0
    if args.command == "consolidate":
        try:
            result = consolidate(state_path, args.keep_id, args.remove_id)
        except ValueError as exc:
            print(json.dumps({"result": "error", "reason": str(exc)}, indent=2))
            return 2
        print(json.dumps(result, indent=2))
        return 0
    if args.command == "record-run":
        output = record_run(workspace, load_json(args.run_file))
        print(json.dumps({"written": str(output)}, indent=2))
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
