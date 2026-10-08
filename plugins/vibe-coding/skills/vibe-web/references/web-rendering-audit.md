# Web Rendering Audit

## Operation

Inspect the selected SSR, hydration or server-action boundary without product edits. Read [web rendering boundaries](../../../references/web-rendering.md), then follow the repository's actual framework and rendering mode. Do not apply one framework's server/client rules to another.

## Required input

The selected route/action, framework/runtime version, rendering mode, affected user state, trusted session/data owner and expected initial and post-interaction behavior. Recover available facts from the repository and supplied reproduction.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Server HTML and the first browser render use equivalent initial data; later preference updates preserve the product’s intended state.
- Serialized payloads and personalized caches expose only data authorized for the current request identity.
- Server mutations enforce validation and object/tenant authorization using trusted identity independently of browser controls.
- A committed mutation and its directly affected rendered/cached view agree under the selected freshness contract.
- Loading, failure, navigation and retry states preserve usable interaction and do not create unauthorized or duplicate durable effects.

## Goal and scope

Find concrete failures between server-rendered data, serialized payload, first browser render, client effects and subsequent mutations. Include the route's directly shared layout, cache and authorization owner. Keep general design, unrelated client state and backend redesign outside the selected boundary.

## Inspect

- Framework/runtime versions, route handlers, server/client component boundaries, loaders, layouts, streaming or deferred segments, error/loading states and deployment configuration.
- Server render inputs, serialization/escaping, locale/timezone/theme sources, random IDs, time-dependent values, browser-only APIs and client initialization.
- Request identity, personalized fetches, cache keys/tags/lifetimes, CDN/framework caches and invalidation after mutations.
- Server actions or equivalent mutation endpoints, trusted sessions, object authorization, input validation, CSRF/origin handling and redirect destinations.
- Browser console/recoverable errors, rendered HTML, route tests, real browser tests and relevant production traces.

## Audit method

1. Trace a concrete route from request and identity through server HTML/data to the first client render. Separate a server-only failure, hydration mismatch and later client-state bug.
2. Compare initial values on both sides. Reproduce the relevant saved preference, timezone, locale, signed-in state or query parameter; do not treat a harmless post-hydration update as a mismatch.
3. Follow serialized data and shared caches across two identities when personalization exists. Identify which layer owns cache variation and which mutation invalidates it.
4. Call the mutation boundary directly with the same object under permitted, forged and signed-out contexts. Hidden buttons and browser-supplied identity do not enforce server authorization.
5. Verify the browser symptom and its source owner. A unit test of a page function cannot establish successful hydration or navigation.

## Issue classes and priority

Prioritize cross-user data exposure, unauthorized server actions and durable corruption; then failed first render, broken navigation/mutation, stale personalized output and inaccessible error recovery. Lower-priority findings still require a visible consumer effect. Examine duplicate effects during retries, lost validation errors, unsafe serialized data, unbounded redirect targets and mismatched server/browser environment assumptions only where reachable.

## Evidence requirements

Provide route, affected state/identity, `path:line` and symbol, reproduction, expected and observed output, one correction direction and a meaningful regression. Do not suppress hydration warnings as a proposed repair or report every use of browser APIs as defective. Bound negative conclusions to the routes and states inspected, and distinguish local rendering evidence from deployment/CDN behavior.

## Priority model

Use the repository’s severity scale if defined. Otherwise classify by demonstrated reachability and impact, not the presence of a keyword:

- **P0:** critical or immediate personalized data exposure or unauthorized server mutation.
- **P1:** A broken render, navigation or mutation path.
- **P2:** A concrete bounded stale/error-state inconsistency.

A potentially severe category without a supported reachable path remains an unverified concern, not a P0 finding.

## Finding rules

Accept a finding only when the evidence establishes the reachable trigger, authoritative owner, violated invariant, affected consumer/state and concrete impact. Separate source facts, observed runtime behavior and inference. Reject generic best practices, stylistic preferences, hypothetical scale failures and already-solved issues. Give one owner-layer remediation direction. Merge symptoms sharing the same owner and correction; split findings when owner, rollout, rollback or validation boundaries differ.

## Completion criteria

Finish when the selected path and applicable invariants have been examined, findings pass the evidence gate and material unknowns are named. No supported defect is a valid outcome. Do not expand scope or fabricate work to fill priority levels.

## Output contract

Respond in the user’s language. Return findings ordered by impact. Each finding contains: priority and concrete title; affected surface/actor/state; exact evidence anchors and nearest symbol; authoritative owner; violated invariant; expected versus observed behavior; reachable impact; one remediation direction; acceptance criteria; verification route; relevant rollout/rollback constraints and explicit exclusions. Use concise connected fields or prose, not empty template sections. If no finding qualifies, state that and bound the conclusion to the inspected scope. Report unresolved evidence separately. Do not create external tasks or edit code for an audit-only request.
