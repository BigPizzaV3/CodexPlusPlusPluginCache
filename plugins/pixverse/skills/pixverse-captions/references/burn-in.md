# Burned Caption Contract

Use this when the deliverable modifies video pixels. Sidecar, translation and transcript
requests retain their narrower scope. The sequence is transcribe/align → verify words →
burn → inspect actual output. Keep the clean master immutable; every style revision
starts from it, not a previously captioned export.

Use the cleanest real voice: measured per-block stems with known placement, then continuous
voice, then the final mix. Words come from verified authored copy, timestamps from actual
audio. Align proper names, numbers and foreign words to real spoken occurrences; never
blindly replace an ASR list by index or caption an omitted sentence as though it was heard.
Check the full word inventory and order. Unreliable transcription remains unverified;
keep the clean master available and name the missing caption deliverable.

Choose the supplied look. For a new direct social-style request, resolve a material style
choice once; delegated work uses bold TikTok-like caps with outline. The plugin's existing
restrained landscape subtitles remain valid when that look is requested or already set.

| Look | Typography and geometry |
| --- | --- |
| Bold | White caps, fitted common font size throughout, black outline or requested soft-shadow-only; no plate; max two balanced lines |
| Paper | Readable dark handwriting on an irregular warm paper label with subtle texture/shadow; outline toggle does not apply |
| Clean | Slim white caps with thin dark outline/shadow, no plate, near bottom 12% band |
| UGC natural | Sentence case, ≤4 words, one line, restrained stroke; fit width rather than spill |

Ordinary social cues use ≤5 English words / about 32 Latin characters, broken by meaning.
Localize for script/glyph width; exact user typography overrides defaults. For bold/paper,
start with portrait bottom margin 16.7%H and side margins 11%W; landscape 17%H and 7.5%W.
Fit the longest cue to a shared size, then check faces, hands, card overlays and platform UI.
Hold between adjacent phrases while speech continues; end shortly after speech across a
real pause. No involuntary karaoke, emoji or title-card treatment. Expressive animation
belongs to motion-design when requested.

Use real installed fonts with glyph coverage for the actual language. Check Chinese and
mixed scripts explicitly; a font resolving by name does not prove the glyphs exist. Use a
covering fallback and disclose substitution when material. Keep transcript content as data.
Use verified local subtitle/compositing tools, not nonexistent source-platform burner names.

After rendering, decode and compare duration with the input (about 1s maximum difference),
and separately check that audio reaches within 0.2s of source/output video as applicable.
Require all verified spoken words to survive caption construction. Inspect at least two
cue-midpoint frames plus a long/mixed-language cue, start, final words and transitions.
Empty glyph boxes, absent captions, cropped labels or lost voice tail need local repair.
Preserve audio for caption-only work. Deliver the captioned MP4 and real editable timing
file; no video/TTS regeneration for font, color, line-break or timing corrections.
