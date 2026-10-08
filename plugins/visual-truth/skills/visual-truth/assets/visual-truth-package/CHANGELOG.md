# Changelog

## 1.3.0 - 2026-07-21

- Added an always-available privacy-first **Send feedback** action to Toolbar & help, Duda Settings, and command search, plus a dismissible prompt that waits until the third distinct editing session.
- Added no automatic feedback payload: only the rating, comments, optional reply email, version, and form source deliberately submitted on the public feedback page are sent.
- Added persistent Duda, Squarespace, and Elementor workspace presets with familiar panel placement, visual language, primary actions, and functional tool mappings over the same Visual Truth editing engine.
- Added a direct **Text + box / Box only** switch to both Easy and Advanced floating text toolbars and kept it synchronized with the inspector preference across reloads.
- Changed all precision adjustment selectors from 1/4/8px to 1/5/10px; arrow keys still move by 1px and Shift+arrow now moves by 10px.
- Kept workspace chrome and floating controls within desktop, iPad portrait, iPad landscape, and phone bounds, including full-width bottom-docked controls on narrow Elementor layouts.
- Replaced the easy-to-miss floating side-dock arrows with persistent **Layers** and **Design** controls in the top toolbar; each dock can be toggled independently and Tab restores the exact prior combination.
- Renamed the far-right X action to **Close Visual Truth** and made the bottom-left launcher reliably clickable when restoring the editor.
- Kept **Close Visual Truth** fully inside the viewport in labeled 1373 px toolbars by collapsing lower-priority alignment shortcuts before the fixed endcap.
- Added direct drag-to-move from anywhere inside a selected element with a five-pixel intent threshold, while preserving normal clicks, double-click text editing, the dedicated move handle, snapping, axis lock, undo, and responsive scopes.

## 1.2.1 - 2026-07-21

- Promoted the development-only Visual Truth host into the browser top layer, with a maximum-z-index fallback, so a host website cannot cover the editor or launcher with its own stacking context.
- Corrected workspace-canvas discovery so the application root remains the editable canvas when Visual Truth is mounted in its separate installation host.
- Removed the Easy Mode padding-handle collision that intercepted text resize handles.
- Made **Resize text + box** the clear default text-handle behavior, persisted the selected behavior across reloads, and retained **Reflow text** as an intentional alternative.
- Kept resized text inside its box while the font and box grow or shrink together, and added the resulting font size to the live resize HUD.

## 1.2.0 - 2026-07-16

- Added a privacy-minimal, best-effort anonymous counter after a successful Visual Truth project installation.
- The counter sends only the event type and Visual Truth version; it does not send project names, paths, source code, page content, accounts, cookies, device identifiers, or editor activity.
- Added `VISUAL_TRUTH_ANALYTICS=0` to disable the installation event.
- Added a public aggregate analytics page backed by daily counters, with no user-level records.

## 1.1.0 - 2026-07-16

- Added default Easy Mode while preserving the complete original editor as Advanced Mode.
- Added contextual text, image, and container inspectors; visual Add tiles; recent and saved items; canvas insertion zones; onboarding; tooltips; and command search.
- Made side-handle text-box resizing reflow text by default, with an explicit Scale text alternate and direct A−, numeric size, and A+ controls.
- Added grouped human-readable review, before/after previews, selective local source application, theme consistency tools, and live accessibility checks.
- Added responsive Easy Mode layouts and visible keyboard focus without changing the development-only or local-only safety boundary.
- Added focused Easy Layers, semantic element naming, and clickable selection breadcrumbs.
- Added exact number fields and per-value reset actions alongside the common spacing, radius, opacity, and size sliders.
- Added 25–200% canvas zoom, 100%, Fit page, Fit selection, pan mode, a page minimap, and double-click section isolation.
- Added direct canvas handles for padding, flex/grid gap, grid-column division, and child alignment.
- Added reusable visual components with insert/update controls and instance-level content overrides.
- Added named change sessions, session enable/disable controls, and hold-to-compare original.
- Added a layout-free Content mode for copy, links, images, alt text, and button labels.
- Added contextual smart actions for sibling spacing, even distribution, responsive sizing, project typography, and contrast repair.
- Added Affinity-style ruler guides: drag from either ruler to place a persistent canvas guide, snap elements magnetically, drag or arrow-key guides to refine them, delete individual guides, or right-click the ruler corner to clear them all.
- Polished ruler-guide discoverability and precision with a first-use hint, live coordinate badges, a guide count, exact numeric positioning in pixels or inches, and a compact Studio guide manager.
- Moved the editor minimize control into a dedicated far-right toolbar endcap after Easy/Advanced, enlarged it to a 46 × 44 px target, strengthened its contrast, and clarified that it restores the bottom-left Visual Truth launcher.
- Removed the desktop-only absolute brand positioning that allowed the active Select tool to render underneath the transparent Visual Truth wordmark; the brand and tools now occupy separate, stable flex positions at every desktop width.

## 1.0.0 - 2026-07-13

### Public Release

- Prepared Visual Truth as a validated skills-only Codex plugin for public review.
- Added deterministic package ranges for React, Vite, and the build toolchain.
- Added public documentation, licensing, privacy, terms, security, support, and submission test materials.
- Added compatibility checks, transactional installer rollback, and clean-install coverage for npm, pnpm, Yarn, and Bun.
- Preserved the development-only overlay boundary so Visual Truth is never intentionally mounted in production.

## 0.26.0 - 2026-07-13

### Canvas Rulers

- Added persistent Photoshop-style X and Y rulers around the editing canvas, with pixels as the default unit.
- Added a pixel/inch unit switch in Studio and at the rulers' upper-left intersection; inches use the browser's standard 96 CSS pixels per inch.
- Made ruler ticks and numeric labels follow horizontal and vertical canvas scrolling.
- Reserved ruler gutters in the attached workspace so the page, alignment grid, Quick Adjust controls, and multi-selection tools remain unobstructed.
- Kept the compact phone editor ruler-free while preserving the saved desktop ruler preference.

## 0.25.0 - 2026-07-13

### Docked Workspace

- Replaced the floating editor layout with a Lightroom-style shell that contains the active website inside a dedicated central canvas.
- Docked the primary toolbar across the top, Layers and Add to the left, Studio or Design to the right, and the selected-path status bar across the bottom.
- Added attached edge tabs for collapsing and restoring either side dock while the canvas expands into the released space.
- Clamped multi-selection arrangement controls and the group-move handle inside the usable canvas between all open docks.
- Made single-selection Quick Adjust controls respect Studio as a right-side boundary.

### Lightroom Shortcuts

- Added Tab to hide or restore both side docks while remembering which docks were previously open.
- Added Shift+Tab to hide or restore the complete editor chrome for an unobstructed canvas.
- Preserved normal Tab focus navigation while an editor control or form field has focus.
- Kept phone editing attached as a top toolbar and bottom control sheet rather than forcing desktop side docks into the narrow viewport.

## 0.24.0 - 2026-07-13

### Visual Studio

- Added Shift-click multi-selection, group dragging, persistent grouping, six-way alignment, and horizontal or vertical distribution.
- Added exact 4px, 8px, 12px, and 16px grid snapping with visible grid lines alongside the existing magnetic alignment guides.
- Expanded the right-click menu with layer naming, style copy/paste, reusable-section capture, group/ungroup, lock/unlock, and Make It Code.
- Added a collapsible Lightroom-style Studio with explicit responsive override properties and one-property reset controls.

### Reuse And Data

- Added fully styled reusable sections with local libraries, cross-project clipboard export/import, collision-free element identities, and structural Undo history.
- Added global named styles that can be captured, applied, relinked, and updated across every linked element.
- Added repeated-card tooling with editable JSON rows and visual bindings for text, image source, link destination, and background image.
- Kept repeater output in source data order and recorded rendering or deletion as grouped, reversible structural actions.

### Make It Code

- Added a development-only Vite source bridge and automatic bridge availability check.
- Added one-click generation of a reviewable `src/visual-truth.generated.ts` module for style, responsive style, text, attributes, inserts, removals, and reorders.
- Added a reusable generated-patch runtime that reapplies changes after app rendering and responsive viewport changes without shipping the editor overlay.
- Added installer automation for Vite projects, a public Vite plugin export, package integrity checks, and generated-source compilation verification.

## 0.23.0 - 2026-07-13

### Live Style HUD

- Extended the selected element's live measurement HUD to text, fill, and border colors; border width and radius; opacity; and shadow presets.
- Showed exact resulting numeric values with signed differences, while color and shadow edits show the resulting value and previous appearance.
- Shared the feedback path between Quick Adjust, the Design inspector, and responsive Desktop/iPad/Phone scopes.
- Kept live measurement badges inside the usable canvas when the selected element is close to the Layers or Design panel.
- Preserved continuous Undo history and the existing movement, resize, type, and spacing HUD behavior.

## 0.22.0 - 2026-07-13

### Live Spacing HUD

- Extended the selected element's live measurement HUD to margin, padding, and container-gap adjustments.
- Showed the exact side or gap property, resulting pixel value, and signed difference after Quick Adjust and inspector edits.
- Reused the shared transient feedback path so spacing readouts return automatically to the element's normal page measurements.
- Preserved responsive edit scopes, continuous Undo history, and the existing movement, resize, and type HUD behavior.

## 0.21.0 - 2026-07-13

### Live Type Size HUD

- Extended the selected element's live measurement HUD to font-size adjustments.
- Showed the exact resulting font size and signed pixel difference after Quick Adjust, Type panel, inspector, and inline text-toolbar changes.
- Kept the Type HUD visible during direct on-page text editing without exposing resize handles or movement controls.
- Preserved the existing movement and resize HUD behavior while sharing one transient feedback system across all three adjustment types.

## 0.20.0 - 2026-07-13

### Live Measurement HUD

- Turned the selected element's dimensions badge into a live measurement HUD during movement and resizing.
- Showed the element's accumulated X/Y offset during mouse dragging, keyboard nudging, and Quick Adjust movement instead of only the latest step.
- Added live Shift-axis and temporary Option/Alt snap-bypass state to the movement readout.
- Added exact resulting width and height, width/height deltas, and ratio-lock state during handle resizing, exact dimension changes, and 5% scaling.
- Kept the feedback visible briefly after button-based adjustments, then restored the normal absolute X/Y/width/height badge automatically.

## 0.19.0 - 2026-07-13

### Precision Dragging

- Fixed canvas dragging so it continues from an element's existing Visual Truth translation instead of jumping back toward its original position after a nudge or earlier drag.
- Added Shift-drag axis locking for clean horizontal or vertical movement.
- Added Option/Alt-drag to temporarily bypass magnetic snapping without changing the saved snapping preference.
- Clarified the move-handle tooltip so both precision modifiers are discoverable on the canvas.

## 0.18.0 - 2026-07-12

### Layer Type Filters

- Added persistent All elements, Text, Media, Layout, and Controls filters to the Layers panel.
- Added a live visible/total layer count so large pages show the effect of filtering immediately.
- Kept Layers search inside the active type while still searching through collapsed branches.
- Made Focus Selection temporarily expose the complete selected hierarchy and safely pause type filtering.
- Recognized standard media elements, SVGs, CSS backgrounds, and labelled image or logo containers as Media.
- Preserved the selected type separately for every route and migrated existing Layers preferences to All elements.

## 0.12.0 - 2026-07-12

### Position And Align

- Added a Quick Adjust Position & Align panel for exact X and Y offsets without leaving the selected element.
- Added direct 1px, 4px, and 8px position steppers plus editable pixel fields.
- Added one-click reset position and parent alignment for left, horizontal center, right, top, vertical center, and bottom.
- Routed exact positioning and alignment through responsive Desktop/iPad/Phone scopes and existing Undo history.
- Fixed continuous-history cleanup so returning a quick adjustment to its exact original value removes the no-op captured change.
- Normalized zero translation to CSS `none` so reset position restores both visual truth and a zero-change history state.

## 0.11.0 - 2026-07-12

### On-Canvas Type

- Added a Quick Adjust Type panel for exact typography without leaving selected text.
- Added font-family selection, editable font size, and direct 1px, 4px, or 8px size steps.
- Added line-height and letter-spacing steppers with live values.
- Added regular, medium, semibold, and bold weight presets plus left, center, and right alignment controls.
- Routed every Type action through responsive Desktop/iPad/Phone scopes and existing Undo history.
- Kept Type mutually exclusive with the Size, Spacing, and Style popovers.

## 0.10.0 - 2026-07-12

### On-Canvas Size

- Added a Quick Adjust Size panel for exact width and height without leaving the selected element.
- Added direct 1px, 4px, and 8px width and height steppers plus editable pixel fields.
- Added aspect-ratio locking so one dimension can update both width and height as one Undo action.
- Added one-click fill-parent width with grouped history for width, height, and max-width.
- Added the active step selector inside Size, Spacing, and Style so each open panel remains fully operable even when it overlaps the Quick Adjust bar.
- Routed exact sizing through responsive Desktop/iPad/Phone scopes and existing Undo history.

## 0.9.0 - 2026-07-12

### On-Canvas Style

- Added a Quick Adjust Style panel for common visual changes without leaving the selected element.
- Added six direct color swatches plus native custom color pickers for text, fill, and border colors.
- Added one-click fill clearing and compact steppers for border radius, border width, and opacity.
- Added none, small, medium, and large shadow presets with the current preset shown directly on canvas.
- Reused the active 1px, 4px, or 8px Quick Adjust step for radius and border-width changes.
- Routed every Style action through existing responsive Desktop/iPad/Phone scopes and Undo history.
- Kept the Style and Spacing panels mutually exclusive and constrained inside the usable editor canvas.

## 0.8.0 - 2026-07-12

### On-Canvas Spacing

- Added a Quick Adjust spacing panel for margin and padding without leaving the selected element.
- Added independent top, right, bottom, and left controls with live pixel values.
- Reused the selected 1px, 4px, or 8px Quick Adjust step for every spacing action.
- Added automatic container-gap controls for flex, inline-flex, grid, and inline-grid elements.
- Kept the spacing panel inside the usable canvas and clear of the main toolbar and side panels.
- Routed spacing and gap changes through responsive Desktop/iPad/Phone scopes and existing Undo history.

## 0.7.0 - 2026-07-12

### Quick Adjust

- Added a compact on-canvas toolbar beside the selected element so common adjustments no longer require moving to the inspector.
- Added mouse-accessible 1px, 4px, and 8px movement steps with directional controls.
- Added 5% shrink and grow controls for images, cards, containers, and other selected elements.
- Added 1px text-size decrease and increase controls when a text element is selected.
- Kept Quick Adjust inside the usable canvas between the Layers and Design panels, including when the selected element extends underneath a panel.
- Routed every Quick Adjust action through existing grouped history and responsive edit scopes, preserving one-step Undo and Desktop/iPad/Phone-specific changes.

## 0.6.0 - 2026-07-12

### Canvas

- Added named hover preselection, alignment-grid and magnetic-snap toggles, and X/Y/width/height selection readouts.
- Added direct image drop/paste targeting for image replacement and container backgrounds.
- Added visual nine-point image and background focal positioning.
- Added lock and hide controls with persistent Layers indicators.

### Structure

- Added draggable Layers placement before, inside, or after compatible targets.
- Added an exact Parent picker for moving elements across containers.
- Added full element copy/paste through the context menu and Cmd/Ctrl+C or Cmd/Ctrl+V.
- Added before/after selector and parent history, plus stable local IDs for unlabeled moved elements.

### Responsive Truth

- Added per-device override counts and current-device reset.
- Added selected-element highlighting and exact measurements in Desktop, iPad, and Phone previews.
- Corrected combined-preview scaling so all three frames fit without horizontal overflow.
- Added exact responsive measurements and original selector hints to the Send to Codex brief.

### History And Packaging

- Grouped multi-property gestures into one Undo/Redo action.
- Coalesced rapid nudges, sliders, and repeated property edits into one history row.
- Added `npm run validate:package` for bundled exports, types, styles, and version integrity.
- Updated and reinstalled the personal Visual Truth plugin with the 0.6.0 package.
