---
name: game-mode
description: Control the Windowisp Windows desktop pet, Sandbox Mode, and privacy-safe Familiar reactions. Use when the user invokes $game-mode; asks to start, pause, close, toggle, or control the desktop pet; starts Sandbox Mode; or asks the pet to greet, wait, celebrate, sleep, report success or failure, or show that Codex needs input or permission.
---

# Game Mode

Run the portable launcher bundled with this skill. Resolve `scripts/game-mode.ps1`
relative to this `SKILL.md`, then execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<skill-directory>\scripts\game-mode.ps1" -Action On
```

Choose exactly one action from the user's request:

- `On`: Start the pet if necessary in Sandbox Mode and enable movement controls. A later `On` while Sandbox is active begins the selected game type.
- `Off`: Disable movement controls without launching a stopped pet.
- `Toggle`: Use only when the user explicitly asks to toggle or switch modes.
- `Playroom`: Start the pet if necessary and toggle buildable Sandbox Mode on the real desktop.
- `Familiar`: Send one approved status reaction with `-FamiliarEvent`.
- `Exit`: Close the standalone pet completely.

For a Familiar reaction, use one explicit event. Never put conversation content,
user data, filenames, or arbitrary text in a bubble.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<skill-directory>\scripts\game-mode.ps1" -Action Familiar -FamiliarEvent celebrate
```

Supported events: `greet`, `wait`, `needs-input`, `permission-required`,
`succeeded`, `failed`, `completed`, `celebrate`, `sleep`, `codex-working`,
`user-active`, `returning-user`, and `idle`. Prefer `needs-input` when work cannot
continue without the user and `permission-required` only for a real approval.

Run the command rather than merely describing it. Treat an unqualified `$game-mode`
invocation as `On`. After success, report the resulting mode. Mention the controls
only when useful: `A`/`D` or arrow keys move, `W`, `Space`, or Up jumps, `S` or Down
drops, and `J` attacks. `Ctrl`+`Alt`+`P` opens the Control Centre, `F7` freezes the pet with
click-through, `F8` toggles direct control, `F9` resets, and `F10` closes the pet.

Do not launch the plugin-root `run-pet.ps1` directly. The bundled launcher prevents
duplicate processes and sends commands to an existing instance.
