---
name: trylle-cli
description: Operate the Trylle git platform with the official `try` CLI. Use when an agent needs to authenticate to Trylle; inspect or manage repositories, pull requests, issues, stacked PRs, CI, actions secrets or variables, organizations, profiles, SSH keys, automations, or bots; print Trylle web URLs; call an uncovered public API endpoint; or use Trylle's AI, explain, draft, and diff commands.
---

# Trylle CLI

Use `try` as the primary interface for Trylle platform operations. Use `git` for local version-control work, but do not substitute GitHub-specific tooling for Trylle resources.

## Core workflow

1. Confirm the CLI is available with `try --version`. If it is missing, install it with `brew install trylle/trylle-cli/try` when the user authorizes installation.
2. Check authentication with `try auth status --json`. Never run `try auth token --show` or print bot tokens unless the user explicitly requests the secret material and the environment can handle it safely.
3. Resolve context with `try repo context --json` inside a checkout. Outside a checkout, pass `-R OWNER/NAME` to commands that support it or pass `OWNER/NAME` positionally to `try repo view`, `clone`, and similar repository commands.
4. Inspect the current state with a read command. Prefer `--json` for agent reasoning and automation.
5. Before a write, run `try <group> <command> --help`, validate identifiers and the intended scope, then execute only the requested mutation.
6. Re-read the affected resource. Return a web URL with `try browse repo|pr|issue` when it helps the user continue.

## Route the task

- Repositories and daily context: use `try status` and `try repo`.
- Pull requests and reviews: use `try pr`.
- Issue triage: use `try issue`.
- Dependent branches and pull requests: use `try stack`.
- CI status and logs: use `try ci`.
- Repository or organization configuration: use `try actions` or `try org`.
- Accounts and operations: use `try profile`, `try ssh-key`, `try automation`, or `try bot`.
- Resource links and uncovered public endpoints: use `try browse` or `try api`.
- Local AI and review helpers: use `try ai`, `try explain`, `try draft`, or `try diff`.

Read [references/command-catalog.md](references/command-catalog.md) for the complete command map and exact argument patterns. Read [references/workflows.md](references/workflows.md) when creating or publishing a repository, opening or reviewing a pull request, triaging issues, handling stacks, diagnosing CI, or changing secrets and settings.

## Safety and output rules

- Treat repository deletion, PR merging or closing, issue closing, label replacement, key deletion, automation toggles, token minting, and secret changes as consequential operations. Show the exact target and inspect current state first.
- Keep credentials out of command literals, logs, files, commit messages, and chat. Use pre-existing environment variables for secret values and unset temporary variables afterward.
- Prefer `--body-file` to complex inline PR, review, issue, or comment bodies.
- Use `--json` whenever available. Human output is intended for terminal reading and may change formatting.
- Do not guess unsupported flags. The installed CLI's `--help` output is the source of truth.
- Do not use `try api` when a first-class command exists. For raw calls, use only the public `/v1` API path needed for the task.

## Current CLI gotchas

- Repository inference depends on a recognizable git remote. Pass `-R OWNER/NAME` explicitly when inference is ambiguous.
- `try pr current --json` exits nonzero when the current branch has no open PR instead of returning JSON `null`. Use `try repo context --json` when absence is an expected state.
- `try pr review` requires exactly one of `--approve`, `--request-changes`, or `--comment`.
- `try issue label --set` replaces the complete label set; `--add` and `--remove` preserve unrelated labels.
- `try stack submit` pushes the current branch to `origin` before creating the pull request.
- On CLI version 1.0.0, `try ci logs --follow` and `try ci watch` return the current log payload rather than continuously polling. Re-run a read command when fresh state is required.
- List filters such as PR author and issue labels may be applied to the returned page. Increase the page size or paginate before concluding that no matching item exists.
