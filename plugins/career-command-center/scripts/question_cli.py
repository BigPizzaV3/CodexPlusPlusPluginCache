#!/usr/bin/env python3
"""Manage source-specific evidence questions for a Career Command Center workspace."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


QUESTION_RELATIVE_PATH = Path("Evidence_Bank/personalized_questions.json")
VALID_PRIORITIES = {"critical", "high", "medium"}
VALID_CATEGORIES = {
    "metric",
    "ownership",
    "outcome",
    "method",
    "timeline",
    "contradiction",
    "eligibility",
    "direction",
    "other",
}
RESPONSE_STATUSES = {"answered", "unable_to_verify", "not_applicable"}
TERMINAL_STATUSES = {"resolved", "not_applicable", "superseded"}
VALID_STATUSES = {"open"} | RESPONSE_STATUSES | TERMINAL_STATUSES
VALID_AUDIT_STATUSES = {"not_started", "current", "needs_refresh"}
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{4,119}$")
GENERIC_QUESTION_PATTERNS = [
    re.compile(r"^tell me more\b", re.IGNORECASE),
    re.compile(r"^can you elaborate\b", re.IGNORECASE),
    re.compile(r"^please explain\b", re.IGNORECASE),
    re.compile(r"^describe (?:your|the) (?:project|role|experience)\b", re.IGNORECASE),
    re.compile(r"^what (?:did you do|are your strengths)\b", re.IGNORECASE),
]


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())


def empty_bank() -> dict[str, Any]:
    return {
        "version": 1,
        "generation_id": "",
        "audit_status": "not_started",
        "source_change_note": "",
        "generated_at": "",
        "updated_at": timestamp(),
        "questions": [],
    }


def question_path(workspace: Path) -> Path:
    return workspace / QUESTION_RELATIVE_PATH


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def load_bank(workspace: Path) -> dict[str, Any]:
    path = question_path(workspace)
    if not path.exists():
        bank = empty_bank()
        write_json(path, bank)
        return bank
    payload = load_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    validate_bank(payload)
    return payload


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(value, indent=2, ensure_ascii=True, sort_keys=True) + "\n"
    handle, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(data)
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def ensure_text(value: Any, field: str, minimum: int, maximum: int) -> str:
    text = clean_text(value)
    if len(text) < minimum or len(text) > maximum:
        raise ValueError(f"{field} must contain {minimum}-{maximum} characters")
    return text


def normalize_source(raw: Any, index: int, workspace: Path | None = None) -> dict[str, str]:
    if not isinstance(raw, dict):
        raise ValueError(f"source_refs[{index}] must be an object")
    path_value = ensure_text(raw.get("path"), f"source_refs[{index}].path", 1, 500)
    source_path = Path(path_value)
    if source_path.is_absolute() or path_value.startswith("~") or ".." in source_path.parts:
        raise ValueError(f"source_refs[{index}].path must be workspace-relative")
    if workspace is not None and not (workspace / source_path).is_file():
        raise ValueError(f"source_refs[{index}].path does not exist in the workspace: {path_value}")
    return {
        "path": source_path.as_posix(),
        "label": ensure_text(raw.get("label"), f"source_refs[{index}].label", 2, 160),
        "locator": ensure_text(raw.get("locator"), f"source_refs[{index}].locator", 2, 160),
        "context": ensure_text(raw.get("context"), f"source_refs[{index}].context", 10, 400),
    }


def normalize_question(raw: Any, generated_at: str, workspace: Path) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("Each question must be an object")
    identifier = clean_text(raw.get("id"))
    if not ID_PATTERN.fullmatch(identifier):
        raise ValueError(
            "Question id must be 5-120 lower-case letters, numbers, dots, underscores, or hyphens"
        )
    priority = clean_text(raw.get("priority")).lower()
    if priority not in VALID_PRIORITIES:
        raise ValueError(f"Question {identifier} has invalid priority: {priority}")
    category = clean_text(raw.get("category")).lower()
    if category not in VALID_CATEGORIES:
        raise ValueError(f"Question {identifier} has invalid category: {category}")
    question = ensure_text(raw.get("question"), f"Question {identifier}.question", 20, 500)
    if not question.endswith("?"):
        raise ValueError(f"Question {identifier}.question must end with a question mark")
    if any(pattern.search(question) for pattern in GENERIC_QUESTION_PATTERNS):
        raise ValueError(f"Question {identifier} is generic; tie it to the cited source ambiguity")
    why = ensure_text(raw.get("why_it_matters"), f"Question {identifier}.why_it_matters", 10, 400)
    sources = raw.get("source_refs")
    if not isinstance(sources, list) or not sources:
        raise ValueError(f"Question {identifier} requires at least one source reference")
    evidence_ids = raw.get("related_evidence_ids") or []
    if not isinstance(evidence_ids, list) or not all(isinstance(item, str) for item in evidence_ids):
        raise ValueError(f"Question {identifier}.related_evidence_ids must be an array of strings")
    return {
        "id": identifier,
        "priority": priority,
        "category": category,
        "question": question,
        "why_it_matters": why,
        "source_refs": [
            normalize_source(source, index, workspace) for index, source in enumerate(sources)
        ],
        "related_evidence_ids": [clean_text(item) for item in evidence_ids if clean_text(item)],
        "status": "open",
        "answer": "",
        "generated_at": generated_at,
        "answered_at": "",
        "reviewed_at": "",
        "review_note": "",
    }


def validate_bank(bank: dict[str, Any]) -> None:
    if bank.get("version") != 1:
        raise ValueError("personalized_questions.json must use version 1")
    if bank.get("audit_status", "not_started") not in VALID_AUDIT_STATUSES:
        raise ValueError("personalized_questions.json has an invalid audit_status")
    questions = bank.get("questions")
    if not isinstance(questions, list):
        raise ValueError("personalized_questions.json questions must be an array")
    seen: set[str] = set()
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            raise ValueError(f"questions[{index}] must be an object")
        identifier = question.get("id")
        if not isinstance(identifier, str) or not ID_PATTERN.fullmatch(identifier):
            raise ValueError(f"questions[{index}] has an invalid id")
        if identifier in seen:
            raise ValueError(f"Duplicate question id: {identifier}")
        seen.add(identifier)
        if question.get("priority") not in VALID_PRIORITIES:
            raise ValueError(f"Question {identifier} has an invalid priority")
        if question.get("category") not in VALID_CATEGORIES:
            raise ValueError(f"Question {identifier} has an invalid category")
        if question.get("status") not in VALID_STATUSES:
            raise ValueError(f"Question {identifier} has an invalid status")
        if not clean_text(question.get("question")).endswith("?"):
            raise ValueError(f"Question {identifier} must end with a question mark")
        sources = question.get("source_refs")
        if not isinstance(sources, list) or not sources:
            raise ValueError(f"Question {identifier} requires source_refs")
        for source_index, source in enumerate(sources):
            normalize_source(source, source_index)
        if question.get("status") == "answered" and not clean_text(question.get("answer")):
            raise ValueError(f"Answered question {identifier} has an empty answer")


def summary(bank: dict[str, Any]) -> dict[str, Any]:
    counts = {status: 0 for status in sorted(VALID_STATUSES)}
    priorities = {priority: 0 for priority in sorted(VALID_PRIORITIES)}
    for question in bank["questions"]:
        counts[question["status"]] += 1
        if question["status"] in {"open", "answered", "unable_to_verify"}:
            priorities[question["priority"]] += 1
    return {
        "path": str(bank.get("_path", "")),
        "generation_id": bank.get("generation_id", ""),
        "audit_status": bank.get("audit_status", "not_started"),
        "total": len(bank["questions"]),
        "status_counts": counts,
        "active_priority_counts": priorities,
        "needs_user_answer": counts["open"],
        "awaiting_codex_review": counts["answered"] + counts["unable_to_verify"],
    }


def generate_questions(workspace: Path, input_path: Path, maximum: int) -> dict[str, Any]:
    payload = load_json(input_path)
    if isinstance(payload, list):
        raw_questions = payload
        generation_id = f"audit-{timestamp()}"
    elif isinstance(payload, dict):
        raw_questions = payload.get("questions")
        generation_id = clean_text(payload.get("generation_id")) or f"audit-{timestamp()}"
    else:
        raise ValueError("Generation input must be an array or an object with a questions array")
    if not isinstance(raw_questions, list):
        raise ValueError("Generation input questions must be an array")
    if maximum < 1 or maximum > 50:
        raise ValueError("max-questions must be between 1 and 50")
    if len(raw_questions) > maximum:
        raise ValueError(f"Generation input contains {len(raw_questions)} questions; maximum is {maximum}")

    now = timestamp()
    incoming = [normalize_question(raw, now, workspace) for raw in raw_questions]
    incoming_ids = [question["id"] for question in incoming]
    if len(set(incoming_ids)) != len(incoming_ids):
        raise ValueError("Generation input contains duplicate question ids")

    bank = load_bank(workspace)
    existing = {question["id"]: question for question in bank["questions"]}
    merged: list[dict[str, Any]] = []
    for question in incoming:
        previous = existing.get(question["id"])
        if previous and previous.get("status") not in {"open", "superseded"}:
            merged.append(previous)
        else:
            merged.append(question)

    for previous in bank["questions"]:
        if previous["id"] in incoming_ids:
            continue
        retained = dict(previous)
        if retained.get("status") == "open":
            retained["status"] = "superseded"
            retained["reviewed_at"] = now
            retained["review_note"] = f"Superseded by question generation {generation_id}."
        merged.append(retained)

    bank.update(
        {
            "version": 1,
            "generation_id": generation_id,
            "audit_status": "current",
            "source_change_note": "",
            "generated_at": now,
            "updated_at": now,
            "questions": merged,
        }
    )
    validate_bank(bank)
    write_json(question_path(workspace), bank)
    bank["_path"] = str(question_path(workspace))
    return summary(bank)


def respond(workspace: Path, identifier: str, status: str, answer: str) -> dict[str, Any]:
    if status not in RESPONSE_STATUSES:
        raise ValueError(f"Response status must be one of: {', '.join(sorted(RESPONSE_STATUSES))}")
    answer = answer.strip()
    if status == "answered" and not answer:
        raise ValueError("An answered question requires a non-empty answer")
    bank = load_bank(workspace)
    question = next((item for item in bank["questions"] if item["id"] == identifier), None)
    if question is None:
        raise ValueError(f"Question not found: {identifier}")
    question["status"] = status
    question["answer"] = answer
    question["answered_at"] = timestamp()
    question["reviewed_at"] = ""
    question["review_note"] = ""
    bank["updated_at"] = timestamp()
    validate_bank(bank)
    write_json(question_path(workspace), bank)
    bank["_path"] = str(question_path(workspace))
    return summary(bank)


def review_questions(workspace: Path, input_path: Path) -> dict[str, Any]:
    payload = load_json(input_path)
    reviews = payload.get("reviews") if isinstance(payload, dict) else None
    if not isinstance(reviews, list) or not reviews:
        raise ValueError("Review input must contain a non-empty reviews array")
    bank = load_bank(workspace)
    by_id = {question["id"]: question for question in bank["questions"]}
    now = timestamp()
    for index, review in enumerate(reviews):
        if not isinstance(review, dict):
            raise ValueError(f"reviews[{index}] must be an object")
        identifier = clean_text(review.get("id"))
        if identifier not in by_id:
            raise ValueError(f"Review question not found: {identifier}")
        status = clean_text(review.get("status")).lower()
        if status not in {"resolved", "not_applicable"}:
            raise ValueError(f"Review {identifier} status must be resolved or not_applicable")
        note = ensure_text(review.get("review_note"), f"Review {identifier}.review_note", 5, 500)
        evidence_ids = review.get("related_evidence_ids") or []
        if not isinstance(evidence_ids, list) or not all(isinstance(item, str) for item in evidence_ids):
            raise ValueError(f"Review {identifier}.related_evidence_ids must be an array of strings")
        question = by_id[identifier]
        question["status"] = status
        question["reviewed_at"] = now
        question["review_note"] = note
        question["related_evidence_ids"] = [clean_text(item) for item in evidence_ids if clean_text(item)]

    bank["updated_at"] = now
    validate_bank(bank)
    write_json(question_path(workspace), bank)
    bank["_path"] = str(question_path(workspace))
    return summary(bank)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("init")
    subparsers.add_parser("validate")
    subparsers.add_parser("summary")

    generate_parser = subparsers.add_parser("generate")
    generate_parser.add_argument("--input", type=Path, required=True)
    generate_parser.add_argument("--max-questions", type=int, default=12)

    respond_parser = subparsers.add_parser("respond")
    respond_parser.add_argument("--id", required=True)
    respond_parser.add_argument("--status", required=True, choices=sorted(RESPONSE_STATUSES))
    respond_parser.add_argument("--answer", default="")

    review_parser = subparsers.add_parser("review")
    review_parser.add_argument("--input", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workspace = args.workspace.expanduser().resolve()
    if args.command == "init":
        bank = load_bank(workspace)
        bank["_path"] = str(question_path(workspace))
        result = summary(bank)
    elif args.command == "validate":
        bank = load_bank(workspace)
        bank["_path"] = str(question_path(workspace))
        result = {"valid": True, **summary(bank)}
    elif args.command == "summary":
        bank = load_bank(workspace)
        bank["_path"] = str(question_path(workspace))
        result = summary(bank)
    elif args.command == "generate":
        result = generate_questions(workspace, args.input.expanduser().resolve(), args.max_questions)
    elif args.command == "respond":
        result = respond(workspace, args.id, args.status, args.answer)
    elif args.command == "review":
        result = review_questions(workspace, args.input.expanduser().resolve())
    else:
        raise AssertionError(f"Unhandled command: {args.command}")
    print(json.dumps(result, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        raise SystemExit(str(error)) from error
