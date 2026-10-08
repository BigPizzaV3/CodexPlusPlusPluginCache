# Personal Skills

My collection of reusable AI agent skills.

I keep my skills here so I can use the same workflows across ChatGPT and the CLI agents I work with, without maintaining separate copies for each one.

The `skills/` directory is the source of truth. ChatGPT and my local agents use the same skills.

## Install

### ChatGPT

Install the `louisschprs-skills` plugin.

### CLI

Install the skills with:

```bash
npx skills add louisscheepers/louisschprs-skills

```

## Structure

```text
.
├── .codex-plugin/
│   └── plugin.json
├── assets/
│   └── icon.svg
├── skills/
├── LICENSE
└── README.md

```

Each skill lives in its own directory under `skills/` and follows the Agent Skills [`SKILL.md`](http://SKILL.md) format.

## License

MIT