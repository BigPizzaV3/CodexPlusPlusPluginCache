# Shopify App Builder: Shopify App Development Plugin for AI Coding Agents

[![npm](https://img.shields.io/npm/v/shopify-app-builder)](https://www.npmjs.com/package/shopify-app-builder)
[![license](https://img.shields.io/badge/license-MIT-0b6e4f)](LICENSE)
[![Shopify](https://img.shields.io/badge/Shopify-app%20development-004c3f)](https://shopify.dev/docs/apps)

Shopify App Builder is a production-focused, open-source Shopify app development plugin for AI coding agents. It helps agents build, debug, audit, launch, and grow Shopify apps with 32 focused Agent Skills, 9 workflow commands, 5 specialist agents, native plugin manifests, and deterministic release validation.

It has native package surfaces for Claude Code, OpenAI Codex, Cursor, and Gemini CLI, plus portable installation for OpenCode, Command Code, Windsurf, Cline, Roo Code, Kilo Code, Continue, and other tools that support the `SKILL.md` Agent Skills format.

> This community project is not affiliated with, endorsed by, or sponsored by Shopify. Shopify and related marks belong to Shopify Inc.

## Install

### Claude Code

```text
/plugin marketplace add khadinakbarlabs/shopify-app-builder
/plugin install shopify-app-builder@shopify-app-builder
```

Claude Code discovers the plugin's skills, commands, and specialist agents.

### Codex

```bash
codex plugin marketplace add khadinakbarlabs/shopify-app-builder
codex plugin add shopify-app-builder@shopify-app-builder
```

If the installed Codex build does not support plugin marketplaces, use the portable Agent Skills command below with `--agent codex`.

### Cursor, OpenCode, Command Code, and other coding agents

The open Agent Skills installer supports a broad and evolving set of harness profiles:

```bash
npx skills add khadinakbarlabs/shopify-app-builder --list
npx skills add khadinakbarlabs/shopify-app-builder --skill '*' --agent codex --copy --yes
```

Replace `codex` with `claude-code`, `cursor`, `opencode`, `command-code`, or another profile supported by your installed `skills` CLI. Use `--agent '*'` only when you intentionally want every detected agent configured.

### Gemini CLI

```bash
gemini extensions install https://github.com/khadinakbarlabs/shopify-app-builder
```

### npm

```bash
npx shopify-app-builder install --agent codex --global
npx shopify-app-builder install --agent cursor --global
npx shopify-app-builder install --agent gemini-cli --global
npx shopify-app-builder install --all --dry-run
```

The npm installer copies only bundled skill directories. It has no runtime dependencies, no network calls, no telemetry, and no install or postinstall hook. Existing skills are skipped unless `--force` is explicitly supplied.

### Clone or download

```bash
git clone https://github.com/khadinakbarlabs/shopify-app-builder.git
cd shopify-app-builder
npm test
npm run validate
```

## What is included

### Shopify engineering

- Admin GraphQL and legacy REST migration
- Shopify CLI, app configuration, and extensions
- App Bridge, Polaris, and embedded-app patterns
- OAuth, token exchange, managed install, session storage, and HMAC verification
- Billing, webhooks, Functions, Storefront API, Hydrogen, Liquid, metafields, metaobjects, B2B, and Markets
- Development troubleshooting and schema-ID validation

### Product quality

- Accessibility and WCAG-oriented reviews
- Performance budgets and Built for Shopify readiness
- Onboarding, empty/loading/error states, and merchant-pain prevention
- Polaris anti-patterns and modern embedded-app UX

### Launch and growth

- App idea validation and niche research
- Naming, pricing, listing optimization, and App Store SEO
- Shopify App Store advertising with explicit spend approval gates

Browse the complete catalog in [`skills/`](skills/).

The `using-shopify-app-builder` routing skill selects the smallest relevant skill set for each request and applies credential, verification, deployment, publication, and paid-spend boundaries.

## Example prompts

- “Build a Shopify app that lets merchants A/B test product titles.”
- “Audit this embedded app for Built for Shopify blockers.”
- “Debug this GraphQL 200 response with throttle errors.”
- “Add and verify an `orders/paid` webhook.”
- “Review this App Store listing for keyword relevance and conversion.”

## Safety and credential handling

- The package contains no credentials and does not request Shopify credentials during installation.
- Credential examples use placeholders and environment variables.
- The release check rejects private keys, common live-token formats, personal filesystem paths, and mismatched skill identifiers.
- Cache troubleshooting uses a recoverable backup script instead of `rm -rf`.
- Deployment, paid advertising, publication, and other consequential actions still require the user's explicit instruction in the active agent session.

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), and [the release audit](docs/release-audit.md).

## Compatibility

The portable skills use standard YAML frontmatter with a lowercase hyphenated `name` matching the skill directory. Harness-specific commands and specialist agents remain under `commands/` and `agents/` for Claude Code, while every supported harness can load the `skills/` collection.

See [the compatibility matrix](docs/compatibility.md) for exact installation surfaces and limitations.

## Agent-specific use cases and guidelines

Each guide explains the best use cases, invocation style, operating boundaries, examples, and verification procedure for that harness:

- [Claude Code](docs/agents/claude-code.md)
- [Codex](docs/agents/codex.md)
- [Cursor](docs/agents/cursor.md)
- [OpenCode](docs/agents/opencode.md)
- [Command Code](docs/agents/command-code.md)
- [Gemini CLI](docs/agents/gemini-cli.md)
- [Other Agent Skills-compatible coding agents](docs/agents/other-agents.md)

## Accuracy and versioned APIs

Shopify APIs, CLI behavior, App Bridge, Polaris, review criteria, and advertising surfaces change over time. Skills identify their reference versions where practical, but agents must verify time-sensitive claims against current official Shopify documentation before shipping production code or spending money.

## Contributing

Bug fixes, source corrections, new tests, and focused Shopify skills are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the security policy before opening a pull request.

## License

MIT. See [LICENSE](LICENSE).
