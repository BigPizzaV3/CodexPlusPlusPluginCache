# Audio Specialization

## Use when

Use for music, sound effects, mixers, spatial audio, voice, dynamic ambience,
audio settings, and pooling.

## Inspect first

- audio mixer
- audio manager or service
- spatial settings
- pooling
- voice framework
- volume persistence
- platform constraints

## Implementation rules

- Reuse mixer groups.
- Avoid one AudioSource per transient effect when pooling exists.
- Keep gameplay rules independent from playback.
- Avoid repeated clip loading.
- Handle scene transitions.
- Preserve user volume settings.
- Consider spatial blend and attenuation.
- Avoid duplicate music playback.

## Validation

- expected playback
- repeated triggering
- scene transitions
- pause and mute
- volume persistence
- spatial behavior
- missing clip handling
