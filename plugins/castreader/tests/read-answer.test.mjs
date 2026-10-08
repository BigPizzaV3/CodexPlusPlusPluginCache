import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'node:http';
import { answerPayload, readerURL, openAnswerBridge } from '../scripts/read-answer.mjs';

test('complete Markdown survives transport without a developer API key', () => {
  const markdown = '# Answer\n\n**Bold** and [link](https://castreader.com).\n\n```js\nconst x = 1;\n```\n';
  const payload = answerPayload(markdown);
  const url = new URL(readerURL(payload));
  assert.equal(url.origin, 'https://castreader.com');
  assert.equal(url.search, '');
  const decoded = JSON.parse(Buffer.from(new URLSearchParams(url.hash.slice(1)).get('answer'), 'base64url'));
  assert.equal(decoded.markdown, markdown);
  assert.equal(decoded.sha256, payload.sha256);
  assert.throws(() => answerPayload('a'.repeat(120001)));
  assert.throws(() => answerPayload('你好', { language: 'zh' }));
});

test('bridge exposes only an unguessable loopback path; no workspace or credentials', async t => {
  const bridge = await openAnswerBridge(answerPayload('Hello **world**'));
  t.after(() => bridge.server.close());
  const response = await fetch(bridge.url);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(html, /location.replace/);
  assert.doesNotMatch(html, /API_KEY|state\.json|receipt\.json/);
  assert.equal((await fetch(new URL('/.env', bridge.url))).status, 404);
  assert.equal((await fetch(bridge.url, { method: 'POST' })).status, 404);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    get(bridge.url, { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
  });
  assert.equal(wrongHostStatus, 404);
});
