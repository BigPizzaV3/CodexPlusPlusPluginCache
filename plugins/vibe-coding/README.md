# Vibe Coding

46 skills and 241 engineering workflows for Codex and Claude Code: repository mapping, planning, review, debugging, implementation and verification.

[Website and catalog](https://arty-kk.github.io/vibe-coding) · [Repository](https://github.com/arty-kk/vibe-coding) · [Support](https://github.com/arty-kk/vibe-coding/issues)

## Install

```sh
codex plugin marketplace add arty-kk/vibe-coding
```

Select the Vibe Coding marketplace in the desktop Plugins Directory, install Vibe Coding, and start a new task.

For Claude Code:

```sh
claude plugin marketplace add arty-kk/vibe-coding
claude plugin install vibe-coding@vibe-coding
```

Start a new session and use `/vibe-coding:vibe`. The same skill names work with the `/vibe-coding:` prefix.

## Use

Ask: `Use Vibe Coding. Map this repository and explain its main contracts.`

Choose `$vibe-review` for a patch, `$vibe-probe` for one bug, `$vibe-task` for a task brief, or a domain skill from the [skill catalog](references/catalog.md).

[Browse recipes](CATALOG.html) · [Workflow](references/workflow.md) · [Installation](docs/INSTALL.md) · [Maintenance](docs/MAINTENANCE.md)

## Local tools

Python 3.10+ (validation/packaging use pinned PyYAML):

```sh
python3 -m pip install -r requirements.txt
python3 scripts/catalog.py search webhook --mode check
python3 scripts/catalog.py show patch-checking
python3 scripts/validate.py
python3 scripts/package.py --output ../vibe-coding-1.3.0.zip
```

MIT License. No bundled MCP server, account connection or telemetry.
