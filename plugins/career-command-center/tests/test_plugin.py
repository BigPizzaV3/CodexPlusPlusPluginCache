#!/usr/bin/env python3
"""Integration tests for the plugin workspace and automation scripts."""

from __future__ import annotations

import json
import os
import platform
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = PLUGIN_ROOT / "scripts"


def run(*args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(arg) for arg in args],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def run_unchecked(*args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(arg) for arg in args],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="career-command-center-plugin-") as temporary:
        workspace = Path(temporary) / "Workspace"
        run("python3", SCRIPTS / "bootstrap_workspace.py", workspace)

        assert (workspace / "Evidence_Bank/CV_GENERATION_STANDARD.md").exists()
        assert (workspace / "Evidence_Bank/PERSONALIZED_QUESTION_STANDARD.md").exists()
        assert (workspace / "Evidence_Bank/personalized_questions.json").exists()
        assert (workspace / "Evidence_Bank/Verified_Evidence_Ledger.md").exists()
        assert (workspace / "State/cv_command_center_state.json").exists()
        fresh_state = json.loads((workspace / "State/cv_command_center_state.json").read_text(encoding="utf-8"))
        assert fresh_state["version"] == 3
        fresh_questions = json.loads(
            (workspace / "Evidence_Bank/personalized_questions.json").read_text(encoding="utf-8")
        )
        assert fresh_questions["audit_status"] == "not_started"

        config = {
            "version": 1,
            "onboarding_completed": True,
            "workspace_path": str(workspace),
            "profile": {"fullName": "Test Candidate"},
            "search": {
                "countries": ["Netherlands"],
                "opportunityTypes": ["Job", "PhD"],
                "roleFamilies": ["R&D and product engineering"],
            },
            "cv": {"selectedMasterPaths": []},
            "automation": {
                "enabled": True,
                "frequency": "daily",
                "weekdaysOnly": True,
                "hour": 7,
                "minute": 30,
                "minimumNewLeads": 6,
                "searchDepthMinutes": 240,
                "automationID": "career-command-center-daily",
                "needsCodexSync": True,
                "lastSyncedAt": "",
            },
        }
        write_json(workspace / "Config/command_center_config.json", config)

        master_path = workspace / "Applications/Test_Master_CV.docx"
        master_path.write_bytes(b"test master")
        evidence_path = workspace / "Evidence_Bank/approved_evidence.json"
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
        evidence["evidence_blocks"] = [{"id": "TEST-001", "claim": "Verified test evidence"}]
        evidence["approved_master_cvs"] = {"test_family": str(master_path)}
        write_json(evidence_path, evidence)

        doctor = json.loads(run("python3", SCRIPTS / "doctor.py", workspace, "--strict").stdout)
        assert doctor["ready_for_automation"]
        assert doctor["approved_masters"] == 1

        lead = {
            "id": "example__role",
            "source_job_id": "official:123",
            "title": "R&D Engineer",
            "organization": "Example",
            "job_url": "https://example.com/jobs/123?tracking=abc",
            "status": "to_apply",
            "rationale": "Python test automation supports the role's validation workflow.",
            "concerns": "No direct ISO 13485 ownership is demonstrated; Upload a transcript and degree certificate through the portal.",
        }
        lead_path = Path(temporary) / "lead.json"
        write_json(lead_path, lead)
        first = json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)
        assert first["result"] == "added"

        duplicate = dict(lead)
        duplicate["id"] = "aggregator__duplicate"
        duplicate["job_url"] = "https://example.com/jobs/123?utm_source=board"
        write_json(lead_path, duplicate)
        second = json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)
        assert second["result"] == "updated"

        state_path = workspace / "State/cv_command_center_state.json"
        state = json.loads(state_path.read_text(encoding="utf-8"))
        assert len(state["leads"]) == 1
        assessment = state["leads"][0]
        assert assessment["assessment_schema_version"] == 2
        assert any("ISO 13485" in item for item in assessment["fit_gaps"])
        assert any("transcript" in item.lower() for item in assessment["application_requirements"])
        assert not any("transcript" in item.lower() for item in assessment["fit_gaps"])
        state["leads"][0]["status"] = "archived"
        write_json(state_path, state)
        third = json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)
        assert third["result"] == "skipped" and third["reason"] == "archived"

        state["leads"] = []
        deleted = dict(lead)
        deleted["status"] = "deleted"
        state["deleted_leads"] = [deleted]
        write_json(state_path, state)
        deleted_result = json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)
        assert deleted_result["result"] == "skipped" and deleted_result["reason"] == "recently_deleted"

        state["deleted_leads"] = []
        state["lead_tombstones"] = [
            {
                "id": lead["id"],
                "source_job_id": lead["source_job_id"],
                "job_url": lead["job_url"],
                "apply_url": "",
                "title": lead["title"],
                "organization": lead["organization"],
                "deleted_at": "2026-01-01T00:00:00Z",
            }
        ]
        write_json(state_path, state)
        tombstone_result = json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)
        assert tombstone_result["result"] == "skipped" and tombstone_result["reason"] == "tombstoned"

        state["lead_tombstones"] = []
        applied = dict(lead)
        applied["status"] = "applied"
        state["leads"] = [applied]
        write_json(state_path, state)
        applied_result = json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)
        assert applied_result["result"] == "skipped" and applied_result["reason"] == "applied"

        state["leads"] = []
        first_personio = {
            "id": "personio-role-one",
            "source_job_id": "personio:one",
            "title": "Systems Engineer",
            "organization": "Example Engineering",
            "location": "Utrecht, Netherlands",
            "job_url": "https://example.jobs.personio.com/",
            "apply_url": "https://example.jobs.personio.com/",
            "status": "to_apply",
        }
        second_personio = dict(first_personio)
        second_personio.update(
            {
                "id": "personio-role-two",
                "source_job_id": "personio:two",
                "title": "C++ Software Developer",
            }
        )
        write_json(state_path, state)
        write_json(lead_path, first_personio)
        assert json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)["result"] == "added"
        write_json(lead_path, second_personio)
        assert json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "upsert", "--lead-file", lead_path).stdout)["result"] == "added"

        state = json.loads(state_path.read_text(encoding="utf-8"))
        canonical = {
            "id": "research-role-canonical",
            "source_job_id": "board:123",
            "title": "Research Engineer",
            "organization": "Example Research Institute",
            "location": "Rotterdam, Netherlands",
            "job_url": "https://research.example/jobs/research-engineer",
            "status": "applied",
        }
        legacy_duplicate = {
            "id": "research-role-package",
            "duplicate_of": "research-role-canonical",
            "title": "Research role package record",
            "organization": "Example Research Institute",
            "location": "Rotterdam, Netherlands",
            "job_url": "https://research.example/jobs/research-engineer?utm_source=test",
            "status": "archived",
            "notes_path": "/tmp/legacy-notes.md",
        }
        state["leads"].extend([canonical, legacy_duplicate])
        write_json(state_path, state)
        consolidation = json.loads(
            run(
                "python3",
                SCRIPTS / "state_cli.py",
                "--workspace",
                workspace,
                "consolidate",
                "--keep-id",
                "research-role-canonical",
                "--remove-id",
                "research-role-package",
            ).stdout
        )
        assert consolidation["result"] == "consolidated"
        state = json.loads(state_path.read_text(encoding="utf-8"))
        merged = next(item for item in state["leads"] if item["id"] == "research-role-canonical")
        assert "research-role-package" in merged["merged_legacy_ids"]
        assert merged["notes_path"] == "/tmp/legacy-notes.md"
        assert len(state["leads"]) == 3

        validation = json.loads(run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "validate").stdout)
        assert validation["valid"]

        spec = json.loads(run("python3", SCRIPTS / "render_automation_spec.py", workspace).stdout)
        assert spec["automation_id"] == "career-command-center-daily"
        assert "BYDAY=MO,TU,WE,TH,FR" in spec["rrule"]
        assert "at least 6 new" in spec["prompt"]
        assert "240 minutes" in spec["prompt"]
        assert "{{" not in spec["prompt"]

        config = json.loads((workspace / "Config/command_center_config.json").read_text(encoding="utf-8"))
        config["automation"].update({"frequency": "weekly", "weeklyDay": "Thursday", "enabled": True})
        write_json(workspace / "Config/command_center_config.json", config)
        weekly_spec = json.loads(run("python3", SCRIPTS / "render_automation_spec.py", workspace).stdout)
        assert weekly_spec["name"] == "Career Command Center Weekly Search"
        assert "BYDAY=TH" in weekly_spec["rrule"]

        config["automation"].update({"frequency": "manual", "enabled": False})
        write_json(workspace / "Config/command_center_config.json", config)
        manual_spec = json.loads(run("python3", SCRIPTS / "render_automation_spec.py", workspace).stdout)
        assert manual_spec["name"] == "Career Command Center Manual Search"
        assert manual_spec["status"] == "PAUSED"

        run("python3", SCRIPTS / "mark_automation_synced.py", workspace, "--automation-id", "career-command-center-daily")
        synced = json.loads((workspace / "Config/command_center_config.json").read_text(encoding="utf-8"))
        assert synced["automation"]["needsCodexSync"] is False
        assert synced["automation"]["lastSyncedAt"]

        status_payload = Path(temporary) / "run.json"
        write_json(status_payload, {"leads_added": 6, "packages_created": 2})
        run("python3", SCRIPTS / "state_cli.py", "--workspace", workspace, "record-run", "--run-file", status_payload)
        status = json.loads((workspace / "Automation/automation_status.json").read_text(encoding="utf-8"))
        assert status["leads_added"] == 6 and status["last_run_at"]

        question_input = Path(temporary) / "questions.json"
        project_fixture = workspace / "Projects/Test Project"
        project_fixture.mkdir(parents=True, exist_ok=True)
        (project_fixture / "report.pdf").write_bytes(b"test report fixture")
        (project_fixture / "presentation.pdf").write_bytes(b"test presentation fixture")
        write_json(
            question_input,
            {
                "generation_id": "test-audit-1",
                "questions": [
                    {
                        "id": "project-impact-baseline",
                        "priority": "critical",
                        "category": "metric",
                        "question": "The project report gives a 40% time reduction. Was that measured, estimated, or proposed as a target?",
                        "why_it_matters": "The answer determines whether the figure is a result, estimate, or design target.",
                        "source_refs": [
                            {
                                "path": "Projects/Test Project/report.pdf",
                                "label": "Test Project Report",
                                "locator": "Discussion, page 12",
                                "context": "The percentage appears without a baseline measurement or validation method.",
                            }
                        ],
                        "related_evidence_ids": [],
                    },
                    {
                        "id": "project-team-ownership",
                        "priority": "high",
                        "category": "ownership",
                        "question": "Which modelling, implementation, and testing tasks in the team project did you personally complete?",
                        "why_it_matters": "Individual ownership must be separated before project bullets can be approved.",
                        "source_refs": [
                            {
                                "path": "Projects/Test Project/presentation.pdf",
                                "label": "Test Project Presentation",
                                "locator": "Methods, slides 5-9",
                                "context": "The slides describe team outputs without assigning implementation tasks.",
                            }
                        ],
                        "related_evidence_ids": [],
                    },
                ],
            },
        )
        generated = json.loads(
            run(
                "python3",
                SCRIPTS / "question_cli.py",
                "--workspace",
                workspace,
                "generate",
                "--input",
                question_input,
            ).stdout
        )
        assert generated["needs_user_answer"] == 2
        assert generated["audit_status"] == "current"
        blocked_doctor = run_unchecked("python3", SCRIPTS / "doctor.py", workspace, "--strict")
        assert blocked_doctor.returncode == 1
        blocked_diagnostic = json.loads(blocked_doctor.stdout)
        assert blocked_diagnostic["question_counts"]["open"] == 2
        assert blocked_diagnostic["ready_for_automation"] is False

        responded = json.loads(
            run(
                "python3",
                SCRIPTS / "question_cli.py",
                "--workspace",
                workspace,
                "respond",
                "--id",
                "project-impact-baseline",
                "--status",
                "answered",
                "--answer",
                "It was an estimate based on the documented workflow steps, not a measured result.",
            ).stdout
        )
        assert responded["awaiting_codex_review"] == 1

        write_json(
            question_input,
            {
                "generation_id": "test-audit-2",
                "questions": [
                    {
                        "id": "project-impact-baseline",
                        "priority": "critical",
                        "category": "metric",
                        "question": "The project report gives a 40% time reduction. Was that measured, estimated, or proposed as a target?",
                        "why_it_matters": "The answer determines whether the figure is a result, estimate, or design target.",
                        "source_refs": [
                            {
                                "path": "Projects/Test Project/report.pdf",
                                "label": "Test Project Report",
                                "locator": "Discussion, page 12",
                                "context": "The percentage appears without a baseline measurement or validation method.",
                            }
                        ],
                        "related_evidence_ids": [],
                    },
                    {
                        "id": "project-final-decision",
                        "priority": "high",
                        "category": "outcome",
                        "question": "Which design did the final comparison support, and what result drove that decision?",
                        "why_it_matters": "The decision would turn a process description into defensible engineering evidence.",
                        "source_refs": [
                            {
                                "path": "Projects/Test Project/report.pdf",
                                "label": "Test Project Report",
                                "locator": "Results, pages 8-11",
                                "context": "Several designs are compared without a clear final recommendation.",
                            }
                        ],
                        "related_evidence_ids": [],
                    },
                ],
            },
        )
        regenerated = json.loads(
            run(
                "python3",
                SCRIPTS / "question_cli.py",
                "--workspace",
                workspace,
                "generate",
                "--input",
                question_input,
            ).stdout
        )
        assert regenerated["needs_user_answer"] == 1
        assert regenerated["awaiting_codex_review"] == 1
        assert regenerated["status_counts"]["superseded"] == 1

        review_input = Path(temporary) / "question-reviews.json"
        write_json(
            review_input,
            {
                "reviews": [
                    {
                        "id": "project-impact-baseline",
                        "status": "resolved",
                        "review_note": "Recorded as a labelled estimate rather than a measured result.",
                        "related_evidence_ids": ["TEST-ESTIMATE-001"],
                    }
                ]
            },
        )
        reviewed = json.loads(
            run(
                "python3",
                SCRIPTS / "question_cli.py",
                "--workspace",
                workspace,
                "review",
                "--input",
                review_input,
            ).stdout
        )
        assert reviewed["awaiting_codex_review"] == 0
        run(
            "python3",
            SCRIPTS / "question_cli.py",
            "--workspace",
            workspace,
            "respond",
            "--id",
            "project-final-decision",
            "--status",
            "not_applicable",
        )
        question_validation = json.loads(
            run("python3", SCRIPTS / "question_cli.py", "--workspace", workspace, "validate").stdout
        )
        assert question_validation["valid"]
        final_question_bank = json.loads(
            (workspace / "Evidence_Bank/personalized_questions.json").read_text(encoding="utf-8")
        )
        statuses_by_id = {item["id"]: item["status"] for item in final_question_bank["questions"]}
        assert statuses_by_id["project-impact-baseline"] == "resolved"
        assert statuses_by_id["project-team-ownership"] == "superseded"
        assert statuses_by_id["project-final-decision"] == "not_applicable"
        final_doctor = json.loads(run("python3", SCRIPTS / "doctor.py", workspace, "--strict").stdout)
        assert final_doctor["ready_for_automation"] is True

        future_timestamp = (project_fixture / "report.pdf").stat().st_mtime + 60
        os.utime(project_fixture / "report.pdf", (future_timestamp, future_timestamp))
        stale_doctor = run_unchecked("python3", SCRIPTS / "doctor.py", workspace, "--strict")
        assert stale_doctor.returncode == 1
        stale_diagnostic = json.loads(stale_doctor.stdout)
        assert any("changed source files" in item for item in stale_diagnostic["warnings"])

        write_json(
            question_input,
            {
                "questions": [
                    {
                        "id": "generic-project-question",
                        "priority": "medium",
                        "category": "other",
                        "question": "Tell me more about your project and what you learned?",
                        "why_it_matters": "The answer might add more detail to a future application.",
                        "source_refs": [
                            {
                                "path": "Projects/Test Project/report.pdf",
                                "label": "Test Project Report",
                                "locator": "Entire report",
                                "context": "The report contains several sections about the project work.",
                            }
                        ],
                        "related_evidence_ids": [],
                    }
                ]
            },
        )
        rejected_generic = run_unchecked(
            "python3",
            SCRIPTS / "question_cli.py",
            "--workspace",
            workspace,
            "generate",
            "--input",
            question_input,
        )
        assert rejected_generic.returncode != 0
        assert "generic" in rejected_generic.stderr.lower()

        if platform.system() == "Darwin" and platform.machine().lower() in {"arm64", "aarch64"}:
            fake_plugin = Path(temporary) / "PermissionRepairPlugin"
            fake_scripts = fake_plugin / "scripts"
            fake_scripts.mkdir(parents=True)
            shutil.copy2(SCRIPTS / "install_app.py", fake_scripts / "install_app.py")
            shutil.copy2(SCRIPTS / "build_app.sh", fake_scripts / "build_app.sh")

            source_app = PLUGIN_ROOT / "assets/macos-app/prebuilt/Career Command Center.app"
            fake_app = fake_plugin / "assets/macos-app/prebuilt/Career Command Center.app"
            shutil.copytree(source_app, fake_app, symlinks=True)
            fake_executable = fake_app / "Contents/MacOS/CareerCommandCenter"
            fake_executable.chmod(
                fake_executable.stat().st_mode
                & ~(stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            )
            assert not os.access(fake_executable, os.X_OK)

            destination = Path(temporary) / "Applications/Career Command Center.app"
            install_result = json.loads(
                run(
                    "python3",
                    fake_scripts / "install_app.py",
                    "--destination",
                    destination,
                    "--no-launch",
                ).stdout
            )
            installed_executable = destination / "Contents/MacOS/CareerCommandCenter"
            assert install_result["executable_permission_repaired"] is True
            assert os.access(installed_executable, os.X_OK)
            run("/usr/bin/codesign", "--verify", "--deep", "--strict", destination)

    print("Plugin integration tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
