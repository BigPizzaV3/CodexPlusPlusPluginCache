# ChatGPT Desktop / Codex Local Environment

This project can use a **Local Environment** in the ChatGPT desktop app so Codex worktrees automatically install dependencies and validate the local FFmpeg runtime.

## Where to configure it

1. Open the ChatGPT desktop app.
2. Switch the product selector to **Codex**.
3. Open **Settings → Environments**.
4. Select the environment associated with this project (or create one).
5. The app stores the generated project environment configuration under `.codex` at the project root; that generated file may be committed when you want to share the environment configuration.

Local environments are specifically used by Codex in the desktop app. Local and Worktree executions both run on the computer hosting the project.

## Setup script

Set the Linux setup script to:

```bash
npm run codex:setup
```

That command executes `scripts/codex-environment-setup.mjs`, which verifies:

- Node.js;
- npm;
- FFmpeg;
- FFprobe;
- dependency installation (`npm install`);
- initial TypeScript build.

The Codex app runs the setup script automatically when it creates a new managed worktree for a new chat.

## Cleanup script

Set the cleanup script to:

```bash
npm run codex:cleanup
```

It removes generated build/test cache directories but does not remove source files, `node_modules`, media fixtures, or user files.

## Recommended Actions

Create these actions in the **Actions** section of the Environment screen:

| Action | Command |
|---|---|
| Build | `npm run build` |
| Type Check | `npm run check` |
| Lint | `npm run lint` |
| Test | `npm test` |
| Validate | `npm run validate` |
| Doctor | `npm run doctor` |
| CLI Help | `npm run cli -- --help` |

`Validate` is the release gate for a milestone because it starts with the
foundation verifier, runs every current runtime/documentation/packaging gate,
and then runs TypeScript, ESLint, Vitest, and the production build.

The foundation check can also be run directly when a change touches package
identity, CLI wiring, TypeScript configuration, or the process boundary:

```bash
npm run verify:foundation
```

## Worktrees

For milestone development, prefer **Worktree** when you want Codex changes isolated from your primary checkout. Managed worktrees are Git worktrees created by Codex and can run this Environment's setup script automatically.

If future versions of this project require ignored local files (for example `.env.local`), create a `.worktreeinclude` file at the repository root containing only the ignored paths that must be copied into managed worktrees:

```gitignore
.env.local
```

Do **not** add secrets to Git. `.worktreeinclude` copies matching ignored local files into a Codex-managed local worktree; it does not make them tracked.

## Recommended workflow for each milestone

1. Start a Codex **Worktree** chat from the latest stable milestone branch/commit.
2. Let the Environment setup run.
3. Implement the milestone.
4. Run the `Validate` action.
5. Review the diff in the desktop app.
6. Commit or transfer the work back to Local only after validation passes.

## Troubleshooting

### FFmpeg not found

Run:

```bash
which ffmpeg
which ffprobe
ffmpeg -version
ffprobe -version
```

If FFmpeg is installed outside `PATH`, use the toolkit's `--ffmpeg-path` and `--ffprobe-path` overrides or update the environment PATH before running Codex.

### npm install fails

Confirm the integrated terminal can reach the npm registry and that any corporate proxy configuration is available in the same shell environment.

### Worktree is missing a local file

If the file is intentionally ignored by Git, add its path to `.worktreeinclude`. Tracked files are already present in the worktree and should not be listed there.
