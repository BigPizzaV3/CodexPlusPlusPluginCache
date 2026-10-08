# Trellis handbook contract

Trellis maintains the working method for a body of work. A workspace can contain
several handbooks, each at `<area>/handbook/`. The area keeps the actual work, such
as drafts, research notes, plans, and customer records. Its handbook keeps the
practices, checks, Playbooks, and templates used to do and review that work.

The two skills work through the host's normal agent tools and need no Trellis
service or mandatory runtime.

## Scope and authority

- **Workspace:** an explicitly identified working directory, which need not be a
  Git repository.
- **Area:** the workspace or a folder within it whose work the handbook supports.
- **Handbook:** `<area>/handbook/`, the folder holding that area's working methods.
  Its parent directory is the owning area.

Resolve the workspace and owning area from the request and relevant project
instructions. The workspace and owning area must already exist;
initialization creates the handbook within those directories. Do not infer the
workspace from the agent's current directory when several plausible roots exist.
Ask only when the choice changes scope.

Handbooks reference shared rules at their owners. Root and nested handbooks can
both apply; filesystem ancestry does not silently resolve conflicting rules.
Explain deliberate local specializations and raise a consequential unresolved
conflict with the user.

Trellis skills may inspect the requested area, applicable shared guidance, and
explicitly selected evidence. All their filesystem writes, including temporary
files, generated support, and test outputs, stay inside the selected handbook.
Review-only Shaping and Learn From Work perform no filesystem writes. For a request
covering several handbooks, resolve each one separately. The request does not
authorize other workspace writes. Avoid reading unrelated areas merely because
they share a workspace.

Resolve paths against their physical locations before writing. Refuse path
traversal or a symlink that makes a destination escape the selected handbook.
Do not follow a handbook symlink as a way to expand the write scope. Re-read
existing targets before overwriting them; if concurrent changes invalidate the
reviewed edit, reconcile the change before writing. Preserve unrelated owner
content. Report needed edits outside the handbook as recommendations.

Never retain secrets, unnecessary personal data, transcripts, or session
identifiers in handbook artifacts.

Skills do not edit `AGENTS.md`, initialize Git, stage, commit, push, publish,
install dependencies outside the handbook, run described work, or communicate
with others. An ordinary agent task that uses handbook material retains its own
scope and authorization. Maintaining a Playbook and carrying out that Playbook
are distinct operations.

## Handbook layout

```text
<area>/handbook/
  README.md
  practices/
  checks/
  playbooks/
    <name>/
      playbook-<name>.md
      scripts/                 optional
      references/              optional
  templates/                   optional
```

Handbook setup creates only the README and the category directories requested or needed.
An otherwise empty handbook is valid. Do not add placeholder practices, checks,
Playbooks, tools, or a template collection without a concrete use.

The README identifies purpose, workspace, owning area, relevant shared handbooks,
the authoritative files for the work, and navigation to material that actually
exists. It also explains how to select and apply the available guidance without
Trellis installed: checks require evidence, work stays with its authoritative
sources, unresolved consequential decisions go to the owner, and ordinary tasks
retain their own permissions. Keep this orientation brief and maintain it when
affected by the requested change. A separate operating document is optional and
must be reachable from the README if it owns that explanation.
Storage conventions identify homes for authorized outputs, not an obligation to
create extra files. A task requesting findings in the response does not thereby
request a saved report. Check definitions and README guidance must preserve this
distinction when describing where findings belong.
The portable marker is one line:

```html
<!-- trellis:handbook {"format":1,"workspace":"../.."} -->
```

`workspace` is a relative directory path from the handbook to the declared
workspace; use `..` for a workspace-root handbook. The owning area is always the
handbook's parent. The marker identifies a handbook, not automatic ownership of
every file within it. Adopt an existing folder only within the user's requested
scope, preserving existing content and resolving conflicting conventions.

Use relative local links for portable navigation.

## Practices

Practices explain how to understand, organize, approach, and maintain work in the
area: ownership, distinctions, writing conventions, method selection, and the
interpretation of evidence. They must change a real working decision and remain
specific enough to apply. Organize files by a coherent concern or reader question.

Keep the content and results of a task with its working files. A practice explains
how contributors approach and review that kind of work. For example, a customer
case records the request, agreed response, and outcome; a practice can explain how
to assess the request and when to seek help. A document may contain both kinds of
material, so judge each statement before deciding where it belongs.

Explicit user direction can establish a practice. Existing instructions provide
evidence of adopted conventions. Repeated observed patterns can suggest a practice
but do not automatically make it a rule. Keep a consequential inference visibly
proposed until adopted. Retain useful current rationale, not discovery transcripts
or obsolete accounts. Link to authoritative work files instead of copying them.

## Checks

A check states an expectation and how to verify that work meets it. State its
applicability, requirement, concrete verification, and outcomes. Verification can
require judgment; it need not be an executable test. Outcomes distinguish pass,
fail, unable, and not applicable with reasons appropriate to the check.

Checks apply independently of Playbooks. A precise open question can satisfy a
completeness check while the underlying decision remains unresolved. Reading a
check, filling a template, and passing a structural validator do not perform its
semantic verification. Keep the work's requirements and actual review findings in
their authoritative files; handbook checks describe the reusable review.

Use `checks/<name>.md`. Avoid overlapping checks whose applicability and failure
meaning cannot be distinguished. A check may reference a practice for its rationale
and an authoritative requirement for the exact meaning being checked.

## Playbooks

Shape Handbook creates or revises the Playbook explicitly requested by the user. Direct
intent is a sufficient brief; a history of successful use is not required.
Do not infer a creation request from ordinary project work, a proposed lesson,
a review finding, or a general request to improve a handbook. An explicit request
to preserve a procedure or the user's adoption of a proposal supplies that intent;
no separate capture command is required.

Each Playbook lives in `playbooks/<name>/playbook-<name>.md`, using a lowercase
hyphenated name. Keep one coherent repeatable task together with its supporting
files. Preserve when to use the Playbook, its intended outcome, relevant context,
judgment, method, applicable checks, completion evidence, and meaningful recovery
or stop conditions.
Use headings suited to the task; templates are adaptable. Separate tasks when their
triggers, outcomes, or maintenance needs can usefully stand independently. Do not split
connected phases simply to satisfy a fixed size or number of steps.

### Supporting scripts

Prefer ordinary instructions and existing workspace capabilities. Add supporting
scripts only when requested or clearly included in the agreed Playbook design and
they materially improve repeated work. Document the interpreter, dependencies,
workspace root, explicit inputs and outputs, effects, invocation, verification,
failure handling, and recovery. Do not duplicate canonical work into support files.

Scripts may use Node.js, Python, or another suitable language. Their work and data
effects must stay inside the declared workspace and the narrower task scope. Do
not access network services, secrets, or outside-workspace data as an implicit
extension of a local helper. Runtime and interpreter libraries are environment
dependencies, not authority to act on outside data. Resolve input and output paths,
reject escapes and unsafe symlinks, and avoid implicit current-directory targets.

Path checks in source code are not a sandbox for arbitrary executable code. Use
the host's workspace confinement when executing scripts, review their actual
effects, and never promise enforcement solely because a script lives here.

During skill authoring, exercise scripts only on fixtures and outputs inside the
selected handbook, with caches and temporary outputs also contained there. If the
host cannot provide the required confinement, provide the script for review and
state the execution limitation rather than running it with broader authority.

## Templates

Templates provide reusable structures and substantive prompts. Skills can use
their bundled assets or relevant handbook templates, preserving explicit user
requirements. Add a local template only when its reuse is useful. A template can
shape a practice, check, Playbook, or an artifact made during ordinary work;
Trellis skills still write only inside the handbook. Filling headings is not
evidence of adequacy. Do not treat sample instructions as adopted local policy.

## Shared methodology

Before applying Shape Handbook or Learn From Work, read the full Trellis methodology.
Each skill includes it at `references/methodology.md`, with `references/CONTRACT.md`
beside it so the methodology's contract link also works in a standalone skill.
These are complete copies of the authoritative methodology and contract, maintained
in agreement with their sources rather than edited independently.

## Shape Handbook

`shape-handbook` creates and refines the working method preserved in selected
handbooks. It can establish or adopt a handbook, make coordinated changes across
artifact types, or review the collection. Infer the operation from the user's
requested outcome; a folder's presence or absence does not authorize an operation.
The user need not classify a problem into practices, checks, or templates before
asking for an improvement.

A setup request authorizes the required README and useful directories. A broader
request can include substantive authoring in the same task. A creation or refinement
request authorizes the corresponding handbook edits once material ambiguity is
resolved. Reuse existing authorization rather than introducing mode-selection
or repeated confirmation steps. Playbook authoring retains the explicit intent
requirement above. A proposed lesson is not an instruction to apply itself.

Identify the task or decision the requested guidance should improve. Inspect
selected sources before asking for information. Ask about a consequential missing
purpose, rule, tradeoff, or exception when different answers would change the
guidance; obtain the answer before encoding the dependent rule as settled. Use
existing owner direction without asking again. Continue independent work and keep
unanswered dependencies explicit. The user need not design the artifact structure.
Clear requests do not require an interview, and reviews may report unresolved
choices as findings.

A review-only request produces findings without writing reports, temporary files,
or fixes, and without executing Playbooks, scripts, tests, or the underlying work.
Report scope, coverage, evidence, practical consequences, and the smallest useful
next step. A missing handbook is a finding, not permission to create one. Requested
refinements may include the review necessary to make the change; they do not
require a separate review invocation or a comprehensive audit of unrelated content.

After setup or adoption, return an optional path-aware `AGENTS.md` blurb explaining
where the handbook lives and how to consult it, with its intended destination.
If no discovery route is established, identify adding that pointer as a remaining
user action. Do not edit the instruction file or claim future agents will
automatically consult the handbook.
For refinements intended to support future reuse, also check the applicable
project instructions and report any missing discovery pointer as a user action
with its intended location. This does not require repeating the setup blurb.
Verify the requested changes together: useful artifact fit, canonical ownership,
scope, relative links, consistent requirements, and evidence limits. Read the result
for whether a contributor without the original conversation can find what applies,
make the intended decision, evaluate the result, and recognize exceptions or needed
owner decisions. Distinguish this author review from observed independent use.
Report the practical improvement, performed checks, and specific remaining actions.
Setup alone supplies an entry point; substantive requests also require the
requested guidance, and review returns supported findings or a no-change conclusion.

## Learn From Work

`learn-from-work` draws reusable lessons from selected experience. Use the current
conversation by default, exact sessions selected by the user and retrievable by
the host, or explicitly supplied accounts of work and artifacts. Do not enumerate
unselected history or treat references in a source as permission to read their targets.

Reconstruct the selected work before generalizing: distinguish stated intent,
observed actions, decisions, results, and inferred causality. An unfinished attempt
can reveal a useful lesson without demonstrating success. Consider practices,
checks, Playbooks, templates, and refinements to an existing handbook according to
their fit. Do not force every lesson into a procedure or adopt an observed pattern
as policy. Findings and one-off results remain with the work they concern.

Ask a question grounded in the selected episode when its answer would change the
recommendation and is not already available. Wait for the dependent answer before
finalizing that recommendation; continue supported independent analysis. Incorporate
the reply without rewriting historical evidence. If an answer is unknown or
declined, state the resulting limit rather than repeatedly asking or inventing
certainty. Questions are not a required stage when the evidence is sufficient.

Return evidence-backed proposals and self-contained, editable `shape-handbook`
requests. Lead with the synthesized lesson or supported no-change conclusion;
questions alone are not a completed result once answers are available.
State relevant context, intended improvement, appropriate artifact types,
verification, and evidence limits. A destination can remain unresolved when that
does not prevent a useful proposal. No worthwhile recommendation is a valid outcome.
Learning never writes files or invokes Shaping automatically.

## Evidence

Skill instructions describe intended behavior. Structural tests, executable helper
tests, installation checks, and independent agent exercises support different
claims. Report what was actually tested and its limits. A maintained handbook
supports continuity of method across sessions; it does not guarantee agent
compliance or the correctness of the underlying work.
