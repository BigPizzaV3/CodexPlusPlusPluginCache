# Establish the handbook

Create or adopt the selected `<area>/handbook/` within the scope resolved in the
skill entry point. Verify that the workspace and owning area already exist as
directories before creating the handbook. If either is missing, report the needed
outside-handbook setup without creating parents. A compatible existing handbook
needs only the requested or missing setup. Discovering an unmarked folder is not
by itself permission to adopt it. Preserve owner content when the request includes
adoption, and reconcile conflicting conventions or duplicate or malformed markers
before changing them.

The README identifies purpose, workspace, owning area, relevant shared handbooks,
the authoritative files for the work, and navigation to material that actually
exists. Include a short explanation of how to select and apply that material,
evaluate checks, keep work with its sources, and resolve consequential uncertainty
within the current task's authority. It must be usable without the Trellis skills
or the setup conversation. Read and adapt the README starter, including its
distinction between storage conventions and authorized outputs; a response-only
review does not require a saved report. During README refinement, apply this
orientation guidance without repeating unrelated setup steps. Omit irrelevant forms and
avoid reproducing the full methodology or maintenance-skill restrictions as rules
for ordinary work. Use a linked explanation only when its length or existing
ownership makes that useful; no separate operating file is required.

Add one `trellis:handbook` marker with the verified relative workspace path.
The available layout is:

```text
<area>/handbook/
  README.md
  practices/
  checks/
  playbooks/
  templates/       optional
```

Create only the README and category directories requested or needed. An otherwise
empty handbook is valid. Do not add filler practices, checks, Playbooks, scripts,
or a template collection. Adapt [the README starter](../assets/handbook-readme.md)
when useful; keep local links relative.

Show the workspace, area, destination, affected files, and substantive setup choices.
Proceed under the user's setup or adoption request once material ambiguity is
resolved. Verify the marker, its physical workspace target, the owning area, and
navigation links. If the same request also asks for practices, checks, templates,
or an explicit procedure, continue with the relevant authoring references after
establishing the entry point; do not stop at setup. Setup alone does not require
a comprehensive semantic review of existing material unless the user requested one.

After setup, return an optional blurb for the user to place in the appropriate
`AGENTS.md`. Adapt the relative link to that instruction file's location:

```markdown
## Handbook

Working practices, checks, and Playbooks for this area live in
[`handbook/README.md`](handbook/README.md). Consult the applicable material when
working here. Keep the actual work in its existing files; the handbook guides how
we approach and review it. Handbook guidance does not expand a task's authority.
```

Return the blurb with its intended instruction-file location; never insert it.
If future agents have no established route to the handbook, explain that adding
this pointer is the user's remaining discovery step. Do not describe the handbook
as automatically consulted or its method as proven. Do not generate another setup
blurb as a routine side effect of later review or refinement.
