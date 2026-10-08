# CLAUDE.md — quarryFi Codex Plugin

## Project Overview

QuarryFi privacy-minimized activity tracker for OpenAI Codex (CLI and App). Sends project-level heartbeats to QuarryFi for R&D evidence review. Tracker data does not determine tax-credit eligibility and is not tax advice. The plugin shares `~/.quarryfi/config.json` with the Claude Code plugin and VS Code extension.

## Architecture

- `.codex-plugin/plugin.json` — Codex plugin manifest (name: `quarryfi-time-tracker`)
- `hooks/track-session.sh` — Shared lifecycle hook for SessionStart, PostToolUse, UserPromptSubmit, and Stop
- `skills/quarryfi-status/SKILL.md` — Status check skill
- `skills/quarryfi-update/SKILL.md` — Self-update skill (git pull from inside Codex)
- `setup.sh` — Interactive multi-profile config setup

## Critical Rules for Updates

### Plugin source is immutable at runtime

Normal Codex sessions, lifecycle hooks, and status checks must never modify files under the plugin checkout. Runtime state belongs only under `~/.quarryfi/` (config, audit log, and session files). The explicit `quarryfi-update` skill is the only workflow allowed to change the local plugin folder, and it must do so with a fast-forward git update or a clearly reported repair of stale git metadata.

Keep these copies separate:

- Upstream development repo: where product changes are authored, committed, and pushed to GitHub.
- Local install source: the clone referenced by a personal/project marketplace, updated by `quarryfi-update`.
- Codex runtime cache: `~/.codex/plugins/cache/...`, managed by Codex. Never commit, pull, reset, or treat it as the update target.

### Heartbeat payload — all 9 fields required, never null

Every heartbeat sent to `POST /api/heartbeat` must include ALL of these fields with real values:

| Field | Fallback | Never send |
|---|---|---|
| `source` | `"codex"` (hardcoded) | |
| `project_name` | git repo name → `"unknown"` | `null`, `""` |
| `language` | marker files → git diff → `"multi"` | `null`, `""` |
| `file_type` | git diff ext → language inference → `"multi"` | `null`, `""` |
| `branch` | `git rev-parse` → `"unknown"` | `null`, `""` |
| `editor` | `"Codex CLI"` or `"Codex App"` | `null`, `""` |
| `timestamp` | `date -u` ISO 8601 | `null`, `""` |
| `duration_seconds` | `0` on start events | `null`, `""` |
| `session_id` | env var → persisted file → generate | `null`, `""` |

This applies everywhere — including `setup.sh`'s verify_key function, which must send a complete payload (not a minimal one) or the API returns 400.

### Runtime diagnostics are required

Every heartbeat request should also include a top-level `client` object with:

- `plugin_version`
- `runtime_channel`
- `hook_mode`
- `install_revision`
- `host_app`

These are used only for runtime health diagnostics. They must never include prompts, code, or file contents.

Trackers may also send the current Git commit SHA, a SHA-256 digest of the lowercase GitHub `owner/repository` name, a changed-file count, and one coarse activity enum. Never send raw remotes, local paths, filenames, diffs, prompts, commands, command output, or source code.

### Session files use stable paths, not PID

Session files live under `~/.quarryfi/session-codex-{hash}` where hash is derived from `shasum` of the project directory. NEVER use `$$` (PID) — each hook invocation is a separate process.

### Config format is shared

`~/.quarryfi/config.json` is identical across the Codex plugin, Claude Code plugin, and VS Code extension. Any config format changes must be coordinated across all three repos.

Released builds always send to `https://quarryfi.com`. Keep accepting legacy `api_url` fields for shared-config compatibility, but never use them to choose a network destination. This default-deny boundary prevents a modified config from redirecting a seat credential.

### Plugin folder name must match manifest name

The install directory must be `quarryfi-time-tracker` to match the `"name"` field in `.codex-plugin/plugin.json`. The marketplace entry `source.path` must point to this folder name.

## Version Bumping

Bump version in `.codex-plugin/plugin.json` when:
- **Patch** (0.2.x): bug fixes, doc updates
- **Minor** (0.x.0): new features, new fields, new skills
- **Major** (x.0.0): breaking config changes, removed fields

Current version: see `.codex-plugin/plugin.json`

## Testing

- `bash -n hooks/track-session.sh` — syntax check
- `bash -n setup.sh` — syntax check
- Test verify_key by running `setup.sh` with a real key — must get HTTP 200, not 400
- Manual smoke: run the hook directly with CLI args and with JSON stdin, then confirm `~/.quarryfi/audit.log` records `hook_fired`
