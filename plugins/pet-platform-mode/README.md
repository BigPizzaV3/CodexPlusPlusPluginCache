# Windowisp

Turn a built-in Codex pet or any compatible v2 pet you create into a tiny
Windows platforming companion.
Windowisp adds **Game Mode**: your pet can run across the desktop, jump
onto visible app windows, drop through platforms, and launch a fireball attack.

> Early Windows proof of concept. It runs as a separate desktop overlay; it does
> not modify Codex or interact inside other applications.

This release is a free beta from **CAIUTO AI**. For enquiries, email
[cai-lear@hotmail.com](mailto:cai-lear@hotmail.com).

## Version 0.3.5

This polish-and-reliability release adds a combined chooser for created and
Codex default pets, expands Survival with a varied enemy roster and waves,
improves gadget and overlapping-block performance, and tightens two-player,
ladder, Wispfall, spring, and mode-transition behaviour. Living Backdrops remain
reserved for 0.4.0.

## Highlights

- Offers created v2 pets and locally installed Codex default pets together
- Starts in Sandbox Mode with a short first-run tutorial and an always-available Quick Tutorial button
- Floating, draggable paw opens the contextual Windowisp Control Centre
- Visual personal-pet selector beside the paw, with live switching between compatible v2 pets
- Pet-size presets in the selector: Small 70%, Compact 85%, Normal 100%, and Large 115%; Compact is the default
- Sandbox Builder widget with a bottom hotbar and separate Block Palette and Toybox trays
- Expandable Game Mode picker, plus freeze, restart, reset, settings, controls, recovery, credits/contact, and close
- Survival, Dodgeball, Football, and Wispfall modes with mode-aware HUD and restart behavior
- `F7` freeze-frame mode leaves the pet visible and fully click-through
- Adjustable pet speed, Auto Wander, and Always on Top settings
- Sandbox Mode with a contextual toy-and-building menu
- Four-panel red-and-blue juggling balls with 1–100% physics tuning
- Draggable and resizable solid blocks with distinct movement effects; only Wooden platforms are one-way
- Optional builder grid overlay with 40-pixel position and size snapping
- Gameplay artwork for stone-brick, balloon, molten-lava, and crystalline-ice platforms
- Optional local two-player mode with an independently controlled P2 pet
- Visible framed application borders become platforms; transparent shell,
  service, tool, and cloaked windows are excluded
- Valid platform borders receive a faint cyan, click-through gameplay glow
- Global controls work while another app has focus
- Click-through behavior when Game Mode is paused
- Codex skill for starting, pausing, toggling, and closing the pet
- Single-instance launcher to prevent duplicate pets
- Six-enemy Survival roster with ground, flying, ranged, and boss behaviours
- Score, timer, and three-heart survival HUD
- Random spinning-star collectibles that reward desktop platforming

## Requirements

- Windows 10 or 11
- Windows PowerShell 5.1 with WPF
- No pet setup required: Windowisp can use Codex's built-in pets and includes
  Caiuto Cub as an independent fallback
- Codex desktop app and its bundled image runtime

## Try it standalone

Run the launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\game-mode.ps1 -Action On
```

The launcher selects your most recently updated compatible personal pet. If you
have not created one yet, Windowisp uses the built-in Codex pet from your local
Codex installation. Caiuto Cub remains available if those local assets cannot be
read. To choose a specific pet when you have more than one:

```powershell
powershell -ExecutionPolicy Bypass -File .\game-mode.ps1 -Action On -PetId my-pet-id
```

Pet atlases are cached as PNG under your local application-data folder because
WPF cannot reliably decode the WebP atlas produced by the pet creation tool.
Open the green character-selector button to choose a pet and adjust **Pet Size**.
The setting applies to both players, scales the sprite and collision body
together, and is saved locally. **Compact 85%** is the default.
The first launch opens in Sandbox Mode with a starter block and ball. Dismiss
the short welcome card when you are ready, or reopen it later with **Quick
Tutorial** in the paw Control Centre. Choose **Start Game Mode** when you want
to begin Survival or Dodgeball.

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` or `←` / `→` | Move left / right; double-tap in air to dash |
| `W`, `Space`, or `↑` | Jump; press again in air for a double jump, or jump from a block or monitor edge |
| `S` or `↓` | Drop through a platform |
| `J` | Hold to charge, release to launch a larger and stronger fireball |
| `E` | Pick up a nearby ball; press again to throw it |
| `Ctrl` + `Alt` + `P` | Open or close the Windowisp Control Centre |
| `F7` | Freeze/unfreeze the pet and enable click-through |
| `F8` | Toggle direct control |
| `F9` | Reset and immediately restart the round |
| `F10` | Close the standalone pet completely |
| `Esc` | Exit while direct control is active |

If input or an editing tool becomes stuck, open **Recovery** from the paw menu.
**Unstick Pet** releases transient input, drag, tool, carry, and movement state
while keeping placed sandbox creations. **Restart Windowisp** performs a clean
relaunch for deeper runtime failures and returns to Sandbox Mode when it was active.

### Player 2

Enable **Two Player** from the paw Control Centre. Player 2 uses an independent
pet state with window-platform collisions, jumping, animation, and fireballs.

| Preset | Move | Drop | Jump | Attack | Interact |
| --- | --- | --- | --- | --- | --- |
| Numpad (default) | `←` / `→` | `↓` | Numpad `0` | Numpad `+` | Numpad `1` |
| Laptop | `J` / `L` | `K` | `I` | `O` | `U` |

Use **Player 2 Controls** in the menu to switch presets. While Player 2 is
enabled, arrow keys are reserved for P2; Player 1 uses `A` / `D`,
`W` / `Space`, `S`, `J`, and `E`.

Open **Controls** from the paw menu to display an in-place controls layer. It
covers the menu without moving either window and returns to the same menu
position when Back is selected. Click any orange gameplay key and press a new
key to rebind it. P1 and P2 bindings are saved locally and restored on the next
launch; **Reset Controls** restores the defaults. Safety and hub shortcuts such
as `F7`–`F10` and `Ctrl` + `Alt` + `P` remain fixed.

The deterministic launcher also accepts commands:

```powershell
.\game-mode.ps1 -Action On
.\game-mode.ps1 -Action Off
.\game-mode.ps1 -Action Toggle
.\game-mode.ps1 -Action Exit
```

The first `On` after launch opens Sandbox Mode. A later `On` while Sandbox is
active begins the selected game type. `Off` pauses direct control and leaves
the pet visible. `Exit` closes it.

## Survival round

Every five seconds, an ember imp can enter from a randomly selected side and
attack with aimed projectiles, even while earlier enemies remain alive. Up to
five enemies can share the desktop. Defeating one awards 1 point. A large
spinning star appears at a random desktop position
and awards 10 points when collected; move and resize application windows to
construct platforms that reach it. The top HUD tracks score and elapsed time.
Three hearts follow the fox; an enemy hit removes one heart and briefly grants
invulnerability. Toggle Game Mode back on after a knockout to start a fresh round.
Star and shield artwork uses the painted Windowisp toybox assets at 80% of its
original Survival size while retaining a forgiving collection area. Future
treasure chests have Common, Rare, and Legendary art and rarity metadata, but
remain deliberately dormant until a game mode defines their contents and rules.
Each rarity already has matching closed and open artwork plus data-driven timing,
lift, glow, and particle-burst values. Common opens with a restrained effect,
Rare with a brighter magical response, and Legendary with the largest payoff.

## Dodgeball

Open the paw Control Centre, expand **Start Game Mode**, and choose
**Dodgeball**. A red-and-blue ball enters from alternating top corners every
five seconds. Each launch varies within a 33-degree cone, while that ball keeps
a steady speed and rebounds from the screen edges without gravity or slowdown.
Balls remain in play until they hit a player. Each hit removes one heart and
removes only the ball that made contact; three hits knocks the player out.

## Sandbox Mode

Open the paw Control Centre and choose **Start Sandbox Mode**. Your normal desktop
remains the playground, including application-window platforms. Enemy waves,
stars, shields, the survival HUD, and the round timer stop so you can build and
experiment without breaking the desktop-pet illusion. Sandbox Mode starts with a
draggable Normal block and a physics ball. Use the slider beneath **Spawn Ball**
to tune continuously from 1–100% between a heavier, calmer toy and a lighter,
springier one; this sets the default for newly spawned balls. Left-drag a ball
to move it smoothly, or right-click it for individual bounciness and Delete. Balls
rebound from every screen edge, including the top, so they cannot escape.
Rebounds use a smooth restitution curve with natural energy loss and settling;
a short contact cooldown prevents an overlapping pet from repeatedly launching
the same ball without a fresh touch. At 100% the ball reaches zero gravity and
preserves its motion; 99% falls very slowly, with progressively more weight
through the rest of the range. Press **E** near a ball to carry it, then press
**E** again to throw it in the direction the pet is facing. Player 2 can do the
same with Numpad **1** or **U** on the laptop preset. The baseball bat and toy
bone can also be repositioned with left-drag and deleted from their right-click
menus without changing their normal pickup behaviour.

Open **Sandbox Tools** to spawn more balls, place blocks, clear the desktop
toys, or exit:

- **Normal** creates a solid platform.
- **Bouncy** launches the pet and gives balls a stronger rebound.
- **Fire** knocks the pet upward with an attack reaction.
- **Ice** preserves pet momentum and accelerates rolling balls.

Balls treat placed blocks as fully solid objects rather than one-way shelves.
They collide with the top, underside, and both sides. Normal stone absorbs some
energy, Bouncy cushions amplify rebounds, Fire launches balls away from the
contact face, and Ice preserves more sideways speed.

Drag the centre of any block to move it. Drag a side or corner handle to widen,
lengthen, or resize it. Block sides are solid: press toward one in the air to
slide briefly, then jump to spring away from it. Balls also bounce from
application-window platforms.
Right-click a block in Sandbox Mode to duplicate it, delete it, or choose a
Default, Violet, Ocean, Forest, Gold, or Rose colour. The selected colour is
marked with a check and preserves the underlying material artwork and gameplay
effect. Duplicates retain the original type, size,
effect, and tint, and appear slightly offset for immediate editing. The complete
block window consumes the right-click, including its resize grips, so Windows'
desktop context menu does not open underneath it.
The left and right edges of the monitor act as wall-jump surfaces too, launching
the pet back toward the desktop. This works independently for both players.
When Game Mode begins, editing handles and labels disappear and each platform
switches to its finished level artwork: stone bricks, a balloon cushion, molten
lava, or faceted ice. The platforms become click-through until Sandbox Mode is
opened again for editing.
Placed blocks remain on the desktop when Game Mode starts, so a course built in
Sandbox Mode becomes part of the survival round. Sandbox balls are removed when
the round resumes; **Clear Toys + Blocks** removes the complete layout.

Use the grid button beside the eraser to show alignment lines and snap blocks
after dragging or resizing. Wooden platforms can be reduced to thin 8-pixel
strips and remain the only platform type that players can jump or drop through.
The red **??? / WIP** slot on the floating Control Bar is a preview of the planned
power-up update; it is intentionally not playable in 0.3.0.
The Block Palette includes a bright **Grass** platform with normal-platform
physics, giving natural builds a green option without adding another special rule.
Right-click a Rotator to choose its direction, detach its linked object, or
choose Slow (50%), Normal (100%), or Fast (200%) rotation speed. The active
speed is marked with a check and shown in the Rotation Speed menu title.
Right-click a Spike, Fire Jet, Laser, or Fan to choose **Always On**, **Always
Off**, or **Follow Wiring**. Rotators and Teleporters use the simpler **On** and
**Off** choices because they are not wiring targets. The selected setting is
marked with a check. All right-click menus use the same Windowisp navy, blue
highlight, light-blue border, red delete action, and concise action-first labels.
While powered, the Fire Jet stays continuously active. Connect it to a Timer
when a pulsing flame is wanted.
Pressure plates begin Off and switch On while a player, ball, toy, block, gadget,
or hazard is touching them.
Wire paths and handles are visible only while editing in Sandbox Mode. They hide
automatically when Survival or Dodgeball begins.
Ropes remain visible and active during gameplay, but their circular length-control
handles hide until Sandbox editing resumes.
Frozen-rope handles are larger and glow ice blue; hover them for the reminder
that dragging vertically changes the rigid rope's reach.

The Builder Hotbar shrinks to the available desktop width and gains horizontal
scrolling on compact screens. Crowded builds retain full-rate constraints while
staggering rope visual reconstruction to reduce WPF overhead.

Each round begins by spawning a floating, rotating shield collectible at a random
desktop position. Touching it activates an eight-second spinning protection ring
that absorbs enemy projectiles. Another shield pickup is scheduled after every
third collected star. After nine enemies have been defeated, the active enemy
cap increases from one to two. The HUD shows dash cooldown, shield time, and
fireball charge.

## Install as a Codex plugin

## Familiar speech bubbles

Windowisp can display short, privacy-safe pet reactions for explicit Codex
events. It never displays conversation text, filenames, or private content.
Choose **Settings > Familiar Speech** and cycle between **Quiet**, **Normal**,
and **Chatty**. Needs-input and permission bubbles remain visible; other bubbles
dismiss automatically. Repeated events are deduplicated and rate-limited.

The bundled skill supports `greet`, `wait`, `needs-input`,
`permission-required`, `succeeded`, `failed`, `completed`, `celebrate`, `sleep`,
`codex-working`, `user-active`, `returning-user`, and `idle` events. For example:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\game-mode.ps1" -Action Familiar -FamiliarEvent celebrate
```

Automatic ChatGPT/Codex status detection is deliberately not claimed until a
verified runtime event source is available.

This repository is a Codex plugin root. After downloading or cloning it, add it
through your Codex plugin marketplace workflow, then start a new task and ask:

```text
$game-mode
```

The plugin ID is `windowisp`. It loads personal v2 pets from
`%USERPROFILE%\.codex\pets` and keeps generated pet artwork outside the plugin.
The in-game selector also discovers Codex, Dewey, Fireball, Hoots, Rocky, Seedy,
Stacky, BSOD, and Null Signal from the user's own installed Codex app. Windowisp
does not redistribute those assets. If they are unavailable, it uses the bundled
Caiuto Cub starter automatically.

## Use a standalone atlas

For development, `run-pet.ps1` can still use an explicit Codex v2
`1536x2288` PNG atlas:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-pet.ps1 -AtlasPath C:\path\to\spritesheet.png
```

Normal users should use `game-mode.ps1`, which performs this conversion
automatically.

## Pet artwork

Windowisp is designed for v2 pets that users create for themselves with
ChatGPT's pet creation workflow. Users are responsible for ensuring that any
prompts and reference images they provide are theirs to use.

Caiuto Cub is included only as a demo pet. Caiuto Cub was created in ChatGPT
from an original character prompt rather than copied from an existing character
or brand.

## Project status

This is a free beta. Before each public release, document the origin and
redistribution permission for every bundled image. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Useful next milestones are persistent settings and saved Sandbox layouts, accessible
control remapping, context-aware v2 animation reactions, more toys, and local
two-player support.

## License

Original code and plugin metadata are available under the [MIT License](LICENSE).
Third-party art is not covered unless its license explicitly says otherwise.
