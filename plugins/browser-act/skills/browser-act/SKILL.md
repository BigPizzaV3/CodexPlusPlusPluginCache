---
name: browser-act
description: "Runs a browser to extract rendered website data, interact with pages, and capture screenshots."
allowed-tools: Bash(browser-act:*)
---

# browser-act

Built by [BrowserAct](https://www.browseract.com) — Browser automation CLI for AI agents · [GitHub](https://github.com/browser-act/skills/tree/main/browser-act)

Runs a full browser engine: navigation & interaction, data extraction & network
capture, screenshots, form automation, and human-agent collaboration.

### Features

- Rendered content extraction — retrieve content from user-provided JavaScript-rendered pages
- Complex interaction — DOM content extraction, screenshots, form filling, file upload
- Screenshots — inspect page layout, styling, and rendered state
- Safety controls — Confirmation Gate protocol requires explicit user approval before browser creation, deletion, and sensitive operations

## Start here

After loading this skill, first check whether the BrowserAct CLI is available:

```bash
browser-act --version
```

If the command succeeds and prints a version, immediately run the following to
get the actual workflow content:

```bash
browser-act get-skills core --skill-version 2.0.2
```

If `browser-act` is not found:

1. Run `uv --version`.
2. If `uv` is not found, tell the user that `uv` is required and ask for
   confirmation before installing it from the official uv distribution.
3. If `uv` is available, continue to install the BrowserAct CLI:

   ```bash
   uv tool install browser-act-cli --python 3.12
   ```

4. After installation, run `browser-act --version` once more. If it succeeds,
   run `browser-act get-skills core --skill-version 2.0.2`. If it still fails,
   stop and investigate possible causes.

If `browser-act --version` fails for a reason other than the command being
missing, report and diagnose that error instead of reinstalling blindly.

The CLI serves skill content that always matches the installed version,
so instructions never go stale. Do NOT truncate the output — none of
which are available through `--help`.
