# Validation Safety

## Preserve project state

Before running disruptive operations:

- record active scene
- record Play Mode state
- record target platform
- record working tree
- preserve failing data
- preserve representative saves
- identify build output path

## Tests

Do not let tests modify production assets permanently.

Use isolated test data and temporary paths.

## Play Mode

Exit Play Mode after validation unless the user requests otherwise.

Avoid saving runtime changes into scenes or prefabs.

## Builds

Do not build into `Assets/` or source directories.

Do not overwrite valuable artifacts without clear intent.

## Devices

Do not uninstall or erase user data unless required and authorized.

## Credentials

Do not expose:

- signing keys
- passwords
- tokens
- certificates
- provisioning profiles
- service account secrets

Report only whether required credentials were available.

## Packages and settings

Do not modify packages or Project Settings merely to make validation pass.

If a configuration change is required, report it as a blocker or separate fix.
