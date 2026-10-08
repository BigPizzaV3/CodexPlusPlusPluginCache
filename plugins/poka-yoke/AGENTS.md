# poka-yoke

Mistake-proofing for code, config, schemas and processes. The method is Shigeo Shingo's:
prefer a device that makes a wrong action impossible or self-announcing over an instruction
asking someone to avoid it.

> A comment, a docstring, a wiki page, a review checklist, or a line in an instructions file
> saying "don't do X" is **not** a poka-yoke. It is training, and training degrades. A device
> does not. If your fix relies on someone remembering something, keep going.

This applies to this file too. A rule written here competes with every other rule here and
loses a little more as the file grows. A check that fails the build does not.

## Routing

Read `skills/poka-yoke/SKILL.md` for the general method. For a specific job, read that
skill's `SKILL.md` instead — one file, not all eleven.

| Read this | When |
|---|---|
| `skills/poka-yoke/SKILL.md` | General mistake-proofing, or you are not sure which applies |
| `skills/design/SKILL.md` | New API, schema, type or state machine — make misuse unrepresentable |
| `skills/audit/SKILL.md` | Existing code: swappable arguments, silent fallbacks, unguarded deletes |
| `skills/retro/SKILL.md` | Something already broke, and the fix must close the class not the case |
| `skills/guardrails/SKILL.md` | A rule needs enforcing rather than documenting: pre-commit, CI, constraints |
| `skills/agent-guardrails/SKILL.md` | Stopping an AI agent damaging a repo: permission rules, protected paths |
| `skills/authz/SKILL.md` | Multi-tenant isolation, IDOR, row-level security |
| `skills/data/SKILL.md` | Pipelines and metrics, where failure is silently wrong numbers not a crash |
| `skills/ops/SKILL.md` | Deploys, migrations, rollback, blast radius |
| `skills/llm/SKILL.md` | Shipped AI features: structured output, tool schemas, prompt injection, evals |
| `skills/ux/SKILL.md` | Forms, destructive actions, flows users get wrong |

`references/` is loaded on demand, not up front: the hazard taxonomy is in
`references/hazard-catalog.md`, language specifics in `references/lang-*.md`.

## The scanner

```bash
python3 scripts/detect_hazards.py --paths .        # whole tree
python3 scripts/detect_hazards.py --staged         # pre-commit
python3 scripts/detect_hazards.py --diff --json    # CI, exits non-zero on findings
```

Standard library only, no install step, no network. It reports what it scanned: a scan of
zero files exits non-zero rather than reporting a clean bill of health, because an all-clear
you got by typo is worse than no check at all.

## The two axes

Rank every finding by **what happens when the mistake occurs**: Control (the wrong action
cannot be performed), Warning (possible but announces itself), Detection (you find out
afterwards), or rung zero (telling people to be careful). Then by **how the device notices**:
contact (can the wrong thing physically fit), fixed-value (is the set complete), motion-step
(is the order right and did every step happen).

State which rung the code is on now and which rung your fix reaches. A plan that stops at
Detection should say so rather than presenting itself as prevention.

## Evidence, and its limits

591 blind-graded runs across six model families, assertions written before the runs, grader
blind to configuration. The behaviour this most reliably changes is stating what a design
forecloses: 45% of responses did that unprompted, 80% with the method applied, across 132
graded verdicts.

That average conceals where the effect lives. Asked squarely to design an interface, models
already do it 77% of the time and the skills add eleven points. The large gains are where
nobody asked for a design review: writing an endpoint 14% to 79%, shipping an agent feature
33% to 83%, building a form 29% to 64%.

Every run was the first turn of a fresh session, so this measures the ceiling rather than what
survives a long working session. The baseline is *no* methodology rather than a different one,
so it does not establish that this method in particular caused the gain. And it costs
something measurable: responses became worse at spotting a raw SQL interpolation already on
the page (92% to 69%) while becoming better at changing the shape that allowed it.

If you want the bug in front of you found, use a reviewer. If you want that class of bug to
stop being expressible, use this.

Raw runs, harness and checklists: https://github.com/rainmanjam/poka-yoke
