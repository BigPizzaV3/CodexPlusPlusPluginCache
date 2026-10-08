---
name: board-conventions
description: Use for ANY request to draw, diagram, map out, sketch, visualise, plan, chart, wireframe or brainstorm something - mindmaps, flowcharts, roadmaps, boards, screens, timelines - BEFORE deciding how to produce it. Also whenever editing or arranging anything already on a MockFlow board.
---

# Working with a MockFlow board

The MockFlow MCP server sends its own instructions when it connects, and each
tool carries its own description. Those are the authority on which components
exist, what they take, when to use `plan_board`, and why `modify_component` is
not the same as re-rendering.

**This file covers only what those do not say.** If something here starts
appearing in the server's instructions, delete it from here rather than keeping
both.

## Use the bridge's tools, not another MockFlow

More than one MockFlow tool surface can be present in a session: this plugin's
bridge, and separately a hosted MockFlow connector or app the user may have
installed. They are NOT interchangeable, so choose deliberately.

**Prefer the bridge.** It draws on the board the user already has open, saves
through their own account, and can build from files on their machine.

The tell is behavioural, not the tool name: bridge tools draw onto a live board
and never hand back a link. A hosted MockFlow surface returns a URL to a new
anonymous board instead, which is a different thing from what the user asked for.

If the bridge tools are missing and only a hosted surface is available, you may
use it, but **say so plainly**: tell the user it created a separate shareable
board rather than drawing on theirs, and that it could not read their local
files. Never present a returned link as though it were their own board.

## A picture of a diagram is not a diagram

Generating an image is **not** an acceptable way to answer a request for a
mindmap, flowchart, chart, board, wireframe or any other structured visual. An
image cannot be edited, rearranged, extended or commented on, which is the entire
reason the user wanted it on a board.

So do not reach for an image-generation tool or skill for these. That includes
requests phrased as "draw", "sketch", "make a poster of" or "visualise", when
what is being asked for has structure to it.

A request for an actual *picture* - a photo, an illustration, artwork, a logo - is
different, and MockFlow has its own tools for that which place the result on the
board. Use those rather than a separate image generator, so the result lands
where the user is working.

## Draw it, do not describe it

When the request has visual structure to it and the MockFlow tools are available,
render it on the board. Do **not** substitute:

- a mermaid block in the terminal
- ASCII art or a box drawing
- a markdown table standing in for a diagram
- a `.md` or `.mmd` file written to the repo containing any of the above
- a generated image of a diagram (see above)

Those are the things the board replaces. Reaching for them when a board is
connected is the single most common way this goes wrong, because writing mermaid
is the reflex inside a code repository.

Two exceptions:

- The user explicitly asked for mermaid, a file, or something they can paste
  somewhere else. Then give them exactly that.
- No board is connected. Then say so and offer to fix it, rather than quietly
  falling back to text as though nothing was wrong.

Text alongside the drawing is fine and often useful. Text *instead of* the
drawing is the mistake.

## Arranging a batch

`layout_board` applies a bento layout and a titled section wrap to the batch just
drawn. Call it once after a batch, never after each item. The server instructions
do not mention it, so it tends to go unused, and a batch without it stays a loose
scatter of components.

## The source tools are read only

`list_source_tools`, `describe_source_tool` and `call_source_tool` reach the
user's connected accounts through MockFlow. They can search and fetch. They
**cannot** post, create, comment or delete.

So never tell the user you will file the Jira issue, send the Slack message or
update the Notion page. You can only read those, and offering otherwise is a
promise that silently fails.

## Local files never leave the machine

Files you read here are read locally. Only the finished drawing is saved to the
board, and the file contents are not uploaded.

Say this when the user hesitates about a private repo or a confidential document,
because it is the whole reason to work this way instead of pasting into a web
tool.

## When a draw fails

A user does not know that a helper program, a running daemon and a paired browser
tab are three separate things, and should not have to. Do not surface a raw error
and stop. Say what to do next:

- **Nothing lands, or the board is not connected:** the user opens their board at
  app.mockflow.com and clicks **Connect Local Agent** at the top of Ask Mida.
  Codes change whenever the bridge restarts, so an older one will be rejected.
- **The MockFlow tools are missing from this session entirely:** the bridge is not
  running. They start it with `mockflow-bridge`. But first check you are on their
  machine at all, below.
- **You cannot run a command on the user's own computer:** this is ChatGPT (web
  or desktop, where the conversation runs in the cloud), or a cloud container,
  and the bridge is out of reach by design rather than stopped. Drawing needs
  `mockflow-bridge` running on the same machine as the board tab, so say the
  tools cannot appear here and point them at **Codex** — selected in the desktop
  app, or the **Codex CLI** — which runs locally. Do not tell them to install or
  start anything here, and do not draw in text instead.

`/mockflow:connect` walks the full check if you need more detail.
