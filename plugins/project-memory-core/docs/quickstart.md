---
title: PMC Quickstart
---

# Get useful project memory in minutes

## 1. Install PMC

Install **PMC** from the public Plugins Directory, then begin a new Codex task in the project repository.

## 2. Start with one prompt

```text
@PMC set up lasting memory for this project in my Obsidian vault
```

PMC asks one question first: create a new vault or connect an existing Obsidian vault. It then confirms only the path and project details it cannot safely infer.

PMC does not reorganise an existing vault. A new vault gets the smallest useful structure and a polished `Project Home.md`.

## 3. Let PMC create the first overview

When setup finishes, accept the offer to scan the repository—or say:

```text
@PMC create an overview of this codebase in my Obsidian vault
```

PMC inspects a focused set of repository evidence and fills in:

- project purpose and structure;
- run, test, and build commands it can verify;
- current status and next actions;
- important constraints, decisions, discoveries, and procedures.

Unknown facts are omitted or labelled as inference rather than guessed.

## 4. Add the vault to the Codex project

For automatic access in future tasks:

1. Open **Edit project** in Codex.
2. Select **Add folder**.
3. Add the Obsidian vault as a secondary folder.
4. Keep the code repository as the primary folder.

Then say:

```text
@PMC use this vault automatically in future tasks for this repository
```

After approval, PMC adds a portable managed block to the repository's `AGENTS.md`. It stores a stable project ID, never your absolute vault path.

## 5. Work normally

```text
@PMC remember this
@PMC remember the decision we just made
@PMC update the project status
@PMC what do we already know about authentication?
@PMC wrap up this task
@PMC check this project's memory
```

You do not need special markers. When PMC notices something durable, it asks before adding it. Say "keep that session only" whenever something should not enter the vault.

## What PMC never does

- Upload your vault to the developer
- Capture complete raw transcripts
- Add developer telemetry
- Store authentication secrets
- Silently resolve contradictory knowledge
- Reorganise an existing vault without permission
