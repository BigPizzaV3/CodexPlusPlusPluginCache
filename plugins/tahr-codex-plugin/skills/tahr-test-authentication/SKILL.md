---
name: tahr-test-authentication
description: Review and safely test web authentication and session boundaries across login, registration, password reset, magic links, MFA or OTP, OAuth/OIDC, SAML, passkeys, tokens, cookies, logout, and recovery. Use for authentication code review, pre-release auth testing, account-takeover analysis, session-management review, SSO integration review, or validating an existing security assessment.
---

# Test Authentication

Find identity-boundary failures, not merely unusual responses. Treat auth material as untrusted until it proves the intended identity and transport.

## Establish safe scope

1. Identify source roots, runtime origins, supported authentication methods, supplied identities, and expected account lifecycle.
2. Do not send runtime requests unless the user supplied or authorized the target. Use source-only analysis otherwise.
3. Treat all supplied accounts as protected unless explicitly labeled disposable. Do not lock, reset, disable, delete, re-role, enroll or remove MFA/passkeys, rotate credentials, or invalidate all sessions on protected accounts.
4. Use invalid identifiers for low-volume response-shape checks and disposable accounts for lockout, reset completion, password changes, MFA mutation, code replay, and takeover proof.
5. Stop runtime testing on lockout text, CAPTCHA, rate limiting, disabled-account state, unexpected notification delivery, or unclear side effects.

## Prove identity truth first

For each supplied identity:

- observe the rendered login flow before submitting credentials;
- classify password, split-step, OTP, MFA, magic-link, OAuth/OIDC/SAML, passkey, browser-bound, and custom stages;
- identify hidden state, nonce, CSRF, tenant, organization, provider, or login-method choices;
- validate success against an authenticated-only or identity-confirming endpoint;
- record the observed user, role, tenant, auth mode, and whether cookies/tokens are portable or browser-bound.

Do not equate a cookie, token, callback URL, HTTP 200, account picker, application shell, or pending MFA page with successful authentication. A failed role-specific login is a coverage blocker, not target access denial.

## Model the lifecycle

Trace these state transitions when present:

`registration/invite -> verification -> login -> step-up/MFA -> session refresh -> logout/revocation`

`forgot-password -> delivery -> token/code validation -> password change -> prior-session behavior`

`OAuth/SAML/passkey initiation -> provider/authenticator -> callback/completion -> application session`

Record every endpoint, browser action, actor, token class, binding, one-time expectation, expiry, and alternate/mobile/legacy channel. Derive endpoints from source, specifications, JavaScript, and observed traffic before using fallback names.

## Execute the abuse matrix

Read [auth-matrix.md](references/auth-matrix.md). Prioritize tests that cross an identity boundary:

- valid-disposable versus invalid account enumeration controls;
- rate limiting and weaker alternate endpoints;
- pre-auth, post-password, post-MFA, and fully authenticated stage skipping;
- token/code replay, wrong-account binding, stale-token reuse, and parallel requests;
- recovery, factor, password, email, and security-setting changes without reauthentication;
- session fixation, logout/timeout invalidation, CSRF, cookie scope, and refresh rotation;
- OAuth redirect/state/nonce/PKCE/code/client/scope binding;
- credentials or reusable secrets in URLs, responses, logs, JavaScript, caches, or browser storage.

Change one dimension at a time and pair every abuse attempt with a valid control. Refresh or re-establish the exact identity after an intentionally invalidating test before interpreting later responses.

## Apply proof gates

Read [auth-proof-gates.md](references/auth-proof-gates.md). Keep endpoint discovery, header observations, raw tokens, configuration smells, status codes, timing, and script labels in a candidate ledger until the class-specific proof gate passes.

For every confirmed issue, preserve:

- exact flow stage, endpoint/action, and actor/session context;
- baseline and manipulated request or browser action;
- token/cookie class and state using redacted fingerprints;
- authenticated-only data/action, wrong-account binding, replay, persistent state change, or other concrete impact;
- safe, faithful reproduction steps and cleanup or restoration status.

Never persist raw passwords, cookies, bearer/refresh tokens, authorization codes, reset/magic links, OTPs, SAML assertions, passkey material, secrets, or PII.

## Report coverage honestly

Separate `confirmed`, `candidate`, `not_reproduced`, `blocked_for_safety`, and `not_applicable`. List every untested lifecycle stage, missing disposable identity, browser-bound limitation, unavailable delivery channel, stale session, or provider blocker. Do not turn incomplete auth coverage into “no issue found.”
