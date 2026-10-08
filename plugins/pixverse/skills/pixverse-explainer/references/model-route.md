# Faceless Video Model Route

| Layer | Default | Command shape |
| --- | --- | --- |
| Style key, cast, stages, props | Sunburst 2K/high | `pixverse create image --model gpt-image-2.5-sunburst --quality 1440p --detail-level high --aspect-ratio <ar> [--images <style-key> …] --prompt <file>` |
| Animated blocks | Seedance 2.5, 1080p, 10s | `pixverse create reference --model seedance-2.5 --quality 1080p --duration 10 --aspect-ratio <16:9 or 9:16> --images <stage> <cast…> <props…> --prompt <file>` |
| Narration | speech-2.8-hd, one locked voice, speed 0.95–1.05 | `pixverse create voice --model speech-2.8-hd --voice-id <id> --language <code> --speed 1.0 --text <file>` |

"Sunburst 2K/high" means `--quality 1440p --detail-level high`; its aspect ratios are
1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 2:1, 1:2 and 21:9. These follow the shared defaults
in `../../../skills-shared/quality-policy.md`; its membership, balance and confirmation gates apply unchanged. An explicit user model
choice wins. Recheck `"${PVX}" pixverse capabilities create <mode> --model <id> --json`
when a parameter is not already established in this task.

Compose the queue with explicit `queue write` / `queue append` commands so every block
carries its own references and prompt file; pass earlier PixVerse outputs by provider
`path` (`{{style-key.path}}`). The filled block template is already the finished
Seedance prompt — keep its shot grid, timings and wording through prompt enhancement.

Budget before spending: a 10s Seedance 2.5 1080p block has cost about 1,190 credits,
an image about 25, a narration take about 3 (observed 2026-09-17). A 30s film is roughly
3,600 credits plus images; check the balance covers every block and one retry, and tell
the user plainly when it does not rather than starting a film that cannot finish.

## Gemini Omni Flash (on request)

`gemini-omni-flash` works with the same block template: `create reference`, 720p only
in the observed contract, explicit 3–10s duration, `16:9` or `9:16`, at most 5 images
and 1 video, no `--audio`, `--no-audio`, `--task-type` or `--off-peak` flags. Compact
the block's references into five images during planning. Report 720p as 720p.

## Audio

Blocks ask for diegetic foley only. Narration is generated separately and mixed in the
edit; inspect each clip's own audio and drop any stray speech or music before mixing.

## Comparing workflows

For a same-provider skill comparison hold video model, resolution, duration, aspect,
image model and voice constant and let each workflow author its own script and prompts.
Keep installed skill text, public showcase films and actual generation receipts
distinct when describing what was tested.
