---
name: connect
description: Check, pair or troubleshoot the connection between this machine and a MockFlow board. Use when board tools are missing or failing, when nothing appears on the board, or when the user asks which board they are connected to.
---

# MockFlow connection

Three things have to be true before anything can be drawn: the bridge helper is
installed, a daemon is running, and a board tab is paired.

Work through them in that order. Each check tells you which one failed. But check
step 0 first, because when it fails the other three are unreachable and every fix
below is wasted effort.

## 0. Can this session reach the user's own computer?

Everything else here assumes the session is running on the machine the board tab
is open on. When it is not, the bridge cannot be reached from here at all, and
saying "start the bridge" sends the user off to fix something that was never the
problem.

Two environments where this is the case:

- **ChatGPT, web or desktop.** A ChatGPT conversation runs on OpenAI's servers
  even in the desktop app — ChatGPT and Codex share that app, and the selector
  in the interface decides which one a conversation is. On the ChatGPT side
  there is no shell on the user's machine and the plugin cannot carry its MCP
  configuration, so the board tools are never present. Nothing the user
  installs will make them appear.
- **A cloud or remote container.** There is a shell, but it is not the user's
  computer. The bridge and the board tab have to be on the same machine, so a
  bridge started in a container has nothing to pair with.

The tell is that you have no way to run a command on the user's own machine. If
the MockFlow tools are absent and you cannot check for the bridge locally, assume
this rather than assuming a stopped daemon.

Say it plainly, name Codex as the way forward, and stop:

> Drawing on your board goes through **mockflow-bridge**, a small program that
> runs on your own computer and talks to the board tab open in your browser. A
> ChatGPT conversation runs on OpenAI's servers — even in the desktop app — so
> it has no way to reach the bridge, and the board tools will not appear here
> however long you wait.
>
> Switch to **Codex**. In the desktop app that is the selector in the same
> interface; in a terminal it is the Codex CLI. A Codex session runs on your
> machine, so it can reach the bridge. Install the plugin there, run
> `mockflow-bridge`, and pair it with your board once.

Lead with the selector: for someone already in the desktop app it is the
smallest possible move, same app, same account, one switch. The Codex CLI is
the alternative for people who already work in a terminal. Someone in the web
app needs both steps: the desktop app, then Codex selected inside it.

Be precise that the desktop app alone is not the answer. ChatGPT and Codex live
in the same app now, and the app with ChatGPT selected still cannot draw. Say
"select Codex" every time, not "use the desktop app".

Do not offer the npm command, do not offer to install anything, and do not fall
back to a mermaid block or a text sketch as though the request had been met. If
they want something on a board right now without leaving the browser, Ask Mida on
app.mockflow.com is the thing to point at.

## 1. Is the helper installed?

```bash
command -v mockflow-bridge
```

Nothing returned means it is not installed. Offer to install it and say what it
is: a small local program, about 2MB, no MockFlow account required.

```bash
npm i -g @mockflow/mockflow-bridge
```

If Node.js itself is missing, that comes first, from nodejs.org, version 18 or
newer.

## 2. Is a daemon running?

```bash
mockflow-bridge status
```

This reports whether the daemon is up and which boards are connected. If it is
not running, start it. Nothing can be drawn without it, and the MockFlow tools in
this session will be unavailable until it is up and the session has reloaded.

## 3. Is a board paired?

The daemon shows a **pairing code**. The user opens their board at
app.mockflow.com, clicks **Connect Local Agent** at the top of Ask Mida, and
enters that code. The button turns green.

Pairing is per computer and survives restarts, so this is a one time step. But
**codes change every time the daemon restarts**, so an old code will be rejected.
If pairing fails, get the current code rather than reusing one from earlier in
the conversation.

## Which board am I drawing on?

`list_boards` shows what is connected. `select_board` pins the target explicitly.
Without an explicit selection, draws go to the tab the user is focused on, else
the only connected tab.

## Nothing appeared on the board

In likelihood order:

1. The board tab was closed or reloaded, so the pairing is gone. Re-pair.
2. The daemon stopped. Check step 2.
3. Draws went to a different connected board. Check with `list_boards`.

## Reading files

File access is off by default. The daemon has to have been started with
`--workspace <path>` for the agent it spawns to read a folder. This does not
affect Claude Code reading files itself, only the Ask Mida side.
