---
description: Rebuild a meme for another dialect or market (LOCALIZE route)
argument-hint: "<meme or path> to <egyptian|saudi|levantine|english>"
---

Use the meme-marketing skill in LOCALIZE mode:

$ARGUMENTS

Delegate to the `meme-dialect-localizer` subagent with the skill root path, the source meme and the target dialect(s). Then pass the localized versions to the `meme-bineval-critic` subagent and fix any gate 8 (dialect) failures before replying.
