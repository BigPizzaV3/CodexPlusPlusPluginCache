---
description: Audit a meme, caption or batch JSON against the 8 BinEval gates (AUDIT route)
argument-hint: "<meme text, image description, or path to batch.json>"
---

Use the meme-marketing skill in AUDIT mode on:

$ARGUMENTS

Delegate the review to the `meme-bineval-critic` subagent, passing the skill root path and the material above (or the file path if one was given). Return its gate table unchanged, then give the single strongest repaired version of each failing meme. Do not estimate reach, virality or engagement.
