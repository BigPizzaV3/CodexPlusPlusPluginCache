# Trylle CLI command catalog

This catalog was verified against `trylle-cli 1.0.0`. Run `try <command path> --help` before relying on details that may have changed in a newer release.

## Contents

- [Conventions](#conventions)
- [Authentication and daily status](#authentication-and-daily-status)
- [Repositories](#repositories)
- [Pull requests](#pull-requests)
- [Issues](#issues)
- [Stacked pull requests](#stacked-pull-requests)
- [Organizations and actions configuration](#organizations-and-actions-configuration)
- [Profiles and SSH keys](#profiles-and-ssh-keys)
- [CI](#ci)
- [Automations and bots](#automations-and-bots)
- [URLs and raw API](#urls-and-raw-api)
- [Local AI and diff helpers](#local-ai-and-diff-helpers)

## Conventions

- Add `--json` for machine-readable output wherever the command exposes it.
- Use `-R OWNER/NAME` or `--repo OWNER/NAME` on repo-aware commands. Omit it only when the current git remote unambiguously identifies a Trylle repository.
- Pagination flags are `--page`, `--per-page`, `--limit`, and sometimes `--cursor`. Check leaf help because each endpoint supports a subset.
- Body-taking commands accept `--body TEXT` or `--body-file PATH`. Prefer a file for multiline Markdown.
- `try repo view`, `clone`, `fork`, `branches`, `edit`, and `delete` take `OWNER/NAME` positionally rather than through `-R`.

## Authentication and daily status

```text
try auth login [--api-key VALUE] [--api-endpoint URL] [--web-url URL] [--json]
try auth logout [--json]
try auth status [--json]
try auth token [--show] [--json]
try whoami [--json]
try status [--json]
try about
```

`try auth login` also reads `TRYLLE_API_KEY`, `TRYLLE_API_ENDPOINT`, and `TRYLLE_WEB_URL`. Avoid `try auth token --show`; the default token command masks the active credential.

`try status` combines the viewer, open PRs, open issues, and recent AI or automation runs. Individual sections may contain an error while the rest still succeeds.

## Repositories

```text
try repo list [--page N] [--per-page N] [--limit N] [--cursor VALUE] [--json]
try repo view [OWNER/NAME] [--json]
try repo create NAME [--owner OWNER] [--description TEXT] [--private|--public]
    [--auto-init] [--default-branch BRANCH] [--json]
try repo clone OWNER/NAME [DIRECTORY] [--depth N] [--json]
try repo fork [OWNER/NAME] [--json]
try repo branches [OWNER/NAME] [pagination flags] [--json]
try repo edit [OWNER/NAME] [--description TEXT] [--private BOOL]
    [--default-branch BRANCH] [--json]
try repo delete [OWNER/NAME] [--json]
try repo context [-R OWNER/NAME] [--json]
```

`try repo clone` obtains a clone URL from Trylle and then runs `git clone`. `try repo context` returns repository metadata, viewer data, the current branch, the current PR when found, and up to five recent CI jobs.

## Pull requests

```text
try pr list [-R OWNER/NAME] [--state STATE] [--author LOGIN]
    [pagination flags] [--json]
try pr view NUMBER [-R OWNER/NAME] [--comments] [--json]
try pr diff NUMBER [-R OWNER/NAME] [--json]
try pr current [-R OWNER/NAME] [--json]
try pr create [-R OWNER/NAME] --title TITLE --base BRANCH [--head BRANCH]
    [--body TEXT|--body-file PATH] [--draft]
    [--label NAME]... [--assignee LOGIN]... [--reviewer LOGIN]... [--json]
try pr checkout NUMBER [-R OWNER/NAME] [--json]
try pr comment NUMBER [-R OWNER/NAME] (--body TEXT|--body-file PATH) [--json]
try pr review NUMBER [-R OWNER/NAME]
    (--approve|--request-changes|--comment)
    [--body TEXT|--body-file PATH] [--json]
try pr status NUMBER [-R OWNER/NAME] [--json]
try pr merge NUMBER [-R OWNER/NAME] [--method METHOD] [--delete-branch] [--json]
try pr close NUMBER [-R OWNER/NAME] [--json]
try pr reopen NUMBER [-R OWNER/NAME] [--json]
```

The default PR list state is `open`; the default merge method is `squash`. `try pr diff` returns the structured review bundle. `try pr checkout` fetches the head branch from `origin` and checks it out locally. `try pr current --json` exits nonzero when no open PR matches the current branch; use `try repo context --json` when a missing PR is a normal outcome.

## Issues

```text
try issue list [-R OWNER/NAME] [--state STATE] [--label NAME]...
    [pagination flags] [--json]
try issue view NUMBER [-R OWNER/NAME] [--comments] [--json]
try issue create [-R OWNER/NAME] --title TITLE
    [--body TEXT|--body-file PATH] [--label NAME]... [--assignee LOGIN]... [--json]
try issue comment NUMBER [-R OWNER/NAME] (--body TEXT|--body-file PATH) [--json]
try issue label NUMBER [-R OWNER/NAME]
    [--add NAME]... [--remove NAME]... [--set NAME]... [--json]
try issue close NUMBER [-R OWNER/NAME] [--reason completed] [--json]
try issue reopen NUMBER [-R OWNER/NAME] [--json]
try issue timeline NUMBER [-R OWNER/NAME] [--json]
```

The default issue list state is `open`. Multiple `--label` filters require all named labels in the returned page. `--set` replaces all labels; otherwise the CLI reads the issue and applies `--add` and `--remove` to the existing set. The current public API records the closed state but not the `--reason` hint.

## Stacked pull requests

```text
try stack create BRANCH [--json]
try stack track [-R OWNER/NAME] [--pull NUMBER]
    (--parent NUMBER|--clear) [--json]
try stack log [-R OWNER/NAME] [--json]
try stack next [-R OWNER/NAME] [--json]
try stack prev [-R OWNER/NAME] [--json]
try stack restack [-R OWNER/NAME] [--json]
try stack sync [-R OWNER/NAME] [--pull NUMBER] [--parent NUMBER] [--json]
try stack submit [-R OWNER/NAME] [--draft] [--json]
```

`create` runs `git checkout -b`. Commands without `--pull` resolve the open PR for the current branch. `next` and `prev` check out adjacent stack branches. `restack` rebases on the stack parent or PR base. `submit` reuses an existing PR or pushes `HEAD` to `origin` and creates a PR using the latest commit subject.

## Organizations and actions configuration

```text
try org list [--json]
try org view ORG [--json]
try org members ORG [pagination flags] [--json]
try org secret ORG list|get NAME|set NAME VALUE|delete NAME [--json]
try org variable ORG list|get NAME|set NAME VALUE|delete NAME [--json]

try actions secret list|get NAME|set NAME VALUE|delete NAME
    [-R OWNER/NAME|--org ORG] [--json]
try actions variable list|get NAME|set NAME VALUE|delete NAME
    [-R OWNER/NAME|--org ORG] [--json]
```

The `try org secret|variable` commands and `try actions ... --org` commands address the same organization-scoped feature through different syntax. Never place literal secret values in recorded command text. Secret reads normally return metadata, not recoverable plaintext.

## Profiles and SSH keys

```text
try profile view LOGIN [--json]
try profile follow LOGIN [--json]
try ssh-key list [pagination flags] [--json]
try ssh-key add TITLE PUBLIC_KEY [--json]
try ssh-key delete ID [--json]
```

`profile follow` only enables following; there is no unfollow command in CLI 1.0.0.

## CI

```text
try ci list [-R OWNER/NAME] [--limit N|--per-page N] [--json]
try ci view RUN_ID [--json]
try ci logs RUN_ID [--follow] [--json]
try ci watch RUN_ID [--json]
try ci cancel RUN_ID [--json]
try ci usage [-R OWNER/NAME] [--json]
```

For non-JSON log output, the CLI prints `stdout` and `stderr` directly when those fields are present. On version 1.0.0, `logs --follow` and `watch` make the same current-log request; they do not continuously poll.

## Automations and bots

```text
try automation list [--account ACCOUNT] [--json]
try automation runs ID [--limit N] [--json]
try automation enable ID [--json]
try automation disable ID [--json]
try bot list [--json]
try bot token BOT_ID [--json]
```

Automation toggles first read the full automation and then write it back with the new enabled state. `try bot token` may mint and reveal secret material; do not run it as a harmless read.

## URLs and raw API

```text
try browse repo [-R OWNER/NAME]
try browse pr NUMBER [-R OWNER/NAME]
try browse issue NUMBER [-R OWNER/NAME]
try api PATH [-X get|post|put|patch|delete]
    [-q KEY=VALUE]... [-f KEY=VALUE]... [-F KEY=JSON]...
    [--input PATH|-] [--json]
```

`browse` prints the dashboard URL without opening a browser. `api` targets the configured public API. `-f` encodes string fields, `-F` parses raw JSON values, and `--input -` reads a complete JSON body from stdin.

## Local AI and diff helpers

```text
try ai [--config PATH] [--provider PROVIDER] [--api-key VALUE]
    [--model MODEL] [--thinking LEVEL] [--fast] [--reconfigure] [QUERY...]
try explain [REFERENCE] [--staged] [--query QUESTION] [--list]
try draft [--context TEXT]
try diff [REFERENCE] [--pr NUMBER_OR_URL] [--detect-pr]
    [--file PATH]... [--watch] [--theme NAME] [--stacked]
    [--focus PATH] [--origin OWNER/REPO] [--wrap]
```

These commands use local provider configuration rather than the Trylle public API. `try draft` reads staged changes. `try explain` defaults to the current diff. `try diff` is an interactive side-by-side viewer and can export annotations back to an agent through stdout.
