# Authentication and Authorization Investigation

Use for login, API-key, OAuth, token, SSO, session, permission, 401, and 403 issues.

## Distinguish first

Authentication = who are you?  
Authorization = are you allowed to do this?

Do not treat 401 and 403 as interchangeable.

## Signals

Extract:
- auth mechanism: API key, OAuth2, JWT, session, SAML/OIDC SSO;
- endpoint/action;
- environment;
- timestamp;
- request/correlation ID;
- error code/message;
- tenant/account;
- token issue/expiry time if safely available;
- scope/role/permission names;
- recent identity-provider or permission changes.

Never ask the user to paste secrets, tokens, passwords, private keys, recovery codes, or credentials.

## 401 investigation

Check:
- missing/expired token;
- wrong environment/issuer/audience;
- malformed authorization header;
- revoked/rotated credential;
- token refresh failure;
- clock skew;
- identity-provider availability;
- API-key status;
- signature verification failure.

## 403 investigation

Check:
- role/scope mismatch;
- resource ownership/tenant boundary;
- feature entitlement;
- account state;
- policy/IP/network restriction;
- recently changed permissions;
- endpoint-specific authorization rules.

## Compare working vs failing

Compare the same user/account across endpoints or a working user against failing user:
- roles/scopes;
- tenant/resource ownership;
- auth method;
- application/environment;
- session/token age;
- policy/feature entitlements.

Do not expose one user's permissions or account data to another customer.

## Root cause caution

A 401 after a deployment may still be caused by client token expiry.  
A 403 may be expected product behavior.  
Establish intended policy before calling it a defect.
