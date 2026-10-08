# Task ETA Tracker for Codex

`task-eta-tracker` is a skills-only Codex plugin for estimating and tracking honest completion-time ranges on long-running or uncertain tasks. It uses observable milestones, elapsed time, required verification, blockers, and confidence instead of presenting a fragile single-number deadline.

## What it does

- Defines the task's observable done condition and mandatory gates before forecasting.
- Breaks remaining work into three to seven outcome-based milestones.
- Reports optimistic-to-pessimistic ranges with a likely center and confidence level.
- Separates active work, tool execution, verification, and external waiting.
- Reforecasts when evidence changes, work grows materially, or the prior range becomes implausible.
- Keeps acceptance criteria, tests, safety checks, and recovery paths intact even when the estimate slips.

## Install for local testing

From this repository checkout:

```bash
codex plugin marketplace add /absolute/path/to/task-eta-tracker
codex plugin add task-eta-tracker@task-eta-tracker-local
```

Start a fresh Codex task after installation so the skill list reloads.

The skill can also be installed directly from:

```text
https://github.com/timyeou1234/task-eta-tracker/tree/main/skills/task-eta-tracker
```

The local marketplace is for development and does not indicate acceptance in the public Plugins Directory.

## Use

Invoke it directly:

```text
Use $task-eta-tracker to estimate and track this task with milestone-based ETA ranges.
```

It may also trigger when a user asks for remaining time, an updated forecast, periodic progress, or an explanation for a task taking longer than expected. It intentionally stays out of quick single-step work.

## Privacy

This plugin contains only static instructions. It has no MCP server, hosted service, account, analytics, hooks, or developer-controlled data collection. See [PRIVACY.md](PRIVACY.md).

## Release automation

The release workflow validates the package, creates a versioned ZIP and checksum, and can create a GitHub Release for a matching `v*` tag. OpenAI review and publishing remain user-controlled steps in the OpenAI Platform submission portal.

## License

MIT. See [LICENSE](LICENSE).
