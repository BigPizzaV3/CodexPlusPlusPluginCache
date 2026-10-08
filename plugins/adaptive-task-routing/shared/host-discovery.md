# Host discovery

Load only the matching guide when an enabled gate needs missing or stale metadata:

- [Codex CLI, Codex App and ChatGPT](hosts/openai.md)
- [Claude Code](hosts/claude.md)
- [Gemini CLI](hosts/gemini.md)

These guides provide read paths, not permission to change the host. Keep one shared
decision policy; do not fork Skill descriptions by platform. A capability guide for
another host may ship in the same package without being applicable there.

Stop after a bounded attempt per relevant source. A missing executable, unavailable
host bridge, denied permission, timeout or mismatched scope is a discovery result,
not a reason to launch inference, scan unrelated sessions or alter configuration.
If only the user can inspect the selector, ask once when an exact choice matters;
otherwise deliver task needs and follow the matching host's documented fallback and
user-decision behavior.

Every result should answer: what was attempted, what was observed, which context it
applies to, and what remains unknown. Reuse unchanged observations for the session;
invalidate them after manual model/effort changes, new contexts or host changes.
