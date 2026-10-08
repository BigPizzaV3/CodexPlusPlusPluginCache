# Testing multi-merchant scenarios and offboarding

## Testing with a connected/test client

Don't test Connect flows against a real client account. Use the Client Links API to
generate a test client:

1. Create a test client link with sample data via the Client Links API.
2. Opening the link emails a test address and creates an account with the prefilled
   fields.
3. Check onboarding completion via the Capabilities API (or the web app) before
   running payment tests against it — a test client that hasn't completed
   onboarding will fail the same way an incomplete real client would.

This exercises the full onboarding → OAuth → payment path without touching a real
merchant's account.

## Offboarding and revoked access

A client can revoke your platform's access at any time from their own Mollie
account — your stored access/refresh tokens for that client become invalid
immediately when this happens.

- **Handle 401s from a specific client's token as a possible revocation**, not just
  an expired-token case — attempt a refresh once; if that also fails, treat the
  client as disconnected rather than retrying indefinitely.
- **Don't silently retry payments** for a disconnected client — surface it to the
  platform's own operational tooling so a human notices the client dropped off,
  since their orders will otherwise silently stop processing.
- Remove or invalidate the stored tokens for that client once you've confirmed the
  disconnection, rather than leaving dead credentials in your database.

## Common mistakes

| Mistake | Fix |
|---|---|
| Testing OAuth/onboarding against a real client account | Use the Client Links API to generate a test client |
| Treating every 401 from a client token as "just expired" | Attempt refresh once, then treat persistent failure as revoked access |
| Retrying payments indefinitely for a disconnected client | Detect and surface disconnection instead of silent retries |
