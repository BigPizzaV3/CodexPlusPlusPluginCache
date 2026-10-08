# Agent compatibility

The canonical skill lives at `skills/proofread`. The repository installer maps
supported clients onto three discovery locations to avoid duplicate skill
entries:

| Discovery group | Path |
| --- | --- |
| Universal agents | `.agents/skills/proofread` |
| Codex | `.codex/skills/proofread` |
| Claude Code | `.claude/skills/proofread` |

Universal discovery covers Gemini CLI, GitHub Copilot, Cursor, OpenCode,
Windsurf, and Devin. Use the installer rather than creating every possible
native path manually.

```bash
node scripts/install-agent-skill.mjs install --scope project
node scripts/install-agent-skill.mjs install --scope user
node scripts/install-agent-skill.mjs check --scope user --json
```

The default install uses links; add `--copy` where links are unsuitable. The
installer preflights every target and refuses to overwrite conflicts.

The skill does not require Claude plugins or another prose-editing skill. Harper
CLI is optional and invoked only when installed; the agent must disclose when it
skips that baseline. Optional companion skills are capability-detected at use
time as described in [interoperability.md](interoperability.md); they are never
installed or assumed by this package.
