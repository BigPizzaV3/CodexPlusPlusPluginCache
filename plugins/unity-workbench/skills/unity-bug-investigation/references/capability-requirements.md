# Capability Requirements

## Repository capabilities

- file search
- text read and edit
- code search
- Git diff and history
- terminal execution
- test execution

## Unity read capabilities

- `unity.connection.status`
- `unity.console.read`
- `unity.scene.inspect`
- `unity.gameobject.inspect`
- `unity.asset.search`
- `unity.playmode.read`
- `unity.tests.list`
- `unity.profiler.read`
- `unity.screenshot.capture`

## Unity mutation capabilities

- `unity.playmode.set`
- `unity.tests.run`
- `unity.script.modify`
- `unity.asset.modify`
- `unity.gameobject.modify`
- `unity.scene.modify`

## Resolution rules

- confirm active project
- inspect before mutation
- prefer targeted operations
- preserve evidence
- re-read state after changes
- check Console after import or compilation
- do not clear evidence prematurely

## Missing capabilities

When tooling is unavailable:

- use repository-level evidence
- provide exact manual reproduction
- do not fabricate runtime validation
- mark uncertainty clearly
