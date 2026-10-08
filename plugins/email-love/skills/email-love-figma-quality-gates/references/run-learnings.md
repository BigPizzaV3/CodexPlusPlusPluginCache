# Durable learnings from a real design-system migration run

## Executive finding

This was primarily an enforcement failure, not an absence-of-documentation failure. The
current Email Love skills already describe natural image aspect ratios, real IMAGE fills,
mobile `mj-group` width resolution, exporter-first verification, and honest deferred
status. The run still failed because those rules were not turned into stop gates, measured
evidence, or an independent acceptance pass.

The durable improvement is therefore not another long rendering manual. It is:

1. route library work to the migration skill;
2. prove the riskiest four modules before scaling the batch;
3. validate geometry and properties from a machine-readable snapshot;
4. require production desktop and mobile renders for completion;
5. make the acceptance reviewer independent of the builder.

## What happened and what changes

| Observed problem | Existing rule before the run? | Durable skill change |
| --- | --- | --- |
| A whole EDS was approached like iterative email building | Partly | Add an explicit scope-escalation router. Libraries, foundations, tokens, and multiple categories always enter the migration workflow. |
| Benefit icons stretched in mobile Preview | Yes, mobile group math existed | Require a mobile geometry ledger at 320, 375, and 390px. Subtract section and column padding before comparing the resolved box with the image's natural width. |
| Some image blocks were color fills or placeholders | Yes | Require read-back evidence that every meaningful image rectangle has an IMAGE fill and hash before a module can pass. |
| Social icons were cropped | Partly | Export each icon at 2x and run an alpha-perimeter check. Treat sprite crops as unverified until every independently linked icon is inspected. |
| Components drifted from the source examples | Yes, source fidelity was expected | Make the exact source screenshot or frame ID mandatory per module. Missing source authority blocks approval. |
| `Show Image` left an empty fixed column | Partly | BOOLEAN properties bind to a complete removable semantic region. The false state must leave a finished layout, not merely hide a leaf. |
| Properties were added because a layer was technically bindable | Yes, evidence-backed properties existed | Add a property usefulness and completeness gate. Zero properties is valid. Boilerplate, link-bearing text, and required structural regions stay unbound. |
| User guidance arrived late | Partly | Make plugin-use instructions and help links a release gate, not a final cosmetic task. |
| Batches were described as structurally passed while exporter checks were deferred | Yes | Restrict completion language to four explicit states. Deferred production rendering can never be called complete or fixed. |

## Evidence from this run

- Eleven meaningful image rectangles needed repair from non-image or placeholder fills to
  real IMAGE fills.
- Sixty properties were removed and sixteen were rebound after the first property model
  proved too permissive.
- A `Show Image` property hid only the image leaf while its fixed column remained, producing
  an empty column.
- The icon row moved from a 50/470 split to a 72/448 split. That was an improvement, but the
  accompanying calculation compared the total resolved icon column to a 32px icon without
  subtracting the column's 10px right padding. At a 375px viewport with 40px section side
  padding, the conservative content box is about 30.85px, not 40.85px. Because production
  mobile Preview was still deferred, the run did not prove the repair. The quality gate uses
  96/424 for the regression fixture so it also survives the 320px target, and validates the
  inner box rather than the outer column.
- Footer social assets were later normalized to separate 36x36 IMAGE fills, which shows the
  need for asset-level verification early in the proof batch.
- Several reports correctly noted that production Preview/export was unavailable, but work
  continued into later batches. The new proof-batch gate stops that expansion.

## What not to learn

- Do not ban `mj-group`. It is the correct primitive when content genuinely must remain side
  by side on mobile; the widths and padding must be proven.
- Do not ban BOOLEAN properties. Bind them to complete optional regions and test the false
  state.
- Do not force every icon to be square if the authoritative source is not square. Square is
  a strong default for social and feature glyphs, not a universal law.
- Do not ban deliberate cropping. Record it as approved and compare it with the source.
- Do not encode customer-specific typography, colors, widths, or module names as universal Email
  Love rules.
- Do not interpret a later successful repair as evidence that the earlier process was sound.
  Preserve the regression case and improve the gate that should have caught it.
