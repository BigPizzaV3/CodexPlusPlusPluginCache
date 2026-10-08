# Surfer Skills

Skills for using [Surfer](https://surferseo.com) in your AI assistant: write and optimize articles, create outlines and briefs, manage templates, and act on content recommendations. Connect through [Surfer MCP](https://devs.surferseo.com/mcp/overview).

This repository is where the playbooks are maintained. The Surfer MCP server serves the same skills to every connected assistant, so a change merged here reaches the server as well. Install from here when your client does not read server-shipped skills, or when you want a pinned local copy.

## Requirements

- A Surfer account on a plan that includes MCP: Pro, Peace of Mind, Enterprise, or AI Search Analytics. The MCP tab in the app shows whether yours does.
- Creating a Content Editor, opening a recommendation, generating an AI article, and running Auto-Optimize consume Surfer credits. Reading data does not. See [credits and limits](https://devs.surferseo.com/mcp/credits-and-limits).
- For the install command below, Node.js 22.20 or newer.

## Install

For ChatGPT and Codex plugins, download the versioned ZIP from the
[latest release](https://github.com/surferseo/skills/releases/latest).
It bundles the same `skills/` directory and the Surfer MCP connection in
`mcp.json`.

Use the [skills CLI](https://skills.sh) in your project:

```bash
# All skills, including connection setup
npx skills add surferseo/skills --skill '*' -y

# One workflow, when Surfer is already connected
npx skills add surferseo/skills --skill surfer-create-outline -y

# Later, pull the latest playbooks
npx skills update
```

Add `-a codex` or `-a claude-code` to install for one assistant only. Without the CLI, copy a `skills/<name>` folder into `.claude/skills/` for Claude Code or `.agents/skills/` for Codex.

## Connect

Ask your assistant to use [`surfer-connect`](skills/surfer-connect/SKILL.md) for account setup, client-specific instructions, and connection problems. If you installed only a workflow, add `surfer-connect` when you need setup help. The [Surfer MCP security page](https://devs.surferseo.com/mcp/security) explains what a connected assistant can read, change, and delete.

## Skills

| Skill | Use it to |
|---|---|
| `surfer-write-article` | Generate an article from a keyword or topic |
| `surfer-optimize-content` | Improve existing content for SEO, AI Search, or both |
| `surfer-create-outline` | Create a SERP-informed outline |
| `surfer-create-content-brief` | Prepare a writer-ready content brief |
| `surfer-manage-content-templates` | Manage reusable content templates |
| `surfer-content-recommendations` | Act on site recommendations |
| `surfer-connect` | Set up and verify your connection |

Try: “Create a Surfer outline for best trail running shoes. Stop after the outline.”

For account help, visit the [Surfer help center](https://docs.surferseo.com/). MIT licensed; see [LICENSE](LICENSE).
