import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const port = Number.parseInt(process.env.PORT || '3000', 10);
const secret = process.env.SHIP24_WEBHOOK_SECRET ? Buffer.from(process.env.SHIP24_WEBHOOK_SECRET) : null;
const logFile = process.env.LOG_FILE || null;
const MAX_BODY_BYTES = 1024 * 1024;

function log(entry) {
  const line = `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`;
  if (logFile) fs.appendFileSync(logFile, line);
  else process.stdout.write(line);
}

function maskAuth(header) {
  if (!header) return null;
  const [scheme] = header.split(' ');
  return `${scheme} [masked]`;
}

function secretMatches(header) {
  if (!secret) return true;
  const [scheme, token = ''] = (header || '').split(' ');
  const candidate = Buffer.from(token);
  return scheme === 'Bearer' && candidate.length === secret.length && crypto.timingSafeEqual(candidate, secret);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.pause();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function respond(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function logPayload(req, payload) {
  const base = { method: req.method, path: req.url, authorization: maskAuth(req.headers.authorization) };
  const trackings = Array.isArray(payload?.trackings) ? payload.trackings : [];
  if (trackings.length === 0) {
    log({ ...base, note: 'no trackings[] in payload', keys: Object.keys(payload ?? {}) });
    return;
  }
  for (const tracking of trackings) {
    const metadata = tracking.metadata ?? {};
    const tracker = tracking.tracker ?? {};
    const shipment = tracking.shipment ?? {};
    const common = {
      ...base,
      topic: metadata.topic,
      messageId: metadata.messageId,
      trackerId: tracker.trackerId,
      clientTrackerId: tracker.clientTrackerId,
      trackingNumber: tracker.trackingNumber,
      statusMilestone: shipment.statusMilestone,
    };
    const events = Array.isArray(tracking.events) ? tracking.events : [];
    if (events.length === 0) {
      const pod = tracking.data ? { status: tracking.data.status, contentType: tracking.data.content?.type } : undefined;
      log({ ...common, pod });
      continue;
    }
    for (const event of events) {
      log({
        ...common,
        eventId: event.eventId,
        statusCode: event.statusCode,
        occurrenceDatetime: event.occurrenceDatetime,
      });
    }
  }
}

async function handle(req, res) {
  const rejected = { method: req.method, path: req.url, authorization: maskAuth(req.headers.authorization) };
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'POST only' });
    return;
  }
  if (!secretMatches(req.headers.authorization)) {
    log({ ...rejected, rejected: 'bad secret' });
    respond(res, 401, { error: 'invalid webhook secret' });
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    log({ ...rejected, rejected: error.message });
    // The client may still be sending, so answer first and close the socket once the response is flushed.
    res.writeHead(413, { 'Content-Type': 'application/json', Connection: 'close' });
    res.end(JSON.stringify({ error: error.message }), () => req.destroy());
    return;
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    log({ ...rejected, rejected: 'invalid json', bytes: body.length });
    respond(res, 400, { error: 'invalid json' });
    return;
  }
  respond(res, 200, { ok: true });
  logPayload(req, payload);
}

http.createServer(handle).listen(port, () => {
  console.log(`Ship24 webhook test receiver listening on http://localhost:${port} (POST any path)`);
  console.log(`secret check: ${secret ? 'on' : 'off (set SHIP24_WEBHOOK_SECRET to enable)'}; log: ${logFile ?? 'stdout'}`);
});
