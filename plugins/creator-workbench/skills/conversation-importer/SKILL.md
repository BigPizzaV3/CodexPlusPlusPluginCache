---
name: conversation-importer
description: Import ChatGPT or Claude conversation-export JSON into local markdown files with metadata. Use when the user has exported AI history and wants it organized, searchable, or ready for a second brain.
---

# Conversation Importer

## Preferred execution

When the export is available in the workspace and Python exists, use the bundled script:

```bash
python3 scripts/conversation_importer.py INPUT OUTPUT_DIR
```

The script supports best-effort detection of common ChatGPT and Claude JSON export shapes.

## Safety

- never upload local exports to a third party just to parse them
- do not expose unrelated conversations in logs
- preserve the original export files
- write generated markdown to a separate output directory

## After import

1. inspect several generated files
2. verify dates and titles look plausible
3. use `living-wiki` for topic synthesis and linking
4. do not claim every export format is supported if the parser skipped records

## Fallback

If Python is unavailable, inspect the export structure with available file tools and convert a small verified batch rather than pretending the whole export was processed.

## Creator Workspace handoff

Use `sandbox-python-executor` for deterministic parsing when available. Hand imported markdown to `living-wiki` when the user wants reusable knowledge, then verify retrieval with `workspace-recall`.
