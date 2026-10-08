"""Install rendering dependencies in a private, interpreter-specific runtime."""
from __future__ import annotations

import importlib
import subprocess
import sys
import sysconfig
from pathlib import Path

from .shell import run
from .state import local_data_home


class PythonDependencyError(RuntimeError):
    pass


def python_packages_path() -> Path:
    tag = f"{sys.implementation.cache_tag}-{sysconfig.get_platform()}"
    return local_data_home() / "runtime" / "python" / tag / "site-packages"


def pillow_status() -> dict:
    target = python_packages_path()
    if target.is_dir() and str(target) not in sys.path:
        sys.path.insert(0, str(target))
        importlib.invalidate_caches()
    try:
        pillow = importlib.import_module("PIL.Image")
    except ImportError:
        return {"found": False, "ok": False, "python": sys.executable, "runtime": str(target)}
    return {"found": True, "ok": True, "version": pillow.__version__, "python": sys.executable,
            "runtime": str(target)}


def ensure_pillow() -> dict:
    status = pillow_status()
    if status["ok"]:
        return status
    target = python_packages_path()
    target.mkdir(parents=True, exist_ok=True)
    command = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check",
               "--target", str(target), "--upgrade", "Pillow"]
    print("Installing Pillow in the plugin-managed Python runtime...", file=sys.stderr)
    try:
        result = run(command, timeout=300)
    except subprocess.TimeoutExpired as exc:
        raise PythonDependencyError("Pillow installation timed out after 300 seconds; retry bootstrap --yes.") from exc
    if not result.ok:
        raise PythonDependencyError(
            "Pillow installation failed. Check pip and network access, then retry bootstrap --yes. "
            + (result.stderr or result.stdout)[-1200:]
        )
    importlib.invalidate_caches()
    status = pillow_status()
    if not status["ok"]:
        raise PythonDependencyError("Pillow installation completed but import failed; retry bootstrap --yes.")
    return status
