#!/usr/bin/env python3
"""Dependency-free validation for a public Creator Workspace plugin package."""

from __future__ import annotations

from pathlib import Path, PurePosixPath
import json
import re
import sys
import xml.etree.ElementTree as ET


root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
errors: list[str] = []
warnings: list[str] = []


def one_line_string(value, field, *, required=True, max_len=None):
    if value is None and not required:
        return
    if not isinstance(value, str):
        errors.append(f"{field} must be a string")
        return
    if required and not value.strip():
        errors.append(f"{field} must not be empty")
    if value != value.strip():
        errors.append(f"{field} has outer whitespace")
    if "\n" in value or "\r" in value:
        errors.append(f"{field} must be one line")
    if max_len is not None and len(value) > max_len:
        errors.append(f"{field} exceeds {max_len} characters")


def safe_package_path(value, field):
    one_line_string(value, field)
    if not isinstance(value, str) or not value:
        return None
    if not value.startswith("./"):
        errors.append(f"{field} must start with ./")
        return None
    rel = value[2:]
    pure = PurePosixPath(rel)
    if pure.is_absolute() or not rel or any(part in ("", ".", "..") for part in pure.parts):
        errors.append(f"{field} is not a safe package-relative path")
        return None
    target = root.joinpath(*pure.parts)
    try:
        target.resolve().relative_to(root)
    except ValueError:
        errors.append(f"{field} escapes the package")
        return None
    if not target.is_file():
        errors.append(f"{field} does not resolve to a regular file: {value}")
        return None
    return target


def validate_square_svg(path: Path, field: str):
    try:
        element = ET.parse(path).getroot()
        if element.tag.rsplit("}", 1)[-1] != "svg":
            raise ValueError("root element is not svg")
        width = float(re.sub(r"[^0-9.+-]", "", element.attrib["width"]))
        height = float(re.sub(r"[^0-9.+-]", "", element.attrib["height"]))
        if width <= 0 or height <= 0 or width != height:
            raise ValueError("dimensions must be positive and square")
    except Exception as exc:
        errors.append(f"{field} is not a valid square SVG: {exc}")


manifest_path = root / ".codex-plugin" / "plugin.json"
manifest = {}
if not manifest_path.is_file():
    errors.append("missing .codex-plugin/plugin.json")
else:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid plugin.json: {exc}")

if manifest:
    one_line_string(manifest.get("name"), "name", max_len=64)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", str(manifest.get("name", ""))):
        errors.append("name must be a lowercase ASCII package identifier")
    if manifest.get("name") != "creator-workbench":
        errors.append("existing Marketplace package identifier must be creator-workbench")
    one_line_string(manifest.get("version"), "version")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(manifest.get("version", ""))):
        errors.append("version is not strict semver")
    one_line_string(manifest.get("description"), "description")
    if manifest.get("skills") != "./skills/":
        errors.append("skills path must be ./skills/")

    author = manifest.get("author")
    if not isinstance(author, dict):
        errors.append("author must be an object")
    else:
        one_line_string(author.get("name"), "author.name", max_len=80)

    interface = manifest.get("interface")
    if not isinstance(interface, dict):
        errors.append("interface must be an object")
        interface = {}
    one_line_string(interface.get("displayName"), "interface.displayName", max_len=30)
    one_line_string(interface.get("shortDescription"), "interface.shortDescription", max_len=30)
    one_line_string(interface.get("developerName"), "interface.developerName", max_len=80)
    one_line_string(interface.get("category"), "interface.category")
    long_description = interface.get("longDescription")
    if not isinstance(long_description, str) or not long_description.strip():
        errors.append("interface.longDescription must be a non-empty string")
    elif len(long_description) > 4000:
        errors.append("interface.longDescription exceeds 4000 characters")

    capabilities = interface.get("capabilities")
    if not isinstance(capabilities, list):
        errors.append("interface.capabilities must be a list")
    else:
        if len(capabilities) > 20:
            errors.append("interface.capabilities has more than 20 items")
        for index, capability in enumerate(capabilities):
            one_line_string(capability, f"interface.capabilities[{index}]", max_len=120)

    prompts = interface.get("defaultPrompt")
    if not isinstance(prompts, list):
        errors.append("interface.defaultPrompt must be a list")
    else:
        if len(prompts) > 3:
            errors.append("interface.defaultPrompt has more than 3 prompts")
        normalized = []
        for index, prompt in enumerate(prompts):
            one_line_string(prompt, f"interface.defaultPrompt[{index}]", max_len=128)
            if isinstance(prompt, str):
                normalized.append(" ".join(prompt.split()).casefold())
        if len(normalized) != len(set(normalized)):
            errors.append("interface.defaultPrompt contains duplicates")

    for field in ("logo", "composerIcon"):
        target = safe_package_path(interface.get(field), f"interface.{field}")
        if target and target.suffix.lower() == ".svg":
            validate_square_svg(target, f"interface.{field}")

codex_dir = root / ".codex-plugin"
if codex_dir.is_dir():
    extras = sorted(entry.name for entry in codex_dir.iterdir() if entry.name != "plugin.json")
    if extras:
        errors.append(f".codex-plugin may contain plugin.json only: {extras}")

skills_dir = root / "skills"
skill_names: set[str] = set()
skill_count = 0
if not skills_dir.is_dir():
    errors.append("missing skills/")
else:
    for child in sorted(skills_dir.iterdir()):
        rel = child.relative_to(root).as_posix()
        if not child.is_dir() or child.is_symlink():
            errors.append(f"non-directory or symlink under skills/: {rel}")
            continue
        skill_path = child / "SKILL.md"
        if not skill_path.is_file() or skill_path.is_symlink():
            errors.append(f"{child.name}: missing regular SKILL.md")
            continue
        skill_count += 1
        try:
            text = skill_path.read_text(encoding="utf-8")
        except Exception as exc:
            errors.append(f"{child.name}: unreadable SKILL.md: {exc}")
            continue
        match = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
        if not match:
            errors.append(f"{child.name}: malformed frontmatter")
            continue
        frontmatter, body = match.groups()
        name_match = re.search(r"(?m)^name:\s*([^\n]+?)\s*$", frontmatter)
        description_match = re.search(r"(?m)^description:\s*([^\n]+?)\s*$", frontmatter)
        if not name_match:
            errors.append(f"{child.name}: missing name")
            skill_name = ""
        else:
            skill_name = name_match.group(1).strip().strip('"\'')
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", skill_name):
                errors.append(f"{child.name}: invalid skill name {skill_name!r}")
            if skill_name != child.name:
                errors.append(f"{child.name}: skill name must match parent directory")
            if skill_name in skill_names:
                errors.append(f"duplicate skill name: {skill_name}")
            skill_names.add(skill_name)
            package_name = str(manifest.get("name", ""))
            if package_name and len(f"{package_name}:{skill_name}") > 64:
                errors.append(f"combined plugin skill identity exceeds 64 characters: {skill_name}")
        if not description_match or not description_match.group(1).strip():
            errors.append(f"{child.name}: missing description")
        if not body.strip():
            errors.append(f"{child.name}: empty instructions")

        agent_path = child / "agents" / "openai.yaml"
        if not agent_path.is_file() or agent_path.is_symlink():
            errors.append(f"{child.name}: missing regular agents/openai.yaml")
            continue
        try:
            agent = agent_path.read_text(encoding="utf-8")
        except Exception as exc:
            errors.append(f"{child.name}: unreadable agents/openai.yaml: {exc}")
            continue
        for key in ("interface:", "display_name:", "short_description:", "policy:", "allow_implicit_invocation:"):
            if key not in agent:
                errors.append(f"{child.name}: agents/openai.yaml missing {key}")
        for key in ("display_name", "short_description", "default_prompt"):
            scalar = re.search(rf"(?m)^\s{{2}}{key}:\s*(.+?)\s*$", agent)
            if key != "default_prompt" and not scalar:
                errors.append(f"{child.name}: agents/openai.yaml missing interface.{key}")
            elif scalar:
                value = scalar.group(1).strip().strip('"\'')
                if not value:
                    errors.append(f"{child.name}: interface.{key} must not be empty")
        try:
            agent_yaml = __import__("yaml").safe_load(agent) or {}
            iface_yaml = agent_yaml.get("interface") or {}
            policy_yaml = agent_yaml.get("policy") or {}
            prompt = iface_yaml.get("default_prompt")
            short = iface_yaml.get("short_description")
            if not isinstance(prompt, str) or f"${skill_name}" not in prompt:
                errors.append(f"{child.name}: interface.default_prompt must mention ${skill_name}")
            if not isinstance(short, str) or not (25 <= len(short) <= 64):
                errors.append(f"{child.name}: interface.short_description must be 25-64 characters")
            allowed_policy_keys = {"allow_implicit_invocation"}
            extra_policy_keys = set(policy_yaml) - allowed_policy_keys
            if extra_policy_keys:
                errors.append(
                    f"{child.name}: policy may contain only allow_implicit_invocation; "
                    f"unexpected keys: {sorted(extra_policy_keys)}"
                )
            if not isinstance(policy_yaml.get("allow_implicit_invocation"), bool):
                errors.append(
                    f"{child.name}: policy.allow_implicit_invocation must be true or false"
                )
        except Exception as exc:
            errors.append(f"{child.name}: invalid agents/openai.yaml: {exc}")
        implicit = re.search(r"(?m)^\s{2}allow_implicit_invocation:\s*(true|false)\s*$", agent)
        if not implicit:
            errors.append(f"{child.name}: allow_implicit_invocation must be boolean")

router = root / "skills" / "creator-router" / "SKILL.md"
if router.is_file():
    router_text = router.read_text(encoding="utf-8")
    if "@Creator Workspace" not in router_text:
        errors.append("creator-router must define direct @Creator Workspace invocation")
    if "workspace-recall" not in router_text:
        errors.append("creator-router must route workspace recall")
    for routed_skill in sorted(skill_names - {"creator-router"}):
        if routed_skill not in router_text:
            errors.append(f"creator-router does not reference bundled skill: {routed_skill}")

report_path = root / "BUILD-REPORT.json"
if report_path.is_file() and manifest:
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        if report.get("plugin") != manifest.get("name"):
            errors.append("BUILD-REPORT plugin does not match manifest name")
        if report.get("version") != manifest.get("version"):
            errors.append("BUILD-REPORT version does not match manifest version")
    except Exception as exc:
        errors.append(f"invalid BUILD-REPORT.json: {exc}")

for path in root.rglob("*"):
    relative = path.relative_to(root).as_posix()
    if path.is_symlink():
        errors.append(f"symlink not allowed: {relative}")
    if path.name in {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}:
        errors.append(f"transient cache not allowed: {relative}")
    if path.is_file() and (path.suffix.lower() in {".pyc", ".pyo"} or path.name in {".DS_Store", "Thumbs.db"}):
        errors.append(f"transient file not allowed: {relative}")
    if path.is_file() and re.search(r"(^|/)\.env($|\.)", relative):
        errors.append(f"secret-shaped file not allowed: {relative}")

result = {
    "ok": not errors,
    "plugin": manifest.get("name") if manifest else None,
    "version": manifest.get("version") if manifest else None,
    "skill_count": skill_count,
    "errors": errors,
    "warnings": warnings,
}
print(json.dumps(result, indent=2))
raise SystemExit(0 if not errors else 1)
