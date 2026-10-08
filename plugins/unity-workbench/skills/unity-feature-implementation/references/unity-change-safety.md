# Unity Change Safety

## Serialized assets

Before editing:

1. Identify the exact object or asset.
2. Read current serialized state.
3. Prefer targeted changes.
4. Preserve file IDs and GUID references.
5. Avoid rewriting unrelated sections.
6. Inspect the resulting diff.
7. Let Unity import.
8. Check Console errors.
9. Verify missing references and prefab overrides.

## Packages

Do not:

- update unrelated packages
- change lock files without need
- add packages that duplicate existing functionality
- replace stable dependencies casually

When adding a package:

- verify Unity-version compatibility
- document why it is required
- inspect transitive lock-file changes
- validate assembly compatibility

## Generated files

Normally do not edit or commit:

- `Library/`
- `Temp/`
- `Logs/`
- `obj/`
- generated IDE projects
- build output
- local user settings
