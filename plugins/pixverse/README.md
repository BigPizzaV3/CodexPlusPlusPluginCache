# PixVerse Agent Plugin

Turn Codex into a PixVerse-powered video creation studio.

Turn ideas, prompts, and references into finished videos. Plan stories, build storyboards, generate
shots, add audio, and edit and deliver the result. Image and audio generation, project memory, and
quality checks support your production through the official PixVerse CLI.

OpenAI Platform identifies this archive through `.codex-plugin/plugin.json`, using the canonical
`pixverse` / `PixVerse` identity.

## Media Defaults

Images, edits, control assets and realism refinements use **GPT Image 2.5 Sunburst,
2K (`1440p`), high** by default. Videos use **Seedance 2.5, 1080p** with prompt enhancement.
Generate media through PixVerse; use FFmpeg/ffprobe for footage inspection, editing and finishing.
Brand work produces visual images and mockups. Website demos use supplied screen media.

## New In 1.3.2

Version 1.3.2 exposes 38 direct media workflow and utility entries. Select the task you want
directly; Studio handles discovery and planning. The online
CLI installs npm latest, reviewed at 1.4.5.

Canvas now uploads user-supplied local media before writing its provider path into graph nodes or
generation references. The 1.3.1 catalog expansion covers reference remakes, video restyling, ranking videos, podcast clips,
street interviews, talking heads, video variants and video translation.
Captions, boards, inserts and graphics can follow measured spoken-word timing. Variant queues
reuse accepted assets and generate only the parts that change.

Simple image and video requests use a compact execution contract, with advanced guidance loaded
when needed. Queue waiting checks capacity only for ready submissions, and billing reads only
the data needed for reconciliation.

Ordinary image and single-clip generation delivers directly after generation and download,
without automatic QA. Quality inspection remains available on request and in specialized
workflows that explicitly require it.

For reference-based creation, `$pixverse-video-remake` reads a supplied or linked video with
local tools (frames, word-labelled contact sheets, cut candidates, an optional local speech
aligner and an optional `yt-dlp` download), writes timecoded notes, and rebuilds the piece as an
original adaptation. Existing-footage edits use `$pixverse-video-editing`; look changes that keep
the motion use `$pixverse-video-restyle`. No video-understanding API is involved.

## Canvas Since 1.2.0

Version 1.2.0 adds Canvas capabilities: create or continue a visual project, organize references and
storyboards, generate connected media, refine shots, and compose clips with audio. Preview the project
in the Codex in-app Browser and download files when you need them.

## Get Started

Try: **“Turn this product photo into a short video, preserving the product's appearance.”**
For Canvas work, use `$pixverse-canvas` or share an existing Canvas project link and describe what to change.

## Public Skills

Select the existing workflow for the requested result directly. Studio is for discovery and planning.

| Public skill | Purpose |
|---|---|
| `pixverse-create-image` | Generate or edit images, posters, product stills and visual boards |
| `pixverse-create-video` | Generate or transform a video clip from text, images or references |
| `pixverse-audio` | Generate voiceover, narration, music and audio assets |
| `pixverse-product-video` | Create product commercials, brand films and ecommerce launch videos |
| `pixverse-ugc-video` | Create creator-led UGC ads, spoken demos and social hook tests |
| `pixverse-music-video` | Create music videos, lyric visuals, dance and performance clips |
| `pixverse-cinematic-story` | Create a short narrative beat, emotional scene, reveal or fable |
| `pixverse-short-drama` | Create vertical micro-drama, dialogue scenes and cliffhangers |
| `pixverse-game-trailer` | Create game teasers, combat showcases and game-world concepts |
| `pixverse-character-sheet` | Create recurring character, prop and identity reference sheets |
| `pixverse-video-editing` | Cut, assemble, reframe, retime and mix existing footage from any source |
| `pixverse-canvas` | Create or continue Canvas projects, generate connected media and preview cloud results |
| `pixverse-delivery` | Resume projects, recover assets, inspect quality and export deliverables |
| `pixverse-setup` | Resolve setup, login, account and CLI operation problems |
| `pixverse-studio` | Discover a workflow or plan an underspecified creative brief |
| `pixverse-product-stills` | Product photography and still try-on |
| `pixverse-listing-images` | Product detail cards and exact specifications |
| `pixverse-cover-art` | Video thumbnails and covers |
| `pixverse-visual-recipes` | Specific image treatments or short motion effects |
| `pixverse-fashion-video` | Try-on and wearable demonstrations |
| `pixverse-unbox-video` | Package opening and product reveals |
| `pixverse-howto-video` | Step-by-step product operation |
| `pixverse-ad-variants` | Independent variations of a supplied ad |
| `pixverse-explainer` | Complete narrator-led explainers |
| `pixverse-presenter` | Recurring presenter episodes |
| `pixverse-video-script` | Full spoken scripts without media generation |
| `pixverse-voiceover` | Natural narration or fixed-window takes |
| `pixverse-captions` | Captions burned into video |
| `pixverse-motion-design` | Fast music-led motion with measured beats and FFmpeg typography/graphics |
| `pixverse-brand-system` | Generated logo concepts, brand visuals and mockups |
| `pixverse-video-remake` | Rebuild a supplied or linked reference video as your own version |
| `pixverse-video-restyle` | Change the look, world or subject of existing footage while keeping its motion |
| `pixverse-ranking-video` | Tier lists and comparisons with a live board bound to the spoken verdicts |
| `pixverse-podcast-clip` | Two-host conversation clips with complementary views and speaker captions |
| `pixverse-street-interview` | Question-and-answer encounters with timed reveals |
| `pixverse-talking-head` | Speaking takes with locked identity, consistent voice and word timing |
| `pixverse-video-variants` | Many versions of one project, regenerating only what changes |
| `pixverse-video-translate` | The same video in another language with re-flowed captions and graphics |

## Runtime Requirements

PixVerse Agent Plugin `1.3.2` requires Node.js `>=22.12.0` and PixVerse CLI `>=1.4.0`.
The managed runtime installs and refreshes the supported CLI in an isolated plugin runtime and does
not depend on a globally installed `pixverse` command.

Authentication opens the emitted PixVerse authorization URL in the Codex in-app Browser. Plugin and
CLI upgrades preserve existing credentials and browser authorization unless the session has expired
or was revoked.

## Canvas

Explicit Canvas work starts from `pixverse-canvas`; Studio is not a prerequisite. Canvas projects use
cloud preview in the Codex in-app Browser, reuse cloud references between nodes, and download media
only when requested. If browser control is unavailable, the agent provides the Canvas project link.
Credit reports are also available on request. Paid generation follows the existing confirmation
settings, with preflight, bound confirmation plans, shared-edit checks, and duplicate-submission guards.

## More Information

- Website: <https://app.pixverse.ai>
- Privacy policy: <https://pixverse.ai/en/privacy-policy>
- Terms of service: <https://pixverse.ai/en/terms-of-service>
