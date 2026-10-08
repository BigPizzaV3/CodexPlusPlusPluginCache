# Repository maintenance

This repository is the public source for the `matt-skills-curated` ChatGPT/Codex plugin.

- `skills/` is flat and contains only public, curated Skills.
- Every Skill must have `SKILL.md` and `agents/openai.yaml`.
- Every packaged Skill is model-invoked in this curated edition so the router can reach it automatically. Do not add manual-only invocation flags to public Skills.
- `engineering-workflow-guide` is the model-invoked router and its catalog must cover every other packaged Skill exactly once.
- Keep upstream provenance and MIT attribution accurate.
- Do not exclude a Skill solely because upstream called it misc or beta. Promote useful capabilities after portability, safety, dependency, and quality review; exclude only duplicates, host-specific surfaces, deprecated material, telemetry, credentials, symlinks, or generated noise.
- Run `python3 scripts/validate_plugin.py` and deterministic double packaging before committing a release.
