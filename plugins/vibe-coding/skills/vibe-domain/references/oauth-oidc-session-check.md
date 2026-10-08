# OAuth OIDC Session Check

## Operation

Verify the selected login, callback, account-linking or refresh boundary without product edits. Use the implemented provider, library version, client type and flow. Distinguish OAuth resource authorization from OIDC identity and from the application's local session.

## Required input

The selected login/callback/linking/refresh flow, provider and library versions, client type, issuer/redirect configuration, identity/session owner, expected outcomes and available synthetic issuer or provider sandbox.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- The callback is bound to the intended authorization transaction and trusted issuer, with applicable one-time, PKCE, CSRF and nonce guarantees.
- Only claims validated for the correct issuer, audience, signature and lifetime can establish the application identity.
- Account linking follows stable provider identity and the explicit verification policy; ambiguous email is not sufficient authority.
- Rejected callbacks and reused invalidated credentials cannot create or overwrite valid account/session state.
- Concurrent refresh, logout and revocation preserve the distinct local-session, provider-session and resource-access promises.

## Establish the boundary

Inspect provider configuration, registered redirect URIs, trusted issuer/endpoints, authorization transaction storage, callback handler, library validation, account identity mapping, cookies/session store and refresh/revocation paths. Record supported browser/native/server clients and which verifier layers the local fixture includes.

## Authorization transaction checks

Trace one valid flow from initiation through callback to session creation. Verify transaction binding and one-time consumption: PKCE where required, state or an applicable supported CSRF binding, and nonce validation when the flow uses a nonce. Keep the expected issuer and token endpoint attached to the original transaction. Do not report missing `state` as a defect when an applicable alternative is demonstrated.

Exercise a correct callback, expired transaction, mismatched binding, reused code/transaction, altered redirect target and provider error. A failed callback must not create a session, link an account or overwrite an existing identity. Check that post-login return locations obey the application's trusted destination policy.

## Identity and session checks

Use the library's validated claims rather than a decoded JWT payload. With test keys or the existing issuer harness, exercise invalid signature/algorithm, wrong issuer/audience, expired token and applicable authorized-party/nonce rules. Select cases matching the configured flow; do not pretend a mock principal tests cryptographic validation.

Trace the stable provider subject and issuer into account mapping. Email alone must not silently link ambiguous or unverified identities; verify the repository's linking policy and an existing-account collision. Inspect session fixation/rotation, cookie scope and server-side session lifetime where the selected route owns them. Confirm that rejected identity never reaches protected business operations.

## Refresh and logout checks

Verify the configured rotation or sender-binding policy, concurrent refresh attempts, expiry and reuse of invalidated credentials. Observe both the returned result and stored credential/session state so an error after an unsafe update is not counted as denial. Never log raw token values. Distinguish revoking the local session from ending the provider session and from revoking API access; test the product's stated promise.

## Evidence and limitations

Use synthetic identities, local test issuers or an existing provider sandbox. Pair denial cases with a valid control, report exact steps/results and map failures to `path:line` and the identity owner. Separate library-level, HTTP/cookie/browser and provider integration coverage. Report missing checks instead of declaring the whole login system verified.

Select applicable requirements from [OAuth Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html) and [OIDC validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation), plus version-matched provider documentation.

## Evidence and safety rules

Define the required scenario matrix before execution from the selected invariant and current repository commands. Respect active test restrictions. Use the authorized environment and bounded workload/fault conditions. Record expected and observed state, identity/order/effect evidence and exact commands; passing harness output alone cannot override the intended contract. Pair negative cases with a valid control. Do not perform destructive drills, broaden implementation or infer provider/production behavior from local fixtures. An unavailable required scenario remains unavailable.

## Verdict and completion

Return **passed** only when every required criterion is supported by actual evidence. Return **failed** when a named invariant is violated, with the minimal reproduction and owner. Return **blocked** when required evidence cannot be obtained because the target, environment or safe operation is unavailable; name the missing gate. If a defect is already proven and other checks are blocked, report failed with those unexercised gates. Stop when the bounded matrix is resolved or cannot safely progress; never convert skipped work into a pass.

## Output contract

Respond in the user’s language and begin with passed, failed or blocked. Include: checked invariant and exact boundary/version; required scenario matrix with expected/observed state and per-case result; actual commands and bounded measurements; evidence anchors or minimal reproduction; residual risks; unavailable gates and their effect on the verdict. Separate inspected source from executed runtime evidence. Omit empty sections. Recommend the narrow owner correction for a failure without performing unrequested edits.
