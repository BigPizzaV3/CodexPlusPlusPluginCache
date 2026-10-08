# poka-yoke — skills bundle

Eleven skills, a dependency-free hazard scanner, and device templates. No plugin manifests,
no benchmark harness, no marketplace scaffolding: this is the behaviour-shaping content only.

Version 0.2.0 · MIT · https://github.com/rainmanjam/poka-yoke

## Install

Unzip anywhere the agent can read, and point it at `AGENTS.md`. Codex reads `AGENTS.md`
automatically when it sits at the root of the working directory, so the simplest install is
to unzip into your project and let it be found:

```bash
unzip poka-yoke-skills-0.2.0.zip
# then either work inside poka-yoke/, or copy AGENTS.md and skills/ into your project root
```

Nothing runs on install, and nothing here reaches the network.

## What is in it

```
.codex-plugin/         plugin.json — generated, hooks are empty, skills point at ./skills/
AGENTS.md              entry point and routing table
skills/<name>/SKILL.md eleven skills, one per mode
references/            hazard taxonomy and language specifics, loaded on demand
scripts/               detect_hazards.py, cli.py, device_registry.py — standard library only
assets/devices/        templates you choose to apply: pre-commit, CI, lint, hooks
```

Paths inside the skills are relative to the file that names them (`../../references/...`), so
the tree moves as a unit. Every one of those 13 references was checked to resolve inside this
bundle before it was packaged.

## The scanner

```bash
python3 scripts/detect_hazards.py --paths .
python3 scripts/detect_hazards.py --staged
python3 scripts/detect_hazards.py --diff --json
```

It reports what it scanned, and a scan of zero files exits non-zero rather than reporting
clean. Twenty hazard shapes; a further 23 are left to real linters, which it names rather
than reimplementing badly.

## Differences from the full plugin

`assets/devices/claude-hooks/` is written for Claude Code's `PreToolUse` hook and its
`.claude/settings.json` permission rules. The Python guard itself is portable, but the
registration mechanism is not — treat it as a reference implementation. The `pre-commit`,
`github-actions` and `lint` device templates are runtime-neutral.

One link in `references/hazard-catalog.md` points at `docs/method.md`, which lives in the
repository rather than in the plugin; in this bundle it is rewritten to a pinned URL.
