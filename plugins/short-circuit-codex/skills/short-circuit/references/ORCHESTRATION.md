# Orchestration

Use these rules for short-circuit orchestration: planning, phase execution, fresh-context judgement, model/agent selection, `codex exec`, and hooks.

## Core Posture

- Prefer explicit goals, concrete artifacts, and bounded execution over broad conversational drift.
- Separate planning, implementation, and judgement when the task is complex enough to justify the overhead.
- Keep the main agent responsible for final decisions. Planner, worker, judge, hook, and subagent outputs are inputs, not authority.
- Avoid confidence theater. Do not ask agents to be "100% confident"; ask them to identify critical missed points, mismatches, and evidence-backed risks.
- Treat model calls, subagents, hooks, and nested Codex runs as costs. Use them when they reduce failure risk more than they add latency, token use, approval friction, or complexity.
- Prefer fresh-context judgement when the main context is long, biased by its own prior choices, or likely to miss issues due to context rot.
- Treat this as a preferred workflow, not a universal claim about the best possible agentic process.
- Give the agent the product north star before the feature. State why the work exists, what it must not become, and which real user or framework need it serves.
- Treat every technical exchange as a mode choice. The user may be asking for evaluation, planning, no-change inspection, design discussion, revert, implementation, or release readiness.
- Use evidence-first correction. When a bug report, review finding, user objection, failed assumption, or external critique appears, verify it against the repo, tests, logs, docs, or runtime evidence before changing code. Apply the correction only after the finding is confirmed or the uncertainty is explicitly accepted.

## Kickoff Rules

Before non-trivial work starts, establish:

- the product intent or north star
- the expected outcome
- explicit non-goals
- the relevant artifact paths
- reference sources and their authority level
- whether the current turn is for evaluation, planning, implementation, or judgement
- repository safety: whether the workspace is git-initialized, whether untracked non-ignored files exist, and whether a user-approved branch is needed before broad mutation

Do not turn every technical question into a diff. If the user asks whether an idea is sensible, whether a report is valid, or whether a bug is real, evaluate first and wait before implementing unless they explicitly ask for changes.

When reference material is provided, assign its role:

- authority: follow unless it conflicts with the user's direct requirements
- evidence: use to verify or compare
- inspiration: extract useful ideas without owning the design
- weak signal: consider but do not let it steer the architecture

If the authority level is unclear and the reference could materially change the design, ask or state the assumption before acting.

## Ceremony Budget

Scale process to risk.

- Small local fixes: inspect the relevant repo convention, patch narrowly, run focused verification, and skip plan artifacts or fresh judgement unless risk appears.
- Medium changes: make a brief plan, verify with targeted tests/type/lint, and use fresh judgement only when public contracts, data flow, or architecture may be affected.
- Large or public-contract changes: use system design and implementation plans, phase the work, track decisions, run quality gates, and use fresh-context judgement when it can catch meaningful misses.

Do not use "keep it lightweight" as an excuse to skip necessary evidence, tests, or safety checks. Do not use "quality" as an excuse to add ceremony that the task's risk does not justify.

## Planning Workflow

For non-trivial implementation work, create two complementary plans before writing code:

1. System design plan: define the goal, boundaries, invariants, risks, non-goals, expected behavior, and consequences of the design.
2. Implementation plan: define the concrete steps, touched areas, methods, validation commands, and phase order.

Use the two plans for different jobs:

- The implementation plan should explain what to do, why each step exists, and which method or approach to use.
- The system design plan should explain the task boundaries, the goal, the reasoning behind the design, and the expected consequences of the work.

For long tasks, write the plan as an artifact, not only as chat output. A plan artifact should preserve:

- approved scope
- open questions
- phase order
- quality gates
- decisions already made
- assumptions and invalidation triggers
- explicit non-goals
- paths or modules expected to change

If the repo has no existing convention, prefer:

- `SYSTEM_DESIGN_PLAN.md` for the system design plan
- `IMPLEMENTATION_PLAN.md` for the detailed implementation plan
- `docs/phase-N-judgement.md` for phase-specific judgement reports

Plan files are draft coordination artifacts. Add `*_PLAN.md` to `.gitignore` unless the user explicitly wants a plan promoted into durable docs.

Judgement reports are coordination artifacts by default. Decide their git fate explicitly: keep them ignored/scratch for phase work, or commit them only when the user wants durable review history or release evidence.

Split substantial work into N phases. Each phase should have:

- a narrow objective
- expected files or subsystems
- implementation steps
- acceptance criteria
- verification steps
- judgement requirements, when review is worth the overhead

Treat work as non-trivial when it changes public API, package/repo structure, CI/tooling, release behavior, data contracts, agent/eval behavior, or more than a few files. Small local bug fixes can skip heavy planning when the intent and verification are obvious.

Use the plans to transfer perspective. `5.6 terra xhigh` or another execution-focused implementer should be able to apply the planner-tier perspective even when the planner-tier model is not doing the implementation itself. Prefer `5.6 sol xhigh` for planner-tier work when it is available; otherwise use `5.5 xhigh` as the planner-tier fallback.

Treat the plan as an implementation contract. If new information changes the contract, update the plan before continuing rather than relying on memory.

For long or multi-phase work, keep a compact decision ledger inside the plan or phase handoff. Do not create a separate heavyweight process unless the repo already has one.

Use this shape:

```text
Decision: <what was chosen>
Reason: <why this is the current best choice>
Source: <user instruction, repo evidence, test result, or constraint>
Invalidates if: <what new evidence would force a change>
```

Use the ledger for architectural decisions, model/workflow choices, deferred risks, assumptions about external services, and tradeoffs that future phases or fresh judges must preserve. Do not log obvious implementation trivia.

Before a phase that will mutate files, protect existing work:

- Refuse to overwrite untracked, non-ignored files without reading and preserving their content first.
- If the workspace is not a git repository, do not start broad mutation blindly. For a real Python project foundation, state the intent and prefer `uv init`, then verify `.git`; for an already-shaped non-Python workspace or plain versioning need, use `git init`; for scratch or temporary workspaces, do not initialize unless versioning is useful.
- If `pyproject.toml` already exists, do not run `uv init` over it. Read the existing file and patch missing metadata, tooling, and package structure deliberately.
- If there are untracked non-ignored files, pause broad mutation until the user decides whether to add, ignore, move, or otherwise preserve them.
- For broad or risky changes, ask before creating or switching to a new branch. Do not silently branch on behalf of the user.

## Model And Agent Selection

Do not assume the active Codex agent can autonomously switch its own model mid-turn.

Do not change models on behalf of the user based on preference or guesswork. Model changes must be user-directed or already encoded in an explicit custom agent, profile, startup flag, or session control.

Use role-based model tiers:

- `planner-tier`: the strongest practical reasoning model for system design and implementation plans.
- `implementer-tier`: a cost-effective coding model for bounded execution from a concrete plan.
- `judge-tier`: a fresh high-reasoning reviewer for implementation judgement when risk warrants it.

Reference Codex model-split patterns:

1. Detailed plan first: have the planner-tier model produce the detailed implementation plan so the implementer-tier model, such as `5.6 terra xhigh`, can implement without missing requirements and without exhausting higher-model limits. For planner-tier work, use `5.6 sol xhigh` when it is available; otherwise fall back to `5.5 xhigh`.
2. Foundation first: when laying a project's foundation, use `/goal` with the planner-tier model for the v0/foundation pass so the base is solid, then continue with the planner-tier planning plus implementer-tier implementation loop. For the planner-tier model, prefer `5.6 sol xhigh` when available and `5.5 xhigh` when `5.6 sol xhigh` is unavailable.

These references are part of the orchestration preference. They describe the intended planner/implementer/judge split and relative capability/cost tradeoff. They do not authorize Codex to switch models silently.

When model separation matters, make it explicit through the available control surface:

- use `/model` or the model selector when the user is steering an active session
- use startup flags such as `--model` for new CLI or `codex exec` runs
- use custom agent configuration when spawning specialized agents
- ask for explicit user direction when the model choice affects cost, latency, or quality materially

Use higher-capability or higher-reasoning sessions for system design, implementation planning, and difficult judgement. Use execution-focused or lower-cost models for bounded implementation only when the plan is concrete enough.

When the task matches the model-split workflow, ask about the workflow rather than picking models silently. Example questions:

- "Should I use a planner-tier / implementer-tier split for this?"
- "For v0 foundation work, should we set `/goal` and do the initial foundation pass with a planner-tier model, then continue with planner-tier plans plus implementer-tier implementation?"

Do not ask for ordinary small changes. Ask only when the task starts a new project or foundation pass, is large enough for N-phase planning, has costly missed-requirement risk, or can safely be implemented from a strong plan.

## Phase Execution Loop

For each phase:

1. Restate the phase objective and acceptance criteria briefly.
2. Implement only the scoped phase.
3. Run the smallest meaningful verification for that phase.
4. Run the phase quality gate when one is defined; quality is part of the phase, not a final ceremony.
5. Compare the result against the system design plan and implementation plan.
6. If judgement is warranted, run a fresh-context judgement pass before moving to the next phase.
7. Triage judgement findings before applying changes.

When asking for judgement, prefer concrete review prompts such as "Are there any critical points we missed in implementation?" over generic confidence prompts.

Do not let phase boundaries become ceremony. Skip extra review when the change is small, local, low-risk, and already verified.

## Batch Invocation

When code needs to run many independent slow calls, prefer bounded concurrency over serial execution.

This applies to work such as:

- many LLM calls
- many API calls
- scraping or checking many websites
- independent eval cases
- independent document or artifact processing
- independent agent or judge calls

If call `B` does not need the result of call `A`, do not make `B` wait for `A` just because a serial loop is easier to write. For example, a script that scans 100 unrelated websites should not wait for one website to finish before starting the next unless a real dependency, rate limit, or resource limit requires it.

Use the simplest concurrency shape that fits the constraints:

- If there is no meaningful rate limit and the system can handle the load, dispatch independent calls concurrently.
- If provider rate limits, memory, file descriptors, browser contexts, tokens, or network capacity matter, split work into bounded batches.
- If the safe limit is unknown, start with a conservative concurrency limit and make it configurable.
- If calls share mutable state, write the same files, contend for ports, depend on lock files, or require ordered observations, keep that part sequential.

Do not add a complex queue, worker system, or orchestration framework when a small bounded gather/map pattern is enough. Concurrency is a performance practice for independent slow work, not architecture by default.

For concurrent calls, define:

- input item identity
- concurrency limit or batch size
- timeout and retry policy
- result ordering or merge key
- failure behavior for partial errors
- single-writer behavior for output files or persistent storage

The main process remains responsible for combining results. Parallel workers may produce evidence, reports, or candidates; they do not decide final scope on their own.

## Scope Control

Guard scope in both directions:

- Do not add logic, abstractions, features, or integrations beyond the user's request and approved plan.
- Do not use "avoid extra work" as an excuse to skip required behavior, metadata, tests, docs, or cleanup.

When implementing framework, SDK, DSL, LSP, benchmark, optimizer, or tool surfaces, distinguish real primitives from case-specific patches:

- If a real example exposes a repeated need, extract a generic primitive.
- If a fix only serves the example, keep it in an adapter, example, test fixture, or do not include it.
- Do not move domain-specific details into core just to make one scenario work.

For framework work, prefer dogfooding with a real script or representative task before adding a new core primitive. The acceptance question is: "Can the real scenario now be expressed more cleanly through the framework's intended primitives?"

## Fresh Judgement Loop

Use fresh-context judgement when implementation quality matters and the main agent may be anchored to its own choices.

The judge must receive:

- Expected outcome: goal, requirements, system design plan, or implementation plan.
- Evaluation path: the workspace path the judge should inspect. Default to the workspace root when no narrower path is appropriate.
- Actual implementation: the real working tree, diff, and touched files under the evaluation path whenever available.
- Relevant decisions and assumptions: the decision ledger entries that should constrain the judgement.
- Optional evidence: relevant test output, command output, logs, constraints, or known tradeoffs. Prefer paths to artifacts plus short excerpts over dumping large logs into the prompt.
- Report path: a concrete file path where the judge must write its report. For phase work, use `docs/phase-N-judgement.md` unless the repo already has a convention.

Do not use an implementation summary as the only evidence unless the actual files are unavailable.

The judge should run in read-only mode when the tool surface supports it. The judge must not implement fixes, modify files, or proceed to the next phase.

For evaluation or optimization work, keep judge-only ground truth out of the task/generation prompt. Provide ground truth to the judge or evaluator, not to the implementer/generator being evaluated.

The judge should write a report to a file, not only to stdout. Example:

```text
Run an independent implementation judgement in a fresh context.

Expected outcome:
<goal, requirements, system design plan, and implementation plan>

Evaluation path:
<workspace root by default, or a narrower path>

Actual implementation:
Inspect the working tree, git diff, and relevant files under the evaluation path.
Do not rely only on this prompt's summary.

Evidence collection:
- inspect git status or equivalent
- inspect git diff or equivalent
- read touched files and relevant plan files
- review test/type/lint output paths or excerpts
- run no mutations

Write the report to:
docs/phase-N-judgement.md
```

The report should include:

- whether the implementation matches the expected outcome
- missed requirements
- correctness or design issues
- test gaps
- concrete fix recommendations
- uncertain findings that require main-agent verification

After the judge writes the report, the main agent must:

- read the report file
- categorize findings as valid, invalid, unclear, already handled, or out of scope
- apply only valid findings
- treat unclear findings as prompts for further inspection
- briefly state why rejected findings were not applied
- rerun relevant verification after fixes

Judge output is advisory. A fresh judge can hallucinate or overfit to the supplied artifacts.

After applying valid findings, rerun the phase's verification steps. Run a second fresh judgement only when the fixes are material, the first report found systemic design risk, or the verification result changes the phase contract; otherwise verification plus main-agent triage is enough.

## Intervention Patterns

When the agent is moving in the wrong direction, stop the drift before asking for more work.

Use short, explicit interventions:

- "Do not change files; inspect first."
- "Revert that case-specific change."
- "This is not the right source/session/context; find the correct one first."
- "Do not patch the symptom; debug the underlying integration."
- "Refresh the plan before implementing."
- "This should be generic primitive work, not example-specific logic."
- "Continue the goal; do not branch into unrelated work."

Prefer no-change inspection when the situation is unclear. Producing more diff while the abstraction, context, or source of truth is wrong increases cleanup cost.

## Using `codex exec`

Use `codex exec` for fresh judgement when a separate Codex run is the most practical way to get an isolated evaluation.

Prefer `codex exec` for:

- independent implementation review
- fresh-context critique of a completed phase
- producing a report file for the main agent to consume

Avoid `codex exec` as the default model-selection mechanism. For model selection, prefer explicit session, CLI, IDE, or custom-agent controls.

When using `codex exec`, keep the prompt bounded and artifact-driven:

- pass the expected outcome
- pass the evaluation path
- require inspection of actual files and diff
- require a report file
- avoid broad conversational history

## Host Agent Adaptation

This workflow is Codex-first but portable. When the host is not Codex, keep the same roles and artifacts but adapt the control surface:

- Fresh judgement: use a separate read-only agent/session, a task worker, or a new chat with the expected outcome, evaluation path, actual files/diff, evidence, and report path.
- Model split: translate `planner-tier` and `implementer-tier` to the host's available model classes instead of copying Codex model names.
- `codex exec`: replace with the host's equivalent isolated agent run, or manually start a fresh session that writes the report file.
- Hooks: use only deterministic local automation available in the host. Do not emulate hooks with extra model calls unless the user asks.

Codex model labels such as `5.6 sol xhigh`, `5.5 xhigh`, and `5.6 terra xhigh` are examples of planner-tier and implementer-tier roles. Treat `5.6 sol xhigh` as the preferred planner-tier model only when it is available, `5.5 xhigh` as its planner-tier fallback, and `5.6 terra xhigh` as the implementer-tier example. The role separation matters more than the literal model name.

## Hooks

Use hooks only when they reduce repeated mistakes without adding meaningful token, latency, or approval cost.

Good hook uses:

- detect that a phase ended without a required judgement report
- verify that a judge report file exists at the expected path
- warn on malformed `codex exec` judge prompts
- preserve phase state before compaction
- record touched paths or diff metadata for later review

Avoid hook uses:

- auto-spawning judge agents by default
- running expensive reviews on every turn
- duplicating what the main agent can decide cheaply
- creating recursive Codex calls unless explicitly requested
- enforcing broad policy through brittle shell scripts

Before adding a hook, ask:

- Does this prevent a recurring failure?
- Is the check deterministic and cheap?
- Can it run without extra model calls?
- Does it avoid blocking normal flow?
- Would a line in the skill be enough?

Hooks may enforce the workflow, but must not become the source of judgement.
