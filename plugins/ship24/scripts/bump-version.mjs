import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  {
    path: 'package.json',
    getVersion: (d) => d.version,
    setVersion: (d, v) => {
      d.version = v;
    },
  },
  {
    path: '.claude-plugin/plugin.json',
    getVersion: (d) => d.version,
    setVersion: (d, v) => {
      d.version = v;
    },
  },
  {
    path: '.claude-plugin/marketplace.json',
    getVersion: (d) => d.plugins?.[0]?.version,
    setVersion: (d, v) => {
      if (d.plugins?.[0]) d.plugins[0].version = v;
    },
  },
  {
    path: 'plugin.json',
    getVersion: (d) => d.version,
    setVersion: (d, v) => {
      d.version = v;
    },
  },
  {
    path: '.cursor-plugin/plugin.json',
    getVersion: (d) => d.version,
    setVersion: (d, v) => {
      d.version = v;
    },
  },
  {
    path: '.codex-plugin/plugin.json',
    getVersion: (d) => d.version,
    setVersion: (d, v) => {
      d.version = v;
    },
  },
  {
    path: 'gemini-extension.json',
    getVersion: (d) => d.version,
    setVersion: (d, v) => {
      d.version = v;
    },
  },
];

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function computeNewVersion(currentVersion, arg) {
  if (SEMVER_PATTERN.test(arg)) return arg;

  const match = SEMVER_PATTERN.exec(currentVersion);
  if (!match) {
    throw new Error(`Current version "${currentVersion}" is not a valid X.Y.Z semver string.`);
  }
  const [majorNum, minorNum, patchNum] = [Number(match[1]), Number(match[2]), Number(match[3])];

  switch (arg) {
    case 'major':
      return `${majorNum + 1}.0.0`;
    case 'minor':
      return `${majorNum}.${minorNum + 1}.0`;
    case 'patch':
      return `${majorNum}.${minorNum}.${patchNum + 1}`;
    default:
      throw new Error(
        `Unknown bump argument "${arg}". Use patch, minor, major, or an explicit X.Y.Z version.`,
      );
  }
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>');
    process.exitCode = 1;
    return;
  }

  const packageJsonPath = path.join(ROOT, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  const newVersion = computeNewVersion(currentVersion, arg);

  for (const file of FILES) {
    const absolute = path.join(ROOT, file.path);
    const raw = await readFile(absolute, 'utf8');
    const doc = JSON.parse(raw);
    const oldVersion = file.getVersion(doc);
    file.setVersion(doc, newVersion);
    await writeFile(absolute, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    console.log(`${file.path}: ${oldVersion} -> ${newVersion}`);
  }
}

await main();
