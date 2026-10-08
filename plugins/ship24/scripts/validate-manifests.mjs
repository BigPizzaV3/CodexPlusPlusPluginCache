import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP_URL = 'https://api.ship24.com/mcp';
// biome-ignore lint/suspicious/noTemplateCurlyInString: the manifests must contain this placeholder literally
const KEY_HEADER = 'Bearer ${SHIP24_API_KEY}';

const MANIFEST_FILES = {
  packageJson: 'package.json',
  claudePlugin: '.claude-plugin/plugin.json',
  claudeMarketplace: '.claude-plugin/marketplace.json',
  mcp: '.mcp.json',
  mcpLower: 'mcp.json',
  rootPlugin: 'plugin.json',
  cursorPlugin: '.cursor-plugin/plugin.json',
  codexPlugin: '.codex-plugin/plugin.json',
  agentsMarketplace: '.agents/plugins/marketplace.json',
  geminiExtension: 'gemini-extension.json',
};

const VERSION_LOCATIONS = [
  { key: 'packageJson', label: 'package.json' },
  { key: 'claudePlugin', label: '.claude-plugin/plugin.json' },
  {
    key: 'claudeMarketplace',
    label: '.claude-plugin/marketplace.json plugins[0].version',
    getVersion: (d) => d.plugins?.[0]?.version,
  },
  { key: 'rootPlugin', label: 'plugin.json' },
  { key: 'cursorPlugin', label: '.cursor-plugin/plugin.json' },
  { key: 'codexPlugin', label: '.codex-plugin/plugin.json' },
  { key: 'geminiExtension', label: 'gemini-extension.json' },
];

const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  const raw = await readFile(absolute, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${relativePath}: failed to parse JSON (${error.message})`);
    return null;
  }
}

async function fileExists(relativePath) {
  try {
    await stat(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const docs = {};
  for (const [key, relativePath] of Object.entries(MANIFEST_FILES)) {
    docs[key] = await readJson(relativePath);
  }

  if (docs.rootPlugin) {
    const schemaPath = path.join(ROOT, 'schemas', 'agent-plugins-1.0.0.plugin.schema.json');
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    if (!validate(docs.rootPlugin)) {
      for (const error of validate.errors ?? []) {
        fail(`plugin.json: schema violation at "${error.instancePath || '/'}" — ${error.message}`);
      }
    }
  }

  const versions = new Map();
  for (const location of VERSION_LOCATIONS) {
    const doc = docs[location.key];
    if (!doc) continue;
    const version = location.getVersion ? location.getVersion(doc) : doc.version;
    versions.set(location.label, version);
  }
  const distinctVersions = new Set(versions.values());
  if (distinctVersions.size > 1) {
    fail(
      `Version mismatch across manifests: ${[...versions.entries()]
        .map(([label, version]) => `${label}=${version}`)
        .join(', ')}`,
    );
  }

  if (docs.mcp) {
    const server = docs.mcp.mcpServers?.['ship24-tracking'];
    if (server?.headers?.Authorization !== KEY_HEADER) {
      fail(`.mcp.json: ship24-tracking headers.Authorization must be "${KEY_HEADER}".`);
    }
    if (server?.url !== MCP_URL) {
      fail('.mcp.json: ship24-tracking url must be "https://api.ship24.com/mcp".');
    }
  }

  if (docs.mcpLower) {
    const server = docs.mcpLower.mcpServers?.['ship24-tracking'];
    if (server?.headers?.Authorization !== KEY_HEADER) {
      fail(`mcp.json: ship24-tracking headers.Authorization must be "${KEY_HEADER}".`);
    }
    if (server?.url !== MCP_URL) {
      fail('mcp.json: ship24-tracking url must be "https://api.ship24.com/mcp".');
    }
    if (server?.type !== 'streamable-http') {
      fail(
        'mcp.json: ship24-tracking type must be "streamable-http" (Agent Plugins 1.0 mcp schema).',
      );
    }
  }

  if (docs.geminiExtension) {
    const server = docs.geminiExtension.mcpServers?.['ship24-tracking'];
    const authHeader = server?.headers?.Authorization ?? '';
    if (!authHeader.includes('$SHIP24_API_KEY')) {
      fail(
        'gemini-extension.json: ship24-tracking headers.Authorization must contain "$SHIP24_API_KEY".',
      );
    }
    const settings = Array.isArray(docs.geminiExtension.settings)
      ? docs.geminiExtension.settings
      : [];
    if (!settings.some((setting) => setting.envVar === 'SHIP24_API_KEY')) {
      fail('gemini-extension.json: settings[] must include an entry with envVar "SHIP24_API_KEY".');
    }
  }

  if (docs.cursorPlugin) {
    const properties = docs.cursorPlugin.variables?.properties;
    if (!properties || !('SHIP24_API_KEY' in properties)) {
      fail('.cursor-plugin/plugin.json: variables.properties.SHIP24_API_KEY must be declared.');
    }
    const server = docs.cursorPlugin.mcpServers?.['ship24-tracking'];
    if (server?.url !== MCP_URL) {
      fail(
        '.cursor-plugin/plugin.json: mcpServers.ship24-tracking.url must be "https://api.ship24.com/mcp".',
      );
    }
    if (server?.headers?.Authorization !== KEY_HEADER) {
      fail(
        `.cursor-plugin/plugin.json: mcpServers.ship24-tracking headers.Authorization must be "${KEY_HEADER}".`,
      );
    }
  }

  if (docs.codexPlugin) {
    if (docs.codexPlugin.mcpServers !== './.mcp.json') {
      fail('.codex-plugin/plugin.json: mcpServers must point at "./.mcp.json".');
    }
    if (docs.codexPlugin.skills !== './skills/') {
      fail('.codex-plugin/plugin.json: skills must be "./skills/".');
    }
  }

  if (docs.agentsMarketplace) {
    const entry = docs.agentsMarketplace.plugins?.[0];
    if (entry?.source?.source !== 'local' || entry?.source?.path !== './') {
      fail(
        '.agents/plugins/marketplace.json: plugins[0].source must be { source: "local", path: "./" }.',
      );
    }
    if (!entry?.policy?.installation || !entry?.policy?.authentication) {
      fail(
        '.agents/plugins/marketplace.json: plugins[0].policy.installation and .authentication are required.',
      );
    }
    if (!entry?.category) {
      fail('.agents/plugins/marketplace.json: plugins[0].category is required.');
    }
  }

  if (docs.claudeMarketplace && docs.claudePlugin) {
    const marketplacePlugin = docs.claudeMarketplace.plugins?.[0];
    if (marketplacePlugin?.name !== docs.claudePlugin.name) {
      fail(
        `.claude-plugin/marketplace.json: plugins[0].name must equal .claude-plugin/plugin.json name ("${marketplacePlugin?.name}" !== "${docs.claudePlugin.name}").`,
      );
    }
    if (marketplacePlugin?.source !== './') {
      fail(
        `.claude-plugin/marketplace.json: plugins[0].source must be "./" (got "${marketplacePlugin?.source}").`,
      );
    }
  }

  if (!(await fileExists('assets/logo.png'))) {
    fail('assets/logo.png is missing.');
  }

  if (failures.length > 0) {
    console.error(`Found ${failures.length} manifest violation(s):\n`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('All manifests are valid and consistent.');
}

await main();
