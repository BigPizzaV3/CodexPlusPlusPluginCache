#!/usr/bin/env node

import {constants as fsConstants} from 'node:fs';
import {access, chmod, lstat, mkdir, open, readFile, rename, stat, unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const OFFICIAL_BASE_URL = 'https://api.cloud.llamaindex.ai';
const MAX_PDF_BYTES = 250 * 1024 * 1024;
const DEFAULT_EXPANDS = ['text', 'markdown', 'items', 'images_content_metadata'];
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const ALLOWED_TIERS = new Set(['agentic', 'agentic_plus', 'cost_effective', 'fast']);

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: llamaparse.mjs <input.pdf> --out <private-result.json> [--tier <tier>] [--poll-ms <milliseconds>] [--timeout-seconds <seconds>]');
  process.exitCode = 2;
}

function parseInteger(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    input: null,
    out: null,
    tier: 'agentic',
    pollMs: 2000,
    timeoutSeconds: 1800,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') options.out = argv[++index];
    else if (arg === '--tier') options.tier = argv[++index];
    else if (arg === '--poll-ms') options.pollMs = parseInteger(argv[++index], '--poll-ms', 250, 60000);
    else if (arg === '--timeout-seconds') options.timeoutSeconds = parseInteger(argv[++index], '--timeout-seconds', 10, 7200);
    else if (arg === '--api-key' || arg.startsWith('--api-key=')) {
      throw new Error('API keys are accepted only through LLAMA_CLOUD_API_KEY; command-line keys are forbidden');
    } else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    else if (!options.input) options.input = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }

  if (!options.input || !options.out) throw new Error('both <input.pdf> and --out are required');
  if (!ALLOWED_TIERS.has(options.tier)) throw new Error(`unsupported tier: ${options.tier}`);
  return options;
}

function baseUrl() {
  if (process.env.NODE_ENV === 'test' && process.env.PDF_PARSER_TEST_BASE_URL) {
    return process.env.PDF_PARSER_TEST_BASE_URL.replace(/\/$/, '');
  }
  return OFFICIAL_BASE_URL;
}

function redact(value, secret) {
  let text = String(value ?? '');
  if (secret) text = text.split(secret).join('[REDACTED]');
  return text.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]').slice(0, 1000);
}

async function readJsonResponse(response) {
  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`LlamaParse returned non-JSON HTTP ${response.status}; response body withheld`);
  }
  if (!response.ok) {
    throw new Error(`LlamaParse HTTP ${response.status}; response body withheld`);
  }
  return {json, raw};
}

async function requestJson(url, apiKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(300000),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers ?? {}),
    },
  });
  return readJsonResponse(response);
}

async function validateInput(inputPath) {
  const absolute = path.resolve(inputPath);
  const details = await stat(absolute);
  if (!details.isFile()) throw new Error('input must be a regular file');
  if (details.size === 0 || details.size > MAX_PDF_BYTES) {
    throw new Error(`input PDF must be between 1 byte and ${MAX_PDF_BYTES} bytes`);
  }
  const handle = await open(absolute, 'r');
  try {
    const header = Buffer.alloc(5);
    const {bytesRead} = await handle.read(header, 0, 5, 0);
    if (bytesRead !== 5 || header.toString('ascii') !== '%PDF-') throw new Error('input is not a PDF by file signature');
  } finally {
    await handle.close();
  }
  return {absolute, details};
}

async function validateOutput(outputPath, inputPath) {
  const absolute = path.resolve(outputPath);
  if (absolute === inputPath) throw new Error('output must not overwrite the source PDF');
  try {
    const details = await lstat(absolute);
    if (details.isSymbolicLink()) throw new Error('output path must not be a symbolic link');
    throw new Error('output already exists; choose a new path so prior parse evidence is preserved');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(path.dirname(absolute), {recursive: true, mode: 0o700});
  await access(path.dirname(absolute), fsConstants.W_OK);
  return absolute;
}

async function writePrivateAtomic(outputPath, raw) {
  const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  const handle = await open(tempPath, 'wx', 0o600);
  try {
    await handle.writeFile(raw, 'utf8');
  } finally {
    await handle.close();
  }
  try {
    await rename(tempPath, outputPath);
    await chmod(outputPath, 0o600);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function run(argv) {
  const options = parseArgs(argv);
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('LLAMA_CLOUD_API_KEY is required and must belong to the person running this command');
  }

  const input = await validateInput(options.input);
  const output = await validateOutput(options.out, input.absolute);
  const bytes = await readFile(input.absolute);
  const form = new FormData();
  form.append('purpose', 'parse');
  form.append('file', new Blob([bytes], {type: 'application/pdf'}), path.basename(input.absolute));

  const root = baseUrl();
  const upload = await requestJson(`${root}/api/v1/beta/files`, apiKey, {
    method: 'POST',
    body: form,
  });
  if (!upload.json.id || typeof upload.json.id !== 'string') throw new Error('upload response did not include a file id');

  const created = await requestJson(`${root}/api/v2/parse`, apiKey, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({file_id: upload.json.id, tier: options.tier, version: 'latest'}),
  });
  if (!created.json.id || typeof created.json.id !== 'string') throw new Error('parse response did not include a job id');

  const resultUrl = new URL(`${root}/api/v2/parse/${encodeURIComponent(created.json.id)}`);
  for (const expand of DEFAULT_EXPANDS) resultUrl.searchParams.append('expand', expand);
  const deadline = Date.now() + options.timeoutSeconds * 1000;

  while (Date.now() <= deadline) {
    const result = await requestJson(resultUrl, apiKey);
    const status = result.json?.job?.status;
    if (!status || typeof status !== 'string') throw new Error('parse result did not include job.status');
    if (TERMINAL_STATUSES.has(status)) {
      if (status !== 'COMPLETED') throw new Error(`parse job ended with status ${status}`);
      await writePrivateAtomic(output, result.raw);
      console.log(`Parse complete. Private raw JSON written to ${output}`);
      return;
    }
    await sleep(options.pollMs);
  }
  throw new Error(`parse job exceeded ${options.timeoutSeconds} seconds`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  run(process.argv.slice(2)).catch(error => {
    console.error(`Error: ${redact(error.message, process.env.LLAMA_CLOUD_API_KEY)}`);
    process.exitCode = process.exitCode || 1;
  });
}

export {parseArgs, redact, run};
