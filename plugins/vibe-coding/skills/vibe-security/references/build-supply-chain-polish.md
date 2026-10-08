# Build Supply Chain Polish

## Operation

Implement the selected dependency, CI or release-assembly trust correction. Follow [supply-chain boundaries](../../../references/supply-chain.md). Use the demonstrated actor-to-effect path and existing release policy to define the change; avoid a blanket tooling migration.

## Required input

The selected dependency/build/publishing workflow, trigger and ref, actor-controlled inputs, executing identity, available privileges and intended artifact. Identify the actual trust crossing and permitted publication policy.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Change contract

Implement the smallest complete owner-layer correction, not merely the smallest diff. Carry it through directly affected producers, consumers, states, schemas/configuration, generated artifacts and operational behavior. Remove logic made obsolete by the change unless evidenced compatibility requires overlap. Preserve unrelated work; exclude independent cleanup, speculative abstractions and migrations. Each material change must serve a selected invariant and acceptance criterion.

## Domain invariants

- Untrusted source, scripts, cache entries and artifacts cannot execute with publishing authority merely because an earlier job succeeded.
- Build inputs resolve to the intended registry/ref/digest and lockfile under the repository’s dependency policy.
- Privilege follows the job’s required operation and cannot be expanded by attacker-controlled event or artifact metadata.
- Release bytes come from an explicitly approved inventory; unexpected sensitive files and escaping paths fail before publication.
- Integrity checks, publisher identity, provenance and inventory are verified as distinct properties against the project’s actual policy.

## Goal and scope

Remove the specific route by which untrusted input gains execution privileges or enters approved release bytes. Complete directly affected workflow permissions, input validation, artifact handling, inventory and verification so the same behavior cannot bypass the fix through another step in the selected path.

## Establish acceptance criteria

Identify the controlling actor, trigger, selected ref, execution context, credentials and permitted output. Reproduce the unsafe behavior with synthetic data or a disposable fixture. Define a valid control build and the malicious/accidental input that must be rejected. Determine whether the owner is trigger design, script execution, dependency resolution, cache reuse or final package assembly.

## Implementation targets

- Separate untrusted contribution checks from privileged publication. Avoid checking out and executing attacker-controlled code after entering a context with publishing secrets.
- Minimize workflow token permissions at the owning scope. Preserve required release operations and use repository-native identity/environment controls rather than unexplained broad permission removal.
- Bind external actions, dependencies or tools to the immutable identity required by the project. Preserve lockfile/generator consistency and inspect lifecycle scripts that execute during installation.
- Treat downloaded artifacts and cache contents according to their producing trust domain. Verify identity and paths before extraction or execution; artifact names alone are not authority.
- Assemble releases from an explicitly reviewed inventory. Reject unexpected or sensitive files and symlink/path escapes before creating publishable output. Do not regenerate an approval list from arbitrary current files during every build.
- Keep diagnostics useful without revealing credentials or private file contents. Preserve the intended publisher and exact source/artifact association.

## Change discipline

Update the workflow or script that owns the boundary, plus directly dependent configuration and maintenance instructions. Do not paper over a failing build by disabling its security gate or rerunning privileged code with additional secrets. Preserve ordinary contribution and release paths and document any intentional workflow constraint.

## Validation

Show the original synthetic case fails before the correction and is rejected afterward, while the valid control still builds. Verify permissions/ref selection where possible, release inventory and archive bytes, deterministic assembly when promised, and relevant CI on the actual changed commit. For a dependency change run the necessary native checks; for packaging verify no final or partial artifact survives validation failure.

Report the repaired trust path, evidence, checks run and remaining hosted-runner or registry checks. Publish only within the user's existing authorization and the repository's applicable controls.

## Completion criteria

The selected invariant holds at the authoritative owner and directly affected consumers; obsolete conflicting behavior is removed or intentionally retained for stated compatibility; the complete diff is reviewed; required available checks have actual results. A missing required environment or unresolved defect prevents a claim of verified completion. Continue authorized corrections within scope; stop when the requested contract is complete rather than searching for a different improvement.

## Output contract

Respond in the user’s language with the completed behavior first. Include the selected invariant and owner, changed scope/key files, evidence for the correction, the affected producer-to-consumer contract, actual verification commands/scenarios/results, and material rollout or rollback consequences. List required checks not run and unresolved assumptions explicitly. Distinguish implemented, locally verified and externally released states. A future plan cannot substitute for an executed change. Omit empty sections and unrelated process narration.
