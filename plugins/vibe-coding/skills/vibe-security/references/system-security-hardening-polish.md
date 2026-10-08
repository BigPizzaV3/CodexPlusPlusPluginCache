# System Security Hardening Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed System Security Hardening improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Fix at the authoritative enforcement boundary and default-deny unknown identities, tenants, destinations, capabilities, formats, or states.
- Make credential-abuse controls atomic/distributed, rate-aware, observable, and recoverable; avoid permanent global lockouts or IP-only controls that attackers can weaponize.
- Normalize and validate before authorization/use, then re-check after redirects/resolution/decoding where the interpreted target can change.
- Reduce privilege/attack surface instead of relying only on detection; rotate/revoke exposed secrets and preserve overlap for safe rollout.
- Add tests and security signals for the exact abuse path without recording secrets, raw credentials, personal payloads, or exploit material.

## Validation

- Run repository security/static/dependency/policy tests plus narrow authorization/tenant/session/abuse fixtures.
- Exercise race, distributed replica, restart, counter expiry, revocation propagation, DNS/redirect/parser limits, privilege denial, and rotation overlap in a safe environment.
- Record controls proven, residual assumptions, and production-only gates without publishing reusable exploit instructions.
