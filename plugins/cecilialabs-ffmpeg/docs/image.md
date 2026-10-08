# Image Workflows

## Convert image formats

```bash
cecilia-ffmpeg image convert photo.jpg --to png
cecilia-ffmpeg image convert artwork.png --to webp --quality 85
cecilia-ffmpeg image convert animation.webp --to gif --fps 12
```

Accepted image format names include `jpeg` and the `jpg` alias.

Geometry options:

```text
--width <pixels>
--height <pixels>
--fit contain|cover|stretch
--background <color>
```

Animation-related options:

```text
--fps
--max-colors
--loop
```

## Extract a frame from video

```bash
cecilia-ffmpeg image extract clip.mp4   --at 12.5   --to jpeg   --width 1280   --height 720   --fit contain
```

Supported still outputs: PNG, JPEG/JPG, WebP.

## Choosing fit

`contain` is safest when preserving the whole source matters. `cover` is useful for fixed canvases/thumbnails. `stretch` deliberately allows aspect-ratio distortion.
