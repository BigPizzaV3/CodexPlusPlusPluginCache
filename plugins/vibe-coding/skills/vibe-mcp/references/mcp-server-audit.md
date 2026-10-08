# MCP Server Audit

## Operation

Inspect the named MCP server/client boundary and report supported findings without product edits. Follow [MCP contract boundaries](../../../references/mcp-contract.md) for the repository's supported revision. Do not turn an audit into a protocol migration.

## Required input

The selected server/client, operation, supported protocol/SDK revisions, transport, affected principal/resource and expected result or effect. Establish these from the current repository and request; do not invent missing capabilities or a protocol migration.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Discovery, accepted input, executed handler and serialized result describe the same operation under the supported protocol revision.
- HTTP routing/version metadata agrees with the body before dispatch; stdio carries valid protocol framing without diagnostic contamination.
- Only verified identity and operation-level policy authorize resource access. Arguments, discovery visibility and annotations cannot grant authority.
- Protocol failure, authentication failure and tool execution failure retain their distinct observable result contracts.
- Cancellation, retry and reconnect do not imply rollback and cannot bypass the durable effect’s idempotency owner.

## Goal and scope

Establish whether an advertised capability survives discovery, transport, validation, authorization, execution and serialization with the same meaning. Select the tools, resources or prompts relevant to the request; inspect their direct middleware and consumers rather than every integration in the repository.

## Inspect

- Dependency locks, SDK adapters, supported protocol revisions, transport entrypoints, compatibility branches and enabled extensions.
- Capability negotiation, discovery registration/pagination/cache, input/output schemas, annotations, handler dispatch and client result interpretation.
- HTTP origin checks, routing/version metadata, authentication middleware, token validation, principal construction and per-operation resource scope.
- Downstream clients, durable writes, retry/cancellation ownership, stream closure, errors, diagnostics and existing protocol/host fixtures.

## Audit method

1. Name the actual client, revision and transport. Distinguish current per-request metadata from legacy initialization and optional sessions before interpreting a missing handshake or header.
2. Follow one real advertised operation with a concrete request. Compare the declared input to what dispatch accepts, and the declared output to the serialized success and failure responses.
3. Trace identity from the trusted verifier into the selected object or tenant. Repeat the reasoning for discovery reuse and direct calls; a filtered tool list is not call-time authorization.
4. Follow completion, cancellation and retry to downstream effects. Determine whether the handler may finish after the client disconnects and whether a retry repeats a non-idempotent operation.
5. Use the narrowest meaningful reproduction. Handler tests prove handler behavior; use actual transport messages for framing, headers and status findings, and a supported host for host compatibility claims.

## Issue classes

Schema drift, wrong result discriminator, ignored `isError`, protocol errors disguised as successful tool results, mismatched HTTP header/body metadata, unsafe origin acceptance, cross-principal discovery caching, argument-derived authority, wrong token audience, credential forwarding and duplicated effects after reconnect. Inspect stdout contamination on stdio and request-scoped stream cleanup on HTTP where reachable.

## Evidence requirements

Prioritize unauthorized data/effects and corrupted durable state, then failures blocking supported clients, then lower-impact contract inconsistencies with demonstrated consumers. Optional capabilities, unused legacy behavior and a newer published specification are not defects by themselves.

Each finding needs `path:line`, the owning symbol, affected revision/client, request and observed result, violated contract, impact, one repair direction and a regression route. Merge symptoms with one owner. If no defect is supported, identify the inspected path and remaining transport/provider gaps without claiming universal conformance.

## Priority model

Use the repository’s severity scale if defined. Otherwise classify by demonstrated reachability and impact, not the presence of a keyword:

- **P0:** critical or immediate unauthorized tool effects or cross-principal data exposure.
- **P1:** A supported client unable to execute its advertised contract.
- **P2:** A concrete discovery, framing or error-reporting inconsistency.

A potentially severe category without a supported reachable path remains an unverified concern, not a P0 finding.

## Finding rules

Accept a finding only when the evidence establishes the reachable trigger, authoritative owner, violated invariant, affected consumer/state and concrete impact. Separate source facts, observed runtime behavior and inference. Reject generic best practices, stylistic preferences, hypothetical scale failures and already-solved issues. Give one owner-layer remediation direction. Merge symptoms sharing the same owner and correction; split findings when owner, rollout, rollback or validation boundaries differ.

## Completion criteria

Finish when the selected path and applicable invariants have been examined, findings pass the evidence gate and material unknowns are named. No supported defect is a valid outcome. Do not expand scope or fabricate work to fill priority levels.

## Output contract

Respond in the user’s language. Return findings ordered by impact. Each finding contains: priority and concrete title; affected surface/actor/state; exact evidence anchors and nearest symbol; authoritative owner; violated invariant; expected versus observed behavior; reachable impact; one remediation direction; acceptance criteria; verification route; relevant rollout/rollback constraints and explicit exclusions. Use concise connected fields or prose, not empty template sections. If no finding qualifies, state that and bound the conclusion to the inspected scope. Report unresolved evidence separately. Do not create external tasks or edit code for an audit-only request.
