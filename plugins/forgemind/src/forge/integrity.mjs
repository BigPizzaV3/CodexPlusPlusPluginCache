import { createHash } from 'node:crypto';

import { canonicalJson } from '../io.mjs';

export const CANONICALIZATION = 'forgemind-canonical-json-v1';

export function stableId(prefix, value) {
  const normalized = String(prefix).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${normalized}_${createHash('sha256').update(canonicalJson(value)).digest('hex').slice(0, 24)}`;
}

export function digestRecord(record) {
  const payload = withoutDigest(record);
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function sealRecord(record) {
  const payload = withoutDigest(record);
  return {
    ...payload,
    digest: {
      algorithm: 'sha256',
      canonicalization: CANONICALIZATION,
      value: digestRecord(payload),
    },
  };
}

export function verifyRecord(record) {
  const expected = digestRecord(record ?? {});
  const actual = record?.digest?.value;
  const metadataValid = record?.digest?.algorithm === 'sha256'
    && record?.digest?.canonicalization === CANONICALIZATION
    && typeof actual === 'string';
  return {
    schemaVersion: 1,
    status: metadataValid && actual === expected ? 'valid' : 'invalid',
    expected,
    actual: actual ?? null,
  };
}

function withoutDigest(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const { digest, ...payload } = record;
  return payload;
}
