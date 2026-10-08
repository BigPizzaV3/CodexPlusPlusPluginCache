# Render spec: containers, leaves, and shared attributes

## Contents

- R3: Wrapper, section, group, column, Two Column Swap, and inner column
- R4: Text, image, button, divider, and spacer leaf pairs
- R5: Cross-cutting padding, color, alignment, width, link, alt, and border rules

## R3. Containers

### R3.1 mj-wrapper

**In an email template** this is a node inside the root. **In a design-system module this
node IS the root** (R2.2): same tag, same attributes, same auto-layout, but created as a
COMPONENT with no `mainFrame` above it and none on it.

- Node: FRAME as a direct child of an email root; COMPONENT as a module root.
- Shared `name` = `mj-wrapper`.
- Auto-layout: `layoutMode = 'VERTICAL'`, vertical HUG (never FIXED), horizontal FILL under
  an email root or FIXED at the email width as a module root,
  `primaryAxisAlignItems = counterAxisAlignItems = 'MIN'`.
- Attribute mapping:

  | MJML attr | Figma property |
  | --- | --- |
  | `padding-top/right/bottom/left` | `paddingTop/Right/Bottom/Left` (parseFloat px) |
  | `background-color` | one SOLID fill; absent means `fills = []` |
  | `border-radius` | `cornerRadius` (or the four per-corner radii for a 4-value string) |
  | `full-width` | shared plugin data `fullWidth` = `'true'` (only if present) |

- Optional shared keys: `stackColumns` (`'true'` default), `reverseStack`. They propagate
  down to child sections that lack their own value.
- Children: `mj-section` frames in order; each gets `layoutSizingHorizontal = 'FILL'` after
  append.

### R3.2 mj-section

- Node: FRAME, child of a wrapper (or of the root if the MJML has no wrapper).
- Shared `name` = `mj-section`.
- Auto-layout: `layoutMode = 'HORIZONTAL'`, both sizing HUG, then FILL width as a child of
  the wrapper (height stays HUG),
  `primaryAxisAlignItems = counterAxisAlignItems = 'CENTER'` (primary exports as the section
  `text-align`: MIN left, MAX right, else center).
- Attribute mapping: same table as wrapper. Borders map to strokes (R5.6).
- Geometry matters: exported column widths are computed as
  `columnWidth / (section.width - section.paddingLeft - section.paddingRight) * 100%`. With
  the standard worker output (section 600 wide, padding-left/right 20, column width 560) that
  is exactly 100 percent. Set the section's horizontal padding from the email's one content width
  rather than from the worker (R0.3.1: a 560 content width on a 600 body is 20/20), keep its
  vertical padding as the worker gave it, and make the column pixel widths sum to that content
  width. Where the worker's side margin and the email's disagree, the email's wins and the column
  widths are re-derived to the new sum.
- Children: `mj-column` frames (or a single `mj-group`) left to right.
- Optional shared keys: `stackColumns` = `'false'` to prevent mobile stacking without a
  group; `reverseStack` = `'true'` to reverse stacking order on mobile.

### R3.3 mj-group

- Node: FRAME, MUST be a direct child of `mj-section`, never of a column.
- Shared `name` = `mj-group`.
- Auto-layout: `layoutMode = 'HORIZONTAL'`, both sizing HUG (the group's width comes from the
  fixed columns inside it), `primaryAxisAlignItems = counterAxisAlignItems = 'CENTER'`
  (primary exports as horizontal alignment; counter exports as `vertical-align`).
- **Never fill the group itself.** Dark-mode CSS paints `contentColor` on the wrapper and forces
  section and column backgrounds to transparent, but it has no group selector. A group's own fill
  therefore survives while its text turns white. Put band fills on the group's columns instead;
  those fills erase to transparent over the wrapper surface in dark mode. A filled `mj-group` is a
  verification failure. Padding, radius, and borders still map to the group.
- Children: two or more `mj-column` frames with FIXED pixel widths.
- Width math: the exporter emits the group width as
  `group.width / (section.width - section horizontal padding) * 100%`, and each inner column
  as `column.width / (group.width - group horizontal padding) * 100%`. A 560 group containing
  280 + 280 exports 50%/50%.
- Columns inside a group keep their elements side by side on mobile.
- A group may be narrower than the section content box. Its columns sum to the group's width,
  never the section content width.
- A bordered group needs width headroom. Pin the group FIXED at its intended width and make
  its columns sum short by at least the total border width; a HUG group forces columns to 100
  percent and can wrap the last bordered column.
- On mobile the exporter expands a group to the viewport and applies its column percentages to
  that width. A tight icon cluster therefore spreads across the phone. If tight clustering is
  mandatory, the only reliable fallback is one combined image with one href, which loses
  per-icon links and needs the designer's approval.
- **A group is not the vehicle for the Two Column Swap** (R3.4.1, the standard rebuild for an
  overlapping or bleeding image). That pattern wants the mobile stacking a group suppresses, so
  it uses a plain `mj-section` holding two `mj-column`s. Reach for a group only when the design
  genuinely must stay side by side at 390px.

#### R3.3.1 Pinned widths that carry text need slack

**Never pin a text-bearing column at the width Figma hugged to.** Pinning the width is
correct, and R0.3 is right that the pixel IS the percentage. What the pixel is NOT is a safe
measurement. It was taken in the font Figma rendered on canvas, the email declares a different
one, and a pinned column cannot grow. Text that fit by a hair on canvas wraps at send time, in
a font the canvas never showed you.

Two independent sources of drift stack up:

1. **Same family name, different binary.** Figma renders its own bundled Inter. The exporter
   writes `font-family: Inter, Arial` and also emits an `mj-font` link to
   `fonts.googleapis.com/css2?family=Inter`, so the email renders Google's Inter build, not
   Figma's. Measured on a real string: "Lorem Ipsum Dolor" at Inter Regular 16px fits inside a
   143px content box on the Figma canvas and measures 143.39px in Chromium against Google's
   Inter. An overflow of 0.39px, 0.27 percent, is enough to wrap the row onto two lines.
2. **The webfont may not load at all.** Any client that blocks or fails the `mj-font` link
   falls back to the next entry in the stack, which is `fallBackFontName` and defaults to
   `Arial`. Measured drift on real strings against Figma's Inter runs as high as +11.5 percent,
   and it goes both ways: do not assume the fallback is always narrower or always wider than
   what you see.
3. **The source family may have been substituted.** A boundary measured in the source face
   is not valid after a fallback substitution. Re-measure the natural hug width in the
   substituted family and feed that value to the formula below; a metric clone matches its
   target fallback, not the unrelated brand face it replaced.

So take the text node's natural hug width in Figma, then pin the column at:

```
column width = max( ceil(hugWidth * 1.12), hugWidth + 8 ) + the column's horizontal padding
```

The 12 percent covers the worst measured fallback drift **for Arial and Helvetica**, which is
what `fallBackFontName` resolves to unless someone changed it. The `+ 8px` floor stops short
strings ("Sale", "New", "Just In") from ending up with one or two pixels of slack, which is no
slack at all.

**Use 25 percent instead when the fallback is a wide face.** `fallBackFontName` is a writable
key, so a brand can set it to Verdana, Tahoma or Georgia. Those set much wider than Arial at the
same size: measured against Figma's rendering across realistic label strings, Verdana reached
+24.9 percent, Georgia +11.5 percent and Tahoma +9.8 percent, so a 12 percent allowance is not
enough to hold them. Read the root's `fallBackFontName` before you pin anything, and if it names
one of those three, widen by 1.25 rather than 1.12. A brand webfont paired with a wide fallback
is a materially different risk from Inter paired with Arial, and should not share one number.

Applying it: widen the FIXED columns only. Leave the group HUG and let Figma recompute its
width, and leave every FILL child alone, they cascade through the layout engine on their own.
Then re-derive the exported percentages by hand and confirm the inner ones still sum to 100.
Worked example from the fix that produced this rule: a 66px badge column plus a 151px label
column in a 217px group became 74 + 169 in a 243px group, exporting 30.4527% + 69.5473%, which
is exactly 100.

**Failure signature, so you recognize it next time:** it looks right on the Figma canvas and
wraps in the plugin Preview, same machine, same session, same minute. Nothing is mis-tagged, no
width is "wrong" in Figma terms, and a diff of the tree shows nothing at all. When a reviewer
reports a line breaking that does not break on canvas, suspect a pinned width first, and
measure the string against the **exported** font stack rather than trusting the canvas.

**Where else this bites.** Anywhere a FIXED width sits above text:

- Columns in a group (this section) and columns in a multi-column section (R0.3 case 2). Group
  columns are the worse of the two, because they never stack on mobile, so the pinched width is
  what every reader gets.
- An `mj-button` pinned to FIXED (R0.4) with a label inside it.

It does NOT apply to FILL columns or FILL buttons, which resolve against the content box at
render time and adapt. Do not pad those; the extra width would be real design drift for no gain.

#### R3.3.2 Group columns shrink on mobile, and R3.3.1 does not protect them

A group never stacks, so each fixed desktop column becomes a percentage at smaller viewports.
Before pinning one, compute:

```
resolved = columnWidth / groupWidth * (mobileViewport - mobile section side padding)
```

For text, require the resolved width to exceed the longest unbreakable word in the exported
font by at least 5 percent. For a fixed-aspect image, require at least its natural width. If a
column fails, widening usually just transfers the defect to a neighbor. Collapse the row into
one reflowing `mj-text` with hyperlink ranges, let loose columns stack, or hide decorative
content on mobile. Character-by-character wrapping that appears only in the mobile export is
the signature of this defect.

### R3.4 mj-column

- Node: FRAME, child of `mj-section` or `mj-group`.
- Shared `name` = `mj-column`.
- Auto-layout: `layoutMode = 'VERTICAL'`, vertical HUG, never FIXED. A column is the frame
  most often left at a fixed height by mistake, and it is where Outlook clipping bites
  hardest.
- Horizontal sizing, per R0.3:
  - **Single column in its section: FILL.** It resolves to the section content box, which is the
    email's one content width once you have set the section's horizontal padding from it (R0.3.1),
    and exports `width: 100%`. Never HUG, which collapses the column to its content, and never
    FIXED, which exports the same 100 percent today and drifts silently the moment a padding
    changes (R0.3).
  - **Two or more columns in one section, or any column inside an `mj-group`: FIXED.** Load
    bearing: the exported percentage is derived from the pixel number. Start from the worker's
    `width` attrs for the RATIO between the columns, then re-derive the actual numbers so they sum
    to the email's content width rather than to the worker's (R0.3.1 has the worked example).
    When you are deriving a number from a Figma measurement, and the column contains text, add
    slack per R3.3.1 before you pin it.
- **Axis alignment rule (the trap):** set BOTH axes to the dominant horizontal alignment of
  the column's content. `align="left"` or mixed: `MIN` / `MIN`. `align="center"`: `CENTER` /
  `CENTER`. `align="right"`: `MAX` / `MAX`. Why: `counterAxisAlignItems` drives the
  column-level `text-align: <value> !important` CSS, and `primaryAxisAlignItems` exports as
  the column `vertical-align`. For hug-height columns the vertical value is visually
  irrelevant, so horizontal fidelity wins; do not try to honor a worker `vertical-align: top`
  on a centered column.
  **Exception, multi-column rows:** when a section holds two or more columns whose content heights
  differ, set `primaryAxisAlignItems = 'MIN'` (exports vertical-align: top) while keeping
  `counterAxisAlignItems` on the content's horizontal alignment. The two properties are independent
  exporter reads, so this does not disturb text-align. Top is the default for multi-column rows;
  matched axes remain the rule for single-column sections.
- Attribute mapping:

  | MJML attr | Figma property |
  | --- | --- |
  | `width` | frame width in px: FILL for a lone column, FIXED at this number for multi-column and group columns |
  | `padding-*` | paddings |
  | `background-color` | SOLID fill; absent means `fills = []` (any fill at all exports as background-color, even at opacity 0) |
  | `border-radius` | cornerRadius |
  | `border` / `border-*` | strokes (R5.6) |

- Children: leaf PAIR wrapper frames and `mj-spacer`, top to bottom. After appending, set
  each child's `layoutSizingHorizontal = 'FILL'`.

#### R3.4.1 THE TWO COLUMN SWAP: the standard rebuild for an overlapping or bleeding image

**The failure it replaces.** Source designs routinely place a photograph so it overlaps or
bleeds past the block it belongs to: a product shot entering from the right behind body copy, an
animal cropped off by the left edge of a cream band with text beside it. In Figma that is
z-order plus absolute position. Email has neither, so it cannot be reproduced, and no attribute
in this appendix gets close. **The standard remedy is to rebuild the block as a two column row:
one `mj-section`, two `mj-column`s, the image in one and the text in the other, in the same left
to right order the design implies.** The image stops at its column edge instead of bleeding, and
nothing overlaps. This is a settled decision rather than a per-block judgment call, so do not
re-argue it per block and do not go hunting for a cleverer reproduction of the overlap.

**How to recognize it, because nothing in the source labels it.** Two tells, either one of which
is enough:

- **The photo's bounds extend past the bounds of the block it reads as part of.** It is wider or
  taller than the band, or its absolute x/y put part of it outside the frame that appears to
  contain it. Compare the image node's absolute box against the band's box; do not judge it from
  the screenshot, where the overflow is invisible by construction.
- **The photo is clipped by a sibling drawn over it rather than by a mask.** A rectangle of
  background color sits above it in z-order and hides one edge. The layer panel shows no mask
  and no crop, and the composite you see exists in no single node.

On an unstructured source neither tell is written down anywhere, and the screenshot looks like an
ordinary photo in a band, which is why recognizing this is its own step rather than something you
notice in passing.

**The construction.** One `mj-section`, two `mj-column` children, image column and text column in
source order.

- Both columns FIXED (R0.3 case 2, R3.4), with their widths summing to the section content box: a
  600 wide section carrying 20/20 padding takes columns summing to 560. Unequal splits only
  survive because both numbers are pinned; the exporter derives the percentages from them.
- **Derive the widths in this order.** Pin the text column first, with the slack from R3.3.1,
  then give the image column the remainder, then size the image last. Worked: text hugs at 260
  and pins to 292, so the image column is 268.
- **The image is a rendered crop of the source region (R4.2.1), never the raw fill**, and it is
  cropped to its column rather than padded to fit, per R4.2.1's never-pad rule on aspect ratio.
  The `mj-image` rectangle is the image column's content width, and its height is the render's
  natural aspect at that width: continuing the example, a 780 x 660 render at 268 wide is 227
  tall, and 227 is the number.
- Heights HUG throughout (R0.1). Both alignment axes equal on the section and on each column
  (R3.4's axis alignment rule, the trap).
- Spacing on one side of each boundary only (R0.7). The gutter between the two columns is one
  column's horizontal padding, never both.
- **Not an `mj-group`.** A group exists to keep columns side by side on mobile (R3.3), which is
  the opposite of what this pattern wants.

**Mobile.** Two columns stack, so the image lands above the text, which is a normal email pattern
and arguably better than a bleed that would have had to be abandoned on a 390 wide screen anyway.
Stacking follows column order, and column order is the design's desktop order, not yours to choose:
when the design reads text then image on desktop but should read image then text on mobile, set
`reverseStack` = `'true'` on the section (R3.2) rather than reordering the columns.

**Why this is the default, so nobody relitigates it.** It keeps the text LIVE: the alternative,
flattening the whole block to one image, gives up selectable text, accessibility, and dark mode
for the sake of an effect. It degrades well, per the mobile note above. And the loss is small and
nameable, the overlap and nothing else, which is what you tell the customer at hand-off.

**When it is not this pattern.** Type set over a photographic collage where the lettering is part
of the artwork, or any treatment where copy and picture are one composited whole with no boundary
to cut on. The test: if you can name the rectangle the image belongs in and the rectangle the text
belongs in, it is this pattern, so build it. If you cannot, say so and let the customer decide
rather than flattening a block to an image on your own judgment.

### R3.5 mj-column-inner (rarely needed)

Use ONLY when a column needs a second, inner background or border box distinct from its own
(a card inside a colored column). Most card-in-column designs are expressible without it: put
the card fill, radius, and paddings directly on the `mj-column` and the outer color on the
section. Prefer that. The second genuine case is a filled card that needs a gutter. A column's
fill covers its own padding, so the gutter cannot come from that filled column without adjacent
cards touching. Use a fill-less outer column with the gutter as its padding and a FILL inner
column carrying the card fill, radius, and inner paddings. Measured: a 271px outer column with
22px `paddingRight` held a filled inner column resolving to 249px.

If you must use it: FRAME, the FIRST (and only) child of an `mj-column`, with the leaves
moved inside it. This is load bearing: the exporter checks `column.children[0]` and ONLY
there. In any other position its fill, radius, borders, and paddings are silently discarded
and its children flatten into the parent. Shared `name` = `mj-column-inner`;
`layoutMode = 'VERTICAL'`, vertical HUG, horizontal FILL,
`primaryAxisAlignItems = counterAxisAlignItems = 'CENTER'`.

## R4. Leaf pairs

Every content leaf is TWO tagged nodes: an outer wrapper FRAME that carries layout (paddings,
alignment, container background) and an inner node that carries content. Style the inner
node, not the wrapper. Both must be tagged. A wrapper with a fill and no child exports as an
empty cell. Every pair wrapper hugs vertically.

### R4.1 mj-text: `mj-text-Frame` wrapping a TEXT node `mj-text`

Wrapper FRAME:
- Shared `name` = `mj-text-Frame`. Layer name `Text Block`.
- `layoutMode = 'HORIZONTAL'` (yes, horizontal), vertical HUG, never FIXED: a pinned text
  frame is the classic Outlook clip, because copy length changes most often between sends.
  `primaryAxisAlignItems = counterAxisAlignItems = 'CENTER'`.
- `padding-*` from the mj-text attrs go HERE (the exporter reads `node.parent.paddingTop`).
- `fills = []` unless the MJML has `container-background-color`, which becomes this frame's
  SOLID fill.
- As a column child: `layoutSizingHorizontal = 'FILL'`.

Inner TEXT node (direct child):
- Shared `name` = `mj-text`.
- `layoutSizingHorizontal = 'FILL'`, `layoutSizingVertical = 'HUG'`.
- Property mapping:

  | MJML attr | TEXT property |
  | --- | --- |
  | `align` | `textAlignHorizontal` = LEFT / CENTER / RIGHT (the ONLY source of the exported `align`) |
  | `color` | one SOLID fill |
  | `font-family` | `fontName.family` (first of the stack) |
  | `font-weight` + `font-style` | `fontName.style` per the table in R1.9 |
  | `font-size` | `fontSize` (px number) |
  | `line-height` | `lineHeight` PERCENT (ratio * 100), AUTO allowed for 1.2/1 |
  | `letter-spacing` | `letterSpacing` `{ unit: 'PIXELS' }` |
  | `text-transform` | `textCase`: uppercase UPPER, lowercase LOWER, capitalize TITLE, none ORIGINAL |
  | `text-decoration` | `textDecoration`: underline UNDERLINE, line-through STRIKETHROUGH, none NONE |
  | `content` | `characters` after HTML conversion (R1.11); links via `setRangeHyperlink` |

- Also set `textAlignVertical = 'CENTER'`.

### R4.2 mj-image: `mj-image-Frame` wrapping a RECTANGLE `mj-image`

Wrapper FRAME:
- Shared `name` = `mj-image-Frame`. Layer name `Image Block`.
- `layoutMode = 'HORIZONTAL'`, both sizing HUG (FILL width as column child, height stays
  HUG).
- `primaryAxisAlignItems` from `align`: left MIN, right MAX, center or absent CENTER. Set
  `counterAxisAlignItems` to the SAME value.
- `padding-*` from the mj-image attrs go HERE.
- `fills = []` ALWAYS.
- Never copy the rectangle's height onto this frame.

Inner RECTANGLE (direct child):
- Shared `name` = `mj-image`.
- `resize(width, height)` from the MJML `width`/`height` attrs. Keep
  `layoutSizingHorizontal = 'FIXED'`. A RECTANGLE has no hug, and its pixel size is one of
  the four load-bearing FIXED widths.
- Fill: an IMAGE fill, `scaleMode: 'FILL'`, from an image already in the file.
  `figma.createImageAsync(src)` is NOT available to you as an external agent, so a worker `src`
  URL is not something you can turn into a fill directly, and R4.2.1 has the route for any image
  coming from the design you converted from. The worker returns `"placeholder"` for every `src`
  anyway, so substitute the customer's real asset when you have one; otherwise one SOLID light
  gray fill (`#E8E8E8`). The exporter re-exports the node's own pixels, so a gray rect exports as
  a gray image, which is correct placeholder behavior.
- `cornerRadius` from `border-radius`.
- Shared plugin data ON THE RECTANGLE (not the wrapper): `href` from MJML `href` (omit when
  absent; never write `#`), `altText` from MJML `alt`.
- Sizing note: if the rectangle width is LESS than the column content width the exporter
  drops `fluid-on-mobile`; if equal it keeps it. So measure against the column content width you
  actually built, which is the email's one content width (R0.3.1) rather than the side margin the
  worker returned: an image meant to fill its column takes that number and stays fluid, a 134 logo
  does not.

### R4.2.1 Bringing an image across from a source design: RENDER the node, never the raw fill

This is the Path B rule for every image you take out of a design the customer already has, above
all their own non-Email-Love Figma file (B2). An image in a design file is almost never the whole
photograph the designer started from, and two things routinely sit between the raw bytes and what
you see on the canvas. Neither one travels with the raw asset:

- **A crop transform.** An image fill with `scaleMode: 'CROP'` carries an `imageTransform` matrix:
  which part of the photograph is showing, and at what zoom. Export the raw fill and you get the
  full frame back with that transform discarded, including everything the designer cropped away.
  The symptom is dead space where the composition used to be tight: a subject that filled 56 to 59
  percent of a band now occupies 27 percent and floats small inside it, or sits half out of view.
  Nothing about the rectangle's geometry is wrong, which is exactly why this gets misdiagnosed and
  reported as a spacing bug.
- **Clipping by overlapping siblings.** Unstructured designs clip by z-order and not by masks: a
  shape, a band of background, or another image sits on top and hides part of the picture. What you
  see is a composite of several nodes, and those pixels exist in none of them on its own. Only a
  render captures it. This is also the second tell for the Two Column Swap (R3.4.1): if the sibling
  drawn over the photo is what stops it bleeding past its block, the block needs rebuilding as a
  two column row and this rule supplies the image inside it.

So, for every image you bring across: **render the node as it appears and use the render.** Never
the raw fill, never the asset behind `fills[0].imageHash`.

The route, since `figma.createImageAsync` is unavailable to an agent:

1. `download_assets` on the NODE in the source file (`get_screenshot` on the node, or
   `node.exportAsync`, do the same job), at 2x, to a local PNG. Reading `fills[0].imageHash` and
   fetching that asset instead is the mistake, not the shortcut.
2. **Inspect baked backgrounds before upload.** When the source geometry defines the
   silhouette, use it as a mask first: a corner radius at least half the shorter side, an
   ellipse, vector mask, or clipping parent can composite the render exactly. Use color keying
   or border-connected flood fill only when geometry cannot recover the silhouette.
3. `upload_assets` to place that PNG onto the `mj-image` rectangle in the build file. The crop is
   baked into the pixels now, so the fill is a plain `scaleMode: 'FILL'` with an identity transform
   and there is no crop left to reproduce.
4. Verify against a screenshot of the SOURCE NODE, never against the source's raw asset.

**Aspect ratio: preserve the render's, never stretch to fit a chosen width.** Measure the ratio on
the rendered PNG and derive the height from the width you picked: `height = round(targetWidth *
renderH / renderW)`. A 995 x 550 render placed at 600 wide is 332 tall, and 332 is not a number to
round to something tidier. If a height was decided earlier and it disagrees with the render, the
render wins and you re-derive the height. Forcing a render into the wrong box is either a
`scaleMode: 'FILL'` quietly cropping it a second time or a visibly squashed photo.

**NEVER PAD AN ASSET TO FIT A CONTAINER, and never stretch one either.** An email image is declared
with a width and takes its height from the file, so the rectangle has exactly one correct height.
Adding white to the exported PNG to reach a ratio you already have bakes that padding into the
asset, where no later change to the rectangle can remove it. Both defects read as a spacing bug
rather than an image bug, which is what makes them expensive: the dead space looks like a padding
value nobody can find in the auto layout. **Size the container to the asset, never the asset to the
container.**

**Width is a decision, so make it deliberately and state it.** A source image narrower than its
canvas (995 in a 1089 wide design, so about 91 percent) is inset by design, not full bleed. Either
reproduce the inset as horizontal padding on the `mj-image-Frame`, at email scale (R0.6) and snapped
to the spacing scale the brand already uses, or take it full bleed at the body width. Both are
defensible. Pick against the brand's own established patterns, and say which you chose and why when
you hand off. What this must never be is an accident of arithmetic.

### R4.3 mj-button: `mj-button-Frame` wrapping FRAME `mj-button` whose DIRECT child is a TEXT node

Three levels. The TEXT node MUST be a direct child of the `mj-button` frame:
`extractButtonJson` locates it via `node.children.find(c => c.type === 'TEXT')`.

Level 1, wrapper FRAME:
- Shared `name` = `mj-button-Frame`. Layer name `Button Block`.
- `layoutMode = 'HORIZONTAL'`, both sizing HUG (FILL width as column child).
- `primaryAxisAlignItems` from the mj-button `align` (left MIN, right MAX, else CENTER);
  `counterAxisAlignItems` the SAME value. The exporter reads the button's alignment from this
  frame, the button's direct parent. Mirror the same alignment on the containing column's
  axes when all of the column's content shares it; the two must not fight.
- `padding-*` from the mj-button attrs go HERE.
- `fills = []` unless `container-background-color` is set.

Level 2, FRAME `mj-button`:
- Shared `name` = `mj-button`. Layer name `Button`.
- `layoutMode = 'HORIZONTAL'`, `layoutSizingVertical = 'HUG'` always, and
  `layoutSizingHorizontal` per R0.4 (HUG default, FILL for an edge to edge CTA, FIXED only
  when the design system pins a width). When you do pin one FIXED, give the label slack per
  R3.3.1: a pinned button cannot grow around a label that sets wider in the exported font than
  it did on the Figma canvas.
- `primaryAxisAlignItems` from `text-align` (default CENTER);
  `counterAxisAlignItems = 'CENTER'`.
- `background-color` to one SOLID fill (a missing fill exports
  `background-color: transparent`).
- `border-radius` to `cornerRadius`.
- `border` shorthand (e.g. `2px solid #1A1A4B`) to strokes: `strokes = [SOLID color]`,
  `strokeWeight = weight`. `border: 0px` means no strokes.
- `inner-padding` `"T R B L"` to paddings. Symmetric values are safe; the plugin's own
  re-import of asymmetric inner-padding swaps left/right, so avoid asymmetric inner padding.
  This padding is the button's tap target and the only thing that sets its height, so check
  the result is at least 44px tall rather than reaching for a fixed height.
- Shared plugin data ON THIS FRAME: `href` from MJML `href` (omit when absent).

Level 3, TEXT node (direct child of the `mj-button` frame):
- Shared `name` = `mj-button-text`. Layer name `Button Text`.
- `characters` = the button `content` (plain text, R1.11).
- Font family, style, size, line-height, text-transform, text-decoration mapped exactly as in
  R4.1, from the mj-button attrs.
- `color` attr to the TEXT fill (this exports as the button label color).
- `textAlignHorizontal = 'CENTER'`, `textAlignVertical = 'CENTER'`,
  `layoutSizingHorizontal = 'HUG'`, `layoutSizingVertical = 'HUG'`.

Do not add any other children. Button icon frames (`beforeIcon-Frame` / `afterIcon-Frame`)
are out of scope here, and they carry a naming trap: the library-save path finds them by a
raw layer-name substring check, so if you ever build them the literal substring must stay in
the layer name.

### R4.4 mj-divider: `mj-divider-Frame` wrapping a LINE `mj-divider`

Wrapper FRAME:
- Shared `name` = `mj-divider-Frame`. Layer name `Divider`.
- `layoutMode = 'HORIZONTAL'`, vertical HUG, FILL width as column child. Space above and
  below a rule is this frame's padding, never its height.
- `primaryAxisAlignItems` from `align` (default CENTER); `counterAxisAlignItems` the SAME
  value.
- `padding-*` from the mj-divider attrs go HERE. `fills = []` unless
  `container-background-color`.

Inner LINE node (use `figma.createLine()`, not a rectangle: the exporter reads `strokes`,
`strokeWeight`, and `dashPattern`):
- Shared `name` = `mj-divider`. Layer name `Divider Line`.
- `strokes = [SOLID <border-color>]` (default `#000000`); `strokeWeight` = numeric
  `border-width` (default 1); `dashPattern` `[]` solid, `[4, 4]` dashed, `[1, 2]` dotted.
- `resize(W, 0)` where W is the numeric `width` if given in px, else the column content
  width; then `layoutSizingHorizontal = 'FILL'` for a full-width divider.

### R4.5 mj-spacer: single FRAME (no pair), and the one fixed height in the spec

**Try not to need one** (R0.2). When you do build one: FRAME, direct child of the column,
shared `name` = `mj-spacer`, layer name `Spacer`, and `layoutMode = 'HORIZONTAL'`. Use
`fills = []` for a plain gap. When the spacer is itself a colored band, use one bound SOLID
fill so it exports as `container-background-color`. Then `resize(width, H)` from the height
attribute, set `layoutSizingVertical = 'FIXED'` and `layoutSizingHorizontal = 'FILL'`, map
padding, and add no children.

## R5. Cross-cutting attribute rules

**R5.1 Padding.** Worker `padding-*` are explicit px strings; `parseFloat` them onto the
OWNING frame. Container tags carry their own paddings; leaf tags carry theirs on the PAIR
WRAPPER frame (the exporter reads `node.parent.padding*` for text, button, image, divider).
A gap the block above already pays for is not yours to pay for again: R0.7.

**R5.2 Colors.** All colors are hex strings. One SOLID fill per background; TEXT fills for
text color. `transparent` or absent means `fills = []`.

**R5.3 Alignment master table.**

| Node | Property read by exporter | Exported as |
| --- | --- | --- |
| `mj-section` | `primaryAxisAlignItems` ('row' map) | section `text-align` |
| `mj-group` | `primaryAxisAlignItems`, `counterAxisAlignItems` | group left/right class, `vertical-align` |
| `mj-column` | `primaryAxisAlignItems` ('col' map: MIN top, MAX bottom, else middle) | column `vertical-align` |
| `mj-column` | `counterAxisAlignItems` ('col' map: MIN left, MAX right, else center) | column-level `text-align !important` CSS |
| TEXT `mj-text` | `textAlignHorizontal` | text `align` |
| `mj-image-Frame` | `primaryAxisAlignItems` ('row') | image `align` |
| `mj-button-Frame` | `primaryAxisAlignItems` ('row') | button `align` |
| `mj-button` | `primaryAxisAlignItems` ('row') | button `text-align` |
| `mj-divider-Frame` | `primaryAxisAlignItems` ('row') | divider `align` |

'row' map: MIN left, MAX right, anything else center. Always set the counter axis to the same
value as the primary on every one of these frames.

**R5.4 Column width handling.** Single column: a section 600 wide with `padding-left/right:
20px` and a FILL column (resolving to 560) exports `width: 100%`. Multi column: widths export
as percentages of the section content box. The worker may bake gutters as column paddings
(`padding-right: 10px` on the left column); keep those as paddings, do NOT convert them to
itemSpacing. **The content box itself is one decision for the whole email, not a per-section one**
(R0.3.1): the number a single column resolves to, and the number a multi-column split sums to, is
the content width you fixed before you started rather than the side margin the worker returned for
that screenshot. Reproduce the worker's paddings everywhere else; this is the one you override.
Apply R0.3.1's full-bleed and card/inset exceptions by checking their outer band edges.

**R5.5 href and alt.** Never in layer names or geometry; always shared plugin data. `href` on
the `mj-image` rectangle and on the `mj-button` frame; `altText` on the `mj-image` rectangle.
Omit the key entirely when the worker value is empty or `#`.

**R5.6 Borders.** Per-side `border-top/right/bottom/left` ("Wpx style #hex"): set
`strokes = [SOLID hex]` plus `strokeTopWeight` etc. per side (0 for absent sides). Uniform
`border` shorthand: `strokes` + `strokeWeight`. Dashed and dotted map to `dashPattern`
`[4,4]` / `[1,2]`.
