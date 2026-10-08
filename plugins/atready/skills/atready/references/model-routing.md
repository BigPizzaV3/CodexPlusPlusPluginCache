# Model-aware resource variants

Use this reference only when the user asks for model-aware planning, a provider profile exposes
`model_routing_suggestions`, or a saved resource clearly represents one model-specific surface.
Model suggestions are dated catalog proposals. They are not live provider facts, benchmark-derived
scores, defaults, availability checks, or execution authority.

## During resource setup

1. Read the selected provider with `resource profile PROFILE_ID --json` through the pinned launcher.
2. If `model_routing_suggestions` is empty, continue with ordinary one-resource setup.
3. If suggestions exist, show their catalog review date and ask which exact model/surface the user
   can select today. Never inspect configuration, model lists, accounts, plans, or usage.
4. Keep a generic provider entry when model selection is automatic, unknown, or not important to
   planning. Do not silently choose a catalog model.
5. When two confirmed model choices have materially different capability, cost, policy, capacity,
   or readiness, offer separate resource entries using the proposed resource IDs. Each entry needs
   its own complete user-confirmed scores, readiness, safety, preview, and apply approval.
6. Do not create model entries in a batch. A model name in catalog data is never proof that the
   user's plan, region, organization, surface, or current session exposes it.

Treat `planning_role` and `planning_caution` as question prompts. Do not copy them into capability
scores. Ask the user to rate the configured model based on their experience; preserve unknown or
baseline values when they have not evaluated it.

If separate model entries are intended to distinguish hard work from fast or cost-efficient work,
the intake must capture that distinction in structured fields: the relevant capability scores,
`ratings.speed`, and `economics.marginal_cost`. Do not accept every differentiating field at the
same baseline and then imply the router can see the catalog role. Quick Setup may ask only for those
targeted comparisons; Detailed Setup remains available for the full score set. When evidence is
missing, keep the baseline and state that model-aware preference is not yet encoded.

## During project planning

The deterministic router still selects resource entries, not hidden models. Never replace its
selected resource, adjust a score, or invent a model choice in prose.

- If the selected resource is model-specific, name that exact resource and use the catalog role
  only as a dated explanation alongside the user's declared scores.
- If the selected resource is generic, leave its model unspecified. When model choice materially
  affects the requested work, list confirmation of the current model as a decision instead of an
  assumed assignment.
- Prefer a user-confirmed deep-reasoning entry for genuinely ambiguous, long-horizon, architectural,
  investigative, or cross-domain work only when its declared capabilities and project gates support
  that selection.
- Prefer a user-confirmed cost-efficient or fast-iteration entry for bounded implementation,
  routine refactors, tests, and repetitive edits only when its declared capabilities and project
  gates support that selection.
- Never describe one catalog model as universally smarter, worse, faster, cheaper, or more reliable.
  Those comparisons vary by task, mode, provider serving, price, and time.

## Shared capacity and duplicate models

Two model entries can draw from one subscription or usage pool. Equal
`shared_capacity_group` values are a warning proposal, not an enforced quota relationship:

- disclose that AtReady v0.1 does not coordinate or reserve a shared pool across resources;
- do not present the entries as independent capacity, redundancy, fallback, or availability;
- re-check the governing pool before recommending simultaneous or sequential heavy use; and
- preserve one provider/model offered through two surfaces as two resources when access, policy,
  capacity, or authorization differs. Cursor-hosted Grok and standalone xAI Grok are not the same
  operational resource even when they share an underlying model name.

## Catalog maintenance

Model lineups are volatile. Before changing a suggestion, verify the provider's current official
model and pricing/selection documentation, update `model_catalog_reviewed_on`, and keep temporary
offers labeled temporary. DeepSeek V4 Flash Free is a temporary OpenCode Zen option, not OpenCode's
universal default. Current source families are Cursor Models & Pricing and its model pages,
OpenCode Models and Zen, and the xAI model catalog. Never turn a promotional allowance, provider
benchmark, or model name such as `Flash` into an inventory score.
