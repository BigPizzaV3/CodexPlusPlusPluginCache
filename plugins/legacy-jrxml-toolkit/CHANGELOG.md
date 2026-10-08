# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.2] - 2026-08-05

### Added

- Independent GitHub Actions nodes for compiler-script, Claude Code, and ChatGPT/Codex validation.
- Automatic `chatgpt-codex-v<version>` GitHub Release publication after successful Codex validation on `main`.
- Workflow-structure regression tests covering job boundaries, dependencies, release conditions, and artifact naming.

### Changed

- Renamed the portable bundle to `legacy-jrxml-toolkit-chatgpt-codex-skill.zip` so its intended submission target is explicit.
- Split `tests/validate-skill.sh` into `compiler`, `claude`, `codex`, and `all` validation modes.
- Made package-version validation derive the expected version from canonical `SKILL.md` metadata.

## [1.0.1] - 2026-08-05

### Added

- Dependency-free Claude Code SemVer increment validator and tests.

### Changed

- Synchronized Claude and Codex metadata at version 1.0.1.

## [1.0.0] - 2026-08-05

### Added

- Portable Agent Skill for legacy iReport and JasperReports 2.x JRXML workflows.
- Legacy-compatible PowerShell compilation harness.
- Layout, project integration, and official-source references.
- Claude Code plugin manifest and GitHub-hosted marketplace catalog.
- Official Codex skill-only plugin manifest and GitHub-hosted marketplace catalog.
- Generated Codex plugin tree synchronized from the canonical root Agent Skill.
- Portable Agent Skill and Codex plugin ZIP artifacts with SHA-256 checksums.
- Tagged-release workflow for installable distribution artifacts.
- Automated validation for the skill, Claude metadata, Codex metadata, generated tree, and package contents.
- Public privacy statement, validation documentation, and MIT license.
