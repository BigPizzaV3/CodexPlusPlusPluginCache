# Validation & Clarification

## Operation

Analyze and return an actionable brief in the current conversation. Planning does not create a new assistant task or edit product code. Carry the full requested objective into the plan; separate independent work without silently discarding it.

## Goal

Decide whether the task is relevant, necessary, correctly scoped, and safe to execute as one assistant task. If valid, return the smallest set of coherent in-chat briefs that covers the requested scope. If invalid, block it with evidence.

## Validation pass

1. Identify intended behavior change, affected surface, owner layer, expected outcome, and likely validation.
2. Verify against current repository evidence whether:
   - the issue or need exists now;
   - it is already solved fully or partially elsewhere;
   - it conflicts with architecture, conventions, contracts, style, or active repository instructions (`AGENTS.md`, `CLAUDE.md` or scoped rules);
   - affected components, modules, tests, configs, docs, maps, migrations, generated artifacts, or consumers are discoverable;
   - map-only claims are verified against current owner sources before becoming implementation scope;
   - the task is the right size for one execute run / one PR.
3. Cite `path:line[-line]` or nearest stable locator such as `path#symbol` for every verdict.
4. Separate direct evidence from inference. Never present inference as repository fact.
5. Do not turn weak hypotheses, taste preferences, speculative hardening, or generic cleanup into a task brief without evidence of current impact, concrete risk, or missing required behavior.
6. If the task bundles independent fixes, separate coherent briefs and retain every requested outcome. Ask only when a consequential missing decision cannot be resolved from evidence.
7. Ask a concise clarifying question only when a missing product/business/contract decision prevents safe execution and repository evidence cannot resolve it.

## Verdict handling

- If the task is not needed, already solved, unsupported by repo evidence, incorrectly formulated, or aimed at the wrong owner layer, start with `⚠️ Task is not relevant:` and give a short reason with `path:line[-line]` evidence.
- If the task is relevant, return coherent task briefs covering the requested scope with unambiguous scope, expected result, evidence, acceptance criteria, and validation.
