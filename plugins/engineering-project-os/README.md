<img src="assets/logo.svg" width="96" height="96" alt="Engineering Project OS logo">

# Engineering Project OS

**Built for Codex.**

Resume engineering work with durable state and reusable failure knowledge.

[Install from the Universal Plugin Directory](https://chatgpt.com/plugins/plugins_6aa793523ba481918ea921c5438d98c9)

The source-tree candidate is 2.2.1 and is not published by this checkout. The Directory page shows the version currently available for installation.

The problem usually appears after the first productive session. Codex has explored the repository, ruled out two plausible causes, made a decision and found one check that passes. Then the task ends.

Tomorrow the code is still there, but the working state is not. Which decision was current? Which failure was confirmed? Did green CI prove the change worked or did the result still need a physical device, deployment or human check? A long chat may contain the answer, but chat history is a poor project database.

Engineering Project OS keeps that working truth in visible repository files. Codex can resume from the current plan, checkpoint, findings and evidence instead of reconstructing them from conversation fragments. The repository owns the state. The plugin knows how to inspect, create, validate and maintain it safely.

## What it gives a developer

- **Resumable work:** return in a new Codex task and continue from an exact checkpoint instead of retelling the project.
- **Visible plans and decisions:** keep the current route, constraints and next action beside the code that depends on them.
- **Guarded completion:** required gates and proof are checked before a plan can close, including remote prerequisites when the outcome needs them.
- **Durable additions:** corrections and new requirements are recorded during work, routed into the current or a following slice and recovered after context compaction.
- **Reusable failure knowledge:** turn a confirmed mechanism into a reviewed lesson that you can carry into another repository you own.

Project OS is useful when work spans sessions, has several acceptance boundaries or produces lessons worth preserving. It is not a generic project manager, an automatic global knowledge service or a requirement for an ordinary one-session code fix.

## What that looks like in practice

### Continue a long Codex task

A migration is halfway through. The current plan records what has changed, why one approach was rejected, which phase is active and the exact next check. A fresh Codex task reads those records and continues from repository truth rather than a summary remembered by a previous conversation.

### Keep "green" honest

A React Native fix passes TypeScript and unit tests. That is useful evidence, but it does not prove a native modal behaves correctly on the affected device. Project OS can preserve both facts: the source checks passed and physical acceptance remains open. "Done" stops being a mood.

### Reuse a failure without copying the old project

One repository confirms a recurring React Native lifecycle failure and records the trigger, mechanism, prevention and decisive verification. You review and sanitize that lesson, then import it into a new repository. The second project receives the reusable mechanism, not the first project's names, paths or private history.

## Start in Codex

1. [Install Engineering Project OS from the Universal Plugin Directory](https://chatgpt.com/plugins/plugins_6aa793523ba481918ea921c5438d98c9).
2. Open the repository in Codex and start a new task.
3. Inspect the repository without changing it:

~~~text
$project-os inspect
~~~

Project OS will recommend one connection path: a clean bootstrap, a bootstrap that preserves an existing `AGENTS.md` or adoption of compatible records already in the repository. Review the preview before any write, then run the matching workflow and validate the result.

~~~text
$project-os bootstrap
$project-os check
~~~

Use `$project-os adopt` instead of bootstrap when the inspection finds compatible existing state. Installing the plugin and connecting a repository are separate actions: installation makes the skill available while bootstrap or adoption creates the visible repository-local control plane.

After setup, ordinary development does not need a Project OS prefix. Ask Codex to implement, investigate or verify work normally. Use `$project-os` when the subject is the operating system itself: inspection, plans, checkpoints, findings, knowledge, upgrades or Program lifecycle.

~~~text
$project-os overview
$project-os check
$project-os plan open: ship offline retry without duplicate writes
$project-os plan checkpoint
~~~

Every mutating Project OS workflow follows the same boundary:

`inspect -> preview or dry-run -> review -> apply -> check`

The exact Codex requests and helper commands are documented in [Usage](docs/USAGE.md) and [Reference](docs/REFERENCE.md).

## Knowledge that compounds

If a team spends weeks proving why a failure happens, the lesson should survive more than the conversation that found it. Project OS separates two kinds of knowledge:

- **Project knowledge** stays with its repository and may include local names, paths, evidence and history.
- **Reusable knowledge** contains only reviewed, sanitized failure mechanisms that the user has deliberately approved for transfer.

The transfer is explicit: capture a confirmed finding, prepare a sanitized lesson, approve it, export it or read it directly from another repository, preview it against the destination and import it. Nothing synchronizes in the background. There is no Project OS-owned shared database and no author-managed lesson service.

For repositories available on the same machine, Codex can transfer reviewed lessons directly from the source repository. Portable JSON bundles support cross-machine work and the ChatGPT companion. Destination-owned changes win, skipped lessons are explained and repeated imports are idempotent.

The first repository records the lesson. The next repository does not need to repeat the failure. Software will still invent new ones, but at least it has to be creative.

See [How it works](docs/HOW_IT_WORKS.md) for the knowledge model and [Usage](docs/USAGE.md) for the transfer workflows.

## Standard and Program

Every connected repository starts in **Standard**. Standard is the complete everyday system: repository routing, durable context, checkpoint state, just-in-time plans, findings, evidence and knowledge.

A **Program** is an optional temporary contract for one genuinely multi-phase initiative. Use it when several separate plans need one shared outcome, authority boundary, phase sequence, evidence policy and exit condition. A long task does not automatically need a Program.

For example, one pagination fix belongs in Standard. An authentication migration across an API, workers, web and mobile may justify a Program. Closing a Program archives its exact contract with a SHA-256 digest, then returns the repository to Standard.

## ChatGPT companion

ChatGPT is a companion for explanations, supplied project files and portable knowledge bundles. It does not gain access to a live local repository merely because the plugin is installed.

Use the three Directory starter prompts to understand the system, prepare a setup from supplied material or work with a reviewed knowledge bundle:

~~~text
@Engineering Project OS Tell me how Project OS helps Codex resume real engineering work across sessions.
@Engineering Project OS Help me set up Project OS for this repository and start with a safe preview.
@Engineering Project OS Help me reuse verified failure knowledge from an earlier project in this one.
~~~

An overview needs no files. Advice about an existing setup requires the relevant Project OS files. If they are missing, ChatGPT must ask for them instead of pretending that an empty host workspace is your repository. Any changed files returned by ChatGPT remain artifacts until you deliberately apply them.

## Alternative: standalone Codex skill

The Universal Plugin Directory is the primary installation route. If you need a standalone Codex-only installation, use the built-in `$skill-installer` in Codex chat with the versioned release tag:

After the candidate is published with its versioned tag, the standalone installation request is:

~~~text
$skill-installer Install project-os from https://github.com/innrvoice/engineering-project-os/tree/v2.2.1/skills/project-os
~~~

Start a new Codex task after installation. The versioned URL does not follow `main` automatically.

## What is installed

The plugin contains a skill with focused instructions, references, templates, capability guidance and a deterministic Python helper. A connected repository contains visible records under `AGENTS.md` and `.agents/`.

There is no daemon, watcher, MCP server, hidden database, automatic upload, automatic Git operation or background cross-project synchronization. The helper runs only when explicitly invoked and never grants authority to change application code, install dependencies, commit, push, deploy or publish.

Requirements are Python 3.9 or newer on macOS or Linux when the deterministic helper runs locally.

## Continue reading

- [Setup](docs/SETUP.md)
- [How it works](docs/HOW_IT_WORKS.md)
- [Usage](docs/USAGE.md)
- [Reference](docs/REFERENCE.md)
- [Directory and release packaging](docs/PACKAGING.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Privacy policy](docs/PRIVACY.md)
- [Terms of use](docs/TERMS.md)
- [Support](https://github.com/innrvoice/engineering-project-os/issues)
- [MIT License](LICENSE)
