---
name: email-love-design-system-migration
description: Audit and migrate an entire legacy email design system or library into an Email Love Figma design system. Use when the user asks to assess migration readiness, inventory legacy email modules, determine source fidelity or scale, create Email Love foundations, convert a legacy library in batches, or migrate templates from Figma, a local folder, cloud storage, or a supported ESP. The source remains read-only and all conversion happens in a separate target Figma file. Do not use for building one campaign email; use email-love-figma-builder for that.
---

# Email Love Design System Migration

Audit a legacy email library from Figma, files, cloud storage, or a supported ESP, establish
its trustworthy foundations, and convert it into a reviewable Email Love design system in a
separate Figma target file.

## Non-negotiable boundaries

- Keep every source read-only at all times. Never edit a source Figma file, local folder,
  cloud folder, ESP template, campaign, automation, or message.
- Build only in a separate target file.
- Never convert an unaudited library.
- Never convert the entire library in one unreviewed pass.
- Never invent Email Love structure from visual intuition. Use the design-converter worker
  and the packaged render rules.
- Never start conversion while required human gates remain unresolved.
- Never present an individual module as a complete design system.

## Which model to run this with

If your environment lets you choose a model tier or reasoning-effort setting, use your
strongest available option for this skill. A migration runs once per customer and holds a
large rule set at once (the render references alone are tens of thousands of tokens); a
dropped rule becomes a component that silently breaks on export later, for someone who was
not in this conversation to catch it. The extra cost is small next to the cost of getting
it wrong. This is a different budget from the routine campaign builds a customer does
afterward against an already-verified design system, where a faster model is usually fine.

## Before doing anything

1. Identify where the source emails live and select the source adapter in Phase 0 (ask only when the request has not already named or linked the source).
2. For a Figma source, confirm the official remote Figma MCP exposes `get_metadata` and
   `get_screenshot`. For conversion, also confirm it exposes `use_figma`.
3. Before calling `use_figma`, read the Figma MCP's current `figma-use` skill or equivalent
   instructions in full.
4. If `use_figma` is missing, limit work to the read-only audit and a precise migration
   report. Do not promise conversion.
5. Confirm whether the user wants:
   - audit only;
   - foundations only after an accepted audit;
   - a specific conversion batch; or
   - the complete staged migration.
6. Obtain the source link, path, folder, or account scope required by the selected adapter.
   For conversion, obtain or create a separate target Figma file link.

Do not ask the user to disable the sandbox or bypass all approvals. Use normal tool
approvals. For unattended work, recommend a trusted isolated environment with narrowly
scoped permissions.

## Load references by phase

Read references completely before acting in the corresponding phase:

- **Audit:** [audit.md](references/audit.md)
- **The selected non-Figma source only:** load its adapter from
  [`references/sources/`](references/sources/)
- **Any run longer than a couple of minutes:** [progress.md](references/progress.md)
- **Conversion entry and gates:** [conversion-overview.md](references/conversion-overview.md)
- **Foundations:** [foundations.md](references/foundations.md)
- **Module batches:** [module-conversion.md](references/module-conversion.md)
- **Before any module transcription, all three render references:**
  - [render-geometry.md](references/render-geometry.md)
  - [render-nodes.md](references/render-nodes.md)
  - [render-components-validation.md](references/render-components-validation.md)

The render references are deliberately split by topic. Search them by rule number (`R0` to
`R9`) or exact tag when re-checking a rule, but read all three completely before the first
module transcription in a run.

## Phase 0: Pick the source

Ask only when the source is missing or genuinely ambiguous. When the request already names or
links the source - a pasted Figma link, a folder path, "our Klaviyo templates" - that IS the
answer: confirm it in one line and select its adapter without presenting the menu. Otherwise
ask this once before scoping the audit:

> Where are the emails you want to migrate?
> (a) Figma, (b) local folder, (c) Klaviyo, (d) Marketo, (e) Customer.io,
> (f) Google Drive, (g) SharePoint, (h) Brevo, (i) Kit, (j) ActiveCampaign,
> (k) Iterable, (l) Omnisend, or (m) HubSpot?

The answer selects exactly one route:

| Choice | Source | Adapter |
| --- | --- | --- |
| a | Figma | Use the audit reference directly |
| b | Local folder | [local-folder.md](references/sources/local-folder.md) |
| c | Klaviyo | [klaviyo.md](references/sources/klaviyo.md) |
| d | Marketo | [marketo.md](references/sources/marketo.md) |
| e | Customer.io | [customer-io.md](references/sources/customer-io.md) |
| f | Google Drive | [google-drive.md](references/sources/google-drive.md) |
| g | SharePoint | [sharepoint.md](references/sources/sharepoint.md) |
| h | Brevo | [brevo.md](references/sources/brevo.md) |
| i | Kit | [kit.md](references/sources/kit.md) |
| j | ActiveCampaign | [activecampaign.md](references/sources/activecampaign.md) |
| k | Iterable | [iterable.md](references/sources/iterable.md) |
| l | Omnisend | [omnisend.md](references/sources/omnisend.md) |
| m | HubSpot | [hubspot.md](references/sources/hubspot.md) |

Do not infer the source silently. Recommend Figma when it is available because components,
styles, variables, and cross-design reuse produce the richest audit. Then follow the source
the customer actually has. Load only the selected adapter, completely, before discovery.

## Phase 1: Audit

Read the audit reference, then:

1. Scope every source item included using the selected adapter's Discover procedure.
2. For Figma, inventory pages, frames, components, component sets, styles, variables, email
   widths, mobile twins, and repeated modules with read-only calls. For other sources, use the
   adapter's audit-step adaptations.
3. Classify source fidelity:
   - **AUTHORITATIVE:** geometry is a deliberate specification.
   - **PARTIAL:** preserve repeated deliberate values and standardize inconsistent ones.
   - **REFERENCE ONLY:** preserve brand, copy, and structure, but build geometry to email
     standards.
4. For AUTHORITATIVE and PARTIAL sources, derive both width and type evidence, select one
   scale factor, apply it consistently, and prove that type ratios survive.
5. Split designs into reusable modules before classifying them.
6. Record the canonical body width, content width, type ramp, spacing, colors, radii,
   buttons, images, and fallbacks.
7. Produce the migration report in the exact structure defined in the audit reference.

Every reported count must come from actual reads. Every judgment must name its evidence.

## Human gate after the audit

Do not begin conversion until the user confirms:

- the migration scope;
- the source-fidelity tier when it involved judgment;
- the scale factor for AUTHORITATIVE or PARTIAL sources;
- any blocking flag affecting how modules will be built.

A missing component source file blocks conversion. A REFERENCE ONLY source does not need a
fabricated scale factor.

## Phase 2: Foundations

Read the conversion overview and foundations references. Build foundations once per
customer, before any module:

- prescribed page structure;
- cover and getting-started guidance;
- two-tier primitive and semantic color variables;
- spacing and radius variables;
- type specimen and text styles;
- button foundations;
- email-template proof root;
- target body and content widths;
- source-specific image and font handling.

Bind component fills to semantic variables, never primitives or raw hex. Keep plugin-data
theme keys literal because variables cannot bind them.

Run the complete foundations checklist before approving batch 1. Do not use module
conversion to patch missing foundations.

## Phase 3: Module conversion

Read the module-conversion reference and all render references.

1. Before the first module, establish how the batch checks will run. Probe the Email Love MCP
   for `emaillove_export_figma`. When present, use it with `operationType: "preview"` for a
   quota-free headless export and use its token with `emaillove_preview_email`; no plugin click
   is needed for covered core tags. The Email Love MCP (server name `emaillove`) may be
   connected separately from this skill's install, so when its tools are absent, determine
   which case applies before prescribing setup: the server may be UNCONFIGURED (a directory
   or skills-only install carries no MCP configuration; add it with `codex mcp add emaillove
   --url https://mcp.emaillove.com/mcp`), UNAUTHORIZED (configured but not signed in; run
   `codex mcp login emaillove`, and explain that the sign-in screen is Email Love's normal
   account flow, the same sign-in the Figma plugin uses), or UNAVAILABLE (configured and
   authorized but not responding). Start a fresh task after any change so the tools appear.
   An unavailable renderer means verification is deferred, not passed. Do not confuse this server with the Email Love inspiration/library MCP;
   the two are not interchangeable. If the tool raises a CoverageError for `mj-hero`,
   `mj-social`, `mj-navbar`, or `mj-table`, ask a human to run the paid-seat plugin Export and
   maintain the Deferred verification list when no human is available.
2. Whatever the library size, start with a proof batch of at most four modules covering the
   source's relevant risk classes. Do not start later batches until every proof module
   passes production desktop and mobile checks and the user accepts the proof batch; if
   production rendering is unavailable, stop after preparing the proof and report deferred
   verification (a user approval does not substitute for missing render evidence). After
   that gate, use batches of roughly five modules so a review can stop a repeated defect
   early; a small library may finish in a single further batch.
3. Before the first write, name the batch and its module count and give a rough estimate, and
   freeze a compact batch Fact Pack carrying only what this batch can be wrong about: the
   structural authority (source node tree, or supplied/ESP HTML, per the audit), the visual
   authority (approved comps or source renders; defect screenshots are symptoms), the tier /
   email width / content width / scale factor from the audit, one line per module mapping its
   inventory row to the source ref actually converted from, and an `Unknown or pending` list.
   Do not start writing while that list holds anything that can change what you build; evidence
   arriving mid-batch that contradicts the Fact Pack stops the batch until it is re-frozen.
   Approvals stay conversational and scoped to the batch: the design-review gate after each
   batch is one approval for one batch, and a user request that already clearly authorizes
   exactly this batch is that approval.
4. For each module:
   - read its audit row and build constraints;
   - fetch or screenshot the source item at the target email width using its adapter;
   - send only that customer's source render to the converter;
   - save the returned JSON;
   - transcribe according to the render references;
   - apply the library's foundations and canonical content width;
   - repair known worker limitations;
   - create a reusable `mj-wrapper` component with no `mainFrame` marker;
   - add customer-facing TEXT properties by default, while keeping boilerplate and
     link-bearing text unbound; add BOOLEAN and INSTANCE_SWAP properties only from evidence;
   - verify it with one compact read-back pass and one desktop screenshot.
5. After provisional upload, run the mobile render and export sniff once for the batch, or
   add specific outstanding checks to the Deferred verification list.
6. Stop after the batch report for human review.
7. Continue only after the batch is accepted.

Never send a competitor email or Email Love inspiration preview to the converter.

## Progress contract

Follow the exact audit, foundations, batch, stopping, and resumable-state contract in
`progress.md`.

At the start, state the phase, item count, named items, and estimate.

For audit work, report only meaningful completed units such as pages or audit stages. For
conversion, report after each finished module:

> Batch 2, module 3 of 5 done, 60 percent: Testimonial, quote led.

Before every converter request, say that the conversion may take several seconds to roughly
half a minute and that transcription is the longer step. When retrying with `recache=1` or
after a trivial response, say so immediately.

Revise estimates at the next module boundary when pace changes materially.

## Verification

Use the phase checklist and R9 from the references. At minimum verify:

- source file unchanged;
- source account, folder, and templates unchanged for non-Figma adapters;
- every audit inventory row contains a source `T/I` content census;
- prescribed target pages present in the correct order;
- foundations and semantic bindings intact;
- every text style name matches its read-back value, including weight;
- one canonical body width and content width;
- module root is a direct-page-child COMPONENT tagged `mj-wrapper`;
- no `nodeType` exists anywhere in a module tree;
- every created node has the exact plugin tag and friendly display name;
- every frame is vertically HUG except `mj-spacer`;
- fixed widths are documented load-bearing cases;
- pinned text widths include fallback slack;
- images use source-node renders with preserved aspect ratios;
- source and build pass Group 0 parity for text, images, alignment, and band fills;
- image assets match the source identity, icon set, luminance context, and sprite crop;
- overlaps use the Two Column Swap;
- component-property bindings were read back;
- every customer-facing text node is reachable through a module-root TEXT property except
  boilerplate and link-bearing text;
- no `mj-group` carries its own fill;
- semantic fill bindings use the `.boundVariables?.color` predicate;
- text-on-background contrast failures below 3.0 are reported without silently changing brand colors;
- one fresh screenshot per module matches the accepted fidelity tier;
- the batch mobile render and export sniff passed, or every outstanding check appears in the
  Deferred verification list;
- the batch contains no unreviewed modules beyond its declared scope.

Fix failures before presenting a batch.

## Final handoff

Deliver:

- the audit and accepted human decisions;
- foundations created;
- modules converted by batch;
- concessions and placeholders;
- categories and component properties;
- known limitations;
- verification results;
- the exact Email Love plugin upload sequence;
- a recommendation to assemble one real sample email, export it, and send an inbox test.

Never use an em dash in module copy, Figma layer names, or plugin-data values.
