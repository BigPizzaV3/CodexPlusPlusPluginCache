# Marketplace Submission Notes

Aivana Database Engineer by [Aivana GmbH](https://www.aivana-gmbh.ai) is a Codex plugin for safety-governed SQL Server and PostgreSQL
analysis, performance diagnostics, migration planning, and policy-controlled
database operations.

## Marketplace Install Path

Submit the plugin directory URL:

```text
https://github.com/rweisssieker-xp/SQLSERVER-POSTGRES-Plugin/tree/master/plugins/sqlserver-postgres-performance-advisor
```

For a local checkout, use the Codex CLI:

```bash
codex plugin marketplace add /absolute/path/to/SQLSERVER-POSTGRES-Plugin
codex plugin add sqlserver-postgres-performance-advisor@sqlserver-postgres-plugin-marketplace
```

Replace the checkout path and open a new Codex task after installation. Run
`npm ci` in the installed plugin directory before live database use. These
instructions do not imply acceptance into a public marketplace.

## Required Manifest

The marketplace scanner expects a plugin manifest at the repository root:

```text
.codex-plugin/plugin.json
```

The nested plugin directory also keeps its local manifest for development:

```text
plugins/sqlserver-postgres-performance-advisor/.codex-plugin/plugin.json
```

The submitted artifact must stay at or below the scanner file-count limit of
128 files. The repository keeps a compact marketplace skill set for submission
while the runtime manifest remains the source of truth for executable tools.

## Safety Positioning

This plugin is an advisor and governed operations layer. It is not a replacement
for SSMS, DataGrip, dbForge, SSDT, Redgate SQL Prompt, SQL Sentry, or other IDE
and monitoring suites. It focuses on deterministic advisory workflows, evidence
packages, policy gates, rollback planning, and Codex skill orchestration.

## Disruptive AI Demo Positioning

Default narrative:

```text
Autonomous Database Operations without autonomous production risk.
```

Use `demos/enterprise-ai-usp-scenarios.json` for machine-readable marketplace
demos and `demos/KILLER_DEMOS.md` for the curated talk track. The killer demos
show unsafe prompt escalation, board-level operator briefings, cross-agent
disagreement before a wrong index, and executive ROI storytelling while staying
in closed-loop dry-run mode.

The formal output expectations for the autonomous operator and AI cognitive
control-plane tools are declared in `runtime/tool-contracts.json`.

## Marketing Assets

Use `MARKETING.md` for launch-ready product messaging, buyer personas, USP
matrix, competitive positioning, marketplace copy, landing-page copy, FAQ,
pricing narrative, and launch blurb.

Use `demos/SALES_PLAYBOOK.md` for discovery questions, qualification signals,
demo sequencing, objection handling, follow-up email copy, and pilot success
criteria.
