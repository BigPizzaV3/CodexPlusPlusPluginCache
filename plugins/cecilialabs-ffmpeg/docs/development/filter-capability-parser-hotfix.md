# Milestone 3 hotfix — FFmpeg filter capability parsing

## Symptom

`environment.integration.test.ts` reported a non-empty codec/encoder/decoder catalog but `capabilities.filters.length === 0`.

## Root cause class

The initial implementation was unnecessarily strict about the textual representation and output stream used by `ffmpeg -filters`. Capability listing is a human-oriented FFmpeg interface, so downstream/distro builds and wrappers may differ in flag-column width, terminal escape sequences, or whether informational output is routed through stdout or stderr.

## Fix

- strip ANSI terminal escape sequences before capability parsing;
- accept filter capability flag columns from 3 through 8 characters instead of exactly 3;
- parse capability output from both stdout and stderr;
- retain rejection of legend/header rows;
- add a regression test containing ANSI sequences and an extended flag column.

## Validation on the target machine

Run:

```bash
npm test
```

For low-level inspection if needed:

```bash
ffmpeg -hide_banner -filters | sed -n '1,30p'
```
