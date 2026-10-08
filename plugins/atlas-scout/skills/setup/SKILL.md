---
name: atlas-scout-setup
description: Install, configure, verify, troubleshoot, or remove the Atlas Scout runtime and Codex integration when the user asks for Atlas Scout setup help.
---

# Set up Atlas Scout for Codex

Atlas Scout requires a separately installed `atlas-scout` executable. Never download or execute a
binary, alter operating-system security controls, or change the user's Codex configuration without
their explicit approval.

1. Check whether `atlas-scout` is already on `PATH` with `atlas-scout --version`.
2. If it is absent, ask the user to review <https://atlasscout.dev/docs>, including the preview and
   platform-safety disclosures. The supported installer is <https://atlasscout.dev/install.sh>.
3. After approval, download the installer to a temporary file for inspection before running it.
4. Verify the runtime and workspace:

   ```bash
   atlas-scout --version
   atlas-scout doctor --workspace /absolute/path/to/project
   ```

5. When this plugin was installed from the Zaguán Labs Codex marketplace, its bundled `.mcp.json`
   starts `atlas-scout mcp`. Start a new Codex thread and confirm the Atlas Scout tools are present.
6. If the server cannot start, check the executable path and run `atlas-scout doctor`. If Atlas Scout
   was also registered manually, remove or disable the duplicate so only one server starts.

Installing or removing this open plugin wrapper does not install or remove the proprietary Atlas
Scout runtime, and removing the runtime does not delete workspace indexes unless the product
documentation explicitly says so.
