# Audio Tags Lexicon

Inline bracketed tags steer delivery on expressive TTS models (for example, ElevenLabs' expressive model). On models without tag support they may be read aloud, so confirm the model before tagging.

## Emotion and tone
`[warm]` `[excited]` `[calm]` `[serious]` `[sarcastic]` `[curious]` `[sad]` `[nervous]` `[confident]` `[playful]`

## Volume and delivery
`[whispers]` `[softly]` `[shouts]` `[emphasized]` `[deadpan]`

## Pace
`[slowly]` `[quickly]` `[pause]` `[long pause]`

## Non-verbal
`[laughs]` `[chuckles]` `[sighs]` `[exhales]` `[gasps]` `[clears throat]`

## Rules for whether a tag fires

1. The voice must be capable of it. A tag cannot push a voice outside its range.
2. Stability must be low enough. High stability ignores tags.
3. The tag goes before the text it governs.
4. Fewer is stronger: three or four per paragraph at most.
5. Punctuation (ellipses, dashes, full stops) steers delivery on every model, tagged or not.
6. Unknown or invented tags may be ignored or spoken aloud. Test new tags on one line first.
