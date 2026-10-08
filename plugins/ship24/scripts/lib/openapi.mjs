import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export async function loadSpec(path) {
  const raw = await readFile(path, 'utf8');
  return parse(raw);
}

function decodeRefSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function resolveRef(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const segments = ref
    .slice(2)
    .split('/')
    .map((segment) => decodeRefSegment(decodeURIComponent(segment)));
  let node = doc;
  for (const segment of segments) {
    if (node == null || typeof node !== 'object') return null;
    node = node[segment];
  }
  return node ?? null;
}

function refName(ref) {
  if (typeof ref !== 'string') return null;
  const parts = ref.split('/');
  return parts[parts.length - 1] || null;
}

function normalizeTypes(type) {
  if (Array.isArray(type)) return type;
  if (typeof type === 'string') return [type];
  return [];
}

function uniq(list) {
  return [...new Set(list)];
}

function withFormat(schema, base) {
  if (schema && typeof schema.format === 'string' && schema.format.length > 0) {
    return `${base} (${schema.format})`;
  }
  return base;
}

function withNullable(schema, base) {
  if (schema && schema.nullable === true && !/(^|\W)null(\W|$)/.test(base)) {
    return `${base} | null`;
  }
  return base;
}

export function renderType(doc, schema) {
  if (schema == null || typeof schema !== 'object') return 'unknown';

  if (typeof schema.$ref === 'string') {
    return refName(schema.$ref) || 'unknown';
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const base = schema.enum.map((value) => `\`${value}\``).join(' | ');
    return withNullable(schema, withFormat(schema, base));
  }

  const variants = schema.oneOf || schema.anyOf;
  if (Array.isArray(variants) && variants.length > 0) {
    const pieces = uniq(variants.map((variant) => renderType(doc, variant)));
    return withNullable(schema, withFormat(schema, pieces.join(' | ')));
  }

  const types = normalizeTypes(schema.type);
  if (types.length === 0) {
    if (schema.properties) return withNullable(schema, withFormat(schema, 'object'));
    if (schema.items) {
      return withNullable(schema, withFormat(schema, `${renderType(doc, schema.items)}[]`));
    }
    return 'unknown';
  }

  const pieces = [];
  for (const type of types) {
    if (type === 'array') {
      const itemType = schema.items ? renderType(doc, schema.items) : 'unknown';
      const wrapped = itemType.includes(' | ') ? `(${itemType})` : itemType;
      pieces.push(`${wrapped}[]`);
    } else if (type === 'null') {
      pieces.push('null');
    } else {
      pieces.push(type);
    }
  }

  const base = uniq(pieces).join(' | ');
  return withNullable(schema, withFormat(schema, base));
}

export function getSchemaFields(doc, schemaOrRef) {
  let schema = schemaOrRef;
  if (typeof schemaOrRef === 'string') {
    schema = resolveRef(doc, schemaOrRef);
  } else if (schemaOrRef && typeof schemaOrRef.$ref === 'string') {
    schema = resolveRef(doc, schemaOrRef.$ref);
  }
  if (!schema || typeof schema !== 'object' || !schema.properties) return [];

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  return Object.entries(schema.properties).map(([name, propSchema]) => ({
    name,
    type: renderType(doc, propSchema),
    required: required.has(name),
    deprecated: Boolean(propSchema && propSchema.deprecated === true),
    description: propSchema?.description || '',
  }));
}

function pickExample(mediaType) {
  if (!mediaType) return null;
  if (mediaType.example !== undefined) return mediaType.example;
  if (mediaType.examples && typeof mediaType.examples === 'object') {
    const first = Object.values(mediaType.examples)[0];
    if (first && typeof first === 'object') {
      if (typeof first.$ref === 'string') return null;
      if ('value' in first) return first.value;
      return first;
    }
  }
  return null;
}

function pickMediaType(content) {
  if (!content || typeof content !== 'object') return null;
  return content['application/json'] || Object.values(content)[0] || null;
}

function extractResponseSchemaName(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (typeof schema.$ref === 'string') return refName(schema.$ref);
  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf) {
      if (part && typeof part.$ref === 'string') return refName(part.$ref);
    }
  }
  return null;
}

function renderParameter(doc, param) {
  return {
    name: param.name,
    in: param.in,
    required: Boolean(param.required),
    type: renderType(doc, param.schema || {}),
    description: param.description || '',
  };
}

function renderRequestBody(doc, requestBody) {
  if (!requestBody || typeof requestBody !== 'object') return null;
  const mediaType = pickMediaType(requestBody.content);
  if (!mediaType) return { schemaName: null, fields: [], example: null };

  const schema = mediaType.schema;
  let schemaName = null;
  let fields = [];
  if (schema && typeof schema.$ref === 'string') {
    schemaName = refName(schema.$ref);
    fields = getSchemaFields(doc, schema.$ref);
  } else if (schema) {
    fields = getSchemaFields(doc, schema);
  }

  return { schemaName, fields, example: pickExample(mediaType) };
}

function renderResponses(responses) {
  if (!responses || typeof responses !== 'object') return [];
  return Object.entries(responses).map(([status, response]) => {
    const mediaType = pickMediaType(response?.content);
    const schemaName = mediaType ? extractResponseSchemaName(mediaType.schema) : null;
    return {
      status,
      description: response?.description || '',
      schemaName,
    };
  });
}

function stripPublicV1Prefix(path) {
  const prefix = '/public/v1';
  if (path.startsWith(prefix)) {
    const rest = path.slice(prefix.length);
    return rest === '' ? '/' : rest;
  }
  return path;
}

export function getOperations(doc) {
  const paths = doc?.paths || {};
  const operations = [];

  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const pathLevelParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.includes(method)) continue;
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;

      const operationParams = Array.isArray(operation.parameters) ? operation.parameters : [];
      const parameters = [...pathLevelParams, ...operationParams].map((param) =>
        renderParameter(doc, param),
      );

      operations.push({
        method: method.toUpperCase(),
        path: stripPublicV1Prefix(rawPath),
        operationId: operation.operationId || null,
        summary: operation.summary || '',
        description: operation.description || '',
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        parameters,
        requestBody: renderRequestBody(doc, operation.requestBody),
        responses: renderResponses(operation.responses),
      });
    }
  }

  return operations;
}

function flattenTrackingItemFields(doc, trackingsSchema) {
  if (!trackingsSchema?.items) return [];
  return getSchemaFields(doc, trackingsSchema.items).map((field) => ({
    ...field,
    name: `trackings[].${field.name}`,
  }));
}

function buildMinimalExample(doc, schema, depth = 0) {
  if (!schema || typeof schema !== 'object' || depth > 6) return null;
  if (typeof schema.$ref === 'string') {
    return buildMinimalExample(doc, resolveRef(doc, schema.$ref), depth + 1);
  }
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0];
  if (schema.default !== undefined) return schema.default;

  const types = normalizeTypes(schema.type);
  if (types.includes('array')) {
    const item = buildMinimalExample(doc, schema.items, depth + 1);
    return item === undefined ? [] : [item];
  }
  if (schema.properties) {
    const out = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      out[key] = buildMinimalExample(doc, propSchema, depth + 1);
    }
    return out;
  }
  if (types.includes('string')) return '';
  if (types.includes('integer') || types.includes('number')) return 0;
  if (types.includes('boolean')) return false;
  return null;
}

const WEBHOOK_TOPICS = {
  'receive-webhooks-tracking-results': 'tracking/events',
  'receive-webhooks-proof-of-delivery': 'tracking/pod',
};

export function getWebhookPayloads(doc) {
  const webhooks = doc?.webhooks || {};
  const results = [];

  for (const pathItem of Object.values(webhooks)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.includes(method)) continue;
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;
      const operationId = operation.operationId;
      if (!operationId || !(operationId in WEBHOOK_TOPICS)) continue;

      const mediaType = pickMediaType(operation.requestBody?.content);
      const schema = mediaType?.schema;
      const trackingsSchema = schema?.properties?.trackings;
      const fields = flattenTrackingItemFields(doc, trackingsSchema);

      let example = mediaType ? pickExample(mediaType) : null;
      let note;
      if (!example) {
        example = buildMinimalExample(doc, schema);
        note =
          'No example found in the spec; this is a minimal example built from schema defaults/examples.';
      }

      const payload = {
        operationId,
        summary: operation.summary || '',
        description: operation.description || '',
        topic: WEBHOOK_TOPICS[operationId],
        fields,
        example,
      };
      if (note) payload.note = note;
      results.push(payload);
    }
  }

  return results;
}
