# First-Time MCP Server Setup

Read this for first-time MCP configuration or optional proxy installation. Steps 1-3 configure direct HTTP access. Step 4 adds a proxy that keeps the client session open while Unreal is unavailable.

The goal is three things:
1. Enable the `ModelContextProtocol` and `AllToolsets` plugins in the project.
2. Make the editor auto-start the MCP server on launch.
3. Configure the connection Codex reads to connect.

Walk the user through them in order. Do not skip the user's `.uproject` edit silently. Confirm the file path first.

## 1. Enable the plugins in the `.uproject`

Two plugins are required. `ModelContextProtocol` is the server and transport; `AllToolsets` provides the tools. With only `ModelContextProtocol` enabled the server starts but exposes no tools.

Open the project's `.uproject` file. In the `Plugins` array, ensure both entries:

```json
{
  "Name": "ModelContextProtocol",
  "Enabled": true
},
{
  "Name": "AllToolsets",
  "Enabled": true
}
```

If the array doesn't exist, create it. If either entry exists with `"Enabled": false`, flip it to `true`.

`AllToolsets` is an editor-only aggregator with `EnabledByDefault` off, so it must be enabled explicitly. To expose only a subset of tools, enable the specific toolset plugins you want instead of `AllToolsets`.

## 2. Enable auto-start

The default is for the MCP server to stay stopped. To start it manually in a session, run `ModelContextProtocol.StartServer` from the editor console.

To start it automatically on every editor launch, add the snippet below to the per-user editor config file:

`<Project>/Saved/Config/<Platform>Editor/EditorPerProjectUserSettings.ini`

This is the file the editor writes when you toggle the setting in Editor Preferences. It is per-user and not source-controlled.

```ini
[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]
bAutoStartServer=True
```

Optional overrides if the defaults conflict with another local service:

```ini
ServerPortNumber=8000
ServerUrlPath=/mcp
```

A command-line alternative also works: pass `-ModelContextProtocolStartServer` (and optionally `-ModelContextProtocolPort=<port>`) to the editor. Prefer the `.ini` because it's persistent.

## 3. Configure Codex

This Codex plugin already supplies the default `http://127.0.0.1:8000/mcp` connection through root `mcp.json` (portable hosts) and `.mcp.json` (legacy hosts). With that bundled connection enabled, skip manual client configuration. For a different endpoint, update both plugin MCP files and refresh the installed plugin. Configure one Unreal connection, not both the bundled connection and a duplicate manually configured connection.

For a manually managed connection instead of the bundled one, the editor does not write `.codex/config.toml` on its own. Either run a console command from inside the editor, or hand-write the file.

**From a running editor (preferred):** run `ModelContextProtocol.GenerateClientConfig Codex` in the console. Codex uses TOML and the writer refuses to overwrite an existing `.codex/config.toml`. Edit that one by hand if it already exists, preserving unrelated configuration.

The destination depends on the build kind:

- **Source build** (your repo contains `Engine/`): the file is written to the workspace root, alongside `Engine/`. Not next to the `.uproject`.
- **Installed/launcher build**: the file is written next to the `.uproject`.

**Without launching the editor first** (for example, scripting a fresh-project bootstrap), hand-write `.codex/config.toml` at the location matching your build kind above:

```toml
[mcp_servers.unreal-mcp]
url = "http://127.0.0.1:8000/mcp"
```

Adjust the URL if the port or path was overridden in step 2.

## 4. Optional: install the proxy

Use this option if you want the client session to survive editor shutdown and startup. The editor must still run for live tool calls.

Check whether your engine includes `Engine/Plugins/Experimental/ModelContextProtocol/Extras/Proxy`. If it is absent, keep the direct HTTP setup.

Choose the binary for the operating system where the MCP client runs:

| Platform | Binary under `Extras/Proxy` |
|---|---|
| Windows x64 | `Bin/Win64/unreal_mcp_proxy.exe` |
| macOS arm64 | `Bin/Mac/unreal_mcp_proxy` |
| Linux x64 | `Bin/Linux/unreal_mcp_proxy` |
| Linux arm64 | `Bin/LinuxArm64/unreal_mcp_proxy` |

The proxy installer operates on `.mcp.json`, not Codex's TOML configuration. For this optional proxy path, first generate a workspace `.mcp.json` using `ModelContextProtocol.GenerateClientConfig ClaudeCode` (the command selects the JSON format). Then run the matching command from `Extras/Proxy`, using the actual configuration path. Do not point it at the plugin's bundled MCP files.

Windows PowerShell:

```powershell
.\Bin\Win64\unreal_mcp_proxy.exe --mcp-json "C:\path\to\.mcp.json" install
```

macOS:

```bash
./Bin/Mac/unreal_mcp_proxy --mcp-json "/path/to/.mcp.json" install
```

For Linux, use `Bin/Linux` or `Bin/LinuxArm64` instead of `Bin/Mac`.
An explicit `--mcp-json` path also supports projects outside the engine directory tree.

The installer replaces the HTTP entry with a STDIO `unreal-mcp-proxy` entry. It keeps the original entry under `_upstreamEntry`. Configure one Unreal connection, not both the proxy and a duplicate direct HTTP connection.

For Codex, transfer the generated proxy entry's exact `command` and `args` into `[mcp_servers.unreal-mcp-proxy]` in `.codex/config.toml`, preserving the absolute `--mcp-json` path. The proxy reads the recorded upstream entry from that JSON file. Disable the plugin's bundled direct connection and remove any manually configured direct duplicate before enabling the proxy. The JSON installer alone does not configure Codex.

Restart the MCP client once after installation so it loads the changed configuration. Later editor shutdowns do not require stopping the proxy. If an editor integration automatically replaces `.mcp.json`, disable that integration's automatic client-configuration writes.

To restore the direct HTTP entry, run the same command with `uninstall` instead of `install`. In Codex, also remove the manual proxy table and restore either the bundled connection or the manual direct connection from step 3. Reload the client configuration afterward.

The proxy stores catalogs in the operating system's user cache directory. Scope includes configuration path, proxy path, engine build identity, and client protocol version. It does not supply a fixed Unreal tool catalog. See the engine's `Extras/Proxy/README.md` for cache behavior and transport limits in your build.

## Verifying

After the editor is running with the plugin enabled and auto-start on:

- The Output Log shows MCP server startup messages.
- `list_toolsets` (one of the three tool-search meta-tools) returns successfully.
- Codex's MCP connection view shows `unreal-mcp`, or `unreal-mcp-proxy` when installed, and a live tool call succeeds.

A connected proxy or visible cached tools do not prove that Unreal is reachable. Confirm with a successful read-only Unreal tool call.

If any of these fail, see `operations.md` for recovery commands.
