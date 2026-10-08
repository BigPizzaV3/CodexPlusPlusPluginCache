# Phases 2 and 3: Convert

## Contents

- Conversion boundaries
- Required inputs
- Audit report contract
- Human gates
- Foundations and module batches

Convert an audited legacy design system into a working Email Love design system. This follows
the audit and works in two phases: foundations once, then modules in batches. A designer
reviews between batches; never convert the whole library in one unreviewed pass.

Prefer to have this done for you? Email Love's team runs this exact process, with design
review included, as part of Enterprise onboarding: hello@emaillove.com.

Two hard rules:

- **The customer's source is read-only, always.** All building happens in a separate target
  Figma file. Source calls are inspections, screenshots, fetches, and asset downloads only.
- **The audit report is required input.** It carries the source fidelity tier, the per-module
  classification (A/B/C/D plus any named concession), the scale factor where one applies, the brand
  foundations, and the flags. Do not re-derive
  what it already settled; do re-verify anything that looks wrong when you meet the actual nodes.
- **The SOURCE FIDELITY TIER decides where your numbers come from, so read it first.** AUTHORITATIVE
  means the geometry IS the spec, so preserve the source's widths, margins, type sizes, and spacing,
  and a deviation needs a written reason. PARTIAL means preserve what the audit proved consistent and
  standardise the rest, flagging each call. REFERENCE ONLY means take the brand, the copy, and the
  module structure, and **build the geometry to email standards with no scale factor at all**: there
  is nothing to divide and no source proportion to preserve. A tier is a recommendation the customer's
  designer can overrule; if they do, build under theirs and record whose call it was.

And one method rule that governs everything below: **you do not rebuild a module by eye.**
For AUTHORITATIVE and PARTIAL Figma sources with components, auto layout, and target-width
frames, structure comes from a direct read of the source node tree. For unstructured,
flattened, or non-Figma sources, structure comes from the design-converter worker and you
transcribe what it returns per the packaged render references. A frame you build from your
own mental model of email structure looks correct on canvas and silently drops content on
export, because the plugin keeps its real conventions in private plugin data you cannot read.

## Inputs

1. The migration audit report (file or pasted).
2. The source link, path, folder, account scope, or saved renders named by the selected source
   adapter, all read-only.
3. The target file: an existing one the team designates, or create one named
   "[Customer] Email Love Design System" via the Figma MCP.
4. Which batch to run: "foundations", or a batch of modules named by their rows in the audit's
   **Module inventory**. A library of eight or fewer modules may run as one batch; above that,
   use roughly five modules per batch. An explicit list from the user wins over the audit's
   proposed batch.

Once you have those four, and **before the first write to the canvas**, tell the user what the
run covers and roughly how long to expect, per "How long this takes, and what to tell the user
first" above. Do this every batch, not just the first one, and adjust the estimate as the file
teaches you what it costs. That opening line is one of the five checkpoints in "Report progress
while it runs" in that same section, and it is the one that matters most to the rest: the batch's
module count becomes the denominator for every line after it.

### What you read out of the audit, by section name

The audit's sections map onto the phases below. Use the audit's own words for these artifacts so
the two halves of the migration stay one conversation:

- **Module inventory** (required in the report): the deduplicated module list. One row is one
  module, and a batch is a group of rows. It carries each module's name (which becomes the
  component name), category, the designs it appears in, the **source ref** (the one appearance you
  screenshot, so you never re-derive the split), verdict, concession, **build constraints**, and
  effort. Read the build constraints column before you convert a row: it is where a technique
  constraint for that module lives, "render nodes, not raw fills" (R4.2.1) above all, and a
  constraint you skip there resurfaces as a defect the customer reports. This is what Phase 3
  iterates over. **Its category ORDER is load bearing too:** Phase 2 creates one component page per
  category in exactly the order the inventory presents them, so read that order off the table
  rather than sorting the categories yourself. There is no per-design conversion pass: the report's
  Per-design roll-up is context for the customer, not a work list.
- **Source fidelity** (required in the report): the tier, AUTHORITATIVE, PARTIAL, or REFERENCE ONLY,
  plus the signals behind it. **Read this before any other section**, because it decides whether the
  sections below are measurements to carry across or evidence about a file whose proportions you are
  deliberately not reusing, and it changes what Phase 2 and Phase 3 do. State the tier in your first
  line to the user.
- **Scale factor** (required unless the source is REFERENCE ONLY): the number every geometry decision
  is divided by. Read it; never re-derive it (see Phase 2). On a REFERENCE ONLY source this section
  carries no number and states email standards instead, and that is the finished answer rather than a
  gap: do not derive a factor of your own, not from the width, not from the ramp, not "for
  information", because whoever builds applies the number that is there.
- **Spacing system** (required): the accepted value or ladder for section side padding, vertical
  rhythm, gutters, inset padding, and mobile equivalents, plus named exceptions. Phase 2 builds
  the tokens; Phase 3 rejects any per-module value outside this system.
- **Palette** (required): the complete color census and the accepted mapping from source clusters
  to primitives and semantic roles, including the dark-mode proposal that supplies the six dark
  theme keys. Phase 2 creates the variables; Phase 3 requires every non-placeholder fill to bind
  to one.
- **Mobile styles** (required): the two-anchor mobile type ramp, mobile spacing overrides, and
  hide-on-mobile list. Phase 2 records the ramp and Phase 3 writes it on every module.
- **Brand foundations:** the type ramp on email-safe fallbacks, the button styles, and the target
  email width, with pointers to Palette and Spacing system. Phase 2 builds from these, and it
  takes the ramp table's Email size column verbatim rather than mapping styles itself. On a
  REFERENCE ONLY source, only the brand half is source material (palette, typefaces, logo, copy);
  the ramp, the spacing scale, the content width, and the target width are the email standards the
  audit stated.
- **Flags:** the gates. Two always block work rather than describe it: the scale factor when
  the audit's two derivations disagreed, and each named concession. Both need a human "yes"
  before the affected modules get built. **A third joins them whenever Flags carries the source
  fidelity tier**, which Step 7 does whenever that call was a judgement rather than a reading: the
  tier needs the same yes, because it decides whether the customer's geometry comes across at all.
  Where the tier is REFERENCE ONLY the yes is cheap rather than deliberative, so ask it as one
  confirming sentence before foundations: their brand comes across and the geometry will be ours.

If the report has no Module inventory, it predates this contract (see the
1.11.0 note under "Version and staying current"). Do not improvise a module list out of a
per-design table: re-run Phase 1, which is minutes of work and saves rebuilding a batch against
the wrong boundaries. A report with an inventory but **no Source fidelity section** predates the
fidelity contract instead, and that you can settle in a question rather than a re-run: ask Step 3's
signals (standard email width, margins identical rather than similar, text styles, paint styles,
variables, components, auto layout, mobile variants), record the tier you settled on, and say that
you settled it rather than read it. **A missing Scale factor is only a gap on an AUTHORITATIVE or
PARTIAL source.**
