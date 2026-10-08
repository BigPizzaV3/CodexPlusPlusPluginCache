from __future__ import annotations

import json
import re
import sqlite3
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

SHA256 = re.compile(r"^[0-9a-f]{64}$")
TRANSITIONS = {
    "draft": {"reviewed"},
    "reviewed": {"accepted"},
    "accepted": {"superseded"},
    "superseded": set(),
}


class GovernanceStore:
    def __init__(self, path: str | Path) -> None:
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def register_artifact(
        self,
        artifact_id: str,
        *,
        kind: str,
        digest: str,
        public_metadata: dict[str, Any],
        blinded_metadata: dict[str, Any],
        actor: str,
    ) -> None:
        if not all((artifact_id.strip(), kind.strip(), actor.strip())):
            raise ValueError("artifact ID, kind, and actor are required")
        if not SHA256.fullmatch(digest):
            raise ValueError("artifact digest must be a lowercase SHA-256")
        public_json = _metadata_json(public_metadata)
        blinded_json = _metadata_json(blinded_metadata)
        created_at = _now()
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO artifacts
                        (id, kind, digest, state, public_metadata, blinded_metadata, created_at, updated_at)
                    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
                    """,
                    (
                        artifact_id, kind, digest, public_json, blinded_json,
                        created_at, created_at,
                    ),
                )
                self._audit(connection, artifact_id, actor, "artifact.registered", {"state": "draft"})
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"artifact already exists: {artifact_id}") from exc

    def transition(self, artifact_id: str, state: str, *, actor: str) -> None:
        if not actor.strip():
            raise ValueError("actor is required")
        with self._connect() as connection:
            row = connection.execute(
                "SELECT state FROM artifacts WHERE id = ?", (artifact_id,)
            ).fetchone()
            if row is None:
                raise KeyError(f"Unknown artifact: {artifact_id}")
            current = row[0]
            if state not in TRANSITIONS[current]:
                raise ValueError(f"invalid governance transition: {current} -> {state}")
            if state == "accepted":
                approval = connection.execute(
                    "SELECT 1 FROM reviews WHERE artifact_id = ? AND verdict = 'approve' LIMIT 1",
                    (artifact_id,),
                ).fetchone()
                if approval is None:
                    raise ValueError("accepted state requires at least one approval review")
            connection.execute(
                "UPDATE artifacts SET state = ?, updated_at = ? WHERE id = ?",
                (state, _now(), artifact_id),
            )
            self._audit(
                connection, artifact_id, actor, "artifact.transitioned", {"from": current, "to": state}
            )

    def record_review(
        self,
        artifact_id: str,
        *,
        reviewer: str,
        verdict: str,
        note: str = "",
    ) -> None:
        if not reviewer.strip():
            raise ValueError("reviewer is required")
        if verdict not in {"approve", "block"}:
            raise ValueError("review verdict must be approve or block")
        try:
            with self._connect() as connection:
                state = connection.execute(
                    "SELECT state FROM artifacts WHERE id = ?", (artifact_id,)
                ).fetchone()
                if state is None:
                    raise KeyError(f"Unknown artifact: {artifact_id}")
                if state[0] != "reviewed":
                    raise ValueError("reviews can only be recorded in reviewed state")
                connection.execute(
                    """
                    INSERT INTO reviews (artifact_id, reviewer, verdict, note, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (artifact_id, reviewer, verdict, note, _now()),
                )
                self._audit(
                    connection,
                    artifact_id,
                    reviewer,
                    "review.recorded",
                    {"verdict": verdict, "note": note},
                )
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"reviewer {reviewer!r} already reviewed artifact {artifact_id!r}") from exc

    def review_queue(self, reviewer: str) -> list[dict[str, Any]]:
        if not reviewer.strip():
            raise ValueError("reviewer is required")
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT a.id, a.kind, a.digest, a.state, a.public_metadata, a.blinded_metadata,
                       EXISTS(SELECT 1 FROM reviews r WHERE r.artifact_id = a.id AND r.reviewer = ?)
                FROM artifacts a WHERE a.state = 'reviewed' ORDER BY a.created_at, a.id
                """,
                (reviewer,),
            ).fetchall()
        result = []
        for artifact_id, kind, digest, state, public_json, blinded_json, reviewed in rows:
            metadata = json.loads(public_json)
            if reviewed:
                metadata.update(json.loads(blinded_json))
            result.append(
                {
                    "id": artifact_id,
                    "kind": kind,
                    "digest": digest,
                    "state": state,
                    "metadata": metadata,
                    "blinded": not bool(reviewed),
                }
            )
        return result

    def get_artifact(self, artifact_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id, kind, digest, state, public_metadata, blinded_metadata FROM artifacts WHERE id = ?",
                (artifact_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Unknown artifact: {artifact_id}")
        return {
            "id": row[0], "kind": row[1], "digest": row[2], "state": row[3],
            "public_metadata": json.loads(row[4]), "blinded_metadata": json.loads(row[5]),
        }

    def create_waiver(
        self,
        *,
        gate_id: str,
        owner: str,
        reason: str,
        issued_at: str,
        expires_at: str,
        actor: str,
    ) -> str:
        if not all(value.strip() for value in (gate_id, owner, reason, actor)):
            raise ValueError("waiver gate, owner, reason, and actor are required")
        issued = _timestamp(issued_at)
        expires = _timestamp(expires_at)
        if expires <= issued:
            raise ValueError("waiver must expire after issuance")
        waiver_id = uuid4().hex
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO waivers (id, gate_id, owner, reason, issued_at, expires_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (waiver_id, gate_id, owner, reason, issued_at, expires_at, actor),
            )
            self._audit(
                connection, None, actor, "waiver.created", {"waiver_id": waiver_id, "gate_id": gate_id}
            )
        return waiver_id

    def list_waivers(self) -> list[dict[str, str]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, gate_id, owner, reason, issued_at, expires_at, created_by FROM waivers ORDER BY issued_at"
            ).fetchall()
        keys = ("id", "gate_id", "owner", "reason", "issued_at", "expires_at", "created_by")
        return [dict(zip(keys, row, strict=True)) for row in rows]

    def audit_events(self, artifact_id: str | None = None) -> list[dict[str, Any]]:
        with self._connect() as connection:
            if artifact_id is None:
                rows = connection.execute(
                    "SELECT created_at, artifact_id, actor, action, detail FROM audit_log ORDER BY id"
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT created_at, artifact_id, actor, action, detail FROM audit_log
                    WHERE artifact_id = ? ORDER BY id
                    """,
                    (artifact_id,),
                ).fetchall()
        return [
            {"created_at": row[0], "artifact_id": row[1], "actor": row[2], "action": row[3], "detail": json.loads(row[4])}
            for row in rows
        ]

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _audit(
        self,
        connection: sqlite3.Connection,
        artifact_id: str | None,
        actor: str,
        action: str,
        detail: dict[str, Any],
    ) -> None:
        connection.execute(
            "INSERT INTO audit_log (created_at, artifact_id, actor, action, detail) VALUES (?, ?, ?, ?, ?)",
            (_now(), artifact_id, actor, action, _json(detail)),
        )

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS artifacts (
                    id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL,
                    digest TEXT NOT NULL,
                    state TEXT NOT NULL CHECK(state IN ('draft', 'reviewed', 'accepted', 'superseded')),
                    public_metadata TEXT NOT NULL,
                    blinded_metadata TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
                    reviewer TEXT NOT NULL,
                    verdict TEXT NOT NULL CHECK(verdict IN ('approve', 'block')),
                    note TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(artifact_id, reviewer)
                );
                CREATE TABLE IF NOT EXISTS waivers (
                    id TEXT PRIMARY KEY,
                    gate_id TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    issued_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_by TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    artifact_id TEXT,
                    actor TEXT NOT NULL,
                    action TEXT NOT NULL,
                    detail TEXT NOT NULL
                );
                """
            )


def _json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _metadata_json(value: object) -> str:
    if not isinstance(value, Mapping):
        raise ValueError("artifact metadata must be a JSON object")
    try:
        encoded = json.dumps(
            dict(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
        )
    except (TypeError, ValueError) as exc:
        raise ValueError("artifact metadata must contain finite JSON values") from exc
    return encoded


def _now() -> str:
    return datetime.now().astimezone().isoformat()


def _timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("waiver timestamps must use ISO-8601") from exc
    if parsed.tzinfo is None:
        raise ValueError("waiver timestamps must include a timezone")
    return parsed
