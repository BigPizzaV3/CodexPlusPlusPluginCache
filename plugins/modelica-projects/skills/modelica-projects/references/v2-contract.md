# Modelica 2.1 contract

The canonical root requires `version: 2`, `package`, `description`, `mslVersion`, `languageVersion`, `dependencies`, and `files`. Unknown fields are rejected.

Each file supplies a safe relative `.mo` path, source, kind, optional documentation flags, and optional `visual` object. Visual data supports:

- `direction`: `LR` or `TB`;
- `coordinateSystem`: two finite points;
- declared `components` with optional origin, size, and rotation;
- declared boundary `connectors` on left, right, top, or bottom;
- `connections` with declared endpoints and optional points, color, pattern, and thickness;
- icon primitives: `Rectangle`, `Ellipse`, `Polygon`, `Line`, and `Text`.

```bash
python3 scripts/modelica_tool.py create spec.json output --relayout
python3 scripts/modelica_tool.py import ExistingPackage canonical.json
python3 scripts/modelica_tool.py lint ExistingPackage
python3 scripts/modelica_tool.py repair ExistingPackage canonical.json
python3 scripts/modelica_tool.py edit ExistingPackage patch.json RevisedPackage
python3 scripts/modelica_tool.py preview spec.json preview.svg --format svg --class Demo.System
python3 scripts/modelica_tool.py lint ExistingPackage --compiler auto
```

Validate canonical projects with `canonical-v2.schema.json`. The runtime additionally resolves local instance and connector references where possible, reports unresolved external-library members as static warnings, rejects malformed indexed endpoints, and limits source and generated outputs to 8 MiB.

Automatic layout is deterministic and topology-aware: it condenses strongly connected components, preserves declaration order, supports LR/TB orientation, keeps boundary connectors on class edges, routes to component boundaries, and assigns collision-aware orthogonal tracks. Supplied placements remain intact unless relayout is explicit. Existing graphical annotations remain intact unless replacement is explicit.

`import` recovers visual data only from the hash-bound portable metadata emitted by this skill. Supported standard annotations then round-trip through the canonical graph. Other valid annotations remain untouched in source and generate an uninterpreted-visual warning; the tool does not claim a full Modelica parser.

Package metadata is read from `package.mo`, including escaped descriptions and versioned `uses` entries. If an imported package does not declare a Modelica Standard Library version, import reports that it used the documented `4.1.0` canonical fallback; this is static metadata normalization, not compilation evidence.

The version-1 `edit` schema selects safe relative `.mo` paths and supports `add-file`, `set-visual`, and explicit `repair` operations for `within` clauses or line endings. Edits occur in staging, never in place. Untouched files remain byte-for-byte identical, new classes update the necessary `package.order`, ambiguous source rewrites fail, and output must be outside the input project.

`preview` produces script-free, external-resource-free structural SVG/HTML. `lint --compiler off` is the default. `auto` uses an already-installed `omc` when identifiable and otherwise returns static success with disclosure; `required` fails when unavailable. The skill never installs a compiler. No real compiler or graphical runtime is installed for the 2.1 release gate, so compilation, simulation, native rendering, numerical behavior, physical validity, and cross-tool visual parity remain unexecuted evidence classes.
