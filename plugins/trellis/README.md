# Trellis

A handbook helps the next contributor or agent find the methods a task depends on,
understand what to check, and judge what the evidence supports. As work exposes
recurring problems, you can refine that guidance for future tasks.

To support this, Trellis's skills help you create and maintain the following in a
handbook:

- **Repeatable Playbooks:** instructions for recurring tasks, including when to
  use them, the decisions involved, and how to check the result.
- **Checks:** expectations to assess whenever they apply, with guidance on how to
  verify them.
- **Practices:** guidance for approaching work and making recurring decisions
  consistently.
- **Templates:** reusable structures and prompts that help contributors and
  agents produce complete, useful work.

Together, these guide how work is approached, carried out, and reviewed in the
workspace.

The handbook holds the working method; the work itself stays with its area.

## Two skills

| Skill | Use it to |
| --- | --- |
| **Shape Handbook** (`shape-handbook`) | Establish, adopt, review, or refine selected handbooks, coordinating changes across their contents. |
| **Learn From Work** (`learn-from-work`) | Examine selected experience and propose reusable lessons and handbook improvements. |

Use the host's skill selector or normal invocation syntax. Namespaces and command
prefixes are host-specific; these are the portable skill names.

Both skills instruct the agent to read the full methodology before applying them.
Each skill includes the complete methodology and its linked contract under
`references/`, so those documents remain available when the skill is copied on its own.

Shaping follows your requested outcome. A request to review returns findings. A
request to create or improve authorizes the relevant handbook changes. You can
ask for an improvement without deciding which artifact types it needs. Preserving
or revising a Playbook requires your explicit request to capture that procedure.

Learning returns proposals you can choose, edit, or ignore. A lesson may fit a
practice, check, Playbook, template, or refinement of existing guidance. The skill
uses the current conversation, exact sessions you select, or explicitly supplied
accounts of work and artifacts. It never searches unselected history, writes files, or
invokes Shaping automatically.

Both skills inspect the selected material before asking questions. They ask when
your answer would change a working rule or proposed lesson—for example, whether an
unconfirmed date may appear in a client update. You supply missing local decisions
and context; the skills handle analysis, organization, and the requested result.
Clear requests need no interview. An unknown answer stays an explicit limitation.

Shaping explains which future decision the result helps and what it verified.
Learning explains what could change next time, why, and what remains uncertain,
then supplies proposals you can choose. Neither promises a new artifact or lesson
when existing guidance already serves the need.

For example:

- “Help a teammate pick up this project without another briefing. Put the working guidance they need in a handbook.”
- “Help us catch unclear claims before sharing client updates. Add guidance and checks to this folder’s handbook.”
- “Help the next organizer prepare a workshop without missed arrangements. Save our preparation routine as a playbook.”
- “Help contributors find the guidance that applies to their work. Review these handbooks for confusing or conflicting advice.”
- “Learn from these review notes so we can avoid the same rework. Suggest handbook improvements for me to choose.”

## Start with an area

Ask Shape Handbook to establish a handbook for the workspace or a particular area:

> Set up a handbook for research/. Use this project folder as the workspace.

The skill creates `research/handbook/README.md` and only the additional directories
needed. It returns a short, path-aware blurb you can place in `AGENTS.md` if you
want agents to consult the handbook. It never edits that file. You can include
specific practices or checks in the same request when their purpose is clear.
Different areas can maintain their own handbooks and reference shared practices.

Every handbook's README explains how to use the available guidance. People and
agents can use it without Trellis installed: start with the README, follow the
material relevant to the task, and perform the applicable checks. Their ordinary
task permissions still apply. Trellis's skills maintain this guidance.

If the project has no established pointer to the handbook, adding the returned
blurb is your remaining step for helping future agents find it. A usable handbook,
a discovery route, and observed successful use are separate accomplishments.

## What a handbook contains

```text
research/handbook/
  README.md
  practices/
  checks/
  playbooks/
    summarize-research/
      playbook-summarize-research.md
      scripts/                         optional
  templates/                           optional
```

A handbook can be useful with only some of these resources; empty categories do
not need filler.

Checks apply even when no Playbook exists. Reading a check does not perform its
verification. Completing a template's headings does not establish substantive quality.
Review the resulting meaning and keep unresolved questions explicit.

## File and execution boundaries

Trellis writes only inside selected handbooks. Review-only Shaping and Learn From Work
write nothing. The skills may read the surrounding work to understand its
method, but recommend needed changes outside the handbook instead of applying them.
Your existing request authorizes the corresponding handbook edits; the skills ask
only about unresolved choices that materially affect scope, meaning, or effects.

A recommendation does not authorize its own adoption. Creating a Playbook does
not carry it out. During ordinary work, you and your agents apply the handbook
within that task's authority.

Optional scripts live with their Playbook and operate only within the declared
workspace and task scope. They may use Node.js, Python, or another suitable
language. Review and test their actual effects and use host confinement when
executing them; a folder location or a path check is not an executable-code sandbox.
No Trellis runtime, service, account, or dependency installation is required for
text-only use.

Read the [methodology](METHODOLOGY.md) for the reasoning, the
[contract](CONTRACT.md) for exact boundaries, and [privacy](PRIVACY.md) and
[terms](TERMS.md) for the package's data and distribution policies.
