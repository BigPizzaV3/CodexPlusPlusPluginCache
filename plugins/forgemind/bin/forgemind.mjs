#!/usr/bin/env node

import { runCli } from '../src/cli.mjs';

const result = await runCli(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});
process.exitCode = result.exitCode;
