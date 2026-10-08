# Authentication Proof Gates

## Universal gate

Confirm all of the following:

1. The endpoint or browser step belongs to a real authentication lifecycle.
2. The tested identity is known and safe for the action.
3. The baseline proves expected behavior with fresh auth state.
4. The manipulated flow crosses or weakens an identity boundary.
5. The impact is reproducible and secrets are redacted without erasing proof.

## Class-specific gates

| Claim | Required proof | Insufficient alone |
|---|---|---|
| Authentication bypass | Authenticated-only data/action or fully authenticated application state without the required factor | HTTP 200, app shell, login page, account picker, MFA prompt |
| Enumeration | Reproducible difference between a known-valid disposable identity and invalid controls | Different invalid usernames, one timing sample |
| Weak brute-force control | Repeated successful sensitive attempts or a paired bypass of an observed limit on a real endpoint | Missing CAPTCHA/header, rejected requests, no 429 alone |
| Reset takeover | Predictable/reused/cross-user token or unauthorized password/account state change on a disposable identity | Accepted reset request, token in local response, reflected host |
| Reset-link poisoning | Attacker-controlled host in the delivered/generated user link | Host reflection or HTTP 200 |
| MFA bypass | Post-MFA access, accepted code replay, factor state change, or missing rate limit on a challenge-bound flow | MFA absent, options page, generic verification 200 |
| Session fixation | Attacker-controlled or pre-auth session identifier remains authoritative after login | Stable cookie name or preference cookie |
| Logout/timeout failure | The exact stale pre-logout/expired artifact still reaches authenticated-only data/action | A refreshed session works |
| CSRF | A meaningful state-changing action succeeds from the attacker origin without an effective defense | Missing token on a read-only form |
| OAuth/OIDC | Usable code/token, session binding, replay, or unauthorized scopes resulting from the mutation | Provider page, ID-token claims, raw code/token presence |
| SAML/passkey | Server accepts the manipulated completion and grants or changes account access | Option/challenge metadata or mocked assertion material |
| Secret exposure | Real reusable secret or credentialed user-specific data at the recorded location | Public client ID, publishable key, placeholder, variable name |

Record candidates that fail a gate with the missing proof and the safest next check. Do not upgrade severity to compensate for incomplete evidence.
