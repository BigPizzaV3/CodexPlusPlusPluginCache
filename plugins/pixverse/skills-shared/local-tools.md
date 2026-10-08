# Local Tools

The plugin requires FFmpeg/ffprobe, Node.js and the managed PixVerse CLI (`setup status`).
Two optional local tools extend reference and timing work; the plugin detects them and never
installs them on its own.

Graphics rendering, labelled frames and contact sheets also use Pillow. `bootstrap --yes`
automatically installs it when missing, and these rendering commands perform the same
repair on first use. The install uses the selected Python interpreter and a private
`runtime/python/<interpreter-platform>/site-packages` directory under the plugin data home;
it does not modify system Python packages. Existing usable Pillow installations are reused.
Core CLI commands and setup remain usable before Pillow is installed. A pip/network failure
returns an actionable error; retry bootstrap after resolving it.

| Tool | Used by | Detect | Install (user choice) |
|---|---|---|---|
| `whisper` (openai-whisper) or `whisperx` | `media transcribe`, `timeline build` | `which whisper whisperx` | `pip install openai-whisper` (needs PyTorch; first run downloads the model, ~500 MB for `small`) or `pip install whisperx` |
| `yt-dlp` | `media fetch` | `which yt-dlp` | `pip install yt-dlp` or `brew install yt-dlp` |

Explain the download size and time before the user installs anything. On a machine without a
speech aligner, ask for a word-timing JSON from another tool, fall back to fixed-window TTS
takes, or deliver phrase captions clearly labelled as unmeasured (`./word-timing.md`).

## Fonts

Caption and graphics rendering use system fonts: Arial Black/Impact/Helvetica on macOS and
Windows, DejaVu on Linux, and PingFang / Hiragino / Noto Sans CJK / Microsoft YaHei for
Chinese, Japanese and Korean. Emoji use Apple Color Emoji, Noto Color Emoji or Segoe UI Emoji.
On Linux install `fonts-noto-cjk` and `fonts-noto-color-emoji` for full coverage. Inspect a
rendered frame with mixed text before delivering.

## Where files go

Generated media stays under `projects/<slug>/assets/`; reference material under
`projects/<slug>/reference/`; word timings, timelines, plans and graphics under the project as
well, so a resumed session can rebuild the composition without regenerating anything.
