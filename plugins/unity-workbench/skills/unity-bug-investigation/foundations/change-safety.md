# Investigation Change Safety

## Before modifying

- preserve failing data
- preserve representative saves
- capture current serialized state
- inspect the Git diff
- identify rollback steps
- avoid broad asset rewrites

## Serialized assets

Treat scenes, prefabs, ScriptableObjects, input actions, animation controllers,
materials, and project settings as high impact.

Prefer targeted MCP or Editor operations over raw wholesale serialization edits.

## Packages

Do not update packages merely to test whether a bug disappears.

If version testing is necessary:

- record the baseline version
- use an isolated branch or copy
- inspect lock-file changes
- restore the original state
- report compatibility implications

## User data

Do not delete or reset user data as the first diagnostic step.

Back up before migration or repair tests.

## Temporary fixes

Clearly distinguish:

- diagnostic experiment
- workaround
- production fix

Do not leave a workaround in place without documenting its limitations.
