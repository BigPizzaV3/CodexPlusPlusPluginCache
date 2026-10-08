# Portable mind-map 2.1 contract

The canonical root requires `version: 2`, `title`, optional `description`, one `root`, and optional `crossLinks`. Unknown fields are rejected.

Every node has `text` and `children`, plus optional stable `id`, `note`, `url`, `tags`, `status`, and priority from 1 to 9. Missing IDs are derived deterministically. IDs must be unique; cross-links must reference existing nodes; the hierarchy must remain a single acyclic tree.

```bash
python3 scripts/mindmap_tool.py create spec.json map
python3 scripts/mindmap_tool.py import existing.opml canonical.json
python3 scripts/mindmap_tool.py export canonical.json map --formats json,md,opml,mm,mmd,graphml
python3 scripts/mindmap_tool.py extract canonical.json node_id subtree.json
python3 scripts/mindmap_tool.py merge base.json incoming.json merged.json
python3 scripts/mindmap_tool.py merge-safe base.json incoming.json merged.json --conflict error
python3 scripts/mindmap_tool.py diff left.json right.json changes.json
python3 scripts/mindmap_tool.py reorder canonical.json order.json reordered.json
python3 scripts/mindmap_tool.py preview canonical.json preview.svg --layout radial
```

Validate canonical maps with `canonical-v2.schema.json`. Imports support canonical JSON, generated rich Markdown, un-namespaced OPML 2.0, FreeMind-compatible `.mm`, the documented GraphML subset, and Mermaid mind-map source emitted by this skill. DTDs and entity declarations are rejected before XML parsing, GraphML keys and endpoints are validated, and every imported or transformed document is revalidated against the canonical limits.

The legacy `merge` command remains available for version-2 compatibility and replaces an entire matching base subtree; it is deprecated and warns on use. Route new work to `merge-safe`. It merges nonconflicting nodes by stable ID, preserves unrelated branches, defaults conflicts to `error`, and accepts explicit `base` or `incoming` conflict policy. It reports conflicting parents, text, metadata, and order. `diff` emits a deterministic change report; `reorder` accepts only explicit per-parent child-ID arrays and never reparents nodes.

Generated Markdown remains a readable outline while deterministic comments preserve title description, IDs, notes, URLs, tags, status, priority, and cross-links. OPML uses standard `text` and documented category metadata while accepting the legacy private attributes. FreeMind and GraphML preserve cross-links in the supported subset. Every export emits precise per-format losses.

`preview` creates deterministic script-free, external-resource-free SVG/HTML in right-facing, downward, or radial layout. Structural preview is not proof of appearance or import in a third-party application. The skill never produces proprietary archives or automates an application library.
