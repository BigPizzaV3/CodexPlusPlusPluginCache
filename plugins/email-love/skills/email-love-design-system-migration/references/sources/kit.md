## Source adapter: Kit

Requires the [official Kit MCP](https://developers.kit.com/mcp/kit-mcp) connected to your Codex
session with OAuth. Kit, formerly ConvertKit, stores useful email HTML in Broadcasts, Sequences,
and Templates. Ask which pools to include before discovery.

### Discover

Inspect the live MCP tool catalog, call the appropriate list operations for the selected pools,
sort locally by last modified, and report counts by pool. Above roughly 50 items, ask the
customer to narrow before fetching.

### Fetch

Call the matching get-item operation and read the HTML field identified by the live schema.
Render at target width, trim blank space, and send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

### Audit adaptations

Always REFERENCE ONLY, no scale factor, per-item modules, no cross-item deduplication in v1,
and foundations from the first three items. Include the pool type, Broadcast, Sequence step, or
Template, on every report row.
