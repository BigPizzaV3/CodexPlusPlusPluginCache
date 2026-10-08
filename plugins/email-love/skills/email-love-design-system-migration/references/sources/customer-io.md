## Source adapter: Customer.io

Requires the Customer.io MCP connected to your Codex session with `cio_read_api`, `cio_schema`,
and `cio_prime` available.

## Contents

- Prime and authentication
- Content pools
- Discover
- Fetch
- Audit adaptations

### Prime and authentication

Call `cio_prime` at the start of every session. Its instructions override this adapter when the
API changes. Then call `cio_auth_status`; if it fails, have the customer run `cio auth login`
with their `sa_live_` service-account token. Confirm `environment_id`, because every request is
workspace scoped.

Customer.io UI naming differs from the API: UI Automations are `campaigns`, and UI Profiles are
`customers`. Use the customer's term in conversation and the API term in calls.

### Content pools

v1 reads Templates (`/v1/environments/{env}/templates`) and Newsletters
(`/v1/environments/{env}/newsletters`). Ask whether to read templates, newsletters, or both.
It does not read campaign or automation messages, transactional messages, Design Studio emails,
layouts, or snippets. Say this before discovery, especially when the customer uses Design Studio.

### Discover

Use `cio_schema` for `templates.list` or `newsletters.list` before assuming response fields.
List the selected pools with `cio_read_api`, auto-paginate, and keep discovery payloads small:

```text
cio api /v1/environments/{env}/templates --page-all --jq '.templates[] | {id, name, updated_at, type}'
```

Use the equivalent newsletter shape from the current schema. Sort locally by `updated_at`
descending. Above roughly 50 combined items, ask the customer to narrow before fetching.

### Fetch

Fetch each approved item with:

```text
cio api /v1/environments/{env}/templates/{template_id}
cio api /v1/environments/{env}/newsletters/{newsletter_id}
```

Use `cio_schema` on the corresponding `.get` endpoint when the HTML field is unclear; common
names are `body`, `html`, and `content`. Render at target width, trim blank space, and send the
PNG through [module-conversion.md](../module-conversion.md), Phase 3 step 1.

Do not load Customer.io's `design-studio` or `fly-api` creation skills during this read-only
migration. They govern creating content in Customer.io and introduce conflicting instructions.

### Audit adaptations

Always REFERENCE ONLY, no scale factor, per-item modules, no cross-item deduplication in v1,
and foundations from the first three items. Add the asset ID, pool type, and direct edit URL to
every row.

The report must repeat the v1 omissions: Automations and campaign messages, transactional
messages, Design Studio emails, layouts, and snippets. If the active library lives mainly in an
omitted pool, stop presenting this as a complete audit.
