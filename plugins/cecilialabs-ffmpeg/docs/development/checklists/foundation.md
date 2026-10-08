# Milestone 1 — Completion Checklist

**Target:** `v0.1.0-alpha.1`  
**Status:** ✅ Implemented

> **Historical note:** Milestone 1 provisionally selected Execa. Milestone 2 superseded that decision with the audited native `spawn` boundary documented in ADR 0002.

| Requirement | Status | Evidence |
|---|---:|---|
| Repository foundation | ✅ | root package structure |
| Configure TypeScript strict mode | ✅ | `tsconfig.json` |
| Configure ESM | ✅ | `package.json`, `tsconfig.json` |
| Configure `tsx` for development | ✅ | `package.json` scripts/devDependency |
| Configure production build | ✅ | `tsconfig.build.json`, `npm run build` |
| Configure npm `bin` | ✅ | `package.json` → `cecilia-ffmpeg` |
| Add Commander CLI | ✅ | `src/cli/program.ts` |
| Select a process-runner strategy | ✅ | Execa was selected provisionally here; ADR 0002 supersedes it with native `spawn` in Milestone 2 |
| Add Zod validation | ✅ | `src/cli/global-options.ts` + pre-action validation |
| Add Vitest | ✅ | `vitest.config.ts`, `test/cli/*` |
| Add formatting/linting | ✅ | ESLint flat config + Prettier config |
| Implement `--output` | ✅ | `src/cli/program.ts` |
| Implement `--overwrite` | ✅ | `src/cli/program.ts` |
| Implement `--dry-run` | ✅ | `src/cli/program.ts` |
| Implement `--json` | ✅ | `src/cli/program.ts` |
| Implement `--quiet` | ✅ | `src/cli/program.ts` |
| Implement `--verbose` | ✅ | `src/cli/program.ts` |
| Implement `--ffmpeg-path` | ✅ | `src/cli/program.ts` |
| Implement `--ffprobe-path` | ✅ | `src/cli/program.ts` |
| Preserve Milestone 0 `--keep-temp` | ✅ | `src/cli/program.ts` |
| Expose frozen command grammar | ✅ | `src/cli/command-spec.ts` |
| No FFmpeg invocation in Milestone 1 CLI help | ✅ | no process runtime exists in `src/`; smoke tests inspect help only |
| Plugin portable manifest | ✅ | `plugin.json` |
| Concrete project license | ✅ | `LICENSE`, ADR 0001 |

## Acceptance criterion

Required target:

```bash
npm run cli -- --help
```

The implementation is wired for this command and does not import or execute FFmpeg/FFprobe. In the assembly environment, npm dependencies could not be fetched because outbound DNS for `registry.npmjs.org` is unavailable. Therefore the exact dependency-backed command could not be executed here.

### Validation completed in the assembly environment

- JSON files parsed successfully.
- JavaScript configuration passed `node --check`.
- All TypeScript source and test files passed TypeScript parser/transpile diagnostics using the installed TypeScript compiler.
- No `child_process`, `spawn`, `exec`, or `ffmpeg` execution implementation exists in `src/`.

### Final local verification after download

```bash
npm install
npm run validate
npm run cli -- --help
```

## Gate to Milestone 2

Milestone 2 may implement binary discovery, FFmpeg/FFprobe execution, cancellation, structured execution results, and dry-run rendering through the shared runtime. Domain commands must continue to avoid direct process execution.
