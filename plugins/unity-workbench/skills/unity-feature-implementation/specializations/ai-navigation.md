# AI and Navigation Specialization

## Use when

Use for NavMesh, pathfinding, behavior trees, state machines, perception,
targeting, steering, and enemy decision-making.

## Inspect first

- navigation framework
- update cadence
- state or behavior architecture
- perception system
- target ownership
- multiplayer authority
- pooling
- obstacle and agent settings

## Implementation rules

- Keep decision logic separate from presentation.
- Avoid expensive full-scene searches.
- Control update frequency.
- Preserve authority rules.
- Make state transitions explicit.
- Handle unreachable targets.
- Handle despawned targets.
- Reset pooled AI state.
- Avoid hidden coupling to scene names or tags.

## Validation

- valid and invalid targets
- unreachable destinations
- target loss
- scene reload
- pooled reuse
- multiplayer authority
- performance with representative agent counts
