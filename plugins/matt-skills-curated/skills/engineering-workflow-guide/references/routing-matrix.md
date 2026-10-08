# ChatGPT Skill Routing Matrix

This matrix maps common user prompts and engineering intents to the exact primary skill, secondary pipeline, and negative exclusions.

---

| User Intent / Phrasing | Primary Skill | Lifecycle Pipeline | Do NOT Use When |
|---|---|---|---|
| "Explore ideas", "Interview me", "Poke holes in my plan" | `grill-me` | `grill-me` ➔ `to-spec` | Requirements already formal & clear |
| "Capture decisions into ADR", "Define domain terms" | `grill-with-docs` | `grill-with-docs` ➔ `to-spec` | Writing production application code |
| "Write a technical spec", "Formalize requirements" | `to-spec` | `to-spec` ➔ `to-tickets` | Spec already written & approved |
| "Break down into tickets", "Create task graph", "Tracer bullets" | `to-tickets` | `to-tickets` ➔ `implement` | Requirements ambiguous or unapproved |
| "Ask stakeholder questions", "Async requirements survey" | `to-questionnaire` | `to-questionnaire` ➔ `to-spec` | Information already in repository |
| "Quick prototype", "UI spike", "Throwaway exploration" | `prototype` | `prototype` ➔ `grill-with-docs` | Building permanent production features |
| "Design operational process", "Write SOP", "Review loop" | `workflow-designer` | `workflow-designer` ➔ `to-spec` | One-off manual script execution |
| "Research third-party API", "Investigate documentation" | `research` | `research` ➔ `to-spec` | Reading local project code files |
| "Define entity models", "Ubiquitous language", "CONTEXT.md" | `domain-modeling` | `domain-modeling` ➔ `codebase-design` | Generic database table migrations |
| "Design deep modules", "Module interface seams", "Ousterhout" | `codebase-design` | `codebase-design` ➔ `implement` | Trivial one-line helper functions |
| "Audit codebase architecture", "Git churn hotspot analysis" | `improve-codebase-architecture` | `improve-codebase-architecture` ➔ `setup-ts-deep-modules` | Routine single-file bug fixing |
| "TypeScript boundaries", "dependency-cruiser rules" | `setup-ts-deep-modules` | `setup-ts-deep-modules` ➔ `code-review` | Non-TypeScript codebases |
| "Unsafe test typecasts", "Migrate to shoehorn" | `migrate-to-shoehorn` | `migrate-to-shoehorn` ➔ `code-review` | Production application types |
| "Implement approved spec", "Code feature", "Build ticket" | `implement` | `implement` ➔ `code-review` | Requirements fuzzy or unapproved |
| "Parallel subagents", "Isolated worktrees", "Multi-agent PR" | `implement-spec` | `implement-spec` ➔ `code-review` | Single developer / single-file edit |
| "Test-driven development", "Red-green-refactor", "Write tests" | `tdd` | `tdd` ➔ `code-review` | Throwaway exploratory spikes |
| "Diagnose bug", "Fix failing test", "Flaky CI", "Crash" | `diagnosing-bugs` | `diagnosing-bugs` ➔ `tdd` ➔ `code-review` | Trivial obvious syntax errors |
| "Review PR", "Review branch diff", "Check standards" | `code-review` | `code-review` | Writing new code or diagnosing bugs |
| "Merge conflict", "Rebase conflict", "Fix conflict markers" | `resolving-merge-conflicts` | `resolving-merge-conflicts` ➔ `code-review` | Routine safe git rebases without conflicts |
| "Prevent force push", "Block dangerous git", "Hard reset guard" | `git-safety-guardrails` | `git-safety-guardrails` | Safe git status or log commands |
| "Setup issue tracker", "Configure triage labels", "Setup docs" | `setup-engineering-workflows` | `setup-engineering-workflows` | General npm package installation |
| "Setup Husky", "lint-staged", "Prettier pre-commit hook" | `setup-pre-commit` | `setup-pre-commit` | Remote CI/CD pipeline automation |
| "Triage incoming issues", "Author agent brief", "Out of scope" | `triage` | `triage` ➔ `implement` | Internal tickets from to-tickets |
| "Map huge project", "Multi-session effort", "Fog of war" | `wayfinder` | `wayfinder` ➔ `to-spec` | Small, single-session feature work |
| "Interactive bash wizard", "Dashboard credentials setup" | `wizard` | `wizard` | Tasks the AI can execute directly |
| "Train ML model", "LoRA fine-tuning", "vLLM serving" | `ai-engineering` | `ai-engineering` ➔ `ml-best-practices` | Standard CRUD backend development |
| "Self-healing data pipeline", "AST-validated data fixes" | `ai-data-remediation` | `ai-data-remediation` ➔ `code-review` | Routine database schema migrations |
| "Statistical ML", "95% bootstrap CIs", "EDA", "Data leakage" | `ml-best-practices` | `ml-best-practices` ➔ `ai-engineering` | Basic spreadsheet formatting |
| "Inner cognitive workspace", "Three registers", "Deep thinking" | `j-space` | `j-space` ➔ `implement` | Trivial single-step lookups |
| "Synthesize /goal prompt", "Overnight autonomous run" | `goal` | `goal` ➔ `implement-spec` | Immediate single-turn execution |
| "Author new skill", "Skill evals", "10 Canonical Principles" | `skill-conductor` | `skill-conductor` ➔ `writing-for-agents` | General application coding |
| "Compact session", "Transfer context", "Save handoff" | `handoff` | `handoff` | Committing code to git |
| "Session retrospective", "Audit agent mistakes" | `retro` | `retro` ➔ `writing-for-agents` | Active mid-task implementation |
| "Re-pitch simpler", "Explain in plain English", "Wait what" | `wait-what` | `wait-what` | Initial planning or brainstorming |
| "Teach technical concept", "Interactive HTML lab", "ZPD" | `teach` | `teach` | Silent autonomous code generation |
| "Write agent instructions", "AGENTS.md rules", "Context pointers" | `writing-for-agents` | `writing-for-agents` ➔ `skill-conductor` | Human-facing marketing copy |
| "Brainstorm essay notes", "Capture raw fragments", "Metaphors" | `writing-fragments` | `writing-fragments` ➔ `writing-shape` | Final draft formatting |
| "Shape notes into draft", "Block-by-block article assembly" | `writing-shape` | `writing-shape` ➔ `writing-beats` | Initial raw fragment generation |
| "Narrative beats", "Beat-by-beat drafting journey" | `writing-beats` | `writing-beats` | Quick single-sentence edits |
| "Scaffold exercise folders", "Workshop tutorial boilerplate" | `scaffold-exercises` | `scaffold-exercises` ➔ `code-review` | Application feature scaffolding |
