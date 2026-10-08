# Integrated workflow graph

Creator Workspace is a directed workflow, not a bag of unrelated skills.

```text
                         creator-router
                               |
                +--------------+--------------+
                |                             |
        second-brain-setup             niche-research
                |                             |
      conversation-importer                   |
                |                             |
           living-wiki                        |
                +-------------+---------------+
                              |
                       workspace-recall
                              |
                  +-----------+-----------+
                  |                       |
             voice-builder            voiceprint
                  |                       |
                  +-----------+-----------+
                              |
                      create-from-brain
                              |
          +-------------------+--------------------+
          |                   |                    |
      post-writer      format-specific skills   analytics
          |                   |                    |
          +-------------------+--------------------+
                              |
                           show-me
                              |
                       save-progress
```

Execution helpers may support any node:
- `host-workspace-operator` for real workspace I/O
- `sandbox-python-executor` for deterministic computation and validation

## Required handoffs

| From | Condition | To |
|---|---|---|
| `second-brain-setup` | exports supplied | `conversation-importer` |
| `conversation-importer` | knowledge should become reusable | `living-wiki` |
| `living-wiki` | user asks what the workspace knows | `workspace-recall` |
| `workspace-recall` | output will be authored content | `create-from-brain` |
| `workspace-recall` | learned written voice is relevant | `voice-builder` profile |
| `workspace-recall` | literal spoken wording is required | `voiceprint` |
| `create-from-brain` | social post requested | `post-writer` |
| any creation skill | visual decision/artifact requested | `show-me` |
| analytics/import/provenance | computation is required | `sandbox-python-executor` |
| any file-mutating workflow | real workspace mutation is required | `host-workspace-operator` |
| any completed workflow | user explicitly asks to retain learning | `save-progress` |
