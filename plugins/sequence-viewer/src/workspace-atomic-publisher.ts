import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, rm, stat } from "node:fs/promises";
import path from "node:path";

const destinationTails = new Map<string, Promise<void>>();

export class SequenceWorkspaceCollisionError extends Error {
  readonly code = "SEQUENCE_WORKSPACE_COLLISION";

  constructor(
    message = "The workspace export or provenance sidecar already exists.",
  ) {
    super(message);
    this.name = "SequenceWorkspaceCollisionError";
  }
}

export function isSequenceWorkspaceCollisionError(
  error: unknown,
): error is SequenceWorkspaceCollisionError {
  return error instanceof SequenceWorkspaceCollisionError;
}

export type SequenceWorkspaceAtomicHooks = {
  beforeArtifactLink?: () => Promise<void> | void;
  beforeCommit?: () => Promise<void> | void;
  beforeSidecarLink?: () => Promise<void> | void;
};

export async function publishSequenceWorkspacePair({
  artifact,
  artifactPath,
  hooks = {},
  sidecar,
  sidecarPath,
  signal,
}: {
  artifact: Uint8Array;
  artifactPath: string;
  hooks?: SequenceWorkspaceAtomicHooks;
  sidecar: string;
  sidecarPath: string;
  signal?: AbortSignal;
}): Promise<void> {
  const release = await acquireDestination(artifactPath, sidecarPath, signal);
  try {
    await publishLocked({
      artifact,
      artifactPath,
      hooks,
      sidecar,
      sidecarPath,
      signal,
    });
  } finally {
    release();
  }
}

export type SequenceWorkspaceStagedIdentity = {
  changedAtNanoseconds: string;
  device: string;
  inode: string;
  modifiedAtNanoseconds: string;
  size: string;
};

/** Publishes an already-written private file without reading it into memory. */
export async function publishSequenceWorkspaceStagedPair({
  artifactPath,
  hooks = {},
  sidecar,
  sidecarPath,
  signal,
  stagedArtifactPath,
  stagedIdentity,
}: {
  artifactPath: string;
  hooks?: SequenceWorkspaceAtomicHooks;
  sidecar: string;
  sidecarPath: string;
  signal?: AbortSignal;
  stagedArtifactPath: string;
  stagedIdentity: SequenceWorkspaceStagedIdentity;
}): Promise<void> {
  if (
    !sameCanonicalDirectory(
      path.dirname(stagedArtifactPath),
      path.dirname(artifactPath),
    )
  ) {
    throw new Error("Workspace staging must be local to its destination.");
  }
  const release = await acquireDestination(artifactPath, sidecarPath, signal);
  try {
    await publishStagedLocked({
      artifactPath,
      hooks,
      sidecar,
      sidecarPath,
      signal,
      stagedArtifactPath,
      stagedIdentity,
    });
  } finally {
    release();
  }
}

async function publishLocked({
  artifact,
  artifactPath,
  hooks,
  sidecar,
  sidecarPath,
  signal,
}: {
  artifact: Uint8Array;
  artifactPath: string;
  hooks: SequenceWorkspaceAtomicHooks;
  sidecar: string;
  sidecarPath: string;
  signal?: AbortSignal;
}): Promise<void> {
  const nonce = randomUUID();
  const artifactTemp = temporaryPath(artifactPath, nonce, "artifact");
  const sidecarTemp = temporaryPath(sidecarPath, nonce, "provenance");
  let artifactPublished = false;
  let sidecarPublished = false;
  let committed = false;
  const errors: unknown[] = [];

  try {
    throwIfAborted(signal);
    await writePrivateExclusive(artifactTemp, artifact);
    throwIfAborted(signal);
    await writePrivateExclusive(sidecarTemp, sidecar);
    throwIfAborted(signal);
    await assertMissing(artifactPath);
    await assertMissing(sidecarPath);
    await hooks.beforeArtifactLink?.();
    throwIfAborted(signal);
    await link(artifactTemp, artifactPath);
    artifactPublished = true;
    await assertSameRegularFile(artifactPath, artifactTemp);
    await hooks.beforeSidecarLink?.();
    throwIfAborted(signal);
    await assertSameRegularFile(artifactPath, artifactTemp);
    await link(sidecarTemp, sidecarPath);
    sidecarPublished = true;
    await assertSameRegularFile(sidecarPath, sidecarTemp);
    await hooks.beforeCommit?.();
    throwIfAborted(signal);
    await Promise.all([
      assertSameRegularFile(artifactPath, artifactTemp),
      assertSameRegularFile(sidecarPath, sidecarTemp),
    ]);
    committed = true;
  } catch (error) {
    errors.push(normalizeCollision(error));
    if (!committed) {
      if (sidecarPublished) {
        await unlinkIfSameFile(sidecarPath, sidecarTemp).catch((rollback) =>
          errors.push(rollback),
        );
      }
      if (artifactPublished) {
        await unlinkIfSameFile(artifactPath, artifactTemp).catch((rollback) =>
          errors.push(rollback),
        );
      }
    }
  }

  await Promise.allSettled([
    rm(artifactTemp, { force: true }),
    rm(sidecarTemp, { force: true }),
  ]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") errors.push(result.reason);
    }
  });
  if (committed) {
    try {
      await syncDirectory(path.dirname(artifactPath));
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      errors[0] instanceof Error
        ? errors[0].message
        : "Workspace artifact publication failed.",
    );
  }
}

async function publishStagedLocked({
  artifactPath,
  hooks,
  sidecar,
  sidecarPath,
  signal,
  stagedArtifactPath,
  stagedIdentity,
}: {
  artifactPath: string;
  hooks: SequenceWorkspaceAtomicHooks;
  sidecar: string;
  sidecarPath: string;
  signal?: AbortSignal;
  stagedArtifactPath: string;
  stagedIdentity: SequenceWorkspaceStagedIdentity;
}): Promise<void> {
  const nonce = randomUUID();
  const sidecarTemp = temporaryPath(sidecarPath, nonce, "provenance");
  let artifactPublished = false;
  let sidecarPublished = false;
  let committed = false;
  const errors: unknown[] = [];

  try {
    throwIfAborted(signal);
    await assertPrivateStagedFile(stagedArtifactPath, stagedIdentity);
    await writePrivateExclusive(sidecarTemp, sidecar);
    throwIfAborted(signal);
    await assertMissing(artifactPath);
    await assertMissing(sidecarPath);
    await hooks.beforeArtifactLink?.();
    throwIfAborted(signal);
    await assertPrivateStagedFile(stagedArtifactPath, stagedIdentity);
    await link(stagedArtifactPath, artifactPath);
    artifactPublished = true;
    await assertExpectedRegularFile(artifactPath, stagedIdentity);
    await hooks.beforeSidecarLink?.();
    throwIfAborted(signal);
    await assertExpectedRegularFile(artifactPath, stagedIdentity);
    await link(sidecarTemp, sidecarPath);
    sidecarPublished = true;
    await assertSameRegularFile(sidecarPath, sidecarTemp);
    await hooks.beforeCommit?.();
    throwIfAborted(signal);
    await Promise.all([
      assertExpectedRegularFile(artifactPath, stagedIdentity),
      assertSameRegularFile(sidecarPath, sidecarTemp),
    ]);
    committed = true;
  } catch (error) {
    errors.push(normalizeCollision(error));
    if (!committed) {
      if (sidecarPublished) {
        await unlinkIfSameFile(sidecarPath, sidecarTemp).catch((rollback) =>
          errors.push(rollback),
        );
      }
      if (artifactPublished) {
        await unlinkIfExpectedFile(artifactPath, stagedIdentity).catch(
          (rollback) => errors.push(rollback),
        );
      }
    }
  }
  await rm(sidecarTemp, { force: true }).catch((error) => errors.push(error));
  if (committed) {
    try {
      await syncDirectory(path.dirname(artifactPath));
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      errors[0] instanceof Error
        ? errors[0].message
        : "Workspace artifact publication failed.",
    );
  }
}

async function writePrivateExclusive(
  filePath: string,
  contents: Uint8Array | string,
): Promise<void> {
  const handle = await open(
    filePath,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(contents);
    await handle.sync();
    const fileStat = await handle.stat({ bigint: true });
    if (
      !fileStat.isFile() ||
      fileStat.nlink !== 1n ||
      (process.platform !== "win32" && (fileStat.mode & 0o777n) !== 0o600n)
    ) {
      throw new Error(
        "Workspace staging did not create a private regular file.",
      );
    }
  } finally {
    await handle.close();
  }
}

async function assertMissing(filePath: string): Promise<void> {
  try {
    await lstat(filePath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }
  throw new SequenceWorkspaceCollisionError();
}

async function unlinkIfSameFile(
  destination: string,
  staged: string,
): Promise<void> {
  try {
    const [destinationStat, stagedStat] = await Promise.all([
      stat(destination, { bigint: true }),
      stat(staged, { bigint: true }),
    ]);
    if (
      destinationStat.dev === stagedStat.dev &&
      destinationStat.ino === stagedStat.ino
    ) {
      await rm(destination);
    }
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

async function assertSameRegularFile(
  destination: string,
  staged: string,
): Promise<void> {
  const [destinationStat, stagedStat] = await Promise.all([
    lstat(destination, { bigint: true }),
    lstat(staged, { bigint: true }),
  ]);
  if (
    destinationStat.isSymbolicLink() ||
    stagedStat.isSymbolicLink() ||
    !destinationStat.isFile() ||
    !stagedStat.isFile() ||
    destinationStat.dev !== stagedStat.dev ||
    destinationStat.ino !== stagedStat.ino
  ) {
    throw new Error("The workspace publication target changed during commit.");
  }
}

async function assertPrivateStagedFile(
  staged: string,
  expected: SequenceWorkspaceStagedIdentity,
): Promise<void> {
  const fileStat = await lstat(staged, { bigint: true });
  if (
    fileStat.isSymbolicLink() ||
    !fileStat.isFile() ||
    fileStat.dev.toString() !== expected.device ||
    fileStat.ino.toString() !== expected.inode ||
    fileStat.ctimeNs.toString() !== expected.changedAtNanoseconds ||
    fileStat.mtimeNs.toString() !== expected.modifiedAtNanoseconds ||
    fileStat.size.toString() !== expected.size ||
    fileStat.nlink !== 1n ||
    (process.platform !== "win32" && (fileStat.mode & 0o777n) !== 0o600n)
  ) {
    throw new Error("Workspace staging changed before publication.");
  }
}

async function assertExpectedRegularFile(
  destination: string,
  expected: SequenceWorkspaceStagedIdentity,
): Promise<void> {
  const fileStat = await lstat(destination, { bigint: true });
  if (
    fileStat.isSymbolicLink() ||
    !fileStat.isFile() ||
    fileStat.dev.toString() !== expected.device ||
    fileStat.ino.toString() !== expected.inode ||
    fileStat.size.toString() !== expected.size
  ) {
    throw new Error("The workspace publication target changed during commit.");
  }
}

async function unlinkIfExpectedFile(
  destination: string,
  expected: SequenceWorkspaceStagedIdentity,
): Promise<void> {
  try {
    await assertExpectedRegularFile(destination, expected);
    await rm(destination);
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

async function syncDirectory(directory: string): Promise<void> {
  if (process.platform === "win32") return;
  const handle = await open(directory, constants.O_RDONLY);
  try {
    await handle.sync();
  } catch (error) {
    if (!isNodeError(error, "EINVAL") && !isNodeError(error, "ENOTSUP")) {
      throw error;
    }
  } finally {
    await handle.close();
  }
}

function temporaryPath(
  destination: string,
  nonce: string,
  suffix: string,
): string {
  return path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${nonce}.${suffix}.tmp`,
  );
}

function normalizeCollision(error: unknown): unknown {
  return isNodeError(error, "EEXIST")
    ? new SequenceWorkspaceCollisionError()
    : error;
}

function sameCanonicalDirectory(left: string, right: string): boolean {
  return canonicalDestinationPath(left) === canonicalDestinationPath(right);
}

function canonicalDestinationPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isNodeError(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw (
    signal.reason ??
    new DOMException(
      "Workspace artifact publication was cancelled.",
      "AbortError",
    )
  );
}

async function acquireDestination(
  artifactPath: string,
  sidecarPath: string,
  signal?: AbortSignal,
): Promise<() => void> {
  const key = JSON.stringify(
    [artifactPath, sidecarPath].map(canonicalDestinationPath).sort(),
  );
  const previous = destinationTails.get(key) ?? Promise.resolve();
  let openGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  const settled = previous.catch(() => undefined);
  const tail = settled.then(() => gate);
  destinationTails.set(key, tail);
  try {
    await waitForAbortable(settled, signal);
    throwIfAborted(signal);
  } catch (error) {
    openGate();
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openGate();
    void tail.finally(() => {
      if (destinationTails.get(key) === tail) destinationTails.delete(key);
    });
  };
}

async function waitForAbortable(
  promise: Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (signal == null) {
    await promise;
    return;
  }
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () =>
      finish(() =>
        reject(
          signal.reason ??
            new DOMException(
              "Workspace artifact publication was cancelled.",
              "AbortError",
            ),
        ),
      );
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(
      () => finish(resolve),
      (error) => finish(() => reject(error)),
    );
  });
}
