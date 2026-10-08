#!/usr/bin/env python3
"""Author, import, lint, repair, export, and optionally render Mermaid documents."""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import validate_mermaid

VERSION = 2
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*$")
ROOT_KEYS = {"version", "title", "description", "diagrams"}
DIAGRAM_KEYS = {"id", "title", "description", "accessibility", "kind", "data", "source", "styles"}
KINDS = {
    "flowchart",
    "sequence",
    "state",
    "class",
    "er",
    "mindmap",
    "architecture",
    "gantt",
    "timeline",
    "kanban",
    "raw",
}
COMPATIBILITY_PROFILE = "11.16.1"
VERSION_SENSITIVE_KINDS = {"architecture", "timeline", "kanban", "mindmap"}
PORTABLE_METADATA_PREFIX = "%% portable-canonical-v2:"
MAX_DIAGRAMS = 64
MAX_ITEMS = 4000
MAX_STYLES = 256
MAX_STYLE_BYTES = 4096
MAX_TEXT_BYTES = 64 * 1024
MAX_FRAGMENT_BYTES = 16 * 1024
MAX_SOURCE_BYTES = validate_mermaid.MAX_SOURCE_BYTES
MAX_INPUT_BYTES = validate_mermaid.MAX_INPUT_BYTES
MAX_OUTPUT_BYTES = 8 * 1024 * 1024
MAX_RENDER_BYTES = 64 * 1024 * 1024
RENDER_TIMEOUT_SECONDS = 120
VERSION_TIMEOUT_SECONDS = 10
ALLOWED_SYSTEM_SYMLINKS = {Path("/var"), Path("/tmp"), Path("/etc")}
MARKDOWN_SUFFIXES = validate_mermaid.STRICT_MARKDOWN_SUFFIXES
SAFE_STYLE_PROPERTIES = {
    "color",
    "fill",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-opacity",
    "stroke-width",
    "text-decoration",
}

ARCHITECTURE_ICONS = {"cloud", "database", "disk", "internet", "server"}
SEMVER = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$")


class ContractError(ValueError):
    pass


def text(
    value: Any,
    field: str,
    *,
    optional: bool = False,
    single_line: bool = False,
    max_bytes: int = MAX_TEXT_BYTES,
) -> str | None:
    if value is None and optional:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{field} must be a non-empty string")
    if len(value.encode("utf-8")) > max_bytes:
        raise ContractError(f"{field} is too large")
    for character in value:
        category = unicodedata.category(character)
        if single_line and (character in "\n\r" or category in {"Zl", "Zp"}):
            raise ContractError(f"{field} must be a single line")
        if category in {"Cs", "Zl", "Zp"} or (category == "Cc" and character not in "\n\r\t"):
            raise ContractError(f"{field} contains unsupported Unicode/control characters")
    return value


def strict_object(value: Any, allowed: set[str], field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{field} must be an object")
    unknown = set(value) - allowed
    if unknown:
        raise ContractError(f"{field} has unknown fields: {sorted(unknown)}")
    return value


def require_object(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{field} must be an object")
    return value


def ident(value: Any, field: str) -> str:
    result = text(value, field, single_line=True, max_bytes=256)
    assert isinstance(result, str)
    if not IDENT.fullmatch(result):
        raise ContractError(f"{field} must be a stable ASCII identifier")
    return result


def require_bool(value: Any, field: str) -> bool:
    if not isinstance(value, bool):
        raise ContractError(f"{field} must be true or false")
    return value


def require_list(value: Any, field: str, *, maximum: int = MAX_ITEMS) -> list[Any]:
    if not isinstance(value, list):
        raise ContractError(f"{field} must be an array")
    if len(value) > maximum:
        raise ContractError(f"{field} contains too many items")
    return value


def _structured_item_count(value: Any) -> int:
    count = 0
    stack = [value]
    while stack:
        current = stack.pop()
        if isinstance(current, list):
            count += len(current)
            if count > MAX_ITEMS:
                return count
            stack.extend(current)
        elif isinstance(current, dict):
            stack.extend(current.values())
    return count


def _inline(value: Any, field: str) -> str:
    result = text(value, field, max_bytes=MAX_FRAGMENT_BYTES)
    assert isinstance(result, str)
    result = " ".join(result.replace("\t", " ").splitlines())
    result = re.sub(r" {2,}", " ", result).strip()
    if any(token in result for token in ("```", "~~~", "%%")):
        raise ContractError(f"{field} contains a Mermaid grammar delimiter")
    return result


def _encoded_label(value: Any, field: str) -> str:
    """Encode Mermaid-significant inline delimiters as display entities."""

    result = _inline(value, field)
    result = result.replace("&", "&amp;")
    replacements = {
        "\\": "&#92;",
        '"': "&quot;",
        "<": "&lt;",
        ">": "&gt;",
        "[": "&#91;",
        "]": "&#93;",
        "{": "&#123;",
        "}": "&#125;",
        "(": "&#40;",
        ")": "&#41;",
        "|": "&#124;",
        ";": "&#59;",
        ":": "&#58;",
    }
    return "".join(replacements.get(character, character) for character in result)


def quoted_label(value: Any, field: str) -> str:
    return f'"{_encoded_label(value, field)}"'


def _balanced_fragment(value: Any, field: str) -> str:
    result = text(value, field, single_line=True, max_bytes=MAX_FRAGMENT_BYTES)
    assert isinstance(result, str)
    if any(token in result for token in ("```", "~~~", "%%", "{", "}", ";")):
        raise ContractError(f"{field} contains a Mermaid grammar delimiter")
    pairs = {"(": ")", "[": "]", "<": ">"}
    closers = {closing: opening for opening, closing in pairs.items()}
    stack: list[str] = []
    quote: str | None = None
    escaped = False
    for character in result:
        if escaped:
            escaped = False
            continue
        if character == "\\":
            escaped = True
            continue
        if quote is not None:
            if character == quote:
                quote = None
            continue
        if character in {'"', "'"}:
            quote = character
        elif character in pairs:
            stack.append(character)
        elif character in closers:
            if not stack or stack.pop() != closers[character]:
                raise ContractError(f"{field} has unbalanced delimiters")
    if quote is not None or stack:
        raise ContractError(f"{field} has unbalanced delimiters")
    return result


def _validate_style_definition(value: Any, field: str) -> str:
    definition = text(value, field, single_line=True, max_bytes=MAX_STYLE_BYTES)
    assert isinstance(definition, str)
    lowered = definition.casefold()
    if any(
        token in lowered
        for token in (
            ";",
            "{",
            "}",
            "[",
            "]",
            "<",
            ">",
            "```",
            "~~~",
            "%%",
            "url(",
            "@import",
            "javascript:",
            "vbscript:",
            "http:",
            "https:",
            "ftp:",
            "file:",
            "data:",
            "expression(",
            "behavior:",
            "-moz-binding",
            "\\",
        )
    ):
        raise ContractError("style definitions may not contain active content or grammar delimiters")

    depth = 0
    quote: str | None = None
    escaped = False
    pieces: list[str] = []
    start = 0
    for index, character in enumerate(definition):
        if escaped:
            escaped = False
            continue
        if character == "\\":
            escaped = True
            continue
        if quote is not None:
            if character == quote:
                quote = None
            continue
        if character in {'"', "'"}:
            quote = character
        elif character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
            if depth < 0:
                raise ContractError(f"{field} has unbalanced parentheses")
        elif character == "," and depth == 0:
            pieces.append(definition[start:index].strip())
            start = index + 1
    pieces.append(definition[start:].strip())
    if quote is not None or depth:
        raise ContractError(f"{field} has unbalanced quotes or parentheses")
    for piece in pieces:
        if not piece or ":" not in piece:
            raise ContractError(f"{field} must contain comma-separated property:value declarations")
        property_name, property_value = piece.split(":", 1)
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", property_name.strip()):
            raise ContractError(f"{field} contains an invalid style property")
        if property_name.strip().casefold() not in SAFE_STYLE_PROPERTIES:
            raise ContractError(f"{field} contains an unsupported style property")
        if not property_value.strip():
            raise ContractError(f"{field} contains an empty style value")
    return definition


def build_flow(data: dict[str, Any]) -> str:
    strict_object(data, {"direction", "nodes", "edges"}, "flowchart data")
    direction = data.get("direction", "LR")
    if direction not in {"LR", "RL", "TB", "BT"}:
        raise ContractError("flowchart direction must be LR, RL, TB, or BT")
    nodes = require_list(data.get("nodes"), "flowchart nodes")
    edges = require_list(data.get("edges"), "flowchart edges")
    seen: set[str] = set()
    lines = [f"flowchart {direction}"]
    for index, raw in enumerate(nodes):
        node = strict_object(raw, {"id", "label", "class"}, f"nodes[{index}]")
        node_id = ident(node.get("id"), f"nodes[{index}].id")
        if node_id in seen:
            raise ContractError(f"duplicate node id: {node_id}")
        seen.add(node_id)
        lines.append(f"  {node_id}[{quoted_label(node.get('label'), f'nodes[{index}].label')}]")
        if node.get("class") is not None:
            lines.append(f"  class {node_id} {ident(node['class'], f'nodes[{index}].class')}")
    for index, raw in enumerate(edges):
        edge = strict_object(raw, {"from", "to", "label", "arrow"}, f"edges[{index}]")
        start = ident(edge.get("from"), f"edges[{index}].from")
        end = ident(edge.get("to"), f"edges[{index}].to")
        if start not in seen or end not in seen:
            raise ContractError(f"edge references undeclared node: {start} -> {end}")
        arrow = edge.get("arrow", "-->")
        if arrow not in {"-->", "---", "-.->", "==>"}:
            raise ContractError(f"unsupported edge arrow: {arrow}")
        edge_label = edge.get("label")
        middle = f"{arrow}|{_encoded_label(edge_label, f'edges[{index}].label')}|" if edge_label is not None else arrow
        lines.append(f"  {start} {middle} {end}")
    return "\n".join(lines) + "\n"


def build_sequence(data: dict[str, Any]) -> str:
    strict_object(data, {"participants", "messages"}, "sequence data")
    participants = require_list(data.get("participants"), "participants")
    messages = require_list(data.get("messages"), "messages")
    seen: set[str] = set()
    lines = ["sequenceDiagram"]
    for index, raw in enumerate(participants):
        item = strict_object(raw, {"id", "label", "actor"}, f"participants[{index}]")
        participant_id = ident(item.get("id"), f"participants[{index}].id")
        if participant_id in seen:
            raise ContractError(f"duplicate participant id: {participant_id}")
        seen.add(participant_id)
        actor = item.get("actor", False)
        if "actor" in item:
            actor = require_bool(actor, f"participants[{index}].actor")
        keyword = "actor" if actor else "participant"
        lines.append(
            f"  {keyword} {participant_id} as {_encoded_label(item.get('label'), f'participants[{index}].label')}"
        )
    for index, raw in enumerate(messages):
        item = strict_object(raw, {"from", "to", "text", "kind"}, f"messages[{index}]")
        start = ident(item.get("from"), f"messages[{index}].from")
        end = ident(item.get("to"), f"messages[{index}].to")
        if start not in seen or end not in seen:
            raise ContractError("message references undeclared participant")
        kind = item.get("kind", "sync")
        arrow = {"sync": "->>", "async": "-)", "reply": "-->>"}.get(kind)
        if arrow is None:
            raise ContractError(f"unsupported message kind: {kind}")
        message = _encoded_label(item.get("text"), f"messages[{index}].text")
        lines.append(f"  {start}{arrow}{end}: {message}")
    return "\n".join(lines) + "\n"


def build_state(data: dict[str, Any]) -> str:
    strict_object(data, {"states", "transitions", "initial"}, "state data")
    states = require_list(data.get("states"), "states")
    transitions = require_list(data.get("transitions"), "transitions")
    seen: set[str] = set()
    lines = ["stateDiagram-v2"]
    for index, raw in enumerate(states):
        item = strict_object(raw, {"id", "label"}, f"states[{index}]")
        state_id = ident(item.get("id"), f"states[{index}].id")
        if state_id in seen:
            raise ContractError(f"duplicate state: {state_id}")
        seen.add(state_id)
        lines.append(f"  state {quoted_label(item.get('label'), f'states[{index}].label')} as {state_id}")
    initial = ident(data.get("initial"), "initial")
    if initial not in seen:
        raise ContractError("initial references an undeclared state")
    lines.append(f"  [*] --> {initial}")
    for index, raw in enumerate(transitions):
        item = strict_object(raw, {"from", "to", "label"}, f"transitions[{index}]")
        start = ident(item.get("from"), f"transitions[{index}].from")
        end = ident(item.get("to"), f"transitions[{index}].to")
        if start not in seen or end not in seen:
            raise ContractError("transition references undeclared state")
        suffix = f": {_encoded_label(item['label'], f'transitions[{index}].label')}" if item.get("label") is not None else ""
        lines.append(f"  {start} --> {end}{suffix}")
    return "\n".join(lines) + "\n"


def build_class(data: dict[str, Any]) -> str:
    strict_object(data, {"classes", "relations"}, "class data")
    classes = require_list(data.get("classes"), "classes")
    relations = require_list(data.get("relations"), "relations")
    seen: set[str] = set()
    lines = ["classDiagram"]
    for index, raw in enumerate(classes):
        item = strict_object(raw, {"id", "members"}, f"classes[{index}]")
        class_id = ident(item.get("id"), f"classes[{index}].id")
        if class_id in seen:
            raise ContractError(f"duplicate class: {class_id}")
        seen.add(class_id)
        members = require_list(item.get("members", []), f"classes[{index}].members")
        lines.append(f"  class {class_id} {{")
        for member_index, member in enumerate(members):
            lines.append(f"    {_balanced_fragment(member, f'classes[{index}].members[{member_index}]')}")
        lines.append("  }")
    arrows = {"inheritance": "<|--", "composition": "*--", "aggregation": "o--", "association": "-->"}
    seen_relations:set[tuple[str,str,str,str|None]]=set()
    for index, raw in enumerate(relations):
        item = strict_object(raw, {"from", "to", "kind", "label"}, f"relations[{index}]")
        start = ident(item.get("from"), f"relations[{index}].from")
        end = ident(item.get("to"), f"relations[{index}].to")
        if start not in seen or end not in seen:
            raise ContractError("relation references undeclared class")
        arrow = arrows.get(item.get("kind", "association"))
        if arrow is None:
            raise ContractError("unsupported class relation")
        relation_key=(start,end,str(item.get("kind","association")),item.get("label"))
        if relation_key in seen_relations: raise ContractError("duplicate class relation")
        seen_relations.add(relation_key)
        suffix = f" : {_encoded_label(item['label'], f'relations[{index}].label')}" if item.get("label") is not None else ""
        lines.append(f"  {start} {arrow} {end}{suffix}")
    return "\n".join(lines) + "\n"


def build_er(data: dict[str, Any]) -> str:
    strict_object(data, {"entities", "relationships"}, "ER data")
    entities = require_list(data.get("entities"), "entities")
    relationships = require_list(data.get("relationships"), "relationships")
    seen: set[str] = set()
    lines = ["erDiagram"]
    for index, raw in enumerate(entities):
        item = strict_object(raw, {"id", "attributes"}, f"entities[{index}]")
        entity_id = ident(item.get("id"), f"entities[{index}].id")
        if entity_id in seen:
            raise ContractError(f"duplicate entity: {entity_id}")
        seen.add(entity_id)
        lines.append(f"  {entity_id} {{")
        attributes = require_list(item.get("attributes", []), f"entities[{index}].attributes")
        for attribute_index, attribute in enumerate(attributes):
            lines.append(f"    {_balanced_fragment(attribute, f'entities[{index}].attributes[{attribute_index}]')}")
        lines.append("  }")
    cardinality_pattern = re.compile(
        r"^(?:\|\||o\||\|o|\}\||\|\{|o\{|\}o)--(?:\|\||o\||\|o|\}\||\|\{|o\{|\}o)$"
    )
    for index, raw in enumerate(relationships):
        item = strict_object(raw, {"from", "to", "cardinality", "label"}, f"relationships[{index}]")
        start = ident(item.get("from"), f"relationships[{index}].from")
        end = ident(item.get("to"), f"relationships[{index}].to")
        if start not in seen or end not in seen:
            raise ContractError("relationship references undeclared entity")
        cardinality = text(
            item.get("cardinality"), f"relationships[{index}].cardinality", single_line=True, max_bytes=32
        )
        if not cardinality_pattern.fullmatch(str(cardinality)):
            raise ContractError("malformed ER cardinality")
        relationship_label = quoted_label(item.get("label"), f"relationships[{index}].label")
        lines.append(f"  {start} {cardinality} {end} : {relationship_label}")
    return "\n".join(lines) + "\n"


def build_mindmap(data: dict[str, Any]) -> str:
    strict_object(data, {"root"}, "mindmap data")
    lines = ["mindmap"]
    count = 0

    def walk(raw: Any, depth: int) -> None:
        nonlocal count
        item = strict_object(raw, {"text", "children"}, "mindmap node")
        count += 1
        if count > MAX_ITEMS or depth > 64:
            raise ContractError("mindmap exceeds structural limits")
        value = _encoded_label(item.get("text"), "mindmap text")
        lines.append(f"{'  ' * depth}root({value})" if depth == 1 else f"{'  ' * depth}{value}")
        for child in require_list(item.get("children", []), "mindmap children"):
            walk(child, depth + 1)

    walk(data.get("root"), 1)
    return "\n".join(lines) + "\n"


def _architecture_icon(value: Any, field: str) -> str:
    icon = text(value, field, single_line=True, max_bytes=32)
    assert isinstance(icon, str)
    if icon not in ARCHITECTURE_ICONS:
        raise ContractError(f"{field} must be one of {sorted(ARCHITECTURE_ICONS)}")
    return icon


def build_architecture(data: dict[str, Any]) -> str:
    strict_object(data, {"groups", "services", "edges"}, "architecture data")
    groups = require_list(data.get("groups", []), "architecture groups")
    services = require_list(data.get("services"), "architecture services")
    edges = require_list(data.get("edges", []), "architecture edges")
    if not services:
        raise ContractError("architecture services must contain at least one service")
    group_ids: set[str] = set()
    service_ids: set[str] = set()
    lines = ["architecture-beta"]
    for index, raw in enumerate(groups):
        item = strict_object(raw, {"id", "label", "icon", "parent"}, f"groups[{index}]")
        group_id = ident(item.get("id"), f"groups[{index}].id")
        if group_id in group_ids:
            raise ContractError(f"duplicate architecture group: {group_id}")
        parent = item.get("parent")
        if parent is not None:
            parent = ident(parent, f"groups[{index}].parent")
            if parent not in group_ids:
                raise ContractError("architecture group parents must be declared earlier")
        group_ids.add(group_id)
        icon = _architecture_icon(item.get("icon", "cloud"), f"groups[{index}].icon")
        suffix = f" in {parent}" if parent else ""
        lines.append(
            f"  group {group_id}({icon})[{_encoded_label(item.get('label'), f'groups[{index}].label')}]{suffix}"
        )
    for index, raw in enumerate(services):
        item = strict_object(raw, {"id", "label", "icon", "group"}, f"services[{index}]")
        service_id = ident(item.get("id"), f"services[{index}].id")
        if service_id in service_ids or service_id in group_ids:
            raise ContractError(f"duplicate architecture identifier: {service_id}")
        group = item.get("group")
        if group is not None:
            group = ident(group, f"services[{index}].group")
            if group not in group_ids:
                raise ContractError(f"service references undeclared group: {group}")
        service_ids.add(service_id)
        icon = _architecture_icon(item.get("icon", "server"), f"services[{index}].icon")
        suffix = f" in {group}" if group else ""
        lines.append(
            f"  service {service_id}({icon})[{_encoded_label(item.get('label'), f'services[{index}].label')}]{suffix}"
        )
    for index, raw in enumerate(edges):
        item = strict_object(
            raw, {"from", "to", "label", "fromSide", "toSide"}, f"edges[{index}]"
        )
        start = ident(item.get("from"), f"edges[{index}].from")
        end = ident(item.get("to"), f"edges[{index}].to")
        if start not in service_ids or end not in service_ids:
            raise ContractError("architecture edges must connect declared services")
        start_side = item.get("fromSide", "R")
        end_side = item.get("toSide", "L")
        if start_side not in {"L", "R", "T", "B"} or end_side not in {"L", "R", "T", "B"}:
            raise ContractError("architecture edge sides must be L, R, T, or B")
        # Mermaid's architecture grammar has directional edges but no edge-label
        # production in the pinned 11.16.1 profile. Retain any label in canonical
        # metadata and structural previews without emitting invalid source.
        lines.append(f"  {start}:{start_side} --> {end_side}:{end}")
    return "\n".join(lines) + "\n"


def _date_token(value: Any, field: str) -> str:
    result = text(value, field, single_line=True, max_bytes=64)
    assert isinstance(result, str)
    if not re.fullmatch(r"(?:\d{4}-\d{2}-\d{2}|\d+(?:\.\d+)?(?:ms|s|m|h|d|w)|after [A-Za-z_][A-Za-z0-9_-]*)", result):
        raise ContractError(f"{field} must be an ISO date, duration, or 'after ID'")
    return result


def build_gantt(data: dict[str, Any]) -> str:
    strict_object(data, {"dateFormat", "axisFormat", "sections"}, "gantt data")
    date_format = text(data.get("dateFormat", "YYYY-MM-DD"), "gantt dateFormat", single_line=True, max_bytes=64)
    axis_format = text(data.get("axisFormat", "%Y-%m-%d"), "gantt axisFormat", single_line=True, max_bytes=64)
    assert isinstance(date_format, str) and isinstance(axis_format, str)
    if not re.fullmatch(r"[A-Za-z0-9%_.:/ -]+", date_format) or not re.fullmatch(r"[A-Za-z0-9%_.:/ -]+", axis_format):
        raise ContractError("gantt date formats contain unsupported characters")
    sections = require_list(data.get("sections"), "gantt sections")
    if not sections:
        raise ContractError("gantt sections must contain at least one section")
    lines = ["gantt", f"  dateFormat {date_format}", f"  axisFormat {axis_format}"]
    seen: set[str] = set()
    for section_index, raw_section in enumerate(sections):
        section = strict_object(raw_section, {"title", "tasks"}, f"sections[{section_index}]")
        lines.append(f"  section {_encoded_label(section.get('title'), f'sections[{section_index}].title')}")
        tasks = require_list(section.get("tasks"), f"sections[{section_index}].tasks")
        if not tasks:
            raise ContractError(f"sections[{section_index}].tasks must contain at least one task")
        for task_index, raw_task in enumerate(tasks):
            field = f"sections[{section_index}].tasks[{task_index}]"
            task = strict_object(raw_task, {"id", "label", "start", "end", "status"}, field)
            task_id = ident(task.get("id"), f"{field}.id")
            if task_id in seen:
                raise ContractError(f"duplicate Gantt task id: {task_id}")
            start = _date_token(task.get("start"), f"{field}.start")
            end = _date_token(task.get("end"), f"{field}.end")
            for token_name,token_value in (("start",start),("end",end)):
                if token_value.startswith("after "):
                    dependency=token_value[6:]
                    if dependency not in seen:
                        raise ContractError(f"{field}.{token_name} references a task that was not declared earlier: {dependency}")
            status = task.get("status")
            if status is not None and status not in {"done", "active", "crit", "milestone"}:
                raise ContractError(f"{field}.status is unsupported")
            qualifiers = f"{status}, " if status else ""
            label = _encoded_label(task.get("label"), f"{field}.label")
            lines.append(f"    {label} :{qualifiers}{task_id}, {start}, {end}")
            seen.add(task_id)
    return "\n".join(lines) + "\n"


def build_timeline(data: dict[str, Any]) -> str:
    strict_object(data, {"sections"}, "timeline data")
    sections = require_list(data.get("sections"), "timeline sections")
    if not sections:
        raise ContractError("timeline sections must contain at least one section")
    lines = ["timeline"]
    for section_index, raw_section in enumerate(sections):
        section = strict_object(raw_section, {"title", "events"}, f"sections[{section_index}]")
        lines.append(f"  section {_encoded_label(section.get('title'), f'sections[{section_index}].title')}")
        events = require_list(section.get("events"), f"sections[{section_index}].events")
        if not events:
            raise ContractError(f"sections[{section_index}].events must contain at least one event")
        for event_index, raw_event in enumerate(events):
            field = f"sections[{section_index}].events[{event_index}]"
            event = strict_object(raw_event, {"time", "text"}, field)
            time_value = _encoded_label(event.get("time"), f"{field}.time")
            event_text = _encoded_label(event.get("text"), f"{field}.text")
            lines.append(f"    {time_value} : {event_text}")
    return "\n".join(lines) + "\n"


def build_kanban(data: dict[str, Any]) -> str:
    strict_object(data, {"columns"}, "kanban data")
    columns = require_list(data.get("columns"), "kanban columns")
    if not columns:
        raise ContractError("kanban columns must contain at least one column")
    lines = ["kanban"]
    seen: set[str] = set()
    for column_index, raw_column in enumerate(columns):
        column = strict_object(raw_column, {"id", "label", "items"}, f"columns[{column_index}]")
        column_id = ident(column.get("id"), f"columns[{column_index}].id")
        if column_id in seen:
            raise ContractError(f"duplicate Kanban identifier: {column_id}")
        seen.add(column_id)
        lines.append(
            f"  {column_id}[{_encoded_label(column.get('label'), f'columns[{column_index}].label')}]"
        )
        for item_index, raw_item in enumerate(require_list(column.get("items"), f"columns[{column_index}].items")):
            field = f"columns[{column_index}].items[{item_index}]"
            item = strict_object(raw_item, {"id", "label"}, field)
            item_id = ident(item.get("id"), f"{field}.id")
            if item_id in seen:
                raise ContractError(f"duplicate Kanban identifier: {item_id}")
            seen.add(item_id)
            lines.append(f"    {item_id}[{_encoded_label(item.get('label'), f'{field}.label')}]" )
    return "\n".join(lines) + "\n"


BUILDERS = {
    "flowchart": build_flow,
    "sequence": build_sequence,
    "state": build_state,
    "class": build_class,
    "er": build_er,
    "mindmap": build_mindmap,
    "architecture": build_architecture,
    "gantt": build_gantt,
    "timeline": build_timeline,
    "kanban": build_kanban,
}


def _insert_accessibility(source: str, title_value: str, accessibility: str | None) -> str:
    if accessibility is None:
        return source
    lines = source.rstrip("\n").split("\n")
    if not lines:
        raise ContractError("cannot attach accessibility text to an empty diagram")
    safe_title = _encoded_label(title_value, "diagram.title")
    safe_description = _encoded_label(accessibility, "diagram.accessibility")
    lines[1:1] = [f"  accTitle: {safe_title}", f"  accDescr: {safe_description}"]
    return "\n".join(lines) + "\n"


def _append_portable_metadata(source: str, item: dict[str, Any]) -> str:
    source = source.rstrip("\n") + "\n"
    payload = {
        "version": 1,
        "id": item["id"],
        "title": item["title"],
        "description": item.get("description"),
        "accessibility": item.get("accessibility"),
        "kind": item["kind"],
        "data": item["data"],
        "styles": item["styles"],
        "sourceSha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    ).decode("ascii").rstrip("=")
    return f"{source}{PORTABLE_METADATA_PREFIX}{encoded}\n"


def _target_version_warnings(document: dict[str, Any], target_version: str) -> list[str]:
    if not SEMVER.fullmatch(target_version):
        raise ContractError("--target-version must be a semantic version such as 11.16.1")
    warnings: list[str] = []
    sensitive = sorted(
        diagram["kind"] for diagram in document["diagrams"] if diagram["kind"] in VERSION_SENSITIVE_KINDS
    )
    if sensitive and target_version != COMPATIBILITY_PROFILE:
        warnings.append(
            "version-sensitive Mermaid families "
            + ", ".join(sorted(set(sensitive)))
            + f" were authored for compatibility profile {COMPATIBILITY_PROFILE}, not {target_version}"
        )
    return warnings


def _representation_losses(document: dict[str, Any]) -> list[str]:
    losses: list[str] = []
    if any(
        edge.get("label") is not None
        for diagram in document["diagrams"]
        if diagram["kind"] == "architecture"
        for edge in diagram["data"].get("edges", [])
    ):
        losses.append(
            "architecture edge labels remain in canonical metadata and structural previews but are not emitted into Mermaid 11.16.1 source"
        )
    return losses


def _semantic_diagnostics(document:dict[str,Any])->list[dict[str,str]]:
    diagnostics:list[dict[str,str]]=[]
    for diagram in document["diagrams"]:
        data=diagram.get("data") or {}
        if diagram["kind"]=="state":
            reachable={data["initial"]}; changed=True
            while changed:
                changed=False
                for transition in data["transitions"]:
                    if transition["from"] in reachable and transition["to"] not in reachable:
                        reachable.add(transition["to"]); changed=True
            for state in data["states"]:
                if state["id"] not in reachable:
                    diagnostics.append({
                        "code":"mermaid.unreachable-state",
                        "severity":"warning",
                        "path":f"$.diagrams[{diagram['id']}].data.states[{state['id']}]",
                        "message":f"state {state['id']} is unreachable from initial state {data['initial']}",
                    })
        elif diagram["kind"]=="class":
            by_pair:dict[tuple[str,str],set[str]]={}
            for relation in data["relations"]:
                pair=tuple(sorted((relation["from"],relation["to"])))
                by_pair.setdefault(pair,set()).add(relation.get("kind","association"))
            for pair,kinds in sorted(by_pair.items()):
                if len(kinds)>1:
                    diagnostics.append({
                        "code":"mermaid.contradictory-class-relations",
                        "severity":"warning",
                        "path":f"$.diagrams[{diagram['id']}].data.relations",
                        "message":f"classes {pair[0]} and {pair[1]} have multiple relation kinds: {', '.join(sorted(kinds))}",
                    })
    return diagnostics


def normalize_document(payload: Any) -> dict[str, Any]:
    root = strict_object(payload, ROOT_KEYS, "document")
    if root.get("version") != VERSION:
        raise ContractError(f"version must be {VERSION}")
    title_value = text(root.get("title"), "title", single_line=True)
    description = text(root.get("description"), "description", optional=True)
    diagrams = require_list(root.get("diagrams"), "diagrams", maximum=MAX_DIAGRAMS)
    if not 1 <= len(diagrams) <= MAX_DIAGRAMS:
        raise ContractError(f"diagrams must contain 1-{MAX_DIAGRAMS} entries")
    seen: set[str] = set()
    normalized: list[dict[str, Any]] = []
    total_items = 0
    for index, raw in enumerate(diagrams):
        item = strict_object(raw, DIAGRAM_KEYS, f"diagrams[{index}]")
        diagram_id = ident(item.get("id"), f"diagrams[{index}].id")
        if diagram_id in seen:
            raise ContractError(f"duplicate diagram id: {diagram_id}")
        seen.add(diagram_id)
        kind = item.get("kind")
        if kind not in KINDS:
            raise ContractError(f"unsupported diagram kind: {kind}")
        source = item.get("source")
        data = item.get("data")
        item_title = text(item.get("title"), f"diagrams[{index}].title", single_line=True)
        item_description = text(item.get("description"), f"diagrams[{index}].description", optional=True)
        item_accessibility = text(item.get("accessibility"), f"diagrams[{index}].accessibility", optional=True)
        assert isinstance(item_title, str)
        if kind == "raw":
            source = text(source, f"diagrams[{index}].source", max_bytes=MAX_SOURCE_BYTES)
            if "data" in item:
                raise ContractError("raw diagrams may not contain data")
        else:
            if "source" in item:
                raise ContractError("structured diagrams may not contain source")
            data_object = require_object(data, f"diagrams[{index}].data")
            total_items += _structured_item_count(data_object)
            if total_items > MAX_ITEMS:
                raise ContractError(f"document contains more than {MAX_ITEMS} structured items")
            source = BUILDERS[kind](data_object)
        assert isinstance(source, str)

        styles = require_list(item.get("styles", []), f"diagrams[{index}].styles", maximum=MAX_STYLES)
        total_items += len(styles)
        if total_items > MAX_ITEMS:
            raise ContractError(f"document contains more than {MAX_ITEMS} structured items")
        if styles and kind != "flowchart":
            raise ContractError("style classes are supported only for structured flowcharts")
        normalized_styles: list[dict[str, str]] = []
        style_names: set[str] = set()
        for style_index, raw_style in enumerate(styles):
            style = strict_object(raw_style, {"name", "definition"}, f"styles[{style_index}]")
            style_name = ident(style.get("name"), f"styles[{style_index}].name")
            if style_name in style_names:
                raise ContractError(f"duplicate style name: {style_name}")
            style_names.add(style_name)
            definition = _validate_style_definition(
                style.get("definition"), f"styles[{style_index}].definition"
            )
            normalized_styles.append({"name": style_name, "definition": definition})
            source += f"classDef {style_name} {definition}\n"

        source = source.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
        normalized_item: dict[str, Any] = {
            "id": diagram_id,
            "title": item_title,
            "description": item_description,
            "accessibility": item_accessibility,
            "kind": kind,
            "data": data if kind != "raw" else None,
            "source": source,
            "styles": normalized_styles,
        }
        if kind != "raw":
            source = _insert_accessibility(source, item_title, item_accessibility)
            normalized_item["source"] = source
            source = _append_portable_metadata(source, normalized_item)
            normalized_item["source"] = source
        if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
            raise ContractError(f"diagrams[{index}].source exceeds 2 MiB")
        errors, warnings = validate_mermaid.check_source(source)
        if errors:
            raise ContractError("invalid Mermaid source: " + "; ".join(errors))
        normalized_item["warnings"] = warnings
        normalized.append(normalized_item)
    return {"version": VERSION, "title": title_value, "description": description, "diagrams": normalized}


def _markdown_heading(value: str) -> str:
    return value.replace("\\", "\\\\").replace("#", "\\#")


def _check_markdown_metadata(value: str | None, field: str) -> None:
    if value is None:
        return
    for line in value.splitlines():
        if re.match(r"^[ \t]*(?:`{3,}|~{3,})", line):
            raise ContractError(f"{field} may not contain a fenced-code delimiter")
    if re.search(r"<\s*(?:!--|/?\s*[A-Za-z][^>]*)>", value):
        raise ContractError(f"{field} may not contain raw HTML")
    if re.search(r"!\[[^\]]*\]\(\s*(?:https?|data|file):", value, re.IGNORECASE):
        raise ContractError(f"{field} may not contain an external image")


def markdown(document: dict[str, Any]) -> str:
    _check_markdown_metadata(str(document["title"]), "title")
    _check_markdown_metadata(document.get("description"), "description")
    lines = [f"# {_markdown_heading(str(document['title']))}"]
    if document.get("description"):
        lines += ["", str(document["description"])]
    for diagram in document["diagrams"]:
        _check_markdown_metadata(str(diagram["title"]), "diagram.title")
        _check_markdown_metadata(diagram.get("description"), "diagram.description")
        lines += ["", f"## {_markdown_heading(str(diagram['title']))}"]
        if diagram.get("description"):
            lines += ["", str(diagram["description"])]
        lines += [
            "",
            f"<!-- mermaid:id={diagram['id']} -->",
            "```mermaid",
            diagram["source"].rstrip(),
            "```",
        ]
    return "\n".join(lines) + "\n"


def _portable_item_from_source(source: str) -> dict[str, Any] | None:
    normalized_source = source.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
    lines = normalized_source.splitlines(keepends=True)
    marker_indexes = [index for index, line in enumerate(lines) if line.startswith(PORTABLE_METADATA_PREFIX)]
    if not marker_indexes:
        return None
    if marker_indexes != [len(lines) - 1]:
        raise ContractError("portable canonical metadata must appear exactly once at the end of a diagram")
    encoded = lines[-1][len(PORTABLE_METADATA_PREFIX) :].strip()
    if not encoded or not re.fullmatch(r"[A-Za-z0-9_-]+", encoded):
        raise ContractError("portable canonical metadata is malformed")
    try:
        padding = "=" * ((4 - len(encoded) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded + padding).decode("utf-8"))
    except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
        raise ContractError("portable canonical metadata is malformed") from exc
    payload = strict_object(
        payload,
        {"version", "id", "title", "description", "accessibility", "kind", "data", "styles", "sourceSha256"},
        "portable canonical metadata",
    )
    if payload.get("version") != 1:
        raise ContractError("unsupported portable canonical metadata version")
    source_hash = payload.get("sourceSha256")
    if not isinstance(source_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", source_hash):
        raise ContractError("portable canonical metadata has an invalid source hash")
    body = "".join(lines[:-1])
    if hashlib.sha256(body.encode("utf-8")).hexdigest() != source_hash:
        raise ContractError("portable canonical metadata does not match the Mermaid source")
    item = {
        key: payload.get(key)
        for key in ("id", "title", "description", "accessibility", "kind", "data", "styles")
    }
    rebuilt = normalize_document(
        {"version": VERSION, "title": "Imported Mermaid", "description": None, "diagrams": [item]}
    )["diagrams"][0]["source"]
    if rebuilt != normalized_source:
        raise ContractError("portable canonical metadata is inconsistent with the Mermaid source")
    return item


def import_source(path: Path) -> dict[str, Any]:
    contents = read_input(path)
    try:
        blocks, _ = validate_mermaid.extract_mermaid_text(
            contents, markdown=path.suffix.lower() in MARKDOWN_SUFFIXES
        )
    except ValueError as exc:
        raise ContractError(str(exc)) from exc
    diagrams = []
    for index, raw_source in enumerate(blocks, 1):
        source = raw_source.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
        errors, _ = validate_mermaid.check_source(source)
        if errors:
            raise ContractError(f"block {index}: " + "; ".join(errors))
        portable = _portable_item_from_source(source)
        if portable is not None:
            diagrams.append(portable)
        else:
            diagrams.append(
                {
                    "id": f"diagram_{index}",
                    "title": f"Diagram {index}",
                    "description": None,
                    "accessibility": None,
                    "kind": "raw",
                    "source": source,
                    "styles": [],
                }
            )
    return normalize_document(
        {"version": VERSION, "title": path.stem, "description": None, "diagrams": diagrams}
    )


def reject_symlink_ancestors(path: Path) -> None:
    current = path
    while current.parent != current:
        if current.is_symlink() and current not in ALLOWED_SYSTEM_SYMLINKS:
            raise ContractError(f"symbolic-link path component is not allowed: {current}")
        current = current.parent


def output_path(argument: str) -> Path:
    raw = Path(argument).expanduser()
    if ".." in raw.parts:
        raise ContractError("output path traversal is not allowed")
    return raw.absolute()


def input_path(argument: str, field: str = "input") -> Path:
    raw = Path(argument).expanduser()
    if ".." in raw.parts:
        raise ContractError(f"{field} path traversal is not allowed")
    return raw.absolute()


def safe_output(path: Path, overwrite: bool) -> None:
    if path.is_symlink():
        raise ContractError("unsafe output path")
    reject_symlink_ancestors(path.parent)
    if path.exists():
        if not overwrite:
            raise ContractError("output exists; pass --overwrite")
        if not path.is_file():
            raise ContractError("output must be a regular file")


def read_input(path: Path) -> str:
    if path.is_symlink():
        raise ContractError("input must not be a symbolic link")
    reject_symlink_ancestors(path.parent)
    if not path.is_file():
        raise ContractError("input must be a regular file")
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ContractError("input exceeds 8 MiB")
    with path.open("r", encoding="utf-8", newline="") as handle:
        return handle.read()


def _ensure_output_size(body: str) -> None:
    if len(body.encode("utf-8")) > MAX_OUTPUT_BYTES:
        raise ContractError("output exceeds 8 MiB")


def _write_staged(path: Path, body: str) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(body)
        handle.flush()
        os.fsync(handle.fileno())


def atomic_write(path: Path, body: str, overwrite: bool) -> None:
    _ensure_output_size(body)
    safe_output(path, overwrite)
    path.parent.mkdir(parents=True, exist_ok=True)
    reject_symlink_ancestors(path.parent)
    descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temp = Path(temp_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def _transactional_install(staged: list[tuple[Path, Path]], overwrite: bool) -> None:
    for _, destination in staged:
        safe_output(destination, overwrite)
    backups: dict[Path, Path] = {}
    installed: list[Path] = []
    try:
        for _, destination in staged:
            if destination.exists():
                descriptor, backup_name = tempfile.mkstemp(
                    prefix=f".{destination.name}.backup.", dir=destination.parent
                )
                os.close(descriptor)
                backup = Path(backup_name)
                backup.unlink()
                os.replace(destination, backup)
                backups[destination] = backup
        for staged_path, destination in staged:
            os.replace(staged_path, destination)
            installed.append(destination)
    except OSError as exc:
        rollback_errors: list[str] = []
        for destination in reversed(installed):
            try:
                destination.unlink(missing_ok=True)
            except OSError as rollback_exc:
                rollback_errors.append(str(rollback_exc))
        for destination, backup in backups.items():
            try:
                if backup.exists():
                    os.replace(backup, destination)
            except OSError as rollback_exc:
                rollback_errors.append(str(rollback_exc))
        if rollback_errors:
            raise ContractError(
                f"output transaction failed and rollback was incomplete: {exc}; {'; '.join(rollback_errors)}"
            ) from exc
        raise ContractError(f"output transaction failed: {exc}") from exc
    finally:
        for backup in backups.values():
            backup.unlink(missing_ok=True)


def public_json(document: dict[str, Any]) -> str:
    clean = {
        "version": VERSION,
        "title": document["title"],
        "description": document.get("description"),
        "diagrams": [],
    }
    for diagram in document["diagrams"]:
        item = {
            key: diagram.get(key)
            for key in ("id", "title", "description", "accessibility", "kind", "styles")
        }
        if diagram["kind"] == "raw":
            item["source"] = diagram["source"]
        else:
            item["data"] = diagram["data"]
        clean["diagrams"].append(item)
    body = json.dumps(clean, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    _ensure_output_size(body)
    return body


def _renderer_details(mode: str) -> tuple[dict[str, str] | None, list[str]]:
    executable = shutil.which("mmdc")
    if not executable:
        if mode == "required":
            raise ContractError("mmdc is required but not installed")
        return None, ["mmdc not installed; source-only output produced"]
    resolved = str(Path(executable).resolve())
    try:
        completed = subprocess.run(
            [resolved, "--version"],
            capture_output=True,
            text=True,
            timeout=VERSION_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        if mode == "required":
            raise ContractError(f"cannot determine mmdc version: {exc}") from exc
        return None, [f"mmdc version could not be determined; source-only output produced: {exc}"]
    version = (completed.stdout.strip() or completed.stderr.strip()).splitlines()
    if completed.returncode or not version:
        detail = completed.stderr.strip() or f"exit status {completed.returncode}"
        if mode == "required":
            raise ContractError(f"cannot determine mmdc version: {detail}")
        return None, [f"mmdc version could not be determined; source-only output produced: {detail}"]
    version_text=version[0][:512]
    version_match=re.search(r"(?<![0-9])([0-9]+\.[0-9]+\.[0-9]+)(?![0-9])",version_text)
    if version_match is None or version_match.group(1)!=COMPATIBILITY_PROFILE:
        detail=f"mmdc {version_text!r} is incompatible with pinned profile {COMPATIBILITY_PROFILE}"
        if mode=="required": raise ContractError(detail)
        return None,[detail+"; source-only output produced"]
    return {"executable": resolved, "version": version_text}, []


def _validate_rendered_artifact(path:Path,format_name:str)->None:
    if format_name=="svg":
        safe=_safe_rendered_svg(path.read_text(encoding="utf-8"))
        with path.open("w",encoding="utf-8",newline="") as handle: handle.write(safe)
        return
    data=path.read_bytes()
    if format_name=="png":
        if len(data)<24 or not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ContractError("mmdc did not produce a valid PNG signature")
        return
    if format_name=="pdf":
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
            raise ContractError("mmdc did not produce a valid PDF envelope")
        decoded_names=re.sub(
            rb"#([0-9A-Fa-f]{2})",
            lambda match: bytes([int(match.group(1),16)]),
            data,
        )
        if re.search(
            rb"/(?:AA|EmbeddedFile|GoToR|ImportData|JavaScript|JS|Launch|OpenAction|RichMedia|SubmitForm|URI)\b",
            decoded_names,
        ):
            raise ContractError("mmdc produced PDF with active content")
        return
    raise ContractError("unsupported rendered artifact format")


def write_with_optional_render(
    output: Path,
    body: str,
    *,
    mode: str,
    render_format: str,
    overwrite: bool,
    renderable: bool,
) -> dict[str, Any]:
    _ensure_output_size(body)
    if mode == "off":
        atomic_write(output, body, overwrite)
        return {"warnings": [], "evidence": "static"}
    if not renderable:
        if mode == "required":
            raise ContractError("rendering requires mmd or mermaid source output")
        atomic_write(output, body, overwrite)
        return {
            "warnings": ["rendering applies only to mmd or mermaid output; source-only output produced"],
            "evidence": "static",
        }

    # Refuse an unsafe or occupied source destination before consulting or
    # invoking any optional renderer. The check is repeated at installation to
    # close the ordinary time-of-check/time-of-use window.
    safe_output(output, overwrite)
    renderer, warnings = _renderer_details(mode)
    if renderer is None:
        atomic_write(output, body, overwrite)
        return {"warnings": warnings, "evidence": "static"}

    rendered_output = output.with_suffix(f".{render_format}")
    if rendered_output == output:
        raise ContractError("rendered output would replace the Mermaid source")
    safe_output(output, overwrite)
    safe_output(rendered_output, overwrite)
    output.parent.mkdir(parents=True, exist_ok=True)
    reject_symlink_ancestors(output.parent)
    stage_directory = Path(
        tempfile.mkdtemp(prefix=f".{output.name}.render.", dir=output.parent)
    )
    try:
        staged_source = stage_directory / output.name
        staged_render = stage_directory / rendered_output.name
        _write_staged(staged_source, body)
        try:
            completed = subprocess.run(
                [renderer["executable"], "-i", str(staged_source), "-o", str(staged_render)],
                capture_output=True,
                text=True,
                timeout=RENDER_TIMEOUT_SECONDS,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ContractError(f"mmdc failed: {exc}") from exc
        if completed.returncode:
            detail = completed.stderr.strip() or completed.stdout.strip() or f"exit status {completed.returncode}"
            raise ContractError(f"mmdc failed: {detail}")
        if not staged_render.exists() or staged_render.is_symlink() or not staged_render.is_file():
            raise ContractError("mmdc did not produce a regular rendered artifact")
        render_size = staged_render.stat().st_size
        if render_size <= 0:
            raise ContractError("mmdc produced an empty rendered artifact")
        if render_size > MAX_RENDER_BYTES:
            raise ContractError("rendered output exceeds 64 MiB")
        _validate_rendered_artifact(staged_render,render_format)
        _transactional_install(
            [(staged_source, output), (staged_render, rendered_output)], overwrite
        )
    finally:
        shutil.rmtree(stage_directory, ignore_errors=True)
    return {
        "warnings": warnings,
        "evidence": "rendered",
        "renderer": renderer,
        "rendered_output": str(rendered_output),
    }


def _output_record(path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "bytes": path.stat().st_size,
    }


def _diagram_preview_items(diagram: dict[str, Any]) -> tuple[list[str], list[tuple[int, int, str]]]:
    kind = diagram["kind"]
    data = diagram.get("data") or {}
    labels: list[str] = []
    edges: list[tuple[int, int, str]] = []
    ids: dict[str, int] = {}

    def add(item_id: str, label: str) -> None:
        ids[item_id] = len(labels)
        labels.append(label)

    if kind == "flowchart":
        for item in data["nodes"]:
            add(item["id"], item["label"])
        for edge in data["edges"]:
            edges.append((ids[edge["from"]], ids[edge["to"]], edge.get("label") or ""))
    elif kind == "sequence":
        for item in data["participants"]:
            add(item["id"], item["label"])
        for message in data["messages"]:
            edges.append((ids[message["from"]], ids[message["to"]], message["text"]))
    elif kind == "state":
        for item in data["states"]:
            add(item["id"], item["label"])
        for transition in data["transitions"]:
            edges.append((ids[transition["from"]], ids[transition["to"]], transition.get("label") or ""))
    elif kind == "class":
        for item in data["classes"]:
            add(item["id"], item["id"])
        for relation in data["relations"]:
            edges.append((ids[relation["from"]], ids[relation["to"]], relation.get("label") or relation.get("kind", "")))
    elif kind == "er":
        for item in data["entities"]:
            add(item["id"], item["id"])
        for relation in data["relationships"]:
            edges.append((ids[relation["from"]], ids[relation["to"]], relation.get("label") or ""))
    elif kind == "architecture":
        for item in data.get("services", []):
            add(item["id"], item["label"])
        for edge in data.get("edges", []):
            edges.append((ids[edge["from"]], ids[edge["to"]], edge.get("label") or ""))
    elif kind == "gantt":
        task_ids: dict[str, int] = {}
        for section in data["sections"]:
            for item in section["tasks"]:
                add(item["id"], f"{section['title']}: {item['label']}")
                task_ids[item["id"]] = ids[item["id"]]
                for token in (item["start"], item["end"]):
                    if token.startswith("after "):
                        edges.append((task_ids[token[6:]], ids[item["id"]], "after"))
    elif kind == "timeline":
        for section_index, section in enumerate(data["sections"]):
            previous: int | None = None
            for event_index, event in enumerate(section["events"]):
                item_id = f"timeline_{section_index}_{event_index}"
                add(item_id, f"{event['time']}: {event['text']}")
                current = ids[item_id]
                if previous is not None:
                    edges.append((previous, current, ""))
                previous = current
    elif kind == "kanban":
        for column in data["columns"]:
            add(column["id"], column["label"])
            column_index=ids[column["id"]]
            for item in column["items"]:
                add(item["id"], f"{column['label']}: {item['label']}")
                edges.append((column_index,ids[item["id"]],"contains"))
    elif kind == "mindmap":
        def walk(node: dict[str, Any], parent: int | None, path: tuple[int, ...]) -> None:
            node_id = "mind_" + "_".join(str(value) for value in path)
            add(node_id, node["text"])
            current = ids[node_id]
            if parent is not None:
                edges.append((parent, current, ""))
            for index, child in enumerate(node.get("children", [])):
                walk(child, current, path + (index,))
        walk(data["root"], None, (0,))
    else:
        raise ContractError("raw Mermaid preview requires an explicitly requested local mmdc renderer")
    return labels, edges


def _structural_svg(document: dict[str, Any]) -> str:
    panels: list[tuple[dict[str, Any], list[str], list[tuple[int, int, str]]]] = []
    total_height = 54
    for diagram in document["diagrams"]:
        labels, edges = _diagram_preview_items(diagram)
        panels.append((diagram, labels, edges))
        total_height += 92 + max(1, len(labels)) * 76 + len(edges) * 22
    width = 960
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{total_height}" viewBox="0 0 {width} {total_height}">',
        '<rect width="100%" height="100%" fill="#0b1020"/>',
        '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif} .title{font-size:22px;font-weight:700;fill:#f4f7ff}.meta{font-size:12px;fill:#9fb0d0}.node{fill:#18233d;stroke:#71d7ff;stroke-width:1.5}.label{font-size:14px;fill:#f7fbff}.edge{stroke:#b984ff;stroke-width:2;fill:none}.edgeLabel{font-size:11px;fill:#dbc8ff}</style>',
        f'<text class="title" x="32" y="36">{html.escape(str(document["title"]))}</text>',
    ]
    y = 62
    for diagram, labels, edges in panels:
        panel_height = 72 + max(1, len(labels)) * 76 + len(edges) * 22
        parts.append(f'<rect x="24" y="{y}" width="912" height="{panel_height}" rx="18" fill="#10182b" stroke="#253556"/>')
        parts.append(f'<text class="title" x="48" y="{y + 34}">{html.escape(str(diagram["title"]))}</text>')
        parts.append(f'<text class="meta" x="48" y="{y + 54}">{html.escape(str(diagram["kind"]))} · structural preview · static evidence</text>')
        node_y = y + 78
        positions: list[tuple[float, float]] = []
        for index, label in enumerate(labels or ["Empty structure"]):
            x = 64 if index % 2 == 0 else 516
            row = index // 2
            cy = node_y + row * 76
            positions.append((x, cy))
            display = label if len(label) <= 58 else label[:55] + "…"
            parts.append(f'<rect class="node" x="{x}" y="{cy}" width="380" height="48" rx="10"/>')
            parts.append(f'<text class="label" x="{x + 16}" y="{cy + 29}">{html.escape(display)}</text>')
        edge_y = node_y + ((max(1, len(labels)) + 1) // 2) * 76 + 8
        for edge_index, (start, end, label) in enumerate(edges):
            if start >= len(positions) or end >= len(positions):
                continue
            start_x, start_y = positions[start]
            end_x, end_y = positions[end]
            x1, y1 = start_x + 190, start_y + 48
            x2, y2 = end_x + 190, end_y
            parts.append(f'<path class="edge" d="M{x1},{y1} L{x1},{edge_y + edge_index * 22} L{x2},{edge_y + edge_index * 22} L{x2},{y2}"/>')
            if label:
                display = label if len(label) <= 72 else label[:69] + "…"
                parts.append(f'<text class="edgeLabel" x="48" y="{edge_y + edge_index * 22 + 14}">{html.escape(display)}</text>')
        y += panel_height + 20
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def _safe_rendered_svg(source: str) -> str:
    lowered = source.casefold()
    if "<!doctype" in lowered or "<!entity" in lowered:
        raise ContractError("renderer produced SVG with a DTD or entity declaration")
    # ElementTree discards processing instructions during normal tree parsing.
    # An XML stylesheet instruction would therefore bypass the element and
    # attribute checks below while instructing some SVG viewers to fetch an
    # external stylesheet. SVG output from the supported renderer has no need
    # for processing instructions; retain only the syntactic XML declaration.
    for match in re.finditer(r"<\?([A-Za-z_:][A-Za-z0-9_.:-]*)\b", source):
        if match.group(1) != "xml":
            raise ContractError("renderer produced SVG with a processing instruction")
    if any(token in lowered for token in ("javascript:", "vbscript:", "@import", "expression(", "behavior:", "-moz-binding")):
        raise ContractError("renderer produced SVG with active or external content")
    try:
        root = ET.fromstring(source)
    except ET.ParseError as exc:
        raise ContractError(f"renderer produced malformed SVG: {exc}") from exc

    def local_name(value: str) -> str:
        return value.rsplit("}", 1)[-1].casefold()

    if local_name(root.tag) != "svg":
        raise ContractError("renderer output is not an SVG document")

    def validate_css_value(value: str) -> None:
        """Validate CSS after XML character-reference decoding.

        SVG consumers decode character references before parsing CSS. Checking
        only the original source therefore misses values such as
        ``u&#114;l(https://example.invalid)``. CSS escapes and comments can
        perform the same token splicing, so renderer-produced CSS containing
        either is rejected rather than normalized heuristically.
        """

        lowered_value = value.casefold()
        if "\\" in value or "/*" in lowered_value or "*/" in lowered_value or "@" in value:
            raise ContractError("renderer produced SVG with escaped or directive CSS")
        if any(
            token in lowered_value
            for token in (
                "javascript:",
                "vbscript:",
                "expression(",
                "behavior:",
                "-moz-binding",
            )
        ):
            raise ContractError("renderer produced SVG with active CSS")
        matches = list(re.finditer(r"url\s*\(([^)]*)\)", value, re.IGNORECASE | re.DOTALL))
        remainder = re.sub(r"url\s*\(([^)]*)\)", "", value, flags=re.IGNORECASE | re.DOTALL)
        if re.search(r"url\s*\(", remainder, re.IGNORECASE):
            raise ContractError("renderer produced malformed SVG resource CSS")
        for match in matches:
            target = match.group(1).strip().strip("\"'")
            if not re.fullmatch(r"#[A-Za-z0-9_.:-]+", target):
                raise ContractError("renderer produced an external SVG resource")

    forbidden_elements = {
        "a", "animate", "animatemotion", "animatetransform", "audio", "canvas",
        "embed", "foreignobject", "iframe", "image", "link", "meta", "object",
        "script", "set", "video",
    }
    for element in root.iter():
        if not isinstance(element.tag, str):
            raise ContractError("renderer produced unsupported SVG markup")
        if local_name(element.tag) in forbidden_elements:
            raise ContractError("renderer produced SVG with active or linked content")
        if local_name(element.tag) == "style":
            validate_css_value("".join(element.itertext()))
        for raw_name, raw_value in element.attrib.items():
            name = local_name(raw_name)
            value = raw_value.strip()
            if name.startswith("on") or name in {"base", "src"}:
                raise ContractError("renderer produced SVG with active attributes")
            if name == "href" and not value.startswith("#"):
                raise ContractError("renderer produced an external SVG reference")
            if name in {
                "clip-path",
                "cursor",
                "fill",
                "filter",
                "marker-end",
                "marker-mid",
                "marker-start",
                "mask",
                "style",
                "stroke",
            }:
                validate_css_value(value)
    return source


def preview_document(document: dict[str, Any], output: Path, format_name: str, overwrite: bool, render: str) -> dict[str, Any]:
    expected = ".html" if format_name == "html" else ".svg"
    if output.suffix.lower() != expected:
        raise ContractError(f"preview output extension must be {expected}")
    # Preflight before consulting or invoking an optional local renderer. The
    # atomic writer repeats this check immediately before installation.
    safe_output(output, overwrite)
    raw = [diagram for diagram in document["diagrams"] if diagram["kind"] == "raw"]
    renderer: dict[str, str] | None = None
    if raw:
        if len(document["diagrams"]) != 1:
            raise ContractError("raw Mermaid preview supports exactly one diagram")
        if render == "off":
            raise ContractError("raw Mermaid preview requires --render auto or --render required")
        renderer, warnings = _renderer_details("required" if render == "required" else "auto")
        if renderer is None:
            raise ContractError(warnings[0])
        with tempfile.TemporaryDirectory(prefix="mermaid-preview-") as raw_directory:
            directory = Path(raw_directory)
            source_path = directory / "source.mmd"
            svg_path = directory / "preview.svg"
            _write_staged(source_path, raw[0]["source"])
            try:
                completed = subprocess.run(
                    [renderer["executable"], "-i", str(source_path), "-o", str(svg_path)],
                    capture_output=True,
                    text=True,
                    timeout=RENDER_TIMEOUT_SECONDS,
                )
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise ContractError(f"mmdc failed: {exc}") from exc
            if completed.returncode:
                detail = completed.stderr.strip() or completed.stdout.strip() or f"exit status {completed.returncode}"
                raise ContractError(f"mmdc failed: {detail}")
            if svg_path.is_symlink() or not svg_path.is_file():
                raise ContractError("mmdc did not produce a regular SVG artifact")
            render_size = svg_path.stat().st_size
            if render_size <= 0:
                raise ContractError("mmdc produced an empty SVG artifact")
            if render_size > MAX_RENDER_BYTES:
                raise ContractError("rendered SVG exceeds 64 MiB")
            svg = _safe_rendered_svg(svg_path.read_text(encoding="utf-8"))
        evidence = "rendered"
    else:
        svg = _structural_svg(document)
        evidence = "previewed"
    if format_name == "html":
        body = (
            "<!doctype html>\n<meta charset=\"utf-8\">\n"
            f"<title>{html.escape(str(document['title']))} structural preview</title>\n"
            "<style>html{background:#0b1020;color:#f4f7ff}body{margin:0;padding:24px}svg{max-width:100%;height:auto}</style>\n"
            f"{svg}"
        )
    else:
        body = svg
    _ensure_output_size(body)
    atomic_write(output, body, overwrite)
    result: dict[str, Any] = {
        "outputs": [_output_record(output)],
        "diagnostics": _semantic_diagnostics(document),
        "changes": [],
        "losses": [],
        "evidence": evidence,
    }
    if renderer is not None:
        result["renderer"] = renderer
    return result


MERMAID_MARKER_RE = re.compile(r"^[ \t]*<!--[ \t]*mermaid:id=([A-Za-z_][A-Za-z0-9_-]*)[ \t]*-->[ \t]*(?:\r?\n|\r)?$")


def edit_markdown(source_path: Path, edits_path: Path, output: Path, overwrite: bool) -> dict[str, Any]:
    contents = read_input(source_path)
    if source_path.suffix.lower() not in MARKDOWN_SUFFIXES:
        raise ContractError("edit-markdown source must be a Markdown file")
    try:
        fences = validate_mermaid.parse_mermaid_fences(contents)
    except ValueError as exc:
        raise ContractError(str(exc)) from exc
    spec = strict_object(_load_json(edits_path), {"version", "edits"}, "edit document")
    if spec.get("version") != 1:
        raise ContractError("edit document version must be 1")
    edits = require_list(spec.get("edits"), "edits", maximum=MAX_DIAGRAMS)
    if not edits:
        raise ContractError("edits must not be empty")
    lines = contents.splitlines(keepends=True)
    offsets = [0]
    for line in lines:
        offsets.append(offsets[-1] + len(line))
    marker_to_index: dict[str, int] = {}
    for index, fence in enumerate(fences):
        if fence.start_line <= 1:
            continue
        marker_match = MERMAID_MARKER_RE.fullmatch(lines[fence.start_line - 2])
        if marker_match:
            marker_id = marker_match.group(1)
            if marker_id in marker_to_index:
                raise ContractError(f"duplicate Mermaid marker id: {marker_id}")
            marker_to_index[marker_id] = index
    replacements: list[tuple[int, int, str, str]] = []
    selected: set[int] = set()
    for edit_index, raw_edit in enumerate(edits):
        field = f"edits[{edit_index}]"
        edit = strict_object(raw_edit, {"markerId", "index", "expectedSourceSha256", "source"}, field)
        marker_id = edit.get("markerId")
        ordinal = edit.get("index")
        expected_hash = edit.get("expectedSourceSha256")
        if marker_id is not None:
            marker_id = ident(marker_id, f"{field}.markerId")
            if ordinal is not None or expected_hash is not None:
                raise ContractError(f"{field} must select by markerId or by index plus expectedSourceSha256")
            if marker_id not in marker_to_index:
                raise ContractError(f"Mermaid marker id not found: {marker_id}")
            fence_index = marker_to_index[marker_id]
        else:
            if isinstance(ordinal, bool) or not isinstance(ordinal, int) or ordinal < 1 or ordinal > len(fences):
                raise ContractError(f"{field}.index must select an existing one-based Mermaid fence")
            if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
                raise ContractError(f"{field}.expectedSourceSha256 must be a lowercase SHA-256 digest")
            fence_index = ordinal - 1
            actual_hash = hashlib.sha256(fences[fence_index].source.encode("utf-8")).hexdigest()
            if actual_hash != expected_hash:
                raise ContractError(f"{field} source hash does not match")
        if fence_index in selected:
            raise ContractError("a Mermaid fence may be edited only once per operation")
        selected.add(fence_index)
        replacement_source = text(edit.get("source"), f"{field}.source", max_bytes=MAX_SOURCE_BYTES)
        assert isinstance(replacement_source, str)
        replacement_source = replacement_source.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
        if any(line.lstrip().startswith(PORTABLE_METADATA_PREFIX) for line in replacement_source.splitlines()):
            raise ContractError(f"{field}.source contains reserved portable metadata")
        errors, _ = validate_mermaid.check_source(replacement_source)
        if errors:
            raise ContractError(f"{field}.source is invalid: " + "; ".join(errors))
        fence = fences[fence_index]
        opening_line = lines[fence.start_line - 1]
        eol = "\r\n" if opening_line.endswith("\r\n") else "\r" if opening_line.endswith("\r") else "\n"
        replacement_body = "".join(fence.indent + line + eol for line in replacement_source.rstrip("\n").split("\n"))
        replacements.append(
            (
                offsets[fence.start_line],
                offsets[fence.end_line - 1],
                replacement_body,
                marker_id or f"index:{ordinal}",
            )
        )
    revised = contents
    for start, end, replacement, _ in sorted(replacements, reverse=True):
        revised = revised[:start] + replacement + revised[end:]
    try:
        validate_mermaid.parse_mermaid_fences(revised)
    except ValueError as exc:
        raise ContractError(f"edited Markdown is invalid: {exc}") from exc
    atomic_write(output, revised, overwrite)
    return {
        "outputs": [_output_record(output)],
        "diagnostics": [],
        "changes": [f"replace-mermaid-fence:{label}" for *_, label in replacements],
        "losses": [],
        "evidence": "static",
    }


def _load_json(path: Path) -> Any:
    try:
        return json.loads(read_input(path))
    except RecursionError as exc:
        raise ContractError("JSON nesting is too deep") from exc


def _validate_repair_source(path: Path, contents: str) -> None:
    try:
        blocks, _ = validate_mermaid.extract_mermaid_text(
            contents, markdown=path.suffix.lower() in MARKDOWN_SUFFIXES
        )
    except ValueError as exc:
        raise ContractError(str(exc)) from exc
    for index, block in enumerate(blocks, 1):
        source = block.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
        errors, _ = validate_mermaid.check_source(source)
        if errors:
            prefix = f"block {index}: " if len(blocks) > 1 else ""
            raise ContractError(prefix + "; ".join(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("create", "export"):
        subparser = subparsers.add_parser(command)
        subparser.add_argument("spec")
        subparser.add_argument("output")
        subparser.add_argument("--format", choices=("json", "md", "mmd", "mermaid"), default="md")
        subparser.add_argument("--target-version", default=COMPATIBILITY_PROFILE)
        subparser.add_argument("--overwrite", action="store_true")
        subparser.add_argument("--render", choices=("off", "auto", "required"), default="off")
        subparser.add_argument("--render-format", choices=("svg", "png", "pdf"), default="svg")
    import_parser = subparsers.add_parser("import")
    import_parser.add_argument("source")
    import_parser.add_argument("output")
    import_parser.add_argument("--overwrite", action="store_true")
    lint_parser = subparsers.add_parser("lint")
    lint_parser.add_argument("source")
    repair_parser = subparsers.add_parser("repair")
    repair_parser.add_argument("source")
    repair_parser.add_argument("output")
    repair_parser.add_argument("--overwrite", action="store_true")
    edit_parser = subparsers.add_parser("edit-markdown")
    edit_parser.add_argument("source")
    edit_parser.add_argument("edits")
    edit_parser.add_argument("output")
    edit_parser.add_argument("--overwrite", action="store_true")
    preview_parser = subparsers.add_parser("preview")
    preview_parser.add_argument("spec")
    preview_parser.add_argument("output")
    preview_parser.add_argument("--format", choices=("svg", "html"), default="svg")
    preview_parser.add_argument("--render", choices=("off", "auto", "required"), default="off")
    preview_parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    try:
        if args.command == "lint":
            path = input_path(args.source, "source")
            if path.suffix.lower() == ".json":
                document = normalize_document(_load_json(path))
            else:
                document = import_source(path)
            print(json.dumps({"ok": True, "diagnostics": _semantic_diagnostics(document), "changes": [], "outputs": [], "losses": [], "diagrams": len(document["diagrams"]), "evidence": "static"}, sort_keys=True))
            return 0

        if args.command == "import":
            document = import_source(input_path(args.source, "source"))
            output = output_path(args.output)
            atomic_write(output, public_json(document), args.overwrite)
            print(
                json.dumps(
                    {"ok": True, "output": str(output), "outputs": [_output_record(output)], "diagnostics": _semantic_diagnostics(document), "changes": [], "losses": [], "evidence": "static"},
                    sort_keys=True,
                )
            )
            return 0

        if args.command == "repair":
            source_path = input_path(args.source, "source")
            original = read_input(source_path)
            repaired = original.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
            _validate_repair_source(source_path, repaired)
            output = output_path(args.output)
            atomic_write(output, repaired, args.overwrite)
            print(
                json.dumps(
                    {
                        "ok": True,
                        "output": str(output),
                        "outputs": [_output_record(output)],
                        "diagnostics": [],
                        "changes": ["normalize-line-endings-and-final-newline"] if repaired != original else [],
                        "losses": [],
                        "evidence": "static",
                    },
                    sort_keys=True,
                )
            )
            return 0

        if args.command == "edit-markdown":
            report = edit_markdown(
                input_path(args.source, "source"),
                input_path(args.edits, "edits"),
                output_path(args.output),
                args.overwrite,
            )
            print(json.dumps({"ok": True, **report}, sort_keys=True))
            return 0

        if args.command == "preview":
            document = normalize_document(_load_json(input_path(args.spec, "specification")))
            report = preview_document(
                document,
                output_path(args.output),
                args.format,
                args.overwrite,
                args.render,
            )
            print(json.dumps({"ok": True, **report}, sort_keys=True))
            return 0

        spec_path = input_path(args.spec, "specification")
        document = normalize_document(_load_json(spec_path))
        profile_warnings = _target_version_warnings(document, args.target_version)
        output = output_path(args.output)
        if args.format == "json":
            body = public_json(document)
        elif args.format == "md":
            body = markdown(document)
        else:
            if len(document["diagrams"]) != 1:
                raise ContractError("raw export requires exactly one diagram")
            body = document["diagrams"][0]["source"]
        _ensure_output_size(body)
        expected = {"json": ".json", "md": ".md", "mmd": ".mmd", "mermaid": ".mermaid"}[args.format]
        if output.suffix.lower() != expected:
            raise ContractError(f"output extension must be {expected}")
        render_report = write_with_optional_render(
            output,
            body,
            mode=args.render,
            render_format=args.render_format,
            overwrite=args.overwrite,
            renderable=args.format in {"mmd", "mermaid"},
        )
        response: dict[str, Any] = {
            "ok": True,
            "output": str(output),
            "outputs": [_output_record(output)],
            "diagnostics": _semantic_diagnostics(document)+[
                {"code": "mermaid.version-profile", "severity": "warning", "path": "$.diagrams", "message": warning}
                for warning in profile_warnings
            ],
            "changes": [],
            "losses": _representation_losses(document),
            "warnings": profile_warnings + render_report["warnings"],
            "evidence": render_report["evidence"],
            "targetVersion": args.target_version,
            "compatibilityProfile": COMPATIBILITY_PROFILE,
        }
        if "renderer" in render_report:
            response["renderer"] = render_report["renderer"]
            response["rendered_output"] = render_report["rendered_output"]
            response["outputs"].append(_output_record(Path(render_report["rendered_output"])))
        print(json.dumps(response, sort_keys=True))
        return 0
    except (OSError, UnicodeError, json.JSONDecodeError, RecursionError, ContractError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, sort_keys=True), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
