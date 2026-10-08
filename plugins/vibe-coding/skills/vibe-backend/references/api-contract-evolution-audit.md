# API Contract Evolution Audit

## Operation

Inspect the selected public or internal contract change without product edits. Read [API and schema evolution](../../../references/contract-evolution.md). Judge compatibility against supported consumers and encodings, not a schema diff alone.

## Required input

The changed schema/operation, encoding, authoritative source, old/new producer and consumer versions, supported compatibility window and rollout constraints. Identify a concrete payload or operation and the consumers that must keep working.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Every supported producer/consumer combination preserves the documented business meaning as well as wire acceptance.
- Request acceptance and response guarantees remain consistent across requiredness, nullability, enums, defaults and errors.
- Schema identities and generated artifacts derive from their authoritative source; retained messages and field identities cannot be silently reinterpreted.
- Mixed-version rollout, retained-data replay and supported rollback maintain the contract throughout the transition.
- Compatibility adapters have a concrete owner and removal condition supported by consumer evidence.

## Goal and scope

Determine whether old and new producers/consumers can coexist through the actual rollout, replay and rollback window. Include the schema owner, serializer/resolver, generated clients and directly affected callers. Keep database storage migrations and authorized reference reconstruction with their own owners unless they directly constrain this contract.

## Inspect

- OpenAPI/GraphQL/Protobuf/event schema sources, generated outputs, registries, generator configuration and dependency versions.
- Request validators, serializers, resolvers, defaults, error/status mapping, pagination and consumer parsing or exhaustive enum handling.
- Deployed client versions, mobile/offline consumers, persisted operations, retained events, compatibility policy and deprecation commitments.
- Contract tests, old/new fixtures, release order, traffic or consumer evidence, feature gates, backfills and rollback constraints.

## Audit method

1. Identify the wire format and source of truth. Separate binary, JSON, generated-code and business-semantic compatibility; the same change may differ across them.
2. Establish the supported version window and which consumers actually remain active. If this evidence is absent, report the uncertainty rather than inventing an indefinite compatibility promise.
3. Compare old producer/new consumer and new producer/old consumer using concrete payloads. Include retry, replay and rollback when old data or binaries can return.
4. Trace changed requiredness, nullability, enums, defaults and field identities into validation and generated code. Check GraphQL input/output direction, persisted operations and Protobuf field-number reuse where applicable.
5. Run the repository's schema diff and consumer tests, then inspect semantic changes those tools cannot establish: units, ordering, pagination, error meaning and authorization.

## Issue classes and priority

Prioritize supported consumers that fail, silently reinterpret data, lose access or receive unauthorized fields. Next consider mixed-version write/read divergence, unsafe rollback, replay of retained payloads and generated artifacts that no longer match the server. Lower-impact documentation/deprecation drift still needs a concrete consumer consequence.

An additive field is not automatically safe for strict clients; a wire-compatible number change is not necessarily safe for old application types. Conversely, a removed unused schema field is not a proven outage without a supported consumer or explicit compatibility guarantee.

## Evidence requirements

Cite schema and consumer `path:line`, version/encoding pair, minimal payload or operation, expected and observed outcome, affected rollout stage, one repair direction and regression route. Group failures under their authoritative contract owner. State which versions and consumer modes were exercised, and keep missing deployment or replay evidence visible.

## Priority model

Use the repository’s severity scale if defined. Otherwise classify by demonstrated reachability and impact, not the presence of a keyword:

- **P0:** critical or immediate supported consumers silently corrupting business data or losing critical access.
- **P1:** A material mixed-version or replay failure.
- **P2:** A concrete lower-impact schema/client drift.

A potentially severe category without a supported reachable path remains an unverified concern, not a P0 finding.

## Finding rules

Accept a finding only when the evidence establishes the reachable trigger, authoritative owner, violated invariant, affected consumer/state and concrete impact. Separate source facts, observed runtime behavior and inference. Reject generic best practices, stylistic preferences, hypothetical scale failures and already-solved issues. Give one owner-layer remediation direction. Merge symptoms sharing the same owner and correction; split findings when owner, rollout, rollback or validation boundaries differ.

## Completion criteria

Finish when the selected path and applicable invariants have been examined, findings pass the evidence gate and material unknowns are named. No supported defect is a valid outcome. Do not expand scope or fabricate work to fill priority levels.

## Output contract

Respond in the user’s language. Return findings ordered by impact. Each finding contains: priority and concrete title; affected surface/actor/state; exact evidence anchors and nearest symbol; authoritative owner; violated invariant; expected versus observed behavior; reachable impact; one remediation direction; acceptance criteria; verification route; relevant rollout/rollback constraints and explicit exclusions. Use concise connected fields or prose, not empty template sections. If no finding qualifies, state that and bound the conclusion to the inspected scope. Report unresolved evidence separately. Do not create external tasks or edit code for an audit-only request.
