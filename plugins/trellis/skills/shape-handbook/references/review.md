# Review the handbook

Review asks what makes the selected handbook useful, coherent, and maintainable.
It returns findings without filesystem writes or execution. Do not initialize a
missing handbook or apply suggested fixes merely because a review exposed them.
If the user also requested refinement, use the findings to guide those authorized
changes under the relevant authoring references.

Inventory the selected README, practices, checks, Playbooks, templates, and support
files. Honor narrower scope. Otherwise cover the selected material and report
omissions; use bounded batches rather than silently sampling. Inspect relevant area
sources when a finding depends on them, and state limits when sources are unavailable.
Unrelated owner material is not a defect because Trellis did not create it.

## Assess usefulness

Begin with the area's work and a future decision its handbook should improve.
Identify when a contributor would need the guidance and how they could check the
result. Use these questions where they bear on the requested scope, then examine
the artifacts that support the answers. Follow the README as a reader without the
Trellis skills or original conversation. Check that it explains how to use the
available guidance and makes the relevant owner reachable. Distinguish missing
orientation, an unresolved owner decision, and an actual contradiction; each needs
a different repair. Ask for owner input only when needed for a supported finding,
otherwise report the decision needed without turning review into a compulsory interview.

| Dimension | Review question |
| --- | --- |
| Continuity | Can the next contributor find the applicable working method without reconstructing past conversations? |
| Context | Can they find the scope, working constraints, and source material their task depends on? |
| Quality and review | Are expectations, verification, and evidence limits clear for the work's current status? |
| Learning | Does selected experience reveal recurring problems or useful lessons worth proposing for the working method? |
| Shared understanding | Are responsibilities, important distinctions, and expectations clear across contributors? |
| Knowledge organization | Can readers find authoritative guidance without reconciling duplicate accounts? |
| Local relevance | Does the guidance improve a decision in this area enough to justify the reading, steps, and maintenance it adds? |
| Ongoing improvement | What needs clarification, correction, or removal in light of documented changes to the work? |

Apply judgment to the area's needs and the evidence available. These dimensions
do not require corresponding handbook sections or a score for every question.
Tie each finding to a concrete gap and its consequence for the work. Prefer a
correction at the existing owner when it serves the same decision. A no-change
review is useful when the current guidance suffices. Missing historical evidence
does not itself establish a defect. For learning, use only experience already
selected for this review; further investigation can be proposed
when needed. Keep proposed lessons distinct from adopted guidance. Reviewing a
handbook does not invoke Learn From Work, adopt a proposal, or create a Playbook.

## Assess the working arrangement

- **Scope and ownership:** README purpose, workspace declaration, authoritative work
  files, useful navigation, local links, and deliberate shared/local specializations.
- **Practices:** the decisions they change, applicability, meaningful distinctions,
  exceptions, and a clear distinction between proposed and adopted guidance.
- **Checks:** independent applicability, evaluable requirements, actual verification,
  and meaningful pass, fail, unable, and not-applicable outcomes.
- **Playbooks:** when to use them, outcome, context, judgment, connected method, applicable
  checks, completion evidence, and useful recovery or stop conditions.
- **Templates:** substantive prompts, adaptable structure, and sample instructions
  clearly distinguished from adopted local policy.

Compare artifacts for overlap, contradictory expectations, fragmented reasoning,
duplicated shared rules, and mismatched scopes. Judge mixed documents statement by
statement. Current task lists, agreed plans, customer records, and actual review
findings remain with the work they concern. Empty categories and an otherwise
empty handbook are valid without a concrete unmet need.

Do not review the actual work merely to examine the definition of its check.
An open question may satisfy draft completeness without resolving the decision;
filled headings and valid links do not establish substantive support.

## Inspect support and maintenance evidence

Read referenced scripts statically. Compare their source with the documented
interpreter, dependencies, workspace and task scope, inputs and outputs, effects,
invocation, verification, and recovery. Identify implicit targets, escaping paths
or symlinks, undeclared network or secret access, and effects on data outside the workspace.
Do not run scripts, tests, or Playbooks during review. Explain static inspection
limits; source path guards are not a sandbox for arbitrary code.

Base maintenance findings on concrete evidence: conflicting current guidance,
broken references, explicit replacement, observed failures, changed requirements,
or a documented contract that differs from source. Age or missing telemetry alone
does not prove staleness or disuse. A directly requested method need not have an
operational history, but claims of effectiveness require evidence.

Lead the report with scope, coverage, and consequential findings. For each, identify
the affected path, evidence, practical consequence, and smallest useful next step.
Separate demonstrated defects, proposed improvements, and unresolved uncertainty.
Recommend outside-handbook corrections without making them. A clean review does
not prove agent compliance, successful execution, or correctness of the underlying work.
