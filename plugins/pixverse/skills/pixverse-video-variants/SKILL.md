---
name: pixverse-video-variants
description: "Video variants: produce many versions of one generated video project by swapping the host, product, wording, language, aspect or hook while reusing every accepted asset and regenerating only what changes."
---

# Video Variants

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

One editable production, many deliverables. A variant changes one or a few roles (host,
product, wording, language, aspect, hook) and reuses everything else: accepted images,
takes, music, graphics, timeline and plan. Paid work is only the parts that actually change.
Ordered edits of a supplied ad stay in `../pixverse-ad-variants/SKILL.md`.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Define The Variant Sheet

Start from an existing project with its script, timeline, plan and manifest. For each
variant record: the change (what and where it appears), the assets that stay, the assets to
regenerate, and the acceptance check. Zip ordered lists; never build a Cartesian product the
user did not ask for. Read `./references/reuse-matrix.md` for what each change touches.

## Reuse Before Generating

Carry accepted assets into the new queue without paying again:

```bash
"${PVX}" queue append projects/<slug>-v2/queue.json --project <slug>-v2 --id broll-leaves --reuse <slug>:broll-leaves
"${PVX}" queue append projects/<slug>-v2/queue.json --id host-cat --reuse <slug>:host-cat
"${PVX}" queue append projects/<slug>-v2/queue.json --id take --preflight -- pixverse create reference --model seedance-2.5 ... --images "{{host-cat.path}}" --prompt ...
```

`--reuse <project>:<task-id>` copies the accepted asset's provider path and local file from
that project's manifest; the preflight lists it as reused with no charge and dependents can
reference `{{id.path}}` as usual. Generate only the changed nodes: a new host image and its
takes for a host swap, new takes for new wording, a new voice and takes for a language,
new inserts for a product. Graphics with the swapped identity (an avatar in a sticker, an
icon on a board) are re-rendered locally, not regenerated.

The example assumes `host-cat` is already an accepted source-project asset; otherwise
generate the new host image before referencing it. The identifier after the colon is the
queue task key, not a provider generation ID. The helper selects its latest successful
manifest entry; it cannot infer creative acceptance or rejection. Verify the selected task
ID against project decisions before reuse, and use a distinct task key for rejected retakes.

## Re-flow The Composition

Rebuild the timeline from the new takes (`../../skills-shared/word-timing.md`); anchors,
captions, boards and sounds follow the new words. Re-render the plan
(`../../skills-shared/anchored-composition.md`) with only the changed sources swapped. For
an aspect change, keep the script and takes when the framing allows it and adapt the plan
geometry; regenerate takes only when the composition truly needs a different frame.

Timing re-flow does not relocate graphics around a new face, prop or gesture. Inspect the
new take at the overlay anchors and re-place cards, boards, inserts and stamps before the
final render. Reuse the layout only after checking its occupied regions on the new host.

## Deliver As A Set

Sample one grid per variant on the same anchors and compare. Deliver the files with a
compact sheet: variant, what changed, what was reused, task ids and credits from the ledger.
Repair only the rejected variant. Keep the project editable so the next batch starts from
the same accepted base.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
