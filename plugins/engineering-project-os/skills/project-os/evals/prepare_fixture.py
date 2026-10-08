#!/usr/bin/env python3
"""Prepare a synthetic reviewer repository in a new, explicitly selected directory."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import subprocess
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import project_os  # noqa: E402


CASES = json.loads((Path(__file__).parent / "submission.json").read_text(encoding="utf-8"))["cases"]
CONTINUITY_CASES = json.loads((Path(__file__).parent / "continuity.json").read_text(encoding="utf-8"))["cases"]
ALL_CASES = CASES + CONTINUITY_CASES


def reusable_entry(identifier: str, applies_to: list[str], mechanism: str) -> dict[str, object]:
    entry: dict[str, object] = {
        "id": identifier,
        "title": f"Synthetic lesson {identifier}",
        "status": "active",
        "applies_to": applies_to,
        "trigger": "A synthetic verification reproduces the failure.",
        "mechanism": mechanism,
        "prevention": "Check the initiating owner before applying a late result.",
        "verification": ["Delay the result, change the owner and confirm the update is rejected."],
        "boundaries": ["Applies only when asynchronous ownership can change."],
        "source": {"kind": "user-reviewed", "created_with": project_os.VERSION},
    }
    entry["source"]["content_hash"] = project_os.entry_content_hash(entry)
    return entry


def reusable_registry(entries: list[dict[str, object]]) -> str:
    return json.dumps({"schema_version": 1, "entries": entries}, indent=2, ensure_ascii=False) + "\n"


def reusable_bundle(entries: list[dict[str, object]]) -> str:
    return json.dumps({
        "format": "project-os-reusable-knowledge",
        "schema_version": 1,
        "created_with": project_os.VERSION,
        "entries": entries,
    }, indent=2, ensure_ascii=False) + "\n"


def prepare(case: str, target: Path) -> None:
    # Resolve the selected parent, but never adopt or overwrite an existing target.
    target = target.parent.resolve(strict=True) / target.name
    target.mkdir()
    files = {"README.md": "# Synthetic reviewer fixture\n\nNo real project or user data.\n"}
    if case == "bootstrap-react-native-expo-repository":
        files.update({
            "package.json": json.dumps({"private": True, "dependencies": {
                "react": "19.0.0", "react-native": "0.79.0", "expo": "53.0.0"
            }}, indent=2) + "\n",
            "app.json": '{"expo": {"name": "Review fixture", "slug": "review-fixture"}}\n',
        })
    if case == "unrelated-code-request-does-not-create-state":
        files.update({
            "AGENTS.md": "# Working agreement\n\nFix only handler.py. Run python3 -B -m unittest -v test_handler.py.\n",
            "handler.py": 'def normalize(value):\n    return value.strip() or "empty"\n',
            "test_handler.py": 'import unittest\nfrom handler import normalize\n\nclass HandlerTest(unittest.TestCase):\n    def test_missing_value(self):\n        self.assertEqual(normalize(None), "empty")\n\n    def test_present_value(self):\n        self.assertEqual(normalize(" hello "), "hello")\n',
        })
    project_os.execute_operations(target, [("create", target / name, text) for name, text in files.items()], False)
    connected = {
        "check-valid-connected-repository",
        "upgrade-current-repository-is-idempotent",
        "prepare-and-approve-reusable-lessons",
        "export-reusable-knowledge-bundle",
        "import-applicable-reusable-lessons",
        "private-lesson-is-not-approved",
        "conflicting-import-does-not-write",
        "resume-blocked-plan-after-condition-clears",
    }
    if case not in connected and not case.startswith("continuity-"):
        return
    packs = "mobile" if case == "import-applicable-reusable-lessons" else "auto"
    overlays = "react-native-expo" if case == "import-applicable-reusable-lessons" else "auto"
    project_os.init_project(target, packs, overlays, False)
    creates = []
    updates = {}
    if case.startswith("continuity-"):
        contract = {"schema_version": 1, "plan_id": "001", "revision": 1, "gates": [
            {"id": "normalization", "condition": "Whitespace is normalized and empty input is rejected.",
             "evidence_class": "source", "target": "local", "status": "pending", "evidence": [],
             "next_action": "Run the focused normalizer tests and record their outcome.", "reason": ""},
            {"id": "remote-migration", "condition": "The required target migration and post-migration behavior are verified.",
             "evidence_class": "hosted", "target": "synthetic remote service", "status": "pending", "evidence": [],
             "next_action": "Obtain target access and verify the migration; no remote access is supplied by this fixture.", "reason": ""},
        ]}
        index = {"schema_version": 2, "execution_state": "running", "active_plan": "001", "next_id": 2,
                 "legacy_closed": {}, "legacy_uncontracted": [], "plans": [{"id": "001", "status": "active",
                 "path": ".agents/plans/001-retry.md", "contract_path": ".agents/plans/001-retry.json",
                 "outcome": "Preserve retry input behavior and verify the required target migration."}]}
        updates[".agents/plans/index.json"] = json.dumps(index, indent=2) + "\n"
        updates[".agents/STATE.md"] = "# Current checkpoint\n\nExecution state: running.\nActive plan: 001.\n\nNext: validate retry inputs. The target migration and post-migration gate remain pending; this fixture supplies no remote access.\n"
        creates.extend([
            (target / ".agents/plans/001-retry.json", json.dumps(contract, indent=2) + "\n"),
            (target / ".agents/plans/001-retry.md", "# Plan 001: Retry input behavior\n\nPreserve whitespace normalization and empty-input rejection, then verify the required target migration. The adjacent JSON owns acceptance. Following independent diagnostics work is outside this outcome. No deployment or external connection is authorized.\n"),
            (target / "retry.py", "def normalize(value):\n    result = value.strip()\n    if not result:\n        raise ValueError('empty input')\n    return result\n"),
            (target / "test_retry.py", "import unittest\nfrom retry import normalize\n\nclass RetryTest(unittest.TestCase):\n    def test_whitespace(self):\n        self.assertEqual(normalize(' ready '), 'ready')\n\n    def test_empty_rejected(self):\n        with self.assertRaises(ValueError):\n            normalize('   ')\n"),
        ])
        context_path = target / ".agents/CONTEXT.md"
        updates[".agents/CONTEXT.md"] = context_path.read_text() + "\n## Synthetic verification command\n\nRun python3 -B -m unittest -v test_retry.py from this fixture. Empty input rejection is part of the current contract. Remote access is unavailable and external actions are not authorized.\n"
    if case in {"prepare-and-approve-reusable-lessons", "private-lesson-is-not-approved"}:
        private = case == "private-lesson-is-not-approved"
        lesson = {
            "id": "REVIEW-PRIVATE-001" if private else "REVIEW-PORTABLE-001",
            "title": "Synthetic private lesson" if private else "Synthetic portable lesson",
            "status": "active",
            "applies_to": ["review fixture"], "trigger": "A retry occurs after the owner changes.",
            "mechanism": (
                "A late result is applied to a new owner. Private context: <PRIVATE_PERSON>, <PRIVATE_PATH>, https://example.invalid/evidence?signature=synthetic."
                if private else "A late result is applied to an owner that no longer initiated the request."
            ),
            "prevention": "Recheck the initiating owner before applying a late result.",
            "verification": ["Delay the result, change the owner, then confirm no update reaches the new owner."],
            "boundaries": ["Synthetic fixture only; placeholders are not real private data."],
            "source": {"kind": "project", "references": [".agents/evidence/review.md"]},
        }
        updates[".agents/knowledge/project/failures.json"] = json.dumps(
            {"schema_version": 1, "project": target.name, "entries": [lesson]}, indent=2) + "\n"
        creates.append((target / ".agents/evidence/review.md", "# Synthetic confirmation\n\nA controlled late-result test reproduced the owner mismatch and confirmed the owner check.\n"))
    if case == "export-reusable-knowledge-bundle":
        entries = [
            reusable_entry("REVIEW-MOBILE-001", ["mobile", "overlay/react-native-expo"], "A stale async result crosses an ownership boundary."),
            reusable_entry("REVIEW-CORE-001", ["core"], "A completion claim is accepted without durable evidence."),
        ]
        updates[".agents/knowledge/reusable/failures.json"] = reusable_registry(entries)
    if case == "import-applicable-reusable-lessons":
        entries = [
            reusable_entry("REVIEW-MOBILE-001", ["mobile", "overlay/react-native-expo"], "A stale async result crosses an ownership boundary."),
            reusable_entry("REVIEW-SERVICE-001", ["service"], "A retry duplicates a non-idempotent service mutation."),
        ]
        creates.append((target / "source/reusable-lessons.json", reusable_bundle(entries)))
    if case == "conflicting-import-does-not-write":
        local = reusable_entry("REVIEW-CONFLICT-001", ["core"], "The target has a locally reviewed mechanism.")
        incoming = reusable_entry("REVIEW-CONFLICT-001", ["core"], "The source has different reviewed content.")
        updates[".agents/knowledge/reusable/failures.json"] = reusable_registry([local])
        creates.append((target / "source/conflicting-bundle.json", reusable_bundle([incoming])))
    if case == "resume-blocked-plan-after-condition-clears":
        updates[".agents/plans/index.json"] = json.dumps({
            "schema_version": 2, "execution_state": "idle", "active_plan": None, "next_id": 2, "legacy_closed": {}, "legacy_uncontracted": [],
            "plans": [{"id": "001", "status": "blocked", "path": ".agents/plans/001-review.md",
                       "outcome": "Validate the local sample input.", "contract_path": ".agents/plans/001-review.json"}],
        }, indent=2) + "\n"
        updates[".agents/STATE.md"] = "# Checkpoint\n\nPlan 001 is blocked until sample.txt exists. Next: confirm sample.txt, resume 001, then validate its contents.\n"
        creates.extend([
            (target / ".agents/plans/001-review.json", json.dumps({"schema_version": 1, "plan_id": "001", "revision": 1, "gates": [{
                "id": "sample", "condition": "sample.txt contains ready.", "evidence_class": "source", "target": "local",
                "status": "pending", "evidence": [], "next_action": "Validate sample.txt contents.", "reason": "",
            }]}, indent=2) + "\n"),
            (target / ".agents/plans/001-review.md", "# Plan 001\n\nOutcome: validate the local sample input.\n\nBlocked until sample.txt exists.\n\n- [ ] Validate that sample.txt contains ready.\n"),
            (target / "sample.txt", "ready\n"),
        ])
    replacements = [(target / name, text, hashlib.sha256((target / name).read_bytes()).hexdigest())
                    for name, text in updates.items()]
    if creates or replacements:
        project_os.execute_sync_transaction(target, creates, replacements,
            after_write=lambda: project_os.require_passing_check(target, "Reviewer fixture"))
    if case in {"continuity-remote-prerequisite", "continuity-premature-release"}:
        checked = subprocess.run([sys.executable, "-B", "-m", "unittest", "-v", "test_retry.py"], cwd=target,
                                 capture_output=True, text=True, check=False)
        if checked.returncode:
            raise project_os.ProjectOSError("Synthetic source baseline did not pass")
        proof = "# Synthetic source verification\n\nCommand: python3 -B -m unittest -v test_retry.py. Target: local.\n\n~~~text\n" + checked.stdout + checked.stderr + "~~~\n"
        contract_path = target / ".agents/plans/001-retry.json"
        contract = json.loads(contract_path.read_text())
        contract["gates"][0].update(status="verified", next_action="", evidence=[{
            "path": ".agents/evidence/source-baseline.md", "sha256": "sha256:" + hashlib.sha256(proof.encode()).hexdigest(),
            "checked_on": date.today().isoformat(), "target": "local", "revision": 1,
        }])
        if case == "continuity-premature-release":
            contract["gates"] = contract["gates"][:1]
            for product in ("Codex", "ChatGPT"):
                contract["gates"].append({"id": product.lower(), "condition": f"Fresh {product} intake, cancellation and file-only recovery pass.",
                    "evidence_class": "host", "target": f"fresh {product} candidate session", "status": "pending", "evidence": [],
                    "next_action": f"Run exact isolated candidate acceptance in {product} before publication.", "reason": "No host behavior proof is supplied."})
            plan = index["plans"][0]
            plan["outcome"] = "Prepare a release candidate with verified fresh Codex and ChatGPT behavior."
            (target / ".agents/plans/index.json").write_text(json.dumps(index, indent=2) + "\n")
            (target / plan["path"]).write_text("# Plan 001: Verified release candidate\n\nLocal tests passed. The ZIP is prepared. Fresh Codex and ChatGPT intake, cancellation and file-only recovery are mandatory acceptance before publication. The adjacent contract owns all gates.\n")
            (target / ".agents/STATE.md").write_text("# Checkpoint\n\nExecution state: running.\nActive plan: 001.\n\nLocal tests passed and candidate ZIP is built. Mandatory fresh Codex and ChatGPT acceptance are pending. Next: test the isolated candidate before publication.\n")
        project_os.execute_sync_transaction(target, [(target / ".agents/evidence/source-baseline.md", proof)],
            [(contract_path, json.dumps(contract, indent=2) + "\n", hashlib.sha256(contract_path.read_bytes()).hexdigest())],
            after_write=lambda: project_os.require_passing_check(target, "Synthetic source baseline"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", required=True, choices=[case["name"] for case in ALL_CASES])
    parser.add_argument("--target", required=True, type=Path, help="New directory with an existing parent")
    arguments = parser.parse_args()
    try:
        prepare(arguments.case, arguments.target)
    except (OSError, project_os.ProjectOSError) as error:
        parser.exit(2, f"Fixture preparation failed: {error}\n")
    print(f"Fixture ready: {arguments.target.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
