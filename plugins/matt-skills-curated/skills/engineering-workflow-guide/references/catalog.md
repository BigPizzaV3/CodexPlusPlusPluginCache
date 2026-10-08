# Curated Skill Catalog

Use one primary skill by default. Add another only for a distinct phase.

## Discovery and planning

- `grill-with-docs`: Use when a plan or design needs a focused interview and the resulting domain terms or architectural decisions should be captured in project documentation as they are resolved.
- `grill-me`: Use when a plan, design, requirement, or decision needs a focused interview to expose ambiguity, missing constraints, trade-offs, or weak assumptions before execution.
- `grilling`: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
- `to-spec`: Use when the current conversation and repository context are sufficient to synthesize a buildable specification without another interview, including implementation and testing decisions.
- `to-tickets`: Use when an approved plan, spec, or current conversation should be decomposed into ordered tracer-bullet implementation tickets with explicit dependencies on the configured tracker.
- `wayfinder`: Use when a goal is too large or uncertain for one agent session and needs a shared map of decision tickets, blockers, claims, and resolved context across multiple sessions.
- `prototype`: Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like.
- `research`: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
- `to-questionnaire`: Use when a decision, spec, or implementation question depends on facts only another stakeholder can provide and those unknowns should be turned into a precise questionnaire.
- `workflow-designer`: Use when a recurring task, operational routine, content process, review loop, or personal/team workflow should be turned into an implementable specification with triggers, inputs, actions, human checkpoints, outputs, failure handling, and ownership.

## Implementation and quality

- `implement`: Use when a concrete spec, approved plan, or set of tickets is ready to implement and the task requires scoped code changes plus verification.
- `implement-spec`: Use when a specification with associated task-graph tickets is ready to implement across multiple subagents or isolated branches, and the goal is a complete pull request on a single branch.
- `tdd`: Use when implementing a feature or fixing a bug test-first with a red-green cycle, or when the task needs durable integration-style tests around public behavior.
- `code-review`: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes - Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
- `diagnosing-bugs`: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
- `resolving-merge-conflicts`: Use when you need to resolve an in-progress git merge/rebase conflict.
- `migrate-to-shoehorn`: Use when TypeScript tests rely on unsafe `as` or `as unknown as` assertions for fixtures and the user wants to migrate those test-only values to `@total-typescript/shoehorn` with explicit intent.

## AI and Machine Learning

- `ai-engineering`: Design, train, fine-tune, optimize, and serve production ML models and LLMs with strict train-test isolation, naive baselines, fairness audits, and sub-100ms latency budgets.
- `ai-data-remediation`: Self-healing data pipeline layer using semantic anomaly clustering, AST-validated lambda transformations, and zero-loss mathematical reconciliation.
- `ml-best-practices`: Statistical ML standards for exploratory data analysis, missing value strategy, dual-model benchmarks, 95% bootstrap confidence intervals, and story-first notebook structures.

## Cognitive and Autonomous Orchestration

- `j-space`: Operate the inner cognitive workspace for multi-step chained reasoning, long-horizon planning, calibrated confidence, three registers (inner/ledger/outer), and seam invariant audits.
- `goal`: Synthesize high-leverage autonomous /goal prompts and contracts with observable done criteria, verified resource inventories, and terminal goal anchoring for unattended execution.
- `skill-conductor`: Full lifecycle management for agent skills (draft, test, review, improve, package) using the 10 canonical authoring principles and BinEval 5-dimension scoring.

## Design and architecture

- `domain-modeling`: Build and sharpen a project's domain model. Use when the user wants to pin down domain terminology or a ubiquitous language, record an architectural decision, or when another skill needs to maintain the domain model.
- `codebase-design`: Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find deepening opportunities, decide where a seam goes, make code more testable or AI-navigable, or when another skill needs the deep-module vocabulary.
- `improve-codebase-architecture`: Use when a codebase needs architectural review for shallow modules, weak seams, low locality, or deepening opportunities, followed by a visual report and focused design discussion.
- `setup-ts-deep-modules`: Use when a TypeScript repository should enforce package entry points, hidden implementation folders, tests through public interfaces, and cycle checks with dependency-cruiser, especially in a flat packages directory or monorepo.

## Repository safety and setup

- `setup-engineering-workflows`: Use when repository workflows need explicit issue-tracker, triage-label, domain-document, or agent-instruction conventions before planning, triage, wayfinding, or ticket work can run reliably.
- `setup-pre-commit`: Use when a JavaScript or TypeScript repository needs reliable pre-commit quality checks with Husky and lint-staged, while preserving the repository's package manager, formatter, existing hooks, and test/typecheck conventions.
- `git-safety-guardrails`: Use when a repository needs explicit safeguards around destructive or irreversible Git operations, especially force pushes, hard resets, cleans, destructive restores, branch deletion, or history rewrites.
- `triage`: Use when repository issues or external contribution requests need classification, verification, missing-information follow-up, rejection handling, or a durable agent-ready implementation brief.
- `wizard`: Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infrastructure, setting up credentials or CI secrets, walking an unfamiliar third-party dashboard, or running a one-off migration or cutover. Don't invoke this for steps the agent can perform itself.

## Continuity and communication

- `handoff`: Use when the current work, decisions, evidence, blockers, and next actions need to be compacted into a durable handoff for another agent or a later session.
- `retro`: Use when conducting a retrospective on a coding session to identify actionable improvements to the agent environment, navigation pointers, automated checks, coding standards, tool economy, or AGENTS.md instructions.
- `wait-what`: Use when the previous explanation or proposal did not land and should be re-pitched from a different angle, with assumptions reset and the confusing part made explicit.
- `teach`: Use when the user wants to learn a technical concept or skill from the current workspace through an adaptive explanation, examples, checks for understanding, and durable learning records.
- `writing-for-agents`: Use when creating or editing agent-facing Skills, AGENTS.md or CLAUDE.md instructions, referenced agent documents, context pointers, templates, or other reusable guidance consumed by an agent.

## Writing and learning content

- `writing-fragments`: Use when the user wants to develop an article, essay, post, script, or other long-form piece by first collecting strong raw fragments without committing to an outline or final structure.
- `writing-shape`: Use when the user has a fixed pile of notes, fragments, transcript material, or research and wants to shape it into a coherent article or long-form draft one block at a time without altering the source material.
- `writing-beats`: Use when the user wants an interactive long-form writing process that progresses through small narrative or argumentative beats, offering a few valid next moves at each step while keeping the reader's required context clear.
- `scaffold-exercises`: Use when a course, workshop, tutorial, or training repository needs new exercise folders, problem/solution/explainer variants, starter files, numbering, or lint-ready scaffolding that follows the repository's own conventions.
