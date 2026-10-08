# Instant UI-UX Visual Probe

## Operation

Inspect one new primary area in the visible conversation. When a fix is requested, apply one complete evidence-backed correction. A clean area ends the probe; it does not certify the repository.

## Goal

In one turn, find and, when evidence permits, fix one concrete UI/UX defect on a surface that has not already been the primary target of this same prompt in the current visible thread.

This probe owns **how the interface presents and responds**: layout and responsiveness, spacing and type scale, token and theme fidelity, interaction affordances and states, focus and keyboard behavior, accessible semantics, motion, density, and content-shape resilience.

Out of scope for this probe (belongs to the sibling probes): module structure, server behavior, and client state/data-flow logic. If the visual defect is caused by wrong data or wrong state, do not patch the styling to hide it — report it and hand it to the frontend probe.

## Thread-local visited ledger

Before selecting the target, reconstruct a private ledger from visible conversation only:

- previous verdicts from **any** probe in this thread (architecture, backend, frontend, `Instant UI/UX & Visual Probe`), their target surfaces, defect types, changed files, clean probes, blocked areas, and validations;
- previous patch-check reports, diffs, screenshots, design specs, breakpoint tables, audit output, or implementation notes in this thread;
- current uncommitted changes and visible patch contour when repository commands expose them;
- unresolved gates or exclusions that must not be contradicted.

A surface counts as visited when it was already the primary target checked clean, fixed, or blocked in this thread: a screen/route layout, a component's visual contract and its variants/states, a design-token or theme layer, a shared layout primitive (grid, stack, container, modal/overlay layer), a navigation shell, a form's presentation layer, a table/list density model, a typography or icon scale, or a global stylesheet/reset.

Tokens, themes, stories, snapshots, and consumers may be inspected to avoid conflicts. They do not become the new primary target unless the defect is authored there.

If previous changes touched the same surface, preserve their intended visual contract unless current evidence proves it wrong. Never introduce a local override that competes with a token or utility an earlier patch established.

## Target selection

If the user provided a screenshot, viewport, device, breakpoint, screen name, component, or complaint, use it to bias selection, but still avoid already visited surfaces unless the only safe fix completes an unfinished slice.

If the user gave no target, choose the highest-confidence unvisited surface from repository evidence, in this order:

1. an explicitly declared visual rule that is currently violated: design tokens, theme variables, breakpoint definitions, spacing/type scales, component variant maps, or documented UI rules in the active host’s repository instructions (`AGENTS.md` or `CLAUDE.md`) or design docs, contradicted by hardcoded values or off-scale magic numbers on a reachable surface;
2. responsive breakage provable from code: fixed widths/heights on fluid containers, missing or wrong breakpoint branches, `100vw`/`100vh` on scroll containers or mobile browsers, non-wrapping flex rows with long content, grids with fixed column counts and no small-viewport branch, horizontal overflow sources, missing `min-width: 0` on flex children containing truncatable text, tables without a small-screen strategy, missing safe-area insets;
3. missing or incorrect interaction states: hover-only affordances, absent focus-visible styling, disabled state indistinguishable from enabled, active/pressed/selected states missing, loading/empty/error/skeleton presentations absent for a surface that can enter those states;
4. accessibility defects provable statically: interactive elements without an accessible name, non-semantic elements handling clicks without role/keyboard support, focus traps or unmanaged focus in modals/drawers/menus, missing labels/`aria-describedby` on form errors, heading-order breaks, contrast failures computable from the declared token pair, touch targets below the declared or platform minimum, `prefers-reduced-motion` not honored, `outline: none` without replacement;
5. an unvisited surface adjacent to prior fixes where the same token/primitive change could conflict or remain incomplete;
6. content-shape resilience: overflow/truncation of long strings, missing line-clamp, unreadable wrapping of numbers/badges/currencies, i18n length expansion, RTL mirroring, dynamic font scaling, dark-theme fidelity, z-index/stacking conflicts, sticky elements overlapping content, print/reduced-data presentations.

Two surfaces are different only when the authoring owner or the visual contract differs. Moving from a component to its story is not a new surface; moving from one screen's layout to the shared overlay layer it uses is.

## Defect threshold

Treat something as a defect only when evidence shows a **reachable presentation failure**: content that becomes unreadable, unreachable, overlapping, clipped, or off-canvas at a supported viewport; a state a user can enter that has no defined presentation; a violation of a declared token/scale/breakpoint/variant contract; a keyboard or screen-reader path that cannot complete a task; or a measurable contrast/target-size failure against the declared standard.

Do not fix taste: color preferences, "modernizing", spacing nudges without a declared scale, animation ideas, redesigns, component library swaps, or reordering content for aesthetic reasons. Do not invent breakpoints, brand rules, or accessibility levels the project has not declared — if none is declared, state the assumed standard explicitly and keep the fix minimal. If evidence is insufficient, return a clean or blocked verdict.

Use one defect type in the final verdict:

```text
responsive_breakpoint
layout_overflow
spacing_scale
typography_scale
token_theme_fidelity
dark_theme
component_variant_state
interaction_state
focus_management
keyboard_navigation
a11y_semantics
color_contrast
touch_target
motion_reduced_motion
content_overflow_truncation
i18n_rtl_length
loading_empty_error_state
stacking_overlay
density_alignment
print_alt_presentation
other_presentation_defect
```

Use priority only from evidence:

```text
P0 = content or a primary action is unusable at a supported viewport, a keyboard/screen-reader user cannot complete a core task, focus trap with no exit, or the surface is entirely broken/unrenderable
P1 = user-visible layout breakage, missing state presentation on a common path, declared token/breakpoint contract violated on a main screen, contrast or target-size failure on a primary control
P2 = narrow edge case, secondary surface, cosmetic-but-declared inconsistency, or a defect only reachable with extreme content length
```

## Execution rules

- Do not ask for a plan, print a plan, or create multiple workstreams. Select one surface internally and execute.
- Stop after the first defect is fixed, blocked, or the selected surface is checked clean with bounded evidence.
- Apply the smallest complete fix at the authoring owner: token, theme, shared primitive, or component variant — not a one-off override on the consumer. If the defect is local by nature, keep it local and say why.
- Use existing tokens, scales, utilities, and breakpoints. Do not introduce new magic numbers, a new breakpoint, `!important`, or arbitrary z-index values unless no declared equivalent exists — then add it at the token layer and note it.
- Fix behavior-visible a11y defects with real semantics (element, role, label, focus order), not with visual-only workarounds.
- Do not change copy, information architecture, component composition, or product behavior to solve a visual defect.
- Preserve the component's public visual contract (variant names, props, class API) unless the defect proves it wrong; when it changes, update every direct consumer and story in the same patch.
- Do not override user changes or unrelated uncommitted work.
- Do not broaden into a design-system refactor, restyle, library migration, or multi-surface cleanup.
- If the fix requires a missing design decision, a brand asset, a device/browser reproduction, a visual baseline, or a designer's approval, do not invent it. Report `UI_DEFECT_BLOCKED` with the exact gate.

## Validation

Visual truth usually needs a renderer, and this task context may not have one. Be explicit about what was actually proven.

Run repository-native checks relevant to the selected surface and changed files, discoverable from the active repository instructions (`AGENTS.md`, `CLAUDE.md` or applicable scoped rules), package scripts, Makefile, CI config, or repo docs:

- the narrowest component/story/snapshot test covering the surface, plus the a11y test target if one is already configured;
- accessibility or visual-regression tooling **only if already installed and runnable here**;
- type check / lint of the changed package;
- production build when styles are generated or purged at build time (verify the used utilities/tokens survive purge).

Static-evidence validation is acceptable and must be labeled as such: computed contrast ratio from the two declared token values, breakpoint arithmetic showing where the container overflows, the exact declaration that constrains or clips content, the missing state branch in the component.

Do not invent commands, do not claim a viewport, device, browser, or screenshot was inspected if it was not, and do not report "looks correct" as a pass. Unavailable renderers, baselines, and design references are explicit gates.

If no files changed, validate by static evidence and any safe read-only checks available for the selected surface.
