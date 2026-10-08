#!/usr/bin/env python3
"""Build a portable recurring-search instruction from a Career Passport."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from contracts import load_json, validate_career_passport


def build_schedule_prompt(passport: dict[str, Any]) -> str:
    errors = validate_career_passport(passport)
    if errors:
        raise ValueError("Invalid Career Passport: " + "; ".join(errors))
    automation = passport.get("automation")
    if not isinstance(automation, dict) or not automation.get("enabled"):
        raise ValueError("Career Passport has no enabled automation configuration")
    preferences = passport["preferences"]
    cadence = automation["cadence"]
    local_time = automation["local_time"]
    timezone = automation["timezone"]
    timing = f"{cadence} at {local_time} ({timezone})"
    pack_mode = automation["application_pack_mode"]
    pack_instruction = (
        "For verified Apply roles, create paired Word CV and cover-letter packs only after all document QA passes."
        if pack_mode == "apply_roles"
        else "Do not create application packs automatically; wait for my request."
    )
    locations = ", ".join(str(value) for value in preferences.get("locations", [])) or "the Passport geography"
    directions = ", ".join(str(value) for value in preferences.get("target_directions", [])) or "the Passport target directions"
    profile = passport.get("profile", {})
    profile_snapshot = {
        "headline": profile.get("headline"),
        "location": profile.get("location"),
        "work_rights": profile.get("work_rights"),
    }
    preference_snapshot = {
        "target_directions": preferences.get("target_directions", []),
        "locations": preferences.get("locations", []),
        "remote_preference": preferences.get("remote_preference"),
        "salary_minimum": preferences.get("salary_minimum"),
        "currency": preferences.get("currency"),
        "employment_types": preferences.get("employment_types", []),
        "excluded_employers": preferences.get("excluded_employers", []),
        "excluded_role_patterns": preferences.get("excluded_role_patterns", []),
    }
    evidence_snapshot = [
        {
            "evidence_id": item.get("evidence_id"),
            "safe_wording": item.get("safe_wording"),
            "restrictions": item.get("restrictions", []),
        }
        for item in passport.get("evidence", [])
        if isinstance(item, dict)
    ]
    history_snapshot = [
        {
            "company": item.get("company"),
            "title": item.get("title"),
            "exact_posting_url": item.get("exact_posting_url"),
            "content_fingerprint": item.get("content_fingerprint"),
            "recommendation": item.get("recommendation"),
            "last_application_stage": item.get("last_application_stage"),
        }
        for item in passport.get("role_history", [])
        if isinstance(item, dict)
    ]
    snapshot = json.dumps(
        {
            "passport_updated_at": passport.get("updated_at"),
            "profile": profile_snapshot,
            "preferences": preference_snapshot,
            "evidence": evidence_snapshot,
            "role_history": history_snapshot,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    continuity_mode = automation.get("continuity_mode", "snapshot_only")
    if continuity_mode == "task_context":
        continuity_instruction = (
            "Continuity mode: current-task context. Create this schedule from the existing Career Centre task and return each run "
            "to that task. Use the task's existing conversation context, uploaded files, installed Career Centre plugin and latest "
            "Career Passport available there. Reconcile role fingerprints and application history before browsing. State which "
            "continuity inputs were available; never claim cross-account or unrelated-task memory. "
        )
    elif continuity_mode == "verified_persistent":
        continuity_instruction = (
            "Continuity mode: verified-persistent. Before browsing, load the latest valid Career Passport from the configured "
            "persistent source and confirm its updated_at value. Reconcile its role fingerprints and application history, then save "
            "the validated updated Passport where the next run will receive it. If either load or save is unavailable, return BLOCKED "
            "with one recovery action; never reset to the embedded snapshot or claim continuity. "
        )
    else:
        continuity_instruction = (
            "Continuity mode: snapshot-only. Begin every result with: ‘Continuity: snapshot-backed alert. I used the Career Passport "
            "captured when this schedule was created plus this run's results. The host did not supply an updated Passport from earlier "
            "scheduled runs, so a role may repeat in a later alert.’ Suppress duplicates against the embedded role_history and within "
            "this run. Use employer posting identity/external job ID first, then canonical employer plus normalised title and material "
            "description similarity; do not use mutable remote/location wording as the primary key. Prefer roles explicitly posted or "
            "updated within the latest scheduled interval. Do not print a run number, claim "
            "cross-run deduplication, say the Passport was updated, or call a role new since the prior run. "
        )
    return (
        f"Run {timing}. Invoke Career Centre explicitly. Use this embedded evidence-safe Career Passport snapshot as the candidate and history source: {snapshot}. "
        f"{continuity_instruction}"
        f"Search for {directions} in {locations}. Reconcile role fingerprints and application history before browsing. "
        f"Return at most {automation['max_displayed_roles']} verified roles; every displayed role needs an exact open posting URL, "
        "salary band and basis, employment type, Apply/Maybe/Skip decision, main match and main risk. "
        "Use no more than four focused queries and inspect no more than twelve plausible postings per run; stop early rather than add filler. "
        f"{pack_instruction} Never auto-submit or send an application. If the embedded snapshot or exact-link verification is unavailable, "
        "return BLOCKED with one recovery action instead of guessing."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("passport", type=Path)
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()
    passport = load_json(args.passport.resolve())
    try:
        prompt = build_schedule_prompt(passport)
    except ValueError as exc:
        print(json.dumps({"passed": False, "errors": [str(exc)]}, indent=2))
        return 1
    if args.format == "json":
        print(json.dumps({"passed": True, "prompt": prompt}, indent=2))
    else:
        print(prompt)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
