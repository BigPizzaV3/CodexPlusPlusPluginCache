---
name: atlassian-forge
description: Build, review, debug, and investigate Atlassian Forge apps and Jira/Confluence integrations, including Forge manifests, permissions, resolvers, REST calls, webhooks, storage, remote backends, and Rovo actions. Use when a request specifically involves Atlassian Forge or asks Jira/Rovo to interact with a Forge app.
---

# Atlassian Forge

Use this skill for Forge-specific implementation and support work. Keep the app's declared capabilities, user authorization, data residency, and deployment environment explicit.

## Scope and evidence

- Treat the repository, `manifest.yml`, Forge CLI output, app logs, Jira/Confluence responses, and Rovo context as separate evidence sources.
- Never invent a Forge module, permission scope, event payload, deployment status, site, issue, account ID, or Rovo result.
- Before changing code, identify the product (Jira, Confluence, or both), module/entry point, environment, expected behavior, observed behavior, and exact error or request ID.
- Separate observed facts, inferences, and unknowns. State when the Forge CLI, Atlassian site, or Rovo context is unavailable.
- Read-only investigation is the default. Treat deploy, install, upgrade, permission changes, data writes, and issue mutations as explicit mutations requiring user authorization in the current task.

## Implementation workflow

1. Inspect the existing app structure, `manifest.yml`, package scripts, runtime versions, and tests before proposing changes.
2. Choose the smallest Forge module and resolver shape that satisfies the request. Preserve existing module keys and public action names unless a breaking change is requested.
3. Derive permissions from the exact API operations and user/app execution identity. Request the narrowest scopes; do not add broad scopes “for convenience.”
4. Make authorization boundaries visible: distinguish `asUser` from `asApp`, verify project/space permissions, and avoid treating app access as proof of user access.
5. Validate inputs and outputs at resolver boundaries. Do not expose secrets, tokens, private issue data, internal errors, or unnecessary personal data to UI, logs, remote services, or Rovo.
6. For remote backends, document the endpoint, authentication mode, egress permissions, timeout/retry behavior, failure mode, and whether the design affects Runs on Atlassian eligibility.
7. Test locally where possible, then run the repository's lint/test checks and Forge validation available in the environment. Do not claim deployment or installation succeeded without command output proving it.
8. Report changed files, checks run, remaining limitations, and any required manual steps (consent, install, deploy, or site-specific configuration).

## Jira and Confluence API guidance

- Prefer the official Forge API clients and documented product REST APIs over hand-built authentication.
- Confirm the API version and required OAuth/Forge scopes from the specific operation documentation; do not infer scopes from a similar endpoint.
- Preserve and inspect HTTP status, response body, pagination, rate-limit headers, and Atlassian request identifiers.
- For webhooks/events, verify event type, payload version, delivery/retry semantics, idempotency, ordering assumptions, and whether the handler runs as a user or app.
- For issue or content mutations, use idempotency safeguards where possible and make partial failure/retry behavior explicit.

## Rovo interoperability

When the request mentions Jira Rovo, Rovo agents, or Rovo actions:

- Treat Rovo as a caller with its own product permissions and consent context. A Forge app does not automatically inherit access merely because Rovo can see a Jira issue.
- If exposing an action to Rovo, use the Forge Rovo action module and the least required Rovo/Atlassian scopes. Describe the action's inputs, side effects, failure responses, and data returned to the agent.
- Keep actions deterministic, bounded, and auditable. Prefer read-only actions for investigation; require explicit confirmation or a clearly stated mutation request for writes.
- Return concise, structured results with stable field names, source identifiers, timestamps, and an uncertainty or limitation field when relevant.
- Never claim that Jira Rovo can directly load a Codex `SKILL.md`. This skill is available to Codex through the plugin package; Rovo can use equivalent instructions only when an Atlassian/Rovo app or connector explicitly imports or exposes them.
- If Rovo access is requested but no Rovo-capable connector, Forge app, or Atlassian environment is available, provide the implementation contract and state the access limitation instead of pretending the integration is enabled.

## Debugging checklist

Check, in order:

- manifest syntax, module keys, handler/export names, and package/runtime compatibility;
- deployment environment versus installed environment;
- missing or changed scopes and whether consent/reinstallation is required;
- `asUser` versus `asApp` behavior and the caller's Jira/Confluence permissions;
- request URL, API version, payload shape, pagination, rate limits, and request IDs;
- resolver serialization, timeout, retry, duplicate delivery, and remote egress configuration;
- recent deployment, configuration, permission, or Atlassian platform changes.

For every suspected cause, record supporting evidence, contradicting evidence, and the next check that would distinguish it. If evidence is insufficient, say: **Insufficient evidence to determine the root cause.**

## Useful official references

Use current Atlassian documentation for exact schemas and scopes:

- [Forge manifest](https://developer.atlassian.com/platform/forge/manifest/)
- [Forge permissions](https://developer.atlassian.com/platform/forge/manifest-reference/permissions/)
- [Forge scopes](https://developer.atlassian.com/platform/forge/manifest-reference/scopes-forge/)
- [Forge Rovo action module](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/)
- [Forge Jira REST API](https://developer.atlassian.com/platform/forge/rest/v2/api-group-jira/)
- [Forge `requestJira`](https://developer.atlassian.com/platform/forge/apis-reference/fetch-api-product.requestjira/)
- [Forge Remote](https://developer.atlassian.com/platform/forge/remote/)

## Output contract

Unless the user requests another format, finish with:

- **Outcome:** implemented, diagnosed, reviewed, or blocked;
- **Forge surface:** product, module, resolver/API, environment;
- **Observed / Inferred / Unknown:** clearly separated;
- **Permissions and security:** scopes, execution identity, data exposure, and consent implications;
- **Validation:** exact checks and results;
- **Rovo compatibility:** whether Rovo can call it, what must be configured, and any limitation;
- **Next actions:** concrete code, deployment, installation, or investigation steps.
