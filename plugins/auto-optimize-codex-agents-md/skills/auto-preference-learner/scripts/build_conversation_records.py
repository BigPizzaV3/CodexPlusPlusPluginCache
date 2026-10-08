#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from _common import extract_text, load_json, normalize_text, parse_timestamp, project_root_for_cwd, stable_id, write_json_output


@dataclass
class Turn:
    turn_id: str
    ordinal: int
    started_at: str | None = None
    cwd: str | None = None
    project_root: str | None = None
    primary_user_messages: list[str] = field(default_factory=list)
    fallback_user_messages: list[str] = field(default_factory=list)
    primary_final_answers: list[str] = field(default_factory=list)
    fallback_final_answers: list[str] = field(default_factory=list)
    primary_user_refs: list[str] = field(default_factory=list)
    fallback_user_refs: list[str] = field(default_factory=list)
    primary_final_refs: list[str] = field(default_factory=list)
    fallback_final_refs: list[str] = field(default_factory=list)
    event_lines: list[int] = field(default_factory=list)

    @property
    def user_messages(self) -> list[str]:
        return self.primary_user_messages or self.fallback_user_messages

    @property
    def final_answers(self) -> list[str]:
        return self.primary_final_answers or self.fallback_final_answers

    @property
    def user_refs(self) -> list[str]:
        return self.primary_user_refs or self.fallback_user_refs

    @property
    def final_refs(self) -> list[str]:
        return self.primary_final_refs or self.fallback_final_refs

    def touch(self, line_number: int) -> None:
        if line_number not in self.event_lines:
            self.event_lines.append(line_number)

    def set_cwd(self, cwd: Any) -> None:
        if not isinstance(cwd, str) or not cwd.strip():
            return
        self.cwd = cwd
        root = project_root_for_cwd(cwd)
        self.project_root = str(root) if root else None

    def add_user(self, text: str, ref: str, *, primary: bool) -> None:
        messages = self.primary_user_messages if primary else self.fallback_user_messages
        refs = self.primary_user_refs if primary else self.fallback_user_refs
        if text and normalize_text(text) not in {normalize_text(item) for item in messages}:
            messages.append(text)
            refs.append(ref)

    def add_final(self, text: str, ref: str, *, primary: bool) -> None:
        answers = self.primary_final_answers if primary else self.fallback_final_answers
        refs = self.primary_final_refs if primary else self.fallback_final_refs
        if text and normalize_text(text) not in {normalize_text(item) for item in answers}:
            answers.append(text)
            refs.append(ref)


def payload_for(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload")
    return payload if isinstance(payload, dict) else {}


def turn_identifier(payload: dict[str, Any], fallback: str) -> str:
    for key in ("turn_id", "task_id", "id"):
        value = payload.get(key)
        if value is not None and str(value).strip():
            return str(value)
    return fallback


def event_timestamp(event: dict[str, Any], payload: dict[str, Any]) -> str | None:
    parsed = parse_timestamp(event.get("timestamp") or payload.get("timestamp"))
    return parsed.isoformat().replace("+00:00", "Z") if parsed else None


CONTEXT_TAG = re.compile(r"^<([a-z0-9_-]+)>", re.IGNORECASE)


def is_injected_context(text: str) -> bool:
    stripped = text.lstrip()
    if stripped.startswith("# AGENTS.md instructions") and "<INSTRUCTIONS>" in stripped:
        return True
    match = CONTEXT_TAG.match(stripped)
    if match is None:
        return False
    tag = match.group(1).lower()
    return tag.endswith("_context") or tag in {"recommended_plugins", "turn_aborted", "subagent_notification"}


def extract_user_text(value: Any) -> str:
    if isinstance(value, list):
        parts = [extract_text(item) for item in value]
        text = "\n".join(part for part in parts if part and not is_injected_context(part)).strip()
        return strip_legacy_user_wrapper(text)
    text = extract_text(value)
    return "" if is_injected_context(text) else strip_legacy_user_wrapper(text)


def strip_legacy_user_wrapper(text: str) -> str:
    prefixes = ("# Context from my IDE setup:", "# In app browser:")
    if not text.startswith(prefixes):
        return text
    for marker in ("\n## My request for Codex:\n", "\n# My request for Codex:\n"):
        if marker in text:
            return text.split(marker, 1)[1].strip()
    return ""


def incremental_events(path: Path, cursor: dict[str, Any] | None = None):
    offset = int((cursor or {}).get("byte_offset", 0))
    completed_line = int((cursor or {}).get("line_number", 0))
    if offset < 0 or completed_line < 0 or (path.exists() and offset > path.stat().st_size):
        offset = 0
        completed_line = 0
    with path.open("rb") as handle:
        handle.seek(offset)
        for line_number, raw_line in enumerate(handle, start=completed_line + 1):
            byte_end = handle.tell()
            try:
                value = json.loads(raw_line.decode("utf-8-sig"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if isinstance(value, dict):
                yield line_number, value, byte_end


def parse_session(session: dict[str, Any], cursor: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    path = Path(session["source_path"])
    session_id = str(session["session_id"])
    turns: list[Turn] = []
    current: Turn | None = None
    default_cwd = session.get("cwd")
    default_project_root = session.get("project_root")
    ordinal_base = int((cursor or {}).get("turn_ordinal", 0))
    line_end_offsets: dict[int, int] = {}

    def get_turn(identifier: str | None = None, started_at: str | None = None, force_new: bool = False) -> Turn:
        nonlocal current
        if force_new or current is None:
            ordinal = ordinal_base + len(turns) + 1
            current = Turn(identifier or f"ordinal-{ordinal}", ordinal, started_at, default_cwd, default_project_root)
            turns.append(current)
        elif identifier and current.turn_id.startswith("ordinal-"):
            current.turn_id = identifier
        return current

    for line_number, event, byte_end in incremental_events(path, cursor):
        line_end_offsets[line_number] = byte_end
        payload = payload_for(event)
        outer_type = event.get("type")
        inner_type = payload.get("type")
        timestamp = event_timestamp(event, payload)
        ref = f"{session_id}:{line_number}"

        if outer_type == "session_meta":
            session_cwd = payload.get("cwd")
            if isinstance(session_cwd, str) and session_cwd.strip():
                default_cwd = session_cwd
                root = project_root_for_cwd(session_cwd)
                default_project_root = str(root) if root else None
            continue

        if outer_type == "turn_context":
            identifier = turn_identifier(payload, f"ordinal-{ordinal_base + len(turns) + 1}")
            if current is None or (current.turn_id != identifier and (current.user_messages or current.final_answers)):
                turn = get_turn(identifier, timestamp, force_new=True)
            else:
                turn = get_turn(identifier, timestamp)
            turn.set_cwd(payload.get("cwd"))
            turn.touch(line_number)
            continue

        if outer_type == "event_msg" and inner_type == "task_started":
            identifier = turn_identifier(payload, f"ordinal-{ordinal_base + len(turns) + 1}")
            if current is None or current.user_messages or current.final_answers:
                turn = get_turn(identifier, timestamp, force_new=True)
            else:
                turn = get_turn(identifier, timestamp)
            turn.touch(line_number)
            continue

        if outer_type == "response_item" and inner_type == "message":
            role = payload.get("role")
            text = extract_user_text(payload.get("content")) if role == "user" else extract_text(payload.get("content"))
            if role == "user":
                if not text:
                    continue
                turn = get_turn(started_at=timestamp)
                if turn.final_answers:
                    turn = get_turn(started_at=timestamp, force_new=True)
                turn.touch(line_number)
                turn.add_user(text, ref, primary=True)
            else:
                turn = get_turn(started_at=timestamp)
                turn.touch(line_number)
                if role == "assistant" and payload.get("phase") == "final_answer" and text:
                    turn.add_final(text, ref, primary=True)
            continue

        if outer_type == "event_msg" and inner_type == "user_message":
            text = extract_user_text(payload.get("message") or payload.get("text") or payload.get("content"))
            if text:
                turn = get_turn(started_at=timestamp)
                if turn.final_answers:
                    turn = get_turn(started_at=timestamp, force_new=True)
                turn.touch(line_number)
                turn.add_user(text, ref, primary=False)
            continue

        if outer_type == "event_msg" and inner_type == "agent_message":
            text = extract_text(payload.get("message") or payload.get("text") or payload.get("content"))
            if payload.get("phase") == "final_answer" and text:
                turn = get_turn(started_at=timestamp)
                turn.touch(line_number)
                turn.add_final(text, ref, primary=False)
            continue

        if outer_type == "event_msg" and inner_type == "task_complete":
            text = extract_text(payload.get("last_agent_message"))
            if text:
                turn = get_turn(started_at=timestamp)
                turn.touch(line_number)
                turn.add_final(text, ref, primary=False)
            continue

        if current is not None:
            current.touch(line_number)

    records: list[dict[str, Any]] = []
    for turn in turns:
        if not turn.user_messages or not turn.final_answers:
            continue
        user_input = "\n\n".join(turn.user_messages)
        final_answer = "\n\n".join(turn.final_answers)
        record_id = stable_id(session_id, turn.turn_id, prefix="R-")
        line_numbers = turn.event_lines or [int(ref.rsplit(":", 1)[1]) for ref in [*turn.user_refs, *turn.final_refs]]
        records.append(
            {
                "record_id": record_id,
                "session_id": session_id,
                "storage": session.get("storage"),
                "project_root": turn.project_root,
                "cwd": turn.cwd,
                "turn_id": turn.turn_id,
                "turn_ordinal": turn.ordinal,
                "timestamp": turn.started_at or session.get("started_at"),
                "user_input": user_input,
                "assistant_final_answer": final_answer,
                "source": {
                    "jsonl_path": str(path.resolve()),
                    "user_event_refs": turn.user_refs,
                    "final_event_refs": turn.final_refs,
                    "line_start": min(line_numbers),
                    "line_end": max(line_numbers),
                    "byte_end": line_end_offsets[max(line_numbers)],
                },
            }
        )
    return records


CONTINUATION_SIGNALS = ("上次", "之前", "继续", "昨天", "前面", "last time", "previous", "continue")
MAX_PRIOR_CONTEXT_CANDIDATES = 8


def similarity_features(text: str) -> set[str]:
    normalized = normalize_text(text)
    words = {f"w:{value}" for value in re.findall(r"[a-z0-9_]{2,}", normalized)}
    compact_cjk = "".join(re.findall(r"[\u3400-\u9fff]", normalized))
    cjk_pairs = {f"c:{compact_cjk[index:index + 2]}" for index in range(max(0, len(compact_cjk) - 1))}
    return words | cjk_pairs


def feedback_episode_candidates(all_records: list[dict[str, Any]], new_record_ids: set[str]) -> list[dict[str, Any]]:
    episodes: list[dict[str, Any]] = []
    for index, current in enumerate(all_records):
        if current["record_id"] not in new_record_ids:
            continue
        user_text = normalize_text(current.get("user_input", ""))
        signals = [signal for signal in CONTINUATION_SIGNALS if signal in user_text]
        project_root = current.get("project_root")
        recent_same_scope = [
            candidate
            for candidate in reversed(all_records[:index])
            if candidate.get("project_root") == project_root
        ][:MAX_PRIOR_CONTEXT_CANDIDATES]
        recent_ids = {item["record_id"] for item in recent_same_scope}
        current_features = similarity_features(current.get("user_input", ""))
        scored: list[tuple[float, dict[str, Any]]] = []
        for candidate in all_records[:index]:
            if (
                not candidate.get("project_root")
                or candidate.get("record_id") in recent_ids
            ):
                continue
            candidate_features = similarity_features(
                f"{candidate.get('user_input', '')}\n{candidate.get('assistant_final_answer', '')}"
            )
            overlap = current_features.intersection(candidate_features)
            if overlap:
                scored.append((len(overlap) / max(1, len(current_features | candidate_features)), candidate))
        semantically_ranked = [item[1] for item in sorted(scored, key=lambda item: item[0], reverse=True)[:MAX_PRIOR_CONTEXT_CANDIDATES]]
        previous_candidates = list(
            {
                candidate["record_id"]: candidate
                for candidate in [*recent_same_scope, *semantically_ranked]
            }.values()
        )
        semantic_ids = {item["record_id"] for item in semantically_ranked}
        for previous in previous_candidates:
            linked = [previous, current]
            association_signals: list[str] = []
            if previous.get("session_id") == current.get("session_id"):
                association_signals.append("same_session_prior")
            if previous["record_id"] in recent_ids:
                association_signals.append("same_project_recent_prior")
            elif project_root and previous.get("project_root") == project_root:
                association_signals.append("same_project_historical_candidate")
            if previous["record_id"] in semantic_ids:
                association_signals.append("semantic_text_overlap")
            if previous.get("project_root") != project_root:
                association_signals.append("cross_project_recurrence_candidate")
            if signals:
                association_signals.extend(["explicit_continuation_reference", *signals])
            episodes.append(
                {
                    "episode_id": stable_id(previous["record_id"], current["record_id"], prefix="E-"),
                    "record_ids": [item["record_id"] for item in linked],
                    "session_ids": [item["session_id"] for item in linked],
                    "project_root": project_root,
                    "association_signals": association_signals,
                    "context_records": [
                        {
                            "record_id": item["record_id"],
                            "session_id": item["session_id"],
                            "turn_id": item.get("turn_id"),
                            "project_root": item.get("project_root"),
                            "user_input": item["user_input"],
                            "assistant_final_answer": item["assistant_final_answer"],
                            "source": item["source"],
                        }
                        for item in linked
                    ],
                }
            )
    return episodes


def build(manifest: dict[str, Any], state: dict[str, Any] | None = None, include_processed: bool = False) -> dict[str, Any]:
    processed = set((state or {}).get("processed_record_ids", []))
    prior_index = {
        str(item["record_id"]): item
        for item in (state or {}).get("record_index", [])
        if isinstance(item, dict) and item.get("record_id")
    }
    prior_cursors = (state or {}).get("source_cursors", {})
    source_cursors = dict(prior_cursors)
    records: list[dict[str, Any]] = []
    warnings: list[str] = []
    for session in manifest.get("sessions", []):
        source_paths = list(dict.fromkeys([session.get("source_path"), *session.get("source_locations", [])]))
        copy_metadata = {
            str(item.get("source_path")): item
            for item in session.get("source_copies", [])
            if isinstance(item, dict) and item.get("source_path")
        }
        session_records: dict[str, dict[str, Any]] = {}
        for source_index, source_path in enumerate(path for path in source_paths if path):
            source_copy = copy_metadata.get(str(source_path), {})
            candidate = {**session, "source_path": source_path, "storage": source_copy.get("storage", session.get("storage"))}
            try:
                cursor = None if include_processed else prior_cursors.get(str(Path(source_path).resolve()))
                parsed = parse_session(candidate, cursor)
            except OSError as error:
                warnings.append(f"{source_path}: {error}")
                continue
            added = 0
            if parsed:
                latest = max(parsed, key=lambda item: item["source"]["line_end"])
                source_cursors[str(Path(source_path).resolve())] = {
                    "byte_offset": latest["source"]["byte_end"],
                    "line_number": latest["source"]["line_end"],
                    "turn_ordinal": latest["turn_ordinal"],
                }
            for record in parsed:
                turn_key = str(record.get("turn_id") or record["record_id"])
                if turn_key not in session_records:
                    session_records[turn_key] = record
                    added += 1
            if source_index > 0 and added:
                warnings.append(f"{session.get('session_id')}: merged {added} additional turn(s) from duplicate {source_path}")
        records.extend(session_records.values())
    records.sort(key=lambda item: (item.get("timestamp") or "", item["session_id"], item["turn_ordinal"]))
    since = parse_timestamp(manifest.get("since"))
    if since is not None:
        records = [item for item in records if parse_timestamp(item.get("timestamp")) is not None and parse_timestamp(item["timestamp"]) >= since]
    combined = {**prior_index, **{item["record_id"]: item for item in records}}
    all_records = sorted(
        combined.values(), key=lambda item: (item.get("timestamp") or "", item["session_id"], item["turn_ordinal"])
    )
    if not include_processed:
        records = [item for item in records if item["record_id"] not in processed]
    new_record_ids = {item["record_id"] for item in records}
    episodes = feedback_episode_candidates(all_records, new_record_ids)
    return {
        "version": 1,
        "codex_home": manifest.get("codex_home"),
        "quota_gate": manifest.get("quota_gate"),
        "records": records,
        "record_ids": [item["record_id"] for item in records],
        "feedback_episode_candidates": episodes,
        "allowed_project_roots": manifest.get("allowed_project_roots", []),
        "explicit_project_roots": manifest.get("explicit_project_roots", []),
        "source_cursors": source_cursors,
        "scan_cache": manifest.get("scan_cache", {}),
        "warnings": warnings,
        "counts": {"records": len(records), "sessions": len(manifest.get("sessions", [])), "feedback_episode_candidates": len(episodes)},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build minimal user/final-answer records from a Codex session manifest.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--state")
    parser.add_argument("--include-processed", action="store_true")
    parser.add_argument("--output")
    args = parser.parse_args()
    manifest = load_json(Path(args.manifest).expanduser().resolve(), {})
    state = load_json(Path(args.state).expanduser().resolve(), {}) if args.state else {}
    write_json_output(build(manifest, state, args.include_processed), args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
