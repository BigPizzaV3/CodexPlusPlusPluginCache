# Claude Code discovery

Specification check: 2026-09-11. Prefer live metadata already exposed to this session.
Do not install instrumentation or launch a second inference session to discover it.

1. Use host-provided current model/effort metadata. If the user already exposes a
   status-line observation, its `model.id` and `effort.level` can describe that session;
   check the observation time and installed version. Do not create or overwrite a
   status-line command merely for this Skill. Absent fields in older payloads are
   unknown, not automatically unsupported.
2. If necessary, have the user inspect `/model` for actual selector options/current
   choice and `/effort` for effort options on versions supporting that command. These
   are user controls, not shell commands the agent can send to a new Claude process
   to change the parent. Ask once, and do not block work that needs no exact choice.
3. Explicitly provided model/effort settings or narrowly read applicable settings can
   be labeled configuration hints. Do not dump full settings or credentials. Account,
   provider, environment overrides and session changes may differ from saved values.

Preserve aliases such as an adaptive/plan selection as configured policies, not an
assertion of one concrete model on every turn. Main-thread, subagent and Skill-level
overrides have different scopes. Do not add `model` or `effort` frontmatter to these
Skills to force a setting: that changes invocation behavior and bypasses routing mode.
Use only options verified for the installed host/model; no fixed effort list is bundled.

Use runtime descriptions, then exact-product official capability guidance as needed.
Neither API catalog listings nor advertised model aliases prove account availability.
Read access does not establish switching or new-context capability. When automatic
operation is unavailable, retain the independent recommendation and describe only
the verified user control, without claiming `applied`.

Sources: [model configuration](https://code.claude.com/docs/en/model-config) and
[status-line metadata](https://code.claude.com/docs/en/statusline).
