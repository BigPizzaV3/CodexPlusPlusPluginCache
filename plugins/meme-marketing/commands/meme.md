---
description: Craft 3 to 5 zero-cringe memes for an audience (CREATE route)
argument-hint: "<topic> [audience] [dialect: english|egyptian|saudi|levantine] [platform]"
---

Use the meme-marketing skill in CREATE mode for this brief:

$ARGUMENTS

Run the full 6-phase DAG from SKILL.md:

1. Lock the audience, platform and dialect. If something is missing, state one practical assumption and continue.
2. Delegate micro-moment mining to the `meme-moment-miner` subagent, passing the skill root path.
3. Build 3 to 5 concepts, each with a different humor mechanic and visual form.
4. Delegate review to the `meme-bineval-critic` subagent and apply its repairs. Drop anything that still fails a gate.
5. For concepts that fit a built-in doodle template, delegate rendering to the `meme-doodle-renderer` subagent.
6. Deliver per meme: caption, on-image text, visual brief, Send Test target, and the rendered SVG path if any.

If the user asked for JSON, also save the batch following `references/output-contract.md`; the plugin hook validates it on write.
