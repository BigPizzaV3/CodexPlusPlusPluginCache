# Ship24 AI plugin

Official [Ship24](https://www.ship24.com) plugin for AI coding agents. It bundles eight skills, one review
agent and the hosted Ship24 Tracking MCP server so that Claude Code, Cursor, OpenAI Codex, GitHub Copilot,
Gemini CLI and any Agent Skills-compatible tool can integrate the
[Ship24 Tracking API](https://docs.ship24.com) correctly and track parcels across 2,500+ carriers.

Everything in the skills traces back to [docs.ship24.com](https://docs.ship24.com), the public OpenAPI spec or
the official [`ship24` Node SDK](https://github.com/ship24/ship24-node), plus a short list of facts verified in
Ship24's implementation (see [CONTRIBUTING](CONTRIBUTING.md)). Endpoint and schema tables are generated from
the spec and checked in CI, so they do not drift.

## What you get

### Skills

| Skill | Use it when |
| --- | --- |
| `ship24-integration` | Adding Ship24 to a codebase: detect the stack, pick per-shipment or per-call, webhooks or polling, implement, verify |
| `ship24-webhooks` | Building a webhook receiver: secret check, fast `2xx`, deduplication, ordering, retries, proof of delivery |
| `ship24-webhook-test` | Exercising a receiver end to end with a local zero-dependency receiver, sample trackers and webhook replay |
| `ship24-couriers` | Courier codes, auto-detection, required fields per courier, fetching and caching the courier list |
| `ship24-tracking-statuses` | Mapping `statusMilestone`, `statusCategory` and `statusCode` to business logic; sample tracking numbers |
| `ship24-troubleshooting` | Decoding HTTP statuses, error codes, rate limits, silent webhooks and MCP connection problems |
| `ship24-node-sdk` | Using the official `ship24` npm package instead of hand-written HTTP calls |
| `ship24-track` | Looking up a parcel right now through the MCP tools, with a `curl` fallback |

### Agent

`ship24-integration-reviewer` audits an existing integration read-only and reports findings with severity and
`file:line`: hardcoded keys, missing `trackerId` persistence, slow webhook handlers, missing deduplication,
ignored rate limits, deprecated fields.

### MCP server

The plugin connects to Ship24's hosted MCP server at `https://api.ship24.com/mcp` (Streamable HTTP). Tools are
registered according to the plan attached to your API key:

| Tool | Endpoint | Plan |
| --- | --- | --- |
| `search_tracking` | `POST /tracking/search` | per-call |
| `get_couriers` | `GET /couriers` | all |
| `track` | `POST /trackers/track` | per-shipment |
| `create_tracker` | `POST /trackers` | per-shipment |
| `bulk_create_trackers` | `POST /trackers/bulk` | per-shipment |
| `list_trackers` | `GET /trackers` | per-shipment |
| `get_tracker` | `GET /trackers/{trackerId}` | per-shipment |
| `update_tracker` | `PATCH /trackers/{trackerId}` | per-shipment |
| `get_tracking_results` | `GET /trackers/{trackerId}/results` | per-shipment |
| `search_tracking_by_number` | `GET /trackers/search/{trackingNumber}/results` | per-shipment |
| `resend_webhooks` | `POST /trackers/{trackerId}/webhook-events/resend` | per-shipment |
| `download_webhook_history` | `GET /trackers/{trackerId}/webhook-history/download` | per-shipment |

Calls made through the MCP server use your API key and count against your plan's quota exactly like direct
API calls.

## Your API key

Every host reads the same variable: `SHIP24_API_KEY`. Create a key in the
[Ship24 dashboard](https://dashboard.ship24.com/integrations/api-keys) (a free plan is available), preferably a
dedicated one for AI tools so it can be revoked on its own. The skills work without a key; the MCP tools list
without a key but every tool call answers `401` until one is set.

```bash
# macOS / Linux
export SHIP24_API_KEY=apik_your_key_here

# Windows PowerShell
$env:SHIP24_API_KEY = "apik_your_key_here"
```

## Install

### Claude Code

```text
/plugin marketplace add ship24/ship24-ai-plugin
/plugin install ship24@ship24
```

Export `SHIP24_API_KEY` in the shell that launches Claude Code. Skills appear as `/ship24:ship24-track`,
`/ship24:ship24-integration`, and so on; `/mcp` lists the `ship24-tracking` server. If you previously ran
`claude mcp add ... ship24-tracking ...` by hand, remove that entry (`claude mcp remove ship24-tracking`) to
avoid duplicate tools.

### Cursor

Install `ship24` from the Cursor plugin marketplace and set the `SHIP24_API_KEY` variable when Cursor asks for
it (later under Plugins → Configure). Skills, the agent and the MCP server are declared in
`.cursor-plugin/plugin.json`.

### OpenAI Codex

```bash
codex plugin marketplace add ship24/ship24-ai-plugin
codex plugin add ship24@ship24
```

Export `SHIP24_API_KEY` before starting Codex. Codex documents `bearer_token_env_var` as the way to authenticate
an HTTP MCP server; if the `ship24-tracking` tools answer `401`, add
`bearer_token_env_var = "SHIP24_API_KEY"` under `[mcp_servers.ship24-tracking]` in `~/.codex/config.toml`.

### GitHub Copilot and VS Code

The repository follows the Agent Plugins 1.0 layout (`plugin.json`, `skills/`, `mcp.json`). In VS Code run
**Chat: Install Plugin From Source** with the repository URL; with Copilot CLI run
`copilot plugin install ship24/ship24-ai-plugin`. The portable format has no secret mechanism for HTTP headers,
so the bundled `ship24-tracking` server lists its tools but every call answers `401`; to use the tools there,
add the server to your own MCP configuration with the header `Authorization: Bearer <your key>`.

### Gemini CLI

```bash
gemini extensions install https://github.com/ship24/ship24-ai-plugin
```

The install prompts for the Ship24 API key setting and stores it for the `ship24-tracking` MCP server.

### Any tool that supports Agent Skills

```bash
npx skills add ship24/ship24-ai-plugin
```

Installs the eight skills only (no MCP server). Add the MCP server to your tool with the URL
`https://api.ship24.com/mcp` and the header `Authorization: Bearer <your key>`; see
[docs.ship24.com/integrate-with-ai](https://docs.ship24.com/integrate-with-ai).

## Try it

- "Track SHIP24_SAMPLE_DELIVERED_000 with Ship24 and summarize the delivery timeline."
- "Add Ship24 shipment tracking with webhooks to this project."
- "Which Ship24 courier code should I use for USPS, and does it need a postcode?"
- "Audit this repository's Ship24 integration."

`SHIP24_SAMPLE_<MILESTONE>_000` tracking numbers return fixed results for each status; see the
`ship24-tracking-statuses` skill.

## Security

See [SECURITY.md](SECURITY.md). Nothing in this repository calls the network: the host tool sends your key to
`https://api.ship24.com/mcp` and nowhere else. The webhook test receiver only listens locally.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and suggestions through GitHub issues are welcome.

## License

[MIT](LICENSE)
