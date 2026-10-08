# Save Systems Specialization

## Use when

Use for persistence, profiles, checkpoints, progression, settings, cloud saves,
serialization, migrations, and data versioning.

## Inspect first

- save format
- storage location
- versioning
- migration logic
- encryption or compression
- cloud synchronization
- platform restrictions
- failure recovery
- representative old saves

## Implementation rules

- Preserve backward compatibility.
- Provide safe defaults for missing fields.
- Version format changes.
- Avoid Unity object references unless supported.
- Separate runtime state from serialized DTOs when appropriate.
- Handle partial or corrupted data deliberately.
- Do not silently discard unknown data.
- Consider ownership in multiplayer.
- Avoid blocking writes on hot paths.

## Validation

- new save
- save and reload
- missing fields
- old save migration
- corrupted or incomplete data
- cloud conflict when relevant
- platform path behavior
