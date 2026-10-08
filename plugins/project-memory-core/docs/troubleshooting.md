---
title: Project Memory Troubleshooting
---

# Troubleshooting

## Codex cannot read the vault

- Confirm that the vault is attached to the same local project as the code repository.
- Open **Edit project** and check the folder list.
- Confirm that filesystem permission was granted.
- Confirm that the vault exists on this machine and is not an unavailable removable or network drive.

## Context is not loaded automatically

- Confirm that the code repository is the primary folder.
- Check the primary repository's `AGENTS.md` for one Project Memory managed block.
- Confirm that its stable project ID matches the machine-local configuration.
- Start a new task after installing or updating the plugin.

## The wrong project notes are loaded

- Check the current primary repository.
- Inspect the stable project ID in `AGENTS.md`.
- Correct the machine-local repository-to-vault mapping.
- Do not solve the problem by adding absolute vault paths to shared notes.

## Existing vault is not recognised

An Obsidian vault normally contains `.obsidian`. If it is missing, confirm that you selected the correct folder. Project Memory can use a normal Markdown folder only after explicit confirmation.

## A durable update conflicts with an existing note

Project Memory should stop and show the existing durable claim and evidence beside the proposed claim and evidence. Choose whether to keep the existing claim, accept the proposed correction, merge compatible parts, or supersede the old claim while preserving its history. Accepted historical decisions should not be silently rewritten.

## A secret appeared in the conversation

Do not store it. Rotate or revoke the credential when necessary. Project Memory may record a safe operational action such as “rotate the exposed credential,” but never the value.

## Obsidian links are broken

Ask Project Memory to inspect the affected project's links. Avoid renaming many files at once unless the scope and resulting link updates have been reviewed.

## Uninstalling Project Memory

Uninstalling the plugin does not delete user-created notes, summaries, configuration, or repository instructions. Remove those separately only when intended.
