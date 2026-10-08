---
title: Project Memory Privacy Policy
---

# Privacy Policy

Effective date: 5 August 2026

## Summary

Project Memory is a local-first, skills-only Codex plugin. The developer does not operate a server for the plugin and does not receive, collect, store, sell, or share users' prompts, code, vault content, configuration, project notes, or session summaries.

There is no PMC account, developer telemetry, analytics service, advertising identifier, or remote licence check in the free public plugin.

## Local data processed

At the user's request, Codex may read or write files in folders the user selects, including:

- Obsidian-compatible Markdown notes;
- machine-local project path configuration;
- an optional managed Project Memory block in a code repository's `AGENTS.md`;
- optional concise session summaries;
- repository-relative code references.
- explicit non-sensitive evidence checks selected for drift detection;
- derived local context rankings and knowledge-coverage reports.
- optional team ownership and review aliases;
- user-requested onboarding, decision-log, context, or audit snapshots.

This processing occurs in the user's Codex environment under Codex's permission controls. Project Memory does not transmit this data to the developer.

The bundled health, context, drift, and coverage helpers are local scripts. They do not use network access, external embedding services, telemetry, or developer-operated storage. Drift reports do not repeat the configured Expected evidence value.

The export helper writes only to a user-selected local destination. It runs no network operation, refuses overwrite by default, omits absolute vault paths from exported content, and stops when its own credential-like content check finds a possible secret. Users control subsequent sharing and retention of exported snapshots.

The optional Project Memory Companion operates inside Obsidian on local vault files. Its settings contain only a vault-relative project folder, optional reviewer alias, and local notification preference. It has no network integration, telemetry, account, external storage, or raw transcript access.

## Conversation data

Project Memory does not request or capture complete raw chat transcripts. Optional concise session summaries are disabled until requested or enabled by the user and remain in a user-selected local folder.

## Sensitive information

The plugin instructs Codex not to persist passwords, API keys, access tokens, private keys, authentication cookies, MFA codes, or other authentication secrets.

## Retention and deletion

The developer retains no user data. Users control local retention and may edit or delete their notes, summaries, and configuration with their normal filesystem tools. Removing the plugin does not automatically delete user-created files.

Users may disable automatic orientation by removing the managed Project Memory block from the repository's `AGENTS.md`. This does not delete vault notes.

## Recipients and sharing

The plugin sends no data to the developer or third parties. A user may separately choose to synchronize or publish their local vault using another product; that activity is outside Project Memory and governed by that product's terms and privacy policy.

## Changes

Material changes to the plugin's data practices will be reflected in this policy and submitted for any required plugin review before release.

## Contact

Use the public support channel listed on the Project Memory support page. The final public support URL must be configured before submission.
