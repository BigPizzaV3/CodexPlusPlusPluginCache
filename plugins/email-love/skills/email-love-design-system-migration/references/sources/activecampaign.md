## Source adapter: ActiveCampaign

Requires the [official ActiveCampaign MCP](https://developers.activecampaign.com/page/mcp)
connected to your Codex session with OAuth. Use only read-side operations.

### Discover

Inspect the live tool catalog. Ask whether to walk campaigns, reusable templates, or automation
emails. Campaigns and templates usually carry the strongest design-system material. List the
chosen pool, sort locally by last modified, and report the count. Above roughly 50 items, ask the
customer to narrow.

### Fetch

Call the get-item operation and read `content`, `html`, or the field named by the live schema.
Render at target width, trim blank space, and send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

### Audit adaptations

Always REFERENCE ONLY, no scale factor, per-item modules, no cross-item deduplication in v1,
and foundations from the first three items. Record the pool and template type. Drag-and-drop
templates tend to convert more cleanly than raw HTML because their layout is more structured.
