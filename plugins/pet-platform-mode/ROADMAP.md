# Windowisp Roadmap

## 0.3.5 — Polish and reliability

Keep this release focused. Prioritise bugs found during real playtesting with
Morgana, control consistency, clean mode transitions, performance, and release
verification. Do not add Living Backdrops to this release.

## 0.4.0 — Living Backdrops

Add an optional visual background layer that fits the user's active screen and
places a themed environment over their ordinary windows during selected game
modes and events. The layer should feel like part of the game while remaining
click-through and reversible.

Initial concept:

- Begin with three scenes: Football stadium, Wispfall night, and the existing
  pastoral Sandbox field.
- Fit or crop cleanly across common widescreen resolutions and DPI settings.
- Fade between scenes and support lightweight event effects without taking
  keyboard or mouse focus.
- Provide an obvious setting to disable Living Backdrops and respect reduced
  motion.
- Restore the normal desktop view on mode exit, plugin shutdown, and recovery
  after an interrupted previous run.
- Test one monitor and multiple monitors, window stacking, click-through input,
  memory use, startup time, and crowded gameplay performance.
- Use compressed WebP assets and set an explicit artwork budget before growing
  from three backgrounds toward a possible ten-scene pack.

Release gate: the backdrop must never leave the user's desktop altered, obscure
controls unexpectedly, or introduce immediate gameplay slowdown.
