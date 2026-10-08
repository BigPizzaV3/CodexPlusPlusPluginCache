# Mollie Connect — OAuth and client onboarding

Mollie Connect is for platforms/marketplaces that process payments on behalf of
other businesses ("clients"). This is a fundamentally different integration from
`<references/payments/>` — the platform never touches its clients' payments
directly; it acts on their behalf via OAuth.

## Two ways to onboard a client

**A) Client signs up and connects independently**
The client already has (or creates) their own Mollie account, then authorizes your
platform via the standard OAuth "Connect with Mollie" flow (below).

**B) Platform creates the account on the client's behalf**
Use the Client Links API to generate a co-branded onboarding link, prefilled with
the client's details. Opening the link emails the client and creates their account
with the prefilled fields — they complete onboarding in the Mollie web app.

Ask which model fits before generating code — it changes whether you need the
Client Links API at all.

## OAuth flow (model A)

1. Redirect the client to Mollie's OAuth authorization URL with your `client_id`,
   requested scopes, and a `redirect_uri`.
2. Client approves and is redirected back to you with an authorization `code`.
3. Exchange the `code` for an **access token** and **refresh token** at the token
   endpoint.
4. Store both tokens against the client record — you'll need the refresh token to
   get new access tokens as they expire (see `<references/connect/permissions-and-tokens.md>`).

Don't hand-roll this — use one of Mollie's OAuth helper libraries for your language
rather than implementing the authorization-code exchange from scratch.

## KYC verification

New clients go through Mollie's verification process (KYC) regardless of onboarding
path. Check onboarding/verification completion via the Capabilities API before
assuming a client can accept live payments — a newly connected account may not be
able to receive payouts yet.

```javascript
// Check whether a connected client account has completed onboarding
const capabilities = await mollie.organizations.getCapabilities(clientOrganizationId);
```

- This is an organization-level endpoint — a plain API key doesn't have access to
  it at all. Authenticate `mollie` with the **client's OAuth access token** (the
  same pattern as `<references/connect/application-fees-and-routing.md>`: act on
  their behalf, not the platform's own credentials). Using the platform's own
  advanced/organization access token instead would check the platform's own
  capabilities, not the client's — confirm the exact token/scope requirement
  against current docs before shipping.
- Do not let application code assume a freshly onboarded client is immediately
  payment-capable — poll or check capabilities before routing real traffic to them.

## Common mistakes

| Mistake | Fix |
|---|---|
| Building a standard checkout integration for a platform use case | Stop and route to Connect — see the developer-type check in the main router |
| Assuming a client can accept payments right after OAuth approval | Check Capabilities API — KYC may still be pending |
| Hand-rolling the OAuth code exchange | Use Mollie's OAuth client libraries for your language |
