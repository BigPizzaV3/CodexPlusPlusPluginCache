# Editor Tools Specialization

## Use when

Use for custom inspectors, EditorWindows, property drawers, menu items,
asset processors, importers, validators, and project automation.

## Inspect first

- editor assembly boundaries
- existing editor framework
- Undo support
- multi-object editing
- serialization approach
- asset database usage
- domain reload behavior

## Implementation rules

- Place editor code in editor-only assemblies or folders.
- Support Undo for user changes.
- Mark objects dirty only when necessary.
- Avoid unintended asset imports.
- Support multi-object editing when appropriate.
- Avoid long blocking work on the main thread.
- Persist tool state deliberately.
- Keep runtime assemblies free of UnityEditor references.
- Validate menu paths and shortcuts.

## Validation

- compilation without runtime UnityEditor references
- Undo and redo
- multi-selection
- domain reload
- asset import behavior
- no unintended serialized changes
