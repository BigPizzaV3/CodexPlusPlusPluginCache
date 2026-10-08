# Read-Only Audit Safety

## Default rule

Do not change the project during a health check.

## Allowed read operations

- read source and configuration
- inspect scenes and prefabs without saving
- read Console
- list tests
- read build settings
- inspect package versions
- inspect Git history and diff
- read existing profiler captures

## Conditional operations

Only when clearly useful and safe:

- run existing tests
- enter Play Mode for validation
- capture profiler data
- trigger a development build
- create a report under documentation

Report any operation that may alter local generated state.

## Prohibited by default

- package updates
- package installation
- scene saves
- prefab modifications
- Project Settings edits
- automatic fixes
- asset reorganization
- code reformatting
- Console clearing
- deleting caches
- changing build targets

## Secrets

If secrets are found:

- report the path
- do not reproduce secret values
- avoid storing them in generated reports
