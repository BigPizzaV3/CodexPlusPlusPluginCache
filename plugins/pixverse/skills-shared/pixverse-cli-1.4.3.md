# PixVerse CLI 1.4.3 npm Review

Historical review; the current reviewed release is in `./pixverse-cli-1.4.5.md`.

Reviewed on 2026-09-15 against the installed npm package and its bundled
`dist/capabilities.json`. Online bootstrap installs `pixverse@latest`; `1.4.3` is the
reviewed release, while `1.4.0` remains the shared compatibility floor. Plugin version
is `1.3.0`. The internal CLI artifact baseline is unchanged.

## Published Identity

- Package: [pixverse 1.4.3](https://www.npmjs.com/package/pixverse/v/1.4.3)
- Node.js: `>=22.12.0`
- Capabilities schema: `1.2.0`; 93 commands
- Capabilities SHA-256: `4981d138978e818fc19505ddd3a86fa434bf5e1ddba9e42c298c878f0f90da53`
- npm integrity: `sha512-P0Z4Um0cdqXcd+Jd0YgFeawujdA4c3eJMNbxdjpDtX/LSJ6Dbwil/6h2HvQktW8M9TYLumat3xvJabG4HKp6jA==`

## Delta From 1.4.0

The normalized capability comparison changes only CLI version metadata, the image
Create domain/model catalog, and the `create image` detail-level help text. Command
names, other Create modes, Canvas discovery, bindings, global options, exit codes and
transport contract remain identical to the reviewed 1.4.0 snapshot.

| Image capability | 1.4.3 |
|---|---|
| CLI default image model | `gpt-image-2.5-flare` |
| Added model ids | `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` |
| Added models' detail levels | `low`, `medium`, `high`, `xhigh`, `max`; default `low` |
| Added models' reference limit | 16 images |
| Added models' quality | `1080p`, `1440p`, `2160p` |
| Image model aspect defaults | `16:9` instead of `1:1` |

Plugin creative defaults now explicitly select `gpt-image-2.5-sunburst`, 2K (`1440p`),
`--detail-level high`, and Seedance 2.5 1080p for video. See `./quality-policy.md`.
These override the provider defaults when authoring new work; existing explicit choices
and saved paid queues remain unchanged. The CLI capability history above remains factual.
The expanded detail levels are model-specific: GPT Image 2.0 still accepts only
`low`, `medium`, `high`.

Before writing an unfamiliar model/parameter combination, inspect the active
offline contract through `"${PVX}" pixverse capabilities create image --model <id> --json`.
Do not infer that an account has access to a model merely because it appears in the
CLI catalog. Account routing and paid confirmation still apply.

This review covers the published capability contract and offline compatibility
checks. It does not claim a paid generation test of the added image models.
