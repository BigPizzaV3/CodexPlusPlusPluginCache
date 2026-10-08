#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export function answerPayload(markdown, { title = 'Codex answer', language = 'en' } = {}) {
  if (typeof markdown !== 'string' || !markdown.trim() || Buffer.byteLength(markdown) > 120000)
    throw Error('Save the complete selected answer as Markdown (maximum 120 KB). Do not truncate it.');
  if (language !== 'en') throw Error('The current synchronized-reading preview is English only. Keep the source language; do not silently translate it.');
  return { version: 1, markdown, title: title.slice(0, 160), language,
    sha256: createHash('sha256').update(markdown).digest('hex') };
}

export function readerURL(payload) {
  return 'https://castreader.com/codex-reader/index.html#answer=' + Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** A short loopback handoff avoids pasting a long/private answer into tool URLs.
 * It serves exactly one unguessable path and no files from the workspace. */
export async function openAnswerBridge(payload, { port = 0, lifetimeMs = 15 * 60 * 1000 } = {}) {
  const token = randomBytes(24).toString('hex');
  const nonce = randomBytes(24).toString('base64');
  const path = `/read/${token}`;
  const destination = readerURL(payload);
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Opening CastReader</title></head><body><p>Opening your answer in CastReader…</p><script nonce="${nonce}">location.replace(${JSON.stringify(destination)});</script></body></html>`;
  const server = createServer((req, res) => {
    const host = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== host || req.url !== path || !['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'` });
    res.end(req.method === 'HEAD' ? undefined : page);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const timer = setTimeout(() => server.close(), lifetimeMs); timer.unref();
  server.on('close', () => clearTimeout(timer));
  return { server, url: `http://127.0.0.1:${server.address().port}${path}`, sha256: payload.sha256 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
    const file = option('--markdown');
    if (!file) throw Error('Usage: node scripts/read-answer.mjs --markdown /absolute/answer.md --language en [--title "Answer title"]');
    const payload = answerPayload(await readFile(file, 'utf8'), { language: option('--language') || 'en', title: option('--title') || 'Codex answer' });
    const bridge = await openAnswerBridge(payload);
    console.log(JSON.stringify({ url: bridge.url, sha256: bridge.sha256, service: 'CastReader membership', bytes: Buffer.byteLength(payload.markdown) }));
    const stop = () => bridge.server.close(); process.once('SIGTERM', stop); process.once('SIGINT', stop);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
