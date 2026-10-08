---
name: portable-mindmaps
description: Author, import, revise, safely merge, diff, reorder, preview, repair, and validate portable mind maps as JSON, rich Markdown, OPML, FreeMind XML, Mermaid, and GraphML. Use for mind maps, concept maps, brainstorming trees, and nested outlines.
---

# Portable mind maps

Use one canonical rooted tree with stable node IDs, then export only the portable representations the user needs. Run `scripts/mindmap_tool.py` for deterministic operations. Read `references/v2-contract.md`, validate canonical inputs against `references/canonical-v2.schema.json`, and validate explicit reorder requests against `references/reorder-v1.schema.json`.

## Routes

- New map: author canonical v2 JSON and run `create`.
- Existing JSON, generated Markdown, OPML, `.mm`, GraphML, or generated Mermaid mind-map source: run `import`, revise the canonical document, then `export` it.
- Focused work: use `extract` for a subtree, `diff` for a machine-readable comparison, and `reorder` for an explicit order-only change.
- Merge: route to `merge-safe`, which merges by stable ID and defaults conflicts to `error`. Use `--conflict base|incoming` only when the user states that policy. The legacy `merge` command remains deprecated compatibility behavior that replaces a matching subtree; warn before any explicit legacy use.
- Diagnosis: run `lint`; use `repair` only to normalize into canonical v2 without inventing hierarchy.
- Preview: run `preview --format svg|html --layout right|down|radial` for a deterministic, script-free structural preview.

Default exports remain Markdown, OPML, and FreeMind-compatible XML. Select JSON, Mermaid mind-map source, or GraphML with `--formats`. Generated Markdown round-trips supported metadata through deterministic comments while remaining a readable outline. Preserve hierarchy and stable IDs; report deterministic metadata loss whenever a target cannot represent notes, links, tags, status, priority, or cross-links.

All imports and transformed results pass through the same canonical validator. Reject DTD/entity-bearing XML, invalid URLs or priorities, duplicate IDs, dangling cross-links, excessive depth/count, duplicate output formats, symlink paths, and overwrite attempts.

Do not generate proprietary archives, automate desktop applications, or modify an application's library. Static checks do not prove native import fidelity or layout.
