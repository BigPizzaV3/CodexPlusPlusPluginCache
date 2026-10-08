# Self-Hosting Plugin Design

## Goal
Build `chatgpt-codex-plugin-autopilot` as a standalone private GitHub repository and installable ChatGPT/Codex skill-only Plugin. The Plugin contains the existing generic autopilot Skill and validates/packages itself with the same rules it applies to other Plugins.

## Architecture
The repository root is the Plugin root. `.codex-plugin/plugin.json` declares one skills directory and no required app, MCP server, or hook. `skills/chatgpt-codex-plugin-autopilot/` contains the Skill, OpenAI agent metadata, references, validator, and deterministic packager. Repository-level scripts wrap self-validation, self-packaging, checksum generation, and install smoke tests.

## Release contract
Version starts at `0.1.0`. A release is blocked unless unit tests, self-validation, deterministic package comparison, archive inspection, secret/path scans, and fresh-install smoke tests pass. GitHub Release assets are `chatgpt-codex-plugin-autopilot-<version>.zip` and `SHA256SUMS`. The GitHub repository is private.

## Safety and scope
The Plugin is skill-only and grants no external-system access by itself. It must fail closed on malformed plugin metadata, unsafe archive entries, secret-shaped files, local absolute paths, invalid Skill layout, nondeterministic archives, and explicit public exclusions. It must not add hidden telemetry or registry credentials.
