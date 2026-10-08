---
name: using-shopify-app-builder
description: "Use at the start of any Shopify app engineering, debugging, review, launch, listing, or growth task. Routes the request to the smallest relevant Shopify App Builder skills and enforces credential, verification, deployment, publication, and paid-spend boundaries. Triggers include: 'Shopify app', 'Shopify extension', 'Shopify API', 'App Bridge', 'Polaris', 'Built for Shopify', 'App Store listing', and 'Shopify app ads'."
---

# Using Shopify App Builder

Treat this skill as the router for the toolkit. Select focused skills before proposing code or operational changes.

## Routing workflow

1. Inspect the repository, framework, Shopify configuration, and the user's stated outcome.
2. Classify the request with the routing table below.
3. Read the selected skill files completely. Use the smallest set that covers the request.
4. Verify time-sensitive platform behavior against current official Shopify documentation.
5. Implement only what the user authorized, then run proportionate checks on the real affected surface.

## Skill routing table

| Request | Start with | Add when needed |
| --- | --- | --- |
| New app, scaffold, extension, or deployment plan | `shopify-cli` | `app-validation`, `app-niche-finder`, `app-auth`, `app-billing` |
| Admin data or GraphQL error | `admin-graphql` | `metafields-metaobjects`, `webhooks`, `dev-troubleshooting` |
| Legacy REST migration | `admin-rest` | `admin-graphql`, `migrate-rest-to-graphql` command in Claude/Cursor |
| OAuth, token exchange, HMAC, or session issue | `app-auth` | `dev-troubleshooting`, `webhooks` |
| Billing, plans, trials, or usage charges | `app-billing` | `app-pricing-strategy`, `merchant-pain-prevention` |
| Embedded admin UI | `app-bridge` and `polaris-ui` | `ux-polaris-antipatterns`, `app-accessibility`, `app-performance` |
| Storefront or theme work | `storefront-api`, `hydrogen-storefront`, or `liquid-themes` | `metafields-metaobjects` |
| Checkout or backend customization | `shopify-functions` | `admin-graphql`, `dev-troubleshooting` |
| Webhook delivery or signature verification | `webhooks` | `app-auth`, `dev-troubleshooting` |
| Pre-ship or App Store review | `built-for-shopify-standards` | `merchant-pain-prevention`, `app-accessibility`, `app-performance`, UX skills |
| Listing, name, price, or market validation | `app-listing-optimization`, `app-naming`, `app-pricing-strategy`, or `app-validation` | `app-niche-finder` |
| App Store advertising | `shopify-app-store-ads` | `app-listing-optimization`, `app-pricing-strategy` |
| Shopify MCP or agentic commerce | `shopify-mcp` | Relevant API and authentication skills |

## Operating guidelines

- Inspect first. Do not assume the app template, API version, package version, scopes, or deployment provider.
- Use official Shopify documentation as the authority for unstable platform facts.
- Keep OAuth scopes minimal and explain every requested write scope.
- Treat GraphQL HTTP success separately from GraphQL `errors`, mutation `userErrors`, and throttle metadata.
- Verify webhooks with the raw request body and constant-time HMAC comparison.
- Never expose, echo, commit, or publish tokens, app secrets, session data, `.env` contents, or personal filesystem paths.
- Do not deploy, publish, submit, alter billing, or enable paid advertising unless the user explicitly authorizes that action.
- Preserve unrelated work in dirty repositories and avoid destructive cleanup.
- Report live evidence for deployments and dashboard changes; source edits or a passing build alone are not proof of live success.

## Harness behavior

- Claude Code can use the bundled slash commands and specialist agents in addition to skills.
- Codex and OpenCode should invoke focused skills by name or natural-language intent; Claude-specific agents are optional reference material, not native subagents.
- Cursor can load the native plugin surfaces or the portable skills collection.
- Gemini CLI receives this routing policy through `GEMINI.md` and reads focused `SKILL.md` files as needed.
- Command Code and other Agent Skills-compatible harnesses use the portable skills collection.

## Completion gate

Before reporting success, state what changed, which checks ran, what live surface was verified, and what remains unverified. Never convert an inference into a completion claim.
