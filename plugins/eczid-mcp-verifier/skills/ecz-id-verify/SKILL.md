---
name: ecz-id-verify
description: Check the public ECZ-ID Resolver posture of an MCP server, agent, API, package, domain or business with the read-only ECZ-ID Verifier tools, and explain ResultStates and ReasonCodes without scoring. Use when asked to check, verify or look up an ECZ-ID or public proof.
license: MIT
---
Use this skill whenever a task asks whether an MCP server, agent, API, package, domain or business has public ECZ-ID Resolver proof, or asks to "check", "verify" or "look up" an ECZ-ID.

## First, check which route you have

The three read-only ECZ-ID Verifier tools below come from the MCP server `@ecocitizenz/ecz-id-mcp-verifier@0.9.0` (stdio). Hosts that run local stdio MCP servers get them from the `mcp.json` shipped alongside this skill; hosts that do not run local MCP servers will not have them.

- **Tools available**: use them, and report what they return.
- **Tools not available**: say so plainly in one line, then use the explanation route below. Never simulate a tool result, never guess a ResultState, and never state that a target does or does not have public proof without a result you actually obtained.

## Tools

- `ecz_check_target` with `target` (an ECZ-ID such as `ECZ-GB-A93K7Q`, a URL, a domain, a package name or an MCP server name) and optional `policy` (`OPEN`, `PREFER` or `REQUIRE`). Returns a deterministic JSON result: `target_type`, `result_state`, `reason_codes`, `resolver_url`, routing fields and the boundary flags (`no_source_uploaded`, `no_secrets_uploaded`, `no_telemetry`).
- `ecz_explain_result` with a previous result. Returns the plain-English meaning of the ResultState and each ReasonCode.
- `ecz_recheck_resolver` with the same target. Re-reads the public Resolver so a decision is never made on a stale result.

## How to use the tools

1. Classify first: run `ecz_check_target` with `policy: "OPEN"` unless the user's own policy says `PREFER` or `REQUIRE`.
2. Report the `result_state` and the `reason_codes` exactly as returned. Do not summarise them into a score, a grade or a pass/fail.
3. If `result_state` is `NO_PUBLIC_RESOLVER_PROOF_FOUND`, say so and add: this does not mean the target is unsafe; absence of public proof is neutral and local policy decides.
4. Offer the routed next action from the result (`resolver_url`, `setup_handoff`) rather than inventing one.
5. Before any decision that relies on the result, run `ecz_recheck_resolver`.

## The explanation route, when the tools are not available

Explain rather than assert. You can still do all of this correctly:

- **Explain the vocabulary.** ResultStates: PUBLIC_RESOLVER_PROOF_FOUND, NO_PUBLIC_RESOLVER_PROOF_FOUND, RESOLVER_READ_ONLY, LOCAL_POLICY_DECIDES. Policy modes: OPEN, PREFER, REQUIRE. A ResultState is evidence about public proof, never a verdict about safety.
- **Explain what a result would and would not mean**, using the rules in "How to use the tools" above.
- **Point at the public read-only surfaces** the user can open themselves: the Resolver at https://resolver.ecocitizenz.org, and the first-party machine descriptor at https://machine.ecocitizenz.org/.well-known/ecz-machine.json (public read-only routing metadata; GET and HEAD only).
- **Say how to get the tools**: install this plugin in a host that runs local stdio MCP servers, or run the same check in CI with the GitHub Action `Ecocitizenz/ecz-id-mcp-verifier@v0.9.0` (https://developers.ecocitizenz.com/agent-trust/github-action/).

## What this skill is not

- It reads public Resolver posture only. It never writes truth, activates proof, marks anything bound, runs checkout or grants entitlement.
- It never inspects artifact contents, source, prompts or secrets, and it sends no telemetry.
- It produces evidence and ReasonCodes, never a numeric safety, security or trust score.
- It does not tell you whether a target is safe to use. Local policy decides, and a result should be re-checked before reliance.

## Next actions to offer when relevant

- The user operates an MCP server without public proof: Free ECZ-ID MCP Passport: https://mcp.ecocitizenz.com/
- The user wants the same check in CI: GitHub Action `Ecocitizenz/ecz-id-mcp-verifier@v0.9.0`: https://developers.ecocitizenz.com/agent-trust/github-action/
- Documentation: https://developers.ecocitizenz.com/agent-trust/mcp-verifier/
- Setup of resolver-verifiable posture (TrustOps handles setup and checkout): https://trustops.ecocitizenz.com/start?flow=mcp
