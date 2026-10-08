# Visual Truth

Visual Truth is a development-only visual editing overlay for React websites and web apps. It lets you select real DOM elements on the live page, drag them, resize them with handles, edit exact visual properties, undo changes, and turn the approved result into reviewable source code with Codex.

Visual Truth 1.3.0 adds persistent Duda, Squarespace, and Elementor workspaces, a direct **Text + box / Box only** handle switch, 1/5/10px precision controls, clear Layers and Design panel controls, direct drag-to-move, and opt-in privacy-first product feedback while keeping the editor above host-site stacking contexts. The editor is designed for local development and must never be mounted in a production render path.

See [CHANGELOG.md](./CHANGELOG.md) for the current release record.

## Run the demo

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Click any page element while the overlay is open. Drag anywhere inside the selected element (or use its blue move handle), resize from any handle, or edit values in the inspector.

## Intended project workflow

1. Add Visual Truth as a local development dependency and import its component and stylesheet only during development. A small **Visual Truth** launcher then appears automatically in the local app.
2. Open the real local app and make the visual adjustment with the mouse.
3. Open **Studio** and choose **Make It Code** to write the complete visual change set into the project's generated, reviewable source module.
4. Keep refining visually or ask Codex to translate the generated patch module into the owning components and styles.

The overlay changes the live DOM immediately for visual truth. The local-only Vite bridge can then make those exact edits durable without a copy/paste handoff. The editor overlay must never be included in production builds; the small generated patch module is ordinary source code and may be reviewed, committed, or later folded into the owning components.

After a successful project installation, Visual Truth makes one best-effort request that contains only the event type and Visual Truth version. It does not transmit project names, paths, source code, page content, accounts, cookies, device identifiers, or editor activity. Set `VISUAL_TRUTH_ANALYTICS=0` when running the installer to disable this anonymous installation event.

**Send feedback** is always available through Toolbar & help, Duda Settings, and command search. A small prompt may appear only after the third distinct editing session; it can be postponed or disabled permanently. The editor sends nothing when the prompt appears. Only the rating, comments, optional reply email, version, and form source deliberately submitted on the feedback page are stored—never an automatic copy of project names, source code, page content, screenshots, device details, identity, or editor activity.

## Install in another local React app

Build the reusable package once:

```bash
npm run build:lib
npm run validate:package
```

Add this folder to the target project as a development dependency. Put the editor in a development-only module:

```tsx
// src/visual-truth.dev.tsx
import { createRoot } from 'react-dom/client'
import { VisualTruth } from 'visual-truth'
import 'visual-truth/style.css'

export function mountVisualTruth() {
  const host = document.createElement('div')
  host.dataset.visualTruthHost = ''
  document.body.append(host)
  createRoot(host).render(<VisualTruth />)
}
```

The component promotes this dedicated host into the browser top layer while Visual Truth is mounted, with a maximum-z-index fallback for browsers that do not support the Popover API. Keep the editor in its own host instead of rendering it inside the application root.

Load that module only inside Vite's development branch:

```tsx
if (import.meta.env.DEV) {
  void import('./visual-truth.dev').then(({ mountVisualTruth }) => mountVisualTruth())
}
```

Codex can perform this installation for each project. Do not statically import the editor or its stylesheet from the production application path. The generated patch runtime is ordinary application source and remains separate from the editor overlay.

Once installed, no command is needed during normal use. Open the local website, click **Visual Truth**, make the change with the mouse, add an optional note in **Changes**, and choose **Send to Codex**.

## Compatibility

- Node.js 20.19 or newer
- React 18.2 or React 19
- Vite 5.4 through Vite 8 for automatic Make It Code bridge setup
- npm, pnpm, Yarn, or Bun

The Codex plugin installer recognizes conventional Vite entry files and configuration files. Other React frameworks can mount the development overlay manually, but the installer will stop before rewriting an unsupported configuration.

## Privacy and production safety

Visual Truth operates against the local page in the user's browser. It stores editor preferences and temporary visual history locally and writes generated source only when the user invokes **Make It Code**. The overlay is development-only and is not intended to be bundled into a production application.

See [Privacy](./PRIVACY.md), [Terms](./TERMS.md), and [Security](./SECURITY.md).

## Support

Visual Truth is created by Derek Hanchi and published by Ultimate Design Studios.

- Website: https://visual-truth-editor.deriquehanche.chatgpt.site
- Support: https://visual-truth-editor.deriquehanche.chatgpt.site/support
- Email: info@ultimatedesignstudios.com

## Current scope

- Switch the complete editing workspace between familiar Duda, Squarespace, and Elementor arrangements without losing Visual Truth selection, history, responsive scope, or source-handoff behavior.
- Start in **Easy Mode** with only Add, Select & edit, Undo/Redo, device preview, site checks, and one **Apply changes** action; switch to the complete existing workspace with the Easy/Advanced control.
- Use the floating **Text + box / Box only** switch while text is selected: scale the font and box together with contained text, or resize only the box while the font size stays fixed. The same preference appears in the inspector and persists across reloads.
- Change type size from the on-canvas A−, exact numeric size, and A+ controls or from the contextual text inspector.
- See a five-control contextual inspector specialized for text, images, or layout containers, including image replacement, crop/fit, focal position, spacing, and appearance.
- Add from visual element tiles, recently used elements, and saved sections; choose or drag to the visible Add above, Add inside, and Add below canvas zones.
- Review grouped plain-English changes with compact before/after previews, revert or exclude individual edits, save a version, and apply only the selected changes to local source.
- Follow a three-step first-use guide, search actions with Cmd/Ctrl + K, reuse project colors/type/radii, and check alt text, heading order, contrast, link labels, tap targets, and focus behavior.
- Keep Easy Layers focused on the selected section and its neighbors, use semantic names instead of concatenated page copy, and move safely through the clickable Page › Section › Element breadcrumb.
- Set gap, radius, padding, opacity, width, and other common values with paired sliders and exact number fields; use arrow keys for fine adjustment or reset an individual value.
- Zoom from 25% to 200%, return to 100%, fit the page or selection, pan the canvas, jump through a compact page minimap, and isolate a section by double-clicking it.
- Drag padding, container gap, grid-column division, and alignment handles directly on the canvas while exact values remain visible in the inspector.
- Turn a selected card, button, header, or section into a reusable visual component, insert additional instances, and update shared design while preserving instance-specific copy, links, images, and alt text.
- Group edits into named change sessions, enable or disable a complete session, and hold **Compare original** for an immediate before/after check.
- Enter dedicated **Content** mode to replace copy, links, button labels, images, and alt text without exposing layout controls.
- Use contextual smart actions to match sibling spacing, distribute children, make a selection responsive, apply project typography, or repair contrast.
- Select real elements on the page
- Shift-click multiple elements, drag them as a set, align their edges or centers, distribute spacing, and create persistent visual groups
- Use a visible 4px, 8px, 12px, or 16px grid with independent grid snapping and magnetic edge/center guides
- Read persistent X and Y canvas rulers in pixels or inches; ruler numbers follow the canvas while it scrolls
- Drag from the top or side ruler onto the canvas to place persistent Affinity-style guides; elements magnetically snap to them, active guides show exact coordinate badges, and Studio provides precise numeric positions, units, individual deletion, and Clear all
- Preview the element under the mouse with a named hover outline before selecting it
- After selecting an element, drag anywhere inside it or use the blue move handle to reposition from its current offset; hold Shift to lock movement to one axis, or hold Option/Alt to temporarily bypass magnetic snapping
- Read the live on-canvas HUD while moving, resizing, changing type size, adjusting spacing, or styling: accumulated X/Y offsets, exact resulting dimensions, width/height differences, exact font size and delta, exact margin/padding/gap values, exact appearance values, previous colors and shadows, signed numeric differences, axis lock, snap bypass, and ratio-lock state
- Use the on-canvas Quick Adjust bar for 1px, 5px, or 10px directional movement without leaving the selected object
- Open the on-canvas Position & Align panel for exact X/Y offsets, reset position, and one-click parent-edge or parent-center alignment
- Shrink or grow the selected object by 5%, and decrease or increase selected text by 1px, directly from Quick Adjust
- Send the current visual brief directly to Codex from Quick Adjust after making a change
- Open the on-canvas Type panel for exact font size, family, line height, tracking, weight, and alignment
- Open the on-canvas Size panel for exact width and height, 1px, 5px, or 10px resize steps, aspect-ratio locking, and fill-parent width
- Open the on-canvas Spacing panel for independent margin and padding on every side, plus gap controls on flex and grid containers
- Open the on-canvas Style panel for text, fill, and border colors; border width and radius; opacity; and four shadow presets
- Choose the 1px, 5px, or 10px adjustment step directly inside the Size, Spacing, and Style panels
- Toggle a precise alignment grid and magnetic snapping independently
- Show or hide the canvas rulers, switch their units in Studio, or click the rulers' corner unit button
- Enter exact X/Y offsets or nudge with 1px, 5px, and 10px movement controls
- Use arrow keys for 1px movement and Shift + arrow keys for 10px movement
- See the same live accumulated offset after Quick Adjust or keyboard nudges, exact size feedback after step-based or 5% scaling controls, exact font-size feedback from Quick Adjust, Type, inspector, or inline text controls, and exact spacing and appearance feedback from Quick Adjust or inspector fields
- Resize using eight handles
- Edit page text directly in place with a floating formatting toolbar
- Right-click elements to edit or rename, copy/paste style, copy/paste complete elements, save reusable sections, group, lock, reorder, hide, reset, remove, or Make It Code
- Search and add headings, text, linked buttons, images, cards, dividers, spacers, lists, sections, and responsive columns
- Duplicate, remove, reorder, or move elements into another parent container with structural undo, redo, and reload restoration
- Drag Layers before, after, or inside another compatible container, or choose an exact Parent container in the inspector
- Decrease or increase selected elements by 10%, or fill the parent width
- Edit width, height, margin, padding, type size, alignment, colors, radius, and opacity
- Adjust font size and line height with direct sliders and step buttons
- Control fit and all nine focal positions for image, video, and CSS background elements with a visual 3x3 focus grid
- Replace images from the computer, drop or paste images directly onto the canvas, change media URLs, and edit image alt text
- Edit link destinations and same-tab/new-tab behavior directly in the inspector
- Change container display, flex flow, alignment, gap, and responsive grid columns
- Collapse individual inspector sections, hide panels from a customization menu, and preserve that personal workspace across reloads
- Enable inspector Solo mode to keep only one panel open, and reorder panels with accessible move controls; both choices persist across reloads
- Drag the inspector's left edge from 240px to 420px, preserve the chosen width across reloads, or double-click the handle to restore the 260px default
- Resize Layers from 180px to 360px for long names and deep structures; its toggle follows the edge, the width persists, and double-click restores 220px
- Collapse or expand individual Layers branches with the mouse or Left/Right arrow keys, collapse or expand the complete tree in one click, and preserve branch choices separately for each route
- Focus Layers on the selected element's hierarchy, while search continues to find matching elements inside collapsed branches
- Filter Layers to All elements, Text, Media, Layout, or Controls, see the visible/total row count, and preserve the chosen type separately for each route
- Edit CSS background images on hero sections and containers, including local replacement, fit, repeat, and focal position
- Select a parent, child, previous sibling, or next sibling without hunting on the page
- Search ordinary page elements automatically or enable persistent Detailed Layers for nested divs, spans, logos, and graphics
- Lock elements against canvas selection and manipulation, or hide and recover them through persistent Layers indicators
- Drag with magnetic sibling and parent alignment guides, hold Shift for horizontal or vertical movement, hold Option/Alt to temporarily ignore snapping, or align left, center, right, top, middle, and bottom in one click
- Preserve the site’s existing transform effects by recording movement as a separate translate offset
- Lock aspect ratio for handle-based and exact width/height resizing
- Show or hide individual elements on Desktop, iPad, or Phone
- Scope style edits independently to All devices, Desktop, iPad, or Phone and preserve every value in the Codex brief
- See exact per-device override properties, distinguish source inheritance from explicit overrides, and reset individual properties or the selected element's current-device edits
- Preview Desktop at 1440×900, iPad at 1024×1366, and Phone at 440×956
- Open a Duda-style combined preview with all three exact live CSS viewports at once
- Highlight and report the selected element's exact X, Y, width, and height independently in every responsive preview
- Keep temporary visual and structural edits synchronized into every responsive preview frame
- Browse labelled DOM layers
- Undo, redo, reset one element, or clear all changes; multi-property gestures reverse as one action and continuous slider/nudge edits are coalesced
- Automatically remove a coalesced change when a quick adjustment returns to its exact original value
- Revert any individual captured edit without discarding later work
- Restore the complete route-specific edit session, note, and undo timeline after a reload
- Save custom-named visual versions and restore a known-good multi-edit state in one click
- Save fully styled reusable sections, copy them between projects through the clipboard, and insert them with collision-free element identities
- Capture global named styles, apply them to many elements, and update every linked element from one selected source
- Turn a selected card into a data repeater, bind text, image, link, or background fields, edit JSON rows, and render the complete repeated set as undoable structural changes
- Open the Lightroom-style Studio panel and collapse advanced tool groups independently
- Work inside one attached Lightroom-style shell: website canvas in the center, toolbar at the top, Layers/Add on the left, Studio/Design on the right, and status along the bottom
- Use the clearly labeled **Layers** and **Design** controls in the top toolbar to hide either dock independently, press Tab from the website canvas to hide or restore both docks, or press Shift+Tab to hide or restore all editor chrome
- Use the automatic local Make It Code bridge to write style, responsive, text, attribute, insert, remove, and reorder changes into `src/visual-truth.generated.ts`
- Use `Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z`, `Cmd/Ctrl + C`, `Cmd/Ctrl + V`, `Cmd/Ctrl + D`, Delete, and Enter for common editor actions
- Send a viewport-aware implementation brief to Codex through the clipboard and integration event
- Include the selected element's exact Desktop, iPad, and Phone measurements in the Codex brief after responsive review
- Toggle with `Cmd/Ctrl + Shift + V`
- Open **Send feedback** from Toolbar & help, Duda Settings, or command search; postpone or permanently dismiss the delayed prompt without sending any project data

The reusable package is bundled with the Visual Truth Codex plugin for one-command local installation. A future framework adapter can add source-location metadata for more automated component patching.
