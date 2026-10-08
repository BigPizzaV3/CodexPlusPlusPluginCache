## Source adapter: Local Folder

Use this when the customer has `.html`, `.eml`, PNG, or JPEG email files in a dedicated
folder. Requires Codex CLI or another Codex surface with local file access.

### Discover

Ask for the exact folder path and whether discovery should be recursive. Default to a
non-recursive walk and list only candidate files:

```bash
find <folder> -maxdepth 1 -type f \( -iname '*.html' -o -iname '*.htm' -o -iname '*.eml' -o -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \)
```

Never scan Downloads, an inbox export, or another broad folder without the customer's
explicit confirmation. Group obvious filename variants, ask which one is current, and report
the raw file counts plus the proposed template count before fetching anything.

### Fetch

- HTML: read it, render at the target email width in headless Chrome, and trim trailing blank
  space. Empty page below the email invites the converter to invent spacers.
- EML: extract the `text/html` MIME part with Python's `email.parser`, then render it. Use
  `text/plain` only when HTML is absent and explain that it contributes little visual design.
- PNG or JPEG: use the file directly. Do not upscale a source narrower than the target width.

Render command, using the customer's target width:

```bash
google-chrome --headless=new --screenshot=<out.png> --window-size=<width>,4000 --force-device-scale-factor=2 file://<absolute-path>
```

Send the PNG through [module-conversion.md](../module-conversion.md), Phase 3 step 1, with
`emailWidth` pinned to the target when prompt inputs are available.

### Audit adaptations

- File discovery replaces the Figma survey.
- Source fidelity is always REFERENCE ONLY. Do not derive a scale factor from rendered HTML
  or screenshots.
- Split modules per template. v1 does not deduplicate across templates; say that clearly and
  defer collapse of near-duplicates to design review.
- Derive the first brand-foundations proposal from at least three templates, never one.
- Estimate per template and call out that deferred deduplication raises the first-pass count.

The report carries the confirmed source path, per-template format and module count, verdict
roll-up, brand proposal, deferred-deduplication flag, and effort estimate. State REFERENCE ONLY
once at the top; do not fabricate a scale-factor section.
