# Host integration

Apply the section for the assistant that is actually running this task. A copied prompt mentioning another product does not change the host. Preserve the same domain recipes and operation boundaries in every host.

## Repository instructions

- **Codex:** use the active repository instructions, including applicable `AGENTS.md` files and narrower directory rules according to the host's scope and precedence. Follow any instructions already supplied with the task.
- **Claude Code:** use the active `CLAUDE.md` or `.claude/CLAUDE.md`, applicable nested instructions, and matching `.claude/rules/` rules. Honor `AGENTS.md` when the host loads it or the repository explicitly adopts it; its presence is not a reason to ignore Claude instructions. Managed and user instructions remain governed by Claude's precedence.
- Do not replace one host's instruction files with the other's, create compatibility shims, copy personal settings into a repository, or treat every discovered Markdown file as instructions. If two applicable rules conflict, resolve through the active host's instruction hierarchy and the user's explicit scope; ask only when that leaves a material ambiguity.

## Claude Cowork and cloud sessions

Use the project files and tools actually shared with the session. A local Claude Code marketplace installation does not itself enable the plugin in a claude.ai account or a Cowork workspace. Select the enabled plugin skill from that surface’s picker; use the namespace the host exposes. Apply any active workspace instructions the host supplies, including `CLAUDE.md`, without reaching into unrelated local folders or accounts.

Repository inspection and documentation can use available file tools. Git history, a terminal, a browser, package installation or a connected service must be present before a recipe can rely on them. Do not assume the user’s local checkout path exists inside Cowork’s environment or that a connector response is an editable filesystem. Return the requested evidence or artifact through the host’s supported output surface, and identify unavailable execution checks. The package requires no shell expansion in skill frontmatter or dynamic `!` commands.

## Invocation and reference paths

In Codex, invoke a skill with `$vibe-review` or the plugin picker. In Claude Code, use the plugin namespace, such as `/vibe-coding:vibe-review`; the entry skill is `/vibe-coding:vibe`. These are assistant invocations, not shell commands. The same skill directory and recipe IDs serve both hosts.

Resolve Markdown links relative to the instruction file that contains them, using the plugin or skill directory exposed by the host. The repository being worked on remains the task's working directory. Do not resolve a plugin-relative `../../references/` link from the user's repository, assume a fixed cache location, or edit installed plugin caches. The Codex `agents/openai.yaml` files are discovery metadata, not separate agents to run in Claude.

## Tools and execution

Use only capabilities exposed in the current session. In Claude Code, use its available file, search and terminal tools and its permission modes; do not call Codex app APIs or assume a Codex task scheduler exists. In Codex, use its available tools; do not assume Claude commands, hooks or settings are installed. A recipe's instruction to inspect, edit or verify describes an outcome, not a required tool name.

Honor the active host's plan mode, filesystem boundaries and tool approvals. A skill cannot elevate permissions, switch off a sandbox, or turn an inspection request into authorization to edit. If repository access, a browser, provider credentials or a required check is unavailable, report that specific gate. A chat-only or cloud surface without the needed repository/tools cannot establish a runtime pass.

Keep plans and results in the current conversation. Creating another task/session, delegating, scheduling or publishing requires authorization from the user or an applicable authorized workflow plus an available capability. Do not translate a planning recipe into an automatic subagent call. Do not change the user's model, account, memory or host settings to run a workflow.
