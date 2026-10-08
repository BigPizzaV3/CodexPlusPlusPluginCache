Synthetic reviewer fixture; contains no real-person or customer data.
Input: synthetic_talking_head.mp4, transcript.json, segments.json, audio.wav
Expected edit: timeline.edited.md
Expected cuts: final_cuts.json
Expected rendered result: expected/preview.mp4
The edit removes pre-roll, a superseded take, an NG instruction, wrap-up,
and the first repeated '然后', while preserving the final claim and example.
