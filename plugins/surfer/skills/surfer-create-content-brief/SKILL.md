---
name: surfer-create-content-brief
description: >-
  Use when the user wants a writer-ready content brief grounded in Surfer's SEO and AI Search
  guidance. Triggers include "make a content brief", "brief a writer for this keyword", "what should
  an article cover", and "give me an SEO and AI Search brief". Also use it for SERP or competitor
  research with no draft, such as "analyze the SERP for this keyword" or "what do the top-ranking
  pages cover". It reports the SERP-derived competitors, structure, terms, and questions without
  writing anything. It creates or reuses a manual Content Editor and assembles its outline, SEO
  guidelines, and source-attributed AI Search facts into a concise brief. For an outline alone, use
  surfer-create-outline. For an article draft, use surfer-write-article.
license: MIT
---

# Surfer: Create a Content Brief

## Overview

Turn a keyword into an evidence-aware writing specification. The output is a brief for a human or
agent writer. Do not produce a generic article, and do not imply that an empty editor already scores
well.

## Inputs and setup

- Require `main_keyword` and ask for it when missing. Use the user's `location` and `device`,
  otherwise default to United States and mobile. Accept a `workspace_id` or call `workspace__list`
  and choose the sole active workspace. If several are active, ask the caller which one to use;
  if none is active, stop and report that resource operations are unavailable.
- Reuse an existing `content_editor_id` when it matches the intended keyword and scope. Otherwise
  create one. A `content_editor__create` call with only a keyword yields a manual editor. AI
  drafting starts only when `ai_article__generate` is called. A create consumes a credit, so pass
  an `idempotency_key`. Retry a timeout or an ambiguous failure with the same key. Surfer then
  returns the original editor instead of creating a duplicate.
- Before creation, collect brand knowledge, content type or template, voice, custom instructions,
  and competitor choices whenever they must shape the initial outline. They map to the
  `content_editor__create` inputs: `use_brand_knowledge`, one `custom_template_id` or
  `surfer_template` (mutually exclusive), and `custom_instructions`. When both template fields are
  omitted, Surfer picks a template itself during analysis. It may pick the workspace default, an
  AI-chosen preset or custom template, or none, so a request for no template cannot be guaranteed.
  Verify which template took effect and swap it only when the user asks. A template, once set, can
  be swapped but not removed. `content_editor__update` rejects an update that clears
  `custom_template_id` without supplying a `surfer_template`. Omitting `custom_voice_id` applies
  the workspace default voice. To honor a request for no voice, send `custom_voice_id: null`.
  Competitors change through `seo_guidelines__update_competitors` after initialization.
- Require connected Surfer MCP tools. For setup or connection failures, use `surfer-connect`;
  ask to install it if missing. If a required tool is unavailable, name it and stop.

## Playbook

1. **Initialize the Content Editor.** Call `content_editor__create` with the complete initial setup
   when no suitable editor exists. Await the completion signal or poll `content_editor__get` until
   `completed`. On failure or timeout, report the editor id and stop.

2. **Inspect the effective setup.** Read `content_editor__get`. Read the `competitors` block of
   `seo_guidelines__get` only when competitor selection matters. State the effective brand toggle,
   template or voice, instructions, and competitor set. Change a setting only on an explicit user
   request, using `content_editor__update` or `seo_guidelines__update_competitors`.

3. **Collect the brief inputs:**
   - `outline__get`, always returned as Markdown.
   - `seo_guidelines__get`, the SEO brief with structure targets, terms, topics, and questions.
   - `ai_search_guidelines__list_facts` for the source-attributed facts. Check the analysis readiness
     reported by the MCP tool: wait with a bound while analysis runs, use the facts once complete,
     and report failure or a timeout without inventing facts. The separate AI Search score may be
     read when needed, but its `ready` status does not establish facts analysis completion; do not
     use a score to grade an empty draft.

   If the outline is pending, wait on `outline.status`. `outline__regenerate` rebuilds it from the
   SERP competitors with the current template, instructions, and brand knowledge. Use it after an
   approved setup change or to recover a failed outline, then re-read `outline__get`.

4. **Write the brief as structured sections.** Organize it into:
   - search intent, the primary keyword, location and device, and audience and brand constraints
   - a proposed title and the Surfer-derived outline
   - word-count and structural targets, given as ranges rather than hard quotas
   - priority terms, marking which belong in headings and which in body coverage
   - the required subtopics and questions
   - AI Search facts as candidate claims, each keeping its source URL and `cited_by` context
   - explicit constraints, open questions, and the Content Editor link and id

5. **Preserve evidence boundaries.** Do not call an AI Search fact true merely because an engine
   suggested or cited it. Attribute it, ask the writer to verify material claims, and call out
   unavailable or incomplete AI Search analysis rather than fabricating facts.

6. **Hand off deliberately.** Stop after the brief unless the user also asks for drafting. Pass the
   `content_editor_id`, `workspace_id`, keyword, accepted outline, and brief to
   `surfer-write-article` so it reuses the analyzed editor. The outline is planning context; the
   writer's optional AI outline review is a separate step. Do not automatically start
   `ai_article__generate`.
