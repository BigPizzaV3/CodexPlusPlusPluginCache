# Skill catalog

This Codex package includes 35 skills. Use `$skill-name` to invoke one, such as `$ce-plan`. Each linked guide describes the workflow in more detail. Individual guides retain upstream slash-style examples; in Codex, use the corresponding dollar-prefixed name.

The `SKILL.md` inside each directory under `skills/` is authoritative for runtime behavior. Available tools, configured integrations, and host permissions affect which parts of a workflow can run.

The core workflow is:

```text
$ce-brainstorm      Define the requirements
      ↓
$ce-plan            Plan the implementation
      ↓
$ce-work            Build and verify
      ↓
$ce-simplify-code   Refine the code
      ↓
$ce-code-review     Review the change
      ↓
$ce-compound        Assess and capture durable learnings
```

Use the steps relevant to the change. `$ce-ideate` can help find a direction before brainstorming. `$ce-compound` writes a learning only when verified work produced reasoning that future agents would otherwise have to rediscover.

## The core loop

| Skill | Purpose |
| --- | --- |
| [`$ce-brainstorm`](./ce-brainstorm.md) | Clarify goals and decisions, then write a requirements-only plan. |
| [`$ce-plan`](./ce-plan.md) | Develop an implementation-ready plan grounded in the project and its constraints. |
| [`$ce-work`](./ce-work.md) | Implement the plan, verify the result, and continue through the applicable shipping steps. |
| [`$ce-simplify-code`](./ce-simplify-code.md) | Improve recently changed code for clarity, reuse, and efficiency while preserving behavior. |
| [`$ce-code-review`](./ce-code-review.md) | Review a diff or pull request for actionable findings. Applying fixes can be explicitly requested. |
| [`$ce-compound`](./ce-compound.md) | Capture reasoning from verified work when the code, tests, and existing docs do not already explain it. Write nothing when no learning qualifies. |

## Around the loop

| Skill | Purpose |
| --- | --- |
| [`$ce-strategy`](./ce-strategy.md) | Create or update STRATEGY.md to guide later ideation, brainstorming, and planning. |
| [`$ce-product-pulse`](./ce-product-pulse.md) | Report on a defined period of usage, performance, errors, and follow-ups from configured signals. |
| [`$ce-sweep`](./ce-sweep.md) | Collect feedback from Slack and GitHub issues, acknowledge it at the source, and maintain a plan for lfg. Email support is experimental. |
| [`$ce-compound-refresh`](./ce-compound-refresh.md) | Check captured learnings against the current project and update, consolidate, or remove outdated guidance. |

## On demand

| Skill | Purpose |
| --- | --- |
| [`$ce-ideate`](./ce-ideate.md) | Discover and evaluate grounded directions before choosing one to develop. |
| [`$ce-bakeoff`](./ce-bakeoff.md) | Develop independent competing approaches, compare them against a shared brief, and select a result. Brainstorming and planning invoke it only when explicitly requested. |
| [`$ce-pov`](./ce-pov.md) | Assess supplied material against project evidence and constraints. An oracle panel can add independent model opinions. |
| [`$ce-debug`](./ce-debug.md) | Diagnose broken or slow behavior, verify the cause, and optionally continue through a fix and pull request handoff. |
| [`$ce-explain`](./ce-explain.md) | Explain how something works and why, distinguishing evidence from inference. |
| [`$ce-doc-review`](./ce-doc-review.md) | Review requirements or a plan for substantive findings and missing decisions. |
| [`$ce-optimize`](./ce-optimize.md) | Measure a target, compare changes, and keep improvements supported by the results. |
| [`$ce-prototype`](./ce-prototype.md) | Build a throwaway prototype to settle how something should work or feel, then carry the findings into planning. |

## Git workflow

| Skill | Purpose |
| --- | --- |
| [`$ce-commit`](./ce-commit.md) | Create local commits using repository conventions. Does not push. |
| [`$ce-commit-push-pr`](./ce-commit-push-pr.md) | Commit, push, and open a pull request, or write or revise its description. |
| [`$ce-babysit-pr`](./ce-babysit-pr.md) | Watch an open pull request and coordinate feedback and CI repairs. Only the stack-land mode can merge a confirmed managed stack. |
| [`$ce-resolve-pr-feedback`](./ce-resolve-pr-feedback.md) | Evaluate existing review comments, apply appropriate fixes, and reply to the review threads. |
| [`$ce-worktree`](./ce-worktree.md) | Create an isolated worktree or attach one to an existing branch, pull request, or commit. |

## Autonomous pipeline

| Skill | Purpose |
| --- | --- |
| [`$lfg`](./lfg.md) | Run through planning, implementation, review, testing, and an open pull request, with bounded CI repair. Without a remote, stop at local commits. Does not merge. |

## Testing and design

| Skill | Purpose |
| --- | --- |
| [`$ce-test-browser`](./ce-test-browser.md) | Run browser tests for the current change using available browser tools. |
| [`$ce-test-xcode`](./ce-test-xcode.md) | Build and test an iOS app in a simulator, using screenshots, logs, and human verification rather than XCUITest. |
| [`$ce-polish`](./ce-polish.md) | Refine a working feature through user-directed live browser feedback. Invoke explicitly. |
| [`$ce-dogfood`](./ce-dogfood.md) | Run browser QA on the current branch, fix small breakages, and write a report. Invoke explicitly. |

## Collaboration

| Skill | Purpose |
| --- | --- |
| [`$ce-proof`](./ce-proof.md) | Publish, read, comment on, or edit Markdown through Proof. |
| [`$ce-handoff`](./ce-handoff.md) | Create a session handoff, or locate and read a selected continuity source. Does not automatically continue the work. |
| [`$ce-promote`](./ce-promote.md) | Draft announcement copy for a shipped feature. Does not publish the drafts. |

## Utilities

| Skill | Purpose |
| --- | --- |
| [`$ce-setup`](./ce-setup.md) | Check optional tools, create or repair project configuration, and scaffold Compound Packs. |
| [`$ce-noslop`](./ce-noslop.md) | Rewrite, check, or draft clear prose while preserving facts and required technical terms. |
| [`$ce-retune`](./ce-retune.md) | Retune a skill corpus for a new model using a measured baseline, noise checks, and evaluated changes. |
| [`$ce-riffrec-feedback-analysis`](./ce-riffrec-feedback-analysis.md) | Analyze a Riffrec recording or another screen, voice, or notes artifact into evidence for bugs or requirements. |

## Configuration and artifact locations

Project defaults are documented in [configuration](./configuration.md). [Compound Packs](./packs.md) describe shared rule folders that planning uses and review checks against.

Paths in the guides, such as `docs/plans/` and `docs/solutions/`, are defaults. Set `docs_root` to place Compound Engineering artifacts under another directory in the project; see [artifact root](./configuration.md#artifact-root).

Return to the [README](../../README.md) for setup and examples, or see [package details](../submission.md) for the source revision and contents.
