# Web Rendering Polish

## Operation

Implement one selected web rendering or server-action correction and verify the user-visible result. Use [web rendering boundaries](../../../references/web-rendering.md) and the repository's framework conventions. A prior audit is unnecessary when the request already identifies the target.

## Required input

The selected route/action, framework/runtime version, rendering mode, affected user state, trusted session/data owner and expected initial and post-interaction behavior. Recover available facts from the repository and supplied reproduction.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Change contract

Implement the smallest complete owner-layer correction, not merely the smallest diff. Carry it through directly affected producers, consumers, states, schemas/configuration, generated artifacts and operational behavior. Remove logic made obsolete by the change unless evidenced compatibility requires overlap. Preserve unrelated work; exclude independent cleanup, speculative abstractions and migrations. Each material change must serve a selected invariant and acceptance criterion.

## Domain invariants

- Server HTML and the first browser render use equivalent initial data; later preference updates preserve the product’s intended state.
- Serialized payloads and personalized caches expose only data authorized for the current request identity.
- Server mutations enforce validation and object/tenant authorization using trusted identity independently of browser controls.
- A committed mutation and its directly affected rendered/cached view agree under the selected freshness contract.
- Loading, failure, navigation and retry states preserve usable interaction and do not create unauthorized or duplicate durable effects.

## Goal and scope

Restore the contract from server inputs through initial HTML, hydration, interaction and authoritative mutation. Include directly affected serialization, cache invalidation, error handling and tests. Keep independent component redesign, routing migrations and framework upgrades out of the change unless required by the defect.

## Establish the failing state

Name the route, rendering mode, framework/runtime versions and affected user state. Reproduce the failure with a stable fixture: saved preference, locale, authentication state, object identity or relevant request data. Record both server output and browser behavior. Choose acceptance criteria for initial render, post-hydration state and the subsequent interaction before editing.

## Implementation targets

- Make server output and the first client render use the same initial data. Apply browser-only preferences in the correct lifecycle or supply a trusted matching server snapshot. Preserve the preference after hydration and on navigation.
- Keep environment-specific code behind the appropriate boundary without converting the entire page to client rendering merely to hide a mismatch. Avoid random/time-dependent first-render values unless serialized consistently.
- Serialize only data intended for that user; use framework escaping rather than interpolating untrusted HTML or script data. Do not move secrets into browser bundles to resolve a server import failure.
- Construct mutation identity from the trusted server session, then check object/tenant authorization at the owning service. Retain input validation and framework CSRF/origin protections; client fields and hidden controls are not authority.
- Align cache scope and invalidation with personalized reads and successful writes. Update the correct route/query data after mutation, including conflict, denial and retry behavior.
- Preserve meaningful loading, error and empty states and usable focus/navigation when the selected flow depends on them.

## Validation

Run the repository's relevant type/build checks and targeted tests. For hydration, exercise real server rendering and a browser reload with both default and non-default saved state; assert recoverable errors and rendered content, then operate the controls. A snapshot of a component function is insufficient. For actions, exercise legitimate ownership, forged identity, signed-out access, invalid input and observable persisted state; add HTTP/framework checks when the changed layer owns them.

Report the owner changed, user-visible behavior restored, commands/results and untested deployment boundaries. Do not claim a warning-suppression flag fixes divergent content or that action-unit tests verify browser hydration.

## Completion criteria

The selected invariant holds at the authoritative owner and directly affected consumers; obsolete conflicting behavior is removed or intentionally retained for stated compatibility; the complete diff is reviewed; required available checks have actual results. A missing required environment or unresolved defect prevents a claim of verified completion. Continue authorized corrections within scope; stop when the requested contract is complete rather than searching for a different improvement.

## Output contract

Respond in the user’s language with the completed behavior first. Include the selected invariant and owner, changed scope/key files, evidence for the correction, the affected producer-to-consumer contract, actual verification commands/scenarios/results, and material rollout or rollback consequences. List required checks not run and unresolved assumptions explicitly. Distinguish implemented, locally verified and externally released states. A future plan cannot substitute for an executed change. Omit empty sections and unrelated process narration.
