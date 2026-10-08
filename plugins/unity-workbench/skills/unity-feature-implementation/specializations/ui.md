# UI Specialization

## Use when

Use for HUD, menus, windows, settings, uGUI, UI Toolkit, navigation,
localization, and runtime UI presentation.

## Inspect first

- uGUI or UI Toolkit
- presenter, MVVM, or controller pattern
- localization
- navigation and focus
- resolution support
- prefab or document ownership
- current event binding strategy

## Implementation rules

- Separate gameplay state from presentation.
- Reuse existing presenters and view models.
- Avoid repeated listener registration.
- Unsubscribe on disable or destruction.
- Use localization for user-facing strings.
- Preserve controller and keyboard navigation.
- Prefer event-driven updates for infrequent state changes.
- Avoid unnecessary layout rebuilds.
- Keep view state derived from authoritative data.

## Validation

- visible state
- interaction
- navigation
- localization
- resolution and scaling
- repeated open and close
- scene reload
- missing optional data
