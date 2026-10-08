---
name: setup
description: >
  Set up, install, start, reconnect, or verify Vibooks and vibooks-cli for a
  small-business bookkeeping workflow. Use when Vibooks is not installed,
  local API readiness is unclear, access is missing, or a company or book must
  be created or reused before bookkeeping begins.
---

# Set Up Vibooks

Follow the bundled `vibooks` skill for installation, authentication,
licensing, jurisdiction, and bookkeeping safety rules.

The plugin already provides the bundled Vibooks workflow. Do not install a
duplicate standalone skill with `npx skills`; use the agent client's plugin
manager for plugin updates.

1. Apply the bundled `vibooks` skill's 24-hour update-check cache before using
   `vibooks_update_status`. With two fresh catalog entries, call it once with
   `includeNetwork: false` when local installed versions are needed and combine
   those facts with the validated cache. If either entry is stale or the user
   asks to check now, call the normal networked tool once and validate each
   returned catalog as the bundled skill requires. Report updates; do not run a
   duplicate standalone check or install anything silently.
2. Run `vibooks_readiness`. If startup is unclear, inspect
   `vibooks_desktop_status`; inspect `vibooks_license_status` only when access
   or licensing blocks the requested work.
3. Reuse a trusted existing installation and book when possible. Otherwise
   follow the bundled skill's official install and bootstrap workflow.
4. Confirm the active company, book, accounting basis, jurisdiction, currency,
   and tax setup before creating bookkeeping data.
5. When an unfamiliar API operation is needed, discover it with `vibooks_ops`,
   then inspect it with `vibooks_describe` and `vibooks_schema` before use.
6. Do not bypass licensing, period controls, supported workflows, or the
   official Vibooks API and CLI paths.

Finish by reporting the selected company and book, readiness state, unresolved
setup decisions, and the next bookkeeping action that is safe to perform.
