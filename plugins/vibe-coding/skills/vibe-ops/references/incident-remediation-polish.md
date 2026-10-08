# Incident Remediation Polish

## Operation

Implement the authorized correction or mitigation for the selected incident. Read [incident response boundaries](../../../references/incident-response.md). A credible incident report can establish the target directly; do not force a separate preliminary audit.

## Required input

The affected user operation and cohorts, incident window, available symptom/runtime evidence, known changes, investigation or intervention authority and recovery criteria. Mark unavailable telemetry and unresolved causality explicitly.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Change contract

Implement the smallest complete owner-layer correction, not merely the smallest diff. Carry it through directly affected producers, consumers, states, schemas/configuration, generated artifacts and operational behavior. Remove logic made obsolete by the change unless evidenced compatibility requires overlap. Preserve unrelated work; exclude independent cleanup, speculative abstractions and migrations. Each material change must serve a selected invariant and acceptance criterion.

## Domain invariants

- Incident claims distinguish user impact, observed failure and inferred cause using attributable and time-aligned evidence.
- A mitigation’s effect and a root-cause correction are separate claims; neither is established by temporal correlation alone.
- The intervention targets the authoritative failure owner and preserves directly affected compatibility, retry and durable-state contracts.
- Recovery is demonstrated by fresh affected-user behavior and required convergence, with valid traffic and functioning telemetry.
- Unfinished data repair and unobserved recurrence windows remain explicit even when immediate symptoms or alerts subside.

## Goal and scope

Restore the affected user operation and prevent the demonstrated failure path from recurring. Keep the intervention at the runtime/code/configuration owner and include directly affected retry, cleanup, data repair and recovery checks. Avoid unrelated refactoring while the incident scope remains unresolved.

## Establish the intervention

Record the affected operation, current impact, evidence supporting the cause and acceptance criteria for recovery. Distinguish mitigation from root-cause correction. Choose the smallest coherent change with understood side effects and a practical reversal or forward-fix path. Honor already granted deployment authority; obtain missing authority only when the actual action requires it.

## Remediation targets

- Correct the owning code/configuration contract rather than suppressing its error signal. Keep timeouts, retries, concurrency and downstream capacity coherent.
- Stop retry amplification or invalid work at the appropriate admission boundary without silently discarding committed business operations.
- Restore resource ownership and cleanup on success, rejection, cancellation and shutdown. Do not solve exhaustion solely by raising limits without addressing the demonstrated leak or workload requirement.
- Coordinate compatibility for schema/configuration/consumer changes. A binary rollback that cannot read current data is not a recovery plan.
- Separate application recovery from repair of partially completed work. Use stable identities, checkpoints and bounded batches so a repair can resume without repeating non-repeatable effects.
- Preserve useful incident evidence and the signals needed to judge recovery. Remove temporary instrumentation or controls only when their continuing owner and purpose are clear.

## Execution discipline

Reproduce the failing behavior in the narrowest useful fixture or test environment. Implement the owner correction and directly dependent updates. For a live intervention, use the established rollout/control mechanism, explicit abort criteria and observable checkpoints. Do not automatically restart services, replay queues or run destructive data repairs merely because a recipe lists those possibilities.

## Validation

Demonstrate that the original failure is blocked and normal behavior remains intact. Exercise the relevant load, retry, restart or partial-failure condition rather than relying only on a happy path. After an authorized rollout, verify fresh user-operation evidence, backlog/convergence and error/resource signals over the selected window. Passing local tests is not proof that production recovered.

Report the correction, intervention scope, actual checks, current incident state and remaining repair or observation work. If only mitigation was achieved, say so and retain the concrete unresolved cause instead of closing the incident on a quiet alert.

## Completion criteria

The selected invariant holds at the authoritative owner and directly affected consumers; obsolete conflicting behavior is removed or intentionally retained for stated compatibility; the complete diff is reviewed; required available checks have actual results. A missing required environment or unresolved defect prevents a claim of verified completion. Continue authorized corrections within scope; stop when the requested contract is complete rather than searching for a different improvement.

## Output contract

Respond in the user’s language with the completed behavior first. Include the selected invariant and owner, changed scope/key files, evidence for the correction, the affected producer-to-consumer contract, actual verification commands/scenarios/results, and material rollout or rollback consequences. List required checks not run and unresolved assumptions explicitly. Distinguish implemented, locally verified and externally released states. A future plan cannot substitute for an executed change. Omit empty sections and unrelated process narration.
