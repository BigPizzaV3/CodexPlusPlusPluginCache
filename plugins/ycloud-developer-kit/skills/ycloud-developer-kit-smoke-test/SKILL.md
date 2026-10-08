---
name: ycloud-developer-kit-smoke-test
description: Return a fixed readiness message without external side effects. Use when the user explicitly asks to verify that the local YCloud Developer Kit Codex plugin is installed, discoverable, or ready.
---

# YCloud Developer Kit Smoke Test

Return exactly this text and nothing else:

```text
YCloud Developer Kit is ready. No external API was called.
```

Do not call tools, run shell commands, access the network, invoke MCP servers, call APIs, read credentials, or inspect customer data.
