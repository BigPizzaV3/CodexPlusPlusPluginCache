# Diagnostic workflow

## Contents

1. Establish the evidence surface
2. Source-fidelity gate
3. Classify the target before inspecting details
4. Walk from the root to the symptom
5. Compare against a known-good peer
6. State the hypothesis before writing
7. Preserve repair integrity

Use this order so the visible symptom does not dictate an unmeasured structural change.

## 1. Establish the evidence surface

Capture each available surface independently:

1. Figma canvas screenshot.
2. Email Love plugin Preview.
3. Production HTML from `emaillove_export_figma` with `operationType: "preview"`.
4. Desktop and mobile renders from `emaillove_preview_email`.
5. Supplied exported HTML, ESP result, or inbox screenshot.

Write which surface first shows the failure. A canvas-only problem is not automatically an export
problem, and a clean canvas does not clear the exporter.

## Source-fidelity gate

Set two authorities before inspecting toward a repair:

- **Structural authority:** supplied or production HTML for the structure it contains; otherwise
  the source component and the packaged render contract.
- **Visual authority:** the user-approved original comp, migration audit, or desktop and mobile
  source references. A screenshot submitted to report a defect is symptom evidence unless the user
  says it is the target design.

Record conflicts between authorities instead of resolving them from the current broken canvas. Do
not write until the intended width, inset, radius, responsive composition, and affected node
mapping are settled or explicitly unknown - and if an unknown can change the proposed mutation,
resolve it first. A user-visible region name may not match the library component name: map visible
copy to the proof instance and then to the source component before editing anything.

## 2. Classify the target before inspecting details

- **Email template:** root has `nodeType = mainFrame`; direct children are `mj-wrapper` nodes or
  instances.
- **Reusable module:** root is a COMPONENT tagged `mj-wrapper`; no `mainFrame` exists in its tree.
- **Library instance:** target is an INSTANCE whose main component carries valid Email Love tags.
- **Not Email Love:** no valid root or wrapper evidence. Route out of this skill.

Do not add a `mainFrame` marker to a reusable module or an `mj-wrapper` tag to an email root. That
changes the product shape rather than repairing it.

## 3. Walk from the root to the symptom

Record the full ancestor chain and check:

- shared `emaillove` tag or root marker;
- node type and direct-child relationship;
- visibility;
- auto-layout direction, sizing, padding, alignment, and `itemSpacing`;
- fills, strokes, and radii that the exporter interprets;
- component or instance boundary;
- mobile shared-plugin-data keys;
- href, alt text, raw token, and component-property bindings where relevant.

An unrecognized helper frame higher in the chain can flatten every correctly tagged leaf beneath
it. Always inspect ancestors before changing the leaf.

## 4. Compare against a known-good peer

Prefer evidence from the same file and library:

1. The main component behind the failing instance.
2. Another intact instance of that component.
3. A recent exported email using the same module.
4. The packaged render contract.

Do not copy private plugin data assumptions from a peer. External tools cannot read private plugin
data, and an existing private value can override the shared value you write.

## 5. State the hypothesis before writing

Use this compact record:

```text
Observed facts:
- <source or node id>: <direct observation>
Structural authority:
Visual authority:
Derived values:
- <result> = <inputs and calculation>
Inferences:
Unknown or pending:
Symptom:
First failing surface:
Failing node and ancestor:
Measured mismatch:
One proposed change:
Expected desktop result:
Expected mobile result:
```

Keep observations, derivations, and inferences separate. An observed value names its source and
node id; a derived value shows its inputs and calculation; an inference stays labeled until a
render proves it. Do not promote a plausible recommendation, a peer pattern, or a measurement of
the current broken state to a fact. Do not write while `Unknown or pending` contains anything that
can change the proposed node, geometry, or responsive behavior. If the proposed change has no
measurable expected result, it is not ready to apply.

Include only the fields that can affect this repair: a link or marker fix carries no geometry
lines, and geometry lines appear only when geometry is what changes.

## 6. Preserve repair integrity

- Make one change, read it back, then render.
- Treat an unchanged read-back as a failed write.
- Treat a clean read-back with a bad render as a disproven hypothesis.
- Revert disproven changes on the working copy.
- Compare text and image counts before and after a structural repair.
- Compare component-property counts and re-read every binding.
- Stop after two failed local patches on the same section and reconstruct that section from its
  authoritative source.
