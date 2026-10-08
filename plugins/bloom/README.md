# Bloom MCP plugin

Bloom Labs, Inc. is a Y Combinator company from the **P25 batch**.

Connect ChatGPT, Codex, Claude, or Cursor to the Bloom design canvas through Bloom's hosted MCP
server. This repository contains only connection metadata, Bloom branding, and a short bootstrap
skill. The server and its detailed authoring guidance remain hosted by Bloom.

The MCP URL is **https://api.bloom.diy/mcp**. It uses Streamable HTTP and browser OAuth. Sign in with
a Bloom account that has Canvas access. Your client cannot see or call Bloom tools before it has a
valid connection, and access stops if Canvas access is removed. Project permissions still apply to
each tool.

## Install

- **ChatGPT and Codex:** use the Bloom listing in the Plugins Directory when published, or add the
  remote MCP URL directly in a client that supports Streamable HTTP and OAuth.
- **Claude:** add Bloom as a custom connector, or install the Bloom plugin bundle when listed.
- **Cursor:** install this public repository as a plugin when listed, or add the MCP URL in Settings.

Until marketplace review finishes, follow the [connection guide](https://docs.bloom.diy/connect-bloom-mcp)
for exact client steps. After connecting, ask your client to call Bloom's `whoami` tool. The live
server exposes current tool schemas and the `skills` guide for canvas authoring.

The plugin has no local executable, bundled backend code, static token, or required API key.
