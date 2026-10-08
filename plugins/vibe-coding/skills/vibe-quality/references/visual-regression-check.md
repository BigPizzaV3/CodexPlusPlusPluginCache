# Visual Regression Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Required input

Supply the patch range, changed routes/components/states, target browsers/viewports, and accepted design references. Inspect only directly affected rendered surfaces plus shared tokens/components actually changed by the patch.

## Scenarios

- Render loading, empty, error, success, validation, disabled, permission, long-content, localization, reduced-motion, and dark/high-contrast states when applicable.
- Compare responsive layout, overflow, focus order/visibility, keyboard interaction, semantic/accessibility tree, and pointer/touch targets.
- Use deterministic data, fonts/assets, animation disabling, stable viewport, and documented screenshot masks only for proven nondeterminism.
- Review baseline changes semantically; never bulk-accept screenshots to make the suite green.
- Correlate visual diffs with DOM/style/component changes and run interaction/a11y assertions for behavior that pixels cannot prove.
