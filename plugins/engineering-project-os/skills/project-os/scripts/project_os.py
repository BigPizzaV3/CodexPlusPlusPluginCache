#!/usr/bin/env python3
"""Bootstrap, adopt, validate, upgrade and maintain repository-local Project OS state."""

from __future__ import annotations

import argparse
import copy
import contextlib
import io
import hashlib
import json
import os
import re
import stat
import sys
import uuid
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterable, Sequence


VERSION = "2.2.1"
SCHEMA_VERSION = 5
PROGRAM_RELATIVE_PATH = ".agents/PROGRAM.md"
PACK_NAMES = ("service", "web", "mobile", "data", "delivery")
OVERLAY_NAMES = ("react-native-expo",)
OVERLAY_REQUIREMENTS = {"react-native-expo": {"mobile"}}
PLAN_STATUSES = {"planned", "active", "blocked", "done", "superseded"}
FINDING_STATUSES = {
    "candidate",
    "confirmed",
    "fixed_unverified",
    "verified",
    "accepted_risk",
    "deferred",
    "rejected",
    "merged",
}
FAILURE_STATUSES = {"draft", "active", "retired", "replaced"}
COVERAGE_DISPOSITIONS = {"promoted", "merged", "retained_private", "retired"}
RESERVED_TEMPLATE_TOKENS = {
    "__UPDATED_DATE__",
    "__PROJECT_NAME__",
    "__DETECTION_LINES__",
    "__PACK_NAMES__",
    "__OVERLAY_NAMES__",
    "__PROGRAM_INITIATIVE__",
    "__PROGRAM_ID__",
    "__PROGRAM_STARTED_ON__",
    "__PROGRAM_OUTCOME__",
    "__PROGRAM_AUTHORITY__",
    "__PROGRAM_PHASES__",
    "__PROGRAM_EXIT_CONDITIONS__",
    "__PROGRAM_EVIDENCE__",
    "__PROGRAM_COST_BOUNDARY__",
    "__PROGRAM_EXCLUSIONS__",
}
LESSON_HEADING_PATTERN = re.compile(r"^## ([A-Z][A-Z0-9-]*-\d+):\s*(.+?)\s*$")
CANONICAL_TOKEN_CONTROL_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
FULL_SHA256_PATTERN = re.compile(r"sha256:[0-9a-f]{64}\Z")
PRIVATE_KNOWLEDGE_PATTERNS = (
    (re.compile(r"(?:/Users/|/home/|/private/var/|/var/folders/|[A-Za-z]:\\Users\\)"), "private path"),
    (re.compile(r"\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|xox[baprs]-|AKIA)[A-Za-z0-9_-]+"), "credential-like token"),
    (re.compile(r"\bAIza[A-Za-z0-9_-]{20,}"), "credential-like token"),
    (re.compile(r"Authorization\s*:\s*Bearer\s+eyJ[A-Za-z0-9_.-]+", re.IGNORECASE), "authorization token"),
    (re.compile(r"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----"), "private key"),
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE), "email address"),
    (
        re.compile(
            r"\b(?:[a-z][a-z0-9+.-]*://[^\s`<>]+|www\.[^\s`<>]+)",
            re.IGNORECASE,
        ),
        "URL",
    ),
    (
        re.compile(
            r"(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
            r"(?:ai|app|cloud|co|com|dev|edu|gov|io|me|net|org|tech)"
            r"(?::[0-9]{1,5})?(?:/[^\s`()<>\[\]{}]*)?",
            re.IGNORECASE,
        ),
        "URL",
    ),
    (re.compile(r"[?&](?:token|access_token|signature|x-amz-signature|x-goog-signature)=[^&\s]+", re.IGNORECASE), "signed URL"),
)
SENSITIVE_FIELD_NAMES = {
    "api_key",
    "apikey",
    "access_token",
    "authorization",
    "client_secret",
    "password",
    "passwd",
    "private_key",
    "refresh_token",
    "secret",
}

SKILL_ROOT = Path(__file__).resolve().parent.parent
ASSETS = SKILL_ROOT / "assets"
CORE_TEMPLATE = ASSETS / "templates" / "core"
PROGRAM_TEMPLATE = ASSETS / "templates" / "program" / "PROGRAM.md"
HISTORY_README_TEMPLATE = ASSETS / "templates" / "program" / "history" / "README.md"
PACK_TEMPLATE = ASSETS / "packs"
OVERLAY_TEMPLATE = ASSETS / "overlays"

DEFAULT_PATHS: dict[str, Any] = {
    "context": ".agents/CONTEXT.md",
    "state": ".agents/STATE.md",
    "plans": ".agents/plans/index.json",
    "requests": ".agents/requests.json",
    "findings": ".agents/findings/findings.json",
    "evidence": ".agents/evidence",
    "program": None,
    "history": None,
    "history_index": None,
    "reusable_knowledge": ".agents/knowledge/reusable/failures.json",
    "project_knowledge": [".agents/knowledge/project/failures.json"],
    "legacy_knowledge": [],
    "knowledge_coverage": None,
}


class ProjectOSError(RuntimeError):
    pass


def load_json(path: Path) -> Any:
    return load_json_snapshot(path)[0]


def load_json_snapshot(path: Path) -> tuple[Any, str]:
    """Parse and fingerprint the same bytes, never a later reread of the file."""
    try:
        content = path.read_bytes()
        return json.loads(content.decode("utf-8")), hashlib.sha256(content).hexdigest()
    except FileNotFoundError as error:
        raise ProjectOSError(f"Missing JSON file: {path}") from error
    except UnicodeDecodeError as error:
        raise ProjectOSError(f"JSON file is not valid UTF-8: {path}") from error
    except json.JSONDecodeError as error:
        raise ProjectOSError(
            f"Invalid JSON in {path}: line {error.lineno}, column {error.colno}: {error.msg}"
        ) from error
    except OSError as error:
        raise ProjectOSError(f"Could not read JSON file {path}: {error}") from error


def read_regular_at(directory_fd: int, name: str) -> tuple[bytes, os.stat_result]:
    descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory_fd)
    with os.fdopen(descriptor, "rb") as handle:
        details = os.fstat(handle.fileno())
        if not stat.S_ISREG(details.st_mode):
            raise ProjectOSError(f"Expected a regular file: {name}")
        return handle.read(), details


def unlink_owned_at(directory_fd: int, name: str, identity: tuple[int, int]) -> None:
    """Remove only the directory entry that still names the caller-owned inode."""
    try:
        details = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
    except FileNotFoundError:
        return
    if (details.st_dev, details.st_ino) == identity:
        os.unlink(name, dir_fd=directory_fd)


def replace_at(directory_fd: int, source: str, destination: str) -> None:
    os.replace(
        source,
        destination,
        src_dir_fd=directory_fd,
        dst_dir_fd=directory_fd,
    )


def link_at(directory_fd: int, source: str, destination: str) -> None:
    os.link(
        source,
        destination,
        src_dir_fd=directory_fd,
        dst_dir_fd=directory_fd,
        follow_symlinks=False,
    )


def atomic_write_bytes(
    directory_fd: int, name: str, content: bytes, expected_sha256: str,
    mode: int | None = None,
) -> os.stat_result:
    """Replace within an already opened directory; parent path swaps cannot redirect it."""
    original, details = read_regular_at(directory_fd, name)
    if hashlib.sha256(original).hexdigest() != expected_sha256:
        raise ProjectOSError(f"File changed during operation: {name}")
    temporary = f".{name}.project-os-write.{uuid.uuid4().hex}"
    ownership_descriptor = os.open(
        temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
        0o600, dir_fd=directory_fd,
    )
    temporary_details = os.fstat(ownership_descriptor)
    temporary_identity = (temporary_details.st_dev, temporary_details.st_ino)
    original_identity = (details.st_dev, details.st_ino)
    replacement_digest = hashlib.sha256(content).hexdigest()
    backup = f".{name}.project-os-backup.{uuid.uuid4().hex}"
    displaced = f".{name}.project-os-displaced.{uuid.uuid4().hex}"
    backup_created = False
    publication_started = False
    publication_verified = False
    try:
        writer_descriptor = os.dup(ownership_descriptor)
        try:
            handle = os.fdopen(writer_descriptor, "wb")
        except BaseException:
            os.close(writer_descriptor)
            raise
        with handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
            os.fchmod(handle.fileno(), stat.S_IMODE(details.st_mode) if mode is None else mode)
        current, current_details = read_regular_at(directory_fd, name)
        if (
            (current_details.st_dev, current_details.st_ino) != original_identity
            or hashlib.sha256(current).hexdigest() != expected_sha256
        ):
            raise ProjectOSError(f"File changed during operation: {name}")
        replacement, temporary_details = read_regular_at(directory_fd, temporary)
        if (
            (temporary_details.st_dev, temporary_details.st_ino) != temporary_identity
            or hashlib.sha256(replacement).hexdigest() != replacement_digest
        ):
            raise ProjectOSError(f"Temporary replacement changed during operation: {name}")
        link_at(directory_fd, name, backup)
        backup_created = True
        backup_content, backup_details = read_regular_at(directory_fd, backup)
        if (
            (backup_details.st_dev, backup_details.st_ino) != original_identity
            or hashlib.sha256(backup_content).hexdigest() != expected_sha256
        ):
            raise ProjectOSError(f"Original backup changed during operation: {name}")
        publication_started = True
        replace_at(directory_fd, name, displaced)
        displaced_content, displaced_details = read_regular_at(directory_fd, displaced)
        if (
            (displaced_details.st_dev, displaced_details.st_ino) != original_identity
            or hashlib.sha256(displaced_content).hexdigest() != expected_sha256
        ):
            raise ProjectOSError(
                f"Target changed at publication: {name}; concurrent file preserved at {displaced}"
            )
        link_at(directory_fd, temporary, name)
        published, published_details = read_regular_at(directory_fd, name)
        if (
            (published_details.st_dev, published_details.st_ino) == temporary_identity
            and hashlib.sha256(published).hexdigest() == replacement_digest
        ):
            publication_verified = True
            return published_details
        raise ProjectOSError(f"Temporary replacement changed at publication: {name}")
    except BaseException as error:
        preserved: str | None = None
        if publication_started and backup_created:
            try:
                current, current_details = read_regular_at(directory_fd, name)
            except FileNotFoundError:
                current = None
                current_details = None
            if current_details is not None and (
                (current_details.st_dev, current_details.st_ino) == original_identity
                and hashlib.sha256(current or b"").hexdigest() == expected_sha256
            ):
                publication_started = False
            else:
                if current_details is not None and (
                    (current_details.st_dev, current_details.st_ino) != temporary_identity
                    or hashlib.sha256(current or b"").hexdigest() != replacement_digest
                ):
                    preserved = f".{name}.project-os-conflict.{uuid.uuid4().hex}"
                    try:
                        link_at(directory_fd, name, preserved)
                        preserved_content, preserved_details = read_regular_at(
                            directory_fd, preserved
                        )
                        if (
                            (preserved_details.st_dev, preserved_details.st_ino)
                            != (current_details.st_dev, current_details.st_ino)
                            or hashlib.sha256(preserved_content).hexdigest()
                            != hashlib.sha256(current or b"").hexdigest()
                        ):
                            raise ProjectOSError(
                                "concurrent replacement preservation was not exact"
                            )
                        latest, latest_details = read_regular_at(directory_fd, name)
                        if (
                            (latest_details.st_dev, latest_details.st_ino)
                            != (current_details.st_dev, current_details.st_ino)
                            or hashlib.sha256(latest).hexdigest()
                            != hashlib.sha256(current or b"").hexdigest()
                        ):
                            raise ProjectOSError(
                                "target changed again during recovery"
                            )
                    except BaseException as recovery_error:
                        raise ProjectOSError(
                            f"Atomic replacement recovery is incomplete for {name}; "
                            f"original preserved at {backup}: {recovery_error}"
                        ) from error
                try:
                    replace_at(directory_fd, backup, name)
                except BaseException as restore_error:
                    try:
                        restored, restored_details = read_regular_at(directory_fd, name)
                    except BaseException:
                        restored = None
                        restored_details = None
                    if not (
                        restored_details is not None
                        and (restored_details.st_dev, restored_details.st_ino)
                        == original_identity
                        and hashlib.sha256(restored or b"").hexdigest()
                        == expected_sha256
                    ):
                        raise ProjectOSError(
                            f"Atomic replacement recovery is incomplete for {name}; "
                            f"original preserved at {backup}: {restore_error}"
                        ) from error
                backup_created = False
                restored, restored_details = read_regular_at(directory_fd, name)
                if (
                    (restored_details.st_dev, restored_details.st_ino) != original_identity
                    or hashlib.sha256(restored).hexdigest() != expected_sha256
                ):
                    raise ProjectOSError(
                        f"Atomic replacement recovery could not verify {name}"
                    ) from error
        if preserved is not None and isinstance(error, ProjectOSError):
            raise ProjectOSError(
                f"{error}; concurrent file preserved at {preserved}"
            ) from error
        raise
    finally:
        unlink_owned_at(directory_fd, temporary, temporary_identity)
        if backup_created and (not publication_started or publication_verified):
            unlink_owned_at(directory_fd, backup, original_identity)
        unlink_owned_at(directory_fd, displaced, original_identity)
        os.close(ownership_descriptor)


def atomic_write_text(
    path: Path, content: str, expected_sha256: str, *, directory_fd: int,
) -> os.stat_result:
    return atomic_write_bytes(directory_fd, path.name, content.encode("utf-8"), expected_sha256)


class AnchoredFilesystem:
    """Keep directory descriptors alive through apply, validation and rollback.

    All mutations use dir_fd and no-follow opens. Namespace checks detect renamed
    parents; rollback still uses the original directories, never replacement paths.
    """

    def __init__(self, root: Path):
        if (
            not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY")
            or not {os.open, os.mkdir, os.stat, os.unlink, os.rmdir, os.rename, os.link}
            <= os.supports_dir_fd
        ):
            raise ProjectOSError("Safe mutations require POSIX directory descriptors (macOS or Linux)")
        self.root = root
        self.directories: dict[Path, int] = {}
        self.links: list[tuple[int, str, int]] = []
        self.descriptors: list[int] = []
        self.created: list[tuple[int, str, int]] = []
        try:
            descriptor = os.open(root.anchor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            self.descriptors.append(descriptor)
            for part in root.parts[1:]:
                descriptor = self.open_directory(descriptor, part)
            self.directories[root] = descriptor
        except OSError as error:
            self.close()
            raise ProjectOSError(f"Could not safely open repository directories: {error}") from error
        except BaseException:
            self.close()
            raise

    def open_directory(self, parent_fd: int, name: str) -> int:
        descriptor = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
        self.descriptors.append(descriptor)
        self.links.append((parent_fd, name, descriptor))
        return descriptor

    def parent(self, path: Path, create: bool = False) -> int:
        relative = path.relative_to(self.root)
        if not relative.parts or any(part in {".", ".."} for part in relative.parts):
            raise ProjectOSError(f"Unsafe destination: {path}")
        current = self.root
        descriptor = self.directories[current]
        for part in relative.parts[:-1]:
            current = current / part
            if current not in self.directories:
                made = False
                try:
                    child = self.open_directory(descriptor, part)
                except FileNotFoundError:
                    if not create:
                        raise
                    os.mkdir(part, dir_fd=descriptor)
                    made = True
                    child = self.open_directory(descriptor, part)
                if made:
                    self.created.append((descriptor, part, child))
                self.directories[current] = child
            descriptor = self.directories[current]
        return descriptor

    def verify(self) -> None:
        for parent_fd, name, descriptor in self.links:
            current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
            original = os.fstat(descriptor)
            if not stat.S_ISDIR(current.st_mode) or (
                current.st_dev, current.st_ino
            ) != (original.st_dev, original.st_ino):
                raise ProjectOSError(f"Directory changed during operation: {name}")

    def close(self) -> None:
        for descriptor in reversed(self.descriptors):
            os.close(descriptor)
        self.descriptors.clear()

    def rollback_directories(self) -> list[str]:
        failures = []
        for parent_fd, name, descriptor in reversed(self.created):
            try:
                current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
                original = os.fstat(descriptor)
                if (current.st_dev, current.st_ino) != (original.st_dev, original.st_ino):
                    raise ProjectOSError("created directory was concurrently replaced")
                os.rmdir(name, dir_fd=parent_fd)
            except BaseException as error:
                failures.append(f"{name}: {error}")
        return failures


def package_metadata(root: Path) -> tuple[dict[str, Any], list[str]]:
    path = root / "package.json"
    if not path.is_file():
        return {}, []
    try:
        value = load_json(path)
    except ProjectOSError:
        return {}, ["package.json exists but is not valid JSON"]
    if not isinstance(value, dict):
        return {}, ["package.json must contain an object"]

    dependency_names: set[str] = set()
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        dependencies = value.get(key, {})
        if isinstance(dependencies, dict):
            dependency_names.update(str(name).lower() for name in dependencies)
    scripts = value.get("scripts", {})
    script_names = sorted(str(name) for name in scripts) if isinstance(scripts, dict) else []
    return {"dependencies": sorted(dependency_names), "scripts": script_names}, []


def read_small_text(path: Path, limit: int = 250_000) -> str:
    if not path.is_file() or path.stat().st_size > limit:
        return ""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def iter_string_values(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from iter_string_values(item)
    elif isinstance(value, list):
        for item in value:
            yield from iter_string_values(item)


def private_material_labels(value: Any) -> list[str]:
    labels: set[str] = set()
    for text in iter_string_values(value):
        for pattern, label in PRIVATE_KNOWLEDGE_PATTERNS:
            if pattern.search(text):
                labels.add(label)
    if any(
        isinstance(key, str) and key.strip().lower().replace("-", "_") in SENSITIVE_FIELD_NAMES
        for key in iter_mapping_keys(value)
    ):
        labels.add("sensitive field name")
    return sorted(labels)


def iter_mapping_keys(value: Any) -> Iterable[Any]:
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from iter_mapping_keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from iter_mapping_keys(item)


def any_exists(root: Path, names: Iterable[str]) -> bool:
    return any((root / name).exists() for name in names)


def any_top_level_match(root: Path, patterns: Iterable[str]) -> bool:
    return any(any(root.glob(pattern)) for pattern in patterns)


def detect_repository(root: Path) -> dict[str, Any]:
    root = root.resolve()
    if not root.is_dir():
        raise ProjectOSError(f"Target is not a directory: {root}")

    signal_candidates = (
        "package.json",
        "tsconfig.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "package-lock.json",
        "pyproject.toml",
        "requirements.txt",
        "setup.py",
        "Pipfile",
        "uv.lock",
        "poetry.lock",
        "deps.edn",
        "project.clj",
        "bb.edn",
        "shadow-cljs.edn",
        "go.mod",
        "Cargo.toml",
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
        "Package.swift",
        "pubspec.yaml",
        "Gemfile",
        "composer.json",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
        "eas.json",
        "app.json",
        "app.config.js",
        "app.config.ts",
        "Makefile",
        "justfile",
    )
    signals = [name for name in signal_candidates if (root / name).exists()]
    for directory in (
        ".github/workflows",
        "api",
        "server",
        "services",
        "workers",
        "migrations",
        "ios",
        "android",
        "supabase/functions",
        "supabase/migrations",
    ):
        if (root / directory).exists():
            signals.append(f"{directory}/")

    package, package_warnings = package_metadata(root)
    dependencies = set(package.get("dependencies", []))
    python_text = "\n".join(
        read_small_text(root / name).lower()
        for name in ("pyproject.toml", "requirements.txt", "setup.py")
    )
    clojure_text = "\n".join(
        read_small_text(root / name).lower() for name in ("deps.edn", "project.clj")
    )

    toolchains: list[str] = []
    toolchain_checks = (
        ("javascript-typescript", any_exists(root, ("package.json", "tsconfig.json"))),
        (
            "python",
            any_exists(
                root,
                ("pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "uv.lock"),
            )
            or any_top_level_match(root, ("*.py",)),
        ),
        (
            "clojure",
            any_exists(root, ("deps.edn", "project.clj", "bb.edn", "shadow-cljs.edn")),
        ),
        ("go", (root / "go.mod").exists()),
        ("rust", (root / "Cargo.toml").exists()),
        (
            "java-kotlin",
            any_exists(root, ("pom.xml", "build.gradle", "build.gradle.kts"))
            or any_top_level_match(root, ("*.gradle", "*.gradle.kts")),
        ),
        (
            "swift-objective-c",
            (root / "Package.swift").exists()
            or any_top_level_match(root, ("*.xcodeproj", "*.xcworkspace"))
            or (root / "ios").is_dir(),
        ),
        ("dart", (root / "pubspec.yaml").exists()),
        ("ruby", (root / "Gemfile").exists()),
        ("php", (root / "composer.json").exists()),
        ("dotnet", any_top_level_match(root, ("*.sln", "*.csproj", "*.fsproj"))),
    )
    toolchains.extend(name for name, present in toolchain_checks if present)

    has_react_native = "react-native" in dependencies
    has_expo = "expo" in dependencies
    has_mobile = (
        has_react_native
        or (root / "pubspec.yaml").exists()
        or (root / "ios").is_dir()
        or (root / "android").is_dir()
        or any_top_level_match(root, ("*.xcodeproj", "*.xcworkspace"))
    )

    web_framework_dependencies = {
        "next",
        "vue",
        "nuxt",
        "svelte",
        "@sveltejs/kit",
        "@angular/core",
        "solid-js",
        "astro",
    }
    explicit_web_files = any_exists(
        root,
        ("index.html", "vite.config.js", "vite.config.ts", "next.config.js", "next.config.mjs"),
    )
    has_web = (
        bool(web_framework_dependencies.intersection(dependencies))
        or explicit_web_files
        or ("react-dom" in dependencies and not has_mobile)
    )

    service_dependencies = {
        "express",
        "fastify",
        "koa",
        "hapi",
        "@nestjs/core",
        "django",
        "fastapi",
        "flask",
        "starlette",
        "celery",
    }
    service_markers = ("django", "fastapi", "flask", "starlette", "celery", "gunicorn")
    clojure_service_markers = (
        "metosin/reitit",
        "http-kit/http-kit",
        "ring/ring-core",
        "compojure/compojure",
        "io.pedestal/pedestal.service",
    )
    has_service = (
        bool(service_dependencies.intersection(dependencies))
        or any(marker in python_text for marker in service_markers)
        or any(marker in clojure_text for marker in clojure_service_markers)
        or (root / "supabase" / "functions").is_dir()
        or any(
            (root / name).is_dir()
            for name in ("api", "backend", "server", "services", "workers")
        )
    )

    data_dependencies = {
        "pg",
        "prisma",
        "@prisma/client",
        "typeorm",
        "sequelize",
        "mongoose",
        "sqlalchemy",
        "alembic",
        "diesel",
    }
    clojure_data_markers = (
        "com.github.seancorfield/next.jdbc",
        "org.clojure/java.jdbc",
        "hikari-cp/hikari-cp",
        "com.github.seancorfield/honeysql",
        "com.datomic/",
        "com.xtdb/",
    )
    has_data = (
        bool(data_dependencies.intersection(dependencies))
        or any(marker in python_text for marker in ("sqlalchemy", "alembic", "django"))
        or any(marker in clojure_text for marker in clojure_data_markers)
        or (root / "supabase" / "migrations").is_dir()
        or any((root / name).is_dir() for name in ("migrations", "db", "database", "schema"))
        or any_top_level_match(root, ("*.sql",))
    )

    has_delivery = (
        any_exists(
            root,
            (
                "Dockerfile",
                "docker-compose.yml",
                "docker-compose.yaml",
                "compose.yml",
                "compose.yaml",
                "eas.json",
                "fly.toml",
                "railway.json",
                "railway.toml",
                "vercel.json",
                "netlify.toml",
            ),
        )
        or (root / ".github" / "workflows").is_dir()
        or any((root / name).is_dir() for name in ("terraform", "k8s", "helm"))
    )

    recommended_packs = [
        name
        for name, present in (
            ("service", has_service),
            ("web", has_web),
            ("mobile", has_mobile),
            ("data", has_data),
            ("delivery", has_delivery),
        )
        if present
    ]
    recommended_overlays = ["react-native-expo"] if has_react_native and has_expo else []

    package_manager = None
    for lockfile, manager in (
        ("pnpm-lock.yaml", "pnpm"),
        ("yarn.lock", "yarn"),
        ("package-lock.json", "npm"),
    ):
        if (root / lockfile).exists():
            package_manager = manager
            break

    return {
        "target": str(root),
        "repository": root.name,
        "toolchain_signals": toolchains,
        "recommended_packs": recommended_packs,
        "recommended_overlays": recommended_overlays,
        "signals": sorted(set(signals)),
        "package_manager_signal": package_manager,
        "package_scripts": package.get("scripts", []),
        "warnings": package_warnings,
        "note": (
            "Signals recommend capability packs only. Verify commands, architecture and product "
            "authority from the repository before recording them."
        ),
    }


def parse_selection(
    value: str,
    detected: Iterable[str],
    allowed: Sequence[str],
    label: str,
) -> list[str]:
    normalized = value.strip().lower()
    if normalized in {"auto", "selected"}:
        detected_set = set(detected)
        return [name for name in allowed if name in detected_set]
    if normalized in {"", "none"}:
        return []
    requested = [part.strip().lower() for part in value.split(",") if part.strip()]
    unknown = sorted(set(requested).difference(allowed))
    if unknown:
        raise ProjectOSError(
            f"Unknown {label}: {', '.join(unknown)}. Allowed: {', '.join(allowed)}"
        )
    requested_set = set(requested)
    return [name for name in allowed if name in requested_set]


def validate_overlay_dependencies(packs: Sequence[str], overlays: Sequence[str]) -> None:
    pack_set = set(packs)
    for overlay in overlays:
        missing = OVERLAY_REQUIREMENTS.get(overlay, set()).difference(pack_set)
        if missing:
            raise ProjectOSError(
                f"Overlay {overlay} requires packs: {', '.join(sorted(missing))}"
            )


def detection_lines(detection: dict[str, Any]) -> str:
    toolchains = detection.get("toolchain_signals", [])
    signals = detection.get("signals", [])
    return "\n".join(
        (
            "- Toolchains: " + (", ".join(toolchains) if toolchains else "none detected"),
            "- Repository signals: "
            + (
                ", ".join(f"`{signal}`" for signal in signals)
                if signals
                else "none detected"
            ),
        )
    )


def render_template(content: str, replacements: dict[str, str]) -> str:
    rendered = content
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    return rendered


def iter_template_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if path.is_file():
            yield path


def require_destination_within_root(root: Path, destination: Path) -> None:
    root = root.resolve()
    try:
        destination.resolve().relative_to(root)
        destination.relative_to(root)
    except ValueError as error:
        raise ProjectOSError(f"Refusing to access a path outside the target: {destination}") from error


def reject_symlink_path(root: Path, destination: Path) -> None:
    """Reject a mutation when any destination component is a symlink."""
    root = root.resolve()
    require_destination_within_root(root, destination)
    relative = destination.relative_to(root)
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ProjectOSError(f"Refusing to mutate through a symlink: {current}")


def check_no_symlink_path(
    root: Path, path: Path, label: str, errors: list[str]
) -> None:
    try:
        reject_symlink_path(root, path)
    except ProjectOSError as error:
        message = f"{label} must not use symlink components: {error}"
        if message not in errors:
            errors.append(message)


def repo_relative_path(root: Path, raw_path: Any) -> Path | None:
    """Parse a repository-relative POSIX path without accepting traversal syntax."""
    if not isinstance(raw_path, str) or raw_path in {"", ".", ".."} or "\\" in raw_path:
        return None
    pure = PurePosixPath(raw_path)
    if pure.is_absolute() or any(part in {"", ".", ".."} for part in pure.parts):
        return None
    candidate = root.joinpath(*pure.parts)
    try:
        candidate.resolve().relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def safe_relative(root: Path, raw_path: Any) -> Path | None:
    return repo_relative_path(root, raw_path)


def relative_string(root: Path, path: Path | None) -> str | None:
    if path is None:
        return None
    if path.is_symlink():
        return None
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return None


def unique_existing(
    root: Path,
    candidates: Sequence[str],
    kind: str,
    label: str,
    errors: list[str],
    prefer_nonempty: bool = False,
) -> Path | None:
    matches: list[Path] = []
    for relative in candidates:
        path = root / relative
        if path.is_symlink():
            errors.append(f"unsafe symlink for {label}: {relative}")
            continue
        if kind == "file" and path.is_file():
            matches.append(path)
        if kind == "dir" and path.is_dir():
            matches.append(path)
    if prefer_nonempty and len(matches) > 1:
        nonempty = [
            path
            for path in matches
            if any(item.is_file() and not item.is_symlink() for item in path.rglob("*"))
        ]
        if len(nonempty) == 1:
            return nonempty[0]
        if nonempty:
            matches = nonempty
    if len(matches) > 1:
        errors.append(
            f"ambiguous {label} owners: "
            + ", ".join(path.relative_to(root).as_posix() for path in matches)
        )
        return None
    return matches[0] if matches else None


def default_system(
    root: Path,
    mode: str,
    installation: str,
    packs: Sequence[str],
    overlays: Sequence[str],
    paths: dict[str, Any],
    active_program: dict[str, Any] | None = None,
) -> dict[str, Any]:
    managed_guidance: dict[str, str] = {
        ".agents/WORKFLOW.md": "sha256:"
        + hashlib.sha256((CORE_TEMPLATE / ".agents/WORKFLOW.md").read_bytes()).hexdigest(),
        ".agents/packs/README.md": "sha256:"
        + hashlib.sha256((PACK_TEMPLATE / "README.md").read_bytes()).hexdigest()
    }
    for name in packs:
        relative = f".agents/packs/{name}.md"
        managed_guidance[relative] = (
            "sha256:" + hashlib.sha256((PACK_TEMPLATE / f"{name}.md").read_bytes()).hexdigest()
        )
    for name in overlays:
        relative = f".agents/packs/overlays/{name}.md"
        managed_guidance[relative] = (
            "sha256:" + hashlib.sha256((OVERLAY_TEMPLATE / f"{name}.md").read_bytes()).hexdigest()
        )
    return {
        "schema_version": SCHEMA_VERSION,
        "project_os_version": VERSION,
        "mode": mode,
        "active_program": active_program,
        "installation": installation,
        "generated_on": date.today().isoformat(),
        "packs": list(packs),
        "pack_paths": [f".agents/packs/{name}.md" for name in packs],
        "overlays": list(overlays),
        "overlay_paths": [f".agents/packs/overlays/{name}.md" for name in overlays],
        "managed_guidance": managed_guidance,
        "toolchain_signals": detect_repository(root)["toolchain_signals"],
        "paths": paths,
    }


def empty_reusable_knowledge() -> dict[str, Any]:
    return {"schema_version": 1, "entries": []}


def guidance_operations(
    root: Path,
    packs: Sequence[str],
    overlays: Sequence[str],
) -> list[tuple[str, Path, str | None]]:
    operations: list[tuple[str, Path, str | None]] = []
    readme_source = PACK_TEMPLATE / "README.md"
    readme_destination = root / ".agents" / "packs" / "README.md"
    operations.append(
        ("skip", readme_destination, None)
        if readme_destination.exists()
        else ("create", readme_destination, readme_source.read_text(encoding="utf-8"))
    )
    for name in packs:
        source = PACK_TEMPLATE / f"{name}.md"
        destination = root / ".agents" / "packs" / f"{name}.md"
        operations.append(
            ("skip", destination, None)
            if destination.exists()
            else ("create", destination, source.read_text(encoding="utf-8"))
        )
    for name in overlays:
        source = OVERLAY_TEMPLATE / f"{name}.md"
        destination = root / ".agents" / "packs" / "overlays" / f"{name}.md"
        operations.append(
            ("skip", destination, None)
            if destination.exists()
            else ("create", destination, source.read_text(encoding="utf-8"))
        )
    return operations


def guidance_content_map(packs: Sequence[str], overlays: Sequence[str]) -> dict[str, str]:
    contents = {
        ".agents/WORKFLOW.md": (CORE_TEMPLATE / ".agents/WORKFLOW.md").read_text(encoding="utf-8"),
        ".agents/packs/README.md": (PACK_TEMPLATE / "README.md").read_text(encoding="utf-8")
    }
    for name in packs:
        contents[f".agents/packs/{name}.md"] = (PACK_TEMPLATE / f"{name}.md").read_text(
            encoding="utf-8"
        )
    for name in overlays:
        contents[f".agents/packs/overlays/{name}.md"] = (
            OVERLAY_TEMPLATE / f"{name}.md"
        ).read_text(encoding="utf-8")
    return contents


def execute_operations(
    root: Path,
    operations: Sequence[tuple[str, Path, str | None]],
    dry_run: bool,
    before_write: Callable[[], None] | None = None,
) -> None:
    seen: set[Path] = set()
    for action, destination, content in operations:
        if action not in {"create", "skip"}:
            raise ProjectOSError(f"Unsupported file operation: {action}")
        require_destination_within_root(root, destination)
        reject_symlink_path(root, destination)
        if destination in seen:
            raise ProjectOSError(f"Duplicate file operation: {destination}")
        seen.add(destination)
        if action == "create" and destination.exists():
            raise ProjectOSError(f"Refusing to overwrite an existing file: {destination}")
        if action == "skip" and not destination.is_file():
            raise ProjectOSError(f"Preserved destination is not a regular file: {destination}")
        if action == "create" and content is None:
            raise ProjectOSError(f"Create operation has no content: {destination}")

    for action, destination, _ in operations:
        print(f"{action}: {destination.relative_to(root)}")
    if dry_run:
        return
    if before_write is not None:
        before_write()

    execute_sync_transaction(
        root,
        [(path, content or "") for action, path, content in operations if action == "create"],
        [],
    )


def execute_sync_transaction(
    root: Path,
    creates: Sequence[tuple[Path, str | bytes]],
    replacements: Sequence[tuple[Path, str, str]],
    deletions: Sequence[tuple[Path, str]] = (),
    after_write: Callable[[], None] | None = None,
    preconditions: dict[Path, str] | None = None,
) -> None:
    """Apply using anchored directories, with snapshot checks and guarded rollback."""
    # Callers resolve the user-selected root before planning. Do not resolve it again
    # here: a parent symlink introduced during planning must not select a new target.
    destinations = (
        [path for path, _ in creates]
        + [path for path, _, _ in replacements]
        + [path for path, _ in deletions]
    )
    if len(destinations) != len(set(destinations)):
        raise ProjectOSError("Sync transaction contains duplicate destinations")
    for path in [*destinations, *(preconditions or {})]:
        if not path.is_absolute() or not path.is_relative_to(root):
            raise ProjectOSError(f"Destination escapes repository: {path}")
    fs = AnchoredFilesystem(root)
    created: list[tuple[Path, int, tuple[int, int], str]] = []
    replaced: list[tuple[Path, int, bytes, int, tuple[int, int], str]] = []
    deleted: list[tuple[Path, int, str, str]] = []

    def require_hash(path: Path, expected: str) -> tuple[bytes, os.stat_result]:
        content, details = read_regular_at(fs.parent(path), path.name)
        if hashlib.sha256(content).hexdigest() != expected:
            raise ProjectOSError(f"File changed during operation: {path}")
        return content, details

    def check_preconditions(after: bool = False) -> None:
        for path, digest in (preconditions or {}).items():
            if not after or path not in destinations:
                require_hash(path, digest)

    def require_identity(directory_fd: int, name: str, identity: tuple[int, int], digest: str) -> None:
        content, details = read_regular_at(directory_fd, name)
        if (details.st_dev, details.st_ino) != identity or (
            hashlib.sha256(content).hexdigest() != digest
        ):
            raise ProjectOSError("file was concurrently changed or replaced")

    try:
        try:
            # Open existing parents before applying anything, pinning their identities.
            for path, _ in creates:
                try:
                    directory_fd = fs.parent(path)
                    os.stat(path.name, dir_fd=directory_fd, follow_symlinks=False)
                except FileNotFoundError:
                    continue
                raise ProjectOSError(f"File changed during sync: {path}")
            for path, _, digest in replacements:
                require_hash(path, digest)
            for path, digest in deletions:
                require_hash(path, digest)
            check_preconditions()
            fs.verify()
            for path, content in creates:
                directory_fd = fs.parent(path, create=True)
                fs.verify()
                intended = content if isinstance(content, bytes) else content.encode("utf-8")
                descriptor = os.open(
                    path.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o666, dir_fd=directory_fd,
                )
                details = os.fstat(descriptor)
                identity = (details.st_dev, details.st_ino)
                created.append((path, directory_fd, identity, hashlib.sha256(intended).hexdigest()))
                with os.fdopen(descriptor, "wb") as handle:
                    handle.write(intended)
                    handle.flush()
                    os.fsync(handle.fileno())
            for path, content, digest in replacements:
                directory_fd = fs.parent(path)
                original, details = require_hash(path, digest)
                fs.verify()
                replacement = atomic_write_text(path, content, digest, directory_fd=directory_fd)
                replaced.append((
                    path, directory_fd, original, stat.S_IMODE(details.st_mode),
                    (replacement.st_dev, replacement.st_ino),
                    hashlib.sha256(content.encode("utf-8")).hexdigest(),
                ))
            for path, digest in deletions:
                directory_fd = fs.parent(path)
                require_hash(path, digest)
                fs.verify()
                tombstone = f".{path.name}.project-os-delete.{uuid.uuid4().hex}"
                descriptor = os.open(
                    tombstone, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o600, dir_fd=directory_fd,
                )
                os.close(descriptor)
                try:
                    os.replace(path.name, tombstone, src_dir_fd=directory_fd, dst_dir_fd=directory_fd)
                except OSError:
                    os.unlink(tombstone, dir_fd=directory_fd)
                    raise
                deleted.append((path, directory_fd, tombstone, digest))
                actual, _ = read_regular_at(directory_fd, tombstone)
                if hashlib.sha256(actual).hexdigest() != digest:
                    raise ProjectOSError(f"File changed during deletion: {path}")
            fs.verify()
            check_preconditions(after=True)
            if after_write is not None:
                after_write()
            fs.verify()
            check_preconditions(after=True)
            # Final validation may invoke code that races with published destinations.
            # Check written bytes and identities too, not only read-only dependencies.
            for path, directory_fd, identity, digest in created:
                require_identity(directory_fd, path.name, identity, digest)
            for path, directory_fd, _, _, identity, digest in replaced:
                require_identity(directory_fd, path.name, identity, digest)
        except BaseException as error:
            failures: list[str] = []
            for path, directory_fd, tombstone, digest in reversed(deleted):
                try:
                    # Exclusive restore: never overwrite a concurrently recreated path.
                    content, _ = read_regular_at(directory_fd, tombstone)
                    if hashlib.sha256(content).hexdigest() != digest:
                        raise ProjectOSError("deletion backup was concurrently changed")
                    os.link(tombstone, path.name, src_dir_fd=directory_fd,
                            dst_dir_fd=directory_fd, follow_symlinks=False)
                    os.unlink(tombstone, dir_fd=directory_fd)
                except BaseException as rollback_error:
                    failures.append(f"{path}: {rollback_error}; original preserved at {tombstone}")
            for path, directory_fd, original, mode, identity, digest in reversed(replaced):
                try:
                    require_identity(directory_fd, path.name, identity, digest)
                    atomic_write_bytes(directory_fd, path.name, original, digest, mode)
                except BaseException as rollback_error:
                    failures.append(f"{path}: {rollback_error}")
            for path, directory_fd, identity, digest in reversed(created):
                try:
                    require_identity(directory_fd, path.name, identity, digest)
                    os.unlink(path.name, dir_fd=directory_fd)
                except BaseException as rollback_error:
                    failures.append(f"{path}: {rollback_error}")
            failures.extend(fs.rollback_directories())
            if failures:
                note = " rollback incomplete: " + "; ".join(failures)
                raise ProjectOSError(f"Project OS transaction failed;{note}: {error}") from error
            if isinstance(error, (KeyboardInterrupt, SystemExit)):
                raise
            raise ProjectOSError(
                f"Project OS transaction failed; changes were rolled back: {error}"
            ) from error
        for path, directory_fd, tombstone, digest in deleted:
            try:
                content, _ = read_regular_at(directory_fd, tombstone)
                if hashlib.sha256(content).hexdigest() != digest:
                    raise ProjectOSError(f"Deletion backup changed: {path}")
                os.unlink(tombstone, dir_fd=directory_fd)
            except (OSError, ProjectOSError) as error:
                raise ProjectOSError(f"Project OS transaction committed but cleanup failed: {error}") from error
    finally:
        fs.close()


def init_project(
    root: Path,
    packs_value: str,
    overlays_value: str,
    dry_run: bool,
    allow_existing_agents: bool = False,
) -> int:
    root = root.resolve()
    detection = detect_repository(root)
    packs = parse_selection(packs_value, detection["recommended_packs"], PACK_NAMES, "packs")
    overlays = parse_selection(
        overlays_value, detection["recommended_overlays"], OVERLAY_NAMES, "overlays"
    )
    validate_overlay_dependencies(packs, overlays)
    system_path = root / ".agents" / "SYSTEM.json"
    if system_path.exists():
        raise ProjectOSError("Project OS is already configured; use check instead of reinitializing")
    agents_path = root / "AGENTS.md"
    agents_exists = agents_path.exists()
    agents_root = root / ".agents"
    if agents_root.is_symlink() or (agents_root.exists() and not agents_root.is_dir()):
        raise ProjectOSError("Existing .agents must be a real directory")
    owned_names = {
        "SYSTEM.json",
        "WORKFLOW.md",
        "requests.json",
        "README.md",
        "CONTEXT.md",
        "STATE.md",
        "PROGRAM.md",
        "plans",
        "findings",
        "evidence",
        "knowledge",
        "packs",
        "history",
    }
    existing_owned = (
        sorted(name for name in owned_names if (agents_root / name).exists())
        if agents_root.is_dir()
        else []
    )
    if existing_owned or (agents_exists and not allow_existing_agents):
        raise ProjectOSError(
            "Existing repository instructions or Project OS-owned .agents state detected; "
            "use adopt instead of init"
        )
    if agents_exists and allow_existing_agents:
        if not agents_path.is_file() or agents_path.is_symlink():
            raise ProjectOSError("Existing AGENTS.md must be a regular file")
        agents_text = agents_path.read_text(encoding="utf-8", errors="ignore")
        required_routes = (".agents/CONTEXT.md", ".agents/STATE.md")
        missing_routes = [route for route in required_routes if route not in agents_text]
        if missing_routes:
            raise ProjectOSError(
                "Existing AGENTS.md must route to "
                + ", ".join(missing_routes)
                + " before --allow-existing-agents can preserve it"
            )

    replacements = {
        "__UPDATED_DATE__": date.today().isoformat(),
        "__PROJECT_NAME__": root.name,
        "__DETECTION_LINES__": detection_lines(detection),
        "__PACK_NAMES__": ", ".join(packs) if packs else "none",
        "__OVERLAY_NAMES__": ", ".join(overlays) if overlays else "none",
    }
    operations: list[tuple[str, Path, str | None]] = []
    template_roots = [CORE_TEMPLATE]
    for template_root in template_roots:
        for source in iter_template_files(template_root):
            relative = source.relative_to(template_root)
            if relative == Path("AGENTS.md") and agents_exists:
                continue
            destination = root / relative
            operations.append(
                ("skip", destination, None)
                if destination.exists()
                else (
                    "create",
                    destination,
                    render_template(source.read_text(encoding="utf-8"), replacements),
                )
            )

    paths = dict(DEFAULT_PATHS)
    system = default_system(root, "standard", "initialized", packs, overlays, paths)
    operations.extend(guidance_operations(root, packs, overlays))
    operations.append(("create", system_path, json.dumps(system, indent=2) + "\n"))
    if agents_exists:
        original, _ = read_regular_at_path(agents_path)
        agents_draft = original.decode("utf-8")
        replacements_for_init = []
        if ".agents/WORKFLOW.md" not in agents_draft:
            agents_draft = agents_draft.rstrip() + "\n\nRead `.agents/WORKFLOW.md` before non-trivial work and after context compaction. Current user and repository instructions take precedence.\n"
            replacements_for_init.append((agents_path, agents_draft, hashlib.sha256(original).hexdigest()))
        creates_for_init = [(path, content or "") for action, path, content in operations if action == "create"]
        print_transaction_preview(root, creates_for_init, replacements_for_init)
        if not dry_run:
            execute_sync_transaction(root, creates_for_init, replacements_for_init,
                                     after_write=lambda: require_passing_check(root, "Initialization"),
                                     preconditions={agents_path: hashlib.sha256(original).hexdigest()})
    else:
        execute_operations(root, operations, dry_run)

    if agents_exists:
        print("existing AGENTS.md preserved")
    if dry_run:
        print("dry-run: no files written")
    return 0


def scan_markdown_lessons(root: Path, roots: Sequence[str]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    occurrences: dict[tuple[str, str, str], int] = {}
    for raw_root in roots:
        lesson_root = safe_relative(root, raw_root)
        if lesson_root is None or not lesson_root.exists() or lesson_root.is_symlink():
            continue
        files = [lesson_root] if lesson_root.is_file() else sorted(lesson_root.rglob("*.md"))
        for path in files:
            if path.is_symlink():
                continue
            try:
                path.resolve().relative_to(root.resolve())
            except ValueError:
                continue
            relative = path.relative_to(root).as_posix()
            for line_number, line in enumerate(
                path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1
            ):
                match = LESSON_HEADING_PATTERN.match(line)
                if not match:
                    continue
                title = match.group(2)
                identity = (relative, match.group(1), title)
                occurrences[identity] = occurrences.get(identity, 0) + 1
                occurrence = occurrences[identity]
                fingerprint = hashlib.sha256(
                    f"{relative}\n{match.group(1)}\n{title}\n{occurrence}".encode("utf-8")
                ).hexdigest()[:16]
                records.append(
                    {
                        "source": relative,
                        "line": line_number,
                        "legacy_id": match.group(1),
                        "title": title,
                        "occurrence": occurrence,
                        "fingerprint": fingerprint,
                    }
                )
    return records


def file_sha256(path: Path) -> str:
    try:
        return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError as error:
        raise ProjectOSError(f"Could not hash adoption source: {path}: {error}") from error


def adoption_precondition_snapshot(
    root: Path,
    system: dict[str, Any],
    inventory: Sequence[dict[str, Any]],
    detection: dict[str, Any],
) -> dict[str, Any]:
    """Capture preserved adoption inputs so validation cannot go stale before mutation."""
    root = root.resolve()
    paths = system.get("paths")
    if not isinstance(paths, dict):
        raise ProjectOSError("Adoption SYSTEM paths must contain an object")

    tracked_files = {"AGENTS.md"}
    for key in (
        "context",
        "state",
        "plans",
        "findings",
        "program",
        "history_index",
        "knowledge_coverage",
    ):
        raw_path = paths.get(key)
        if isinstance(raw_path, str):
            tracked_files.add(raw_path)
    project_knowledge = paths.get("project_knowledge", [])
    if not isinstance(project_knowledge, list):
        raise ProjectOSError("Adoption project knowledge paths must be an array")
    tracked_files.update(path for path in project_knowledge if isinstance(path, str))

    file_hashes: dict[str, str] = {}
    for raw_path in sorted(tracked_files):
        path = safe_relative(root, raw_path)
        if path is None:
            raise ProjectOSError(f"Unsafe adoption source path: {raw_path!r}")
        reject_symlink_path(root, path)
        if not path.is_file():
            raise ProjectOSError(f"Missing adoption source file: {raw_path}")
        file_hashes[raw_path] = file_sha256(path)

    history_archives: dict[str, str] = {}
    raw_history = paths.get("history")
    raw_history_index = paths.get("history_index")
    if isinstance(raw_history, str) and isinstance(raw_history_index, str):
        history_path = safe_relative(root, raw_history)
        index_path = safe_relative(root, raw_history_index)
        if history_path is None or index_path is None:
            raise ProjectOSError("Unsafe adoption history paths")
        reject_symlink_path(root, history_path)
        reject_symlink_path(root, index_path)
        try:
            index_bytes = index_path.read_bytes()
        except OSError as error:
            raise ProjectOSError(f"Could not read adoption history index: {error}") from error
        index_digest = "sha256:" + hashlib.sha256(index_bytes).hexdigest()
        if file_hashes.get(raw_history_index) != index_digest:
            raise ProjectOSError("Adoption history index changed during discovery")
        try:
            history_index = json.loads(index_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ProjectOSError("Adoption history index is not valid UTF-8 JSON") from error
        entries = history_index.get("entries") if isinstance(history_index, dict) else None
        if not isinstance(entries, list):
            raise ProjectOSError("Adoption history index must contain an entries array")
        for position, entry in enumerate(entries):
            raw_archive = entry.get("path") if isinstance(entry, dict) else None
            archive_path = safe_relative(root, raw_archive)
            if archive_path is None:
                raise ProjectOSError(
                    f"Adoption history entry {position} has an unsafe path"
                )
            try:
                archive_path.resolve().relative_to(history_path.resolve())
            except ValueError as error:
                raise ProjectOSError(
                    f"Adoption history entry {position} is outside SYSTEM history"
                ) from error
            reject_symlink_path(root, archive_path)
            if not archive_path.is_file():
                raise ProjectOSError(
                    f"Adoption history entry {position} is not a regular file"
                )
            archive_digest = file_sha256(archive_path)
            if not isinstance(entry, dict) or entry.get("sha256") != archive_digest:
                raise ProjectOSError(
                    f"Adoption history entry {position} hash does not match its index"
                )
            if not isinstance(raw_archive, str):
                raise ProjectOSError(
                    f"Adoption history entry {position} has no valid path"
                )
            history_archives[raw_archive] = archive_digest

    directory_paths: list[str] = []
    for key in ("evidence", "history"):
        raw_path = paths.get(key)
        if not isinstance(raw_path, str):
            continue
        path = safe_relative(root, raw_path)
        if path is None:
            raise ProjectOSError(f"Unsafe adoption directory path: {raw_path!r}")
        reject_symlink_path(root, path)
        if not path.is_dir():
            raise ProjectOSError(f"Missing adoption directory: {raw_path}")
        directory_paths.append(raw_path)

    legacy_roots = paths.get("legacy_knowledge", [])
    if not isinstance(legacy_roots, list):
        raise ProjectOSError("Adoption legacy knowledge paths must be an array")
    legacy_hashes: dict[str, str] = {}
    for raw_root in legacy_roots:
        lesson_root = safe_relative(root, raw_root)
        if lesson_root is None:
            raise ProjectOSError(f"Unsafe legacy knowledge path: {raw_root!r}")
        reject_symlink_path(root, lesson_root)
        if not lesson_root.is_dir():
            raise ProjectOSError(f"Missing legacy knowledge directory: {raw_root}")
        directory_paths.append(raw_root)
        for path in sorted(lesson_root.rglob("*.md")):
            reject_symlink_path(root, path)
            if not path.is_file():
                raise ProjectOSError(f"Legacy knowledge path is not a regular file: {path}")
            relative = path.relative_to(root).as_posix()
            legacy_hashes[relative] = file_sha256(path)

    inventory_raw = json.dumps(
        list(inventory), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    detection_snapshot = {
        key: detection.get(key)
        for key in (
            "toolchain_signals",
            "recommended_packs",
            "recommended_overlays",
            "signals",
            "package_manager_signal",
            "package_scripts",
            "warnings",
        )
    }
    return {
        "files": file_hashes,
        "directories": sorted(set(directory_paths)),
        "history_archives": history_archives,
        "legacy_markdown": legacy_hashes,
        "legacy_inventory_sha256": "sha256:" + hashlib.sha256(inventory_raw).hexdigest(),
        "detection": detection_snapshot,
    }


def verify_adoption_preconditions(root: Path, report: dict[str, Any]) -> None:
    expected = report.get("preconditions")
    system = report.get("proposed_system")
    if not isinstance(expected, dict) or not isinstance(system, dict):
        raise ProjectOSError("Adoption report has no valid mutation preconditions")
    paths = system.get("paths")
    if not isinstance(paths, dict):
        raise ProjectOSError("Adoption report has no valid SYSTEM paths")
    refreshed = discover_adoption(root, include_inventory=False)
    current = refreshed.get("preconditions")
    if (
        not refreshed.get("safe_to_adopt")
        or refreshed.get("proposed_system") != system
        or current != expected
    ):
        changed = sorted(
            key
            for key in set(expected).union(current if isinstance(current, dict) else {})
            if expected.get(key)
            != (current.get(key) if isinstance(current, dict) else None)
        )
        if not refreshed.get("safe_to_adopt"):
            changed.append("validation")
        raise ProjectOSError(
            "Adoption sources changed after discovery"
            + (f" ({', '.join(sorted(set(changed)))})" if changed else "")
            + "; rerun the adoption dry run"
        )


def discover_adoption(root: Path, include_inventory: bool = False) -> dict[str, Any]:
    root = root.resolve()
    detection = detect_repository(root)
    errors: list[str] = []
    warnings: list[str] = []
    context = unique_existing(root, (".agents/CONTEXT.md",), "file", "context", errors)
    state = unique_existing(root, (".agents/STATE.md",), "file", "state", errors)
    plans = unique_existing(
        root,
        (".agents/plans/index.json", "docs/plans/index.json"),
        "file",
        "plans",
        errors,
    )
    findings = unique_existing(
        root,
        (
            ".agents/findings/findings.json",
            ".agents/audit/findings.json",
            "docs/audit/findings.json",
        ),
        "file",
        "findings",
        errors,
    )
    evidence = unique_existing(
        root,
        (".agents/evidence", ".agents/audit/evidence", "docs/audit/evidence"),
        "dir",
        "evidence",
        errors,
        prefer_nonempty=True,
    )
    program = unique_existing(root, (".agents/PROGRAM.md",), "file", "program", errors)
    history = unique_existing(root, (".agents/history",), "dir", "history", errors)
    history_index = unique_existing(
        root, (".agents/history/index.json",), "file", "history index", errors
    )
    coverage = unique_existing(
        root,
        (
            ".agents/adoption/knowledge-map.json",
            ".agents/knowledge/coverage.json",
        ),
        "file",
        "knowledge coverage",
        errors,
    )

    knowledge_root = root / ".agents" / "knowledge"
    if knowledge_root.is_symlink():
        errors.append(f"unsafe knowledge root symlink: {knowledge_root}")
    project_knowledge: list[str] = []
    canonical_project = knowledge_root / "project" / "failures.json"
    if canonical_project.is_file():
        project_knowledge.append(relative_string(root, canonical_project) or "")
    if knowledge_root.is_dir():
        for path in sorted(knowledge_root.glob("*.md")):
            if path.name.lower() != "readme.md":
                relative = relative_string(root, path)
                if relative is None:
                    errors.append(f"unsafe project knowledge path: {path}")
                else:
                    project_knowledge.append(relative)
    project_knowledge = [path for path in project_knowledge if path]

    legacy_knowledge: list[str] = []
    if knowledge_root.is_dir():
        for directory in sorted(path for path in knowledge_root.iterdir() if path.is_dir()):
            if directory.name in {"project", "reusable", "shared"}:
                continue
            if directory.is_symlink():
                errors.append(f"unsafe legacy knowledge symlink: {directory}")
                continue
            if any(directory.rglob("*.md")):
                relative = relative_string(root, directory)
                if relative:
                    legacy_knowledge.append(relative)

    paths = {
        "context": relative_string(root, context),
        "state": relative_string(root, state),
        "plans": relative_string(root, plans),
        "requests": DEFAULT_PATHS["requests"],
        "findings": relative_string(root, findings),
        "evidence": relative_string(root, evidence),
        "program": None,
        "history": relative_string(root, history) if history_index is not None else None,
        "history_index": relative_string(root, history_index),
        "reusable_knowledge": ".agents/knowledge/reusable/failures.json",
        "project_knowledge": project_knowledge,
        "legacy_knowledge": legacy_knowledge,
        "knowledge_coverage": relative_string(root, coverage),
    }
    if program is not None:
        errors.append(
            "existing PROGRAM.md is ambiguous; adoption creates Standard state only"
        )
    if history is not None and history_index is None:
        warnings.append(
            "existing history is preserved but remains unmanaged without history/index.json"
        )
    packs = list(detection["recommended_packs"])
    overlays = list(detection["recommended_overlays"])
    validate_overlay_dependencies(packs, overlays)
    system = default_system(root, "standard", "adopted", packs, overlays, paths)
    validate_system_owner_paths(root, paths, "standard", system.get("managed_guidance"), errors)

    if history is not None and history_index is not None:
        validate_history_index(root, history, history_index, errors)

    if not (root / "AGENTS.md").is_file():
        errors.append("missing root AGENTS.md")
    for owner in ("context", "state", "plans", "findings"):
        if paths[owner] is None:
            errors.append(f"could not discover required {owner} owner")
    if evidence is None:
        warnings.append("no evidence directory was discovered")
    agents_text = read_small_text(root / "AGENTS.md")
    for owner in (context, state):
        if owner is not None:
            relative = relative_string(root, owner)
            if relative and relative not in agents_text:
                errors.append(f"AGENTS.md does not route to {relative}")

    validate_adoption_records(root, paths, errors)
    for raw_path in project_knowledge:
        path = safe_relative(root, raw_path)
        if path is None or not path.is_file():
            errors.append(f"invalid project knowledge path: {raw_path}")
        elif path.suffix == ".json":
            validate_failure_registry(path, f"project knowledge {raw_path}", errors)

    inventory = scan_markdown_lessons(root, legacy_knowledge)
    counts: dict[str, int] = {}
    for record in inventory:
        counts[record["legacy_id"]] = counts.get(record["legacy_id"], 0) + 1
    duplicates = sorted(identifier for identifier, count in counts.items() if count > 1)
    if inventory and coverage is None:
        errors.append("legacy knowledge requires an explicit complete coverage map")
    elif coverage is not None:
        validate_knowledge_coverage(
            root,
            inventory,
            coverage,
            {},
            errors,
            require_canonical_targets=False,
        )
        warnings.append("legacy knowledge coverage is preserved for later user review")
    if duplicates:
        warnings.append("legacy knowledge duplicate ids are resolved only by source fingerprint")

    managed_destinations = [
        ".agents/WORKFLOW.md",
        ".agents/requests.json",
        ".agents/packs/README.md",
        ".agents/knowledge/reusable/failures.json",
        *(f".agents/packs/{name}.md" for name in packs),
        *(f".agents/packs/overlays/{name}.md" for name in overlays),
    ]
    for relative in managed_destinations:
        if (root / relative).exists():
            errors.append(f"Project OS-managed adoption destination already exists: {relative}")
    for relative in [*managed_destinations, ".agents/SYSTEM.json"]:
        try:
            reject_symlink_path(root, root / relative)
        except ProjectOSError as error:
            errors.append(str(error))

    planned_creates = [".agents/SYSTEM.json", ".agents/WORKFLOW.md", ".agents/requests.json"]
    planned_creates.extend(f".agents/packs/{name}.md" for name in packs)
    planned_creates.extend(f".agents/packs/overlays/{name}.md" for name in overlays)
    planned_creates.extend((".agents/packs/README.md", ".agents/knowledge/reusable/failures.json"))
    planned_creates = [relative for relative in planned_creates if not (root / relative).exists()]

    preconditions: dict[str, Any] | None = None
    if not errors:
        try:
            preconditions = adoption_precondition_snapshot(root, system, inventory, detection)
        except ProjectOSError as error:
            errors.append(str(error))

    if not errors and plans is not None:
        try:
            validate_plan_records(root, system, errors,
                                  index_value=migrate_plan_index(load_json(plans)),
                                  requests_value={"schema_version": 1, "next_id": 1, "requests": []})
        except ProjectOSError as error:
            errors.append(str(error))
    modified = []
    if not errors and plans is not None:
        original_plans = load_json(plans)
        if migrate_plan_index(original_plans) != original_plans:
            modified.append(paths["plans"])
    if ".agents/WORKFLOW.md" not in agents_text:
        modified.append("AGENTS.md")
    report: dict[str, Any] = {
        "target": str(root),
        "safe_to_adopt": not errors,
        "errors": errors,
        "warnings": warnings,
        "planned_creates": sorted(set(planned_creates)),
        "existing_files_modified": modified,
        "proposed_record_changes": ({
            paths["plans"]: migrate_plan_index(load_json(plans)),
            "AGENTS.md": agents_text if ".agents/WORKFLOW.md" in agents_text else agents_text.rstrip() + "\n\nRead `.agents/WORKFLOW.md` before non-trivial work and after context compaction. It owns durable request intake and guarded plan completion; current user and repository instructions take precedence.\n",
            ".agents/WORKFLOW.md": (CORE_TEMPLATE / ".agents/WORKFLOW.md").read_text(encoding="utf-8"),
            paths["requests"]: {"schema_version": 1, "next_id": 1, "requests": []},
        } if not errors and plans is not None else {}),
        "legacy_knowledge_count": len(inventory),
        "legacy_duplicate_ids": duplicates,
        "proposed_system": system,
        "preconditions": preconditions,
    }
    if include_inventory:
        report["legacy_knowledge_inventory"] = inventory
    return report


def adopt_project(root: Path, dry_run: bool, include_inventory: bool) -> int:
    root = root.resolve()
    system_path = root / ".agents" / "SYSTEM.json"
    if system_path.exists():
        raise ProjectOSError("Project OS is already configured; use check instead of adopt")
    report = discover_adoption(root, include_inventory=include_inventory)
    proposed = report["proposed_system"]
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not report["safe_to_adopt"]:
        return 1
    if dry_run:
        print("dry-run: no files written")
        return 0

    system = report["proposed_system"]
    snapshots = {root / raw_path: digest.removeprefix("sha256:")
                 for category in ("files", "history_archives", "legacy_markdown")
                 for raw_path, digest in report["preconditions"][category].items()}
    creates = [(root / raw_path, content) for raw_path, content in guidance_content_map(
        system["packs"], system["overlays"]
    ).items()]
    creates.extend([
        (root / system["paths"]["requests"], canonical_json({"schema_version": 1, "next_id": 1, "requests": []})),
        (root / system["paths"]["reusable_knowledge"], canonical_json(empty_reusable_knowledge())),
        (system_path, json.dumps(system, indent=2, ensure_ascii=False) + "\n"),
    ])
    for raw_path in report["planned_creates"]:
        if (root / raw_path).exists():
            raise ProjectOSError(f"Refusing to overwrite adoption destination: {raw_path}")
    verify_adoption_preconditions(root, report)
    legacy_system = copy.deepcopy(system)
    legacy_system["schema_version"] = 4
    legacy_system["paths"].pop("requests")
    # Use the same reviewed format/routing migration as upgrade.
    next_system = copy.deepcopy(legacy_system)
    extra_creates, replacements = plan_continuity_migration(root, legacy_system, next_system, snapshots)
    # The requests create above already belongs to the full adoption preview.
    assert len(extra_creates) == 1
    print_transaction_preview(root, creates, replacements)
    execute_sync_transaction(root, creates, replacements,
                             after_write=lambda: require_passing_check(root, "Adoption"), preconditions=snapshots)
    print("adopted: project content preserved; plan format and workflow routing migrated")
    return 0


def check_unique_ids(
    entries: Any,
    label: str,
    errors: list[str],
    required: Iterable[str],
    allowed_statuses: set[str] | None = None,
) -> set[str]:
    identifiers: set[str] = set()
    if not isinstance(entries, list):
        errors.append(f"{label} must be an array")
        return identifiers
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"{label}[{index}] must be an object")
            continue
        missing = [key for key in required if key not in entry]
        if missing:
            errors.append(f"{label}[{index}] is missing: {', '.join(missing)}")
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not entry_id:
            errors.append(f"{label}[{index}] has no valid id")
        elif entry_id in identifiers:
            errors.append(f"{label} contains duplicate id {entry_id}")
        else:
            identifiers.add(entry_id)
        status = entry.get("status")
        if allowed_statuses is not None and (
            not isinstance(status, str) or status not in allowed_statuses
        ):
            errors.append(f"{label}[{index}] has invalid status {entry.get('status')!r}")
    return identifiers


def entry_content_hash(entry: dict[str, Any]) -> str:
    value = copy.deepcopy(entry)
    source = value.get("source")
    if isinstance(source, dict):
        source.pop("content_hash", None)
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def semantic_lesson_hash(entry: dict[str, Any]) -> str:
    value = {
        key: copy.deepcopy(entry.get(key))
        for key in (
            "title",
            "applies_to",
            "trigger",
            "mechanism",
            "prevention",
            "verification",
            "boundaries",
        )
    }
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def make_user_owned_entry(
    value: dict[str, Any],
    *,
    status: str,
    source_kind: str,
    origin_pack: str | None = None,
) -> dict[str, Any]:
    entry = {
        key: copy.deepcopy(value[key])
        for key in (
            "id",
            "title",
            "applies_to",
            "trigger",
            "mechanism",
            "prevention",
            "verification",
            "boundaries",
        )
        if key in value
    }
    entry["status"] = status
    for key in ("replaces", "replaced_by", "reason", "previous_content_hash"):
        if key in value:
            entry[key] = copy.deepcopy(value[key])
    source: dict[str, Any] = {"kind": source_kind, "created_with": VERSION}
    if isinstance(origin_pack, str) and origin_pack:
        source["origin_pack"] = origin_pack
    entry["source"] = source
    source["content_hash"] = entry_content_hash(entry)
    return entry


def migrated_predecessor_hash(
    legacy_tombstone: dict[str, Any], origin_pack: str | None
) -> str | None:
    legacy_previous = legacy_tombstone.get("previous_content_hash")
    if (
        not isinstance(legacy_previous, str)
        or FULL_SHA256_PATTERN.fullmatch(legacy_previous) is None
    ):
        return None
    legacy_active = copy.deepcopy(legacy_tombstone)
    legacy_active["status"] = "active"
    for key in ("replaced_by", "reason", "previous_content_hash"):
        legacy_active.pop(key, None)
    if entry_content_hash(legacy_active) != legacy_previous:
        return None
    migrated_active = make_user_owned_entry(
        legacy_active,
        status="active",
        source_kind="user-reviewed",
        origin_pack=origin_pack,
    )
    return migrated_active["source"]["content_hash"]


def populated_migration_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, dict, set)):
        return bool(value)
    return True


def discarded_schema_three_migration_fields(
    entry: dict[str, Any], *, draft_fallback: bool, exact_managed_baseline: bool
) -> list[str]:
    """Name user-owned values schema-4 migration cannot preserve losslessly."""
    discarded: list[str] = []
    status = entry.get("status")
    if draft_fallback:
        if populated_migration_value(status) and status not in {"active", "draft"}:
            discarded.append("status")
        for field in ("replaces", "replaced_by", "reason", "previous_content_hash"):
            if field in entry and populated_migration_value(entry[field]):
                discarded.append(field)

    supported_top_level = {
        "id", "title", "status", "applies_to", "trigger", "mechanism",
        "prevention", "verification", "boundaries", "source", "replaces",
        "replaced_by", "reason", "previous_content_hash",
    }
    for field in sorted(set(entry).difference(supported_top_level)):
        if populated_migration_value(entry[field]):
            discarded.append(field)

    source = entry.get("source")
    if isinstance(source, dict):
        references = source.get("references")
        if not exact_managed_baseline and populated_migration_value(references):
            discarded.append("source.references")
        supported_source = {
            "kind", "pack", "project_os_version", "references", "content_hash",
        }
        for field in sorted(set(source).difference(supported_source)):
            if populated_migration_value(source[field]):
                discarded.append(f"source.{field}")
        pack = source.get("pack")
        supported_packs = {
            "core", *PACK_NAMES, *(f"overlay/{name}" for name in OVERLAY_NAMES),
        }
        if populated_migration_value(pack) and pack not in supported_packs:
            discarded.append("source.pack")
    elif populated_migration_value(source):
        discarded.append("source")
    return sorted(set(discarded))


def is_canonical_knowledge_token(value: Any) -> bool:
    return (
        isinstance(value, str)
        and bool(value)
        and value == value.strip()
        and "," not in value
        and not any(character.isspace() for character in value)
        and CANONICAL_TOKEN_CONTROL_PATTERN.search(value) is None
    )


def validate_strict_reusable_entries(
    entries: Any,
    label: str,
    errors: list[str],
    *,
    verify_hashes: bool,
) -> None:
    if not isinstance(entries, list):
        return
    by_id = {
        entry["id"]: entry
        for entry in entries
        if isinstance(entry, dict) and is_canonical_knowledge_token(entry.get("id"))
    }
    allowed = {
        "id", "title", "status", "applies_to", "trigger", "mechanism",
        "prevention", "verification", "boundaries", "source", "replaces",
        "replaced_by", "reason", "previous_content_hash",
    }
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        entry_id = entry.get("id")
        if not is_canonical_knowledge_token(entry_id):
            errors.append(
                f"{label}[{index}] id must be trimmed and contain no whitespace, commas or controls"
            )
        applies_to = entry.get("applies_to")
        if isinstance(applies_to, list):
            if any(not is_canonical_knowledge_token(tag) for tag in applies_to):
                errors.append(
                    f"{label}[{index}] applies_to tags must be trimmed and contain no whitespace, commas or controls"
                )
            elif len(applies_to) != len(set(applies_to)):
                errors.append(f"{label}[{index}] applies_to tags must be unique")
        extras = sorted(set(entry).difference(allowed))
        if extras:
            errors.append(f"{label}[{index}] has unsupported fields: {', '.join(extras)}")
        source = entry.get("source")
        if not isinstance(source, dict):
            errors.append(f"{label}[{index}] source must be an object")
            continue
        source_extras = sorted(
            set(source).difference({"kind", "created_with", "origin_pack", "content_hash"})
        )
        if source_extras:
            errors.append(
                f"{label}[{index}] source has unsupported fields: {', '.join(source_extras)}"
            )
        expected_kind = (
            "migration-review-required"
            if entry.get("status") == "draft"
            else "user-reviewed"
        )
        if source.get("kind") != expected_kind:
            errors.append(f"{label}[{index}] source.kind must be {expected_kind}")
        if (
            not isinstance(source.get("created_with"), str)
            or not source.get("created_with")
            or source["created_with"] != source["created_with"].strip()
        ):
            errors.append(f"{label}[{index}] source.created_with must be a canonical version")
        origin_pack = source.get("origin_pack")
        if origin_pack is not None and (
            not isinstance(origin_pack, str)
            or origin_pack not in {
                "core", *PACK_NAMES, *(f"overlay/{name}" for name in OVERLAY_NAMES),
            }
        ):
            errors.append(f"{label}[{index}] source.origin_pack is invalid")
        content_hash = source.get("content_hash")
        if not isinstance(content_hash, str) or FULL_SHA256_PATTERN.fullmatch(content_hash) is None:
            errors.append(f"{label}[{index}] content_hash must be sha256 followed by 64 hex digits")
        elif verify_hashes and content_hash != entry_content_hash(entry):
            errors.append(f"{label}[{index}] content_hash does not match its content")

        for relation in ("replaces", "replaced_by"):
            related = entry.get(relation)
            if related is not None and not is_canonical_knowledge_token(related):
                errors.append(f"{label}[{index}] {relation} must be a canonical id")
            elif related == entry_id:
                errors.append(f"{label}[{index}] {relation} cannot reference itself")

        status = entry.get("status")
        tombstone_fields = {"reason", "previous_content_hash"}
        if status in {"active", "draft"}:
            forbidden = sorted(
                field for field in (*tombstone_fields, "replaced_by") if field in entry
            )
            if status == "draft" and "replaces" in entry:
                forbidden.append("replaces")
            if forbidden:
                errors.append(
                    f"{label}[{index}] {status} entry has invalid lifecycle fields: "
                    + ", ".join(sorted(forbidden))
                )
        elif status in {"retired", "replaced"}:
            if not isinstance(entry.get("reason"), str) or not entry.get("reason", "").strip():
                errors.append(f"{label}[{index}] {status} entry needs a reason")
            previous = entry.get("previous_content_hash")
            if not isinstance(previous, str) or FULL_SHA256_PATTERN.fullmatch(previous) is None:
                errors.append(
                    f"{label}[{index}] {status} entry needs a full previous_content_hash"
                )
            if status == "retired" and "replaced_by" in entry:
                errors.append(f"{label}[{index}] retired entry cannot have replaced_by")
            if status == "replaced" and not is_canonical_knowledge_token(
                entry.get("replaced_by")
            ):
                errors.append(f"{label}[{index}] replaced entry needs replaced_by")

    for entry_id, entry in by_id.items():
        replaced_by = entry.get("replaced_by")
        if isinstance(replaced_by, str):
            if replaced_by not in by_id:
                errors.append(
                    f"{label} lifecycle link is dangling: {entry_id} replaced_by {replaced_by}"
                )
            elif by_id[replaced_by].get("replaces") != entry_id:
                errors.append(
                    f"{label} lifecycle mismatch: {entry_id} names {replaced_by} but the successor is not reciprocal"
                )
        replaces = entry.get("replaces")
        if isinstance(replaces, str):
            if replaces not in by_id:
                errors.append(
                    f"{label} lifecycle link is dangling: {entry_id} replaces {replaces}"
                )
            elif (
                by_id[replaces].get("status") != "replaced"
                or by_id[replaces].get("replaced_by") != entry_id
            ):
                errors.append(
                    f"{label} lifecycle mismatch: {entry_id} replaces {replaces} but the predecessor is not reciprocal"
                )
    visited: set[str] = set()
    for start in sorted(by_id):
        if start in visited:
            continue
        order: list[str] = []
        positions: dict[str, int] = {}
        current = start
        while current in by_id and current not in visited:
            if current in positions:
                cycle = order[positions[current]:] + [current]
                errors.append(
                    f"{label} lifecycle replacement cycle: " + " -> ".join(cycle)
                )
                break
            positions[current] = len(order)
            order.append(current)
            next_id = by_id[current].get("replaced_by")
            if not isinstance(next_id, str):
                break
            current = next_id
        visited.update(order)


def validate_registry_schema(value: dict[str, Any], label: str, errors: list[str]) -> None:
    versions = [value[key] for key in ("schema_version", "version") if key in value]
    if not versions:
        errors.append(f"{label} must declare schema_version or version")
    elif any(version != 1 for version in versions):
        errors.append(f"{label} schema version must be 1")


def system_path_value(
    root: Path,
    paths: dict[str, Any],
    key: str,
    errors: list[str],
    required: bool = False,
) -> Path | None:
    raw = paths.get(key)
    if raw is None:
        if required:
            errors.append(f"SYSTEM paths.{key} is required")
        return None
    path = safe_relative(root, raw)
    if path is None:
        errors.append(f"SYSTEM paths.{key} is not a safe repository-relative path: {raw!r}")
    return path


def validate_system_owner_paths(
    root: Path,
    paths: dict[str, Any],
    mode: Any,
    managed_guidance: Any,
    errors: list[str],
) -> None:
    """Require distinct file owners and reject unsafe directory ownership overlap."""
    raw_program = paths.get("program")
    if mode == "program" and raw_program != PROGRAM_RELATIVE_PATH:
        errors.append(
            f"Program mode requires SYSTEM paths.program to be {PROGRAM_RELATIVE_PATH}"
        )
    if mode == "standard" and raw_program is not None:
        errors.append("Standard mode requires SYSTEM paths.program to be null")

    def normalized(raw_path: str) -> str:
        return PurePosixPath(raw_path).as_posix().casefold()

    physical_file_owners: list[tuple[str, str]] = [
        ("AGENTS.md", "AGENTS.md"),
        ("SYSTEM manifest", ".agents/SYSTEM.json"),
    ]
    file_owners: list[tuple[str, str]] = [
        ("AGENTS.md", normalized("AGENTS.md")),
        ("SYSTEM manifest", normalized(".agents/SYSTEM.json")),
    ]
    for key in (
        "context",
        "state",
        "plans",
        "requests",
        "findings",
        "program",
        "history_index",
        "shared_knowledge",
        "reusable_knowledge",
        "knowledge_coverage",
    ):
        raw_path = paths.get(key)
        if isinstance(raw_path, str):
            physical_file_owners.append((f"paths.{key}", raw_path))
            file_owners.append((f"paths.{key}", normalized(raw_path)))
    project_knowledge = paths.get("project_knowledge")
    if isinstance(project_knowledge, list):
        physical_file_owners.extend(
            (f"paths.project_knowledge[{index}]", raw_path)
            for index, raw_path in enumerate(project_knowledge)
            if isinstance(raw_path, str)
        )
        file_owners.extend(
            (f"paths.project_knowledge[{index}]", normalized(raw_path))
            for index, raw_path in enumerate(project_knowledge)
            if isinstance(raw_path, str)
        )
    if isinstance(managed_guidance, dict):
        physical_file_owners.extend(
            (f"managed_guidance[{raw_path}]", raw_path)
            for raw_path in managed_guidance
            if isinstance(raw_path, str)
        )
        file_owners.extend(
            (f"managed_guidance[{raw_path}]", normalized(raw_path))
            for raw_path in managed_guidance
            if isinstance(raw_path, str)
        )

    owners_by_path: dict[str, list[str]] = {}
    for label, raw_path in file_owners:
        owners_by_path.setdefault(raw_path, []).append(label)
    for raw_path, labels in owners_by_path.items():
        if len(labels) > 1:
            errors.append(
                f"Project OS file owner collision at {raw_path}: {', '.join(labels)}"
            )

    owners_by_identity: dict[tuple[int, int], list[str]] = {}
    for label, raw_path in physical_file_owners:
        candidate = safe_relative(root, raw_path)
        if candidate is None:
            continue
        try:
            details = candidate.stat()
        except OSError:
            continue
        owners_by_identity.setdefault((details.st_dev, details.st_ino), []).append(label)
    for labels in owners_by_identity.values():
        if len(labels) > 1:
            errors.append(
                "Project OS file owners reference the same existing file: "
                + ", ".join(labels)
            )

    directory_owners: list[tuple[str, str]] = []
    for key in ("evidence", "history"):
        raw_path = paths.get(key)
        if isinstance(raw_path, str):
            directory_owners.append((f"paths.{key}", normalized(raw_path)))
    legacy_knowledge = paths.get("legacy_knowledge")
    if isinstance(legacy_knowledge, list):
        directory_owners.extend(
            (f"paths.legacy_knowledge[{index}]", normalized(raw_path))
            for index, raw_path in enumerate(legacy_knowledge)
            if isinstance(raw_path, str)
        )

    def contains(parent: str, child: str) -> bool:
        parent_parts = PurePosixPath(parent).parts
        child_parts = PurePosixPath(child).parts
        return (
            len(child_parts) > len(parent_parts)
            and child_parts[: len(parent_parts)] == parent_parts
        )

    for left_index, (left_label, left_path) in enumerate(directory_owners):
        for right_label, right_path in directory_owners[left_index + 1 :]:
            if left_path == right_path or contains(left_path, right_path) or contains(
                right_path, left_path
            ):
                errors.append(
                    "Project OS directory owner overlap: "
                    f"{left_label} ({left_path}) and {right_label} ({right_path})"
                )

    raw_history = paths.get("history")
    raw_history_index = paths.get("history_index")
    if (
        isinstance(raw_history, str)
        and isinstance(raw_history_index, str)
        and not contains(raw_history, raw_history_index)
    ):
        errors.append("SYSTEM paths.history_index must be inside paths.history")

    for file_label, file_path in file_owners:
        for directory_label, directory_path in directory_owners:
            if file_path != directory_path and not contains(directory_path, file_path):
                continue
            if file_label == "paths.history_index" and directory_label == "paths.history":
                continue
            errors.append(
                f"Project OS owner overlap: {file_label} ({file_path}) is owned by "
                f"{directory_label} ({directory_path})"
            )


def require_safe_system_owners(root: Path, system: dict[str, Any]) -> None:
    paths = system.get("paths")
    if not isinstance(paths, dict):
        raise ProjectOSError("SYSTEM paths must contain an object")
    errors: list[str] = []
    validate_system_owner_paths(
        root, paths, system.get("mode"), system.get("managed_guidance"), errors
    )
    if errors:
        raise ProjectOSError("Unsafe Project OS owners: " + "; ".join(errors))


def require_canonical_program_owner(root: Path, system: dict[str, Any]) -> Path:
    require_safe_system_owners(root, system)
    paths = system["paths"]
    if paths.get("program") != PROGRAM_RELATIVE_PATH:
        raise ProjectOSError(
            f"Program lifecycle requires SYSTEM paths.program to be {PROGRAM_RELATIVE_PATH}"
        )
    program_path = safe_relative(root, paths.get("program"))
    if program_path is None:
        raise ProjectOSError("SYSTEM Program path is unsafe")
    return program_path


def validate_failure_registry(
    path: Path,
    label: str,
    errors: list[str],
    verify_hashes: bool = True,
    strict_reusable: bool = False,
) -> set[str]:
    required = (
        "id",
        "title",
        "status",
        "applies_to",
        "trigger",
        "mechanism",
        "prevention",
        "verification",
        "boundaries",
        "source",
    )
    try:
        value = load_json(path)
    except ProjectOSError as error:
        errors.append(str(error))
        return set()
    entries = value.get("entries", []) if isinstance(value, dict) else None
    identifiers = check_unique_ids(entries, label, errors, required, FAILURE_STATUSES)
    if isinstance(value, dict):
        validate_registry_schema(value, label, errors)
    if isinstance(entries, list):
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                continue
            for key in ("id", "title", "trigger", "mechanism", "prevention"):
                if not isinstance(entry.get(key), str) or not entry.get(key).strip():
                    errors.append(f"{label}[{index}] has invalid {key}")
            for key in ("applies_to", "verification", "boundaries"):
                values = entry.get(key)
                if (
                    not isinstance(values, list)
                    or not values
                    or any(not isinstance(item, str) or not item.strip() for item in values)
                ):
                    errors.append(f"{label}[{index}] has invalid {key}")
    if strict_reusable:
        validate_strict_reusable_entries(
            entries, label, errors, verify_hashes=verify_hashes
        )
        for material_label in private_material_labels(value):
            errors.append(f"{label} contains a {material_label}")
    return identifiers


def validate_adoption_records(root: Path, paths: dict[str, Any], errors: list[str]) -> None:
    for key, maximum in (("context", 150), ("state", 80)):
        path = safe_relative(root, paths.get(key))
        if path is not None and path.is_file():
            lines = len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
            if lines > maximum:
                errors.append(f"{path.relative_to(root)} has {lines} lines; maximum is {maximum}")

    plans_path = safe_relative(root, paths.get("plans"))
    if plans_path is not None and plans_path.is_file():
        try:
            value = load_json(plans_path)
        except ProjectOSError as error:
            errors.append(str(error))
        else:
            if not isinstance(value, dict):
                errors.append("plans index must contain an object")
            else:
                if value.get("schema_version") != 2:
                    validate_registry_schema(value, "plans index", errors)
                plans = value.get("plans", [])
                check_unique_ids(plans, "plans", errors, ("id", "status", "path", "outcome"))
                active_ids: list[str] = []
                if isinstance(plans, list):
                    for plan in plans:
                        if not isinstance(plan, dict):
                            continue
                        identifier = plan.get("id")
                        status = plan.get("status")
                        if not isinstance(status, str) or status not in PLAN_STATUSES:
                            errors.append(f"plan {identifier!r} has invalid status {status!r}")
                        if status == "active" and isinstance(identifier, str):
                            active_ids.append(identifier)
                        plan_path = safe_relative(root, plan.get("path"))
                        if plan_path is None or not plan_path.is_file():
                            errors.append(f"plan {identifier!r} has an invalid or missing path")
                        else:
                            lines = len(
                                plan_path.read_text(encoding="utf-8", errors="ignore").splitlines()
                            )
                            if lines > 200:
                                errors.append(
                                    f"plan {identifier!r} has {lines} lines; maximum is 200"
                                )
                execution_state = value.get("execution_state")
                if execution_state == "running" and len(active_ids) != 1:
                    errors.append("running execution requires exactly one active plan")
                elif execution_state == "idle" and active_ids:
                    errors.append("idle execution requires no active plan")
                elif not isinstance(execution_state, str) or execution_state not in {
                    "running",
                    "idle",
                }:
                    errors.append("execution_state must be idle or running")
                if "active_plan" in value:
                    expected_active = active_ids[0] if len(active_ids) == 1 else None
                    if value.get("active_plan") != expected_active:
                        errors.append("active_plan must match the derived active plan when present")

    findings_path = safe_relative(root, paths.get("findings"))
    if findings_path is not None and findings_path.is_file():
        try:
            value = load_json(findings_path)
        except ProjectOSError as error:
            errors.append(str(error))
        else:
            if not isinstance(value, dict):
                errors.append("findings registry must contain an object")
            else:
                validate_registry_schema(value, "findings registry", errors)
                findings = value.get("findings", [])
                check_unique_ids(
                    findings,
                    "findings",
                    errors,
                    ("id", "status", "impact", "evidence", "required_check"),
                    FINDING_STATUSES,
                )
                if isinstance(findings, list):
                    for finding in findings:
                        if not isinstance(finding, dict):
                            continue
                        evidence = finding.get("evidence", [])
                        if not isinstance(evidence, list):
                            errors.append(
                                f"finding {finding.get('id')!r} evidence must be an array"
                            )
                            continue
                        for raw_path in evidence:
                            evidence_path = safe_relative(root, raw_path)
                            if evidence_path is None or not evidence_path.exists():
                                errors.append(
                                    f"finding {finding.get('id')!r} has invalid or missing evidence"
                                )


def validate_knowledge_coverage(
    root: Path,
    inventory: Sequence[dict[str, Any]],
    coverage_path: Path,
    reusable_targets: dict[str, str],
    errors: list[str],
    *,
    require_canonical_targets: bool = True,
) -> None:
    try:
        value = load_json(coverage_path)
    except ProjectOSError as error:
        errors.append(str(error))
        return
    if not isinstance(value, dict):
        errors.append("knowledge coverage must contain an object")
        return
    if value.get("schema_version") != 1:
        errors.append("knowledge coverage schema_version must be 1")
    entries = value.get("entries", [])
    if not isinstance(entries, list):
        errors.append("knowledge coverage entries must be an array")
        return
    expected: dict[str, dict[str, Any]] = {}
    for record in inventory:
        fingerprint = record["fingerprint"]
        if fingerprint in expected:
            errors.append(f"legacy inventory contains duplicate fingerprint {fingerprint}")
        expected[fingerprint] = record
    expected_sources = sorted({record["source"] for record in inventory})
    sources = value.get("sources", [])
    if not isinstance(sources, list):
        errors.append("knowledge coverage sources must be an array")
        sources = []
    seen_sources: set[str] = set()
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            errors.append(f"knowledge coverage source {index} must be an object")
            continue
        raw_path = source.get("path")
        path = safe_relative(root, raw_path)
        if path is None or not path.is_file():
            errors.append(f"knowledge coverage source {index} has an invalid path")
            continue
        if raw_path in seen_sources:
            errors.append(f"knowledge coverage duplicates source {raw_path}")
            continue
        seen_sources.add(raw_path)
        expected_hash = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
        if source.get("sha256") != expected_hash:
            errors.append(f"knowledge coverage source hash drifted: {raw_path}")
    if sorted(seen_sources) != expected_sources:
        missing_sources = sorted(set(expected_sources).difference(seen_sources))
        extra_sources = sorted(seen_sources.difference(expected_sources))
        if missing_sources:
            errors.append(
                "knowledge coverage is missing source hashes: " + ", ".join(missing_sources)
            )
        if extra_sources:
            errors.append(
                "knowledge coverage has unrelated source hashes: " + ", ".join(extra_sources)
            )

    seen: set[str] = set()
    canonical_seen: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"knowledge coverage entry {index} must be an object")
            continue
        fingerprint = entry.get("fingerprint")
        if not isinstance(fingerprint, str) or fingerprint not in expected:
            errors.append(f"knowledge coverage entry {index} has an unknown fingerprint")
            continue
        if fingerprint in seen:
            errors.append(f"knowledge coverage duplicates fingerprint {fingerprint}")
            continue
        seen.add(fingerprint)
        record = expected[fingerprint]
        for key in ("source", "legacy_id", "title", "occurrence"):
            if entry.get(key) != record[key]:
                errors.append(f"knowledge coverage {fingerprint} does not match source {key}")
        disposition = entry.get("disposition")
        if not isinstance(disposition, str) or disposition not in COVERAGE_DISPOSITIONS:
            errors.append(
                f"knowledge coverage {fingerprint} has invalid disposition {disposition!r}"
            )
        canonical_id = entry.get("canonical_id")
        if isinstance(disposition, str) and disposition in {"promoted", "merged"}:
            if not isinstance(canonical_id, str) or not canonical_id:
                errors.append(
                    f"knowledge coverage {fingerprint} has an invalid canonical id {canonical_id!r}"
                )
            elif canonical_id in reusable_targets:
                expected_target = reusable_targets[canonical_id]
                if entry.get("target") != expected_target:
                    errors.append(
                        f"knowledge coverage {fingerprint} target must be {expected_target}"
                    )
            elif require_canonical_targets:
                errors.append(
                    f"knowledge coverage {fingerprint} references missing reusable id {canonical_id!r}"
                )
            elif not isinstance(entry.get("target"), str) or not entry.get("target"):
                errors.append(f"knowledge coverage {fingerprint} has an invalid target")
            if isinstance(canonical_id, str) and canonical_id and disposition == "promoted":
                if canonical_id in canonical_seen:
                    errors.append(f"knowledge coverage duplicates canonical id {canonical_id}")
                canonical_seen.add(canonical_id)
        if disposition == "retained_private" and entry.get("target") != "project":
            errors.append(
                f"knowledge coverage {fingerprint} retained_private target must be project"
            )
        if disposition == "retired" and not entry.get("reason"):
            errors.append(f"knowledge coverage {fingerprint} retired entry needs a reason")
    missing = sorted(set(expected).difference(seen))
    extra = sorted(seen.difference(expected))
    if missing:
        errors.append(f"knowledge coverage is missing {len(missing)} source lessons")
    if extra:
        errors.append(f"knowledge coverage has {len(extra)} unknown source lessons")
    if value.get("source_count") != len(inventory):
        errors.append("knowledge coverage source_count does not match legacy inventory")
    if value.get("mapped_source_count") != len(seen):
        errors.append("knowledge coverage mapped_source_count does not match entries")


def validate_history_index(
    root: Path,
    history_path: Path,
    index_path: Path,
    errors: list[str],
) -> None:
    """Validate tamper-evident history entries against their recorded SHA-256 values."""
    try:
        value = load_json(index_path)
    except ProjectOSError as error:
        errors.append(str(error))
        return
    if not isinstance(value, dict):
        errors.append("history index must contain an object")
        return
    if value.get("schema_version") != 1:
        errors.append("history index schema_version must be 1")
    entries = value.get("entries")
    if not isinstance(entries, list):
        errors.append("history index entries must be an array")
        return

    identifiers: set[str] = set()
    indexed_paths: set[str] = set()
    for position, entry in enumerate(entries):
        label = f"history index entry {position}"
        if not isinstance(entry, dict):
            errors.append(f"{label} must be an object")
            continue
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not entry_id:
            errors.append(f"{label} has no valid id")
        elif entry_id in identifiers:
            errors.append(f"history index contains duplicate id {entry_id}")
        else:
            identifiers.add(entry_id)
        kind = entry.get("kind")
        if not isinstance(kind, str) or kind not in {"program", "snapshot"}:
            errors.append(f"{label} has invalid kind {kind!r}")
        raw_path = entry.get("path")
        path = safe_relative(root, raw_path)
        if path is None:
            errors.append(f"{label} has an unsafe path")
            continue
        try:
            path.resolve().relative_to(history_path.resolve())
        except ValueError:
            errors.append(f"{label} path is outside SYSTEM history")
            continue
        if path == index_path:
            errors.append(f"{label} cannot reference the history index itself")
            continue
        if isinstance(raw_path, str) and raw_path in indexed_paths:
            errors.append(f"history index contains duplicate path {raw_path}")
        elif isinstance(raw_path, str):
            indexed_paths.add(raw_path)
        check_no_symlink_path(root, path, label, errors)
        if not path.is_file():
            errors.append(f"{label} references a missing file: {raw_path}")
            continue
        expected_hash = entry.get("sha256")
        actual_hash = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
        if expected_hash != actual_hash:
            errors.append(f"history snapshot hash mismatch: {raw_path}")
        if kind == "program":
            if not isinstance(entry_id, str) or not re.fullmatch(
                r"program-\d{8}-\d{3,}", entry_id
            ):
                errors.append(f"{label} has an invalid Program id")
            elif path != history_path / "programs" / entry_id / "PROGRAM.md":
                errors.append(f"{label} path does not match its Program id")
            disposition = entry.get("disposition")
            if not isinstance(disposition, str) or disposition not in {
                "completed",
                "stopped",
            }:
                errors.append(f"{label} has invalid program disposition")
            try:
                canonical_date(entry.get("closed_on"), f"{label} closed_on")
            except ProjectOSError as error:
                errors.append(str(error))
            if disposition == "stopped" and (
                not isinstance(entry.get("reason"), str) or not entry.get("reason", "").strip()
            ):
                errors.append(f"{label} stopped Program requires a non-empty reason")


def markdown_section(text: str, heading: str) -> str | None:
    match = re.search(
        rf"(?ms)^## {re.escape(heading)}\s*\n(.*?)(?=^## |\Z)", text
    )
    return match.group(1).strip() if match else None


def validate_created_program_contract(
    program_text: str, active_program: dict[str, Any], errors: list[str]
) -> None:
    initiative = active_program.get("initiative")
    program_id = active_program.get("id")
    started_on = active_program.get("started_on")
    lines = program_text.splitlines()
    expected_metadata = {
        0: f"# Program: {initiative}",
        2: f"Program ID: {program_id}.",
        3: f"Started: {started_on}.",
        4: "Status: active.",
    }
    for line_index, expected in expected_metadata.items():
        if len(lines) <= line_index or lines[line_index] != expected:
            errors.append(f"PROGRAM.md metadata does not match SYSTEM: {expected}")

    sections = {
        heading: markdown_section(program_text, heading)
        for heading in (
            "Outcome",
            "Authority",
            "Phases",
            "Exit conditions",
            "Evidence requirements",
            "Cost boundary",
            "Exclusions",
        )
    }
    for heading, content in sections.items():
        if not content:
            errors.append(f"PROGRAM.md section must be non-empty: {heading}")

    for heading in (
        "Authority",
        "Exit conditions",
        "Evidence requirements",
        "Cost boundary",
        "Exclusions",
    ):
        content = sections.get(heading)
        if content and not any(line.startswith("- ") and line[2:].strip() for line in content.splitlines()):
            errors.append(f"PROGRAM.md section requires a non-empty list: {heading}")

    phases = sections.get("Phases")
    if not phases:
        return
    matches = list(re.finditer(r"(?m)^### ([1-9]\d*)\. (\S.*?)\s*$", phases))
    if len(matches) < 2:
        errors.append("PROGRAM.md requires at least two phases")
        return
    if [int(match.group(1)) for match in matches] != list(range(1, len(matches) + 1)):
        errors.append("PROGRAM.md phase numbers must be contiguous from 1")
    for index, match in enumerate(matches):
        body_end = matches[index + 1].start() if index + 1 < len(matches) else len(phases)
        body = phases[match.end() : body_end].strip()
        marker = "Phase exit conditions:"
        if marker not in body:
            errors.append(f"PROGRAM.md phase {index + 1} is missing exit conditions")
            continue
        outcome, conditions = body.split(marker, 1)
        if not outcome.strip():
            errors.append(f"PROGRAM.md phase {index + 1} outcome must be non-empty")
        if not any(
            line.startswith("- ") and line[2:].strip()
            for line in conditions.splitlines()
        ):
            errors.append(f"PROGRAM.md phase {index + 1} exit conditions must be non-empty")


def validate_active_program(
    program_path: Path | None, active_program: Any, errors: list[str]
) -> None:
    if not isinstance(active_program, dict):
        errors.append("Program mode requires SYSTEM active_program to be an object")
        return
    for key in ("id", "initiative", "origin"):
        if not isinstance(active_program.get(key), str) or not active_program.get(key):
            errors.append(f"SYSTEM active_program.{key} must be a non-empty string")
    program_id = active_program.get("id")
    if not isinstance(program_id, str) or not re.fullmatch(
        r"program-\d{8}-\d{3,}", program_id
    ):
        errors.append("SYSTEM active_program.id has an invalid format")
    origin = active_program.get("origin")
    if not isinstance(origin, str) or origin not in {"created", "legacy-migration"}:
        errors.append("SYSTEM active_program.origin must be created or legacy-migration")
        return
    if origin == "created":
        try:
            canonical_date(active_program.get("started_on"), "SYSTEM active_program.started_on")
        except ProjectOSError as error:
            errors.append(str(error))
        if program_path is not None and program_path.is_file():
            validate_created_program_contract(
                program_path.read_text(encoding="utf-8", errors="ignore"),
                active_program,
                errors,
            )
    else:
        if active_program.get("started_on") is not None:
            errors.append("Legacy-migration active_program.started_on must be null")
        try:
            canonical_date(
                active_program.get("migrated_on"), "SYSTEM active_program.migrated_on"
            )
        except ProjectOSError as error:
            errors.append(str(error))

GATE_STATUSES = {"pending", "verified", "not_applicable"}
REQUEST_STATUSES = {"captured", "needs_clarification", "integrated", "implemented", "withdrawn"}
REQUEST_RELATIONS = {"same_outcome", "prerequisite", "independent"}


def positive_integer(value: Any) -> bool:
    return type(value) is int and value > 0


def record_hash(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def retain_snapshot(snapshots: dict[Path, str] | None, path: Path, digest: str) -> None:
    if snapshots is not None:
        if path in snapshots and snapshots[path] != digest:
            raise ProjectOSError(f"File changed during validation: {path}")
        snapshots[path] = digest


def read_plan_input(
    root: Path, raw_path: Any, label: str, errors: list[str],
    snapshots: dict[Path, str] | None = None,
) -> tuple[Any, Path | None]:
    path = safe_relative(root, raw_path)
    if path is None:
        errors.append(f"{label} has an unsafe repository-relative path: {raw_path!r}")
        return None, None
    try:
        reject_symlink_path(root, path)
        value, digest = load_json_snapshot(path)
        retain_snapshot(snapshots, path, digest)
        return value, path
    except ProjectOSError as error:
        errors.append(f"{label}: {error}")
        return None, path


def validate_contract(
    root: Path, plan: dict[str, Any], errors: list[str],
    snapshots: dict[Path, str] | None = None,
) -> dict[str, Any] | None:
    label = f"plan {plan.get('id')!r} contract"
    contract, path = read_plan_input(root, plan.get("contract_path"), label, errors, snapshots)
    if not isinstance(contract, dict):
        errors.append(f"{label} must contain an object")
        return None
    if contract.get("schema_version") != 1 or type(contract.get("schema_version")) is not int:
        errors.append(f"{label} schema_version must be 1")
    if contract.get("plan_id") != plan.get("id"):
        errors.append(f"{label} plan_id must match the registry")
    revision = contract.get("revision")
    if not positive_integer(revision):
        errors.append(f"{label} revision must be a positive integer")
    gates = contract.get("gates")
    if not isinstance(gates, list) or not gates:
        errors.append(f"{label} gates must be a non-empty array")
        return contract
    check_unique_ids(gates, label + " gates", errors,
                     ("id", "condition", "evidence_class", "target", "status", "evidence", "next_action", "reason"), GATE_STATUSES)
    for gate in gates:
        if not isinstance(gate, dict):
            continue
        gate_label = f"{label} gate {gate.get('id')!r}"
        for key in ("condition", "evidence_class", "target"):
            if not isinstance(gate.get(key), str) or not gate[key].strip():
                errors.append(f"{gate_label} {key} must be non-empty text")
        for key in ("next_action", "reason"):
            if not isinstance(gate.get(key), str):
                errors.append(f"{gate_label} {key} must be text")
        status = gate.get("status")
        if status == "pending" and not str(gate.get("next_action") or "").strip():
            errors.append(f"{gate_label} pending requires next_action")
        if status == "not_applicable" and not str(gate.get("reason") or "").strip():
            errors.append(f"{gate_label} not_applicable requires a scope-grounded reason")
        evidence = gate.get("evidence")
        if not isinstance(evidence, list):
            errors.append(f"{gate_label} evidence must be an array")
            continue
        if status == "verified" and not evidence:
            errors.append(f"{gate_label} verified requires evidence")
        seen: set[str] = set()
        for proof in evidence:
            if not isinstance(proof, dict):
                errors.append(f"{gate_label} evidence must contain objects")
                continue
            raw_path = proof.get("path")
            if isinstance(raw_path, str):
                if raw_path in seen:
                    errors.append(f"{gate_label} duplicate evidence path {raw_path!r}")
                seen.add(raw_path)
            proof_path = safe_relative(root, raw_path)
            if proof_path is None:
                errors.append(f"{gate_label} unsafe evidence path: {raw_path!r}")
                continue
            try:
                reject_symlink_path(root, proof_path)
                content, _ = read_regular_at_path(proof_path)
                digest = hashlib.sha256(content).hexdigest()
                retain_snapshot(snapshots, proof_path, digest)
                if proof.get("sha256") != "sha256:" + digest:
                    errors.append(f"{gate_label} evidence hash mismatch: {raw_path}")
            except (OSError, ProjectOSError) as error:
                errors.append(f"{gate_label} evidence missing or unsafe: {raw_path}: {error}")
            try:
                canonical_date(proof.get("checked_on"), f"{gate_label} evidence checked_on")
            except ProjectOSError as error:
                errors.append(str(error))
            if proof.get("target") != gate.get("target"):
                errors.append(f"{gate_label} evidence target mismatch")
            if type(proof.get("revision")) is not int or proof.get("revision") != revision:
                errors.append(f"{gate_label} evidence revision is stale")
    return contract


def read_regular_at_path(path: Path) -> tuple[bytes, os.stat_result]:
    # Reject final symlinks and non-regular files even during read-only status checks.
    directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        return read_regular_at(directory_fd, path.name)
    finally:
        os.close(directory_fd)


def contract_gate_map(contract: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not isinstance(contract, dict) or not isinstance(contract.get("gates"), list):
        return {}
    return {gate["id"]: gate for gate in contract["gates"]
            if isinstance(gate, dict) and isinstance(gate.get("id"), str)}


def closure_requests(plan_id: str, requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # A successor's later progress must not invalidate its predecessor's receipt.
    return [request for request in requests if request.get("target_plan") == plan_id or (
        request.get("origin_plan") == plan_id and not (
            request.get("relation") == "independent"
            and request.get("target_plan") not in (None, plan_id)
            and request.get("status") in ("integrated", "implemented")
        )
    )]


def completion_record(
    root: Path, plan: dict[str, Any], contract: dict[str, Any],
    requests: list[dict[str, Any]], closed_on: str,
) -> dict[str, Any]:
    contract_path = safe_relative(root, plan["contract_path"])
    assert contract_path is not None
    proofs = {(proof["path"], proof["sha256"]) for gate in contract["gates"]
              for proof in gate["evidence"]}
    return {
        "closed_on": closed_on,
        "revision": contract["revision"],
        "contract_sha256": "sha256:" + hashlib.sha256(contract_path.read_bytes()).hexdigest(),
        "evidence": [{"path": path, "sha256": digest} for path, digest in sorted(proofs)],
        "requests": [{"id": request["id"], "sha256": record_hash(request)}
                     for request in sorted(closure_requests(plan["id"], requests), key=lambda item: item["id"])],
    }


def plan_blockers(
    plan: dict[str, Any], contract: dict[str, Any] | None, requests: list[dict[str, Any]],
) -> list[str]:
    blockers: list[str] = []
    if contract is None:
        blockers.append("A reviewed acceptance contract is required before resume or completion.")
    else:
        for gate in contract_gate_map(contract).values():
            if gate.get("status") == "pending":
                blockers.append(f"Gate {gate['id']}: {gate.get('condition')}; next: {gate.get('next_action')}")
    for request in closure_requests(plan["id"], requests):
        if request.get("status") not in ("implemented", "withdrawn"):
            blockers.append(f"Request {request['id']} remains {request.get('status')}: {request.get('interpretation')}")
    return blockers


def validate_plan_records(
    root: Path, system: dict[str, Any], errors: list[str],
    snapshots: dict[Path, str] | None = None,
    index_value: dict[str, Any] | None = None,
    requests_value: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]], list[dict[str, Any]]]:
    paths = system.get("paths", {})
    if index_value is None:
        index, _ = read_plan_input(root, paths.get("plans"), "plans index", errors, snapshots)
    else:
        index = index_value
    if not isinstance(index, dict):
        errors.append("plans index must contain an object")
        return {}, {}, []
    if type(index.get("schema_version")) is not int or index.get("schema_version") != 2:
        errors.append("plans index schema_version must be 2; run upgrade")
    if "version" in index and index["version"] != 2:
        errors.append("plans index version must match schema_version 2")
    plans = index.get("plans")
    check_unique_ids(plans, "plans", errors, ("id", "status", "path", "outcome"), PLAN_STATUSES)
    if not isinstance(plans, list):
        return index, {}, []
    plans = [plan for plan in plans if isinstance(plan, dict) and isinstance(plan.get("id"), str)]
    by_id = {plan["id"]: plan for plan in plans}
    legacy_closed = index.get("legacy_closed", {})
    legacy_open = index.get("legacy_uncontracted", [])
    if not isinstance(legacy_closed, dict) or any(
        not isinstance(key, str) or not isinstance(value, str) or value not in {"done", "superseded"}
        for key, value in (legacy_closed.items() if isinstance(legacy_closed, dict) else ())
    ):
        errors.append("plans legacy_closed must map IDs to original done or superseded statuses")
        legacy_closed = {}
    if not isinstance(legacy_open, list) or any(not isinstance(item, str) for item in legacy_open):
        errors.append("plans legacy_uncontracted must be an array of IDs")
        legacy_open = []
    if len(legacy_open) != len(set(legacy_open)):
        errors.append("plans legacy_uncontracted contains duplicate IDs")
    if set(legacy_closed).intersection(legacy_open):
        errors.append("legacy_closed and legacy_uncontracted must be disjoint")
    for plan_id, status in legacy_closed.items():
        if plan_id not in by_id or by_id[plan_id].get("status") != status:
            errors.append(f"legacy_closed plan {plan_id!r} must retain its original status {status!r}")
    for plan_id in legacy_open:
        if plan_id not in by_id or by_id[plan_id].get("status") not in ("active", "blocked", "planned"):
            errors.append(f"legacy_uncontracted plan {plan_id!r} must remain non-terminal")
        elif by_id[plan_id].get("contract_path") is not None:
            errors.append(f"legacy_uncontracted plan {plan_id!r} has a contract; remove its migration mark after review")
    active = [plan["id"] for plan in plans if plan.get("status") == "active"]
    if index.get("execution_state") == "running":
        if len(active) != 1:
            errors.append("running execution requires exactly one active plan")
        if "active_plan" in index and index["active_plan"] != (active[0] if len(active) == 1 else None):
            errors.append("active_plan must match the single active plan when present")
    elif index.get("execution_state") == "idle":
        if active:
            errors.append("idle execution requires no active plan")
        if "active_plan" in index and index["active_plan"] is not None:
            errors.append("idle execution requires active_plan null when present")
    else:
        errors.append("execution_state must be idle or running")
    contracts: dict[str, dict[str, Any]] = {}
    owners: dict[str, str] = {"AGENTS.md": "AGENTS.md", ".agents/SYSTEM.json": "SYSTEM"}
    for key in ("context", "state", "plans", "requests", "findings", "program", "history_index", "reusable_knowledge", "knowledge_coverage"):
        if isinstance(paths.get(key), str):
            owners[paths[key].casefold()] = key
    for raw_path in system.get("managed_guidance", {}):
        owners[raw_path.casefold()] = "managed guidance"
    for raw_path in paths.get("project_knowledge", []):
        if isinstance(raw_path, str):
            owners[raw_path.casefold()] = "project knowledge"
    identities: dict[tuple[int, int], str] = {}
    for raw_path, owner in owners.items():
        path = safe_relative(root, raw_path)
        if path is not None and path.is_file():
            details = path.stat()
            identities[(details.st_dev, details.st_ino)] = owner
    for plan in plans:
        if not isinstance(plan.get("outcome"), str) or not plan["outcome"].strip():
            errors.append(f"plan {plan['id']!r} outcome must be non-empty text")
        for key in ("path", "contract_path"):
            raw_path = plan.get(key)
            if key == "contract_path" and raw_path is None:
                if plan["id"] not in legacy_closed and plan["id"] not in legacy_open:
                    errors.append(f"plan {plan['id']!r} requires contract_path")
                continue
            path = safe_relative(root, raw_path)
            if path is None:
                errors.append(f"plan {plan['id']!r} has invalid {key}")
                continue
            normalized = path.relative_to(root).as_posix().casefold()
            if normalized in owners:
                errors.append(f"plan {plan['id']!r} {key} owner collision with {owners[normalized]}")
            owners[normalized] = f"plan {plan['id']} {key}"
            try:
                reject_symlink_path(root, path)
                data, details = read_regular_at_path(path)
                identity = (details.st_dev, details.st_ino)
                if identity in identities:
                    errors.append(f"plan {plan['id']!r} {key} aliases {identities[identity]}")
                identities[identity] = owners[normalized]
                retain_snapshot(snapshots, path, hashlib.sha256(data).hexdigest())
                if key == "path" and len(data.decode('utf-8').splitlines()) > 200:
                    errors.append(f"plan {plan['id']!r} exceeds 200 lines")
            except (OSError, UnicodeError, ProjectOSError) as error:
                errors.append(f"plan {plan['id']!r} {key} missing or unsafe: {error}")
        if plan.get("contract_path") is not None:
            contract = validate_contract(root, plan, errors, snapshots)
            if contract is not None:
                contracts[plan["id"]] = contract
    if requests_value is None:
        registry, _ = read_plan_input(root, paths.get("requests"), "requests registry", errors, snapshots)
    else:
        registry = requests_value
    requests: list[dict[str, Any]] = []
    if not isinstance(registry, dict):
        errors.append("requests registry must contain an object")
    else:
        if type(registry.get("schema_version")) is not int or registry.get("schema_version") != 1:
            errors.append("requests registry schema_version must be 1")
        if not positive_integer(registry.get("next_id")):
            errors.append("requests registry next_id must be a positive integer")
        raw_requests = registry.get("requests")
        check_unique_ids(raw_requests, "requests", errors,
                         ("id", "recorded_on", "source_text", "interpretation", "origin_plan", "target_plan", "relation", "status", "gate_ids", "decision"), REQUEST_STATUSES)
        if isinstance(raw_requests, list):
            requests = [item for item in raw_requests if isinstance(item, dict) and isinstance(item.get("id"), str)]
    for request in requests:
        label = f"request {request['id']!r}"
        if not re.fullmatch(r"R-[0-9]{3,}", request["id"]):
            errors.append(f"{label} ID must have R-NNN form")
        elif positive_integer(registry.get("next_id")) and int(request["id"][2:]) >= registry["next_id"]:
            errors.append(f"{label} next_id must exceed assigned IDs")
        for key in ("source_text", "interpretation"):
            if not isinstance(request.get(key), str) or not request[key].strip():
                errors.append(f"{label} {key} must be non-empty text")
        if not isinstance(request.get("decision"), str):
            errors.append(f"{label} decision must be text")
        try:
            canonical_date(request.get("recorded_on"), f"{label} recorded_on")
        except ProjectOSError as error:
            errors.append(str(error))
        relation = request.get("relation")
        if not isinstance(relation, str) or relation not in REQUEST_RELATIONS:
            errors.append(f"{label} invalid relation")
        for key in ("origin_plan", "target_plan"):
            value = request.get(key)
            if value is not None and (not isinstance(value, str) or value not in by_id):
                errors.append(f"{label} unknown {key}")
        gate_ids = request.get("gate_ids")
        if not isinstance(gate_ids, list) or any(not isinstance(item, str) for item in gate_ids):
            errors.append(f"{label} gate_ids must be an array of IDs")
            continue
        if len(gate_ids) != len(set(gate_ids)):
            errors.append(f"{label} duplicate gate_ids")
        status = request.get("status")
        if not isinstance(status, str):
            continue
        if status in {"integrated", "implemented"}:
            target = request.get("target_plan")
            if not isinstance(target, str) or target not in by_id or not gate_ids:
                errors.append(f"{label} routed requests require target_plan and gate_ids")
            if relation in ("same_outcome", "prerequisite") and (
                request.get("origin_plan") is None or target != request.get("origin_plan")
            ):
                errors.append(f"{label} required dependency must remain in its origin plan")
            if relation == "independent" and target != request.get("origin_plan") and not str(request.get("decision") or "").strip():
                errors.append(f"{label} independent routing requires a decision explaining the separate outcome and sequence")
            gates = contract_gate_map(contracts.get(target)) if isinstance(target, str) else {}
            for gate_id in gate_ids:
                if gate_id not in gates:
                    errors.append(f"{label} missing linked gate {gate_id!r}")
                elif status == "implemented" and gates[gate_id].get("status") != "verified":
                    errors.append(f"{label} implemented requires verified linked gates")
        if status == "withdrawn" and not str(request.get("decision") or "").strip():
            errors.append(f"{label} withdrawal requires the user's explicit cancellation or replacement in decision")
    for plan in plans:
        if plan.get("status") != "done" or plan["id"] in legacy_closed:
            continue
        receipt = plan.get("completion")
        contract = contracts.get(plan["id"])
        if not isinstance(receipt, dict):
            errors.append(f"plan {plan['id']!r} done requires a completion receipt; use plan complete")
            continue
        try:
            canonical_date(receipt.get("closed_on"), f"plan {plan['id']} completion closed_on")
        except ProjectOSError as error:
            errors.append(str(error))
        errors.extend(f"plan {plan['id']} done: {blocker}" for blocker in plan_blockers(plan, contract, requests))
        if contract is not None:
            try:
                if receipt != completion_record(root, plan, contract, requests, receipt.get("closed_on")):
                    errors.append(f"plan {plan['id']!r} completion receipt no longer matches its contract, evidence or scoped requests")
            except (KeyError, TypeError, OSError):
                errors.append(f"plan {plan['id']!r} completion receipt cannot be verified")
    return index, contracts, requests


def plan_status_report(root: Path, plan_id: str | None, snapshots: dict[Path, str] | None = None) -> dict[str, Any]:
    system = require_current_system(root, snapshots)
    errors: list[str] = []
    structural_output = io.StringIO()
    with contextlib.redirect_stdout(structural_output):
        structural_status = check_project(root)
    if structural_status:
        errors.extend(line.removeprefix("error: ") for line in structural_output.getvalue().splitlines()
                      if line.startswith("error: "))
    index, contracts, requests = validate_plan_records(root, system, errors, snapshots)
    errors = list(dict.fromkeys(errors))
    raw_plans = index.get("plans", [])
    plans = [item for item in raw_plans if isinstance(item, dict)] if isinstance(raw_plans, list) else []
    if plan_id is None:
        active = [plan for plan in plans if plan.get("status") == "active"]
        if len(active) != 1:
            raise ProjectOSError("plan status requires --id unless exactly one plan is active")
        plan = active[0]
    else:
        matches = [plan for plan in plans if plan.get("id") == plan_id]
        if len(matches) != 1:
            raise ProjectOSError(f"Unknown or ambiguous plan ID: {plan_id}")
        plan = matches[0]
    contract = contracts.get(plan["id"])
    blockers = plan_blockers(plan, contract, requests)
    readiness_blockers = [*errors, *blockers]
    if plan.get("status") not in ("active", "done"):
        readiness_blockers.append("Readiness requires an active plan or a validated completed plan.")
    ready = not readiness_blockers
    if plan.get("status") != "active":
        blockers.insert(0, "Only an active plan can be completed.")
    return {"plan_id": plan["id"], "outcome": plan["outcome"], "status": plan["status"],
            "ready": ready, "readiness": "READY" if ready else "NOT_READY",
            "readiness_blockers": readiness_blockers,
            "can_complete": not errors and not blockers, "errors": errors, "blockers": blockers,
            "gates": list(contract_gate_map(contract).values()),
            "requests": [request for request in requests if plan["id"] in (request.get("origin_plan"), request.get("target_plan"))],
            "following_slices": [item for item in plans if item.get("status") == "planned"]}


def plan_status(root: Path, plan_id: str | None, as_json: bool, require_ready: bool = False) -> int:
    report = plan_status_report(root.resolve(), plan_id)
    if as_json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"Readiness: {report['readiness']} - {report['outcome']}")
        print(f"Plan {report['plan_id']}: {report['status']} - {report['outcome']}")
        for gate in report["gates"]:
            print(f"{gate.get('id')}: {gate.get('status')} [{gate.get('evidence_class')}; {gate.get('target')}] {gate.get('condition')}")
        for blocker in [*report["errors"], *report["blockers"]]:
            print(f"remaining: {blocker}")
        for request in report["requests"]:
            print(f"request {request.get('id')}: {request.get('status')} -> {request.get('target_plan')}")
        for plan in report["following_slices"]:
            print(f"planned: {plan['id']} - {plan['outcome']}")
        print("Recorded closure eligible: " + ("yes" if report["can_complete"] else "no"))
    return 1 if report["errors"] or require_ready and not report["ready"] else 0


def complete_plan(root: Path, plan_id: str, checkpoint: Path, dry_run: bool) -> int:
    root = root.resolve()
    if check_project(root) != 0:
        raise ProjectOSError("Plan complete requires a clean structural check")
    snapshots: dict[Path, str] = {}
    report = plan_status_report(root, plan_id, snapshots)
    if not report["can_complete"]:
        raise ProjectOSError("Plan cannot close: " + "; ".join([*report["errors"], *report["blockers"]]))
    system = require_current_system(root, snapshots)
    errors: list[str] = []
    index, contracts, requests = validate_plan_records(root, system, errors, snapshots)
    if errors:
        raise ProjectOSError("Plan inputs changed or are invalid: " + "; ".join(errors))
    plan = next(item for item in index["plans"] if item["id"] == plan_id)
    if plan["status"] != "active" or plan_blockers(plan, contracts.get(plan_id), requests):
        raise ProjectOSError("Plan closure inputs changed during validation")
    checkpoint = checkpoint.absolute()
    if checkpoint.is_relative_to(root):
        reject_symlink_path(root, checkpoint)
    if checkpoint.is_symlink() or not checkpoint.is_file():
        raise ProjectOSError("Checkpoint draft must be a regular file")
    # Select the external parent once, as for a user-selected repository root.
    checkpoint = checkpoint.parent.resolve() / checkpoint.name
    reject_symlink_path(Path(checkpoint.anchor), checkpoint)
    content, draft_details = read_regular_at_path(checkpoint)
    draft_digest = hashlib.sha256(content).hexdigest()
    try:
        draft = content.decode("utf-8")
    except UnicodeError as error:
        raise ProjectOSError("Checkpoint must be UTF-8") from error
    if not draft.strip() or len(draft.splitlines()) > 80:
        raise ProjectOSError("Checkpoint must contain non-empty text of at most 80 lines")
    if not re.search(r"^Execution state: idle\.?$", draft, re.MULTILINE) or not re.search(
        r"^Active plan: none\.?$", draft, re.MULTILINE
    ):
        raise ProjectOSError("Checkpoint must declare Execution state: idle and Active plan: none on separate lines")
    reserved = [token for token in RESERVED_TEMPLATE_TOKENS if token in draft]
    if reserved:
        raise ProjectOSError("Checkpoint contains unresolved template tokens")
    state_path = safe_relative(root, system["paths"]["state"])
    index_path = safe_relative(root, system["paths"]["plans"])
    assert state_path is not None and index_path is not None
    state_bytes, _ = read_regular_at_path(state_path)
    state_digest = hashlib.sha256(state_bytes).hexdigest()
    snapshots[state_path] = state_digest
    draft_identity = (draft_details.st_dev, draft_details.st_ino)
    if checkpoint == state_path or checkpoint == index_path or checkpoint in snapshots or any(
        (path.stat().st_dev, path.stat().st_ino) == draft_identity for path in snapshots
    ):
        raise ProjectOSError("Checkpoint draft must be separate from Project OS record owners")
    plan["completion"] = completion_record(root, plan, contracts[plan_id], requests, date.today().isoformat())
    plan["status"] = "done"
    index["execution_state"] = "idle"
    if "active_plan" in index:
        index["active_plan"] = None
    replacements = [(index_path, canonical_json(index), snapshots[index_path]), (state_path, draft, state_digest)]
    print(json.dumps({"transition": {"plan_id": plan_id, "from": "active", "to": "done", "execution_state": "idle"},
                      "completion": plan["completion"], "checkpoint": draft}, indent=2, ensure_ascii=False))
    print_transaction_preview(root, [], replacements)
    if dry_run:
        print("dry-run: no files written")
        return 0

    def verify_checkpoint() -> None:
        reject_symlink_path(Path(checkpoint.anchor), checkpoint)
        current, details = read_regular_at_path(checkpoint)
        if hashlib.sha256(current).hexdigest() != draft_digest or (
            details.st_dev, details.st_ino
        ) != draft_identity:
            raise ProjectOSError("Checkpoint draft changed during operation")

    def validate_completion() -> None:
        require_passing_check(root, "Plan completion")
        verify_checkpoint()

    verify_checkpoint()
    execute_sync_transaction(root, [], replacements,
                             after_write=validate_completion, preconditions=snapshots)
    return 0


def migrate_plan_index(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProjectOSError("Plans index must contain an object")
    if value.get("schema_version") == 2:
        return copy.deepcopy(value)
    errors: list[str] = []
    validate_registry_schema(value, "legacy plans index", errors)
    check_unique_ids(value.get("plans"), "legacy plans", errors, ("id", "status", "path", "outcome"), PLAN_STATUSES)
    if errors:
        raise ProjectOSError("Invalid legacy plans index: " + "; ".join(errors))
    migrated = copy.deepcopy(value)
    if "legacy_closed" in migrated or "legacy_uncontracted" in migrated:
        raise ProjectOSError("Legacy plans index collides with new migration fields")
    migrated["schema_version"] = 2
    if "version" in migrated:
        migrated["version"] = 2
    migrated["legacy_closed"] = {}
    migrated["legacy_uncontracted"] = []
    for plan in migrated["plans"]:
        if plan["status"] in {"done", "superseded"}:
            migrated["legacy_closed"][plan["id"]] = plan["status"]
        elif not plan.get("contract_path"):
            migrated["legacy_uncontracted"].append(plan["id"])
    return migrated


def plan_continuity_migration(
    root: Path, original_system: dict[str, Any], next_system: dict[str, Any],
    snapshots: dict[Path, str],
) -> tuple[list[tuple[Path, str | bytes]], list[tuple[Path, str, str]]]:
    creates: list[tuple[Path, str | bytes]] = []
    replacements: list[tuple[Path, str, str]] = []
    paths = next_system["paths"]
    if original_system.get("schema_version") == SCHEMA_VERSION:
        return creates, replacements
    if "requests" in paths:
        raise ProjectOSError("Legacy SYSTEM requests owner collides with schema-5 migration")
    paths["requests"] = DEFAULT_PATHS["requests"]
    request_path = root / paths["requests"]
    reject_symlink_path(root, request_path)
    if request_path.exists():
        raise ProjectOSError("Requests destination already exists; resolve ownership before upgrade")
    creates.append((request_path, canonical_json({"schema_version": 1, "next_id": 1, "requests": []})))
    index_path = safe_relative(root, paths.get("plans"))
    if index_path is None:
        raise ProjectOSError("Plans owner is unsafe")
    reject_symlink_path(root, index_path)
    value, digest = load_json_snapshot(index_path)
    snapshots[index_path] = digest
    migrated = migrate_plan_index(value)
    if migrated != value:
        replacements.append((index_path, canonical_json(migrated), digest))
    agents_path = root / "AGENTS.md"
    reject_symlink_path(root, agents_path)
    data, _ = read_regular_at_path(agents_path)
    digest = hashlib.sha256(data).hexdigest()
    snapshots[agents_path] = digest
    text = data.decode("utf-8")
    if ".agents/WORKFLOW.md" not in text:
        text = text.rstrip() + "\n\nRead `.agents/WORKFLOW.md` before non-trivial work and after context compaction. It owns durable request intake and guarded plan completion; current user and repository instructions take precedence.\n"
        replacements.append((agents_path, text, digest))
    return creates, replacements


def check_project(root: Path, config: Path | None = None) -> int:
    root = root.resolve()
    errors: list[str] = []
    config_path = config.resolve() if config else root / ".agents" / "SYSTEM.json"
    if config is None:
        check_no_symlink_path(root, config_path, "SYSTEM manifest", errors)
    try:
        loaded_system = load_json(config_path)
    except ProjectOSError as error:
        print("Project OS check: FAIL")
        print(f"error: {error}")
        return 1
    if not isinstance(loaded_system, dict):
        print("Project OS check: FAIL")
        print("error: SYSTEM configuration must contain an object")
        return 1
    system = loaded_system

    if system.get("schema_version") != SCHEMA_VERSION:
        errors.append(
            f"SYSTEM schema_version must be {SCHEMA_VERSION}, got {system.get('schema_version')!r}"
        )
    if system.get("project_os_version") != VERSION:
        errors.append(
            "SYSTEM project_os_version must match the installed Project OS version "
            f"{VERSION!r}, got {system.get('project_os_version')!r}; run the Project OS "
            "upgrade workflow with `$project-os upgrade`"
        )
    mode = system.get("mode")
    if not isinstance(mode, str) or mode not in {"standard", "program"}:
        errors.append(f"SYSTEM mode must be standard or program, got {mode!r}")
    installation = system.get("installation")
    if not isinstance(installation, str) or installation not in {"initialized", "adopted"}:
        errors.append(f"SYSTEM installation must be initialized or adopted, got {installation!r}")

    packs = system.get("packs", [])
    overlays = system.get("overlays", [])
    if not isinstance(packs, list) or any(pack not in PACK_NAMES for pack in packs):
        errors.append("SYSTEM packs must be an array of known capability packs")
        packs = []
    elif packs != [name for name in PACK_NAMES if name in set(packs)]:
        errors.append("SYSTEM packs must be unique and in canonical order")
    if not isinstance(overlays, list) or any(overlay not in OVERLAY_NAMES for overlay in overlays):
        errors.append("SYSTEM overlays must be an array of known ecosystem overlays")
        overlays = []
    elif overlays != [name for name in OVERLAY_NAMES if name in set(overlays)]:
        errors.append("SYSTEM overlays must be unique and in canonical order")
    try:
        validate_overlay_dependencies(packs, overlays)
    except ProjectOSError as error:
        errors.append(str(error))

    expected_pack_paths = [f".agents/packs/{name}.md" for name in packs]
    expected_overlay_paths = [f".agents/packs/overlays/{name}.md" for name in overlays]
    if system.get("pack_paths", []) != expected_pack_paths:
        errors.append("SYSTEM pack_paths must match packs in canonical order")
    if system.get("overlay_paths", []) != expected_overlay_paths:
        errors.append("SYSTEM overlay_paths must match overlays in canonical order")
    for raw_path in [*expected_pack_paths, *expected_overlay_paths]:
        path = safe_relative(root, raw_path)
        if path is not None:
            check_no_symlink_path(root, path, f"managed guidance {raw_path}", errors)
        if path is None or not path.is_file():
            errors.append(f"missing selected guidance file: {raw_path}")

    managed_guidance = system.get("managed_guidance")
    expected_managed_paths = [
        ".agents/WORKFLOW.md",
        ".agents/packs/README.md",
        *expected_pack_paths,
        *expected_overlay_paths,
    ]
    if not isinstance(managed_guidance, dict) or list(managed_guidance) != expected_managed_paths:
        errors.append("SYSTEM managed_guidance must match selected guidance in canonical order")
        managed_guidance = {}
    for raw_path, expected_hash in managed_guidance.items():
        path = safe_relative(root, raw_path)
        if path is not None:
            check_no_symlink_path(root, path, f"managed guidance {raw_path}", errors)
        if path is None or not path.is_file():
            continue
        actual_hash = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
        if expected_hash != actual_hash:
            errors.append(f"managed guidance differs from its recorded baseline: {raw_path}")

    if "managed_knowledge" in system:
        errors.append("SYSTEM managed_knowledge was removed in schema 4; run upgrade")

    paths = system.get("paths")
    if not isinstance(paths, dict):
        errors.append("SYSTEM paths must contain an object")
        paths = {}
    validate_system_owner_paths(root, paths, mode, managed_guidance, errors)

    if not (root / "AGENTS.md").is_file():
        errors.append("missing required file: AGENTS.md")
    if installation == "initialized":
        for relative in (
            ".agents/README.md",
            ".agents/plans/README.md",
            ".agents/findings/README.md",
            ".agents/evidence/README.md",
            ".agents/knowledge/README.md",
            ".agents/packs/README.md",
        ):
            if not (root / relative).is_file():
                errors.append(f"missing required file: {relative}")

    context_path = system_path_value(root, paths, "context", errors, required=True)
    state_path = system_path_value(root, paths, "state", errors, required=True)
    plans_path = system_path_value(root, paths, "plans", errors, required=True)
    findings_path = system_path_value(root, paths, "findings", errors, required=True)
    evidence_path = system_path_value(root, paths, "evidence", errors)
    program_path = system_path_value(root, paths, "program", errors, required=mode == "program")
    history_path = system_path_value(root, paths, "history", errors)
    history_index_path = system_path_value(root, paths, "history_index", errors)
    if "shared_knowledge" in paths:
        errors.append("SYSTEM paths.shared_knowledge was removed in schema 4; run upgrade")
    reusable_path = system_path_value(root, paths, "reusable_knowledge", errors, required=True)

    for label, path in (
        ("context", context_path),
        ("state", state_path),
        ("plans", plans_path),
        ("findings", findings_path),
        ("evidence", evidence_path),
        ("program", program_path),
        ("history", history_path),
        ("history index", history_index_path),
        ("reusable knowledge", reusable_path),
    ):
        if path is not None:
            check_no_symlink_path(root, path, f"SYSTEM path {label}", errors)

    for label, path in (
        ("context", context_path),
        ("state", state_path),
        ("plans", plans_path),
        ("findings", findings_path),
        ("reusable knowledge", reusable_path),
    ):
        if path is not None and not path.is_file():
            errors.append(f"missing {label} file: {path.relative_to(root)}")
    if evidence_path is not None and not evidence_path.is_dir():
        errors.append(f"missing evidence directory: {evidence_path.relative_to(root)}")
    if program_path is not None and not program_path.is_file():
        errors.append(f"missing program file: {program_path.relative_to(root)}")
    if history_path is not None and not history_path.is_dir():
        errors.append(f"missing history directory: {history_path.relative_to(root)}")
    if history_index_path is not None and not history_index_path.is_file():
        errors.append(f"missing history index file: {history_index_path.relative_to(root)}")

    active_program = system.get("active_program")
    if mode == "standard":
        if program_path is not None:
            errors.append("Standard mode requires SYSTEM paths.program to be null")
        if active_program is not None:
            errors.append("Standard mode requires SYSTEM active_program to be null")
        if (root / ".agents" / "PROGRAM.md").exists():
            errors.append("Standard mode cannot retain an active .agents/PROGRAM.md")
    elif mode == "program":
        validate_active_program(program_path, active_program, errors)

    if (history_path is None) != (history_index_path is None):
        errors.append("SYSTEM history and history_index paths must be set together")
    if history_path is not None and history_index_path is not None and history_index_path.is_file():
        validate_history_index(root, history_path, history_index_path, errors)

    agents_path = root / "AGENTS.md"
    check_no_symlink_path(root, agents_path, "AGENTS.md", errors)
    if agents_path.is_file():
        agents_text = agents_path.read_text(encoding="utf-8", errors="ignore")
        for routed_path in (context_path, state_path, root / ".agents/WORKFLOW.md"):
            if routed_path is None:
                continue
            relative = routed_path.relative_to(root).as_posix()
            if relative not in agents_text:
                errors.append(f"AGENTS.md does not route to {relative}")

    for path, maximum in ((context_path, 150), (state_path, 80)):
        if path is not None and path.is_file():
            lines = len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
            if lines > maximum:
                errors.append(f"{path.relative_to(root)} has {lines} lines; maximum is {maximum}")

    validate_plan_records(root, system, errors)

    if findings_path is not None and findings_path.is_file():
        try:
            findings_value = load_json(findings_path)
        except ProjectOSError as error:
            errors.append(str(error))
        else:
            if isinstance(findings_value, dict):
                validate_registry_schema(findings_value, "findings registry", errors)
            findings = findings_value.get("findings", []) if isinstance(findings_value, dict) else None
            check_unique_ids(
                findings,
                "findings",
                errors,
                ("id", "status", "impact", "evidence", "required_check"),
                FINDING_STATUSES,
            )
            if isinstance(findings, list):
                for finding in findings:
                    if not isinstance(finding, dict):
                        continue
                    evidence = finding.get("evidence", [])
                    if not isinstance(evidence, list):
                        errors.append(f"finding {finding.get('id')!r} evidence must be an array")
                        continue
                    for raw_path in evidence:
                        path = safe_relative(root, raw_path)
                        if path is None:
                            errors.append(f"finding {finding.get('id')!r} has invalid evidence path")
                        elif not path.exists():
                            errors.append(
                                f"finding {finding.get('id')!r} evidence does not exist: {raw_path}"
                            )

    reusable_targets: dict[str, str] = {}
    if reusable_path is not None and reusable_path.is_file():
        valid_reusable_ids = validate_failure_registry(
            reusable_path, "reusable knowledge", errors, strict_reusable=True
        )
        try:
            reusable_value = load_json(reusable_path)
        except ProjectOSError:
            reusable_value = None
        if isinstance(reusable_value, dict):
            if set(reusable_value) != {"schema_version", "entries"}:
                errors.append("reusable knowledge may contain only schema_version and entries")
            entries = reusable_value.get("entries", [])
            if isinstance(entries, list):
                for entry in entries:
                    entry_id = entry.get("id") if isinstance(entry, dict) else None
                    if (
                        not isinstance(entry, dict)
                        or not isinstance(entry_id, str)
                        or entry_id not in valid_reusable_ids
                    ):
                        continue
                    source = entry.get("source")
                    origin_pack = source.get("origin_pack") if isinstance(source, dict) else None
                    if isinstance(origin_pack, str):
                        reusable_targets[entry["id"]] = origin_pack

    project_paths = paths.get("project_knowledge", [])
    if not isinstance(project_paths, list):
        errors.append("SYSTEM paths.project_knowledge must be an array")
        project_paths = []
    for raw_path in project_paths:
        path = safe_relative(root, raw_path)
        if path is None:
            errors.append(f"invalid project knowledge path: {raw_path!r}")
        else:
            check_no_symlink_path(root, path, f"SYSTEM project knowledge {raw_path}", errors)
            if not path.is_file():
                errors.append(f"missing project knowledge file: {raw_path}")
            elif path.suffix == ".json":
                validate_failure_registry(path, f"project knowledge {raw_path}", errors)

    legacy_roots = paths.get("legacy_knowledge", [])
    if not isinstance(legacy_roots, list):
        errors.append("SYSTEM paths.legacy_knowledge must be an array")
        legacy_roots = []
    for raw_path in legacy_roots:
        path = safe_relative(root, raw_path)
        if path is None:
            errors.append(f"invalid legacy knowledge path: {raw_path!r}")
        else:
            check_no_symlink_path(root, path, f"SYSTEM legacy knowledge {raw_path}", errors)
            if not path.exists():
                errors.append(f"missing legacy knowledge path: {raw_path}")
    inventory = scan_markdown_lessons(root, legacy_roots)
    counts: dict[str, int] = {}
    for record in inventory:
        counts[record["legacy_id"]] = counts.get(record["legacy_id"], 0) + 1
    duplicate_legacy_ids = sorted(identifier for identifier, count in counts.items() if count > 1)
    coverage_path = system_path_value(root, paths, "knowledge_coverage", errors)
    if coverage_path is not None:
        check_no_symlink_path(root, coverage_path, "SYSTEM knowledge coverage", errors)
        if not coverage_path.is_file():
            errors.append(f"missing knowledge coverage file: {coverage_path.relative_to(root)}")
        else:
            validate_knowledge_coverage(
                root,
                inventory,
                coverage_path,
                reusable_targets,
                errors,
                require_canonical_targets=False,
            )

    scan_paths: list[Path] = [config_path]
    scan_paths.extend(
        path for path in (reusable_path, *[safe_relative(root, value) for value in expected_pack_paths])
        if path is not None
    )
    scan_paths.extend(
        path for path in (safe_relative(root, value) for value in expected_overlay_paths)
        if path is not None
    )
    if installation == "initialized":
        scan_paths.extend(path for path in (agents_path, context_path, state_path, program_path) if path)
        scan_paths.extend(
            root / relative
            for relative in (
                ".agents/README.md",
                ".agents/plans/README.md",
                ".agents/findings/README.md",
                ".agents/evidence/README.md",
                ".agents/knowledge/README.md",
                ".agents/packs/README.md",
            )
        )
    for path in scan_paths:
        if path.suffix not in {".md", ".json"} or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        tokens = sorted(token for token in RESERVED_TEMPLATE_TOKENS if token in text)
        if tokens:
            try:
                label = path.relative_to(root).as_posix()
            except ValueError:
                label = str(path)
            errors.append(
                f"unresolved template tokens in {label}: {', '.join(tokens)}"
            )

    if errors:
        print("Project OS check: FAIL")
        for error in errors:
            print(f"error: {error}")
    else:
        print("Project OS check: PASS")
    return 1 if errors else 0


def read_selected_system(
    root: Path, snapshots: dict[Path, str] | None = None,
) -> tuple[list[str], list[str], dict[str, Any]]:
    system_path = root / ".agents" / "SYSTEM.json"
    reject_symlink_path(root, system_path)
    system, digest = load_json_snapshot(system_path)
    retain_snapshot(snapshots, system_path, digest)
    if not isinstance(system, dict):
        raise ProjectOSError("SYSTEM configuration must contain an object")
    if system.get("schema_version") != SCHEMA_VERSION:
        raise ProjectOSError(
            f"operation requires SYSTEM schema_version {SCHEMA_VERSION}; run upgrade first"
        )
    if system.get("project_os_version") != VERSION:
        raise ProjectOSError(
            f"Repository Project OS version must be {VERSION}; run upgrade first"
        )
    if not isinstance(system.get("mode"), str) or system.get("mode") not in {
        "standard",
        "program",
    }:
        raise ProjectOSError("SYSTEM mode must be standard or program")
    if not isinstance(system.get("installation"), str) or system.get("installation") not in {
        "initialized",
        "adopted",
    }:
        raise ProjectOSError("SYSTEM installation must be initialized or adopted")
    packs = system.get("packs", [])
    overlays = system.get("overlays", [])
    if not isinstance(packs, list) or not isinstance(overlays, list):
        raise ProjectOSError("SYSTEM packs and overlays must be arrays")
    if any(not isinstance(name, str) or name not in PACK_NAMES for name in packs):
        raise ProjectOSError("SYSTEM packs contain an unknown value")
    if any(not isinstance(name, str) or name not in OVERLAY_NAMES for name in overlays):
        raise ProjectOSError("SYSTEM overlays contain an unknown value")
    if packs != [name for name in PACK_NAMES if name in set(packs)]:
        raise ProjectOSError("SYSTEM packs must be known, unique and in canonical order")
    if overlays != [name for name in OVERLAY_NAMES if name in set(overlays)]:
        raise ProjectOSError("SYSTEM overlays must be known, unique and in canonical order")
    validate_overlay_dependencies(packs, overlays)
    if system.get("pack_paths") != [f".agents/packs/{name}.md" for name in packs]:
        raise ProjectOSError("SYSTEM pack_paths do not match selected packs")
    if system.get("overlay_paths") != [
        f".agents/packs/overlays/{name}.md" for name in overlays
    ]:
        raise ProjectOSError("SYSTEM overlay_paths do not match selected overlays")
    if not isinstance(system.get("paths"), dict):
        raise ProjectOSError("SYSTEM paths must contain an object")
    require_safe_system_owners(root, system)
    lifecycle_errors: list[str] = []
    raw_program = system["paths"].get("program")
    program_path = safe_relative(root, raw_program) if isinstance(raw_program, str) else None
    if system["mode"] == "standard":
        if raw_program is not None or system.get("active_program") is not None:
            lifecycle_errors.append(
                "Standard mode requires null Program path and active_program"
            )
        if (root / PROGRAM_RELATIVE_PATH).exists():
            lifecycle_errors.append("Standard mode cannot retain an active PROGRAM.md")
    else:
        if program_path is None or not program_path.is_file():
            lifecycle_errors.append("Program mode requires an existing PROGRAM.md")
        validate_active_program(program_path, system.get("active_program"), lifecycle_errors)
    if lifecycle_errors:
        raise ProjectOSError("Invalid Program lifecycle: " + "; ".join(lifecycle_errors))
    reusable_path = safe_relative(root, system["paths"].get("reusable_knowledge"))
    if reusable_path is None:
        raise ProjectOSError("SYSTEM reusable knowledge path is unsafe or missing")
    reject_symlink_path(root, reusable_path)
    return packs, overlays, system


def sync_knowledge(
    root: Path,
    packs_value: str,
    overlays_value: str,
    dry_run: bool,
) -> int:
    del packs_value, overlays_value, dry_run
    root = root.resolve()
    system_path = root / ".agents" / "SYSTEM.json"
    if not system_path.is_file():
        raise ProjectOSError("Project OS is not configured in the target repository")
    print(f"sync-knowledge is deprecated and never writes in Project OS {VERSION}")
    print("Use `knowledge import --source <repository-or-bundle>` for user-owned lessons.")
    print("Use `upgrade` to refresh Project OS guidance, schema and release metadata.")
    return 0


def parse_identifier_list(value: str | None, label: str) -> list[str]:
    if value is None:
        return []
    identifiers = [item.strip() for item in value.split(",") if item.strip()]
    if not identifiers or len(identifiers) != len(set(identifiers)):
        raise ProjectOSError(f"{label} must contain unique comma-separated ids")
    return identifiers


def validate_reusable_value(value: Any, label: str) -> None:
    errors: list[str] = []
    if not isinstance(value, dict):
        raise ProjectOSError(f"{label} must contain an object")
    if set(value) != {"schema_version", "entries"}:
        errors.append(f"{label} may contain only schema_version and entries")
    validate_registry_schema(value, label, errors)
    entries = value.get("entries")
    check_unique_ids(
        entries,
        label,
        errors,
        (
            "id", "title", "status", "applies_to", "trigger", "mechanism",
            "prevention", "verification", "boundaries", "source",
        ),
        FAILURE_STATUSES,
    )
    if isinstance(entries, list):
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                continue
            for key in ("id", "title", "trigger", "mechanism", "prevention"):
                if not isinstance(entry.get(key), str) or not entry.get(key).strip():
                    errors.append(f"{label}[{index}] has invalid {key}")
            for key in ("applies_to", "verification", "boundaries"):
                values = entry.get(key)
                if (
                    not isinstance(values, list)
                    or not values
                    or any(not isinstance(item, str) or not item.strip() for item in values)
                ):
                    errors.append(f"{label}[{index}] has invalid {key}")
    validate_strict_reusable_entries(entries, label, errors, verify_hashes=True)
    for material_label in private_material_labels(value):
        errors.append(f"{label} contains a {material_label}")
    if errors:
        raise ProjectOSError(f"Invalid {label}: " + "; ".join(errors))


def load_reusable_registry(
    root: Path, snapshots: dict[Path, str] | None = None,
) -> tuple[dict[str, Any], Path, dict[str, Any], str]:
    _, _, system = read_selected_system(root, snapshots)
    raw_path = system["paths"].get("reusable_knowledge")
    path = safe_relative(root, raw_path)
    if path is None or not path.is_file():
        raise ProjectOSError("Reusable knowledge registry is unsafe or missing")
    reject_symlink_path(root, path)
    value, digest = load_json_snapshot(path)
    validate_reusable_value(value, "reusable knowledge")
    if snapshots is not None:
        snapshots[path] = digest
    return value, path, system, digest


def validate_proposal(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, dict):
        raise ProjectOSError("Knowledge proposal must contain an object")
    if set(value) != {"format", "schema_version", "entries"}:
        raise ProjectOSError(
            "Knowledge proposal may contain only format, schema_version and entries"
        )
    if value.get("format") != "project-os-knowledge-proposal":
        raise ProjectOSError("Knowledge proposal format is invalid")
    if value.get("schema_version") != 1:
        raise ProjectOSError("Knowledge proposal schema_version must be 1")
    entries = value.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ProjectOSError("Knowledge proposal entries must be a non-empty array")
    required = {
        "id", "title", "applies_to", "trigger", "mechanism", "prevention",
        "verification", "boundaries",
    }
    identifiers: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != required:
            raise ProjectOSError(
                f"Knowledge proposal entry {index} must contain exactly: "
                + ", ".join(sorted(required))
            )
        entry_id = entry.get("id")
        if not is_canonical_knowledge_token(entry_id) or entry_id in identifiers:
            raise ProjectOSError(f"Knowledge proposal entry {index} has an invalid or duplicate id")
        identifiers.add(entry_id)
        for key in ("title", "trigger", "mechanism", "prevention"):
            if not isinstance(entry.get(key), str) or not entry.get(key).strip():
                raise ProjectOSError(f"Knowledge proposal {entry_id} has invalid {key}")
        for key in ("applies_to", "verification", "boundaries"):
            items = entry.get(key)
            if (
                not isinstance(items, list)
                or not items
                or any(not isinstance(item, str) or not item.strip() for item in items)
            ):
                raise ProjectOSError(f"Knowledge proposal {entry_id} has invalid {key}")
        applies_to = entry["applies_to"]
        if any(not is_canonical_knowledge_token(tag) for tag in applies_to):
            raise ProjectOSError(
                f"Knowledge proposal {entry_id} applies_to tags must be trimmed and contain no whitespace, commas or controls"
            )
        if len(applies_to) != len(set(applies_to)):
            raise ProjectOSError(f"Knowledge proposal {entry_id} applies_to tags must be unique")
    privacy = private_material_labels(value)
    if privacy:
        raise ProjectOSError("Knowledge proposal contains: " + ", ".join(privacy))
    return entries


def selected_proposal_entries(
    proposal: Sequence[dict[str, Any]], ids_value: str | None, select_all: bool,
) -> list[dict[str, Any]]:
    requested = parse_identifier_list(ids_value, "--ids")
    if bool(requested) == select_all:
        raise ProjectOSError("Choose exactly one of --ids or --all")
    by_id = {entry["id"]: entry for entry in proposal}
    if select_all:
        return list(proposal)
    missing = sorted(set(requested).difference(by_id))
    if missing:
        raise ProjectOSError("Proposal does not contain ids: " + ", ".join(missing))
    return [by_id[entry_id] for entry_id in requested]


def merge_active_entries(
    current: Sequence[dict[str, Any]],
    incoming: Sequence[dict[str, Any]],
    *,
    allow_draft_approval: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    by_id = {entry["id"]: copy.deepcopy(entry) for entry in current}
    semantics = {semantic_lesson_hash(entry): entry["id"] for entry in current}
    report: dict[str, list[str]] = {
        "additions": [], "updates": [], "duplicates": [], "conflicts": [], "unchanged": [],
    }
    for entry in sorted(incoming, key=lambda item: item["id"]):
        entry_id = entry["id"]
        existing = by_id.get(entry_id)
        incoming_hash = entry.get("source", {}).get("content_hash")
        if existing is not None:
            existing_hash = existing.get("source", {}).get("content_hash")
            if incoming_hash == existing_hash:
                report["unchanged"].append(entry_id)
                continue
            if allow_draft_approval and existing.get("status") == "draft":
                incoming_semantic_hash = semantic_lesson_hash(entry)
                duplicate_id = next(
                    (
                        candidate["id"]
                        for candidate in sorted(by_id.values(), key=lambda item: item["id"])
                        if candidate["id"] != entry_id
                        and semantic_lesson_hash(candidate) == incoming_semantic_hash
                    ),
                    None,
                )
                if duplicate_id is not None:
                    report["duplicates"].append(f"{entry_id}:{duplicate_id}")
                    continue
                existing_semantic_hash = semantic_lesson_hash(existing)
                if semantics.get(existing_semantic_hash) == entry_id:
                    semantics.pop(existing_semantic_hash)
                by_id[entry_id] = copy.deepcopy(entry)
                semantics[incoming_semantic_hash] = entry_id
                report["updates"].append(entry_id)
                continue
            if (
                existing.get("status") == "active"
                and entry.get("status") in {"retired", "replaced"}
                and entry.get("previous_content_hash") == existing_hash
            ):
                by_id[entry_id] = copy.deepcopy(entry)
                report["updates"].append(entry_id)
                continue
            report["conflicts"].append(entry_id)
            continue
        semantic_hash = semantic_lesson_hash(entry)
        if entry.get("status") in {"retired", "replaced"}:
            by_id[entry_id] = copy.deepcopy(entry)
            report["additions"].append(entry_id)
            continue
        duplicate_id = semantics.get(semantic_hash)
        if duplicate_id is not None:
            report["duplicates"].append(f"{entry_id}:{duplicate_id}")
            continue
        by_id[entry_id] = copy.deepcopy(entry)
        semantics[semantic_hash] = entry_id
        report["additions"].append(entry_id)
    return sorted(by_id.values(), key=lambda item: item["id"]), report


def apply_registry_change(
    root: Path,
    registry_path: Path,
    registry_digest: str,
    next_entries: Sequence[dict[str, Any]],
    report: dict[str, Any],
    dry_run: bool,
    extra_precondition: Callable[[], None] | None = None,
) -> int:
    next_value = {
        "schema_version": 1,
        "entries": sorted((copy.deepcopy(entry) for entry in next_entries), key=lambda item: item["id"]),
    }
    print(canonical_json(report), end="")
    if report.get("conflicts"):
        print("knowledge operation aborted: resolve conflicts before applying changes")
        return 1
    validate_reusable_value(next_value, "reusable knowledge")
    serialized = canonical_json(next_value)
    replacements: list[tuple[Path, str, str]] = []
    current_value, current_digest = load_json_snapshot(registry_path)
    if current_digest != registry_digest:
        raise ProjectOSError("Reusable knowledge changed after preview")
    if current_value != next_value:
        replacements.append((registry_path, serialized, registry_digest))
    print_transaction_preview(root, [], replacements)
    if dry_run:
        print("dry-run: no files written")
        return 0
    if extra_precondition is not None:
        extra_precondition()

    def validate_after_write() -> None:
        require_passing_check(root, "Knowledge operation")
        if extra_precondition is not None:
            extra_precondition()

    execute_sync_transaction(
        root,
        [],
        replacements,
        after_write=validate_after_write,
        preconditions={registry_path: registry_digest},
    )
    return 0


def knowledge_list(root: Path, scope: str) -> int:
    root = root.resolve()
    reusable, _, system, _ = load_reusable_registry(root)
    result: dict[str, Any] = {"scope": scope}
    if scope in {"reusable", "all"}:
        result["reusable"] = reusable["entries"]
    if scope in {"project", "all"}:
        project: list[dict[str, Any]] = []
        for raw_path in system["paths"].get("project_knowledge", []):
            path = safe_relative(root, raw_path)
            if path is None or not path.is_file():
                raise ProjectOSError(f"Project knowledge path is unsafe or missing: {raw_path!r}")
            if path.suffix == ".json":
                value = load_json(path)
                entries = value.get("entries", []) if isinstance(value, dict) else []
                project.append({"path": raw_path, "entries": entries})
            else:
                project.append({"path": raw_path, "format": "markdown"})
        result["project"] = project
    print(canonical_json(result), end="")
    return 0


def knowledge_approve(
    root: Path, proposal_path: Path, ids_value: str | None, select_all: bool, dry_run: bool,
) -> int:
    root = root.resolve()
    proposal_path = proposal_path.resolve()
    proposal, proposal_digest = load_json_snapshot(proposal_path)
    selected = selected_proposal_entries(validate_proposal(proposal), ids_value, select_all)
    incoming = [
        make_user_owned_entry(entry, status="active", source_kind="user-reviewed")
        for entry in selected
    ]
    reusable, registry_path, _, registry_digest = load_reusable_registry(root)
    next_entries, merge_report = merge_active_entries(
        reusable["entries"], incoming, allow_draft_approval=True
    )
    report: dict[str, Any] = {"operation": "approve", "selected": [e["id"] for e in incoming]}
    report.update(merge_report)

    def verify_proposal() -> None:
        _, current_digest = load_json_snapshot(proposal_path)
        if current_digest != proposal_digest:
            raise ProjectOSError("Knowledge proposal changed after preview")

    return apply_registry_change(
        root, registry_path, registry_digest, next_entries, report, dry_run, verify_proposal
    )


def incomplete_lifecycle_links(entries: Sequence[dict[str, Any]]) -> list[str]:
    selected_ids = {entry["id"] for entry in entries}
    return sorted(
        {
            f"{entry['id']}:{relation}->{entry[relation]}"
            for entry in entries
            for relation in ("replaces", "replaced_by")
            if relation in entry and entry[relation] not in selected_ids
        }
    )


def resolve_external_export_output(root: Path, output: Path) -> Path:
    requested = output.expanduser().absolute()
    if requested.is_symlink():
        raise ProjectOSError(f"Refusing to overwrite an existing export: {requested}")
    resolved = requested.resolve(strict=False)
    if resolved.is_relative_to(root):
        raise ProjectOSError(
            f"Knowledge export output must be outside the target repository: {resolved}"
        )
    return resolved


def knowledge_export(
    root: Path,
    output: Path,
    ids_value: str | None,
    active_only: bool,
    dry_run: bool,
) -> int:
    root = root.resolve()
    reusable, registry_path, _, registry_digest = load_reusable_registry(root)
    requested = parse_identifier_list(ids_value, "--ids")
    by_id = {entry["id"]: entry for entry in reusable["entries"]}
    if requested:
        missing = sorted(set(requested).difference(by_id))
        if missing:
            raise ProjectOSError("Reusable knowledge does not contain ids: " + ", ".join(missing))
        selected = [by_id[entry_id] for entry_id in requested]
    else:
        selected = list(reusable["entries"])
    drafts = [entry["id"] for entry in selected if entry["status"] == "draft"]
    selected = [entry for entry in selected if entry["status"] != "draft"]
    if requested and drafts:
        raise ProjectOSError("Draft lessons require approval before export: " + ", ".join(drafts))
    if active_only:
        selected = [entry for entry in selected if entry["status"] == "active"]
    missing_lifecycle = incomplete_lifecycle_links(selected)
    if missing_lifecycle:
        raise ProjectOSError(
            "Export selection has an incomplete lifecycle chain: "
            + ", ".join(missing_lifecycle)
        )
    bundle = {
        "format": "project-os-reusable-knowledge",
        "schema_version": 1,
        "created_with": VERSION,
        "entries": sorted((copy.deepcopy(entry) for entry in selected), key=lambda item: item["id"]),
    }
    privacy = private_material_labels(bundle)
    if privacy:
        raise ProjectOSError("Knowledge bundle contains: " + ", ".join(privacy))
    serialized = canonical_json(bundle)
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    output = resolve_external_export_output(root, output)
    filesystem = AnchoredFilesystem(output.parent)
    try:
        parent_fd = filesystem.parent(output)
        filesystem.verify()
        try:
            os.stat(output.name, dir_fd=parent_fd, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise ProjectOSError(f"Refusing to overwrite an existing export: {output}")
        print(
            canonical_json(
                {
                    "operation": "export",
                    "entries": len(selected),
                    "output": str(output),
                    "sha256": "sha256:" + digest,
                }
            ),
            end="",
        )
        if dry_run:
            print("dry-run: no files written")
            return 0
        _, current_digest = load_json_snapshot(registry_path)
        if current_digest != registry_digest:
            raise ProjectOSError("Reusable knowledge changed after preview")

        temporary = f".project-os-export-{uuid.uuid4().hex}.tmp"
        temporary_identity: tuple[int, int] | None = None
        ownership_descriptor: int | None = None
        published_owned = False
        publication_complete = False
        try:
            filesystem.verify()
            ownership_descriptor = os.open(
                temporary,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                0o644,
                dir_fd=parent_fd,
            )
            details = os.fstat(ownership_descriptor)
            temporary_identity = (details.st_dev, details.st_ino)
            writer_descriptor = os.dup(ownership_descriptor)
            try:
                handle = os.fdopen(writer_descriptor, "wb")
            except BaseException:
                os.close(writer_descriptor)
                raise
            with handle:
                handle.write(serialized.encode("utf-8"))
                handle.flush()
                os.fsync(handle.fileno())
            filesystem.verify()
            content, details = read_regular_at(parent_fd, temporary)
            if (details.st_dev, details.st_ino) != temporary_identity or (
                hashlib.sha256(content).hexdigest() != digest
            ):
                raise ProjectOSError("Temporary knowledge export changed before publication")
            try:
                os.link(
                    temporary,
                    output.name,
                    src_dir_fd=parent_fd,
                    dst_dir_fd=parent_fd,
                    follow_symlinks=False,
                )
            except FileExistsError as error:
                raise ProjectOSError(
                    f"Refusing to overwrite an existing export: {output}"
                ) from error
            published, published_details = read_regular_at(parent_fd, output.name)
            if (
                (published_details.st_dev, published_details.st_ino)
                != temporary_identity
                or hashlib.sha256(published).hexdigest() != digest
            ):
                raise ProjectOSError(
                    "Published knowledge export changed before verification"
                )
            published_owned = True
            filesystem.verify()
            unlink_owned_at(parent_fd, temporary, temporary_identity)
            filesystem.verify()
            publication_complete = True
        except OSError as error:
            raise ProjectOSError(f"Knowledge export failed: {error}") from error
        finally:
            if (
                temporary_identity is not None
                and published_owned
                and not publication_complete
            ):
                unlink_owned_at(parent_fd, output.name, temporary_identity)
            if temporary_identity is not None:
                unlink_owned_at(parent_fd, temporary, temporary_identity)
            if ownership_descriptor is not None:
                os.close(ownership_descriptor)
    finally:
        filesystem.close()
    return 0


def load_import_source(source: Path) -> tuple[list[dict[str, Any]], Path, str]:
    source = source.expanduser().absolute()
    if source.is_dir():
        system_path = source / ".agents" / "SYSTEM.json"
        system = load_json(system_path)
        if not isinstance(system, dict) or system.get("schema_version") != SCHEMA_VERSION:
            raise ProjectOSError("Source repository must be upgraded to schema 4 before import")
        paths = system.get("paths")
        reusable_path = safe_relative(source, paths.get("reusable_knowledge")) if isinstance(paths, dict) else None
        if reusable_path is None:
            raise ProjectOSError("Source repository reusable knowledge path is unsafe or missing")
        source_path = reusable_path
    else:
        source_path = source
    if not source_path.is_file() or source_path.is_symlink():
        raise ProjectOSError(f"Knowledge import source is not a regular file: {source_path}")
    value, digest = load_json_snapshot(source_path)
    if isinstance(value, dict) and value.get("format") == "project-os-reusable-knowledge":
        if set(value) != {"format", "schema_version", "created_with", "entries"}:
            raise ProjectOSError("Knowledge bundle has non-canonical top-level fields")
        if value.get("schema_version") != 1 or not isinstance(value.get("created_with"), str):
            raise ProjectOSError("Knowledge bundle metadata is invalid")
        registry_value = {"schema_version": 1, "entries": value.get("entries")}
    else:
        registry_value = value
    validate_reusable_value(registry_value, "imported reusable knowledge")
    return registry_value["entries"], source_path, digest


def target_applicability_tags(system: dict[str, Any]) -> set[str]:
    tags = {"engineering", *system.get("packs", [])}
    for overlay in system.get("overlays", []):
        tags.add(overlay)
        if overlay == "react-native-expo":
            tags.update({"react-native", "expo"})
    return tags


def knowledge_import(
    root: Path,
    source: Path,
    ids_value: str | None,
    select_all: bool,
    dry_run: bool,
) -> int:
    root = root.resolve()
    reusable, registry_path, system, registry_digest = load_reusable_registry(root)
    incoming, source_path, source_digest = load_import_source(source)
    requested = parse_identifier_list(ids_value, "--ids")
    if requested and select_all:
        raise ProjectOSError("Choose at most one of --ids or --all")
    by_id = {entry["id"]: entry for entry in incoming}
    if requested:
        missing = sorted(set(requested).difference(by_id))
        if missing:
            raise ProjectOSError("Import source does not contain ids: " + ", ".join(missing))
        selected = [by_id[entry_id] for entry_id in requested]
        drafts = [entry["id"] for entry in selected if entry["status"] == "draft"]
        if drafts:
            raise ProjectOSError(
                "Draft lessons require source approval before import: " + ", ".join(drafts)
            )
        incomplete = incomplete_lifecycle_links(selected)
        if incomplete:
            raise ProjectOSError(
                "Import selection has an incomplete lifecycle chain: "
                + ", ".join(incomplete)
            )
        skipped: list[dict[str, str]] = []
        lifecycle_selected: list[dict[str, str]] = []
    elif select_all:
        selected = [entry for entry in incoming if entry["status"] != "draft"]
        skipped = [
            {"id": entry["id"], "reason": "draft requires source approval"}
            for entry in incoming if entry["status"] == "draft"
        ]
        lifecycle_selected = []
    else:
        tags = target_applicability_tags(system)
        selected = []
        skipped = []
        lifecycle_selected = []
        for entry in incoming:
            if entry["status"] == "draft":
                skipped.append({"id": entry["id"], "reason": "draft requires source approval"})
            elif entry["status"] in {"retired", "replaced"}:
                selected.append(entry)
                if not tags.intersection(entry["applies_to"]):
                    lifecycle_selected.append(
                        {"id": entry["id"], "reason": "lifecycle tombstone"}
                    )
            elif tags.intersection(entry["applies_to"]):
                selected.append(entry)
            else:
                skipped.append(
                    {"id": entry["id"], "reason": "not applicable to target packs or overlays"}
                )
        selected_ids = {entry["id"] for entry in selected}
        pending = sorted(selected_ids)
        while pending:
            selected_id = pending.pop(0)
            entry = by_id[selected_id]
            for relation in ("replaces", "replaced_by"):
                linked_id = entry.get(relation)
                if not isinstance(linked_id, str) or linked_id in selected_ids:
                    continue
                linked = by_id[linked_id]
                selected.append(linked)
                selected_ids.add(linked_id)
                pending.append(linked_id)
                pending.sort()
                skipped = [item for item in skipped if item["id"] != linked_id]
                lifecycle_selected.append(
                    {"id": linked_id, "reason": f"{relation} of {selected_id}"}
                )
        incomplete = incomplete_lifecycle_links(selected)
        if incomplete:
            raise ProjectOSError(
                "Default import could not close the lifecycle chain: "
                + ", ".join(incomplete)
            )
    next_entries, merge_report = merge_active_entries(reusable["entries"], selected)
    report: dict[str, Any] = {
        "operation": "import",
        "source": str(source_path),
        "target_tags": sorted(target_applicability_tags(system)),
        "selected": [entry["id"] for entry in sorted(selected, key=lambda item: item["id"])],
        "lifecycle_selected": sorted(lifecycle_selected, key=lambda item: item["id"]),
        "skipped": sorted(skipped, key=lambda item: item["id"]),
    }
    report.update(merge_report)

    def verify_source() -> None:
        _, current_digest = load_json_snapshot(source_path)
        if current_digest != source_digest:
            raise ProjectOSError("Knowledge import source changed after preview")

    return apply_registry_change(
        root, registry_path, registry_digest, next_entries, report, dry_run, verify_source
    )


def knowledge_revise(root: Path, entry_id: str, proposal_path: Path, dry_run: bool) -> int:
    root = root.resolve()
    proposal_path = proposal_path.resolve()
    proposal, proposal_digest = load_json_snapshot(proposal_path)
    proposed = validate_proposal(proposal)
    if len(proposed) != 1:
        raise ProjectOSError("Knowledge revise proposal must contain exactly one entry")
    replacement = proposed[0]
    if replacement["id"] == entry_id:
        raise ProjectOSError("A revision needs a new stable id")
    reusable, registry_path, _, registry_digest = load_reusable_registry(root)
    by_id = {entry["id"]: copy.deepcopy(entry) for entry in reusable["entries"]}
    current = by_id.get(entry_id)
    if current is None or current.get("status") != "active":
        raise ProjectOSError("Knowledge revise requires an active existing lesson")
    if replacement["id"] in by_id:
        raise ProjectOSError(f"Replacement id already exists: {replacement['id']}")
    if semantic_lesson_hash(replacement) in {
        semantic_lesson_hash(entry) for key, entry in by_id.items() if key != entry_id
    }:
        raise ProjectOSError("Replacement duplicates another reusable lesson")
    previous_hash = current["source"]["content_hash"]
    current["status"] = "replaced"
    current["replaced_by"] = replacement["id"]
    current["reason"] = f"Revised as {replacement['id']}"
    current["previous_content_hash"] = previous_hash
    current["source"]["kind"] = "user-reviewed"
    current["source"]["created_with"] = VERSION
    current["source"].pop("content_hash", None)
    current["source"]["content_hash"] = entry_content_hash(current)
    next_entry = make_user_owned_entry(
        replacement, status="active", source_kind="user-reviewed"
    )
    next_entry["replaces"] = entry_id
    next_entry["source"].pop("content_hash")
    next_entry["source"]["content_hash"] = entry_content_hash(next_entry)
    by_id[entry_id] = current
    by_id[next_entry["id"]] = next_entry

    def verify_proposal() -> None:
        _, current_digest = load_json_snapshot(proposal_path)
        if current_digest != proposal_digest:
            raise ProjectOSError("Knowledge proposal changed after preview")

    return apply_registry_change(
        root,
        registry_path,
        registry_digest,
        list(by_id.values()),
        {
            "operation": "revise",
            "selected": [entry_id, next_entry["id"]],
            "additions": [next_entry["id"]],
            "updates": [entry_id],
            "duplicates": [],
            "conflicts": [],
            "unchanged": [],
        },
        dry_run,
        verify_proposal,
    )


def knowledge_retire(root: Path, entry_id: str, reason: str, dry_run: bool) -> int:
    root = root.resolve()
    if not reason.strip():
        raise ProjectOSError("Knowledge retire requires a reason")
    reusable, registry_path, _, registry_digest = load_reusable_registry(root)
    by_id = {entry["id"]: copy.deepcopy(entry) for entry in reusable["entries"]}
    entry = by_id.get(entry_id)
    if entry is None or entry.get("status") != "active":
        raise ProjectOSError("Knowledge retire requires an active existing lesson")
    entry["previous_content_hash"] = entry["source"]["content_hash"]
    entry["status"] = "retired"
    entry["reason"] = reason.strip()
    entry["source"]["kind"] = "user-reviewed"
    entry["source"]["created_with"] = VERSION
    entry["source"].pop("content_hash", None)
    entry["source"]["content_hash"] = entry_content_hash(entry)
    return apply_registry_change(
        root,
        registry_path,
        registry_digest,
        list(by_id.values()),
        {
            "operation": "retire", "selected": [entry_id], "additions": [],
            "updates": [entry_id], "duplicates": [], "conflicts": [], "unchanged": [],
        },
        dry_run,
    )


def knowledge_remove(root: Path, entry_id: str, confirmation: str, dry_run: bool) -> int:
    root = root.resolve()
    if confirmation != entry_id:
        raise ProjectOSError("--confirm must exactly match the lesson id")
    reusable, registry_path, _, registry_digest = load_reusable_registry(root)
    by_id = {entry["id"]: entry for entry in reusable["entries"]}
    entry = by_id.get(entry_id)
    if entry is None:
        raise ProjectOSError(f"Reusable knowledge does not contain id: {entry_id}")
    referenced_by = sorted(
        candidate["id"]
        for candidate in reusable["entries"]
        if candidate["id"] != entry_id
        and entry_id in {candidate.get("replaces"), candidate.get("replaced_by")}
    )
    if entry.get("replaces") or entry.get("replaced_by") or referenced_by:
        detail = ", ".join(referenced_by) if referenced_by else "its lifecycle fields"
        raise ProjectOSError(
            f"Cannot remove lifecycle-linked lesson {entry_id}; referenced by {detail}"
        )
    next_entries = [entry for entry in reusable["entries"] if entry["id"] != entry_id]
    return apply_registry_change(
        root,
        registry_path,
        registry_digest,
        next_entries,
        {
            "operation": "remove", "selected": [entry_id], "additions": [],
            "updates": [], "removed": [entry_id], "duplicates": [], "conflicts": [],
            "unchanged": [],
        },
        dry_run,
    )


def nonempty_string_list(value: Any, label: str) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or any(not isinstance(item, str) or not item.strip() for item in value)
    ):
        raise ProjectOSError(f"{label} must be a non-empty array of non-empty strings")
    return [item.strip() for item in value]


def canonical_date(value: str | None, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ProjectOSError(f"{label} requires a YYYY-MM-DD date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ProjectOSError(f"{label} must be a valid YYYY-MM-DD date") from error
    if parsed.isoformat() != value:
        raise ProjectOSError(f"{label} must use canonical YYYY-MM-DD form")
    return value


def validate_program_definition(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProjectOSError("Program definition must contain a JSON object")
    normalized: dict[str, Any] = {}
    for key in ("initiative", "outcome"):
        raw = value.get(key)
        if not isinstance(raw, str) or not raw.strip():
            raise ProjectOSError(f"Program definition {key} must be a non-empty string")
        if key == "initiative" and any(character in raw for character in ("\r", "\n")):
            raise ProjectOSError("Program definition initiative must be a single line")
        normalized[key] = raw.strip()
    for key in (
        "authority",
        "exit_conditions",
        "evidence_requirements",
        "cost_boundary",
        "exclusions",
    ):
        normalized[key] = nonempty_string_list(value.get(key), f"Program definition {key}")

    phases = value.get("phases")
    if not isinstance(phases, list) or len(phases) < 2:
        raise ProjectOSError("Program definition phases must contain at least two phases")
    normalized_phases: list[dict[str, Any]] = []
    for index, phase in enumerate(phases, 1):
        if not isinstance(phase, dict):
            raise ProjectOSError(f"Program definition phase {index} must be an object")
        normalized_phase: dict[str, Any] = {}
        for key in ("name", "outcome"):
            raw = phase.get(key)
            if not isinstance(raw, str) or not raw.strip():
                raise ProjectOSError(
                    f"Program definition phase {index} {key} must be a non-empty string"
                )
            if key == "name" and any(character in raw for character in ("\r", "\n")):
                raise ProjectOSError(
                    f"Program definition phase {index} name must be a single line"
                )
            normalized_phase[key] = raw.strip()
        normalized_phase["exit_conditions"] = nonempty_string_list(
            phase.get("exit_conditions"),
            f"Program definition phase {index} exit_conditions",
        )
        normalized_phases.append(normalized_phase)
    normalized["phases"] = normalized_phases
    for text in iter_string_values(normalized):
        if any(token in text for token in RESERVED_TEMPLATE_TOKENS):
            raise ProjectOSError("Program definition contains a reserved template token")
    return normalized


def markdown_bullets(values: Sequence[str]) -> str:
    return "\n".join(f"- {value}" for value in values)


def render_program_definition(
    definition: dict[str, Any], program_id: str, started_on: str
) -> str:
    phases: list[str] = []
    for index, phase in enumerate(definition["phases"], 1):
        phases.extend(
            (
                f"### {index}. {phase['name']}",
                "",
                phase["outcome"],
                "",
                "Phase exit conditions:",
                "",
                markdown_bullets(phase["exit_conditions"]),
                "",
            )
        )
    replacements = {
        "__PROGRAM_INITIATIVE__": definition["initiative"],
        "__PROGRAM_ID__": program_id,
        "__PROGRAM_STARTED_ON__": started_on,
        "__PROGRAM_OUTCOME__": definition["outcome"],
        "__PROGRAM_AUTHORITY__": markdown_bullets(definition["authority"]),
        "__PROGRAM_PHASES__": "\n".join(phases).rstrip(),
        "__PROGRAM_EXIT_CONDITIONS__": markdown_bullets(definition["exit_conditions"]),
        "__PROGRAM_EVIDENCE__": markdown_bullets(definition["evidence_requirements"]),
        "__PROGRAM_COST_BOUNDARY__": markdown_bullets(definition["cost_boundary"]),
        "__PROGRAM_EXCLUSIONS__": markdown_bullets(definition["exclusions"]),
    }
    return render_template(PROGRAM_TEMPLATE.read_text(encoding="utf-8"), replacements)


def load_history_for_mutation(
    root: Path, system: dict[str, Any]
) -> tuple[Path, Path, dict[str, Any], str | None]:
    paths = system.get("paths")
    if not isinstance(paths, dict):
        raise ProjectOSError("SYSTEM paths must contain an object")
    raw_history = paths.get("history") or ".agents/history"
    raw_index = paths.get("history_index") or ".agents/history/index.json"
    history_path = safe_relative(root, raw_history)
    index_path = safe_relative(root, raw_index)
    if history_path is None or index_path is None:
        raise ProjectOSError("SYSTEM history paths are unsafe")
    reject_symlink_path(root, history_path)
    reject_symlink_path(root, index_path)
    try:
        index_path.resolve().relative_to(history_path.resolve())
    except ValueError as error:
        raise ProjectOSError("SYSTEM history_index must be inside SYSTEM history") from error
    if history_path.exists() and not history_path.is_dir():
        raise ProjectOSError("SYSTEM history path must be a directory")
    index_sha256: str | None = None
    if index_path.exists():
        if not index_path.is_file():
            raise ProjectOSError("SYSTEM history index must be a regular file")
        value, index_sha256 = load_json_snapshot(index_path)
        errors: list[str] = []
        validate_history_index(root, history_path, index_path, errors)
        if errors:
            raise ProjectOSError("Invalid history index: " + "; ".join(errors))
        if hashlib.sha256(index_path.read_bytes()).hexdigest() != index_sha256:
            raise ProjectOSError("History index changed during validation")
    else:
        value = {"schema_version": 1, "entries": []}
    if not isinstance(value, dict) or not isinstance(value.get("entries"), list):
        raise ProjectOSError("History index must contain an entries array")
    return history_path, index_path, copy.deepcopy(value), index_sha256


def next_program_id(index: dict[str, Any], history_path: Path | None = None) -> str:
    prefix = f"program-{date.today().strftime('%Y%m%d')}-"
    used = {
        entry.get("id")
        for entry in index.get("entries", [])
        if isinstance(entry, dict) and isinstance(entry.get("id"), str)
    }
    sequence = 1
    while f"{prefix}{sequence:03d}" in used or (
        history_path is not None
        and (history_path / "programs" / f"{prefix}{sequence:03d}").exists()
    ):
        sequence += 1
    return f"{prefix}{sequence:03d}"


def active_plan_ids(
    root: Path, system: dict[str, Any], snapshots: dict[Path, str] | None = None,
) -> list[str]:
    paths = system.get("paths")
    if not isinstance(paths, dict):
        raise ProjectOSError("SYSTEM paths must contain an object")
    plans_path = safe_relative(root, paths.get("plans"))
    if plans_path is None or not plans_path.is_file():
        raise ProjectOSError("SYSTEM plans registry is missing")
    value, digest = load_json_snapshot(plans_path)
    if snapshots is not None:
        snapshots[plans_path] = digest
    if not isinstance(value, dict) or not isinstance(value.get("plans"), list):
        raise ProjectOSError("Plans registry must contain a plans array")
    active = [
        plan.get("id")
        for plan in value["plans"]
        if isinstance(plan, dict)
        and plan.get("status") == "active"
        and isinstance(plan.get("id"), str)
    ]
    if value.get("execution_state") == "running" or active:
        return active or ["<running execution>"]
    if value.get("execution_state") != "idle":
        raise ProjectOSError("Plans registry execution_state must be idle or running")
    return []


def require_current_system(root: Path, snapshots: dict[Path, str] | None = None) -> dict[str, Any]:
    _, _, system = read_selected_system(root, snapshots)
    if system.get("project_os_version") != VERSION:
        raise ProjectOSError("Repository must be upgraded before Program lifecycle changes")
    return system


def require_passing_check(root: Path, operation: str) -> None:
    if check_project(root) != 0:
        raise ProjectOSError(f"{operation} produced invalid Project OS state")


def print_transaction_preview(
    root: Path,
    creates: Sequence[tuple[Path, str | bytes]],
    replacements: Sequence[tuple[Path, str, str]],
    deletions: Sequence[tuple[Path, str]] = (),
) -> None:
    for path, _ in creates:
        print(f"create: {path.relative_to(root)}")
    for path, _, _ in replacements:
        print(f"update: {path.relative_to(root)}")
    for path, _ in deletions:
        print(f"delete: {path.relative_to(root)}")


def start_program(root: Path, definition_path: Path, dry_run: bool) -> int:
    root = root.resolve()
    if check_project(root) != 0:
        raise ProjectOSError("Program start requires a clean Project OS check")
    snapshots: dict[Path, str] = {}
    system = require_current_system(root, snapshots)
    if system.get("mode") != "standard" or system.get("active_program") is not None:
        raise ProjectOSError("A Program is already active")
    definition = validate_program_definition(load_json(definition_path.resolve()))
    history_path, index_path, history_index, index_sha256 = load_history_for_mutation(
        root, system
    )
    if index_sha256 is not None:
        snapshots[index_path] = index_sha256
    program_id = next_program_id(history_index, history_path)
    started_on = date.today().isoformat()
    program_path = root / PROGRAM_RELATIVE_PATH
    reject_symlink_path(root, program_path)
    if program_path.exists():
        raise ProjectOSError("Refusing to overwrite an existing .agents/PROGRAM.md")
    content = render_program_definition(definition, program_id, started_on)

    next_system = copy.deepcopy(system)
    next_system["mode"] = "program"
    next_system["active_program"] = {
        "id": program_id,
        "initiative": definition["initiative"],
        "started_on": started_on,
        "origin": "created",
    }
    next_system["paths"]["program"] = ".agents/PROGRAM.md"
    if index_sha256 is not None:
        next_system["paths"]["history"] = history_path.relative_to(root).as_posix()
        next_system["paths"]["history_index"] = index_path.relative_to(root).as_posix()
    next_system["generated_on"] = started_on
    contract_errors: list[str] = []
    validate_created_program_contract(content, next_system["active_program"], contract_errors)
    if contract_errors:
        raise ProjectOSError("Invalid rendered Program: " + "; ".join(contract_errors))

    creates: list[tuple[Path, str]] = [(program_path, content)]
    replacements: list[tuple[Path, str, str]] = []
    system_path = root / ".agents" / "SYSTEM.json"
    system_sha256 = snapshots[system_path]
    replacements.append(
        (system_path, json.dumps(next_system, indent=2) + "\n", system_sha256)
    )
    print_transaction_preview(root, creates, replacements)
    if dry_run:
        print("dry-run: no files written")
        return 0
    execute_sync_transaction(
        root,
        creates,
        replacements,
        after_write=lambda: require_passing_check(root, "Program start"),
        preconditions=snapshots,
    )
    return 0


def program_status(root: Path) -> int:
    root = root.resolve()
    system = require_current_system(root)
    paths = system.get("paths", {})
    index_path = safe_relative(root, paths.get("history_index")) if isinstance(paths, dict) else None
    archive_count = 0
    if index_path is not None and index_path.is_file():
        index = load_json(index_path)
        if isinstance(index, dict) and isinstance(index.get("entries"), list):
            archive_count = len(index["entries"])
    print(
        json.dumps(
            {
                "mode": system.get("mode"),
                "active_program": system.get("active_program"),
                "indexed_history_entries": archive_count,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def close_program(
    root: Path,
    disposition: str,
    reason: str | None,
    dry_run: bool,
) -> int:
    root = root.resolve()
    if check_project(root) != 0:
        raise ProjectOSError("Program close requires a clean Project OS check")
    snapshots: dict[Path, str] = {}
    system = require_current_system(root, snapshots)
    if system.get("mode") != "program" or not isinstance(system.get("active_program"), dict):
        raise ProjectOSError("No Program is active")
    if disposition == "stopped" and (not isinstance(reason, str) or not reason.strip()):
        raise ProjectOSError("A stopped Program requires --reason")
    if active_plan_ids(root, system, snapshots):
        raise ProjectOSError("Close the active plan before closing the Program")
    program_path = require_canonical_program_owner(root, system)
    if not program_path.is_file():
        raise ProjectOSError("Active PROGRAM.md is missing")
    reject_symlink_path(root, program_path)
    program_content = program_path.read_bytes()
    program_digest = hashlib.sha256(program_content).hexdigest()
    active = system["active_program"]
    program_id = active.get("id")
    if not isinstance(program_id, str) or not program_id:
        raise ProjectOSError("SYSTEM active_program has no valid id")

    history_path, index_path, history_index, index_sha256 = load_history_for_mutation(
        root, system
    )
    archive_path = history_path / "programs" / program_id / "PROGRAM.md"
    if index_sha256 is not None:
        snapshots[index_path] = index_sha256
    reject_symlink_path(root, archive_path)
    if archive_path.exists():
        raise ProjectOSError(f"Program archive already exists: {archive_path.relative_to(root)}")
    if any(
        isinstance(entry, dict) and entry.get("id") == program_id
        for entry in history_index["entries"]
    ):
        raise ProjectOSError(f"History already contains Program id {program_id}")
    entry: dict[str, Any] = {
        "id": program_id,
        "kind": "program",
        "path": archive_path.relative_to(root).as_posix(),
        "sha256": "sha256:" + program_digest,
        "closed_on": date.today().isoformat(),
        "disposition": disposition,
    }
    if reason:
        entry["reason"] = reason.strip()
    history_index["entries"].append(entry)

    next_system = copy.deepcopy(system)
    next_system["mode"] = "standard"
    next_system["active_program"] = None
    next_system["paths"]["program"] = None
    next_system["paths"]["history"] = history_path.relative_to(root).as_posix()
    next_system["paths"]["history_index"] = index_path.relative_to(root).as_posix()
    next_system["generated_on"] = date.today().isoformat()

    creates: list[tuple[Path, str | bytes]] = [(archive_path, program_content)]
    replacements: list[tuple[Path, str, str]] = []
    serialized_index = json.dumps(history_index, indent=2, ensure_ascii=False) + "\n"
    if index_sha256 is None:
        creates.append((index_path, serialized_index))
    else:
        replacements.append((index_path, serialized_index, index_sha256))
    readme_path = history_path / "README.md"
    if not readme_path.exists():
        creates.append((readme_path, HISTORY_README_TEMPLATE.read_text(encoding="utf-8")))
    system_path = root / ".agents" / "SYSTEM.json"
    replacements.append(
        (
            system_path,
            json.dumps(next_system, indent=2, ensure_ascii=False) + "\n",
            snapshots[system_path],
        )
    )
    deletions = [(program_path, program_digest)]
    print_transaction_preview(root, creates, replacements, deletions)
    if dry_run:
        print("dry-run: no files written")
        return 0
    execute_sync_transaction(
        root,
        creates,
        replacements,
        deletions,
        after_write=lambda: require_passing_check(root, "Program close"),
        preconditions=snapshots,
    )
    return 0


def validate_system_selection(system: dict[str, Any]) -> tuple[list[str], list[str]]:
    packs = system.get("packs")
    overlays = system.get("overlays")
    if not isinstance(packs, list) or any(
        not isinstance(name, str) or name not in PACK_NAMES for name in packs
    ):
        raise ProjectOSError("SYSTEM packs must contain known capability packs")
    if not isinstance(overlays, list) or any(
        not isinstance(name, str) or name not in OVERLAY_NAMES for name in overlays
    ):
        raise ProjectOSError("SYSTEM overlays must contain known ecosystem overlays")
    if packs != [name for name in PACK_NAMES if name in set(packs)]:
        raise ProjectOSError("SYSTEM packs must be unique and in canonical order")
    if overlays != [name for name in OVERLAY_NAMES if name in set(overlays)]:
        raise ProjectOSError("SYSTEM overlays must be unique and in canonical order")
    validate_overlay_dependencies(packs, overlays)
    if system.get("pack_paths") != [f".agents/packs/{name}.md" for name in packs]:
        raise ProjectOSError("SYSTEM pack_paths do not match selected packs")
    if system.get("overlay_paths") != [
        f".agents/packs/overlays/{name}.md" for name in overlays
    ]:
        raise ProjectOSError("SYSTEM overlay_paths do not match selected overlays")
    return list(packs), list(overlays)


def plan_managed_release_update(
    root: Path,
    original_system: dict[str, Any],
    next_system: dict[str, Any],
    snapshots: dict[Path, str] | None = None,
) -> tuple[
    list[tuple[Path, str | bytes]],
    list[tuple[Path, str, str]],
    list[tuple[Path, str]],
]:
    """Plan conflict-safe guidance refresh and schema-4 knowledge migration."""
    packs, overlays = validate_system_selection(original_system)
    expected = default_system(
        root,
        str(next_system.get("mode")),
        str(next_system.get("installation")),
        packs,
        overlays,
        next_system.get("paths", {}),
        next_system.get("active_program")
        if isinstance(next_system.get("active_program"), dict)
        else None,
    )
    recorded_guidance = original_system.get("managed_guidance")
    expected_guidance = expected["managed_guidance"]
    baseline_paths = list(expected_guidance)
    if original_system.get("schema_version") != SCHEMA_VERSION:
        baseline_paths.remove(".agents/WORKFLOW.md")
    if not isinstance(recorded_guidance, dict) or list(recorded_guidance) != baseline_paths:
        raise ProjectOSError("SYSTEM managed_guidance is missing or inconsistent")
    if any(not isinstance(value, str) for value in recorded_guidance.values()):
        raise ProjectOSError("SYSTEM managed_guidance contains an invalid baseline")
    creates: list[tuple[Path, str | bytes]] = []
    replacements: list[tuple[Path, str, str]] = []
    deletions: list[tuple[Path, str]] = []
    conflicts: list[str] = []
    guidance_contents = guidance_content_map(packs, overlays)
    if original_system.get("schema_version") != SCHEMA_VERSION:
        workflow_path = root / ".agents/WORKFLOW.md"
        reject_symlink_path(root, workflow_path)
        if workflow_path.exists():
            raise ProjectOSError("Workflow destination already exists; resolve ownership before upgrade")
        creates.append((workflow_path, guidance_contents[".agents/WORKFLOW.md"]))
    for raw_path, recorded_hash in recorded_guidance.items():
        path = safe_relative(root, raw_path)
        if path is None:
            raise ProjectOSError(f"Managed guidance path is unsafe: {raw_path}")
        reject_symlink_path(root, path)
        desired_hash = expected_guidance[raw_path]
        desired_content = guidance_contents[raw_path]
        if not path.exists():
            creates.append((path, desired_content))
            continue
        if not path.is_file():
            raise ProjectOSError(f"Managed guidance is not a regular file: {raw_path}")
        actual_digest = hashlib.sha256(path.read_bytes()).hexdigest()
        actual_hash = "sha256:" + actual_digest
        if actual_hash == desired_hash:
            continue
        if actual_hash == recorded_hash:
            replacements.append((path, desired_content, actual_digest))
        else:
            conflicts.append(f"managed guidance differs locally: {raw_path}")

    original_paths = original_system.get("paths")
    next_paths = next_system.get("paths")
    if not isinstance(original_paths, dict) or not isinstance(next_paths, dict):
        raise ProjectOSError("SYSTEM paths must contain an object")
    reusable_path = safe_relative(root, next_paths.get("reusable_knowledge"))
    if reusable_path is None:
        raise ProjectOSError("SYSTEM reusable knowledge path is unsafe or missing")
    reject_symlink_path(root, reusable_path)
    original_schema = original_system.get("schema_version")
    migrated_entries: list[dict[str, Any]] = []
    if original_schema in {2, 3}:
        recorded_knowledge = original_system.get("managed_knowledge", {})
        if not isinstance(recorded_knowledge, dict) or any(
            not isinstance(entry_id, str)
            or not isinstance(entry_hash, str)
            or not entry_hash.startswith("sha256:")
            for entry_id, entry_hash in (
                recorded_knowledge.items() if isinstance(recorded_knowledge, dict) else ()
            )
        ):
            raise ProjectOSError("Legacy SYSTEM managed_knowledge is missing or invalid")
        old_shared_path = safe_relative(root, original_paths.get("shared_knowledge"))
        if old_shared_path is None or not old_shared_path.is_file():
            raise ProjectOSError("Legacy shared knowledge path is unsafe or missing")
        reject_symlink_path(root, old_shared_path)
        old_shared, old_shared_digest = load_json_snapshot(old_shared_path)
        if snapshots is not None:
            snapshots[old_shared_path] = old_shared_digest
        if not isinstance(old_shared, dict):
            raise ProjectOSError("Legacy shared knowledge must contain an object")
        canonical_shared_fields = {
            "schema_version", "knowledge_version", "packs", "overlays", "entries",
        }
        missing_shared_fields = sorted(canonical_shared_fields.difference(old_shared))
        if missing_shared_fields:
            raise ProjectOSError(
                "Legacy shared knowledge is missing canonical fields: "
                + ", ".join(missing_shared_fields)
            )
        extra_shared_fields = sorted(set(old_shared).difference(canonical_shared_fields))
        if extra_shared_fields:
            raise ProjectOSError(
                "Legacy shared knowledge requires explicit review because unsupported "
                "top-level fields would be discarded: " + ", ".join(extra_shared_fields)
            )
        if old_shared.get("schema_version") != 1:
            raise ProjectOSError("Legacy shared knowledge schema_version must be 1")
        if old_shared.get("knowledge_version") != original_system.get("project_os_version"):
            raise ProjectOSError(
                "Legacy shared knowledge knowledge_version must match SYSTEM project_os_version"
            )
        if old_shared.get("packs") != ["core", *packs]:
            raise ProjectOSError(
                "Legacy shared knowledge requires explicit review because packs must "
                "exactly match core plus canonical SYSTEM packs"
            )
        if old_shared.get("overlays") != overlays:
            raise ProjectOSError(
                "Legacy shared knowledge requires explicit review because overlays must "
                "exactly match canonical SYSTEM overlays"
            )
        old_entries = old_shared.get("entries") if isinstance(old_shared, dict) else None
        if not isinstance(old_entries, list):
            raise ProjectOSError("Legacy shared knowledge must contain an entries array")
        old_by_id: dict[str, dict[str, Any]] = {}
        old_targets: dict[str, str] = {}
        for index, entry in enumerate(old_entries):
            if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
                raise ProjectOSError(f"Invalid legacy shared knowledge entry at index {index}")
            if entry["id"] in old_by_id:
                raise ProjectOSError(f"Duplicate legacy shared knowledge id: {entry['id']}")
            old_by_id[entry["id"]] = entry
            source = entry.get("source")
            source_pack = source.get("pack") if isinstance(source, dict) else None
            if isinstance(source_pack, str):
                old_targets[entry["id"]] = source_pack

        promoted_ids: set[str] = set()
        coverage_raw = original_paths.get("knowledge_coverage")
        coverage_path = safe_relative(root, coverage_raw) if isinstance(coverage_raw, str) else None
        if coverage_path is not None:
            reject_symlink_path(root, coverage_path)
            if not coverage_path.is_file():
                raise ProjectOSError("Legacy knowledge coverage path is missing")
            coverage, coverage_digest = load_json_snapshot(coverage_path)
            if snapshots is not None:
                snapshots[coverage_path] = coverage_digest
            inventory = scan_markdown_lessons(root, original_paths.get("legacy_knowledge", []))
            coverage_errors: list[str] = []
            validate_knowledge_coverage(
                root, inventory, coverage_path, old_targets, coverage_errors
            )
            if coverage_errors:
                raise ProjectOSError(
                    "Invalid legacy knowledge coverage: " + "; ".join(coverage_errors)
                )
            coverage_entries = coverage.get("entries", []) if isinstance(coverage, dict) else []
            promoted_ids = {
                entry.get("canonical_id")
                for entry in coverage_entries
                if isinstance(entry, dict)
                and entry.get("disposition") in {"promoted", "merged"}
                and isinstance(entry.get("canonical_id"), str)
            }

        migration_statuses: dict[str, str] = {}
        migration_previous_hashes: dict[str, str] = {}
        for entry_id in sorted(old_by_id):
            entry = old_by_id[entry_id]
            baseline = recorded_knowledge.get(entry_id)
            current_hash = entry_content_hash(entry)
            preserve_owned = entry_id in promoted_ids
            preserve_draft = baseline is None or current_hash != baseline
            if not preserve_owned and not preserve_draft:
                continue
            legacy_status = entry.get("status")
            migrated_status = (
                legacy_status
                if preserve_owned and legacy_status in FAILURE_STATUSES
                else "draft"
            )
            if migrated_status in {"retired", "replaced"}:
                source = entry.get("source")
                origin_pack = source.get("pack") if isinstance(source, dict) else None
                migrated_previous = migrated_predecessor_hash(
                    entry, origin_pack if isinstance(origin_pack, str) else None
                )
                if migrated_previous is None:
                    migrated_status = "draft"
                else:
                    migration_previous_hashes[entry_id] = migrated_previous
            migration_statuses[entry_id] = migrated_status

        changed = True
        while changed:
            changed = False
            for entry_id in sorted(migration_statuses):
                status = migration_statuses[entry_id]
                if status == "draft":
                    continue
                entry = old_by_id[entry_id]
                invalid = False
                if status == "active" and any(
                    key in entry for key in ("replaced_by", "reason", "previous_content_hash")
                ):
                    invalid = True
                if status == "retired" and (
                    "replaced_by" in entry
                    or not isinstance(entry.get("reason"), str)
                    or not entry.get("reason", "").strip()
                ):
                    invalid = True
                if status == "replaced" and (
                    not isinstance(entry.get("reason"), str)
                    or not entry.get("reason", "").strip()
                    or not is_canonical_knowledge_token(entry.get("replaced_by"))
                ):
                    invalid = True
                replaces = entry.get("replaces")
                if replaces is not None and (
                    not is_canonical_knowledge_token(replaces)
                    or migration_statuses.get(replaces) != "replaced"
                    or old_by_id.get(replaces, {}).get("replaced_by") != entry_id
                ):
                    invalid = True
                replaced_by = entry.get("replaced_by")
                if replaced_by is not None and (
                    status != "replaced"
                    or not is_canonical_knowledge_token(replaced_by)
                    or migration_statuses.get(replaced_by) in {None, "draft"}
                    or old_by_id.get(replaced_by, {}).get("replaces") != entry_id
                ):
                    invalid = True
                if invalid:
                    migration_statuses[entry_id] = "draft"
                    migration_previous_hashes.pop(entry_id, None)
                    changed = True

        discarded_entries = []
        for entry_id in sorted(migration_statuses):
            discarded = discarded_schema_three_migration_fields(
                old_by_id[entry_id],
                draft_fallback=migration_statuses[entry_id] == "draft",
                exact_managed_baseline=(
                    entry_content_hash(old_by_id[entry_id])
                    == recorded_knowledge.get(entry_id)
                ),
            )
            if discarded:
                discarded_entries.append(f"{entry_id}: {', '.join(discarded)}")
        if discarded_entries:
            raise ProjectOSError(
                "Schema 3 knowledge migration requires explicit review because it would "
                "discard user-owned fields: "
                + "; ".join(discarded_entries)
                + ". Review the named legacy entries, restore a valid lifecycle chain or "
                "move the information into supported schema-4 lesson fields, then explicitly "
                "remove legacy-only fields before retrying."
            )

        for entry_id in sorted(migration_statuses):
            entry = old_by_id[entry_id]
            migrated_status = migration_statuses[entry_id]
            migration_value = copy.deepcopy(entry)
            if migrated_status == "draft":
                for key in ("replaces", "replaced_by", "reason", "previous_content_hash"):
                    migration_value.pop(key, None)
            elif migrated_status in {"retired", "replaced"}:
                migration_value["previous_content_hash"] = migration_previous_hashes[entry_id]
            source = entry.get("source")
            origin_pack = source.get("pack") if isinstance(source, dict) else None
            converted = make_user_owned_entry(
                migration_value,
                status=migrated_status,
                source_kind=(
                    "migration-review-required"
                    if migrated_status == "draft"
                    else "user-reviewed"
                ),
                origin_pack=origin_pack if isinstance(origin_pack, str) else None,
            )
            privacy = private_material_labels(converted)
            if privacy:
                raise ProjectOSError(
                    f"Legacy knowledge {entry_id} requires sanitization before migration: "
                    + ", ".join(privacy)
                )
            migrated_entries.append(converted)

        if reusable_path.exists():
            raise ProjectOSError(
                "Schema-4 reusable knowledge destination already exists; resolve ownership first"
            )
        reusable = {
            "schema_version": 1,
            "entries": sorted(migrated_entries, key=lambda entry: entry["id"]),
        }
        validate_reusable_value(reusable, "migrated reusable knowledge")
        creates.append((reusable_path, canonical_json(reusable)))
        deletions.append((old_shared_path, old_shared_digest))
        print(f"knowledge migrated active: {sum(entry['status'] == 'active' for entry in migrated_entries)}")
        print(f"knowledge migrated draft: {sum(entry['status'] == 'draft' for entry in migrated_entries)}")
        print(f"release-managed knowledge removed: {len(old_entries) - len(migrated_entries)}")
    else:
        if not reusable_path.is_file():
            raise ProjectOSError("Reusable knowledge registry is missing")
        reusable_value, reusable_digest = load_json_snapshot(reusable_path)
        if snapshots is not None:
            snapshots[reusable_path] = reusable_digest
        reusable_errors: list[str] = []
        validate_failure_registry(
            reusable_path,
            "reusable knowledge",
            reusable_errors,
            verify_hashes=True,
            strict_reusable=True,
        )
        if not isinstance(reusable_value, dict) or set(reusable_value) != {
            "schema_version", "entries"
        }:
            reusable_errors.append("reusable knowledge has non-canonical top-level fields")
        if reusable_errors:
            conflicts.extend(reusable_errors)

    if conflicts:
        raise ProjectOSError("Upgrade conflicts: " + "; ".join(conflicts))
    next_system["schema_version"] = SCHEMA_VERSION
    next_system["project_os_version"] = VERSION
    next_system["managed_guidance"] = expected_guidance
    next_system.pop("managed_knowledge", None)
    comparison_before = copy.deepcopy(original_system)
    comparison_after = copy.deepcopy(next_system)
    comparison_before.pop("generated_on", None)
    comparison_after.pop("generated_on", None)
    if comparison_after != comparison_before or creates or replacements or deletions:
        next_system["generated_on"] = date.today().isoformat()
    return creates, replacements, deletions


def release_order(value: Any) -> tuple[Any, ...]:
    """SemVer precedence; build metadata does not affect upgrade direction."""
    match = re.fullmatch(
        r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
        r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
        r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?", value if isinstance(value, str) else "",
    )
    if match is None:
        raise ProjectOSError(f"Invalid Project OS release version: {value!r}")
    identifiers = match.group(4).split(".") if match.group(4) else []
    if any(item.isdigit() and len(item) > 1 and item.startswith("0") for item in identifiers):
        raise ProjectOSError(f"Invalid Project OS release version: {value!r}")
    return (
        *(int(match.group(index)) for index in (1, 2, 3)),
        0 if identifiers else 1,
        tuple((0, int(item)) if item.isdigit() else (1, item) for item in identifiers),
    )


def upgrade_project(
    root: Path,
    legacy_program_state: str | None,
    disposition: str | None,
    closed_on: str | None,
    reason: str | None,
    dry_run: bool,
) -> int:
    root = root.resolve()
    system_path = root / ".agents" / "SYSTEM.json"
    reject_symlink_path(root, system_path)
    loaded, original_digest = load_json_snapshot(system_path)
    if not isinstance(loaded, dict):
        raise ProjectOSError("SYSTEM configuration must contain an object")
    original_system = loaded
    if release_order(original_system.get("project_os_version")) > release_order(VERSION):
        raise ProjectOSError(
            f"Repository release {original_system.get('project_os_version')} is newer than "
            f"helper {VERSION}; refusing to downgrade. Use the matching or newer helper."
        )
    snapshots = {system_path: original_digest}
    schema = original_system.get("schema_version")
    if not isinstance(schema, int) or schema not in {2, 3, 4, SCHEMA_VERSION}:
        raise ProjectOSError(
            f"Upgrade supports SYSTEM schema 2, 3, 4 or {SCHEMA_VERSION}, got {schema!r}"
        )
    if not isinstance(original_system.get("installation"), str) or original_system.get(
        "installation"
    ) not in {"initialized", "adopted"}:
        raise ProjectOSError("SYSTEM installation must be initialized or adopted")
    validate_system_selection(original_system)
    if not isinstance(original_system.get("paths"), dict):
        raise ProjectOSError("SYSTEM paths must contain an object")

    next_system = copy.deepcopy(original_system)
    next_paths = next_system["paths"]
    next_paths.setdefault("history_index", None)
    if schema in {2, 3}:
        next_paths.pop("shared_knowledge", None)
        next_paths["reusable_knowledge"] = DEFAULT_PATHS["reusable_knowledge"]
    creates: list[tuple[Path, str | bytes]] = []
    replacements: list[tuple[Path, str, str]] = []
    deletions: list[tuple[Path, str]] = []

    if schema in {4, SCHEMA_VERSION}:
        if any(
            value is not None
            for value in (legacy_program_state, disposition, closed_on, reason)
        ):
            raise ProjectOSError("Legacy Program flags are valid only for a schema 2 upgrade")
        if not isinstance(next_system.get("mode"), str) or next_system.get("mode") not in {
            "standard",
            "program",
        }:
            raise ProjectOSError("Current SYSTEM mode must be standard or program")
        if "active_program" not in next_system:
            raise ProjectOSError("Current SYSTEM must declare active_program")
        require_safe_system_owners(root, next_system)
    elif schema == 3:
        if any(
            value is not None
            for value in (legacy_program_state, disposition, closed_on, reason)
        ):
            raise ProjectOSError("Legacy Program flags are valid only for a schema 2 upgrade")
        if not isinstance(next_system.get("mode"), str) or next_system.get("mode") not in {
            "standard",
            "program",
        }:
            raise ProjectOSError("Schema 3 SYSTEM mode must be standard or program")
        if "active_program" not in next_system:
            raise ProjectOSError("Schema 3 SYSTEM must declare active_program")
        require_safe_system_owners(root, next_system)
    else:
        old_mode = original_system.get("mode")
        if not isinstance(old_mode, str) or old_mode not in {"lite", "full"}:
            raise ProjectOSError("Schema 2 SYSTEM mode must be lite or full")
        if old_mode == "lite":
            if any(
                value is not None
                for value in (legacy_program_state, disposition, closed_on, reason)
            ):
                raise ProjectOSError("Lite migration does not accept legacy Program flags")
            if next_paths.get("program") is not None:
                raise ProjectOSError("Lite schema 2 state cannot declare a Program path")
            next_system["mode"] = "standard"
            next_system["active_program"] = None
            next_paths["program"] = None
            if next_paths.get("history") is None:
                next_paths["history_index"] = None
            require_safe_system_owners(root, next_system)
        else:
            if legacy_program_state not in {"active", "closed"}:
                raise ProjectOSError(
                    "Schema 2 Full migration requires --legacy-program-state active or closed"
                )
            raw_program = next_paths.get("program") or PROGRAM_RELATIVE_PATH
            if raw_program != PROGRAM_RELATIVE_PATH:
                raise ProjectOSError(
                    f"Schema 2 Program migration requires paths.program to be {PROGRAM_RELATIVE_PATH}"
                )
            next_paths["program"] = raw_program
            owner_check_system = copy.deepcopy(next_system)
            owner_check_system["mode"] = "program"
            require_safe_system_owners(root, owner_check_system)
            program_path = safe_relative(root, raw_program)
            if program_path is None or not program_path.is_file():
                raise ProjectOSError("Schema 2 Full migration requires an existing PROGRAM.md")
            reject_symlink_path(root, program_path)
            history_path, index_path, history_index, index_sha256 = load_history_for_mutation(
                root, next_system
            )
            if index_sha256 is not None:
                snapshots[index_path] = index_sha256
            next_paths["history"] = history_path.relative_to(root).as_posix()
            next_paths["history_index"] = index_path.relative_to(root).as_posix()
            readme_path = history_path / "README.md"
            if not readme_path.exists():
                creates.append(
                    (readme_path, HISTORY_README_TEMPLATE.read_text(encoding="utf-8"))
                )
            elif not readme_path.is_file() or readme_path.is_symlink():
                raise ProjectOSError("History README must be a regular file when present")
            program_id = next_program_id(history_index, history_path)
            if legacy_program_state == "active":
                if disposition is not None or closed_on is not None or reason is not None:
                    raise ProjectOSError("Active legacy Program migration cannot set disposition")
                next_system["mode"] = "program"
                next_system["active_program"] = {
                    "id": program_id,
                    "initiative": "Migrated schema 2 Program",
                    "started_on": None,
                    "migrated_on": date.today().isoformat(),
                    "origin": "legacy-migration",
                }
                next_paths["program"] = program_path.relative_to(root).as_posix()
                if index_sha256 is None:
                    creates.append((index_path, json.dumps(history_index, indent=2) + "\n"))
            else:
                if disposition not in {"completed", "stopped"}:
                    raise ProjectOSError(
                        "Closed legacy Program migration requires --disposition completed or stopped"
                    )
                actual_closed_on = canonical_date(
                    closed_on, "Closed legacy Program migration --closed-on"
                )
                if disposition == "stopped" and (not reason or not reason.strip()):
                    raise ProjectOSError("A stopped legacy Program requires --reason")
                if active_plan_ids(root, original_system, snapshots):
                    raise ProjectOSError(
                        "Close the active plan before migrating a closed legacy Program"
                    )
                archive_path = history_path / "programs" / program_id / "PROGRAM.md"
                reject_symlink_path(root, archive_path)
                if archive_path.exists():
                    raise ProjectOSError(
                        f"Program archive already exists: {archive_path.relative_to(root)}"
                    )
                program_content = program_path.read_bytes()
                program_digest = hashlib.sha256(program_content).hexdigest()
                history_entry: dict[str, Any] = {
                    "id": program_id,
                    "kind": "program",
                    "path": archive_path.relative_to(root).as_posix(),
                    "sha256": "sha256:" + program_digest,
                    "closed_on": actual_closed_on,
                    "disposition": disposition,
                }
                if reason:
                    history_entry["reason"] = reason.strip()
                history_index["entries"].append(history_entry)
                creates.append((archive_path, program_content))
                serialized_index = json.dumps(history_index, indent=2, ensure_ascii=False) + "\n"
                if index_sha256 is None:
                    creates.append((index_path, serialized_index))
                else:
                    replacements.append((index_path, serialized_index, index_sha256))
                deletions.append((program_path, program_digest))
                next_system["mode"] = "standard"
                next_system["active_program"] = None
                next_paths["program"] = None

    continuity_creates, continuity_replacements = plan_continuity_migration(
        root, original_system, next_system, snapshots
    )
    creates.extend(continuity_creates)
    replacements.extend(continuity_replacements)

    managed_creates, managed_replacements, managed_deletions = plan_managed_release_update(
        root, original_system, next_system, snapshots
    )
    creates.extend(managed_creates)
    replacements.extend(managed_replacements)
    deletions.extend(managed_deletions)
    require_safe_system_owners(root, next_system)
    prospective_errors: list[str] = []
    if schema != SCHEMA_VERSION:
        prospective_index_path = safe_relative(root, next_paths.get("plans"))
        assert prospective_index_path is not None
        prospective_index = migrate_plan_index(load_json(prospective_index_path))
        validate_plan_records(root, next_system, prospective_errors, snapshots,
                              index_value=prospective_index,
                              requests_value={"schema_version": 1, "next_id": 1, "requests": []})
    else:
        validate_plan_records(root, next_system, prospective_errors, snapshots)
    if prospective_errors:
        raise ProjectOSError("Upgrade record conflicts: " + "; ".join(prospective_errors))
    serialized_system = json.dumps(next_system, indent=2, ensure_ascii=False) + "\n"
    if hashlib.sha256(serialized_system.encode("utf-8")).hexdigest() != original_digest:
        replacements.append((system_path, serialized_system, original_digest))

    print(f"upgrade schema: {schema} -> {SCHEMA_VERSION}")
    print(f"upgrade mode: {original_system.get('mode')} -> {next_system.get('mode')}")
    print_transaction_preview(root, creates, replacements, deletions)
    if schema != SCHEMA_VERSION:
        for path, content, *_ in [*creates, *replacements]:
            if path.name in {"AGENTS.md", "WORKFLOW.md", "requests.json"} or path == safe_relative(root, next_paths.get("plans")):
                print(f"preview: {path.relative_to(root)}\n{content}")
    if dry_run:
        print("dry-run: no files written")
        return 0
    execute_sync_transaction(
        root,
        creates,
        replacements,
        deletions,
        after_write=lambda: require_passing_check(root, "Upgrade"),
        preconditions=snapshots,
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan_parser = subparsers.add_parser("plan", help="Inspect or transactionally complete a plan")
    plan_commands = plan_parser.add_subparsers(dest="plan_command", required=True)
    plan_status_parser = plan_commands.add_parser("status", help="Report recorded gates and remaining obligations")
    plan_status_parser.add_argument("--target", required=True, type=Path)
    plan_status_parser.add_argument("--id")
    plan_status_parser.add_argument("--json", action="store_true")
    plan_status_parser.add_argument("--require-ready", action="store_true", help="Exit nonzero until all recorded outcome acceptance passes")
    plan_complete_parser = plan_commands.add_parser("complete", help="Close only after required evidence exists")
    plan_complete_parser.add_argument("--target", required=True, type=Path)
    plan_complete_parser.add_argument("--id", required=True)
    plan_complete_parser.add_argument("--checkpoint", required=True, type=Path)
    plan_complete_parser.add_argument("--dry-run", action="store_true")

    detect_parser = subparsers.add_parser("detect", help="Inspect toolchain and capability signals")
    detect_parser.add_argument("--target", required=True, type=Path)

    init_parser = subparsers.add_parser("init", help="Create a new Project OS control plane")
    init_parser.add_argument("--target", required=True, type=Path)
    init_parser.add_argument(
        "--packs", default="auto", help="auto, none or comma-separated capability packs"
    )
    init_parser.add_argument(
        "--overlays", default="auto", help="auto, none or comma-separated ecosystem overlays"
    )
    init_parser.add_argument("--dry-run", action="store_true")
    init_parser.add_argument(
        "--allow-existing-agents",
        action="store_true",
        help="preserve an existing AGENTS.md that already routes to CONTEXT.md and STATE.md",
    )

    adopt_parser = subparsers.add_parser(
        "adopt", help="Discover and safely attach to an existing Project OS-like layout"
    )
    adopt_parser.add_argument("--target", required=True, type=Path)
    adopt_parser.add_argument("--dry-run", action="store_true")
    adopt_parser.add_argument(
        "--inventory", action="store_true", help="include legacy Markdown lesson inventory"
    )

    check_parser = subparsers.add_parser("check", help="Validate Project OS state and invariants")
    check_parser.add_argument("--target", required=True, type=Path)
    check_parser.add_argument("--config", type=Path, help="validate against a proposed SYSTEM manifest")

    sync_parser = subparsers.add_parser(
        "sync-knowledge", help="Deprecated read-only compatibility notice"
    )
    sync_parser.add_argument("--target", required=True, type=Path)
    sync_parser.add_argument("--packs", default="selected")
    sync_parser.add_argument("--overlays", default="selected")
    sync_parser.add_argument("--dry-run", action="store_true")

    knowledge_parser = subparsers.add_parser(
        "knowledge", help="Manage user-owned reusable failure knowledge"
    )
    knowledge_subparsers = knowledge_parser.add_subparsers(
        dest="knowledge_command", required=True
    )
    knowledge_list_parser = knowledge_subparsers.add_parser(
        "list", help="List project-specific or reusable knowledge"
    )
    knowledge_list_parser.add_argument("--target", required=True, type=Path)
    knowledge_list_parser.add_argument(
        "--scope", choices=("project", "reusable", "all"), default="all"
    )
    knowledge_approve_parser = knowledge_subparsers.add_parser(
        "approve", help="Approve reviewed proposal entries into reusable knowledge"
    )
    knowledge_approve_parser.add_argument("--target", required=True, type=Path)
    knowledge_approve_parser.add_argument("--proposal", required=True, type=Path)
    approve_selection = knowledge_approve_parser.add_mutually_exclusive_group(required=True)
    approve_selection.add_argument("--ids")
    approve_selection.add_argument("--all", action="store_true", dest="select_all")
    knowledge_approve_parser.add_argument("--dry-run", action="store_true")
    knowledge_export_parser = knowledge_subparsers.add_parser(
        "export", help="Create a deterministic portable knowledge bundle"
    )
    knowledge_export_parser.add_argument("--target", required=True, type=Path)
    knowledge_export_parser.add_argument("--output", required=True, type=Path)
    knowledge_export_parser.add_argument("--ids")
    knowledge_export_parser.add_argument("--active-only", action="store_true")
    knowledge_export_parser.add_argument("--dry-run", action="store_true")
    knowledge_import_parser = knowledge_subparsers.add_parser(
        "import", help="Preview or import lessons from a repository or bundle"
    )
    knowledge_import_parser.add_argument("--target", required=True, type=Path)
    knowledge_import_parser.add_argument("--source", required=True, type=Path)
    import_selection = knowledge_import_parser.add_mutually_exclusive_group()
    import_selection.add_argument("--ids")
    import_selection.add_argument("--all", action="store_true", dest="select_all")
    knowledge_import_parser.add_argument("--dry-run", action="store_true")
    knowledge_revise_parser = knowledge_subparsers.add_parser(
        "revise", help="Replace an active lesson with a reviewed revision"
    )
    knowledge_revise_parser.add_argument("--target", required=True, type=Path)
    knowledge_revise_parser.add_argument("--id", required=True)
    knowledge_revise_parser.add_argument("--proposal", required=True, type=Path)
    knowledge_revise_parser.add_argument("--dry-run", action="store_true")
    knowledge_retire_parser = knowledge_subparsers.add_parser(
        "retire", help="Retire an active reusable lesson"
    )
    knowledge_retire_parser.add_argument("--target", required=True, type=Path)
    knowledge_retire_parser.add_argument("--id", required=True)
    knowledge_retire_parser.add_argument("--reason", required=True)
    knowledge_retire_parser.add_argument("--dry-run", action="store_true")
    knowledge_remove_parser = knowledge_subparsers.add_parser(
        "remove", help="Permanently remove a local reusable lesson"
    )
    knowledge_remove_parser.add_argument("--target", required=True, type=Path)
    knowledge_remove_parser.add_argument("--id", required=True)
    knowledge_remove_parser.add_argument("--confirm", required=True)
    knowledge_remove_parser.add_argument("--dry-run", action="store_true")

    upgrade_parser = subparsers.add_parser(
        "upgrade", help="Upgrade schema, managed guidance and release metadata"
    )
    upgrade_parser.add_argument("--target", required=True, type=Path)
    upgrade_parser.add_argument(
        "--legacy-program-state",
        choices=("active", "closed"),
        help="required classification when migrating a schema 2 Full repository",
    )
    upgrade_parser.add_argument("--disposition", choices=("completed", "stopped"))
    upgrade_parser.add_argument("--closed-on")
    upgrade_parser.add_argument("--reason")
    upgrade_parser.add_argument("--dry-run", action="store_true")

    program_parser = subparsers.add_parser("program", help="Manage a multi-phase Program")
    program_subparsers = program_parser.add_subparsers(
        dest="program_command", required=True
    )
    program_start_parser = program_subparsers.add_parser(
        "start", help="Start a Program from a validated JSON definition"
    )
    program_start_parser.add_argument("--target", required=True, type=Path)
    program_start_parser.add_argument("--definition", required=True, type=Path)
    program_start_parser.add_argument("--dry-run", action="store_true")
    program_status_parser = program_subparsers.add_parser(
        "status", help="Report current Program state"
    )
    program_status_parser.add_argument("--target", required=True, type=Path)
    program_close_parser = program_subparsers.add_parser(
        "close", help="Archive and close the active Program"
    )
    program_close_parser.add_argument("--target", required=True, type=Path)
    program_close_parser.add_argument(
        "--disposition", required=True, choices=("completed", "stopped")
    )
    program_close_parser.add_argument("--reason")
    program_close_parser.add_argument("--dry-run", action="store_true")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        if args.command == "plan":
            if args.plan_command == "status":
                return plan_status(args.target, args.id, args.json, args.require_ready)
            return complete_plan(args.target, args.id, args.checkpoint, args.dry_run)
        if args.command == "detect":
            print(json.dumps(detect_repository(args.target), indent=2, ensure_ascii=False))
            return 0
        if args.command == "init":
            return init_project(
                args.target,
                args.packs,
                args.overlays,
                args.dry_run,
                args.allow_existing_agents,
            )
        if args.command == "adopt":
            return adopt_project(args.target, args.dry_run, args.inventory)
        if args.command == "check":
            return check_project(args.target, args.config)
        if args.command == "sync-knowledge":
            return sync_knowledge(args.target, args.packs, args.overlays, args.dry_run)
        if args.command == "knowledge":
            if args.knowledge_command == "list":
                return knowledge_list(args.target, args.scope)
            if args.knowledge_command == "approve":
                return knowledge_approve(
                    args.target, args.proposal, args.ids, args.select_all, args.dry_run
                )
            if args.knowledge_command == "export":
                return knowledge_export(
                    args.target, args.output, args.ids, args.active_only, args.dry_run
                )
            if args.knowledge_command == "import":
                return knowledge_import(
                    args.target, args.source, args.ids, args.select_all, args.dry_run
                )
            if args.knowledge_command == "revise":
                return knowledge_revise(args.target, args.id, args.proposal, args.dry_run)
            if args.knowledge_command == "retire":
                return knowledge_retire(args.target, args.id, args.reason, args.dry_run)
            if args.knowledge_command == "remove":
                return knowledge_remove(
                    args.target, args.id, args.confirm, args.dry_run
                )
        if args.command == "upgrade":
            return upgrade_project(
                args.target,
                args.legacy_program_state,
                args.disposition,
                args.closed_on,
                args.reason,
                args.dry_run,
            )
        if args.command == "program":
            if args.program_command == "start":
                return start_program(args.target, args.definition, args.dry_run)
            if args.program_command == "status":
                return program_status(args.target)
            if args.program_command == "close":
                return close_program(
                    args.target, args.disposition, args.reason, args.dry_run
                )
    except ProjectOSError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    parser.error(f"Unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
