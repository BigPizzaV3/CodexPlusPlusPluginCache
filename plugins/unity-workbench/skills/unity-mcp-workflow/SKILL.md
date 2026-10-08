---
name: unity-mcp-workflow
description: Use when working on Unity projects with Codex, especially when selecting or connecting a Unity MCP provider, validating Unity Editor connectivity, debugging scenes/prefabs/scripts, or deciding what Unity workflows should be automated.
---

# Unity MCP Workflow

Use this skill when the user asks Codex to work with Unity or to connect Codex to Unity through MCP.

## Surface And Workspace Limits

First determine whether the current surface can actually inspect the user's Unity project.

In Chat mode without an attached workspace, repository files, or local filesystem access, do not claim that you can connect to or inspect the user's Unity project. Explain that Unity Essentials can guide the user conceptually from information they provide, but it cannot verify `Assets/`, `Packages/manifest.json`, Unity Editor state, or MCP configuration from plain chat alone. Recommend using Codex with the Unity project folder open when the user wants the plugin to inspect files, detect MCP setup, or validate the Unity connection.

In Codex with a workspace or local files available, inspect the real project before giving connection instructions.

Do not tell the user to install this Codex plugin, its internal package name, or any previous package name as if it were a Unity-side MCP requirement. Unity Essentials is a workflow plugin for Codex, not a Unity Editor MCP bridge. The Unity-side bridge should be one of the actual Unity MCP providers detected or selected below.

When there is no workspace, use language like:

```text
I cannot inspect or connect to your Unity project from this chat alone because I do not have access to the project folder or Unity Editor state here. I can explain the setup conceptually from what you paste, but for automatic project detection and MCP validation, open the Unity project in Codex and ask me there.
```

## MCP Discovery First

Before recommending or installing any Unity MCP provider, check whether the project already has one.

Look for evidence in:

- `Packages/manifest.json`
- `Packages/packages-lock.json`
- embedded packages under `Packages/`
- project folders or package names containing `mcp`, `unity-mcp`, `com.unity.ai.assistant`, `coplay`, `ai-game`, `ivanmurzak`, or `codergamester`
- existing MCP client config files such as `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, or other repo-documented MCP setup
- active MCP tools already available to Codex in the current thread

If a Unity MCP is already installed, do not recommend adding another one by default. Prefer using and validating the existing bridge first. Multiple Unity MCP bridges can duplicate tools, confuse tool selection, increase token usage, and make debugging harder.

If no MCP evidence is found, state that no Unity MCP was detected and ask whether the user wants to add one. If they do, guide them through choosing exactly one provider that fits their situation. If they do not, continue with repository-only workflows and clearly report that Unity Editor actions, console reads, scene inspection through the Editor, and live validation are unavailable.

## Provider Selection

Prefer this order unless the user explicitly asks for a specific provider:

1. Official Unity MCP: choose this when the project uses Unity 6 or newer, has the AI Assistant package available, and the user has the needed Unity AI trial or subscription. It is the most conservative default because it is documented by Unity and requires explicit approval for direct external clients.
2. CoplayDev/unity-mcp: choose this when the user wants a popular open-source bridge, needs broad editor automation, or cannot use the official Unity AI package. Inspect the current repository documentation before giving install commands because the project evolves quickly.
3. IvanMurzak/Unity-MCP: consider this when the user wants a full AI development loop, generated skills, runtime/in-game MCP behavior, or a CLI-first setup.
4. CoderGamester/mcp-unity: consider this when the user wants a Node.js-backed open-source Unity Editor bridge with Codex/Cursor/Claude-style client support.

Do not silently install a community MCP server into a Unity project. Explain the tradeoff and ask for confirmation before installing packages or running installer commands that modify the project.

Use these questions to choose a provider:

- If the user wants the official/supportable path and has Unity 6 plus Unity AI access, choose Official Unity MCP.
- If the user wants the most popular open-source bridge with broad editor automation, choose CoplayDev/unity-mcp.
- If the user wants generated agent skills, CLI setup, many built-in tools, or runtime/in-game AI workflows, choose IvanMurzak/Unity-MCP.
- If the user wants a lighter Node.js-backed open-source Editor bridge, choose CoderGamester/mcp-unity.
- If the project already has one provider installed, use that provider unless there is a clear reason to replace it.

## Connection Workflow

Before using Unity MCP tools or claiming Unity is connected:

1. Identify the current Unity project root. Check for `Assets/`, `Packages/manifest.json`, and `ProjectSettings/ProjectVersion.txt`.
2. Check the Unity version from `ProjectSettings/ProjectVersion.txt`.
3. Determine whether any MCP provider is already installed or configured.
4. Verify the editor is open and the MCP bridge/server is running.
5. If direct approval is required in Unity, tell the user exactly where to approve the client.
6. Run a low-risk probe first, such as reading the scene hierarchy or console messages.

If no Unity MCP provider is installed or configured, the correct connection guidance is:

1. Explain that no Unity MCP was detected in the project.
2. Ask whether the user wants to add an MCP bridge.
3. If yes, choose one provider using the provider-selection rules below and follow that provider's current official/repository setup instructions.
4. If no, continue without MCP using normal repository tools and report the limitations.

Never replace this flow with a request to install Unity Essentials or any Codex-side plugin again.

When a workspace exists but no MCP is detected, use language like:

```text
I found the Unity project, but I do not see a Unity MCP bridge configured in this project yet. I can keep working from repository files only, or I can help you choose and add one Unity MCP provider. Do you want to add an MCP bridge?
```

For official Unity MCP, remember:

- The Unity MCP bridge is configured in `Edit > Project Settings > AI > Unity MCP`.
- The local relay is installed under `~/.unity/relay/`.
- Manual client configuration points to the relay executable with `--mcp`.
- Direct external clients require approval in Unity.

For community providers, inspect the installed package and repository docs in the current turn before relying on remembered setup details.

## Installation Policy

- Install at most one Unity MCP provider per project unless the user explicitly asks for a multi-provider experiment.
- Do not install all known MCPs.
- Do not add, update, or remove Unity packages without explicit user confirmation.
- If an MCP exists but appears broken, troubleshoot it before suggesting replacement.
- If replacement is justified, explain the migration plan and ask before making changes.
- Prefer a small connection proof before deeper automation: read Unity version, read console, or inspect scene hierarchy.

## Unity Work Rules

- Read local project files and Unity state before proposing changes.
- Preserve user scene, prefab, and asset changes. Do not revert Unity-generated files unless the user explicitly asks.
- Prefer Editor-safe changes over hand-editing YAML assets. Hand-edit `.prefab`, `.unity`, or `.asset` YAML only when the format and object IDs are understood.
- For script edits, respect existing assembly definitions, namespaces, serialization, and Unity lifecycle conventions.
- After script changes, check compile errors through Unity console or available project build/test commands.
- For prefab/scene changes, verify the actual object path and component wiring after edits.
- For play-mode or destructive actions, explain the action and get user confirmation if it can modify runtime state, assets, or open scenes.

## Useful Unity Capabilities To Offer

When the user asks what else would be useful for Unity, suggest capabilities like these:

- Connection doctor: verify Unity version, MCP provider, relay/server process, package install, and client approval state.
- Console triage loop: read console errors, map them to scripts/assets, patch the cause, and re-check.
- Scene/prefab inspector: summarize hierarchy, missing scripts, broken references, inactive objects, and suspicious component values.
- Serialized reference tracer: follow prefab/fileID/GUID links from YAML into scripts, materials, sprites, addressables, and localized assets.
- Test runner helper: run EditMode/PlayMode tests and summarize failures.
- Build readiness checks: inspect build target, scenes in build, scripting backend, addressables, define symbols, and common platform issues.
- Asset hygiene checks: find missing meta files, duplicate GUIDs, large assets, unused assets, texture import issues, and audio compression problems.
- Custom MCP tool authoring: create project-specific Editor tools for repetitive tasks such as localization validation, prefab audits, or scene setup.
- XR/mobile checks: inspect input actions, quality settings, safe-area layout, touch gestures, and platform-specific player settings.

## Helper Scripts

This plugin includes `scripts/unity_mcp_advisor.py`. Use it for a quick local recommendation from a Unity project path and an optional provider:

```powershell
python "%PLUGIN_ROOT%\scripts\unity_mcp_advisor.py" --project "C:\path\to\UnityProject" --provider official
```

Provider values: `auto`, `official`, `coplaydev`, `ivanmurzak`, `codergamester`.

The script reports existing MCP evidence before recommending a provider.
