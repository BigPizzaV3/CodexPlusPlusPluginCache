import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { appendMemoryEntry } from './memory.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function migrateMarkdownMemory({ workspace, author = 'ForgeMind migration' }) {
  const root = await resolveWorkspace(workspace);
  const legacyRoot = path.join(root, '.codex-orchestrator', 'memory');
  let files = [];
  try {
    files = (await readdir(legacyRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let imported = 0;
  let duplicates = 0;
  for (const name of files) {
    const statement = (await readFile(path.join(legacyRoot, name), 'utf8')).trim();
    if (!statement) continue;
    const result = await appendMemoryEntry({
      workspace: root,
      scope: 'shared',
      entry: {
        type: 'legacy-memory',
        subject: path.basename(name, '.md'),
        statement,
        source: `.codex-orchestrator/memory/${name}`,
        evidence: [`.codex-orchestrator/memory/${name}`],
        author,
        confidence: 0.5,
        reviewState: 'pending',
        sensitivity: 'internal',
        nonExpiring: true,
      },
    });
    if (result.status === 'created') imported += 1;
    else duplicates += 1;
  }
  return { schemaVersion: 1, status: 'passed', imported, duplicates, sourceFiles: files.length };
}
