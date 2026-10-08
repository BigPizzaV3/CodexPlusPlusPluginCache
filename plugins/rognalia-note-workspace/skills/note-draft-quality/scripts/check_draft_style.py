#!/usr/bin/env python3
"""Find review signals in Japanese note drafts without modifying the draft."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Sequence


MAX_INPUT_BYTES = 2_000_000
MAX_COMMAS_PER_SENTENCE = 3

METHOD_TERMS = re.compile(
    r"置換テスト|温度確認|記号lint|文体チェック|品質ゲート|静的signal"
)
MARKDOWN_LINK = re.compile(r"!??\[([^\]]*)\]\([^)]*\)")
INLINE_CODE = re.compile(r"`[^`]*`")
URL = re.compile(r"https?://\S+")
SENTENCE = re.compile(r"[^。！？!?]+[。！？!?]?")


def _result(status: str, **fields: Any) -> Dict[str, Any]:
    result: Dict[str, Any] = {"schema_version": 1, "status": status}
    result.update(fields)
    return result


def _read_draft(value: str) -> str:
    if value == "-":
        text = sys.stdin.read()
    else:
        path = Path(value)
        if not path.is_file():
            raise ValueError("draft fileを読めません。")
        if path.stat().st_size > MAX_INPUT_BYTES:
            raise ValueError("draft fileが大きすぎます。")
        text = path.read_text(encoding="utf-8")
    if len(text.encode("utf-8")) > MAX_INPUT_BYTES:
        raise ValueError("draft inputが大きすぎます。")
    if not text.strip():
        raise ValueError("draft inputが空です。")
    return text


def _clean_markdown(line: str) -> str:
    cleaned = line.strip()
    if not cleaned or cleaned.startswith("<!--"):
        return ""
    if re.fullmatch(r"(?:#[^\s#]+\s*){2,}", cleaned):
        return ""
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned)
    cleaned = re.sub(r"^>\s?", "", cleaned)
    cleaned = re.sub(r"^(?:[-*+]\s+|\d+[.)]\s+)", "", cleaned)
    cleaned = MARKDOWN_LINK.sub(lambda match: match.group(1), cleaned)
    cleaned = INLINE_CODE.sub("", cleaned)
    cleaned = URL.sub("", cleaned)
    cleaned = cleaned.replace("**", "").replace("__", "")
    return cleaned.strip()


def _prose_units(text: str) -> List[Dict[str, Any]]:
    units: List[Dict[str, Any]] = []
    paragraph_index = -1
    in_paragraph = False
    fence: str = ""

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        stripped = raw_line.strip()
        fence_match = re.match(r"^(```|~~~)", stripped)
        if fence_match:
            marker = fence_match.group(1)
            if not fence:
                fence = marker
            elif fence == marker:
                fence = ""
            in_paragraph = False
            continue
        if fence:
            continue
        if not stripped:
            in_paragraph = False
            continue

        if stripped.startswith(">") or re.match(
            r"^(?:#{1,6}\s+|\[(?:大見出し|小見出し)\])", stripped
        ):
            in_paragraph = False
            continue
        cleaned = _clean_markdown(raw_line)
        if not cleaned:
            continue
        if not in_paragraph:
            paragraph_index += 1
            in_paragraph = True
        units.append(
            {
                "line": line_number,
                "paragraph": paragraph_index,
                "text": cleaned,
            }
        )
    return units


def _sentences(units: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sentences: List[Dict[str, Any]] = []
    for unit in units:
        for match in SENTENCE.finditer(unit["text"]):
            text = match.group(0).strip()
            if text:
                sentences.append(
                    {
                        "line": unit["line"],
                        "paragraph": unit["paragraph"],
                        "text": text,
                    }
                )
    return sentences


def _ending_kind(sentence: str) -> str:
    body = re.sub(r"[。！？!?]+$", "", sentence).strip()
    patterns = (
        "と考えます",
        "と思います",
        "になります",
        "しています",
        "していました",
        "できません",
        "できます",
        "でしょう",
        "ではありません",
        "ません",
        "でした",
        "ました",
        "です",
        "ます",
        "である",
        "だった",
    )
    for pattern in patterns:
        if body.endswith(pattern):
            return pattern
    return ""


def _collect_issues(text: str) -> List[Dict[str, Any]]:
    units = _prose_units(text)
    sentences = _sentences(units)
    issues: List[Dict[str, Any]] = []
    seen = set()

    def add(code: str, line: int, message: str, **details: Any) -> None:
        key = (code, line)
        if key in seen:
            return
        seen.add(key)
        issue: Dict[str, Any] = {"code": code, "line": line, "message": message}
        if details:
            issue["details"] = details
        issues.append(issue)

    for unit in units:
        line = int(unit["line"])
        value = str(unit["text"])
        if METHOD_TERMS.search(value):
            add(
                "internal_method_leak",
                line,
                "制作・確認の用語があります。記事の題材として必要な説明か、作業報告の混入かを確認します。",
            )

    for sentence in sentences:
        value = str(sentence["text"])
        line = int(sentence["line"])
        comma_count = value.count("、")
        if comma_count > MAX_COMMAS_PER_SENTENCE:
            add(
                "comma_density",
                line,
                "一文に読点が四つ以上あります。数だけでは直さず、読みづらさや主語・述語の離れすぎがないか確認します。",
                comma_count=comma_count,
                threshold=MAX_COMMAS_PER_SENTENCE,
            )
    endings = [_ending_kind(str(sentence["text"])) for sentence in sentences]
    for index in range(2, len(endings)):
        same_paragraph = (
            sentences[index]["paragraph"]
            == sentences[index - 1]["paragraph"]
            == sentences[index - 2]["paragraph"]
        )
        if (
            same_paragraph
            and endings[index]
            and endings[index] == endings[index - 1] == endings[index - 2]
        ):
            add(
                "repeated_sentence_ending",
                int(sentences[index - 2]["line"]),
                "同じ段落で同じ語尾が三文以上続いています。単調さがあるか確認し、意図的な反復は保ちます。",
                ending=endings[index],
            )

    issues.sort(key=lambda issue: (int(issue["line"]), str(issue["code"])))
    return issues


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="日本語のnote原稿から文体上のreview signalをJSONで返します。"
    )
    parser.add_argument("draft", help="UTF-8のdraft file。stdinは-を指定します。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        text = _read_draft(args.draft)
    except (OSError, UnicodeError, ValueError) as error:
        print(
            json.dumps(
                _result("error", errors=[str(error)]),
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 2

    issues = _collect_issues(text)
    status = "review" if issues else "pass"
    print(
        json.dumps(
            _result(
                status,
                input_sha256=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                issue_count=len(issues),
                issues=issues,
            ),
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
