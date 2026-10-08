# Versioning and compatibility

The collection uses Semantic Versioning.

At version 1.0.0, each plugin's documented JSON schemas, command flags, output extensions, output-directory shape, overwrite policy, exit behavior, and evidence boundary are stable public interfaces.

Version 2.0.0 introduces new canonical document schemas and unified author/import/lint/repair/export CLIs. The v1 release remains available for consumers that require its frozen contracts; v2 files use an explicit root `version: 2` discriminator.

Version 2.0.1 is a corrective release. It preserves the v2 schemas, commands, flags, default extensions, overwrite behavior, and ordinary valid-output shapes while tightening rejection of malformed or unsafe input. Python 3.11-3.13 are supported for this line; Python 3.14 is tested as forward-compatibility evidence but is not part of the supported matrix.

Version 2.1.0 is a backward-compatible feature release. Canonical roots remain `version: 2`; new edit and reorder inputs carry their own `version: 1` operation discriminators. It adds builders, import/export coverage, structural previews, source-preserving edits, safe merge, diagnostics, and optional adapters without changing existing default outputs. JSON Schema files published with each skill document the accepted authored shapes; runtime checks remain authoritative for semantic references and cumulative safety limits.

- Major releases may make incompatible interface or output-structure changes.
- Minor releases add backward-compatible formats, options, validations, or skills.
- Patch releases correct behavior without breaking documented contracts.

Identical valid input, generator version, and options must produce byte-identical portable output. Static validation never implies rendering, native import, compilation, simulation, numerical correctness, or physical validity. Optional runtime evidence applies only to the exact runtime invocation reported.

Python 3.11, 3.12, and 3.13 are supported for bundled scripts. The skills themselves require only a compatible ChatGPT or Codex plugin host with local file access.
