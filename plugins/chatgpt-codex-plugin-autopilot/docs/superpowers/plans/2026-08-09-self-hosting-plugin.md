# Self-Hosting Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `chatgpt-codex-plugin-autopilot` as a private, standalone, installable, self-validating ChatGPT/Codex Plugin with a downloadable GitHub Release ZIP.

**Architecture:** The repository root is a skill-only Plugin. The existing generic Skill is promoted into the repository as the canonical capability, while thin repository scripts invoke its validator and deterministic packager against the repository itself. GitHub Actions rerun the same self-hosting gates and tag releases attach the exact verified ZIP plus SHA256SUMS.

**Tech Stack:** Python 3 standard library, shell, Git, GitHub Actions, GitHub CLI

## Global Constraints
- Repository name: `chatgpt-codex-plugin-autopilot`
- Visibility: private
- Initial version: `0.1.0`
- Plugin architecture: skill-only, no required app/MCP/hook
- Release ZIP must be deterministic and directly installable
- No credentials, local absolute paths, hidden telemetry, or stale excluded capabilities in release surface
- Current official OpenAI Plugin/Skill rules override remembered rules

---

### Task 1: Standalone plugin contract
**Files:** Create `.codex-plugin/plugin.json`, `tests/test_plugin_contract.py`, `README.md`, legal/support files, branding assets.
**Produces:** A valid skill-only Plugin root with final-directory metadata and installable identity.
- [ ] Write failing tests for manifest identity, one Skill, legal URLs, assets, and absence of app/MCP/hook requirements
- [ ] Run the tests and confirm RED because the Plugin files do not exist
- [ ] Add the minimal manifest, docs, legal/support pages, and square SVG assets
- [ ] Run the tests and confirm GREEN
- [ ] Commit the contract

### Task 2: Canonical autopilot Skill
**Files:** Create `skills/chatgpt-codex-plugin-autopilot/**`, `tests/test_skill_surface.py`.
**Consumes:** The approved Skill from Riqor v0.2.6.
**Produces:** A self-contained Skill with references, `agents/openai.yaml`, validator, and deterministic packager.
- [ ] Write failing surface tests for required Skill files, trigger metadata, references, and scripts
- [ ] Run and confirm RED
- [ ] Copy the approved Skill into the standalone repository and adapt repository references only where required
- [ ] Run and confirm GREEN
- [ ] Commit the Skill

### Task 3: Self-hosting validation and packaging
**Files:** Create `scripts/self_check.py`, `scripts/build_release.py`, `tests/test_self_hosting.py`.
**Produces:** `self_check` and `build_release` commands that validate the repo against its own Skill and create deterministic release assets.
- [ ] Write failing tests for self-validation, two-build byte identity, root layout, checksum content, and fresh extraction validation
- [ ] Run and confirm RED
- [ ] Implement minimal wrappers around the Skill validator/packager plus archive smoke checks
- [ ] Run and confirm GREEN
- [ ] Commit self-hosting tooling

### Task 4: CI and release automation
**Files:** Create `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `tests/test_workflows.py`, `.gitignore`.
**Produces:** Read-only CI and tag-triggered GitHub Release automation with verified ZIP/checksum assets.
- [ ] Write failing static tests for pinned actions, permissions, test/self-check/build gates, and release assets
- [ ] Run and confirm RED
- [ ] Add CI and release workflows with pinned GitHub actions and no package-registry publishing
- [ ] Run and confirm GREEN
- [ ] Commit automation

### Task 5: Full gate, private publish, and release verification
**Files:** No production changes unless a gate exposes a root cause.
- [ ] Run the full unit suite
- [ ] Run `python3 scripts/self_check.py`
- [ ] Build twice and require byte-identical ZIP SHA256
- [ ] Inspect archive file list and run fresh-extraction validation
- [ ] Scan tracked/release files for secrets, local paths, symlinks, and excluded capabilities
- [ ] Create private GitHub repository and push `main`
- [ ] Verify remote visibility is private and CI passes
- [ ] Tag `v0.1.0`, push the tag, and verify the GitHub Release succeeds
- [ ] Download release assets, compare SHA256 to local verified assets, and report exact commit/tag/hash
