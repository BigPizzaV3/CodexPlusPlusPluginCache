# Connect — scopes, tokens, and their lifecycle

## Two-token model

- **Access token** — sent as a Bearer token on every API call made on behalf of a
  connected client. Short-lived.
- **Refresh token** — stored server-side against the client record, exchanged for a
  new access token via the `/tokens` endpoint when the access token expires.

```javascript
// Using a stored access token to act on behalf of a connected client
const client = createMollieClient({ accessToken: storedAccessToken });
```

Never use a client's access token past its expiry without refreshing first — build
the refresh into your token-fetch path rather than reacting to 401s ad hoc, since a
failed API call mid-checkout is worse than a slightly-early proactive refresh.

**Confirm current token expiry duration against Mollie's OAuth setup docs before
hardcoding any refresh interval** — this changes over time and getting it wrong
either wastes calls (refreshing too early) or breaks checkout (refreshing too late).

## Scopes

Access tokens are scoped to specific permissions — the client approves exactly what
your platform can do on their behalf during the OAuth consent step. Request the
minimum scopes the integration needs; don't default to requesting everything.

Example: reading a connected client's profiles requires `profiles.read`. Follow the
same `<resource>.read` / `<resource>.write` pattern for other resources (payments,
refunds, etc.) — **look up the exact scope list in Mollie's current OAuth setup docs
before writing the authorization request**, since scope names are resource-specific
and this reference should not be treated as the exhaustive list.

## Common mistakes

| Mistake | Fix |
|---|---|
| Requesting every available scope by default | Request only the scopes the integration actually uses |
| Using an access token past expiry | Build refresh-before-expiry into the token-fetch path |
| Storing only the access token, not the refresh token | Store both — the refresh token is what lets you get new access tokens without re-authorizing |
