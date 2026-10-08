# Anarlog agent plugin

Query Anarlog meetings with a local-first skill and an optional Cloud MCP connection. On your computer, the skill prefers the local CLI or local MCP, including unsynced changes. Remote agents use OAuth-connected Cloud snapshots. Read notes, summaries, participants, action items, bounded transcript excerpts, recurring history, and complete exports when explicitly needed.

## Local access

Install the [Anarlog CLI](https://docs.anarlog.so/installation) and open the desktop app once to create its database. Use `anarlog-cli` instead of `anarlog` for every command on Flatpak. Run `anarlog --json doctor`, then `anarlog --json meetings --source local list`. Local reads need no Cloud login, Pro subscription, or completed sync. The app can be closed after its database exists.

## Optional Cloud access

1. Sign in with Pro access through a personal plan or an eligible paid Team membership in the desktop app.
2. Open **Settings → Developers → Cloud API & Connectors**, review the disclosure, and enable it.
3. Wait for your meeting snapshots to upload.

Use the host's connection control to sign in and approve OAuth. Some MCP hosts prompt on first cloud tool use. The host discovers Anarlog's authorization server from `https://api.anarlog.so/mcp`; no cloud API key is required.

The CLI can also read hosted snapshots with `anarlog meetings --source cloud ...` after login. `--source auto` prefers the local database and uses Cloud only when it is absent; it does not check freshness or hide database errors.

The repository package is named **Anarlog**. Its optional hosted connection appears as **Anarlog Cloud**.

## Install from this repository

### Claude Code

```bash
claude plugin marketplace add fastrepl/anarlog
claude plugin install anarlog@fastrepl
```

Or add the remote server directly. Claude discovers OAuth from the MCP endpoint:

```bash
claude mcp add --transport http anarlog https://api.anarlog.so/mcp
```

### GitHub Copilot CLI

```bash
copilot plugin marketplace add fastrepl/anarlog
copilot plugin install anarlog@fastrepl
```

### ChatGPT and Codex

```bash
codex plugin marketplace add fastrepl/anarlog \
  --sparse .agents/plugins \
  --sparse agent-plugins/anarlog
```

Restart the ChatGPT desktop app, open the Plugins Directory, select the Fastrepl source, and install **Anarlog**.

The plugin includes an optional **Anarlog Cloud** App connection. Connect it for hosted access; leave it disconnected to use the local CLI. The public directory listing has its own review and release process, separate from this repository marketplace.

### Cursor

Import `https://github.com/fastrepl/anarlog` as a team marketplace, then install **Anarlog**. You can also load `agent-plugins/anarlog` as a local plugin while testing.

## Configure MCP directly

Clients that do not install plugins can add the hosted server:

```json
{
  "mcpServers": {
    "anarlog": {
      "url": "https://api.anarlog.so/mcp"
    }
  }
}
```

For a fully local agent that should not use Cloud, start `anarlog mcp` yourself. See [MCP for agents](https://docs.anarlog.so/agents/mcp). Static remote clients that cannot complete MCP OAuth can follow the [remote MCP setup](https://docs.anarlog.so/reference/api-cloud#remote-mcp) with a cloud API key.

## Data access

Cloud MCP is read-only hosted snapshots. Local CLI and optional local MCP read the app database through Anarlog's compatibility layer. Cloud access uploads a separate server-readable copy only after the user opts in. Encrypted Cloud Sync and connector uploads have independent freshness; neither database availability nor a meeting's `updated_at` proves that all copies are current. See [Data, privacy, and retention](https://docs.anarlog.so/data-and-privacy).
