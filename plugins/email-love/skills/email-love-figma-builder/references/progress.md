## How long a build takes, and telling the user first

## Contents

- Set an estimate before the first write
- Report progress at section boundaries
- Report converter waits and retries
- Revise estimates when pace changes
- Never stop silently
- Preserve resumable state when a build pauses

Building an email in Figma is **minutes, not seconds**, and a user expecting an instant result
reads a normal build as a hang. **Before the first write to the canvas, say in one line what
you are building and roughly how long to expect.** A short line at each section boundary after
that is the right rhythm: not silence, not a running commentary.

Almost all of that time is round trips to Figma, not model thinking. Every node you create or
read back is a tool call, so **the node count predicts the time far better than how
complicated the design looks**. A one-section reminder is quick; a multi-section email with a
hero, several content blocks, and a footer is meaningfully longer; a sequence multiplies by the
number of emails. Path A is the faster path, because instancing a finished component is a
handful of calls where transcribing the same block node by node is dozens.

The design-converter worker on Path B is not the slow part: it returns MJML JSON in a few
seconds to about half a minute per design. If the user comes away thinking the AI is what is
slow, they have the wrong picture. The AI is waiting on the canvas.

Give ranges, never promises, and keep the scale straight. One email is minutes. Converting a
whole design system is a different job: a batch of five design-system modules has been measured
at tens of minutes per pass, which is why library migration is a separate batched process with
design review between batches, covered by `$email-love-design-system-migration`.

### Report progress while it runs

Codex shows the user every tool call it makes, so they can already see WHAT is happening: the
`use_figma` writes, the curl to the design converter, the screenshot reads. That makes one part of
this contract lighter and the rest of it heavier. The visible calls never say **how far through**
the build is or **how much longer** it has to go, and a wall of node writes reads as motion without
progress. So the count, the percentage, and the section name carry the load. Telling the user you
are calling Figma does not: they watched you call it, in more detail than you would have given.

A build is minutes rather than tens of minutes, so the granularity is the **section**, not the
whole email and not the node. Post one line at each of these points and nowhere else:

1. **Before the first write to the canvas:** the path and why (you owe that line anyway), the
   section plan by name, and the estimate. **The section count you give here is the denominator for
   every line after it**, so name them: "Path A, 9 sections: preheader, logo header, hero, three
   product cards, testimonial, CTA, footer. Roughly 8 minutes."
2. **After each section lands:** count, percentage, section name.
3. **On Path B, when the design-converter call goes out** (B3): one line before it. Codex shows the
   curl leaving, but a 20 to 40 second wait with nothing appearing on the canvas is the one point in
   a build where a user reasonably concludes the run has hung, and the visible call says nothing
   about how long it should take. Say the same thing the moment you re-run with `recache=1` or retry
   an `X-Trivial-Response`, rather than mentioning it at hand-off: a failed call the user just
   watched does not tell them whether you are recovering or stuck.
4. **At the end:** what was built, what you assumed or had to ask about, and anything skipped.

How each line is written:

- **A count and a percentage, never prose.** "Section 4 of 9 done, 44 percent" is the format.
  "Almost there" is not a checkpoint.
- **Name the section.** "Section 4 of 9: testimonial" lets the user find it in Figma. "Section 4 of
  9" does not, and a layer name scrolling past inside a tool call is not something a user can
  follow.
- **Two counters for a sequence, not one.** "Email 2 of 4, section 3 of 7: hero" locates someone in
  a campaign. A single percentage of the whole sequence does not.
- **Revise the estimate when the pace disagrees with it.** Most builds are short enough that the
  opening number holds. But if sections are landing at double what you opened with, say so at the
  next section boundary with the new number instead of at the end, and revise upward without
  apology: Path B transcription in particular runs slower than it looks. This is the one thing the
  visible tool calls can never supply, so it is the part to get right.
- **Do not narrate the operation the user is already watching.** Spend the line on the arithmetic
  instead. The exception is when the visible calls mislead rather than inform: a silent wait, or a
  burst of calls that looks like thrash and is really one repair, earns one plain-language clause.
  "Transcribing the footer, 43 nodes" is worth reading; "running use_figma" is not.
- **Section boundaries only.** Never per node, per instance, per property, or per screenshot. A hero
  with thirty nodes gets one line when it is finished, not thirty. The transcript is already dense
  with calls, so prose in between costs more here than it would on a quieter surface.

Two lines, the format to copy. Path A, after a section:

> Section 4 of 9 done, 44 percent: testimonial, instanced and filled. Sections are averaging about
> 50 seconds, so the remaining 5 are roughly 4 minutes. Next: section 5 of 9, CTA.

Path B, before the worker:

> Sending the hero comp to the design converter now. It takes a few seconds to about half a minute,
> then transcribing what comes back is the longer part.

### Say when you STOP, too

Those four points cover a build that is still building. Nothing in them covers a build that has
stopped, and that asymmetry is worse than having neither half: **an agent that reports progress but
not its own stop is worse than one that does neither, because the user infers continuation from the
last progress line.** The visible tool calls make this worse rather than better. When you stop, the
calls stop too, and a user who has been watching a wall of `use_figma` writes scroll past reads the
quiet exactly the way he reads a long transcription: as work in progress. Silence is indistinguishable
from still working.

**Never stop silently.** If you stop, for any reason, say so in the SAME message as the last of the
work, not in a later reply and not only once the user asks. Four things, every time: what you
completed in the format of point 2 above so it reconciles with the lines before it, what remains by
section name, why you stopped, and the exact thing needed to resume, phrased so the user can send it
straight back. The reasons that qualify are a blocker, a decision only the user can make, a limit you
have hit, or reaching the end of a unit of work. Finishing the email is that last one, and point 4 is
how it gets announced.

**Do not stop between the sections of one email.** The email is the unit of work, so the section plan
you gave at point 1 is a plan to finish, not a menu to stop partway down. In a sequence the unit is
still the email: between emails is a defined boundary, mid-email is not, so finish the one you are in
before you stop, and report it with both counters. The exceptions are the two this workflow already
names, and both are a question put to the user at the section it belongs to rather than a build
abandoned quietly: A5, where no component fits and they are the one who knows, and the non-negotiable
rule in `SKILL.md`, where neither path can produce the section at all. Announce either in the shape
below rather than trailing
off. Library migration is the other shape of this, and it is not yours to improvise: batches and the
review between them live in `$email-love-design-system-migration`; hand the request to that skill.

**If you wrote resumable state, name its path in that message.** Write one whenever the build is a
sequence or you expect it to cross a session boundary, beside the `/tmp/mjml.json` payload Path B
already has you save, and treat it as expected behaviour rather than extra credit. On a one-off email
the sections already on the canvas are most of the state, so name the frame instead. Either way the
user has to be told where it is. He watched the file get written scroll past inside a shell call,
which is not the same as knowing it exists or what it is for: state the user cannot see does not make
the build resumable, it only makes you feel that it is.

One worked example, the format to copy. It is one message, sent unprompted, not an answer to "are you
still working on it":

> Stopped, not still building. Email 2 of 4, 5 of 7 sections done, 71 percent: preheader, logo header,
> hero, two product cards, all in the `Email 2 - Winback` frame. Remaining in this email: countdown
> banner and footer. Why I stopped: no component in the design system covers a countdown banner and
> the converter flattens it to a single image, so neither path can produce it and I am not
> hand-building the structure. To resume, point me at a component to use, or say "place it as a static
> image with a fallback line", and I will finish from the saved state at `/tmp/build-state.json`.

---
