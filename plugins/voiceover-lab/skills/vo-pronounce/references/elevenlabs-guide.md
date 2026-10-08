# Producing with ElevenLabs

Use this map when the user is producing with ElevenLabs. Feature names and controls change over time, so describe the job and point to the feature; tell the user to confirm current details in the ElevenLabs docs. Never invent prices or limits.

| Job | ElevenLabs feature | Notes |
|---|---|---|
| Render a single-voice script | Text to Speech | Pick the model class first (see `vo-model-pick`). |
| Performed, emotional reads with inline tags | Text to Speech, expressive model | Bracketed audio tags such as `[whispers]` or `[laughs]` work on the expressive model; older models may read them aloud. |
| Long-form narration and audiobooks | Studio (long-form projects) | Chapter-based editing and re-rendering of single paragraphs. |
| Multi-speaker scenes and podcasts | Text to Speech dialogue support, or Studio with per-speaker voices | Assign one voice per speaker label. |
| Find a voice | Voice Library | Audition against the real script, not a sample line. |
| Invent a voice | Voice Design | Write the description with `vo-voice-design`. |
| Clone a real voice | Instant or Professional Voice Cloning | Consent first (`vo-consent`), then record with `vo-clone-prep`. |
| Other languages | Dubbing, or multilingual TTS | Plan expansion with `vo-localize`. |
| Change a performance's voice | Voice Changer (speech to speech) | Useful when timing and emotion must match a human guide take. |
| Sound effects and ambience | Sound Effects | Prompts from `vo-sfx`. |
| Music beds | Music | Briefs from `vo-music`. |
| Voice agents and IVR | Agents | Persona and prompts from `vo-agent-persona` and `vo-ivr`. |
| Transcribe a recording | Speech to Text | Clean up with `vo-transcript`. |
| Fix mispronunciations | Pronunciation dictionaries, phoneme or alias rules (model-dependent) | Build the lexicon with `vo-pronounce`. |

## Settings vocabulary

ElevenLabs voice settings typically include stability, similarity, style exaggeration, and speaker boost. Lower stability is more expressive and follows tags; higher stability is more consistent and ignores direction. Start mid, change one setting at a time.
