# Workspace contract

Do not force this layout onto an existing project. Discover existing files first.

When creating a new Creator Workspace workspace from scratch, prefer:

```text
brain/
  raw/
  wiki/
  imports/
  _index.md
profile/
  about-me.md
  voice.md
memory/
  rules.md
  lessons.md
projects/
  <project>/
    state.md
outputs/
```

Ownership rules:

- `brain/wiki/**` owns knowledge synthesized from sources.
- `profile/**` owns voice and author-profile rules.
- `memory/rules.md` owns cross-project durable preferences.
- `memory/lessons.md` owns durable warnings from mistakes.
- `projects/<project>/state.md` owns temporary decisions, open work, and one-off overrides.
- `outputs/` contains generated deliverables when the user wants local files.

A skill must not duplicate a fact into several owners merely because it can.
