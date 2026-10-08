---
title: Advanced Local Edition
---

# Advanced local edition

The repository also contains `project-memory`, an advanced local development edition. It adds automatic Codex lifecycle hooks and complete raw transcript archiving outside Obsidian.

## When to use it

Use the advanced edition only when:

- complete session provenance is genuinely required;
- local policy permits storing conversations and code context;
- archive access, retention, backup, and deletion are controlled;
- the required local runtime is maintained;
- users understand and trust the installed hooks.

## Differences from the public edition

| Capability | Public edition | Advanced local edition |
|---|---:|---:|
| Durable Obsidian notes | Yes | Yes |
| Concise optional summaries | Yes | Yes |
| Raw transcript archive | No | Yes |
| Lifecycle hooks | No | Yes |
| Runtime dependency | No | Python |
| Public submission candidate | Yes | No |

## Privacy considerations

Raw transcripts may contain confidential code, credentials accidentally pasted by a user, customer data, or information outside the durable-note scope. Store archives only in approved locations and define retention and deletion policies.

The advanced edition is deliberately excluded from the public submission bundle.
