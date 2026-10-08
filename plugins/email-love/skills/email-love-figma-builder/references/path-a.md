# PATH A: the customer has an Email Love design system

## Contents

- A1: Inventory the library
- A2: Choose components
- A3: Duplicate and vet a donor root
- A4: Assemble by instancing
- A5: Handle a confirmed component gap

Instance-only discipline. The components are the ground truth; your job is selection, copy,
and imagery.

## A1: Inventory the library properly

A shallow inventory produces every email as a re-skin of one existing campaign. A real one
produces emails whose sections fit their content.

1. **Enumerate the components.** From `list_components` if the Email Love MCP is connected
   (it returns them grouped by the customer's own categories, which are the names you should
   reuse everywhere), otherwise by listing every page in the file and searching each for
   COMPONENT and COMPONENT_SET nodes, one call per page. Email Love design systems usually
   keep the library on dedicated pages (Heroes, Cards, Lists, Copy Blocks, Data, Footer)
   separate from the campaigns page.
2. **Read the file's structure, and leave it as you found it.** A library built through Email
   Love's migration route carries a prescribed page frame, and recognizing it saves you a lot of
   searching:

   ```
   Cover
   Getting Started
   --- Foundations
   Foundations
   Type
   Buttons
   --- Components
   one page per component category, in the customer's own category names
   --- Templates
   Campaigns
   ```

   The `---` pages are dividers standing in for the page folders Figma does not have, so they are
   empty on purpose. A file shaped like that is telling you where everything lives: the color and
   spacing tokens on Foundations, the type ramp on Type, the button components on Buttons, the
   modules on the category pages, and finished emails on Campaigns beside the existing ones, which
   is where this build belongs. **Read Cover and Getting Started when they exist.** Cover states
   the email width the system is built at, and that is the width your root frame has to match.
   Getting Started states the file's own conventions, which outrank any habit of yours.

   **Respect the structure you find rather than imposing one.** Do not rename a page, do not
   reorder the page list, do not add a Cover or a divider that is not there, and do not open a new
   page for this build when the file already has the page this work belongs on. Plenty of libraries
   look nothing like the frame above, because they were built by hand or built before it existed.
   That is not a defect for you to fix mid-build: reshaping someone's library while they asked for
   one email is a change they did not ask for. Say in one line what shape you found, put your work
   where that shape puts it, and if the file genuinely has nowhere for a finished email, ask before
   creating a page.
3. **Use the tokens the file already has.** Where the library carries Figma variables, a semantic
   set (names like `color/bg/page`, `color/text/primary`, `spacing/md`) usually sits on top of a
   primitive set named by value. For anything you create outside an instance, the root frame fill
   above all, bind to the SEMANTIC variable rather than typing a hex: that is how the file was
   built, and it is what keeps a later brand-color change to one edit. Never repoint or rename a
   token, and never bind to a primitive directly. Instances are already bound, so leave them
   alone. Two things a variable cannot reach: the root frame's eight theme keys, which are shared
   plugin data strings and carry literal hex (R2.1), and `fontSize` or `lineHeight`, which are not
   bindable, so type comes from the file's text styles instead. Where there are no variables, take
   the values from the palette as usual.
4. **Study 2 or 3 of their past emails.** Screenshot and read the frames the user named as
   their best, or the most recent. Learn voice, copy length, section rhythm, imagery habits,
   and footer conventions, including whether the footer uses an `mj-raw` token block. These
   are also your donor candidates for the root frame.
5. **Report the palette** to the user in one compact list.

## A2: Ask who picks the components

Every build, unless the Step 1 questions already answered it or the brief already dictates
the exact sections (then confirm that list in one line). If they defer, pick by content fit
and say what you chose and why.

Codex runs in a terminal, so the strongest picker available to you is the canvas itself:

- **Pick in Figma (preferred here).** Lay out a temporary top-level frame named
  "Component menu, delete me" beside the build area, containing labeled instances of the 3 or
  4 candidates for the current section. Ask the user to click their choice in Figma and say
  "picked". Read `figma.currentPage.selection`, confirm what you saw by name, and move to the
  next section. Delete the menu frame when the picking is done. The user judges components at
  full size and never squints at a thumbnail.
- **Numbered list fallback.** If the user would rather not switch to Figma, list candidates
  per section with a one-line note on fit and your recommendation tagged, and let them answer
  with numbers. You can also save `get_screenshot` output to local files and tell the user
  the paths so they can open them.

Compose with a clear split: past emails teach voice and polish, the palette plus the content
decides structure. Statistics want a stats card, steps want a list component, social proof
wants a testimonial card, a single announcement wants a hero plus copy block. If your section
stack is identical to an existing campaign's, you matched the donor rather than the content.

## A3: Root frame from a donor, then vet what you inherited

**Duplicate an existing Email Love email frame.** That gives you a root carrying every plugin
setting (marker, theme colors, subject and preheader slots). The donor's value is its root
settings, not its body:

- Keep inherited sections only if they are component instances (or a raw footer block).
- **A hand-built section inside the donor** (a plain frame that is not an instance) is
  invisible to the exporter and must be replaced with a library instance or removed. This is
  the most common way an inherited email silently loses content.
- Delete inherited sections you do not need and instantiate fresh ones from the palette.

If no donor exists in the file, build the root per
[shared-rules.md](shared-rules.md#root-frame) and append the instances straight into it, in
order. Never wrap an instance in a frame of your own: an untagged frame between the root and
an instance flattens everything below it into one image.

## A4: Assemble by instancing

The complete list of edits you may make to an instance:

- **Text content.** Load the node's current fonts, await, then mutate. Read the fonts off the
  node rather than assuming. Skipping the font load is the most common build failure.
- **Image fills** on the component's image blocks, at their existing dimensions, 2x
  resolution, watching crop and focal point. The plugin picks up image fills at export and
  handles hosting. If a geometry write inside the instance is ever unavoidable (an image band
  whose height has to match a photo's aspect), R0.8 is the rule you need: `resize()` on a node
  nested inside an instance silently does nothing, no error and the value unchanged on
  read-back, so FILL the descendant chain and resize the INSTANCE, and read every geometry
  write back.
- **Component properties**: toggle booleans to hide optional regions, swap instance-swap
  slots, set text properties. Because the plugin exports what is visible, a boolean that
  hides a region genuinely removes it from the sent email.
- **Plugin data**: `href`, `altText`, and mobile style keys, per
  [shared-rules.md](shared-rules.md).

Everything else is forbidden: **never detach**, never add, delete, or reparent layers inside
an instance, never retag anything inside it, never change its internal auto-layout, never
apply a fill to a structural frame inside it. Detaching severs the structure the exporter
reads, and restructuring internals reintroduces exactly the hand-authoring this workflow
forbids.

**Naming inside an instance is not your problem, so leave it alone.** A component the plugin
built carries the plugin's own naming on every node, the MJML tag in plugin data and the
friendly display name on the layer, and an instance surfaces the main component's plugin
data. Do not rename layers inside an instance to "clarify" them, and do not write plugin data
onto instance internals. The R6 naming rules in
[render-components-validation.md](render-components-validation.md) are for nodes you create,
and on Path A the only node you create is the root. If a component's internals look wrong,
that is a design-system fix in the source component, not something to patch per instance.

Also: **one visible CTA button per email** unless the user asks otherwise (hide competing
buttons via component properties); **leave final CTA URLs to the plugin** unless the user
gave you real URLs; **placeholder missing imagery** as flat gray fills at the existing
dimensions and say so in the report; **lay multiple emails side by side**, each in its own
frame, so the team can review a sequence at a glance.

## A5: When no component fits, stop

In order:

1. Reconsider. Most "no component fits" moments are a copy problem, not a component problem.
   Fit the content to the closest component and check with the user.
2. Ask the user directly, showing what you have and what the section needs. They often know a
   component you did not find, on a page you did not check.
3. Only if they confirm nothing exists: build that one section through **Path B** (generate
   and transcribe, not freehand), then offer to save it into their design system so it exists
   next time (see B6). A gap-fill section is a design-system asset by definition, which means
   it is a **module**, not a tiny email: build it as an `mj-wrapper` COMPONENT with **no**
   `nodeType = 'mainFrame'` marker, friendly layer names inside, the module name on the
   component itself, and properties for the parts that will change (R2.2 in
   [render-geometry.md](render-geometry.md)). It should be indistinguishable from the
   components around it.

Never assemble the section by hand, and never flatten it to an image to make the problem go
away. An image in place of a section is a decision for the customer to make, not for you.
