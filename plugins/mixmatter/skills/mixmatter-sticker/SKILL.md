---
name: mixmatter-sticker
description: >-
  Create a sticker, emoji-like asset, reaction cutout, label, or die-cut graphic from a user-supplied image. Use when the
  output should be a reusable isolated asset with optional outline, shadow, and transparent background. Do not use for
  caption-led memes, broad editorial image reconstruction, or animated/video output.
---

# MixMatter Sticker 3.0

Create a legible, reusable small-format asset while preserving the source subject's identity.

## Before generation

- Require a source image unless the user explicitly asks for a new sticker from text.
- Identify the subject boundary, identity-bearing details, fragile thin parts, and any source text.
- Respect exact user choices from Matter Studio. If none were supplied, use `Clean Cutout`, a medium white edge, a subtle shadow, and a transparent background.
- Ask only when the requested crop would remove identity-critical content or when exact wording is missing.

## Construction rules

- Isolate one clear subject or coherent subject group.
- Simplify internal detail enough to read at chat-sticker size without turning the subject generic.
- Use a continuous, optically even outline. Expand narrow gaps where necessary so the edge does not collapse.
- Keep shadows short, soft, and secondary. Do not use a large photographic drop shadow.
- For transparent output, keep the canvas genuinely transparent outside the sticker silhouette.
- Preserve source text exactly. Never substitute plausible-looking pseudo-text.
- Avoid adding decorative icons, sparkles, facial features, or props unless the user asks.

## Mode interpretations

- `Clean Cutout`: faithful subject, tidy silhouette, minimal stylization.
- `Emoji`: stronger expression and simplified forms, but preserve recognizability.
- `Label`: flatter print treatment with a compact badge-like silhouette.
- `Die-cut`: tactile print edge, optional slight registration variation, still production-clean.

## Delivery check

Verify the subject is not clipped, the border is consistent, transparent regions are clean, small details survive, and the result remains readable at 128 px.
