# Creator Workspace

A curated ChatGPT and Codex plugin built from five open-source workflow repositories by Charlie Hills.

The public product name is **Creator Workspace**. Its public display name is **Creator Workspace**, while its Marketplace package identifier remains `creator-workbench` for compatibility with the existing published plugin identity.

It connects five jobs that are usually split across different prompts and folders:

1. remember useful context
2. create from that context
3. keep the user's actual voice
4. retrieve the right context instead of dumping the whole archive
5. carry corrections forward without turning every choice into a permanent rule

## The loop

```text
Second Brain
    |
    v
Workspace Recall
    |
    v
Relevant context
    |
    +------> Voice Builder
    |          or Voiceprint
    v
Content workflow
    |
    +------> Show Me when the result should be visual
    |
    v
Save Progress
    |
    +------> durable rules / lessons / project state
```

## Included

- local second-brain setup
- ChatGPT and Claude export importer
- living wiki maintenance
- workspace recall and narrow context retrieval
- context and idea briefs
- create-from-brain workflow
- written-sample voice builder
- spoken-transcript Voiceprint workflow
- 17 social-media creation and analytics workflows
- self-contained HTML visual handoff
- durability-based Save Progress memory workflow
- deterministic Python helpers
- ChatGPT/Codex skill metadata for every public skill

## Architecture

Skills-only. No MCP server is required.

The package can use host-native file, Python, web, email, calendar, or other capabilities when they are actually available. It does not invent those capabilities.

See `docs/ARCHITECTURE.md` and `docs/CONVERSION-MATRIX.md`.
