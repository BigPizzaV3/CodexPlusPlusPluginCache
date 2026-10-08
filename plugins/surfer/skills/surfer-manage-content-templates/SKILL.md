---
name: surfer-manage-content-templates
description: >-
  Use when the user wants to create, inspect, update, choose, or delete a reusable Surfer content
  template. Triggers include "create a custom template", "turn this article into a Surfer template",
  "list our templates", "set a default template", and "update or delete a content template". For a
  writing style or tone profile, use custom voices. For one article's direction, use the custom
  instructions in surfer-write-article.
license: MIT
---

# Surfer: Manage Content Templates

## Overview

Manage reusable structural examples safely. A template is a reference text that future Content
Editors reuse for structure. The Boundaries section separates it from a voice profile and a one-off
prompt.

## Boundaries

- A template is the reusable organization, sections, formatting, and recurring document shape.
- A custom voice is the reusable tone and style. Manage it with `custom_voice__*` when that is the
  actual request.
- Custom instructions are one editor's editorial or factual direction. Pass them through
  `content_editor__create` or `content_editor__update`.
- A Surfer template is a read-only predefined template from `surfer_content_template__list`. Never
  try to update or delete it.

## Prerequisites

- Resolve the workspace with `workspace__list`. If several workspaces are active, ask the caller
  which `workspace_id` to use rather than guessing.
- Require connected Surfer MCP tools. For setup or connection failures, use `surfer-connect`;
  ask to install it if missing. If a required tool is unavailable, name it and stop.
- Do not create a template until the user supplies or approves its name and reference text.

## Playbook

1. **Inspect before mutating.** Use `content_template__list` to find a similarly named custom
   template. Use `content_template__get` before changing a specific template. List predefined options
   with `surfer_content_template__list` when the user wants to compare rather than create a duplicate.

2. **Prepare a high-signal reference.** Keep stable structure, heading hierarchy, formatting, and
   representative phrasing. Remove stale facts, client secrets, and accidental product claims.
   Preserve only material the user is authorized to reuse. Do not bury changing campaign details in a
   shared template. Create and update both require a `reference_text` of 1 to 25,000 characters and
   at least 200 words. When the reference falls short of 200 words, ask the user for more material
   or for approval to expand it. Never pad the reference silently to clear the floor.

3. **Create safely.** Call `content_template__create` with `name`, `reference_text`, and
   `default: false` unless the user explicitly requests a workspace default. Pass an
   `idempotency_key`. Retry a timeout or an ambiguous failure with the same key. Surfer then
   returns the original template instead of creating a duplicate. Read the created template
   afterward to confirm its id and stored reference text.

4. **Update intentionally.** Read the target first, show the proposed changes to name, reference, and
   default, then call `content_template__update`. Treat changing the default as a workspace-wide
   behavior change, and require explicit user confirmation immediately before it.

5. **Delete only with confirmation.** Identify the exact template by id and name, explain that
   deletion is destructive, and call `content_template__delete` only after the user confirms that
   exact target. Never infer a deletion from a request to "clean up templates."

6. **Make selection explicit.** Return the template id and workspace. To apply it to a new article,
   pass the chosen `custom_template_id` to `content_editor__create`. Do not combine it with
   `surfer_template`, because the two are mutually exclusive.
