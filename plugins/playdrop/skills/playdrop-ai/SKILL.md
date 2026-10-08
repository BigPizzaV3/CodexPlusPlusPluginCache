---
name: playdrop-ai
description: Develop, test, publish, improve listings and distribute creator-owned browser games on PlayDrop when the user asks to use PlayDrop. Use its connector tools and current documentation for complete uploads, retained versions, SDK features and game views.
---

# PlayDrop

Help the creator make the best game they can, give it a strong listing and reach players on PlayDrop.
The creator owns and maintains their code with their coding agent. Uploaded games and PlayDrop Studio games
are separate: do not read Studio source, request Studio tasks, update Studio games or use them as upload dependencies. Studio library cards expose only basic
metadata and a link to continue on PlayDrop. There is no bulk-delete tool; do not substitute uploads, publication or cancellation for deletion.

## Establish the available capabilities

Use `get_account` and `list_games` to check the connected creator and owned games. Read `get_documentation`
for current `catalogue`, `sdk` and `server-sdk` contracts before using advanced features. Never request or expose
passwords, OAuth credentials or component grants in conversation.

Use the tools actually available on this connection. Catalogue uploads, version inspection, publication and
Extensions are normal connector capabilities. If a host does not expose a tool, use its available upload tools
or the website and explain that limitation. Do not claim a deployment or review verdict without evidence.

## Develop, test and upload a complete game

For a simple self-contained HTML game, use `upload_game` with the HTML and explicit private visibility.
This is the shortest upload path when no extra files or listing media are requested. Keep any supplied media,
server code and dependencies: use the complete catalogue workflow below when the upload includes those files.
Do not simplify a complete game into HTML alone to bypass a transport failure.

1. Build in the creator's project and keep original source there. Keep the same game identity and slug on updates.
2. When developing locally, start the game server and open
   `https://www.playdrop.ai/creators/<username>/apps/game/<slug>/dev?url=<encoded loopback URL>`
   in a compatible browser on the same machine. URL-encode the full local URL. Use the built-in browser if it
   supports local-network access, otherwise the creator's ordinary browser with its normal permission flow.
   Verify input and rendering through the PlayDrop host and SDK; standalone localhost is insufficient.
   Keep the server running, report which browser passed, and do not disable browser security, use a tunnel,
   upload a substitute Dev version or send local Dev context to `show_game_panel`.
   This local development step is unnecessary when uploading already-created attachments.
3. Prepare a complete `catalogue.json`, listing and file manifest. Every push is a full snapshot: include every
   desired field and every desired file. Omitted optional fields follow replacement semantics; omitted catalogue
   items are not deleted. An explicit reused file from an owned retained version must appear in the new manifest.
   Supply each app's visibility explicitly, or set the catalogue request's visibility. Prefer private testing.
   Baked procedural 2D assets are supported. Executable procedural/CUSTOM 3D uploads are unsupported through
   the connector. Reference an existing supported asset revision or upload a baked supported format instead;
   do not execute creator modules in the API.
4. Where available, use `prepare_catalogue_upload`, transport every declared file, then
   `complete_catalogue_upload`. Support signed byte uploads, inline text and host-provided file attachments
   according to the tool schema. For ChatGPT attachments, pass individual runtime/media file references through
   top-level `attachments`. Map each manifest path with `attachmentIndex`, its zero-based position in that
   array: for `attachments: [htmlFile, iconFile]`, use `{path: "game/index.html", attachmentIndex: 0}` and
   `{path: "media/icon.png", attachmentIndex: 1}`. ChatGPT resolves those references into download objects
   after the model call; do not bind manifest paths to internal file IDs or filenames.
   PlayDrop fetches the bytes server-side. Inline text remains suitable for HTML; local coding agents can PUT
   signed uploads directly. The tool does not unpack ZIPs: attach the contained files individually. Never invent
   file IDs or download URLs, and do not drop listing media to hide a transport failure. If the installed tool
   lacks this attachment contract and the host cannot reach signed storage, report the blocked transport.
   Keep the request ID and returned per-item receipts; resume the same upload
   after a partial or ambiguous result. Report committed items and unfinished items honestly. Cancel only an
   upload the user intends to abandon.
5. Prefer private testing before publication when requested. Review admission applies to each
   exact MCP-uploaded version, including private drafts. An unfinished review is not an eligible verdict.

Make gameplay responsive and use device safe areas. English and the creator's language should have complete
listings and localized artwork when requested. Listing icons, screenshots, landscape trailers and portrait
teasers should reflect the actual game. The optional PlayDrop SDK supports saves, leaderboards, achievements,
social features and multiplayer. Read current docs for hosted Colyseus game servers and asset/spec/pack support.

## Inspect, publish and improve

Use `list_game_versions` and `get_game_version` when available to inspect exact uploaded artifacts, visibility,
retention, listing, review feedback and distribution. Keep original source in the creator's local project;
never promise a cloud source-code editor.

`publish_game_version` publishes a selected retained version without new bytes or a new version number.
Read the current public version first and supply `expectedCurrentVersion`. On a stale expectation, explain the
conflict and refresh the selection; do not silently replace a newer publication. Publication preserves the
selected version's existing review. Private uploads must not change the live listing or tags.

Return canonical `/@creator/game-slug` links with the exact public version for Live playback. Owners can have
newer private drafts, so do not present a draft as Live. Distribution follows the returned review/discovery
status and varies by surface; do not promise search placement or recommendations before eligibility.
Use review feedback to improve gameplay and listing, then upload another complete snapshot.

## Extensions behavior

The Sidebar library shows owned game cards with Live, Draft or Studio status. Clicking an uploaded game
opens its latest retained version for playtesting. Studio cards show an Open in PlayDrop handoff; the connector
cannot read or change their source. There are no per-card Play/Update buttons or separate creation prompt.
Use the host conversation composer for creating games and requesting changes.

The Conversation panel contains only the game player and Live / Draft controls. Live resolves the exact
current public version; Draft selects an exact private version or the latest draft. Missing versions show clear
empty states. `show_game_panel` accepts empty input for game selection, or the chosen game/version/environment.
Use it to test uploaded versions; local Dev belongs in the browser workflow above. Editor and Assets views are
outside this first release. Game updates remain complete uploads from the creator's coding agent; do not invoke
Studio tasks.

Use `send_feedback` when the user asks to report a PlayDrop issue or suggestion. Include useful reproduction
steps and observed errors without credentials or private source unrelated to the report.
