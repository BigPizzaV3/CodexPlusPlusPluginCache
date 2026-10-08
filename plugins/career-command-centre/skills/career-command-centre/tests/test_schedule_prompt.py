from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPT_ROOT))
sys.path.insert(0, str(FIXTURE_ROOT))

from build_schedule_prompt import build_schedule_prompt  # noqa: E402
from factory import career_passport, load_persona  # noqa: E402


def automated_passport(persona_name: str, *, timezone: str, pack_mode: str = "on_request") -> dict:
    persona = load_persona(persona_name)
    data = {
        "schema_version": "4.0",
        "profile": copy.deepcopy(persona["profile"]),
        "preferences": copy.deepcopy(persona["preferences"]),
        "evidence": copy.deepcopy(persona["evidence"]),
        "role_history": [],
        "application_events": [],
        "corrections": [],
        "feedback": [],
        "automation": {
            "enabled": True,
            "cadence": "weekdays",
            "local_time": "07:30",
            "timezone": timezone,
            "max_displayed_roles": 5,
            "application_pack_mode": pack_mode,
            "destination": "scheduled_result_task",
            "continuity_mode": "snapshot_only",
        },
        "updated_at": "2026-07-14T09:30:00+08:00",
    }
    return data


class SchedulePromptTests(unittest.TestCase):
    def test_global_schedule_uses_passport_market_and_fail_closed_contract(self) -> None:
        data = automated_passport("midcareer_operations", timezone="America/Toronto")
        prompt = build_schedule_prompt(data)
        self.assertIn("weekdays at 07:30 (America/Toronto)", prompt)
        self.assertIn("Toronto, Remote Canada", prompt)
        self.assertIn("at most 5 verified roles", prompt)
        self.assertIn("Do not create application packs automatically", prompt)
        self.assertIn("return BLOCKED", prompt)
        self.assertIn("Continuity mode: snapshot-only", prompt)
        self.assertIn("role may repeat in a later alert", prompt)
        self.assertIn('"work_rights":"Canadian citizen"', prompt)
        self.assertIn('"evidence_id":"EV-P02-001"', prompt)
        self.assertNotIn("in this continuing task", prompt)
        self.assertNotIn("Australia", prompt)

    def test_automatic_pack_mode_still_requires_qa_and_manual_submission(self) -> None:
        data = automated_passport("earlycareer_marketing", timezone="Europe/London", pack_mode="apply_roles")
        prompt = build_schedule_prompt(data)
        self.assertIn("paired Word CV and cover-letter packs only after all document QA passes", prompt)
        self.assertIn("Never auto-submit", prompt)

    def test_current_task_schedule_uses_existing_context_and_explicit_plugin(self) -> None:
        data = automated_passport("midcareer_operations", timezone="America/Toronto")
        data["automation"]["destination"] = "continuing_task"
        data["automation"]["continuity_mode"] = "task_context"
        prompt = build_schedule_prompt(data)
        self.assertIn("Invoke Career Centre explicitly", prompt)
        self.assertIn("Continuity mode: current-task context", prompt)
        self.assertIn("existing conversation context", prompt)
        self.assertIn("return each run to that task", prompt)
        self.assertIn("never claim cross-account", prompt)

    def test_snapshot_schedule_embeds_existing_role_history_without_claiming_cross_run_memory(self) -> None:
        data = automated_passport("midcareer_operations", timezone="America/Toronto")
        data["role_history"] = [
            {
                "role_id": "ROLE-PAST-001",
                "company": "MapleGrid",
                "title": "Customer Operations Manager",
                "exact_posting_url": "https://jobs.example.org/maplegrid/customer-operations-001",
                "content_fingerprint": "sha256:maplegrid-001",
                "first_seen_at": "2026-07-13T09:00:00-04:00",
                "last_seen_at": "2026-07-14T09:00:00-04:00",
                "recommendation": "apply",
                "last_application_stage": "applied",
            }
        ]
        prompt = build_schedule_prompt(data)
        self.assertIn("sha256:maplegrid-001", prompt)
        self.assertIn("https://jobs.example.org/maplegrid/customer-operations-001", prompt)
        self.assertIn("Do not print a run number", prompt)
        self.assertIn("claim cross-run deduplication", prompt)
        self.assertIn("do not use mutable remote/location wording as the primary key", prompt)

    def test_verified_persistent_mode_fails_closed_when_state_cannot_be_loaded_or_saved(self) -> None:
        data = automated_passport("senior_transformation", timezone="Australia/Melbourne")
        data["automation"]["continuity_mode"] = "verified_persistent"
        prompt = build_schedule_prompt(data)
        self.assertIn("Continuity mode: verified-persistent", prompt)
        self.assertIn("load the latest valid Career Passport", prompt)
        self.assertIn("either load or save is unavailable, return BLOCKED", prompt)

    def test_schedule_prompt_rejects_missing_or_disabled_configuration(self) -> None:
        with self.assertRaisesRegex(ValueError, "no enabled automation"):
            build_schedule_prompt(career_passport())
        data = automated_passport("senior_transformation", timezone="Australia/Melbourne")
        data["automation"]["enabled"] = False
        with self.assertRaisesRegex(ValueError, "no enabled automation"):
            build_schedule_prompt(data)


if __name__ == "__main__":
    unittest.main()
