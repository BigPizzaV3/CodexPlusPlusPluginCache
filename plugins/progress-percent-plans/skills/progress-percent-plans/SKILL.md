---
name: progress-percent-plans
description: Keep progress percentages visible and current inside Codex plan-step UI. Use automatically for every non-trivial multi-step task that creates, updates, rewrites, resumes, or reports a plan, checklist, TODO sequence, implementation, research, audit, test run, or staged workflow, even when the user does not explicitly request percentages. Do not use for trivial one-step answers.
---

# Progress Percent Plans

Keep the plan UI itself accurate enough that a user can understand current progress without reading every commentary update.

The plugin lifecycle hook re-injects the core plan policy on every user prompt, session start or resume, compaction, and subagent start. Treat that injected developer context as the always-on activation path; the user never needs to name this skill. This skill remains the detailed source of truth for calculation and update behavior.

## Start the plan

- Create a plan when the task has at least two meaningful execution stages, will run long enough to benefit from checkpoints, or the user explicitly asks for a plan, TODOs, stages, status, or percentages.
- Do not create ceremonial steps for a trivial one-step answer.
- Prefix every plan step with `[NN%]`, such as `[40%] Implement save migration`.
- Give each step its own percentage. Do not present a step percentage as an elapsed-time or remaining-time estimate.
- If planning begins after work has started, initialize percentages from evidence already available instead of resetting everything to zero.

## Calculate step progress

- Use `0%` for an untouched step and `100%` only for a step whose required output and proportional verification are complete.
- Keep the active step between `1%` and `99%`.
- Prefer stable 5% increments unless a concrete checklist or measurable batch supports finer precision.
- Base movement on completed sub-results, checks, or artifacts. Do not advance percentages merely because time passed.
- A pending step may show partial progress when preparatory work was completed in parallel, but leave its status as pending until it becomes the active step.
- If testing reveals rework, lower the affected percentage and briefly state why.

## Keep status consistent

- Call the plan update tool near the start of qualifying work.
- Treat percentage formatting as a write barrier: before every plan-tool call, verify that every step starts with exactly one `[NN%]` prefix. Do not send the update until all steps pass this check.
- Normalize suffix forms such as `Task (40%)` or `Task （40%）` to `[40%] Task`; never mix prefix and suffix styles within a plan.
- When rewriting, merging, splitting, or replacing plan steps, carry forward evidence-based percentages. Give genuinely new untouched steps `[0%]`; never omit a percentage because the wording or scope changed.
- Keep at most one step marked `in_progress`.
- Mark a step `completed` only together with `[100%]`.
- Never leave a completed step below `100%`, or a pending/in-progress step at `100%`.
- Preserve step wording and order where practical so the plan reads as one evolving record rather than a succession of unrelated plans.
- Add, split, merge, or remove a step only when the task scope genuinely changes.

## Update checkpoints

Update the visible percentages whenever any of these occurs:

- a material implementation, research, or review batch finishes;
- the active phase changes;
- a test result changes confidence or exposes rework;
- the user asks for progress or status;
- the task resumes after an interruption or context compaction;
- work is about to pause for user input or an external dependency.

When the user asks for status, update the plan before answering. Lead with the outcome, current active step, and any real blocker; do not invent an ETA.

## Resume safely

- Reconstruct percentages from existing files, test evidence, and prior plan state after interruption.
- Re-run the write-barrier check after context compaction, automatic continuation, task resumption, or a user scope change; these transitions do not relax the prefix requirement.
- Do not claim past work is complete solely because an earlier message said it was underway.
- If the plan tool is unavailable, show the same `[NN%]` prefixes in a concise status list and resume tool-backed tracking when available.

## Completion example

Use a consistent progression such as:

- `[100%] Audit requirements and affected files` — completed
- `[65%] Implement the migration` — in progress
- `[20%] Prepare regression fixtures` — pending, with fixtures drafted in parallel
- `[0%] Run full verification and package evidence` — pending

The percentages describe the completion of each named step, not the overall project.
