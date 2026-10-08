# PATH B: the customer has no design system yet

## Contents

- B1: Brand interview
- B2: Select and assess the source design
- B3: Call the design converter
- B4: Transcribe the returned JSON
- B5: Repair known worker limitations
- B6: Apply foundations and prepare reusable modules

The new-customer path. Structure comes from the design-converter worker; styling comes from
the brand foundations and is applied on top. Say plainly at the start that you are generating
a first email and that it doubles as the first piece of their design system.

## B1: A short brand interview

Four questions, one batch, on top of the Step 1 brief:

1. **Brand basics:** logo file, primary and secondary colors as hex, and the brand fonts. Ask
   for an email-safe fallback for any font that is not web-safe (Arial, Georgia, Helvetica,
   Times, Verdana, Tahoma, Trebuchet, Courier). Never invent a substitution silently. If the
   chosen fallback is unavailable in Figma, use Arimo for Arial or Helvetica, Gelasio for
   Georgia, or Tinos for Times New Roman, and report that the exported family will be the clone.
2. **Email width:** 600 or 640. Everything downstream is measured against this.
3. **Footer requirements:** postal address, unsubscribe mechanism, and whether their ESP
   injects the footer with a merge token (see "The footer token block" below).
4. **Do they have anything to start from?** This is the important one, and it decides B2.

## B2: Where the design comes from, best first

- **Their own past email.** The strongest input: real brand colors, real type, real logo, no
  clone risk. Accept an HTML file from their ESP, an `.eml`, or a screenshot. If they give
  HTML, render it headlessly to PNG at the email width. If they give a screenshot, use it as
  is.
- **Their own non-Email-Love Figma design.** Screenshot the frame via the Figma MCP
  (`get_screenshot`) and convert that. Their file stays read-only.
- **A comp you design for them.** When they have nothing. Write the layout as a single HTML
  file at the email width using their real colors, fonts, and copy, render it headless at 2x,
  and convert that render. Let the Step 2 inspiration decide the section order and pacing;
  let the brand interview decide every color and typeface.

**First judge whether the design you were handed is AUTHORITATIVE about geometry, because only then
are its proportions worth preserving.** This is the short version of a question the migration audit
asks in full, and Path B meets it every time somebody hands over a Figma frame. Their own past email,
or a comp you wrote at the email width, is authoritative by construction: it was made to send. An old
mockup drawn to present usually is not. Four cheap signals answer it: is the design at a standard
email width, does it use real text styles rather than sizes typed per layer, is it built with auto
layout rather than absolute positioning, and are its equivalent margins identical rather than merely
similar.

- **Mostly yes: the geometry is a specification.** Derive the scale factor as below, carry the
  source's margins, ramp, and spacing across, and tell the user what you preserved. Convert its
  side margin ONCE, through the target email width, and use that one content width in every
  section (R0.3.1), because the worker returns a side margin per screenshot and three of those in
  one email is a text edge that moves as the reader scrolls.
- **Mostly no: take the brand and build to email standards.** What you keep is the palette, the
  typefaces, the logo, the copy, and the order the blocks come in. **Do not derive a scale factor at
  all**, and do not preserve a source proportion: build a 600 wide email with body copy at 16 on a
  conventional ramp (12, 14, 16, 20, 24 to 30), spacing in multiples of 8, and one content width for
  every section, normally 560 with 20/20 padding. Scaling the screenshot to 600 before you send it is
  still right, but that is framing one PNG rather than a factor entering the email. Say so to the user
  in a sentence, because it is good news rather than a compromise: a margin nobody chose carries no
  decision, and dividing it faithfully reproduces a guess more precisely than it was made.

**The rest of this section is for a design you judged authoritative.**

**Check that the source is at email scale before you convert it.** A past email or a comp you
wrote yourself is at email width by construction. A Figma design drawn for presentation, or a
web-first canvas, is often some multiple of it, which means every size authored in it (a 35px body,
a 53px headline) carries that multiple, and anything you read off it or hand the worker in
`promptInputs` carries it too until you divide it out. Two cheap
derivations catch it: the frame width divided by the email width from B1, and the authored type
sizes divided by the sizes email actually uses (a 35px body over 16, a 53px headline over 24).
Land near 1 and the source is at email scale. Land near some other number and that number is your
scale factor. When the two derivations disagree by more than a few percent, trust the type ramp: a
designer picks type sizes deliberately off a ramp, while a canvas width absorbs bleed, margins,
and whatever artboard someone happened to start on. Then do two things: scale the screenshot down
to the email width before you send it, because that is the input the worker was tuned for rather
than a lever on its output (it classifies at a canonical email scale and returns email numbers
whatever resolution you send, so do not expect its payload to carry the factor either way: R0.6),
and pin `emailWidth` in `promptInputs` (B3), which is the setting that actually fixes the body
width. Tell the user the factor you derived; it is a judgment they may want to correct.

**A factor you derive here is ONE number, applied to EVERY quantity it governs.** Whether you scale
the screenshot before sending it or divide a source measurement you carry across by hand, the same
factor governs type
sizes, line heights, the spacing scale, paddings, and spacer heights. Rounding is allowed, to
the nearest whole pixel, after the division. Choosing a converted value because it looks like a
size email usually uses is not rounding; it is a second factor invented for one element.

**Widths are the exception, and R0.6's TWO FACTOR TENSION is why.** Divide the source width by the
target email width and compare that ratio to the type factor you just derived. They agree only when
the source was drawn at an exact multiple of the email width, so usually they do not: a 1092 wide
source at a 600px body is 1.82 across the width against a 2.2 type factor. When they differ by more
than a couple of percent, say so to the user and name the split rather than picking one: the type
factor governs type sizes, line heights, and the spacing scale, and the target email width governs
the body width and everything measured across it (content width, column splits, image widths).

**Check it against the source's own ratios.** Divide the largest type size you ended up with by the
smallest, do the same in the source, and compare. More than a couple of percent apart means
something got rounded toward a pleasant number instead of divided. The failure looks like this,
measured on a real conversion: a source headline of 55 and body of 35, a ratio of 1.57, came out as
30 and 16, a ratio of 1.88, so 1.83 on the headline and 2.19 on the body. The email read as though
its padding were wrong even though every padding value was correct, which is why this is worth a
deliberate check rather than a glance. If a converted size looks wrong, the factor is the suspect
and not the style: re-derive the factor, re-divide everything, re-run the check.

Rendering, whichever HTML you start from. Codex has a shell, so do it locally:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu \
  --screenshot=/tmp/render.png \
  --window-size=600,4000 \
  --force-device-scale-factor=2 \
  file:///tmp/comp.html
```

Use the customer's email width for the first `--window-size` number and a height tall enough
for the whole email, then **trim any trailing blank space before sending**. A screenshot
padded with empty page invites the worker to invent spacers. On Linux substitute
`google-chrome` or `chromium`.

Never convert a competitor's email or an Email Love library preview. Same clone problem, and
the customer has no design system to restyle it into, so a clone stays a clone.

## B3: Convert the source

### Prefer the Email Love MCP for a Figma source

When `emaillove_convert_design` is available and the customer supplied a Figma source, use it
before the direct worker route. Pass the source file's `fileKey` and the selected frame's
`nodeId`; the MCP renders the node server-side through Figma and forwards it to the converter.
This preserves the source-specific conversion path without moving image bytes through the agent.

- Follow the tool schema for `responseMode`. Use its `outline` or `section` response modes when
  the full tree would be too large for one tool response, and preserve every returned part before
  transcription.
- Use `screenshotUrl` only when the customer owns the image and the source Figma node cannot be
  identified. Do not use a competitor or Email Love library preview as either input.
- The conversion is source-led. It is not a route for free-form HTML generation.

Save the returned conversion output before transcription and continue with B4 through B6. If the
MCP tool is unavailable, unauthorized, or cannot access the source file, use the direct worker
route below.

### Direct worker fallback

POST to `https://convert.emaillove.com`:

- **Headers:** `Content-Type: application/json`, `Authorization: Bearer` with an **empty**
  token, and `X-Auth-Provider: gumroad`. That combination is an anonymous Free user, which is
  allowed; no license key is needed.
- **Body:** `{ "screenshot": "<raw base64, no data: prefix>", "screenshotMime": "image/png" }`.
  **Set the mime correctly.** It defaults to PNG and is passed straight through, so a JPEG
  declared as PNG is a silent quality loss.
- **`promptInputs` (optional, and worth it whenever you know the design).** The worker treats
  these as truth and the screenshot as a lossy reference, so anything you pin comes back
  exact and anything you leave unpinned gets re-derived from pixels and drifts. Supported
  fields: `emailWidth` (number), `textNodes` (per text run: `content`, `fontFamily`, `color`,
  `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `textAlign`, `textCase`,
  `textDecoration`, `hyperlink`), `imageNodes` (`{ width, height, name }`), `bgColors` (array
  of hex strings), `layoutText` (a plain-text frame tree with paddings and gaps). When you
  authored the comp yourself in B2 you know all of this: send it.
- **Query params:** `nocache=1` skips the cache entirely, read and write (results otherwise
  cache for 24h on the screenshot hash); `recache=1` skips the read but still writes, which
  is how you overwrite a bad cached result; `decomposeRasterized=1` asks the worker to OCR
  flat image-only regions into live text and buttons instead of one big image, for sources
  that are a single baked screenshot.
- **Response:** the MJML JSON. `X-Cache` says HIT or MISS. `X-Trivial-Response: true` means
  the result collapsed to a single image; re-run with `recache=1` and usually
  `decomposeRasterized=1`. A full-length email takes 20 to 40 seconds.

From the Codex shell:

```bash
B64=$(base64 -i /tmp/render.png | tr -d '\n')
printf '{"screenshot":"%s","screenshotMime":"image/png"}' "$B64" > /tmp/body.json

curl -sS --max-time 120 -D /tmp/headers.txt \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer' \
  -H 'X-Auth-Provider: gumroad' \
  --data-binary @/tmp/body.json \
  'https://convert.emaillove.com' > /tmp/mjml.json
```

The `Authorization` value is the literal word `Bearer` with nothing after it. On Linux
`base64 -i` becomes `base64 -w0`. Read `/tmp/headers.txt` for `X-Cache` and
`X-Trivial-Response` before you trust the body.

**Save the JSON to disk before transcribing**, so the transcription and any later
re-verification work from a stable input.

**If your Figma MCP is read-only**, B4 cannot run and Path B is not dead: have the user paste
the render into their Figma file, select it, and hit Convert on the plugin's AI Import
screen. That calls this same worker and writes the frame for them, structure included. You
then pick up at B5 and B6 by reading the resulting frame back and telling them precisely what
to fix. Say up front that this is the route you are taking and why.

## B4: Transcribe per the render spec

Follow [render-geometry.md](render-geometry.md), [render-nodes.md](render-nodes.md), and
[render-components-validation.md](render-components-validation.md) exactly. Together they map
every MJML tag and attribute to the Figma node, auto-layout, fill, and shared plugin data the
exporter reads back. Do not improvise a mapping. Run the R9 post-build checklist per email
before moving on.

**Name every node twice** (R6). The MJML tag goes in the `name` shared plugin data key; the
layer name gets the plugin's own friendly display name for that tag ("Row (Contains columns
that sit side by side)", "Text Block", "Button Text"). The exporter resolves the tag from
plugin data and never reads the layer name for dispatch, so this costs nothing and it is the
difference between a file a designer can read and a wall of `mj-` strings. Never rely on the
layer-name fallback: a node with no plugin data tag can have the friendly label baked in as
its tag by the plugin's own naming helper, and it stops exporting.

What the spec maps: `mj-wrapper`, `mj-section`, `mj-group`, `mj-column`, `mj-column-inner`,
and the text, image, button, divider, and spacer leaves. **When the worker returns a tag the
spec does not map**, which in practice means a social icon row coming back as `mj-social`
with `mj-social-element` children, do not invent a node for it and do not silently drop it.
Rebuild that row from tags the spec does map: for social icons, an `mj-group` of one-column
`mj-image` pairs, each with its own `href`, which also keeps the icons side by side on
mobile. Composing from mapped primitives is the same move as rebuilding a pill as a button;
inventing an unmapped node is not. List every row you rebuilt this way in your report.

## B5: Repair what the worker gets wrong (every time, these are known)

The worker returns structure, not a finished email. Five gaps, all observed repeatedly:

1. **Pills and badges come back as `mj-text`** with an inline-styled `<div>` carrying a
   background color and a border radius. Rebuild every one as an `mj-button` (see the
   standing corrections below). A pill needs no link to be a button.
2. **The worker never emits `mj-group`.** Its whole vocabulary is `mj-wrapper`, `mj-section`,
   `mj-column`, `mj-text`, `mj-image`, `mj-button`, `mj-divider`, `mj-spacer`, and
   `mj-social` with `mj-social-element` children. Anything that must stay side by side on
   mobile comes back as plain sibling columns, which will stack. Decide which rows must not
   stack (badge rows, icon rows, two-up cards) and rebuild those as an `mj-group` per R3.3.
   The columns inside that group are pinned to pixel widths, so pin them with slack rather
   than at the width Figma hugged to (R3.3.1: a pinned column cannot grow, and the email
   renders a different font binary than the canvas does). Never put a fill on the group;
   put band fills on its columns so dark-mode text cannot go white-on-white. Run R3.3.2's
   mobile shrink calculation before accepting the row.
3. **Every `src` is `"placeholder"`.** Place the customer's real logo and imagery yourself;
   use flat gray fills at the correct dimensions everywhere else and list them in your
   report. When an image comes out of their own Figma design, export the RENDERED node, never
   the raw image fill behind it: a fill with `scaleMode: 'CROP'` loses its crop the moment you
   take the underlying asset, and you get the whole photograph instead of the picture the
   designer composed (R4.2.1, which also has the aspect-ratio rule).
4. **Unpinned colors, radii, and fonts drift** by a few units between runs, and unpinned
   fonts flatten to Arial. Correct them against the brand foundations rather than accepting
   what came back.
5. **The worker cannot see an overlap, so it never returns the Two Column Swap.** It infers
   structure from a flat screenshot, and email has no z-order to infer into, so a source block
   where a photo bleeds past its band or sits behind copy comes back either as a full-width
   `mj-image` stacked above the text or as the whole band flattened into one image. Neither is
   the answer. Rebuild it as a two column row per **R3.4.1**: one section, two columns, image in
   one and text in the other in source order, both columns pinned to widths that sum to the
   section content box, the image a rendered crop of the source region. R3.4.1 also has the two
   tells for spotting the pattern in the source, which you need because the screenshot you sent
   the worker hides the overflow by construction, so check the source nodes rather than the PNG.
   Do not improvise a container for the overlap and do not flatten the block to make it go away.
   State in your report that you applied the swap, and that the loss is the overlap and nothing
   else.

## B6: Apply the design system on top, then make it reusable

AI Import produces structure, not styling. It is not a pixel copier. Once the tree is
correct, apply the brand colors and type from B1 across every text node, button, and section
fill. Set the root frame's six dark-mode theme keys from the file's established dark treatment;
if none exists, use the house dark defaults in R2.1 and flag them for review. The light body color
belongs only in `lightThemeBackgroundColor`. Keep global `contentColor` neutral unless the brand
treatment covers most filled surfaces. A one-off footer or card color belongs as a per-node
`contentColor` override on that module's main component.

Then offer to make it reusable. Saving into the plugin's design system is an authenticated
plugin action on the user's current selection; you cannot push components into it. What you
can do is set it up so the save is one click.

**First decide what they are saving, because the two are different shapes and they go in
through different screens** (R2 in [render-geometry.md](render-geometry.md)):

- **The whole email, as a starting template.** That is the `mainFrame` root you already
  built. It stays exactly as it is; the marker is required.
- **One block, as a reusable module.** That is the `mj-wrapper` inside the email, not the
  email root. Uploading a `mainFrame` as a module does not fail, it archives as a whole
  email, so do not "promote the email frame" when what they wanted was a hero. Copy the
  wrapper out to a library page, make that copy a COMPONENT tagged `mj-wrapper`, and make
  sure it carries **no** `nodeType` key. R2.2 has the exact calls and R2.3 the plugin
  evidence.

Then, either way:

- **Rename it first.** The raw Figma layer name becomes both the component name and its
  storage path, and there is no rename field in the save dialog. A frame left at its import
  name saves as a component literally called `EmailLove_clone`.
- **Add properties to anything meant for reuse.** A one-off campaign email can stay a frame
  with no properties. A module exposes customer-facing headlines, eyebrows, subheads, body,
  and button labels as module-root TEXT properties by default, usually two to seven. Keep
  boilerplate and link-bearing text unbound because a characters binding wipes hyperlink
  ranges. Require evidence only for BOOLEAN and INSTANCE_SWAP properties. Build a module's
  button inline to surface its label; a nested foundation-button instance cannot remap that
  TEXT property to the module root. R7 and R8 carry the exact bindings. Re-read every binding
  before presenting.
- **Use the customer's real category names** when you propose where each upload goes. If the
  Email Love MCP is connected, `list_components` returns their categories; otherwise ask them
  to read the section names off the plugin's Assets sidebar, which ships 13 predefined
  sections: Pre-Header, Header, Heroes, Single Column, Two Column, Three Column, Four Column,
  Buttons, Reviews, Images, Lists, Order Tables, Footer. Classify by what the block
  structurally is: **Heroes** for a top-of-email feature block, **Single Column** for one
  full-width stack, **Two Column** or **Three Column** for side-by-side columns, **Order
  Tables** for line-item layouts, **Images** for image-only blocks. When nothing fits, choose
  the closest existing section and say so, rather than inventing one.
- **Then walk the uploads, and route each one by its shape.** A whole email template goes in
  through Custom Templates: "Select the email frame, make sure a design system is selected in
  the plugin, open Custom Templates, click **Add New Template**, pick a category." A module
  goes in through the Assets sidebar instead: "Pick the design system, open the Heroes
  section, select 'Hero, text led' on the canvas, click **Upload**, confirm; say done and I
  will queue the next." Selecting several wrappers at once uploads them as one batch. **That
  Upload button only renders for a user on a paid plan** (`AssetsComponent.tsx` gates the whole
  Assets header on the subscribed state), so a Free user will not find it; say so rather than
  sending them hunting. Custom Templates refuses a module with "Please select valid email
  template", because that path requires the `mainFrame` marker a module must not carry. Report
  the full checklist even if the user defers the uploads; it is the hand-off artifact.
- Do not write `saveCategory` or `saveName` plugin data. The plugin reads neither key today.

**What you have made here is a few reusable components, and that is not a design system. Do not
improvise one mid-build.** A real Email Love library has a shape: a prescribed page frame (Cover,
Getting Started, divider pages, Foundations, Type, Buttons, one page per component category,
Campaigns), color and spacing as Figma variables in two tiers with every component fill bound to a
semantic token, a Type page built as a specimen sheet, and one module per row of an audited
inventory. That comes out of the migration route, which audits the source, classifies how much of its
geometry is a specification, settles the scale factor once where one applies, and builds foundations
before any module. Inventing a page structure and a token set here, in
the middle of building one email, produces a file that looks like a design system and matches no
other customer's, which is exactly the divergence the prescribed structure exists to prevent. So
save the blocks that earn it, put them on a plainly named library page rather than a scaffolding of
your own, and say plainly that a full library is a separate piece of work.

Point the user at `$email-love-design-system-migration` or hello@emaillove.com for a whole
legacy library. A full library is a migration, not a one-email build.
