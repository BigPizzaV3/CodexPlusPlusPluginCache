# Capability Requirements

## Repository capabilities

- file search
- source and configuration read
- Git diff and status
- terminal execution
- artifact inspection

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

## Unity execution capabilities

- `unity.tests.run`
- `unity.playmode.set`
- `unity.build.run`
- `unity.profiler.capture`
- `unity.screenshot.capture`

## Resolution rules

1. Confirm active project.
2. Record baseline first.
3. Prefer targeted tests before broad suites.
4. Use actual target platform when required.
5. Preserve failure evidence.
6. Report artifact paths.
7. Do not mutate project configuration to force a pass.
8. Exit Play Mode after validation.
