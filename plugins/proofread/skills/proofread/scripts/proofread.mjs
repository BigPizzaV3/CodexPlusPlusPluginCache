#!/usr/bin/env node
// Copyright (c) 2026 Rafael Arciniegas

import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const DIALECTS = new Set(["us", "uk", "au", "ca"]);

function usage() {
  return `Usage:
  proofread.mjs doctor
  proofread.mjs lint PATH [--dialect us|uk|au|ca]
  proofread.mjs scan PATH
  proofread.mjs guard ORIGINAL DRAFT
  proofread.mjs diff ORIGINAL DRAFT

Commands:
  doctor   Report required and optional executable availability
  lint     Run Harper CLI on an existing file
  scan     Report suspicious invisible Unicode without changing the file
  guard    Compare protected spans between the original and edited draft
  diff     Show a color-free word diff without changing either file`;
}

function commandVersion(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  return {
    available: !result.error && result.status === 0,
    version: result.status === 0 ? (result.stdout || result.stderr).trim().split("\n")[0] : null,
    error: result.error?.code ?? (result.status === 0 ? null : (result.stderr.trim() || `exit ${result.status}`)),
  };
}

async function requireFile(filePath, label = "file") {
  if (!filePath) throw new Error(`${label} path is required`);
  const absolute = path.resolve(filePath);
  try {
    await access(absolute, constants.R_OK);
    if (!(await stat(absolute)).isFile()) throw new Error("not-file");
  } catch {
    throw new Error(`${label} is not a readable file: ${absolute}`);
  }
  return absolute;
}

function parseLintArgs(args) {
  let dialect = "us";
  let filePath = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dialect") {
      dialect = args[++index];
      if (!DIALECTS.has(dialect)) throw new Error(`Unsupported dialect: ${dialect}`);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (filePath) {
      throw new Error(`Unexpected argument: ${arg}`);
    } else {
      filePath = arg;
    }
  }
  return { dialect, filePath };
}

async function doctor() {
  const result = {
    node: { available: true, version: process.version },
    git: commandVersion("git"),
    harper: commandVersion("harper-cli"),
  };
  result.ok = result.git.available;
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function lint(args) {
  const { dialect, filePath } = parseLintArgs(args);
  const absolute = await requireFile(filePath);
  const result = spawnSync("harper-cli", [
    "lint", "--format", "compact", "--no-color", "--quiet", "--dialect", dialect, absolute,
  ], { encoding: "utf8", shell: false });
  if (result.error?.code === "ENOENT") {
    throw new Error("harper-cli is not installed; skip the optional baseline and disclose that it was skipped");
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.status ?? 1;
}

function addMatches(target, kind, source, expression) {
  for (const match of source.matchAll(expression)) target.push({ kind, value: match[0] });
}

function fencedBlocks(source) {
  const blocks = [];
  const lines = source.split(/(?<=\n)/);
  let current = null;
  for (const line of lines) {
    if (!current) {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (opening) current = { marker: opening[1][0], length: opening[1].length, value: line };
      continue;
    }
    current.value += line;
    const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*(?:\n)?$/);
    if (close && close[1][0] === current.marker && close[1].length >= current.length) {
      blocks.push({ kind: "fenced-code", value: current.value });
      current = null;
    }
  }
  if (current) blocks.push({ kind: "fenced-code", value: current.value });
  return blocks;
}

function protectedSpans(source) {
  const spans = fencedBlocks(source);
  addMatches(spans, "inline-code", source, /`[^`\n]+`/g);
  addMatches(spans, "url", source, /\bhttps?:\/\/[^\s<>"']+/gi);
  addMatches(spans, "windows-path", source, /\b[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]+/g);
  addMatches(spans, "unix-path", source, /(?:^|(?<=\s))(?:\.{0,2}\/|\/)(?:[A-Za-z0-9._~@%+,:=-]+\/)+[A-Za-z0-9._~@%+,:=-]*/gm);
  addMatches(spans, "number", source, /(?<![\p{L}\p{N}_])[-+]?(?:\d[\d,]*(?:\.\d+)?%?)(?![\p{L}\p{N}_])/gu);
  addMatches(spans, "numeric-citation", source, /\[(?:\d+(?:\s*[-,]\s*\d+)*)\]/g);
  addMatches(spans, "double-quote", source, /"[^"\n]+"/g);
  addMatches(spans, "curly-double-quote", source, /“[^”\n]+”/g);
  addMatches(spans, "curly-single-quote", source, /‘[^’\n]+’/g);
  return spans;
}

function countSpans(spans) {
  const counts = new Map();
  for (const span of spans) {
    const key = JSON.stringify([span.kind, span.value]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function subtractCounts(left, right) {
  const difference = [];
  for (const [key, count] of left) {
    const remaining = count - (right.get(key) ?? 0);
    if (remaining > 0) {
      const [kind, value] = JSON.parse(key);
      difference.push({ kind, value, count: remaining });
    }
  }
  return difference;
}

async function guard(args) {
  const original = await requireFile(args[0], "original");
  const draft = await requireFile(args[1], "draft");
  const originalCounts = countSpans(protectedSpans(await readFile(original, "utf8")));
  const draftCounts = countSpans(protectedSpans(await readFile(draft, "utf8")));
  const removed = subtractCounts(originalCounts, draftCounts);
  const added = subtractCounts(draftCounts, originalCounts);
  const result = { ok: removed.length === 0 && added.length === 0, removed, added };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}

async function scan(args) {
  const filePath = await requireFile(args[0]);
  const source = await readFile(filePath, "utf8");
  const names = new Map([
    ["\u00ad", "soft-hyphen"], ["\u200b", "zero-width-space"],
    ["\u200c", "zero-width-non-joiner"], ["\u200d", "zero-width-joiner"],
    ["\u2060", "word-joiner"], ["\ufeff", "byte-order-mark"],
  ]);
  const hits = [];
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (names.has(character) || /[\u202a-\u202e\u2066-\u2069]/u.test(character)) {
      hits.push({ index, code_point: `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`, name: names.get(character) ?? "bidi-control" });
    }
  }
  console.log(JSON.stringify({ ok: hits.length === 0, hits }, null, 2));
}

async function diff(args) {
  const original = await requireFile(args[0], "original");
  const draft = await requireFile(args[1], "draft");
  const result = spawnSync("git", ["diff", "--no-index", "--word-diff=plain", "--no-color", "--", original, draft], {
    encoding: "utf8", shell: false,
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (![0, 1].includes(result.status)) process.exitCode = result.status ?? 2;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }
  if (command === "doctor") return doctor();
  if (command === "lint") return lint(args);
  if (command === "scan") return scan(args);
  if (command === "guard") return guard(args);
  if (command === "diff") return diff(args);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
