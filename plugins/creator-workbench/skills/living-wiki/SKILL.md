---
name: living-wiki
description: Turn raw research and imported notes into a maintained linked markdown wiki. Use when the user asks to process research, update their second brain, build topic pages, connect notes, or check wiki health.
---

# Living Wiki

## Source boundary

`brain/raw` and imported conversation files are evidence. `brain/wiki` is synthesized knowledge.

Never edit source files merely to make the wiki cleaner.

## Ingest

For each new source:
1. identify its main claims and useful facts
2. preserve source title, date, and path or URL when available
3. update existing topic pages instead of creating near-duplicates
4. create a new concept page only when it has a distinct job
5. add links to related pages
6. update the index

## Contradictions

When sources disagree:
- keep both claims
- record provenance
- mark the disagreement
- do not silently choose the nicer story

## Health check

Check for:
- orphan pages
- duplicate concepts
- stale index entries
- contradictory claims without provenance
- pages that are only summaries and never synthesize
- missing source references

## Deterministic helper

When available:

```bash
python3 scripts/wiki_index.py brain/wiki brain/_index.md
```

This indexes files. It does not replace semantic synthesis.

## Completion

State what sources were processed, what pages were added or updated, and what remains uncertain.

## Creator Workspace handoff

After indexing or synthesis, use `workspace-recall` when the user asks what the workspace knows or when another creation skill needs focused context.
