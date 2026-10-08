# Eval And Optimization

Use these rules when designing benchmarks, evaluation specs, prompt/code optimization, judge workflows, feedback loops, and traces.

## Recommended Ecosystem

Pydantic Evals is a first-class recommendation for evaluation workflows when it fits the project. Use it for structured datasets, evaluators, reports, and repeatable evaluation runs when the Pydantic AI ecosystem is already appropriate.

This is a recommendation, not a requirement. If the repo already has a stronger eval stack, benchmark harness, or domain-specific evaluator, use that instead.

Relevant docs are covered by the Pydantic AI llms.txt link:

- https://pydantic.dev/docs/ai/llms.txt

## Separation Of Inputs

Keep these separate:

- task input
- generation prompt
- candidate output
- judge-only ground truth
- feedback
- score
- trace
- optimizer state

Ground truth belongs to the judge/evaluator, not to the generator being evaluated.

Do not leak `expected_scenario`, answer keys, or hidden criteria into the task prompt when the goal is to measure generation quality.

Judgement modes:

| Mode | Evaluated artifact | Ground truth visibility | Report consumer |
| --- | --- | --- | --- |
| implementation judgement | actual code, diff, plans, verification evidence | requirements and plans are visible; hidden eval keys usually not relevant | main agent triages findings before fixes |
| generation eval | candidate output from a model/tool/prompt | judge/evaluator may see ground truth; generator must not | evaluator/optimizer records score, feedback, and trace |

Do not reuse an implementation-review prompt for generation eval if it would leak judge-only truth into the generator side.

## Evaluation Evidence

A model's claim is not evidence. Prefer executed, replayable, inspectable artifacts:

- generated eval specs
- replay results
- traces
- scores
- textual feedback
- candidate diffs
- metric breakdowns
- run metadata

Benchmarks should produce evidence that another agent or human can inspect.

## Scoring Discipline

Do not let parse success, compile success, or test count become the only score when semantic correctness matters.

Consider:

- correctness
- semantic match
- code quality
- runtime behavior
- output quality
- size or complexity metrics when relevant
- textual judge feedback
- failure category
- regression risk

A benchmark or optimizer should know what it is optimizing and what it must not optimize away.

## Trace And Feedback

Optimization needs traceability.

Record:

- input
- generated output
- relevant code
- feedback
- score
- judge reasoning summary or report
- candidate lineage
- metric effects
- version information for prompts/assets/models when relevant

Trace should support later debugging and paper/report-quality analysis, not only immediate optimization.

## Avoid Self-Deception

Watch for optimizer failure modes:

- ground truth leakage
- task-specific memorization
- compile success treated as semantic success
- missing negative examples
- missing feedback text
- no candidate lineage
- no replay path
- no separation between training signal and evaluation signal

Tuning should improve general rules or prompts, not hard-code one task's answer.

## Judge Workflow

For judgement:

- give the judge the expected outcome
- give the judge the actual implementation or generated output
- give judge-only truth only when appropriate
- request concrete findings and evidence
- write reports to files when the main agent will consume them
- have the main agent triage findings before applying changes

Judge output is feedback, not authority.
