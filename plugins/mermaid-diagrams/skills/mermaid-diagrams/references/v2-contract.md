# Mermaid 2.1 contract

The canonical root requires `version: 2`, `title`, optional `description`, and `diagrams`.

Each diagram requires a unique ASCII `id`, `title`, `kind`, and either structured `data` or raw `source`. Optional fields are `description`, `accessibility`, and `styles`. Unknown fields are rejected.

Structured kinds are `flowchart`, `sequence`, `state`, `class`, `er`, `mindmap`, `architecture`, `gantt`, `timeline`, and `kanban`. Use `raw` for another statically recognized Mermaid family. Structured syntax targets the pinned Mermaid `11.16.1` compatibility profile. `architecture`, `timeline`, `kanban`, and `mindmap` are version-sensitive; a different explicit `--target-version` produces a warning. Architecture edge labels remain in canonical metadata and structural previews because the pinned source grammar has no edge-label production.

Validate authored documents with `canonical-v2.schema.json`. The runtime additionally enforces semantic references, source safety, active-content rejection, supported style properties, 64 diagrams, 4,000 structured items, 256 styles per diagram, 8 MiB output, and the tighter source limits documented by the bundled validator.

```bash
python3 scripts/mermaid_tool.py create spec.json output.md --format md
python3 scripts/mermaid_tool.py import existing.md canonical.json
python3 scripts/mermaid_tool.py lint canonical.json
python3 scripts/mermaid_tool.py export canonical.json output.mmd --format mmd
python3 scripts/mermaid_tool.py edit-markdown SOURCE.md EDITS.json OUTPUT.md
python3 scripts/mermaid_tool.py preview canonical.json preview.svg --format svg
```

Raw export requires exactly one diagram. Markdown and JSON support multiple diagrams.

Markdown import extracts Mermaid fence bodies into canonical raw diagrams. It retains source inside those bodies, including Mermaid comments, but does not store unrelated prose. Use `edit-markdown` when preserving the surrounding document matters. Its strict version-1 edit schema selects each block by persistent marker ID, or by one-based index plus the expected body SHA-256. It refuses duplicate targets, ambiguity, stale hashes, reserved portable metadata, and malformed fences; it preserves every byte outside the selected body, including line endings, indentation, delimiter length, info string, comments, and unrelated Markdown.

`preview` generates script-free, external-resource-free SVG or self-contained HTML. Structured previews communicate the canonical topology and labels; they are structural evidence, not Mermaid renderer or host parity evidence. Raw-source preview requires an explicitly requested local `mmdc`.

`--render off` is the default. Rendering applies only to `.mmd` and `.mermaid` source outputs and requires an already-installed local `mmdc`; the plugin never downloads it. `auto` produces source-only success with a disclosure when the executable or its version is unavailable. `required` fails without an identifiable renderer, and invoked rendering installs source and rendered output transactionally. A successful report records the exact executable and version. The 2.1 release gate uses controlled adapter tests because no real `mmdc` is installed; that is not native Mermaid rendering proof.
