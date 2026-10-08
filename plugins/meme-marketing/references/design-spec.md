# Design Spec

Match the visual grammar of the intended platform and community. The supplied deck often uses bold yellow reaction subtitles; an original screenshot, text-led post or a client's established graphic identity may call for a different treatment. Deliberate simplicity should still be readable and accessible.

Fill the design block in the output with real values. A designer reading your spec should not have to make a single decision you could have made for them.

---

## Typography

**Arabic text**
- Heavy display weight, the boldest cut available. Thin or elegant Arabic type reads as editorial and kills the tone.
- Fill: bright yellow, around `#FFE500`. This reflects a recurring treatment in the supplied deck; check contrast and brand context before using it.
- Outline: black stroke, thick, roughly 6 to 10% of the cap height. The stroke is what makes the text survive a busy frame.
- No drop shadow, no gradient, no bevel, no glow.

**Latin words inside an Arabic line**
Set them in a heavy serif or a different bold face from the Arabic. The visual break is useful: it makes the jargon pop and mirrors how these words feel in speech, like borrowed objects.

**Alternate palette for a second brand or a softer pillar**
Pink fill with a white outline reads as lifestyle rather than industry, and cleanly separates a second content line from the main one. Pick one palette per brand and never mix them in the same feed.

---

## Layout

- Text sits in the **bottom 15 to 20%** of the frame, centered or running full width.
- Prefer the fewest readable words the chosen visual form requires. Text-free visuals, screenshot memes and multi-panel formats have different needs.
- No background box behind the text by default; the stroke does the separating.
- Use a black bar behind the text only in stacked two-panel layouts, where it doubles as the panel divider.
- Never cover a face. The face is the payload.
- Arabic letter elongation (kashida) is used decoratively to fill a line to full width. It reads as classic meme and poster styling, so it is a feature rather than a mistake.

---

## Ratios

| Ratio | When |
|---|---|
| 1:1 | Default. Safest across feed placements. |
| 4:5 | When you want maximum vertical space in an Instagram or Facebook feed. |
| 16:9 | When the width of a cinematic frame is part of the joke, or when two people in one shot matter. |
| Stacked 2-panel | Setup and answer, or question and reply. |
| 2x2 grid | Escalation across four beats. Use sparingly. |

---

## Logo

- Small badge in a top corner, roughly **8 to 10% of the image width**.
- Same corner every time, so it becomes a recognizable mark rather than a label.
- Never over a face, and never in the bottom third where the text lives.
- Keep a light and a dark version. A yellow-on-green badge disappears on a bright yellow cartoon background, which is the single most common execution error in this format.
- The logo is the entire branding budget. No URL, no handle inside the image, no frame, no watermark pattern.

---

## Image quality

Keep deliberate source texture when permission and legibility allow. Export at platform-appropriate dimensions and avoid corrupt, unreadable or deceptively doctored screenshots. Do not make unverified claims that deliberate compression increases sharing.

Preserve meaningful image context; crop without hiding a crucial speaker or changing what real footage appears to show. Obtain permission for third-party imagery. For generated visuals, make original scenes without protected characters or the likeness of private people.

---

## Elements deliberately absent

No CTA. No link. No hashtags in the image. No price. No feature bullets. No border or frame. No gradient overlay. No icon set. No brand colour wash over the photo.

Each one of these visibly converts a meme into an ad, and an obvious ad costs the person sharing it a small amount of social credit, which is enough to stop the share.

---

## Delivery checklist

Before handing the spec over, confirm you have specified:

- [ ] Ratio
- [ ] Text content, exactly as it should be set, with the line break if there are two lines
- [ ] Text position and colour palette
- [ ] Logo corner and which version, light or dark
- [ ] The visual, described precisely enough to be found or built
- [ ] A fallback visual carrying the same emotional state


## Text-free and staged UI exceptions

An intentionally text-free meme needs no bottom caption or stroke. A screenshot meme needs accurate typography, spacing and device status conventions; stage fictional names and label it as a mock if viewers could mistake it for a real private exchange. Provide accessible alt text outside the image. Confirm the platform's safe area and check font rendering for Arabic-English mixed lines before publishing. A logo is optional when it would undermine the joke or conflict with the creator's visual identity.
