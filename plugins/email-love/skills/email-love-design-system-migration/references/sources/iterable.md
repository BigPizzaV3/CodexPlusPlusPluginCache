## Source adapter: Iterable

Requires [Iterable's official MCP](https://support.iterable.com/hc/en-us/articles/42936800222612-Overview-of-Iterable-s-MCP-Server)
connected to your Codex session. It is currently beta and is a self-hosted local npm deployment
rather than a hosted OAuth server. Setup requires an Iterable API key with template-read
permissions.

### Discover

Inspect the live tool catalog, then ask whether to walk templates, campaigns, or both. Templates
are the direct reusable pool; campaigns often contain the current production designs. List the
chosen pool, sort by last modified, and report the count. Above roughly 50 items, ask the
customer to narrow.

### Fetch

Call the get-item operation and verify the HTML field against its current schema. Render at target
width, trim blank space, and send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

### Audit adaptations

Always REFERENCE ONLY, no scale factor, per-item modules, no cross-item deduplication in v1,
and foundations from the first three items. Because the MCP is beta, record unexpected errors or
schema differences on the affected report rows for customer and Iterable feedback.
