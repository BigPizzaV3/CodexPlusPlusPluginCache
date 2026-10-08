#!/usr/bin/env python3
"""Dependency-free contract validation for Career Centre v4."""
from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SCHEMA_VERSION = "4.0"
DECISIONS = {"apply", "maybe", "skip"}
APPLICATION_STAGES = {
    "discovered", "reviewed", "preparing", "applied", "follow_up",
    "interview", "reference", "offer", "rejected", "withdrawn",
    "closed", "reposted",
}
SOURCE_TYPES = {
    "current_cv", "historical_cv", "user_confirmed",
    "uploaded_evidence", "external_source",
}
SOURCE_DOCUMENT_TYPES = {
    "current_cv", "historical_cv", "linkedin_export", "career_passport",
    "uploaded_evidence", "pasted_text",
}
DOCUMENT_TYPES = {"cv_base", "tailored_cv", "cover_letter"}
DOCUMENT_STATUSES = {"ready", "partial", "superseded"}
CONFIDENCE = {"source_only", "user_confirmed", "externally_corroborated"}
GENERIC_PATHS = {
    "", "/", "/careers", "/careers/", "/jobs", "/jobs/",
    "/job-search", "/job-search/", "/search", "/search/",
}
PLACEHOLDER_HOSTS = {
    "example.com", "www.example.com", "example.org", "www.example.org",
    "example.net", "www.example.net",
}


def _error(errors: list[str], path: str, message: str) -> None:
    errors.append(f"{path}: {message}")


def _mapping(value: Any, path: str, errors: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        _error(errors, path, "must be an object")
        return {}
    return value


def _sequence(value: Any, path: str, errors: list[str]) -> list[Any]:
    if not isinstance(value, list):
        _error(errors, path, "must be an array")
        return []
    return value


def _required_text(obj: dict[str, Any], key: str, path: str, errors: list[str]) -> str:
    value = obj.get(key)
    if not isinstance(value, str) or not value.strip():
        _error(errors, f"{path}.{key}", "is required and must be non-empty text")
        return ""
    return value.strip()


def _enum(obj: dict[str, Any], key: str, allowed: set[str], path: str, errors: list[str]) -> str:
    value = str(obj.get(key, "")).strip()
    if value not in allowed:
        _error(errors, f"{path}.{key}", f"must be one of {sorted(allowed)}")
    return value


def _unique(values: Iterable[str], path: str, errors: list[str]) -> None:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    if duplicates:
        _error(errors, path, "contains duplicate value(s): " + ", ".join(sorted(duplicates)))


def is_safe_exact_posting_url(value: Any, *, synthetic: bool = False) -> tuple[bool, str]:
    if not isinstance(value, str) or not value.strip():
        return False, "exact posting URL is missing"
    try:
        parsed = urlsplit(value.strip())
    except Exception:
        return False, "URL could not be parsed"
    if parsed.scheme.lower() not in {"http", "https"}:
        return False, "URL must use HTTP or HTTPS"
    if not parsed.hostname:
        return False, "URL must include a hostname"
    if parsed.username or parsed.password:
        return False, "URL must not contain embedded credentials"
    host = parsed.hostname.casefold()
    if host in PLACEHOLDER_HOSTS and not synthetic:
        return False, "placeholder domains are not valid live postings"
    if parsed.path.casefold() in GENERIC_PATHS:
        return False, "URL points to a generic careers/search page, not an exact role"
    return True, ""


def validate_evidence(items: Any, *, path: str = "evidence") -> tuple[list[str], set[str]]:
    errors: list[str] = []
    records = _sequence(items, path, errors)
    ids: list[str] = []
    for index, raw in enumerate(records):
        item_path = f"{path}[{index}]"
        item = _mapping(raw, item_path, errors)
        evidence_id = _required_text(item, "evidence_id", item_path, errors)
        if evidence_id:
            ids.append(evidence_id)
            if not evidence_id.startswith("EV-"):
                _error(errors, f"{item_path}.evidence_id", "must start with EV-")
        for key in ("claim", "safe_wording", "source_name", "source_excerpt", "captured_at"):
            _required_text(item, key, item_path, errors)
        source_type = _enum(item, "source_type", SOURCE_TYPES, item_path, errors)
        confidence = _enum(item, "confidence", CONFIDENCE, item_path, errors)
        _sequence(item.get("restrictions"), f"{item_path}.restrictions", errors)
        _sequence(item.get("role_relevance"), f"{item_path}.role_relevance", errors)
        corroborating = item.get("corroborating_sources", [])
        if corroborating is not None:
            _sequence(corroborating, f"{item_path}.corroborating_sources", errors)
        if source_type in {"current_cv", "historical_cv"} and confidence != "source_only" and not corroborating:
            _error(
                errors,
                f"{item_path}.confidence",
                "CV-derived evidence must remain source_only unless corroborating sources are recorded",
            )
        if confidence == "user_confirmed" and source_type not in {"user_confirmed", "uploaded_evidence"} and not corroborating:
            _error(errors, f"{item_path}.confidence", "user confirmation or a corroborating source is required")
        if confidence == "externally_corroborated" and source_type != "external_source" and not corroborating:
            _error(errors, f"{item_path}.confidence", "external corroboration must be identified")
    _unique(ids, f"{path}.evidence_id", errors)
    return errors, set(ids)


def validate_role_dossier(data: Any, *, path: str = "role") -> list[str]:
    errors: list[str] = []
    role = _mapping(data, path, errors)
    if role.get("schema_version") != SCHEMA_VERSION:
        _error(errors, f"{path}.schema_version", f"must equal {SCHEMA_VERSION}")
    _required_text(role, "role_id", path, errors)
    _required_text(role, "track", path, errors)
    decision = _enum(role, "decision", DECISIONS, path, errors)
    fit = role.get("fit_score")
    if not isinstance(fit, (int, float)) or isinstance(fit, bool) or not 0 <= float(fit) <= 10:
        _error(errors, f"{path}.fit_score", "must be a number from 0 to 10")
    chance = role.get("shortlist_chance_percent")
    if not isinstance(chance, int) or isinstance(chance, bool) or not 0 <= chance <= 100:
        _error(errors, f"{path}.shortlist_chance_percent", "must be an integer from 0 to 100")

    salary = _mapping(role.get("salary"), f"{path}.salary", errors)
    _required_text(salary, "band", f"{path}.salary", errors)
    _required_text(salary, "currency", f"{path}.salary", errors)
    _enum(salary, "basis", {"listed", "estimated", "day-rate", "annualised-contract-estimate"}, f"{path}.salary", errors)

    employment = _mapping(role.get("employment"), f"{path}.employment", errors)
    employment_type = _enum(
        employment,
        "type",
        {"permanent", "contract", "fixed-term", "part-time", "casual", "other", "unknown"},
        f"{path}.employment",
        errors,
    )
    if employment_type in {"contract", "fixed-term"}:
        _required_text(employment, "duration", f"{path}.employment", errors)
        _required_text(employment, "deprioritisation_note", f"{path}.employment", errors)

    identity = _mapping(role.get("identity"), f"{path}.identity", errors)
    for key in ("company", "title", "location", "source", "checked_at", "content_fingerprint"):
        _required_text(identity, key, f"{path}.identity", errors)
    synthetic = identity.get("synthetic") is True
    ok, reason = is_safe_exact_posting_url(identity.get("exact_posting_url"), synthetic=synthetic)
    if not ok:
        _error(errors, f"{path}.identity.exact_posting_url", reason)
    posting_status = _enum(identity, "posting_status", {"open", "closed", "unknown"}, f"{path}.identity", errors)
    link_status = _enum(identity, "link_status", {"verified_exact", "unverified", "generic", "missing"}, f"{path}.identity", errors)

    for key in ("main_match", "main_risk", "cv_angle", "recommended_cv_base"):
        _required_text(role, key, path, errors)
    if not isinstance(role.get("add_to_tracker"), bool):
        _error(errors, f"{path}.add_to_tracker", "must be true or false")
    skip_reason = role.get("skip_reason")
    if decision == "skip" and (not isinstance(skip_reason, str) or not skip_reason.strip()):
        _error(errors, f"{path}.skip_reason", "is required for Skip")
    if decision == "apply":
        if posting_status != "open":
            _error(errors, f"{path}.identity.posting_status", "Apply requires an open posting")
        if link_status != "verified_exact":
            _error(errors, f"{path}.identity.link_status", "Apply requires a verified exact link")
        if employment_type == "unknown":
            _error(errors, f"{path}.employment.type", "Apply requires known employment type")

    requirement_map = _sequence(role.get("requirement_map"), f"{path}.requirement_map", errors)
    if decision == "apply" and len(requirement_map) < 3:
        _error(errors, f"{path}.requirement_map", "Apply requires at least three mapped requirements")
    for index, raw in enumerate(requirement_map):
        req_path = f"{path}.requirement_map[{index}]"
        req = _mapping(raw, req_path, errors)
        _required_text(req, "requirement", req_path, errors)
        importance = _enum(req, "importance", {"essential", "important", "desirable"}, req_path, errors)
        assessment = _enum(req, "assessment", {"direct", "adjacent", "gap", "unknown"}, req_path, errors)
        evidence_ids = _sequence(req.get("evidence_ids"), f"{req_path}.evidence_ids", errors)
        if assessment in {"direct", "adjacent"} and not evidence_ids:
            _error(errors, f"{req_path}.evidence_ids", "evidence is required for direct or adjacent assessment")
        if decision == "apply" and importance == "essential" and assessment in {"gap", "unknown"}:
            _error(errors, req_path, "Apply cannot contain an unresolved essential requirement")
    return errors


def validate_career_passport(data: Any) -> list[str]:
    errors: list[str] = []
    root = _mapping(data, "passport", errors)
    if root.get("schema_version") != SCHEMA_VERSION:
        _error(errors, "passport.schema_version", f"must equal {SCHEMA_VERSION}")
    profile = _mapping(root.get("profile"), "passport.profile", errors)
    _required_text(profile, "name", "passport.profile", errors)
    _sequence(profile.get("contact"), "passport.profile.contact", errors)
    preferences = _mapping(root.get("preferences"), "passport.preferences", errors)
    for key in ("target_directions", "locations", "employment_types", "excluded_employers", "excluded_role_patterns"):
        _sequence(preferences.get(key), f"passport.preferences.{key}", errors)
    _enum(preferences, "selectivity", {"focused", "balanced", "explore"}, "passport.preferences", errors)
    _enum(preferences, "remote_preference", {"remote", "hybrid", "onsite", "flexible", "unknown"}, "passport.preferences", errors)
    if preferences.get("salary_basis") is not None:
        _enum(preferences, "salary_basis", {"base", "fixed", "total_compensation", "ctc", "hourly", "daily", "annual_package", "unspecified"}, "passport.preferences", errors)
    currency = preferences.get("currency")
    if not isinstance(currency, str) or len(currency) != 3 or not currency.isalpha() or currency != currency.upper():
        _error(errors, "passport.preferences.currency", "must be a three-letter uppercase currency code")
    employment_types = preferences.get("employment_types") if isinstance(preferences.get("employment_types"), list) else []
    allowed_employment = {"permanent", "contract", "fixed-term", "part-time", "casual", "other"}
    for index, employment_type in enumerate(employment_types):
        if employment_type not in allowed_employment:
            _error(errors, f"passport.preferences.employment_types[{index}]", f"must be one of {sorted(allowed_employment)}")
    source_preferences = _mapping(preferences.get("source_preferences"), "passport.preferences.source_preferences", errors)
    _enum(source_preferences, "strategy", {"automatic", "preferred", "broad"}, "passport.preferences.source_preferences", errors)
    for key in ("preferred", "excluded"):
        _sequence(source_preferences.get(key), f"passport.preferences.source_preferences.{key}", errors)
    document_preferences = _mapping(preferences.get("document_preferences"), "passport.preferences.document_preferences", errors)
    format_mode = _enum(document_preferences, "format_mode", {"smart_default", "reference"}, "passport.preferences.document_preferences", errors)
    _enum(document_preferences, "page_strategy", {"adaptive", "one_page", "two_page"}, "passport.preferences.document_preferences", errors)
    _enum(document_preferences, "cover_letter_mode", {"paired", "cv_only", "ask_each_time"}, "passport.preferences.document_preferences", errors)
    for key in ("section_order", "additional_sections", "omitted_sections", "style_notes"):
        _sequence(document_preferences.get(key), f"passport.preferences.document_preferences.{key}", errors)
    language = document_preferences.get("language")
    if language is not None and (not isinstance(language, str) or len(language.strip()) < 2):
        _error(errors, "passport.preferences.document_preferences.language", "must be a language code or name with at least two characters")
    regional_spelling = document_preferences.get("regional_spelling")
    if regional_spelling is not None and (not isinstance(regional_spelling, str) or not regional_spelling.strip()):
        _error(errors, "passport.preferences.document_preferences.regional_spelling", "must be null or non-empty text")
    field_preferences_raw = document_preferences.get("field_preferences")
    if field_preferences_raw is not None:
        field_preferences = _mapping(field_preferences_raw, "passport.preferences.document_preferences.field_preferences", errors)
        for key in ("contact_field_order", "hidden_contact_fields", "notes"):
            values = _sequence(field_preferences.get(key), f"passport.preferences.document_preferences.field_preferences.{key}", errors)
            for index, value in enumerate(values):
                if not isinstance(value, str) or not value.strip():
                    _error(errors, f"passport.preferences.document_preferences.field_preferences.{key}[{index}]", "must be a non-empty string")
        for key in ("show_location", "show_work_rights"):
            if not isinstance(field_preferences.get(key), bool):
                _error(errors, f"passport.preferences.document_preferences.field_preferences.{key}", "must be true or false")
        _enum(field_preferences, "headline_mode", {"role_specific", "preserve", "user_confirmed"}, "passport.preferences.document_preferences.field_preferences", errors)
        _enum(field_preferences, "date_style", {"preserve", "month_year", "year_only"}, "passport.preferences.document_preferences.field_preferences", errors)
        label_overrides = _mapping(field_preferences.get("section_label_overrides"), "passport.preferences.document_preferences.field_preferences.section_label_overrides", errors)
        for source_label, replacement_label in label_overrides.items():
            if not isinstance(source_label, str) or not source_label.strip() or not isinstance(replacement_label, str) or not replacement_label.strip():
                _error(errors, "passport.preferences.document_preferences.field_preferences.section_label_overrides", "keys and values must be non-empty strings")
    reference_name = document_preferences.get("reference_template_name")
    if format_mode == "reference" and (not isinstance(reference_name, str) or not reference_name.strip()):
        _error(errors, "passport.preferences.document_preferences.reference_template_name", "is required when format_mode is reference")
    if format_mode == "smart_default" and reference_name is not None:
        _error(errors, "passport.preferences.document_preferences.reference_template_name", "must be null when format_mode is smart_default")
    salary_minimum = preferences.get("salary_minimum")
    if salary_minimum is not None and (not isinstance(salary_minimum, (int, float)) or isinstance(salary_minimum, bool) or salary_minimum < 0):
        _error(errors, "passport.preferences.salary_minimum", "must be null or a non-negative number")

    source_documents = _sequence(root.get("source_documents", []), "passport.source_documents", errors)
    source_ids: list[str] = []
    for index, raw in enumerate(source_documents):
        item_path = f"passport.source_documents[{index}]"
        item = _mapping(raw, item_path, errors)
        source_id = _required_text(item, "source_id", item_path, errors)
        if source_id:
            source_ids.append(source_id)
            if not source_id.startswith("SRC-"):
                _error(errors, f"{item_path}.source_id", "must start with SRC-")
        _required_text(item, "name", item_path, errors)
        _enum(item, "source_type", SOURCE_DOCUMENT_TYPES, item_path, errors)
        target_directions = _sequence(item.get("target_directions"), f"{item_path}.target_directions", errors)
        for direction_index, direction in enumerate(target_directions):
            if not isinstance(direction, str) or not direction.strip():
                _error(errors, f"{item_path}.target_directions[{direction_index}]", "must be non-empty text")
        if not isinstance(item.get("is_primary"), bool):
            _error(errors, f"{item_path}.is_primary", "must be true or false")
        _required_text(item, "ingested_at", item_path, errors)
        notes = item.get("notes", [])
        if notes is not None:
            note_items = _sequence(notes, f"{item_path}.notes", errors)
            for note_index, note in enumerate(note_items):
                if not isinstance(note, str) or not note.strip():
                    _error(errors, f"{item_path}.notes[{note_index}]", "must be non-empty text")
    _unique(source_ids, "passport.source_documents.source_id", errors)

    document_versions = _sequence(root.get("document_versions", []), "passport.document_versions", errors)
    version_ids: list[str] = []
    known_source_ids = set(source_ids)
    for index, raw in enumerate(document_versions):
        item_path = f"passport.document_versions[{index}]"
        item = _mapping(raw, item_path, errors)
        version_id = _required_text(item, "version_id", item_path, errors)
        if version_id:
            version_ids.append(version_id)
            if not version_id.startswith("DOC-"):
                _error(errors, f"{item_path}.version_id", "must start with DOC-")
        document_type = _enum(item, "document_type", DOCUMENT_TYPES, item_path, errors)
        _enum(item, "status", DOCUMENT_STATUSES, item_path, errors)
        _required_text(item, "file_name", item_path, errors)
        _required_text(item, "created_at", item_path, errors)
        role_id = item.get("role_id")
        if document_type in {"tailored_cv", "cover_letter"} and (not isinstance(role_id, str) or not role_id.strip()):
            _error(errors, f"{item_path}.role_id", "is required for a tailored CV or cover letter")
        if document_type == "cv_base" and role_id is not None:
            _error(errors, f"{item_path}.role_id", "must be null for a CV base")
        source_refs = _sequence(item.get("source_document_ids"), f"{item_path}.source_document_ids", errors)
        if not source_refs:
            _error(errors, f"{item_path}.source_document_ids", "at least one source document is required")
        unknown_sources = sorted({str(source_id) for source_id in source_refs if str(source_id) not in known_source_ids})
        if unknown_sources:
            _error(errors, f"{item_path}.source_document_ids", "unknown source document ID(s): " + ", ".join(unknown_sources))
        summaries = _sequence(item.get("change_summary"), f"{item_path}.change_summary", errors)
        for summary_index, summary in enumerate(summaries):
            if not isinstance(summary, str) or not summary.strip():
                _error(errors, f"{item_path}.change_summary[{summary_index}]", "must be non-empty text")
    _unique(version_ids, "passport.document_versions.version_id", errors)

    evidence_errors, _ = validate_evidence(root.get("evidence"), path="passport.evidence")
    errors.extend(evidence_errors)

    history = _sequence(root.get("role_history"), "passport.role_history", errors)
    role_ids: list[str] = []
    fingerprints: list[str] = []
    for index, raw in enumerate(history):
        item_path = f"passport.role_history[{index}]"
        item = _mapping(raw, item_path, errors)
        role_ids.append(_required_text(item, "role_id", item_path, errors))
        fingerprints.append(_required_text(item, "content_fingerprint", item_path, errors))
        _enum(item, "recommendation", DECISIONS, item_path, errors)
        ok, reason = is_safe_exact_posting_url(item.get("exact_posting_url"), synthetic=False)
        if not ok:
            _error(errors, f"{item_path}.exact_posting_url", reason)
    _unique(role_ids, "passport.role_history.role_id", errors)
    _unique(fingerprints, "passport.role_history.content_fingerprint", errors)

    events = _sequence(root.get("application_events"), "passport.application_events", errors)
    event_ids: list[str] = []
    for index, raw in enumerate(events):
        item_path = f"passport.application_events[{index}]"
        item = _mapping(raw, item_path, errors)
        event_ids.append(_required_text(item, "event_id", item_path, errors))
        _required_text(item, "role_id", item_path, errors)
        _enum(item, "stage", APPLICATION_STAGES, item_path, errors)
        _enum(item, "source", {"user", "posting", "system"}, item_path, errors)
        _required_text(item, "recorded_at", item_path, errors)
    _unique(event_ids, "passport.application_events.event_id", errors)
    _sequence(root.get("corrections"), "passport.corrections", errors)
    feedback = _sequence(root.get("feedback"), "passport.feedback", errors)
    feedback_ids: list[str] = []
    for index, raw in enumerate(feedback):
        item_path = f"passport.feedback[{index}]"
        item = _mapping(raw, item_path, errors)
        feedback_ids.append(_required_text(item, "feedback_id", item_path, errors))
        _enum(item, "category", {"search", "role", "document", "workflow"}, item_path, errors)
        _required_text(item, "statement", item_path, errors)
        if not isinstance(item.get("confirmed"), bool):
            _error(errors, f"{item_path}.confirmed", "must be true or false")
        _required_text(item, "recorded_at", item_path, errors)
    _unique(feedback_ids, "passport.feedback.feedback_id", errors)
    automation_raw = root.get("automation")
    if automation_raw is not None:
        automation = _mapping(automation_raw, "passport.automation", errors)
        if not isinstance(automation.get("enabled"), bool):
            _error(errors, "passport.automation.enabled", "must be true or false")
        cadence = _enum(automation, "cadence", {"manual", "daily", "weekdays", "weekly", "custom"}, "passport.automation", errors)
        local_time = automation.get("local_time")
        if cadence == "manual":
            if local_time is not None:
                _error(errors, "passport.automation.local_time", "must be null for manual cadence")
        elif not isinstance(local_time, str) or len(local_time) != 5 or local_time[2:3] != ":":
            _error(errors, "passport.automation.local_time", "must use HH:MM for scheduled cadence")
        else:
            try:
                hour, minute = (int(part) for part in local_time.split(":"))
                if hour not in range(24) or minute not in range(60):
                    raise ValueError
            except ValueError:
                _error(errors, "passport.automation.local_time", "must be a valid 24-hour time")
        _required_text(automation, "timezone", "passport.automation", errors)
        max_roles = automation.get("max_displayed_roles")
        if not isinstance(max_roles, int) or isinstance(max_roles, bool) or not 1 <= max_roles <= 10:
            _error(errors, "passport.automation.max_displayed_roles", "must be an integer from 1 to 10")
        _enum(automation, "application_pack_mode", {"on_request", "apply_roles"}, "passport.automation", errors)
        _enum(automation, "destination", {"scheduled_result_task", "continuing_task"}, "passport.automation", errors)
        continuity_mode = automation.get("continuity_mode")
        if continuity_mode is not None and continuity_mode not in {"task_context", "snapshot_only", "verified_persistent"}:
            _error(errors, "passport.automation.continuity_mode", "must be task_context, snapshot_only or verified_persistent")
    _required_text(root, "updated_at", "passport", errors)
    return errors


def _evidence_text(raw: Any, path: str, evidence_ids: set[str], errors: list[str], *, allow_empty_evidence: bool = False) -> None:
    item = _mapping(raw, path, errors)
    _required_text(item, "text", path, errors)
    refs = _sequence(item.get("evidence_ids"), f"{path}.evidence_ids", errors)
    if not refs and not allow_empty_evidence:
        _error(errors, f"{path}.evidence_ids", "at least one evidence ID is required")
    unknown = sorted({str(ref) for ref in refs if str(ref) not in evidence_ids})
    if unknown:
        _error(errors, f"{path}.evidence_ids", "unknown evidence ID(s): " + ", ".join(unknown))


def validate_application_pack(data: Any) -> list[str]:
    errors: list[str] = []
    root = _mapping(data, "application_pack", errors)
    if root.get("schema_version") != SCHEMA_VERSION:
        _error(errors, "application_pack.schema_version", f"must equal {SCHEMA_VERSION}")
    candidate = _mapping(root.get("candidate"), "application_pack.candidate", errors)
    _required_text(candidate, "name", "application_pack.candidate", errors)
    _sequence(candidate.get("contact"), "application_pack.candidate.contact", errors)
    role_errors = validate_role_dossier(root.get("role"), path="application_pack.role")
    errors.extend(role_errors)
    role = root.get("role") if isinstance(root.get("role"), dict) else {}
    if role.get("decision") == "skip":
        _error(errors, "application_pack.role.decision", "application packs are not produced for Skip roles")

    evidence_errors, evidence_ids = validate_evidence(root.get("evidence"), path="application_pack.evidence")
    errors.extend(evidence_errors)
    settings = _mapping(root.get("document_settings"), "application_pack.document_settings", errors)
    template = _enum(settings, "template", {"professional", "executive", "reference"}, "application_pack.document_settings", errors)
    reference_template_name = settings.get("reference_template_name")
    if template == "reference" and (not isinstance(reference_template_name, str) or not reference_template_name.strip()):
        _error(errors, "application_pack.document_settings.reference_template_name", "is required when template is reference")
    if template != "reference" and reference_template_name is not None:
        _error(errors, "application_pack.document_settings.reference_template_name", "must be null unless template is reference")
    page_target = settings.get("page_target")
    if page_target not in {1, 2}:
        _error(errors, "application_pack.document_settings.page_target", "must be 1 or 2")
    min_font = settings.get("minimum_font_pt")
    if not isinstance(min_font, (int, float)) or isinstance(min_font, bool) or min_font < 9:
        _error(errors, "application_pack.document_settings.minimum_font_pt", "must be at least 9")
    cv_only = settings.get("cv_only")
    if not isinstance(cv_only, bool):
        _error(errors, "application_pack.document_settings.cv_only", "must be true or false")

    cv = _mapping(root.get("cv"), "application_pack.cv", errors)
    sections = _sequence(cv.get("sections"), "application_pack.cv.sections", errors)
    if len(sections) < 4:
        _error(errors, "application_pack.cv.sections", "at least four meaningful sections are required")
    headings: list[str] = []
    break_count = 0
    for section_index, raw_section in enumerate(sections):
        section_path = f"application_pack.cv.sections[{section_index}]"
        section = _mapping(raw_section, section_path, errors)
        heading = _required_text(section, "heading", section_path, errors)
        headings.append(heading.casefold())
        section_type = _enum(section, "type", {"paragraphs", "bullets", "skills", "experience"}, section_path, errors)
        if section.get("page_break_before") is True:
            break_count += 1
        elif section.get("page_break_before") is not False:
            _error(errors, f"{section_path}.page_break_before", "must be true or false")
        items = _sequence(section.get("items"), f"{section_path}.items", errors)
        if not items:
            _error(errors, f"{section_path}.items", "must not be empty")
        if section_type == "experience":
            for item_index, raw_exp in enumerate(items):
                exp_path = f"{section_path}.items[{item_index}]"
                exp = _mapping(raw_exp, exp_path, errors)
                for key in ("role", "company", "dates"):
                    _required_text(exp, key, exp_path, errors)
                _evidence_text(
                    {"text": "experience header", "evidence_ids": exp.get("evidence_ids")},
                    exp_path,
                    evidence_ids,
                    errors,
                )
                bullets = _sequence(exp.get("bullets"), f"{exp_path}.bullets", errors)
                for bullet_index, bullet in enumerate(bullets):
                    _evidence_text(bullet, f"{exp_path}.bullets[{bullet_index}]", evidence_ids, errors)
        else:
            for item_index, item in enumerate(items):
                _evidence_text(item, f"{section_path}.items[{item_index}]", evidence_ids, errors)
    _unique(headings, "application_pack.cv.sections.heading", errors)
    expected_breaks = 0 if page_target == 1 else 1
    if break_count != expected_breaks:
        _error(errors, "application_pack.cv.sections.page_break_before", f"page target {page_target} requires exactly {expected_breaks} controlled page break(s); found {break_count}")

    cover = _mapping(root.get("cover_letter"), "application_pack.cover_letter", errors)
    enabled = cover.get("enabled")
    if not isinstance(enabled, bool):
        _error(errors, "application_pack.cover_letter.enabled", "must be true or false")
    if cv_only is False and enabled is not True:
        _error(errors, "application_pack.cover_letter.enabled", "paired cover letter is required unless cv_only=true")
    if cv_only is True and enabled is True:
        _error(errors, "application_pack.cover_letter.enabled", "must be false when cv_only=true")
    paragraphs = _sequence(cover.get("paragraphs"), "application_pack.cover_letter.paragraphs", errors)
    if enabled:
        if not 4 <= len(paragraphs) <= 6:
            _error(errors, "application_pack.cover_letter.paragraphs", "an enabled cover letter requires four to six narrative paragraphs")
        for index, paragraph in enumerate(paragraphs):
            _evidence_text(paragraph, f"application_pack.cover_letter.paragraphs[{index}]", evidence_ids, errors)
        opening = str(paragraphs[0].get("text", "")).casefold() if paragraphs and isinstance(paragraphs[0], dict) else ""
        banned_openings = ("i am applying", "i'm applying", "i am excited to apply", "my skills align")
        if opening.startswith(banned_openings):
            _error(errors, "application_pack.cover_letter.paragraphs[0].text", "opening is generic and prohibited")
    change_log = _mapping(root.get("change_log"), "application_pack.change_log", errors)
    for key in ("included_evidence", "excluded_evidence", "keywords_included", "keywords_omitted", "ambiguities"):
        _sequence(change_log.get(key), f"application_pack.change_log.{key}", errors)
    _required_text(change_log, "archetype", "application_pack.change_log", errors)
    return errors


def validate_run_result(data: Any) -> list[str]:
    errors: list[str] = []
    root = _mapping(data, "run_result", errors)
    if root.get("schema_version") != SCHEMA_VERSION:
        _error(errors, "run_result.schema_version", f"must equal {SCHEMA_VERSION}")
    _required_text(root, "run_id", "run_result", errors)
    status = _enum(root, "status", {"SUCCESS", "SUCCESS_NO_PACK", "PARTIAL", "BLOCKED", "FAILED"}, "run_result", errors)
    request = _mapping(root.get("request"), "run_result.request", errors)
    if not isinstance(request.get("search_requested"), bool):
        _error(errors, "run_result.request.search_requested", "must be true or false")
    packs_requested = _sequence(request.get("application_packs_requested"), "run_result.request.application_packs_requested", errors)
    _unique([str(value) for value in packs_requested], "run_result.request.application_packs_requested", errors)
    limits = _mapping(root.get("limits"), "run_result.limits", errors)
    roles = _sequence(root.get("roles"), "run_result.roles", errors)
    role_ids: list[str] = []
    urls: list[str] = []
    fingerprints: list[str] = []
    apply_count = 0
    for index, role in enumerate(roles):
        errors.extend(validate_role_dossier(role, path=f"run_result.roles[{index}]"))
        if isinstance(role, dict):
            role_ids.append(str(role.get("role_id", "")))
            identity = role.get("identity") if isinstance(role.get("identity"), dict) else {}
            urls.append(str(identity.get("exact_posting_url", "")))
            fingerprints.append(str(identity.get("content_fingerprint", "")))
            if role.get("decision") == "apply":
                apply_count += 1
    _unique(role_ids, "run_result.roles.role_id", errors)
    _unique(urls, "run_result.roles.identity.exact_posting_url", errors)
    _unique(fingerprints, "run_result.roles.identity.content_fingerprint", errors)
    displayed_limit = limits.get("max_displayed_roles")
    apply_limit = limits.get("max_apply_roles")
    if isinstance(displayed_limit, int) and len(roles) > displayed_limit:
        _error(errors, "run_result.roles", "displayed role count exceeds max_displayed_roles")
    if isinstance(apply_limit, int) and apply_count > apply_limit:
        _error(errors, "run_result.roles", "Apply count exceeds max_apply_roles")
    files = _sequence(root.get("files"), "run_result.files", errors)
    reports = _sequence(root.get("validation_reports"), "run_result.validation_reports", errors)
    if status == "SUCCESS" and not files:
        _error(errors, "run_result.files", "SUCCESS requires generated files")
    if status == "SUCCESS" and not reports:
        _error(errors, "run_result.validation_reports", "SUCCESS requires validation reports")
    if status == "SUCCESS" and not packs_requested:
        _error(errors, "run_result.status", "SUCCESS is reserved for completed requested application packs; use SUCCESS_NO_PACK")
    if status == "SUCCESS_NO_PACK" and packs_requested:
        _error(errors, "run_result.status", "requested application packs cannot end as SUCCESS_NO_PACK")
    return errors


def load_json(path: Path) -> Any:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


VALIDATORS = {
    "career-passport": validate_career_passport,
    "role-dossier": validate_role_dossier,
    "application-pack": validate_application_pack,
    "run-result": validate_run_result,
}
