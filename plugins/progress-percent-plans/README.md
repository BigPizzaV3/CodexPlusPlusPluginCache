# Progress Percent Plans

Progress Percent Plans is an always-on plugin for Codex. It keeps a visible completion percentage on every meaningful step of a multi-step plan and updates those percentages as implementation, research, review, and testing progress. Once its lifecycle hooks are trusted, users do not need to name or invoke the skill in their prompts.

The percentages represent evidence-backed completion of each named step. They are not elapsed-time measurements or delivery estimates.

## What it does

- Prefixes each plan step with `[NN%]`.
- Keeps plan status and completion percentages consistent.
- Updates progress at material checkpoints and whenever the user asks for status.
- Preserves evidence-backed progress after interruptions.
- Re-injects the policy on every prompt, resume, compaction, and subagent start.
- Avoids creating ceremonial plans for trivial one-step requests.

## Contents

- `.codex-plugin/plugin.json` — plugin manifest.
- `skills/progress-percent-plans/SKILL.md` — workflow instructions and activation boundary.
- `hooks/` — lifecycle configuration and local, network-free context injectors.
- `assets/` — original plugin logo and composer icon.

## Privacy

This plugin has no MCP server, authentication, analytics, network integration, or external storage. Its local hook receives standard Codex lifecycle input on stdin, ignores that input, and emits only a fixed planning instruction. See [PRIVACY.md](PRIVACY.md).

## Support

Open an issue in this repository. See [SUPPORT.md](SUPPORT.md) for the information that helps diagnose a problem.

## License

MIT. See [LICENSE](LICENSE).
