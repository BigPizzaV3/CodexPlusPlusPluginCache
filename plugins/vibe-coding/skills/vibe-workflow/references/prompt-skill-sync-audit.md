# Prompt Skill Sync Audit

## Scope

Maintain the selected Vibe Coding package: skill discovery, domain recipes, shared workflow, catalog and validation.
Inspect and report without editing.

Read the package manifests, selected SKILL.md entrypoints, referenced recipes and catalog entries. Each skill needs a distinct trigger; every recipe must be reachable; relative links must resolve inside the package. Keep inspection and implementation instructions consistent with the requested operation. Preserve domain invariants when simplifying repeated guidance.

Report supported findings with file and recipe evidence and one concrete repair direction.

Run `python3 scripts/validate.py` from the plugin root. For a behavior change, use a representative task in a disposable fixture and record the actual result. Structural validation establishes package consistency; task execution establishes observed model behavior.
