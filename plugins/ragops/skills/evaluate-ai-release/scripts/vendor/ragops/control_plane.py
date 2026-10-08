from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from ragops.store import ExperimentStore

WORKSPACE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,62}$")


class ControlPlane:
    """Local control-plane alpha with workspace-isolated experiment stores."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.index = self.root / "control-plane.db"
        self._initialize()

    def create_workspace(self, workspace_id: str, name: str) -> str:
        if not WORKSPACE_ID.fullmatch(workspace_id):
            raise ValueError("workspace ID must be a lowercase slug of 3-63 characters")
        if not name.strip():
            raise ValueError("workspace name is required")
        api_key = f"rgo_{secrets.token_urlsafe(32)}"
        digest = _digest(api_key)
        created_at = datetime.now(timezone.utc).isoformat()
        try:
            with self._connect() as connection:
                connection.execute(
                    "INSERT INTO workspaces (id, name, key_digest, created_at) VALUES (?, ?, ?, ?)",
                    (workspace_id, name, digest, created_at),
                )
                connection.execute(
                    "INSERT INTO audit_events (created_at, workspace_id, action, detail) VALUES (?, ?, ?, ?)",
                    (created_at, workspace_id, "workspace.created", name),
                )
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"workspace already exists: {workspace_id}") from exc
        return api_key

    def authenticate(self, workspace_id: str, api_key: str) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT key_digest FROM workspaces WHERE id = ?", (workspace_id,)
            ).fetchone()
        return bool(row and hmac.compare_digest(row[0], _digest(api_key)))

    def workspace_store(self, workspace_id: str, api_key: str) -> ExperimentStore:
        if not self.authenticate(workspace_id, api_key):
            raise PermissionError("invalid workspace credentials")
        path = self.root / "workspaces" / workspace_id / "runs.db"
        self.audit(workspace_id, "workspace.store_accessed", "experiment store")
        return ExperimentStore(path)

    def rotate_key(self, workspace_id: str, current_key: str) -> str:
        if not self.authenticate(workspace_id, current_key):
            raise PermissionError("invalid workspace credentials")
        new_key = f"rgo_{secrets.token_urlsafe(32)}"
        with self._connect() as connection:
            connection.execute(
                "UPDATE workspaces SET key_digest = ? WHERE id = ?",
                (_digest(new_key), workspace_id),
            )
        self.audit(workspace_id, "workspace.key_rotated", "credential rotated")
        return new_key

    def audit(self, workspace_id: str, action: str, detail: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO audit_events (created_at, workspace_id, action, detail) VALUES (?, ?, ?, ?)",
                (datetime.now(timezone.utc).isoformat(), workspace_id, action, detail),
            )

    def audit_events(self, workspace_id: str, *, limit: int = 100) -> list[dict[str, str]]:
        if limit < 1 or limit > 1000:
            raise ValueError("limit must be between 1 and 1000")
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT created_at, action, detail FROM audit_events
                WHERE workspace_id = ? ORDER BY id DESC LIMIT ?
                """,
                (workspace_id, limit),
            ).fetchall()
        return [
            {"created_at": row[0], "action": row[1], "detail": row[2]} for row in rows
        ]

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.index)

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    key_digest TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    detail TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                )
                """
            )


def _digest(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()
