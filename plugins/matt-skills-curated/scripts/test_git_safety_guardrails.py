#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
classifier = ROOT / "skills" / "git-safety-guardrails" / "scripts" / "classify_git_command.py"

def classify(*parts: str):
    result = subprocess.run([sys.executable, str(classifier), *parts], text=True, capture_output=True)
    data = json.loads(result.stdout)
    return result.returncode, data

for command in [
    ("git", "status"),
    ("git", "diff", "--stat"),
    ("git", "fetch", "origin"),
    ("git", "push", "origin", "feature-branch"),
]:
    code, data = classify(*command)
    assert code == 0, (command, code, data)
    assert data["classification"] == "allow", (command, data)

for command in [
    ("git", "reset", "--hard", "HEAD"),
    ("git", "clean", "-fd"),
    ("git", "branch", "-D", "feature"),
    ("git", "push", "--force", "origin", "main"),
    ("git", "rebase", "main"),
]:
    code, data = classify(*command)
    assert code == 2, (command, code, data)
    assert data["classification"] == "review", (command, data)
    assert data["reason"], (command, data)

print("git safety classifier: PASS")
