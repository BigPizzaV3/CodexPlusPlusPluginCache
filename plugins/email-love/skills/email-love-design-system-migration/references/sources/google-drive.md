## Source adapter: Google Drive

Use this when email HTML, EML, PNG, or JPEG files live in a Drive folder. Requires a Google
Drive MCP connected to your Codex session. The reference implementation is the
[official Google Drive MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive).
Tool names vary, so inspect the connected server's catalog instead of assuming them.

### Discover

Ask for the folder URL or ID, extract `{folder_id}`, and confirm which Google account authorized
the MCP. List files whose parent is that folder and filter to `text/html`, `message/rfc822`,
`image/png`, and `image/jpeg`. Report the folder name, ID, count, and format breakdown. Above
roughly 50 files, ask the customer to narrow by filename, modified date, or subfolder.

### Fetch

Read each approved file by ID. HTML is rendered at target width. EML contributes its
`text/html` MIME part, then is rendered. Decode image files to a temporary file and use them
directly without upscaling. Send each PNG through [module-conversion.md](../module-conversion.md),
Phase 3 step 1.

### Audit adaptations

Use the Local Folder rules: always REFERENCE ONLY, no scale factor, per-file modules, no
cross-file deduplication in v1, and foundations from the first three files. Include
`https://drive.google.com/file/d/{file_id}/view` in every report row.

Google OAuth scope is a common failure. `drive.readonly` can see files the user may read;
`drive.file` generally sees only app-created or picker-opened files. If a known non-empty folder
looks empty, verify scope before concluding there is no content.
