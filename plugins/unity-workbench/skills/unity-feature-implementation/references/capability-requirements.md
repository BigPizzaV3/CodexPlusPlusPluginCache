# Capability Requirements

The skill refers to conceptual capabilities rather than exact MCP tool names.

## Essential repository capabilities

- file search
- text read
- text edit
- code search
- Git diff inspection
- terminal execution

## Unity read capabilities

- `unity.connection.status`
- `unity.console.read`
- `unity.asset.search`
- `unity.gameobject.inspect`
- `unity.scene.inspect`
- `unity.buildsettings.read`
- `unity.tests.list`
- `unity.playmode.read`

## Unity mutation capabilities

- `unity.script.create`
- `unity.script.modify`
- `unity.asset.modify`
- `unity.gameobject.modify`
- `unity.scene.modify`
- `unity.playmode.set`
- `unity.tests.run`

## Optional capabilities

- `unity.prefab.inspect`
- `unity.prefab.modify`
- `unity.inputactions.inspect`
- `unity.inputactions.modify`
- `unity.animation.inspect`
- `unity.shader.compile`
- `unity.profiler.capture`
- `unity.screenshot.capture`
- `unity.build.run`

## Resolution rules

1. Prefer tools associated with the active Unity instance.
2. Prefer read-only inspection before mutation.
3. Prefer targeted operations.
4. Prefer structured results.
5. Prefer tools that preserve Unity serialization.
6. Avoid unclear side effects.
7. Re-read affected state after mutation.
8. Check Console output after import or compilation.

## Missing capabilities

When a capability is unavailable:

- use repository inspection
- complete safe code changes
- do not fabricate Editor changes
- provide exact manual setup
- lower the reported validation level
