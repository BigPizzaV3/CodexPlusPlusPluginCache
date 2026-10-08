# Repair verification and report

Do not collapse these checks into one judgment. Report each state separately as `pass`, `fail`, or
`deferred`.

## Canvas state

- Take a fresh screenshot of the repaired target.
- Compare it with the baseline and the user's intended design.
- Confirm no new clipping, overlap, missing content, alignment shift, or unexplained spacing.
- Confirm the repair copy is clearly named and the original is still present when copy-first repair
  was required.

Evaluate desktop and mobile canvas fidelity independently. Desktop passes only when the repaired
target matches the authoritative desktop intent and no unaffected desktop composition regressed.
Mobile passes only when a mobile source or documented expected stack, order, visibility, inset,
and surface perimeter exist and match; when no separate mobile source exists, record the mobile
canvas comparison as `deferred` - never inferred from desktop - and rely on the production mobile
exporter gate. A repair that improves one viewport and regresses the other fails.

Canvas passes only when the visible design matches intent. It says nothing about export validity.

## Structure state

Read the repaired tree back and confirm:

- the root has exactly the intended email or module shape;
- every frame in the export chain resolves to a known tag;
- component instances remain attached;
- leaf pairs are complete and buttons have a direct TEXT child;
- all relevant frames hug vertically and only valid load-bearing widths are fixed;
- both alignment axes follow the packaged contract;
- `itemSpacing` is zero and no gap is paid for twice;
- visibility, fills, links, alt text, raw children, and mobile keys are on the correct nodes;
- text and image counts match the baseline except for an explicitly intended change;
- component-property count and every `componentPropertyReferences` binding match the pre-repair
  record unless the user approved a property change;
- no page, token, text style, or unrelated component changed.

Structure passes only when the complete read-back is clean. A clean read-back still does not prove
exporter behavior.

## Exporter state

Use `emaillove_export_figma` with `operationType: "preview"`, then send its token to
`emaillove_preview_email`. Confirm:

- production HTML compiles without an unexpected flattening or missing node;
- desktop output matches the repaired canvas intent;
- mobile output has the intended stack, group, recomposition, padding, typography, and image width;
- links, images, button behavior, raw footer content, and dark-mode CSS are present as applicable;
- the originally reported exporter symptom is absent.

Assign desktop and mobile exporter results separately. Exporter passes only when both pass; an
untested viewport is `deferred`, not `pass`, and success at one viewport cannot compensate for
failure at the other. If the tools are unavailable after probing and authorization guidance, set
both exporter states `deferred` and name the exact human Preview or Export check required.

For an Outlook, Gmail, Apple Mail, ESP, or inbox-only report, state whether production Preview
reproduced it. A Preview pass does not replace a real inbox test when the defect is client-specific.

## Completion rule

Use `fixed` only when canvas, structure, and exporter are all `pass`. Otherwise use `repair applied,
verification incomplete` or `cause identified, not repaired`, whichever is accurate.

## Repair report template

```text
Target:
Original node id:
Working-copy or replacement node id:
Original preserved: yes/no/not applicable

Reported symptom:
First failing surface:
Proven cause:

Changes:
- <node id>: <before> -> <after>, because <evidence>

Preserved:
- instances, content counts, property bindings, foundations, unrelated modules

Repair Contract:
- class: property_patch / instance_replacement / section_reconstruction
- allowed nodes: <ids>

Verification:
- canvas: desktop <state> - <evidence>; mobile <state> - <evidence or "no mobile source, deferred">
- structure: pass/fail/deferred - <evidence>
- exporter: desktop <state> - <evidence>; mobile <state> - <evidence>

Remaining handoff:
- private plugin control, named inbox test, or none

Final status:
- fixed / repair applied, verification incomplete / cause identified, not repaired
```
