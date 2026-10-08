#!/usr/bin/env python3
"""Deterministic semantic validation for Coupon Hive confirmed WatchSpecs."""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


TOP_LEVEL_KEYS = {
    "schema_version",
    "skill_version",
    "confirmation",
    "task_binding",
    "host_payload",
    "query",
    "scope",
    "economics",
    "accepted_offer_types",
    "conditions",
    "sources",
    "schedule",
    "notification",
    "status",
}
QUERY_KEYS = {"description", "category", "variants", "condition"}
SCOPE_KEYS = {
    "country_code",
    "currency",
    "location_precision",
    "locality",
    "online_allowed",
    "pickup_allowed",
    "deadline",
}
ECONOMICS_KEYS = {
    "maximum_effective_price",
    "minimum_discount_percent",
    "free_definition",
}
CONDITION_KEYS = {
    "purchase_required",
    "rebate",
    "membership",
    "trial",
    "subscription_or_renewal",
    "account_required",
    "marketing_consent",
    "loyalty_points",
    "deposit_or_authorization_hold",
    "app_only",
    "new_customer",
    "eligibility_assertions",
}
SOURCE_KEYS = {
    "allowed_merchants",
    "blocked_merchants",
    "access_policy",
    "allow_unverified_leads",
    "maximum_queries_per_run",
    "maximum_sources_per_run",
}
SCHEDULE_KEYS = {
    "frequency",
    "interval",
    "weekdays",
    "local_time",
    "minute",
    "day_of_month",
    "timezone",
    "quiet_hours",
    "ends_at",
    "maximum_runs",
}
NOTIFICATION_KEYS = {
    "events",
    "minimum_price_improvement",
    "minimum_percent_improvement",
    "expiry_warning_hours",
    "silent_when_unchanged",
    "include_digest",
}
HOST_PAYLOAD_KEYS = {
    "task_title",
    "host_surface",
    "prompt_template_id",
    "recurring_prompt_sha256",
    "requested_lifecycle_actions",
}
LIFECYCLE_TOP_LEVEL_KEYS = {
    "schema_version",
    "skill_version",
    "confirmation",
    "mutation",
    "status",
}
LIFECYCLE_CONFIRMATION_KEYS = {
    "confirmed_by_user",
    "confirmed_at",
    "lifecycle_card_summary",
    "approved_mutation_digest",
}
LIFECYCLE_MUTATION_KEYS = {
    "host_surface",
    "existing_task_id",
    "task_title",
    "action",
    "expected_current_state",
    "expected_final_state",
}
LIFECYCLE_OBSERVATION_KEYS = {
    "source",
    "observed_at",
    "host_surface",
    "existing_task_id",
    "task_title",
    "observed_current_state",
}
LIFECYCLE_RECEIPT_KEYS = {
    "source",
    "received_at",
    "status",
    "host_surface",
    "task_id",
    "task_title",
    "action",
    "final_state",
}
COMPOUND_UPDATE_RECEIPT_KEYS = {
    "source",
    "received_at",
    "status",
    "host_surface",
    "task_id",
    "task_title",
    "structured_schedule",
}

ALLOWED_CATEGORIES = {
    "physical_goods",
    "free_public_event",
    "manufacturer_sample",
}
ALLOWED_CONDITIONS = {"new", "used", "refurbished", "open_box", "not_applicable"}
ALLOWED_OFFER_TYPES = {
    "price_drop",
    "public_coupon",
    "free_now",
    "free_with_purchase",
    "free_after_rebate",
    "bogo",
    "free_sample",
}
ALLOWED_EVENTS = {
    "new_verified_match",
    "price_threshold_crossed",
    "material_condition_changed",
    "expiry_warning",
}
WEEKDAYS = {"MO", "TU", "WE", "TH", "FR", "SA", "SU"}
TIME_RE = re.compile(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
TIMEZONE_RE = re.compile(r"^(?:UTC|[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+)$")
RFC3339_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$"
)
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
DIGEST_BOUND_FIELDS = (
    "task_binding",
    "host_payload",
    "query",
    "scope",
    "economics",
    "accepted_offer_types",
    "conditions",
    "sources",
    "schedule",
    "notification",
)
PROMPT_TEMPLATE_ID = "coupon-hive-recurring-v1"
ALLOWED_HOST_SURFACES = {"chatgpt_plugin", "codex_skill"}
ALLOWED_LIFECYCLE_ACTIONS = {"pause", "resume", "delete"}
PROMPT_CORE_FIELDS = (
    "schema_version",
    "skill_version",
    "query",
    "scope",
    "economics",
    "accepted_offer_types",
    "conditions",
    "sources",
    "schedule",
    "notification",
)
MAX_MONEY_VALUE = 1_000_000_000_000


def _exact_object(
    value: Any,
    expected: set[str],
    path: str,
    errors: list[str],
) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return None
    missing = sorted(expected - set(value))
    extra = sorted(set(value) - expected)
    if missing:
        errors.append(f"{path} is missing fields: {', '.join(missing)}")
    if extra:
        errors.append(f"{path} has undeclared fields: {', '.join(extra)}")
    return value


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, float) and math.isfinite(value)


def _is_choice(value: Any, choices: set[str]) -> bool:
    return isinstance(value, str) and value in choices


def _is_exact_host_string(
    value: Any,
    *,
    minimum: int,
    maximum: int,
    prefix: str | None = None,
) -> bool:
    if not isinstance(value, str) or not minimum <= len(value) <= maximum:
        return False
    if value != value.strip() or value.splitlines() != [value]:
        return False
    if prefix is not None and not value.startswith(prefix):
        return False
    return not any(
        unicodedata.category(character) in {"Cc", "Cf", "Zl", "Zp"}
        for character in value
    )


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or RFC3339_RE.fullmatch(value) is None:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else None


def _timestamp_is_valid(value: Any) -> bool:
    return _parse_timestamp(value) is not None


def _clock_minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def _inside_quiet_hours(value: str, start: str, end: str) -> bool:
    point = _clock_minutes(value)
    lower = _clock_minutes(start)
    upper = _clock_minutes(end)
    if lower < upper:
        return lower <= point < upper
    return point >= lower or point < upper


def _canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def approval_digest(payload: dict[str, Any]) -> str:
    """Bind every scheduled or externally mutating WatchSpec field canonically."""

    protected = {key: payload.get(key) for key in DIGEST_BOUND_FIELDS}
    confirmation = payload.get("confirmation")
    protected["watch_card_summary"] = (
        confirmation.get("watch_card_summary")
        if isinstance(confirmation, dict)
        else None
    )
    canonical = _canonical_json_bytes(protected)
    return "sha256:" + hashlib.sha256(canonical).hexdigest()


def render_recurring_prompt(payload: dict[str, Any]) -> str:
    """Render the exact host prompt from digest-bound WatchSpec fields."""

    host_payload = payload.get("host_payload")
    host_surface = (
        host_payload.get("host_surface")
        if isinstance(host_payload, dict)
        else None
    )
    invocation = {
        "chatgpt_plugin": "the selected Coupon Hive Plugin",
        "codex_skill": "$coupon-hive",
    }.get(host_surface)
    if invocation is None:
        raise ValueError("unsupported host surface")

    prompt_core = {key: payload.get(key) for key in PROMPT_CORE_FIELDS}
    canonical_spec = _canonical_json_bytes(prompt_core).decode("utf-8")
    return (
        f"Use {invocation} version 0.1.0 to run the recurring offer watch "
        f"defined by {PROMPT_TEMPLATE_ID}.\n\n"
        "Treat the embedded JSON as the complete authority boundary. Use only the "
        "OpenAI host's authorized public-web research path; never use a scraper, "
        "crawler, unofficial connector, site-search form, or third-party API. "
        "Respect source terms and access controls, skip uncertain access, disclose "
        "coverage gaps, prefer first-party sources, re-open final landing pages, "
        "and timestamp, normalize, classify, and de-duplicate evidence.\n\n"
        "Notify only for a new verified_current match, a confirmed threshold "
        "crossing, a material condition correction, or a requested expiry warning. "
        "Stay quiet when nothing actionable changed unless the JSON requests a "
        "digest. Separate unverified leads from verified matches. Never purchase, "
        "reserve, sign up, submit a form, test a code at checkout, download a file, "
        "or request credentials.\n\n"
        "If Coupon Hive 0.1.0 is unavailable or incompatible, research cannot be "
        "performed, evidence cannot be checked, or the JSON is invalid, fail closed "
        "and report the specific problem. Never claim a run, notification, or "
        "schedule succeeded without a host receipt.\n\n"
        f"CouponHiveRecurringWatchJSON:\n{canonical_spec}"
    )


def recurring_prompt_digest(payload: dict[str, Any]) -> str:
    """Return the content digest of the exact UTF-8 recurring prompt bytes."""

    prompt = render_recurring_prompt(payload).encode("utf-8")
    return "sha256:" + hashlib.sha256(prompt).hexdigest()


def lifecycle_approval_digest(payload: dict[str, Any]) -> str:
    """Bind one standalone lifecycle mutation and its displayed card."""

    confirmation = payload.get("confirmation")
    protected = {
        "mutation": payload.get("mutation"),
        "lifecycle_card_summary": (
            confirmation.get("lifecycle_card_summary")
            if isinstance(confirmation, dict)
            else None
        ),
    }
    canonical = _canonical_json_bytes(protected)
    return "sha256:" + hashlib.sha256(canonical).hexdigest()


def validate_lifecycle_spec(payload: Any) -> list[str]:
    """Validate a separately confirmed pause, resume, or delete mutation."""

    errors: list[str] = []
    root = _exact_object(payload, LIFECYCLE_TOP_LEVEL_KEYS, "$", errors)
    if root is None:
        return errors

    if not _is_int(root.get("schema_version")) or root.get("schema_version") != 1:
        errors.append("$.schema_version must equal 1")
    if root.get("skill_version") != "0.1.0":
        errors.append("$.skill_version must equal 0.1.0")
    if root.get("status") != "confirmed":
        errors.append("$.status must equal confirmed")

    confirmation = _exact_object(
        root.get("confirmation"),
        LIFECYCLE_CONFIRMATION_KEYS,
        "$.confirmation",
        errors,
    )
    if confirmation is not None:
        if confirmation.get("confirmed_by_user") is not True:
            errors.append("$.confirmation.confirmed_by_user must be true")
        if _parse_timestamp(confirmation.get("confirmed_at")) is None:
            errors.append("$.confirmation.confirmed_at must be an ISO-8601 timestamp")
        summary = confirmation.get("lifecycle_card_summary")
        if not isinstance(summary, str) or not summary.strip() or len(summary) > 2000:
            errors.append(
                "$.confirmation.lifecycle_card_summary must contain the approved card"
            )
        digest = confirmation.get("approved_mutation_digest")
        if not isinstance(digest, str) or DIGEST_RE.fullmatch(digest) is None:
            errors.append(
                "$.confirmation.approved_mutation_digest must be a lowercase SHA-256 digest"
            )

    mutation = _exact_object(
        root.get("mutation"),
        LIFECYCLE_MUTATION_KEYS,
        "$.mutation",
        errors,
    )
    if mutation is not None:
        if not _is_choice(mutation.get("host_surface"), ALLOWED_HOST_SURFACES):
            errors.append("$.mutation.host_surface is unsupported")
        task_id = mutation.get("existing_task_id")
        if not _is_exact_host_string(task_id, minimum=1, maximum=300):
            errors.append(
                "$.mutation.existing_task_id must be the exact single-line host task identifier"
            )
        title = mutation.get("task_title")
        if not _is_exact_host_string(
            title,
            minimum=15,
            maximum=120,
            prefix="Coupon Hive — ",
        ):
            errors.append(
                "$.mutation.task_title must be an exact single-line Coupon Hive — title of 15 to 120 characters"
            )
        action = mutation.get("action")
        if not _is_choice(action, ALLOWED_LIFECYCLE_ACTIONS):
            errors.append("$.mutation.action must be pause, resume, or delete")
        current_state = mutation.get("expected_current_state")
        if not _is_choice(current_state, {"active", "paused"}):
            errors.append("$.mutation.expected_current_state is invalid")
        elif action == "pause" and current_state != "active":
            errors.append("pause requires an expected current state of active")
        elif action == "resume" and current_state != "paused":
            errors.append("resume requires an expected current state of paused")
        expected_final = {
            "pause": "paused",
            "resume": "active",
            "delete": "deleted",
        }.get(action) if isinstance(action, str) else None
        if mutation.get("expected_final_state") != expected_final:
            errors.append(
                "$.mutation.expected_final_state does not match the requested action"
            )

    if confirmation is not None:
        try:
            expected_digest = lifecycle_approval_digest(root)
        except (TypeError, ValueError):
            errors.append(
                "$.confirmation.approved_mutation_digest cannot bind invalid values"
            )
        else:
            if confirmation.get("approved_mutation_digest") != expected_digest:
                errors.append(
                    "$.confirmation.approved_mutation_digest does not match the lifecycle mutation"
                )

    return errors


def _string_list(
    value: Any,
    path: str,
    errors: list[str],
    *,
    maximum: int,
    item_maximum: int | None = None,
) -> list[str]:
    if not isinstance(value, list):
        errors.append(f"{path} must be an array")
        return []
    if len(value) > maximum:
        errors.append(f"{path} exceeds {maximum} entries")
    if any(
        not isinstance(item, str)
        or not item.strip()
        or (item_maximum is not None and len(item) > item_maximum)
        for item in value
    ):
        errors.append(f"{path} entries must be non-empty strings")
        return []
    return value


def _normalized_merchant(value: str) -> str | None:
    candidate = value.strip().lower()
    try:
        parsed = urlparse(candidate if "://" in candidate else f"https://{candidate}")
        host = parsed.hostname or candidate
    except ValueError:
        return None
    return host.removeprefix("www.").rstrip(".")


def validate_watch_spec(payload: Any) -> list[str]:
    """Return every deterministic validation error; an empty list means valid."""

    errors: list[str] = []
    root = _exact_object(payload, TOP_LEVEL_KEYS, "$", errors)
    if root is None:
        return errors

    if not _is_int(root.get("schema_version")) or root.get("schema_version") != 1:
        errors.append("$.schema_version must equal 1")
    if root.get("skill_version") != "0.1.0":
        errors.append("$.skill_version must equal 0.1.0")
    if root.get("status") != "confirmed":
        errors.append("$.status must equal confirmed")

    confirmed_time: datetime | None = None
    confirmation = _exact_object(
        root.get("confirmation"),
        {
            "confirmed_by_user",
            "confirmed_at",
            "watch_card_summary",
            "approved_spec_digest",
        },
        "$.confirmation",
        errors,
    )
    if confirmation is not None:
        if confirmation.get("confirmed_by_user") is not True:
            errors.append("$.confirmation.confirmed_by_user must be true")
        confirmed_time = _parse_timestamp(confirmation.get("confirmed_at"))
        if confirmed_time is None:
            errors.append("$.confirmation.confirmed_at must be an ISO-8601 timestamp")
        summary = confirmation.get("watch_card_summary")
        if not isinstance(summary, str) or not summary.strip() or len(summary) > 4000:
            errors.append("$.confirmation.watch_card_summary must contain the approved card")
        digest = confirmation.get("approved_spec_digest")
        if not isinstance(digest, str) or DIGEST_RE.fullmatch(digest) is None:
            errors.append("$.confirmation.approved_spec_digest must be a lowercase SHA-256 digest")

    binding = _exact_object(
        root.get("task_binding"),
        {"action", "existing_task_id"},
        "$.task_binding",
        errors,
    )
    if binding is not None:
        action = binding.get("action")
        task_id = binding.get("existing_task_id")
        if not _is_choice(action, {"create", "update"}):
            errors.append("$.task_binding.action must be create or update")
        elif action == "create" and task_id is not None:
            errors.append("create must not carry an existing task identifier")
        elif action == "update" and not _is_exact_host_string(
            task_id, minimum=1, maximum=300
        ):
            errors.append("update must carry the exact existing task identifier")

    host_payload = _exact_object(
        root.get("host_payload"),
        HOST_PAYLOAD_KEYS,
        "$.host_payload",
        errors,
    )
    if host_payload is not None:
        title = host_payload.get("task_title")
        if not _is_exact_host_string(
            title,
            minimum=15,
            maximum=120,
            prefix="Coupon Hive — ",
        ):
            errors.append(
                "$.host_payload.task_title must be an exact single-line Coupon Hive — title of 15 to 120 characters"
            )
        if not _is_choice(
            host_payload.get("host_surface"), ALLOWED_HOST_SURFACES
        ):
            errors.append("$.host_payload.host_surface is unsupported")
        if host_payload.get("prompt_template_id") != PROMPT_TEMPLATE_ID:
            errors.append(
                f"$.host_payload.prompt_template_id must equal {PROMPT_TEMPLATE_ID}"
            )
        prompt_digest = host_payload.get("recurring_prompt_sha256")
        if not isinstance(prompt_digest, str) or DIGEST_RE.fullmatch(prompt_digest) is None:
            errors.append(
                "$.host_payload.recurring_prompt_sha256 must be a lowercase SHA-256 digest"
            )
        lifecycle_actions = _string_list(
            host_payload.get("requested_lifecycle_actions"),
            "$.host_payload.requested_lifecycle_actions",
            errors,
            maximum=1,
        )
        if (
            len(lifecycle_actions) != len(set(lifecycle_actions))
            or not set(lifecycle_actions).issubset(ALLOWED_LIFECYCLE_ACTIONS)
        ):
            errors.append(
                "$.host_payload.requested_lifecycle_actions must contain at most one supported action"
            )
        if (
            binding is not None
            and binding.get("action") == "create"
            and lifecycle_actions
        ):
            errors.append("create cannot include a lifecycle follow-up action")
        if "delete" in lifecycle_actions:
            errors.append(
                "delete must use a separately confirmed lifecycle mutation rather than a compound update"
            )
        try:
            expected_prompt_digest = recurring_prompt_digest(root)
        except (TypeError, ValueError):
            errors.append(
                "$.host_payload.recurring_prompt_sha256 cannot bind invalid prompt fields"
            )
        else:
            if prompt_digest != expected_prompt_digest:
                errors.append(
                    "$.host_payload.recurring_prompt_sha256 does not match the exact rendered prompt bytes"
                )

    query = _exact_object(root.get("query"), QUERY_KEYS, "$.query", errors)
    if query is not None:
        description = query.get("description")
        if not isinstance(description, str) or not description.strip() or len(description) > 500:
            errors.append("$.query.description must be 1 to 500 characters")
        if not _is_choice(query.get("category"), ALLOWED_CATEGORIES):
            errors.append("$.query.category is outside the Store release scope")
        variants = _string_list(
            query.get("variants"),
            "$.query.variants",
            errors,
            maximum=30,
            item_maximum=100,
        )
        if len(set(variants)) != len(variants):
            errors.append("$.query.variants must be unique")
        condition = query.get("condition")
        if not isinstance(condition, list) or not condition:
            errors.append("$.query.condition must contain unique supported values")
        elif any(not isinstance(item, str) for item in condition):
            errors.append("$.query.condition must contain unique supported values")
        elif len(condition) != len(set(condition)) or not set(condition).issubset(
            ALLOWED_CONDITIONS
        ):
            errors.append("$.query.condition must contain unique supported values")

    scope = _exact_object(root.get("scope"), SCOPE_KEYS, "$.scope", errors)
    if scope is not None:
        country = scope.get("country_code")
        currency = scope.get("currency")
        if not isinstance(country, str) or re.fullmatch(r"[A-Z]{2}", country) is None:
            errors.append("$.scope.country_code must be two uppercase letters")
        if not isinstance(currency, str) or re.fullmatch(r"[A-Z]{3}", currency) is None:
            errors.append("$.scope.currency must be three uppercase letters")
        precision = scope.get("location_precision")
        locality = scope.get("locality")
        if not _is_choice(
            precision, {"country", "region", "city", "postal_code"}
        ):
            errors.append("$.scope.location_precision is invalid")
        elif precision == "country" and locality is not None:
            errors.append("country-level scope must not carry a finer locality")
        elif precision != "country" and (
            not isinstance(locality, str) or not locality.strip()
        ):
            errors.append("region, city, or postal-code scope requires a locality")
        if isinstance(locality, str) and len(locality) > 120:
            errors.append("$.scope.locality must be at most 120 characters")
        for key in ("online_allowed", "pickup_allowed"):
            if not isinstance(scope.get(key), bool):
                errors.append(f"$.scope.{key} must be boolean")
        deadline = scope.get("deadline")
        if deadline is not None and not _timestamp_is_valid(deadline):
            errors.append("$.scope.deadline must be null or an ISO-8601 timestamp")
        elif deadline is not None and confirmed_time is not None:
            parsed_deadline = _parse_timestamp(deadline)
            if parsed_deadline is not None and parsed_deadline <= confirmed_time:
                errors.append("$.scope.deadline must be after confirmation")

    economics = _exact_object(
        root.get("economics"), ECONOMICS_KEYS, "$.economics", errors
    )
    if economics is not None:
        price = economics.get("maximum_effective_price")
        discount = economics.get("minimum_discount_percent")
        if price is not None and (
            not _is_number(price) or price < 0 or price > MAX_MONEY_VALUE
        ):
            errors.append(
                "$.economics.maximum_effective_price must be null or 0 to 1000000000000"
            )
        if discount is not None and (
            not _is_number(discount) or discount < 0 or discount > 100
        ):
            errors.append("$.economics.minimum_discount_percent must be 0 to 100")
        if not _is_choice(
            economics.get("free_definition"),
            {
                "free_now_only",
                "conditional_free_allowed",
                "not_applicable",
            },
        ):
            errors.append("$.economics.free_definition is invalid")

    offer_types = root.get("accepted_offer_types")
    if not isinstance(offer_types, list) or not offer_types:
        errors.append("$.accepted_offer_types must contain unique in-scope values")
        offer_types = []
    elif any(not isinstance(item, str) for item in offer_types):
        errors.append("$.accepted_offer_types must contain unique in-scope values")
        offer_types = []
    elif len(offer_types) != len(set(offer_types)) or not set(
        offer_types
    ).issubset(ALLOWED_OFFER_TYPES):
        errors.append("$.accepted_offer_types must contain unique in-scope values")
        offer_types = []

    conditions = _exact_object(
        root.get("conditions"), CONDITION_KEYS, "$.conditions", errors
    )
    if conditions is not None:
        for key in CONDITION_KEYS - {"eligibility_assertions"}:
            if not isinstance(conditions.get(key), bool):
                errors.append(f"$.conditions.{key} must be boolean")
        if conditions.get("trial") is not False:
            errors.append("trial promotions are outside the Store release scope")
        if conditions.get("subscription_or_renewal") is not False:
            errors.append("subscription promotions are outside the Store release scope")
        _string_list(
            conditions.get("eligibility_assertions"),
            "$.conditions.eligibility_assertions",
            errors,
            maximum=20,
            item_maximum=100,
        )
        conditional_pairs = {
            "free_with_purchase": "purchase_required",
            "free_after_rebate": "rebate",
            "bogo": "purchase_required",
        }
        for offer_type, condition_key in conditional_pairs.items():
            if offer_type in offer_types and conditions.get(condition_key) is not True:
                errors.append(
                    f"{offer_type} requires $.conditions.{condition_key} to be true"
                )
        if (
            economics is not None
            and economics.get("free_definition") == "free_now_only"
        ):
            if set(offer_types) != {"free_now"}:
                errors.append("free_now_only may accept only the free_now offer type")
            for key in (
                "purchase_required",
                "rebate",
                "membership",
                "account_required",
                "marketing_consent",
                "loyalty_points",
                "deposit_or_authorization_hold",
                "app_only",
                "new_customer",
            ):
                if conditions.get(key) is not False:
                    errors.append(f"free_now_only requires $.conditions.{key} to be false")

    sources = _exact_object(root.get("sources"), SOURCE_KEYS, "$.sources", errors)
    if sources is not None:
        allowed = _string_list(
            sources.get("allowed_merchants"),
            "$.sources.allowed_merchants",
            errors,
            maximum=100,
            item_maximum=200,
        )
        blocked = _string_list(
            sources.get("blocked_merchants"),
            "$.sources.blocked_merchants",
            errors,
            maximum=100,
            item_maximum=200,
        )
        allowed_normalized = {_normalized_merchant(item) for item in allowed}
        blocked_normalized = {_normalized_merchant(item) for item in blocked}
        if None in allowed_normalized or None in blocked_normalized:
            errors.append("allowed and blocked merchants must be valid names or URLs")
        allowed_normalized.discard(None)
        blocked_normalized.discard(None)
        overlap = allowed_normalized & blocked_normalized
        if overlap:
            errors.append(
                "allowed and blocked merchant lists overlap: " + ", ".join(sorted(overlap))
            )
        if sources.get("access_policy") != "host_public_web_only":
            errors.append("$.sources.access_policy must equal host_public_web_only")
        if not isinstance(sources.get("allow_unverified_leads"), bool):
            errors.append("$.sources.allow_unverified_leads must be boolean")
        for key, lower, upper in (
            ("maximum_queries_per_run", 1, 20),
            ("maximum_sources_per_run", 1, 100),
        ):
            value = sources.get(key)
            if not _is_int(value) or not lower <= value <= upper:
                errors.append(f"$.sources.{key} must be {lower} to {upper}")

    schedule = _exact_object(
        root.get("schedule"), SCHEDULE_KEYS, "$.schedule", errors
    )
    if schedule is not None:
        frequency = schedule.get("frequency")
        if not _is_choice(frequency, {"hourly", "daily", "weekly", "monthly"}):
            errors.append("$.schedule.frequency is invalid")
        interval = schedule.get("interval")
        if not _is_int(interval) or not 1 <= interval <= 365:
            errors.append("$.schedule.interval must be 1 to 365")
        weekdays = schedule.get("weekdays")
        if not isinstance(weekdays, list):
            errors.append("$.schedule.weekdays must contain unique weekday codes")
            weekdays = []
        elif any(not isinstance(item, str) for item in weekdays):
            errors.append("$.schedule.weekdays must contain unique weekday codes")
            weekdays = []
        elif len(weekdays) != len(set(weekdays)) or not set(weekdays).issubset(
            WEEKDAYS
        ):
            errors.append("$.schedule.weekdays must contain unique weekday codes")
            weekdays = []
        local_time = schedule.get("local_time")
        day = schedule.get("day_of_month")
        minute = schedule.get("minute")
        if frequency == "hourly":
            if (
                weekdays
                or local_time is not None
                or day is not None
                or not _is_int(minute)
                or not 0 <= minute <= 59
            ):
                errors.append("hourly schedules use only interval and minute 0 to 59")
        elif frequency == "daily":
            if weekdays or not isinstance(local_time, str) or not TIME_RE.fullmatch(local_time) or day is not None or minute is not None:
                errors.append("daily schedules require local_time, null minute, and no weekdays/day")
        elif frequency == "weekly":
            if not weekdays or not isinstance(local_time, str) or not TIME_RE.fullmatch(local_time) or day is not None or minute is not None:
                errors.append("weekly schedules require weekdays, local_time, and null minute")
        elif frequency == "monthly":
            if weekdays or not isinstance(local_time, str) or not TIME_RE.fullmatch(local_time) or not _is_int(day) or not 1 <= day <= 28 or minute is not None:
                errors.append("monthly schedules require local_time, null minute, and day 1 to 28")
        timezone = schedule.get("timezone")
        if (
            not isinstance(timezone, str)
            or not 1 <= len(timezone) <= 100
            or TIMEZONE_RE.fullmatch(timezone) is None
        ):
            errors.append("$.schedule.timezone must be UTC or a real IANA timezone")
        else:
            try:
                ZoneInfo(timezone)
            except (ZoneInfoNotFoundError, ValueError):
                errors.append("$.schedule.timezone must be UTC or a real IANA timezone")
        quiet = schedule.get("quiet_hours")
        if quiet is not None:
            quiet_obj = _exact_object(
                quiet, {"start", "end"}, "$.schedule.quiet_hours", errors
            )
            if quiet_obj is not None:
                if any(
                    not isinstance(quiet_obj.get(key), str)
                    or TIME_RE.fullmatch(quiet_obj[key]) is None
                    for key in ("start", "end")
                ):
                    errors.append("$.schedule.quiet_hours must contain valid local times")
                else:
                    quiet_start = quiet_obj["start"]
                    quiet_end = quiet_obj["end"]
                    if quiet_start == quiet_end:
                        errors.append("$.schedule.quiet_hours start and end must differ")
                    elif frequency == "hourly":
                        errors.append("hourly schedules cannot safely enforce quiet_hours")
                    elif (
                        isinstance(local_time, str)
                        and TIME_RE.fullmatch(local_time)
                        and _inside_quiet_hours(local_time, quiet_start, quiet_end)
                    ):
                        errors.append("$.schedule.local_time falls inside quiet_hours")
        ends_at = schedule.get("ends_at")
        if ends_at is not None and not _timestamp_is_valid(ends_at):
            errors.append("$.schedule.ends_at must be null or an ISO-8601 timestamp")
        elif ends_at is not None and confirmed_time is not None:
            parsed_end = _parse_timestamp(ends_at)
            if parsed_end is not None and parsed_end <= confirmed_time:
                errors.append("$.schedule.ends_at must be after confirmation")
        maximum_runs = schedule.get("maximum_runs")
        if maximum_runs is not None and (
            not _is_int(maximum_runs) or not 1 <= maximum_runs <= 10000
        ):
            errors.append("$.schedule.maximum_runs must be null or 1 to 10000")

    notification = _exact_object(
        root.get("notification"),
        NOTIFICATION_KEYS,
        "$.notification",
        errors,
    )
    if notification is not None:
        events = notification.get("events")
        if not isinstance(events, list) or not events:
            errors.append("$.notification.events must contain unique supported values")
            events = []
        elif any(not isinstance(item, str) for item in events):
            errors.append("$.notification.events must contain unique supported values")
            events = []
        elif len(events) != len(set(events)) or not set(events).issubset(
            ALLOWED_EVENTS
        ):
            errors.append("$.notification.events must contain unique supported values")
            events = []
        price_improvement = notification.get("minimum_price_improvement")
        percent_improvement = notification.get("minimum_percent_improvement")
        for key, value, maximum in (
            ("minimum_price_improvement", price_improvement, None),
            ("minimum_percent_improvement", percent_improvement, 100),
        ):
            if value is not None and (
                not _is_number(value)
                or value <= 0
                or (maximum is not None and value > maximum)
                or (maximum is None and value > MAX_MONEY_VALUE)
            ):
                errors.append(f"$.notification.{key} has an invalid value")
        if (
            "price_threshold_crossed" in events
            and price_improvement is None
            and percent_improvement is None
        ):
            errors.append("price_threshold_crossed requires an amount or percentage")
        expiry_hours = notification.get("expiry_warning_hours")
        if expiry_hours is not None and (
            not _is_int(expiry_hours) or not 1 <= expiry_hours <= 720
        ):
            errors.append("$.notification.expiry_warning_hours must be null or 1 to 720")
        if "expiry_warning" in events and expiry_hours is None:
            errors.append("expiry_warning requires expiry_warning_hours")
        if notification.get("silent_when_unchanged") is not True:
            errors.append("$.notification.silent_when_unchanged must be true")
        if not isinstance(notification.get("include_digest"), bool):
            errors.append("$.notification.include_digest must be boolean")

    if confirmation is not None:
        try:
            expected_digest = approval_digest(root)
        except (TypeError, ValueError):
            errors.append("$.confirmation.approved_spec_digest cannot bind invalid values")
        else:
            if confirmation.get("approved_spec_digest") != expected_digest:
                errors.append(
                    "$.confirmation.approved_spec_digest does not match the scheduled settings"
                )

    return errors


def prepare_authorized_mutation_plan(payload: dict[str, Any]) -> dict[str, Any]:
    """Construct the host-neutral mutation plan authorized by a WatchSpec."""

    errors = validate_watch_spec(payload)
    if errors:
        raise ValueError("invalid WatchSpec: " + "; ".join(errors))
    binding = payload["task_binding"]
    host_payload = payload["host_payload"]
    return {
        "host_surface": host_payload["host_surface"],
        "task_action": binding["action"],
        "existing_task_id": binding["existing_task_id"],
        "task_title": host_payload["task_title"],
        "recurring_prompt": render_recurring_prompt(payload),
        "structured_schedule": json.loads(
            json.dumps(
                payload["schedule"],
                ensure_ascii=False,
                allow_nan=False,
            )
        ),
        "requested_lifecycle_actions": list(
            host_payload["requested_lifecycle_actions"]
        ),
    }


def validate_mutation_dispatch_plan(
    payload: dict[str, Any], actual_plan: Any
) -> list[str]:
    """Type- and byte-check the plan immediately before host translation."""

    errors = validate_watch_spec(payload)
    actual = _exact_object(
        actual_plan,
        {
            "host_surface",
            "task_action",
            "existing_task_id",
            "task_title",
            "recurring_prompt",
            "structured_schedule",
            "requested_lifecycle_actions",
        },
        "$dispatch_plan",
        errors,
    )
    if errors or actual is None:
        return errors

    expected = prepare_authorized_mutation_plan(payload)
    for key in (
        "host_surface",
        "task_action",
        "existing_task_id",
        "task_title",
        "requested_lifecycle_actions",
    ):
        if actual.get(key) != expected[key]:
            errors.append(f"$dispatch_plan.{key} differs from confirmed authority")
    actual_prompt = actual.get("recurring_prompt")
    if not isinstance(actual_prompt, str):
        errors.append("$dispatch_plan.recurring_prompt must be a string")
    else:
        try:
            actual_prompt_bytes = actual_prompt.encode("utf-8")
            expected_prompt_bytes = expected["recurring_prompt"].encode("utf-8")
        except UnicodeError:
            errors.append(
                "$dispatch_plan.recurring_prompt must be valid UTF-8 without lone surrogates"
            )
        else:
            if actual_prompt_bytes != expected_prompt_bytes:
                errors.append(
                    "$dispatch_plan.recurring_prompt bytes differ from the confirmed renderer output"
                )
    try:
        actual_schedule = _canonical_json_bytes(actual.get("structured_schedule"))
    except (TypeError, ValueError):
        errors.append("$dispatch_plan.structured_schedule is not canonical JSON")
    else:
        if actual_schedule != _canonical_json_bytes(expected["structured_schedule"]):
            errors.append(
                "$dispatch_plan.structured_schedule differs type-strictly from confirmed authority"
            )
    return errors


def validate_observed_lifecycle_target(
    payload: dict[str, Any], observation: Any
) -> list[str]:
    """Require a fresh host listing that matches the confirmed lifecycle target."""

    errors = validate_lifecycle_spec(payload)
    observed = _exact_object(
        observation,
        LIFECYCLE_OBSERVATION_KEYS,
        "$host_observation",
        errors,
    )
    if errors or observed is None:
        return errors

    if observed.get("source") != "host_task_listing":
        errors.append("$host_observation.source must equal host_task_listing")
    observed_at = _parse_timestamp(observed.get("observed_at"))
    if observed_at is None:
        errors.append("$host_observation.observed_at must be an ISO-8601 timestamp")
    else:
        confirmed_at = _parse_timestamp(payload["confirmation"]["confirmed_at"])
        if confirmed_at is not None and observed_at < confirmed_at:
            errors.append("$host_observation predates lifecycle confirmation")

    mutation = payload["mutation"]
    expected = {
        "host_surface": mutation["host_surface"],
        "existing_task_id": mutation["existing_task_id"],
        "task_title": mutation["task_title"],
        "observed_current_state": mutation["expected_current_state"],
    }
    for key, expected_value in expected.items():
        if observed.get(key) != expected_value:
            errors.append(f"$host_observation.{key} differs from confirmed precondition")
    return errors


def prepare_authorized_lifecycle_plan(
    payload: dict[str, Any], observation: dict[str, Any]
) -> dict[str, Any]:
    """Construct a lifecycle plan only after a matching fresh host listing."""

    errors = validate_observed_lifecycle_target(payload, observation)
    if errors:
        raise ValueError("invalid lifecycle observation: " + "; ".join(errors))
    mutation = payload["mutation"]
    return {
        "observation_source": observation["source"],
        "observed_at": observation["observed_at"],
        "host_surface": observation["host_surface"],
        "existing_task_id": observation["existing_task_id"],
        "task_title": observation["task_title"],
        "action": mutation["action"],
        "observed_current_state": observation["observed_current_state"],
        "expected_final_state": mutation["expected_final_state"],
    }


def validate_lifecycle_dispatch_plan(
    payload: dict[str, Any], observation: Any, actual_plan: Any
) -> list[str]:
    """Check a freshly observed lifecycle plan against confirmed authority."""

    errors = validate_observed_lifecycle_target(payload, observation)
    actual = _exact_object(
        actual_plan,
        {
            "observation_source",
            "observed_at",
            "host_surface",
            "existing_task_id",
            "task_title",
            "action",
            "observed_current_state",
            "expected_final_state",
        },
        "$dispatch_plan",
        errors,
    )
    if errors or actual is None:
        return errors
    expected = prepare_authorized_lifecycle_plan(payload, observation)
    for key, expected_value in expected.items():
        if actual.get(key) != expected_value:
            errors.append(f"$dispatch_plan.{key} differs from confirmed authority")
    return errors


def validate_lifecycle_receipt(
    payload: dict[str, Any], observation: Any, receipt: Any
) -> list[str]:
    """Require a successful receipt for the same observed lifecycle target."""

    errors = validate_observed_lifecycle_target(payload, observation)
    normalized = _exact_object(
        receipt,
        LIFECYCLE_RECEIPT_KEYS,
        "$lifecycle_receipt",
        errors,
    )
    if errors or normalized is None:
        return errors

    if normalized.get("source") != "host_lifecycle_receipt":
        errors.append(
            "$lifecycle_receipt.source must equal host_lifecycle_receipt"
        )
    if normalized.get("status") != "succeeded":
        errors.append("$lifecycle_receipt.status must equal succeeded")
    received_at = _parse_timestamp(normalized.get("received_at"))
    if received_at is None:
        errors.append("$lifecycle_receipt.received_at must be an ISO-8601 timestamp")
    else:
        observed_at = _parse_timestamp(observation["observed_at"])
        if observed_at is not None and received_at < observed_at:
            errors.append("$lifecycle_receipt predates the host observation")

    mutation = payload["mutation"]
    for field, expected_value in (
        ("host_surface", mutation["host_surface"]),
        ("task_id", mutation["existing_task_id"]),
        ("task_title", mutation["task_title"]),
        ("action", mutation["action"]),
        ("final_state", mutation["expected_final_state"]),
    ):
        if normalized.get(field) != expected_value:
            errors.append(
                f"$lifecycle_receipt.{field} differs from confirmed authority"
            )
    return errors


def validate_compound_update_receipt(
    payload: dict[str, Any], receipt: Any
) -> list[str]:
    """Gate a confirmed pause/resume follow-up on the exact update receipt."""

    errors = validate_watch_spec(payload)
    normalized = _exact_object(
        receipt,
        COMPOUND_UPDATE_RECEIPT_KEYS,
        "$update_receipt",
        errors,
    )
    if errors or normalized is None:
        return errors

    binding = payload["task_binding"]
    host_payload = payload["host_payload"]
    if binding["action"] != "update" or not host_payload[
        "requested_lifecycle_actions"
    ]:
        errors.append("compound lifecycle receipt requires a confirmed update follow-up")
    if normalized.get("source") != "host_update_receipt":
        errors.append("$update_receipt.source must equal host_update_receipt")
    if normalized.get("status") != "succeeded":
        errors.append("$update_receipt.status must equal succeeded")
    received_at = _parse_timestamp(normalized.get("received_at"))
    if received_at is None:
        errors.append("$update_receipt.received_at must be an ISO-8601 timestamp")
    else:
        confirmed_at = _parse_timestamp(payload["confirmation"]["confirmed_at"])
        if confirmed_at is not None and received_at < confirmed_at:
            errors.append("$update_receipt predates WatchSpec confirmation")
    for field, expected_value in (
        ("host_surface", host_payload["host_surface"]),
        ("task_id", binding["existing_task_id"]),
        ("task_title", host_payload["task_title"]),
    ):
        if normalized.get(field) != expected_value:
            errors.append(f"$update_receipt.{field} differs from confirmed authority")
    try:
        actual_schedule = _canonical_json_bytes(normalized.get("structured_schedule"))
    except (TypeError, ValueError):
        errors.append("$update_receipt.structured_schedule is not canonical JSON")
    else:
        if actual_schedule != _canonical_json_bytes(payload["schedule"]):
            errors.append(
                "$update_receipt.structured_schedule differs type-strictly from confirmed authority"
            )
    return errors


def validate_compound_lifecycle_receipt(
    payload: dict[str, Any], update_receipt: Any, lifecycle_receipt: Any
) -> list[str]:
    """Require the exact bound follow-up receipt after a valid update receipt."""

    errors = validate_compound_update_receipt(payload, update_receipt)
    normalized = _exact_object(
        lifecycle_receipt,
        LIFECYCLE_RECEIPT_KEYS,
        "$compound_lifecycle_receipt",
        errors,
    )
    if errors or normalized is None:
        return errors

    host_payload = payload["host_payload"]
    binding = payload["task_binding"]
    action = host_payload["requested_lifecycle_actions"][0]
    expected_final_state = {"pause": "paused", "resume": "active"}[action]
    if normalized.get("source") != "host_lifecycle_receipt":
        errors.append(
            "$compound_lifecycle_receipt.source must equal host_lifecycle_receipt"
        )
    if normalized.get("status") != "succeeded":
        errors.append("$compound_lifecycle_receipt.status must equal succeeded")
    received_at = _parse_timestamp(normalized.get("received_at"))
    update_received_at = _parse_timestamp(update_receipt.get("received_at"))
    if received_at is None:
        errors.append(
            "$compound_lifecycle_receipt.received_at must be an ISO-8601 timestamp"
        )
    elif update_received_at is not None and received_at < update_received_at:
        errors.append("$compound_lifecycle_receipt predates the update receipt")
    for field, expected_value in (
        ("host_surface", host_payload["host_surface"]),
        ("task_id", binding["existing_task_id"]),
        ("task_title", host_payload["task_title"]),
        ("action", action),
        ("final_state", expected_final_state),
    ):
        if normalized.get(field) != expected_value:
            errors.append(
                f"$compound_lifecycle_receipt.{field} differs from confirmed authority"
            )
    return errors


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    lifecycle_mode = bool(arguments and arguments[0] == "--lifecycle")
    if lifecycle_mode:
        arguments.pop(0)
    if len(arguments) != 1:
        print(
            "Usage: validate_watch_spec.py [--lifecycle] AUTHORITY_SPEC.json",
            file=sys.stderr,
        )
        return 2
    path = Path(arguments[0])
    try:
        payload = json.loads(
            path.read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite number {value} is not valid JSON")
            ),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Unable to read valid JSON: {exc}", file=sys.stderr)
        return 2
    errors = (
        validate_lifecycle_spec(payload)
        if lifecycle_mode
        else validate_watch_spec(payload)
    )
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print("LifecycleSpec is valid" if lifecycle_mode else "WatchSpec is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
