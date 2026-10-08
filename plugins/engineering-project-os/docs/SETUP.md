# Setup

Engineering Project OS is built for Codex. The primary installation route is the Universal Plugin Directory. Installation makes the Project OS skill available, but it does not attach a repository or write Project OS records.

## Requirements

- A supported Codex surface with plugin access.
- A local repository opened as the Codex workspace.
- Python 3.9 or newer on macOS or Linux for deterministic helper operations.
- A clean understanding of any existing `AGENTS.md`, `.agents/` records and uncommitted work before setup.

## 1. Install from the Universal Plugin Directory

1. Open [Engineering Project OS](https://chatgpt.com/plugins/plugins_6aa793523ba481918ea921c5438d98c9).
2. Select the plus button or `Install`.
3. Open the target repository in Codex.
4. Start a new Codex task so the installed skill is available.

Do not copy plugin files into the repository. The Directory installation belongs to the user profile while Project OS records belong to each connected repository.

## 2. Inspect the repository

**Type this in Codex chat:**

~~~text
$project-os inspect
~~~

Inspection is read-only. Codex reads Git state, applicable instructions, existing Project OS records, documentation and available engineering configuration. It reports one recommended connection path and the files that path would affect.

The possible paths are:

- **Clean bootstrap:** no existing Project OS authority needs preservation.
- **`AGENTS.md`-preserving bootstrap:** a compatible root instruction file already exists and must remain authoritative.
- **Adoption:** compatible context, plans, findings, evidence or knowledge already exist and should be mapped instead of replaced.

Stop if the report cannot identify the repository root, finds ambiguous ownership or would overwrite project-owned authority.

## 3. Preview and connect

For a bootstrap, continue with:

~~~text
$project-os bootstrap
~~~

For compatible existing records, use:

~~~text
$project-os adopt
~~~

Codex inspects again, prepares the operation and runs the deterministic helper with `--dry-run`. Review the proposed files before authorizing the same operation without `--dry-run`.

Bootstrap creates Standard mode. It does not create a Program, active plan or application code. It preserves safe unrelated `.agents` namespaces such as `.agents/plugins` and refuses an unsafe overwrite.

Adoption maps compatible records to the Project OS ownership model. It does not silently treat arbitrary Markdown as current authority.

## 4. Validate and restart

After the reviewed operation is applied, run:

~~~text
$project-os check
~~~

A successful setup requires the helper check to pass and the Git diff to contain only the approved control-plane files. Start a new Codex task after `AGENTS.md` is created or changed so its instruction route enters the task startup chain.

Ordinary engineering work now uses ordinary requests. Use `$project-os` when the request concerns Project OS maintenance, durable plan state, findings, evidence, knowledge or Program lifecycle.

## Upgrade from 2.1.1 to candidate 2.2.1

Candidate 2.2.1 introduces SYSTEM schema 5, plans schema 2, JSON acceptance contracts, durable request intake and guarded plan completion. Knowledge transfer formats remain unchanged. The candidate is not published by this source checkout; use the versioned installed helper after publication or explicitly test the candidate helper in an isolated fixture.

First update the installed Directory plugin, then start a new Codex task in the repository and type:

~~~text
$project-os upgrade
~~~

Codex must use the installed 2.2.1 helper transaction:

~~~text
python3 /absolute/path/to/project-os/scripts/project_os.py upgrade --target /path/to/repository --dry-run
python3 /absolute/path/to/project-os/scripts/project_os.py upgrade --target /path/to/repository
python3 /absolute/path/to/project-os/scripts/project_os.py check --target /path/to/repository
git diff --check
~~~

Review the dry-run before applying it. After the check, inspect the exact changed paths. The reviewed transaction adds managed WORKFLOW, an empty requests registry, minimal AGENTS routing and plan-index migration metadata. Existing Markdown plans, context, state, findings, evidence and application code remain unchanged. Historical closed plans retain their dispositions without new proof. Before resuming a legacy unfinished plan, review its contract and remove its migration mark. Existing legacy knowledge migration rules remain applicable.

Updating the installed plugin alone does not upgrade a connected repository. Each repository keeps its recorded release until this explicit transaction succeeds.

## ChatGPT companion setup

ChatGPT is a companion for explanations, supplied project files and portable knowledge bundles. After Directory installation, start a new ChatGPT chat and select the plugin with `@Engineering Project OS`.

An overview needs no repository input:

~~~text
@Engineering Project OS Tell me how Project OS helps Codex resume real engineering work across sessions.
~~~

Setup advice can begin from a project description. Claims about an existing setup require the relevant files, usually `AGENTS.md`, `.agents/SYSTEM.json`, `.agents/CONTEXT.md`, `.agents/STATE.md` and the registries involved in the request. A complete repository archive is optional and appropriate only when the complete tree matters.

ChatGPT works against the supplied copies. It cannot connect to a live local checkout through installation alone. Any generated or changed files remain chat artifacts until the user deliberately applies them to the repository and validates the result in Codex.

## Alternative: standalone Codex skill

Use this route only when a standalone Codex-only installation is required. Send the following message in Codex chat, not Terminal:

~~~text
$skill-installer Install project-os from https://github.com/innrvoice/engineering-project-os/tree/v2.2.1/skills/project-os
~~~

Start a new Codex task after installation. Use this candidate URL only after the versioned tag is published. It does not follow `main` automatically.

Avoid keeping an older standalone skill active beside the Directory plugin. Remove the obsolete user-level `project-os` skill before relying on the Directory version so `$project-os` resolves to one intended installation.

## Setup boundaries

- Installing the plugin is not connecting a repository.
- Connecting a repository is not opening a plan.
- Opening a plan is not starting a Program.
- A passing Project OS check proves structural consistency, not product acceptance.
- No setup path authorizes dependency installation, application edits, Git operations, deployment or publication.

Use [Usage](USAGE.md) for developer workflows, [Reference](REFERENCE.md) for exact syntax and [Packaging](PACKAGING.md) for maintainer release procedures.
