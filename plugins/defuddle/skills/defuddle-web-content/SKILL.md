---
name: defuddle-web-content
description: Use when the user asks to extract the main readable article or page content from a public web page while removing
  navigation, ads, and other clutter.
license: MIT
compatibility: Requires a local Node.js/npm environment to execute Defuddle. The bundled source is reference material and
  does not install the runtime automatically.
---

# Defuddle Web Content

## Host capability adaptation

1. **Native host capability:** when ChatGPT/Codex exposes a native tool or connected source that satisfies this task, use it.
2. **Original external runtime:** when the upstream runtime named by this skill is actually available, use it as documented below.
3. **Instruction-only fallback:** when neither is available, perform only the reasoning/instruction portion that remains valid, state the limitation, and never fabricate tool output, successful execution, or persisted state.

Use an equivalent native host capability when available; otherwise perform only the instruction-based portion and clearly disclose the unavailable runtime.

Use Defuddle when a local terminal/runtime is available and the task calls for removing navigation, ads, sidebars, comments, and other page clutter while preserving the main content and metadata.

## Preferred CLI flow

Use `npx defuddle` so a global installation is not required:

```bash
npx defuddle parse <source> --markdown
```

`<source>` may be a URL or local HTML file. HTML may also be piped on stdin.

Common output modes:

```bash
npx defuddle parse page.html --markdown
npx defuddle parse page.html --json
npx defuddle parse page.html --frontmatter
npx defuddle parse page.html --property title
```

For exact CLI options and Node/browser API usage, read `references/source/README.md`.

## Runtime rule

Do not claim Defuddle extracted a page unless the command or library actually ran successfully. If the environment cannot execute Node/npm or cannot access the requested URL, explain that limitation and use another available reading method only if the user permits it.

## Source reference

The bundled `references/source/src/` directory contains the original 0.19.4 TypeScript source for implementation/reference purposes. It is not an installed npm dependency.
