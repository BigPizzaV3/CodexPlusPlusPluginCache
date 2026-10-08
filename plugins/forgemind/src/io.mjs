import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export function canonicalJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export async function writeJsonAtomic(target, value) {
  return writeTextAtomic(target, canonicalJson(value));
}

export async function writeTextAtomic(target, content, options = {}) {
  const resolved = path.resolve(target);
  const directory = path.dirname(resolved);
  const temporary = path.join(directory, `.${path.basename(resolved)}.${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    if (options.ifAbsent) {
      try {
        await writeFile(resolved, content, { encoding: 'utf8', flag: 'wx' });
        return resolved;
      } finally {
        await rm(temporary, { force: true });
      }
    }
    await replaceAtomically(temporary, resolved);
  } finally {
    await rm(temporary, { force: true });
  }
  return resolved;
}

async function replaceAtomically(temporary, resolved) {
  // Windows can briefly hold a just-written file open (for example through
  // Defender or an indexer). Retrying the final same-volume rename preserves
  // atomic replacement and avoids turning that transient lock into a failed
  // workflow run.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(temporary, resolved);
      return;
    } catch (error) {
      const retryable = error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'EBUSY';
      if (!retryable || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}
