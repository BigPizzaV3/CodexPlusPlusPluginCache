---
title: Project Memory User Guide
---

# User guide

## What Project Memory does

Project Memory keeps important project knowledge available beyond one conversation. It stores curated Markdown notes in an Obsidian-compatible vault while machine-specific paths remain in private local configuration.

The durable layer answers:

- What is this project and what is its current state?
- What decisions have been made and why?
- What constraints and conventions must future work respect?
- What investigations, procedures, and references remain useful?
- What should happen next?

The public edition does not capture complete raw chat transcripts. Optional concise session summaries are stored separately and only when enabled or requested.

## Public and advanced editions

### Project Memory

The public, skills-only edition is suitable for normal use:

- no runtime installation;
- no server or account;
- no raw transcript capture;
- no telemetry;
- cross-platform Markdown and Obsidian compatibility.

### Project Memory Local

The advanced local development edition adds automatic lifecycle hooks and raw transcript archiving. It is intended for technically controlled environments and requires more careful privacy, retention, and runtime management.

## Create a new vault

Ask Codex to create a new Project Memory vault and select the destination folder. Project Memory:

1. checks that the path is safe;
2. refuses to repurpose a populated non-Obsidian folder without confirmation;
3. creates the vault and `.obsidian` marker;
4. adds only minimal project-memory structure;
5. keeps optional session summaries outside the vault.

Open the resulting folder in Obsidian normally.

## Connect an existing vault

Select your existing vault when asked. Project Memory checks for `.obsidian`, preserves your existing organisation, and adds project knowledge gradually.

If `.obsidian` is absent, Project Memory treats the location as a Markdown folder and asks before using it. It never reorganises existing content merely because a new convention is available.

## Add the vault as a source

Within the Codex local project:

1. Open **Edit project**.
2. Select **Add folder**.
3. Choose the Obsidian vault.
4. Keep the code repository primary.

The vault is now an accessible secondary source for every chat created in that local project. See [Automatic project orientation](automatic-orientation.md) for prompt-free loading.

## Register projects

One vault can support many code repositories. Each registration has:

- a stable project ID;
- a human-readable name;
- a machine-local repository path;
- a vault-relative project folder.

Only the stable ID and relative references appear in shared durable notes. Different users may keep the same repository and vault on completely different drives.

Project Memory can optionally apply a lightweight profile—software, research, client engagement, grant work package, product development, or personal learning—to suggest useful initial coverage areas. Profiles do not create empty folder trees or prevent later note types.

## Durable note types

Project Memory starts with only what is useful:

- `Project Home.md`: a polished, scannable front door with status, commands, decisions, risks, and next actions.
- `Project.md`: a compact compatibility index for project purpose, workstreams, decisions, and references.
- `Current State.md`: concise status, priorities, blockers, and next actions.
- `Decisions/`: accepted choices with context, rationale, and consequences.
- `Inbox/Promotion Inbox.md`: proposed changes awaiting review; its contents are not yet durable truth.
- `Handoff.md`: a concise restart brief generated from canonical notes.
- `Dashboards/`: optional Obsidian Bases views for decisions, current work, and knowledge needing attention.

Plans, investigations, procedures, or reference folders are created only when needed.

Focused templates are available for decisions, constraints, discoveries, procedures, and debugging lessons. PMC creates these only when there is durable content to record.

## What gets saved

Good durable knowledge includes accepted decisions, confirmed constraints, verified behaviour, reusable procedures, resolved root causes, risks, limitations, and current priorities.

Brainstorming, repeated information, transient tool output, unsuccessful attempts without a reusable lesson, and speculative conclusions stay out of the durable vault.

Before updating unmarked knowledge, Project Memory records a compact proposal in the Promotion Inbox. Review candidates individually by asking Codex to approve, edit, reject, or defer them. Conflicts, deletion, and supersession always require confirmation.

## Context packs

At the beginning of a task, PMC reads `Project Home.md`, `Project.md`, and `Current State.md`, then selects only notes relevant to the requested work. Selection uses links, status, workstreams, repository-relative code references, and recency. Codex briefly explains why it loaded each additional note instead of placing the entire vault in context.

The ranking runs locally and is intentionally inspectable. It is a retrieval aid rather than an authority: Codex reads the selected notes and verifies their status before acting. Superseded, deprecated, and rejected notes are excluded unless historical context is explicitly needed.

## Connect code to decisions

Durable notes can carry stable repository IDs and repository-relative `code_paths`. This supports questions such as:

```text
Which decisions affect src/tokens/issuer.ts?
What code implements our token-expiry decision?
Will this change invalidate any accepted project knowledge?
```

Project Memory never stores `C:` or `D:` source paths in shared notes. Optional revisions are Git commit identifiers, so links remain meaningful across machines.

## Branch-aware knowledge

Before promoting implementation-derived knowledge, Codex checks the current Git branch and revision when available. Work observed only on a feature branch enters the Promotion Inbox as branch-scoped. It does not update canonical Current State as merged or released until there is supporting evidence.

Implementation may be labelled `observed`, `proposed`, `implemented`, `merged`, `released`, `reverted`, or `unverified`. A merge is not automatically treated as a release.

## Contradictions and drift

Project Memory distinguishes:

- **stale:** the note has exceeded its review window;
- **conflicting:** two sources make incompatible claims;
- **unverified:** current evidence is insufficient.

Codex may compare relevant notes with code, configuration, and tests during a task. Suspected contradictions are placed in the Promotion Inbox with both pieces of evidence. Canonical knowledge is never silently overwritten.

For important stable claims, Codex can add explicit verification checks to a note. Supported checks include file presence or absence, required or forbidden text, and regular-expression matches. Ask:

```text
Check whether our durable notes have drifted from this repository.
```

Codex runs the local read-only checker. A failed check means the claim needs review; it does not prove whether the note or implementation is correct. Expected evidence values are not repeated in the checker report, and secrets must never be used as verification values.

## Knowledge coverage

Projects can declare stable coverage areas such as authentication, deployment, or billing. Notes tag the workstreams they support. Project Memory generates `Coverage.md` showing whether each area is:

- `covered`: multiple supporting notes plus an accepted decision or current-state note;
- `thin`: some material exists but navigation is incomplete;
- `uncovered`: no tagged durable notes were found.

Coverage also reports ownership and overdue reviews. It is a documentation navigation signal, not a staff or project-performance score.

## Local retrieval

Context ranking now combines exact terms, repository-relative code paths, note status, recency, and conservative fuzzy title matching. It remains fully local and explainable. This is deliberately not described as AI semantic search: no embedding model, API key, hidden index, or vault upload is required.

## Knowledge health

Ask naturally:

```text
Check this project's knowledge health.
```

Codex runs the bundled read-only checker, inspects the findings, and proposes focused repairs. It checks structural problems such as missing metadata, overdue reviews, old current-state notes, unresolved links, machine-specific paths, missing code targets, unscoped branch work, incomplete supersession links, duplicate decision titles, and possible credential-like content. It never prints suspected secret values or performs semantic repairs without approval.

## Handoff briefs

Ask Codex to prepare a handoff or wrap up the work. `Handoff.md` gives the next contributor a compact objective, current position, recent work, accepted decisions, blockers, open questions, next actions, and relevant links. It is regenerated from canonical notes rather than becoming a second source of truth.

## Team collaboration

Ask Codex to enable shared-vault conventions for a project. Project Memory creates a Team note and uses:

- one durable decision per file;
- stable `knowledge_id` values independent of filenames;
- explicit owners and reviewer aliases or teams;
- review states: `draft`, `requested`, `approved`, or `changes-requested`;
- contributor-specific Promotion Inbox files to reduce Git conflicts;
- reproducible Handoff and Coverage files that can be regenerated after merges.

A Git merge does not automatically mean project knowledge was approved. Project Memory records approval only after an explicit review action. Team aliases should avoid personal data unless project policy requires it.

## Portable exports

Ask Codex for one of four snapshots:

- **Onboarding:** project, current state, handoff, and accepted decisions.
- **Decision log:** accepted and superseded decisions with status preserved.
- **Audit:** relative paths, metadata, and SHA-256 hashes without note bodies.
- **Context:** foundational notes plus only the inspected notes selected for a particular task.

Codex runs the health check first and stops if possible-secret findings remain. The exporter refuses to overwrite an existing file without approval. Exports contain no absolute vault path and never update automatically; the vault remains canonical.

## Optional Obsidian interface

Project Memory Companion adds a local dashboard for Promotion Inbox actions, team reviews, overdue knowledge, and coverage gaps. It is optional; all canonical data remains ordinary Markdown. See [Obsidian companion](obsidian-companion.md).

## Markers

Markers are optional natural-language shortcuts:

| Marker | Meaning |
|---|---|
| `Remember:` | Confirmed durable candidate |
| `Decision:` | Decision with rationale and consequences |
| `Constraint:` | Confirmed requirement or limitation |
| `Reference:` | Durable supporting information |
| `Session only:` | Do not promote to durable notes |
| `Forget:` | Propose correction, removal, or supersession |

Equivalent natural language works; exact punctuation is unnecessary.

The simplest requests are often best:

```text
@PMC remember this
@PMC remember the decision we just made
@PMC update the project status
@PMC what do we already know about authentication?
@PMC wrap up this task
@PMC check this project's memory
```

## Resume work

With automatic orientation enabled, future tasks read the minimal current context automatically. Without it, use:

```text
Resume this project from Project Memory.
```

PMC reads `Project Home.md`, the compact project index, and current state first, follows only relevant links, and flags stale or contradictory information.

## Backups and synchronization

Project Memory is not a backup or synchronization service. You control the vault files and may use Git, Obsidian Sync, approved company storage, or another backup system according to your policies.

Do not commit machine-local configuration containing absolute paths. Never store credentials in the vault.
