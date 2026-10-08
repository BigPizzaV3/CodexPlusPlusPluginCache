# Wrong credentials, auth errors, rate limits

## "It works in test mode but fails in live" (or vice versa)

Almost always a test/live mismatch between frontend and backend:

```javascript
// Frontend
const mollie = Mollie('pfl_xxx', { testmode: true });   // ← test

// Backend
const client = createMollieClient({ apiKey: 'live_xxx' }); // ← live — mismatch
```

Both sides must agree. Check:
- `testmode` passed to `Mollie()` in the browser
- Whether the backend API key starts with `test_` or `live_`
- The profile ID (`pfl_xxx`) belongs to the same account as the backend API key —
  a profile ID from a different account will fail even if test/live modes match

## API authentication errors (401 / 403)

- **401** — the API key/access token itself is invalid, expired, or malformed. For
  Connect integrations, this can also mean the client revoked access — see
  `<references/connect/testing-and-offboarding.md>`.
- **403** — the credential is valid but lacks the required scope for that
  operation. Check which scope the endpoint requires (e.g. `refunds.write` for
  issuing refunds) against what was granted at OAuth time or configured on the API
  key.

Don't guess — log the actual response body, Mollie's error responses name the
specific problem rather than just the HTTP status.

## Rate limits (429)

A `429` means you've exceeded Mollie's rate limit. Back off and retry with
increasing delay — don't tighten a retry loop in response to a `429`, that makes it
worse.

```javascript
async function withBackoff(fn, attempt = 1) {
  try {
    return await fn();
  } catch (err) {
    if (err.status === 429 && attempt <= 3) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      return withBackoff(fn, attempt + 1);
    }
    throw err;
  }
}
```

If you're hitting rate limits during normal operation (not a burst/bug), that's a
signal to batch or cache reads (e.g. payment method lists) rather than just retrying
harder.

## Common mistakes

| Mistake | Fix |
|---|---|
| Frontend `testmode` and backend API key mode don't match | Make both test or both live — never mixed |
| Profile ID from a different Mollie account than the backend key | Confirm `pfl_xxx` and the API key belong to the same account |
| Treating 403 the same as 401 | 403 means missing scope, not invalid credential — check what scope the call needs |
| Retrying a 429 immediately in a tight loop | Use exponential backoff, cap retry attempts |
