## Source adapter: Brevo

Requires the [official Brevo MCP](https://developers.brevo.com/docs/mcp-protocol) connected to
your Codex session. Brevo API keys grant broad
account access, including sends and writes. Recommend a local `BREVO_API_KEY` environment
variable so the literal secret does not enter conversation history, and use read operations only.

### Discover

Inspect the MCP tool catalog, call its template-list operation, filter to email templates, and
ignore SMS and WhatsApp. Sort locally by last modified and report the count. Above roughly 50
templates, ask the customer to narrow the selection.

### Fetch

Call the get-template operation for each approved ID. The HTML field is commonly `htmlContent`,
but verify the live tool schema. Leave personalization such as `{{ contact.FIRSTNAME }}` intact.
Render at target width, trim blank space, and send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

### Audit adaptations

Always REFERENCE ONLY, no scale factor, per-template modules, no cross-template deduplication in
v1, and foundations from the first three templates. v1 reads email templates only, not campaigns
or automations. Mark the audit partial when those contain the production library.
