---
name: email-love-figma-builder
description: Build export-ready marketing and lifecycle emails inside Figma using Email Love components or the Email Love design-converter workflow. Use whenever the user asks to create, assemble, draft, convert, or build an email or email campaign in Figma; mentions Email Love, email design systems, mj-wrapper frames, ESP export, or AI Import; shares an email campaign brief with a Figma file; or asks to turn an existing email or Figma comp into an exportable email. Supports both customers with an existing Email Love design system and customers creating their first email without one. Do not use for migrating an entire legacy email design system; use email-love-design-system-migration for that.
---

# Email Love Figma Builder

Build real, export-ready Email Love emails in the user's Figma file. Treat the underlying
Email Love structure as production code: canvas appearance alone does not prove that the
email will export.

## Non-negotiable rule

Never invent Email Love structure from memory.

Structure comes from exactly two places:

- **Path A:** instances of published components from the customer's Email Love design system.
- **Path B:** measured conversion output returned by `emaillove_convert_design` for a
  customer-owned Figma source when that MCP tool is available, otherwise MJML JSON from the
  Email Love design-converter worker. Transcribe either result according to the packaged render
  references.

The only structure created without either source is an empty email root and, when explicitly
required, the narrowly defined `mj-raw` ESP token block. If neither path can produce a
section, stop and ask the user.

## Which model to run this with

The two paths carry very different risk, so if your environment lets you choose a model tier
or reasoning-effort setting, they deserve different budgets.

**Path B, and the design-system-migration skill, deserve your strongest available model.** That
work holds a large rule set at once (the render references alone run tens of thousands of
tokens) and a dropped rule becomes a component that silently breaks on export later, for
someone who was not in this conversation to catch it. This is also work a customer does once,
not daily, so the extra cost is small next to the cost of getting it wrong.

**Path A, once a design system is already synced and verified, is a smaller job.** Instance a
component, load its font, set text, done. A faster or lower-effort model handles routine
campaign builds reliably here, because mistakes are cheap and obvious: wrong copy in a button
is visible the moment you look at it.

## Before doing anything

1. Confirm the official remote Figma MCP exposes `use_figma`, `get_metadata`, and
   `get_screenshot`.
2. Before calling `use_figma`, read the Figma MCP's current `figma-use` skill or equivalent
   instructions in full.
3. If `use_figma` is missing, say that the connection is read-only and do not promise a
   canvas build. Offer:
   - an email plan with copy and subject lines; or
   - for Path B, a converter-assisted handoff where the user pastes the render into Figma
     and runs AI Import in the Email Love plugin.
4. Confirm the Email Love plugin is installed. Path A also requires a synced Email Love
   design system.
5. Check whether the Email Love MCP tools (`emaillove_convert_design`,
   `emaillove_export_figma`, `emaillove_preview_email`) are available, and tell the user in
   one line which of Figma writing, conversion, and export verification this session
   actually has. When they are absent, distinguish an unconfigured server, one awaiting
   authorization, and unavailable tools before prescribing a remedy; a skills-only install
   carries no MCP configuration, so never send it straight to a login command.
6. Treat a request to audit or migrate a whole legacy library as a different job. Use
   `$email-love-design-system-migration`.

Do not ask the user to disable the sandbox or bypass all approvals. Work through normal
Figma tool approvals. For unattended operation, recommend a trusted isolated environment
with narrowly scoped permissions.

## Load only the references required for the chosen path

Before any canvas write, always read:

- [shared-rules.md](references/shared-rules.md)
- [progress.md](references/progress.md)

Then read:

- **Path A:** [path-a.md](references/path-a.md)
- **Path B:** [path-b.md](references/path-b.md), then all three render references before
  transcription:
  - [render-geometry.md](references/render-geometry.md)
  - [render-nodes.md](references/render-nodes.md)
  - [render-components-validation.md](references/render-components-validation.md)
- **Path A gap-fill using Path B:** read the Path B and render references before creating
  the missing module.

The render references are deliberately split by topic. Search them by rule number (`R0` to
`R9`) or exact tag (`mj-button`, `mj-group`, `mj-image`) when re-checking a rule, but read
all three completely before transcribing converter output.

## Step 1: Collect the brief

Do not re-ask facts the user already supplied. Collect the missing essentials in one compact
round:

1. What email or sequence is this?
2. What is the single primary CTA and its destination?
3. What factual content must appear: offer, dates, products, proof, and source links?
4. What is the Figma file link?

For sequences, also collect timing or trigger and the job of each email. For lifecycle
emails, establish what the recipient just did. For multi-brand files, identify the brand.

Use choice-shaped questions when an interactive question tool is available. Otherwise use
lettered choices so the user can answer in one line. Ask at most two rounds, then proceed
with sensible assumptions and report them.

Never invent statistics, dates, prices, legal language, addresses, or URLs. Mark unresolved
facts as placeholders.

## Step 2: Use inspiration only when it helps

When the user names a reference brand, the brief is thin, or the request is a sequence,
search for Email Love inspiration tools such as `search_emails`, `fetch_email`,
`get_brand_insights`, `list_journeys`, or `get_journey`.

Use inspiration for:

- section rhythm;
- subject-line patterns;
- offer framing;
- tone;
- sequence pacing.

Never copy another brand's copy, convert a competitor preview, or send an Email Love library
preview to the design converter. Path B input must be the customer's own material or a comp
created for them.

If inspiration was explicitly requested but the tools are missing, say so before building
and offer to continue using general best practice.

## Step 3: Choose the path by checking

1. If Email Love account tools are available, list brands, components, and templates.
2. Otherwise inspect every relevant Figma page for `COMPONENT` and `COMPONENT_SET` nodes,
   existing Email Love email roots, and library conventions.
3. Route:
   - relevant components exist: Path A;
   - no design system exists: Path B;
   - partial library: Path A for matching sections and Path B only for confirmed gaps.

**Scope escalation is a reroute, not a bigger build.** If the request expands into a whole
library, foundations, variables, tokens, or multiple component categories, stop the builder
workflow and route to `email-love-design-system-migration`. Do not continue one module at a
time under this skill; a library approached as iterative email building skips the audit, the
proof batch, and the batch gates that exist precisely for library-scale work. When reusable
modules were created or repaired during a build and the `email-love-figma-quality-gates`
skill is installed, offer it as an independent acceptance pass at hand-off.

Tell the user the chosen path and why before the first canvas write.

## Step 4: Establish the section plan and estimate

Follow the exact progress and stop contract in `progress.md`.

Before writing, name every planned section and give a rough range:

> Path A, 7 sections: preheader, header, hero, proof, feature list, CTA, footer. Roughly 6
> to 9 minutes.

That section count is the denominator for every progress update.

For a sequence use two counters:

> Email 2 of 4, section 3 of 7 done, 43 percent: hero.

Report progress only:

- before the first write;
- after each complete section;
- immediately before each Path B converter request;
- when retrying a trivial or failed converter response;
- at completion.

Each section update must include the count, percentage, section name, and a revised estimate
when actual pace differs materially.

## Step 5: Build incrementally

- Use one `setCurrentPageAsync` per `use_figma` call.
- Write in small structural batches.
- Read geometry writes back immediately.
- Check metadata or a screenshot after every structural step.
- Never detach an instance.
- Never add, delete, reparent, retag, rename, or restructure layers inside a Path A instance.
- Preserve the file's pages, order, variables, styles, tokens, breakpoints, widths, and
  fonts.
- Use exactly one visible primary CTA button unless the user explicitly asks otherwise.
- Leave unknown final URLs unset rather than writing `#`.
- Use flat gray placeholders at the correct dimensions for missing imagery and report them.
- Place multiple emails side by side for review.

On Path B, save the converter JSON before transcription and treat it as the stable input.
Apply every repair defined in the Path B reference: pills, groups, placeholder images,
foundation drift, unsupported tags, and Two Column Swap detection.

## Step 6: Verify before presenting

Run the relevant checklist from the packaged references, not a remembered version.

Always verify:

- the root has the intended email or module shape;
- every Path A section is an intact component instance except a valid raw footer;
- every Path B node is tagged and every leaf pair is complete;
- every frame created is vertically HUG except an intentional `mj-spacer`;
- fixed widths occur only in documented load-bearing cases;
- both auto-layout alignment axes match, except the documented multi-column top-align
  case (primary MIN with counter on the content's horizontal alignment);
- pinned text widths include font fallback slack;
- all vertical gaps are padding paid by one side only;
- source images use rendered crops with preserved aspect ratios;
- overlaps became the documented Two Column Swap;
- all nodes intended for export are visible;
- there is exactly one visible CTA unless requested otherwise;
- the file's page list, variables, and styles remain unchanged.

Take a fresh screenshot of every email and inspect for clipped text, overlaps, inconsistent
spacing, missing content, incorrect color, and alignment flips. Fix failures before handoff.

## Step 7: Hand off

Verify through the production exporter first when you can. Probe for
`emaillove_export_figma` and `emaillove_preview_email` before delegating verification to the
user: when connected, run the desktop preview export on the root, run the mobile preview,
fix anything either render disproves, and include the preview link in the report. End every
build with exactly one completion state:

- `desktop and mobile export verified`: both production renders exist and pass; desktop
  success never substitutes for untested mobile output.
- `built in Figma, export verification pending`: canvas and structure checks passed but no
  production render has been seen.
- `blocked`: plus the exact action needed to continue.

Reserve `export-ready`, `fixed`, and `verified` for the evidence those words imply; a named
inbox-client test is a separate claim from a production Preview pass.

Report:

- what was built;
- Path A, Path B, or mixed, and why;
- components selected or converter structure used;
- repairs applied;
- inspiration used;
- assumptions;
- provisional links and mobile keys;
- dark-mode overrides preserved or added;
- placeholder imagery or unresolved facts;
- anything skipped.

Propose a subject under 45 characters and a complementary preheader. Remind the user to set
or verify them in the Email Love plugin, review mobile and dark-mode previews, export through
the plugin, and send a real inbox test.

Never use an em dash in email copy, Figma layer names, or plugin-data values.
