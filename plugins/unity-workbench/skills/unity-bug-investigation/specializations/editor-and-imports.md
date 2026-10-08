# Editor and Import Bugs

## Inspect first

- editor-only assembly
- asset importer
- AssetDatabase usage
- custom inspector
- Undo
- domain reload
- generated assets
- import loop
- package cache involvement

## Common causes

- runtime reference to UnityEditor
- recursive import
- marking assets dirty repeatedly
- missing Undo
- stale generated asset
- importer dependency not declared
- domain reload state leak

## Validation

- clean import
- domain reload
- Undo and redo
- multi-object edit
- no import loop
- runtime assemblies remain clean
