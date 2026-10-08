## Source adapter: HubSpot

Requires the [official HubSpot MCP](https://developers.hubspot.com/mcp) connected to your Codex
session. Use the marketing-email operations on the broader CRM and marketing server.

### Discover

Inspect the live tool catalog. Ask whether to walk marketing emails, reusable email templates,
or both. Most customers want marketing emails because they contain sent designs. Filter marketing
emails to published by default, sort by last modified, and report the count. Above roughly 50
items, ask the customer to narrow.

### Fetch

Call the get-item operation and verify the rendered HTML field in the current schema; common API
names include `emailBody`. Render at target width, trim blank space, and send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

### Audit adaptations

Always REFERENCE ONLY, no scale factor, per-item modules, no cross-item deduplication in v1,
and foundations from the first three items. Personalization tokens may remain in the render.
Smart content and dynamic CTAs render only their default variant, so the customer must rebuild
conditional logic and CTA-library links in the target ESP. State this on the affected rows.
