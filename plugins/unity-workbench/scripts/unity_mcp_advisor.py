#!/usr/bin/env python3
"""Print practical Unity MCP setup guidance for a local Unity project."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


PROVIDERS = {"auto", "official", "coplaydev", "ivanmurzak", "codergamester"}


def read_unity_version(project: Path) -> str | None:
    version_file = project / "ProjectSettings" / "ProjectVersion.txt"
    if not version_file.exists():
        return None
    for line in version_file.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("m_EditorVersion:"):
            return line.split(":", 1)[1].strip()
    return None


def read_manifest(project: Path) -> dict:
    manifest = project / "Packages" / "manifest.json"
    if not manifest.exists():
        return {}
    try:
        return json.loads(manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def read_packages_lock(project: Path) -> dict:
    lock_file = project / "Packages" / "packages-lock.json"
    if not lock_file.exists():
        return {}
    try:
        return json.loads(lock_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def major_version(version: str | None) -> int | None:
    if not version:
        return None
    first = version.split(".", 1)[0]
    try:
        return int(first)
    except ValueError:
        return None


def relay_path() -> Path:
    if os.name == "nt":
        return Path.home() / ".unity" / "relay" / "relay_win.exe"
    if os.uname().sysname == "Darwin":
        return Path.home() / ".unity" / "relay"
    return Path.home() / ".unity" / "relay" / "relay_linux"


def missing_unity_markers(project: Path) -> list[str]:
    required = [
        project / "Assets",
        project / "Packages" / "manifest.json",
        project / "ProjectSettings" / "ProjectVersion.txt",
    ]
    return [path.relative_to(project).as_posix() for path in required if not path.exists()]


def classify_provider(text: str) -> str | None:
    lowered = text.lower()
    if "com.unity.ai.assistant" in lowered:
        return "official"
    if "coplaydev" in lowered or "coplay" in lowered:
        return "coplaydev"
    if "ivanmurzak" in lowered or "ai-game" in lowered:
        return "ivanmurzak"
    if "codergamester" in lowered:
        return "codergamester"
    if "unity-mcp" in lowered or "mcp-unity" in lowered:
        return "unknown-unity-mcp"
    return None


def detect_existing_mcp(project: Path) -> list[tuple[str, str]]:
    evidence: list[tuple[str, str]] = []
    manifest = read_manifest(project)
    deps = manifest.get("dependencies", {})
    for name, value in deps.items():
        provider = classify_provider(f"{name} {value}")
        if provider:
            evidence.append((provider, f"Packages/manifest.json dependency: {name}"))

    lock = read_packages_lock(project)
    for name, data in lock.get("dependencies", {}).items():
        provider = classify_provider(f"{name} {data}")
        if provider:
            evidence.append((provider, f"Packages/packages-lock.json dependency: {name}"))

    packages_dir = project / "Packages"
    if packages_dir.exists():
        for child in packages_dir.iterdir():
            provider = classify_provider(child.name)
            if provider:
                evidence.append((provider, f"embedded package/folder: Packages/{child.name}"))

    for config in [project / ".mcp.json", project / ".cursor" / "mcp.json", project / ".vscode" / "mcp.json"]:
        if config.exists():
            evidence.append(("configured-mcp-client", str(config.relative_to(project))))

    return evidence


def detect_provider(project: Path, requested: str) -> str:
    if requested != "auto":
        return requested
    existing = detect_existing_mcp(project)
    for provider, _reason in existing:
        if provider in PROVIDERS:
            return provider
    version = read_unity_version(project)
    manifest = read_manifest(project)
    deps = manifest.get("dependencies", {})
    if "com.unity.ai.assistant" in deps or (major_version(version) or 0) >= 6000:
        return "official"
    if any("CoplayDev/unity-mcp" in str(value) for value in deps.values()):
        return "coplaydev"
    if any("ivanmurzak" in str(value).lower() or "unity-mcp" in str(value).lower() for value in deps.values()):
        return "ivanmurzak"
    return "coplaydev"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, help="Path to the Unity project root.")
    parser.add_argument("--provider", choices=sorted(PROVIDERS), default="auto")
    args = parser.parse_args()

    project = Path(args.project).expanduser().resolve()
    version = read_unity_version(project)
    manifest = read_manifest(project)
    deps = manifest.get("dependencies", {})
    existing_mcp = detect_existing_mcp(project)
    missing_markers = missing_unity_markers(project)
    provider = "unresolved" if missing_markers else detect_provider(project, args.provider)

    print(f"Project: {project}")
    print(f"Unity version: {version or 'not found'}")
    if existing_mcp:
        print("Existing MCP evidence:")
        seen = set()
        for provider_name, reason in existing_mcp:
            item = (provider_name, reason)
            if item in seen:
                continue
            seen.add(item)
            print(f"- {provider_name}: {reason}")
    else:
        print("Existing MCP evidence: none found")
    if missing_markers:
        print("Recommended provider: unresolved until the Unity project root is verified")
    else:
        print(f"Recommended provider: {provider}")
    print()

    if missing_markers:
        print("Warning: this path is not a verified Unity project root.")
        for marker in missing_markers:
            print(f"- Missing {marker}")
        print("Resolve the Unity project root before choosing or installing a Unity MCP provider.")
        return 1

    if provider == "official":
        relay = relay_path()
        print("Official Unity MCP checklist:")
        print("- Install/enable the Unity AI Assistant package.")
        print("- Open Unity and check Edit > Project Settings > AI > Unity MCP.")
        print("- Confirm the bridge is Running.")
        print(f"- Manual MCP command: {relay}")
        print("- Manual MCP args: --mcp")
        print("- Approve the Codex/client connection when Unity shows it as pending.")
        if "com.unity.ai.assistant" not in deps:
            print("- Note: com.unity.ai.assistant was not found in Packages/manifest.json.")
            print("- Ask before installing/enabling the package.")
    elif provider == "coplaydev":
        print("CoplayDev/unity-mcp checklist:")
        print("- Review https://github.com/CoplayDev/unity-mcp before installing.")
        print("- Add the Unity package from its documented Package Manager git URL.")
        print("- Start Unity, verify the MCP server status, then connect the MCP client.")
        print("- Use this when official Unity MCP is unavailable or community tooling is preferred.")
        print("- Ask before adding it if no existing CoplayDev MCP evidence was found.")
    elif provider == "ivanmurzak":
        print("IvanMurzak/Unity-MCP checklist:")
        print("- Review https://github.com/IvanMurzak/Unity-MCP before installing.")
        print("- Consider the CLI flow when you want generated skills or runtime MCP behavior.")
        print("- Confirm project paths and requirements before installation.")
        print("- Ask before adding it if no existing IvanMurzak MCP evidence was found.")
    elif provider == "codergamester":
        print("CoderGamester/mcp-unity checklist:")
        print("- Review https://github.com/CoderGamester/mcp-unity before installing.")
        print("- Confirm Node.js/server requirements and Unity package installation steps.")
        print("- Use a low-risk scene or console read as the first connection test.")
        print("- Ask before adding it if no existing CoderGamester MCP evidence was found.")

    if not existing_mcp:
        print()
        print("No Unity MCP appears to be configured. Ask the user whether they want to add one, then guide them to a single provider.")
    else:
        print()
        print("Use the existing MCP first. Do not add a second provider unless the user explicitly chooses to replace or compare providers.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
