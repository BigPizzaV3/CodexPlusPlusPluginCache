---
name: mermaid-diagrams
description: Author, import, safely edit, preview, repair, validate, and optionally render portable Mermaid diagrams and multi-diagram Markdown. Use for Mermaid source, flowcharts, sequences, states, classes, ER models, mind maps, architecture, Gantt, timeline, or Kanban diagrams.
---

# Mermaid diagrams

Create editable Mermaid source that communicates the requested relationship clearly. Use `scripts/mermaid_tool.py` for deterministic file operations. Read `references/v2-contract.md` and validate authored JSON against `references/canonical-v2.schema.json`; use `references/edit-markdown-v1.schema.json` for targeted Markdown edits.

## Routes

- New work: choose a diagram family with `references/diagram-selection.md`, build canonical v2 JSON, then run `create`. Structured builders cover flowchart, sequence, state, class, ER, mind map, architecture, Gantt, timeline, and Kanban.
- Existing source: run `import` for `.mmd`, `.mermaid`, or Mermaid-enabled Markdown, edit canonical diagrams, and `export` a new document.
- Targeted Markdown edit: use `edit-markdown` with a persistent marker ID, or a one-based fence index plus the expected source SHA-256. This route preserves every byte outside the selected fence body and refuses ambiguous or stale edits.
- Diagnosis: run `lint`; use `repair` only for syntax-preserving normalization.
- Preview: run `preview --format svg|html`. Structured diagrams receive a deterministic, script-free structural preview. Raw Mermaid requires an explicitly requested compatible local renderer.
- Rendering: default to source-only. Use `--render auto|required` only when the user requests rendered output and an existing `mmdc` runtime is available.

Prefer stable ASCII IDs, concise labels, conservative syntax, and multiple small diagrams over one unreadable graph. Preserve IDs, diagram order, and comments inside raw Mermaid source when editing canonical JSON. Use the compatibility profile `11.16.1` for structured builders; pass an explicit `--target-version` only when the user names another target and retain version-profile warnings. Reject remote resources, raw HTML, JavaScript, external images, URL-bearing styles, and unsafe directives by default.

Always report evidence precisely. `lint` performs the documented static subset, not a complete Mermaid parse or semantic proof. Structural SVG/HTML previews are not host-rendering evidence. Static validation and controlled adapter tests are not renderer acceptance; a rendered artifact proves only the exact recorded local `mmdc` invocation.
