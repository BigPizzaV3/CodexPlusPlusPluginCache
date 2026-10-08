# Preserve a requested procedure

Create or revise the Playbook the user asks to preserve. Acceptance of a proposal
that clearly includes the procedure is also a request. Broad handbook improvement,
a learning recommendation, or a review finding alone does not authorize creation.
The user's intended procedure is a sufficient brief; do not require proof of successful use.

Use relevant practices, checks, templates, and existing Playbooks. Update an existing
Playbook when it owns the requested task. Keep connected phases together and separate
tasks when their triggers, outcomes, or maintenance needs can usefully stand alone.
No fixed number of headings, steps, or branches determines a useful boundary.

Preserve when to use the Playbook, its intended outcome, inputs, context, authority,
authoritative work files, judgment, method, applicable checks, completion evidence,
and meaningful recovery or stop conditions. Resolve only material gaps. Link the
work's requirements, decisions, and findings instead of copying them into its
method. A Playbook can invoke checks without owning their independent applicability.

Use a portable lowercase hyphenated name and this exact relationship:

```text
playbooks/<name>/
  playbook-<name>.md
  scripts/             optional
  references/          optional
```

Reject case or Unicode-normalization path collisions. Adapt
[the Playbook starter](../assets/playbook.md) or an applicable local template; use
headings suited to the task. Add support files or local templates only when they
are useful, and do not duplicate canonical work. Verify entry naming, links, check
invocations, completion evidence, and usability without the original conversation.

## Optional supporting scripts

Prefer ordinary instructions and existing workspace capabilities. Add scripts only
when requested or clearly included in the agreed procedure design and when they
materially improve repeated work. Node.js, Python, or another suitable language may
be used; no mandatory runtime or operation catalog is required.

Document interpreter, dependencies, explicit workspace and narrower task scope,
inputs, outputs, effects, invocation, verification, failure handling, and recovery.
Scripts' work and data effects stay inside that workspace and task scope. A local
helper has no implicit authority to access network services, secrets, or data
outside the workspace. Interpreter libraries are environment dependencies, not authority
to act on outside data.

Use explicit paths rooted in the declared workspace, resolve input and output
locations, and reject escapes and unsafe symlinks. Avoid implicit current-directory
targets. Path guards and a script's location do not sandbox arbitrary executable
code: inspect actual effects and use host workspace confinement for execution.

During shaping, validate new or changed scripts only with fixtures and outputs
inside the selected handbook, including caches and temporary files. Use existing
authorization for the agreed support and the required host confinement. If that
confinement is unavailable, provide the script for review and report that execution
was not verified. Do not run it with broader authority or carry out the actual
work. Installing outside the handbook is outside the skill's scope.

Show the supporting files and effects before writing. Broader support that was not
included in the request needs a clear user decision. Report tests actually performed
and their limits; successful authoring or fixture tests do not demonstrate that the
complete Playbook works across real tasks.
