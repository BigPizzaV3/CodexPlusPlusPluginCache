# API Contract Evolution Polish

## Operation

Implement the selected schema evolution or compatibility repair with its directly affected consumers. Use [API and schema evolution](../../../references/contract-evolution.md). Preserve the supported compatibility window unless the user explicitly authorizes a breaking change.

## Required input

The changed schema/operation, encoding, authoritative source, old/new producer and consumer versions, supported compatibility window and rollout constraints. Identify a concrete payload or operation and the consumers that must keep working.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Change contract

Implement the smallest complete owner-layer correction, not merely the smallest diff. Carry it through directly affected producers, consumers, states, schemas/configuration, generated artifacts and operational behavior. Remove logic made obsolete by the change unless evidenced compatibility requires overlap. Preserve unrelated work; exclude independent cleanup, speculative abstractions and migrations. Each material change must serve a selected invariant and acceptance criterion.

## Domain invariants

- Every supported producer/consumer combination preserves the documented business meaning as well as wire acceptance.
- Request acceptance and response guarantees remain consistent across requiredness, nullability, enums, defaults and errors.
- Schema identities and generated artifacts derive from their authoritative source; retained messages and field identities cannot be silently reinterpreted.
- Mixed-version rollout, retained-data replay and supported rollback maintain the contract throughout the transition.
- Compatibility adapters have a concrete owner and removal condition supported by consumer evidence.

## Goal and scope

Complete a coherent change from schema source through runtime validation/serialization, generated artifacts, consumers and rollout. Resolve the demonstrated incompatibility at its owner rather than maintaining contradictory hand-written copies. Avoid unrelated API redesign, generator upgrades or database rewrites.

## Establish acceptance criteria

Identify the encoding, schema owner, supported producer/consumer versions and failing payload or operation. Define which mixed-version combinations must work, what data semantics must remain stable and when old support may be removed. Record rollout order and rollback limits; do not infer that every participant upgrades together.

## Implementation targets

- Select an additive transition, adapter, versioned endpoint/message or explicitly authorized break based on the actual consumers. Preserve old semantics during overlap instead of merely making a parser accept the data.
- Align requiredness, nullability, defaults, enum behavior and error/status mapping with both validators and serializers. Keep request acceptance distinct from response guarantees.
- For GraphQL, check persisted operations, input/output nullability and resolver behavior. For Protobuf, preserve field identity, reserve removed identities where appropriate and respect binary versus JSON differences.
- Update schema generators at their source and regenerate the exact client artifacts used by consumers. Retain reproducible configuration and avoid unexplained generated-file edits.
- Coordinate event registry policy, historical payloads, replay consumers and staged writers where a new value exceeds old-reader capability.
- Update directly affected examples, deprecation notices, telemetry and operational gates so maintainers can tell when the compatibility window has closed.

## Rollout discipline

Name the stage that permits new writers or removes an adapter. Where needed, deploy tolerant readers before new values, preserve old output until consumers are ready and make rollback constraints explicit. Use observed consumer/version evidence for removal; elapsed time alone does not prove old clients are gone. Keep irreversible data changes under the owning migration procedure and existing authorization.

## Validation

Reproduce the original failure before the repair. Exercise old-to-new and new-to-old payloads for every supported direction, boundary values, absent/null fields, unknown enum values and relevant errors. Run native schema, generation, type and consumer tests. Verify semantic output and authorization, not only compilation. Include retained-event replay or a representative rollout/rollback fixture when the selected contract requires it.

Report the changed source of truth, compatibility matrix, actual test results and remaining deployed-consumer gates. Stop when the authorized contract and direct consumers are complete.

## Completion criteria

The selected invariant holds at the authoritative owner and directly affected consumers; obsolete conflicting behavior is removed or intentionally retained for stated compatibility; the complete diff is reviewed; required available checks have actual results. A missing required environment or unresolved defect prevents a claim of verified completion. Continue authorized corrections within scope; stop when the requested contract is complete rather than searching for a different improvement.

## Output contract

Respond in the user’s language with the completed behavior first. Include the selected invariant and owner, changed scope/key files, evidence for the correction, the affected producer-to-consumer contract, actual verification commands/scenarios/results, and material rollout or rollback consequences. List required checks not run and unresolved assumptions explicitly. Distinguish implemented, locally verified and externally released states. A future plan cannot substitute for an executed change. Omit empty sections and unrelated process narration.
