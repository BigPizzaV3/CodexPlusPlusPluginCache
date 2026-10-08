---
name: trinity-connect
description: Pair this Codex App or CLI installation with Trinity capture
---

Connect this Codex installation with the short-lived pairing code the user provided.

1. Resolve `<pluginRoot>` from this skill's installed path. This file is at
   `<pluginRoot>/skills/trinity-connect/SKILL.md`; confirm that
   `<pluginRoot>/dist/codex-connect.js` exists before continuing.
2. Ask to run the next command outside the Codex sandbox. It needs network access to
   exchange the code and writes the device credential under `~/.codex`; never print
   the pairing code.
3. Run `node "<pluginRoot>/dist/codex-connect.js" <pairing-code>`.
4. Run `node "<pluginRoot>/dist/codex-connect.js" --status` separately. If it is
   pending, wait one second and retry up to five times while this plugin's
   PostToolUse hook promotes the credential into its own data directory.
5. Report the final status output as-is. When connected, tell the user to start a
   new Codex task so capture begins at SessionStart.
