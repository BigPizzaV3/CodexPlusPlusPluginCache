# Review Routing

Load only references and skills relevant to observed application signals.

| Signal | Route | Minimum output |
|---|---|---|
| Unknown or undocumented routes, multiple clients, sparse coverage | `$tahr-map-attack-surface` | Canonical operation and identity inventory plus gaps |
| Login, reset, MFA, SSO, tokens, cookies, browser storage | `$tahr-test-authentication` | Lifecycle model, validated identity contexts, proof-gated candidates |
| IDs, roles, tenants, organizations, admin functions, GraphQL mutations | `$tahr-test-access-control` | Frozen operation/obligation inventory, actor-resource-action matrix, enforcement traces, five-gate decisions, and explicit coverage |
| Query building, rendering, commands, URLs, XML, files, uploads, DOM sinks | `$tahr-trace-dangerous-inputs` | Source-to-sink ledger and class-specific proofs |
| Pricing, billing, invitations, approvals, quotas, one-time actions, state machines | `$tahr-test-business-workflows` | Invariants, transition matrix, baseline/action/readback evidence |
| Secrets, crypto, CORS, headers, IaC, containers, cloud, dependencies | `$tahr-audit-secrets-config` | Exposure/config/reachability ledger and exact remediation target |
| LLM, RAG, embeddings, memory, model-rendered output, tools, MCP | `$tahr-test-ai-agents` | AI surface, concept-family attempts, repeated boundary proof |
| APK/AAB, Android manifest, deep links, IPC, WebView | `$tahr-audit-android` | Static candidates, runtime reachability, MASVS-oriented coverage |
| Full-system threat model of an existing application | `$tahr-threat-model-app` | Assets, boundaries, connected attack paths, decisions, validated coverage, executable test handoffs |
| Patched accepted finding | `$tahr-verify-security-fix` | Equivalent-context verdict, regression and adjacent-bypass checks |

## Review ordering

For a comprehensive application review, use this order:

1. Map surface and identities.
2. Establish threat boundaries and business invariants.
3. Review authentication and authorization.
4. Trace dangerous inputs and stateful workflows.
5. Review secrets, configuration, dependencies, and deployment.
6. Run applicable platform-specific lanes.
7. Challenge findings, close gaps, and chain only proven primitives.

Run lanes in parallel only after they share the same canonical surface, identity labels, and evidence contract.
