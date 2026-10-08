# Marketplace submission draft

## Listing

- Plugin name: Progress Percent Plans
- Identifier: `progress-percent-plans`
- Category: Productivity
- Version: 1.0.2
- Publisher draft: Kingsley_Li (`kingsleyli920`)
- Short description: Keep multi-step plans visibly updated by percentage.
- Long description: Progress Percent Plans gives Codex an always-on way to show honest completion percentages directly inside every multi-step plan. Local lifecycle hooks re-inject the policy on every prompt, resume, compaction, and subagent start, so users do not need to invoke the skill by name. It updates percentages at material checkpoints, keeps status and completion values in sync, preserves progress across interruptions, and avoids turning percentages into fake time estimates. It has no authentication, network access, data collection, or external service dependency.
- Website: https://github.com/kingsleyli920/progress-percent-plans
- Support: https://github.com/kingsleyli920/progress-percent-plans/issues
- Privacy policy: https://github.com/kingsleyli920/progress-percent-plans/blob/main/PRIVACY.md
- Terms: https://github.com/kingsleyli920/progress-percent-plans/blob/main/TERMS.md

## Starter prompts

1. Plan this task with visible percentages and keep them updated.
2. Show the current progress percentage of every plan step.
3. Turn this TODO into a percentage-tracked execution plan.

## Data handling

- Skill plus local lifecycle hooks; no MCP server or app connector.
- No authentication or external network requests.
- No user data collection, analytics, cookies, or remote storage.
- It only instructs Codex how to format and update the host plan state.

## Positive review cases

1. Prompt: `Implement a login flow, test it, and package the release. Keep me updated.`
   Expected: Creates a multi-step plan immediately, prefixes every step with `[NN%]`, keeps one active step, and updates percentages after implementation and tests.
2. Prompt: `Audit this repository for stale documentation and fix what you find.`
   Expected: Uses separate audit, repair, and verification steps with evidence-based percentages.
3. Prompt: `Research three options, recommend one, then write a rollout plan.`
   Expected: Tracks research and rollout stages independently; does not treat percentages as ETA.
4. Prompt: `What is the current status?`
   Context: A qualifying plan is already active.
   Expected: Updates the plan before answering and reports the active step and any real blocker.
5. Prompt: `Continue the interrupted migration from the files and test logs already present.`
   Expected: Reconstructs percentages from evidence instead of resetting all steps to zero.

## Negative review cases

1. Prompt: `What is 2 + 2?`
   Expected: Answers directly without creating a ceremonial plan.
2. Prompt: `Translate “good morning” into Chinese.`
   Expected: Completes the one-step request without invoking percentage tracking.
3. Prompt: `Do this task, but do not create a plan or show progress percentages.`
   Expected: Follows the explicit user instruction and does not use the skill behavior.

## Publisher fields to confirm at upload time

- Verified developer or business identity shown by the OpenAI account.
- Country availability and final public publisher name.

## Release notes

Version 1.0.2 adds automatic policy injection on every prompt, resume, compaction, and subagent start. It keeps evidence-backed per-step progress percentages, checkpoint updates, interruption-safe resumption, status consistency rules, and explicit boundaries that avoid ceremonial plans for one-step requests.
