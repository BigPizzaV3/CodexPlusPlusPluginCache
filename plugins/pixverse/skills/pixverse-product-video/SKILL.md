---
name: pixverse-product-video
description: "Product ad: create a product-led video with identity locks, purposeful camera work, readable benefits and a final edit."
---

# Product Videos

For “Adapt this ad using my product”, use reference information already obtained by Codex or
provided by the user: the desired mood, pacing, camera choices, shot notes or usable assets.
Codex chooses how to acquire and understand a linked reference with its available tools.
Continue here with an original product brief, storyboard and production plan; no plugin-owned
video analysis is a prerequisite. Use known product facts and distinguish any creative
assumptions from information observed in the reference.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## CLI Execution

Apply `../../skills-shared/quality-policy.md` to all generated images/videos: Sunburst 2K/high,
Seedance 2.5 1080p with automatic prompt enhancement, and an explicit upgrade/fallback
choice for Free/Basic or model-entitlement rejection.

For an explicitly selected Canvas project or node, read
`../../skills-internal/pixverse-agent-canvas/SKILL.md` first and follow its Canvas
preflight and delivery contract; the ordinary queue/local route below does not replace it.

For ordinary creation or editing, read `../../skills-shared/cli-workflow.md` before
executing this workflow. It contains the existing account-aware routing, paid-work
confirmation, progress, preview and project-handoff rules. Studio and Production are
not prerequisites. The shared account, confirmation and direct-medium rules govern the
examples and defaults below. Read the gateway only when writing manual CLI commands or queue specs.
Creation command examples below are queue-task fragments, not permission to submit paid
`pixverse create` commands directly.

Make the product the star. Preserve packaging, silhouette, material, logo placement, and reason to care.

Read:

- `../../skills-shared/prompt-craft.md`
- `../../skills-shared/model-routing.md`
- `../../skills-shared/capability-priority.md`
- `../../skills-shared/cinematography.md`

## Fast Path

1. Create or read project memory.
2. Classify reference: product identity, brand style, or mood only.
3. Choose one clear direction when the brief is concrete. If direction is open, propose short textual options; generate only requested/approved candidates. Add a control image only when product accuracy or continuity needs it. For effect direction, see `../pixverse-visual-recipes/SKILL.md`.
4. Render the requested duration and count through the account-compatible route. Multi-shot work uses accepted product references and individual shot boards. Standalone still deliverables use `../pixverse-product-stills/SKILL.md`.
5. QA for product fidelity, crop, logo/text drift, and useful motion.

Use `seedance-2.5` at 1080p for both preview and final shots. Apply `../../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` before preflight; preserve the workflow-specific creative controls.

If a premium image-model comparison is requested, compare GPT Image 2.5 Sunburst High and Nano Banana Pro
(`gemini-3.0`) on the same brief. Include both tasks in preflight; comparison is optional.

## Creative Variants

- **Quiet luxury:** macro material, warm side light, slow gestures, minimal copy.
- **Demo clarity:** hand/use-case, before-after, benefit made visible.
- **Thumb-stopper:** odd scale, surreal environment, striking first frame.
- **Brand film:** human emotion around product, less literal demo.
- **Launch teaser:** abstract reveal, final locked packshot.

## Prompt Anchors

Always include:

- product category and exact visual identity
- material and scale
- what must not change
- camera rhythm
- lighting
- final beat

For text/logo, prefer a locked still image plate. Video models are weak at precise readable text.

## Queue Shape

Image board:

```bash
pixverse create image --model gpt-image-2.5-sunburst --quality 1440p --detail-level high --aspect-ratio 9:16 --prompt "..."
```

Video:

```bash
pixverse create reference --model seedance-2.5 --quality 1080p --duration 15 --aspect-ratio 9:16 --images {{board.path}} --prompt "..."
```

Use `pvx queue` for board-to-video chains.

## Make It Yours

If the user says "cool" or "not generic", do not just add neon. Change the creative mechanism: unusual reveal, product-as-environment, tactile macro detail, social-native imperfection, or a symbolic human moment.

## Quality Checks

- product still recognizable
- logo/label not hallucinated beyond tolerance
- no fake UI or fake claims
- first frame works as thumbnail
- final frame can act as product packshot
