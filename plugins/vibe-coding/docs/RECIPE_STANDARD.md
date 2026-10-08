# Recipe execution contract

A recipe is an executable engineering procedure. Its domain vocabulary must connect the user's target to an authoritative owner, an invariant, a bounded operation and observable completion. Length and headings alone do not establish quality.

## Common foundation

1. **Operation:** distinguish inspection, implementation and verification; derive mutation authority from the actual user request and active repository rules.
2. **Required input:** identify the target, owner, intended behavior, current evidence, constraints and applicable environment. Recover ordinary context from the repository. Name consequential missing facts rather than inventing them or asking ritual questions.
3. **Domain invariants:** state what must remain true across the domain's real lifecycle, state transitions and trust boundaries. Each applicable invariant must have a source/consumer trace and a way to observe success or failure.
4. **Procedure:** follow concrete producers, state owners, consumers and failure windows in the current implementation. Select version/provider-specific rules from evidence.
5. **Evidence:** separate requirements, observed runtime behavior, source-based inference and unknowns. Tests record expectations; they do not define product truth by themselves.
6. **Completion and result:** define when the bounded task is complete, what blocks that conclusion and what evidence the user receives.

## Audit

Provide inspectable sources, a domain method and impact-based priorities. Admit a finding only with a reachable trigger, authoritative owner, violated invariant, affected actor/state, concrete impact and validation route. Reject unsupported best-practice claims. Merge symptoms under one owner-layer correction; split different rollout/rollback/validation units.

Output evidence anchors, expected/observed behavior, one remediation direction, acceptance criteria and relevant constraints. No finding is a valid result. An audit-only request does not authorize edits or external task creation.

## Implementation

Define the selected owner/invariant and acceptance criteria before editing. Complete the directly affected producer-to-consumer contract, including required schema/configuration, generated outputs, error states, compatibility and recovery. Remove obsolete conflicting logic unless evidenced compatibility requires overlap. Exclude unrelated cleanup and speculative abstraction.

Reproduce the defect where practical, verify the changed behavior with authorized native checks and inspect the complete diff. Output completed behavior, changed owner/scope, actual checks and remaining gates. A planned change or an unexecuted check is not completion.

## Verification

Define a bounded scenario matrix with expected state transitions, safe environment, workload/failure limits and observable evidence. Include valid controls with negative cases. Separate local, transport, provider and production guarantees.

Return `passed` only when every required criterion is evidenced; `failed` for a demonstrated invariant violation; `blocked` for an unavailable required gate. Report a proven failure even when other checks remain blocked. Output the invariant/boundary, per-case expected and observed results, commands, measurements, evidence and residual gates.

## Author review

Apply a realistic request to the recipe and inspect its actual output and permitted effects. Check audit-only and unavailable-evidence cases as well as a successful correction. Shared references may explain domain details, but must not replace the operation's input, invariant, execution and output contract.
