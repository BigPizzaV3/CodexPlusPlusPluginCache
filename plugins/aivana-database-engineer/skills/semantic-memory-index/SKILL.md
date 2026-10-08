---
name: semantic-memory-index
description: Build a local token-vector memory index for deterministic retrieval without external embeddings.
---

# Semantic Memory Index

Use this skill to index runbooks, policy snippets, tickets, or schema notes for
local retrieval.

Run:

```bash
node runtime/runTool.js semantic_memory_index '{"documents":[{"id":"runbook-1","text":"orders latency after deploy compare query plans"}],"query":"deploy latency"}'
```

The tool stores index metadata in plugin memory and returns ranked token-overlap
matches.
