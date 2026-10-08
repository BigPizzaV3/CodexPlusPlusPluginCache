# Animation Specialization

## Use when

Use for Animator Controllers, animation states, transitions, IK, rigging,
Timeline, procedural animation, and animation events.

## Inspect first

- Animator or Playables architecture
- controller ownership
- parameter conventions
- layers and masks
- root motion
- rigging packages
- network synchronization
- animation event usage

## Implementation rules

- Preserve existing parameter names.
- Avoid unnecessary controller rewrites.
- Keep gameplay authority outside animation events.
- Use animation events only for presentation-timed callbacks when appropriate.
- Consider root motion ownership.
- Avoid parameter spam.
- Reset pooled animator state.
- Keep networked animation state compact.

## Validation

- transition entry and exit
- interruption
- pooled reuse
- root motion
- layer masks
- network observers when relevant
- visual inspection
