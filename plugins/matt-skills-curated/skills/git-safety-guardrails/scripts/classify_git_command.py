#!/usr/bin/env python3
import json, re, shlex, sys

command = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else sys.stdin.read().strip()
patterns = [
    (r"(?:^|[;&|]\s*)git\s+push\b.*(?:--force(?:-with-lease)?|-f\b)", "force push rewrites remote history"),
    (r"(?:^|[;&|]\s*)git\s+reset\s+--hard\b", "hard reset can discard local work"),
    (r"(?:^|[;&|]\s*)git\s+clean\b[^;&|]*(?:\s-f|\s--force)", "git clean can delete untracked files"),
    (r"(?:^|[;&|]\s*)git\s+branch\s+-D\b", "forced branch deletion can discard unmerged work"),
    (r"(?:^|[;&|]\s*)git\s+(?:checkout|restore)\s+(?:--\s+)?\.\s*(?:$|[;&|])", "whole-worktree restore can discard changes"),
    (r"(?:^|[;&|]\s*)git\s+rebase\b", "rebase rewrites commit history"),
]
reason = next((reason for pattern, reason in patterns if re.search(pattern, command)), None)
print(json.dumps({"command": command, "classification": "review" if reason else "allow", "reason": reason}, separators=(",", ":")))
sys.exit(2 if reason else 0)
