#!/usr/bin/env python3
"""Build the compact, market-aware first-run readiness message."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from contracts import load_json, validate_career_passport


def _list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(value).strip() for value in values if str(value).strip()]


def _compact_join(values: list[str], *, fallback: str, limit: int = 4) -> str:
    if not values:
        return fallback
    shown = values[:limit]
    suffix = f" + {len(values) - limit} more" if len(values) > limit else ""
    return "; ".join(shown) + suffix


def _seniority(profile: dict[str, Any], directions: list[str]) -> str:
    text = " ".join([str(profile.get("headline", "")), *directions]).casefold()
    if any(term in text for term in ("early-career", "graduate", "intern", "entry level", "junior")):
        return "early-career"
    if any(term in text for term in ("chief", "executive", "director", "vice president", "vp", "head of")):
        return "senior/executive"
    if any(term in text for term in ("manager", "lead", "principal", "senior")):
        return "experienced"
    return "career level inferred from the CV"


def _market(profile: dict[str, Any], locations: list[str]) -> str:
    location = str(profile.get("location", "")).strip()
    if location:
        return location
    return locations[0] if locations else "the selected market"


def _money(value: Any) -> str:
    if value is None:
        return "not set"
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return str(value)
    if float(value).is_integer():
        return f"{int(value):,}"
    return f"{value:,.2f}".rstrip("0").rstrip(".")


def _compensation(currency: str, value: Any, basis: str) -> str:
    if value is None:
        return f"{currency} floor not set"
    if currency == "INR" and isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 100_000:
        lakhs = value / 100_000
        amount = f"{lakhs:,.2f}".rstrip("0").rstrip(".")
        rendered = f"INR {amount} lakh+"
    else:
        rendered = f"{currency} {_money(value)}+"
    labels = {
        "base": "base salary",
        "fixed": "fixed compensation",
        "total_compensation": "total compensation",
        "ctc": "CTC",
        "hourly": "hourly rate",
        "daily": "daily rate",
        "annual_package": "annual package",
    }
    label = labels.get(basis)
    return rendered + (f" {label}" if label else "")


def _source_summary(source_preferences: dict[str, Any], market: str) -> str:
    preferred = _list(source_preferences.get("preferred"))
    excluded = _list(source_preferences.get("excluded"))
    base = (
        "exact employer/recruiter postings first, then authorised recruiters, "
        f"major job boards and public salary benchmarks relevant to {market}"
    )
    details: list[str] = []
    if preferred:
        details.append("prefer " + _compact_join(preferred, fallback="", limit=3))
    if excluded:
        details.append("exclude " + _compact_join(excluded, fallback="", limit=3))
    return base + ("; " + "; ".join(details) if details else "")


def _page_summary(document_preferences: dict[str, Any], seniority: str) -> str:
    strategy = document_preferences.get("page_strategy", "adaptive")
    if strategy == "one_page" or (strategy == "adaptive" and seniority == "early-career"):
        summary = "one strong Word page; 9 pt minimum"
    else:
        summary = "two Word pages; page 1 at least 65% filled and page 2 at least 80% filled; 9 pt minimum"
    if document_preferences.get("format_mode") == "reference":
        name = str(document_preferences.get("reference_template_name") or "supplied reference CV")
        summary += f"; visual system copied safely from {name}"
    else:
        summary += "; smart professional default format"
    return summary


def _section_summary(document_preferences: dict[str, Any]) -> str:
    order = _list(document_preferences.get("section_order"))
    omitted = {value.casefold() for value in _list(document_preferences.get("omitted_sections"))}
    sections = [section for section in order if section.casefold() not in omitted]
    for section in _list(document_preferences.get("additional_sections")):
        if section.casefold() not in {item.casefold() for item in sections} and section.casefold() not in omitted:
            sections.append(section)
    defaults = [
        "Professional Summary",
        "Role-Match Experience",
        "Professional Experience",
        "Core Skills",
        "Education",
        "Recognition/Certifications when evidenced",
    ]
    summary = _compact_join(sections or defaults, fallback="role-relevant sections", limit=8)
    fields = document_preferences.get("field_preferences")
    if isinstance(fields, dict):
        field_notes: list[str] = []
        hidden = _list(fields.get("hidden_contact_fields"))
        if hidden:
            field_notes.append("hide " + _compact_join(hidden, fallback="", limit=3))
        if fields.get("show_work_rights") is True:
            field_notes.append("show work rights")
        if fields.get("show_location") is False:
            field_notes.append("hide location")
        if fields.get("headline_mode") == "preserve":
            field_notes.append("preserve headline")
        if field_notes:
            summary += " · Fields: " + "; ".join(field_notes)
    return summary


def _pack_summary(document_preferences: dict[str, Any]) -> str:
    mode = document_preferences.get("cover_letter_mode", "paired")
    if mode == "cv_only":
        pack = "Word CV only by your explicit preference"
    elif mode == "ask_each_time":
        pack = "Word CV; ask before adding a one-page Word cover letter"
    else:
        pack = "Word CV plus a one-page Word cover letter"
    return pack + "; you review and submit every application manually"


def build_ready_lines(passport: dict[str, Any]) -> list[str]:
    """Return exactly seven active-assumption lines for a valid Passport."""
    errors = validate_career_passport(passport)
    if errors:
        raise ValueError("Invalid Career Passport: " + "; ".join(errors))
    profile = passport["profile"]
    preferences = passport["preferences"]
    directions = _list(preferences.get("target_directions"))
    locations = _list(preferences.get("locations"))
    seniority = _seniority(profile, directions)
    market = _market(profile, locations)
    work_rights = str(profile.get("work_rights") or "not confirmed; no cross-border right assumed")
    employment = _compact_join(_list(preferences.get("employment_types")), fallback="not set")
    currency = str(preferences.get("currency", "")).upper()
    compensation = _compensation(currency, preferences.get("salary_minimum"), str(preferences.get("salary_basis", "unspecified")))
    documents = preferences["document_preferences"]
    return [
        f"Target: {_compact_join(directions, fallback='inferred from the CV', limit=3)} · {seniority}",
        f"Geography: {_compact_join(locations, fallback=market, limit=4)} · Work rights: {work_rights}",
        f"Sources: {_source_summary(preferences['source_preferences'], market)}",
        f"Compensation: {compensation} · Employment: {employment}",
        f"CV: {_page_summary(documents, seniority)}",
        f"Sections: {_section_summary(documents)}",
        f"Application pack: {_pack_summary(documents)}",
    ]


def build_ready_message(passport: dict[str, Any]) -> str:
    lines = build_ready_lines(passport)
    required_labels = ["Target", "Geography", "Sources", "Compensation", "CV", "Sections", "Application pack"]
    rendered_labels = [line.split(":", 1)[0] for line in lines]
    if rendered_labels != required_labels:
        raise ValueError(f"Readiness labels must be {required_labels}; got {rendered_labels}")
    rendered = ["Your Career Centre is ready", "", *[f"- {line}" for line in lines]]
    rendered.extend(
        [
            "",
            "These defaults work for most people. Say “change my advanced preferences” at any time if you want different sources, sections, page strategy or formatting.",
            "I’ve prepared your Career Passport as the portable evidence and history backup; save the attached copy when convenient.",
            "For continuity, keep one main Career Centre conversation. A separate new conversation may not inherit your CV, evidence or history, so bring the latest Passport when you move.",
        ]
    )
    return "\n".join(rendered)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("passport", type=Path)
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    args = parser.parse_args()
    passport = load_json(args.passport.resolve())
    try:
        lines = build_ready_lines(passport)
    except ValueError as exc:
        print(json.dumps({"passed": False, "errors": [str(exc)]}, indent=2))
        return 1
    if args.format == "json":
        print(json.dumps({"passed": True, "heading": "Your Career Centre is ready", "assumptions": lines}, indent=2))
    else:
        print(build_ready_message(passport))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
