---
name: visual-truth
description: Add and operate the Visual Truth development editor in compatible React websites and web apps. Use when the user asks to visually select, drag, resize, reposition, restyle, or edit live page elements; wants a Duda, Squarespace, Elementor, or general WYSIWYG workflow in Codex; wants exact desktop, iPad, and phone previews; or supplies a Visual Truth change brief that must be translated into durable source code.
---

# Visual Truth

Use the bundled development-only editor to let the user establish visual truth with the mouse, then translate the captured values into maintainable source code.

## Install

1. Inspect the project before editing. Confirm it is a local React web project and identify its package manager, app entry, styling system, and development guard pattern.
2. Run the plugin installer with the project root:

```bash
node <plugin-root>/skills/visual-truth/scripts/install-visual-truth.mjs <project-root>
```

For conventional Vite projects, the installer also configures the local-only Make It Code bridge and generated patch runtime. Preserve those imports; the Vite plugin runs only during local development, while the generated patch module contains the durable visual result.

After a successful installation, the installer makes one best-effort anonymous request containing only the event type and Visual Truth version. It does not transmit project names, paths, source code, page content, accounts, cookies, device identifiers, or editor activity, and analytics failure never fails or rolls back installation. Set `VISUAL_TRUTH_ANALYTICS=0` before running the installer when the user opts out.

3. Create a development-only module for the component and its stylesheet:

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

Keep Visual Truth in this dedicated host rather than rendering it inside the application's root. While mounted, the component promotes the host into the browser top layer and uses a maximum-z-index fallback when the Popover API is unavailable, so host-site stacking contexts cannot cover the editor or launcher.

Load that module only inside Vite's development branch:

```tsx
if (import.meta.env.DEV) {
  void import('./visual-truth.dev').then(({ mountVisualTruth }) => mountVisualTruth())
}
```

For Next.js, use a client component that is dynamically imported with server-side rendering disabled and gated by `process.env.NODE_ENV !== 'production'`. Preserve the project's existing architecture. Never statically import the editor or its stylesheet from a production application path.

4. Start the existing local development server and open the app in the Codex in-app browser. Do not use the user's personal Chrome session.

## Operate

- Choose the persistent **Workspace** preset that matches the user's preferred editor: Duda adds a familiar left tool rail, Squarespace uses a restrained canvas-first light workspace, and Elementor places Design on the left with Structure/Layers on the right. All three presets keep the same Visual Truth selection, history, responsive scope, and Make It Code behavior.
- Right-click the top toolbar or Duda tool rail to open **Toolbar display**. Turn **Show icon labels** on to place readable names below the toolbar icons, or leave the toolbar compact and use **Use hover hints** for rollover descriptions. Both choices persist across reloads. Labels appear at desktop and iPad-landscape widths; iPad portrait and phone stay compact so every primary action remains on-screen without horizontal toolbar scrolling.
- Work in the attached editing shell: the live site is contained in the center canvas, contextual controls remain docked around it, tools are at the top, and status remains attached where the selected preset uses it.
- Use the labeled **Layers** and **Design** controls in the top toolbar to hide either dock independently. Press Tab from the website canvas to hide or restore both side docks while preserving their exact prior combination. Press Shift+Tab from the canvas to hide or restore all editor chrome. Tab remains normal keyboard navigation while an editor control or form field has focus.
- Hover to preview a named DOM target, then select it from the page or Layers panel.
- Use automatic Layers for ordinary page markup or persistent Detailed Layers for nested containers and decorative graphics. Filter the tree to All elements, Text, Media, Layout, or Controls and use the visible/total count to judge the result. Collapse or expand individual hierarchy branches with the chevron or Left/Right arrow keys, use the branch-wide control to collapse or expand the complete tree, and use Focus Selection to show only the selected element's hierarchy. Branch, detail, and type-filter preferences persist separately for each route; search stays inside the selected type while still finding matches inside collapsed branches.
- After selecting an element, drag anywhere inside it or use the blue move handle to reposition it from its current offset with optional magnetic alignment guides. A short intent threshold preserves normal clicks and double-click text editing. Hold Shift while dragging to lock movement to the dominant horizontal or vertical axis, or hold Option/Alt to temporarily bypass snapping without changing its saved setting. Toggle the alignment grid, use exact X/Y and nudge controls, or align to parent edges and centers in one click.
- Watch the selected element's bottom measurement badge while moving, resizing, changing font size, adjusting spacing, or styling. It becomes a live HUD that reports accumulated X/Y offsets, exact resulting width/height, width/height deltas, exact font size and delta, exact margin/padding/gap values, exact appearance values, prior colors or shadows, signed numeric differences, and active axis-lock, snap-bypass, or ratio-lock state. Quick Adjust, keyboard nudges, Type, Spacing, and Style panels, inspector controls, and inline text editing keep the final readout visible briefly before returning to absolute page measurements.
- Use the on-canvas Quick Adjust bar for mouse-driven 1px, 5px, or 10px movement, 5% shrink/grow, and 1px text-size changes without leaving the selected element.
- After making a visual edit, use the Send to Codex icon at the end of Quick Adjust for a one-click handoff without opening Changes. It uses the same complete responsive brief and host event as the Changes panel.
- Open Quick Adjust Position & Align for exact X/Y offsets, 1/5/10px steppers, reset position, and parent-edge or parent-center alignment.
- Open Quick Adjust Type on text elements for exact font family, font size, line height, tracking, weight, and alignment. Font-size steps use the selected 1/5/10px amount.
- Open Quick Adjust Size for exact width and height, 1/5/10px dimension steps, aspect-ratio locking, and fill-parent width. Ratio-locked and fill-parent changes remain grouped into one Undo action.
- Open Quick Adjust spacing to change top, right, bottom, and left margins or padding with the active movement step. Flex and grid containers also expose their gap directly on the canvas, and every adjustment reports the exact resulting value and signed difference in the live HUD.
- Open Quick Adjust Style to choose text, fill, and border colors; clear a fill; adjust border radius, border width, and opacity; or apply none, small, medium, and large shadow presets. Radius and border controls use the active 1px, 5px, or 10px step. Every appearance edit reports its exact resulting value; numeric edits include a signed difference, while colors and shadows identify the previous appearance.
- Size, Spacing, and Style each expose the 1/5/10px step selector inside the open panel.
- Resize with handles or exact width and height controls. On selected text, use the floating **Text + box / Box only** switch directly above the selection. **Text + box** grows or shrinks the box and font together while keeping text contained; **Box only** changes the box while keeping the font size fixed, automatically grows the height when reflow needs it, and will not shrink narrower than the longest word. The inspector exposes the same synchronized preference, and the choice persists across reloads. Lock the aspect ratio for logos, photos, and fixed-shape cards.
- Edit text directly on the page. Use the floating toolbar for size, family, weight, style, decoration, color, alignment, and text presets.
- Right-click for edit, copy/paste appearance, full element copy/paste, layer order, hide, and reset actions.
- Shift-click multiple elements, then drag them together, align edges or centers, distribute spacing, and group or ungroup them from the canvas toolbar or Studio.
- Open Studio for collapsible Lightroom-style advanced controls. Grid and magnetic snapping can be enabled independently at exact 4px, 8px, 12px, or 16px increments. Show persistent X/Y canvas rulers in pixels or inches; the rulers follow canvas scrolling, reserve their own gutters, and can also switch units from the upper-left corner button. Drag from the top or side ruler onto the canvas to place persistent Affinity-style guides. Elements snap magnetically to those guides; drag a guide again to move it, use arrow keys for 1px or Shift+arrow for 10px movement, press Delete or double-click to remove one, or right-click the ruler corner to clear all guides.
- Use Responsive truth in Studio to see every explicit Desktop, iPad, or Phone property and reset one override without disturbing other device values.
- Save a selected hero, section, or card as a fully styled reusable section. Copy its structured payload to the clipboard to import it into another Visual Truth project.
- Capture named styles from a selection, apply them elsewhere, and update all linked elements from one edited source.
- Turn a selected card into a repeater, paste or edit a JSON array, visually bind descendants to text, image, link, or background fields, and render the complete undoable card set.
- Use Make It Code to write the current style, responsive, text, attribute, insertion, removal, and reorder history to `src/visual-truth.generated.ts`. Review it as ordinary source code; do not describe this as a website deployment.
- Open Add to search for headings, text, linked buttons, images, cards, dividers, spacers, lists, sections, and responsive column layouts.
- Use Structure controls or the context menu to duplicate, remove, lock, hide, or move elements. Drag Layers before, after, or inside compatible containers, or use Parent to reparent precisely. These actions participate in undo, redo, reload restoration, and the Codex brief.
- Use the nearby-element controls to select the parent, first child, or adjacent sibling when nested page elements are difficult to click directly.
- For containers, adjust block, flex, or grid display, flow, alignment, gap, and responsive column presets.
- For links and media, edit destinations, same-tab or new-tab behavior, source URLs, image alt text, fit, nine-point visual focus, CSS hero backgrounds, or replace an image from the local computer. Images may also be dropped or pasted directly onto a canvas image or container.
- Use Show on devices to keep an element visible or hidden independently on Desktop, iPad, and Phone.
- Collapse any Design inspector section by clicking its heading, Lightroom-style. Use Customize inspector sections beside the Design and Changes tabs to hide panels, show them again, reorder them, enable Solo mode so opening one closes the previous panel, or collapse/expand the complete stack. Panel visibility, order, Solo mode, and open/closed choices persist locally across reloads.
- On desktop, drag the inspector's left-edge handle to resize it from 240px to 420px. The width persists locally; double-click the handle to reset to 260px. The handle is removed in the compact phone layout.
- Drag the Layers panel's right-edge handle from 180px to 360px when long component names or deep structures need more room. Its width persists and double-click resets it to 220px; the persistent **Layers** toolbar control remains the hide/show action.
- Use Apply to so size, position, spacing, typography, layout, and appearance edits target All devices, Desktop only, iPad only, or Phone only. Device badges count overrides; Reset current-device edits leaves other devices intact.
- Expect original rotate, skew, and animation transforms to remain intact when moving elements; Visual Truth uses a separate translate offset.
- Expect the route-specific edit history, undo stack, and note to restore after a browser reload.
- In Changes, save a visual version before experimenting. Restoring a version reverses the current temporary DOM history and reapplies that complete saved state.
- Revert an individual row in Changes when one captured property should be removed without resetting the whole element or timeline.
- Common shortcuts include Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+C, Cmd/Ctrl+V, Cmd/Ctrl+D, Delete, Enter, arrow keys, and Shift+arrow keys.
- Review Desktop 1440x900, iPad 1024x1366, Phone 440x956, or all devices together.
- Expect all preview frames to reproduce the current temporary change history, highlight the selected element, and report its exact device-specific X/Y/width/height, including inserted and reordered elements.
- Expect one Undo for a multi-property gesture and one Undo for a rapid continuous slider or nudge sequence.
- Expect a rapid adjustment that returns to its exact original value to disappear from Changes instead of leaving a no-op history row.
- Use Changes to add a plain-language note and choose Send to Codex. After responsive review, the brief includes the selected element's exact Desktop, iPad, and Phone measurements. The button always emits `visual-truth:send-to-codex` for host integrations and also copies the brief when the browser grants clipboard access.

## Make Changes Real

When the user supplies a captured brief, treat its viewport, selector, rendered value, and note as visual ground truth.

1. Locate the owning source component and style rather than preserving temporary inline DOM edits.
2. Implement the smallest responsive source change that reproduces the result.
3. Preserve unrelated behavior and existing design conventions.
4. Verify the exact recorded viewport, then check the other Visual Truth device sizes.
5. Report what became durable source code. Do not call this website publishing unless the user separately asks to deploy.

When the Vite source bridge is installed, Make It Code already creates durable generated source. Codex may subsequently fold that generated module into the owning components and styles when maintainability or project conventions call for it.

## Safety

- Keep Visual Truth local and development-only.
- Do not deploy or publish merely because the user chose Send to Codex.
- Before any requested deployment, inspect all current worktree changes and state exactly what will ship.
- Reset temporary visual edits before comparing source changes when stale DOM state could distort verification.
