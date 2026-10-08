#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

function usage(message) {
  if (message) console.error(`Error: ${message}`);
  console.error('Usage: inventory-pdfs.mjs <source-folder> [--json <report-path>]');
  process.exit(2);
}

const argv = process.argv.slice(2);
let rootArg = null;
let outPath = null;
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--json') {
    const value = argv[++i];
    if (!value) usage('--json requires a path');
    outPath = path.resolve(value);
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
const root = path.resolve(rootArg || '.');
function isWithin(base, target) { const relative = path.relative(base, target); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); }
function outputInsideInput(base, target) {
  if (isWithin(base, target)) return true;
  try { return isWithin(fs.realpathSync(base), path.join(fs.realpathSync(path.dirname(target)), path.basename(target))); }
  catch { return false; }
}
if (outPath && outputInsideInput(root, outPath)) usage('--json must be outside the source root');
if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) usage('source folder does not exist or is not a directory');

const MAX_WALK_ENTRIES = 5000;
const MAX_PDF_COUNT = 500;
const MAX_PDF_BYTES = 1024 * 1024 * 1024;
const MAX_TOTAL_PDF_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_PAGES_PER_PDF = 5000;
const MAX_TOTAL_PAGES = 20_000;
const env = {...process.env, LANG: 'C', LC_ALL: 'C'};
function command(name, args, timeout = 60_000) {
  const result = spawnSync(name, args, {encoding: 'utf8', env, timeout, maxBuffer: 64 * 1024 * 1024});
  if (result.error) return {ok: false, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error.code || result.error.message, signal: result.signal || null};
  if (result.status !== 0) return {ok: false, stdout: result.stdout || '', stderr: result.stderr || '', error: `exit_${result.status}`, signal: result.signal || null};
  return {ok: true, stdout: result.stdout || '', stderr: result.stderr || '', error: null, signal: null};
}
function version(name) {
  const result = command(name, ['-v'], 10_000);
  const text = `${result.stdout}\n${result.stderr}`.trim().split('\n')[0] || null;
  return {available: result.ok, version: text, error: result.ok ? null : result.error};
}
const discoveryErrors = [];
function walk(directory, state = {entries: 0}) {
  const found = [];
  const handle = fs.opendirSync(directory);
  try {
    let entry;
    while ((entry = handle.readSync()) !== null) {
      state.entries += 1;
      if (state.entries > MAX_WALK_ENTRIES) throw new Error('walk entry limit exceeded');
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) { discoveryErrors.push({code: 'SYMLINK_SKIPPED', file: path.relative(root, full).split(path.sep).join('/')}); continue; }
      if (entry.isDirectory()) found.push(...walk(full, state));
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) found.push(full);
    }
  } finally { handle.closeSync(); }
  return found;
}
async function hashFile(file) {
  const handle = await fs.promises.open(file, 'r');
  const started = Date.now();
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_PDF_BYTES) throw new Error('hash size limit exceeded');
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let position = 0;
    while (position < stat.size) {
      if (Date.now() - started > 60_000) throw new Error('hash timeout');
      const length = Math.min(buffer.length, stat.size - position);
      const {bytesRead} = await handle.read(buffer, 0, length, position);
      if (bytesRead < 1) throw new Error('unexpected EOF while hashing');
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return hash.digest('hex');
  } finally { await handle.close(); }
}
function safeError(result) {
  const detail = `${result.error || ''}${result.signal ? `:${result.signal}` : ''}`;
  return detail || 'unknown_error';
}
function hasPdfHeader(file) {
  const handle = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(5);
    const bytesRead = fs.readSync(handle, header, 0, header.length, 0);
    return bytesRead === 5 && header.toString('ascii') === '%PDF-';
  } finally {
    fs.closeSync(handle);
  }
}

const tools = {pdfinfo: version('pdfinfo'), pdftotext: version('pdftotext'), pdfimages: version('pdfimages')};
const report = {schema_version: 1, tool: {name: 'inventory-pdfs', version: '1.0.0', node: process.version}, generated_at: new Date().toISOString(), root: '.', limits: {max_walk_entries: MAX_WALK_ENTRIES, max_pdf_count: MAX_PDF_COUNT, max_pdf_bytes: MAX_PDF_BYTES, max_total_pdf_bytes: MAX_TOTAL_PDF_BYTES, max_pages_per_pdf: MAX_PAGES_PER_PDF, max_total_pages: MAX_TOTAL_PAGES}, tools, pdf_count: 0, pdfs: [], errors: []};
for (const [name, details] of Object.entries(tools)) {
  if (!details.available) report.errors.push({code: 'MISSING_OR_BROKEN_TOOL', tool: name, reason: details.error});
}
let pdfs = [];
try { pdfs = walk(root).sort(); }
catch { discoveryErrors.push({code: 'WALK_ENTRY_LIMIT_EXCEEDED', limit: MAX_WALK_ENTRIES}); }
report.errors.push(...discoveryErrors);
report.pdf_count = pdfs.length;
const totalPdfBytes = pdfs.reduce((sum, file) => sum + fs.statSync(file).size, 0);
if (pdfs.length === 0) report.errors.push({code: 'NO_PDFS_FOUND'});
if (pdfs.length > MAX_PDF_COUNT) report.errors.push({code: 'PDF_COUNT_LIMIT_EXCEEDED', actual: pdfs.length, limit: MAX_PDF_COUNT});
if (totalPdfBytes > MAX_TOTAL_PDF_BYTES) report.errors.push({code: 'PDF_TOTAL_BYTES_LIMIT_EXCEEDED', actual: totalPdfBytes, limit: MAX_TOTAL_PDF_BYTES});
let totalPages = 0;

for (const file of pdfs.length > MAX_PDF_COUNT || totalPdfBytes > MAX_TOTAL_PDF_BYTES ? [] : pdfs) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const statBefore = fs.statSync(file);
    if (statBefore.size > MAX_PDF_BYTES) {
      const error = {stage: 'limits', reason: 'pdf_size_limit_exceeded'};
      report.pdfs.push({file: relative, sha256: null, bytes: statBefore.size, mtime_ms: statBefore.mtimeMs, pdf_header_valid: null, pages: null, text_bytes: null, image_rows: null, raster_risk: 'unknown', high_risk_pages: null, page_evidence: [], errors: [error]});
      report.errors.push({code: 'PDF_LIMIT_EXCEEDED', file: relative, ...error});
      continue;
    }
    const hashBefore = await hashFile(file);
    const headerOk = hasPdfHeader(file);
    const info = headerOk && tools.pdfinfo.available ? command('pdfinfo', [file]) : {ok: false, stdout: '', stderr: '', error: headerOk ? 'tool_unavailable' : 'invalid_pdf_header', signal: null};
    const pages = info.ok ? Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1] || 0) : 0;
    if (Number.isInteger(pages) && pages > 0) totalPages += pages;
    const pageLimitExceeded = pages > MAX_PAGES_PER_PDF || totalPages > MAX_TOTAL_PAGES;
    const text = headerOk && tools.pdftotext.available && !pageLimitExceeded ? command('pdftotext', [file, '-']) : {ok: false, stdout: '', stderr: '', error: pageLimitExceeded ? 'page_limit_exceeded' : headerOk ? 'tool_unavailable' : 'invalid_pdf_header', signal: null};
    const images = headerOk && tools.pdfimages.available && !pageLimitExceeded ? command('pdfimages', ['-list', file]) : {ok: false, stdout: '', stderr: '', error: pageLimitExceeded ? 'page_limit_exceeded' : headerOk ? 'tool_unavailable' : 'invalid_pdf_header', signal: null};
    const errors = [];
    if (!info.ok) errors.push({stage: 'pdfinfo', reason: safeError(info)});
    else if (!Number.isInteger(pages) || pages < 1) errors.push({stage: 'pdfinfo', reason: 'invalid_page_count'});
    else if (pages > MAX_PAGES_PER_PDF) errors.push({stage: 'limits', reason: 'page_limit_exceeded'});
    else if (totalPages > MAX_TOTAL_PAGES) errors.push({stage: 'limits', reason: 'total_page_limit_exceeded'});
    if (!text.ok) errors.push({stage: 'pdftotext', reason: safeError(text)});
    if (!images.ok) errors.push({stage: 'pdfimages', reason: safeError(images)});
    const statAfter = fs.statSync(file);
    const hashAfter = await hashFile(file);
    const sourceChanged = hashBefore !== hashAfter || statBefore.size !== statAfter.size || statBefore.mtimeMs !== statAfter.mtimeMs;
    if (sourceChanged) errors.push({stage: 'snapshot', reason: 'source_changed_during_inventory'});

    const textPages = text.ok ? text.stdout.split('\f') : [];
    if (textPages.length > pages && textPages.at(-1) === '') textPages.pop();
    const imageRowsByPage = new Map();
    if (images.ok) {
      for (const line of images.stdout.split('\n')) {
        const match = line.match(/^\s*(\d+)\s+\d+\s+/);
        if (!match) continue;
        const pageNumber = Number(match[1]);
        imageRowsByPage.set(pageNumber, (imageRowsByPage.get(pageNumber) || 0) + 1);
      }
    }
    const pageEvidence = [];
    if (Number.isInteger(pages) && pages > 0 && !pageLimitExceeded) {
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        const pageText = textPages[pageNumber - 1] || '';
        const textBytes = Buffer.byteLength(pageText);
        pageEvidence.push({
          page_number: pageNumber,
          text_bytes: text.ok ? textBytes : null,
          image_rows: images.ok ? (imageRowsByPage.get(pageNumber) || 0) : null,
          raster_risk: !text.ok ? 'unknown' : textBytes < 50 ? 'high' : 'low',
        });
      }
    }
    const highRiskPages = pageEvidence.filter(page => page.raster_risk === 'high').length;
    const row = {
      file: relative,
      sha256: sourceChanged ? null : hashBefore,
      sha256_before: hashBefore,
      sha256_after: hashAfter,
      bytes: statAfter.size,
      mtime_ms: statAfter.mtimeMs,
      snapshot_stable: !sourceChanged,
      pdf_header_valid: headerOk,
      pages: pages || null,
      text_bytes: text.ok ? Buffer.byteLength(text.stdout) : null,
      image_rows: images.ok ? [...imageRowsByPage.values()].reduce((sum, count) => sum + count, 0) : null,
      raster_risk: !text.ok || pages < 1 ? 'unknown' : highRiskPages > 0 ? 'high' : 'low',
      high_risk_pages: !text.ok || pages < 1 ? null : highRiskPages,
      page_evidence: pageEvidence,
      errors,
    };
    report.pdfs.push(row);
    for (const error of errors) report.errors.push({code: 'PDF_INSPECTION_FAILED', file: relative, ...error});
}
report.inventory_complete = report.errors.length === 0 && report.pdfs.length === report.pdf_count;
const output = `${JSON.stringify(report, null, 2)}\n`;
if (outPath) {
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  const temp = `${outPath}.tmp-${process.pid}`;
  fs.writeFileSync(temp, output, {flag: 'wx'});
  fs.renameSync(temp, outPath);
}
process.stdout.write(output);
process.exitCode = report.inventory_complete ? 0 : 1;
