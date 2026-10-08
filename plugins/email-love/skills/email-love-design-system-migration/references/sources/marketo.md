## Source adapter: Marketo

No official Marketo MCP exists. This adapter uses Marketo REST endpoints and therefore requires
Codex CLI or another Codex environment that permits outbound HTTP.

## Contents

- Credentials and authentication
- Discover
- Fetch and limits
- Audit adaptations

### Credentials and authentication

Ask for the Munchkin ID (`123-ABC-456`), a REST service client ID and secret, and the workspace
when the account has more than one. Recommend read-only Access Assets permissions. Offer local
environment variables `MARKETO_MUNCHKIN_ID`, `MARKETO_CLIENT_ID`, and
`MARKETO_CLIENT_SECRET` so secrets do not enter chat history.

Base URL: `https://{munchkinId}.mktorest.com`.

Authenticate once per session and cache the token until near expiry or a 401:

```text
POST /identity/oauth/token?grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}
```

Pass `Authorization: Bearer {access_token}` on asset calls.

### Discover

If needed, list `/rest/asset/v1/workspaces.json` and confirm the workspace. Then paginate
approved templates:

```text
GET /rest/asset/v1/emailTemplates.json?maxReturn=200&offset=0&status=approved
```

Increase `offset` by 200 until `result` is empty, then sort locally by `updatedAt` descending.
Do not include drafts by default. Above roughly 50 templates, ask the customer to narrow by
folder, last 90 days, name pattern, or explicit IDs. Discovery rows include `id`, `name`,
`workspace`, `folder`, `status`, `createdAt`, and `updatedAt`.

### Fetch and limits

For each approved ID:

```text
GET /rest/asset/v1/emailTemplate/{id}/content.json
```

Read `result[0].content`, render to PNG at target width, trim trailing blank space, and send it
through [module-conversion.md](../module-conversion.md), Phase 3 step 1. Leave Marketo syntax
such as `${var:name}`, `${module.name}`, `<mktEditable>`, and `<mktModuleContent>` untouched.

Marketo allows 100 calls per 20 seconds and 10,000 calls per day per instance. Fetch serially.
On error `606`, wait for the burst window to clear and retry the same request.

### Audit adaptations

Always REFERENCE ONLY, with no scale factor, per-template modules, no cross-template dedup in
v1, and foundations from the first three templates. Add the ID, workspace, folder path, and
direct URL `https://app-{munchkinId}.marketo.com/#EMTP{id}A1` to each report row.

v1 reads Email Templates only. It does not read individual Emails from
`/rest/asset/v1/emails.json` or Content Blocks from `/rest/asset/v1/contentBlocks.json`. Those
often contain the current campaigns, headers, footers, and disclaimers. Explain this before
discovery and mark the audit partial when those pools matter.
