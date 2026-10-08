# Look Index

Pick one look, open only its recipe section, and copy its FORMULA, MOTION, PALETTE LOCK
and NEGATIVE into the templates in `./production.md` and `./block-prompt.md`. The recipe
also lists the look's signature devices, roster guidance and shot shapes — use them as
the vocabulary for shot lines.

| Look | One-line character | Recipe |
| --- | --- | --- |
| Editorial Motion Graphics | cream paper, grayscale archival cutouts acting as paper puppets, one bold accent | `./editorial-motion-graphics.md` |
| Paper Diorama | miniature sepia newsprint-and-cardboard worlds, tungsten light, one accent, macro depth | `./styles-history.md` |
| Mannequin | clean clay-render reenactment, featureless figures in solid role colours | `./styles-history.md` |
| Watercolor Chronicle | ink line under translucent washes on cotton paper, restrained historical palette | `./styles-history.md` |
| Cinematic Storybook | lush hand-painted 2D fairytale, animated on twos, jewel tones | `./styles-material-and-story.md` |
| Claymotion | hand-shaped clay with thumbprints, stop-motion pose steps | `./styles-material-and-story.md` |
| Fluffy Toy | plush felt-and-fibre miniatures on a tabletop set | `./styles-material-and-story.md` |
| Kids Studio 3D | chunky rounded toy forms, candy colours, clean white studio | `./styles-color-and-shape.md` |
| Colorful 3D | saturated rounded outdoor world, blue sky, glossy props | `./styles-color-and-shape.md` |
| Pastel Flat 2D | rounded flat shapes, soft pastels, coloured contours | `./styles-color-and-shape.md` |
| Poster Vector | bold flat silhouettes, crisp edges, high-contrast colour fields | `./styles-color-and-shape.md` |
| Hand-drawn Ink | thin irregular black line and grey wash on white | `./styles-drawn-and-frame.md` |
| Whiteboard Doodle | marker lines drawing themselves on a whiteboard | `./styles-drawn-and-frame.md` |
| Pixel Art | one fixed pixel grid, stepped sprite animation, limited ramps | `./styles-drawn-and-frame.md` |
| Stickman Cartoon | minimal webcomic stick figures, flat fills, deadpan | `./styles-drawn-and-frame.md` |
| Picture-story Papercraft | matte cut-paper stills for the Picture Story pipeline | `./styles-drawn-and-frame.md` |

Defaults: Explainer and History → Editorial Motion Graphics; Kids → Kids Studio 3D;
Fairy Tale & Myth → Cinematic Storybook; Picture Story → Picture-story Papercraft. The
user's choice always wins. A look never selects the audience: Pastel Flat 2D or Colorful
3D alone does not switch on Kids narration.

**A supplied style image** is a look donor: attach it to the style-key call, describe
its observed medium, line, palette, surface and stage in an 80–100 word formula written
in the same form as the recipes, and use that formula everywhere. Take its rendering,
never its subjects or lettering.

**A look with no recipe** (the user describes one): write the formula yourself in the
same form — medium and line/surface · shading · palette · one signature accent ·
background treatment · how things move — plus a MOTION token, PALETTE LOCK and NEGATIVE.
Flat 2D looks add `3D render` to the NEGATIVE; dimensional looks leave it out. Describe
looks in plain visual terms rather than by naming a studio, brand or artist.
