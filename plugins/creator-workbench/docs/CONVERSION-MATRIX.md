# Conversion matrix

Disposition values follow Plugin Autopilot: preserve_skill, compile_skill, reference_only, runtime_dependency, internal_only, discard.

| Upstream capability | Disposition | Result |
|---|---|---|
| social-media 17 skills | compile_skill | portable ChatGPT/Codex skills |
| Claude AskUserQuestion form | discard | normal conversational intake |
| Claude for Chrome niche research | compile_skill | current host web research |
| Apify-only post scoring | compile_skill | user data or available connector; heuristic fallback |
| Gemini-only image prompts | compile_skill | host-neutral visual workflows |
| AI Second Brain setup | compile_skill | second-brain-setup |
| AI export organization | compile_skill | conversation-importer |
| Karpathy wiki loop | compile_skill | living-wiki |
| /today and /ideas ideas | compile_skill | brain-briefs |
| /create idea | compile_skill | create-from-brain |
| Gmail / calendar / meeting sources | runtime_dependency | optional host connectors only |
| NotebookLM CLI login procedure | reference_only | not packaged as a dependency |
| iMessage Channels | reference_only | not a ChatGPT/Codex packaged capability |
| fixed 10 Claude sub-agents | discard | host decides parallel execution |
| voiceprint transcript method | preserve_skill | voiceprint |
| voiceprint trace algorithm | preserve_skill | scripts/voiceprint_trace.py |
| show-me HTML handoff | compile_skill | show-me |
| macOS Chrome focus proof | reference_only | use available preview/open capability |
| save-progress durability buckets | preserve_skill | save-progress |
| automatic session hook | discard | user-invoked only |
