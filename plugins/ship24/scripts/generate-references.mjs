import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { banner, codeBlock, table, writeOutputs } from './lib/markdown.mjs';
import {
  getOperations,
  getSchemaFields,
  getWebhookPayloads,
  loadSpec,
  renderType,
  resolveRef,
} from './lib/openapi.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(ROOT, 'skills');

const SPEC_SOURCE = 'spec/ship24-tracking-api.yaml';
const RATE_LIMITS_SOURCE = 'data/rate-limits.json';
const ERROR_CODES_SOURCE = 'data/error-codes.json';
const STATUSES_SOURCE = 'data/statuses.json';
const COURIER_REQUIRED_FIELDS_SOURCE = 'data/courier-required-fields.json';

const UNDOCUMENTED_RATE_LIMIT_EXCEPTIONS = new Set([
  'GET /trackers/{trackerId}/webhook-history/download',
]);

const SCHEMA_ORDER = [
  'tracker-create-request',
  'tracker',
  'tracking',
  'shipment',
  'event',
  'statistics',
  'metadata',
  'webhook-tracker',
  'bulk-create-trackers-request',
  'bulk-create-trackers-response',
  'error-response-format',
];

const TARGETS = [
  {
    file: 'references/endpoints.md',
    skills: ['ship24-integration', 'ship24-node-sdk', 'ship24-troubleshooting'],
    build: buildEndpointsMd,
  },
  {
    file: 'references/schemas.md',
    skills: ['ship24-integration'],
    build: buildSchemasMd,
  },
  {
    file: 'references/courier-fields.md',
    skills: ['ship24-couriers'],
    build: buildCourierFieldsMd,
  },
  {
    file: 'references/errors.md',
    skills: ['ship24-integration', 'ship24-troubleshooting'],
    build: buildErrorsMd,
  },
  {
    file: 'references/rate-limits.md',
    skills: ['ship24-integration', 'ship24-troubleshooting'],
    build: buildRateLimitsMd,
  },
  {
    file: 'references/statuses.md',
    skills: ['ship24-tracking-statuses', 'ship24-troubleshooting'],
    build: buildStatusesMd,
  },
  {
    file: 'references/webhook-payloads.md',
    skills: ['ship24-webhooks', 'ship24-webhook-test'],
    build: buildWebhookPayloadsMd,
  },
];

const ASSET_TARGETS = [
  {
    file: 'assets/webhook-tracking-events.example.json',
    skills: ['ship24-webhooks', 'ship24-webhook-test'],
    build: (ctx) => ctx.webhookPayloads[0].example,
  },
  {
    file: 'assets/webhook-pod.example.json',
    skills: ['ship24-webhooks', 'ship24-webhook-test'],
    build: (ctx) => ctx.webhookPayloads[1].example,
  },
];

const API_REFERENCE_URL = 'https://docs.ship24.com/tracking-api-reference/#';

// Spec descriptions link to Stoplight routes such as /schemas/tracking, which only resolve on the docs site.
function absolutizeDocsLinks(text) {
  return text.replace(/\]\(\/(schemas|operations|webhooks)\//g, `](${API_REFERENCE_URL}/$1/`);
}

function normalizeDescription(text) {
  return absolutizeDocsLinks(text.replace(/^(#{1,5})(\s)/gm, '#$1$2'));
}

function fieldRows(fields) {
  return fields.map((field) => [
    field.deprecated ? `${field.name} (deprecated)` : field.name,
    field.type,
    field.required ? 'yes' : 'no',
    absolutizeDocsLinks(field.description ?? ''),
  ]);
}

function fieldsTable(fields) {
  return table(['Name', 'Type', 'Required', 'Description'], fieldRows(fields));
}

function buildRateLimitIndex(rateLimits) {
  const index = new Map();
  for (const entry of rateLimits.endpoints) {
    index.set(`${entry.method} ${entry.path}`, entry.requestsPerSecond);
  }
  return index;
}

function joinRateLimits(operations, rateLimitIndex) {
  const operationKeys = new Set(operations.map((op) => `${op.method} ${op.path}`));
  for (const key of rateLimitIndex.keys()) {
    if (!operationKeys.has(key)) {
      throw new Error(
        `data/rate-limits.json references "${key}" which has no matching operation in the OpenAPI spec.`,
      );
    }
  }

  const result = new Map();
  for (const op of operations) {
    const key = `${op.method} ${op.path}`;
    if (rateLimitIndex.has(key)) {
      result.set(key, String(rateLimitIndex.get(key)));
    } else if (UNDOCUMENTED_RATE_LIMIT_EXCEPTIONS.has(key)) {
      result.set(key, 'n/a');
    } else {
      throw new Error(
        `No rate-limit entry found for "${key}". Add one to data/rate-limits.json, or if it is intentionally undocumented, add it to UNDOCUMENTED_RATE_LIMIT_EXCEPTIONS in scripts/generate-references.mjs.`,
      );
    }
  }
  return result;
}

function getCourierItemSchema(doc) {
  const schema =
    doc.paths?.['/public/v1/couriers']?.get?.responses?.['200']?.content?.['application/json']
      ?.schema?.properties?.data?.properties?.couriers?.items;
  if (!schema) {
    throw new Error(
      'Could not find the GET /couriers 200 response courier item schema in the spec.',
    );
  }
  return schema;
}

async function loadContext() {
  const doc = await loadSpec(path.join(ROOT, 'spec', 'ship24-tracking-api.yaml'));
  const rateLimits = JSON.parse(
    await readFile(path.join(ROOT, 'data', 'rate-limits.json'), 'utf8'),
  );
  const errorCodes = JSON.parse(
    await readFile(path.join(ROOT, 'data', 'error-codes.json'), 'utf8'),
  );
  const statuses = JSON.parse(await readFile(path.join(ROOT, 'data', 'statuses.json'), 'utf8'));
  const courierRequiredFields = JSON.parse(
    await readFile(path.join(ROOT, 'data', 'courier-required-fields.json'), 'utf8'),
  );

  const operations = getOperations(doc);
  const rateLimitIndex = buildRateLimitIndex(rateLimits);
  const rateLimitsByOperation = joinRateLimits(operations, rateLimitIndex);
  const webhookPayloads = getWebhookPayloads(doc);

  return {
    doc,
    rateLimits,
    errorCodes,
    statuses,
    courierRequiredFields,
    operations,
    rateLimitIndex,
    rateLimitsByOperation,
    webhookPayloads,
  };
}

function renderRequestBodySection(requestBody) {
  const lines = [];
  if (!requestBody) {
    lines.push('No request body.');
    lines.push('');
    return lines.join('\n');
  }

  if (requestBody.schemaName) {
    lines.push(`Schema: \`${requestBody.schemaName}\`.`);
    lines.push('');
  }

  if (requestBody.fields.length > 0) {
    lines.push(fieldsTable(requestBody.fields));
  } else if (!requestBody.schemaName) {
    lines.push('No fields.');
    lines.push('');
  } else {
    lines.push(
      `_\`${requestBody.schemaName}\` has no top-level object fields; see the schema reference._`,
    );
    lines.push('');
  }

  if (requestBody.example) {
    lines.push(codeBlock('json', JSON.stringify(requestBody.example, null, 2)));
  }

  return lines.join('\n');
}

function buildEndpointsMd(ctx) {
  const { operations, rateLimitsByOperation } = ctx;
  const lines = [
    banner({ sources: [SPEC_SOURCE, RATE_LIMITS_SOURCE, COURIER_REQUIRED_FIELDS_SOURCE] }),
    '',
    '# Ship24 Tracking API endpoints',
    '',
    'Base URL: `https://api.ship24.com/public/v1`. Authenticate every request with an ' +
      '`Authorization: Bearer <api key>` header.',
    '',
    table(
      ['Method', 'Path', 'operationId', 'Summary', 'Rate limit req/s'],
      operations.map((op) => [
        op.method,
        op.path,
        op.operationId,
        op.summary,
        rateLimitsByOperation.get(`${op.method} ${op.path}`),
      ]),
    ),
  ];

  for (const op of operations) {
    lines.push(`### ${op.method} ${op.path}`);
    lines.push('');
    lines.push(`**${op.summary}** (\`${op.operationId}\`)`);
    lines.push('');
    if (op.description) {
      lines.push(normalizeDescription(op.description));
      lines.push('');
    }
    lines.push('**Parameters**');
    lines.push('');
    if (op.parameters.length > 0) {
      lines.push(
        table(
          ['Name', 'In', 'Required', 'Type', 'Description'],
          op.parameters.map((p) => [
            p.name,
            p.in,
            p.required ? 'yes' : 'no',
            p.type,
            p.description,
          ]),
        ),
      );
    } else {
      lines.push('No parameters.');
      lines.push('');
    }
    lines.push('**Request body**');
    lines.push('');
    lines.push(renderRequestBodySection(op.requestBody));
    lines.push('**Responses**');
    lines.push('');
    lines.push(
      table(
        ['Status', 'Description', 'Schema'],
        op.responses.map((r) => [
          r.status,
          r.description,
          r.schemaName ? `\`${r.schemaName}\`` : '—',
        ]),
      ),
    );
  }

  return lines.join('\n');
}

function renderSchemaSection(doc, name, schema) {
  const lines = [`### \`${name}\``, ''];

  if (schema.description) {
    lines.push(normalizeDescription(schema.description));
    lines.push('');
  }

  if (schema.type === 'array') {
    const itemType = renderType(doc, schema.items || {});
    const bounds = [];
    if (schema.minItems !== undefined) bounds.push(`minItems ${schema.minItems}`);
    if (schema.maxItems !== undefined) bounds.push(`maxItems ${schema.maxItems}`);
    lines.push(`Array of \`${itemType}\`${bounds.length > 0 ? ` (${bounds.join(', ')})` : ''}.`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(fieldsTable(getSchemaFields(doc, schema)));
  return lines.join('\n');
}

function buildSchemasMd(ctx) {
  const { doc } = ctx;
  const lines = [banner({ sources: [SPEC_SOURCE] }), '', '# Ship24 Tracking API schemas', ''];

  for (const name of SCHEMA_ORDER) {
    const schema = resolveRef(doc, `#/components/schemas/${name}`);
    if (!schema) throw new Error(`Schema "${name}" not found in the OpenAPI spec.`);
    lines.push(renderSchemaSection(doc, name, schema));
  }

  lines.push(renderSchemaSection(doc, 'courier', getCourierItemSchema(doc)));

  return lines.join('\n');
}

function buildCourierFieldsMd(ctx) {
  const { doc, rateLimitIndex, courierRequiredFields } = ctx;
  const courierSchema = getCourierItemSchema(doc);
  const fields = getSchemaFields(doc, courierSchema);
  const requiredFieldsSchema = courierSchema.properties?.requiredFields;
  const enumValues = requiredFieldsSchema?.items?.enum || [];
  const meanings = new Map(courierRequiredFields.values.map((entry) => [entry.value, entry]));

  const rate = rateLimitIndex.get('GET /couriers');

  return [
    banner({ sources: [SPEC_SOURCE, RATE_LIMITS_SOURCE, COURIER_REQUIRED_FIELDS_SOURCE] }),
    '',
    '# Ship24 courier fields',
    '',
    '## `courier` fields',
    '',
    fieldsTable(fields),
    '## `requiredFields` values',
    '',
    table(
      ['Value', 'Dashboard CSV column', 'Meaning (docs)'],
      enumValues.map((value) => {
        const entry = meanings.get(value);
        return [
          `\`${value}\``,
          entry ? `\`${entry.csvColumn}\`` : '',
          entry ? entry.description : 'Not described on docs.ship24.com.',
        ];
      }),
    ),
    '## Rate limit',
    '',
    rate !== undefined
      ? `\`GET /couriers\`: ${rate} request${rate === 1 ? '' : 's'} per second (default).`
      : '`GET /couriers`: rate limit not documented.',
    '',
  ].join('\n');
}

function buildErrorsMd(ctx) {
  const { errorCodes } = ctx;
  return [
    banner({ sources: [ERROR_CODES_SOURCE] }),
    '',
    '# Ship24 API errors',
    '',
    '## Response format',
    '',
    errorCodes.responseFormat.description,
    '',
    codeBlock('json', JSON.stringify(errorCodes.responseFormat.example, null, 2)),
    '## HTTP status codes',
    '',
    table(
      ['Status', 'Label', 'Description'],
      errorCodes.httpStatuses.map((status) => [status.code, status.label, status.description]),
    ),
    '## Error codes',
    '',
    table(
      ['Code', 'Description'],
      errorCodes.errorCodes.map((error) => [`\`${error.code}\``, error.description]),
    ),
  ].join('\n');
}

function buildRateLimitsMd(ctx) {
  const { rateLimits } = ctx;
  const lines = [
    banner({ sources: [RATE_LIMITS_SOURCE] }),
    '',
    '# Ship24 API rate limits',
    '',
    `Default rate limits per endpoint, enforced per ${rateLimits.windowSeconds}-second window.`,
    '',
    rateLimits.note,
    '',
    '## Endpoints',
    '',
    table(
      ['Method', 'Path', 'Requests per second'],
      rateLimits.endpoints.map((entry) => [
        entry.method,
        entry.path,
        String(entry.requestsPerSecond),
      ]),
    ),
    '## Response headers',
    '',
  ];

  for (const set of rateLimits.headerSets) {
    lines.push(`### ${set.name}`);
    lines.push('');
    if (set.note) {
      lines.push(set.note);
      lines.push('');
    }
    lines.push(
      table(
        ['Header', 'Example', 'Description'],
        set.headers.map((header) => [`\`${header.name}\``, header.example, header.description]),
      ),
    );
  }

  return lines.join('\n');
}

function buildStatusesMd(ctx) {
  const { statuses } = ctx;
  const categoryRows = [];
  for (const category of statuses.categories) {
    for (const statusCode of category.statusCodes) {
      categoryRows.push([
        `\`${category.code}\` — ${category.description}`,
        `\`${statusCode.code}\``,
        statusCode.description,
      ]);
    }
  }

  return [
    banner({ sources: [STATUSES_SOURCE] }),
    '',
    '# Ship24 tracking statuses',
    '',
    '## Field semantics',
    '',
    table(
      ['Field', 'Description'],
      Object.entries(statuses.fields).map(([name, description]) => [`\`${name}\``, description]),
    ),
    '## Milestones',
    '',
    table(
      ['Code', 'Label', 'Description'],
      statuses.milestones.map((milestone) => [
        `\`${milestone.code}\``,
        milestone.label,
        milestone.description,
      ]),
    ),
    '## Categories and status codes',
    '',
    table(['Category', 'Status code', 'Description'], categoryRows),
    '## Sample tracking numbers',
    '',
    statuses.sampleTrackingNumbers.note,
    '',
    table(
      ['Milestone', 'Tracking number'],
      statuses.sampleTrackingNumbers.samples.map((sample) => [
        `\`${sample.milestone}\``,
        `\`${sample.trackingNumber}\``,
      ]),
    ),
  ].join('\n');
}

function buildWebhookPayloadsMd(ctx) {
  const { webhookPayloads } = ctx;
  const lines = [banner({ sources: [SPEC_SOURCE] }), '', '# Ship24 webhook payloads', ''];

  for (const payload of webhookPayloads) {
    lines.push(`### ${payload.summary || payload.operationId} (\`${payload.operationId}\`)`);
    lines.push('');
    if (payload.description) {
      lines.push(normalizeDescription(payload.description));
      lines.push('');
    }
    lines.push(`Topic: \`${payload.topic}\`.`);
    lines.push('');
    lines.push(fieldsTable(payload.fields));
    if (payload.note) {
      lines.push(`_${payload.note}_`);
      lines.push('');
    }
    lines.push(codeBlock('json', JSON.stringify(payload.example, null, 2)));
  }

  return lines.join('\n');
}

function resolveSkillPath(skill, file) {
  return path.join(SKILLS_DIR, skill, ...file.split('/'));
}

async function main() {
  const check = process.argv.includes('--check');
  const ctx = await loadContext();
  const outputs = new Map();

  for (const target of TARGETS) {
    const content = target.build(ctx);
    for (const skill of target.skills) {
      outputs.set(resolveSkillPath(skill, target.file), content);
    }
  }

  for (const target of ASSET_TARGETS) {
    const content = `${JSON.stringify(target.build(ctx), null, 2)}\n`;
    for (const skill of target.skills) {
      outputs.set(resolveSkillPath(skill, target.file), content);
    }
  }

  const upToDate = await writeOutputs(outputs, { check });
  if (check && !upToDate) {
    console.error(
      'generate:check failed: some reference files are stale or missing. Run `pnpm generate`.',
    );
    process.exitCode = 1;
  }
}

await main();
