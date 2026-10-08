---
name: shape-handbook
description: Create, adopt, review, or refine selected area handbooks, coordinating practices, checks, Playbooks, and templates. Use when the user asks to shape working methods or assess a handbook. Review requests stay read-only; ordinary work does not itself request handbook changes or Playbook creation.
---

# Shape Handbook

Before applying this skill, read the full [Trellis methodology](references/methodology.md).

Help the selected handbook improve a future contributor's decisions about the
area's work. Choose the smallest coherent change that serves the requested outcome;
the user need not divide a concern into separate practice, check, and template tasks.

## Follow the requested intent

A request to create, adopt, or refine a handbook authorizes the corresponding
changes. A review request asks for findings and remains read-only. If the user asks
for review and fixes, apply the requested fixes within scope. Do not require a
special invocation, a named mode, or repeated confirmation of existing authority.

Creating a Playbook requires a request to preserve that procedure, or the user's
acceptance of a proposal that clearly includes it. Broad improvement, a review
finding, or a learning recommendation alone does not authorize inventing Playbooks.
An intended procedure can be written without prior successful use; creating it
does not demonstrate its effectiveness or carry it out.

## Resolve the handbook and its owners

Resolve the workspace and owning area from the request and applicable project
instructions. A workspace is an identified working directory, not necessarily a
Git repository. Do not select the current directory when plausible alternatives
would materially change scope. Each handbook lives at `<area>/handbook/`; its
parent is the owning area and must be inside the selected workspace.
Verify that the workspace and owning area already exist as directories. Never
create their missing parents: every setup write must remain inside the handbook.

Read an existing README's single marker to check its declared workspace:

```html
<!-- trellis:handbook {"format":1,"workspace":"../.."} -->
```

The workspace path is relative to the handbook; use `..` for a workspace-root
handbook. Verify physical locations against the selected scope. The marker does
not grant authority over another workspace or ownership of every existing file.
Resolve each handbook separately in a multi-handbook request.

Inspect the requested area, applicable shared guidance, and explicitly selected
evidence. Do not search unrelated areas merely because they share a workspace.
Root and nested handbooks can both apply; ancestry alone does not settle conflicts.
Link shared rules at their owners, explain deliberate local specializations, and
raise consequential unresolved conflicts.

The handbook preserves how people do and review the work. Keep current plans,
drafts, decisions, and results in the area's working files. Judge mixed documents
statement by statement and link to the authoritative files for the work.
Extracting a practice does not authorize cleaning up its source outside the handbook.

## Resolve decisions before encoding them

Identify the future task or decision the requested change should help. Inspect the
selected sources first. Retrieve answers available there; ask the user about a
missing purpose, conflicting rule, acceptable tradeoff, or exception only when
different answers would change the guidance. Explain the concrete choice and its
consequence, offering grounded alternatives when useful. Do not ask the user to
design the handbook or choose artifact types.

Ask a small batch of consequential questions and wait for the answers before
encoding the dependent rules. Continue independent work where possible. Existing
instructions or explicit owner direction can settle a choice without another
confirmation. If the user cannot decide, keep that dependency visibly unresolved
or proposed; do not silently choose policy or claim the dependent work is complete.
A clear request needs no questionnaire. Review can report an unresolved choice
as a finding without requiring the user to settle it first.

## Load the guidance needed for this request

- [Setup](references/setup.md): create or adopt a handbook, or materially revise its
  README's scope, navigation, or explanation of use. Read the README starter when
  writing that explanation; return the setup blurb only for setup or adoption.
- [Practices](references/practices.md): clarify working conventions, distinctions,
  ownership, method selection, and interpretation of evidence.
- [Checks](references/checks.md): define independently evaluable expectations and
  their concrete verification.
- [Playbooks](references/playbooks.md): preserve a requested procedure and its
  optional supporting scripts.
- [Review](references/review.md): assess a handbook and relevant sources without
  executing its work; use the findings within any separately requested refinement.

Read the relevant task references together when one concern spans artifact types. Adapt
the bundled assets and applicable local templates to the task.
Create local templates only for useful reuse. Filling headings does not establish
substantive adequacy, and sample instructions do not become adopted local policy.

## Keep effects within scope

All filesystem writes, including temporary files, generated support, fixtures,
caches, and test outputs, stay inside the selected handbook. A review-only request
performs no filesystem writes. For review-only work, prefer direct file reads;
when shell reads are needed, use a non-login shell to avoid cache-writing login hooks.
Resolve destinations physically and inspect every parent directory in the path. Reject
traversal or symlinks that escape the handbook. Do not follow a handbook
symlink to widen the boundary. Re-read targets before overwriting, reconcile
concurrent changes that invalidate the edit, and preserve unrelated owner content.

Show affected paths and material decisions before writing, using existing
authorization to proceed. Recommend required outside-handbook changes instead of
making them. Never edit `AGENTS.md`, initialize Git, stage, commit, push, publish,
install outside the handbook, or communicate with others through this skill.
Do not carry out the underlying work. Supporting-script tests use only
fixtures inside the handbook and host confinement as described in the Playbook
reference; authoring a procedure and performing it remain separate operations.

## Verify the useful result

Verify local links, navigation, artifact fit, and consistency across affected
material. Then read the result as a contributor without this conversation or the
Trellis skills: can they find what applies, make the intended decision, evaluate
the result, and recognize an exception or a needed owner decision? Use a bounded
illustrative situation when it exposes ambiguity; do not perform the actual work
or present this author review as an independent agent exercise. Check that answers
changed all affected guidance and that inferred rules remain proposed until adopted.

Setup alone establishes an understandable entry point. Substantive authoring must
also supply the requested working guidance; review must explain supported findings
or why no change is needed. Keep the README's explanation of handbook use accurate
when the requested change affects it. These are completion criteria for the chosen
task, not a requirement to audit the whole handbook on every edit.

Retain useful current rationale and evidence limits, not transcripts,
session identifiers, secrets, unnecessary personal data, or obsolete accounts.
Report the decision the result now helps, changed paths or findings, checks actually
performed, and remaining dependencies. For a required user action, name the action,
its destination, and what remains incomplete until it happens. Distinguish authored
guidance, its discovery by future agents, and demonstrated use. When future reuse
is requested, check the applicable project instructions for a discovery route;
if absent, name a suitable instruction-file location and the user's remaining
action without editing it. When another agent uses the
result, preserve those limits and distinguish your completed work from its next task.
Each operation retains its own authority; a skill's restrictions do not revoke a
separately authorized task's permissions, and delegation cannot bypass the skill's
boundaries. Structural validity and instruction quality do not establish agent
compliance or correctness of the work.
