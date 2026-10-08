# Authentication Abuse Matrix

Run only applicable, authorized, non-destructive rows. Establish a valid single-attempt control before testing repetition or mutation.

| Boundary | Safe comparisons | High-value failures |
|---|---|---|
| Login | Known disposable vs invalid; normal vs alternate/mobile/legacy endpoint; same actor across IP/header/path variants | Enumeration, weaker alternate endpoint, bypassed throttle, authenticated session before all factors |
| Registration/invite | Normal validation vs omitted/replayed/changed invite state; allowed role/tenant vs client-supplied fields | Unauthorized provisioning, role/tenant selection, reused invite, wrong-account binding |
| Reset/change | Valid disposable vs invalid; original vs modified delivery/binding fields; first vs replay; old session before/after change | Delivered link poisoning, predictable/reusable token, cross-user reset, missing current-password/reauth, old session remains valid |
| MFA/OTP | Pre-MFA vs post-MFA session; first vs reused code; normal vs omitted factor step; limited invalid attempts | Step skip, code reuse, challenge not session-bound, missing rate limit, factor change without reauth |
| Session | Pre-login vs post-login identifier; stale artifact before/after logout/expiry; same token after refresh/revocation | Fixation, logout/timeout failure, refresh reuse, cross-origin state change, overbroad cookie scope |
| OAuth/OIDC | Registered vs modified redirect; correct vs missing/reused state/nonce; verifier vs no verifier; first vs second code/refresh use | Code/token sent to unauthorized redirect, login CSRF, PKCE bypass, code reuse, wrong client/user binding, scope escalation |
| SAML | Original vs replayed assertion; expected vs modified recipient/audience/identity; signed element vs altered structure | Accepted replay, signature wrapping/bypass, wrong recipient, impersonation |
| Passkey/WebAuthn | Challenge first vs replay; expected vs changed origin/RP/account; authenticated vs unauthenticated registration completion | Accepted replay, wrong-origin completion, credential bound without expected account authentication |
| Credential handling | Auth pages/APIs/JS/storage/cache/log shapes | Reusable secret in URL, response, client bundle, JS-readable storage, or cache |

## Test discipline

- Preserve the exact endpoint, method, content type, field names, and flow stage.
- Count actual business/auth successes, not requests that merely avoided HTTP 429.
- Use multiple samples and controls for timing claims; invalid-versus-invalid timing proves nothing about account existence.
- Do not use real discovered usernames for repeated wrong-password traffic.
- Do not complete destructive lifecycle changes without a disposable account and cleanup plan.
