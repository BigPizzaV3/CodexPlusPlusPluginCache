# molecular workspace

Structure Viewer combines a familiar molecular object explorer with a large interactive canvas, optional sequence and command surfaces, and a task-oriented analysis workbench. The Codex viewer is powered by Mol\* and exposes bounded scientific actions rather than an unrestricted programming interpreter.

## One scene for scientists and Codex

Every visible molecular operation and model request acts on the same authenticated viewer session and revisioned scene. The **Structure** inspector lists the complete structure, loaded molecular objects, individual chains, ligands, named selections, measurements, density maps, and saved scenes. **Components** rows use one **Actions** menu whose five operation groups act only on the selected row.

| Control             | Direct behavior                                                                                                               | Typed agent actions                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Action**          | Focus, select, analyze, measure, align loaded objects, save a scene, apply a preset, or manage an object.                     | `focus`, `select`, `analyze`, `measure`, `align`, `preset`, `save_scene`, `restore_scene`, `remove_object`, `derive_object` |
| **Show**            | Add a representation to the chosen object or selection. **Show only** explicitly replaces existing representations.           | `show`, `show_as`                                                                                                           |
| **Hide**            | Hide the chosen representation, molecular object, density map, or measurement without confusing visibility with deletion.     | `hide`, `object_visibility`, `volume_visibility`, `measurement_visibility`                                                  |
| **Label**           | Add, resize, or hide targeted atom, residue, or chain labels.                                                                 | `label`                                                                                                                     |
| **Color**           | Color the target by element, chain, residue, B-factor, other supported properties, or an explicit color.                      | `color`                                                                                                                     |
| Workspace controls  | Toggle the explorer, sequence, measurements, command console, Workbench, or Render; choose atom/residue/chain/object picking. | `workspace`                                                                                                                 |
| Camera and timeline | Focus, orient, zoom, clip, or navigate to a trajectory frame.                                                                 | `camera`, `clip`, `frame`                                                                                                   |
| Scene history       | Return to an earlier scene or reapply a previously reversed operation.                                                        | `undo`, `redo`                                                                                                              |

Molecular objects and selections support all five operation groups within the **Actions** menu. Density-map rows intentionally expose only **Action / Show / Hide**: evaluate the exact nonempty current selection in the selected density at 1σ, correlate it with another actually loaded map, or change its visibility. Detailed contour, color, opacity, zoning, and map-style controls remain in the Workbench; density rows do not advertise nonexistent label or object-color operations.

Discover supported actions, representations, and the current `sceneRevision` from the current viewer rather than assuming that every loaded object has the same capabilities:

```json
{
  "tool": "structure.molecular_actions",
  "arguments": {
    "sessionId": "11111111-1111-4111-8111-111111111111"
  }
}
```

Execute one authenticated, revision-aware action through the shared molecular action tool. The current `expectedRevision` is mandatory; missing or stale revisions are rejected before the scene changes:

```json
{
  "tool": "structure.molecular_action",
  "arguments": {
    "sessionId": "11111111-1111-4111-8111-111111111111",
    "expectedRevision": 7,
    "action": {
      "kind": "show",
      "representation": "sticks",
      "target": {
        "kind": "residue",
        "chain": "A",
        "residue": 57
      }
    }
  }
}
```

The action preserves the existing full-protein representation. A subsequent element-color action can target the same residue:

```json
{
  "kind": "color",
  "target": {
    "kind": "residue",
    "chain": "A",
    "residue": 57
  },
  "color": {
    "kind": "element"
  }
}
```

Workspace presentation and molecular picking have the same authenticated agent coverage:

```json
{
  "tool": "structure.molecular_action",
  "arguments": {
    "sessionId": "11111111-1111-4111-8111-111111111111",
    "expectedRevision": 8,
    "action": {
      "kind": "workspace",
      "explorerVisible": true,
      "sequenceVisible": true,
      "measurementsVisible": false,
      "commandConsoleVisible": false,
      "workbenchVisible": true,
      "renderPanelVisible": false,
      "selectionGranularity": "residue"
    }
  }
}
```

Provide at least one option. Explicit `false` hides its corresponding interface element without deleting scene data. `workbenchVisible` and `renderPanelVisible` control the same mutually exclusive drawers as the visible Workbench and Render buttons; requesting both at once is rejected, while setting either or both to `false` is valid. Render remains subject to its existing availability checks, and opening its panel never starts a render, writes an artifact, or grants workspace consent. Picking granularity accepts only `atom`, `residue`, `chain`, or `object`. The legacy `structure.control_viewer` action `set_workspace_options` accepts the same seven fields for the current authenticated session.

An explicitly user-saved **Save Project** manifest may preserve these seven preferences in a strict `presentation` version 1 section. **Open Project** restores them only after the source and every dependency are authenticated, the molecular scene commits, and the viewer becomes ready. A deferred restore accurately reports `presentationPending: true` and `presentationRestored: false`; it must not be described as already restored. Measurement visibility requires atom picking; the Workbench and Render drawers cannot both be open. Older projects without presentation remain valid. Presentation stores no command history, session credential, token, filesystem path, or Cartesian coordinate, and is never written as an unrelated global preference.

The ribbon's **Structure**, **Mode**, **Entity**, **Chain**, and **Layout** controls use a shared `sequenceView` workspace option. Its partial updates accept `objectId`, `mode: "all" | "chain" | "everything"`, `entityId` (or `null` for all entities), `layout: "wrapped" | "single-line"`, and `chain` (or `null` to reset). A chain descriptor contains the actual `authAsymId`, `labelAsymId`, `labelEntityId`, `instanceId`, and current `modelId`. Obtain these from an atom/residue `structure.query` page for the intended object; use its `entityId` as the descriptor's `labelEntityId`, and do not substitute display chain labels for a blank author ID. The model context and successful command receipt return the same resolved view used by the ribbon.

For **Show known sequence**, send `sequenceView: { "showKnownSequence": true }`, optionally with `objectId` and `layout`. It chooses the first majority-known polymer in that same object; it never invents identities for source `UNK` residues or changes the molecular selection. Do not combine the shortcut with a chain, entity, or mode override. Unknown/ambiguous identities and refreshing inventories are rejected; a previously chosen chain that disappears is shown as unavailable, never replaced by another assembly copy. Per-object filters and scroll positions are retained during the session. These new ribbon filters are intentionally **session-only**: project presentation still stores only the seven established preferences, because native model UUIDs change on reparse.

Loaded molecular objects can be genuinely aligned without opening another viewer:

```json
{
  "tool": "structure.molecular_action",
  "arguments": {
    "sessionId": "11111111-1111-4111-8111-111111111111",
    "expectedRevision": 9,
    "action": {
      "kind": "align",
      "mobileObjectId": "ap5a_bound",
      "referenceObjectId": "primary",
      "method": "structure"
    }
  }
}
```

Both objects must already be loaded and have distinct stable IDs; the primary reference cannot be the moving object. Use `structure`, `sequence`, or `atoms` for the chosen alignment method, and report RMSD, aligned count, and any available directional TM or sequence scores. The direct `align` action superposes whole objects; use `structure.align_structures` when a chain, residue set, or explicit atom pairing must define the fit. Displaying two objects near one another does not establish that they were aligned.

Use the returned scene revision for the next mutation. An outdated revision requires a fresh `structure.get_state` read; it never justifies opening a replacement viewer or guessing which object the user selected.

## Representation and visual semantics

The canonical representations are:

```text
cartoon  backbone  putty  surface  gaussian_surface
ball_and_stick  sticks  lines  points  spheres  ellipsoid
carbohydrate  gaussian_volume  label  orientation  plane
polyhedron  interactions
```

**Show** is additive. Starting with a protein cartoon, showing a ligand or selected side chain as `sticks` keeps the protein context intact. Connected side-chain sticks include the appropriate polymer anchor rather than appearing as disconnected fragments. `sticks` draws genuine connected bond cylinders without atom spheres; `ball_and_stick` separately draws visible atom spheres and bonds; and `lines` is a separate, intentionally thinner representation. The old primary-display `ballStick` option maps to `ball_and_stick`, while the old `stick` option maps to `lines`. **Show only** is the explicit replacement action.

`carbohydrate` uses source-backed carbohydrate symbols; `interactions` displays computed noncovalent contacts. Component `plane` is a colored molecular slice, and component `orientation` displays per-unit ellipsoids. Saved selection principal axes and best-fit planes are separate `structure.manage_guides` operations. The component display options and per-layer `representationOptions` remain typed, bounded `structure.apply_scene` inputs; shared computed-interaction parameters apply object-wide, while layer targets determine which contacts are shown. `interaction_type` coloring belongs to the interaction representation; `carbohydrate`, `illustrative`, and enumerated `native` color themes do not grant access to arbitrary plugins or external data.

The RCSB component presets are `empty`, `automatic`, `atomic_detail`, `polymer_cartoon`, `polymer_and_ligand`, `protein_and_nucleic`, `coarse_surface`, `illustrative`, `molecular_surface`, and `automatic_detail`. The existing `protein_ligand`, `binding_site`, `confidence`, and `publication` presets remain available. Invoke them through `structure.molecular_action` with `action.kind: "preset"`, the `preset` name, and an exact `target`. `presentation: "workbench"` requires an unscoped `{ "kind": "all" }` target and matches the whole-workspace UI operation; `presentation: "scoped"` applies to the specified object/region. There is no separate model tool named `structure.apply_preset`.

The `confidence` preset requires mapped embedded pLDDT metrics and complete molecular-object targets. It supports the whole workbench or whole objects; partial-object targets reject explicitly. Missing QA remains unavailable and missing scores stay gray. **Raw B-factor** is a separate property-coloring choice and does not establish prediction confidence.

The [RCSB inspector tool map](CAPABILITY_MATRIX.md#rcsb-workspace-capabilities) covers the additional construction, View/background, QA/PAE, symmetry, density/motif, image/animation, and model/geometry export controls. These use canonical model-visible tools even where their transport helpers are app-only. Browser clipboard/download buttons remain host delivery gestures; the model produces the equivalent authorized artifact without inventing a user gesture or clipboard permission.

For catalytic residues, binding sites, and interface views, prefer:

1. A complete protein cartoon as the background context.
2. Selected side chains or a ligand as a separate connected-stick layer.
3. Conventional element colors for the focused atoms.
4. Restrained, optional residue labels.
5. A camera focused on the relevant region without clipping the whole molecular context.

Object visibility, representation visibility, label visibility, deletion, and creation of a derived molecular object are distinct operations. Label `mode: "atom" | "residue" | "chain"` produces genuinely distinct atom, residue, and chain labels in both the live viewer and exported PNG/JPEG/WebP/MP4 scenes. Source coordinates remain immutable; a derived object is created only when explicitly requested.

Visible distance, angle, and dihedral measurements also survive both PNG and MP4 rendering. A distance uses the existing `from` and `to` targets and is labeled in Å; an angle adds `kind: "angle"` with exactly one intermediate `via` target; and a dihedral uses `kind: "dihedral"` with exactly two ordered intermediate targets. Angles and dihedrals use degrees. Stable resolved atom identities keep each overlay synchronized with molecule or trajectory motion, while exact Cartesian coordinates remain private to the app and are never included in model-visible measurement or storyboard state.

## Safe object actions and selected-set analysis

The **Action** menu exposes genuine, source-safe molecular operations:

- **Save as named selection…** stores the exact selected atoms under an explicit safe name.
- **Save current scene…** preserves the complete current revisioned scene under an explicit safe name.
- **Extract into new structure…** creates an explicitly named derived object and deletes only the complement of the chosen chain, ligand, named selection, or style layer from that copy.
- **Derive solvent-free copy…** creates an explicitly named derived object and removes only its water atoms.
- **Rename chain in new copy…** creates a derived object and changes its selected chain to a user-provided one- or two-character alphanumeric ID; it never renames the source chain.
- **Align to primary structure** genuinely superposes a loaded secondary molecular object on the fixed primary structure.
- **Measure distance to selection** reports the closest real atom-pair distance in Å between the chosen target and the distinct current selection.
- **Analyze contacts to selection** computes contacts between those exact selections at a 4 Å cutoff.
- **Residue exposure (>50 Å²)** retains every atom of the complete parent object as the solvent-occluding context while restricting protein-chain output to actual protein residues, not crystallographic waters.
- **Find contacts within 4 Å** analyzes the actual chosen ligand and its molecular environment.

Each operation compiles to the authenticated `select`, `save_scene`, `derive_object`, `align`, `measure`, or `analyze` action. Derivations leave every original molecular object and source file unchanged; naming requires an explicit bounded user-provided value.

## Safe molecular selection dialect

The optional command surface accepts a bounded, typed molecular language. Supported selection patterns include:

| Selection                  | Meaning                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `chain A+C`                | Chains A and C.                                                            |
| `resi 19+23+26`            | Residues with those author residue numbers.                                |
| `resn HEM`                 | A residue or component named HEM.                                          |
| `name CA+CB`               | Atoms named CA or CB.                                                      |
| `elem O+N`                 | Oxygen or nitrogen atoms.                                                  |
| `polymer.protein`          | Protein polymer atoms.                                                     |
| `organic` or `solvent`     | Organic molecular components or solvent.                                   |
| `%catalytic`               | The existing named selection `catalytic`.                                  |
| `organic around 4`         | Atoms within 4 Å of the organic selection, excluding the target itself.    |
| `byres (organic around 4)` | Complete residues surrounding the organic selection.                       |
| `/primary//A/57/CA`        | The CA atom in residue 57 of chain A on object `primary`.                  |
| `model primary`            | Object `primary` when the molecular dialect is explicitly selected. |

Boolean `and`, `or`, and `not`, safe parenthesized expressions, bounded distance queries, residue/chain/object expansion, and bounded bonded-neighbor expansion compile to the same `SelectionExpr v1` used by the graphical explorer and model tools. The established native dialect still interprets `model` as a biological model ID. Author chain identifiers, residue numbers, insertion codes, assembly-instance identity, and loaded object identity are preserved.

These familiar commands compile directly to typed, authenticated actions:

```text
select catalytic, chain A and resi 57+102+195
show sticks, catalytic
show ball_and_stick, catalytic
as cartoon, polymer.protein
hide spheres, catalytic
color element, catalytic
label catalytic, resi
zoom catalytic
distance catalytic, organic
angle catalytic, chain A, chain B, chain C
dihedral backbone, chain A, chain B, chain C, chain D
align comparison, primary, structure
clip far, 20
scene catalytic, store
frame 2
undo
redo
```

`show` adds a representation; `as` explicitly replaces it. User-facing frames start at one, so `frame 2` selects internal frame index one. Named selections remain molecular references, not executable variables.

The command surface is not Python, a shell, a script runner, a file browser, or a network client. Unsupported commands and untrusted executable input are rejected before any scene mutation.

## Absolute and relative residue exposure

Solvent-accessible surface area requires the complete surrounding molecular environment. To find residues with absolute exposure above 50 Å², calculate the primary structure's surface once, aggregate atoms by residue, and optionally restrict which residues are returned:

```json
{
  "tool": "structure.analyze",
  "arguments": {
    "sessionId": "11111111-1111-4111-8111-111111111111",
    "expectedRevision": 8,
    "kind": "sasa",
    "selections": [
      {
        "kind": "object",
        "objectId": "primary"
      },
      {
        "kind": "component",
        "component": "protein",
        "objectId": "primary"
      }
    ],
    "options": {
      "sasaAggregation": "residue",
      "minAreaSquareAngstrom": 50,
      "probeRadiusAngstrom": 1.4,
      "sasaSamples": 240
    }
  }
}
```

The first selection defines all occluding atoms. The optional second selection restricts output residues without removing their surrounding environment. For a protein-chain subset, intersect that chain with `protein` so water molecules sharing the chain are not mislabeled as protein residues; the water atoms still remain in the full occluder context. Never calculate residues separately in isolation: doing so incorrectly treats buried atoms as solvent-exposed.

For relative residue exposure, use:

```json
{
  "sasaAggregation": "residue",
  "relativeSasaReference": "tien_2013_maximum",
  "minRelativeExposurePercent": 50
}
```

Absolute exposure uses **square ångströms (Å²)** in `areaSquareAngstrom`. Relative exposure uses **percent (%)** in `relativeExposurePercent`, calculated from the residue-specific Tien 2013 observed maximum in `referenceAreaSquareAngstrom`. Tien percentages are valid only at the standard **1.4 Å solvent probe**: a nonstandard probe can return absolute Å², but its reference and percentage remain null and explicit relative requests fail closed. A threshold of 50 Å² is not equivalent to 50% exposure; both thresholds select values strictly greater than the threshold. Unknown or unsupported residue types receive null reference and relative values instead of an invented alanine reference. Because the reference contains observed rather than theoretical maxima, a legitimately exposed residue can exceed 100%. Preserve author chain and residue numbering, insertion code, model, assembly instance, object identity, the complete molecular environment, output scope, probe radius, sampling density, method, reference, result coverage, and truncation when interpreting results.

For a two-partner interface, `totalSasaLossSquareAngstrom` is the combined exposure lost by both partners; `interfaceAreaSquareAngstrom` and the compatibility-preserving `buriedAreaSquareAngstrom` report the one-sided area, equal to half the total loss. Do not report either geometric measurement as binding affinity, binding energy, or experimentally measured solvent exposure.

## Safety and provenance

- Reuse the existing authenticated viewer session; never open a second viewer to recover from an action failure.
- Read the current scene revision before composing mutations and honor optimistic-concurrency conflicts.
- Keep source files immutable; create derived objects or workspace artifacts only when explicitly requested.
- Preserve workspace-root confinement, source identity, exact author numbering, and symmetry-instance identity.
- Keep atom catalogs and result pages bounded; disclose result truncation and preserve analysis provenance.
- Never execute arbitrary scripts, Python, JavaScript, shell commands, or network/file operations through the molecular command surface.
