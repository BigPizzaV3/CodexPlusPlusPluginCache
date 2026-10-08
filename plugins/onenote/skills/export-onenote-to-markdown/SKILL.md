---
name: export-onenote-to-markdown
description: Export, back up, archive, download, or migrate personal Microsoft OneNote pages, sections, or notebooks to downloadable Markdown files. Use for OneNote-to-Markdown and OneNote-to-Obsidian requests, including bounded multi-page exports.
---

# Export OneNote to Markdown

1. Establish the exact personal page, section, or notebook to export. Explain before a large scan that the current workflow returns one Markdown file per page; it does not create a ZIP, write directly to an Obsidian vault, embed images or attachments, rewrite OneNote links as Obsidian wikilinks, or export shared group/site pages.
2. Keep the source read-only. During export, do not invoke `create_page`, `update_page`, `append_to_page`, `copy_page_to_section`, or `delete_page`. `list_notebooks` is a read-only action even though Microsoft Graph assigns it the connector's `Notes.Create` scope. Treat any request to delete originals as a separate consequential workflow requiring confirmation after export verification.
3. Inventory one batch before exporting. Resolve the notebook with `list_notebooks`; recursively walk `list_section_groups` and `list_sections`; enumerate selected sections with `list_pages`. Collect no more than 20 pages in one turn, requesting only the remaining batch size. Retain the current section and `next_skip` cursor when the cap is reached instead of continuing discovery, along with every observed page ID, title, parent path, and source URL.
4. Call `export_page_as_markdown` once for each page in the current inventory batch and preserve every returned file reference. Do not replace the deterministic export with model-generated Markdown from `get_page_text` or raw `fetch_page` HTML.
5. Treat `resources_not_included`, `unsafe_links_removed`, `complex_table_structure_simplified`, and `unsupported_content_omitted` warnings as partial-fidelity results. The complex-table warning means nested tables or merged cells were flattened because GitHub-Flavored Markdown cannot represent their structure exactly. If the user needs a personal-page image or attachment separately, inspect that page with `fetch_page`, then call `fetch_page_resource` with both that page ID and the exact resource ID observed in its current HTML. State that the returned resource is separate and is not linked from the Markdown file.
6. Reconcile the inventory against exported, partial, and failed page counts. Report every failure and warning, return all observed file references, and never say the migration is complete when a page failed or a pagination window remains.
7. For a large notebook, finish the current bounded batch and offer to continue with the remaining observed page IDs. Do not claim durable checkpoint or resume support based only on chat history.

Use a result summary shaped like:

```text
Exported: <count>
Partial: <count>
Failed: <count>
Remaining: <count or unknown>
Files: <returned Markdown file references>
Warnings: <page-specific fidelity limitations>
```
