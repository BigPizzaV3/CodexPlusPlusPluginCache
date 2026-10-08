# Plugin Assets

Milestone 11 ships original, self-contained SVG assets for the FFmpeg Media Toolkit plugin.

## Files

```text
assets/
├── icon.svg
├── icon-dark.svg
├── logo.svg
└── screenshots/
    ├── cli-overview.svg
    └── skills-overview.svg
```

The icon uses a deliberately simple media-frame + play-mark geometry so it remains legible at 16×16, 32×32, 64×64, and 128×128.

- `icon.svg` targets light interfaces.
- `icon-dark.svg` targets dark interfaces.
- `logo.svg` is the horizontal product mark.
- `screenshots/*.svg` are documentation-preview assets generated from repository-owned vectors, not external images.

No asset references external image files, remote stylesheets, scripts, or web fonts. The SVGs are therefore portable inside the distribution package.
