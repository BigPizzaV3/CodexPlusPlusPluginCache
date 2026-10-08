# Render spec: naming, components, properties, and validation

## Contents

- R6: Human layer names and plugin-data tags
- R7: Reusable components
- R8: Component properties
- R9: Post-build checklist

## R6. Layer names: friendly on the canvas, the tag in plugin data

Every node carries two names: `node.name`, the Figma layer name, for the human who opens the
file, and the plugin data key `name` (shared namespace `emaillove`), which is the MJML tag.
**The exporter never reads the layer name for dispatch**, so a friendly layer name cannot
break the export as long as the plugin data tag is there. The plugin does exactly this to its
own nodes.

```js
const section = figma.createFrame()
section.name = 'Row (Contains columns that sit side by side)'   // for humans
section.setSharedPluginData('emaillove', 'name', 'mj-section')  // for the plugin
```

Three ways this goes wrong:

1. **Skipping the plugin data write and relying on the fallback.** The plugin has a helper
   (`enableVariableNaming`) that copies `node.name` into plugin data `name` for any node
   whose plugin data `name` is empty. Once that runs, the friendly label IS the tag,
   permanently, and the node matches no branch in the exporter.
2. **Putting the friendly name in plugin data.** The value must be either the bare tag or the
   parsed form `Friendly, (mjml:mj-section)`. A friendly-only value is read whole as the tag,
   matches nothing, and the node is dropped with no error.
3. **Button icon frames** are found by a raw layer-name substring check on the library-save
   path, so they must keep the literal `beforeIcon-Frame` / `afterIcon-Frame` substring. They
   are out of scope here, so the safe move is not to build them.

The root is the one node whose naming depends on the shape (R2): an EMAIL TEMPLATE root gets
no tag at all and its layer name is the email name; a DESIGN-SYSTEM MODULE root is tagged
`mj-wrapper` and its layer name is the module name rather than the wrapper display string.

### R6.1 Display names by tag

| tag (plugin data `name`) | Figma layer name (`node.name`) |
| --- | --- |
| `mj-body` | Email Canvas |
| `mj-wrapper` | Wrapper (Groups rows and sets the background for this section ) |
| `mj-section` | Row (Contains columns that sit side by side) |
| `mj-column` | Column (Your images, text, buttons, and other content go in here) |
| `mj-column-inner` | Inner Column |
| `mj-group` | Group (Groups columns together for responsive stacking) |
| `mj-text-Frame` | Text Block |
| `mj-text` | Text |
| `mj-image-Frame` | Image Block |
| `mj-image` | Image |
| `mj-button-Frame` | Button Block |
| `mj-button` | Button |
| `mj-button-text` | Button Text |
| `mj-hero-Frame` | Hero Block |
| `mj-hero` | Hero |
| `mj-hero-Image` | Hero Image |
| `mj-divider-Frame` | Divider |
| `mj-divider` | Divider Line |
| `mj-raw` | Code Block |
| `mj-raw-text` | Code Text |
| `mj-spacer` | Spacer |
| `mj-social` | Social Bar |
| `mj-social-element` | Social Icon |
| `mj-navbar` | Nav Bar |
| `mj-navbar-link` | Nav Link |
| `mj-nav-text` | Nav Text |
| `mj-table` | Table |
| `mj-table-row` | Table Row |
| `mj-table-column` | Table Cell |
| `mj-table-text` | Table Text |
| `mj-table-image` | Table Image |
| `beforeIcon-Frame` | Before Icon |
| `afterIcon-Frame` | After Icon |

Reproduce these strings verbatim, including the stray space before the closing paren in the
wrapper string; that is what the plugin writes. Any tag not listed uses the tag itself as the
layer name. You may append a short human qualifier when a module holds several of the same
block ("Text Block / eyebrow"), but avoid the comma form, since `Label, (mjml:mj-text)` is
the parsed tag syntax.

**Finding these nodes again later: `query()` does not match a layer name that contains a space.**
Measured: `query('FRAME[name*=Text Block]')` returns nothing against frames genuinely named `Text
Block`. Every display name in the table above contains a space, so `query()` is unusable for
finding nodes by the names this appendix prescribes, and the appendix is what created the trap.
Traverse `children`, or use `findAllWithCriteria` and filter on `node.name` yourself.

**The tags below the transcription set.** `mj-hero`, `mj-social`, `mj-navbar`, `mj-table`,
and their children are real plugin node types, which is why they appear in the display-name
table and in the visual-pattern mapping. This spec's detailed attribute mapping covers the
core set only (R3, R4). When the worker returns one of the others, compose the row from
mapped primitives instead (B4), and reserve `mj-hero` for the case where a design genuinely
needs live text over a full-bleed background image.

**A band with decorative art needs neither `mj-hero` nor baked text.** Build a full-bleed
`mj-group`: the copy column carries the band fill and rounded edge, while a narrow art column
carries the decoration and sets `mobileStylesHideInMobileDevice = 'true'`. Keep the copy
inside the email content margin. This preserves live text and removes the decoration cleanly
on mobile.

`mj-column` has no background-image mapping either, so art behind live text inside a card has no
supported construction. Place an overlapping glyph or ornament as an in-flow `mj-image` above the
content and bind its visibility to a BOOLEAN when the source has variants without it. The loss is
the overhang only. Do not bake the card into an image to preserve the overlap: images are not
erased in dark mode, so a baked light card can keep its light colors under forced-light text.

## R7. Components: when a node is a COMPONENT instead of a FRAME

**Make it a COMPONENT when it is meant to be reused**: a design-system module (always), a
section you built to fill a gap and intend to save into the library, a foundations button or
badge that other modules instance. Keep it a FRAME when it is a one-off campaign email that
nobody will instance.

This is safe. Confirmed against the plugin source: the export gate whitelists `FRAME`,
`INSTANCE`, `COMPONENT` at the root and at every container level; the Add New Template branch
tests plugin data only (`nodeType === 'mainFrame'`), never `node.type`; and every
`mj-wrapper` the plugin renders is created as a COMPONENT
(`UiParser.ts:1519-1522`). Instances work too, because an instance surfaces the main
component's plugin data.

```js
// build it as a component from the start...
const root = figma.createComponent()          // instead of figma.createFrame()
// ...or promote the frame you already finished:
const root = figma.createComponentFromNode(frame)

// A DESIGN-SYSTEM MODULE (R2.2): the component IS the mj-wrapper.
root.name = 'Hero, text led'
root.setSharedPluginData('emaillove', 'name', 'mj-wrapper')
// no nodeType key. Writing 'mainFrame' here breaks the module upload (R2.3).

// A REUSABLE WHOLE EMAIL (R2.1): the component is the untagged root.
root.name = 'Welcome email'
root.setSharedPluginData('emaillove', 'nodeType', 'mainFrame')
// plus the eight theme keys. No 'name' key on this node.
```

Four rules keep a COMPONENT root working:

1. **Keep it a direct child of the page.** The plugin's template discovery enumerates DIRECT
   page children and filters on plugin data. A root pulled into a COMPONENT_SET is no longer
   a page child and vanishes from the plugin's picker. A Figma SECTION swallows a root the
   same way, and that hazard applies to FRAME roots too.
2. **Do not leave instances of a template root on the page.** Instances inherit the main
   component's plugin data, so an instance of a template root also reads as a template. To
   show a module in use, place it inside an email root, not loose on the library page.
3. **Properties go on the component that owns the node** (R8), which is the MODULE, never the
   email root. Because every `mj-wrapper` is itself a COMPONENT, an email root cannot bind a
   property to anything inside its wrapper components: Figma rejects
   `componentPropertyReferences` on an instance sublayer.
4. **Do not write `isStandalone`.** The shipped plugin build ignores that key entirely, so a
   "standalone" section gets no wrapper-level controls and is not eligible for the Upload
   button. Keep `mj-wrapper` as the top-level block boundary.

## R8. Component properties

Properties turn a rebuilt module into something a marketer can use without opening it. They
are an agent-side layer on top of the plugin's plugin data model: the plugin neither writes
nor reads them, and they change nothing about the export except through `visible`.

Three hard constraints before any code:

- `addComponentProperty` exists **only** on ComponentNode and ComponentSetNode. A FrameNode
  does not have the method. Convert first (R7).
- The property id that comes back is **suffixed** (`Body#12:3`). Always bind and set with the
  returned id, never with the bare name.
- Figma refuses `componentPropertyReferences` on an **instance sublayer**. The property must
  be added to the component that directly contains the node you are binding.

There are exactly four property types: BOOLEAN, TEXT, INSTANCE_SWAP, VARIANT. **There is no
image property type**, so an `mj-image` fill cannot be exposed as a property.

```js
// TEXT, bound to characters, for copy that changes per send.
// Bind the inner TEXT node, never the wrapper: mj-text, mj-button-text.
const headline = moduleRoot.addComponentProperty('Headline', 'TEXT', textNode.characters)
textNode.componentPropertyReferences = { characters: headline }

// BOOLEAN, bound to visible, for optional regions.
// Bind the block-level wrapper frame, never the inner leaf.
const showBtn = moduleRoot.addComponentProperty('Show Button', 'BOOLEAN', true)
ctaFrame.componentPropertyReferences = { visible: showBtn }

// INSTANCE_SWAP, bound to mainComponent, for style variants.
const style = moduleRoot.addComponentProperty('Button Style', 'INSTANCE_SWAP', primaryButton.id, {
  preferredValues: [
    { type: 'COMPONENT', key: primaryButton.id },
    { type: 'COMPONENT', key: inverseButton.id },
  ],
})
buttonInstance.componentPropertyReferences = { mainComponent: style }
```

For unpublished local components, `.key` is empty and `LOCAL_COMPONENT` is rejected. Use the
node id with preferred-value type `COMPONENT`; switch to published keys only after publishing.

BOOLEAN composes exactly with the exporter, which returns early on any node where `visible`
is false, so flipping it off genuinely removes the block from the exported HTML rather than
shipping a hidden element. VARIANT is only meaningful on a ComponentSetNode; skip it for
email modules, and remember rule 1 in R7.

**Which properties to add.** Customer-facing headlines, eyebrows, subheads, body copy, and
button labels receive module-root TEXT properties by default. Keep legal copy, addresses,
unsubscribe lines, and link-bearing text unbound; binding `characters` wipes hyperlink ranges.
Require source evidence only for BOOLEAN and INSTANCE_SWAP properties. Two to seven properties
per module is the working range, with zero only when there is no customer-facing copy. Name
properties consistently and read every binding back.

**The known button failure:** Figma cannot remap a nested button instance's TEXT property to
the module root. Build buttons inside modules as inline styled frames with one direct text node,
matching the foundations component as the style reference, and bind that node's label at the
module root.

## R9. Post-build checklist (run per email or module before handing off)

1. **The root matches the shape you meant to build** (R2), and only one of these is true of
   it:
   - **EMAIL TEMPLATE:** shared `nodeType = mainFrame`, ALL theme color keys plus
     `lightThemeBackgroundColor` and `fallBackFontName`, no `name` key, and its direct
     children are `mj-wrapper` components.
   - **DESIGN-SYSTEM MODULE:** shared `name = mj-wrapper`, **no `nodeType` key anywhere in
     the tree**, no theme keys unless a designer asked for a dark-mode treatment, layer name
     is the module name, and its direct children are `mj-section` frames. Read `nodeType`
     back off the root and confirm it is empty.
2. Every FRAME/RECT/LINE/TEXT you created has shared `name` set to exactly one known tag;
   zero untagged frames anywhere in the tree; nothing relying on the layer-name fallback.
3. Every node's layer name is the display name for its tag (R6.1), and no friendly string was
   written into the plugin data `name` key. The one exception is a module root.
4. Every leaf is a complete pair; every `mj-button` has a direct TEXT child; no empty wrapper
   frames.
5. `primaryAxisAlignItems === counterAxisAlignItems` on every auto-layout frame, except a column
   in a multi-column row may deliberately use primary MIN with counter on the content's horizontal
   alignment (R3.4). Mark each such top-align exception as intentional in the mismatch report.
6. All nodes `visible = true` (except a region deliberately left off via a BOOLEAN default);
   `itemSpacing = 0` everywhere; no stray fills.
7. **Every frame in the tree has `layoutSizingVertical === 'HUG'`.** Walk the whole tree, root
   included. The only FIXED height allowed is on an `mj-spacer`; the only hard heights are on
   the `mj-image` rectangle and the `mj-divider` line, neither of which is a frame.
8. **Every FIXED width is one of the four load-bearing cases** (root, columns in a
   multi-column section, columns in a group, the image rectangle). Lone columns are FILL and
   groups are HUG except a bordered group deliberately pinned for border headroom. A button is not one of the four: its width is R0.4's mobile-behavior
   decision, so HUG, FILL, and a deliberately pinned FIXED are all valid there, and item 10 is
   where it is checked.
9. **Every pinned-width column that contains text has slack, and every pinned string was
   sanity-checked against the exported font, not the canvas font** (R3.3.1). Columns in a group
   above all, since those never stack on mobile. `max(ceil(hug * 1.12), hug + 8)` plus
   horizontal padding, or 1.25 in place of 1.12 where the root's `fallBackFontName` is Verdana,
   Tahoma, or Georgia (R3.3.1), and the inner group percentages still sum to 100. A label that fits
   exactly on the Figma canvas is a wrap in the plugin Preview, because the canvas font and the
   font the email loads are different binaries. FILL columns are exempt.
10. **Every button's width sizing was a decision** (R0.4), and buttons are at least 44px tall,
    from `inner-padding` rather than a set height.
11. All vertical spacing is padding: no gaps produced by a taller frame, by `itemSpacing`, or
    by a manually positioned node.
12. Root width equals the mj-body width; vertical section paddings equal the worker attrs. All of
    those numbers are at email scale, not source scale
    (R0.6): the root is 600 or 640, and body copy is a size email actually uses.
    **And every text-bearing column resolves to the email's ONE content width**, not to the side
    margin the worker returned for that screenshot (R0.3.1): read the resolved width back off the
    column, compare it against the number you fixed before you started, and check that a
    multi-column split still sums to it. Apply R0.3.1's two sanctioned exceptions by checking
    the outer edge: full-bleed bands may use body width, while a card or inset block may add
    deliberate inner padding. That is the check you cannot
    do by looking at one section, only by comparing the sections to each other.
13. If it is a module: the root is a COMPONENT tagged `mj-wrapper`, a direct child of its
    category page, not inside a COMPONENT_SET or a Figma SECTION, with no stray instances
    left on the page, and no second `mj-wrapper` nested inside it.
14. Every component property you added was re-read back off the node to confirm the binding
    landed, and each one has a reason you can state in the report.
15. No em dashes in any layer name, plugin data value, or text characters.
16. Compare a fresh screenshot against the design you converted from, for spacing, alignment,
    and color parity. Small color and font-metric differences are acceptable; missing
    content, zero-height sections, clipped text, and alignment flips are not.
17. **No gap is paid for twice.** For every pair of stacked siblings, exactly one of them carries
    the padding that separates them, and it is the one above (R0.7). Any frame whose height
    exceeds its content by exactly a padding you wrote is this bug.
18. **Every image taken from a source design is a render of its node, not a raw fill** (R4.2.1),
    so any crop or z-order clipping is baked into the pixels. Each rectangle's height is the
    render's aspect ratio at the width you chose, and the width itself was a stated decision
    (full bleed or the source's inset), not an accident.
19. **Every overlap or edge bleed in the source became a two column row** (R3.4.1), never an
    improvised container and never a flattened image. Per swap: both columns FIXED with their
    widths summing to the section content box, the text column pinned with R3.3.1
    slack, the image column the remainder, the `mj-image` height the render's natural aspect at
    the image column's content width, no `mj-group`, and the gutter paid by one column only.
    Your report names the swap and states that the overlap is the whole of what was lost.
20. **No `mj-group` has a fill.** Band fills belong on its columns. For bordered groups, the
    pinned group has enough headroom that column widths plus borders do not exceed 100 percent.
21. For every reusable module, customer-facing text is reachable through module-root TEXT
    properties except boilerplate and link-bearing text. Every button label is exposed there.
