import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeTextAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';

export async function createWorkspaceSkill({ workspace, name, description, journey = 'Build' }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(name ?? ''))) throw new ForgeMindError('FM_FACTORY_NAME_INVALID', 'Skill name must be lower-case hyphen-case.');
  if (!String(description ?? '').trim()) throw new ForgeMindError('FM_FACTORY_INVALID', 'Skill description is required.');
  const root = await resolveWorkspace(workspace);
  const directory = assertContained(root, path.join(root, '.codex-orchestrator', 'generated-skills', name));
  const skill = `---\nname: ${name}\ndescription: ${String(description).trim()}\n---\n\n# ${name}\n\nPrimary journey: **${String(journey)}**\n\n1. Inspect the task and existing evidence.\n2. Produce the smallest useful artifact.\n3. Verify the result and report residual risk.\n`;
  const metadata = `interface:\n  display_name: "${title(name)}"\n  short_description: "${shortDescription(description)}"\n  default_prompt: "Use $${name} to ${String(description).trim().replaceAll('"', '')}."\npolicy:\n  allow_implicit_invocation: false\n`;
  await writeTextAtomic(path.join(directory, 'SKILL.md'), skill, { ifAbsent: true });
  await writeTextAtomic(path.join(directory, 'agents', 'openai.yaml'), metadata, { ifAbsent: true });
  return { schemaVersion: 1, status: 'created', path: directory, skill: name, errors: [] };
}

function title(value) { return value.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '); }
function shortDescription(value) { return String(value).trim().slice(0, 64).replaceAll('"', ''); }
