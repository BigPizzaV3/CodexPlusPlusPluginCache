# Upstream compatibility

Source project: `garrytan/gstack`

Reviewed upstream version: `1.68.3`
Reviewed upstream commit: `85fd9db554ae4aaaa6d356d2daf873121ee85bdd`
Plugin adaptation version: `0.1.0`

## Compatibility model

The plugin is skills-first. Portable workflows run with host-native ChatGPT or Codex capabilities. Native browser, iOS, pairing, gbrain, and local runtime features are optional. A compatible Codex host may use an already installed original gstack runtime after reading its current installed Skill.

The package intentionally does not hard-code `~/.claude/skills/gstack` as a requirement. This avoids turning Claude-specific installation paths into a ChatGPT/Codex dependency.

## Updating from upstream

1. Review the latest upstream `AGENTS.md`, root `SKILL.md`, and specialist `SKILL.md` files.
2. Compare public workflow names and behavior with `skills/`.
3. Preserve user-visible intent, decision gates, evidence requirements, and safety controls.
4. Do not copy runtime-only assumptions into CHAT workflows.
5. Update this file's upstream version and commit.
6. Run `python3 scripts/validate_plugin.py .`.
7. Package twice and compare SHA256 before release.
