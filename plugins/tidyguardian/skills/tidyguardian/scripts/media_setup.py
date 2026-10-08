"""First-use FFmpeg onboarding. No installer, downloader or file executor lives here.

This module depends only on Python's standard library. Check mode is read-only;
only an explicit basic-mode choice creates a small application preference file.
A preference is NEVER authorization to move, quarantine or delete user files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import subprocess
import sys
import webbrowser

SETUP_REQUIRED = 3
DOWNLOAD_URL = "https://ffmpeg.org/download.html"
TOOLS = ("ffmpeg", "ffprobe")
CHECK_TIMEOUT = 5


def safe_text(value):
    """Do not emit control sequences from a path or executable's output."""
    return "".join(c if c.isprintable() else "?" for c in str(value))


def probe_tool(name):
    path = shutil.which(name)
    info = {"name": name, "path": path, "status": "missing", "version": None}
    if not path:
        return info
    # Never launch a Windows shell script, even with shell=False.
    if Path(path).suffix.lower() in {".bat", ".cmd"}:
        return dict(info, status="unusable", error="Expected a native executable, not a shell script")
    try:
        result = subprocess.run(
            [path, "-version"], stdin=subprocess.DEVNULL, capture_output=True,
            text=True, errors="replace", timeout=CHECK_TIMEOUT, check=False,
        )
        lines = (result.stdout or "").splitlines()
        version = lines[0].strip() if lines else ""
        if result.returncode != 0 or not version.startswith(name + " version "):
            return dict(info, status="unusable", error="Executable did not return an expected version banner")
        return dict(info, status="ready", version=safe_text(version[:250]))
    except subprocess.TimeoutExpired:
        return dict(info, status="unusable", error="Version check timed out")
    except OSError as exc:
        return dict(info, status="unusable", error=safe_text(exc))


def environment():
    system = platform.system()
    contexts = []
    if os.environ.get("SSH_CONNECTION") or os.environ.get("SSH_TTY"):
        contexts.append("SSH / remote host")
    if os.environ.get("WSL_DISTRO_NAME"):
        contexts.append("WSL (separate from Windows)")
    if Path("/.dockerenv").exists() or os.environ.get("container"):
        contexts.append("container")
    if os.environ.get("CI"):
        contexts.append("CI runner")
    distro = ""
    if system == "Linux":
        try:
            distro = platform.freedesktop_os_release().get("ID", "")
        except (OSError, AttributeError):
            pass
    return {"system": system, "architecture": platform.machine(), "distro": distro,
            "python": sys.version.split()[0], "python_executable": sys.executable,
            "context": contexts or ["current Python process; local/remote ownership not verified"]}


def install_guidance(env):
    """Static, platform-specific instructions only; never execute these commands."""
    commands, notes = [], []
    system = env["system"]
    if system == "Darwin":
        if shutil.which("brew"):
            commands = ["brew install ffmpeg"]
            notes.append("Homebrew installs FFmpeg and FFprobe. Review its package/dependency changes.")
        else:
            notes.append("Homebrew was not found. Use the FFmpeg download page's macOS section, or review https://brew.sh/ before installing Homebrew separately.")
    elif system == "Windows":
        if shutil.which("winget"):
            commands = ['winget install --name "FFmpeg (Essentials Build)" --exact --source winget']
            notes.append("Review the selected publisher, license and installer prompts. Do not auto-accept agreements.")
        else:
            notes.append("WinGet was not found. Use the Windows builds linked by FFmpeg, or review https://learn.microsoft.com/windows/package-manager/winget/ first.")
    elif system == "Linux" and env.get("distro") in {"ubuntu", "debian"} and shutil.which("apt-get"):
        commands = ["sudo apt-get update", "sudo apt-get install ffmpeg"]
        notes.append("These commands change system packages and may request an administrator password. The user runs them personally; do not put a password in chat.")
    else:
        notes.append("No verified package-manager shortcut for this environment. Use FFmpeg's download page and your distribution's package instructions; do not guess a command or add a repository automatically.")
    notes.extend([
        "FFmpeg.org publishes source code and links to third-party compiled builds. Choose a build matching this OS and CPU, and follow the publisher's verification instructions.",
        "Install in the environment that will actually run TidyGuardian, not merely the computer showing this chat. This check cannot inspect another computer.",
        "After installation, reopen the terminal / restart the agent if PATH changed, then rerun setup. No PATH or shell-profile edits are performed by TidyGuardian.",
        "A Python ffmpeg package or another agent skill does not by itself provide both command-line executables.",
    ])
    return {"download_url": DOWNLOAD_URL, "commands": commands, "notes": notes}


def inspect():
    env = environment()
    tools = {name: probe_tool(name) for name in TOOLS}
    return {"schema": 1, "environment": env, "tools": tools,
            "media_ready": all(t["status"] == "ready" for t in tools.values()),
            "installation": install_guidance(env)}


def preference_path():
    """Preference scope is user + host + Python environment, not a source folder."""
    home = Path.home()
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", str(home / "AppData" / "Local")))
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", str(home / ".config")))
    if not base.is_absolute():
        raise OSError("Configuration directory must be absolute")
    scope = "\0".join((platform.system(), platform.machine(), platform.node(), sys.executable))
    key = hashlib.sha256(scope.encode()).hexdigest()[:24]
    return base / "tidyguardian" / ("media-basic-" + key + ".json")


def safe_parents(path, create=False):
    """Refuse linked/reparse config locations rather than following them."""
    for parent in reversed(path.parents):
        if not parent.exists() and create:
            parent.mkdir(mode=0o700, exist_ok=True)
        if not os.path.lexists(parent):
            return False
        st = parent.lstat()
        if (not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode)
                or getattr(st, "st_file_attributes", 0) & 0x400):
            raise OSError("Linked or non-directory configuration location refused")
    return True


def basic_preference():
    try:
        path = preference_path()
        if not safe_parents(path):
            return False
        st = path.lstat()
        if (not stat.S_ISREG(st.st_mode) or st.st_nlink != 1 or st.st_size > 512
                or getattr(st, "st_file_attributes", 0) & 0x400):
            return False
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        with os.fdopen(fd, "r", encoding="utf-8") as handle:
            opened = os.fstat(handle.fileno())
            if (opened.st_dev, opened.st_ino) != (st.st_dev, st.st_ino):
                return False
            return json.loads(handle.read(513)) == {"schema": 1, "basic_mode": True}
    except (OSError, ValueError):
        return False


def remember_basic(stream):
    """Exclusive creation: never truncate an existing file, even corrupt state."""
    try:
        path = preference_path()
        safe_parents(path, create=True)
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
        except FileExistsError:
            if basic_preference():
                return True
            raise OSError("Existing preference is not recognized; it was left untouched")
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump({"schema": 1, "basic_mode": True}, handle)
            handle.flush()
            os.fsync(handle.fileno())
        print("Saved basic-mode preference: " + safe_text(path), file=stream)
        return True
    except OSError as exc:
        print("Basic mode applies to this run only; preference not saved: " + safe_text(exc), file=stream)
        return False


def show(report, stream):
    env = report["environment"]
    print("TidyGuardian media setup", file=stream)
    print("Environment: " + safe_text(f"{env['system']} / {env['architecture']} / Python {env['python']}"), file=stream)
    print("Context: " + safe_text(", ".join(env["context"])), file=stream)
    print("Checks apply only to this Python environment, not another computer connected through a browser.", file=stream)
    for name, item in report["tools"].items():
        print(f"  {name}: {item['status']} | " + safe_text(item.get("version") or item.get("error") or "not found on PATH"), file=stream)
        if item["path"]:
            print("    " + safe_text(item["path"]), file=stream)
    if report["media_ready"]:
        print("FFmpeg and FFprobe are ready. Individual file/codec support is checked during preview.", file=stream)
    else:
        print("Media setup is incomplete. No software has been installed or user media modified.", file=stream)
        print("Browser installation: " + DOWNLOAD_URL, file=stream)
        for cmd in report["installation"]["commands"]:
            print("  " + cmd, file=stream)
        for note in report["installation"]["notes"]:
            print("  " + note, file=stream)


def interactive_setup(report, *, require_media=False, stream=None):
    stream = stream or sys.stderr
    while True:
        show(report, stream)
        if report["media_ready"]:
            return 0
        print("[T] Terminal instructions  [B] Open FFmpeg download page  [R] Recheck  [Q] Cancel", file=stream)
        if not require_media:
            print("[C] Explicitly continue with basic mode (remember for this environment)", file=stream)
        print("Choice: ", end="", flush=True, file=stream)
        try:
            answer = input().strip().casefold()
        except (EOFError, KeyboardInterrupt):
            print("\nSetup cancelled. No installation performed.", file=stream)
            return SETUP_REQUIRED
        if answer == "r":
            report = inspect()
        elif answer == "t":
            print("Run the commands shown above personally in another terminal, then choose R. This assistant does not run an installer.", file=stream)
        elif answer == "b":
            # Only this explicit choice may launch a browser. URL is fixed, not input.
            try:
                opened = webbrowser.open(DOWNLOAD_URL, new=2)
            except (webbrowser.Error, OSError):
                opened = False
            print("Download page opened; install manually, then choose R." if opened else "Browser unavailable. Open " + DOWNLOAD_URL + " manually.", file=stream)
        elif answer == "c" and not require_media:
            remember_basic(stream)
            print("Continuing without media previews. This is NOT file-operation permission.", file=stream)
            return 0
        elif answer in {"q", ""}:
            print("Setup paused; rerun the setup command after installing FFmpeg and FFprobe.", file=stream)
            return SETUP_REQUIRED
        else:
            print("Choose one of the displayed options. Nothing has been installed.", file=stream)


def is_interactive():
    return sys.stdin.isatty() and sys.stderr.isatty()


def preflight(*, require_media=False, stream=None):
    """Run before any inventory, report or file-operation command touches its root."""
    stream = stream or sys.stderr
    report = inspect()  # Never infer readiness from an old preference or old PATH.
    if report["media_ready"]:
        return 0
    if not require_media and basic_preference():
        print("Media tools unavailable; continuing with your saved basic-mode choice. Run setup to enable previews.", file=stream)
        return 0
    if is_interactive():
        return interactive_setup(report, require_media=require_media, stream=stream)
    show(report, stream)
    print("SETUP_REQUIRED: run tidyguardian.py setup in an interactive terminal. An agent must present installation choices to the user, then rerun setup --check --json.", file=stream)
    if not require_media:
        print("Only after the user explicitly declines previews: run tidyguardian.py setup --basic. That preference does not authorize file operations.", file=stream)
    return SETUP_REQUIRED


def add_parser(subparsers):
    p = subparsers.add_parser("setup", aliases=["doctor"], help="First-use FFmpeg/FFprobe check and consent-first installation guidance")
    modes = p.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="Check only; no prompt, browser or preference writes")
    modes.add_argument("--basic", action="store_true", help="Explicitly opt into basic mode; remember only this environment's preference")
    p.add_argument("--json", action="store_true", help="Machine-readable check only (implies --check)")


def setup_command(args):
    if args.command == "doctor" and args.basic:
        raise ValueError("doctor is read-only; use setup --basic for an explicit preference change")
    if args.basic and args.json:
        raise ValueError("--basic cannot be combined with read-only --json")
    report = inspect()
    if args.json:
        print(json.dumps(report, ensure_ascii=True, indent=2))
        return 0 if report["media_ready"] else SETUP_REQUIRED
    if args.basic:
        if not remember_basic(sys.stderr):
            return 2
        print("Basic mode selected. Previews remain unavailable until both tools pass setup. No file-operation permission was granted.")
        return 0
    if args.check or args.command == "doctor" or not is_interactive():
        show(report, sys.stdout)
        return 0 if report["media_ready"] else SETUP_REQUIRED
    return interactive_setup(report)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    add_parser(sub)
    try:
        return setup_command(parser.parse_args(argv))
    except (OSError, ValueError) as exc:
        print("Setup stopped: " + safe_text(exc), file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Setup cancelled. No installer was run.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
