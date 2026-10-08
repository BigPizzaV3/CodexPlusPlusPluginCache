# Room design doctrine

## Semantic architecture

- Make function readable before ornament. Every dominant architectural form must have a declared purpose.
- Use an arch only for a passage or an unmistakably deep, backed alcove. A shallow plaque inside a door surround is a false doorway and fails Function.
- Give doors a destination: visible leaf or passage, reveal, threshold, and space beyond.
- Give windows a sill, reveal, believable wall thickness, and view or backing.
- Give deep alcoves a complete recess, backing, purpose, and depth of at least `max(0.35 m, 15% of opening height)`.
- Build continuous procedural wall, floor, and ceiling substrates. Subtract openings with approved Boolean cutters. Add imported or generated architecture and props as dressing.

## Composition and scale

- Establish one hero hierarchy in the production camera. Supporting features must not compete through scale, brightness, or central placement.
- Reserve the hero's complete runtime silhouette before dressing the room.
- Give focal features a count-aware composition. Place one at one deliberate focus, two as a balanced pair, and four as an evenly separated fourfold set; do not stack secondary focal objects on an axis already occupied by a throne, portal, stage, or comparable feature.
- Keep backdrops and secondary features outside the hero's reserved volume and screen-space silhouette.
- Aim seating at its declared use: toward the hero, the center of a conversation group, or the intended viewing/circulation direction.
- Break modular repetition through bay function, depth, lighting, and prop rhythm, not arbitrary misalignment.
- Prevent edge fragments: keep intentional objects wholly framed or clearly continue them beyond the frame.
- Dress shelves and alcoves enough to explain their function; empty repeated fixtures read unfinished.

## Plans, symmetry, and circulation

- Make the floor plan a complete contract for the reviewed space. Include the room outline, cutouts, openings, exterior entrance apron, main sign, ingress props, floor markers, barriers, columns, circulation route, and every placed feature in machine-readable metadata.
- Present the plan as a restrained grayscale engineering drawing with mostly black linework. Derive object marks from top-down orthographic renders of the actual meshes; do not replace props with generic rectangles or decorative category colors.
- Separate lower-room and reflected-ceiling projections into toggled layers so chandeliers and ceiling decoration never obscure floor objects. Omit AI-inspiration panels by default; include one only when the user explicitly asks for it.
- Treat an assigned equirectangular environment as authored room context. Pin it by stable room identity, keep it visible through deliberate openings, and review it from environment-only front, right, rear, left, up, and down directions.
- Keep titles, legends, room facts, approval copy, explanatory footers, and other infographic furniture outside the plan image. Put semantic detail in accessible UI or machine-readable metadata.
- Declare symmetry before composition. Apply the declared order to architecture, barriers, circulation, and repeated props; record deliberate exceptions instead of allowing visual drift.
- Do not satisfy a high radial order by repeating every asset at that order. Prefer sparse complementary lower-order sets offset by one declared sector—for example, two fourfold families offset by 45 degrees to express an eightfold room. Alternate objects of similar height, mass, or function between those sets.
- Make circular rooms highly radial. Arrange circulation and barriers as concentric rings, spokes, or repeated radial bays.
- Keep freestanding column spans visually open to the exterior. Do not place opaque infill between columns; when a solid wall is intended, use engaged columns or pilasters and label that condition.
- Make the primary arrival generous and spatial: default to an open hallway or large aperture with at least 2.4 m clear width, visible depth, and a legible destination. Document any functional exception.

## Contact and clearance

- Require floor and shelf props to touch their support with a controlled `0-5 mm` inset, never float.
- Require wall fixtures to meet a mounting surface or visible bracket.
- Require ceiling fixtures to meet a beam, rose, chain, or ceiling surface.
- For floor- or wall-mounted objects, place the declared attachment face on the support. When none is declared, use the largest suitable planar face; orient the semantic front upward on floors or inward toward the room on walls. Reject edge-balanced, back-facing, or arbitrary-axis placement.
- For surface-applied ceiling decoration, resolve the nearest visible support underside at its actual position. Measure evaluated world-space mesh vertices after every transform; cached object dimensions are not evidence. Align the shortest dimension to the support normal and the largest face parallel to it with a controlled `0-5 mm` inset. Keep the broad room-facing surface unobstructed by wells, panels, beams, or slabs. Require `abs(dot(shortAxis, ceilingNormal)) >= 0.95`, support contact, and a broad face-on silhouette in a straight-up underside render. Exempt declared pendants only when a visible rose, chain, stem, or bracket establishes suspension.
- Use world-space BVH intersections for clipping and measured nearest-surface distance for clearance.
- Use production-camera screen-space gaps for tangencies. Physical separation alone does not prevent a visual collision.

## Shell and openings

- Give exterior boundaries thickness and overlap. Never depend on decorative modules as the only barrier to the world background.
- Associate every arch, door, and window with an opening-schedule ID and an evaluated wall Boolean. Apply the Boolean before its surround; decorative architecture laid onto an uncut wall fails Form.
- Treat open colonnades as intentional scheduled apertures or open shell boundaries with explicit navigation/collision containment and a visible exterior, not as accidental leaks.
- Verify manifold edges, aperture area, normals, and destination geometry after every evaluated opening.
- Audit the primary arrival independently: clear width, height, passage depth, destination visibility, and obstruction state must match the schedule and lower-room plan.
- Hide seams with intentional substrate overlap, trim, posts, beams, thresholds, and backing—not coplanar faces.
- Test with bright-world leak renders, clay materials, floor/ceiling obliques, and final lighting.

## Lighting and review

- Share one fixture manifest between authoring preview, lightmap baking, and runtime effects.
- Keep baked light as the stable baseline and dynamic variation restrained.
- Preserve material separation and contact shadows; overexposure that hides depth fails Form.
- Show the ceiling deliberately. Include one center-up view and two opposed ceiling obliques in addition to four 120-degree corner views; reveal ceiling silhouette, attachment points, lighting, and wall-to-ceiling junctions. A surface decoration passes only when its broad face reads face-on in the center-up view and remains visibly attached in an oblique view.
- At every gate ask: “What is the strangest element, and what promise does it make that the scene does not fulfill?”
