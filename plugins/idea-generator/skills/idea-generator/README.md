# Idea Generator

An Agent Skill for generating ideas through decomposition, crossbreeding, and mutation.

[Try the Web Demo](https://idea.ludi-lab.com/) · [Download the latest release](https://github.com/ludi-uni/idea-generator-skill/releases/latest)

Unlike generic brainstorming, Idea Generator first decomposes source concepts into Idea DNA, then applies crossover and mutation while preserving explicit constraints and locks.

```text
Input concepts
    ↓
Idea DNA decomposition
    ↓
Crossbreeding
    ↓
Mutation
    ↓
Diverse candidate ideas
```

## Try the Web Demo

Start by testing the interaction model at [https://idea.ludi-lab.com/](https://idea.ludi-lab.com/) and then install the release ZIP in your preferred client.

## 日本語クイックスタート

```
電子工作、夏、食べ物。Mutation Highでアイデア生成
```

最速の導線は、上記のように入力して生成を確認してから、GitHub リリースの `idea-generator-vX.Y.Z.zip` をダウンロードし、**Skills の ZIP アップロード**でインポートすることです。
リリース ZIP を使うのが、最も確実で簡単な Skill 導入ルートです。

## How It Works

- Input concepts are decomposed into compact DNA loci.
- Loci are crossbred across parents with explicit constraints and locked fields carried forward.
- Mutation is applied as a scored operation with configurable intensity.
- Output candidates remain interpretable and traceable through compact result-level lineage.

## Install in ChatGPT

- Open ChatGPT in browser.
- Open `Plugins → Skills → Create → Upload from your computer`.
- Upload the release ZIP.
- Personal Skills installation is generally available in Business, Enterprise, Healthcare, and Edu, and may be restricted by your workspace policy.

## Install in Claude.ai

- Open `Settings → Features`.
- Upload the release ZIP through your available Skills flow.
- Custom Skills with code execution usually require Pro, Max, Team, or Enterprise plans.
- Code execution and skill import are also policy dependent.

### Secondary install paths (filesystem)

- Codex: place this Skill in the OpenAI skills path on the local filesystem.
- Claude Code: use the `Skills` directory-based installation flow for filesystem-based loading.

## Install as Agent Skill

Download the standalone release artifact `idea-generator-vX.Y.Z.zip` from GitHub Releases and upload or extract it through the Agent Skill installation flow supported by your client. This remains the canonical standalone Skill package for this repository.

## Install as OpenAI Plugin

The generated `idea-generator-plugin-vX.Y.Z.zip` is an OpenAI skills-only Plugin package with `.codex-plugin/plugin.json` and the Skill under `skills/idea-generator/`. It is intended for local validation now and for future Plugin Directory submission.

Status: Not yet published to the public Plugin Directory

The Plugin package does not include MCP server, App, OAuth, backend, or custom UI configuration. Public availability and Directory installation will depend on the eventual OpenAI submission process.

## Build Plugin Package

Use the repository version in `package.json` as the single version source:

```powershell
npm run build:plugin
```

The command writes `dist/idea-generator-plugin/` and `dist/idea-generator-plugin-v<version>.zip`. It validates the source Skill, reuses the standalone package allowlist, generates the Plugin manifest, checks source parity, and validates the ZIP before publishing those outputs.

## Validate

Run the existing Skill checks and the Plugin checks together:

```powershell
npm run validate
npm test
node scripts/validate-plugin.mjs dist/idea-generator-plugin --source-root .
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
./scripts/validate-plugin-archive.ps1 -ArchivePath (Join-Path 'dist' "idea-generator-plugin-v$version.zip") -SourceRoot .
```

The Plugin validator rejects stale or extra Skill files, MCP/App configuration, unsafe archive paths, secrets, and private local paths.

## Architecture

```text
Source Skill
    ↓
Plugin packaging
    ↓
OpenAI skills-only Plugin
```

The existing Skill is the Single Source of Truth. The Plugin builder invokes the existing standalone Skill packager and generates the manifest and Plugin directory from that validated output. `SKILL.md`, references, examples, assets, and other runtime files are not maintained as a second hand-copied Plugin source.

## Mutation Levels

Mutation values map to these ranges from the frozen `references/mutation-rules.md`:

### Low

0–34 (Low) keeps most parent loci and changes one nearby mechanism, context, or feature with **feasibility and usefulness** emphasis.

### Medium

35–69 (Medium) exchanges several loci and allows one distant substitution while retaining a clear parent identity, balanced across novelty and feasibility.

### High

70–100 (High) uses distant contexts, roles, scales, or inversions and allows more radical transformation while retaining explicit constraints and locked elements.

## Compatibility

Release ZIP upload is the main supported install path for this repository’s Skill artifact.

- GitHub release ZIP is the canonical path for ChatGPT and Claude.ai installation.
- Other Agent Skills-compatible hosts may work, but this is untested and not guaranteed.
- Other hosts are not covered by formal compatibility claims.

Official references:

- ChatGPT Skills help: https://help.openai.com/en/articles/20001066
- Claude Skills: https://support.claude.com/en/articles/12512180-use-skills-in-claude
- Agent Skills specification: https://openagentskills.dev/docs/specification

Examples in `examples/low.md`, `examples/medium.md`, and `examples/high.md` are illustrative outputs and are non-deterministic. They are not guaranteed deterministic returns.

## Repository Structure

- `README.md` (this document)
- `SKILL.md`
- `LICENSE`
- `CHANGELOG.md`
- `agents/openai.yaml`
- `assets/icon.svg`
- `examples/high.md`
- `examples/low.md`
- `examples/medium.md`
- `references/examples.md`
- `references/generation-rules.md`
- `references/mutation-rules.md`
- `references/output-format.md`
- `scripts/`
- `tests/`

## Development

This repository contains development tooling, including:

- `scripts/validate.mjs`
- `scripts/package.ps1`
- `tests/*.test.mjs`
- `package.json`
- `.github/workflows/*`

The installable Skill itself has no runtime scripts.
`scripts/` and related test/automation files are repository tooling only and are excluded from the release ZIP.

## Release

Use the release pipeline output from this repository:

- Validate source with `node scripts/validate.mjs . --mode source`.
- Keep `package.json` at the release version and create the matching Git tag `v<version>`.
- Build and verify the standalone `idea-generator-v<version>.zip` and Plugin `idea-generator-plugin-v<version>.zip` through repository scripts and CI.
- Confirm each ZIP contains only its validated runtime files for install.
- Plugin publication to the public Plugin Directory is not part of this repository workflow yet.

## MIT License

This project is licensed under the MIT License.
See `LICENSE` for details.
