## Source adapter: SharePoint

Use this when source files live in a SharePoint site folder. Requires a Microsoft Graph MCP
connected to your Codex session with read access to that site. Microsoft's
[official Graph MCP](https://github.com/microsoftgraph/msgraph-mcp) is the canonical option.
Inspect its tool catalog because Graph MCP implementations expose different names.

### Discover

Ask for the exact SharePoint folder URL, confirm the authenticated tenant and site permissions,
then list HTML, EML, PNG, and JPEG files in that folder. Enterprise tenants may require admin
consent or per-site OAuth grants. Explain that setup dependency before promising a date. If the
path points to a general document library, ask for the templates subfolder. Above roughly 50
files, ask the customer to narrow the scope.

### Fetch

Read each approved file through the MCP. Render HTML at target width, extract and render the
HTML MIME part of EML, or decode images directly. Send the PNG through
[module-conversion.md](../module-conversion.md), Phase 3 step 1.

### Audit adaptations

Always REFERENCE ONLY, with no scale factor, per-file modules, no cross-file deduplication in
v1, and foundations from the first three files. Preserve each SharePoint file URL verbatim in
the report, including tenant-specific tokens.
