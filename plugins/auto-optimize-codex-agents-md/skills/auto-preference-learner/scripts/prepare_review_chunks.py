from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from _common import atomic_write_json, load_json, write_json_output


DEFAULT_MAX_RECORDS = 100
DEFAULT_MAX_CHARS = 200_000


def review_chunks(batch: dict[str, Any], max_records: int, max_chars: int) -> list[dict[str, Any]]:
    if max_records < 1 or max_chars < 1:
        raise ValueError("review chunk limits must be positive")

    episodes_by_current: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for episode in batch.get("feedback_episode_candidates", []):
        record_ids = episode.get("record_ids", [])
        if record_ids:
            episodes_by_current[str(record_ids[-1])].append(episode)

    projects: dict[str, list[dict[str, Any]]] = {}
    for record in batch.get("records", []):
        projects.setdefault(str(record.get("project_root") or ""), []).append(record)

    chunks: list[dict[str, Any]] = []
    for project_root, records in projects.items():
        current: list[dict[str, Any]] = []
        for record in records:
            candidate = [*current, record]
            payload = _payload(project_root, candidate, episodes_by_current)
            if current and (len(candidate) > max_records or _size(payload) > max_chars):
                chunks.append(_payload(project_root, current, episodes_by_current))
                candidate = [record]
                payload = _payload(project_root, candidate, episodes_by_current)
            if _size(payload) > max_chars:
                raise ValueError(f"record {record.get('record_id')} exceeds the review chunk character limit")
            current = candidate
        if current:
            chunks.append(_payload(project_root, current, episodes_by_current))
    return chunks


def _payload(
    project_root: str,
    records: list[dict[str, Any]],
    episodes_by_current: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    record_ids = [str(record["record_id"]) for record in records]
    record_id_set = set(record_ids)
    return {
        "project_root": project_root or None,
        "record_ids": record_ids,
        "records": records,
        "feedback_episode_candidates": [
            {
                **episode,
                "context_records": [
                    context
                    for context in episode.get("context_records", [])
                    if str(context.get("record_id")) not in record_id_set
                ],
            }
            for record_id in record_ids
            for episode in episodes_by_current.get(record_id, [])
        ],
    }


def _size(value: dict[str, Any]) -> int:
    return len(json.dumps(value, ensure_ascii=False, indent=2)) + 1


def write_chunks(batch_path: Path, output_dir: Path, max_records: int, max_chars: int) -> dict[str, Any]:
    chunks = review_chunks(load_json(batch_path, {}), max_records, max_chars)
    output_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for number, chunk in enumerate(chunks, 1):
        path = output_dir / f"chunk-{number:04d}.json"
        atomic_write_json(path, chunk)
        entries.append(
            {
                "number": number,
                "path": str(path),
                "project_root": chunk["project_root"],
                "record_ids": chunk["record_ids"],
            }
        )
    manifest = {
        "batch": str(batch_path),
        "record_ids": [record_id for entry in entries for record_id in entry["record_ids"]],
        "chunks": entries,
    }
    atomic_write_json(output_dir / "manifest.json", manifest)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Split a conversation batch into bounded project review chunks.")
    parser.add_argument("--batch", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--max-records", type=int, default=DEFAULT_MAX_RECORDS)
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS)
    parser.add_argument("--output")
    args = parser.parse_args()
    manifest = write_chunks(
        Path(args.batch).expanduser().resolve(),
        Path(args.output_dir).expanduser().resolve(),
        args.max_records,
        args.max_chars,
    )
    write_json_output(manifest, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
