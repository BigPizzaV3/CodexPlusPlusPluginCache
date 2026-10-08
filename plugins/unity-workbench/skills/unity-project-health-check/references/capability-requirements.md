# Capability Requirements

## Repository capabilities

- file search
- source and configuration read
- code search
- Git diff and history
- terminal execution
- test execution

## Unity read capabilities

- `unity.connection.status`
- `unity.editor.version`
- `unity.console.read`
- `unity.scene.list`
- `unity.scene.inspect`
- `unity.buildsettings.read`
- `unity.gameobject.inspect`
- `unity.asset.search`
- `unity.package.read`
- `unity.tests.list`
- `unity.playmode.read`
- `unity.profiler.read`
- `unity.screenshot.capture`

## Conditional execution capabilities

- `unity.tests.run`
- `unity.playmode.set`
- `unity.profiler.capture`
- `unity.build.run`

Use these only when appropriate to the audit scope.

## Resolution rules

1. Confirm the active project.
2. Prefer read-only tools.
3. Avoid saving scenes or assets.
4. Record baseline before running tests or Play Mode.
5. Do not clear the Console.
6. Report unvalidated areas.
