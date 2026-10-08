---
name: surfer-write-article
description: >-
  Use when the user wants Surfer to produce a brand-new article or blog post from a keyword or topic.
  Triggers include "write an SEO article about X", "draft optimized content for this keyword",
  "generate a Surfer AI article", and "write for SEO and AI Search". To improve content that already
  exists, use surfer-optimize-content. For a writer brief without a draft, use
  surfer-create-content-brief.
license: MIT
---

# Surfer: Write an Optimized Article

## Overview

Turn a keyword into a new, AI-authored draft grounded in Surfer's SEO and AI Search analysis. When
the user wants only an outline or a brief, create a manual Content Editor and stop before
`ai_article__generate`.

## Prerequisites

- Require connected Surfer MCP tools. For setup or connection failures, use `surfer-connect`;
  ask to install it if missing. If a required tool is unavailable, name it and stop.
- Use the `workspace_id` supplied by the user or the handoff, and verify it is active with
  `workspace__list`. If none was supplied, use the sole active workspace or ask the caller to
  choose when several are active.
- Accept an existing `content_editor_id` as a first-class input, especially from a recommendation,
  outline, or brief handoff. Require `main_keyword` for a new editor; for an existing editor, read
  its keyword and accept up to 19 secondary keywords. Default the location to United States and the
  device to mobile only when creating. Location and device are inputs to `content_editor__create`.
- Before creation, collect the optional `target_word_count`, any SEO or AI Search score targets,
  and `manual_outline`, which is an `ai_article__generate` input. Collect the full editor setup as
  well: the `use_brand_knowledge` toggle (it applies the workspace's brand profile, which cannot be
  inspected or edited from here), one `custom_template_id` or `surfer_template` as the content type
  (mutually exclusive), and `custom_instructions`. When both template fields are omitted, Surfer
  picks a template itself during analysis, so a request for no template cannot be guaranteed.
  Omitting `custom_voice_id` applies the workspace default voice. To honor a request for no voice,
  send `custom_voice_id: null`. Competitors are read from the `competitors` block of
  `seo_guidelines__get` and changed with `seo_guidelines__update_competitors` after initialization.
- Treat "AI writing mode" as the `ai_article__generate` call rather than a `content_editor__create`
  field. Leave it out for manual work.

## Playbook

1. **Reuse or create the Content Editor.** When `content_editor_id` is supplied, read it with
   `content_editor__get` in the selected workspace. Verify the keyword and any location, device, or
   setup constraints the user supplied; report a mismatch before generating. Keep its existing
   settings unless the user requested a change. Reuse it for a continuation or a first draft from
   an outline or brief. An explicit request for another, separate article takes priority: create a
   fresh editor with the requested setup. Otherwise, if no id was supplied, look for a matching
   editor the user asked to continue and call `content_editor__create` only if none applies.
   Include the keyword, location, device, selected brand toggle, template or voice, and custom
   instructions. A create consumes a credit, so use one `idempotency_key` for that logical create
   and reuse it after an ambiguous response. If no template is selected, keep the one Surfer chooses
   during analysis.

2. **Wait for initialization.** Await the completion signal or poll `content_editor__get` until
   `state` is `completed`. Report a failure or a bounded timeout with the editor id.

3. **Review the content plan before drafting.** Read `seo_guidelines__get`, one brief with the terms,
   structure targets, topics, questions, and competitors. Read `ai_search_guidelines__list_facts`
   when AI Search is a goal. Read `content_editor__get` to verify the brand toggle, template or
   voice, and instructions. If the user asks to change competitors, inspect the `competitors` block
   of `seo_guidelines__get`, apply an approved `seo_guidelines__update_competitors`, then re-read the
   affected guidelines before generating.

4. **Choose outline behavior.** `outline__get` returns the read-only SERP outline.
   `outline__regenerate` rebuilds it from the SERP competitors with the editor's template,
   instructions, and brand knowledge. Use it after a setup change or a failed outline. For a
   reviewable AI outline, set `manual_outline: true` when calling `ai_article__generate`. That
   outline is separate from the SERP outline and pauses before prose is written.

5. **Generate or continue the requested article.** Call `ai_article__generate` for a new draft.
   For a continuation, use `ai_article__get` with the known article id, or `ai_article__list` to find
   it. If generation reports an existing-article conflict, use the returned article id to continue
   that work. Surfer rejects another generation in an editor with an in-progress or completed
   article; an explicit request for a separate article uses a fresh editor as in step 1. After a
   lost response, use `ai_article__list` to recover the article; if the outcome remains unclear,
   report it and stop without an automatic retry. On `waiting_for_user_input`, fetch
   `ai_article__get_outline`, present it, and submit only the user-approved version with
   `ai_article__submit_outline`. While it is `new`, `generating_outline`, or `writing`, wait. On
   `failed`, report and stop.

6. **Read the canonical draft and score snapshot.** Await the completion signal or poll
   `ai_article__get` until `completed`. Fetch `content__get`, then read `content_score__get` for the
   unified `total` plus the `seo` and `ai_search` subscores. Trust an individual score only when its
   `status` is `ready`. A `loading` or `calculating` status is still settling. An `error` or
   `unavailable` AI Search score is terminal. Call it out rather than treating it as a pass or
   polling for `ready`.

7. **Iterate only toward user-selected targets.** If a target is set and unmet, improve the draft
   with the relevant SEO guidance and the sourced AI Search facts, write it with `content__update`,
   re-fetch the sanitized stored version with `content__get`, and wait for the selected score
   timestamps to advance. Stop after 3 to 5 rounds or after a plateau. Do not chase a unified Content
   Score target.

8. **Deliver and hand off.** Return the canonical content, the SEO, AI Search, and unified scores
   separately, the Content Editor id, and an edit or share link from `permalink__list`. For a
   recommendation-led workflow, hand control back to `surfer-content-recommendations`.
