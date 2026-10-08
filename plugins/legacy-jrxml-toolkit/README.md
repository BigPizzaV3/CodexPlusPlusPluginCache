# Jasper JRXML Legacy Skill

Portable Agent Skill for complex **legacy iReport/JasperReports 2.x** reports, especially JasperReports 2.0.4, old DTD-based JRXML, dense official forms, absolute layouts, subreports, and headless `.jrxml` → `.jasper` validation.

It preserves legacy syntax instead of “helpfully” upgrading a 2007 report into a 2026 incident report.

## What it provides

- high-fidelity patterns for numbered fields, boxes, dividers, rotated sidebars, and rounded boxes with an open top;
- an evidence-based workflow for reproducing multi-page official forms;
- a configurable PowerShell/JDK 8 compiler harness using the consuming project's JasperReports 2.x jars;
- official SINAN form and JasperReports reference sources;
- local project learning under `docs/report/`, without leaking proprietary conventions into the shared skill.

## Install

The repository is a portable Agent Skill, a Claude Code marketplace, and a Codex plugin marketplace. Root `SKILL.md` remains the canonical source. The Codex plugin tree is generated from it and must not be edited manually.

### Codex plugin marketplace

Add the GitHub repository as a Codex marketplace:

```bash
codex plugin marketplace add vitorhugo-dotnet/jasper-jrxml-claude-skill
```

Install the skill-only plugin:

```bash
codex plugin add legacy-jrxml-toolkit@jasper-jrxml-plugins
```

Start a new Codex thread after installation so the skill is loaded.

The installable plugin uses the official layout:

```text
.agents/plugins/marketplace.json
plugins/legacy-jrxml-toolkit/
├── .codex-plugin/plugin.json
└── skills/jasper-jrxml/
    ├── SKILL.md
    ├── references/
    ├── scripts/
    └── docs/
```

### Codex direct skill installation

For a skill-only checkout without plugin metadata, clone the repository into Codex's skill directory:

```bash
git clone https://github.com/vitorhugo-dotnet/jasper-jrxml-claude-skill.git \
  "${CODEX_HOME:-$HOME/.codex}/skills/jasper-jrxml"
```

Restart Codex after installing the skill.

### Claude Code marketplace

Add this GitHub repository as a marketplace:

```text
/plugin marketplace add vitorhugo-dotnet/jasper-jrxml-claude-skill
```

Install the plugin:

```text
/plugin install legacy-jrxml-toolkit@jasper-jrxml-plugins
```

The plugin exposes the skill under the Claude Code namespace:

```text
/legacy-jrxml-toolkit:jasper-jrxml
```

Equivalent non-interactive CLI commands:

```bash
claude plugin marketplace add vitorhugo-dotnet/jasper-jrxml-claude-skill
claude plugin install legacy-jrxml-toolkit@jasper-jrxml-plugins
```

### Claude Code direct checkout

For local development without registering the marketplace, clone the repository and load it as a plugin:

```bash
git clone https://github.com/vitorhugo-dotnet/jasper-jrxml-claude-skill.git
claude --plugin-dir ./jasper-jrxml-claude-skill
```

Inside that session, invoke `/legacy-jrxml-toolkit:jasper-jrxml`. For project-scoped distribution, prefer marketplace installation instead of maintaining another copy.

### Cross-agent path

Clone into the open Agent Skills directory:

```bash
git clone https://github.com/vitorhugo-dotnet/jasper-jrxml-claude-skill.git \
  ~/.agents/skills/jasper-jrxml
```

Clients that support the [Agent Skills specification](https://agentskills.io/specification) can discover it there or through their configured skill catalog.

Do not keep multiple editable copies. Prefer the root skill plus generated packages or symlinks supported by the client and operating system.

## Build distribution artifacts

Generate the portable Agent Skill and the manifest-bearing ChatGPT/Codex plugin bundle:

```bash
bash scripts/package-skill.sh
```

Artifacts:

```text
dist/legacy-jrxml-toolkit-agent-skill.zip
dist/legacy-jrxml-toolkit-agent-skill.zip.sha256
dist/legacy-jrxml-toolkit-chatgpt-codex-plugin.zip
dist/legacy-jrxml-toolkit-chatgpt-codex-plugin.zip.sha256
```

Use `legacy-jrxml-toolkit-chatgpt-codex-plugin.zip` in the OpenAI plugin submission portal. It contains `.codex-plugin/plugin.json` at the ZIP root and the skill under `skills/jasper-jrxml/`, which is the structure the portal validates.

Use `legacy-jrxml-toolkit-agent-skill.zip` only for clients that accept a portable Agent Skill beginning with `SKILL.md`; it is not the OpenAI plugin submission bundle.

After a successful push to `main`, the GitHub Actions `release-codex` job publishes or refreshes the versioned `chatgpt-codex-v<version>` release with the manifest-bearing ChatGPT/Codex plugin bundle and checksum. Claude validation and Codex release publication remain separate jobs after the common compiler-script validation.

The repository marketplace is the preferred Codex installation path. The ZIPs support marketplace submission, release distribution, offline inspection, and environments that expose manual skill/plugin upload.

After changing canonical skill files or public metadata, regenerate the committed Codex plugin tree:

```bash
python3 scripts/sync-codex-plugin.py
```

Repository validation fails when the generated tree is stale.

## Usage

Ask the agent to create, edit, inspect, compile, or validate a legacy JRXML report, or invoke `jasper-jrxml` explicitly when the client supports direct skill invocation.

Compile a report with the bundled harness:

```powershell
pwsh -NoProfile -File scripts/compile-jrxml.ps1 `
  -Jrxml "reports/complex-form.jrxml" `
  -ProjectRoot "C:\path\to\consumer-project" `
  -LibDirectory "target\app\WEB-INF\lib" `
  -DeployDirectory "src\main\webapp\WEB-INF\reports"
```

Requirements:

- JDK 8;
- the consuming project's JasperReports 2.x and transitive jars;
- PowerShell;
- a real application fill/PDF comparison for visual validation.

## Compatibility boundary

This skill intentionally targets old iReport/JasperReports. Current [JasperReports samples](https://jasperreports.sourceforge.net/sample.reference/README.html) are conceptual references only. Never introduce modern syntax into a JasperReports 2.x template without compiling it against the project's exact legacy dependencies.

Official complex-form sources are listed in [`references/official-report-sources.md`](references/official-report-sources.md), including the [SINAN portal](https://portalsinan.saude.gov.br/).

## Project-specific learning

When a correction is confirmed, the agent writes a focused Markdown lesson in the **consuming repository's** `docs/report/`. The distributed skill is not silently modified and private project details are not promoted upstream. See [`docs/report/README.md`](docs/report/README.md).

## Validate this repository

Run all checks locally:

```bash
bash tests/validate-skill.sh all
bash tests/workflow-structure.Tests.sh
bash tests/package-skill.Tests.sh
```

Run one validation boundary independently:

```bash
bash tests/validate-skill.sh compiler
bash tests/validate-skill.sh claude
bash tests/validate-skill.sh codex
```

Validate with Claude Code itself:

```bash
claude plugin validate . --strict
claude --plugin-dir .
```

Inside that Claude Code session, invoke:

```text
/legacy-jrxml-toolkit:jasper-jrxml
```

If PowerShell is installed:

```powershell
pwsh -NoProfile -File tests/compile-jrxml.Tests.ps1
```

## Publishing boundary

This repository can be installed directly as an independent Codex marketplace. Inclusion in any OpenAI-operated curated directory remains subject to OpenAI's current review and submission process; the repository does not claim an undocumented automatic global-listing path.

## Privacy and releases

- [Privacy statement](PRIVACY.md)
- [Changelog](CHANGELOG.md)
- [Support and bug reports](https://github.com/vitorhugo-dotnet/jasper-jrxml-claude-skill/issues)

## License

[MIT](LICENSE)
