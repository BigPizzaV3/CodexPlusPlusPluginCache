# /mockflow-draw

Draw something on the user's MockFlow board.

The user asked for this explicitly, so there is no judgement call to make: the
result goes on their board, not into the terminal.

## Arguments

- everything after the command name: what to draw. If nothing was given, ask what
  they want on the board and stop. Do not guess.

## This is not optional

Render it with the MockFlow tools. Do **not** answer with a mermaid block, ASCII
art, a markdown table standing in for a diagram, or a file written to the repo.
The user typed this command precisely to rule those out.

The only thing that stops you is a board that is genuinely not reachable. If the
MockFlow tools are missing from this session, or a render fails because no board
is connected, say so plainly and help them fix it. Do not fall back to text and
present it as though it were what they asked for.

Get the reason right before offering a fix. If you have no way to run a command
on the user's own computer, this is ChatGPT (web or desktop — a ChatGPT
conversation runs in the cloud either way) or a cloud container, and the bridge
cannot be reached from here at all: the tools will not appear, and telling them
to install or start it wastes their time. Drawing needs `mockflow-bridge` on the
same machine as the board tab, so point them at Codex — selected in the desktop
app, or the Codex CLI. `/mockflow:connect` has the wording and the checks.

## Everything else

The board conventions apply as normal: pick the component that fits, use
`plan_board` when the request needs several different components, use
`modify_component` rather than a second render when changing something already
there, and call `layout_board` once after a batch rather than after each item.
