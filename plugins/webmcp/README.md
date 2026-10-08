# WebMCP plugin

Agent skill for making websites **WebMCP-compatible**: ping-pong which paths to expose, then ship **Declarative vs Imperative vs Bridge**.

Surface support today: [Codex](http://learn.chatgpt.com/docs/webmcp), Chrome 149 and Edge 150 origin trials, experimental Brave Leo; Firefox and Safari are still positions-only ([implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)).

The repo is packaged as a **plugin** for Claude Code, Codex, and as a [skills.sh](https://skills.sh) skill.

## Install

### Cursor / skills.sh

```bash
npx skills add alpic-ai/webmcp --skill webmcp
```

### Claude Code

```bash
claude plugin marketplace add alpic-ai/webmcp
claude plugin install webmcp@webmcp
```

Validate before submitting:

```bash
claude plugin validate .
```

### Codex

Add this repo as a marketplace source, then install **WebMCP** from the Plugins Directory.

```bash
codex plugin marketplace add alpic-ai/webmcp
```

## What’s inside

```
skills/webmcp/
├── SKILL.md                         # Ping-pong + Declarative vs Imperative vs Bridge
└── references/
    ├── strategies.md                # Declarative vs Imperative vs Bridge
    ├── declarative-forms.md         # toolname / tooldescription on existing forms
    ├── tool-design.md               # Dedicated imperative paths
    ├── runtime.md                   # Native vs polyfill, iframes
    ├── frameworks.md                # Vanilla, React/usewebmcp, Next, Vue
    ├── proxy-existing-mcp.md        # webmcp-proxy for existing MCP servers
    ├── verify.md                    # Chrome DevTools MCP dogfood
    └── security.md                  # Session inheritance, injection
```

## Why this exists

1. **Spec-aligned** — `document.modelContext` first, navigator fallback
2. **Path-first** — agent ping-pongs strategies and paths before coding
3. **Three strategies** — Declarative vs Imperative vs Bridge (`webmcp-proxy`)
4. **Verification-first** — Chrome DevTools MCP `list_webmcp_tools` / `execute_webmcp_tool`

## Example prompts after install

- “Make this site WebMCP compatible — help me choose what to expose”
- “Annotate our existing forms as WebMCP tools”
- “Put our MCP server on the website with webmcp-proxy”
- “Expose checkout as one dedicated WebMCP tool from step 1”

## References

- [W3C WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [webmcp-proxy](https://www.npmjs.com/package/webmcp-proxy)
- [usewebmcp](https://www.npmjs.com/package/usewebmcp)

## License

MIT
