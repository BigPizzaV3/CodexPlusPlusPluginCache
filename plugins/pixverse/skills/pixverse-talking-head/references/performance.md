# Performance Direction

## Delivery

Choose the attitude before the words: friendly explainer, dry confidence, warm intimacy,
hype, calm. Write it as behaviour the camera can see: eye contact, small head movement on
emphasis, one gesture per beat, a decisive landing on the last phrase. Falling intonation
closes a joke; rising intonation invites the next line. Do not stack adjectives; one clear
instruction per beat.

## Beats and time

Give contiguous time ranges that cover the request duration: "0–3 s: says ... with a
dismissive wave; 3–6 s: says ... lifting the cup; 6–8 s: says ... nod, holds eye contact".
Leave the last half second for a natural landing so the cut point is clean. If the measure
estimate and the model's duration steps disagree, round up and let the landing absorb it.

## Continuity across takes

- Same image, same voice reference, same wardrobe words in every prompt.
- Same composition-stability axis; `strict-locked` when takes cut back to back.
- Same light description; mention the time of day once.
- Props that appear in one take appear (or are explicitly absent) in the next.
- Name the take's opening state when it follows another take ("already holding the cup").

## Retakes

Retake only the failed segment. Compare alignment: a missing or extra word, a mispronounced
name, a gesture that hides the face or the product. Keep accepted takes selected in the
timeline; the composition re-flows.

## Speech-free variants

For a silent performance with separately generated narration, generate the take with "does
not speak, listens and reacts", produce narration with `../../pixverse-voiceover/SKILL.md`,
and place it as an `audio` layer; captions then follow the narration's timing.
