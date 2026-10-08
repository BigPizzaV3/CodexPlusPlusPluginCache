# Execution environments and installation

## Runtime requirement

This skill contains instructions and Python 3.10+ standard-library scripts. Its host must supply a compatible Python interpreter, a way to run it, filesystem access for exports, and permission for outbound HTTPS requests to WHO GHO. There are no third-party package dependencies, service credentials, R requirements, or MCP requirements.

Resolve the client from the actual skill location and run `doctor` before the first retrieval in a new environment. Do not assume that a user's browser access proves that the script can reach WHO. If a request fails, distinguish missing Python, command restrictions, network permissions, and source availability using the returned error.

Do not replace TLS verification, alter proxy settings, disable a sandbox, install an unrequested runtime, or route around workspace restrictions to make a failed check pass. Report the concrete requirement and use the host's normal permission mechanism when available.

## Local Codex

The provided installers copy the skill to `~/.agents/skills/dsir-gho` and refuse an existing destination. Alternatively, copy the complete folder there manually. OpenAI documents user-level skills in `$HOME/.agents/skills` and repository skills in `.agents/skills`. Codex normally detects changes; restart if the skill is not visible. Invoke it with `$dsir-gho` in Codex CLI or the IDE extension. [Build skills](https://learn.chatgpt.com/docs/build-skills).

Local commands inherit the host's filesystem and network sandbox. Depending on the permission profile, internet access can require approval. Installing the skill does not change that profile. [Sandbox](https://learn.chatgpt.com/docs/sandboxing).

The installers accept a custom skill root for isolated tests:

```powershell
& .\packaging\install.ps1 -SkillsRoot 'C:\path\to\test-skills'
```

```sh
sh packaging/install.sh --skills-root /path/to/test-skills
```

They copy this folder to a `dsir-gho` child of that root. They do not register a plugin or execute the installed skill.

## ChatGPT Work

Work can run code and shell tools, subject to available capabilities and workspace controls. When present, **Settings > Data controls > Work network access > Allow public internet access** governs public internet access for code and shell commands. Enabling it does not override an administrator restriction. Search and browser permissions are separate. Changes take effect after the current run finishes and the environment refreshes. [ChatGPT Work overview](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview).

Use the skill only after it has been installed or made available through a supported route for that account and surface. Check Python and HTTPS capability in the actual execution environment. The documentation does not establish that every ordinary ChatGPT Python session has internet access.

## Sharing the package

The release ZIP is portable source material for the skill. A chat attachment or Custom GPT Knowledge upload is not represented as executable skill installation. The instructions cannot create tools or grant execution rights merely by being read.

OpenAI distinguishes standalone local skills, ChatGPT workspace skills, and plugins with bundled skills. Their installation and permission states are separate. [Skill controls](https://learn.chatgpt.com/docs/enterprise/skills).

A future skills-only plugin can package this folder without adding MCP. Portable plugin packages use a root `plugin.json` and `skills/<skill-name>/`; local marketplace installation is documented for the desktop app. Public distribution has a separate skills-only submission and review process. This standalone release does not publish such a plugin. [Plugin packaging](https://developers.openai.com/plugins/build/plugins), [Submit plugins](https://developers.openai.com/plugins/deploy/submission).

Once a plugin is available to a user's account, the documented flow is to open Plugins, inspect the plugin, select the plus button, and start a new chat. A plugin's availability does not guarantee that all its capabilities can run on every surface; host permissions still apply. [Install and use plugins](https://learn.chatgpt.com/docs/plugins).
