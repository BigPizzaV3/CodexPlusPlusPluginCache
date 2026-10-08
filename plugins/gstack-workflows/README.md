# gstack Workflows for ChatGPT + Codex

Installable skills-first adaptation of the gstack software delivery workflows for ChatGPT and Codex.

- 57 packaged Skills, including the router and host-capability helpers
- ChatGPT + Codex metadata in `agents/openai.yaml`
- No mandatory MCP server
- No hidden telemetry or credential collection
- Optional native gstack bridge for compatible Codex hosts
- Local marketplace included in the marketplace ZIP

## Install from the marketplace bundle

Unzip `gstack-chatgpt-codex-marketplace.zip`, then add its directory as a local marketplace.

```bash
codex plugin marketplace add /absolute/path/to/gstack-chatgpt-codex-marketplace
```

In ChatGPT desktop Work/Codex mode, repo marketplaces are read from `.agents/plugins/marketplace.json`. Restart the desktop app after adding or updating the marketplace.

## Plugin-only package

`gstack-workflows-plugin.zip` contains the plugin root directly, with `.codex-plugin/plugin.json` at the ZIP root. It is suitable for uploader/preflight workflows that expect a standalone plugin package.

## Public-directory status

This package is locally installable, but it is not claimed as public-directory submission-ready. Public submission still requires the verified publisher identity and any current directory/reviewer metadata required by OpenAI.

## Upstream

Adapted from `garrytan/gstack` 1.68.3 at commit `85fd9db554ae4aaaa6d356d2daf873121ee85bdd` under the MIT license. See `THIRD_PARTY_NOTICES.md`.
