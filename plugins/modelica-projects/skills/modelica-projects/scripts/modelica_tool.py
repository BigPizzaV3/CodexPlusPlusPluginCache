#!/usr/bin/env python3
"""Create, import, annotate, lint, repair, and export portable visual Modelica projects."""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

import create_modelica_project
import static_check_modelica

VERSION = 2
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
QIDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$")
ROOT_KEYS = {"version", "package", "description", "mslVersion", "languageVersion", "dependencies", "files"}
FILE_KEYS = {"path", "source", "kind", "documentation", "example", "test", "visual"}
VISUAL_KEYS = {"direction", "coordinateSystem", "components", "connectors", "connections", "icon"}
POINT_LIMIT = 10_000.0
PRIMITIVES = {"Rectangle", "Ellipse", "Polygon", "Line", "Text"}
CLASS_KIND = re.compile(
    r"^(?:encapsulated )?(?:partial )?"
    r"(?:class|model|(?:operator )?record|block|(?:expandable )?connector|type|package|"
    r"(?:(?:pure|impure) )?(?:operator )?function|operator)$"
)
GRAPHICAL_ANNOTATIONS = {"Icon", "Diagram", "Placement", "Line"}
BUILTIN_TYPES = {"Boolean", "Clock", "Integer", "Real", "String"}
ENDPOINT_SEGMENT = r"[A-Za-z_][A-Za-z0-9_]*(?:\[[1-9][0-9]*(?:,[1-9][0-9]*)*\])?"
ENDPOINT = re.compile(rf"^{ENDPOINT_SEGMENT}(?:\.{ENDPOINT_SEGMENT})*$")
MAX_LINE_THICKNESS = 100.0
MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_OUTPUT_BYTES = 8 * 1024 * 1024
ALLOWED_SYSTEM_SYMLINKS = {Path("/var"), Path("/tmp"), Path("/etc")}
COLORS = {"black": [0, 0, 0], "white": [255, 255, 255], "gray": [95, 95, 95],
          "blue": [35, 90, 160], "orange": [210, 105, 30], "green": [35, 130, 85], "red": [180, 45, 45]}
PORTABLE_VISUAL_PREFIX = "// portable-visual-v2:"
OMC_TIMEOUT_SECONDS = 120
OMC_VERSION_TIMEOUT_SECONDS = 10


class ContractError(ValueError):
    pass


def strict(value: Any, allowed: set[str], context: str) -> dict[str, Any]:
    if not isinstance(value, dict): raise ContractError(f"{context} must be an object")
    unknown = set(value) - allowed
    if unknown: raise ContractError(f"{context} has unknown fields: {sorted(unknown)}")
    return value


def text(value: Any, field: str, optional: bool = False) -> str | None:
    if value is None and optional: return None
    if not isinstance(value, str) or not value.strip(): raise ContractError(f"{field} must be a non-empty string")
    for ch in value:
        cat = unicodedata.category(ch)
        if cat == "Cs" or (cat == "Cc" and ch not in "\n\r\t"):
            raise ContractError(f"{field} contains invalid Unicode/control characters")
    return value


def identifier(value: Any, field: str, qualified: bool = False) -> str:
    result = text(value, field); assert isinstance(result, str)
    if not (QIDENT if qualified else IDENT).fullmatch(result): raise ContractError(f"invalid {field}: {result!r}")
    return result


def boolean(value: Any, field: str) -> bool:
    if not isinstance(value, bool):
        raise ContractError(f"{field} must be a boolean")
    return value


def number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ContractError(f"{field} must be finite")
    result = float(value)
    if abs(result) > POINT_LIMIT: raise ContractError(f"{field} exceeds coordinate bounds")
    return result


def point(value: Any, field: str) -> list[float]:
    if not isinstance(value, list) or len(value) != 2: raise ContractError(f"{field} must be [x,y]")
    return [number(value[0], field), number(value[1], field)]


def extent(value: Any, field: str) -> list[list[float]]:
    if not isinstance(value, list) or len(value) != 2: raise ContractError(f"{field} must contain two points")
    result = [point(value[0], field), point(value[1], field)]
    if result[0][0] == result[1][0] or result[0][1] == result[1][1]:
        raise ContractError(f"{field} has zero area")
    return result


def text_extent(value: Any, field: str) -> list[list[float]]:
    if not isinstance(value, list) or len(value) != 2: raise ContractError(f"{field} must contain two points")
    result = [point(value[0], field), point(value[1], field)]
    if result[0] == result[1]: raise ContractError(f"{field} has zero width and height")
    return result


def positive_size(value: Any, field: str) -> list[float]:
    result = point(value, field)
    if result[0] <= 0 or result[1] <= 0:
        raise ContractError(f"{field} values must be positive")
    return result


def rotation(value: Any, field: str) -> float:
    result = number(value, field)
    if not -360.0 <= result <= 360.0:
        raise ContractError(f"{field} must be between -360 and 360 degrees")
    return result


def color(value: Any, field: str) -> list[int]:
    if isinstance(value, str):
        if value not in COLORS: raise ContractError(f"unknown {field}: {value}")
        return list(COLORS[value])
    if (
        not isinstance(value, list)
        or len(value) != 3
        or any(isinstance(channel, bool) or not isinstance(channel, int) or not 0 <= channel <= 255 for channel in value)
    ):
        raise ContractError(f"{field} must be an RGB triple with integer channels from 0 to 255")
    return list(value)


def thickness(value: Any, field: str) -> float:
    result = number(value, field)
    if result <= 0 or result > MAX_LINE_THICKNESS:
        raise ContractError(f"{field} must be greater than 0 and at most {fmt(MAX_LINE_THICKNESS)}")
    return result


def modelica_string(value: str) -> str:
    """Escape a validated Python string as Modelica string-literal content."""
    return (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )


def modelica_unescape(value:str,field:str)->str:
    mapping={"a":"\a","b":"\b","f":"\f","n":"\n","r":"\r","t":"\t","v":"\v","?":"?",'"':'"',"'":"'","\\":"\\"}
    result=[]; index=0
    while index<len(value):
        if value[index]!="\\": result.append(value[index]); index+=1; continue
        if index+1>=len(value): raise ContractError(f"{field} has a dangling escape")
        escaped=value[index+1]
        if escaped not in mapping: raise ContractError(f"{field} contains an unsupported escape sequence")
        result.append(mapping[escaped]); index+=2
    decoded="".join(result)
    validated=text(decoded,field); assert isinstance(validated,str)
    return validated


def fmt(value: float | int) -> str:
    numeric = float(value)
    return str(int(numeric)) if numeric.is_integer() else f"{numeric:.6g}"


def fmt_point(value: list[float]) -> str:
    return "{" + ",".join(fmt(x) for x in value) + "}"


def fmt_extent(value: list[list[float]]) -> str:
    return "{" + ",".join(fmt_point(x) for x in value) + "}"


@dataclass(frozen=True)
class ModelicaToken:
    kind: str
    value: str
    start: int
    end: int


def lex_modelica(source: str) -> list[ModelicaToken]:
    """Tokenize the source-preserving subset used by v2.1 edits and imports."""
    tokens: list[ModelicaToken] = []
    index = 0
    length = len(source)
    while index < length:
        start = index
        character = source[index]
        if character.isspace():
            index += 1
            while index < length and source[index].isspace(): index += 1
            tokens.append(ModelicaToken("space", source[start:index], start, index)); continue
        if source.startswith("//", index):
            newline = source.find("\n", index + 2); index = length if newline < 0 else newline
            tokens.append(ModelicaToken("comment", source[start:index], start, index)); continue
        if source.startswith("/*", index):
            closing = source.find("*/", index + 2)
            if closing < 0: raise ContractError("unterminated Modelica block comment")
            index = closing + 2; tokens.append(ModelicaToken("comment", source[start:index], start, index)); continue
        if character in {'"', "'"}:
            quote = character; index += 1; escaped = False
            while index < length:
                current = source[index]
                index += 1
                if escaped: escaped = False
                elif current == "\\": escaped = True
                elif current == quote: break
            else: raise ContractError("unterminated Modelica string or quoted identifier")
            tokens.append(ModelicaToken("string" if quote == '"' else "quoted-ident", source[start:index], start, index)); continue
        if character.isalpha() or character == "_":
            index += 1
            while index < length and (source[index].isalnum() or source[index] == "_"): index += 1
            tokens.append(ModelicaToken("ident", source[start:index], start, index)); continue
        if character.isdigit() or (character == "." and index + 1 < length and source[index + 1].isdigit()):
            number_match = re.match(r"(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", source[index:])
            assert number_match is not None
            index += len(number_match.group(0)); tokens.append(ModelicaToken("number", source[start:index], start, index)); continue
        two = source[index:index + 2]
        if two in {":=", "<=", ">=", "==", "<>"}:
            index += 2; tokens.append(ModelicaToken("symbol", two, start, index)); continue
        index += 1; tokens.append(ModelicaToken("symbol", character, start, index))
    stack: list[ModelicaToken] = []
    pairs = {")":"(", "]":"[", "}":"{"}
    for token in tokens:
        if token.kind != "symbol": continue
        if token.value in "([{": stack.append(token)
        elif token.value in pairs:
            if not stack or stack.pop().value != pairs[token.value]:
                raise ContractError(f"unbalanced Modelica delimiter at byte {token.start}")
    if stack: raise ContractError(f"unbalanced Modelica delimiter at byte {stack[-1].start}")
    return tokens


def class_boundaries(source: str) -> list[dict[str, Any]]:
    tokens=[token for token in lex_modelica(source) if token.kind not in {"space","comment"}]
    class_words={"model","block","class","connector","record","function","package","type","operator"}
    stack: list[tuple[str,int,str]]=[]; results=[]; index=0
    while index < len(tokens):
        token=tokens[index]
        if token.kind=="ident" and token.value in class_words:
            cursor=index+1
            if token.value=="operator" and cursor<len(tokens) and tokens[cursor].kind=="ident" and tokens[cursor].value in {"record","function"}: cursor+=1
            if cursor<len(tokens) and tokens[cursor].kind in {"ident","quoted-ident"}:
                name=tokens[cursor].value.strip("'"); stack.append((name,token.start,token.value))
        elif token.kind=="ident" and token.value=="end" and index+2<len(tokens):
            name_token=tokens[index+1]; semi=tokens[index+2]
            control_endings={"if","for","while","when","match","matchcontinue"}
            if name_token.kind=="ident" and name_token.value in control_endings:
                index+=1
                continue
            if name_token.kind in {"ident","quoted-ident"} and semi.value==";" and stack:
                name,start,kind=stack.pop()
                if name_token.value.strip("'")!=name: raise ContractError(f"Modelica class end mismatch: expected {name}")
                results.append({"name":name,"kind":kind,"start":start,"end":semi.end,"depth":len(stack)})
        index+=1
    if stack: raise ContractError(f"unterminated Modelica class: {stack[-1][0]}")
    return sorted(results,key=lambda item:item["start"])


DECLARATION_RE = re.compile(
    r"^[ \t]*(?!(?:within|model|block|class|connector|package|record|function|type|equation|algorithm|end|connect|extends|import|annotation)\b)"
    r"(?:(?:parameter|constant|input|output|discrete|flow|stream|replaceable|redeclare|inner|outer|final|each)[ \t]+)*"
    r"(?P<type>[A-Za-z_][A-Za-z0-9_.]*)(?:[ \t]*\[[^;\n]+\])?[ \t]+"
    r"(?P<name>[A-Za-z_][A-Za-z0-9_]*)\b(?:[ \t]*\[[^;\n]+\])?[^;\n]*;",
    re.MULTILINE,
)


def modelica_mask(source: str) -> str:
    masked, errors = static_check_modelica.mask_comments_and_strings(source)
    if errors: raise ContractError("invalid Modelica source: " + "; ".join(errors))
    return masked


def parse_instance_declarations(source: str) -> dict[str, str]:
    declarations: dict[str, str] = {}
    for match in DECLARATION_RE.finditer(modelica_mask(source)):
        name = match.group("name")
        declarations.setdefault(name, match.group("type"))
    return declarations


def parse_instance_names(source: str) -> set[str]:
    return set(parse_instance_declarations(source))


def endpoint(value: Any, field: str) -> str:
    result = text(value, field)
    assert isinstance(result, str)
    if not ENDPOINT.fullmatch(result):
        raise ContractError(f"{field} must be a dot-separated unquoted Modelica name")
    return result


def endpoint_root(value: str) -> str:
    return value.split(".", 1)[0].split("[",1)[0]


def endpoint_names(value: str) -> list[str]:
    return [segment.split("[",1)[0] for segment in value.split(".")]


def find_matching_parenthesis(masked: str, opening: int, context: str) -> int:
    depth = 1
    for index in range(opening + 1, len(masked)):
        if masked[index] == "(": depth += 1
        elif masked[index] == ")":
            depth -= 1
            if depth == 0: return index
    raise ContractError(f"unterminated {context}")


def split_top_level(masked: str, start: int, end: int, context: str) -> list[tuple[int, int]]:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[str] = []
    segments: list[tuple[int, int]] = []
    cursor = start
    for index in range(start, end):
        char = masked[index]
        if char in "([{": stack.append(char)
        elif char in pairs:
            if not stack or stack.pop() != pairs[char]: raise ContractError(f"unbalanced delimiter in {context}")
        elif char == "," and not stack:
            segments.append((cursor, index)); cursor = index + 1
    if stack: raise ContractError(f"unbalanced delimiter in {context}")
    segments.append((cursor, end))
    return segments


def annotation_calls(source: str) -> list[tuple[int, int, int, list[tuple[int, int, str | None]]]]:
    masked = modelica_mask(source)
    calls: list[tuple[int, int, int, list[tuple[int, int, str | None]]]] = []
    cursor = 0
    pattern = re.compile(r"\bannotation\s*\(")
    while True:
        match = pattern.search(masked, cursor)
        if match is None: break
        opening = match.end() - 1
        closing = find_matching_parenthesis(masked, opening, "annotation")
        entries: list[tuple[int, int, str | None]] = []
        for entry_start, entry_end in split_top_level(masked, opening + 1, closing, "annotation"):
            head = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(", masked[entry_start:entry_end])
            entries.append((entry_start, entry_end, head.group(1) if head else None))
        calls.append((match.start(), opening, closing, entries))
        cursor = closing + 1
    return calls


def graphical_annotation_names(source: str) -> set[str]:
    return {
        name
        for _, _, _, entries in annotation_calls(source)
        for _, _, name in entries
        if name in GRAPHICAL_ANNOTATIONS
    }


def strip_graphical_annotations(source: str) -> str:
    """Remove only top-level graphical entries from Modelica annotation clauses."""
    edits: list[tuple[int, int, str]] = []
    for start, opening, closing, entries in annotation_calls(source):
        removed = [entry for entry in entries if entry[2] in GRAPHICAL_ANNOTATIONS]
        if not removed: continue
        kept = [entry for entry in entries if entry[2] not in GRAPHICAL_ANNOTATIONS and source[entry[0]:entry[1]].strip()]
        if kept:
            # Preserve every surviving entry byte-for-byte. The commas that
            # separated removed entries are the only bytes reconstructed.
            body = ",".join(source[entry_start:entry_end] for entry_start, entry_end, _ in kept)
            edits.append((start, closing + 1, source[start:opening + 1] + body + ")"))
            continue
        removal_start = start
        removal_end = closing + 1
        line_start = source.rfind("\n", 0, start) + 1
        if not source[line_start:start].strip():
            cursor = removal_end
            while cursor < len(source) and source[cursor] in " \t": cursor += 1
            if cursor < len(source) and source[cursor] == ";": removal_end = cursor + 1
            if source.startswith("\r\n", removal_end): removal_end += 2
            elif removal_end < len(source) and source[removal_end] in "\r\n": removal_end += 1
            removal_start = line_start
        else:
            while removal_start > line_start and source[removal_start - 1] in " \t":
                removal_start -= 1
        edits.append((removal_start, removal_end, ""))
    for start, end, replacement in reversed(edits): source = source[:start] + replacement + source[end:]
    return source


def declaration_span(source: str, name: str) -> tuple[int, int]:
    masked = modelica_mask(source)
    pattern = re.compile(
        rf"^[ \t]*(?!(?:within|model|block|class|connector|package|record|function|type|equation|algorithm|end|connect|extends|import|annotation)\b)"
        rf"(?:(?:parameter|constant|input|output|discrete|flow|stream|replaceable|redeclare|inner|outer|final|each)[ \t]+)*"
        rf"[A-Za-z_][A-Za-z0-9_.]*(?:[ \t]*\[[^;\n]+\])?[ \t]+{re.escape(name)}\b[^;\n]*(?P<semi>;)",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(masked))
    if len(matches) != 1: raise ContractError(f"cannot uniquely locate declaration for {name}")
    return matches[0].start(), matches[0].start("semi")


def add_declaration_annotation(source: str, name: str, entry: str) -> str:
    start, semicolon = declaration_span(source, name)
    existing = [call for call in annotation_calls(source) if start <= call[0] and call[2] < semicolon]
    if len(existing) > 1: raise ContractError(f"declaration for {name} has multiple annotation clauses")
    if existing:
        _, opening, closing, _ = existing[0]
        separator = ", " if source[opening + 1:closing].strip() else ""
        return source[:closing] + separator + entry + source[closing:]
    return source[:semicolon] + f" annotation({entry})" + source[semicolon:]


def replace_connect_annotation(source: str, start: str, end: str, entry: str) -> str:
    masked = modelica_mask(source)
    patterns = [
        re.compile(rf"\bconnect\s*\(\s*{re.escape(start)}\s*,\s*{re.escape(end)}\s*\)", re.MULTILINE),
        re.compile(rf"\bconnect\s*\(\s*{re.escape(end)}\s*,\s*{re.escape(start)}\s*\)", re.MULTILINE),
    ]
    matches = [match for pattern in patterns for match in pattern.finditer(masked)]
    if len(matches) != 1: raise ContractError(f"connection equation not found or ambiguous: {start}, {end}")
    match = matches[0]
    stack:list[str]=[]; pairs={")":"(","]":"[","}":"{"}; semicolon=None
    for index in range(match.end(),len(masked)):
        character=masked[index]
        if character in "([{": stack.append(character)
        elif character in pairs:
            if not stack or stack.pop()!=pairs[character]: raise ContractError("unbalanced delimiter in connection equation")
        elif character==";" and not stack:
            semicolon=index; break
    if semicolon is None: raise ContractError(f"connection equation is unterminated: {start}, {end}")
    existing=[call for call in annotation_calls(source) if match.end() <= call[0] and call[2] < semicolon]
    if len(existing)>1: raise ContractError(f"connection equation has multiple annotation clauses: {start}, {end}")
    if existing:
        _,opening,closing,_=existing[0]
        separator=", " if source[opening+1:closing].strip() else ""
        return source[:closing]+separator+entry+source[closing:]
    return source[:semicolon]+f" annotation({entry})"+source[semicolon:]


def local_type_catalog(package: str, files: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    candidates: dict[str, list[dict[str, str]]] = {}
    for item in files:
        relative = PurePosixPath(item["path"])
        qualified = ".".join((package, *relative.with_suffix("").parts))
        relative_name = ".".join(relative.with_suffix("").parts)
        members = parse_instance_declarations(item["source"])
        for alias in {qualified, relative_name, relative.stem}:
            candidates.setdefault(alias, []).append(members)
    return {alias: values[0] for alias, values in candidates.items() if len(values) == 1}


def validate_connection_endpoint(
    value: str,
    declarations: dict[str, str],
    catalog: dict[str, dict[str, str]],
    warnings: list[str],
) -> None:
    parts = endpoint_names(value)
    root = parts[0]
    if root not in declarations: raise ContractError(f"connection endpoint root is undeclared: {value}")
    current_type = declarations[root]
    for member in parts[1:]:
        members = catalog.get(current_type)
        if members is None:
            if current_type in BUILTIN_TYPES:
                raise ContractError(f"connection endpoint member is invalid for {current_type}: {value}")
            warning = f"connection endpoint member not statically resolved for external type {current_type}: {value}"
            if warning not in warnings: warnings.append(warning)
            return
        if member not in members:
            raise ContractError(f"connection endpoint member is undeclared on local type {current_type}: {value}")
        current_type = members[member]


def placement(origin: list[float], size: list[float], rotation: float = 0.0, *, icon: bool = False) -> str:
    half_x, half_y = size[0] / 2, size[1] / 2
    transform = f"origin={fmt_point(origin)}, extent={fmt_extent([[-half_x,-half_y],[half_x,half_y]])}, rotation={fmt(rotation)}"
    if icon:
        return f"Placement(transformation({transform}), iconTransformation({transform}))"
    return f"Placement(transformation({transform}))"


def auto_positions(items: list[str], direction: str, connections: list[Any] | None = None) -> dict[str, list[float]]:
    """Deterministic SCC-layered placement with declaration-order tie breaking."""
    if not items: return {}
    order={name:index for index,name in enumerate(items)}
    graph={name:[] for name in items}
    for raw in connections or []:
        if not isinstance(raw,dict): continue
        start=raw.get("from"); end=raw.get("to")
        if not isinstance(start,str) or not isinstance(end,str): continue
        start_root=endpoint_root(start); end_root=endpoint_root(end)
        if start_root in graph and end_root in graph and end_root not in graph[start_root]: graph[start_root].append(end_root)
    for values in graph.values(): values.sort(key=order.get)
    index_counter=0; stack=[]; indexes={}; low={}; on_stack=set(); components=[]
    def visit(name:str)->None:
        nonlocal index_counter
        indexes[name]=low[name]=index_counter; index_counter+=1; stack.append(name); on_stack.add(name)
        for target in graph[name]:
            if target not in indexes: visit(target); low[name]=min(low[name],low[target])
            elif target in on_stack: low[name]=min(low[name],indexes[target])
        if low[name]==indexes[name]:
            component=[]
            while True:
                value=stack.pop(); on_stack.remove(value); component.append(value)
                if value==name: break
            components.append(sorted(component,key=order.get))
    for name in items:
        if name not in indexes: visit(name)
    component_of={name:index for index,component in enumerate(components) for name in component}
    incoming={index:set() for index in range(len(components))}; outgoing={index:set() for index in range(len(components))}
    for start,targets in graph.items():
        for target in targets:
            left=component_of[start]; right=component_of[target]
            if left!=right: outgoing[left].add(right); incoming[right].add(left)
    component_key=lambda value:min(order[name] for name in components[value])
    ready=sorted((value for value in incoming if not incoming[value]),key=component_key); layer={value:0 for value in ready}
    while ready:
        current=ready.pop(0)
        for target in sorted(outgoing[current],key=component_key):
            layer[target]=max(layer.get(target,0),layer[current]+1); incoming[target].discard(current)
            if not incoming[target]:
                ready.append(target); ready.sort(key=component_key)
    grouped:dict[int,list[str]]={}
    for component_index,component in sorted(enumerate(components),key=lambda pair:component_key(pair[0])):
        grouped.setdefault(layer.get(component_index,0),[]).extend(component)
    positions={}
    max_layer=max(grouped)
    for layer_index in range(max_layer+1):
        layer_items=grouped.get(layer_index,[])
        for row,name in enumerate(layer_items):
            x=-80+(160*layer_index/max(1,max_layer)); y=(len(layer_items)-1)*32-row*64
            positions[name]=[float(y),float(-x)] if direction=="TB" else [float(x),float(y)]
    return positions


def boundary_point(origin:list[float],size:list[float],toward:list[float])->list[float]:
    dx=toward[0]-origin[0]; dy=toward[1]-origin[1]
    if dx==0 and dy==0: return list(origin)
    half_x=size[0]/2; half_y=size[1]/2
    scale=min(half_x/abs(dx) if dx else float("inf"),half_y/abs(dy) if dy else float("inf"))
    return [origin[0]+dx*scale,origin[1]+dy*scale]


def orthogonal(
    start: list[float],
    end: list[float],
    direction: str,
    track: int,
    track_count: int = 1,
) -> list[list[float]]:
    """Route one bounded, deterministic orthogonal track.

    Tracks are spread continuously across a fixed corridor, so dense graphs do
    not repeat every seventh route. A same-origin route becomes a visible
    bounded loop instead of collapsing to a zero-length line.
    """
    if track < 0 or track_count < 1 or track >= track_count:
        raise ContractError("invalid orthogonal routing track")
    fraction = (track + 1) / (track_count + 1)
    offset = (fraction - 0.5) * 24.0
    if start == end:
        gap = 12.0 + fraction * 18.0
        if direction == "TB":
            points = [start, [start[0], start[1] + gap], [start[0] + gap, start[1] + gap], [start[0] + gap, start[1]]]
        else:
            points = [start, [start[0] + gap, start[1]], [start[0] + gap, start[1] + gap], [start[0], start[1] + gap]]
        if any(abs(value) > POINT_LIMIT for routed in points for value in routed):
            raise ContractError("auto-routed connection exceeds coordinate bounds")
        return points
    if (direction == "LR" and start[1] == end[1]) or (direction == "TB" and start[0] == end[0]):
        # Collinear endpoints already form an orthogonal route. A track offset
        # would only introduce a needless dogleg and can overshoot a nearby
        # boundary connector.
        return [start, end]
    if direction == "TB":
        mid = (start[1] + end[1]) / 2 + offset
        points = [start, [start[0], mid], [end[0], mid], end]
    else:
        mid = (start[0] + end[0]) / 2 + offset
        points = [start, [mid, start[1]], [mid, end[1]], end]
    if any(abs(value) > POINT_LIMIT for routed in points for value in routed):
        raise ContractError("auto-routed connection exceeds coordinate bounds")
    return points


def self_loop_route(
    origin: list[float],
    size: list[float],
    direction: str,
    track: int,
    track_count: int,
) -> list[list[float]]:
    if track < 0 or track_count < 1 or track >= track_count:
        raise ContractError("invalid self-loop routing track")
    fraction = (track + 1) / (track_count + 1)
    gap = 12.0 + fraction * 18.0
    if direction == "TB":
        start = [origin[0] - size[0] / 4, origin[1] + size[1] / 2]
        end = [origin[0] + size[0] / 4, origin[1] + size[1] / 2]
        points = [start, [start[0], start[1] + gap], [end[0], end[1] + gap], end]
    else:
        start = [origin[0] + size[0] / 2, origin[1] + size[1] / 4]
        end = [origin[0] + size[0] / 2, origin[1] - size[1] / 4]
        points = [start, [start[0] + gap, start[1]], [end[0] + gap, end[1]], end]
    if any(abs(value) > POINT_LIMIT for routed in points for value in routed):
        raise ContractError("auto-routed self-loop exceeds coordinate bounds")
    return points


def primitive(raw: Any, index: int) -> str:
    context = f"icon[{index}]"
    common={"type","visible","origin","rotation","lineColor","fillColor","fillPattern","linePattern","thickness"}
    item = strict(raw, common|{"extent","points","text","borderPattern","radius","startAngle","endAngle","closure","smooth","arrow","fontSize","fontName","textStyle","horizontalAlignment"}, context)
    kind = item.get("type")
    if not isinstance(kind, str) or kind not in PRIMITIVES: raise ContractError(f"unsupported icon primitive: {kind}")
    allowed = {
        "Rectangle": common|{"extent","borderPattern","radius"},
        "Ellipse": common|{"extent","startAngle","endAngle","closure"},
        "Polygon": common|{"points","smooth"},
        "Line": {"type","visible","origin","rotation","points","lineColor","linePattern","thickness","arrow","smooth"},
        "Text": {"type","visible","origin","rotation","extent","text","lineColor","fontSize","fontName","textStyle","horizontalAlignment"},
    }[kind]
    item = strict(raw, allowed, context)
    args: list[str] = []
    if item.get("visible") is not None:
        if not isinstance(item["visible"],bool): raise ContractError(f"{context}.visible must be a boolean")
        args.append(f"visible={'true' if item['visible'] else 'false'}")
    if item.get("origin") is not None: args.append(f"origin={fmt_point(point(item['origin'],f'{context}.origin'))}")
    if item.get("rotation") is not None: args.append(f"rotation={fmt(rotation(item['rotation'],f'{context}.rotation'))}")
    if kind in {"Rectangle", "Ellipse"}: args.append(f"extent={fmt_extent(extent(item.get('extent'), f'{context}.extent'))}")
    elif kind == "Text": args.append(f"extent={fmt_extent(text_extent(item.get('extent'), f'{context}.extent'))}")
    else:
        points = item.get("points")
        minimum = 3 if kind == "Polygon" else 2
        if not isinstance(points, list) or len(points) < minimum or len(points) > 64:
            raise ContractError(f"{context}.points must contain {minimum}-64 points")
        args.append("points={" + ",".join(fmt_point(point(p, f"{context}.points")) for p in points) + "}")
    if kind == "Text":
        value = text(item.get("text"), f"{context}.text")
        assert isinstance(value, str)
        args.append(f'textString="{modelica_string(value)}"')
    for field, target in (("lineColor", "lineColor"), ("fillColor", "fillColor")):
        if item.get(field) is not None:
            rgb = color(item[field], f"{context}.{field}")
            if kind == "Line": target = "color"
            elif kind == "Text": target = "textColor"
            args.append(f"{target}={{{','.join(str(channel) for channel in rgb)}}}")
    if item.get("fillPattern") is not None:
        fill = item["fillPattern"]
        if not isinstance(fill, str) or fill not in {"None", "Solid", "HorizontalCylinder", "VerticalCylinder", "Sphere"}:
            raise ContractError(f"unsupported {context}.fillPattern")
        args.append(f"fillPattern=FillPattern.{fill}")
    if item.get("linePattern") is not None:
        pattern = item["linePattern"]
        if not isinstance(pattern, str) or pattern not in {"None", "Solid", "Dash", "Dot", "DashDot"}:
            raise ContractError(f"unsupported {context}.linePattern")
        args.append(f"pattern=LinePattern.{pattern}")
    if item.get("thickness") is not None:
        target = "thickness" if kind == "Line" else "lineThickness"
        args.append(f"{target}={fmt(thickness(item['thickness'], f'{context}.thickness'))}")
    if item.get("borderPattern") is not None:
        value=item["borderPattern"]
        if value not in {"None","Raised","Sunken","Engraved"}: raise ContractError(f"unsupported {context}.borderPattern")
        args.append(f"borderPattern=BorderPattern.{value}")
    if item.get("radius") is not None:
        value=number(item["radius"],f"{context}.radius")
        if value<0: raise ContractError(f"{context}.radius must be nonnegative")
        args.append(f"radius={fmt(value)}")
    for field in ("startAngle","endAngle"):
        if item.get(field) is not None: args.append(f"{field}={fmt(rotation(item[field],f'{context}.{field}'))}")
    if item.get("closure") is not None:
        value=item["closure"]
        if value not in {"None","Chord","Radial"}: raise ContractError(f"unsupported {context}.closure")
        args.append(f"closure=EllipseClosure.{value}")
    if item.get("smooth") is not None:
        value=item["smooth"]
        if value not in {"None","Bezier"}: raise ContractError(f"unsupported {context}.smooth")
        args.append(f"smooth=Smooth.{value}")
    if item.get("arrow") is not None:
        value=item["arrow"]
        if not isinstance(value,list) or len(value)!=2 or any(item not in {"None","Open","Filled","Half"} for item in value): raise ContractError(f"{context}.arrow must contain two Arrow enum names")
        args.append(f"arrow={{Arrow.{value[0]},Arrow.{value[1]}}}")
    if item.get("fontSize") is not None:
        value=number(item["fontSize"],f"{context}.fontSize")
        if value<0 or value>512: raise ContractError(f"{context}.fontSize must be 0-512")
        args.append(f"fontSize={fmt(value)}")
    if item.get("fontName") is not None:
        value=text(item["fontName"],f"{context}.fontName"); assert isinstance(value,str)
        args.append(f'fontName="{modelica_string(value)}"')
    if item.get("textStyle") is not None:
        value=item["textStyle"]
        if not isinstance(value,list) or len(value)!=len(set(value)) or any(style not in {"Bold","Italic","Underline"} for style in value): raise ContractError(f"{context}.textStyle is invalid")
        args.append("textStyle={"+",".join(f"TextStyle.{style}" for style in value)+"}")
    if item.get("horizontalAlignment") is not None:
        value=item["horizontalAlignment"]
        if value not in {"Left","Center","Right"}: raise ContractError(f"unsupported {context}.horizontalAlignment")
        args.append(f"horizontalAlignment=TextAlignment.{value}")
    return f"{kind}({', '.join(args)})"


def _visual_metadata_line(visual:dict[str,Any],source_without_metadata:str)->str:
    payload={"version":1,"visual":visual,"sourceSha256":hashlib.sha256(source_without_metadata.encode("utf-8")).hexdigest()}
    encoded=base64.urlsafe_b64encode(json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True).encode("utf-8")).decode("ascii").rstrip("=")
    return PORTABLE_VISUAL_PREFIX+encoded


def strip_portable_visual_metadata(source:str)->str:
    lines=source.splitlines(keepends=True)
    return "".join(line for line in lines if not line.lstrip().startswith(PORTABLE_VISUAL_PREFIX))


def recover_portable_visual(source:str)->dict[str,Any]|None:
    lines=source.splitlines(keepends=True)
    markers=[(index,line.strip()) for index,line in enumerate(lines) if line.lstrip().startswith(PORTABLE_VISUAL_PREFIX)]
    if not markers: return None
    if len(markers)!=1: raise ContractError("portable visual metadata must appear exactly once")
    _,marker=markers[0]; encoded=marker[len(PORTABLE_VISUAL_PREFIX):]
    try:
        padding="="*((4-len(encoded)%4)%4)
        payload=json.loads(base64.urlsafe_b64decode(encoded+padding).decode("utf-8"))
    except (ValueError,UnicodeError,json.JSONDecodeError) as exc: raise ContractError("portable visual metadata is malformed") from exc
    payload=strict(payload,{"version","visual","sourceSha256"},"portable visual metadata")
    if payload.get("version")!=1: raise ContractError("unsupported portable visual metadata version")
    digest=payload.get("sourceSha256")
    if not isinstance(digest,str) or not re.fullmatch(r"[0-9a-f]{64}",digest): raise ContractError("portable visual metadata source hash is invalid")
    without=strip_portable_visual_metadata(source)
    if hashlib.sha256(without.encode("utf-8")).hexdigest()!=digest: raise ContractError("portable visual metadata does not match the Modelica source")
    return strict(payload.get("visual"),VISUAL_KEYS,"portable visual")


def apply_visual(
    source: str,
    visual_raw: Any,
    *,
    relayout: bool,
    replace: bool,
    catalog: dict[str, dict[str, str]],
    warnings: list[str],
) -> tuple[str, dict[str, Any]]:
    visual = strict(visual_raw, VISUAL_KEYS, "visual")
    existing_graphics = graphical_annotation_names(source)
    if existing_graphics and not replace:
        raise ContractError("source already has graphical annotations; pass --replace-graphics")
    if replace: source = strip_graphical_annotations(strip_portable_visual_metadata(source))
    direction = visual.get("direction", "LR")
    if not isinstance(direction, str) or direction not in {"LR", "TB"}:
        raise ContractError("visual.direction must be LR or TB")
    coord = extent(visual.get("coordinateSystem", [[-100,-100],[100,100]]), "coordinateSystem")
    declarations = parse_instance_declarations(source)
    instances = set(declarations)
    components_raw = visual.get("components", [])
    connectors_raw = visual.get("connectors", [])
    connections_raw = visual.get("connections", [])
    icons_raw = visual.get("icon", [])
    if not all(isinstance(v, list) for v in (components_raw, connectors_raw, connections_raw, icons_raw)):
        raise ContractError("visual collections must be arrays")
    if len(components_raw)>512 or len(connectors_raw)>512 or len(icons_raw)>512 or len(connections_raw)>4000:
        raise ContractError("visual collections exceed their documented limits")
    component_items = [strict(raw, {"name","origin","size","rotation"}, f"components[{index}]") for index, raw in enumerate(components_raw)]
    component_names = [identifier(item.get("name"), f"components[{index}].name") for index, item in enumerate(component_items)]
    if len(component_names) != len(set(component_names)): raise ContractError("duplicate visual component")
    missing = set(component_names) - instances
    if missing: raise ContractError(f"visual components are undeclared: {sorted(missing)}")
    positions = auto_positions(component_names, direction, connections_raw)
    placement_by_name: dict[str, list[float]] = {}
    size_by_name: dict[str, list[float]] = {}
    normalized_components: list[dict[str,Any]] = []
    for index, item in enumerate(component_items):
        name = component_names[index]
        supplied_origin = point(item["origin"], f"components[{index}].origin") if item.get("origin") is not None else None
        size = positive_size(item.get("size", [30,20]), f"components[{index}].size")
        angle = rotation(item.get("rotation", 0), f"components[{index}].rotation")
        origin = positions[name] if relayout or supplied_origin is None else supplied_origin
        if any(abs(origin[axis]) + size[axis] / 2 > POINT_LIMIT for axis in (0, 1)):
            raise ContractError(f"components[{index}] extends beyond coordinate bounds")
        placement_by_name[name] = origin
        size_by_name[name] = size
        normalized_components.append({"name":name,"origin":origin,"size":size,"rotation":angle})
        source = add_declaration_annotation(source, name, placement(origin, size, angle))
    connector_positions: dict[str, list[float]] = {}
    connector_names: list[str] = []
    normalized_connectors: list[dict[str,Any]] = []
    for index, raw in enumerate(connectors_raw):
        item = strict(raw, {"name","side","offset","size"}, f"connectors[{index}]")
        name = identifier(item.get("name"), f"connectors[{index}].name")
        if name in connector_names: raise ContractError(f"duplicate visual connector: {name}")
        if name in component_names: raise ContractError(f"visual identifier is both a component and connector: {name}")
        connector_names.append(name)
        if name not in instances: raise ContractError(f"connector is undeclared: {name}")
        side = item.get("side")
        if not isinstance(side, str) or side not in {"left","right","top","bottom"}:
            raise ContractError("connector.side must be left/right/top/bottom")
        offset = number(item.get("offset", 0), f"connectors[{index}].offset")
        min_x, max_x = sorted((coord[0][0], coord[1][0])); min_y, max_y = sorted((coord[0][1], coord[1][1]))
        lower, upper = (min_x, max_x) if side in {"top", "bottom"} else (min_y, max_y)
        if not lower <= offset <= upper:
            raise ContractError(f"connectors[{index}].offset is outside the coordinate system")
        origin = {"left":[min_x,offset], "right":[max_x,offset], "top":[offset,max_y], "bottom":[offset,min_y]}[side]
        connector_positions[name] = origin
        size = positive_size(item.get("size", [10,10]), f"connectors[{index}].size")
        size_by_name[name] = size
        normalized_connectors.append({"name":name,"side":side,"offset":offset,"size":size})
        source = add_declaration_annotation(source, name, placement(origin, size, 0, icon=True))
    all_positions = {**placement_by_name, **connector_positions}
    seen_connections: set[tuple[str,str]] = set()
    normalized_connections: list[dict[str,Any]] = []
    for index, raw in enumerate(connections_raw):
        item = strict(raw, {"from","to","points","color","pattern","thickness"}, f"connections[{index}]")
        start = endpoint(item.get("from"), f"connections[{index}].from")
        end = endpoint(item.get("to"), f"connections[{index}].to")
        validate_connection_endpoint(start, declarations, catalog, warnings)
        validate_connection_endpoint(end, declarations, catalog, warnings)
        key = tuple(sorted((start, end)))
        if key in seen_connections: raise ContractError(f"duplicate connection: {start} -> {end}")
        seen_connections.add(key)
        points_raw = item.get("points")
        if points_raw is None:
            start_root=endpoint_root(start); end_root=endpoint_root(end)
            start_pos = all_positions.get(start_root); end_pos = all_positions.get(end_root)
            if start_pos is None or end_pos is None: raise ContractError("auto-routing requires placed endpoint roots")
            if start_root == end_root:
                points = self_loop_route(start_pos, size_by_name.get(start_root, [1, 1]), direction, index, len(connections_raw))
            else:
                # Component connector geometry is not available from this
                # lightweight source model, so route components to their box
                # boundary. Public class connectors, however, are already
                # positioned on the class boundary: use their actual origin.
                # Shrinking both endpoints by the connector symbol size can
                # collapse adjacent endpoints to the same coordinate and turn
                # an ordinary connection into a misleading self-loop.
                routed_start = (
                    start_pos
                    if start_root in connector_positions
                    else boundary_point(start_pos, size_by_name.get(start_root, [1, 1]), end_pos)
                )
                routed_end = (
                    end_pos
                    if end_root in connector_positions
                    else boundary_point(end_pos, size_by_name.get(end_root, [1, 1]), start_pos)
                )
                points = orthogonal(routed_start,routed_end,direction,index,len(connections_raw))
        else:
            if not isinstance(points_raw,list) or not 2 <= len(points_raw) <= 16: raise ContractError("connection points require 2-16 points")
            points = [point(raw_point, f"connections[{index}].points") for raw_point in points_raw]
        rgb = color(item.get("color", "blue"), f"connections[{index}].color")
        pattern_name = item.get("pattern","Solid")
        if not isinstance(pattern_name, str) or pattern_name not in {"Solid","Dash","Dot","DashDot"}:
            raise ContractError("invalid connection pattern")
        line_thickness = thickness(item.get("thickness",0.5), f"connections[{index}].thickness")
        normalized_connections.append({"from":start,"to":end,"points":points,"color":rgb,"pattern":pattern_name,"thickness":line_thickness})
        ann = f"Line(points={{{','.join(fmt_point(p) for p in points)}}}, color={{{','.join(str(channel) for channel in rgb)}}}, pattern=LinePattern.{pattern_name}, thickness={fmt(line_thickness)})"
        source = replace_connect_annotation(source, start, end, ann)
    icon_graphics = [primitive(raw,i) for i,raw in enumerate(icons_raw)]
    if not icon_graphics:
        icon_graphics = [f'Rectangle(extent={fmt_extent(coord)}, lineColor={{35,90,160}}, fillColor={{245,248,252}}, fillPattern=FillPattern.Solid)', f'Text(extent={fmt_extent([[-90,-20],[90,20]])}, textString="%name", textColor={{35,55,75}})']
    annotation = ("  annotation(" + f"Icon(coordinateSystem(extent={fmt_extent(coord)}), graphics={{{','.join(icon_graphics)}}}), " + f"Diagram(coordinateSystem(extent={fmt_extent(coord)})));\n")
    end_matches = list(re.finditer(r"(?m)^\s*end\s+([A-Za-z_][A-Za-z0-9_]*)\s*;\s*$", modelica_mask(source)))
    if not end_matches: raise ContractError("cannot find class end statement")
    last = end_matches[-1]; source = source[:last.start()] + annotation + source[last.start():]
    normalized_visual={"direction":direction,"coordinateSystem":coord,"components":normalized_components,"connectors":normalized_connectors,"connections":normalized_connections,"icon":icons_raw}
    end_matches = list(re.finditer(r"(?m)^\s*end\s+([A-Za-z_][A-Za-z0-9_]*)\s*;\s*$", modelica_mask(source)))
    last=end_matches[-1]
    marker="  "+_visual_metadata_line(normalized_visual,source)+"\n"
    source=source[:last.start()]+marker+source[last.start():]
    return source, normalized_visual


def normalize(
    payload: Any,
    *,
    relayout: bool = False,
    replace: bool = False,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    warning_sink = warnings if warnings is not None else []
    root = strict(payload,ROOT_KEYS,"project")
    if root.get("version") != VERSION: raise ContractError(f"version must be {VERSION}")
    package = identifier(root.get("package"),"package")
    description = text(root.get("description"),"description")
    assert isinstance(description, str)
    msl = text(root.get("mslVersion"),"mslVersion")
    assert isinstance(msl, str)
    if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?",msl): raise ContractError("invalid mslVersion")
    language = text(root.get("languageVersion"),"languageVersion")
    assert isinstance(language, str)
    if not re.fullmatch(r"\d+\.\d+",language): raise ContractError("invalid languageVersion")
    dependencies_raw = root.get("dependencies")
    if not isinstance(dependencies_raw,list) or len(dependencies_raw)>512: raise ContractError("dependencies must be an array with at most 512 entries")
    dependencies: list[dict[str,str]] = []
    dependency_names: set[str] = set()
    for index, raw in enumerate(dependencies_raw):
        item = strict(raw,{"name","version"},f"dependencies[{index}]")
        name = identifier(item.get("name"),f"dependencies[{index}].name",qualified=True)
        version = text(item.get("version"),f"dependencies[{index}].version")
        assert isinstance(version, str)
        if name == "Modelica": raise ContractError("declare the Modelica dependency through mslVersion, not dependencies")
        if name in dependency_names: raise ContractError(f"duplicate dependency: {name}")
        dependency_names.add(name)
        dependencies.append({"name":name,"version":version})
    files_raw = root.get("files")
    if not isinstance(files_raw,list) or not 1 <= len(files_raw) <= 512: raise ContractError("files must contain 1-512 entries")
    parsed_files: list[dict[str,Any]]=[]; seen:set[str]=set()
    for index,raw in enumerate(files_raw):
        item = strict(raw,FILE_KEYS,f"files[{index}]")
        path = create_modelica_project.safe_relative_modelica_path(item.get("path")).as_posix()
        if path in seen: raise ContractError(f"duplicate file: {path}")
        seen.add(path)
        source = text(item.get("source"),"file.source"); assert isinstance(source,str)
        kind = item.get("kind", "model")
        if not isinstance(kind, str) or not CLASS_KIND.fullmatch(kind):
            raise ContractError(f"files[{index}].kind must be a standard Modelica class kind")
        documentation_raw = item.get("documentation")
        documentation = text(documentation_raw, f"files[{index}].documentation", optional=True)
        example = item.get("example", False)
        test = item.get("test", False)
        if not isinstance(example, bool): raise ContractError(f"files[{index}].example must be a boolean")
        if not isinstance(test, bool): raise ContractError(f"files[{index}].test must be a boolean")
        parsed_files.append({
            "path": path,
            "source": source,
            "kind": kind,
            "documentation": documentation,
            "example": example,
            "test": test,
            "visual": item.get("visual"),
        })
    catalog = local_type_catalog(package, parsed_files)
    files: list[dict[str,Any]]=[]
    for item in parsed_files:
        source = item["source"]
        visual = item.get("visual")
        normalized_visual = None
        if visual is not None:
            source,normalized_visual=apply_visual(
                source,
                visual,
                relayout=relayout,
                replace=replace,
                catalog=catalog,
                warnings=warning_sink,
            )
        files.append({
            "path":item["path"],
            "source":source.rstrip()+"\n",
            "kind":item["kind"],
            "documentation":item["documentation"],
            "example":item["example"],
            "test":item["test"],
            "visual":normalized_visual,
        })
    return {"version":VERSION,"package":package,"description":description,"mslVersion":msl,"languageVersion":language,"dependencies":dependencies,"files":files}


def public_json(document: dict[str,Any]) -> str:
    return json.dumps(document,ensure_ascii=False,indent=2,sort_keys=True)+"\n"


def reject_symlink_ancestors(path:Path)->None:
    current=path
    while current.parent != current:
        if current.is_symlink() and current not in ALLOWED_SYSTEM_SYMLINKS: raise ContractError(f"symbolic-link path component is not allowed: {current}")
        current=current.parent


def read_input(path:Path)->str:
    if path.is_symlink(): raise ContractError("input must not be a symbolic link")
    reject_symlink_ancestors(path.parent)
    if path.stat().st_size>MAX_INPUT_BYTES: raise ContractError("input exceeds 8 MiB")
    with path.open("r",encoding="utf-8",newline="") as handle: return handle.read()


def cli_path(raw: str, field: str) -> Path:
    path = Path(raw).expanduser()
    if ".." in path.parts: raise ContractError(f"{field} must not contain '..' traversal")
    return path.absolute()


def export_project(document: dict[str,Any], output: Path, overwrite: bool) -> Path:
    v1={"package":document["package"],"description":document["description"],"mslVersion":document["mslVersion"],"files":[{"path":x["path"],"source":x["source"]} for x in document["files"]]}
    if ".." in output.parts: raise ContractError("unsafe output path")
    reject_symlink_ancestors(output.parent)
    if output.is_symlink(): raise ContractError("output must not be a symbolic link")
    output_existed = output.exists()
    output.mkdir(parents=True,exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix=".modelica-v2-",dir=output) as raw:
            staged=create_modelica_project.build_tree(v1,Path(raw))
            escaped=modelica_string(document["description"])
            uses=[f'Modelica(version = "{document["mslVersion"]}")']
            uses.extend(
                f'{item["name"]}(version = "{modelica_string(item["version"])}")'
                for item in document["dependencies"]
            )
            package_name=document["package"]
            (staged/"package.mo").write_text(
                f'within;\npackage {package_name} "{escaped}"\n  annotation(uses({", ".join(uses)}));\nend {package_name};\n',
                encoding="utf-8", newline="\n"
            )
            report=static_check_modelica.check_target(staged)
            if report.errors: raise ContractError("generated project failed validation: "+"; ".join(report.errors))
            destination=output/document["package"]
            create_modelica_project.install_tree(staged,destination,overwrite)
    except BaseException:
        if not output_existed and output.is_dir() and not any(output.iterdir()): output.rmdir()
        raise
    return destination


def import_project(root: Path, warnings: list[str] | None = None) -> dict[str,Any]:
    warning_sink=warnings if warnings is not None else []
    if root.is_symlink(): raise ContractError("project must not be a symbolic link")
    reject_symlink_ancestors(root.parent)
    for candidate in root.rglob("*"):
        if candidate.is_symlink(): raise ContractError(f"project contains a symbolic link: {candidate.relative_to(root)}")
    report=static_check_modelica.check_target(root)
    if report.errors: raise ContractError("project failed static validation: "+"; ".join(report.errors))
    package_source=read_input(root/"package.mo")
    quoted=r'((?:\\.|[^"\\])*)'
    match=re.search(rf'\bpackage\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:"{quoted}")?',package_source)
    if not match: raise ContractError("cannot identify package")
    package_name=identifier(match.group(1),"package")
    description=modelica_unescape(match.group(2),"package description") if match.group(2) is not None else f"{package_name} package"
    dependencies=[]; msl_version=None
    masked_package=modelica_mask(package_source)
    uses_entries=[
        (entry_start,entry_end)
        for _,_,_,entries in annotation_calls(package_source)
        for entry_start,entry_end,name in entries
        if name=="uses"
    ]
    if len(uses_entries)>1: raise ContractError("package.mo declares more than one uses annotation")
    if uses_entries:
        entry_start,entry_end=uses_entries[0]
        uses_head=re.match(r"\s*uses\s*\(",masked_package[entry_start:entry_end])
        assert uses_head is not None
        opening=entry_start+uses_head.end()-1
        closing=find_matching_parenthesis(masked_package,opening,"uses annotation")
        if masked_package[closing+1:entry_end].strip():
            raise ContractError("uses annotation contains unsupported trailing content")
        for entry_start,entry_end in split_top_level(masked_package,opening+1,closing,"uses annotation"):
            entry=package_source[entry_start:entry_end].strip()
            dependency_match=re.fullmatch(rf'([A-Za-z_][A-Za-z0-9_.]*)\s*\(\s*version\s*=\s*"{quoted}"\s*\)',entry,re.DOTALL)
            if dependency_match is None: raise ContractError("uses annotation contains an unsupported dependency entry")
            dep_name=identifier(dependency_match.group(1),"dependency name",qualified=True)
            dep_version=modelica_unescape(dependency_match.group(2),f"dependency {dep_name} version")
            if dep_name=="Modelica":
                if msl_version is not None: raise ContractError("uses annotation declares Modelica more than once")
                if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?",dep_version): raise ContractError("Modelica dependency has an invalid version")
                msl_version=dep_version
            else:
                if any(item["name"]==dep_name for item in dependencies): raise ContractError(f"duplicate dependency: {dep_name}")
                dependencies.append({"name":dep_name,"version":dep_version})
    if msl_version is None:
        msl_version="4.1.0"
        warning_sink.append("package.mo does not declare a Modelica version; canonical import used the documented 4.1.0 fallback")
    files=[]
    for path in sorted(root.rglob("*.mo")):
        if path.name=="package.mo": continue
        source=read_input(path); boundaries=class_boundaries(source)
        top=[item for item in boundaries if item["depth"]==0]
        if len(top)!=1: raise ContractError(f"cannot uniquely identify the top-level class in {path.relative_to(root)}")
        metadata_ignored = False
        try:
            visual=recover_portable_visual(source)
        except ContractError as exc:
            # Portable metadata is advisory. A stale or malformed marker must
            # not make otherwise valid source unimportable or cause source
            # rewriting; preserve it literally and lower the evidence level.
            visual=None
            metadata_ignored=True
            warning_sink.append(
                f"{path.relative_to(root).as_posix()}: portable visual metadata was ignored and source was preserved: {exc}"
            )
        if visual is None and not metadata_ignored and graphical_annotation_names(source):
            warning_sink.append(f"{path.relative_to(root).as_posix()}: standard graphical annotations were preserved as source but their visual meaning was not interpreted")
        canonical_source=strip_graphical_annotations(strip_portable_visual_metadata(source)) if visual is not None else source
        files.append({"path":path.relative_to(root).as_posix(),"source":canonical_source,"kind":top[0]["kind"],"documentation":None,"example":False,"test":False,"visual":visual})
    document={"version":VERSION,"package":package_name,"description":description,"mslVersion":msl_version,"languageVersion":"3.7","dependencies":dependencies,"files":files}
    validation_warnings:list[str]=[]
    normalize(document,warnings=validation_warnings)
    for warning in validation_warnings:
        if warning not in warning_sink: warning_sink.append(warning)
    return document


def output_record(path:Path)->dict[str,Any]:
    if path.is_dir():
        digest=hashlib.sha256(); size=0
        for file_path in sorted(candidate for candidate in path.rglob("*") if candidate.is_file()):
            relative=file_path.relative_to(path).as_posix().encode("utf-8")
            data=file_path.read_bytes(); size+=len(data)
            digest.update(len(relative).to_bytes(4,"big")); digest.update(relative); digest.update(len(data).to_bytes(8,"big")); digest.update(data)
        return {"path":str(path),"sha256":digest.hexdigest(),"bytes":size,"kind":"directory"}
    return {"path":str(path),"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size,"kind":"file"}


def _svg_rgb(value:Any,field:str)->str:
    red,green,blue=color(value,field)
    return f"rgb({red},{green},{blue})"


def _icon_preview_parts(visual:dict[str,Any],panel_x:float,panel_y:float,panel_size:float,class_name:str)->list[str]:
    """Render the supported icon subset into a clearly labelled inset.

    This is deliberately a structural rendering, not a native-tool parity
    claim. All text and attribute values are generated from validated data.
    """
    coord=visual["coordinateSystem"]
    min_x,max_x=sorted((coord[0][0],coord[1][0])); min_y,max_y=sorted((coord[0][1],coord[1][1]))
    padding=14.0
    def screen(value:list[float])->tuple[float,float]:
        x=panel_x+padding+(value[0]-min_x)/max(1e-9,max_x-min_x)*(panel_size-2*padding)
        y=panel_y+panel_size-padding-(value[1]-min_y)/max(1e-9,max_y-min_y)*(panel_size-2*padding)
        return x,y
    def transformed(raw_point:list[float],item:dict[str,Any])->list[float]:
        origin=point(item.get("origin",[0,0]),"preview icon origin")
        angle=math.radians(rotation(item.get("rotation",0),"preview icon rotation"))
        cosine=math.cos(angle); sine=math.sin(angle)
        return [origin[0]+raw_point[0]*cosine-raw_point[1]*sine,origin[1]+raw_point[0]*sine+raw_point[1]*cosine]
    def line_style(item:dict[str,Any],field:str)->str:
        stroke=_svg_rgb(item.get("lineColor","black"),field)
        pattern=item.get("linePattern","Solid")
        if pattern=="None": return 'stroke="none"'
        dash={"Dash":"10 6","Dot":"2 5","DashDot":"10 5 2 5","DashDotDot":"10 4 2 4 2 4"}.get(pattern)
        thickness_value=float(item.get("thickness",0.25))
        suffix=f' stroke-dasharray="{dash}"' if dash else ""
        return f'stroke="{stroke}" stroke-width="{max(1.0,thickness_value*2):.2f}"{suffix}'
    def fill_style(item:dict[str,Any])->str:
        pattern=item.get("fillPattern","None")
        if pattern=="None" or item.get("fillColor") is None: return 'fill="none"'
        return f'fill="{_svg_rgb(item["fillColor"],"preview icon fillColor")}" fill-opacity="0.82"'
    icon_items=visual.get("icon",[])
    if not icon_items:
        icon_items=[
            {"type":"Rectangle","extent":coord,"lineColor":[35,90,160],"fillColor":[245,248,252],"fillPattern":"Solid"},
            {"type":"Text","extent":[[-90,-20],[90,20]],"text":"%name","lineColor":[35,55,75]},
        ]
    parts=[f'<rect x="{panel_x:.2f}" y="{panel_y:.2f}" width="{panel_size:.2f}" height="{panel_size:.2f}" rx="14" fill="#f5f8fc" stroke="#4fa9ff" stroke-width="2"/>']
    for index,item in enumerate(icon_items):
        if item.get("visible",True) is False: continue
        kind=item["type"]
        line=line_style(item,f"icon[{index}].lineColor")
        fill=fill_style(item)
        if kind in {"Rectangle","Text"}:
            raw_extent=text_extent(item.get("extent"),f"icon[{index}].extent") if kind=="Text" else extent(item.get("extent"),f"icon[{index}].extent")
            corners=[raw_extent[0],[raw_extent[1][0],raw_extent[0][1]],raw_extent[1],[raw_extent[0][0],raw_extent[1][1]]]
            points_value=[screen(transformed(value,item)) for value in corners]
            if kind=="Rectangle":
                parts.append('<polygon points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in points_value)+f'" {line} {fill}/>')
            else:
                centre=screen(transformed([(raw_extent[0][0]+raw_extent[1][0])/2,(raw_extent[0][1]+raw_extent[1][1])/2],item))
                font_size=float(item.get("fontSize",0))
                font_size=font_size if font_size>0 else 13.0
                raw_value=str(item.get("text",""))
                value=html.escape(class_name if raw_value=="%name" else raw_value)
                parts.append(f'<text x="{centre[0]:.2f}" y="{centre[1]+font_size/3:.2f}" text-anchor="middle" font-size="{min(font_size,28):.2f}" fill="{_svg_rgb(item.get("lineColor","black"),f"icon[{index}].lineColor")}">{value}</text>')
        elif kind=="Ellipse":
            raw_extent=extent(item.get("extent"),f"icon[{index}].extent")
            centre_raw=[(raw_extent[0][0]+raw_extent[1][0])/2,(raw_extent[0][1]+raw_extent[1][1])/2]
            centre=screen(transformed(centre_raw,item))
            edge_x=screen(transformed([raw_extent[1][0],centre_raw[1]],item)); edge_y=screen(transformed([centre_raw[0],raw_extent[1][1]],item))
            radius_x=math.dist(centre,edge_x); radius_y=math.dist(centre,edge_y)
            angle=-float(item.get("rotation",0))
            parts.append(f'<ellipse cx="{centre[0]:.2f}" cy="{centre[1]:.2f}" rx="{radius_x:.2f}" ry="{radius_y:.2f}" transform="rotate({angle:.2f} {centre[0]:.2f} {centre[1]:.2f})" {line} {fill}/>')
        else:
            points_value=[screen(transformed(point(value,f"icon[{index}].points"),item)) for value in item.get("points",[])]
            tag="polygon" if kind=="Polygon" else "polyline"
            tag_fill=fill if kind=="Polygon" else 'fill="none"'
            parts.append(f'<{tag} points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in points_value)+f'" {line} {tag_fill}/>')
    return parts


def visual_svg(document:dict[str,Any],class_selector:str|None)->str:
    candidates=[item for item in document["files"] if item.get("visual") is not None]
    if class_selector:
        def aliases(item:dict[str,Any])->set[str]:
            relative=PurePosixPath(item["path"]); without=relative.with_suffix("")
            return {
                item["path"],
                without.as_posix(),
                ".".join(without.parts),
                ".".join((document["package"],*without.parts)),
                relative.stem,
            }
        candidates=[item for item in candidates if class_selector in aliases(item)]
    if len(candidates)!=1: raise ContractError("preview requires one unambiguous visually annotated class; use --class")
    item=candidates[0]; visual=item["visual"]; coord=visual["coordinateSystem"]
    min_x,max_x=sorted((coord[0][0],coord[1][0])); min_y,max_y=sorted((coord[0][1],coord[1][1]))
    width=1240; diagram_width=980; height=700; margin=70
    def xy(point_value:list[float])->tuple[float,float]:
        x=margin+(point_value[0]-min_x)/max(1e-9,max_x-min_x)*(diagram_width-2*margin)
        y=height-margin-(point_value[1]-min_y)/max(1e-9,max_y-min_y)*(height-2*margin)
        return x,y
    components={entry["name"]:entry for entry in visual.get("components",[])}
    connectors={entry["name"]:entry for entry in visual.get("connectors",[])}
    computed=auto_positions(list(components),visual.get("direction","LR"),visual.get("connections",[]))
    origins={name:(entry.get("origin") or computed.get(name,[0,0])) for name,entry in components.items()}
    for name,entry in connectors.items():
        side=entry["side"]; offset=float(entry.get("offset",0)); origins[name]={"left":[min_x,offset],"right":[max_x,offset],"top":[offset,max_y],"bottom":[offset,min_y]}[side]
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">','<rect width="100%" height="100%" fill="#09111f"/>','<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.frame{fill:#111d32;stroke:#4fa9ff;stroke-width:2}.connector{fill:#ffb454;stroke:#fff0ce;stroke-width:1.5}.wire{fill:none;stroke:#8f7cff;stroke-width:3}.label{fill:#f4f8ff;font-size:15px}.meta{fill:#9fb0d0;font-size:12px}</style>',f'<text class="label" x="32" y="34">{html.escape(item["path"])}</text>', '<text class="meta" x="32" y="54">portable standard Modelica visual structure · static preview</text>']
    for index,connection in enumerate(visual.get("connections",[])):
        points=connection.get("points")
        if points is None:
            start=origins.get(endpoint_root(connection["from"])); end=origins.get(endpoint_root(connection["to"]))
            if start is None or end is None: continue
            points=orthogonal(start,end,visual.get("direction","LR"),index,len(visual.get("connections",[])))
        screen=[xy(value) for value in points]
        parts.append('<polyline class="wire" points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in screen)+'"/>')
    for name,entry in components.items():
        origin=origins[name]; size=entry.get("size",[30,20]); x1,y1=xy([origin[0]-size[0]/2,origin[1]+size[1]/2]); x2,y2=xy([origin[0]+size[0]/2,origin[1]-size[1]/2])
        box_width=x2-x1; max_characters=max(4,int((box_width-20)/8)); display=name if len(name)<=max_characters else name[:max(1,max_characters-1)]+"…"
        parts.append(f'<g><title>{html.escape(name)}</title><rect class="frame" x="{x1:.2f}" y="{y1:.2f}" width="{box_width:.2f}" height="{y2-y1:.2f}" rx="10"/>')
        parts.append(f'<text class="label" x="{x1+10:.2f}" y="{(y1+y2)/2+5:.2f}">{html.escape(display)}</text></g>')
    for name,entry in connectors.items():
        x,y=xy(origins[name]); side=entry["side"]
        if side=="left": label_x,label_y,anchor=x-12,y+4,"end"
        elif side=="right": label_x,label_y,anchor=x+12,y+4,"start"
        elif side=="top": label_x,label_y,anchor=x,y-14,"middle"
        else: label_x,label_y,anchor=x,y+24,"middle"
        parts.append(f'<circle class="connector" cx="{x:.2f}" cy="{y:.2f}" r="8"/>')
        parts.append(f'<text class="meta" x="{label_x:.2f}" y="{label_y:.2f}" text-anchor="{anchor}">{html.escape(name)}</text>')
    parts.append('<text class="meta" x="1010" y="82">Icon layer · structural approximation</text>')
    parts.extend(_icon_preview_parts(visual,1000,96,210,PurePosixPath(item["path"]).stem))
    parts.append('</svg>')
    return "\n".join(parts)+"\n"


def preview_project(source:Path,output:Path,format_name:str,class_selector:str|None,overwrite:bool)->dict[str,Any]:
    warnings=[]
    if source.suffix.lower()==".json": document=normalize(json.loads(read_input(source)),warnings=warnings)
    else: document=import_project(source,warnings)
    svg=visual_svg(document,class_selector)
    if format_name=="html":
        if output.suffix.lower()!=".html": raise ContractError("HTML preview output must end in .html")
        body='<!doctype html>\n<meta charset="utf-8">\n<title>Modelica structural preview</title>\n<style>html{background:#09111f}body{margin:0;padding:24px}svg{max-width:100%;height:auto}</style>\n'+svg
    else:
        if output.suffix.lower()!=".svg": raise ContractError("SVG preview output must end in .svg")
        body=svg
    atomic(output,body,overwrite)
    return {"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":[{"code":"modelica.visual-uninterpreted","severity":"warning","path":"$","message":warning} for warning in warnings],"changes":[],"losses":[],"evidence":"previewed"}


def _expected_within(package:str,relative:PurePosixPath)->str:
    parent=".".join((package,*relative.parent.parts)) if relative.parent.parts else package
    return f"within {parent};"


def edit_project(project:Path,patch_path:Path,output:Path,overwrite:bool)->dict[str,Any]:
    warnings=[]; document=import_project(project,warnings)
    patch=strict(json.loads(read_input(patch_path)),{"version","operations"},"edit patch")
    if patch.get("version")!=1: raise ContractError("edit patch version must be 1")
    operations=patch.get("operations")
    if not isinstance(operations,list) or not operations: raise ContractError("edit patch operations must be a non-empty array")
    if output.is_symlink(): raise ContractError("edit output must not be a symbolic link")
    reject_symlink_ancestors(output.parent)
    project_resolved=project.resolve(strict=True); output_resolved=output.resolve(strict=False)
    if output_resolved==project_resolved or project_resolved in output_resolved.parents:
        raise ContractError("edit output must be outside the input project")
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="modelica-edit-",dir=output.parent) as raw_directory:
        staged=Path(raw_directory)/document["package"]
        shutil.copytree(project,staged,symlinks=False)
        changes=[]
        files_by_path={item["path"]:item for item in document["files"]}
        catalog=local_type_catalog(document["package"],document["files"])
        for index,raw in enumerate(operations):
            operation=strict(raw,{"action","path","visual","replaceGraphics","relayout","source","kind","documentation","example","test","within","lineEndings"},f"operations[{index}]")
            action=operation.get("action")
            relative=create_modelica_project.safe_relative_modelica_path(operation.get("path")); relative_name=relative.as_posix(); target=staged.joinpath(*relative.parts)
            if action=="set-visual":
                allowed={"action","path","visual","replaceGraphics","relayout"}
                strict(raw,allowed,f"operations[{index}]")
                if relative_name not in files_by_path or not target.is_file(): raise ContractError(f"visual edit target does not exist: {relative_name}")
                source=read_input(target)
                relayout=boolean(operation["relayout"],f"operations[{index}].relayout") if "relayout" in operation else False
                replace_graphics=boolean(operation["replaceGraphics"],f"operations[{index}].replaceGraphics") if "replaceGraphics" in operation else False
                revised,visual=apply_visual(source,operation.get("visual"),relayout=relayout,replace=replace_graphics,catalog=catalog,warnings=warnings)
                with target.open("w",encoding="utf-8",newline="") as handle: handle.write(revised)
                files_by_path[relative_name]["source"]=revised; files_by_path[relative_name]["visual"]=visual
                changes.append(f"set-visual:{relative_name}")
            elif action=="add-file":
                allowed={"action","path","source","kind","documentation","example","test"}
                item=strict(raw,allowed,f"operations[{index}]")
                if target.exists(): raise ContractError(f"add-file target already exists: {relative_name}")
                if not target.parent.is_dir(): raise ContractError("add-file currently requires an existing package directory")
                source=text(item.get("source"),f"operations[{index}].source"); assert isinstance(source,str)
                boundaries=class_boundaries(source); top=[entry for entry in boundaries if entry["depth"]==0]
                if len(top)!=1 or top[0]["name"]!=relative.stem: raise ContractError("added file must contain one top-level class matching its filename")
                kind=item.get("kind","model")
                if not isinstance(kind,str) or not CLASS_KIND.fullmatch(kind):
                    raise ContractError(f"operations[{index}].kind must be a standard Modelica class kind")
                declared_base=kind.split()[-1]
                if top[0]["kind"]!="operator" and top[0]["kind"]!=declared_base:
                    raise ContractError(f"operations[{index}].kind does not match the added class declaration")
                documentation=text(item.get("documentation"),f"operations[{index}].documentation",optional=True)
                example=boolean(item["example"],f"operations[{index}].example") if "example" in item else False
                test=boolean(item["test"],f"operations[{index}].test") if "test" in item else False
                expected=_expected_within(document["package"],relative)
                within_matches=re.findall(r"(?m)^\s*within\s*[^;]*;",modelica_mask(source))
                if within_matches!=[expected]: raise ContractError(f"added file must declare '{expected}'")
                with target.open("w",encoding="utf-8",newline="") as handle: handle.write(source if source.endswith(("\n","\r")) else source+"\n")
                order_path=target.parent/"package.order"
                order_contents=read_input(order_path) if order_path.exists() else ""
                names=order_contents.splitlines()
                if relative.stem in names: raise ContractError("package.order already contains the added class")
                newline="\r\n" if "\r\n" in order_contents else ("\r" if "\r" in order_contents else "\n")
                separator="" if not order_contents or order_contents.endswith(("\n","\r")) else newline
                with order_path.open("w",encoding="utf-8",newline="") as handle:
                    handle.write(order_contents+separator+relative.stem+newline)
                added={"path":relative_name,"source":source if source.endswith(("\n","\r")) else source+"\n","kind":kind,"documentation":documentation,"example":example,"test":test,"visual":None}
                document["files"].append(added); files_by_path[relative_name]=added
                catalog=local_type_catalog(document["package"],document["files"])
                changes.extend([f"add-file:{relative_name}",f"update-package-order:{order_path.relative_to(staged).as_posix()}"])
            elif action=="repair":
                allowed={"action","path","within","lineEndings"}; strict(raw,allowed,f"operations[{index}]")
                if not target.is_file(): raise ContractError(f"repair target does not exist: {relative_name}")
                source=read_input(target); revised=source
                repair_within=boolean(operation["within"],f"operations[{index}].within") if "within" in operation else False
                repair_lines=boolean(operation["lineEndings"],f"operations[{index}].lineEndings") if "lineEndings" in operation else False
                if not repair_within and not repair_lines: raise ContractError("repair operation must enable within or lineEndings")
                if repair_within:
                    expected=_expected_within(document["package"],relative)
                    matches=list(re.finditer(r"(?m)^\s*within\s*[^;]*;",modelica_mask(revised)))
                    if len(matches)!=1: raise ContractError("within repair requires exactly one existing within clause")
                    match=matches[0]; revised=revised[:match.start()]+expected+revised[match.end():]
                    changes.append(f"repair-within:{relative_name}")
                if repair_lines:
                    revised=revised.replace("\r\n","\n").replace("\r","\n").rstrip()+"\n"; changes.append(f"normalize-line-endings:{relative_name}")
                with target.open("w",encoding="utf-8",newline="") as handle: handle.write(revised)
            else: raise ContractError(f"unsupported edit action: {action}")
        report=static_check_modelica.check_target(staged)
        if report.errors: raise ContractError("edited project failed static validation: "+"; ".join(report.errors))
        create_modelica_project.install_tree(staged,output,overwrite)
    return {"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":[{"code":"modelica.static-warning","severity":"warning","path":"$","message":warning} for warning in warnings],"changes":changes,"losses":[],"evidence":"static"}


def atomic(path:Path,body:str,overwrite:bool)->None:
    if len(body.encode("utf-8"))>MAX_OUTPUT_BYTES: raise ContractError("output exceeds 8 MiB")
    if ".." in path.parts or path.is_symlink(): raise ContractError("unsafe output path")
    reject_symlink_ancestors(path.parent)
    if path.exists():
        if not overwrite: raise ContractError("output exists; pass --overwrite")
        if not path.is_file(): raise ContractError("output must be a regular file")
    path.parent.mkdir(parents=True,exist_ok=True); fd,raw=tempfile.mkstemp(prefix=f".{path.name}.",dir=path.parent); temp=Path(raw)
    try:
        with os.fdopen(fd,"w",encoding="utf-8",newline="\n") as handle: handle.write(body); handle.flush(); os.fsync(handle.fileno())
        os.replace(temp,path)
    finally: temp.unlink(missing_ok=True)


def emit_static_warnings(warnings: list[str]) -> None:
    if warnings:
        print(json.dumps({"evidence":"static","warnings":warnings},sort_keys=True),file=sys.stderr)


def compiler_evidence(path:Path,mode:str)->dict[str,Any]:
    if mode=="off": return {"evidence":"static","warnings":[]}
    if path.is_dir():
        warnings=[]; document=import_project(path,warnings)
        if not document["files"]: raise ContractError("project has no class to check with omc")
        selected=document["files"][0]; relative=PurePosixPath(selected["path"])
        qualified=".".join((document["package"],*relative.with_suffix("").parts)); load_target=path/"package.mo"
    else:
        source=read_input(path); boundaries=[item for item in class_boundaries(source) if item["depth"]==0]
        if len(boundaries)!=1: raise ContractError("omc validation requires one top-level class")
        within_match=re.search(r"(?m)^\s*within\s*([^;]*);",modelica_mask(source)); parent=(within_match.group(1).strip() if within_match else "")
        qualified=".".join(filter(None,(parent,boundaries[0]["name"]))); load_target=path
    if not QIDENT.fullmatch(qualified):
        raise ContractError("omc class target must be a dot-separated unquoted Modelica identifier")
    executable=shutil.which("omc")
    if not executable:
        if mode=="required": raise ContractError("omc is required but not installed")
        return {"evidence":"static","warnings":["omc not installed; static validation only"]}
    resolved=str(Path(executable).resolve())
    try:
        version_run=subprocess.run([resolved,"--version"],capture_output=True,text=True,timeout=OMC_VERSION_TIMEOUT_SECONDS)
    except (OSError,subprocess.TimeoutExpired) as exc:
        if mode=="required": raise ContractError(f"cannot determine omc version: {exc}") from exc
        return {"evidence":"static","warnings":[f"omc unavailable; static validation only: {exc}"]}
    version=(version_run.stdout.strip() or version_run.stderr.strip()).splitlines()
    if version_run.returncode or not version:
        if mode=="required": raise ContractError("cannot determine omc version")
        return {"evidence":"static","warnings":["omc version check failed; static validation only"]}
    with tempfile.TemporaryDirectory(prefix="modelica-omc-") as raw_directory:
        script=Path(raw_directory)/"check.mos"
        script.write_text(f'loadFile("{modelica_string(str(load_target))}");\ncheckModel({qualified});\ngetErrorString();\n',encoding="utf-8",newline="\n")
        try:
            completed=subprocess.run([resolved,str(script)],capture_output=True,text=True,timeout=OMC_TIMEOUT_SECONDS)
        except (OSError,subprocess.TimeoutExpired) as exc: raise ContractError(f"omc failed: {exc}") from exc
    combined=(completed.stdout+"\n"+completed.stderr).strip()
    if completed.returncode or re.search(r"\b(?:Error|failed)\b",combined,re.IGNORECASE) or not re.search(r"\bcompleted successfully\b",combined,re.IGNORECASE):
        raise ContractError("omc checkModel failed: "+(combined[-2000:] or f"exit status {completed.returncode}"))
    return {"evidence":"compiled","warnings":[],"compiler":{"executable":resolved,"version":version[0][:512],"class":qualified}}


def main()->int:
    parser=argparse.ArgumentParser(description=__doc__); sub=parser.add_subparsers(dest="command",required=True)
    p=sub.add_parser("create"); p.add_argument("spec"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true"); p.add_argument("--relayout",action="store_true"); p.add_argument("--replace-graphics",action="store_true")
    p=sub.add_parser("import"); p.add_argument("project"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("annotate"); p.add_argument("spec"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true"); p.add_argument("--relayout",action="store_true"); p.add_argument("--replace-graphics",action="store_true")
    p=sub.add_parser("lint"); p.add_argument("source"); p.add_argument("--compiler",choices=("off","auto","required"),default="off")
    p=sub.add_parser("repair"); p.add_argument("project"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("export"); p.add_argument("spec"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("edit"); p.add_argument("project"); p.add_argument("patch"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("preview"); p.add_argument("source"); p.add_argument("output"); p.add_argument("--format",choices=("svg","html"),default="svg"); p.add_argument("--class",dest="class_selector"); p.add_argument("--overwrite",action="store_true")
    args=parser.parse_args()
    try:
        if args.command=="lint":
            path=cli_path(args.source,"source")
            warnings: list[str] = []
            if path.suffix==".json": normalize(json.loads(read_input(path)),warnings=warnings)
            else:
                report=static_check_modelica.check_target(path)
                if report.errors: raise ContractError("; ".join(report.errors))
                if path.is_file(): class_boundaries(read_input(path))
                else: import_project(path,warnings)
            compiler=compiler_evidence(path,args.compiler)
            warnings.extend(compiler["warnings"])
            emit_static_warnings(warnings)
            response={"ok":True,"diagnostics":[{"code":"modelica.static-warning","severity":"warning","path":"$","message":warning} for warning in warnings],"changes":[],"outputs":[],"losses":[],"evidence":compiler["evidence"]}
            if "compiler" in compiler: response["compiler"]=compiler["compiler"]
            print(json.dumps(response,sort_keys=True)); return 0
        if args.command=="import":
            warnings=[]; document=import_project(cli_path(args.project,"project"),warnings); output=cli_path(args.output,"output"); atomic(output,public_json(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":[{"code":"modelica.visual-uninterpreted","severity":"warning","path":"$","message":warning} for warning in warnings],"changes":[],"losses":[],"evidence":"static"},sort_keys=True)); return 0
        if args.command=="repair":
            warnings=[]; document=import_project(cli_path(args.project,"project"),warnings)
            for item in document["files"]: item["source"]=item["source"].replace("\r\n","\n").replace("\r","\n").rstrip()+"\n"
            output=cli_path(args.output,"output"); atomic(output,public_json(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":[{"code":"modelica.static-warning","severity":"warning","path":"$","message":warning} for warning in warnings],"changes":["normalize-line-endings-and-final-newline"],"losses":[],"evidence":"static"},sort_keys=True)); return 0
        if args.command=="edit":
            report=edit_project(cli_path(args.project,"project"),cli_path(args.patch,"patch"),cli_path(args.output,"output"),args.overwrite)
            print(json.dumps({"ok":True,**report},sort_keys=True)); return 0
        if args.command=="preview":
            report=preview_project(cli_path(args.source,"source"),cli_path(args.output,"output"),args.format,args.class_selector,args.overwrite)
            print(json.dumps({"ok":True,**report},sort_keys=True)); return 0
        raw=json.loads(read_input(cli_path(args.spec,"spec")))
        warnings=[]
        document=normalize(raw,relayout=getattr(args,"relayout",False),replace=getattr(args,"replace_graphics",False),warnings=warnings)
        destination=export_project(document,cli_path(args.output,"output"),args.overwrite)
        emit_static_warnings(warnings)
        print(json.dumps({"ok":True,"output":str(destination),"outputs":[str(destination)],"outputDetails":[output_record(destination)],"diagnostics":[{"code":"modelica.static-warning","severity":"warning","path":"$","message":warning} for warning in warnings],"changes":[],"losses":[],"evidence":"static"},sort_keys=True)); return 0
    except (OSError,UnicodeError,json.JSONDecodeError,ContractError,create_modelica_project.ContractError) as exc:
        print(json.dumps({"ok":False,"error":str(exc)},sort_keys=True),file=sys.stderr); return 2


if __name__=="__main__": raise SystemExit(main())
