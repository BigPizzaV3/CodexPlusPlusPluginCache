# Unity Serialization Safety

Use this guidance whenever a change affects serialized fields or Unity assets.

## High-impact files

Treat these as high-impact:

- `.unity`
- `.prefab`
- `.asset`
- `.mat`
- `.controller`
- `.overrideController`
- `.anim`
- `.playable`
- `.inputactions`
- `.spriteatlas`
- `ProjectSettings/*`

## Serialized fields

- Preserve field names where possible.
- Use `FormerlySerializedAs` when renaming.
- Avoid changing field types without migration.
- Provide safe defaults.
- Do not serialize runtime-only state.
- Keep required and optional references explicit.
- Check prefab overrides and scene instances.

Do not make a private serialized field public only for external access.

## Asset editing

Before editing:

1. Identify the exact asset.
2. Inspect current state.
3. Prefer targeted changes.
4. Preserve GUIDs and file IDs.
5. Avoid unrelated serialization changes.
6. Inspect the diff.
7. Let Unity import.
8. Check Console output.
9. Verify missing references.

## Meta files

When creating assets under `Assets/`:

- include required `.meta` files
- do not reuse GUIDs
- prefer Unity-generated metadata
- avoid manually inventing GUIDs unless tooling requires it

## Prefabs

Check:

- base prefab versus variant ownership
- nested prefabs
- scene instances
- existing overrides
- network prefab registration
- reusable versus scene-specific references

## Scenes

Avoid opening and saving scenes without necessary changes.

Check for unintended changes to:

- lighting
- navigation
- hierarchy
- object ordering
- prefab overrides
- local file IDs

## ScriptableObjects

When extending a ScriptableObject:

- inspect all assets using the type
- provide defaults
- search for custom inspectors
- preserve IDs and lookup keys
- consider migration and validation

## Project Settings

Treat all Project Settings changes as high risk.

Report every changed settings file.

Do not modify layers, tags, physics, graphics, quality, player settings, build
profiles, or package settings without a direct feature need.

## Input Actions

When editing `.inputactions`:

- inspect current action maps
- preserve existing bindings
- consider generated wrapper classes
- consider control schemes
- validate duplicate bindings
- check local multiplayer ownership

## Completion checklist

- No serialized references were lost.
- Existing prefab overrides remain valid.
- Required `.meta` files exist.
- Asset diffs are narrowly scoped.
- Unity imported without new errors.
- Manual wiring is documented.
