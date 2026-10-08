---
name: atlas-scout-code-navigation
description: Use Atlas Scout for local structural code navigation involving definitions, symbols, callers, references, dependency paths, architecture, traces, or edit impact. Use when asked where a symbol is defined, who calls or uses a function, what implements an interface, what breaks if code changes, or how a codebase is organized.
---

# Atlas Scout code navigation

Atlas Scout provides local structural-index evidence for code-navigation tasks. Select a matching
Scout capability when it fits the user's requested evidence:

- For a broad task or unfamiliar subsystem, call compact `fast_context` once for a source/test
  shortlist and exact ranges.
- `symbol_outline` lists declarations and exact ranges in a known file.
- `symbol_search` locates definitions and returns stable symbol ids.
- `symbol_references` returns indexed callers, references, and implementations.
- Graph, trace, path, architecture, and edit-impact tools return their corresponding bounded
  structural evidence.
- Omit `detail` and `limit` on initial discovery. Read useful cited ranges before another broad
  navigation call, and stop when the evidence is sufficient.

Text search remains useful for literals, regular expressions, generated or malformed code,
unsupported or partial language coverage, and focused completeness checks. Other development tools
remain appropriate for builds, tests, package managers, Git, servers, metrics, and runtime
diagnostics. Check Scout's coverage and trust metadata before treating an empty result as
exhaustive, and choose whichever available tool best fits the user's request.
