import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { resolveWorkspace } from './paths.mjs';

export async function inspectProject(workspace) {
  const root = await resolveWorkspace(workspace);
  const entries = await readdir(root, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  const files = await projectFileNames(root);
  const stacks = [];
  const commands = [];
  let packageManager = null;

  if (names.has('package.json')) {
    stacks.push('node');
    packageManager = names.has('pnpm-lock.yaml') ? 'pnpm' : names.has('yarn.lock') ? 'yarn' : 'npm';
    try {
      const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
      for (const category of ['test', 'build', 'lint']) {
        if (packageJson.scripts?.[category]) {
          commands.push(commandCandidate({
            command: packageManager,
            args: [category],
            category,
            confidence: 'detected',
            source: `package.json#scripts.${category}`,
            surfaceHints: [],
          }));
        }
      }
    } catch {
      // Malformed project metadata is reported by callers; inspection remains best-effort.
    }
  }

  const hasSolution = files.some((name) => /\.sln$/i.test(name));
  const hasDotnet = hasSolution || files.some((name) => /\.(?:csproj|fsproj)$/i.test(name));
  if (hasDotnet) {
    stacks.push('dotnet');
    commands.push(commandCandidate({
      command: 'dotnet',
      args: ['test'],
      category: 'test',
      confidence: 'inferred',
      source: hasSolution ? '*.sln' : '*.csproj',
      surfaceHints: ['api'],
    }));
  }

  if (names.has('pyproject.toml') || names.has('requirements.txt')) {
    stacks.push('python');
    commands.push(commandCandidate({
      command: 'python',
      args: ['-m', 'pytest'],
      category: 'test',
      confidence: 'inferred',
      source: names.has('pyproject.toml') ? 'pyproject.toml' : 'requirements.txt',
      surfaceHints: ['api'],
    }));
  }

  if (names.has('go.mod')) {
    stacks.push('go');
    commands.push(commandCandidate({
      command: 'go',
      args: ['test', './...'],
      category: 'test',
      confidence: 'inferred',
      source: 'go.mod',
      surfaceHints: ['api'],
    }));
  }

  const gradleWrapperNames = process.platform === 'win32' ? ['gradlew.bat', 'gradlew'] : ['gradlew', 'gradlew.bat'];
  const gradleWrapper = gradleWrapperNames.find((name) => names.has(name));
  if (gradleWrapper) {
    stacks.push('gradle');
    const hasAndroidManifest = files.some((name) => /(?:^|[\\/])AndroidManifest\.xml$/i.test(name));
    if (hasAndroidManifest) stacks.push('android');
    commands.push(commandCandidate({
      command: gradleWrapper,
      args: ['test'],
      category: 'test',
      confidence: 'inferred',
      source: gradleWrapper,
      surfaceHints: hasAndroidManifest ? ['mobile-gui'] : [],
    }));
  }

  stacks.sort();
  commands.sort((left, right) => left.command.localeCompare(right.command));
  return {
    schemaVersion: 1,
    root,
    packageManager,
    stacks,
    commands,
  };
}

export function commandCandidate({ command, args, category, source, confidence, surfaceHints = [] }) {
  return {
    command,
    args: [...args],
    category,
    confidence,
    source,
    adapter: 'command',
    surfaceHints: [...surfaceHints],
  };
}

async function projectFileNames(root, relative = '') {
  const current = path.join(root, relative);
  let children;
  try {
    children = await readdir(current, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const child of children) {
    if (child.name === '.git' || child.name === 'node_modules') continue;
    const childRelative = path.join(relative, child.name);
    if (child.isDirectory()) files.push(...await projectFileNames(root, childRelative));
    else if (child.isFile()) files.push(childRelative);
  }
  return files;
}
