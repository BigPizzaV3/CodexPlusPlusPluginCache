# Superdesign CLI contract

Use the published CLI on demand with the full prefix `npx --yes @superdesign/cli@latest`.

## Preflight and authentication

1. Confirm shell execution is available. If it is unavailable, stop: this plugin requires the CLI.
2. Run the bare command once. Read its `auth:` line and recent projects.
3. If logged out, run `login`, wait for success, and then continue.
4. Reuse a recent project only when it clearly holds the visual work the user referenced. Otherwise create one:

```bash
npx --yes @superdesign/cli@latest create-project --title "<project title>"
```

`create-project` opens the canvas by default. Use `--no-open` only in a headless environment.

## Canvas first — before any design work

As soon as the brief is clear enough to resolve or name a project, open its canvas before generating new image assets, uploading a newly generated asset, or calling `create-design-draft` / `iterate-design-draft`. This rule covers Graphic, Slides, and exhibition design; simple Moodboard collection keeps its intentional upload-then-open sequence in [moodboard.md](moodboard.md).

For a newly created project, keep `create-project`'s default browser-opening behavior and read the returned `canvas:` URL. For an existing project, mint current links:

```bash
npx --yes @superdesign/cli@latest canvas-link <project-id> --json
```

Attempt the handoff with the available browser surface:

- Open `embedCanvasUrl` only in an agent-embedded browser; never share this temporary sign-in URL with the user.
- Open `canvasUrl` in the user's normal browser when that capability is available, and always provide it as a clickable link.
- If automatic opening is unavailable or fails, provide `canvasUrl` and ask the user to open it manually. This does not block generation.

Before starting asset or design generation, send the user a progress update equivalent to: “The Superdesign canvas is open. You can keep it open and wait—new assets and designs will appear there as they are generated.” If automatic opening failed, state that accurately instead of claiming the canvas opened.

Do not wait until the first draft finishes to surface the canvas. For a long Slides or Graphic workflow, keep the user oriented while asset generation and uploads populate it.

## Command rules

- Verify uncertain flags with `<command> --help`; the published CLI is the source of truth.
- Use `create-design-draft` only for a new base artifact. Static visual work uses `--kind graphic` plus explicit `--width` and `--height`.
- Use `iterate-design-draft` from an existing draft for creative visual work. Use `--mode replace` to refine an accepted artifact and `--mode branch` only when the user wants a separate option or, in a deck, a separate numbered slide.
- Pass the user's verbatim request through `--user-request` on generation and iteration commands.
- Use multiple `-p` flags only for the number of outputs the user requested. Keep batches to at most four outputs.
- Use `fetch-design-nodes --project-id <id>` to recover draft IDs from an earlier session.
- Read a draft with `get-design --draft-id <id> --json` before revising it.
- Upload local PNG, JPEG, WebP, or GIF assets under 10 MB with `upload-asset <file> --project-id <id>`. Uploads are placed on the project canvas by default; never pass `--no-canvas` when the user wants to collect or view the asset there.
- Default output is agent-optimized. Add `--json` only when the full payload is needed and `--full` only for truncated fields.

## Asset routing and visible pixels

Choose the upload purpose from the asset's role instead of treating every image the same:

- **Reference** — a screenshot, visual reference, inspiration image, or temporary composition guide. Upload with `--purpose reference`. Keep the returned node ID and pass it with `--reference-id` whenever generation must see the image.
- **Content** — an image that must appear in the final graphic or slide. Upload with `--purpose content`, retain its returned public URL for the prompt and final HTML, and also pass its node ID with `--reference-id` when crop, placement, or visual analysis matters.
- **Brand** — a logo, font, or reusable identity asset. Upload with `--purpose brand`, the correct `--type`, a stable `--key`, and a useful `--description`. Retain the returned asset key and public URL. Pass the asset key with `--reference-id` when generation needs the pixels, and require the exact public URL wherever that asset must render.

Example for inspiration:

```bash
npx --yes @superdesign/cli@latest upload-asset "/absolute/path/to/reference.png" \
  --project-id <id> --purpose reference
```

Example for a reusable logo:

```bash
npx --yes @superdesign/cli@latest upload-asset "/absolute/path/to/logo.png" \
  --project-id <id> --purpose brand --type logo \
  --key "primary-logo" --description "Primary brand logo; use exactly as supplied"
```

Use the identifier printed by the upload command:

```bash
npx --yes @superdesign/cli@latest create-design-draft \
  ... --reference-id <node-id-or-asset-key>
```

Pass multiple relevant identifiers after the same variadic flag: `--reference-id <id-1> <id-2>`. Do not pass every project asset indiscriminately; select the images that inform this artifact. A public URL in `-p` is necessary when the finished HTML must render an image, but it is not a substitute for `--reference-id` when the model must inspect that image.

If the user supplies a direct image URL rather than a local file, download it only when the local agent can do so safely and the response is a supported image within the upload limit. Accept only ordinary public `http` or `https` locations; reject credentialed, loopback, link-local, and private-network destinations, including redirect targets. Save the response to a temporary local file, verify that it is actually a supported image, then classify and upload it through the same flow. If it cannot be fetched or is an HTML page rather than an image, report that and ask for the file; do not pretend its pixels were provided.

## Revision routing

Read the selected draft before changing it:

```bash
npx --yes @superdesign/cli@latest get-design --draft-id <id> --json
```

For an exact correction—copy, factual claim, URL, known image replacement, or a precise CSS size/overflow defect—export the draft HTML, edit only the requested literals locally, and save it as a new revertible version of the same draft:

```bash
npx --yes @superdesign/cli@latest get-design --draft-id <id> --output /absolute/path/to/draft.html
npx --yes @superdesign/cli@latest import-design-draft \
  --into <draft-id> --html-file /absolute/path/to/draft.html \
  --generated-by <local-model-id> --user-request "<verbatim user request>"
```

This path uses the local coding agent and does not spend design-generation credits. Preserve the document structure and validate the edited HTML before importing it.

For creative recomposition, hierarchy, art direction, or style work, use Superdesign generation on the selected draft with `iterate-design-draft --mode replace`. Use `--mode branch` only for an explicit alternative direction or a separate numbered artifact. Pass relevant uploaded assets again with `--reference-id` during iteration.

## Failure handling

- For an authentication error, run `login` and retry the intended command once.
- Retry any other failed command at most once after correcting its specific cause.
- If generation still fails, report the command error and stop. Do not invent draft IDs, canvas links, or a successful result.

## Canvas review handoff

Read `canvas:` and `preview:` links from command output. The canvas has already been surfaced before generation; share it again at natural review points after the first draft or iteration completes. Appending `?live=1` to the returned canvas URL is allowed for watching drafts stream in; do not otherwise hand-construct URLs.
