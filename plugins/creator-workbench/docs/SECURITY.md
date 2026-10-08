# Security and privacy

- The package contains no secrets or API tokens.
- It declares no remote MCP server.
- AI conversation exports and research files should be processed locally when possible.
- Bundled scripts do not make network requests.
- Source exports are not modified by the importer.
- Workspace writes require user-authorized mutation.
- External connectors are optional host capabilities and must not be claimed unless present.
- Save Progress must not place one-off overrides into durable shared memory.
- Voiceprint should be used on the user's own speech or content they are authorized to edit.
