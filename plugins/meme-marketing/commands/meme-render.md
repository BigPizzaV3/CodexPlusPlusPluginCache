---
description: Render an approved meme into an SVG doodle card (RENDER route)
argument-hint: "<template: distracted|two-buttons|this-is-fine|drake> <copy for each panel>"
---

Use the meme-marketing skill in RENDER mode:

$ARGUMENTS

Delegate to the `meme-doodle-renderer` subagent with the skill root path and the approved copy. Save the SVG in the current working directory unless the user named another path, and report the file path. If no template fits, return the designer brief the subagent produces and say that no image file was created.
