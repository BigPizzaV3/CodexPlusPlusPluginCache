# Serverless Runtime Polish

## Operation

Implement the selected serverless/edge runtime correction and verify the affected invocation contract. Read [serverless runtime boundaries](../../../references/serverless-runtime.md). A prior audit is optional when the user and repository identify the target.

## Required input

The selected handler, provider/runtime and compatibility configuration, trigger, success/acknowledgment promise, authoritative effect and retry owner. Identify the concrete invocation state and permitted local/provider environment.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Change contract

Implement the smallest complete owner-layer correction, not merely the smallest diff. Carry it through directly affected producers, consumers, states, schemas/configuration, generated artifacts and operational behavior. Remove logic made obsolete by the change unless evidenced compatibility requires overlap. Preserve unrelated work; exclude independent cleanup, speculative abstractions and migrations. Each material change must serve a selected invariant and acceptance criterion.

## Domain invariants

- Success or acknowledgment is emitted only when work required by the business contract has reached its promised durability boundary.
- Deferred work uses the actual provider lifetime mechanism; best-effort continuation is not represented as durable delivery.
- Invocation-specific identity and mutable user state cannot survive into another invocation; reusable infrastructure clients remain separately owned.
- Duplicate, concurrent and partial-batch delivery preserve stable operation identity and cannot repeat a non-repeatable committed effect.
- Runtime API use, resource cleanup, fan-out and downstream admission respect the deployed configuration and supported provider semantics.

## Goal and scope

Complete one coherent correction across handler lifetime, response/acknowledgment, state ownership and the directly affected effect. Preserve the existing provider and trigger unless migration is explicitly requested. Do not replace an application's architecture to make a local emulator pass.

## Establish the contract

Record the actual runtime/version, trigger, configured limits and product success promise. Reproduce the defect with a concrete event or request. Define what must be durable before response, what may be deferred, how failure is surfaced and which component owns retry. Identify the stable business operation key where duplicate delivery is possible.

## Implementation targets

- Await work required for a successful response or acknowledgment. For intentionally deferred work use the provider-supported lifetime mechanism or durable handoff that meets the guarantee. Do not substitute best-effort deferral for promised durable completion.
- Propagate required-work failures so callers or event sources receive the correct outcome. Preserve the provider's batch response contract and avoid acknowledging failed records as successful.
- Keep invocation-specific identity and mutable user state local to the invocation. Reuse safe clients/connections where supported while making temporary/cache state explicitly non-authoritative.
- Deduplicate non-repeatable effects at their actual owner using stable identity and appropriate atomicity. Coordinate retry, visibility/lease and timeout behavior so two invocations cannot bypass the protection.
- Bound fan-out and admission to downstream capacity. Clean up invocation-owned resources on rejection/cancellation without closing legitimately shared clients after every request.
- Use APIs and bindings supported by the deployed runtime and compatibility configuration. Keep preview/testing values from silently becoming production authority.

## Change discipline

Apply the fix to the owner rather than adding sleeps, extending arbitrary timeouts or swallowing rejections. Update directly affected trigger/binding configuration, tests and operational documentation. Preserve legitimate normal and retry paths and avoid unrelated provider, dependency or framework upgrades.

## Validation

Demonstrate the original failure before the fix and success afterward. For lifetime changes, hold the storage/downstream promise unresolved and prove the response cannot claim completion; then reject it and verify failure propagation. For delivery changes, replay the same identity concurrently and across restart or partial-batch retry, checking durable effect counts. For reuse changes, run sequential invocations with different identities and inspect state isolation.

Run available native/emulator checks and state which cases require the real provider. Report the changed contract, actual results and remaining deployment, quota or disconnect checks. Publish or alter cloud resources only within the user's existing authorization.

## Completion criteria

The selected invariant holds at the authoritative owner and directly affected consumers; obsolete conflicting behavior is removed or intentionally retained for stated compatibility; the complete diff is reviewed; required available checks have actual results. A missing required environment or unresolved defect prevents a claim of verified completion. Continue authorized corrections within scope; stop when the requested contract is complete rather than searching for a different improvement.

## Output contract

Respond in the user’s language with the completed behavior first. Include the selected invariant and owner, changed scope/key files, evidence for the correction, the affected producer-to-consumer contract, actual verification commands/scenarios/results, and material rollout or rollback consequences. List required checks not run and unresolved assumptions explicitly. Distinguish implemented, locally verified and externally released states. A future plan cannot substitute for an executed change. Omit empty sections and unrelated process narration.
