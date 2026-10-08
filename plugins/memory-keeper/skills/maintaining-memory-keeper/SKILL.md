---
name: maintaining-memory-keeper
description: Use when creating, editing, testing, auditing, packaging, versioning, releasing, or preparing publication of the Memory Keeper plugin or any of its skills.
---

# Maintaining Memory Keeper

This is developer/self-maintenance discipline, not a user-facing mode.

## Required discipline

- behavior changes require a failing regression/contract test first;
- each specialist stays focused; `using-memory-keeper` stays concise and trigger-oriented;
- version and diagnostic marker stay synchronized across manifests/docs/tests;
- pressure scenarios cover bypass/rationalization, incomplete evidence, recovery, and completion;
- built ZIPs are inspected/linted, not inferred from the source tree;
- `verifying-persistent-work` is required before a release-complete claim.

## Official test path

Run `scripts/run_release_tests.py --source <plugin-root>` for source certification. It executes tests in an isolated copy with bytecode disabled, then re-lints the untouched source, preventing tests from creating `__pycache__` and falsely failing their own cleanliness gate. Pass final ZIPs with repeated `--zip <archive>` arguments.

## Release hygiene

Reject `__pycache__`, `.pyc/.pyo`, temp/editor debris, nested old releases, stale version/marker strings, missing specialists, malformed/unsafe ZIPs, or MCP declarations. `scripts/package_lint.py` must fail cleanly rather than crash on malformed input.

Static contracts prove package/skill invariants, not host auto-invocation. Automatic routing must still be pressure-tested on a host where the plugin is actually installed.
