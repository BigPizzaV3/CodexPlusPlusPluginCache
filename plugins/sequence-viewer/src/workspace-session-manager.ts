import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";

import type { RootsRequestExtra } from "./chat-file-resource";
import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { SEQUENCE_VIEWER_VERSION } from "./version";
import { parseAndValidateWorkbenchSession } from "./workbench-session-validation";
import {
  type PreparedSequenceWorkspaceExport,
  type SequenceWorkspaceFileIdentity,
  type SequenceWorkspaceSourceBinding,
  SequenceWorkspaceExportPublisher,
} from "./workspace-export-publisher";
import {
  type SequenceListWorkspaceSessionsInput,
  type SequenceListWorkspaceSessionsResult,
  type SequenceRestoreWorkspaceSessionResult,
  type SequenceWorkspaceSessionManifest,
  sequenceWorkspaceSessionManifestSchema,
} from "./workspace-session-protocol";

const SESSION_NAME_PATTERN = /\.sequence-viewer\.session(?:-\d+)?\.json$/u;
const MAX_TRACK_DEPENDENCY_BYTES = 100 * 1_024 * 1_024;

type ManifestCandidateBinding = {
  bindingId: string;
  candidateId: string;
  expiresAt: number;
  identity: SequenceWorkspaceFileIdentity;
  manifestSha256: string;
  name: string;
  path: string;
  sessionId: string;
  workspacePath: string;
};

export type PreparedSequenceWorkspaceSessionManifest = {
  bytes: Uint8Array;
  manifest: SequenceWorkspaceSessionManifest;
  sha256: string;
};

export type ResolvedSequenceWorkspaceSession = {
  dependencies: SequenceRestoreWorkspaceSessionResult["dependencies"];
  mode: "alignment" | "sequence";
  name: string;
  payload: string;
  workspacePath: string;
};

export function safeSequenceWorkspaceSessionError(error: unknown): Error {
  if (isAbortError(error)) return error;
  if (
    error instanceof Error &&
    !(error instanceof AggregateError) &&
    !("code" in error)
  ) {
    return error;
  }
  return new Error(
    "Workspace session access failed without disclosing host filesystem details.",
  );
}

export async function createSequenceWorkspaceSessionManifest(
  payload: string,
  plan: PreparedSequenceWorkspaceExport,
  signal?: AbortSignal,
): Promise<PreparedSequenceWorkspaceSessionManifest> {
  throwIfAborted(signal);
  const session = parseAndValidateWorkbenchSession(payload);
  const dependencies = await createDependencyDescriptors(
    session.tracks,
    plan,
    signal,
  );
  throwIfAborted(signal);
  const sourceSize = safeInteger(plan.sourceIdentity.size, "source size");
  const manifest = sequenceWorkspaceSessionManifestSchema.parse({
    createdAt: plan.createdAt,
    dependencies,
    mode: session.view.mode,
    payload,
    payloadSha256: sha256(Buffer.from(payload, "utf8")),
    plugin: { name: "sequence-viewer", version: SEQUENCE_VIEWER_VERSION },
    schemaVersion: 1,
    source: {
      sha256: plan.sourceSha256,
      size: sourceSize,
      workspacePath: plan.sourceWorkspacePath,
    },
    version: 1,
  });
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (bytes.byteLength > SEQUENCE_VIEWER_LIMITS.workspace.maxSessionManifestBytes) {
    throw new Error(
      "The durable workspace session manifest exceeds its bounded size.",
    );
  }
  return { bytes, manifest, sha256: sha256(bytes) };
}

export class SequenceWorkspaceSessionManager {
  private readonly candidates = new Map<string, ManifestCandidateBinding>();
  private readonly now: () => number;

  constructor(
    private readonly sourceBindings: SequenceWorkspaceExportPublisher,
    { now = Date.now }: { now?: () => number } = {},
  ) {
    this.now = now;
  }

  async list(
    input: SequenceListWorkspaceSessionsInput,
    extra?: RootsRequestExtra,
  ): Promise<SequenceListWorkspaceSessionsResult> {
    throwIfAborted(extra?.signal);
    const binding = await this.sourceBindings.getActiveSourceBinding(
      input.sessionId,
      extra,
    );
    const directoryPath = path.dirname(binding.sourcePath);
    const entries = await listManifestFiles(directoryPath);
    const candidates: SequenceListWorkspaceSessionsResult["candidates"] = [];
    let inspected = 0;
    for (const entry of entries) {
      if (
        candidates.length >= SEQUENCE_VIEWER_LIMITS.workspace.maxSessionCandidates ||
        inspected >= SEQUENCE_VIEWER_LIMITS.workspace.maxSessionCandidates * 4
      ) {
        break;
      }
      inspected += 1;
      throwIfAborted(extra?.signal);
      try {
        const loaded = await readAndValidateManifest(entry.path, entry.identity);
        if (
          loaded.manifest.source.workspacePath !== binding.sourceWorkspacePath ||
          loaded.manifest.source.size !== safeInteger(binding.sourceIdentity.size, "source size")
        ) {
          continue;
        }
        const candidate = this.remember({
          bindingId: binding.bindingId,
          candidateId: randomUUID(),
          expiresAt: this.expiresAt(),
          identity: entry.identity,
          manifestSha256: loaded.sha256,
          name: entry.name,
          path: entry.path,
          sessionId: input.sessionId,
          workspacePath: workspaceLabel(
            path.relative(binding.rootPath, entry.path),
          ),
        });
        candidates.push({
          candidateId: candidate.candidateId,
          createdAt: loaded.manifest.createdAt,
          dependencies: await inspectDependencies(
            loaded.manifest,
            binding,
            false,
            extra?.signal,
          ),
          mode: loaded.manifest.mode,
          name: candidate.name,
          sourceStatus: "verification-required",
          workspacePath: candidate.workspacePath,
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        // Discovery exposes only compatible manifests; malformed or unsafe files are omitted.
      }
    }
    throwIfAborted(extra?.signal);
    const current = await this.sourceBindings.getActiveSourceBinding(
      input.sessionId,
      extra,
    );
    if (current.bindingId !== binding.bindingId) {
      throw new Error("The workspace source changed while sessions were discovered.");
    }
    return {
      candidates,
      omittedCandidates: entries.length - candidates.length,
    };
  }

  async resolve(
    candidateId: string,
    sessionId: string,
    signal?: AbortSignal,
    extra?: RootsRequestExtra,
  ): Promise<ResolvedSequenceWorkspaceSession> {
    throwIfAborted(signal);
    this.pruneExpired();
    const candidate = this.candidates.get(candidateId);
    if (
      candidate == null ||
      candidate.sessionId !== sessionId ||
      candidate.expiresAt <= this.now()
    ) {
      throw new Error(
        "The workspace session candidate expired or belongs to another viewer.",
      );
    }
    const binding = await this.sourceBindings.getActiveSourceBinding(
      sessionId,
      extra,
    );
    if (binding.bindingId !== candidate.bindingId) {
      throw new Error("The workspace source changed after session discovery.");
    }
    const loaded = await readAndValidateManifest(
      candidate.path,
      candidate.identity,
    );
    if (loaded.sha256 !== candidate.manifestSha256) {
      throw new Error("The workspace session changed after discovery.");
    }
    assertManifestSourceBinding(loaded.manifest, binding);
    const sourceSha256 = await hashBoundFile(
      binding.sourcePath,
      binding.sourceIdentity,
      SEQUENCE_VIEWER_LIMITS.workspace.maxSessionSourceBytes,
      signal,
    );
    if (sourceSha256 !== loaded.manifest.source.sha256) {
      throw new Error(
        "The opened source content does not match this workspace session.",
      );
    }
    const dependencies = await inspectDependencies(
      loaded.manifest,
      binding,
      true,
      signal,
    );
    const unavailableRequired = dependencies.find(
      ({ required, status }) => required && status !== "matched",
    );
    if (unavailableRequired != null) {
      throw new Error(
        `Required workspace dependency ${unavailableRequired.name} is ${unavailableRequired.status}.`,
      );
    }
    throwIfAborted(signal);
    const current = await this.sourceBindings.getActiveSourceBinding(
      sessionId,
      extra,
    );
    if (current.bindingId !== binding.bindingId) {
      throw new Error("The workspace source changed during session restore.");
    }
    await assertFileIdentity(candidate.path, candidate.identity);
    return {
      dependencies,
      mode: loaded.manifest.mode,
      name: candidate.name,
      payload: loaded.manifest.payload,
      workspacePath: candidate.workspacePath,
    };
  }

  private remember(candidate: ManifestCandidateBinding): ManifestCandidateBinding {
    this.pruneExpired();
    while (
      this.candidates.size >= SEQUENCE_VIEWER_LIMITS.workspace.maxCandidateTokens
    ) {
      const oldest = this.candidates.keys().next().value as string | undefined;
      if (oldest == null) break;
      this.candidates.delete(oldest);
    }
    this.candidates.set(candidate.candidateId, candidate);
    return candidate;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [candidateId, candidate] of this.candidates) {
      if (candidate.expiresAt <= now) this.candidates.delete(candidateId);
    }
  }

  private expiresAt(): number {
    return this.now() + SEQUENCE_VIEWER_LIMITS.workspace.tokenTtlMs;
  }
}

async function createDependencyDescriptors(
  tracks: ReturnType<typeof parseAndValidateWorkbenchSession>["tracks"],
  plan: PreparedSequenceWorkspaceExport,
  signal?: AbortSignal,
): Promise<Array<SequenceWorkspaceSessionManifest["dependencies"][number]>> {
  const descriptors: Array<
    SequenceWorkspaceSessionManifest["dependencies"][number]
  > = [];
  const paths = new Set<string>();
  const identities = new Set<string>();
  let totalBytes = 0;
  for (const track of tracks) {
    const workspacePath = track.source.workspacePath;
    if (workspacePath == null) continue;
    if (!/^[a-f0-9]{64}$/u.test(track.source.contentHash ?? "")) {
      throw new Error(
        `Workspace track ${track.name} is missing authoritative digest provenance.`,
      );
    }
    if (paths.has(workspacePath)) continue;
    if (descriptors.length >= SEQUENCE_VIEWER_LIMITS.workspace.maxSessionDependencies) {
      throw new Error("The workspace session has too many dependencies.");
    }
    const resolved = await resolveWorkspaceDependency(
      plan.rootPath,
      workspacePath,
    );
    if (resolved.size > MAX_TRACK_DEPENDENCY_BYTES) {
      throw new Error(`Workspace track ${track.name} exceeds its bounded size.`);
    }
    totalBytes += resolved.size;
    if (totalBytes > SEQUENCE_VIEWER_LIMITS.workspace.maxSessionDependencyBytes) {
      throw new Error("Workspace session dependencies exceed the hash budget.");
    }
    const identityKey = `${resolved.identity.device}:${resolved.identity.inode}`;
    if (identities.has(identityKey)) {
      throw new Error("Workspace session dependencies cannot alias one another.");
    }
    identities.add(identityKey);
    const digest = await hashBoundFile(
      resolved.path,
      resolved.identity,
      MAX_TRACK_DEPENDENCY_BYTES,
      signal,
    );
    if (digest !== track.source.contentHash) {
      throw new Error(
        `Workspace track ${track.name} changed before the session was saved.`,
      );
    }
    descriptors.push({
      format: track.format,
      kind: "track",
      name: path.basename(resolved.path),
      required: false,
      sha256: digest,
      size: resolved.size,
      workspacePath,
    });
    paths.add(workspacePath);
  }
  return descriptors;
}

async function listManifestFiles(directoryPath: string): Promise<
  Array<{
    identity: SequenceWorkspaceFileIdentity;
    name: string;
    path: string;
  }>
> {
  const directory = await opendir(directoryPath);
  const entries: Array<{
    identity: SequenceWorkspaceFileIdentity;
    name: string;
    path: string;
  }> = [];
  let observed = 0;
  try {
    for await (const entry of directory) {
      observed += 1;
      if (observed > SEQUENCE_VIEWER_LIMITS.workspace.maxDirectoryEntries) {
        throw new Error("The source directory is too large for session discovery.");
      }
      if (!SESSION_NAME_PATTERN.test(entry.name)) continue;
      const entryPath = path.join(directoryPath, entry.name);
      const fileStat = await lstat(entryPath, { bigint: true }).catch(() => null);
      if (
        fileStat == null ||
        fileStat.isSymbolicLink() ||
        !fileStat.isFile() ||
        fileStat.nlink !== 1n ||
        fileStat.size >
          BigInt(SEQUENCE_VIEWER_LIMITS.workspace.maxSessionManifestBytes)
      ) {
        continue;
      }
      entries.push({
        identity: fileIdentityFromStat(fileStat),
        name: entry.name,
        path: entryPath,
      });
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  return entries;
}

async function readAndValidateManifest(
  filePath: string,
  identity: SequenceWorkspaceFileIdentity,
): Promise<{ manifest: SequenceWorkspaceSessionManifest; sha256: string }> {
  const bytes = await readBoundFile(
    filePath,
    identity,
    SEQUENCE_VIEWER_LIMITS.workspace.maxSessionManifestBytes,
  );
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const manifest = sequenceWorkspaceSessionManifestSchema.parse(JSON.parse(text));
  if (sha256(Buffer.from(manifest.payload, "utf8")) !== manifest.payloadSha256) {
    throw new Error("The workspace session payload digest is inconsistent.");
  }
  const session = parseAndValidateWorkbenchSession(manifest.payload);
  if (session.view.mode !== manifest.mode) {
    throw new Error("The workspace session mode is inconsistent.");
  }
  return { manifest, sha256: sha256(bytes) };
}

function assertManifestSourceBinding(
  manifest: SequenceWorkspaceSessionManifest,
  binding: SequenceWorkspaceSourceBinding,
): void {
  if (
    manifest.source.workspacePath !== binding.sourceWorkspacePath ||
    manifest.source.size !== safeInteger(binding.sourceIdentity.size, "source size")
  ) {
    throw new Error("The workspace session belongs to a different source.");
  }
}

async function inspectDependencies(
  manifest: SequenceWorkspaceSessionManifest,
  binding: SequenceWorkspaceSourceBinding,
  verifyDigest: boolean,
  signal?: AbortSignal,
): Promise<SequenceRestoreWorkspaceSessionResult["dependencies"]> {
  let totalBytes = 0;
  const results: SequenceRestoreWorkspaceSessionResult["dependencies"] = [];
  for (const dependency of manifest.dependencies) {
    throwIfAborted(signal);
    totalBytes += dependency.size;
    if (totalBytes > SEQUENCE_VIEWER_LIMITS.workspace.maxSessionDependencyBytes) {
      throw new Error("Workspace session dependencies exceed the verification budget.");
    }
    let status: "changed" | "matched" | "missing" | "unverified";
    try {
      const resolved = await resolveWorkspaceDependency(
        binding.rootPath,
        dependency.workspacePath,
      );
      if (resolved.size !== dependency.size) {
        status = "changed";
      } else if (!verifyDigest) {
        status = "unverified";
      } else {
        status =
          (await hashBoundFile(
            resolved.path,
            resolved.identity,
            dependency.size,
            signal,
          )) === dependency.sha256
            ? "matched"
            : "changed";
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      status = "missing";
    }
    results.push({
      kind: dependency.kind,
      name: dependency.name,
      required: dependency.required,
      status,
      workspacePath: dependency.workspacePath,
    });
  }
  return results;
}

async function resolveWorkspaceDependency(
  rootPath: string,
  workspacePath: string,
): Promise<{
  identity: SequenceWorkspaceFileIdentity;
  path: string;
  size: number;
}> {
  const candidatePath = path.resolve(rootPath, ...workspacePath.split("/"));
  if (!isPathWithin(rootPath, candidatePath)) {
    throw new Error("Workspace dependency escapes the active root.");
  }
  const canonical = await realpath(candidatePath).catch(() => null);
  if (canonical == null || !sameCanonicalPath(canonical, candidatePath)) {
    throw new Error("Workspace dependency is not a canonical regular file.");
  }
  await assertNoSymlinkComponents(rootPath, path.dirname(canonical));
  const fileStat = await lstat(canonical, { bigint: true });
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    throw new Error("Workspace dependency is not a regular file.");
  }
  if (fileStat.nlink !== 1n) {
    throw new Error("Workspace dependency hardlink aliases are not supported.");
  }
  const identity = fileIdentityFromStat(fileStat);
  return {
    identity,
    path: canonical,
    size: safeInteger(identity.size, "dependency size"),
  };
}

async function hashBoundFile(
  filePath: string,
  identity: SequenceWorkspaceFileIdentity,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  const size = safeInteger(identity.size, "file size");
  if (size > maxBytes) throw new Error("Workspace file exceeds its bounded size.");
  throwIfAborted(signal);
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fileIdentityFromStat(await handle.stat({ bigint: true }));
    if (!sameFileIdentity(before, identity)) {
      throw new Error("Workspace file changed before it could be hashed.");
    }
    const digest = createHash("sha256");
    const chunk = Buffer.alloc(Math.min(1_024 * 1_024, Math.max(1, size)));
    let offset = 0;
    while (offset < size) {
      throwIfAborted(signal);
      const expected = Math.min(chunk.byteLength, size - offset);
      const { bytesRead } = await handle.read(chunk, 0, expected, offset);
      if (bytesRead === 0) throw new Error("Workspace file changed during hash.");
      digest.update(chunk.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const overflow = Buffer.alloc(1);
    if ((await handle.read(overflow, 0, 1, offset)).bytesRead !== 0) {
      throw new Error("Workspace file changed during hash.");
    }
    const after = fileIdentityFromStat(await handle.stat({ bigint: true }));
    const pathIdentity = fileIdentityFromStat(
      await lstat(filePath, { bigint: true }),
    );
    if (
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(after, pathIdentity)
    ) {
      throw new Error("Workspace file changed during hash.");
    }
    return digest.digest("hex");
  } finally {
    await handle.close();
  }
}

async function readBoundFile(
  filePath: string,
  identity: SequenceWorkspaceFileIdentity,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const size = safeInteger(identity.size, "file size");
  if (size > maxBytes) throw new Error("Workspace file exceeds its bounded size.");
  throwIfAborted(signal);
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fileIdentityFromStat(await handle.stat({ bigint: true }));
    if (!sameFileIdentity(before, identity)) {
      throw new Error("Workspace file changed before it could be read.");
    }
    const bytes = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      throwIfAborted(signal);
      const { bytesRead } = await handle.read(bytes, offset, size - offset, offset);
      if (bytesRead === 0) throw new Error("Workspace file changed during read.");
      offset += bytesRead;
    }
    const overflow = Buffer.alloc(1);
    if ((await handle.read(overflow, 0, 1, offset)).bytesRead !== 0) {
      throw new Error("Workspace file changed during read.");
    }
    const after = fileIdentityFromStat(await handle.stat({ bigint: true }));
    const pathIdentity = fileIdentityFromStat(
      await lstat(filePath, { bigint: true }),
    );
    if (
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(after, pathIdentity)
    ) {
      throw new Error("Workspace file changed during read.");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function assertFileIdentity(
  filePath: string,
  identity: SequenceWorkspaceFileIdentity,
): Promise<void> {
  const current = fileIdentityFromStat(await lstat(filePath, { bigint: true }));
  if (!sameFileIdentity(current, identity)) {
    throw new Error("The workspace session changed after discovery.");
  }
}

function fileIdentityFromStat(fileStat: {
  ctimeNs: bigint;
  dev: bigint;
  ino: bigint;
  mtimeNs: bigint;
  nlink: bigint;
  size: bigint;
}): SequenceWorkspaceFileIdentity {
  return {
    changedAtNanoseconds: fileStat.ctimeNs.toString(),
    device: fileStat.dev.toString(),
    inode: fileStat.ino.toString(),
    links: fileStat.nlink.toString(),
    modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
    size: fileStat.size.toString(),
  };
}

function sameFileIdentity(
  left: SequenceWorkspaceFileIdentity,
  right: SequenceWorkspaceFileIdentity,
): boolean {
  return (
    left.changedAtNanoseconds === right.changedAtNanoseconds &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.links === right.links &&
    left.modifiedAtNanoseconds === right.modifiedAtNanoseconds &&
    left.size === right.size
  );
}

async function assertNoSymlinkComponents(
  rootPath: string,
  directoryPath: string,
): Promise<void> {
  const relative = path.relative(rootPath, directoryPath);
  if (relative === "") return;
  let current = rootPath;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    const fileStat = await lstat(current);
    if (fileStat.isSymbolicLink() || !fileStat.isDirectory()) {
      throw new Error("Workspace dependency directories must be real directories.");
    }
  }
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

function sameCanonicalPath(left: string, right: string): boolean {
  const normalize = (value: string) =>
    process.platform === "win32"
      ? path.resolve(value).toLowerCase()
      : path.resolve(value);
  return normalize(left) === normalize(right);
}

function safeInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Workspace ${label} is outside the supported range.`);
  }
  return parsed;
}

function workspaceLabel(relativePath: string): string {
  return relativePath === "" ? "." : relativePath.split(path.sep).join("/");
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw (
    signal.reason ??
    new DOMException("Workspace session operation was cancelled.", "AbortError")
  );
}
