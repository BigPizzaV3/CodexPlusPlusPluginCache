# PixVerse CLI 1.4.5 Capability Review

Reviewed on 2026-09-22 against npm 1.4.4/1.4.5 tarballs, their README and capability
manifests, and source changes from `2275f40` to `f5c5533`. The 1.4.5 published and
source capability manifests agree. Plugin 1.3.2 keeps the CLI minimum at 1.4.0 and
Node.js at >=22.12.0; the internal artifact baseline is unchanged.

- Capability schema: `1.2.0`; 94 command records.
- Capabilities SHA-256: `20f571777d55aace4bf2d7befc78039e97e9b2fffa7013626ce6c71a712a4d51`.
- npm integrity: `sha512-T8BZXC+WswP9yvu+nwD10V37/6WlSNTGq3iQvMLIn0JsMSfuEjNTqefgcFkSu3SMH7Diy6JSUvQjWN00kF1GTg==`.

## Unchanged Generation Contracts

All Create mode definitions, model parameters and limits are unchanged from 1.4.4.
Use `./pixverse-cli-1.4.4.md` for H3 Max and cumulative image/audio choices, and
`./pixverse-cli-1.4.0.md` for the minimum floor. Sunburst 2K/high and Seedance 2.5
1080p remain plugin defaults. Region options, exit codes, Canvas discovery and
capability adapter bindings are unchanged. Queue polling and paid-work guards remain
in place; this review does not claim live model generation or cloud Canvas testing.

## Canvas Changes

The CLI accepts an optional positional project ID on project-scoped Canvas commands.
The wrapper supports both `canvas graph get <id>` and `canvas graph get --project-id <id>`:
it normalizes the positional alias before region, binding, checkpoint and paid-plan checks.
Conflicting positional/flag IDs stop before any remote request. Existing bindings still work
when the project ID is omitted.

`canvas arrange` saves the entire project's layout without an edit-version precondition.
It follows the existing non-atomic mutation contract: review the current checkpoint, then
use `--allow-non-atomic-canvas-mutation --json` for one pre-read, one mutation and one post-read.
When the user requests arrangement, include this wrapper flag as part of carrying out that
request; do not introduce another user approval step solely for the flag. The response does
not include updated nodes, so readback is required. If no verifiable receipt version is
returned, preserve the successful result and use `canvas sync` to review the latest state;
never retry a successful arrangement to obtain a receipt. Versioned layout patches remain
available through `canvas patch apply`. Older CLI channels may omit the arrange command.

## Download Changes

Downloads publish completed files without overwriting existing files or symlinks.
Audio destinations can be explicit files; a collision requires another output path.
Remote names, extensions and IDs are validated, and temporary upload downloads use
the same non-overwriting publication behavior. A download failure still does not
invalidate generation: recover the free download instead of generating again.

The review compares the public source implementations and fixtures, including download
publication, Canvas argument parsing and command contracts. The npm executable is
obfuscated; its capability manifest matches source, but a readable bundle diff is unavailable.
