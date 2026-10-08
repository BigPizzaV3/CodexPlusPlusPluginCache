# Gemini CLI discovery

Specification check: 2026-09-11. Prefer live metadata exposed by the current CLI.

1. Distinguish the configured model/alias from actual per-turn routing. Auto is a
   host routing policy, not evidence that every turn uses one concrete model. Preserve
   Auto when appropriate instead of forcing a named alternative without evidence.
2. If applicable live selector metadata is unavailable, read the unexpired bundled
   [`gemini-cli.json`](../model-catalogs/gemini-cli.json). It records the stable
   `auto`, `pro`, `flash`, and `flash-lite` aliases verified in Gemini CLI 0.59.0
   and their dated official selection guidance. Recommend those aliases rather than
   guessing a concrete backend model. Alias resolution and account eligibility remain
   runtime-dependent. Never recommend Gemini 1.5 or another identifier absent from
   applicable runtime/user evidence or the current registry. `/model` lets the user
   inspect the account's actual selector when an account-specific comparison is needed;
   it is an interactive user command, not a shell command to run in a child process.
3. A known launch flag, `GEMINI_MODEL`, or applicable `model.name` setting is only a
   configuration observation with its source and scope. Do not dump environment or
   full settings. Session changes, Auto, overrides and fallback can affect execution.
4. Reasoning configuration is model/host-specific. Advanced `modelConfigs` can carry
   `thinkingConfig`, including `thinkingBudget` or `thinkingLevel`. Do not rename the
   router's relative task-demand labels as Gemini settings, infer support from a missing
   field, or treat display controls such as inline thinking as a reasoning budget. In
   compact output use `Reasoning: model default` (localized) when no independent setting
   is observed. Report an exact `thinkingBudget` or `thinkingLevel` only when verified
   as configurable in the effective session. Plain `low`, `medium`, or `high` is invalid
   unless it is the literal verified Gemini control value and is labeled with that
   control's native name.

`Reasoning: model default` is a reasoning value, not proof of current model identity.
An unresolved Auto backend or a generic default-only current AI label cannot certify verified
keep; apply the evidence requirements in [the UX contract](../routing-ux.md).

There is no assumed public non-interactive equivalent of the current selector in
this guide. Do not invent `gemini models list`, start an inference prompt, write
settings, install hooks, or invoke a routing model just to detect options. Use the
unexpired registry for an immediate useful recommendation; ask for `/model` contents
only if the user later requests an account-specific comparison. A subagent's model
and a new invocation's `--model` do not identify or change the running parent session.

Keep the full extension together. The generated coordinator contains its runtime dependencies
in a self-contained appendix, so its normal coordinated gate must not request access to sibling
Skills or plugin-level shared resources. Treat a missing or truncated appendix as incomplete.

Sources: [model selector](https://geminicli.com/docs/cli/model/),
[model routing](https://geminicli.com/docs/cli/model-routing/), and
[advanced model configuration](https://geminicli.com/docs/cli/generation-settings/).
