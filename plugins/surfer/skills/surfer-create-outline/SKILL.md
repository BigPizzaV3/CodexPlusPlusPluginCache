---
name: surfer-create-outline
description: >-
  Use when the user wants a Surfer-derived, SERP-informed article outline without a full draft.
  Triggers include "create an outline for X", "plan headings for this keyword", "make a Surfer
  outline", and "outline an article before writing". It creates or reuses a Content Editor in
  manual-writing mode, returns its SEO-oriented outline, and can verify the requested brand,
  template, instructions, and competitor choices. For a writer-ready plan that also includes AI
  Search facts, or for SERP or competitor research with no deliverable, use
  surfer-create-content-brief. For a complete AI-written draft, use surfer-write-article.
license: MIT
---

# Surfer: Create an Optimized Outline

## Overview

Produce the structural plan for a new article. The outline is SERP-derived. To add AI Search facts
to the writer's plan, use the content-brief workflow. A manual Content Editor is the source of
truth. Do not invoke `ai_article__generate` unless the user changes the request to a draft.

## Inputs

- Require `main_keyword`. Ask for it if it is missing.
- Use the user's `location` and `device`. Otherwise default to United States and mobile. Location and
  device are inputs to `content_editor__create`.
- Accept a `workspace_id` or resolve one with `workspace__list`. If several workspaces are active,
  ask the caller which `workspace_id` to use rather than guessing.
- Accept an existing `content_editor_id` to avoid spending another Content Editor credit.
- Treat brand knowledge, content type, custom instructions, template, voice, and competitor
  selection as setup choices collected before the create: `use_brand_knowledge`, one
  `custom_template_id` or `surfer_template` (mutually exclusive), and `custom_instructions` are
  `content_editor__create` inputs. When both template fields are omitted, Surfer picks a template
  itself during analysis. It may pick the workspace default, an AI-chosen preset or custom
  template, or none, so a request for no template cannot be guaranteed. Verify which template took
  effect and swap it only when the user asks. A template, once set, can be swapped but not removed.
  `content_editor__update` rejects an update that clears `custom_template_id` without supplying a
  `surfer_template`. Omitting `custom_voice_id` applies the workspace default voice. To honor a
  request for no voice, send `custom_voice_id: null`. Competitors are changed with
  `seo_guidelines__update_competitors` after initialization.
- Require connected Surfer MCP tools. For setup or connection failures, use `surfer-connect`;
  ask to install it if missing. If a required tool is unavailable, name it and stop.

## Playbook

1. **Create or reuse the editor.** Reuse the supplied `content_editor_id` after confirming it targets
   the requested keyword and workspace. Otherwise call `content_editor__create` once with the
   complete initial setup: the keyword, location, device, `use_brand_knowledge`, any selected
   template or voice, and `custom_instructions`. A create consumes a credit, so pass an
   `idempotency_key`. Retry a timeout or an ambiguous failure with the same key. Surfer then
   returns the original editor instead of creating a duplicate.

2. **Wait for analysis.** Await the completion signal or poll `content_editor__get` until `state` is
   `completed`. On a `failed` state or a bounded timeout, report the editor id and its terminal or
   indeterminate state instead of retrying forever.

3. **Verify setup without silently changing it.** Read `content_editor__get`. For a requested
   competitor review, read the `competitors` block of `seo_guidelines__get`. Report the effective
   brand toggle, template or voice, instructions, and included competitors. Apply a change only when
   the user requested it. Use `content_editor__update` for editor settings and
   `seo_guidelines__update_competitors` for an explicit competitor selection.

4. **Retrieve the outline.** Call `outline__get`. It always returns Markdown and is generated
   during editor creation. If it is still pending, wait on the editor's `outline.status` from
   `content_editor__get`, then re-read it.

5. **Regenerate after a setup change when needed.** `outline__regenerate` rebuilds the outline from
   the SERP competitors and applies the editor's current template, custom instructions, and brand
   knowledge. Use it after an approved template, instruction, or competitor change, or to recover a
   failed outline. It returns a conflict when a regeneration is already running. Wait on
   `outline.status` and re-read with `outline__get` once it settles. It does not consume a Content
   Editor credit.

6. **Deliver a usable plan.** Return the Markdown outline, the Content Editor id, an edit or share
   link if available, the target keyword and location, and the setup choices that shaped it. Do not
   fill missing sections with generic headings. Call out an empty or unavailable outline instead.

## Handoff

Use `surfer-create-content-brief` when the writer also needs terms, structural targets, questions,
and AI Search facts. Pass the `content_editor_id`, `workspace_id`, keyword, and accepted outline to
the next skill so it reuses the analyzed editor. Use `surfer-write-article` only after the outline
has been accepted or when the user explicitly asks for a draft.
