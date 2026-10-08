## Source adapter: Omnisend

Requires the [official Omnisend MCP](https://mcp.omnisend.com/) connected to your Codex session
with OAuth.

### Discover

Inspect the live tool catalog. Ask whether to walk campaigns, automations, reusable templates,
or a combination. List the chosen pool, sort by last modified, and report the count. Above
roughly 50 items, ask the customer to narrow.

### Fetch

Call the get-item operation and read `html`, `content`, or the field named by the live schema.
Render at target width, trim blank space, and send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

### Audit adaptations

Always REFERENCE ONLY, no scale factor, per-item modules, no cross-item deduplication in v1,
and foundations from the first three items. Omnisend product blocks may render placeholder or
cached catalog data. The migration preserves the layout, not the live ecommerce wiring; say that
in the report so the customer knows to rebuild dynamic product logic in the target ESP.
