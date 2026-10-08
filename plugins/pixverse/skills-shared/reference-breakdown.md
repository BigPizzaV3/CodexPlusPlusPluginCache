# Reference Breakdown

Read this when a supplied video, or a link the user asked to work from, is evidence for what
the new video should preserve, adapt or learn from. The useful result is a timecoded reading:
what the piece communicates and how its concrete choices make that work. Keep observed facts
apart from interpretation, and never claim to have watched footage you only have notes about.

## Get the file

```bash
"${PVX}" media fetch "https://example.com/watch?v=ID" --to projects/<slug>/reference/source.mp4
"${PVX}" media probe projects/<slug>/reference/source.mp4
```

`fetch` needs an installed `yt-dlp` (`./local-tools.md`); it never installs anything and refuses
to overwrite. Respect the source's rights: a reference is studied and adapted, not republished.
Record the URL, duration, aspect and audio presence in the project notes.

## Read the whole through its details

```bash
"${PVX}" media transcribe projects/<slug>/reference/source.mp4 --language en --to projects/<slug>/reference/words.json
"${PVX}" media tile projects/<slug>/reference/source.mp4 --every 1 --columns 6 --cell 240 \
  --words projects/<slug>/reference/words.json --to projects/<slug>/reference/overview.jpg
"${PVX}" media boundaries projects/<slug>/reference/source.mp4 --threshold 0.3
"${PVX}" media tile projects/<slug>/reference/source.mp4 --start 6.8 --end 8.4 --every 0.1 --columns 4 \
  --cell 320 --words projects/<slug>/reference/words.json --to projects/<slug>/reference/list-change.jpg
"${PVX}" media frames projects/<slug>/reference/source.mp4 --at 6.9,7.3,7.8 --label-time --to projects/<slug>/reference/frames
"${PVX}" media cut projects/<slug>/reference/source.mp4 --start 6.8 --end 8.4 --to projects/<slug>/reference/list-change.mp4
```

Widen the range to follow an argument or a persistent system; narrow it to trace an entrance,
a change or a handoff; enlarge a frame to read typography. Word labels on the grid connect
picture changes to the words they answer. `boundaries` gives mechanical change candidates,
never editorial cut labels; confirm each with frames.

## Write the notes

Keep two files under `projects/<slug>/reference/`:

- `ANALYSIS.md`: what the piece is trying to do, how the hook, argument and payoff work, which
  visual/sound systems recur (host, captions, board, B-roll, stickers, music), and what makes
  it hold attention. Facts and interpretation stay distinguishable.
- `TIMELINE.md`: sections named by source seconds and a phase, each connecting the active
  objects to the words or actions they serve, with entry, state, persistence and exit. Cite the
  evidence file for each claim. Example:

```md
## 6.07–8.27 · The workload accelerates
The spoken list "videos / voiceovers / ads / scripts" brings one full-frame illustration and a
marker-style word per noun, each replacing the last. Labels pop to size, settle, and leave with
their picture on the next word. Evidence: list-change.jpg, list-change.mp4; words in words.json.
```

## Turn the reading into direction

Record the relationship, not the seconds: "the board icon lands when the verdict word is
spoken", "B-roll covers the explanation and leaves before the next claim". In the new script
those become selections and moments (`./semantic-script.md`); the new performance sets the
seconds. Then decide, per system, whether it is preserved, adapted or replaced when the person,
product, wording, language or platform changes. Transform a role everywhere it appears: a
presenter is also an avatar, a voice, a lifestyle B-roll subject and the identity inside a
sticker. A product is a prop, a screen, a claim and the closing call to action.
