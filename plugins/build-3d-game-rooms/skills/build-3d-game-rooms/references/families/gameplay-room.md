# Gameplay room adapter

- Use for rooms traversed by a player, vehicle, ball, or other moving gameplay object.
- Treat collision, navigation, sight lines, recovery zones, and gameplay-camera readability as Function contracts.
- Reserve the full movement envelope, including speed-dependent stopping distance and animation extents, before dressing.
- Avoid silhouette noise behind critical targets, gates, pickups, hazards, or routes.
- Test intended and unintended routes, spawn/respawn locations, occlusion, boundary containment, and performance in the real runtime.
- Decorative openings must not imply a traversable route unless navigation and collision agree.
