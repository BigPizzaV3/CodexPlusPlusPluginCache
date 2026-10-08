# Phase 1: Audit (read-only)

## Contents

- Scope the input
- Survey the file
- Classify source fidelity
- Detect the scale factor
- Split designs into reusable modules
- Extract brand foundations
- Write the migration report
- Hand off to conversion

Audit an existing email library for migration to Email Love, and produce a migration report
the customer and the Email Love team can act on. Phase 0 in the skill selects Figma or one of
the packaged [source adapters](sources/). This is Phase 1 of a migration: it
tells everyone what they have, what converts, what needs design judgment, and how big the job
is. Phase 2 is the conversion, and this report is its input:
[conversion-overview.md](conversion-overview.md), [foundations.md](foundations.md), and
[module-conversion.md](module-conversion.md) run it in this skill, or Email Love's team runs
it for the customer as part of Enterprise onboarding. Step 8 is the hand-off, and it is part
of the job, not an afterthought.

**This phase is strictly read-only.** Never create, modify, rename, or delete anything in the
customer's source. Every Figma, filesystem, cloud, or ESP call must be an inspection or fetch.
If the user asks you to
start converting, that is Phase 2: it happens in a separate target file, driven by "Phases 2
and 3: Convert" in [conversion-overview.md](conversion-overview.md) (Step 8 has the hand-off),
and the source file stays read-only in that phase too.

## Step 1: Scope the input

For a Figma source, you need the file link. If several files hold the design system, audit each.
Ask only three questions if not obvious: which frames or pages are the email templates (as opposed to
web or app design); whether there is an existing production email you can use as a reference
for how their emails actually render today; and whether the component masters live in this
file or in a separate Figma library, and if separate, ask for that file too. A missing
library file is the most common blocker an audit surfaces, and knowing up front saves the
report from guessing about components it cannot see.

## Step 2: Survey the file

Build the inventory with read-only calls. **Know the transport limits before relying on one
full-file response:** metadata reads can fail with an opaque SSE parse error above roughly 80KB
or on non-ASCII layer names. When that happens, keep the source read-only and use the available
Figma read tool in batches of about 12 nodes, one compact line per node, with names sanitized to
ASCII using `.replace(/[^\x20-\x7E]/g, '?')`. Adapt the tool name to the Codex Figma connection;
the portable rule is the chunked, ASCII-safe fallback.

1. **Pages** and what each holds (component libraries, template galleries, guidelines,
   icon sets, font fallback references).
2. **Brand foundations:** local text styles (the type ramp with families, weights, sizes),
   local paint styles (the palette and its naming taxonomy), variable collections, and any
   spacing or padding component sets. Note a fonts-fallback page if one exists; it means the
   team has already chosen email-safe substitutes.
3. **Design census:** every candidate frame, with name, width, height, and component/frame
   type. Group desktop and mobile twins (the same design at two widths, commonly 600 and 390);
   in Email Love these merge into ONE frame with Mobile Styles overrides, so count designs,
   not frames.
4. **Asset survey: distinguish absent from fused.** Walk the images, logos, icon rows, badge
   rows, and rating rows the designs use. A genuinely absent asset is a blocker and a customer
   ask. A present-but-fused asset, such as several icons in one screenshot strip, is buildable:
   render and slice it rather than reporting it missing. Before writing that rebuild remedy,
   search the OTHER designs in the file for the same artwork as separate nodes. Teams often
   paste one raster strip into several designs while another email still carries clean vectors.
   Prefer `rebuild from the vectors at <node id>` over slicing or upscaling whenever those
   vectors exist. On every affected Module inventory row, name the state and remedy explicitly:
   `asset absent, blocked on customer`, `slice the fused N-item strip, do not treat as missing`,
   or `rebuild from the vectors at <node id>`.
5. **Fidelity signals, which Step 3 classifies from.** You are reading all of these already while
   you do 1 to 4; the only new work is writing each one down as present or absent rather than
   using it and moving on: a standard email width or not, local text styles, local paint styles,
   variable collections, components or component sets (as opposed to loose frames and groups),
   auto layout (as opposed to absolute positioning), mobile variants. Add one measurement the
   census does not otherwise need: **the left content inset of three or four designs.** Whether
   equivalent margins are identical or merely similar is the signal that separates a file somebody
   designed from a file somebody eyeballed, and it is two reads per design.

Record the authored type sizes and the design widths verbatim, in the numbers the file actually
carries. Step 4 divides both when it runs, and it cannot do that from rounded or remembered
figures. Record them even when you expect the source to be reference only, because they are also
the evidence for the Step 3 classification.

## Step 3: Classify the source fidelity

Before deriving anything from the source's geometry, decide whether that geometry is a
specification at all. This comes before scale detection because it decides whether scale detection
is relevant, and it changes how every later section of the report should be read.

Two sources can look equally finished in a screenshot and mean completely different things.

- **A well organised email-native library** is drawn at real email widths, with a desktop and a
  mobile variant, real text styles, real components, variables, and margins that repeat because
  somebody chose them. Here **the geometry IS the specification**, and carrying it across is the
  job.
- **An old file drawn before the designer knew the tool** is at no particular width, with no
  styles, no components, no auto layout, and margins that vary because each one was eyeballed on
  its own. Here **the geometry is NOT a specification**, it is an artefact of how the file happened
  to get made, and preserving its proportions faithfully reproduces guesses. What is worth taking
  is the brand: palette, typefaces, logo, the copy, and the module structure, meaning which blocks
  exist and in what order.

**Classify from the census you already have** (Step 2, item 5). This step adds no new inspection
work: the signals are the counts and the presence-or-absence notes you just wrote down.

Two of the signals are load bearing and the rest are hygiene:

- **Is the source at a standard email width** (600 or 640, with a mobile variant near 320 to 390)?
- **Are equivalent margins consistent across designs** (the left content insets you measured are
  identical, not merely similar)?

The hygiene signals: local text styles, local paint styles, variable collections, components or
component sets, auto layout, mobile variants of the designs.

Two rules make the call cheap and keep it from drifting on feel: **a source at a standard email
width whose equivalent margins are consistent cannot be reference only**, and **a source at
neither cannot be authoritative**, whatever the hygiene signals say. Between those, most of the
hygiene signals present reads authoritative, almost none of them reads reference only, and a mix
reads partial.

### AUTHORITATIVE: the geometry is the spec

**Definition.** Widths, margins, type sizes, and spacing were chosen, and they are worth carrying
into the email unchanged. Preserve them. Deviating from a source number needs a reason, written
down in the report.

**Signals.** Drawn at 600 or 640 with a mobile variant; text and paint styles applied consistently
rather than ad hoc fills; components or variables in use; auto layout throughout; equivalent
margins identical design to design.

**Downstream.** Scale detection runs, and it should come out at 1.0 or within a few percent of it,
because a source at email scale has nothing to scale. Brand foundations record the source's own
ramp, spacing, and content width as measured. Module rows inherit source geometry.

### PARTIAL: some of it is deliberate and some is not

**Definition.** Preserve what is demonstrably consistent, standardise what is not, and flag each
judgement so a reader can see which numbers came from the file and which came from us.
**"Demonstrably consistent" has a test:** the same measurement appears in at least three places
and is identical, not similar. A value that appears once, or three times with three values, is not
a specification and gets standardised.

**Signals.** Mixed, and mixed is the normal shape of a real library: real text styles but no
components, auto layout on the newer designs and absolute positioning on the older ones, a
standard email width on some designs and an arbitrary canvas on others, margins consistent inside
one design and different in the next.

**Downstream.** Scale detection runs. Derive the factor from the part of the file that is
deliberate and say which part that was. Every standardisation gets its own line in Flags, since
each one is a place the built system will not match the source on purpose.

### REFERENCE ONLY: take the brand, build the geometry

**Definition.** Take the palette, the typefaces, the logo, the copy, and the module structure.
Build the geometry to email standards. Ignore every source measurement: widths, margins, type
sizes, spacing, image dimensions.

**Signals.** No standard email width; no local text or paint styles; no variables; no components;
no auto layout; no mobile variants; equivalent margins that differ design to design.

**Downstream, and this is the part that misbehaves if you skip it:**

- **Step 4 is SKIPPED, not attempted.** Do not derive a scale factor. Not from the width, not from
  the ramp, and not "for information". There is no proportion to preserve, so a factor is a number
  with nothing on the other side of it, and there is no gap between two derivations to agonise over
  because neither derivation should exist.
- **The report says so, in as many words.** The Scale factor section reads `Not applicable, source
  is reference only` and states the email standards used instead. Write that rather than dropping
  the section, so a reader can tell a decision from an omission, and so nobody supplies the missing
  number themselves.
- **Record that the geometry is ours.** A converted module that does not match the source's margins
  is correct, and the report has to say that plainly, or somebody downstream will later "fix" the
  built system back toward the source and reintroduce exactly what this tier exists to discard.
- This is not a theoretical failure. Deriving a factor on a reference-only source and applying it
  faithfully produced a 16px body sitting inside 20px margins: both numbers correctly divided out
  of a source where nobody had chosen either.

### What email standards mean for a reference-only build

Defaults, stated rather than derived. Put these in the report as the geometry the build uses.

- **A 600 body width**, and **one content width for every module**, 560 inside that 600 with 20/20
  side padding: no module invents its own.
- **A conventional type ramp with body at 16:** 12 fine print, 14 secondary, 16 body, 20 subhead,
  24 to 30 headline. Line height around 1.4 to 1.5 on body copy, tighter on headings.
- **A spacing scale in multiples of 8:** 8, 16, 24, 32, 40, 48. Pick one section padding off that
  scale and use it library-wide rather than a different value per module.

Take only the brand from the source alongside these: palette, typefaces, logo, copy, module
structure and its order.

### This is a judgement, and it has consequences

Say so in the report rather than presenting the tier as a measurement. The two ways of getting it
wrong are not equally recoverable:

- **Calling an authoritative file reference-only throws away deliberate design decisions.** The
  margins, the ramp, and the spacing that made their emails theirs get replaced with our defaults,
  and the customer gets a system that is generically correct and not theirs. This is the worse
  error, because the reasoning behind those numbers is not recoverable from the built file.
- **Calling a reference-only file authoritative dresses guesses as decisions** and hard-codes them
  into every module.

So **when the signals are mixed, prefer PARTIAL and flag it.** Do not guess at either extreme to
make the report tidier. PARTIAL is the accurate answer to a mixed file rather than a hedge: it
preserves what the file proves and standardises what it does not, and it makes each of those calls
visible one at a time. State the signals you saw, both the ones for and the ones against, in the
report's Source fidelity section, and say that the tier is a recommendation their designer can
overrule. One question at hand-off, "is this file a specification or a reference", is the entire
cost of getting it right.

## Step 4: Detect the scale factor (authoritative and partial sources only)

**Run this step only when Step 3 classified the source AUTHORITATIVE or PARTIAL. On a REFERENCE
ONLY source this step does not run at all:** derive nothing, report no factor, and go straight to
Step 5, leaving the report's Scale factor section to record the email standards from Step 3.
Deriving a factor anyway and captioning it as background does not work, because whoever converts
applies the number that is in that section whatever sits next to it.

Not every source library is drawn at email scale. A file that was never meant to export as
email is often drawn at some multiple of it: a mockup enlarged for presentation, a web-first
canvas, a slide artboard. The factor decides every type size, line height, and spacing value in
every converted module, so getting it wrong makes the whole library uniformly wrong, and nobody
notices until a converted module sits next to a real email.

Compute BOTH derivations, always, and put both in the report:

1. **From the canvas width:** the source design width divided by the email width they intend
   (600 or 640). A 1089px design against 600 gives 1.815. If nobody has named a target width,
   derive against 600, Email Love's default, and say in the report that you assumed it.
2. **From the type ramp:** the authored type sizes divided by the standard email sizes they map
   onto. Divide the whole ramp, not one style, and look for a cluster: a 35px body over a 16px
   email body gives 2.19, a 26px caption over 12 gives 2.17, a 53px headline over 24 gives
   2.21. Three styles landing near 2.2 is a signal; one style is a coincidence. Sanity check
   the candidate by dividing the ramp back by it: if 2.2 turns the authored sizes into 16, 12,
   and 24, the factor is real.

If the two derivations agree within a few percent, say so, give the one number, and move on:
there is nothing to decide. When they disagree, and on an unstructured source they usually do,
the report carries the disagreement rather than hiding it:

- **State both derivations with their arithmetic and name the gap in percent.** An observed
  migration came out at 1.815 from the width and 2.2 from the type, a 21 percent gap, and 21
  percent is the difference between a converted module a designer accepts and one nobody can
  use.
- **Recommend one, with the reasoning.** Prefer the type ramp when the authored sizes divide
  cleanly into standard email sizes and the width ratio does not. In that observed migration
  the type sizes divided to exactly the standard sizes while the width ratio landed on an
  arbitrary 1.815, so the ramp was the trustworthy signal. The reason generalizes: a designer
  picks type sizes deliberately off a ramp, while a canvas width absorbs bleed, margins, and
  whatever artboard someone happened to start on, so the width carries noise the ramp does not.
- **Mark it a designer decision, in those words.** It is a recommendation until their designer
  confirms it, and because it changes every module it is the highest-leverage line in the
  report.

Two more things while you are in here: check that every design shares one factor (a single
design drawn at a different scale is a flag, not a second factor), and state the email width as
the TARGET width rather than the source canvas width. Conversion divides by the factor; it
never carries source pixels across.

Record the result in the report's **Scale factor** section (Step 7). Phase 2 reads that number
instead of deriving its own, which is the whole point of settling it here.

### The width factor and the type factor will not agree, and the report has to name which governs what

Choosing a target email width AND a type factor independently brings a second factor back into a
system whose whole rule is one factor. The two ratios agree only when the source happens to have
been drawn at an exact multiple of the target width, and a mockup drawn to present is not drawn to
email proportions, so on a real source they usually do not.

**Run the check and put it in the report.** Divide the source width by the target email width,
compare that ratio to the type factor you recommended, and state the gap. Measured on the migration
this rule comes from: a 1092 wide source against a 600 target is 1.82, the recommended type factor
was 2.2, and 1092/2.2 = 496 rather than 600, so the library was always going to carry 2.2 on its
type and 1.82 across its width. Nobody wrote that down, and the cost landed on the margins: the
source's own 115px text margin is 52px through the type factor and 63px through the width ratio, the
converted library shipped 20px, and no reader of the report could trace which derivation produced
that number, because neither of them did.

**When the two differ, name which factor governs which quantities, in the report, in words.** The
defensible split, and the one to state unless the designer decides otherwise, is that the type factor
governs type sizes, line heights, and the spacing scale, while the target email width governs the
body width and everything measured across it: content width, content margin, column splits, image
widths. The reason is that the email width is a hard constraint from the clients rather than a
choice, and legibility is a hard constraint on type, so neither quantity can be bent to make the two
ratios meet. Write it as a sentence with both numbers in it rather than leaving a reader to infer it
from two tables.

**Be honest that this is a genuine tension, not a defect with a fix.** No single factor both
preserves the source's type ramp and preserves its proportions across a body width email can actually
use, because the source was drawn at a width email cannot use. The failure is not having two ratios.
The failure is having two ratios and not saying so, which is how a converted library ends up with
margins nobody can trace back to a decision (Phase 2, render rule R0.6).

### The factor is ONE number, and the ramp table has to prove it

Recommending a factor is necessary and not sufficient. Phases 2 and 3 have to APPLY it,
uniformly, to every quantity it governs: type sizes, line heights, the spacing scale, paddings,
spacer heights. Widths are the exception the section above just named, and they come from the
target email width. The report is what makes that auditable, so it shows the arithmetic
per style rather than only the conclusion.

**Write the type ramp mapping as a four-column table, one row per style:**

| Style | Authored size | Factor | Email size |
| --- | --- | --- | --- |
| Headline | 65 | 2.2 | 30 |
| Subhead | 55 | 2.2 | 25 |
| Body | 35 | 2.2 | 16 |

The Factor column carries the SAME number on every row, and that is the reason for printing it at
all: a per-style factor cannot hide in a table that restates the factor on each line, because a
second number in that column is visible at a glance. Never write the table as authored size
straight to email size with the division left out, and never round a row toward a size that looks
like a nicer email number. Divide, round to the nearest whole pixel, write down what you get. Same
table, same discipline, for the spacing scale.

**Acceptance test, run on the table before the report ships: the source's ratios must survive.**
Divide the largest email size in the table by the smallest, divide the largest authored size by
the smallest, and compare the two. More than a couple of percent apart means a row has been
rounded off the factor: find that row and fix it, do not ship the table. Run the same check across
the spacing scale. Worked, from the migration this rule comes from: authored 65/35 = 1.86 against
email 30/16 = 1.88 passes, a 1 percent drift that is nothing but whole-pixel rounding. The module
that actually shipped came out with a 55 source headline at 30 and a 35 source body at 16, so 1.57
in the source against 1.88 built, a 20 percent failure. That is the defect this test exists to
catch, and it is worth catching here because downstream it presents as a padding problem rather
than a type problem, so nobody thinks to look at the ramp.

If a row's email size looks wrong, that is evidence the FACTOR is wrong, not licence to adjust the
row. Revisit the factor, re-divide the whole ramp, re-run the test.

## Step 5: Split the designs into modules, then classify every module

Email Love design systems are built from modules, not from whole designs. A module is one
reusable block that gets dropped into many emails: a hero, a copy block, a 2-up product row, a
footer. Phase 3 converts modules, one component per module, and batches them, so this step's job
is to hand it a deduplicated **Module inventory**, which is the name both phases use for this
artifact. A per-design verdict cannot do that job. On an observed migration, six finished emails
turned out to be the same nine modules in a different order each time: the six-row per-design
table said almost nothing, and the nine-row Module inventory said everything.

Three passes:

1. **Split each design into blocks.** Walk the tree (node types, auto-layout, text nodes, image
   fills, vectors, nested instances) and cut at the natural block boundaries: a full-width
   background change, a divider, a jump in vertical padding, a repeated row, a run of copy
   followed by an image. On an email-native source the components and auto-layout frames tell
   you where the cuts are. On an unstructured source (loose groups, absolute positioning, no
   components, no styles) you are inferring them, so say so in the report and ask the designer
   to confirm the split: the Module inventory is what gets built, so a wrong boundary is a wrong
   component.
   **For an unstructured source, render the whole design at 1:1 and detect content bands from
   the pixels.** Rows of pure canvas background between mixed-content bands are candidate module
   gaps. Record exact y-coordinates such as `top 128 to 540` on the source ref. This gives Phase 3
   a deterministic local crop and prevents a second agent from re-inferring different boundaries.
   **Apparent Email Love structure in the source is a hint, not a finding.** Source frames can
   retain `mj-*` names or nesting from an earlier export while their geometry no longer matches
   the tags. Verify the structure semantically. The common failure is a frame acting as an
   `mj-section` that is narrower than its wrapper content box: a section always spans its wrapper
   on export, so the row's build constraint must say `inset belongs on the wrapper padding, not
   the section`.
   **Then write the boundary down on the row.** Whoever converts the module has to
   screenshot exactly the region you cut, and a boundary you found but did not record is a
   boundary they have to infer again, differently. So record a source ref per module: the design to
   convert from, plus the node name or node id you cut at, and on a source with no node to name (a
   loose group, an absolutely positioned run) the position within that design, for instance "top 0
   to 480" or "between the divider and the footer rule". One appearance is enough; it is the one
   that gets built.
2. **Deduplicate across designs.** The same block appearing in six designs is ONE module with
   six appearances, never six rows. Near-duplicates are one module plus a note when the
   difference is content, and two modules when the difference is structural (a different column
   count, an added region).
3. **Name each module the way it should appear in their library**, because the name carries
   straight through conversion into the component name ("Hero, text led", "Footer, legal +
   social"). Give each one a category from the sections their plugin already has (Pre-Header,
   Header, Heroes, Single Column, Two Column, Three Column, Four Column, Buttons, Reviews,
   Images, Lists, Order Tables, Footer) rather than one you invent.

   **Then order the categories deliberately, because they become PAGES.** Phase 2 builds one page
   per category in this inventory, in the order the inventory presents them, and it builds no
   others. So a category order that came out of whatever the walk happened to find first becomes
   an incidental page list in the customer's finished library, which is the shape problem the
   prescription in Phase 2 exists to remove. Do not leave it to the walk.

   **Order the categories the way modules appear in a typical email, top to bottom:** Pre-Header,
   Header, Heroes, Single Column, Two Column, Three Column, Four Column, Images, Reviews, Lists,
   Order Tables, Buttons, Footer. That is how someone building an email scans for the next block
   they need, so it is how the file should be ordered. Skip any category the inventory does not
   use, and add none it does not. Where a category genuinely has no settled place in that
   sequence, put it where the customer's own emails put it and say in the report that you did.

   **Group the inventory rows by category, in that order, and order the rows inside a category by
   reuse, highest first.** The category order is the load-bearing part, since it is what Phase 2
   reads; the within-category order is what makes the highest-reuse modules easy to find. The
   batch plan is read off Recommended next step, which names modules explicitly, so it does not
   depend on row order.

Then assign every module exactly one verdict:

- **(A) Live-text convertible.** Auto-layout stacks of text, images, and buttons that map
  onto mj-section/mj-column/element-frame structure. Text stays selectable and editable in
  the sent email. Best deliverability and accessibility; most modules should land here.
- **(B) Editable-image candidate.** Design-rich compositions (layered imagery, text on
  photos, custom shapes, brand illustrations) that would fight email rendering as live text.
  Email Love handles these deliberately: the design frame is placed inside a column without
  an MJML type name, and the exporter flattens it to a single hosted image at export while it
  stays fully editable in Figma. No rebuild needed; the design survives as-is. Cost: the text
  inside is not live in the inbox (image weight, accessibility, clients with images off), so
  recommend pairing with alt text and keeping critical copy outside the image.
- **(C) Hybrid.** Split the module: headline and body as live text, the rich visual region as
  an editable image. Reserve it for blocks where copy and picture are one composited whole with no
  boundary to cut on: type set over a photographic collage where the lettering is part of the
  artwork. **An overlap or an edge bleed on its own is NOT a C**, it is an A with a concession:
  see the Two Column Swap below.
- **(D) Not emailable.** Interactive patterns (hover states, carousels, video embeds beyond a
  thumbnail link), viewport-relative layouts, or app UI that has no email equivalent. List
  what would replace them.

**A photo that overlaps or bleeds past its block is verdict A, not C.** This is the single most
common reason a module gets over-classified, and it is now a settled decision rather than a
per-module argument. Source designs routinely place a photograph so it overlaps or bleeds past
the block it belongs to: a product shot entering from the right behind body copy, an animal
cropped off by the left edge of a cream band with text beside it. In Figma that is z-order plus
absolute position, email has neither, and no MJML attribute gets close. **The standard remedy is
to rebuild the block as a two column row: one `mj-section`, two `mj-column`s, the image in one
and the text in the other, in the source's left to right order.** The image stops at its column
edge instead of bleeding, nothing overlaps, and the text stays live. Appendix R3.4.1 is the full
rule, including the two tells for recognizing it (the photo's bounds extend past the band's, or
the photo is clipped by a sibling drawn over it rather than by a mask), which you have to look
for on the nodes because the screenshot hides the overflow by construction.

So classify such a module **`A (concession: image bleed rebuilt as a two column row)`**, note in
the row that the overlap is what is lost, and price it as an A. Do not write it as a C: C reads
as a partial conversion and this is not one, the whole block converts as live text. Do not
propose flattening the block to an editable image either, which trades selectable text,
accessibility, and dark mode for one effect. What still earns a C is a block that genuinely needs
splitting, type set over a photographic collage where the lettering is part of the artwork, or
any treatment where copy and picture are one composited whole. The test: if you can name the
rectangle the image belongs in and the rectangle the text belongs in, it is the swap and it is an
A. If you cannot, it is a C.

**The concession field on A: required on every A row, and deliberately not a fifth verdict
letter.** A module can convert perfectly as live text except for one effect email cannot
reproduce at all: an overlapping or bleeding photograph, a full-bleed treatment that has to stop
at the content box, a blur, a blend mode, a shape email has no way to draw. That is not B
(nothing needs to become an image), not C
(there is no rich region to split off), and not D (it emails fine). Two modules on an observed
unstructured source were exactly this, and with nowhere to put it the finding got smuggled into
a C with a paragraph of explanation, which is how a decision a designer needed to make ends up
buried.

So record it on the verdict instead: write the verdict as **`A (concession: <the named
concession>)`** and spell the concession out in the row's notes, both what is lost and the
nearest email-safe substitute you propose. Every A row states either `none` or a named
concession, so a blank is a missing answer rather than an implied no. Every named concession
also gets its own line in Flags, for the designer to accept or reject before the module is
built.

**The one concession with a standard wording, because its substitute is already decided:** an
overlap or an edge bleed is written **`A (concession: image bleed rebuilt as a two column row)`**
and the substitute is render rule R3.4.1, not something you invent per module. Use that wording
verbatim so a reviewer can count these at a glance and Phase 3 knows exactly which rebuild to
apply. It still gets its Flags line, because a designer still has to accept losing the overlap.

**Why a field and not a letter:** the ladder answers how a module gets built, and these
get built exactly like any other A, same technique and same effort. What differs is a decision a
human has to accept. A fifth letter would fork the ladder, and every per-verdict count and
effort row with it, on something orthogonal to construction. B and C rows may carry a concession
too when one applies; on those the field is optional, because their verdict already carries an
explanation.

**A flag that constrains HOW a module gets built belongs on that module's row.** Flags is a prose
section a human reads once. The Module inventory is what Phase 3 works from, row by row, and a
converting agent that never opens Flags is the normal case rather than a careless one. So any
finding that changes the technique for a specific module has to be written where that module gets
built from: name it in the row's `build constraints` column and spell it out in the row's notes,
and only then also in Flags when a human has to decide about it. Observed failure: an audit
correctly flagged "images are clipped by z-order, not masks, so export rendered nodes rather than
raw fills" in Flags alone. The conversion exported raw fills, every cropped image came across as
the whole uncropped photograph, and the customer reported it as a spacing bug. The audit was right
and the hand-off still failed, which is a defect in where the finding was written, not in the
finding.

Findings that are build constraints rather than observations, and therefore belong on the row:
images that carry a crop transform or are clipped by overlapping siblings (the row says "render the
node, not the fill", which is R4.2.1), an image that overlaps or bleeds past its block (the row says
"two column row per R3.4.1" and which column the image goes in), an image that is inset rather than
full bleed and the percentage it is inset by, copy that has to stay outside an image for
accessibility, a font this module in particular leans on, a pinned width this module cannot keep,
spacing that has to come from one side only, and **a two-column row that reads as a visual lockup**
(a logo beside a headline, an icon beside a line of copy, columns sharing a single continuous
background bar or card, header and footer strips): the row says "`mj-group`; keep side by side on
mobile". This last one is worth calling out separately because the audit is walking the whole
library and is much better placed to notice that six header rows across six emails are all the same
lockup than the converter is, meeting each row alone with only a desktop screenshot in front of it.
Two roughly equal content columns (image beside copy, two product cards) are not lockups and get
no constraint; they stack on mobile normally. Write each constraint short and imperative: one
clause a builder can act on without reading anything else. A constraint that applies to the whole
library belongs in Brand foundations or Flags instead of being repeated on twenty rows.

Signals that push a module from A toward B or C: vector logos and illustrations (email wants
images), buttons built as nested app-style instances with state layers, stacked image fills,
gradients and blend modes on text, and effects email clients do not render. Signals of A:
clean vertical auto-layout, flat solid fills, one image per region, system-mappable text.

Do not over-classify toward images. Two MJML capabilities keep more modules live-text than
designers expect: **mj-hero** renders live text over a full background image, so "headline on
a photo" is verdict A when the text sits on one background image rather than woven through
layered art; and sections support background images behind live columns. Reserve B for
compositions where text and imagery genuinely interleave (text wrapping around cutouts,
badges over product shots, hand-placed collage). And the Two Column Swap above keeps a third
group live: an overlap or a bleed is a fixed rebuild, not a reason to reach for an image.

Finally, **roll the verdicts up per design**: for each design, the ordered list of module names
it is made of and the worst verdict present in it. The Per-design roll-up is a view of the Module
inventory, not a second classification, so it introduces no verdict that is not already on a
module row. It exists so a customer can still ask "what happens to this email" and get an answer,
and Phase 3 does not work from it.

## Step 6: Extract the brand foundations

From the survey, draft what the Email Love design system will carry. State whether every value
was measured from the source or selected from email standards.

- **Type ramp, censused rather than sampled.** Enumerate every distinct `(family, size, weight,
  line-height)` tuple across the surveyed source, including local overrides. Cluster values only
  when they differ by a point or two and report every cluster. **Cluster within a family, never
  across families.** Two typefaces at one size are two rows because one text style carries one
  family. Name the distinction (`Subhead`, `Subhead Serif`) and settle at foundations whether the
  second family is load bearing or a consolidation candidate. A row naming two families is an
  unresolved decision, not a ramp row. Map the complete census to
  email-safe fallbacks. For AUTHORITATIVE and PARTIAL sources, use Step 4's four-column table with
  the same factor printed on every row and run the ratio acceptance test. For REFERENCE ONLY,
  retain the source typefaces and weights but map them to the standard 12, 14, 16, 20, and 24 to
  30 ramp with body at 16; authored sizes remain evidence, not build inputs.
  Where the smallest cluster is below 12px, say so and recommend a floor at 12px, or at the
  customer's confirmed floor. Conversion will otherwise standardize 10px and 11px values upward
  module by module for readability and client compatibility. Record this as a foundations
  decision before a batch begins.
- **Mobile type ramp, derived, and it is a compression, not a scaling.** Required output.
  Email clients do not scale type: a declared size renders identically on a 375pt phone and a
  640px desktop while the line box nearly halves. Measured: 27px body copy went from 42
  characters per line at 640 to 21 at 375, same line pitch, and the customer reported "the
  mobile rendering is not that good", presenting as a quality feeling, not a type bug.
  **The remedy is a second ramp via Email Love's Mobile Styles, never a smaller desktop ramp**
  (that discards a brand decision to fix a problem the product already solves).
  **Do not derive it with one factor.** This was tried, measured, and rejected by the customer:
  a single factor faithfully preserves the desktop headline-to-body ratio, and that ratio is
  exactly what reads wrong on a phone: the headline dominates a 375pt measure and body copy
  looks tiny beside it. Mobile is a re-typesetting for a narrower measure: headlines compress
  harder than body copy. Derive with two anchors and interpolate linearly between them:

  ```
  body anchor:     desktop body    -> 16-18 mobile (18 on a large-ramp brand)
  headline anchor: desktop largest workhorse headline -> 26-30 mobile
  mobile(size) = A * size + B   through the two anchors, whole-pixel rounded
  floor at 14
  ```

  Worked, from the migration this rule comes from: anchors 27 to 18 and 50 to 28 give
  `64->34, 50->28, 34->21, 27->18, 18->14`, moving headline:body from 1.85 on desktop to 1.56
  on mobile. That compression is the point; there is deliberately no ratio acceptance test
  against the desktop ramp here, because matching the desktop ratio is the failure mode, not
  the goal. State both anchors and the floor as designer decisions.
  **Line heights: no mobile values needed at all if the desktop ramp uses percentage line
  heights**; a ratio rides the mobile font size automatically. Flag any pixel line heights in
  the source for conversion (foundations step 3 has the rule and the measured failure).
  **Where the source has mobile variants, census them instead of deriving**; the table reads
  `measured` in place of the anchors.
- **Palette, censused rather than sampled, and clustered by role.** Enumerate every distinct fill
  hex, including local overrides, then cluster only near-duplicates within about 2 to 3 values per
  RGB channel. Sample text-node fills at SEGMENT level with
  `getStyledTextSegments(['fills'])`, never `node.fills` alone: a mixed-run node reports
  `figma.mixed` or its first run and leaves every other color invisible. Measured: secondary-gray
  body copy at `#727272` across two modules was missed until the converter needed the primitive
  mid-batch. Sample background fills separately, and treat the same hex in two roles as two rows. A band and body copy may share
  `#222222`, but the semantic layer must be able
  to change them independently. For every cluster list the exact source hex, role, fill count,
  and modules where it appears. Propose the six Email Love theme roles (`backgroundColor`,
  `contentColor`, `textColor`, `linkColor`, `buttonTextColor`, `buttonContentColor`) from those
  clusters. List every proposed deviation from an exact source hex with its RGB delta, and list
  low-frequency source colors not carried into the six roles. The designer confirms this mapping.
- **Spacing system, censused rather than sampled.** Across every module, enumerate distinct
  values by role: section side padding, vertical rhythm, column gutter, card or inset padding,
  and mobile equivalents. Convert them to email scale where a factor applies and include the
  number of modules using each value. Propose one system or short ladder per role, name the
  largest outliers, and gate the proposal on a designer decision. Prefer a legible multiples-of-8
  system unless the source clearly uses another grid. Record named exceptions such as a
  full-bleed band or wide-quote outset. Any mobile padding above 160px on a 320px viewport is a
  defect. On REFERENCE ONLY, do not census source geometry; use 8, 16, 24, 32, 40, and 48 and
  state the selected section side padding.
- **Buttons: measure the button component itself, never infer it from the palette census.** Open
  every source button style and record its own background hex, label hex, corner radius, inner
  padding, and label type style. A color census can contain the correct hex and still assign it to
  the wrong role. Report each button style as measured values, and list any theme-versus-button
  difference under the Palette delta rule.
- **Target email width:** the width the converted system gets built at, which is 600 or 640 and
  nothing else. It is a hard constraint from the email clients rather than something the factor
  derives, so do not divide the source width by the factor to get it: on the measured case that
  arithmetic returns 496, which is not a width email can use, and the gap between it and 600 is
  exactly the width-versus-type tension Step 4 declares. Take 640 only where their ESP or brand
  asks for it, 600 otherwise, on every tier.
  Label it as the target, and list anything in the file that contradicts it.
- **Content margin, extracted as a PERCENTAGE of source width, then converted, and the content
  width it implies.** This step already hands over a target email width; this is the other half of
  the same measurement, and without it foundations has to invent the number. **This bullet is for an
  AUTHORITATIVE or PARTIAL source. On a REFERENCE ONLY one the content width is 560 on a 600 body,
  straight off Step 3's standards**, and you do not convert a source margin at all: a margin nobody
  chose carries no information, and a percentage of an arbitrary canvas is arithmetic dressed as a
  derivation. Report the standard and the fact that the source's insets varied, which is one of the
  signals that put the file in this tier. Measure where text
  actually starts on several designs rather than one: the left inset of the headline, the body copy,
  and the button label. Divide the inset by the source width to get a percentage, multiply that
  percentage by the TARGET email width to get the email-scale margin, and state the content width it
  implies (target width minus twice the margin). Worked, from the migration this rule comes from:
  text starting between 109 and 118px in on a 1092 wide design is about 10.5 percent, which on a
  600px target is a 63px margin and a 474px content width. Report the percentage, the converted
  margin, the implied content width, and which designs you measured.
  - **Measure leaf content, never container padding.** Use the resolved left edge of the actual
    text and image nodes relative to the module root. Container padding answers a different
    question: a full-bleed section can have zero side padding while its real inset lives one or
    two levels down on a column. A measured source had section side padding at zero on 116 of
    roughly 180 modules, while the leaf insets clustered at 16, 20, 24, 30, 32, and 40. Reading
    only the sections would have made the whole library too wide.
  - **Report the distribution, not only an average, and break it out by category.** A source can
    vary across the library while remaining exact inside one category. Preserve a category's
    consistent margin as evidence instead of standardizing it away, and name those categories so
    Phase 2 can retain them.
  - **A consistent source margin is evidence worth carrying, and say so in those terms.** It means
    the customer's own system has ONE margin, so the converted library should have one too, and that
    is the finding foundations acts on.
  - **An inconsistent source margin is a FLAG.** List the values you found, say the source has no
    single margin to inherit, and say that foundations will therefore pick one rather than derive it.
    Do not average them into a number that looks derived.
  - **Convert through the target width, not through the type factor**, and note where the two
    disagree (the width-versus-type check in Step 4). Same worked case: 10.5 percent of 1092 is
    115px, which is 52px through a 2.2 type factor and 63px through the 1.82 width ratio. Those are
    two different numbers for one margin, so state which factor you converted through.
  This is a derived STARTING value for Phase 2, not the final decision. Phase 2 fixes ONE content
  width for the library and may overrule this with a stated reason, and a derived number it can
  accept or overrule is strictly better than a number it invents: a per-module content width is what
  produces a text left edge that moves as the reader scrolls (render rule R0.3.1).

## Step 7: Write the migration report

Produce one markdown report, in this exact structure. **Source fidelity, Scale factor, Spacing
system, Palette, Mobile styles, and Module inventory are required sections**: they are what
Phases 2 and 3 consume, and a report missing any of them cannot be converted from.

# Migration audit: [Design system name]
## Summary
[Three sentences: what they have, how much converts cleanly, the one or two biggest items
needing design judgment. State the source fidelity tier here, because it reframes everything
below it. If the source is not at email scale, say so here; it is the finding
that changes the most work.]
## Source fidelity
[REQUIRED. Open with the evidence-authority order this audit used, so conversion inherits it
instead of re-deriving it: **Structural authority:** <the source node tree, or supplied/ESP HTML
where one exists - HTML is authoritative for the structure it contains>. **Visual authority:**
<the approved comps or source renders>. A screenshot supplied to show a defect is symptom
evidence, not the intended design. Then the tier: AUTHORITATIVE, PARTIAL, or REFERENCE ONLY. Then the signals you saw, the ones
for and the ones against: standard email width or not, equivalent margins identical or varying (with
the insets you measured), text styles, paint styles, variables, components, auto layout, mobile
variants. Then what the tier means for the build, in one short paragraph: preserve the source's
geometry, preserve the part that is provably consistent, or build the geometry to email standards and
take only the brand. Say that this is a judgement and a recommendation their designer can overrule.
On REFERENCE ONLY, state the standards the build will use (600 body, 560 content width, ramp with
body at 16, spacing in multiples of 8) and say plainly that a converted module whose margins do not
match the source is correct.]
## Inventory
[Source account, path, or file; item count; Figma pages and structured-object counts when
available; design count with desktop/mobile pairs merged; distinct module count; fonts in play.]
## Scale factor
[REQUIRED, and on a REFERENCE ONLY source it reads `Not applicable, source is reference only`
followed by the email standards from Source fidelity. Do not put a number here on that tier, not even
as background: whoever converts applies whatever number is in this section. On an AUTHORITATIVE or
PARTIAL source: both derivations with their arithmetic, the gap between them in percent, the
recommended factor, the reasoning for choosing it, and "designer decision" in as many words.
State the target email width the factor is measured against. One factor for the library; note
any design that contradicts it. When the two derivations agree, say so and give the single
number. Also state the WIDTH-VERSUS-TYPE check (Step 4): source width divided by target email
width, compared against the recommended type factor, the gap between them, and, when they differ,
which factor governs which quantities in words (type factor for type sizes, line heights, and
spacing; target width for the body width, content width, content margin, column splits, and image
widths). Say plainly that this is a tension the conversion declares rather than resolves, so nobody
reads two factors as an error to be corrected later.]
## Spacing system
[REQUIRED. On AUTHORITATIVE or PARTIAL, one row per spacing role with every source value at
email scale, module counts, proposed system value or ladder, and outliers. Close with `designer
decision`. Name every exception and every mobile value above 160px. On REFERENCE ONLY, state
`Not applicable, source is reference only`, then the 8, 16, 24, 32, 40, 48 scale and the one
section side padding selected from it.]
## Palette
[REQUIRED. One row per color cluster: source hex, usage count, and modules. Then map the six
theme roles to those clusters and list every deviation as `proposed #... vs source #..., delta
R/G/B`. List additional source colors not used by the six roles. Close with `designer decision`.
On REFERENCE ONLY the source palette still applies, and no role may be invented outside it.
Then add the dark-mode proposal, because the six theme keys are dark-mode values, not the light
palette repeated. Filling them with the light palette ships light-on-light in dark mode. Propose
a dark value per role, starting from the exporter's house defaults (`#000000` page, `#1F1F1F`
content, `#FFFFFF` text and links, `#FFFFFF` button with `#000000` label) and adjusting only
where the brand has a real dark treatment. Show the WCAG contrast ratio per pairing so the
designer approves legible values, not hex strings.
**`contentColor` is a global knob; never promote a single surface's brand color into it.** In dark
mode the exporter paints that value on each module wrapper and forces section and column fills to
transparent. Module fills are erased, not recolored, so every card, strip, and band flattens into
one wrapper surface. Keep `contentColor` at the neutral house default unless the brand's dark
treatment demonstrably covers most content surfaces. Record a band or footer that keeps its own
color in both modes as a per-node override recommendation, naming the module; conversion writes it
once on that module's main component. State two consequences for the designer: cards do not read as
cards in dark mode whatever the value, which is a plugin limitation rather than a build choice, and
image ink must clear contrast against the flattened surface because images are not erased.]
## Mobile styles
[REQUIRED. Open with the two anchors (body and headline, desktop -> mobile) and the interpolation
they imply. Then give the mobile type ramp as a table, one row per style: style, desktop size,
mobile size, with rows below the 14px floor marked as floored. State that line heights carry no
mobile override because the desktop styles use percentages, or list the exceptions.
Then give the mobile spacing overrides: the side padding text-bearing sections drop to on mobile
(20 unless the customer says otherwise); 28px mobile bottom padding on every non-last column of
every section that stacks; any section whose desktop padding exceeds 160px; and any `mj-group`
needing the full viewport for the Step 5 group arithmetic. Then list hide-on-mobile items by module
and row, with reasons. Close with `designer decision`. Where the source has mobile variants,
report measured values and say the derivation was skipped.]
## Module inventory
[REQUIRED, deduplicated, and this is the section Phase 3 works from. One row per DISTINCT
module: module name | category | appears in (design names) | source ref | verdict A/B/C/D |
concession | build constraints | content census | effort S/M/L | notes. The name is the name the
converted component will carry. **Content census is REQUIRED on every row** and contains two
integers, `T/I`: the source module's TEXT-node count and image-bearing-node count. An
image-bearing node is any node whose `fills[0].type` is `IMAGE`, including a frame background.
Collect both counts with one `findAll` while walking each module. They let Phase 3 prove that the
rebuild retained the customer's module rather than merely producing a plausible replacement.
**Source ref is REQUIRED on every row** and names the one appearance to
convert from, precisely enough to screenshot without re-deriving the split (Step 5): a design name
plus a node name or id, or, where there is no node to name, a position within that design ("top 0
to 480", "between the divider and the footer rule"). Every A row states either `none` or a named
concession in the concession column, with what is lost and the proposed substitute in the notes.
An overlap or an edge bleed uses the standard wording
`A (concession: image bleed rebuilt as a two column row)` verbatim, and is never a C.
**Build constraints is REQUIRED on every row and states either `none` or the short imperative
constraints from Step 5** (for example "render nodes, not raw fills: images clipped by z-order",
"two column row per R3.4.1, image left", or "image is inset 91 percent, not full bleed"), so that
nothing which changes how a module is built exists only in Flags. **Group the rows by category, in
the top-of-email-to-bottom order Step 5 specifies, and order the rows within a category by reuse,
highest first. The category order is load bearing:** Phase 2 creates one page per category in
exactly the order they appear here, so an incidental order in this table becomes an incidental page
list in the customer's library. The batch plan is read off Recommended next step, which names its
modules, rather than off row order.]
## Per-design roll-up
[One row per design: design name | width(s) | the module names it is made of, in order | worst
verdict present. A roll-up of the Module inventory, not a second classification: no verdict
appears here that is not already on a module row above.]
## Brand foundations
[Type ramp mapping table from the complete type census (style, authored size, factor, email size,
one row per style with the same factor on every row), button styles, and target email width.
Point to Spacing system and Palette rather than restating them. State that the ratio acceptance
test passed, with the two ratios you
compared. Also REQUIRED here, because foundations otherwise invents it: the source's **content
margin as a percentage of source width**, the email-scale margin it converts to through the target
width, the **content width** that implies, the designs you measured, and whether the source margin
was CONSISTENT (evidence the customer's system has one margin, which the converted library should
keep) or INCONSISTENT (a flag, listed with the values found, and foundations picks one rather than
inheriting it). Say which factor you converted the percentage through.
On a REFERENCE ONLY source this section splits: the palette, the typefaces and their email-safe
fallbacks, the logo, and the button styles come from the source as usual, while the ramp, the spacing
scale, the content width, and the target width are the standards from Source fidelity, stated as the
geometry the build uses. No factor column, no ratio test, no converted margin percentage. Keep the
source's authored sizes and insets in the report as the evidence for the tier, labelled as evidence.]
## Flags
[Everything a human should look at: fonts unavailable for email, naming typos, empty pages,
inconsistent widths, accessibility risks from image-heavy modules, module boundaries you
inferred rather than read. Plus three that are decisions rather than observations: every named
concession from the Module inventory, for the designer to accept or reject; the scale-factor
recommendation when the two derivations disagreed; and the source fidelity tier whenever the call
was a judgement rather than a reading, which means any mixed-signal call and every REFERENCE ONLY
one, since that tier discards the source's own geometry. State the signals for and against, the
call you made, and the question "is this file a specification or a reference". On a REFERENCE ONLY
source the tier line stands in for the scale-factor line, which has nothing to recommend; on a
PARTIAL source also flag each value you standardised. Anything here that constrains how a specific
module gets built must ALSO appear in that module's build constraints column (Step 5): Flags is
where a human decides, the row is where a builder reads, and a build constraint that lives only
here will be missed.]
## Effort estimate
[Per-verdict counts over MODULES, not designs, and an S/M/L per module (the Module inventory
already carries the per-module value; total it here). A modules are mechanical; C modules need a
design pass; D modules need product decisions; a concession costs decision time, and the bleed
concession (Step 5) is the one that also costs a little build time, since the swap adds a
restructure: a module that would otherwise be an S can be an M. Bleed modules still count as A, so
expect the A count to run higher and the C count lower than a first look at the library suggests.
State the total in designer-days as a range, and say plainly that estimates firm up after the
first converted batch.]
## Recommended next step
[The batch plan, naming modules by their Module inventory row names: foundations first, then
batch 1 of about five of the highest-reuse modules, then the later batches, with a design review
between batches. Then point at Step 8's two routes.]

Numbers in the report come from your actual reads, never estimates presented as counts. Where
you sampled instead of walking everything, say so.

## Step 8: Hand off to conversion

Deliver the report as a file the user can share internally. Then close the loop, because an
audit that ends without naming what happens next leaves the customer thinking the migration is
somebody's private process. There are two routes, and the report is the input to both:

1. **Self-serve with this plugin.** Continue with
   [conversion-overview.md](conversion-overview.md), [foundations.md](foundations.md), and
   [module-conversion.md](module-conversion.md): foundations once, then modules in batches with
   a designer review between batches. The conversion builds in a NEW target file and keeps this
   source file read-only. What it reads out of this report, by section name: the **Module
   inventory** (one module per row, one batch per group of rows, with the source refs, verdicts,
   concessions, build constraints, categories, and effort, and its category ORDER, which becomes
   the order of the component pages in the converted file), the **Source fidelity** (the tier,
   which decides whether the converter preserves your geometry or builds it to email standards
   and takes only your brand), the
   **Scale factor** where one applies (every number it builds is at that scale), the **Spacing
   system**, the **Mobile styles** (the two-anchor mobile ramp, spacing overrides, and
   hide-on-mobile list), the **Palette** (including its dark-mode proposal, which supplies the six
   dark theme keys), the **Brand foundations** (type
   ramp on email-safe fallbacks, buttons, target email width, and
   the content margin percentage with the content width it converts to, which is where foundations
   gets its one library-wide content width), and the **Flags**.
2. **Done for you.** Email Love's team runs the same process, design review included, as part
   of Enterprise onboarding: hello@emaillove.com.

Two things need a human "yes" before either route starts, three whenever Flags carries the source
fidelity tier, and all of them are in Flags: the tier, the scale
factor, and each named concession. They change what gets built, so getting them agreed now is
cheaper than re-running a batch. **The tier is the cheapest of the three to ask about and the most
expensive to get wrong**, since calling an authoritative file reference-only discards decisions the
designer made on purpose: ask it as one question, "is this file a specification or a reference". If the audit surfaced a missing component library file, that
blocks conversion outright; say so rather than letting a batch start without it.

Offer to answer questions about any specific module's verdict, and to re-run the audit after
they clean up anything the flags surfaced.
