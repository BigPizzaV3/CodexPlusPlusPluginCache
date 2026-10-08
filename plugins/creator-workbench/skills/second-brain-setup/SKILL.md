---
name: second-brain-setup
description: Create or adapt a local second-brain workspace from AI conversation exports and research files. Use when the user invokes Creator Workspace to build a second brain, organize ChatGPT or Claude history, create an Obsidian-style knowledge base, or set up a living wiki.
---

# Second Brain Setup

## Goal

Create a local, inspectable knowledge workspace without locking the user to one note app.

## First inspect

Before creating folders:
- inspect the current workspace
- detect any existing Obsidian vault, wiki, notes folder, or memory convention
- reuse existing structure when sensible

If starting from scratch, use the shared workspace contract.

## Setup stages

1. Create `brain/imports`, `brain/raw`, and `brain/wiki`.
2. Put exported AI histories under `brain/imports`.
3. Use `conversation-importer` to convert supported exports into readable markdown.
4. Put ongoing source material under `brain/raw`.
5. Use `living-wiki` to synthesize sources into topic and concept pages.
6. Build or refresh `brain/_index.md`.

## Obsidian

Obsidian is optional. The folder structure should remain useful as plain markdown without it.

If the user uses Obsidian:
- keep YAML frontmatter valid
- use relative wikilinks where useful
- avoid app-specific plugins unless requested

## External connectors

Gmail, calendars, meeting-note tools, NotebookLM, and other services are optional host capabilities. Do not declare or pretend a connector exists.

## Exclusion

Do not install or claim iMessage channel functionality. That behavior is specific to the upstream Claude environment and is not part of this ChatGPT/Codex package.

## Completion

Report the actual created or reused paths, imported source count if verified, wiki page count if verified, and any user action still required.

## Creator Workspace handoff

Use `host-workspace-operator` for real file inspection or creation. When exports are present, hand off to `conversation-importer`; after synthesis, use `workspace-recall` to test retrieval.
