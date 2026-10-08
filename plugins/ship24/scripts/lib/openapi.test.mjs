import { strict as assert } from 'node:assert';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getOperations,
  getSchemaFields,
  getWebhookPayloads,
  loadSpec,
  renderType,
} from './openapi.mjs';

const specPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'spec',
  'ship24-tracking-api.yaml',
);

const doc = await loadSpec(specPath);

test('getOperations returns exactly 12 operations including create-tracker', () => {
  const operations = getOperations(doc);
  assert.equal(operations.length, 12);

  const createTracker = operations.find((op) => op.operationId === 'create-tracker');
  assert.ok(createTracker, 'expected a create-tracker operation');
  assert.equal(createTracker.method, 'POST');
  assert.equal(createTracker.path, '/trackers');
});

test('getSchemaFields includes trackerId and isTracked on tracker', () => {
  const fields = getSchemaFields(doc, '#/components/schemas/tracker');
  const names = fields.map((field) => field.name);
  assert.ok(names.includes('trackerId'));
  assert.ok(names.includes('isTracked'));
});

test('renderType renders a nullable string as string | null', () => {
  const type = renderType(doc, { type: ['string', 'null'] });
  assert.equal(type, 'string | null');
});

test('renderType renders an array of refs as name[]', () => {
  const type = renderType(doc, { type: 'array', items: { $ref: '#/components/schemas/event' } });
  assert.equal(type, 'event[]');
});

test('renderType renders an enum as a backticked literal list', () => {
  const type = renderType(doc, { type: 'string', enum: ['trackerId', 'clientTrackerId'] });
  assert.equal(type, '`trackerId` | `clientTrackerId`');
});

test('getWebhookPayloads returns 2 entries with trackings as a top-level field', () => {
  const payloads = getWebhookPayloads(doc);
  assert.equal(payloads.length, 2);
  for (const payload of payloads) {
    assert.ok(payload.fields.some((field) => field.name.startsWith('trackings')));
  }
});
