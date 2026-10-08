---
name: learn-from-work
description: Learn reusable working methods from selected experience and propose handbook practices, checks, Playbooks, templates, or coordinated improvements. Use the current conversation, exact selected sessions, or explicitly supplied work evidence. Return editable Shape Handbook requests without writing files or applying proposals automatically. Do not use for research or analysis unrelated to working methods.
---

# Learn From Work

Before applying this skill, read the full [Trellis methodology](references/methodology.md).

Find what selected experience suggests preserving or improving about how an area
works. Recommend the form that serves the lesson; do not force every useful
distinction, check, or template into a Playbook. Learning produces proposals,
not handbook changes or automatic calls to Shape Handbook.

## Select the evidence

Use the current conversation by default, exact sessions selected by the user and
retrievable through the host, or explicitly selected work evidence such as artifacts
or an account of an episode. Do not enumerate unselected history, guess identifiers,
inspect adjacent conversations, or search unrelated folders to fill gaps. A selected
session does not authorize reading every file or service mentioned in it.

Report unavailable, ambiguous, or partial sources individually and continue with
usable evidence. State which sources you examined. If host limits require batches,
identify them rather than silently sampling or omitting sources. Reconstruct each
episode independently before comparing patterns. One source cannot establish what
an unavailable source contained.

When a handbook or surrounding area is selected, inspect relevant existing method
and shared guidance to judge fit and avoid duplication. Resolve workspace and area
from the request, project instructions, and README. A handbook is `<area>/handbook/`;
its parent owns the area. Its README may declare the workspace through:

```html
<!-- trellis:handbook {"format":1,"workspace":"../.."} -->
```

The path is relative to the handbook; a workspace-root handbook uses `..`. Verify
physical scope against the selected workspace, which need not be a Git repository.
Do not use the current directory, a marker, or symlinks to expand ambiguous scope.
Resolve multiple selected handbooks separately. Root and nested guidance can both
apply; ancestry does not settle conflicting rules. Avoid unrelated areas.

A destination need not be chosen before a useful proposal can be made. State any
unresolved handbook choice rather than inventing it. Ask only when the answer
materially changes the proposed method or its fit.

## Reconstruct before drawing lessons

Identify the starting situation, intended outcome, context, constraints, decisions
and cues, actions, results, verification, failures, and recovery relevant to the
proposed lesson. Distinguish direct observations, the user's account, stated intent,
and inference. An artifact records its contents; it does not establish an unobserved
process or prove that its author followed a particular method.

Look for useful turning points: a hidden constraint, correction, meaningful
distinction, failed approach, check that exposes an important distinction,
recurring difficulty, or recovery.
Prefer reasoning that would change future work over a chronology of tool calls.

An unfinished attempt can suggest a method without demonstrating its outcome.
Success does not establish which actions caused it or whether the method generalizes.
Consider another explanation, such as a reviewer's correction or a favorable input,
and a situation where the lesson would not help. Keep these interpretations distinct
from observed evidence; do not invent a counterexample or claim an unperformed
comparison. Current clarification can shape a proposal without rewriting the selected
evidence. Repetition alone does not turn a pattern into adopted policy.

When a missing fact or interpretation would change the lesson, ask a focused
question before finalizing that recommendation. Ground it in the selected episode:
what prompted a correction, which outcome mattered, what happened afterward, or
where the proposed method would not fit. Ask only questions whose plausible answers
would change the advice, and use answers already present in the sources. Do not
hand the analysis back as a generic reflection questionnaire.

Wait for the answer on that dependency while continuing supported independent
analysis. Use the reply to revise, narrow, or discard the candidate lesson, keeping
the user's present account distinct from inspected historical evidence. If the
answer is unknown or declined, state what remains tentative; do not keep asking
or convert uncertainty into a causal claim. Enough evidence needs no extra interview.

## Choose useful handbook improvements

Consider what would help a future contributor:

- **Practice:** a working distinction, convention, approach, or interpretation that
  changes recurring decisions.
- **Check:** an independently applicable expectation with concrete verification
  and meaningful outcomes.
- **Playbook:** a coherent repeatable task with a clear trigger, judgment, method,
  outcome, completion evidence, and meaningful recovery or stop conditions.
- **Template:** an adaptable structure or substantive prompts that improve
  repeated authoring.
- **Coordinated refinement:** an existing handbook concern that needs clearer
  ownership, links, scope, organization, or changes across several artifact types.

For a candidate lesson, identify a recognizable cue, the decision it would change,
why that change might help, its applicability and exceptions, and evidence that
could test it. Use these to assess usefulness, confidence, and maintenance cost;
they do not require separate headings. Prefer refining an existing owner when it
already covers the concern. Keep connected changes together and independently
useful proposals separate. Finding nothing worth preserving is a valid result.

Propose how to improve the working method while leaving the actual work in its
existing files. Judge mixed material statement by statement: a current task list,
result, or frequently consulted fact is not itself a reusable method. Link to the
authoritative work files when needed rather than copying their content. Replace
incidental names, dates, values, and paths with parameters. Never retain secrets,
unnecessary personal data, transcripts, or session identifiers in proposed handbook
artifacts.

## Return self-contained, editable requests

Lead with the useful conclusion: what could change next time, when it would help,
what supports it, and what remains uncertain. A question alone does not complete
the reflection after an answer is available. Explain a supported no-change result;
do not invent a lesson to fill a quota. For each worthwhile proposal, then return
a request the user can edit, combine, ignore, or choose, for example:

```text
Use $shape-handbook to refine [selected handbook, if known] so future [work] can
[working improvement]. Preserve [practice or distinction], define [check and
verification] where useful, and update [relevant template or existing owner].
The selected evidence shows ... It leaves ... unresolved. Keep ... visibly proposed.
```

Include enough context to shape the method without reopening the source conversation:
applicability, proposed change, useful decisions and exceptions, verification,
authoritative sources or existing material to revise, observed evidence and its limits,
and remaining dependencies. Distinguish inspected results from interpretations and
proposed work. Keep consequential inferred rules proposed until adopted. Do not invent
policy, credentials, endpoints, authority, or proof of effectiveness.

When proposing a Playbook, explicitly describe the procedure to preserve and its
outcome in the request. The user must choose that proposal or independently request
the procedure before it is created. A learning recommendation is not itself that
authorization. Suggest supporting scripts only when materially useful and explain
their proposed role within the workspace; do not generate them.

## Read-only boundary

Prefer direct file reads; when shell reads are needed, use a non-login shell to
avoid cache-writing login hooks.

Perform no filesystem writes, including reports, transcripts, temporary files,
caches, or generated artifacts. Return proposals in the response and never invoke
Shape Handbook automatically. Do not execute described work, Playbooks, scripts,
or tests; install dependencies; edit `AGENTS.md`; initialize Git; stage, commit,
push, publish; or communicate with others. Learning a method neither performs it
nor grants authority to perform it later. Another agent using the proposal retains
its separately authorized task permissions; neither operation inherits the other's
authority, and delegation cannot bypass this skill's boundaries.
