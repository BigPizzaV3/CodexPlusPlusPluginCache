#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inflateSync} from 'node:zlib';

function usage(message) {
  if (message) console.error(`Error: ${message}`);
  console.error('Usage: audit-deliverables.mjs <deliverable-folder> --expected <positive-integer> [--json <report-path>] [--language <en|any>] [--strict-ui] [--allow-active-content]');
  process.exit(2);
}

const argv = process.argv.slice(2);
let rootArg = null;
let expected = null;
let outPath = null;
let language = 'en';
let strictUi = false;
let allowActiveContent = false;
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--expected') {
    const value = argv[++i];
    if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 10_000) usage('--expected must be an integer from 1 to 10000');
    expected = Number(value);
  } else if (arg === '--json') {
    const value = argv[++i];
    if (!value) usage('--json requires a path');
    outPath = path.resolve(value);
  } else if (arg === '--language') {
    const value = argv[++i];
    if (!['en', 'any'].includes(value)) usage('--language must be en or any');
    language = value;
  } else if (arg === '--strict-ui') {
    strictUi = true;
  } else if (arg === '--allow-active-content') {
    allowActiveContent = true;
  } else if (arg === '--help') {
    usage();
  } else if (arg.startsWith('-')) {
    usage(`unknown option ${arg}`);
  } else if (rootArg === null) {
    rootArg = arg;
  } else {
    usage(`unexpected argument ${arg}`);
  }
}
if (expected === null) usage('--expected is required so an empty directory cannot pass');
const root = path.resolve(rootArg || '.');
function isWithin(base, target) { const relative = path.relative(base, target); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); }
function outputInsideInput(base, target) {
  if (isWithin(base, target)) return true;
  try { return isWithin(fs.realpathSync(base), path.join(fs.realpathSync(path.dirname(target)), path.basename(target))); }
  catch { return false; }
}
if (outPath && outputInsideInput(root, outPath)) usage('--json must be outside the audited root');
if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) usage('deliverable folder does not exist or is not a directory');

const MAX_TEXT_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_WALK_ENTRIES = 5000;
const MAX_DELIVERABLE_FILES = 1000;
const MAX_TOTAL_QUESTION_SECTIONS = 20_000;
const MAX_TOKENS_PER_QUESTION = 20_000;
const MAX_TOTAL_TOKENS = 2_000_000;
const MAX_PNG_CHUNKS = 10_000;
const MAX_PNG_IDAT_CHUNKS = 4_096;
const MAX_RESPONSE_CANDIDATES = 64;
const MAX_ISSUES = 10_000;
const MAX_AGGREGATE_TEXT_BYTES = 256 * 1024 * 1024;
const MAX_AGGREGATE_ASSET_BYTES = 256 * 1024 * 1024;
const MAX_AGGREGATE_EMBEDDED_BYTES = 256 * 1024 * 1024;
const MAX_DECODED_IMAGE_BYTES = 128 * 1024 * 1024;
const MAX_AGGREGATE_DECODED_BYTES = 512 * 1024 * 1024;
const MAX_AGGREGATE_PIXELS = 200_000_000;
const MAX_IMAGE_PIXELS = 100_000_000;
const MAX_QUESTION_SECTIONS = Math.min(10_000, Math.max(1000, expected * 2));
const MAX_IMAGE_REFERENCES_PER_FORMAT = Math.max(1000, expected * 4);
const assetCache = new Map();
let aggregateTextBytes = 0;
let aggregateAssetBytes = 0;
let aggregateEmbeddedBytes = 0;
let aggregateDecodedBytes = 0;
let aggregatePixels = 0;
let resourceBudgetExhausted = false;
let totalMarkdownImageRefs = 0;
let totalHtmlImageRefs = 0;
let totalQuestionSections = 0;
let totalQuestionTokens = 0;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const toPosix = value => value.split(path.sep).join('/');
const stripMdCode = text => text
  .replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```\s*$/gm, '')
  .replace(/^\s*~~~[^\n]*\n[\s\S]*?^\s*~~~\s*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');
const stripHtmlInactive = text => text
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(script|style|template|noscript|title)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
const uiRe = /student-produced response questions|Mark for Review|Question \d+ of \d+|Answer Preview|Hide Reference|^\s*Hi\s*$|^## Directions\s*$|<h2\b[^>]*>\s*Directions\s*<\/h2>|<p\b[^>]*>\s*Hi\s*<\/p>|<p\b[^>]*>\s*\d+:\s*<\/p>/gmi;
const cjkRe = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const exhibitRe = /(?:graph|scatterplot|histogram|table|figure|chart|diagram|shaded region)\s+(?:shows|shown|indicates|displays|below|above|represents|illustrates)|(?:according to|based on|in|from)\s+the\s+(?:graph|table|chart|diagram|figure|scatterplot|histogram)(?:\s+(?:above|below))?/i;

const auditDiscoveryErrors = [];
function walk(directory, state = {entries: 0}) {
  const found = [];
  const handle = fs.opendirSync(directory);
  try {
    let entry;
    while ((entry = handle.readSync()) !== null) {
      state.entries += 1;
      if (state.entries > MAX_WALK_ENTRIES) throw new Error('walk entry limit exceeded');
      const full = path.join(directory, entry.name);
      const relative = toPosix(path.relative(root, full));
      if (entry.name.startsWith('.')) { auditDiscoveryErrors.push({severity: 'error', code: 'HIDDEN_ENTRY_PRESENT', file: relative}); continue; }
      if (entry.isSymbolicLink()) { auditDiscoveryErrors.push({severity: 'error', code: 'SYMLINK_ENTRY_PRESENT', file: relative}); continue; }
      if (entry.isDirectory()) found.push(...walk(full, state));
      else if (entry.isFile()) found.push(full);
    }
  } finally { handle.closeSync(); }
  return found;
}

function readStableFile(file, maxBytes) {
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const handle = fs.openSync(file, flags);
  try {
    const before = fs.fstatSync(handle);
    if (!before.isFile()) throw new Error('not_regular_file');
    if (before.size > maxBytes) throw new Error('file_too_large');
    const bytes = Buffer.allocUnsafe(before.size);
    let offset = 0;
    while (offset < before.size) {
      const count = fs.readSync(handle, bytes, offset, before.size - offset, offset);
      if (count < 1) throw new Error('unexpected_eof');
      offset += count;
    }
    const after = fs.fstatSync(handle);
    const current = fs.lstatSync(file);
    if (current.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || current.dev !== after.dev || current.ino !== after.ino || current.size !== after.size || current.mtimeMs !== after.mtimeMs) throw new Error('file_changed_during_read');
    return {bytes, stat: after};
  } finally { fs.closeSync(handle); }
}

function mdSections(text) {
  const clean = stripMdCode(text);
  const re = /^(?:###\s+(?:Question\s+)?(\d+)\.?|\*\*(\d+)\.\*\*|(\d+)\.)\s*$/gmi;
  const matches = [];
  let match;
  while ((match = re.exec(clean)) !== null) {
    if (matches.length >= MAX_QUESTION_SECTIONS) { const out = []; out.overflow = true; return out; }
    matches.push({index: match.index, number: Number(match[1] || match[2] || match[3])});
  }
  const out = matches.map((item, index) => ({ordinal: index + 1, number: item.number, text: clean.slice(item.index, index + 1 < matches.length ? matches[index + 1].index : clean.length)}));
  out.overflow = false;
  return out;
}

function htmlSections(text) {
  const clean = stripHtmlInactive(text);
  const re = /<h4\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\bqno\b[^"']*\1)[^>]*>([\s\S]*?)<\/h4>/gi;
  const matches = [];
  let match;
  while ((match = re.exec(clean)) !== null) {
    if (matches.length >= MAX_QUESTION_SECTIONS) { const out = []; out.overflow = true; return out; }
    matches.push({index: match.index, number: Number(match[2].replace(/<[^>]*>/g, '').match(/\d+/)?.[0] || 0)});
  }
  const out = matches.map((item, index) => ({ordinal: index + 1, number: item.number, text: clean.slice(item.index, index + 1 < matches.length ? matches[index + 1].index : clean.length)}));
  out.overflow = false;
  return out;
}

function mdImageRefs(text, limit = MAX_IMAGE_REFERENCES_PER_FORMAT) {
  const clean = stripMdCode(text);
  const refs = [];
  const inline = /!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)/g;
  let match;
  while ((match = inline.exec(clean)) !== null) {
    if (refs.length >= limit) return {refs: [], unsupported: 0, overflow: true};
    refs.push(match[1] || match[2]);
  }
  let unsupported = 0;
  const reference = /!\[[^\]]*\]\[[^\]]*\]/g;
  while (reference.exec(clean) !== null) {
    unsupported += 1;
    if (unsupported > limit) return {refs: [], unsupported, overflow: true};
  }
  return {refs, unsupported, overflow: false};
}

function htmlImageSources(text, limit = MAX_IMAGE_REFERENCES_PER_FORMAT) {
  const clean = stripHtmlInactive(text);
  const sources = [];
  const tagRe = /<img\b[^>]*>/gi;
  let match;
  while ((match = tagRe.exec(clean)) !== null) {
    if (sources.length >= limit) { sources.overflow = true; return sources; }
    const src = match[0].match(/(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    sources.push(src ? (src[1] ?? src[2] ?? src[3]) : null);
  }
  sources.overflow = false;
  return sources;
}

function decodeHtmlEntities(text) {
  const named = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
  return text
    .replace(/&#(?:x([0-9a-f]{1,6})|(\d{1,7}));?/gi, (match, hex, decimal) => {
      const value = hex ? Number.parseInt(hex, 16) : Number.parseInt(decimal, 10);
      return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp|colon|sol|equals);?/gi, (match, entity) => ({...named, colon: ':', sol: '/', equals: '='})[entity.toLowerCase()] ?? match);
}

function visibleHtml(text) {
  return decodeHtmlEntities(stripHtmlInactive(text).replace(/<[^>]*>/g, ' '));
}

function answerValue(text, format) {
  let raw;
  if (format === 'html') {
    const answerElement = /<([a-z][a-z0-9]*)\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\banswer\b[^"']*\2)[^>]*>([\s\S]*?)<\/\1>/i.exec(text);
    if (!answerElement) return null;
    const match = /\bAnswer[ \t]*:[ \t]*([^<\n]+)/i.exec(answerElement[3]);
    if (!match) return null;
    raw = decodeHtmlEntities(match[1]);
  } else {
    const answerLine = /^\s*(?:>\s*)?\*\*Answer(?:\s*:|:\*\*)[^\n]*$/mi.exec(stripMdCode(text));
    if (!answerLine) return null;
    const match = /\bAnswer[ \t]*:[ \t]*(.*)$/i.exec(answerLine[0].replace(/[*_`]/g, ' '));
    if (!match) return null;
    raw = match[1];
  }
  const normalized = raw.normalize('NFKC').replace(/^[([{]+|[\])}.:]+$/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!normalized) return null;
  const choice = /^([A-D])$/.exec(normalized);
  return choice ? choice[1] : normalized;
}

function countMatchesUpTo(text, re, limit) {
  re.lastIndex = 0;
  let count = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    count += 1;
    if (count > limit) return count;
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return count;
}
function responseCandidateOverflow(text, format) {
  const re = format === 'html'
    ? /<(?:p|li)\b[^>]*>\s*(?:[-*+]\s*)?(?:\([A-D]\)|[A-D][.)]|[A-D])(?:\s|<)/gi
    : /^\s*(?:[-*+]\s*)?(?:\([A-D]\)|[A-D][.)]|[A-D])(?:\s|$)/gmi;
  return countMatchesUpTo(text, re, MAX_RESPONSE_CANDIDATES) > MAX_RESPONSE_CANDIDATES;
}

function responseChoices(text, format) {
  let lines;
  let structuredChoiceContainers = 0;
  const choices = [];
  if (format === 'html') {
    const beforeAnswer = text.split(/<[a-z][a-z0-9]*\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\banswer\b[^"']*\1)/i)[0];
    structuredChoiceContainers = (beforeAnswer.match(/<table\b/gi) || []).length;
    for (const row of beforeAnswer.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => visibleHtml(match[1]));
      const label = /^\(?([A-D])\)?$/i.exec(cells[0] || '');
      if (label && cells[1]) choices.push({label: label[1].toUpperCase(), text: cells[1], explicit: true});
    }
    lines = [...beforeAnswer.matchAll(/<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)].map(match => visibleHtml(match[1]));
  } else {
    const beforeAnswer = stripMdCode(text).split(/^\s*(?:>\s*)?\*\*Answer(?:\s*:|:\*\*)/mi)[0];
    structuredChoiceContainers = (beforeAnswer.match(/^\s*\|\s*:?-+/gm) || []).length + (beforeAnswer.match(/<table\b/gi) || []).length;
    lines = beforeAnswer.split(/\r?\n/).map(line => line.replace(/[*_`]/g, ' '));
    for (const row of beforeAnswer.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => visibleHtml(match[1]));
      const label = /^\(?([A-D])\)?$/i.exec(cells[0] || '');
      if (label && cells[1]) choices.push({label: label[1].toUpperCase(), text: cells[1], explicit: true});
    }
    for (const line of lines) {
      const table = /^\s*\|\s*\(?([A-D])\)?\s*\|\s*(.*?)\s*\|\s*$/i.exec(line);
      if (table) choices.push({label: table[1].toUpperCase(), text: table[2], explicit: true});
    }
  }
  for (const line of lines) {
    const match = /^\s*(?:[-*+]\s*)?(?:\(([A-D])\)|([A-D])[.)]|([A-D]))(?:\s+(.*?))?\s*$/i.exec(line);
    if (!match) continue;
    choices.push({label: (match[1] || match[2] || match[3]).toUpperCase(), text: match[4] || '', explicit: Boolean(match[1] || match[2])});
  }
  for (let i = 0; i + 3 < choices.length; i += 1) {
    const run = choices.slice(i, i + 4);
    if (run.map(choice => choice.label).join('') === 'ABCD') {
      if (structuredChoiceContainers >= 4) for (const choice of run) if (!choice.text) choice.text = '[structured table choice]';
      return run;
    }
  }
  return choices.filter(choice => choice.explicit);
}

function contentTokens(text, format) {
  let value;
  if (format === 'html') {
    value = stripHtmlInactive(text)
      .replace(/<([a-z][a-z0-9]*)\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\banswer\b[^"']*\2)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<h4\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\bqno\b[^"']*\1)[^>]*>[\s\S]*?<\/h4>/gi, ' ');
    value = visibleHtml(value);
  } else {
    value = stripMdCode(text)
      .replace(/^\s*(?:>\s*)?\*\*Answer(?:\s*:|:\*\*)[\s\S]*$/gmi, ' ')
      .replace(/!\[[^\]]*\]\((?:<[^>]+>|[^)]+)\)/g, ' ')
      .replace(/^(?:###\s+(?:Question\s+)?\d+\.?|\*\*\d+\.\*\*|\d+\.)\s*$/gmi, ' ')
      .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, ' ')
      .replace(/[|#>*_`~]/g, ' ');
    value = decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '));
  }
  const normalized = value.normalize('NFKC').toLowerCase();
  const tokens = [];
  const tokenRe = /[a-z0-9]+/g;
  let match;
  while ((match = tokenRe.exec(normalized)) !== null) {
    if (tokens.length >= MAX_TOKENS_PER_QUESTION) { tokens.overflow = true; return tokens; }
    tokens.push(match[0]);
  }
  tokens.overflow = false;
  return tokens;
}

function tokenDice(left, right) {
  if (left.length === 0 || right.length === 0) return left.length === right.length ? 1 : 0;
  const counts = new Map();
  for (const token of left) counts.set(token, (counts.get(token) || 0) + 1);
  let overlap = 0;
  for (const token of right) {
    const remaining = counts.get(token) || 0;
    if (remaining > 0) { overlap += 1; counts.set(token, remaining - 1); }
  }
  return (2 * overlap) / (left.length + right.length);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function imageMetadata(bytes) {
  if (resourceBudgetExhausted) return {error: 'aggregate_image_budget_exhausted'};
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return {error: 'empty_image'};
  if (bytes.length > MAX_IMAGE_BYTES) return {error: 'image_too_large'};
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return {error: 'unsupported_or_invalid_image'};
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let sawIhdr = false;
  let chunkCount = 0;
  let idatCount = 0;
  let sawSrgb = false;
  let sawIdat = false;
  let idatEnded = false;
  let sawIend = false;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    chunkCount += 1;
    if (chunkCount > MAX_PNG_CHUNKS) return {error: 'png_chunk_limit_exceeded'};
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) return {error: 'truncated_png'};
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const chunkType = typeBytes.toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(chunkType) || !/[A-Z]/.test(chunkType[2])) return {error: 'invalid_png_chunk_type'};
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, data])) !== expectedCrc) return {error: 'png_crc_mismatch'};
    if (!['IHDR', 'sRGB', 'IDAT', 'IEND'].includes(chunkType)) return {error: 'unsupported_png_chunk'};
    if (!sawIhdr) {
      if (chunkType !== 'IHDR' || length !== 13) return {error: 'invalid_png_ihdr'};
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9];
      if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) return {error: 'unsupported_png_encoding'};
      sawIhdr = true;
    } else if (chunkType === 'sRGB') {
      if (sawSrgb || sawIdat || length !== 1 || data[0] > 3) return {error: 'invalid_png_srgb'};
      sawSrgb = true;
    } else if (chunkType === 'IDAT') {
      idatCount += 1;
      if (idatCount > MAX_PNG_IDAT_CHUNKS) return {error: 'png_idat_chunk_limit_exceeded'};
      if (idatEnded) return {error: 'nonconsecutive_png_idat'};
      sawIdat = true; idat.push(data);
    } else if (chunkType === 'IEND') {
      if (length !== 0 || offset + 12 !== bytes.length) return {error: 'invalid_png_iend'};
      sawIend = true; break;
    } else {
      if (sawIdat) idatEnded = true;
      if (/^[A-Z]/.test(chunkType)) return {error: 'unknown_png_critical_chunk'};
    }
    offset = chunkEnd;
  }
  if (!sawIhdr || !sawIdat || !sawIend) return {error: 'incomplete_png'};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return {error: 'invalid_image_dimensions'};
  if (width * height > MAX_IMAGE_PIXELS) return {error: 'image_dimensions_too_large'};
  const channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colorType];
  const validDepths = {0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16]}[colorType];
  if (!channels || !validDepths?.includes(bitDepth)) return {error: 'unsupported_png_color_mode'};
  if (colorType === 3) return {error: 'palette_png_not_supported'};
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const expectedRawBytes = height * (1 + rowBytes);
  if (expectedRawBytes > MAX_DECODED_IMAGE_BYTES) { resourceBudgetExhausted = true; return {error: 'decoded_image_too_large'}; }
  aggregatePixels += width * height;
  aggregateDecodedBytes += expectedRawBytes;
  if (aggregatePixels > MAX_AGGREGATE_PIXELS || aggregateDecodedBytes > MAX_AGGREGATE_DECODED_BYTES) { resourceBudgetExhausted = true; return {error: 'aggregate_decoded_image_budget_exceeded'}; }
  const compressed = Buffer.concat(idat);
  let raw;
  try {
    const inflated = inflateSync(compressed, {maxOutputLength: expectedRawBytes, info: true});
    raw = inflated.buffer;
    if (inflated.engine?.bytesWritten !== compressed.length) return {error: 'trailing_png_compressed_data'};
  } catch { return {error: 'invalid_png_compressed_data'}; }
  if (raw.length !== expectedRawBytes) return {error: 'invalid_png_scanline_length'};
  for (let row = 0; row < height; row += 1) if (raw[row * (rowBytes + 1)] > 4) return {error: 'invalid_png_filter'};
  return {type: 'png', width, height, sha256: sha256(bytes)};
}

function resolveLocalAsset(reference, baseDirectory) {
  if (!reference || /^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith('//')) {
    return {error: 'external_or_invalid_url'};
  }
  let decoded;
  try { decoded = decodeURIComponent(reference.split('#')[0].split('?')[0]); }
  catch { return {error: 'invalid_percent_encoding'}; }
  if (path.isAbsolute(decoded)) return {error: 'absolute_path'};
  const full = path.resolve(baseDirectory, decoded);
  const relative = path.relative(root, full);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return {error: 'path_escape'};
  if (!fs.existsSync(full)) return {error: 'missing'};
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) return {error: 'symlink_not_allowed'};
  if (!stat.isFile()) return {error: 'not_regular_file'};
  if (stat.size > MAX_IMAGE_BYTES) return {error: 'image_too_large'};
  const realRoot = fs.realpathSync(root);
  const realFull = fs.realpathSync(full);
  const realRelative = path.relative(realRoot, realFull);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) return {error: 'realpath_escape'};
  if (assetCache.has(realFull)) return assetCache.get(realFull);
  let stable;
  try { stable = readStableFile(full, MAX_IMAGE_BYTES); }
  catch (error) { return {error: error.message}; }
  const bytes = stable.bytes;
  aggregateAssetBytes += bytes.length;
  if (aggregateAssetBytes > MAX_AGGREGATE_ASSET_BYTES) { resourceBudgetExhausted = true; return {error: 'aggregate_asset_bytes_exceeded'}; }
  const metadata = imageMetadata(bytes);
  if (metadata.error) return {error: metadata.error};
  const resolved = {full, relative: toPosix(relative), bytes, ...metadata};
  assetCache.set(realFull, resolved);
  return resolved;
}

function decodeDataImage(source, countAggregate = true) {
  const match = /^data:image\/(png);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(source || '');
  if (!match) return {error: 'invalid_or_unsupported_data_uri'};
  let bytes;
  try { bytes = Buffer.from(match[2], 'base64'); }
  catch { return {error: 'invalid_base64'}; }
  const declaredType = match[1].toLowerCase();
  if (countAggregate) {
    aggregateEmbeddedBytes += bytes.length;
    if (aggregateEmbeddedBytes > MAX_AGGREGATE_EMBEDDED_BYTES) { resourceBudgetExhausted = true; return {error: 'aggregate_embedded_bytes_exceeded'}; }
  }
  const metadata = imageMetadata(bytes);
  if (metadata.error) return {error: metadata.error};
  if (metadata.type !== declaredType) return {error: 'mime_signature_mismatch'};
  return {bytes, ...metadata};
}

function addIssue(report, severity, code, file, detail = {}) {
  if (report.issues.length >= MAX_ISSUES) { report.issue_limit_exceeded = true; return; }
  report.issues.push({severity, code, file, ...detail});
}

let allFiles;
try { allFiles = walk(root); }
catch { usage(`deliverable tree exceeds ${MAX_WALK_ENTRIES} entries`); }
const deliverableCandidates = allFiles.filter(file => /_Complete\.(md|html)$/i.test(file));
const deliverables = deliverableCandidates.length > MAX_DELIVERABLE_FILES ? [] : deliverableCandidates;
const mdFiles = deliverables.filter(file => /\.md$/i.test(file)).sort();
const htmlFiles = deliverables.filter(file => /\.html$/i.test(file)).sort();
const report = {
  schema_version: 1,
  tool: {name: 'audit-deliverables', version: '1.0.0', node: process.version},
  generated_at: new Date().toISOString(),
  root: '.',
  contract: {expected, language, strict_ui: strictUi, allow_active_content: allowActiveContent},
  files: [],
  assets: [],
  issues: [],
  totals: {md_questions: 0, md_answers: 0, html_questions: 0, html_answers: 0, md_images: 0, html_images: 0},
};

report.issues.push(...auditDiscoveryErrors);
if (deliverableCandidates.length > MAX_DELIVERABLE_FILES) addIssue(report, 'error', 'DELIVERABLE_FILE_LIMIT_EXCEEDED', '.', {actual: deliverableCandidates.length, limit: MAX_DELIVERABLE_FILES});
if (mdFiles.length === 0) addIssue(report, 'error', 'NO_MARKDOWN_DELIVERABLES', '.');
if (htmlFiles.length === 0) addIssue(report, 'error', 'NO_HTML_DELIVERABLES', '.');

const mdByStem = new Map();
const htmlByStem = new Map();
for (const file of mdFiles) {
  const stem = toPosix(path.relative(root, file)).replace(/\.md$/i, '').toLowerCase();
  if (mdByStem.has(stem)) addIssue(report, 'error', 'DUPLICATE_MARKDOWN_STEM', stem);
  else mdByStem.set(stem, file);
}
for (const file of htmlFiles) {
  const stem = toPosix(path.relative(root, file)).replace(/\.html$/i, '').toLowerCase();
  if (htmlByStem.has(stem)) addIssue(report, 'error', 'DUPLICATE_HTML_STEM', stem);
  else htmlByStem.set(stem, file);
}
const stems = [...new Set([...mdByStem.keys(), ...htmlByStem.keys()])].sort();
const recordedAssets = new Set();
const seenPairHashes = new Set();
const seenQuestionFingerprints = new Map();

for (const stem of stems) {
  const mdPath = mdByStem.get(stem);
  const htmlPath = htmlByStem.get(stem);
  if (!mdPath) { addIssue(report, 'error', 'MISSING_MARKDOWN_PAIR', `${stem}.html`); continue; }
  if (!htmlPath) { addIssue(report, 'error', 'MISSING_HTML_PAIR', `${stem}.md`); continue; }
  const mdRel = toPosix(path.relative(root, mdPath));
  const htmlRel = toPosix(path.relative(root, htmlPath));
  let mdRead;
  let htmlRead;
  try { mdRead = readStableFile(mdPath, MAX_TEXT_BYTES); }
  catch (error) { addIssue(report, 'error', 'MARKDOWN_STABLE_READ_FAILED', mdRel, {reason: error.message}); continue; }
  try { htmlRead = readStableFile(htmlPath, MAX_TEXT_BYTES); }
  catch (error) { addIssue(report, 'error', 'HTML_STABLE_READ_FAILED', htmlRel, {reason: error.message}); continue; }
  const mdStat = mdRead.stat;
  const htmlStat = htmlRead.stat;
  aggregateTextBytes += mdStat.size + htmlStat.size;
  if (aggregateTextBytes > MAX_AGGREGATE_TEXT_BYTES) { addIssue(report, 'error', 'AGGREGATE_TEXT_BYTES_EXCEEDED', stem, {actual: aggregateTextBytes, limit: MAX_AGGREGATE_TEXT_BYTES}); continue; }
  const mdBuffer = mdRead.bytes;
  const htmlBuffer = htmlRead.bytes;
  const pairHash = sha256(Buffer.concat([mdBuffer, Buffer.from([0]), htmlBuffer]));
  if (seenPairHashes.has(pairHash)) addIssue(report, 'error', 'DUPLICATE_DELIVERABLE_CONTENT', stem, {pair_sha256: pairHash});
  else seenPairHashes.add(pairHash);
  let mdText;
  let htmlText;
  try { mdText = new TextDecoder('utf-8', {fatal: true}).decode(mdBuffer); }
  catch { addIssue(report, 'error', 'INVALID_MARKDOWN_UTF8', mdRel); continue; }
  try { htmlText = new TextDecoder('utf-8', {fatal: true}).decode(htmlBuffer); }
  catch { addIssue(report, 'error', 'INVALID_HTML_UTF8', htmlRel); continue; }
  if (/<!--|-->/.test(mdText) || /<!--|-->/.test(htmlText)) addIssue(report, 'error', 'HTML_COMMENT_NOT_ALLOWED', stem);
  const fenceCount = value => (value.match(/^\s*(?:```|~~~)/gm) || []).length;
  if (fenceCount(mdText) > 0) addIssue(report, 'error', 'FENCED_CODE_REQUIRES_MANUAL_REVIEW', mdRel);
  const hiddenContent = /(?:\s|<)(?:hidden|inert|popover)(?:\s|=|>|\/)|aria-hidden\s*=\s*["']?true|\bstyle\s*=|<(?:frame|frameset|noframes|noembed|pre|code|kbd|samp|textarea|template|noscript|xmp|plaintext|listing|dialog|details|select|option|datalist)\b/i;
  if (hiddenContent.test(mdText) || hiddenContent.test(htmlText)) addIssue(report, 'error', 'HIDDEN_OR_INERT_CONTENT', stem);
  if (/<img\b[^>]*\b(?:width|height)\s*=\s*(["']?)0(?:px)?\1(?:\s|>|\/)/i.test(htmlText)) addIssue(report, 'error', 'INVISIBLE_ZERO_DIMENSION_IMAGE', htmlRel);
  if (/(?:<|\s)[A-Za-z_:][-A-Za-z0-9_:.]*\s*=\s*(?:"[^"]*<\/?[a-z][^"]*"|'[^']*<\/?[a-z][^']*'|<\/?[a-z])/i.test(htmlText)) addIssue(report, 'error', 'HTML_TAG_INSIDE_ATTRIBUTE', htmlRel);
  if (/<img\b/i.test(mdText)) addIssue(report, 'error', 'RAW_HTML_IMAGE_IN_MARKDOWN', mdRel);
  if (/\b(?:data-src|srcset)\s*=/i.test(htmlText) || /<source\b/i.test(htmlText)) addIssue(report, 'error', 'ALTERNATE_IMAGE_SOURCE_NOT_ALLOWED', htmlRel);
  const canonicalActiveScan = decodeHtmlEntities(`${mdText}\n${htmlText}`).replace(/%([0-9a-f]{2})/gi, (match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  const compactActiveScan = canonicalActiveScan.replace(/[\u0000-\u0020]+/g, '');
  const activeContent = /<(?:script|style|link|iframe|frame|frameset|noframes|noembed|object|embed|applet|base|form|svg|math|input|video|audio|canvas|picture)\b|\bbackground\s*=|<meta\b[^>]*http-equiv\s*=\s*["']?refresh|<(?:img|source|link|image|use)\b[^>]*(?:src|href|xlink:href|srcset)\s*=\s*["']?https?:|\b(?:src|srcset|poster|action|xlink:href)\s*=\s*["']?(?:https?:|\/\/|data:(?!image\/png;base64,))|url\(\s*["']?(?:https?:|\/\/)|@import\s+(?:url\()?\s*["']?https?:|\bon\w+\s*=|(?:href|src)\s*=\s*["']?(?:javascript:|data:(?!image\/png;base64,))|<\s*(?:javascript:|data:)|\]\(\s*<?(?:javascript:|data:)|^\s*\[[^\]]+\]:\s*<?(?:javascript:|data:)/im;
  const encodedUrlAttribute = /(?:href|src|srcset|action|poster|xlink:href)\s*=\s*(?:["'][^"']*&(?:#|[a-z])|[^\s>]*&(?:#|[a-z]))/i;
  if (activeContent.test(canonicalActiveScan) || activeContent.test(compactActiveScan) || encodedUrlAttribute.test(htmlText)) addIssue(report, allowActiveContent ? 'warning' : 'error', 'ACTIVE_OR_EXTERNAL_CONTENT', stem);
  const sensitiveContent = /(?:X-Amz-(?:Signature|Credential|Security-Token)|X-Goog-(?:Signature|Credential)|[?#&](?:access_token|auth_token|api[_-]?key|signature|sig|token)=[^\s&#"']+|https?:\/\/[^\s\/@:]+:[^\s\/@]+@|Authorization\s*:\s*Bearer\s+\S+|\b(?:sk-|gh[pousr]_)[A-Za-z0-9_-]{20,})/i;
  if (sensitiveContent.test(canonicalActiveScan)) addIssue(report, 'error', 'SENSITIVE_URL_OR_SECRET_PATTERN', stem);
  const documentMdImages = mdImageRefs(mdText);
  const documentHtmlSources = htmlImageSources(htmlText);
  totalMarkdownImageRefs += documentMdImages.refs.length;
  totalHtmlImageRefs += documentHtmlSources.length;
  const imageReferenceLimitExceeded = documentMdImages.overflow || documentHtmlSources.overflow || totalMarkdownImageRefs > expected * 4 || totalHtmlImageRefs > expected * 4;
  if (imageReferenceLimitExceeded) addIssue(report, 'error', 'IMAGE_REFERENCE_LIMIT_EXCEEDED', stem, {markdown: totalMarkdownImageRefs, html: totalHtmlImageRefs, limit_per_format: expected * 4});
  const mSections = mdSections(mdText);
  const hSections = htmlSections(htmlText);
  if (mSections.overflow) addIssue(report, 'error', 'MARKDOWN_QUESTION_LIMIT_EXCEEDED', mdRel, {limit: MAX_QUESTION_SECTIONS});
  if (hSections.overflow) addIssue(report, 'error', 'HTML_QUESTION_LIMIT_EXCEEDED', htmlRel, {limit: MAX_QUESTION_SECTIONS});
  totalQuestionSections += mSections.length + hSections.length;
  if (totalQuestionSections > MAX_TOTAL_QUESTION_SECTIONS) { addIssue(report, 'error', 'TOTAL_QUESTION_SECTION_LIMIT_EXCEEDED', stem, {actual: totalQuestionSections, limit: MAX_TOTAL_QUESTION_SECTIONS}); continue; }
  const mdAnswers = mSections.reduce((sum, section) => {
    const count = countMatchesUpTo(section.text, /^\s*(?:>\s*)?\*\*Answer(?:\s*:|:\*\*)/gmi, 2);
    if (count !== 1) addIssue(report, 'error', 'MARKDOWN_ANSWER_ASSOCIATION', mdRel, {question_ordinal: section.ordinal, question_number: section.number, answer_count: count});
    return sum + count;
  }, 0);
  const htmlAnswers = hSections.reduce((sum, section) => {
    const count = countMatchesUpTo(section.text, /<[a-z][a-z0-9]*\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\banswer\b[^"']*\1)[^>]*>/gi, 2);
    if (count !== 1) addIssue(report, 'error', 'HTML_ANSWER_ASSOCIATION', htmlRel, {question_ordinal: section.ordinal, question_number: section.number, answer_count: count});
    return sum + count;
  }, 0);
  const mdNumbers = mSections.map(section => section.number);
  const htmlNumbers = hSections.map(section => section.number);
  if (JSON.stringify(mdNumbers) !== JSON.stringify(htmlNumbers)) addIssue(report, 'error', 'QUESTION_SEQUENCE_MISMATCH', stem, {markdown: mdNumbers, html: htmlNumbers});
  for (let i = 0; i < Math.min(mSections.length, hSections.length); i += 1) {
    const mdAnswer = answerValue(mSections[i].text, 'markdown');
    const htmlAnswer = answerValue(hSections[i].text, 'html');
    if (!mdAnswer) addIssue(report, 'error', 'EMPTY_OR_UNREADABLE_MARKDOWN_ANSWER', mdRel, {question_ordinal: i + 1, question_number: mSections[i].number});
    if (!htmlAnswer) addIssue(report, 'error', 'EMPTY_OR_UNREADABLE_HTML_ANSWER', htmlRel, {question_ordinal: i + 1, question_number: hSections[i].number});
    if (mdAnswer && htmlAnswer && mdAnswer !== htmlAnswer) addIssue(report, 'error', 'ANSWER_VALUE_MISMATCH', stem, {question_ordinal: i + 1, markdown_sha256: sha256(Buffer.from(mdAnswer)), html_sha256: sha256(Buffer.from(htmlAnswer))});
    if (responseCandidateOverflow(mSections[i].text, 'markdown') || responseCandidateOverflow(hSections[i].text, 'html')) { addIssue(report, 'error', 'RESPONSE_CANDIDATE_LIMIT_EXCEEDED', stem, {question_ordinal: i + 1, limit: MAX_RESPONSE_CANDIDATES}); continue; }
    const mdChoices = responseChoices(mSections[i].text, 'markdown');
    const htmlChoices = responseChoices(hSections[i].text, 'html');
    const mdChoiceLabels = mdChoices.map(choice => choice.label);
    const htmlChoiceLabels = htmlChoices.map(choice => choice.label);
    const mdVisualChoices = /!\[[^\]]*(?:answer[- ]?choice|four (?:choices|graphs|tables|figures))[^\]]*\]\([^)]+\)/i.test(mSections[i].text);
    const htmlVisualChoices = /<img\b[^>]*\balt\s*=\s*(["'])[^"']*(?:answer[- ]?choice|four (?:choices|graphs|tables|figures))[^"']*\1/i.test(hSections[i].text);
    const validResponse = (answer, choices, visualChoices) => {
      const labels = choices.map(choice => choice.label);
      if (!answer) return false;
      if (!/^[A-D]$/.test(answer)) return labels.length === 0;
      return (JSON.stringify(labels) === '["A","B","C","D"]' && choices.every(choice => choice.text.trim())) || (labels.length === 0 && visualChoices);
    };
    if (!validResponse(mdAnswer, mdChoices, mdVisualChoices)) addIssue(report, 'error', 'MARKDOWN_CHOICE_SET_INVALID', stem, {question_ordinal: i + 1, labels: mdChoiceLabels});
    if (!validResponse(htmlAnswer, htmlChoices, htmlVisualChoices)) addIssue(report, 'error', 'HTML_CHOICE_SET_INVALID', stem, {question_ordinal: i + 1, labels: htmlChoiceLabels});
    if (JSON.stringify(mdChoiceLabels) !== JSON.stringify(htmlChoiceLabels)) addIssue(report, 'error', 'RESPONSE_STRUCTURE_MISMATCH', stem, {question_ordinal: i + 1, markdown: mdChoiceLabels, html: htmlChoiceLabels});
    if (JSON.stringify(mdChoiceLabels) === JSON.stringify(htmlChoiceLabels)) {
      for (let choiceIndex = 0; choiceIndex < mdChoices.length; choiceIndex += 1) {
        const mdChoiceTokens = contentTokens(mdChoices[choiceIndex].text, 'markdown');
        const htmlChoiceTokens = contentTokens(htmlChoices[choiceIndex].text, 'html');
        if (mdChoiceTokens.overflow || htmlChoiceTokens.overflow || tokenDice(mdChoiceTokens, htmlChoiceTokens) < 0.9) addIssue(report, 'error', 'RESPONSE_CHOICE_CONTENT_MISMATCH', stem, {question_ordinal: i + 1, choice: mdChoices[choiceIndex].label});
      }
    }
    const mdTokens = contentTokens(mSections[i].text, 'markdown');
    const htmlTokens = contentTokens(hSections[i].text, 'html');
    if (mdTokens.overflow || htmlTokens.overflow) { addIssue(report, 'error', 'QUESTION_TOKEN_LIMIT_EXCEEDED', stem, {question_ordinal: i + 1, limit: MAX_TOKENS_PER_QUESTION}); continue; }
    totalQuestionTokens += mdTokens.length + htmlTokens.length;
    if (totalQuestionTokens > MAX_TOTAL_TOKENS) { addIssue(report, 'error', 'TOTAL_TOKEN_LIMIT_EXCEEDED', stem, {actual: totalQuestionTokens, limit: MAX_TOTAL_TOKENS}); continue; }
    const similarity = tokenDice(mdTokens, htmlTokens);
    if (similarity < 0.75) addIssue(report, 'error', 'QUESTION_CONTENT_PARITY_FAILED', stem, {question_ordinal: i + 1, score: Number(similarity.toFixed(4))});
    else if (similarity < 0.9) addIssue(report, 'warning', 'QUESTION_CONTENT_PARITY_LOW_CONFIDENCE', stem, {question_ordinal: i + 1, score: Number(similarity.toFixed(4))});
    const questionImageHashes = [];
    if (!imageReferenceLimitExceeded) {
      const questionMdRefs = mdImageRefs(mSections[i].text).refs;
      const questionHtmlSources = htmlImageSources(hSections[i].text);
      if (questionMdRefs.length !== questionHtmlSources.length) addIssue(report, 'error', 'QUESTION_IMAGE_COUNT_MISMATCH', stem, {question_ordinal: i + 1, markdown: questionMdRefs.length, html: questionHtmlSources.length});
      for (let imageIndex = 0; imageIndex < Math.min(questionMdRefs.length, questionHtmlSources.length); imageIndex += 1) {
        const mdImage = resolveLocalAsset(questionMdRefs[imageIndex], path.dirname(mdPath));
        const htmlImage = decodeDataImage(questionHtmlSources[imageIndex], false);
        if (!mdImage.error) questionImageHashes.push(mdImage.sha256);
        if (!mdImage.error && !htmlImage.error && mdImage.sha256 !== htmlImage.sha256) addIssue(report, 'error', 'QUESTION_IMAGE_BYTE_MISMATCH', stem, {question_ordinal: i + 1, image_ordinal: imageIndex + 1});
      }
    }
    if (!imageReferenceLimitExceeded) {
      const fingerprint = sha256(Buffer.from(`${mdTokens.join(' ')}\u0000${questionImageHashes.join(',')}`));
      if (seenQuestionFingerprints.has(fingerprint)) addIssue(report, 'error', 'DUPLICATE_QUESTION_FINGERPRINT', stem, {question_ordinal: i + 1, first: seenQuestionFingerprints.get(fingerprint)});
      else seenQuestionFingerprints.set(fingerprint, `${stem}#${i + 1}`);
    }
  }
  for (let i = 1; i < mdNumbers.length; i += 1) {
    if (mdNumbers[i] !== 1 && mdNumbers[i] !== mdNumbers[i - 1] + 1) addIssue(report, 'error', 'NONSEQUENTIAL_QUESTION_NUMBER', mdRel, {ordinal: i + 1, previous: mdNumbers[i - 1], current: mdNumbers[i]});
  }
  for (const section of mSections) {
    if (!exhibitRe.test(section.text)) continue;
    const exhibitImages = mdImageRefs(section.text, 8);
    const hasImage = !exhibitImages.overflow && exhibitImages.refs.length > 0;
    const hasTable = /<table\b[\s\S]*?<\/table>/i.test(section.text) || /^\s*\|.+\|\s*\r?\n\s*\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|\s*\r?\n\s*\|.+\|\s*$/m.test(section.text);
    if (!hasImage && !hasTable) addIssue(report, 'error', 'MISSING_EXHIBIT', mdRel, {question_ordinal: section.ordinal, question_number: section.number});
  }
  const mdImages = documentMdImages;
  if (mdImages.unsupported) addIssue(report, 'error', 'UNSUPPORTED_REFERENCE_STYLE_IMAGE', mdRel, {count: mdImages.unsupported});
  const mdAssets = (imageReferenceLimitExceeded ? [] : mdImages.refs).map((reference, index) => {
    const resolved = resolveLocalAsset(reference, path.dirname(mdPath));
    if (resolved.error) addIssue(report, 'error', 'INVALID_MARKDOWN_IMAGE', mdRel, {image_ordinal: index + 1, reference_sha256: sha256(Buffer.from(reference)), reason: resolved.error});
    else if (!recordedAssets.has(resolved.relative)) {
      report.assets.push({file: resolved.relative, sha256: sha256(resolved.bytes), bytes: resolved.bytes.length});
      recordedAssets.add(resolved.relative);
    }
    return resolved;
  });
  const htmlSources = documentHtmlSources;
  const htmlAssets = (imageReferenceLimitExceeded ? [] : htmlSources).map((source, index) => {
    const decoded = decodeDataImage(source);
    if (decoded.error) addIssue(report, 'error', 'INVALID_HTML_IMAGE', htmlRel, {image_ordinal: index + 1, reason: decoded.error});
    return decoded;
  });
  if (mdAssets.length !== htmlAssets.length) addIssue(report, 'error', 'IMAGE_COUNT_MISMATCH', stem, {markdown: mdAssets.length, html: htmlAssets.length});
  for (let i = 0; i < Math.min(mdAssets.length, htmlAssets.length); i += 1) {
    if (!mdAssets[i].bytes || !htmlAssets[i].bytes) continue;
    const mdHash = sha256(mdAssets[i].bytes);
    if (mdHash !== htmlAssets[i].sha256) addIssue(report, 'error', 'EMBEDDED_IMAGE_BYTE_MISMATCH', stem, {image_ordinal: i + 1, markdown_sha256: mdHash, html_sha256: htmlAssets[i].sha256});
  }
  const mdUi = (stripMdCode(mdText).match(uiRe) || []).length;
  const htmlUi = (stripHtmlInactive(htmlText).match(uiRe) || []).length;
  if (mdUi + htmlUi > 0) addIssue(report, strictUi ? 'error' : 'warning', 'UI_RESIDUE_CANDIDATE', stem, {count: mdUi + htmlUi});
  if (language === 'en') {
    const cjkCount = (stripMdCode(mdText).match(cjkRe) || []).length + (stripHtmlInactive(htmlText).match(cjkRe) || []).length;
    if (cjkCount > 0) addIssue(report, 'error', 'NON_ENGLISH_CJK_RESIDUE', stem, {count: cjkCount});
  }
  const entry = {
    stem,
    markdown: {file: mdRel, sha256: sha256(mdBuffer), bytes: mdStat.size, mtime_ms: mdStat.mtimeMs, questions: mSections.length, answers: mdAnswers, images: mdAssets.length},
    html: {file: htmlRel, sha256: sha256(htmlBuffer), bytes: htmlStat.size, mtime_ms: htmlStat.mtimeMs, questions: hSections.length, answers: htmlAnswers, images: htmlAssets.length},
  };
  report.files.push(entry);
  report.totals.md_questions += mSections.length;
  report.totals.md_answers += mdAnswers;
  report.totals.html_questions += hSections.length;
  report.totals.html_answers += htmlAnswers;
  report.totals.md_images += mdAssets.length;
  report.totals.html_images += htmlAssets.length;
}

if (report.totals.md_questions !== expected) addIssue(report, 'error', 'EXPECTED_MARKDOWN_COUNT_MISMATCH', '.', {expected, actual: report.totals.md_questions});
if (report.totals.html_questions !== expected) addIssue(report, 'error', 'EXPECTED_HTML_COUNT_MISMATCH', '.', {expected, actual: report.totals.html_questions});
if (report.totals.md_answers !== expected) addIssue(report, 'error', 'EXPECTED_MARKDOWN_ANSWER_COUNT_MISMATCH', '.', {expected, actual: report.totals.md_answers});
if (report.totals.html_answers !== expected) addIssue(report, 'error', 'EXPECTED_HTML_ANSWER_COUNT_MISMATCH', '.', {expected, actual: report.totals.html_answers});
report.automated_structural_checks_pass = !report.issue_limit_exceeded && report.issues.every(issue => issue.severity !== 'error');
report.release_pass = false;
report.release_pass_reason = 'Manual source-pixel reconciliation, blind answer verification, rights review, and an independent current-byte review are outside this script.';

const output = `${JSON.stringify(report, null, 2)}\n`;
if (outPath) {
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  const temp = `${outPath}.tmp-${process.pid}`;
  fs.writeFileSync(temp, output, {flag: 'wx'});
  fs.renameSync(temp, outPath);
}
process.stdout.write(output);
process.exitCode = report.automated_structural_checks_pass ? 0 : 1;
