---
name: audit-repository-workflows
description: Use when reviewing a local repository for governance gaps, GitHub Actions trust-boundary risks, unsafe moderation, or a requested remediation patch.
---

# Audit repository workflows

Use the bundled auditor for deterministic local evidence. A finding is a review lead, not proof of exploitability, compromise, authorship, intent, or contributor quality.

## Scope

Resolve the exact repository directory and stay within it. The auditor reads local policy, workflow, and Git evidence without executing repository code or contacting GitHub. Live rulesets, organization policy, installed Apps, secrets, and external services remain outside the result.

## Operation

1. Read [references/commands.md](references/commands.md) and run `audit` first.
2. Prioritize critical and high findings. For each, report the rule ID, evidence location, triggering trust path, safe remediation, and missing external context.
3. If the user requested a fix or patch, run `fix`; otherwise stop after the report. `fix` writes only the requested unified-diff file and does not edit the target.
4. Review patch proposals in repository context and identify every change requiring owner authorization.

## Authority boundary

Audit and patch generation do not authorize installation, patch application, repository edits, settings changes, commits, pushes, pull requests, merges, or moderation actions. Obtain explicit authority for the specific mutation immediately before performing it.

Treat exit code 2 from `--fail-on` as a matched policy threshold. Keep JSON and SARIF private when paths or workflow details are sensitive. If local Git provenance is unavailable, state that limitation rather than inferring identity.

## Result

Return scope, finding counts, prioritized evidence, remediation options, external-state limitations, and whether a patch file was generated. Never score a contributor or infer AI use.
