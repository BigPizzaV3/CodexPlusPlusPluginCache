# Installation

Vibe Coding ships the same 46 skills and 241 recipes for Codex and Claude Code. The manifests and invocation syntax are host-specific; the engineering methods are shared.

## Codex

Install [Vibe Coding in the OpenAI Plugins Directory](https://chatgpt.com/plugins/plugins_6aae54a259ac8191b56161d366fb6e51), then start a new task.

To use the public GitHub marketplace instead:

```sh
codex plugin marketplace add arty-kk/vibe-coding
```

Open the desktop Plugins Directory, select the Vibe Coding source and install Vibe Coding. On hosts exposing `codex plugin add`, the identifier is `vibe-coding@vibe-coding`.

Invoke `$vibe` to choose a workflow, or a focused skill such as `$vibe-review`.

To refresh a GitHub marketplace:

```sh
codex plugin marketplace upgrade vibe-coding
```

Install the updated plugin through the desktop Plugins Directory and start a new task. A source pinned with `--ref v1.3.0` stays on that release; select a newer ref to advance it. Directory-managed installations follow the host's update behavior.

## Claude Code

Use a current Claude Code release with plugin support. Register this public marketplace, then install the plugin:

```sh
claude plugin marketplace add arty-kk/vibe-coding
claude plugin install vibe-coding@vibe-coding
```

Start a new session and invoke the entry skill:

```text
/vibe-coding:vibe Map this repository and explain its main contracts.
```

Focused skills use the same namespace:

```text
/vibe-coding:vibe-review Review this branch against main. Report actionable defects without editing code.
/vibe-coding:vibe-mcp Fix the selected MCP authorization defect and verify the affected contract.
```

To update this GitHub installation explicitly:

```sh
claude plugin marketplace update vibe-coding
claude plugin update vibe-coding@vibe-coding
```

The root `.claude-plugin/plugin.json` also exposes the same nested skills when a directory installs this repository directly. It does not duplicate the skills.

The repository's `.claude-plugin/marketplace.json` points to `./plugins/vibe-coding`. The plugin's `.claude-plugin/plugin.json` identifies its version; the `skills/` directory is discovered by Claude Code. The repository can be installed directly without waiting for community-directory review.

## Claude Cowork and cloud

Enable the plugin for the Claude account or workspace used by that surface, then select its skill in the plugin picker and provide access to the project files. Installing a marketplace with the local Claude Code CLI does not by itself enable the plugin in Cowork. Public directory availability depends on review.

The same text instructions apply in Cowork, with the [host integration](../references/hosts.md) adapting to its shared files, active workspace rules and available tools. Repository, terminal, browser and service checks require those capabilities in the current session; unavailable checks must be reported explicitly. No skill relies on dynamic shell injection, plugin hooks, a bundled MCP server or a fixed local cache path.

## Local checkout and packaged release

```sh
git clone https://github.com/arty-kk/vibe-coding.git
```

Codex can register the checkout with `codex plugin marketplace add ./vibe-coding`. Claude Code can use `claude plugin marketplace add ./vibe-coding`, or load just the plugin for a session with `claude --plugin-dir ./vibe-coding/plugins/vibe-coding`.

The release ZIP contains one `vibe-coding/` directory with Codex, Claude Code and portable manifests, all skills and references, and an offline catalog. Extract it first when a host expects a directory. Clone the repository when you need the complete marketplace source.

Open `CATALOG.html` locally, choose Codex or Claude Code in the workflow dialog, and copy a prompt in English, Spanish, Russian or Simplified Chinese. Technical instructions are in English. CLI catalog search supports the same host-specific prompts:

```sh
python3 scripts/catalog.py search webhook --host claude --lang es --json
```

## Repository rules and host capabilities

Codex follows applicable `AGENTS.md` instructions. Claude Code follows its active `CLAUDE.md`, `.claude/CLAUDE.md`, scoped rules and any `AGENTS.md` that the host or repository adopts. [Host integration](../references/hosts.md) explains invocation, reference paths, permission modes and unavailable tools. Installation never writes instruction files into the user's project, overrides host settings or adds background services.

This setup is for repository work in Codex and Claude Code. Other Claude surfaces depend on their plugin support and available filesystem/tools; a chat-only surface cannot execute repository checks without those capabilities.
