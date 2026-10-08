# Milestone 1 — Repository & TypeScript Foundation

## Status

Implemented for `v0.1.0-alpha.1`.

## Repository foundation

```text
ffmpeg-media-toolkit/
├── plugin.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.js
├── .prettierrc.json
├── README.md
├── LICENSE
├── src/
│   ├── cli.ts
│   ├── index.ts
│   ├── version.ts
│   ├── cli/
│   └── types/
├── test/
│   └── cli/
├── skills/
├── assets/
├── docs/
├── specs/
└── legacy/
```

## CLI architecture

The CLI is built with Commander and the frozen Milestone 0 command grammar is represented as data in `src/cli/command-spec.ts`.

`register-command-tree.ts` recursively converts this specification into Commander commands. This keeps CLI plumbing stable when later milestones add implementations.

Milestone 1 deliberately registers leaf commands as **non-FFmpeg placeholders**. Running a leaf returns `E_OPERATION_UNSUPPORTED` with exit code `5` and identifies its implementation milestone. This ensures:

1. `--help` can be tested without invoking FFmpeg;
2. the public command grammar is visible early;
3. future milestones replace domain behavior without rewriting the root CLI;
4. accidental execution cannot silently perform media mutations.

## TypeScript policy

The project uses:

- Node.js ESM (`type: module`);
- `module` / `moduleResolution`: `NodeNext`;
- TypeScript strict mode;
- `noUncheckedIndexedAccess`;
- `exactOptionalPropertyTypes`;
- isolated modules;
- declaration generation for the production build.

## Toolchain

Runtime dependencies:

- `commander` — CLI grammar and parsing;
- `execa` — provisionally selected in Milestone 1; superseded by ADR 0002 in Milestone 2;
- `zod` — runtime validation.

Development dependencies:

- TypeScript;
- `tsx`;
- Vitest;
- ESLint + typescript-eslint;
- Prettier;
- Node.js type definitions.

## Build model

Development:

```bash
npm install
npm run dev -- --help
# equivalent to:
cecilia-ffmpeg --help
```

Production:

```bash
npm run build
cecilia-ffmpeg --help
```

Published package:

```bash
cecilia-ffmpeg --help
```

The npm `bin` entry maps `cecilia-ffmpeg` to `dist/cli.js`.

## Validation model

`npm run validate` performs:

```text
TypeScript check
→ ESLint
→ Vitest
→ production build
```

The execution environment used to assemble Milestone 1 has no DNS access to the npm registry, so external dependencies could not be installed in-place. The package sources were syntax-validated independently and the dependency-backed validation commands are ready to run after `npm install` in a network-enabled environment.

## Dependency-free foundation verification

Before installing npm dependencies, repository invariants can be checked with:

```bash
npm run verify:foundation
# or directly:
node scripts/verify-foundation.mjs
```

This verifies identity/version alignment, required files, strict TypeScript configuration, global CLI flags, and the Milestone 1 prohibition on direct process execution.
