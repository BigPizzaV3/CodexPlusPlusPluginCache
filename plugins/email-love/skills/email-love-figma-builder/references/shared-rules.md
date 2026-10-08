# What always applies, on both paths

## Contents

- Standing structural corrections
- Root frame
- Links, alt text, subject, and preheader
- Mobile styles
- Footer token blocks
- Foundations that must not change
- Content writing
- Verification
- Handoff

## The standing corrections

These are the mistakes that keep recurring. Check every build against all six. On Path A they
apply to the root and to anything you build outside an instance; they are never a reason to
open an instance and correct its internals, which the components already got right.

- **A pill, badge, tag, or chip is an `mj-button`, never a radiused column.** `mj-button`
  renders a padded, rounded, background-filled box with centered text **and the Outlook VML
  fallback**. A column with a border radius does not survive Outlook.
- **Elements that must stay side by side on mobile go in an `mj-group`.** The group is a
  child of `mj-section` and **never** of a column. MJML requires the columns inside a group
  to be sized in percentages rather than pixels, and you get that by giving each inner column
  an exact **fixed pixel width in Figma** and letting the exporter divide it by the group's
  content box (280 + 280 in a 560 group exports 50/50). Do not reach for FILL sizing to
  express the percentage. To stop a whole section stacking without a group at all, set
  `stackColumns` to `'false'` on the section instead.
- **An image is an `mj-image-Frame` containing a tagged `mj-image` rectangle**, as a pair.
  Never a frame with an image fill on itself: a childless wrapper exports as an empty cell.
  The same pairing applies to text, buttons, and dividers.
- **Alignment: set both axes to the same value, except for multi-column top alignment.** The
  exporter reads `primaryAxisAlignItems` for horizontal alignment in most frames, so a vertical
  column that looks centered on canvas can export as left. Match the two axes everywhere except
  the deliberate R3.4 multi-column case: primary MIN for top alignment, with counter on the
  content's horizontal alignment.
- **Sizing is not cosmetic: heights hug, widths are a decision.** Every frame you create,
  from the root down, is vertical HUG. A fixed height clips content in Outlook and breaks the
  first time the copy runs a line longer. Vertical rhythm is auto layout padding, never a
  taller frame and never manual positioning, which does not export at all. Widths are FILL or
  HUG except where a pixel number is load bearing (the root width, columns in a multi-column
  section, columns in a group, the image rectangle). And a button sized **FILL** is what
  makes it full width on mobile, while HUG or FIXED keeps its width there, so size buttons
  from the design, not from what tidies the canvas. **R0 in
  [render-geometry.md](render-geometry.md)** has the full rule,
  the padding levels, and the one exception (`mj-spacer`).
- **Colors and type come from the design system and are applied on top of the structure.**
  Generated structure is a starting shape, not a styled email.

And the reason all of this is invisible: **untagged content does not fail loudly, it gets
flattened into a picture.** Anything the exporter does not recognize hits its
render-the-unknown-as-an-image path, and an unrecognized frame takes its entire subtree with
it. If your export shows images where you expected live text, that is the first thing to
check.

## Root frame

**This file builds EMAILS, so everything here is the email-template shape**: a `mainFrame`
root with `mj-wrapper` components stacked inside it. A reusable module is a different shape
(the wrapper IS the component, no `mainFrame` marker), and it only comes up when you save a
block into the design system in B6 or A5. R2 in
[render-geometry.md](render-geometry.md) has both side by side; do not mix them.

Preferred: duplicate an existing Email Love email frame, which carries all of this already.
When you create a root from scratch, it is a top-level vertical auto-layout frame with its
width FIXED at the email width (600 or 640), its **height Hug** (R0.1: never a fixed height,
on the root or on anything inside it), and **all nine** keys set. Empty theme keys are not
neutral: the exporter substitutes its own dark defaults, which may not match the brand treatment.

```js
frame.setSharedPluginData('emaillove', 'nodeType', 'mainFrame')
frame.setSharedPluginData('emaillove', 'backgroundColor', '#000000')        // dark-mode page bg
frame.setSharedPluginData('emaillove', 'contentColor', '#1F1F1F')           // dark-mode section bg
frame.setSharedPluginData('emaillove', 'textColor', '#FFFFFF')
frame.setSharedPluginData('emaillove', 'linkColor', '#FFFFFF')
frame.setSharedPluginData('emaillove', 'buttonTextColor', '#000000')
frame.setSharedPluginData('emaillove', 'buttonContentColor', '#FFFFFF')
frame.setSharedPluginData('emaillove', 'lightThemeBackgroundColor', '#FFFFFF') // light mj-body bg
frame.setSharedPluginData('emaillove', 'fallBackFontName', 'Arial')
```

The six theme keys are dark-mode-only values. Use the file's established dark treatment when
one exists; otherwise use the house defaults above and flag them for review. Never repeat the
light palette into those keys, which can produce light-on-light content. The one light value in
the set is `lightThemeBackgroundColor`. All of these stay editable in the plugin's settings
panel afterward.

## Links, alt text, subject, and preheader

These live in plugin data, so set them as you build. **Node placement matters and is easy to
get wrong:**

```js
imageRect.setSharedPluginData('emaillove', 'href', 'https://example.com/pricing')  // the mj-image RECTANGLE
imageRect.setSharedPluginData('emaillove', 'altText', 'Spring collection lookbook')
buttonFrame.setSharedPluginData('emaillove', 'href', 'https://example.com/pricing') // the mj-button frame
root.setSharedPluginData('emaillove', 'emailSubject', '20% off Premium ends Sunday')
root.setSharedPluginData('emaillove', 'emailPreHeader', 'Use code SPRING20 at checkout')
```

`href` goes on the `mj-image` **rectangle** and on the `mj-button` **frame** (the inner one,
not the `-Frame` wrapper). `altText` goes on the `mj-image` rectangle. Subject and preheader
go on the root.

**Existing values win, and you cannot change them.** The plugin reads its own private data
first and falls back to the shared namespace only when the private value is empty. A link
someone set by hand in the plugin lives in private data you can neither read nor overwrite,
so your value is silently ignored. Setting these where nothing was set works; changing an
existing one appears to succeed and does nothing. Treat every link you set as provisional and
list them in your report, and when a user asks you to change an existing link, tell them
plainly to change it in the plugin.

**Magic footer links need explicit handling.** `unsubscribe.com` is the portable placeholder
the exporter replaces with the selected ESP's unsubscribe merge tag. The similar
`manage-preferences.com` value is replaced only for Klaviyo; other targets can ship that literal
third-party URL. Never leave preference wording unlinked, because the exporter may inject that
placeholder. Use the customer's real preference-center URL, a confirmed Klaviyo placeholder,
or `unsubscribe.com` as the portable fallback.

## Mobile styles

Mobile styles are flat shared plugin-data keys on the node. The serialized
`mobileStylesCommonProperties` object is a payload view, not a key to write. Never invent a
plausible key: only write schemas observed in the plugin or verified by a render.

**Schema A, containers and leaf wrappers:** write `mobileStylesPaddingTop`,
`mobileStylesPaddingRight`, `mobileStylesPaddingBottom`, and `mobileStylesPaddingLeft` as numeric
strings. Padding overrides do not activate unless the same node also carries
`isPaddingActive = 'true'`. Other observed keys include `mobileStylesInnerPadding*`,
`mobileStylesHideInMobileDevice`, `mobileStylesHideInDesktopDevice`, `mobileStylesTextAlign`,
`mobileStylesAlign`, plus `stackColumns` and `reverseStack` on sections or wrappers.

**Schema B, type on the inner TEXT node:** write `fontSize = '<px>'` with
`fontSize_mode = 'override'`. The same pattern applies to verified type fields such as
`lineHeight` plus `lineHeight_mode = 'override'`, and `letterSpacing` plus
`letterSpacing_mode = 'override'`. Do not write guessed aliases such as
`mobileStylesFontSize` or `isFontSizeActive`.

Read every write back. Read-back proves storage, not effect, so verify the result in the plugin's
mobile render or Preview. A successful render is sufficient evidence even when the private copy
of plugin data is inaccessible. List every mobile key set in the handoff.

## The footer token block

If any email in the file carries a small frame holding ESP tokens like `{{Footer}}`, that is
an `mj-raw` block and it is how the ESP footer gets injected. **Copy that existing block into
every email you build**, rather than writing one from scratch. Three things to know:

- An `mj-raw` frame **must** contain its text child. The exporter reads the first child
  without checking, so an empty one breaks the export.
- Raw content is **skipped in the plugin's preview but present in the export**. Tell the
  user, so they do not report it as a bug.
- **If the file has no such block yet**, which is the normal Path B case, and the customer
  told you in B1 that their ESP injects the footer with a token, this is the one structure
  you may create by hand: a frame tagged `mj-raw` whose single child is a TEXT node tagged
  `mj-raw-text` holding exactly the token string they gave you, and nothing else. Everything
  else in the footer, the address, the unsubscribe wording, the social icons, is ordinary
  structure and comes from Path A or Path B like the rest of the email. If they do not use a
  token, skip the raw block entirely.

Keep raw blocks small: they skip the plugin's structure handling, mobile styles, and dark
mode entirely, and hand-written markup is where cross-client rendering breaks. Say in your
report that any raw block needs a real inbox test.

## Foundations you do not change

The **email width**, the **breakpoint**, and the **fonts** already in use are brand decisions
someone made, not defaults to improve on. If a font will not load in your environment, do not
substitute one to get the edit through. Report it and leave the layer as you found it; a
silent swap changes the brand's typography everywhere it lands.

**The file's page structure and its tokens are foundations too.** The page list, the page names,
the text styles, and the variables were decided when the library was built (A1). Build inside them:
never rename or reorder a page, never edit a text style or repoint a variable to make one email
work, and never add a page or a token as a side effect of a build. If an email genuinely needs
something the foundations do not carry, that is a request for the designer, so name it in your
report and build the closest correct thing meanwhile.

**Dark mode overrides are read-only.** Per-node `contentColor`, `textColor`, `linkColor`,
`buttonContentColor`, `buttonTextColor` on a child node are a deliberate treatment someone
chose. Never clear or overwrite them, and do not strip them when you duplicate a donor. Name
the sections that carry them in your report. If the user explicitly asks you to set dark mode
on a section, write the keys and tell them to verify in the plugin's dark mode preview.

## Writing the content

Write like a person, not a template. Front-load the value in the first section, keep one
primary CTA, make everything scannable. For sequences, each email must escalate or advance
the story; if two emails in one recipient's path repeat the same theme, rewrite the later
one. Match the brand voice from existing copy in the file, informed by any Step 2
inspiration. Never use em dashes. Never invent statistics; flag any placeholder figures
clearly.

## Verify before you present

Screenshot every email and inspect it: no clipped text, no overlapping elements, spacing
consistent with the file's real campaigns. Then check structure:

- Root frame is a duplicated Email Love frame, or carries `nodeType = mainFrame` plus the eight
  theme keys, which is the nine of "Root frame" less the marker itself. It is an email, so the
  marker belongs there; the only nodes that must NOT carry it are any reusable modules you split
  out in A5 or B6.
- **Path A:** every section is a component instance (raw footer excepted), including
  inherited ones. No detached instances. No hand-built frames survived the donor vetting. No
  instance internals were restructured.
- **The library is as you found it, on Path A:** the page list has the same pages in the same
  order with the same names, no text style or variable was edited or repointed, and the email sits
  on the page the file's own structure puts it on (A1). Read the page names back rather than
  recalling them.
- **Path B:** the R9 post-build checklist in
  [render-components-validation.md](render-components-validation.md) passes: every node tagged, every leaf a
  complete pair, every `mj-button` with a direct TEXT child, both alignment axes equal on
  every auto-layout frame (except the deliberate multi-column top-align case: primary MIN with
  counter on the content's horizontal alignment), all nodes visible, and column widths summing to the email's one
  content width rather than to the side margin the worker returned per screenshot (R0.3.1). Plus
  the five B5 repairs done, and any tag the spec does not map rebuilt from mapped primitives
  per B4. If the source had an overlapping or bleeding photo, that band is a two column row
  per R3.4.1, not a flattened image and not an attempted overlap.
- **Sizing, on both paths, for every frame you created:** vertical HUG everywhere, no fixed
  height except an `mj-spacer`, no FIXED width outside the load-bearing cases, every pinned
  width that carries text given slack (R3.3.1), all spacing expressed as padding, and every
  button's width chosen for how it should behave on mobile (R0).
- **Scale, on Path B:** the root is at the email width from B1, and type sizes, paddings, and
  image dimensions are at email scale rather than the source design's scale (R0.6). A frame
  built at source scale passes every other check in this list.
- **Path B naming and components:** every node carries the display name for its tag and a
  real tag in plugin data, with no friendly string in the plugin data key. Anything built for
  reuse is an `mj-wrapper` COMPONENT with **no `nodeType` key**, named for the module rather
  than the wrapper display string, a direct child of its page, with every property binding
  re-read and confirmed.
- Every `mj-raw` frame contains its text child. Dark mode overrides intact. Exactly one
  visible CTA button per email unless the user asked otherwise.
- Footer preference wording is explicitly linked and no non-Klaviyo export relies on
  `manage-preferences.com` being rewritten.

Fix what fails before presenting. Then report: what you built, which path and why, which
components you chose or what the converter returned and what you repaired, what you assumed,
which inspiration emails informed the work, and everything left as a placeholder.

## Hand off

1. Review the emails in Figma and comment or edit like any design work.
2. Select a finished frame, open the Email Love plugin, and set subject line and preheader in
   the settings panel. Propose copy for both: subject under 45 characters, preheader that
   extends it rather than repeating it.
3. Export through the plugin to their ESP. Building on the canvas is free; exports count
   against the Free plan (5 per month, unlimited on paid plans).

If the plugin says "Please select valid email template" on a frame you built, the root frame
is missing its marker (see "Root frame") or the plugin version predates shared-marker
support: ask the user to update the plugin.
