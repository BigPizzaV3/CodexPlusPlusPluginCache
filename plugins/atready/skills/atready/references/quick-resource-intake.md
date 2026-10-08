# Quick Resource Intake

Use this reference only for the conversational part of adding one resource. It must not trigger a
command, filesystem read, roster lookup, schema query, catalog lookup, memory search, repository
inspection, provider contact, or account check.

## Name first

When the resource is unnamed, ask only:

> What resource do you want to add?

Stop. Do not explain the setup process. Do not narrate that a reference or contract is loading.
This exact response is the complete turn. It uses no tool, memory, repository, filesystem, or
reference access.

## Three questions

After the name is supplied, propose one short, tentative purpose. Use a familiar purpose below when
the name matches. Otherwise describe the likely purpose in plain language and invite correction.
Do not claim that the resource has been inspected or verified.

- CodeRabbit: code review and pull request feedback.
- Codex, OpenCode, Claude Code, Cursor, GitHub Copilot, or Antigravity: coding help such as
  implementation, review, and repository analysis.
- PixelLab or Retro Diffusion: creating and editing pixel art or game assets.
- Blender: creating and editing 3D assets.
- Figma: interface design and visual collaboration.
- Grok: research, reasoning, and general AI assistance.

Ask only the unanswered subset of these questions, in this order. A bare name gets all three:

- How strong is it for that work: basic, solid, strong, or exceptional?
- Is it available to you now?
- Would you use it with private code or project files?

Then say:

> Reply naturally, and correct the purpose if needed. "Not sure" is fine. Nothing will be
> previewed or saved yet.

Keep the whole response under 100 words. Do not mention IDs, numeric scores, category or capability
labels, workflow modes, account access, usage limits, provenance, network use, billing, comparison
ratings, target paths, transport, disclosure, or defaults. Do not add another question. Never ask
for credentials, tokens, passwords, private notes, or private project content.

## Interpret the reply

Use only what the user says:

- Strength maps internally as basic `0.40`, solid `0.65`, strong `0.80`, and exceptional `0.95`.
  Apply one answer only to the stated purpose unless the user distinguishes capabilities.
- Availability maps only to whether it can be used now. It does not prove account access or usage
  room. Preserve `not sure` as unknown.
- A simple yes to private work allows public, internal, and private project data. A no or not sure
  allows public data only. Sensitive data stays excluded unless the user separately and explicitly
  permits it.
- If the user supplies extra planning facts, preserve them. Do not turn them into additional
  questions or treat them as preview approval.

Do not infer installation, authentication, quota, billing, provider configuration, execution
authority, or live capability from a product name or answer.

## Compact recap

After the questions are answered, return only this human recap, adapted to the declared facts:

> **Here's what I'll add**
>
> **`<resource>`** for `<plain language purpose>`
>
> - **Strength:** `<Basic, Solid, Strong, Exceptional, or Not sure>`
> - **Available now:** `<Yes, No, or Not sure>`
> - **Private work:** `<Allowed, Not allowed, or Not sure>`
> - **Still unknown:** `<only a material routing uncertainty, or omit this line>`
>
> Nothing has been saved.
>
> **Preview this entry?**

Keep the recap under 110 words. Do not add an AtReady details block, technical IDs, numeric values,
defaults, path, transport, disclosure, provenance, billing, comparison ratings, or handoff fields.
If usage limits are unknown and materially affect readiness, say so in the single `Still unknown`
line. If private work is allowed, say that sensitive work remains excluded until explicitly
permitted.

The recap is a response-only turn: render it from the answers already in task context and make no
tool call, memory lookup, repository or filesystem inspection, profile lookup, or target check.
Keep internal reasoning, loading, checks, orchestration, and reference names out of the response.

## Corrections and approval

A correction supplies facts only. Apply only the requested edits, recompute dependent mappings,
show the entire compact recap again, and ask `Preview this entry?` again. Do not repeat answered
questions. Even if the correction also says to preview, stop at the revised recap. Approval must
follow the latest displayed version.

Only an explicit yes to `Preview this entry?` authorizes moving to the protected preview stage.
It never authorizes a save or any resource execution.

The five-field Quick Setup preview applies only when the user accepts the tentative bundled purpose
and gives definite strength, availability, and private-work answers. A corrected purpose, extra
planning fact, or `Not sure` answer moves to Detailed Setup after recap approval. Reuse every
supplied fact and ask only what the complete declaration still needs; do not restart intake.
