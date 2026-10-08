## How long this takes, and what to tell the user first

## Contents

- Set expectations by migration phase and source shape
- Report audit progress
- Report foundations and module-batch progress
- Report converter waits and retries
- Never stop silently
- Preserve resumable state between sessions

A migration is measured in sessions, not seconds, and most of the frustration around one comes
from a user who expected a minute. **Before you start any run longer than a couple of minutes,
which means foundations, any module batch, and the audit of a large library, say in one line
what you are about to do and roughly how long it should take.** Then start. A short line at
each module boundary is the right rhythm after that: not silence for forty minutes, not a
running commentary on every node.

**Where the time actually goes.** Almost all of it is round trips to Figma, not model
thinking. Every node you create or read back is a call, so a module with forty nodes costs
many times what a module with six costs, and **the node count predicts the time far better
than how complicated the design looks**. The design-converter worker is not the slow part: it
returns MJML JSON in a few seconds to about half a minute per design. If the user comes away
thinking the AI is what is slow, they have the wrong picture. The AI is waiting on the canvas.

**What has actually been measured.** On batches of five modules, working from converted MJML:

| Pass over a batch of 5 modules | Observed |
| --- | --- |
| Rendering the batch from converted MJML | about 38 minutes |
| Restructuring the batch | about 31 minutes |
| Promoting the batch to components | about 28 minutes |
| A sizing correction pass | about 18 minutes |
| Adding component properties | about 14 minutes |

Hold two things in mind before repeating those numbers. First, they come from several agents
working in parallel **with an adversarial verification pass on every module**. A single agent
following this workflow has a different profile: less parallelism, but also fewer passes, since it
is not re-verifying someone else's work. Second, they are observations of past runs, not a
rate card. Quote them as ranges, and never as a commitment.

**Source shape moves the number more than anything else.** An email-native source (frames
already at 600 or 640, auto layout in place) converts far faster than an unstructured one
(groups, absolutely positioned layers, a scaled-up mockup), because in the unstructured case
you first have to work out where each module even begins and ends before you can build
anything. On a real unstructured file that came out at roughly **three times slower per
module**. The audit already knows which kind of file this is, so use it: if it flagged loose
groups, absolute positioning, or off-spec widths, widen the estimate before you give it.

**The ranges to give:**

- **The audit:** minutes, scaling with library size. It is read-only and creates nothing, so it
  is the quick phase.
- **Foundations:** a single pass, comparable in length to one module batch.
- **A first batch of about five modules:** expect tens of minutes, and longer than that on an
  unstructured source.
- **A full library of a hundred modules or more:** multiple sessions. That is exactly why this
  process is batched with a design review between batches rather than run as one long
  unattended pass.

### Report progress while it runs

Codex shows the user every tool call it makes, so they can already see WHAT is happening: the
`use_figma` writes, the curl to the worker, the screenshot exports. That is more raw activity than
a user of a quieter surface sees, and it makes one part of this contract lighter and the rest of it
heavier. The visible calls never say **how far through** the run is or **how much longer** it has
to go, and a scrolling wall of node writes reads as motion without progress. So the count, the
percentage, and the revised estimate carry the whole load here. Restating the operation carries
almost none: do not spend a line telling the user you are calling Figma, because they watched you
call it.

Post exactly one line at each of these points, and nowhere else.

**While the audit walks (Phase 1).** The audit creates nothing, so it earns three lines, not more:

1. **After the census** (end of Step 2): the counts you found. Pages, candidate frames, designs
   after desktop and mobile twins are merged, text and paint styles. **The design count is the
   denominator for every line after it**, so state it even when it looks obvious. Add the **source
   fidelity tier** you read off those same counts (Step 3) and one clause of why, because it decides
   whether scale detection happens at all and the user should hear that before the silence of the
   walk rather than in the report.
2. **Per design, as you walk them** (Step 5, pass 1): count, percentage, the design's name, and
   what it added to the inventory. Say a blocker at the design where you hit it rather than saving
   it for the report: a component library file you cannot see, a split you are inferring and need
   the designer to confirm, a type ramp that contradicts the width derivation.
3. **At the end** (Step 7): the shape of the report. Modules by verdict, the scale factor (or, on a
   reference-only source, that there is none and the build uses email standards), and the one or two
   flags that decide the next step.

**While a conversion batch runs (Phases 2 and 3).** This is the long, quiet one, so it earns five:

1. **After the source census:** your read of the audit's Module inventory plus your first look at
   the source file. Modules in the inventory, modules in this batch, the designs they come from, and
   the source fidelity tier you are building under. On a reference-only source add the clause that
   follows from it: the geometry is being built to email standards and their brand is what comes
   across, so a module whose margins do not match their file is the plan rather than a mistake.
2. **Before the batch starts:** what IS in it by module name, what is NOT and why (deferred,
   blocked on an unconfirmed concession, out of scope), and the opening estimate.
3. **After each module completes:** count, percentage, module name, revised remaining time.
4. **The moment a step is retried or a decision goes to the user:** a `recache=1` re-run, an
   `X-Trivial-Response` retry, an unconfirmed concession, a scale factor nobody has confirmed. Say
   it then, not in the batch report. A failed call the user just watched scroll past does not tell
   them whether you are recovering or stuck.
5. **At the end:** what was built, what was skipped, and why.

How each line is written:

- **A count and a percentage, never prose.** "Module 3 of 7 done, 43 percent" is the format.
  "Making good progress" is not a checkpoint. The denominator is the batch size you listed at the
  before-the-batch line.
- **Name the thing you are on.** "Module 4 of 7: Global footer" lets the user find it in Figma, and
  in Phase 1 "Design 3 of 11: Welcome email" does the same in their own file. "Module 4 of 7" does
  not, and a layer name scrolling past inside a tool call is not something a user can follow.
- **Revise the estimate from observed pace, every time.** After module 1 you know the real
  per-module cost in this workflow, so recompute the remainder from it instead of repeating the opening
  guess. Revising upward is fine and expected: an unstructured source runs slower than the opening
  guess, and the honest larger number beats the tidy stale one. This is the one thing the visible
  tool calls can never supply, so it is the part to get right.
- **Do not narrate the operation the user is already watching.** "Calling the worker" and "writing
  the node" are lines Codex has printed already, in more detail than you would. Spend the line on
  the arithmetic instead. The exception is when the visible calls mislead rather than inform: a long
  wait with nothing on the canvas, or a burst of calls that looks like thrash and is really one
  repair, earns one plain-language clause. "Transcribing the footer, 43 nodes" is worth reading;
  "running use_figma" is not.
- **Module boundaries only, and in Phase 1 design boundaries only.** Never per node, per style, per
  call, or per screenshot. A fifty-node module gets one line when it finishes, not fifty, and an
  audit that narrates every text node it reads is worse than one that stays quiet. The transcript is
  already dense with calls, so prose in between costs more here than it would on a quieter surface.
- **Own an overrun the moment it is apparent.** If the run is tracking well past the estimate you
  gave, say so at that module boundary, with the new number. A user who was told twenty minutes and
  is at forty should hear it from you rather than work it out.

Two worked examples, the format to copy. A conversion module:

> Module 3 of 7 done, 43 percent: Global footer, 43 nodes transcribed. Modules are averaging 6
> minutes in this workflow against the 4 I estimated, so the remaining 4 are roughly 25 minutes,
> putting the batch near 45 minutes total against the 30 I opened with. Next: Module 4 of 7,
> Two column product row.

An audit design, which is shorter because there is no build to price:

> Design 3 of 11 walked, 27 percent: Welcome email, 4 blocks cut, 2 of them new, 9 modules in the
> inventory so far.

### Say when you STOP, too

Everything above covers a run that is still running. Nothing in it covers a run that has stopped, and
that asymmetry is worse than having neither half: **an agent that reports progress but not its own
stop is worse than one that does neither, because the user infers continuation from the last progress
line.** The visible tool calls make this worse rather than better here. When you stop, the calls stop
too, and a user who has been watching a wall of `use_figma` writes scroll past reads the quiet exactly
the way he reads a long transcription: as work in progress. Silence is indistinguishable from still
working.

**Never stop silently.** If you stop, for any reason, say so in the SAME message as the last of the
work, not in a later reply and not only once the user asks. Four things, every time:

- what you completed, in the format of conversion checkpoint 3 (or audit line 2), so it reconciles
  with the lines before it;
- what remains, by module name from the audit's Module inventory, or by design name in Phase 1;
- why you stopped;
- the exact thing needed to resume, phrased so the user can send it straight back.

The reasons that qualify are a blocker, a decision only the user can make, a limit you have hit, or
reaching the end of a unit of work. That last one is the common case rather than an exception:
finishing a batch IS a stop, and conversion checkpoint 5 plus the gate in Phase 3 step 6 are how that
one gets announced, as audit line 3 plus the Step 8 hand-off are for a finished audit.

**Do not pause mid-batch.** In Phases 2 and 3 the batch is the unit of work and the design review
happens BETWEEN batches (Phase 3 step 6), so five modules of a five-module batch is a defined stopping
point and one module of five is not. Either complete the batch, or stop AT the blocker and name it. An
overrun is not a blocker: a batch tracking at double the estimate earns a revised number at the next
module boundary, not a stop. Phase 1 has no batch, so there the only mid-walk stop is a real blocker,
and Step 1 names the usual one, a component library file you cannot see.

A blocker specific enough to stop mid-batch is one this workflow already names: a concession with no human
yes in the audit's Flags, a scale factor nobody has confirmed, an asset or component library file that
is genuinely absent so the module cannot be built at all, or another decision only a designer can
make. Having built some of the batch is not on that list, and neither is the batch feeling long.

**Writing resumable state is correct, so say WHERE it is.** A batch that can span sessions needs state
that survives one, so keep a small JSON state file beside the `module-NN.json` payloads Phase 3 step 1
already has you write, and update it at the same module boundaries as checkpoint 3: the batch number,
the modules completed and remaining by inventory name, the fidelity tier, and the scale factor and
content width the batch is being built at. That much is expected behaviour rather than extra credit.
**Then name its path in the stop message.** The user saw the file being written scroll past inside a
shell call, which is not the same as knowing it exists or what it is for: state the user cannot see
does not make a run resumable, it only makes you feel that it is.

One worked example, the format to copy. It is one message, sent unprompted, not an answer to "are you
still working on it":

> Stopped, not still running. Batch 1 of 3, 4 of 5 modules done, 80 percent: Global header, Hero with
> CTA, Two column product row, Testimonial, all built at the REFERENCE ONLY standards (600 body, 560
> content width). Remaining in this batch: Global footer. Why I stopped: the footer's inventory row
> carries the image bleed rebuilt as a two column row concession and there is no human yes on it in
> the audit's Flags, so building it now means rebuilding it. To resume, confirm the two column rebuild
> or say "defer the footer to batch 2", and I will finish the batch from the saved state at
> `./migration-state.json`.

---
