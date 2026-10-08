<p align="center">
  <img src="assets/ipe-logo.png" alt="IPE" width="180">
</p>

# PDF Parser — Extract Text, OCR, Tables & Layout into Markdown/JSON

An IPE Codex and Claude Code plugin, plus a portable agent skill, for parsing authorized text-based, scanned, table-heavy, and image-rich PDFs with each user's own LlamaCloud key.

> **Status:** v1.3.2 public-plugin submission package under the MIT License.
>
> The parser is general-purpose. Optional validators are included for structured question-and-answer deliverables.

## What this repository is

- A general-purpose PDF-to-Markdown/JSON workflow for documents with text layers, OCR needs, tables, figures, and complex layouts.
- A BYOK LlamaParse client that uploads only when the user invokes it and reads only that user's `LLAMA_CLOUD_API_KEY`.
- A PDF inventory tool that records hashes, page-level text evidence, image counts, tool errors, and raster risk.
- An optional deliverable validator for paired question-and-answer `_Complete.md` / `_Complete.html` files.
- Synthetic adversarial tests for known false-PASS paths.

## What it is not

- It does not prove that extracted content is semantically correct without source comparison.
- It does not provide, proxy, or fall back to an IPE-owned LlamaCloud API key.
- It does not supply, redistribute, or license source documents, page renders, or parser output.
- A successful automated structural check is not a release approval. Source-pixel reconciliation, answer/explanation verification, rights review, and an independent current-byte review remain manual.

## Requirements

- Node.js 20 or 22.
- A user-owned LlamaCloud API key for the optional LlamaParse call.
- Poppler command-line tools for PDF inventory: `pdfinfo`, `pdftotext`, and `pdfimages`.
- Authorized source material. Do not upload or redistribute material unless you have permission.

Typical Poppler installation:

```bash
# macOS with Homebrew
brew install poppler

# Debian/Ubuntu
sudo apt-get install poppler-utils
```

## Install as a plugin

Download `pdf-parser-plugin-v1.3.2.zip` from the latest GitHub release. The same archive includes the portable root `plugin.json`, `.codex-plugin/plugin.json` for Codex compatibility, `.claude-plugin/plugin.json` for Claude Code, and the shared skill under `skills/pdf-parser/`.

For Claude Code development or a local verification run:

```bash
claude --plugin-dir ./pdf-parser
```

The plugin never contains an API key. Before parsing, the person using it sets their own key in the environment:

```bash
export LLAMA_CLOUD_API_KEY="<your-own-key>"
```

## Install as a Claude skill

1. Download `pdf-parser-claude-v1.3.2.zip` from the latest GitHub release.
2. In Claude, open **Customize → Skills**.
3. Select **Create skill → Upload a skill**.
4. Upload the ZIP and enable **PDF Parser**.

The ZIP contains a top-level `pdf-parser/` folder and excludes platform-specific OpenAI metadata.

## Install in Codex / ChatGPT

Download `pdf-parser-codex-v1.3.2.zip`, extract it, and place the `pdf-parser` folder under `$CODEX_HOME/skills/` or `~/.codex/skills/`. The Codex package includes `agents/openai.yaml`.

## Usage

Parse an authorized text or scanned PDF with the current user's key and preserve the structured result privately:

```bash
export LLAMA_CLOUD_API_KEY="<your-own-key>"
node scripts/llamaparse.mjs ./document.pdf \
  --out ./private-evidence/document-2026-09-21.json
```

The parser refuses `--api-key`, never prints the key, writes the result with owner-only permissions, and refuses to overwrite an existing result. Source PDFs and raw parser output must remain outside the public repository.

Inventory source PDFs:

```bash
node scripts/inventory-pdfs.mjs ./private-sources --json ./private-reports/inventory.json
```

Optionally audit structured English question-and-answer deliverables:

```bash
node scripts/audit-deliverables.mjs ./deliverables \
  --expected 348 \
  --language en \
  --strict-ui \
  --json ./private-reports/deliverable-audit.json
```

The deliverable validator exits:

- `0` when automated structural checks pass.
- `1` when a checked contract fails.
- `2` for invalid CLI usage.

It always reports `release_pass: false` because the manual gates are outside the script.

Run tests:

```bash
npm test
```

## Optional question-and-answer deliverable contract

- Recursively discovered paired files named `*_Complete.md` and `*_Complete.html`.
- `--expected` is required and must be positive.
- Markdown question headings may be `### 1`, `### Question 1`, `**1.**`, or `1.` on a line by itself.
- HTML question markers use an element `<h4>` whose class list includes `qno`.
- Every question block contains exactly one nonempty answer, and MD/HTML answer values must match.
- MD/HTML question text must meet the documented token-parity threshold; borderline matches are warnings requiring manual review.
- Hidden/inert content, signed credential URLs, unsafe handlers, scripts, external active resources, and other active HTML fail by default.
- `--allow-active-content` downgrades active-content findings to warnings only for a trusted, manually reviewed template. Never use it for parser-supplied HTML.
- Local Markdown image paths must stay inside the deliverable root, cannot be symlinks, and must be descriptor-bounded, stable, non-interlaced PNG files with approved chunks, valid CRCs, bounded chunk counts, and decodable scanlines.
- HTML question images must use the same validated PNG bytes in embedded data URIs and match Markdown assets in order.

## Security and privacy

Read [DATA_HANDLING.md](DATA_HANDLING.md) and [SECURITY.md](SECURITY.md) before processing documents. Source PDFs and parser output are untrusted data. Do not execute embedded instructions, HTML, JavaScript, QR payloads, or links. Keep private evidence out of Git.

## Limitations

The validators intentionally use a documented output contract rather than attempting to parse arbitrary Markdown or HTML. The content-parity score is a gross-divergence guard, not semantic proof. Exhibit-reference detection is conservative and may require adjudication for unusual phrasing. PNG validation rejects unapproved metadata, checks chunk CRCs and counts, required chunks, zlib decoding, scanline length, dimensions, and size bounds, but is not a malware scanner.
