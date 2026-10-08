# Behavioral Regression Cases

Use these when evaluating a change to this workflow, not as extra intake questions.
Run from the public SKILL.md with the original natural-language brief; do not inject the
expected prompt into the agent. Save resolved route, manifest, actual submitted prompts,
reference bindings, rendered media and frame/timing evidence. Planning-only execution
tests route/constraints, not output quality. A pass needs actual rendered evidence for
visual/motion/audio assertions. Never grade only keyword presence or decoder success.

| Brief | Required behavior | Hard failure |
| --- | --- | --- |
| Make a 30s editorial motion graphics video explaining how the Mona Lisa became famous, English subtitles | Story narration with named concretes (commission, theft, return); paper-cutout actors performing each phrase on a cream collage stage with one accent; faithful portrait prop; a visible change about every second; narration fills each block; captions timed from audio | Essay narration about abstractions; photoreal room or live-action visitor; props sitting still for a second or more; small elements lost in empty paper; slowed voice |
| Explain why a hot-air balloon rises in Colorful 3D for general viewers | Saturated dimensional world; show heating, lower density and lift; audience remains general | Automatically turns into Kids; Studio-white scene despite colorful donor; rocket exhaust lifts basket |
| Watercolor chronicle about Apollo 11 | Visible paper/ink/wash; correct vehicle and two surface astronauts versus one in orbit | Blank intro is sole style test; Shuttle represents Apollo; all three walk on Moon |
| Show how a printing press makes repeated pages in hand-drawn ink | Inked raised surface contacts paper and repeated impressions result | Buyer/observer scene replaces mechanism; incoherent contact; arbitrary text appears |
| Paper-diorama history of Magellan's expedition | Tactile relief depth, silhouette cast, route states and sourced distinction between Magellan and the completing expedition | Flat-collage override destroys depth; claims Magellan personally finished circumnavigation |
| Pastel Flat 2D lighthouse with supplied night reference | Preserve night palette and beam mechanism; no invented Kids mode | Defaults make it daytime; no beam/ship relationship; unrelated smiling host |
| Mannequin film about early motion pictures | Featureless stable role-color bodies; actual frame/transport mechanism and qualified historical claims | Faces appear; generic movie-theater visit; unsupported absolute first-ever claim |
| Poster Vector myth of Zeus, Poseidon and Hades | Flat silhouettes, role assignments, clear myth framing | Pastel outlines/3D material; realm symbols swap roles; mythology presented as history |
| Whiteboard explanation of yawning | Sequential meaningful diagram and sourced uncertainty | Presents one hypothesis as settled fact; random scribble has no causal meaning |
| Pixel-art explanation of white blood cells | Stable declared grid and researched cell-specific action | Generic game battle/landscape; smooth mixed-density sprites; biologically false mechanism |
| Claymotion story of the dinosaur extinction | Clay contact/material/pose increments and sourced event sequence | Glossy plastic; all dinosaurs including birds vanish; material morph replaces event |
| Stickman Odysseus with a detailed colored reference | Keep simple body language plus observed designed head/costume/environment; myth chronology | White blank stage imposed by label; new character design every cut |
| Two-minute picture story with no video generation | One continuous voice, measured dense frames, previous-frame-only micro-edits | Per-caption TTS; sparse zoom slideshow; video queue despite explicit stills |
| Kids talking-character episode | Four shots/10s; explicit alternation and native lip timing on dialogue blocks | External TTS replaces moving-lip audio; look alone activates dialogue |
| Kids educational song | Real sung audio first, measured musical sections and visual lyric choreography | Spoken TTS or instrumental accepted as a sung song |
| Twelve-minute history episode | Research, chapters, era identities, maps/quantities and bounded production batches | One huge unsupported prompt; false claim of full-film completion from one sample |

Record each case as `not_run`, `plan_checked`, `render_checked_pass`, or
`render_checked_fail`, plus evidence and limitations. Cases using unavailable backend
capability remain blocked for that mode; do not silently substitute another deliverable.
