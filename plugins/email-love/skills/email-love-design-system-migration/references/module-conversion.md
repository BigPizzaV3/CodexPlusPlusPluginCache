## Phase 3: Module conversion (run per batch)

## Contents

- Confirm the reusable module shape
- Choose direct source-tree read or the design-converter worker
- Transcribe the returned JSON
- Decide mobile behavior and merge a twin when present
- Add component properties and categories
- Verify each module
- Sniff one exported HTML artifact per batch
- Report and gate each batch
- Run send readiness and hand off the migration

**Before the first module, establish how the batch checks will run.** Check the Email Love MCP
(`mcp.emaillove.com`) for `emaillove_export_figma`. When present, step 6's export sniff is fully
agent-run with `operationType: "preview"`, with no plugin click and no export quota, and the mobile
render runs through `emaillove_preview_email`. Its v1 coverage is the core tag set:
`mj-wrapper`, `mj-section`, `mj-group`, `mj-column`, `mj-column-inner`, `mj-text`, `mj-image`,
`mj-button`, `mj-divider`, and `mj-spacer`. It rejects `mj-hero`, `mj-social`, `mj-navbar`, and
`mj-table` with a CoverageError naming the node; only those modules still need a human plugin
Export. When the tool is absent, say in the batch-1 opening that a paid-seat human must run the
Export sniff. Maintain one Deferred verification list for checks that neither the MCP nor a human
can run rather than discovering this limitation after several batches.

### 0. What you are building: a module, not a small email

**Batch 1 is a proof batch of at most four modules.** Pick them to cover as many of these risk
classes as the source contains: a full-width or deliberately cropped photo; a grouped
icon-and-text row; a multi-column module with component properties; a footer or social-icon
row. Do not release later modules until every proof module passes production desktop and mobile Preview/export. When no production render route exists in the session (no exporter tool, no
human click available), stop after the proof batch and report the deferred state; continuing
into later batches on deferred exports is the exact expansion the proof batch exists to stop.
Canvas evidence cannot waive this gate.

**Phase 3 builds MODULES.** A module is one reusable block that gets dropped into many
emails, so its shape is a **`mj-wrapper` COMPONENT**: the wrapper IS the component, it carries
shared `name = 'mj-wrapper'`, its layer name is the module name, and it carries **no
`nodeType = 'mainFrame'` marker anywhere in its tree**. The marker is not a harmless extra:
the upload does not stop you, it archives the block as a whole email and emits no component
JSON. An email template is the other shape (a `mainFrame` root with wrapper components stacked
inside), and foundations built one of those in Phase 2 for context.

Appendix R2 has both shapes side by side and the plugin evidence. Read it before the first
module of a batch. If you are picking up a batch converted with an older copy of these
instructions, read `nodeType` back off each module root: a leftover `mainFrame`, or a wrapper
nested inside a wrapper, means that module uploads as a broken email and has to be reshaped.

**One module per row of the audit's Module inventory.** The batch is a group of those rows. A
library of eight or fewer modules may run as one batch with one design review before upload,
because there is no later batch for a construction defect to propagate into. Above that, stay
at roughly five modules per batch so the first review can catch repeated defects early. Each
row already tells you the module's name (use it verbatim as the component name), its
category, the designs it appears in, its source ref, its verdict, its concession if any, its build
constraints, and its effort. Where a module appears in several designs, the source ref names the
one appearance to convert from, so convert it ONCE from there and note that design; the other
appearances are the same component placed again, not more work. When a row has no source ref, pick
the cleanest appearance yourself and record which one in the batch report, so a reviewer can tell
your boundary from the audit's.

**Where this phase's numbers come from is the fidelity tier's answer, and foundations already settled
it.** On an AUTHORITATIVE or PARTIAL source, build every type size, line height, and spacing value at
the audit's scale factor, dividing source pixels by it as you go, while every width comes from the
target email width and foundations' content width instead (Phase 2 has the rule; render rule R0.6 has it
at the geometry level). **On a REFERENCE ONLY source you scale NOTHING.** Build at the standards foundations recorded: the 600
body, the 560 content width, the ramp and the spacing scale that are already text styles and variables
in the target file. Do not measure the source region and divide it by anything, do not reach for a
factor because a module looks small beside the source, and do not reintroduce one per module. The
source screenshot in step 1 tells you which blocks exist, in what order, with what copy and what
imagery: it is a content and structure reference, not a ruler. A module whose margins do not match the
source is correct on this tier, and the batch report says so.

**Build every module at foundations' CONTENT WIDTH; do not take the worker's.** This is the same
discipline as the scale factor, one number decided once and applied everywhere, and it is the one
padding in the worker JSON that is not authoritative. The worker sees one screenshot at a time with
no knowledge of the module's siblings, so its side margin is a per-module guess by construction: a
run that accepted it produced side margins of 48, 40, and 20 across six modules of one email, three
content widths, and a text left edge that moved as the reader scrolled, with every individual padding
value looking reasonable on its own. So transcribe the worker's paddings, then set the horizontal
section padding to whatever foundations' content width requires (a 560 content width on a 600 body
means 20/20), and re-derive any multi-column split so the columns plus gutters still sum to that
content width. Apply R0.3.1's full-bleed and card/inset exceptions by their outer band edges. Appendix
R0.3.1 is the rule and carries the measured case; list in the batch report every module whose worker
padding you overrode to reach the library number. Full-bleed image bands and deliberately
inset card blocks are the two sanctioned content-width exceptions; apply the band-edge and
inset geometry rules in R0.3.1 rather than treating either as worker drift.

Before building any module whose inventory row carries a concession, check the audit's Flags for
a human "yes" on it. If there is none, ask, and record the answer in the batch report. Building
first and asking later means rebuilding.

**A row's build constraints are instructions, not context.** Read them before the first node of
that module and state in the batch report how each one was satisfied. They exist because a correct
audit finding was once left in Flags alone and the conversion built straight past it. An older
audit may have no build-constraints column, so on those read Flags in full before the batch starts,
and treat anything phrased as "export rendered nodes, not raw fills", "re-crop", or "clipped by
z-order" as binding (render rule R4.2.1). Treat anything phrased as "image bleeds", "photo overlaps
the copy", "extends past the band", or "full-bleed image" the same way: that is the Two Column
Swap, render rule R3.4.1, and the module is an A that gets rebuilt as a two column row.

**An overlap or a bleed you find yourself is the same instruction.** An audit written before the
Two Column Swap existed may have filed one of these as a C, or as an A with a hand-written
substitute, or missed it because the screenshot hid it. When the nodes show the pattern, R3.4.1 is
what you build regardless of what the row says, and you record the verdict change and its reason
in the batch report per step 2. Do not improvise a different substitute and do not flatten the
block to an image because the row said C.

For each module in the batch, in order:

### 1. Choose direct tree read or the design-converter worker

**First decide whether the worker is the right input.** The worker is a structure detector
for sources where structure must be inferred from pixels. When the audit classified the
source AUTHORITATIVE or PARTIAL and the source carries components, auto layout, and frames at
the target email width, read the source node tree directly. It already holds exact fills,
sizes, paddings, nesting, crop transforms, container clipping, zero-height text, and fills
stacked under images. Use the worker for unstructured sources, flattened mockups, and every
non-Figma adapter. Record the path and why in the batch report.

**When the supplied source includes HTML (any ESP adapter, or a customer-supplied file),
that HTML is the authoritative structure for BOTH breakpoints.** Before building, inventory
the desktop structure from the DOM and the mobile structure from its media queries as two
separate lists (text runs, images with their own hrefs and dimensions, per-breakpoint
composition), and build to that inventory. A screenshot never overrides the HTML, and a
canvas that disagrees with the supplied HTML is the thing to fix, not the evidence.
Measured: a footer was patched repeatedly from its screenshot while the supplied HTML held
the real desktop grid, the real mobile recomposition, and the individual logo assets the
whole time.

On the direct-tree path, recursively inspect the audited module boundary and translate its
semantic hierarchy into the mapped Email Love primitives in step 2. Preserve exact measured
values after the audit's scale and foundation rules. Existing `mj-*` names are hints only;
validate the geometry and semantics before accepting a tag. Save the compact source-tree dump
alongside the module report as the stable transcription input.

On the worker path, do not rebuild by eye and do not run the plugin's Convert button for
migration batches. The
pipeline is: screenshot the source module (read-only), POST it to the design-converter
worker, transcribe the returned MJML JSON into the target file, then verify.

1. **Screenshot the module** from the customer's file (read-only; `get_screenshot` or an
   export). On an email-native source that is a frame; on an unstructured source it is the
   region of a design that the Module inventory row describes, cropped at the boundaries the
   audit set. Keep the PNG; it is also your visual reference for verification.
   **For an unstructured source, render each whole design once at 1:1 and crop its audited
   content bands locally.** A per-node render loses visually overlapping siblings when the source
   has no grouping, while one native canvas render preserves the composition and makes every
   source ref repeatable. This render is for structural classification only.
   **Export every image asset from its own rendered source node.** Never crop a hero, logo, card
   image, or product image from the module or canvas screenshot. That bakes overlapping text and
   cards into the pixels and creates ghost content. Logos retain intrinsic dimensions and aspect
   ratio; never resize them to fill a column.
   **Size the export so the PNG comes back at the target email width.** Where a factor exists that
   means exporting a source at scale factor 2.2 at roughly 0.45x; where none does, divide the source
   region's own width by the target width and export at that, which is a framing decision about one
   PNG rather than a scale factor entering the build. Do that because it is the input the worker was
   tuned for, NOT because the numbers come back at the scale you sent. The worker is
   scale-agnostic: it classifies at a canonical email scale and returns a 600 wide `mj-body` with
   round email values whatever the input resolution (R0.6, measured on a 768px PNG sent for a
   600px target). So do not plan on dividing its output by the factor, which is usually a no-op
   and invites a second factor into the build. Sanity check ONE number instead, the root
   `mj-body` width against the width you are building to, and only if that disagrees is the
   payload at another scale and every number in it in need of dividing. The factor's real job in
   this phase is reading the SOURCE and sizing images taken out of it.
   You have a shell, so the reliable way to get the width right is to
   resize locally after the export rather than trusting an export scale:
   `sips --resampleWidth 600 module-01.png` on macOS, or
   `convert module-01.png -resize 600x module-01.png` where ImageMagick is available.
2. **POST to the worker** at `https://convert.emaillove.com`:
   - Headers: `Content-Type: application/json`, `Authorization: Bearer` with an EMPTY token,
     and `X-Auth-Provider: gumroad`. The worker treats empty Bearer plus gumroad as an
     anonymous Free user, which is allowed; no license key is needed for this path.
   - Body: `{ "screenshot": "<raw base64 PNG, no data: prefix>", "screenshotMime":
     "image/png" }`. Set the mime correctly: it is passed straight through, so a JPEG
     declared as PNG is a silent quality loss. `layerTree` and `promptInputs` are optional
     extras; screenshot alone works and is the normal agent path.
   - Query params, all optional:
     - `nocache=1` skips the cache read (results are cached by screenshot hash), for QA.
     - `recache=1` skips the cache read AND forces a write, overwriting a poisoned cached
       result. Use this when a previous conversion of the same screenshot was bad.
     - `decomposeRasterized=1` asks the worker to OCR flat image-only regions into live
       `mj-text`/`mj-button` elements instead of one `mj-image`. Use for source frames that
       are a single baked screenshot with no live text.
   - The response body is the MJML JSON. Response header `X-Cache` says HIT or MISS;
     `X-Trivial-Response: true` means the result degenerated to a single image and you should
     re-run with `recache=1` (and usually `decomposeRasterized=1`). A full module takes 20 to
     40 seconds.
   - **If the worker returns 403 with body `error code: 1010`, treat it as a Cloudflare browser
     check, not an authentication failure.** Retry with a normal recent Chrome or Firefox
     `User-Agent` header. The empty Bearer and gumroad provider headers remain correct. A 403
     without code 1010 is still an authentication problem, so re-check those headers instead.

   From the Codex shell:

   ```bash
   B64=$(base64 -i module-01.png | tr -d '\n')
   printf '{"screenshot":"%s","screenshotMime":"image/png"}' "$B64" > body.json

   curl -sS --max-time 120 -D headers-01.txt \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer' \
     -H 'X-Auth-Provider: gumroad' \
     --data-binary @body.json \
     'https://convert.emaillove.com' > module-01.json
   ```

   The `Authorization` value is the literal word `Bearer` with nothing after it. On Linux
   `base64 -i` becomes `base64 -w0`. Read the headers file before you trust the body.
3. **Save the MJML JSON to disk per module** so the transcription and later re-verification
   work from a stable input.

Fallback only: users without Figma MCP write access can select frames in the Figma plugin's
AI Import screen and click Convert there; it calls this same worker. The agent path above is
preferred for migration batches because every node it writes is inspectable and repairable.

### 2. Build the module in the target file from the chosen input

Follow [render-geometry.md](render-geometry.md), [render-nodes.md](render-nodes.md), and
[render-components-validation.md](render-components-validation.md) exactly. Together they map
every MJML tag and attribute to the Figma node, auto-layout, fill, and shared plugin data the
plugin's exporter reads back. **Start at R2 and build the MODULE shape**, not the
email-template shape.

On the worker path, the returned JSON has an `mjml` / `mj-body` envelope and one or more
wrappers. Do not transcribe the envelope. On the direct-tree path there is no envelope; the
audited module boundary becomes the one wrapper component. In both cases create the same root:

```js
const moduleRoot = figma.createComponent()                          // the mj-wrapper itself
moduleRoot.name = 'Hero, text led'                                  // the module name
moduleRoot.setSharedPluginData('emaillove', 'name', 'mj-wrapper')
// and nothing else: no nodeType, no theme colors
```

- **No `mainFrame`, no theme keys, no wrapper-inside-a-wrapper.** If the worker JSON returns
  several wrappers for one source module on the worker path, that is usually one module per wrapper: convert
  them as separate modules, or, when they genuinely are one block, merge their sections under
  a single wrapper component. Never nest one wrapper inside another to keep them together.
- **The layer name is load bearing here**, unlike everywhere else in the file. It becomes the
  saved component name and its storage path, and there is no rename field in the plugin's
  save dialog, so use the module's Module inventory row name verbatim: the audit chose it to be
  the name in the customer's library, so renaming it here silently forks the two documents.
- **Every node gets two names.** The MJML tag goes in the `name` shared plugin data key; the
  Figma layer name gets the plugin's own friendly display name for that tag ("Row (Contains
  columns that sit side by side)", "Text Block", "Button Text"), so the layers panel reads
  like a plugin-built file rather than a wall of `mj-` strings. The exporter never reads the
  layer name for dispatch, so this is free. The module root is the one exception: it is tagged
  `mj-wrapper` like any wrapper, but its layer name is the module name rather than the wrapper
  display string. Appendix R6 has the full table and the three ways this goes wrong. Never
  rely on the layer-name fallback.
- **Content leaves are tagged PAIRS, wrapper plus inner node.** `mj-text-Frame` contains a
  text node tagged `mj-text`; `mj-image-Frame` contains the image rectangle tagged
  `mj-image`; `mj-button-Frame` contains a node tagged `mj-button` whose own direct child is
  a TEXT node. Tagging only the wrapper is the single most damaging mistake in a conversion:
  untagged inner content is not skipped, it is flattened into a hosted PNG by the exporter's
  unknown-node path, so buttons silently lose their text and links and image sections can
  export empty. After building each module, verify every leaf pair before moving on.
- **Heights hug, widths are a decision, spacing is padding.** Appendix R0 is the whole rule
  and it is not cosmetic: every frame from the root down hugs vertically, a fixed height clips
  content in Outlook, vertical rhythm comes from auto layout padding (manual positioning
  exports as nothing), a FIXED width is only for load-bearing cases like unequal columns and
  `mj-group` percentage math, and a button sized FILL is what makes it full width on mobile.
  `mj-spacer` is the single node allowed a fixed height. Read R0 before you transcribe, not
  after.
- **Horizontal section padding comes from foundations' content width, not from the worker.** Every
  other padding in the worker JSON is authoritative and gets transcribed exactly; this one is not,
  because it is the only padding whose correctness depends on modules the worker never saw. Set the
  section's left and right padding so the column resolves to the library content width, and leave the
  outer column's horizontal padding at 0 unless the design needs an inner gutter, because the worker
  often puts the side margin at column level instead and the two add up. Then where the
  row has two or more columns, re-derive the split so the columns plus their gutters still sum to it:
  hold the image column and the gutter, and give the difference to the column that has slack, normally
  the text column. Widening a 520 row to 560 is
  `20 margin + 136 image + 24 gutter + 400 text + 20 margin`, not a new margin invented for this
  module. Full-bleed bands and card/inset blocks follow R0.3.1's two sanctioned outer-edge
  exceptions.

**Start from the visual pattern, not the layer name.** Most conversion mistakes come from
rebuilding what a design *looks like* instead of reaching for the primitive that produces it.
This mapping covers almost everything you will meet:

| What the design shows | What to build | Why |
| --- | --- | --- |
| A pill, badge, tag, or chip | `mj-button` | It renders a padded, rounded, background-filled box with centred text and an Outlook VML fallback. A column with a border radius does not survive Outlook. A pill needs no link to be a button. |
| A call-to-action button | `mj-button` | Same primitive; add the `href`. |
| Two things side by side that must not stack on mobile | `mj-group` of `mj-column`s | Columns stack on small screens unless grouped. |
| A photo that overlaps or bleeds past the block it belongs to, with text beside it | one `mj-section` holding two `mj-column`s, image in one and text in the other | Email has no z-order and no absolute position, so the overlap cannot be reproduced. The Two Column Swap (R3.4.1) is the settled substitute, and it keeps the text live. Not an `mj-group`: this pattern wants the mobile stacking a group suppresses. |
| Headline and copy over a full-bleed image | `mj-hero` | Keeps the text live rather than baking it into a picture. |
| A horizontal rule | `mj-divider` | Never a thin rectangle. |
| Vertical breathing room | `mj-spacer` | Never an empty frame. |
| A row of links | `mj-navbar` with `mj-navbar-link` | |
| Tabular data | `mj-table` with `mj-table-row` | |
| ESP tokens, Handlebars, dynamic cards | `mj-raw` | Passed through verbatim. |
| A composition that genuinely cannot be rebuilt | an untagged frame in a column | Deliberately flattened to a hosted image, still editable in Figma. |

- **Multi-column rows top-align by default.** Columns holding different amounts of content
  otherwise centre against each other and the row reads as a jumble. The exporter reads a
  column's `primaryAxisAlignItems` as `vertical-align` (MIN = top) and its
  `counterAxisAlignItems` as column `text-align`, two independent reads, so a column can be
  top-pinned with centred text: primary MIN, counter CENTER. Set the parent section's
  `counterAxisAlignItems = 'MIN'` too, so the canvas shows what the export does. This
  deliberately relaxes the matched-axes rule for multi-column rows; single-column sections keep
  it. Override to middle only where the design demonstrably centres, such as a badge beside a
  headline in a lockup.
- **Build the pair, do not style the wrapper.** The wrapper carries layout; the inner node
  carries content. An image is an `mj-image-Frame` containing a rectangle whose fill is the
  image, never a frame with an image fill on itself. A divider is an `mj-divider-Frame`
  containing a line, never a frame with a solid fill. Childless wrappers export as empty
  cells. Legacy designs almost always express images and rules as fills on a frame, so this
  is the most common thing you must actively restructure rather than copy.
- **A lockup is an `mj-group`, not two loose columns.** A two-column row is a lockup when it
  needs to stay side by side on mobile, and the design does not say that in words. Recognizing
  it is its own step, because nothing in the source labels it and the desktop screenshot the
  worker read is silent on mobile behavior. Three visual tells, any one is enough:
  - **Unequal columns with one small and fixed.** A logo beside a headline. An icon beside a
    line of copy. A price chip beside a product name. A date beside a badge. The small column
    reads as an attribute of the larger one, not as its own row of content.
  - **The two columns share a single continuous background.** A colored bar, a boxed panel, a
    rounded card. Stacking would split the background in half and the visual identity
    collapses.
  - **The block sits in the top or bottom strip of the email as a header or footer.** Headers
    and footers are lockups by default, because they read as one strip of chrome rather than
    a stack of content blocks.
  Two roughly equal columns of *content*, image beside copy or two product cards, are not
  lockups and should stack normally on mobile. When in doubt, err toward grouping headers and
  footers, and err toward stacking content rows. Every case gets a recorded decision either
  way in step 3 Part A of this phase, and step 5's mobile verification confirms the decision
  is present.
  **A row of five or more navigation links is the exception.** Do not force it into a group or
  one inline text line: each phone-width cell becomes narrower than a word. Use loose columns so
  the links stack, and record `loose columns, stack expected, no keys set, nav bar exceeds
  group-safe width` in the mobile decision.
- **A badge, pill, or icon sitting beside text is an `mj-group`, not a loose frame inside
  `mj-text-Frame`.** A loose frame there flattens to an image and detaches from the text.
  Rebuild it as a group inside the section: `mj-group` containing one `mj-column` that holds
  the badge as an `mj-button` (the table row above: a pill is a button, never a radiused
  column) and another `mj-column` for the adjoining text. Give those columns exact fixed
  pixel widths and let the exporter derive the percentages (render rule R3.3), pin those widths
  with slack rather than at the width Figma hugged to (render rule R3.3.1: a pinned column cannot
  grow, and the email renders a different font binary than the canvas), and remember the
  group must be a child of the section, not of a column, so a design that nests such a row
  inside a column needs the row lifted to section level. Only fall back to treating the region
  as an editable image when the composition is genuinely inseparable.
- **The worker never emits `mj-group`,** so every side-by-side row that must not stack is
  yours to rebuild. Its whole vocabulary is `mj-wrapper`, `mj-section`, `mj-column`,
  `mj-text`, `mj-image`, `mj-button`, `mj-divider`, `mj-spacer`, and `mj-social` with
  `mj-social-element` children. When it returns a tag the appendix does not map, in practice
  a social icon row, do not invent a node and do not silently drop it: rebuild the row from
  mapped primitives (for social icons, an `mj-group` of one-column `mj-image` pairs, each
  with its own `href`). List every row you rebuilt this way in the module's report line.
- **Every `src` comes back as `"placeholder"`.** Place the real assets you round-tripped in
  foundations; use flat gray fills at the correct dimensions everywhere else and list them. Any
  image you pull from the source now is a render of its node, never the raw fill (R4.2.1), and its
  height comes from the render's aspect ratio.
- **The worker cannot see an overlap, so it never returns the Two Column Swap.** It infers
  structure from a flat screenshot and email has no z-order to infer into, so a photo that
  bleeds past its block comes back either as a full-width `mj-image` above the copy or as the
  whole band flattened into one image. Neither is the answer. Rebuild it per R3.4.1, and note in
  the module's report line that you did.
- **Take STRUCTURE from the worker and NUMBERS from measurement.** The worker is a strong
  structure detector: trust its rows, columns, stacking order, button classification, and useful
  structural splits. It is not a measuring instrument. Colors drift, sizes land on plausible round
  numbers instead of the customer's ramp, and unpinned fonts flatten to Arial. Transcribe the tree,
  then replace every color with one sampled from source pixels, every type size with one measured
  by the cap-height method in R5.2.1, and every font with the foundations mapping. A size absent
  from the audit's ramp is the loudest signal that the worker guessed. The measured batch 4 run
  produced nine mismatches, from `#CCCCCC` for `#FFFFFF` through four wrong reds to a 40px headline
  where the approved ramp said 36px and had no 40px step.
- Map every text node to the type styles from foundations.
- Buttons: `mj-button-Frame` wrapping an inline styled `mj-button` frame and direct text node
  that match the foundations button component. Do not instance the foundation component inside
  a module, because its label property cannot be remapped to the module root.
- **Honor the inventory row's verdict.** Verdict A: live text throughout. **Verdict
  `A (concession: ...)`: build it as live text like any other A and apply the named substitute,
  nothing more.** Do not quietly reproduce the effect the concession gave up, in an image or
  otherwise: that is the concession being un-made without the designer in the room, and it turns
  a module the audit priced as mechanical into a flattened picture. **For the one concession with
  a fixed substitute, `A (concession: image bleed rebuilt as a two column row)`, the substitute is
  render rule R3.4.1 and nothing else:** one section, two columns, image in one and text in the
  other in source order, both columns pinned to widths that sum to the section content box, the
  text column pinned first with R3.3.1 slack and the image column taking the remainder, the image
  a rendered crop of the source region at the render's natural aspect. Build it exactly that way
  rather than deriving your own answer, so two agents converting two batches produce the same
  thing. Verdict B regions: place the
  design content as a frame with NO recognized tag name inside a column; the exporter flattens it
  to a hosted image at export while it stays editable. Verdict C modules: live-text structure for
  the copy, one editable-image frame for the rich region. Changing a verdict when the nodes
  contradict the audit is allowed and sometimes right; record it and its reason in the batch
  report.
- Text over a single background photo is mj-hero territory, live text, not an image.

### 3. Decide mobile behavior

**This step always runs, whether the source has a mobile twin or not**, because the biggest
mobile decision is structural (mj-group vs loose columns), made in step 2, and it does not live
in Mobile Styles data. An earlier version of this skill made this step "merge the mobile twin"
and skipped it silently on unstructured legacy sources with no mobile frames, which is where
a real customer batch shipped with header lockups that stacked on mobile. Do not repeat that.
This is the ONE mobile checkpoint every module gets, twin or no twin.

**Part A: for every multi-column section, record the stacking decision.**

Read each section in the module you just built. If it has more than one column, ask which
of THREE mobile behaviors the source calls for: it stays side by side (`mj-group`), it
stacks (loose columns), or the source uses a genuinely different mobile COMPOSITION that no
stacking of the desktop structure can produce. Apply the lockup tells from step 2 (unequal
columns with one small and fixed, columns sharing a continuous background, header or footer
strips are lockups by default). Then write the decision and the reason in the module's report
line, per section, in this format:

- `header row: mj-group (lockup: logo + headline sharing the dark bar)`
- `product cards row: loose columns (two equal content blocks, stack expected)`
- `footer top row: mj-group (lockup: logo + H6 headline in one strip)`
- `brand logo row: recomposed (mobile shows the primary mark on its own row, siblings beneath)`

**The third option builds paired sections**: a desktop-only section carrying
`mobileStylesHideInMobileDevice` and a mobile-only sibling carrying
`mobileStylesHideInDesktopDevice`, each composed for its breakpoint (the same observed
visibility keys the band-decoration pattern uses). There is no observed mobile-alignment
key and the never-write-unobserved-keys rule stands, so when mobile alignment or
arrangement differs from desktop, recomposition IS the sanctioned route. Headers and
footers get an explicit desktop-versus-mobile comparison before their decision is
recorded: they are where sources most often recompose rather than stack, and a stacked
desktop footer that should have been recomposed reads as broken, not as adapted.

A section with more than one column and no recorded decision is not done. Step 5's mobile
verification fails a module where any multi-column section lacks a decision.

**Every `mj-group` decision also gets a mobile geometry ledger.** At 320, 375, and 390px (or
the customer's named target viewports): mobile content = viewport minus the section's mobile
left and right padding; resolved column = column width / group width * mobile content;
resolved inner = resolved column minus that column's own left and right padding. Prove
`resolved inner >= natural image width` for an icon or image that must not shrink, and
`resolved inner >=` the longest unbreakable text run measured in the exported font stack, not
the canvas font. Use the inner content box. Comparing the asset to the total column while ignoring column padding is a false pass. Record the ledger in the module's report line; a
group that fails the ledger gets wider columns, less padding, or a different structure, not
a smaller icon quietly stretched or shrunk by the renderer.

**Part B: write the mobile styles. This always runs.**

An earlier version fired only when the source had a mobile twin, which on a typical migration
means never, and the result was a library correct at 640 and unreadable at 375. The audit's
Mobile styles section is the input. Use only the observed schemas from foundations: Schema A
for containers and Schema B for text nodes. An invented key fails silently, and an invented
activation flag can actively break the output.

Per module:

- **Mobile font size on every `mj-text` and `mj-button-text` TEXT node** from the audit's mobile
  ramp: `fontSize` = the mobile pixels and `fontSize_mode = 'override'`. Put both on the TEXT node,
  not the frame.
- **No mobile line heights.** The percentage line heights from foundations step 3 ride the mobile
  size automatically. Only write `lineHeight` plus `lineHeight_mode` for a genuine per-module
  exception, and record it.
- **Mobile padding on every wrapper or section whose horizontal inset exceeds the mobile value:**
  write `mobileStylesPaddingTop/Right/Bottom/Left` plus `isPaddingActive = 'true'` on the same node.
- **Stacked-column spacing:** every loose-column section whose columns stack on mobile gets
  `mobileStylesPaddingBottom = '28'` plus `isPaddingActive = 'true'` on every column except the
  last. Its desktop gutter is horizontal and disappears on stack; without this, stacked cards and
  badges land flush. Exclude the last column so the section's bottom padding is not doubled (R0.7).
- **Visibility** follows the audit's hide-on-mobile list; **alignment** follows any measured mobile
  difference; **stacking** follows Part A.

Read every key back and treat that as necessary, not sufficient: your own write always reads back.
The true verification is the rendered mobile output in step 5 or the export in step 6. List every
key written in the module's report line.

**Where the source has a mobile twin**, diff it first and let measured differences win over the
derived ramp for that module, noting which. Ignore differences caused only by the narrower frame.
Send inexpressible differences, such as different copy or image crop, to the designer in the report.

**Provisional rules, forward-test-gated.** Three patterns are strong recommendations but are
NOT yet exporter-proven hard rules; treat them as preferences with the escape hatch intact
until a production desktop AND mobile Preview forward-test confirms each:

- Prefer ONE responsive content tree when supported controls (stacking, mobile keys, visibility)
  can express both breakpoints - but the documented paired-section escape hatch stays available
  where recomposition genuinely differs.
- Treat adjacent filled rows that visually form one card as one continuous perimeter (one
  resolved outer bound, radii on the outer perimeter only) - verify the seam in both production
  renders before promising it is gone.
- Reject silent desktop simplification as the price of a mobile repair - a mobile fix that
  regresses desktop fails, it does not ship quietly.

When one of these is forward-tested and holds, record the evidence in the batch report; until
then do not present them as guaranteed exporter behavior.

### 4. Confirm the component shape, add properties, and pick its category

The module was built as a COMPONENT in step 2, because the `mj-wrapper` IS the component. Do
not create a second component around it, and do not promote a `mainFrame` frame into one.
Confirm before going further, by reading the values back off the root:

- `node.type === 'COMPONENT'`
- `getSharedPluginData('emaillove', 'name') === 'mj-wrapper'`
- `getSharedPluginData('emaillove', 'nodeType') === ''` (empty, on the root and everywhere
  below it)
- the root is a direct child of its category page, and its layer name is the module name

The plugin creates every wrapper as a COMPONENT itself (`UiParser.ts:1519-1522`), so this is
its own shape, not a convention we invented, and component properties are impossible without
it. Appendix R7 has the calls and the four rules that keep a component root working (keep it
a direct page child, never combine roots into a variant set, bind properties at the level that
owns the node, do not write `isStandalone`); R2.3 has the evidence for why the `mainFrame`
marker must be absent.

**Add component properties for the parts a marketer will change**, per render rule R8: TEXT
bound to `characters` on the inner text node, BOOLEAN bound to `visible` on the block wrapper,
INSTANCE_SWAP bound to `mainComponent` on a nested instance. There is no image property type.

**Customer-facing copy gets TEXT properties by default.** Headlines, eyebrows, subheads,
body copy, and button labels are what a marketer changes every send, so do not require sibling
evidence that the copy varies. Keep boilerplate that should not change per send unbound,
including legal copy, postal addresses, and unsubscribe lines. Keep link-bearing text unbound
too: binding `characters` wipes hyperlink ranges at bind time and on later edits through the
property. The evidence gate applies to the other property types: a BOOLEAN needs a sibling
design where the region is absent, and an INSTANCE_SWAP needs a real variant. Two to seven
properties per module is the working range; zero is legitimate only when the module has no
customer-facing copy. **A property whose binding is wrong is worse than no property**, so
re-read `componentPropertyReferences` from every bound node. Record what you exposed and why.

**Every module containing a button must expose its label as a TEXT property on the module
root.** Use `Button label` for one CTA or `Card N button label` for a grid. Figma rejects
remapping a nested instance's TEXT property to a module-root property, so build the module's
button inline as a styled frame plus one text node that matches the foundations button exactly.
The foundations component remains the style reference and the INSTANCE_SWAP target for a
Button Style property; do not instance it inside a module. An optional Show Button BOOLEAN
still needs evidence from a sibling design where the button is absent.

Then confirm its category for the upload. **The Module inventory row already proposes one**, so
start there and change it only when the rebuilt structure contradicts it, saying so in the batch
report. **Use the customer's real category names**, which are
whatever sections already exist in their plugin, not names you invent. If the Email Love MCP
is connected, `list_components` returns their categories; otherwise read them off the plugin's
Assets sidebar, which ships 13 predefined sections: Pre-Header, Header, Heroes, Single Column,
Two Column, Three Column, Four Column, Buttons, Reviews, Images, Lists, Order Tables, Footer.
Classify by what the component structurally is: **Heroes** for a top-of-email feature block,
**Single Column** for one full-width stack, **Two Column** or **Three Column** for side-by-side
columns, **Order Tables** for line-item layouts, **Images** for image-only blocks. When
nothing fits, choose the closest existing section and note it, rather than inventing one.

**Do not write `saveCategory` or `saveName` plugin data.** The plugin reads neither key. A
module goes into a design system through the Assets sidebar Upload button, and the **Figma
component name** becomes the component name, so the layer name you set in step 2 is the only
thing that carries. Record the category you chose per module in the batch report, so a human
can correct any misfits in one pass rather than hunting for them later.

### 5. Verify per module: one read-back pass, then one screenshot

Verification is expensive in Figma round trips, so do not walk the tree once per check.
Read the built module back once into one compact record per node. Because metadata responses
fail above roughly 80KB or on non-ASCII layer names, use the available Figma execution tool
in batches of about twelve nodes and emit one ASCII-sanitized line per node. Include node
type, layer name, layout and sizing, both alignment axes, paddings, resolved x and width,
fills and variable bindings, all `emaillove` shared plugin data, component-property
references, and `getStyledTextSegments(['lineHeight'])` for text. Evaluate R9 and the seven
groups below against that dump locally. List every violation by node id; an empty list per
group is the only pass.

**Group 0: parity with the source. Run this first.** The remaining groups ask whether the build is
internally consistent; this one asks whether it is still the module the customer supplied. For
every module, pair source and build by the Module inventory name and compare:

- TEXT-node count against the audit row's census `T`, then the trimmed first 40 characters of
  every text node, sorted, in both trees. A matching count with different strings still fails.
- Image-bearing-node count against census `I`, plus each node's rounded width x height. This
  catches a background photograph rebuilt as a flat fill and a grid rebuilt with missing cells.
- Text alignment per node and the module's band fills.

Any difference fails and must name the module and delta. Exactly three explained resolutions are
allowed, and each goes in the batch report:

1. An intentionally added optional region, defaulted to `visible = false` so the module still
   matches the source out of the box.
2. A deliberate consolidation required by that module's inventory row.
3. A named source defect corrected by the rebuild.

Anything else added is invented content; anything absent is dropped content. Copy comes from the
source. If a module needs a region that the source lacks, use resolution 1 and hide it by default.
"The transcription is a summary" and "the module looked right" do not resolve a mismatch.

When modules are built through a serializer-and-builder pair, run Group 0 on every module, never a
sample. Anything the compact spec does not model disappears silently, and checks performed only on
the build cannot detect that loss.

**Group 1: shape and tags.**

- **Shape, first and hardest:** the root is a COMPONENT tagged `mj-wrapper`, its layer name is
  the module name, and `nodeType` is empty on the root **and on every node below it**. Read it
  back; do not assume. A module carrying `mainFrame` uploads as a whole email, and a module
  with a wrapper nested inside another wrapper is an email in disguise. No theme color keys
  unless a designer asked for a dark-mode treatment on that block.
- Structural checklist: walk the tree and list every violation by node id in the batch report;
  an empty list is the only pass. The `name` plugin data key resolves to a real tag on every node,
  including each button's `mj-button-text`; every leaf is a complete tagged pair; both alignment
  axes match on every auto-layout frame except the deliberate multi-column top-align case (primary
  MIN with counter on the content's horizontal alignment); no detached instances; no unrecognized
  frames except intentional editable-image regions; `mj-column-inner`, if used, is literally
  `children[0]` of its column. Report an alignment mismatch as
  `<node id>: primary=X, counter=Y`, marking multi-column top-align cases as intentional.
**Group 2: sizing.**

- Walk the tree and confirm every frame is vertical HUG, the only fixed height is an
  `mj-spacer`, every FIXED width is one of the load-bearing cases, every pinned width that
  carries text has slack (render rule R3.3.1), and each button's width sizing was chosen for its
  mobile behavior (render rule R0). **The wrapper itself is FIXED at the target email width, on
  the component AND on every instance placed in the root email frame.** A wrapper set to FILL
  is a fail: it inherits from its container instead of pinning its own width, so the export
  math is ambiguous and the same instance breaks the moment it is placed somewhere else.
  Foundations step 7 has the rationale.
- Concession honored, where the row carried one: on a module built with the Two Column Swap, both
  columns are FIXED and their widths sum to the section content box, the text column's pin has
  slack, the `mj-image` rectangle is at the image column's
  content width with the crop's natural aspect for its height, there is no `mj-group` around the
  pair, and nothing in the block was flattened to an image (render rule R3.4.1). Confirm too that the
  overlap was not reproduced by some other means.
**Group 3: geometry against foundations.** Compare these numbers with foundations and the
audit, never with how the module looks.

- **Typography includes weight as well as size.** Check every text node's family and style against
  the audit's Brand foundations census, not only against the new ramp. Assert that every style name
  matches its read-back value and that the ramp's dominant body weight matches the source census.
  A ramp can be internally consistent while placing the entire library at the wrong weight.
- Scale: the module root is at the audit's target email width, and its type sizes, paddings, and
  image dimensions are at email scale rather than source scale (render rule R0.6). A module built at
  source scale looks correct in isolation and wrong the moment it sits next to another module, so
  check it before the batch grows. **On a REFERENCE ONLY source, the check is that no source
  measurement reached the module at all:** every type size is one of the ramp's, every padding is off
  the spacing scale, and the text column resolves to the library content width. Do not check the
  module against the source's proportions, because matching them is not the goal and a mismatch is not
  a finding.
- **Spacing system:** every side padding, vertical padding, gutter, and mobile padding resolves to
  a value or named exception in the audit's Spacing system. List the role and system value for
  every padding. An unrecognized value is a fail and a designer question, not a local override.
  Any mobile padding above 160px on a 320px viewport is a defect.
- **Group columns resolve wide enough on mobile** (R3.3.2): for every `mj-group` column, compute
  `columnWidth / groupWidth * (375 - mobile side padding)`. A text carrier must resolve to at
  least the exported-font width of its longest unbreakable word times 1.05. A fixed-aspect image
  carrier must resolve to at least its natural image width. List every violation by node id; an
  empty list is the only pass. Repair a failure by collapsing to one reflowing `mj-text` with
  hyperlink ranges, dropping the group so columns stack, or hiding decorative content on mobile.
  Desktop Figma and desktop preview cannot expose this defect.
- **Content width: read the resolved x and width of the text-bearing column off the built module and
  confirm it equals the library content width from foundations**, not the worker's number. On a
  multi-column row confirm the columns plus gutters sum to it. This is a cross-module check by nature,
  so it cannot be judged from the module in front of you: compare the number against foundations,
  never against how the module looks. A module with the wrong content width passes every other line
  in this list, which is why it reaches a reviewer as a text edge that moves while scrolling
  (render rule R0.3.1).
- **Multi-column gutter present. A section with more than one column and zero horizontal
  column padding is a FAIL** unless the source design has a measured zero gutter AND the
  batch report says so verbatim. The content-width equation above passes trivially at zero
  gutter (`card + 0 + card + 0 + card = content`), so the arithmetic gate cannot catch this
  by itself. Walk every multi-column section, list the horizontal padding on each column,
  and confirm at least one side of each column boundary carries the source's measured
  gutter (render rule R3.4.0: spacing on one side of each boundary only, never both). On a
  three-column row with a 560 content box and a 16px source gutter, columns take
  `(560 - 32) / 3 = 176`px content each, expressed as 186.67px column boxes with 8px on
  each side, so the boundary carries 16px between adjacent content. **Failure signature:**
  columns correctly sum to the content width but headlines from adjacent columns visually
  concatenate into one sentence; a card image touches the next card's edge; a button sits
  a pixel from a neighbour. Treat any of those as a gutter failure, not a typography
  problem. From Codex's build of a three-column module with zero column padding: geometry
  validated, content collapsed.

**Group 4: fills and bindings.**

- **Semantic-token bind count:** every non-placeholder solid fill resolves to a semantic variable
  from the audit's Palette. List each unbound node id, raw hex, and intended role. Test the binding,
  not the property: Figma returns `boundVariables` as `{}` for an unbound paint, so
  `!fills[0].boundVariables` can never catch it. The working predicate is
  `!fills[0].boundVariables?.color`. Name the value that makes every validation predicate fail and
  confirm that value is reachable. Placeholder gray image fills are the only exception, and each
  must be identified as intentional. An empty violation list is the only pass.
- **Text-on-background contrast:** compare every text node with its nearest filled ancestor. Report
  every ratio below 3.0 with both hex values. Never silently change a brand color to make a failure
  pass; report the ratio and options for designer review.
- **Never fill the group itself: no `mj-group` carries a fill of its own.** The exporter's
  dark-mode CSS erases section and column fills to transparent but never touches a group's own
  fill, so forced-light text can land on that original fill. Put a band fill on the group's
  columns and list every filled group by node id as a failure.
- Naming: every layer carries the display name for its tag, and no friendly string leaked into
  the plugin data `name` key.
- Component: the module root is a direct child of its category page, not inside a component
  set or a Figma section, with no stray instances of it left loose on the page. Every property
  binding re-read and confirmed. Every customer-facing headline, eyebrow, subhead, body, and
  button label is reachable through a module-root TEXT property. Boilerplate and link-bearing
  text are the only allowed exceptions. If the module contains a button, its property is named
  `Button label` or `Card N button label`; list every missing exposure by node id.

**Group 5: mobile data.**

- Mobile: every multi-column section has its Part A stacking decision recorded, and Part B's keys
  are all present and from the observed schemas only: `fontSize` plus `fontSize_mode` on every
  text node (read back by node id), `isPaddingActive` beside every mobile padding, and 28px bottom
  padding on every non-last stacking column. **A mobile padding without its flag, or a font size
  on the frame instead of the text node, is a fail that reads back perfectly**, which is why the
  batch also needs the rendered mobile check before review.
- **Range hygiene:** every text node returns one segment from
  `getStyledTextSegments(['lineHeight'])`. A second segment means a bold or colour range carries
  a detached frozen line height.

**Group 6: asset identity.** A correctly tagged image at the correct dimensions can still contain
the wrong asset.

- Same dimensions do not prove identity. Compare the asset's luminance with its nearest filled
  ancestor and fail a light mark on a light band or a dark mark on a dark band.
- Match the source icon set at that node, not merely the platform names or dimensions. Bare and
  circled social icons can share subjects while being different assets.
- Compare a downloaded asset's aspect ratio with the source node. A large mismatch can indicate a
  sprite sheet; split it at the transparent gutter instead of placing the full sheet in one node.
- Read `placedOnNodeId` from every `upload_assets` response. If it differs from the intended node,
  use the returned `imageHash` to set the fill and delete the stray frame.
- Never hand-transcribe image bytes between files. Use `download_assets` followed by
  `upload_assets`.

**Then take one desktop screenshot per module.** Compare each rebuild with its source screenshot from
step 1 and flag divergences. On REFERENCE ONLY, compare content and structure only; margins,
type sizes, and spacing are expected to differ. This check remains mandatory as batches speed up:
read-back proves what was written, while the image shows what a person sees. If the rebuild is 20 to 40px taller than the
source, detect content bands in both renders and derive the padding correction instead of
eyeballing a nudge. The mobile render belongs to the batch checks in step 6.

### 6. Batch checks: mobile render and export sniff, once per batch

After every module passes step 5, provisionally upload the batch wrappers to the plugin
library. Run both checks before opening the next batch.

**Mobile render.** Compose a QA email from the uploaded wrappers and call
`emaillove_preview_email`, or the current Email Love preview tool, on its compose token. A
390px Figma screenshot only scales desktop pixels and is
not a mobile test. Diff the exporter-generated mobile render against the source mobile design,
or the source screenshot when none exists. Fail on a word broken mid-string, an image aspect
ratio that differs from desktop, a stacked column retaining its desktop gutter, or grouped and
stacked behavior that contradicts step 3.

**Export sniff.** Pick a representative multi-column module, or a button-bearing module when
the batch is single-column. Export it headless first: call `emaillove_export_figma` with the target
file key, the module wrapper's node id, and `operationType: "preview"`. It accepts a bare
`mj-wrapper`, compiles it through the production `/getHtml` pipeline without charging export quota,
and returns the HTML plus a token accepted by `emaillove_preview_email` for a per-module mobile
render. Its output is golden-diffed against real plugin exports on every worker deploy. On a
production proof it was HTML-equivalent with an identical dark-mode CSS block. On a
CoverageError for `mj-hero`, `mj-social`, `mj-navbar`, or `mj-table`, or when the tool is absent,
fall back to the plugin: put an instance in the temporary Campaigns root and ask a human to click
Export. Save and inspect the HTML either way. Confirm:

- body width matches foundations;
- an `@media only screen and (max-width` block exists;
- mobile classes exist for each recorded stack, fluid image, or full-width button behavior;
- column widths and gutters sum to the intended content box, with no column wider than the body.

On a failure, repair the Figma source, re-upload if needed, and rerun both affected checks
before review. These checks inspect exporter output and do not replace step 5.

**When a check cannot run in-session** because `emaillove_export_figma` is absent and no human can
click, or because a CoverageError module has no human available, do not mark it skipped. Accumulate
a Deferred verification list across all batches, one line per module naming the exact behavior a
human must confirm, such as a group staying unstacked, a button going full width, or an image
staying fluid. Hand over the combined list in step 7. The deferral must stay loud, and every report
writes a deferred exporter check as a STATE (`exporter: deferred`), never folded into a pass.

**Repair discipline, when any check or render fails.** Measure the failure first (which
node, which breakpoint, which mechanism) before changing structure; a fix applied to an
unmeasured symptom is a guess. A change the rendered output has disproven is not tried
again somewhere else. After two local patches on the same module, stop patching and
reconstruct the module from its source inventory: patch accumulation is how a module
drifts from the source and the spec at once, and a full reconstruction from a good
inventory is usually cheaper than the third patch. Repairs preserve what already works:
re-read `componentPropertyReferences` after any structural repair and compare the property
count against the pre-repair count, because a rebuild that silently drops bindings passes
every geometry check. Keep the batch's resumable record current throughout (node ids,
outstanding checks, last verified state per module), so an interrupted session resumes
instead of re-verifying or, worse, re-trusting.

### 7. Batch report and gate

One report per batch. **Open with the Group 0 parity table:** for every module, show the source
`T/I` census beside the built counts and leave the delta column blank when they agree. Any
unexplained row fails the gate regardless of the remaining groups. **Every module row then
carries its verification as a component-by-breakpoint acceptance matrix**: one keyed row per
module x breakpoint (desktop, mobile) x check (canvas, structure, exporter), each `pass`,
`fail`, `deferred`, or `missing` - `deferred` means the check was consciously postponed and
names what postpones it; `missing` means the batch never covered it, and a matrix with a
`missing` row does not pass the gate. Duplicate rows for the same module+breakpoint+check are a
report defect. A module is complete only when every required row is `pass`; `exporter:
deferred` is a state, never a pass, and "fixed" for a change no render has seen is the
completion-inflation failure this matrix exists to stop. A component or breakpoint absent from
the supplied renders is NOT tested - write `deferred` or `missing`, never infer a pass. Then report, per module and
keyed by its Module inventory row name, what was rebuilt, the
design you converted it from, verdict honored or changed (with reason), any concession and whether
it was accepted and by whom (and for a bleed concession, the two column widths you landed on, so a
reviewer can check the sum), which input path you used and why, plus what the worker returned
and what you repaired when the worker path applied, mobile decisions,
divergences flagged, component properties added and the reason for each, the category you kept
or changed, the per-node violation lists, semantic bind count, spacing-system check, and the four
export-sniff confirmations, the mobile-render result, and the Deferred verification list when
anything remains. **Open with the source fidelity tier, the target email width, and the content width the
batch was built at, plus the scale factor where one applies**, so a reviewer can check three or four
numbers instead of measuring modules. On a REFERENCE ONLY source, open instead with the tier and the
standards, and repeat the one sentence that the geometry is ours: a batch report is the document a
reviewer reads with the source file open beside it, so it is exactly where the difference gets
mistaken for a defect. Name every module whose
worker side margin you overrode to reach the content width (plus the re-derived column sum where the
module was multi-column). End with the open questions for the
design review. Do not start the next batch until the user says the review happened.

When the `email-love-figma-quality-gates` skill is installed, run it as an independent
acceptance pass over the batch before the design review: its machine-readable audit snapshot
and validator catch deferred-export completion claims, non-IMAGE fills, unsafe group
geometry, and incomplete BOOLEAN properties mechanically, and its verdict is evidence for
the review, not a replacement for it.

## Hand-off after the final batch

### Send-readiness pass

Before hand-off, walk every `mainFrame` campaign on Campaigns and list violations by node id.
An empty list is the only pass.

- All nine required root values are real and non-empty: `nodeType='mainFrame'`,
  `backgroundColor`, `contentColor`, `textColor`, `linkColor`, `buttonTextColor`,
  `buttonContentColor`, `lightThemeBackgroundColor`, and `fallBackFontName`.
  The six theme keys hold dark-mode values from the audit Palette's dark proposal or the house
  defaults, never the light palette repeated; `lightThemeBackgroundColor` holds the light body
  background.
- `emailSubject` and `emailPreHeader` are non-blank real copy, not a module name or TODO.
- `fallBackFontName` is one family such as `Arial`, not a CSS stack.
- Every campaign root has a specific name. Prefix scratch roots with `QA only, do not send`.
- Every `mj-image` has an explicit real `href` or is recorded as deliberately unlinked, plus
  meaningful `altText` or an explicit decorative-empty decision. Never use `#`.
- Every CTA `mj-button` has a real `href`; a linkless badge or pill is recorded as intentional.
- Footer copy includes a real company name, postal address, and unsubscribe mechanism. Use
  `unsubscribe.com` as the portable default; the exporter replaces it with the selected ESP's
  unsubscribe merge tag. Use a specific merge tag only when the customer explicitly asks for that
  ESP-specific value. No lorem ipsum, literal `Address`, placeholder legal copy, invented
  unsubscribe URL, or `#` unsubscribe link.
- Footer preference wording is explicitly linked. The exporter may inject
  `manage-preferences.com` when it sees unlinked preference text, but only Klaviyo replaces
  that placeholder with a merge tag; every other target can ship the literal third-party URL.
  Use `unsubscribe.com` as the portable default when no real preference-center URL is supplied.

Fix every violation, or explicitly classify and rename a campaign as non-sending QA. Do not open
the customer handoff while this list is non-empty.

The design system is on the canvas but not yet in the plugin. Walk the user through the
upload: pick the design system in the plugin, open the Assets section you recorded for the
batch, select the wrapper components on the canvas, click **Upload**, confirm. A
multi-selection of wrappers uploads as one batch, so an approved batch goes in with one click
rather than one component at a time. **The Upload button only renders for a user on a paid
plan** (`AssetsComponent.tsx` gates that whole header on the subscribed state), so if the
person doing the upload is on Free they will not see the button at all and the hand-off needs
a seat on a paid plan first. Custom Templates and its Add New Template dialog are the
email-template route, not this one: it refuses a module with "Please select valid email
template". Then: sync check in the plugin, build one real sample email from the new components
as proof, export it, and send a test to a real inbox. Building is free; exports count against
plan limits.
