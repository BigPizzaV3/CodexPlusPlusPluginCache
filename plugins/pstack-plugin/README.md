# pstack for ChatGPT Web

A curated ChatGPT Web version of [pstack](https://github.com/cursor/plugins/tree/main/pstack).

The original pstack project contains a larger set of engineering workflows built for Cursor and agent-driven development. This repository keeps the parts that make sense inside normal ChatGPT conversations.

Some skills are copied directly from pstack because they already work well as standalone instructions. Others are adapted for ChatGPT Web where the original version depends on Cursor-specific agents, local tools, transcripts, model routing, or code execution.

This is not a complete port of pstack.

## What is included

The repository contains three kinds of skills.

### Direct from pstack

These skills work well in ChatGPT without changing how they behave, so they are kept as close to the upstream versions as possible.

Current examples include:

- `unslop`
- `bro`
- `technical-writing`
- `typescript-best-practices`
- `principle-boundary-discipline`
- `principle-build-the-lever`
- `principle-encode-lessons-in-structure`
- `principle-exhaust-the-design-space`
- `principle-experience-first`
- `principle-fix-root-causes`
- `principle-foundational-thinking`
- `principle-make-operations-idempotent`
- `principle-migrate-callers-then-delete-legacy-apis`
- `principle-minimize-reader-load`
- `principle-model-the-domain`
- `principle-prove-it-works`
- `principle-redesign-from-first-principles`
- `principle-separate-before-serializing-shared-state`
- `principle-subtract-before-you-add`
- `principle-type-system-discipline`

### Adapted for ChatGPT Web

Some pstack skills are useful in ChatGPT, but their upstream implementations assume Cursor features that do not exist in a normal ChatGPT conversation.

These versions keep the purpose of the original skill and rewrite the workflow around what ChatGPT can actually access.

Current adaptations include:

- `how` for tracing and explaining how a codebase or subsystem works
- `why` for investigating design history and the evidence behind a decision
- `teach` for explaining technical systems in a way that builds a useful mental model
- `architect` for designing types, ownership, interfaces, and module boundaries before implementation
- `blast-radius` for finding what a code change could break outside the diff
- `recall` for rebuilding working context from previous conversations and connected project sources

For example, the upstream `blast-radius` skill can ask an agent to write and run a test locally. The ChatGPT Web version does not pretend it can do that when execution is unavailable. It traces the available evidence, states what is proven, and marks runtime claims as unproven when they still need a test.

That distinction matters. The goal is to preserve the useful engineering behavior without copying instructions for tools that ChatGPT Web does not have.

## What is intentionally left out

The original project also contains workflows built around autonomous coding agents, worktrees, local command execution, Cursor transcripts, parallel subagents, or other Cursor-specific behavior.

Those skills are not included merely to increase the skill count.

If a workflow does not make sense in a normal ChatGPT Web conversation, it stays out unless there is a useful ChatGPT-native version to build.

This repository is a curated subset, not a compatibility layer for every pstack feature.

## Upstream project

pstack was created by Lauren Tan and is part of the Cursor plugins repository:

[https://github.com/cursor/plugins/tree/main/pstack](https://github.com/cursor/plugins/tree/main/pstack)

If you use Cursor and want the full pstack workflow, use the original project.

This repository exists for people who want the same ideas available as skills in normal ChatGPT Web conversations.

## Keeping the skills close to upstream

For skills copied directly from pstack, the aim is to stay close to the current upstream version.

Adapted skills intentionally diverge where the original depends on behavior that ChatGPT Web cannot reproduce cleanly.

An upstream change is therefore handled in one of two ways:

1. Direct skills can usually be updated from the upstream version.
2. Adapted skills need to be reviewed and the useful changes carried across without reintroducing Cursor-specific assumptions.

The source of a skill should remain obvious. Adaptations should not quietly turn into unrelated rewrites.

## Repository layout

```text
.codex-plugin/
  plugin.json

assets/
  pstack.svg

skills/
  unslop/
    SKILL.md

  how/
    SKILL.md

  why/
    SKILL.md

  architect/
    SKILL.md

  ...

LICENSE
NOTICE.md
README.md

```

Each skill lives under `skills/<skill-name>/[SKILL.md](http://SKILL.md)`.

## Attribution

This is an unofficial project.

It is not affiliated with or endorsed by Cursor or the original pstack author.

pstack is distributed under the MIT License. Skills copied or adapted from pstack retain that licensing and attribution through the repository's `LICENSE` and [`NOTICE.md`](http://NOTICE.md) files.

See the original project for the upstream source:

[https://github.com/cursor/plugins/tree/main/pstack](https://github.com/cursor/plugins/tree/main/pstack)

## License

MIT. See LICENSE.