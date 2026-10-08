---
name: email-love-figma-quality-gates
description: Audit an Email Love Figma design-system migration batch or reusable module before it is approved. Use for independent QA, completion review, or regression checks involving mobile icon geometry, real image fills, cropped social icons, component-property semantics, source fidelity, Email Love structure, or differences between the Figma canvas and the Email Love plugin Preview/export. Do not use this skill to build, migrate, or repair the modules themselves; route those tasks to the Email Love Builder, Design System Migration, or Template Repair skill first, then return here for acceptance.
---

# Email Love Figma Quality Gates

Treat this as an independent acceptance layer. The builder's report is evidence to inspect, not proof that a module is ready.

## Route before reviewing

1. A whole library, legacy inventory, foundations, tokens, or several component categories
   is a design-system migration. Use `email-love-design-system-migration` for the work.
2. One new campaign or sequence assembled from an existing library is builder work. Use
   `email-love-figma-builder`.
3. One existing module or template with a rendering defect is repair work. Use
   `email-love-template-repair`.
4. Use this skill after any of those workflows to accept or reject the result.

If scope expands during a build, reroute immediately. Do not let a campaign build silently
turn into a library migration.

## Load only the relevant references

- Read [quality-gates.md](references/quality-gates.md) for every audit.
- Read [snapshot-schema.md](references/snapshot-schema.md) when producing or validating the
  machine-readable audit snapshot.
- Read [run-learnings.md](references/run-learnings.md) when explaining why these gates exist
  or reviewing a similar failure pattern.

## Audit workflow

### 1. Establish the authority

Record the source reference for each module and which design is authoritative. If the
source is missing or ambiguous, return `audit incomplete, missing source authority`. Do not
approve from memory or from a prose build report.

### 2. Enforce the proof batch

Before a normal migration batch, require a proof batch of no more than four modules. Cover
as many of these risk classes as the source contains:

- a full-width or deliberately cropped photo;
- a grouped icon-and-text row;
- a multi-column module with component properties;
- a footer or social-icon row.

Do not release later modules until every proof module passes production desktop and mobile Preview/export. If the exporter is unavailable, stop after the proof batch and request the
human Preview check. Canvas evidence cannot waive this gate.

### 3. Capture an audit snapshot

Create one JSON snapshot using [snapshot-schema.md](references/snapshot-schema.md). Measure
the actual nodes and component-property bindings; do not copy claims from a report. Include
the selected mobile viewports and separate desktop and mobile exporter status.

### 4. Run the structural and geometry validator

```bash
python3 scripts/validate_batch_snapshot.py path/to/audit-snapshot.json
```

Treat every reported error as a failed gate. Warnings need a written disposition. The
validator fails closed: missing inventories, an empty module list, a census mismatch, or a
measurement that is not a finite number are all errors, never silent defaults. It is
deliberately conservative about grouped icons: it subtracts both section and column padding
before comparing the resolved mobile box to the asset's natural width. Documented
render-contract exceptions (top-aligned multi-column axes, bordered-group headroom) are
declared in the snapshot, not waived by the checker. A passing snapshot is snapshot
validation only, never production acceptance.

### 5. Inspect icon and social assets

Export each icon node at 2x as a PNG, then run:

```bash
python3 scripts/check_icon_perimeter.py path/to/icon.png path/to/social-icon.png
```

The check is a heuristic with four outcomes: `pass`, `needs-review` (alpha touches an edge
or the inset is thin: compare the source crop and production render before approving),
`not-applicable` (a fully opaque asset, where alpha proves nothing about the crop and a
visual source comparison is still required), and `error`. Only `pass` is automatic. Inspect
one file per independently linked social icon, do not approve an unverified sprite crop,
and never alter approved brand artwork merely to satisfy the heuristic.

### 6. Compare source and production renders

Compare a fresh Figma screenshot with the authoritative source, then compare both desktop
and mobile Email Love plugin renders. Check crop, focal point, aspect ratio, type hierarchy,
spacing, stacking, link independence, and the false state of every BOOLEAN property.

The exporter render is the arbiter. A clean canvas proves only the canvas.

### 7. Report gate-by-gate

Use exactly one of these completion states:

- `complete`: source, structure, assets, properties, canvas, desktop export, mobile export,
  and handoff gates all pass;
- `canvas and structure ready, exporter verification deferred`: production render evidence
  is unavailable;
- `batch rejected, repair required`: one or more gates fail;
- `audit incomplete, missing source authority`: fidelity cannot be judged.

Never shorten a deferred state to `complete`, `fixed`, or `verified`.

## Maintain the package

Run both script self-tests after editing this skill, then the repository's own validator
from the repository root:

```bash
python3 scripts/validate_batch_snapshot.py --self-test
python3 scripts/check_icon_perimeter.py --self-test
```
