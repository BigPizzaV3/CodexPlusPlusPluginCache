---
title: Automatic Project Orientation
---

# Automatic project orientation

Automatic orientation lets new Codex chats use relevant vault knowledge without requiring a repeated text prompt.

## How it works

```text
Primary code folder
    -> automatically discovered AGENTS.md
    -> stable Project Memory ID
    -> machine-local path mapping
    -> attached secondary vault folder
    -> Project Home.md + Project.md + Current State.md
```

The repository contains only the stable project ID. Absolute code and vault paths remain in machine-local configuration.

## One-time setup

### Attach the vault

1. Open the Codex local project's menu.
2. Select **Edit project**.
3. Select **Add folder**.
4. Choose the Obsidian vault.
5. Keep the code repository as the primary folder.

This UI step cannot currently be performed by the plugin on your behalf.

### Enable orientation

Ask Project Memory to use the attached vault automatically for future chats. After confirmation, it adds or updates a managed block in the primary repository's `AGENTS.md`.

The block instructs Codex to:

- resolve the stable project ID;
- read `Project Home.md`, `Project.md`, and `Current State.md` before substantive work;
- follow only links relevant to the current task;
- flag stale or conflicting notes;
- continue safely and report when the vault is unavailable.

## Why the code folder must remain primary

Codex can read and edit all attached folders, but automatic discovery of `AGENTS.md`, repository skills, and `.codex/config.toml` uses the primary folder. Instructions placed only inside a secondary vault are not automatically loaded.

## Sharing with collaborators

The managed `AGENTS.md` block is portable because it contains no drive path. Each collaborator:

1. installs Project Memory;
2. attaches their own vault as a secondary folder;
3. configures their local mapping for the stable project ID.

## Disable orientation

Ask Project Memory to disable automatic orientation. It removes only the content between the Project Memory managed markers and preserves every unrelated repository instruction.

Removing orientation does not delete vault notes or local project configuration.
