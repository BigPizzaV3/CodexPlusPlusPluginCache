# Appendix: the render spec

## Contents

- R0: Sizing, spacing, content width, scale, and instance geometry
- R1: Tagging, visibility, fills, alignment, fonts, and content
- R2: Email-template roots versus reusable module roots

This is part 1 of the packaged transcription specification. Read it together with
`render-nodes.md` and `render-components-validation.md` before transcribing converter JSON.

This is the operative subset of `render-spec.md` and `structure.md` from the Claude skills
at immutable upstream commit
[`eb2cc3a`](https://github.com/email-love/claude-skills/tree/000502dec6215da200995a2367539bf8cc0d93b5),
derived from the plugin source (`email-love/Figma-plugin`), not from inference. Do not
reconstruct these rules from memory: that is hand-authoring by another name.

You may only use what an external agent can write: layer names, geometry, auto-layout,
fills/strokes/radii, TEXT node properties, `setSharedPluginData('emaillove', key, value)`,
and, for reusable modules, component creation plus component properties (R7, R8).

**Read R2 before you create anything.** This spec describes two different things, an EMAIL
TEMPLATE and a DESIGN-SYSTEM MODULE. They share every rule except the root, and the root is
where the difference is fatal.

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
| FILL | `mj-wrapper` under the root; `mj-section` under a wrapper; a single `mj-column` in its section; `mj-column-inner`; every leaf pair wrapper as a column child; the `mj-text` TEXT node inside its frame; the `mj-divider` LINE for a full-width rule; an `mj-button` frame chosen full width (R0.4) |
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

#### R0.3.1 CONTENT WIDTH is decided once, for the whole email

Content width is the width text actually occupies inside a section: the body width minus the side
margins that hold the copy off the edge. **It is ONE number for the whole email, and on Path A one
number for the whole design system, not a per-section value taken from whatever the worker returned
for that screenshot.** The sizing modes above say which node owns the width; this says what the
number is.

**The mechanism, because it is structural rather than careless.** The worker sees ONE screenshot at
a time. It has no knowledge of the sections around the one it is converting, so the section and
column padding it returns is a guess made per screenshot BY CONSTRUCTION. Each guess is individually
defensible. Accepting each one as authoritative therefore does not risk drift, it guarantees it.
Measured across the modules of one assembled email: side margins of 48, 40, and 20, which is three
content widths in one email out of six independently reasonable guesses.

**The failure signature is what a reviewer actually notices: the text left edge MOVES as you
scroll.** 20px in, then 40px, then back to 20px. Nobody reads that as a padding value being wrong,
because no individual padding value IS wrong: 48, 40, and 20 are all ordinary column paddings, and
each looks correct inside the section it belongs to. What is wrong is that they are not the same
number, and that is only visible ACROSS sections, so it survives every other check here and gets
caught the first time somebody scrolls the finished email.

So fix the number once, before you transcribe anything, and use it everywhere: from the design
system on Path A, and on Path B from B2 (560 on a 600 body when the design is not authoritative
about geometry; the source's own margin, converted through the target width, when it is). What has to
equal that number is the TOTAL side inset, the section's horizontal padding plus the outer column's,
because the worker splits the margin across the two levels however it likes. Carry it on the section
and leave the outer column's horizontal padding at 0 unless the design needs an inner gutter: with a
600 body and a 560 content width every text-bearing section carries 20/20, and every section's text
starts at the same x. **Two sanctioned exceptions share one invariant:** the outer edge of a
text-bearing block sits at the email's content width. Full-bleed image bands may run to the body
width. Card and inset blocks may add their own deliberate card padding inside an outer edge at the
content width, or inside a narrower width established by the design system. Verify the band edge,
not the innermost content box, and remember that columns in an `mj-group` sum to the group width.

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
default. FIXED only when the design system pins a button width. Record the choice in your
report when it is anything other than HUG.

Never set the button frame's height. It comes from the text height plus `inner-padding`, and
that padding is also how you get a tap target of at least 44px.

### R0.5 Where padding belongs, by level

| Level | Typical values | Notes |
| --- | --- | --- |
| `mj-wrapper` | 0 to 20 | Outer breathing room around a group of rows. This is where a visible gap between content and the outer background color comes from |
| `mj-section` | 0 to 20, often 0 | Many designs keep section padding at 0 and control spacing at column and element level. Horizontal section padding also defines the content box column percentages are computed against (R3.2), and its horizontal value comes from the email's one content width (R0.3.1), not from the worker |
| `mj-column` | 0 horizontal, 10 to 20 vertical | The most commonly adjusted level for VERTICAL room. Horizontal is different: a column's side padding is part of the TOTAL side inset R0.3.1 fixes, and R0.3.1 carries that inset on the section, so this stays 0 unless the design needs an inner gutter (a multi-column row's gutter is exactly that case) |
| Leaf pair wrapper | sparingly | Fine tuning one element, for example 10px above a button but not above the text over it |
| `mj-button` `inner-padding` | from the MJML, symmetric only | The button's tap target, not layout spacing. Asymmetric values round-trip wrong (R4.3) |

In a conversion the worker's paddings are authoritative with exactly ONE exception, and the
exception is horizontal: **the side inset that holds copy off the body edge comes from the email's one
content width (R0.3.1), never from the worker**, because that number is decided once for the whole
email and the worker's is a per-screenshot guess by construction. That inset is the section's
horizontal padding plus the outer column's, since the worker puts the margin at either level, and
R0.3.1 says to carry it on the section. Every other padding in the JSON, every
vertical value above all, is transcribed exactly, **as the number it already is**: they come back at
email scale whatever resolution you sent the screenshot at, so there is no scale conversion to apply
to them (R0.6). The
ranges above are for gaps you have to invent. Four things that keep padding honest: pick a
base unit (8px) and use multiples of it; padding sits inside the box and eats content width
(two 50 percent columns with 20px each side lose 80px total); Outlook ignores values under
5px and handles even numbers more predictably; mobile padding is a separate override
(`mobileStylesPadding*`), not a reason to compromise the desktop value.

### R0.6 Every number here is at EMAIL scale, never source scale

Widths, type sizes, paddings, radii, and image dimensions in this appendix are email pixels: a
600 or 640 body, a 16px body copy, a 20px section padding. On Path A the design system already
carries those numbers. **On Path B, how you arrive at them has two answers, and B2's first question
decides which: is the design you were handed AUTHORITATIVE about geometry or not?**

- **Authoritative** (a past email of theirs, a comp you wrote at the email width, a library drawn at
  600 with real styles, components, and repeating margins): its geometry is a specification. B2's
  scale check settles one factor before anything is sent to the worker, and the rest of this section
  applies.
- **Not authoritative** (an old mockup at no particular width, no styles, absolute positioning,
  margins that differ design to design): its geometry is an artefact of how the file got made, and
  preserving its proportions reproduces guesses. **There is NO factor.** Build to email standards
  instead, stated rather than derived: a 600 body, one content width of 560, body copy at 16 on a
  12/14/16/20/24-to-30 ramp, spacing in multiples of 8. Take the palette, the typefaces, the logo, the
  copy, and the order of the blocks from the source and nothing else. Skip to "No factor" at the end
  of this section. In a migration this is the audit's SOURCE FIDELITY tier, REFERENCE ONLY, and it is
  the audit that names it.

**The worker is scale-agnostic: its numbers do NOT arrive at the scale of the screenshot you sent.**
It classifies semantically at a canonical email scale rather than measuring your pixels. Measured: a
768px wide screenshot sent for a 600px build target came back with `mj-body` width 600 and round
email-scale values throughout (24, 16, 40), with nothing in the payload tracking the input
resolution. Still send a PNG at the target email width, because that is the input the worker was
tuned for, and still pin `emailWidth` in `promptInputs`, because that is the setting that actually
fixes the body width; just do not treat either as a lever on the arithmetic. Three consequences: do
not compute a scale conversion on the worker's returned numbers expecting it to matter, because it
is usually a no-op and treating it as meaningful invites a second factor into a system whose whole
rule is one factor; the factor still matters enormously, but for reading the SOURCE, which is what
the authored sizes divide by, and for cropping and sizing images taken out of it (R4.2.1); and do not
assume a future worker version behaves the same way, so sanity check ONE returned number, the root
`mj-body` width, against the width you are building to before trusting the whole payload. Never carry
a source pixel across untouched.

**The rest of this section, down to the "No factor" heading, is for a design whose geometry is a
specification.**

A frame built at source scale passes every other check in this appendix: it hugs, it is tagged,
it exports. It is simply two or three times too big, which shows up as a body size no email uses
and a root wider than the body, and on a single email there is nothing beside it to make that
obvious. So check the two numbers rather than trusting the canvas. In a migration the audit
settles the factor once, in its **Scale factor** section, and a fresh derivation there would
overrule a decision a designer already made, or, on a reference-only source, manufacture a decision
nobody made at all.

**Whatever the factor is, it is ONE number applied to EVERY quantity it governs**: type sizes, line
heights, the spacing scale, paddings, spacer heights, radii, border widths. Rounding is allowed, to
the nearest whole pixel, after the division. Choosing a value because it looks like a size email
usually uses is a second factor invented for one element, and the way to catch it is to divide the
largest converted type size by the smallest and compare that to the same ratio in the source. More
than a couple of percent apart and per-style rounding has crept in. A converted size that looks
wrong is evidence against the factor, never licence to nudge the one style. B2 has the measured
case: a 55 headline and a 35 body, a source ratio of 1.57, built as 30 and 16 for a ratio of 1.88,
and it read as a padding bug rather than a type bug.

**Widths are the one thing that factor does not govern, and this is the TWO FACTOR TENSION.**
Choosing a target email width AND a type factor independently reintroduces two factors, and the two
ratios agree only when the source happens to have been drawn at an exact multiple of the target
width, which a design drawn to present is not. Measured: a 1092 wide source built to a 600px body is
1092/600 = 1.82 across its width while its confirmed type factor was 2.2, and 1092/2.2 = 496 rather
than 600. So **run the check once, before you build: divide the source width by the target email
width and compare that ratio to the type factor.** If they differ by more than a couple of percent,
say so when you hand off and name the split: the type factor governs type sizes, line heights, and
the spacing scale, and the target email width governs the body width and everything measured across
it (content width, column splits, image widths). Neither quantity can be bent to make the ratios
meet, because the email width is a hard constraint from the clients and legibility is a hard
constraint on type. **This is a tension to declare, not a bug to fix.** What it must never be is
implicit: an email whose margins nobody can trace back to a decision is how the source's consistent
115px text margin became a 20px one that is neither 52 (through the type factor) nor 63 (through the
width ratio).

**No factor: what a design that is not authoritative about geometry gets instead.** Derive nothing,
not from the width, not from the ramp, and not "for information" beside the real numbers, because a
factor written down anywhere gets applied by whoever reads it next. The numbers are the standards
above, and there is no ratio check to run, since the ratio test proves one factor was applied
uniformly and there is no factor: a ramp eyeballed style by style has no ratio worth matching. What
replaces it is a read-back, that the built ramp is the standard ramp with body at 16. And say plainly,
in your report and to the user, that the geometry is yours by decision, so an email whose margins do
not match the source is correct rather than a defect somebody should later fix back. The measured
failure this prevents: a factor derived on such a source and applied faithfully produced a 16px body
inside 20px margins, both correctly divided out of a file where nobody had chosen either.

### R0.7 DOUBLE PADDING: a gap belongs to ONE block, never to both

The space between two stacked blocks is one decision, made once, on one node. When the block above
already carries a `paddingBottom`, the block below must NOT add a `paddingTop` for the same gap,
and the reverse. Setting both is not "a little more room": the two values add, so a 40 below the
section above plus a 30 above the block below renders as 70, and the email reads as broken to the
designer who drew it.

**Failure signature**, in the order you notice it:

- The gap looks roughly twice what the design shows, while each of the two paddings that produced
  it is individually plausible. That plausibility is why this survives review.
- A leaf frame's height exceeds its content by exactly the padding you wrote, and the email's total
  height is over by the same number. An `mj-image-Frame` measuring 362 around a 332 rectangle is a
  30 that should not exist.
- Removing either value alone fixes the look. That is the proof there were two.

**Where to put it: on the preceding block's `paddingBottom`.** Prefer trailing space over leading
space so that each block owns the gap that follows it. Then a block switched off (`visible =
false`, or a BOOLEAN component property, R8) takes its spacing away with it, instead of leaving a
hole where lead-in space on the next block used to be paid for by a neighbor that is now gone.

This holds at every level, not just section to section: wrapper to section, section to column,
column to leaf pair. Before writing any padding, read what the sibling above it already carries. On
Path B the worker's paddings are authoritative and already complete for vertical rhythm (R0.5; the
horizontal side padding is the one value you override, R0.3.1), so a vertical padding you add on top
of them is almost always this bug. On Path A the component you instanced already carries its
own spacing, so a padding you add around the instance is the same bug at wrapper level.

**At library level the inter-module gap has one fixed owner: the module wrapper's
`paddingBottom`.** Give every module wrapper a `paddingBottom` from the established spacing ladder
(32 in the measured library) and the LAST module, normally the footer, 0. Zero section-level
vertical padding that was doing inter-module duty; three measured modules got shorter when their
24/24 section padding stopped double-serving as the gap. Then a disabled module takes its spacing
with it and cannot leave a hole. Two modules touching with zero gap on the canvas is the tell that
the owner is missing.

### R0.8 A geometry write inside an INSTANCE can silently NO-OP, so read it back

`resize()` on a node nested three or more levels deep inside a component instance does nothing.
Measured: no error is thrown, the call returns as though it worked, and the dimensions read back
unchanged, even after explicitly setting `layoutSizingVertical = 'FIXED'` on that node first to rule
out a sizing mode overriding the write. **Only the instance root accepts an explicit resize.** The
symptom is that it looks like the write succeeded, and that is the whole cost: no exception, no
warning, no partial result, so the time goes into re-checking the number, the units, the call order,
and the parent's sizing, while the thing that is actually wrong is that the write never landed.

**Range writes share the failure mode.** A `setRangeFills` or other `setRange*` call can
silently fail. After every range write, read back the property with
`getStyledTextSegments` and confirm that the intended segmentation landed.

**The working pattern:** set `layoutSizingVertical = 'FILL'` down the whole descendant chain, from
the instance's own child to the node you want to resize; set `primaryAxisSizingMode = 'FIXED'` on the
top-level INSTANCE, which on a VERTICAL frame is the same property R0.1 forbids and is the one thing
the API leaves no way around, since a frame hugging its primary axis absorbs the resize and reads
back unchanged; `resize()` the INSTANCE, which cascades to every FILL descendant; then read the
target node's dimensions back and confirm they moved. **Then put the sizing back where R0.1 wants
it**, because that FILL chain and FIXED instance root are how the height TRAVELS, not the shape you
hand off: set the target node's own vertical sizing to FIXED (a RECTANGLE carries its pixels and has
no hug, R4.2), return the descendant frames and the instance root to HUG, and read those back too.
What you hand off still has to pass checklist item 7, where nothing but an `mj-spacer` is left with
a fixed height.

**The habit this implies: after ANY geometry write inside an instance, READ IT BACK, and treat an
unchanged value as a FAILED WRITE rather than as a no-op that did not matter.** The same holds for
sizing modes and paddings written to instance internals. This is a Path A concern above all, because
A4's image fills sit on rectangles several levels inside an instance.

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
   href. Never insert helper or group frames that are not one of the tags above.
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
   and note it in your report.
10. **Line-height.** Worker values are unitless ratios ("1.5"). Set Figma
    `lineHeight = { unit: 'PERCENT', value: ratio * 100 }`. Exception: a ratio of exactly 1.2
    or 1 may be left as `{ unit: 'AUTO' }`; the exporter emits AUTO as `1.2`.
11. **Content HTML.** Worker `content` strings may contain inline HTML. Convert:
    `<br>`/`<br/>` to `\n`; `<a href="...">text</a>` to a `setRangeHyperlink` on that
    character range; `<b>`/`<strong>` to the Bold style on that range
    (`setRangeFontName`); strip any other tags. Characters must contain no leftover markup.
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
modules. This file mostly builds emails; it builds a module only in A5 and B6.

**A module is not a small email.** An email template root *contains* wrapper components; a
module *is* one of those wrapper components. So a module has no wrapper inside it and no
`mainFrame` above it.

R3 through R6 apply identically to both shapes. Only the root differs.

### R2.1 EMAIL TEMPLATE root (one per MJML document)

Create a top-level FRAME on the target page. It may be a COMPONENT instead (R7) when the
whole email is meant to be reused; nothing below changes.

- **Geometry:** `resize(W, 100)` where `W` is the numeric `mj-body` width (usually `600`),
  then `layoutMode = 'VERTICAL'` and immediately `layoutSizingVertical = 'HUG'`, horizontal
  FIXED at `W`. `primaryAxisAlignItems = counterAxisAlignItems = 'MIN'`. `itemSpacing = 0`,
  all paddings 0. The `100` is a throwaway that gets the node onto the canvas.
- **Layer name:** the email name (this becomes the component name and storage path if the
  frame is later saved). Do NOT put a tag in the root layer name, and do NOT write a `name`
  key on it: the root is identified by `nodeType`, not by a tag.
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
  Use the file's established dark-mode treatment on every email root identically. Where none
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
- Children: the `mj-wrapper` components in document order (R3.1). After appending each
  wrapper set its `layoutSizingHorizontal = 'FILL'`.

The `mjml`, `mj-head`, `mj-body` tags themselves produce NO Figma nodes; the exporter
reconstructs them (body width comes from the root frame's width).

### R2.2 DESIGN-SYSTEM MODULE root: the mj-wrapper IS the component

There is no separate root. Create a COMPONENT and tag it `mj-wrapper`. That component is not
a container that holds a wrapper; it **is** the wrapper, so R3.1 describes this exact node.

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
  selection as a saveable top-level block rather than a fragment.
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
  theme. `buttonContentColor` and `buttonTextColor` are worse: the exporter emits them
  unconditionally whenever they are non-empty, without comparing them to the enclosing email,
  so a module carrying them ships its own dark-mode CSS into every email it is placed in. A
  module inherits nothing and conflicts with everything, so the safe default is **no theme
  keys at all**; the email root supplies them. One sanctioned exception is a surface that keeps
  the same brand color in both themes. Write `contentColor` once on the module's main component;
  instances mirror that shared plugin data. The conditional `backgroundColor`, `contentColor`,
  `textColor`, and `linkColor` keys are safe when explicitly required, while
  `buttonContentColor` and `buttonTextColor` remain unconditional and should stay absent.

### R2.3 The evidence, so this reads as ground truth rather than preference

Read at `origin/main` of `email-love/Figma-plugin`, all paths under `src/`.

1. **Every `mj-wrapper` the plugin builds is already a COMPONENT.** `UiParser.ts:1519-1522`:
   `if (tag === MjmlNodeType.Wrapper || isStandalone) frameNode = figma.createComponent()`.
   Purple wrapper components inside a plugin-built email are normal. Do not "fix" them into
   frames.
2. **The two shapes go in through two different screens, and each one rejects the other.**
   Custom Templates, Add New Template is the email-template route: `AddTemplate.tsx:62` is the
   only caller of `select-component` and always sends `customType: 'customProperties'`, which
   lands in `code.ts:3226-3236` and rejects any selection *without* the marker, with "Please
   select valid email template". A module has no marker, so that dialog can never take one. The
   module route is the **Assets sidebar Upload button** (`AssetsComponent.tsx:610-632`), which
   needs a selected design system and dispatches `syncTemplateUpload` (`code.ts:3861`), taking
   an array of node ids when more than one node is selected. (`select-component` also has a
   mirror-image module branch at `code.ts:3280-3307` that rejects a selection carrying the
   marker; no UI reaches it today.)
3. **The design-system upload path keys off the `mj-wrapper` tag, not the marker.**
   `code.ts:3892-3893` sets
   `isTopLevel = getName(getMetaName(selectedNode)).tagName === 'mj-wrapper'`. Only when
   `isTopLevel` is true does the plugin wrap a clone in its own temporary `mainFrame`
   envelope and generate the MCP companion JSON. A module root not tagged `mj-wrapper` is
   archived as if it were a whole email and gets no MCP JSON at all.
4. **Marking a node both ways is worse than either mistake.** In both serializers the
   `mainFrame` branch is tested before any wrapper handling, first match wins, so the output
   is a nested `mjml` document inside `mj-body` that nothing downstream can compile.

**Strip `nodeType` from every module component. Non-negotiable.**
