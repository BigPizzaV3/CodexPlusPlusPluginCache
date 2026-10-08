# Email Love Figma quality gates

## Contents

- Gate 0: routing and scope
- Gate 1: proof batch
- Gate 2: source parity
- Gate 3: Email Love structure
- Gate 4: image and icon assets
- Gate 5: mobile geometry ledger
- Gate 6: component-property completeness
- Gate 7: canvas visual QA
- Gate 8: production Preview/export
- Gate 9: end-user handoff

Run every gate for a proof batch. For later batches, reuse the accepted foundations but run
all module-level and exporter gates again.

## Gate 0: routing and scope

- Campaign assembled from an existing library: Builder.
- Whole library, legacy inventory, foundations, tokens, or multiple component categories:
  Design System Migration.
- Existing broken module or template: Template Repair.
- Acceptance or regression review after any of those: Quality Gates.

If the active task crosses from one row into another, pause and reroute. Scope is a quality
control, not administration.

## Gate 1: proof batch

The first batch has at most four modules and covers, when present:

1. full-width or deliberately cropped photography;
2. grouped icon-and-text content;
3. multi-column content with component properties;
4. footer or social icons.

Every proof module needs a production desktop and mobile pass before a normal batch begins.
If Preview/export is unavailable, the proof batch may be prepared but the migration stops.

## Gate 2: source parity

Each module records an exact source reference and a parity result for:

- content;
- order;
- crop and focal point;
- type hierarchy;
- color;
- spacing;
- desktop structure;
- intended mobile behavior.

Missing authority fails the audit. Compare screenshots, not recollection.

## Gate 3: Email Love structure

- Module root is a direct-page COMPONENT tagged `mj-wrapper` with no `mainFrame` marker.
- Whole-email root carries `mainFrame`, all theme keys, and no MJML tag.
- No untagged frames, unknown tags, incomplete leaf pairs, empty wrappers, undocumented
  unequal auto-layout axes, or unintended fixed heights. Record each supported top-aligned
  multi-column exception in `structure.axisExceptions`, using the affected node identifier
  and the documented reason `top-aligned-multi-column`; an unequal axis pair without its
  documented exception is a defect.
- Every `mj-button` owns a direct text child.
- Root and load-bearing column widths are deliberate and at email scale.

Use the current Email Love render specification for the complete node mapping. This gate does
not replace it.

## Gate 4: image and icon assets

For every meaningful image rectangle, read back:

- `fills[0].type === 'IMAGE'`;
- a non-empty image hash;
- scale mode;
- rectangle width and height;
- source asset width and height;
- approved-crop status;
- alt text where the image conveys meaning.

Unless the crop is explicitly approved, rectangle and asset aspect ratios must agree within
2 percent. Source-design images must use a render of the composed node, not its raw fill.

For icons and social marks:

- use one image node per independently linked icon;
- keep it square unless the authoritative asset is intentionally non-square;
- export at 2x and run the alpha-perimeter check, treating it as a heuristic with four
  outcomes: `pass` (transparent artwork, safe inset), `needs-review` (alpha touches an edge
  or the inset is under the threshold: compare the source crop and the production render
  before approving), `not-applicable` (alpha does not isolate the artwork, such as a fully
  opaque source: an opaque asset is not evidence of a bad crop, and a visual source
  comparison is still required), and `error` (unreadable or empty asset);
- a deliberately edge-reaching design may be dispositioned as a documented visual
  exception; never add transparent padding or alter approved brand artwork merely to
  satisfy the heuristic;
- do not approve a sprite crop without checking the exported pixels;
- verify each icon's `href` and alt treatment independently.

## Gate 5: mobile geometry ledger

Run grouped layouts at 320, 375, and 390px unless the customer named different target
viewports.

For a group inside a section:

```text
mobile content = viewport - mobile section left padding - mobile section right padding
resolved column = column width / group width * mobile content
resolved inner = resolved column - column left padding - column right padding
```

Then prove:

- image/icon: `resolved inner >= natural image width` when the asset must not shrink;
- text: `resolved inner >= longest unbreakable text width` in the exported font stack;
- column widths account for the full group width, with any deliberate shortfall declared
  as bordered-group headroom and its reason recorded (an undeclared gap is a defect);
- all fixed widths include fallback-font slack;
- an icon is not being enlarged merely to fill the resolved box.

Use the inner content box. Comparing the asset to the total column while ignoring column padding is a false pass.

## Gate 6: component-property completeness

Properties exist only when useful and evidence-backed. Zero is valid.

TEXT properties:

- bind customer-facing copy that changes between sends;
- do not bind boilerplate, standing legal text, postal addresses, merge tokens, or text whose
  hyperlink would be destroyed by replacement;
- re-read the binding from the text node.

BOOLEAN properties:

- bind a complete optional semantic region;
- when false, the remaining module is visually and structurally complete;
- never hide only the leaf inside a required fixed-width column;
- never independently dismantle a comparison, pricing row, order row, or coordinated card;
- multiple node bindings are acceptable when the complete region requires them;
- test and screenshot both true and false states;
- re-read every `visible` binding.

INSTANCE_SWAP properties:

- expose only supported local alternatives;
- keep preferred values explicit;
- test the default and every offered swap.

## Gate 7: canvas visual QA

Inspect a fresh screenshot at 100 percent:

- no clipped or overlapping text;
- no wrong crop, dead space, distortion, or blurry icons;
- hierarchy and spacing match the source;
- components are organized and named consistently;
- usage notes and property notes are present.

This gate is necessary but never sufficient.

## Gate 8: production Preview/export

Record desktop and mobile separately. Both must pass:

- structure recognized by the Email Love plugin;
- live text stays live;
- images render at intended aspect and crop;
- grouped content resolves safely;
- social icons are uncropped and independently linked;
- BOOLEAN false states do not leave holes;
- dark mode and target-client checks required by the brief pass.

If the production renderer is unavailable, the only allowed state is `deferred`. Do not infer
a pass from the canvas or from node metadata.

## Gate 9: end-user handoff

- The Getting Started/User Guide explains selection, editing properties, mobile Preview,
  dark-mode Preview, export, and how to save/upload modules.
- It links to the current Email Love help documentation, including
  <https://help.emaillove.com/plugin/getting-started/overview>.
- Any placeholder, provisional link, approved crop, raw ESP token, or deferred client test is
  listed explicitly.
- Completion status uses the vocabulary in `SKILL.md`.

