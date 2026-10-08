---
name: surfer-optimize-content
description: >-
  Use when the user has existing content, a URL or a draft, and wants to improve its Surfer SEO
  Score, AI Search Score, or both. Triggers include "optimize my article", "improve this page's
  content score", "auto-optimize this", "make this rank better", "optimize for SEO and AI search",
  and "improve my AI or LLM visibility". For writing a new article from scratch, use
  surfer-write-article instead.
license: MIT
---

# Surfer: Optimize Existing Content

## Overview

Raise the Surfer score dimensions the user selected for a page or draft, working through a Content
Editor. Treat the unified Content Score as a diagnostic snapshot. Optimize against the explicit SEO
or AI Search targets the user cares about.

## Prerequisites

- Require connected Surfer MCP tools. For setup or connection failures, use `surfer-connect`;
  ask to install it if missing. If a required tool is unavailable, name it and stop.
- Resolve an active `workspace_id` with `workspace__list`. If several workspaces are active, ask
  the caller which `workspace_id` to use rather than guessing.
- Require a target keyword and either an import URL or raw HTML or Markdown. Ask for a missing
  keyword rather than guessing it from the page alone.
- Ask which dimensions matter: SEO, AI Search, or both. If the user says only "optimize", default to
  SEO 70+. If they ask for both and give no targets, default to 70+ for each and say so. A missing
  AI Search score does not mean zero.
- Treat brand knowledge, content type or template, custom instructions, and competitor selection as
  Content Editor setup, collected before the create: the brand profile is applied through the
  `use_brand_knowledge` toggle and cannot be inspected or edited from here, the content type is one
  `custom_template_id` or `surfer_template` (mutually exclusive), instructions go in
  `custom_instructions`, and competitors are read and changed through `seo_guidelines__get` and
  `seo_guidelines__update_competitors`. When both template fields are omitted, Surfer picks a
  template itself during analysis. It may pick the workspace default, an AI-chosen preset or custom
  template, or none, so a request for no template cannot be guaranteed. Verify which template took
  effect and swap it only when the user asks. A template, once set, can be swapped but not removed.
  `content_editor__update` rejects an update that clears `custom_template_id` without supplying a
  `surfer_template`. Omitting `custom_voice_id` applies the workspace default voice. To honor a
  request for no voice, send `custom_voice_id: null`.

Use bounded waits only. On an explicit failure, an unavailable score, or a timeout, report the id
and state. Never poll indefinitely.

## Playbook

1. **Create or reuse a Content Editor.** Reuse a matching editor through `content_editor__list` when
   the user supplies one or asks to continue it. Omit `workspace_id` on that list call for an
   org-wide search. Otherwise call `content_editor__create` once with `main_keyword`, location,
   device, the full initial setup, and `import_content_url` for a live page. Default the location to
   United States and the device to mobile. For pasted text, omit the import URL and load the body
   after initialization. A create consumes a credit, so pass an `idempotency_key`. Retry a timeout
   or an ambiguous failure with the same key. Surfer then returns the original editor instead of
   creating a duplicate.

2. **Wait and verify the setup.** Await the completion signal or poll `content_editor__get` until
   `state` is `completed`. Read `content_editor__get`. If the user asked to review competitors,
   read the `competitors` block of `seo_guidelines__get`. Report the effective brand toggle,
   template or voice, instructions, and competitors. Apply changes only after user approval, with
   `content_editor__update` or `seo_guidelines__update_competitors`, then re-read the affected
   guidelines.

3. **Load content and establish the baseline.** For a pasted draft, call `content__update`, then
   re-fetch with `content__get`. Read `content_score__get` for the unified `total` plus the `seo`
   and `ai_search` subscores. A `loading` or `calculating` status means the score is still
   settling, so keep waiting until each selected subscore's `status` is `ready`. An `ai_search`
   status of `error` or `unavailable` is terminal. Report it and stop waiting. Before the next
   mutation, record the `calculated_at` of the `seo` and `ai_search` subscores. The `total` has no
   `calculated_at`.

4. **Read only the guidance needed.** For SEO, read `seo_guidelines__get`, one brief that carries the
   structure targets, terms, topics, questions, and competitors. For AI Search, read the facts with
   `ai_search_guidelines__list_facts`. Check the analysis readiness reported by the MCP tool: wait
   with a bound while analysis runs, and report failure or a timeout instead of treating incomplete
   facts as final. The separate `ai_search` score reaching `ready` does not establish facts analysis
   completion. `ai_search_guidelines__get` returns the facts plus the score, its status, and the fact
   count. Retain every fact's source URL and `cited_by` context.

5. **Choose an optimization path**, and ask when the user has no preference.
   - Call `auto_optimize__run` once per requested pass; it edits the document directly. Poll
     `auto_optimize__get` by the returned job id, or resume polling when continuing a known run.
     Each accepted start spends a credit and can cancel an earlier run, so do not automatically
     repeat a start whose response was lost. If no job id is available, report the outcome as unknown
     and stop. A `completed` job has a result of `optimized` or `nothing_to_optimize`. Stop on a
     `failed` state or a quota error.
   - A guided edit revises the draft against the selected guidelines, without keyword stuffing or
     unsupported claims, then calls `content__update`. Preserve source attribution for AI Search
     facts, and re-fetch the canonical stored body with `content__get` because Surfer sanitizes it.

6. **Recalculate and compare.** After either path, re-read the stored content and all selected scores
   with `content_score__get`. After a direct content update, trust a subscore only once its `status`
   is `ready` and its `calculated_at` has advanced past the pre-mutation value. A `loading` or
   `calculating` status may still carry the stale score. The `total` has no `calculated_at`, so
   gate it on `status` alone. If AI Search reports `error` or `unavailable`, report why and do not
   claim the combined target was reached.

7. **Iterate with a stopping rule.** Address the largest remaining SEO or AI Search gap, then repeat
   steps 4 to 6. Stop when every selected target is met, when auto-optimize reports
   `nothing_to_optimize`, when the last useful gain is under about one point, or after 3 to 4 rounds.
   Report the baseline and final values for the SEO, AI Search, and unified Content Score separately.
