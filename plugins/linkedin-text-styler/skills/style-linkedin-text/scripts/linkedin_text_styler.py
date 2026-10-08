#!/usr/bin/env python3
"""Deterministic Unicode text styling for LinkedIn and other plain-text fields."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata

UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
LOWER = "abcdefghijklmnopqrstuvwxyz"
DIGITS = "0123456789"


def seq(start: int, count: int) -> str:
    return "".join(chr(start + i) for i in range(count))


def alphabet(upper: int, lower: int, digits: int | None = None) -> str:
    return seq(upper, 26) + seq(lower, 26) + (seq(digits, 10) if digits else DIGITS)


PLAIN = UPPER + LOWER + DIGITS
STYLES: dict[str, str] = {
    "serif-bold": alphabet(0x1D400, 0x1D41A, 0x1D7CE),
    "serif-italic": alphabet(0x1D434, 0x1D44E),
    "serif-bold-italic": alphabet(0x1D468, 0x1D482),
    "sans": alphabet(0x1D5A0, 0x1D5BA, 0x1D7E2),
    "sans-bold": alphabet(0x1D5D4, 0x1D5EE, 0x1D7EC),
    "sans-italic": alphabet(0x1D608, 0x1D622),
    "sans-bold-italic": alphabet(0x1D63C, 0x1D656),
    "script": alphabet(0x1D49C, 0x1D4B6),
    "script-bold": alphabet(0x1D4D0, 0x1D4EA),
    "fraktur": alphabet(0x1D504, 0x1D51E),
    "fraktur-bold": alphabet(0x1D56C, 0x1D586),
    "double-struck": alphabet(0x1D538, 0x1D552, 0x1D7D8),
    "monospace": alphabet(0x1D670, 0x1D68A, 0x1D7F6),
    "fullwidth": seq(0xFF21, 26) + seq(0xFF41, 26) + seq(0xFF10, 10),
    "circled": seq(0x24B6, 26) + seq(0x24D0, 26) + "⓪①②③④⑤⑥⑦⑧⑨",
    "parenthesized": seq(0x1F110, 26) + seq(0x249C, 26) + DIGITS,
}

# Unicode mathematical alphabets reuse older Letterlike Symbols at these gaps.
EXCEPTIONS: dict[str, dict[str, str]] = {
    "serif-italic": {"h": "ℎ"},
    "script": {"B": "ℬ", "E": "ℰ", "F": "ℱ", "H": "ℋ", "I": "ℐ", "L": "ℒ", "M": "ℳ", "R": "ℛ", "e": "ℯ", "g": "ℊ", "o": "ℴ"},
    "fraktur": {"C": "ℭ", "H": "ℌ", "I": "ℑ", "R": "ℜ", "Z": "ℨ"},
    "double-struck": {"C": "ℂ", "H": "ℍ", "N": "ℕ", "P": "ℙ", "Q": "ℚ", "R": "ℝ", "Z": "ℤ"},
}

SMALL_CAPS = dict(zip(LOWER, "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ"))
SUPER = dict(zip("0123456789+-=()in", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁱⁿ"))
SUB = dict(zip("0123456789+-=()aehijklmnoprstuvx", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ"))
DECORATIONS = {"underline": "\u0332", "double-underline": "\u0333", "strikethrough": "\u0336", "slash": "\u0337"}
LISTS = {"bullet": "•", "arrow": "→", "check": "✓"}


def build_map(style: str) -> dict[str, str]:
    if style == "small-caps":
        return {**SMALL_CAPS, **{k.upper(): v for k, v in SMALL_CAPS.items()}}
    if style == "superscript":
        return SUPER
    if style == "subscript":
        return SUB
    base = style.removesuffix("-underline").removesuffix("-strikethrough")
    if base not in STYLES:
        raise KeyError(style)
    mapping = dict(zip(PLAIN, STYLES[base]))
    mapping.update(EXCEPTIONS.get(base, {}))
    return mapping


def decorate(text: str, mark: str) -> str:
    return "".join(ch + mark if not ch.isspace() and not unicodedata.combining(ch) else ch for ch in text)


def style_text(text: str, style: str) -> str:
    if style in DECORATIONS:
        return decorate(text, DECORATIONS[style])
    mapping = build_map(style)
    result = "".join(mapping.get(ch, ch) for ch in text)
    if style.endswith("-underline"):
        return decorate(result, DECORATIONS["underline"])
    if style.endswith("-strikethrough"):
        return decorate(result, DECORATIONS["strikethrough"])
    return result


def list_text(text: str, kind: str) -> str:
    # Keep every original line separator, including CRLF and a terminal newline.
    parts = re.split(r"(\r\n|\r|\n)", text)
    lines = parts[::2]
    nonempty = [line for line in lines if line.strip()]
    if kind == "ascending":
        labels = [str(i) for i in range(1, len(nonempty) + 1)]
    elif kind == "descending":
        labels = [str(i) for i in range(len(nonempty), 0, -1)]
    elif kind == "number":
        labels = [str(i) for i in range(1, len(nonempty) + 1)]
    else:
        labels = [LISTS[kind]] * len(nonempty)
    out, index = [], 0
    for line in lines:
        if not line.strip():
            out.append(line)
        else:
            suffix = "." if kind in {"number", "ascending", "descending"} else ""
            match = re.fullmatch(r"([\t ]*)(.*?)([\t ]*)", line)
            assert match is not None
            leading, content, trailing = match.groups()
            out.append(f"{leading}{labels[index]}{suffix} {content}{trailing}")
            index += 1
    rebuilt: list[str] = []
    for i, line in enumerate(out):
        rebuilt.append(line)
        separator_index = i * 2 + 1
        if separator_index < len(parts):
            rebuilt.append(parts[separator_index])
    return "".join(rebuilt)


def unstyle(text: str) -> str:
    reverse: dict[str, str] = {}
    for name in STYLES:
        reverse.update({v: k for k, v in build_map(name).items()})
    reverse.update({v: k for k, v in SMALL_CAPS.items()})
    reverse.update({v: k for k, v in SUPER.items()})
    reverse.update({v: k for k, v in SUB.items()})
    marks = set(DECORATIONS.values())
    return "".join(reverse.get(ch, ch) for ch in text if ch not in marks)


def verify_equivalent(original: str, styled: str) -> bool:
    """Return True only when styling removal restores the exact original text."""
    return unstyle(styled) == original


def markup(text: str) -> str:
    rules = [
        (r"\*\*(.+?)\*\*", "sans-bold"),
        (r"~~(.+?)~~", "strikethrough"),
        (r"__(.+?)__", "underline"),
        (r"`(.+?)`", "monospace"),
        (r"(?<!\*)\*([^*\n]+?)\*(?!\*)", "sans-italic"),
    ]
    for pattern, name in rules:
        text = re.sub(pattern, lambda m, s=name: style_text(m.group(1), s), text)
    return text


def available_styles() -> list[str]:
    return sorted(set(STYLES) | set(DECORATIONS) | {"small-caps", "superscript", "subscript", "sans-bold-underline", "sans-bold-strikethrough"})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", help="Input text; stdin is used when omitted")
    parser.add_argument("--style", choices=available_styles())
    parser.add_argument("--list", choices=sorted(set(LISTS) | {"number", "ascending", "descending"}))
    parser.add_argument("--markup", action="store_true", help="Convert simple non-nested markup")
    parser.add_argument("--unstyled", action="store_true", help="Remove supported Unicode styling")
    parser.add_argument("--verify-original", help="Require styled input to unstyle to this exact text")
    parser.add_argument("--list-styles", action="store_true")
    parser.add_argument("--json", action="store_true", help="Emit JSON with output and counts")
    args = parser.parse_args()
    if args.list_styles:
        print("\n".join(available_styles()))
        return 0
    actions = sum(bool(x) for x in (args.style, args.list, args.markup, args.unstyled, args.verify_original is not None))
    if actions != 1:
        parser.error("choose exactly one transformation or --verify-original")
    source = args.text if args.text is not None else sys.stdin.read()
    if args.verify_original is not None:
        if verify_equivalent(args.verify_original, source):
            return 0
        print("styled text does not restore to the exact original", file=sys.stderr)
        return 1
    if args.style:
        output = style_text(source, args.style)
    elif args.list:
        output = list_text(source, args.list)
    elif args.markup:
        output = markup(source)
    else:
        output = unstyle(source)
    if args.json:
        print(json.dumps({"output": output, "input_characters": len(source), "output_characters": len(output), "utf16_code_units": len(output.encode("utf-16-le")) // 2}, ensure_ascii=False))
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
