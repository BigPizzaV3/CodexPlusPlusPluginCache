# Appendix: the render spec

## Contents

- R0: Sizing, spacing, content width, scale, and instance geometry
- R1: Tagging, visibility, fills, alignment, fonts, and content
- R2: Email-template roots versus reusable module roots

This is part 1 of the packaged migration transcription specification. Read it together with
`render-nodes.md` and `render-components-validation.md` before transcribing a module.

This is the operative migration-specific subset of `render-spec.md` and `structure.md` from
the Claude skills at immutable upstream commit
[`fb96b26`](https://github.com/email-love/claude-skills/tree/fb96b26aa346394ae83f63c1d6ebe6b734029c5b),
derived from the plugin source (`email-love/Figma-plugin`), not from inference. Do not
reconstruct these rules from memory: that is rebuilding by eye under another name.

You may only use what an external agent can write: layer names, geometry, auto-layout,
fills/strokes/radii, TEXT node properties, `setSharedPluginData('emaillove', key, value)`,
and, for modules, component creation plus component properties (R7, R8).

**Read R2 before you create anything.** This spec describes two different things, an EMAIL
TEMPLATE and a DESIGN-SYSTEM MODULE. They share every rule except the root, and the root is
where the difference is fatal. A migration batch builds modules.

## R0. Sizing: hug heights, deliberate widths (read before you create a node)

Sizing decides whether the email survives Outlook, whether it survives a copy change, and how
the button behaves on a phone. Email Love's own product docs state it plainly: the Height of
each component and its child frames must be Hug contents, not Fixed, because fixed-height
containers cause content clipping, especially in Outlook.

### R0.1 Height is HUG on the root and on EVERY descendant frame

- `layoutSizingVertical = 'HUG'` on the root, and on every wrapper, section, group, column,
  column-inner, and leaf pair wrapper inside it. Never `'FIXED'`.
- Outlook on Windows renders through the Word engine and CLIPS whatever does not fit, so a
  fixed-height frame that looked correct on canvas ships as a cut off headline in the least
  forgiving client in the mix. It also breaks the first time copy runs one line longer.
- If you call `resize(w, h)` at all, the height argument is a throwaway. Set `layoutMode`,
  then set `layoutSizingVertical = 'HUG'` in the same breath, before you append children.
- Order of operations: `layoutSizing*` is only accepted once the node itself has a
  `layoutMode`, and `'FILL'` only once the node is a child of an auto-layout parent. So:
  create, set `layoutMode`, append, then set sizing.
- Three node types are not frames. A TEXT node hugs vertically. The `mj-image` RECTANGLE and
  the `mj-divider` LINE carry intrinsic geometry from `resize()` and have no hug at all.
  Their pair wrapper FRAMES still hug, and that is what keeps them from being clipped.
- `mj-spacer` is the single node that ENDS with a fixed height, and R0.2 says why. A frame passes
  through a fixed vertical size in exactly one other place, the instance-resize remedy in R0.8,
  which requires it and puts it back; nothing else is ever left FIXED.

### R0.2 Vertical rhythm is auto layout padding, never a height

- Space between blocks is `paddingTop` / `paddingBottom` on the owning frame. Not a taller
  frame, not `itemSpacing`, not manual positioning.
- **Manual positioning does not export at all.** The exporter reads Auto Layout padding and
  nothing else, so a node nudged into place exports with zero spacing and the design
  collapses silently. If a gap is not padding, it does not exist in the sent email.
- Prefer padding to spacers. When the worker JSON returns an `mj-spacer` whose only job is a
  gap between two blocks, fold that height into the padding of the neighboring element and
  drop the spacer. Keep a spacer only where the design needs a standalone gap of its own (a
  colored band, a gap inside a bordered column).
- `mj-spacer` is the ONLY node here that carries a fixed height, and it is load bearing: the
  exporter emits `height: <node.height>px` straight off the node, and a spacer has no
  children to clip. Set `layoutSizingVertical = 'FIXED'` on a spacer and nowhere else.

### R0.3 Width: FILL, HUG, and the narrow case for FIXED

| Sizing | Where it belongs |
| --- | --- |
| FILL | `mj-wrapper` under an email root; `mj-section` under a wrapper; a single `mj-column` in its section; `mj-column-inner`; every leaf pair wrapper as a column child; the `mj-text` TEXT node inside its frame; the `mj-divider` LINE for a full-width rule; an `mj-button` frame chosen full width (R0.4) |
| HUG | `mj-group` unless R3.3 requires a bordered group to be pinned for headroom; the `mj-button` frame when it is auto-width, which is R0.4's default rather than a rule of this table; `mj-button-text`; and the transient state of any frame you created but have not yet appended and set to FILL |
| FIXED | the four cases below, a bordered group under R3.3, and a button deliberately pinned per R0.4 |

FIXED width is correct for:

1. **The root node**, at the numeric `mj-body` width (usually 600). It applies to an
   email-template root and to a module's own wrapper component alike (R2): a module is
   measured against the same body width as the emails it will live in.
2. **Every column in a section that holds two or more columns**, unequal columns above all.
   The exported percentage is
   `column.width / (section.width - section horizontal padding) * 100`, so the pixel number
   IS the percentage. A 200 + 360 split only stays a 200 + 360 split because both are pinned.
3. **Every column inside an `mj-group`.** MJML requires percentage widths there, and the
   exporter derives them from your pixels.
4. **The `mj-image` RECTANGLE**, whose pixel width also decides whether the image stays fluid
   on mobile (R4.2).

A bordered `mj-group` is the one container exception: R3.3 pins it so its columns can sum
short of 100 percent by the total border width. An ordinary group stays HUG.

Anywhere else, a FIXED width is a latent bug: it stops tracking the section content box the
moment a padding value changes.

**And where a load-bearing FIXED width sits above text (cases 2 and 3, plus a FIXED button in
R0.4), pin it with slack, never at Figma's hug width.** The pixel you measured was measured in
the font Figma rendered; the email declares a different stack and a pinned column cannot grow.
R3.3.1 has the rule, the numbers, and the failure signature.

#### R0.3.1 CONTENT WIDTH is a foundation, decided once for the library

Content width is the width text actually occupies inside a module: the body width minus the side
margins that hold the copy off the edge. **It is a FOUNDATION, decided once for the whole library
and used by every module, not a per-module value taken from whatever the worker returned for that
screenshot.** The sizing modes above say which node owns the width; this says what the number is,
and it is the same number in every text-bearing module in the file.

**The mechanism of the failure, stated plainly, because it is structural rather than careless.** The
design-converter worker sees ONE screenshot at a time. It has no knowledge of the module's siblings,
no memory of the module converted before it, and no access to the library's foundations, so the
section and column padding it returns is a guess made per module BY CONSTRUCTION. Each guess is
individually defensible. Accepting each one as authoritative therefore does not risk drift, it
guarantees it: six modules converted from six screenshots will carry several different content
widths unless something outside the worker fixes one number.

**Measured, across the modules of one assembled email:**

| Module | Content width | Side margin |
| --- | --- | --- |
| Logo header | 504 | 48 |
| Hero, text led | 560 | 20 |
| Testimonial | 520 | 40 |
| Cream section | 520 | 40 |
| Copy Block | 560 | 20 |
| Footer | 560 | 20 |

Three content widths in one email, out of six independently reasonable guesses.

**The failure signature, which is what a reviewer actually notices: the text left edge MOVES as you
scroll.** 20px in, then 40px, then back to 20px. Nobody reads that as a padding value being wrong,
because no individual padding value IS wrong: 48, 40, and 20 are all ordinary column paddings, and
each one looks correct inside the module it belongs to. What is wrong is that they are not the same
number, and that is only visible ACROSS modules. So it survives a per-module review, passes every
other check in this appendix, and gets caught the first time somebody scrolls a finished email,
which is the most expensive moment to find it.

**The remedy: the foundations phase fixes ONE content width, and every module uses it.** Phase 2
decides the number and records it; Phase 3 applies that number instead of the worker's. Section
padding then follows from the content width rather than the other way round, and what has to equal
the library number is the TOTAL side inset, the section's horizontal padding plus the outer column's,
because the worker splits that margin across the two levels however it likes. Carry it on the section
and leave the outer column's horizontal padding at 0 unless the design needs an inner gutter: with a
600 body and a 560 content width, every text-bearing section carries 20/20 and every module's text
starts at the same x. Same discipline as the single scale factor in R0.6 where a factor applies, and for the same
reason. **This rule holds on every fidelity tier**, because it is about agreement between modules
rather than agreement with the source: on a reference-only source the number is simply 560 on a 600
body, taken from the standards instead of derived from a source margin.

**Two sanctioned exceptions, governed by one invariant:** the outer edge of a text-bearing
block sits at the library content width. Full-bleed image bands may run to the body width,
because bleeding is the design intent. Card and inset blocks may add their own audited card
padding inside an outer edge at the library content width, or inside a narrower width explicitly
named by the audit's Spacing system. A 540 card with 25px padding around 490px of content is
correct; a plain text section with a different total side inset is not. Verify the band edge,
not the innermost content box, and remember that columns in an `mj-group` sum to the group
width rather than the section content box.

For a multi-column row the content width is still the number the columns sum to (R3.3, R3.4, R5.4):
a 560 content width takes columns plus gutters summing to 560. Widening a row from 520 to 560 means
the added 40 goes to the column that has slack, normally the text column, holding the image column
and the gutter fixed, so the sum is re-derived rather than the margin quietly re-invented. Worked:
`40 + 136 + 24 + 360 + 40 = 600` becomes `20 + 136 + 24 + 400 + 20 = 600`.

### R0.4 Button width is a mobile behavior decision

- **FILL**: the plugin enables full width on mobile (`width: 100%`) and the exporter sets
  `applyFullWidth`. The button spans the column on desktop and on mobile.
- **HUG or FIXED**: the button keeps its width on mobile.

Choose from the source design, never from what makes the canvas look tidy. An edge to edge
CTA is FILL. An inline, auto-width button is HUG, which is what worker JSON buttons are by
default. FIXED only when the design system pins a button width. Record the choice in the
module's report line when it is anything other than HUG.

Never set the button frame's height. It comes from the text height plus `inner-padding`, and
that padding is also how you get a tap target of at least 44px.

### R0.5 Where padding belongs, by level

| Level | Typical values | Notes |
| --- | --- | --- |
| `mj-wrapper` | 0 to 20 | Outer breathing room around a group of rows. This is where a visible gap between content and the outer background color comes from |
| `mj-section` | 0 to 20, often 0 | Many designs keep section padding at 0 and control spacing at column and element level. Horizontal section padding also defines the content box column percentages are computed against (R3.2), and its horizontal value comes from the library's one content width (R0.3.1), not from the worker |
| `mj-column` | 0 horizontal, 10 to 20 vertical | The most commonly adjusted level for VERTICAL room. Horizontal is different: a column's side padding is part of the TOTAL side inset R0.3.1 fixes, and R0.3.1 carries that inset on the section, so this stays 0 unless the design needs an inner gutter (a multi-column row's gutter is exactly that case) |
| Leaf pair wrapper | sparingly | Fine tuning one element, for example 10px above a button but not above the text over it |
| `mj-button` `inner-padding` | from the MJML, symmetric only | The button's tap target, not layout spacing. Asymmetric values round-trip wrong (R4.3) |

In a conversion the worker's paddings are authoritative with exactly ONE exception, and the
exception is horizontal: **the side inset that holds copy off the body edge comes from the library's
single content width (R0.3.1), never from the worker**, because that number is a foundation and the
worker's is a per-module guess by construction. That inset is the section's horizontal padding plus
the outer column's, since the worker puts the margin at either level, and R0.3.1 says to carry it on
the section. Every other padding in the JSON, every vertical
value above all, is transcribed exactly, **as the number it already is**: they come back at email
scale whatever resolution you sent the screenshot at, so there is no scale conversion to apply to
them (R0.6). The
ranges above are for gaps you have to invent. Four things that keep padding honest: pick a
base unit (8px) and use multiples of it; padding sits inside the box and eats content width
(two 50 percent columns with 20px each side lose 80px total); Outlook ignores values under
5px and handles even numbers more predictably; mobile padding is a separate override
(`mobileStylesPadding*`), not a reason to compromise the desktop value.

### R0.6 Every number here is at EMAIL scale, never source scale

Widths, type sizes, paddings, radii, and image dimensions in this appendix are email pixels: a
600 or 640 body, a 16px body copy, a 20px section padding. **How you ARRIVE at those numbers has two
answers, not one, and the audit's SOURCE FIDELITY tier (Step 3) says which one you are under.** Read
that tier before you read the rest of this section, because half of what follows does not apply to a
given migration.

- **AUTHORITATIVE or PARTIAL: the source's geometry is a specification, so you divide.** A source
  file that was never meant to export as email is often drawn at a multiple of email scale, and the
  audit settles the factor once (its **Scale factor** section, a number a designer confirmed) so every
  module in the library is built against the same one. Everything in this section about factors,
  ratios, and the two factor tension is written for these two tiers.
- **REFERENCE ONLY: the source's geometry is not a specification, so there is NO FACTOR and nothing to
  divide.** The numbers are email standards, stated rather than derived: a **600** body, **one content
  width for the whole library** at 560, a ramp with **body at 16** (12, 14, 16, 20, 24 to 30), and a
  **spacing scale in multiples of 8**. From the source you take the palette, the typefaces, the logo,
  the copy, and the module structure. You take no measurement, so there is no arithmetic to get wrong
  and no ratio to preserve. Skip to "REFERENCE ONLY: no factor, and no missing number" at the end of
  this section.

**The worker is scale-agnostic: its numbers do NOT arrive at the scale of the screenshot you
sent.** It classifies semantically at a canonical email scale rather than measuring your pixels.
Measured: a 768px wide screenshot sent for a 600px build target came back with `mj-body` width 600
and round email-scale values throughout (24, 16, 40), with nothing in the payload tracking the input
resolution. Still send a PNG at the target email width, because that is the input the worker was
tuned for, but send it for reliability rather than as a lever on the arithmetic. Three consequences:

- **Do not compute a scale conversion on the worker's returned numbers expecting it to matter.** It
  is usually a no-op, and treating it as meaningful invites a second factor into a system whose
  whole rule is one factor (this section, plus the ratio test below).
- **Where a factor exists it still matters enormously, just not for worker output.** It is for reading
  the SOURCE, which is what the authored sizes divide by, and for cropping and sizing images taken out
  of the source file (R4.2.1). On a REFERENCE ONLY source it is the target width that does that second
  job: an image comes across at the width of the column it lands in, at the crop's natural aspect,
  with no factor in the arithmetic.
- **Do not assume a future worker version behaves the same way.** Sanity check ONE returned number
  against the target width before trusting the whole payload; the root `mj-body` width is the
  cheapest. If that number is not the width you are building to, the payload is at some other scale
  and every number in it needs dividing.

**The rest of this section, down to the REFERENCE ONLY heading, is for an AUTHORITATIVE or PARTIAL
source.**

So divide source measurements by that factor before they become geometry here, and never carry a
source pixel across untouched. A module built at source scale passes every other check in this
appendix: it hugs, it is tagged, it exports. It is simply two or three times too big, which shows
up as a body size no email uses and a root wider than the body, and it only becomes obvious next
to a module built correctly. If you find yourself deriving the factor from the file rather than
reading it from the audit, stop: a fresh derivation silently overrules the decision a human
already made between two disagreeing derivations, and on a REFERENCE ONLY source it manufactures a
decision nobody made at all.

**One factor, chosen once, applied to EVERY quantity it governs.** Not type sizes only: line
heights, the spacing scale, paddings, spacer heights, radii, border widths. Uniformity is the entire
point of settling on a single number, and it is lost the moment any one value is arrived at some
other way. **Widths are the one thing it does not govern, and THE TWO FACTOR TENSION below is why:**
the body width, and everything measured across it (content width, column splits, image widths),
comes from the target email width instead.
Rounding is allowed, but only to the nearest whole pixel, and only after the division. What is not
allowed is picking a converted value because it looks like a size email usually uses. That is a
second factor, invented for one style, wearing the costume of a sensible number.

**Then check the result against the source's own RATIOS.** Divide the largest converted type size
by the smallest and compare that to the same ratio in the source. Do it for the ends of the spacing
scale too. If the two ratios differ by more than a couple of percent, per-style rounding has crept
in, and the drift is somewhere between the number you divided and the number you wrote down.

**The failure this catches, measured in a real converted module.** The source was drawn above email
scale: headline 55, body 35. What got built at 600 wide: headline 30, body 16. That is two
different factors inside one module, 55/30 = 1.83 on the headline and 35/16 = 2.19 on the body, and
the consequence is that the source's own type relationship did not survive. The source
headline-to-body ratio is 55/35 = 1.57; the built one is 30/16 = 1.88. The headline is 20 percent
too large relative to the body.

The audit had done its job. It reported 1.815 from the canvas width and 2.2 from the type ramp,
named the 21 percent gap, and recommended 2.2. Foundations then built the ramp style by style
toward round email numbers, a 65 to 30, a 55 to 25, a 35 to 16, and per-style factors came back in
through that rounding, so the recommended factor was never actually applied to anything.

What makes it expensive is the symptom, because it does not present as a type problem. The module
reads as though its padding is wrong: a headline 20 percent oversized crowds the space around it,
so the reviewer goes hunting through padding values that are every one of them correct, and finds
nothing. The ratio check finds it in one division.

**A converted size that looks wrong is evidence against the FACTOR, not licence to adjust one
style.** If a 25px headline looks small, the reading is that 2.2 may be the wrong factor for this
library. Revisit the factor, put the whole ramp through the new one, and re-run the ratio check.
Never nudge the one style and leave the rest where they were. One style nudged is this bug; the
whole ramp moved together is a decision, and it is a decision that belongs back with the audit and
the designer who confirmed the factor.

**THE TWO FACTOR TENSION: choosing a target email width AND a type factor independently
reintroduces two factors.** This is the exception the single-factor rule above just named, and it
has to be declared rather than resolved. The width ratio and the type ratio agree only
when the source happens to have been drawn at an exact multiple of the target width, and a mockup
drawn to present is not drawn to email proportions, so usually they do not agree.

Measured on the migration this note comes from: a 1092 wide source built to a 600px body has a width
ratio of 1092/600 = 1.82, while the confirmed type factor was 2.2, and 1092/2.2 = 496 rather than
600. So the build carried 2.2 on its type and 1.82 across its width, and nothing in the process ever
said so out loud. It surfaced in the margins: the source's consistent 115px text margin is 52px
through the type factor and 63px through the width ratio, and the library was built at 20px, which
is neither. The single-factor rule had been applied to the type ramp and never to the width
decision.

**The check, run once in foundations and stated in the report:** divide the source width by the
target email width, compare that ratio to the chosen type factor, and if they differ by more than a
couple of percent, SAY SO and name which factor governs which quantities. Do not leave it implicit.
The defensible split, and the one to state unless a designer decides otherwise, is that the type
factor governs type sizes, line heights, and the spacing scale, while the target email width governs
the body width and everything measured across it (content width, content margin, column splits,
image widths). The reason is that the email width is a hard constraint from the clients rather than a
choice, and legibility is a hard constraint on type, so neither quantity can be bent to make the two
ratios meet. Write it down as a sentence with both numbers in it.

**This is a genuine tension with no clean answer, not a bug with a fix.** No single factor both
preserves the source's type ramp and preserves its proportions across a body width email can
actually use, because the source was drawn at a width email cannot use. Naming the split is the
honest outcome. Picking one factor and pretending it covered both quantities is how a converted
library ends up with margins nobody can trace back to a decision, which is the defect R0.3.1 exists
to prevent.

**REFERENCE ONLY: no factor, and no missing number.** On a source whose geometry was never a
specification, the tension above does not arise, because it is a tension between two ways of
preserving a proportion and this tier preserves none. So:

- **Derive nothing.** Not from the width, not from the ramp, and not "for information" beside the real
  numbers. A factor recorded anywhere gets applied by whoever reads it next, whatever caption sits
  next to it.
- **The numbers are the standards** listed at the top of this section: a 600 body, 560 content width,
  body at 16 on a 12/14/16/20/24-to-30 ramp, spacing in multiples of 8, one content width for every
  module and one section padding library-wide. Rounding onto a multiple of 8 is not a second factor
  here, it is the specification.
- **There is no ratio check**, because the ratio test proves a single factor was applied uniformly and
  there is no factor. A ramp that was eyeballed style by style has no ratio worth matching. What
  replaces it is a read-back: the built ramp is the standard ramp, body at 16, each step present once.
- **A module whose margins do not match the source is CORRECT**, and the foundations report and every
  batch report have to say so in words. Otherwise the next person to open both files reads the
  difference as a defect and corrects the library back toward the source, which reintroduces exactly
  what this tier discarded.
- **The failure this branch exists to prevent, measured.** A factor was derived on a reference-only
  source and applied faithfully, and the result was a 16px body inside 20px margins: both numbers
  correctly divided out of a source where nobody had chosen either. Every arithmetic step was right.
  The premise was wrong.

### R0.7 DOUBLE PADDING: a gap belongs to ONE block, never to both

The space between two stacked blocks is one decision, made once, on one node. When the block
above already carries a `paddingBottom`, the block below must NOT add a `paddingTop` for the same
gap, and the reverse. Setting both is not "a little more room": the two values add, so a 40 below
the section above plus a 30 above the block below renders as 70, and the module reads as broken to
the designer who drew it.

**Failure signature**, in the order you notice it:

- The gap looks roughly twice what the design shows, while each of the two paddings that produced
  it is individually plausible. That plausibility is why this survives review.
- A leaf frame's height exceeds its content by exactly the padding you wrote, and the module's
  total height is over by the same number. An `mj-image-Frame` measuring 362 around a 332
  rectangle is a 30 that should not exist.
- Removing either value alone fixes the look. That is the proof there were two.

**Where to put it: on the preceding block's `paddingBottom`.** Prefer trailing space over leading
space so that each block owns the gap that follows it. Then a block switched off (`visible =
false`, or a BOOLEAN component property, R8) takes its spacing away with it, instead of leaving a
hole where lead-in space on the next block used to be paid for by a neighbor that is now gone.

This holds at every level, not just section to section: wrapper to section, section to column,
column to leaf pair. Before writing any padding, read what the sibling above it already carries.
The worker JSON paddings are authoritative and already complete for vertical rhythm (R0.5; the
horizontal section padding is the one value foundations overrides, R0.3.1), so a vertical padding
you add on top of them is almost always this bug.

**At library level the inter-module gap has one fixed owner: the module wrapper's
`paddingBottom`.** Give every module wrapper a `paddingBottom` from the audit's spacing ladder (32
in the measured library) and the LAST module, normally the footer, 0. Zero section-level vertical
padding that was doing inter-module duty; three measured modules got shorter when their 24/24
section padding stopped double-serving as the gap. Then a disabled module takes its spacing with
it and cannot leave a hole. Two modules touching with zero gap on the canvas is the tell that the
owner is missing.

### R0.8 A geometry write inside an INSTANCE can silently NO-OP, so read it back

`resize()` on a node nested three or more levels deep inside a component instance does nothing.
Measured while fixing an image band: no error is thrown, the call returns as though it worked, and
the dimensions read back unchanged, even after explicitly setting `layoutSizingVertical = 'FIXED'`
on that node first to rule out a sizing mode overriding the write. **Only the instance root accepts
an explicit resize.**

**The symptom is that it looks like the write succeeded**, and that is the whole cost of this bug.
Nothing surfaces: no exception, no warning, no partial result. The time goes into re-checking the
number you passed, the units, the order of the calls, and the parent's sizing, because the one thing
that is actually wrong, that the write never landed at all, is the one thing the API did not tell
you.

**Range writes share the failure mode.** A `setRangeFills` or other `setRange*` call can
silently fail. After every range write, read back the property with
`getStyledTextSegments` and confirm that the intended segmentation landed.

**The working pattern**, in this order:

1. Set `layoutSizingVertical = 'FILL'` down the whole descendant chain, from the instance's own
   child to the node you actually want to resize.
2. Set `primaryAxisSizingMode = 'FIXED'` on the top-level INSTANCE. On a VERTICAL auto-layout
   frame that is the same property R0.1 forbids, and the API leaves no way around it: a frame
   hugging its primary axis absorbs the resize and reads back unchanged. So this is the one
   sanctioned transient FIXED height in the appendix, live only for steps 3 and 4, and step 5 is
   what makes it transient.
3. `resize()` the INSTANCE. The height cascades to every FILL descendant.
4. Read the target node's dimensions back and confirm they moved.
5. Put the sizing back where R0.1 wants it. The FILL chain and the FIXED instance root are how
   the height TRAVELS, not the shape you hand off: once the target node carries the height, set
   its own vertical sizing to FIXED (a RECTANGLE carries its pixels and has no hug, R4.2), then
   return the descendant frames and the instance root to HUG, and read those back too. The
   finished module still has to pass checklist item 7, where nothing but an `mj-spacer` is left
   with a fixed height.

**The habit this implies, and it is the part that generalizes past this one bug: after ANY geometry
write inside an instance, READ IT BACK, and treat an unchanged value as a FAILED WRITE rather than
as a no-op that did not matter.** The same holds for sizing modes and paddings written to instance
internals. A build that verifies its own writes catches this in seconds; a build that trusts them
catches it at design review, if at all. It bites hardest where a module's image height has to vary
per instance (R4.2.1), because that is a resize aimed at a rectangle several levels down.

## R1. Non-negotiable ground rules

1. **Tag every node via shared plugin data.** The plugin identifies a node with
   `getMetaName(node)`: it reads the plugin data key `name` first (private, with fallback to
   the shared `emaillove` namespace), else the Figma layer name. Always write
   `node.setSharedPluginData('emaillove', 'name', '<exact tag>')`. The layer name is then
   free for a human label (R6). Never rely on the layer-name fallback. A layer named
   `mj-section - Report CTA` with no shared key FAILS, because the whole string is read as
   the tag; the only layer-name forms that work are the bare tag (`mj-section`) or the parsed
   form `Report CTA, (mjml:mj-section)`.
2. **Exact tag strings.** Matching is exact string equality against: `mj-wrapper`,
   `mj-section`, `mj-group`, `mj-column`, `mj-column-inner`, `mj-text-Frame`, `mj-text`,
   `mj-image-Frame`, `mj-image`, `mj-button-Frame`, `mj-button`, `mj-button-text`,
   `mj-divider-Frame`, `mj-divider`, `mj-spacer`. Case sensitive, `-Frame` suffix capitalized
   exactly as shown.
3. **Every frame in the chain must resolve to a known tag.** The exporter's fallback for
   anything unrecognized is `renderNodeAsImage`: it silently flattens the node AND its entire
   subtree into a hosted PNG. An untagged frame between a column and its leaves destroys
   every well-tagged leaf below it. An untagged button becomes a picture of a button with no
   href. Never insert helper or group frames that are not one of the tags above. **The one
   sanctioned untagged frame is an editable-image region**, where an inventory row carries
   verdict B or C and the design content is placed in a column deliberately untagged so the
   exporter flattens exactly that region (Phase 3 step 2). That is a decision the batch report
   names, not a frame you forgot; everywhere else untagged means broken.
4. **Visibility.** The extractor returns early on `!node.visible`. Every node you create must
   end `visible = true`.
5. **Both axes, same value.** For horizontal alignment the exporter reads
   `primaryAxisAlignItems` and maps MIN to left, MAX to right, anything else (including
   CENTER) to center. On a VERTICAL frame that mapping is wrong for what you see on canvas,
   so the plugin's own components always set `primaryAxisAlignItems` and
   `counterAxisAlignItems` to the SAME value. Do the same on every auto-layout frame you
   create, except the deliberate multi-column top-align case in R3.4: primary MIN with counter
   on the content's horizontal alignment. The shared value is what exports everywhere else.
6. **Fills discipline.** The exporter treats `fills[0]` as a background signal: leaf wrapper
   frames (`mj-text-Frame`, `mj-button-Frame`, `mj-divider-Frame`, `mj-spacer`) with any
   visible fill export `container-background-color`; `mj-image-Frame` must always have
   `fills = []`; columns, sections, and wrappers with a fill export `background-color`. So
   set `fills = []` on every frame with no background in the MJML, and one SOLID fill of the
   exact hex when the MJML sets a background. Never leave a hidden 0-opacity fill lying
   around.
7. **itemSpacing = 0 everywhere.** Nonzero itemSpacing makes the exporter emit extra `c-gap`
   raw divs and half-padding CSS. All vertical rhythm is padding.
8. **Ignore `css-class` in the worker JSON.** The exporter regenerates classes. Never copy
   them anywhere.
9. **Fonts.** Load every font before setting characters. Map `font-family: "Arial,
   sans-serif"` to Figma family `Arial` (first entry of the stack, trimmed). Weight and style
   map to the Figma style name:

   | font-weight | style (normal) | style (italic) |
   | --- | --- | --- |
   | 100 | Thin | Thin Italic |
   | 200 | Extra Light | Extra Light Italic |
   | 300 | Light | Light Italic |
   | 400 | Regular | Italic |
   | 500 | Medium | Medium Italic |
   | 600 | Semi Bold | Semi Bold Italic |
   | 700 | Bold | Bold Italic |
   | 800 | Extra Bold | Extra Bold Italic |
   | 900 | Black | Black Italic |

   If a family lacks the style, fall back to Regular of the same family, then Inter Regular,
   and note it in the module's report line. In a migration the foundations text styles are
   the real source: map every text node to them rather than to whatever the worker guessed.
10. **Line-height.** Worker values are unitless ratios ("1.5"). Set Figma
    `lineHeight = { unit: 'PERCENT', value: ratio * 100 }`. Exception: a ratio of exactly 1.2
    or 1 may be left as `{ unit: 'AUTO' }`; the exporter emits AUTO as `1.2`.
11. **Content HTML.** Worker `content` strings may contain inline HTML. Convert:
    `<br>`/`<br/>` to `\n`; `<a href="...">text</a>` to a `setRangeHyperlink` on that
    character range; `<b>`/`<strong>` to the Bold style on that range (`setRangeFontName`);
    strip any other tags. Characters must contain no leftover markup.
12. **No em dashes** in any layer name, plugin data value, or text characters.

## R2. Which are you building? Email template or design-system module

**Answer this before you create a single node.** There are exactly two root shapes in an
Email Love file. Building the wrong one produces a module that uploads as a broken email,
or an email the plugin refuses to open.

| | **EMAIL TEMPLATE** | **DESIGN-SYSTEM MODULE** |
| --- | --- | --- |
| What it is | One sendable email | One reusable block dropped into many emails |
| Root node | FRAME (or COMPONENT) that carries NO `mj-*` tag | COMPONENT that **is** the `mj-wrapper` |
| `nodeType` = `mainFrame` | **REQUIRED** on the root | **FORBIDDEN.** Nothing stops the upload: the marker makes the block archive as a whole email |
| Shared `name` on the root | none (the root is untagged) | `mj-wrapper` |
| Theme color keys | all eight, on the root, alongside the `nodeType` marker (R2.1) | none by default (see R2.2) |
| Root layer name | the email name | **the module name** (it becomes the saved component name and its storage path) |
| What lives directly inside | `mj-wrapper` components, stacked | `mj-section` frames |
| Component properties | rarely; a campaign email is a one-off | **yes, they live here** (R8) |

The one-line test: **is this a whole email someone will send, or one block someone will place
into many emails?** Heroes, footers, copy blocks, 2-up product rows, banners: those are
modules. **Phase 3 of a migration builds modules, not emails.** Foundations builds exactly one
email template, in Phase 2 step 7, so batch 1 has somewhere to drop modules and see them in
context.

**A module is not a small email.** An email template root *contains* wrapper components; a
module *is* one of those wrapper components. So a module has no wrapper inside it and no
`mainFrame` above it. If your module root is a `mainFrame` containing an `mj-wrapper`, you
have built a one-wrapper email and mislabeled it, and R2.3 explains why the plugin will
reject it.

R3 through R6 apply identically to both shapes. Only the root differs.

### R2.1 EMAIL TEMPLATE root (Phase 2 step 7 only)

Create a top-level FRAME on the target page. It may be a COMPONENT instead (R7) when the whole
email is meant to be reused; nothing below changes.

- **Geometry:** `resize(W, 100)` where `W` is the numeric `mj-body` width (usually `600`),
  then `layoutMode = 'VERTICAL'` and immediately `layoutSizingVertical = 'HUG'`, horizontal
  FIXED at `W`. `primaryAxisAlignItems = counterAxisAlignItems = 'MIN'`. `itemSpacing = 0`,
  all paddings 0. The `100` is a throwaway that gets the node onto the canvas.
- **Layer name:** the email name. Do NOT put a tag in the root layer name, and do NOT write a
  `name` key on it: the root is identified by `nodeType`, not by a tag.
- **Shared plugin data (namespace `emaillove`), all REQUIRED:**

  | key | value |
  | --- | --- |
  | `nodeType` | `mainFrame` (how the plugin recognizes the template; without it nothing else matters) |
  | `backgroundColor` | dark-mode page background. House default `#000000` |
  | `contentColor` | dark-mode content/section background. House default `#1F1F1F` |
  | `textColor` | dark-mode text color. House default `#FFFFFF` |
  | `linkColor` | dark-mode link color. House default `#FFFFFF` |
  | `buttonTextColor` | dark-mode button label color. House default `#000000` |
  | `buttonContentColor` | dark-mode button background. House default `#FFFFFF` |
  | `lightThemeBackgroundColor` | the light mj-body background; the one light value in the set |
  | `fallBackFontName` | `Arial` |

  **The six theme keys are dark-mode values, and filling them with the light palette ships
  light-on-light.** They fire only inside the dark-mode media query. Always set all of them.
  Use the audit Palette's dark-mode proposal on every email root identically. Where no proposal
  exists, use the house defaults above and flag them for review. Never substitute the light
  palette as a stand-in. `lightThemeBackgroundColor` is the light body value. Before writing
  `contentColor`, confirm it represents the treatment for most filled content surfaces. Dark-mode
  CSS paints it on the WRAPPER and forces section and column fills to transparent, so every filled
  cell flattens into that one surface. A brand color used by one footer or card belongs on that
  module as a per-node override rather than the global value.

  **State at hand-off that dark mode flattens module fills.** Cards do not remain visually distinct,
  and this exporter behavior is unreachable from Figma. An image background is not a workaround:
  images are not erased, so a baked light card can keep its light colors under forced-light text.
- Optional: `emailSubject`, `emailPreHeader` (plain strings).
- Also give the root frame a visible SOLID fill of the body background so the canvas looks
  right.
- Children: `mj-wrapper` components in document order (R3.1), each set to
  `layoutSizingHorizontal = 'FILL'` after append.

The `mjml`, `mj-head`, `mj-body` tags themselves produce NO Figma nodes; the exporter
reconstructs them (body width comes from the root frame's width).

### R2.2 DESIGN-SYSTEM MODULE root: the mj-wrapper IS the component

There is no separate root. Create a COMPONENT and tag it `mj-wrapper`. That component is not
a container that holds a wrapper; it **is** the wrapper, so R3.1 describes this exact node,
minus its "direct child of the root" line: in a module there is nothing above it.

```js
const moduleRoot = figma.createComponent()
moduleRoot.name = 'Hero, text led'                                   // the module name
moduleRoot.setSharedPluginData('emaillove', 'name', 'mj-wrapper')    // the ONLY required key
// and NOT: setSharedPluginData('emaillove', 'nodeType', 'mainFrame')
```

- **Node:** COMPONENT, a direct child of its category page. Not a FRAME:
  `addComponentProperty` does not exist on a FrameNode, so a frame module can never carry
  properties. R7 has the four rules that keep a COMPONENT root working.
- **Shared `name` = `mj-wrapper`.** This single key is what makes the plugin treat the
  selection as a saveable top-level block rather than a fragment. A module tagged
  `mj-section` or left untagged is not a module.
- **`nodeType`: never write it.** Not `mainFrame`, not anything else. R2.3 is the evidence.
- **Layer name = the module name**, clean and human, because it becomes both the saved
  component name and its storage path, and there is no rename field in the save dialog.
  `Hero, text led` and `Footer, legal + social` are good; `EmailLove_clone`, `Frame 42`, and
  anything containing `mj-` are not. This is the one place where the layer name is load
  bearing rather than cosmetic.
- **Geometry:** identical to an email root, at the same email width.
- **Paddings, fill, radius, `fullWidth`, `stackColumns` / `reverseStack`:** all per R3.1.
  They are wrapper attributes and this node is the wrapper.
- **Children:** `mj-section` frames in order, each set to
  `layoutSizingHorizontal = 'FILL'` after append. **No `mj-wrapper` inside a module**, and no
  `mainFrame` anywhere in the subtree.
- **Component properties live here** (R8), because this is the component that directly owns
  the section, column, and leaf nodes.
- **Theme color keys: leave them off** unless a designer asked for a dark-mode treatment on
  this specific block. On a wrapper they are per-node dark-mode *overrides*, not the email
  theme. The plugin writes `backgroundColor` / `contentColor` / `textColor` / `linkColor`
  onto every wrapper component it creates (`UiParser.ts:1570`), so those four are legitimate
  here, but they only ever mean "override the enclosing email for this block".
  `buttonContentColor` and `buttonTextColor` are worse: the exporter emits them
  unconditionally whenever they are non-empty, without comparing them to the enclosing email,
  so a module carrying them ships its own dark-mode CSS into every email it is placed in. A
  module inherits nothing and conflicts with everything, so the safe default for a converted
  module is **no theme keys at all**; the email root supplies them. One sanctioned exception is
  a surface that keeps the same brand color in both themes. Write `contentColor` once on the
  module's main component; instances mirror that shared plugin data. The conditional
  `backgroundColor`, `contentColor`, `textColor`, and `linkColor` keys are safe when explicitly
  required, while `buttonContentColor` and `buttonTextColor` remain unconditional and should
  stay absent.

### R2.3 The evidence, so this reads as ground truth rather than preference

Read at `origin/main` of `email-love/Figma-plugin`, all paths under `src/`.

1. **Every `mj-wrapper` the plugin builds is already a COMPONENT.** `UiParser.ts:1519-1522`:
   `if (tag === MjmlNodeType.Wrapper || isStandalone) frameNode = figma.createComponent(); else frameNode = figma.createFrame();`
   So a wrapper-as-component is not an agent convention layered on top of the plugin; it is
   what the plugin itself produces every time it renders MJML into Figma. Purple wrapper
   components inside a plugin-built email are normal. Do not "fix" them into frames, and do
   not wrap one in something else to make it look like a root.
2. **The two shapes go in through two different screens, and each one rejects the other.**
   Custom Templates, Add New Template is the email-template route: `AddTemplate.tsx:62` is the
   only caller of `select-component` and always sends `customType: 'customProperties'`, which
   lands in `code.ts:3226-3236` and rejects any selection *without* the marker, with "Please
   select valid email template". A module has no marker, so that dialog can never take one. The
   module route is the **Assets sidebar Upload button** (`AssetsComponent.tsx:610-632`), which
   needs a selected design system and dispatches `syncTemplateUpload` (`code.ts:3861`), taking
   an array of node ids when more than one node is selected, so a whole approved batch uploads
   at once. (`select-component` also has a mirror-image module branch at `code.ts:3280-3307`
   that rejects a selection carrying the marker; no UI reaches it today.)
3. **The design-system upload path keys off the `mj-wrapper` tag, not the marker.**
   `code.ts:3892-3893` sets
   `isTopLevel = getName(getMetaName(selectedNode)).tagName === 'mj-wrapper'`. Only when
   `isTopLevel` is true does the plugin wrap a clone in its own temporary `mainFrame`
   envelope and generate the MCP companion JSON (`code.ts:3934`, whose own comment notes that
   bare sections and columns "would emit a fragment the backend can't compile"). A module root
   that is not tagged `mj-wrapper` is archived as if it were a whole email and gets **no MCP
   JSON at all**.
4. **Marking a node both ways is worse than either mistake.** In both serializers the
   `mainFrame` branch is tested before any wrapper handling (`nodeJsonExtractor.ts:282`
   versus the wrapper branch at `1587`; `exportTemplate.ts:180` versus `285`). First match
   wins. So a node carrying `name = mj-wrapper` **and** `nodeType = mainFrame` passes the
   `isTopLevel` check, gets cloned into the temp envelope, and then still matches the
   `mainFrame` branch inside that envelope, producing a nested `mjml` document inside
   `mj-body` that nothing downstream can compile.

**Strip `nodeType` from every module component. Non-negotiable.**
