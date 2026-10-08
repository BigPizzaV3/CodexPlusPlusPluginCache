# Write An Executable Source Edit

Use the original measured footage, the resolved change sheet and ordered references.
Keep planning alternatives outside the submitted prompt. Save the submitted text under
the project so a rejection or comparison can recover the actual input.

## Reference Authority

Bind the original as `Video 1` and images in their actual `--images` order. A person
image controls the complete visible look, including worn accessories. A separate mapped
garment reference or explicit wardrobe instruction overrides only its named clothing.
The source supplies performance, lip movements, blocking and lighting, not a default
wardrobe veto. Attribute-only edits keep the person's identity.

When clothing is overridden, lead with the resolved final outfit. Do not repeatedly
describe the discarded costume from the person image: that creates a competing visual
instruction even beside a later override. The image still owns the person's remaining
complete appearance. Transfer only clothing visible in each original crop; off-screen
shoes or a full-body reference never authorize a wider shot. Check the opening occlusion
and every cut for costume or original-face leakage rather than checking only the clearest shot.

State selected components of an outfit board. Resolve conflicts between its props and
the advertised product before submission. Give complementary product views their own
declared role without turning them into additional replacements or new scenes. Never
insert a reference collage into the output.

## Simple Non-Identity Change

For one background, object or attribute edit, use a short complete specification:

```text
Edit Video 1. Preserve its full duration, framing, camera, performance, cuts and timing.
Preserve all untargeted on-screen text and graphics exactly: wording, styling, position,
animation and visibility times. Text attached to a replaced target follows its replacement.
0–[start]s: preserve the source.
[start]–[end]s: change only [anchored target/property] to [resolved description or Image N].
[end]–[source duration]s: preserve the source.
Keep every other subject, product, gesture and lighting property unchanged.
Use only the original source soundtrack in the finished edit.
```

Resolve every bracket before execution, omit zero-length segments and merge adjacent
equal states. A whole-clip change needs one range. Do not use this form for a person
replacement or compress several interacting targets into one vague sentence.

## Identity Or Multiple Interacting Changes

Use this structure when replacing a person, spanning multiple shots/occlusions, or
changing several categories. The number of operations follows the actual request.

```text
Video 1 is the source to edit.
Image 1 defines [person alias]'s complete visible appearance: [observed relevant look,
without describing discarded clothing when a wardrobe override follows].
Image 2 overrides [only the selected wardrobe components]; [resolved accessory exclusions].
Image 3 defines [replacement location/product/other actual role].
Preserve all untargeted captions, subtitles, UI, labels, branding and graphics exactly,
including wording, styling, position, animation and timing. Text physically attached to
a replaced target follows that replacement.
Edit the existing [measured duration]s clip. Preserve every source shot and cut, camera
movement, crop, performance, expression, mouth movement, pose, interaction and timing.
Change only [complete resolved scope].
1. Replace [unique original-person anchor] in every appearance with [alias] from Image 1,
   transferring the complete look subject to the stated wardrobe override. The mapped
   original identity must never reappear, including through occlusion, blur, reflections,
   shadows, entrances, exits and cuts. Retain the original performance and prop contacts.
2. Change only [mapped wardrobe/property] to [its resolved reference-defined state] during
   [actual range]. Preserve [remaining reference-owned appearance].
3. Replace [other actual target] using [its actual reference] during [actual range],
   maintaining source perspective, lighting direction, physical support and contact.
Lock [each identity/reference mapping]. Preserve [specific protected product geometry,
accessories and interactions]. Prevent identity mixing or duplication. No other content,
action, camera movement, cut or timing changes.
Render only these edits in the inherited photographic treatment. The finished video uses
only the unchanged source default audio; introduce no new speech, music or sound effects.
```

Omit absent references and operations. A time-scoped identity effect follows the user's
explicit scope rather than silently widening it. When all changes span the whole source,
inherit the footage's timing without a competing gesture-by-gesture rewrite. If exact cuts
are listed, use observed frame boundaries rather than rounded scene-analysis timestamps.

## Check The Actual Submission

Before preflight, check the final text and media arrays together:

- Every supplied generation reference is used in its declared order and role; no missing
  references, undeclared tags, transport IDs or URLs appear in the prose.
- Every requested operation has a unique target and resolved scope. An `add` includes
  placement, scale and interaction; a `remove` reconstructs the revealed surroundings.
- Complete person appearance and clothing precedence agree throughout. The mapped source
  wardrobe is never accidentally protected, and a clothing-only edit never excludes identity.
- Original-person exclusion covers the difficult appearances, while unmapped people and
  the protected product remain intact. Location changes do not also lock the old furniture.
- Untargeted text protection appears once as an unconditional rule; explicitly targeted
  text edits receive their own operation. No automatic subtitle addition/removal appears.
- No unresolved branches or placeholders remain; ranges cover the requested scope without
  gaps or overlaps. No new shot, pose, dialogue or camera move has been invented.
- The complete prompt fits the 3900-character recipe budget and any stricter live model
  limit. Apply Seedance enhancement without removing these invariants.

Correct a defective prompt before preflight. Keep a validated baseline immutable during a
comparison; any revised prompt is a separately labeled treatment with a fresh preflight.
