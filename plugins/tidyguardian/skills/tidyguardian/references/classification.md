# Classification and media rules

Classification is transparent path/type matching, not an AI confidence score. English keywords match whole tokens; explicit Chinese terms are supported. Known document/audio/archive types can be proposed under clear categories. Unrecognized image/video topics stay in place as Review Needed rather than being forced into a category.

Plans propose `_TidyGuardian_Organized/Category/YYYY/YYYY-MM/filename`. `--organized-root` changes the prefix. Low-confidence media is omitted from automatic move proposals. A human can construct a reviewed move CSV and import it with `apply-move`, but the current policy still validates every proposed file.

Default dates use filesystem modification time. `catalog --media-dates` opts into local FFprobe creation times or optional Pillow EXIF original dates. Each catalog row records `date_basis` and its date string; missing/unreadable metadata falls back to mtime. Naive EXIF times are labeled as timezone unknown. A media metadata failure is not deletion evidence.

The planner may choose numbered suffixes while generating a plan. The final destination is frozen for review. Execution refuses new collisions, including conservative case/Unicode collisions, rather than silently choosing another name or overwriting.

`thumbnails` produces a local review board. Videos use samples around 10%, 50% and 90% when duration is available, with a bounded fallback otherwise. Image previews use one frame. Empty, dark, silent, unreadable or failed media stays in manual review. Similar-looking files are not exact duplicates and are never removal candidates on appearance alone.

Project/package and sidecar protection is conservative and intentionally incomplete. Use explicit ignore rules for unsupported creative applications, camera structures and backups. Automatic dependency-aware group moves and semantic AI classification remain roadmap work.
