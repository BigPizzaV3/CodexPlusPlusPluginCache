## Source adapter: Klaviyo

Requires the official Klaviyo MCP connected to your Codex session. Tool namespaces vary, but
the operation names below are the ones to find.

### Discover

1. Call `get_account_details` first and confirm the account name and organization. Customers
   commonly have staging and production accounts under one login.
2. Call `list_email_templates` with
   `fields_template=["id","name","editor_type","created","updated"]` and
   `sort="-updated"`. Klaviyo caps `page_size` at 10, so follow `links.next` until null.
3. Above roughly 50 templates, ask the customer to narrow by name, ID, modified date, or a
   top-N recent set before fetching bodies.

Report the account, organization ID, total count, recent count, and candidate names for
confirmation.

### Fetch

Call `get_email_template` for each approved ID and request `html`. The discovery response may
already contain HTML, but a second call is cleaner for a small selection. Skip
`SYSTEM_TEXT_ONLY` and any item without HTML, log it, and explain why it contributes no visual
system. Render the HTML at target width, trim blank space, and send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

Do not default to `render_email_template`. It substitutes context but is limited to 3 requests
per second burst and 60 per minute. Use it only when the customer explicitly wants merge tags
resolved, and warn before a batch over 10 templates.

Every Klaviyo MCP call requires a `model` string for telemetry. Pass the most specific model
identifier available in the session.

### Audit adaptations

Use the Local Folder audit rules: always REFERENCE ONLY, no scale factor, per-template modules,
no cross-template deduplication in v1, and foundations sampled from the first three templates.
Add the template ID, editor type, and direct URL
`https://www.klaviyo.com/email-editor/{TEMPLATE_ID}/edit` to every report row.

v1 reads standalone templates only. It does not read campaign or flow messages. If current
production content lives there, ask the customer to save representative messages as templates
or record that the audit is partial. Never present the template pool as the whole library.
