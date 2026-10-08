# Migration to the open-format collection

## Version 2.0 to version 2.1

Version 2.1 keeps the canonical root discriminator `version: 2`, all existing command names, default output formats, overwrite behavior, and ordinary v2 inputs. It adds separate version-1 operation schemas for targeted edits and reordering.

- Mermaid canonical documents remain compatible. New structured kinds are architecture, Gantt, timeline, and Kanban. Use `edit-markdown` rather than import/export when surrounding Markdown must remain byte-identical. Structural previews are new and do not prove host rendering.
- Modelica canonical projects remain compatible. Imports can recover visual graphs created by this skill's hash-bound metadata; other valid annotations stay untouched and are reported as uninterpreted. Use `edit` for staged, source-preserving package changes and `preview` for structural SVG/HTML. Compiler checks remain off unless explicitly requested.
- Portable mind maps remain compatible. Generated Markdown now round-trips supported metadata; GraphML and generated Mermaid can be imported. Route new merging to `merge-safe`; legacy `merge` retains incoming-subtree replacement behavior. `diff`, `reorder`, and structural preview are additive.

The new JSON Schema files are an authoring aid and strict public contract. Runtime validation remains authoritative for cross-reference integrity, cumulative limits, path safety, safe source grammar, and other constraints JSON Schema cannot fully express.

## Version 1 to version 2

- Canonical inputs now carry `version: 2` and use the unified `mermaid_tool.py`, `modelica_tool.py`, or `mindmap_tool.py` command families.
- Existing Mermaid source and Markdown can be imported directly.
- Existing directory-form Modelica packages can be imported; visual data is added only when requested, and existing graphics require explicit replacement authorization.
- Existing v1 Markdown, OPML, and FreeMind mind maps can be imported; richer metadata is represented in canonical JSON and conversion loss is reported per target format.
- The v1 generators remain in the v2 bundles for explicit legacy workflows, but new skill instructions route to the v2 tools.

In 2.0.x, importing Markdown extracts Mermaid fence bodies into a canonical document; it does not preserve unrelated Markdown for a later rewrite. Modelica import validates and preserves source files but does not reconstruct the canonical visual graph from existing annotations. Version 2.1 adds explicit, bounded routes for those needs without changing legacy command behavior.

## Earlier product-line migration

Version 0.3.0 establishes a three-plugin collection:

- Install `mermaid-diagrams` for Mermaid source and Mermaid-enabled Markdown.
- Install `modelica-projects` for portable `.mo` package trees and static structural checks.
- Install `portable-mindmaps` for Markdown, OPML 2.0, and FreeMind-compatible `.mm`.

Earlier proprietary notebook and proprietary Modelica runtime integrations are retired and are not distributed. Existing generated files remain under the user's control, but the collection no longer creates, validates, imports, launches, or claims compatibility with those proprietary formats or applications.

The Modelica plugin now guarantees portable source structure only. Compilation, simulation, rendering, and physical validation require independently selected tools and separately reported evidence.
