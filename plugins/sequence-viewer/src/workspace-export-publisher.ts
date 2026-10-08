import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  opendir,
  readFile,
  realpath,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ListRootsResultSchema } from "@modelcontextprotocol/sdk/types.js";

import type { RootsRequestExtra } from "./chat-file-resource";
import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { SEQUENCE_VIEWER_VERSION } from "./version";
import type {
  SequenceWorkbenchPayloadDeclaration,
  SequenceWorkspacePublicationMetrics,
} from "./workbench-persistence-protocol";
import { isWorkspaceExportNameForFormat } from "./viewer-operations";
import {
  isSequenceWorkspaceCollisionError,
  publishSequenceWorkspacePair,
  publishSequenceWorkspaceStagedPair,
  SequenceWorkspaceCollisionError,
  type SequenceWorkspaceAtomicHooks,
  type SequenceWorkspaceStagedIdentity,
} from "./workspace-atomic-publisher";
import type {
  SequenceCreateWorkspaceDirectoryInput,
  SequenceCreateWorkspaceDirectoryResult,
  SequenceListWorkspaceDirectoryInput,
  SequenceListWorkspaceDirectoryResult,
} from "./workspace-browser-protocol";
import { isSafeWorkspaceBrowserChildName } from "./workspace-browser-protocol";

type FileIdentity = {
  changedAtNanoseconds: string;
  device: string;
  inode: string;
  links: string;
  modifiedAtNanoseconds: string;
  size: string;
};

type DirectoryIdentity = {
  device: string;
  inode: string;
};

type MutableDirectoryIdentity = DirectoryIdentity & {
  changedAtNanoseconds: string;
  modifiedAtNanoseconds: string;
};

type SourceBinding = {
  bindingId: string;
  rootIdentity: DirectoryIdentity;
  rootPath: string;
  sourceIdentity: FileIdentity;
  sourcePath: string;
  sourceWorkspacePath: string;
};

export type SequenceWorkspaceFileIdentity = FileIdentity;
export type SequenceWorkspaceDirectoryIdentity = DirectoryIdentity;
export type SequenceWorkspaceSourceBinding = SourceBinding;

export type PreparedSequenceWorkspaceExport = {
  bindingId: string;
  collisionPolicy: "exact" | "next-version";
  createdAt: string;
  destinationRelativePath: string;
  format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
  mediaType: string;
  name: string;
  outputPath: string;
  outputWorkspacePath: string;
  parentIdentity: DirectoryIdentity;
  parentPath: string;
  provenance: NonNullable<SequenceWorkbenchPayloadDeclaration["provenance"]>;
  provenancePath: string;
  provenanceWorkspacePath: string;
  rootIdentity: DirectoryIdentity;
  rootPath: string;
  requestedDestinationRelativePath: string;
  requestedName: string;
  sessionId: string;
  sourceIdentity: FileIdentity;
  sourcePath: string;
  sourceSha256: string;
  sourceWorkspacePath: string;
  versionNumber: number;
};

export type SequenceWorkspacePublicationResult = {
  destination: { base: "opened-source"; kind: "workspace" };
  format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
  mediaType: string;
  metrics?: SequenceWorkspacePublicationMetrics;
  name: string;
  outputWorkspacePath: string;
  provenanceWorkspacePath: string;
  sha256: string;
  size: number;
  version: 1;
};

export type SequenceWorkspaceExportPublisherOptions = {
  atomicHooks?: SequenceWorkspaceAtomicHooks;
  now?: () => number;
};

export function safeSequenceWorkspacePublicationError(error: unknown): Error {
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return error;
  }
  if (isSequenceWorkspaceCollisionError(error)) return error;
  if (
    error instanceof Error &&
    !("code" in error) &&
    !(error instanceof AggregateError)
  ) {
    return error;
  }
  return new Error(
    "Workspace publication could not safely access the source or destination.",
  );
}

export class SequenceWorkspaceExportPublisher {
  private readonly bindings = new Map<string, SourceBinding>();
  private readonly atomicHooks?: SequenceWorkspaceAtomicHooks;
  private readonly now: () => number;

  constructor({
    atomicHooks,
    now = Date.now,
  }: SequenceWorkspaceExportPublisherOptions = {}) {
    this.atomicHooks = atomicHooks;
    this.now = now;
  }

  async bindSession(
    sessionId: string,
    sourcePath: string,
    extra: RootsRequestExtra,
  ): Promise<boolean> {
    this.bindings.delete(sessionId);
    const binding = await resolveSourceBinding(sourcePath, extra);
    if (binding == null) return false;
    while (this.bindings.size >= 256) {
      const oldest = this.bindings.keys().next().value as string | undefined;
      if (oldest == null) break;
      this.bindings.delete(oldest);
    }
    this.bindings.set(sessionId, binding);
    return true;
  }

  clearSession(sessionId: string): void {
    this.bindings.delete(sessionId);
  }

  async listDirectory(
    input: SequenceListWorkspaceDirectoryInput,
    extra?: RootsRequestExtra,
  ): Promise<SequenceListWorkspaceDirectoryResult> {
    const binding = this.bindings.get(input.sessionId);
    if (binding == null) throw workspaceCapabilityUnavailableError();
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    const directory = await resolveBrowserDirectory(binding, input.directory);
    const directoryIdentity = await readDirectoryIdentity(directory.path);
    const snapshot = await readDirectorySnapshot(directory.path);
    const offset = parseDirectoryCursor(input.cursor, {
      bindingId: binding.bindingId,
      directoryWorkspacePath: directory.workspacePath,
      fingerprint: snapshot.fingerprint,
    }, snapshot.entries.length);
    const entries = snapshot.entries
      .slice(offset, offset + input.limit)
      .map((entry) => ({
        ...entry,
        relativePath: sourceRelativePath(
          binding,
          path.join(directory.path, entry.name),
        ),
      }));
    const nextOffset = offset + entries.length;
    const candidate =
      input.candidate == null
        ? undefined
        : await inspectWorkspaceCandidate({
            binding,
            directoryPath: directory.path,
            format: input.candidate.format,
            name: input.candidate.name,
          });
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    await assertDirectoryCurrent(directory.path, directoryIdentity);
    return {
      candidate,
      directory: {
        breadcrumbs: createBrowserBreadcrumbs(binding, directory.path),
        parentRelativePath:
          sameCanonicalPath(directory.path, binding.rootPath)
            ? undefined
            : sourceRelativePath(binding, path.dirname(directory.path)),
        relativePath: sourceRelativePath(binding, directory.path),
        sourceDirectoryWorkspacePath: workspaceLabel(
          path.relative(binding.rootPath, path.dirname(binding.sourcePath)),
        ),
        workspacePath: directory.workspacePath,
      },
      entries,
      nextCursor:
        nextOffset < snapshot.entries.length
          ? createDirectoryCursor({
              bindingId: binding.bindingId,
              directoryWorkspacePath: directory.workspacePath,
              fingerprint: snapshot.fingerprint,
              offset: nextOffset,
            })
          : undefined,
      omittedEntries: snapshot.omittedEntries,
    };
  }

  async createDirectory(
    input: SequenceCreateWorkspaceDirectoryInput,
    extra?: RootsRequestExtra,
  ): Promise<SequenceCreateWorkspaceDirectoryResult> {
    const binding = this.bindings.get(input.sessionId);
    if (binding == null) throw workspaceCapabilityUnavailableError();
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    const parent = await resolveBrowserDirectory(
      binding,
      input.parentDirectory,
    );
    const parentIdentity = await readDirectoryIdentity(parent.path);
    const directoryPath = path.join(parent.path, input.name);
    if (!isPathWithin(binding.rootPath, directoryPath)) {
      throw new Error("The workspace directory destination escapes its root.");
    }
    let createdIdentity: MutableDirectoryIdentity | undefined;
    try {
      await mkdir(directoryPath, { mode: 0o700 });
      createdIdentity = await readMutableDirectoryIdentity(directoryPath);
      await assertDirectoryCurrent(parent.path, parentIdentity);
      await assertNoSymlinkComponents(binding.rootPath, directoryPath);
      await assertRootStillActive(binding, extra);
      await assertBindingCurrent(binding);
      return {
        name: input.name,
        relativePath: sourceRelativePath(binding, directoryPath),
        workspacePath: workspaceLabel(
          path.relative(binding.rootPath, directoryPath),
        ),
      };
    } catch (error) {
      if (createdIdentity != null) {
        await removeCreatedDirectoryIfUnchanged(
          directoryPath,
          createdIdentity,
        ).catch(() => undefined);
      }
      if (isNodeError(error, "EEXIST")) {
        throw new SequenceWorkspaceCollisionError(
          "A workspace entry with that folder name already exists.",
        );
      }
      throw error;
    }
  }

  async preflight(
    {
      destination,
      format: inputFormat,
      kind,
      name,
      sessionId,
    }: {
      destination: {
        base: "opened-source";
        collisionPolicy?: "exact" | "next-version";
        kind: "workspace";
        relativePath: string;
      };
      format?: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
      kind?: "artifact" | "session";
      name: string;
      sessionId: string;
    },
    extra?: RootsRequestExtra,
  ): Promise<string> {
    const binding = this.bindings.get(sessionId);
    if (binding == null) throw workspaceCapabilityUnavailableError();
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    const format = kind === "session" ? "json" : inputFormat;
    if (format == null) {
      throw new Error("The workspace export format is incomplete.");
    }
    await resolveRequestedDestination({
      binding,
      collisionPolicy: destination.collisionPolicy ?? "exact",
      format,
      name,
      relativePath: destination.relativePath,
    });
    return binding.bindingId;
  }

  async assertSourceBinding(
    sessionId: string,
    bindingId: string,
    extra?: RootsRequestExtra,
  ): Promise<void> {
    const binding = this.bindings.get(sessionId);
    if (binding == null || binding.bindingId !== bindingId) {
      throw workspaceCapabilityUnavailableError();
    }
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
  }

  async assertSessionSourceActive(
    sessionId: string,
    extra?: RootsRequestExtra,
  ): Promise<void> {
    const binding = this.bindings.get(sessionId);
    if (binding == null) throw workspaceCapabilityUnavailableError();
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
  }

  async getActiveSourceBinding(
    sessionId: string,
    extra?: RootsRequestExtra,
  ): Promise<SequenceWorkspaceSourceBinding> {
    const binding = this.bindings.get(sessionId);
    if (binding == null) throw workspaceCapabilityUnavailableError();
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    return {
      ...binding,
      rootIdentity: { ...binding.rootIdentity },
      sourceIdentity: { ...binding.sourceIdentity },
    };
  }

  async prepare(
    input: SequenceWorkbenchPayloadDeclaration,
    signal?: AbortSignal,
    extra?: RootsRequestExtra,
  ): Promise<PreparedSequenceWorkspaceExport | undefined> {
    if (input.destination.kind !== "workspace") {
      return undefined;
    }
    const binding = this.bindings.get(input.sessionId);
    if (binding == null) throw workspaceCapabilityUnavailableError();
    const workspaceSession = input.kind === "session";
    if (
      !workspaceSession &&
      (input.format == null || input.mediaType == null || input.provenance == null)
    ) {
      throw new Error("The workspace export declaration is incomplete.");
    }
    const format = workspaceSession ? "json" : input.format!;
    const mediaType = workspaceSession ? "application/json" : input.mediaType!;
    const provenance = workspaceSession
      ? {
          engine: "sequence-viewer-workspace-session-v1",
          parameters: { kind: "durable-session" },
          sourceRevision: 0,
        }
      : input.provenance!;
    throwIfAborted(signal);
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    const collisionPolicy = input.destination.collisionPolicy ?? "exact";
    const destination = await resolveRequestedDestination({
      binding,
      collisionPolicy,
      format,
      name: input.name,
      relativePath: input.destination.relativePath,
    });
    throwIfAborted(signal);
    const sourceSha256 = await hashBoundSource(binding, signal);
    throwIfAborted(signal);
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    return {
      ...destination,
      bindingId: binding.bindingId,
      collisionPolicy,
      createdAt: new Date(this.now()).toISOString(),
      format,
      mediaType,
      provenance,
      requestedDestinationRelativePath: input.destination.relativePath,
      requestedName: input.name,
      rootIdentity: binding.rootIdentity,
      rootPath: binding.rootPath,
      sessionId: input.sessionId,
      sourceIdentity: binding.sourceIdentity,
      sourcePath: binding.sourcePath,
      sourceSha256,
      sourceWorkspacePath: binding.sourceWorkspacePath,
    };
  }

  async assertPlanCurrent(
    plan: PreparedSequenceWorkspaceExport | undefined,
    extra?: RootsRequestExtra,
  ): Promise<void> {
    if (plan == null) return;
    await this.revalidatePlan(plan, "unpublished", undefined, extra);
  }

  async publish(
    plan: PreparedSequenceWorkspaceExport,
    artifact: Uint8Array,
    declaredSha256: string,
    signal: AbortSignal,
    extra?: RootsRequestExtra,
  ): Promise<SequenceWorkspacePublicationResult> {
    if (sha256(artifact) !== declaredSha256) {
      throw new Error("The staged workspace export digest is inconsistent.");
    }
    const maximumAttempt =
      plan.collisionPolicy === "next-version"
        ? SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts
        : plan.versionNumber;
    let candidatePlan = plan;
    for (
      let attempt = plan.versionNumber;
      attempt <= maximumAttempt;
      attempt += 1
    ) {
      throwIfAborted(signal);
      try {
        if (attempt !== candidatePlan.versionNumber) {
          candidatePlan = await this.resolveVersionedPlan(plan, attempt, extra);
        }
        const sidecar = createWorkspaceSidecar(
          candidatePlan,
          artifact.byteLength,
          declaredSha256,
        );
        await this.revalidatePlan(candidatePlan, "unpublished", undefined, extra);
        await publishSequenceWorkspacePair({
          artifact,
          artifactPath: candidatePlan.outputPath,
          hooks: {
            beforeArtifactLink: async () => {
              await this.revalidatePlan(
                candidatePlan,
                "unpublished",
                undefined,
                extra,
              );
              await this.atomicHooks?.beforeArtifactLink?.();
              await this.revalidatePlan(
                candidatePlan,
                "unpublished",
                undefined,
                extra,
              );
            },
            beforeCommit: async () => {
              await this.revalidatePlan(candidatePlan, "published", {
                artifactSha256: declaredSha256,
                artifactSize: artifact.byteLength,
                sidecar,
              }, extra);
            },
            beforeSidecarLink: async () => {
              await this.revalidatePlan(candidatePlan, "artifact-published", {
                artifactSha256: declaredSha256,
                artifactSize: artifact.byteLength,
              }, extra);
              await this.atomicHooks?.beforeSidecarLink?.();
              await this.revalidatePlan(candidatePlan, "artifact-published", {
                artifactSha256: declaredSha256,
                artifactSize: artifact.byteLength,
              }, extra);
            },
          },
          sidecar,
          sidecarPath: candidatePlan.provenancePath,
          signal,
        });
        await this.revalidatePlan(candidatePlan, "published", {
          artifactSha256: declaredSha256,
          artifactSize: artifact.byteLength,
          sidecar,
        }, extra);
        Object.assign(plan, candidatePlan);
        return {
          destination: { base: "opened-source", kind: "workspace" },
          format: candidatePlan.format,
          mediaType: candidatePlan.mediaType,
          name: candidatePlan.name,
          outputWorkspacePath: candidatePlan.outputWorkspacePath,
          provenanceWorkspacePath: candidatePlan.provenanceWorkspacePath,
          sha256: declaredSha256,
          size: artifact.byteLength,
          version: 1,
        };
      } catch (error) {
        if (
          plan.collisionPolicy !== "next-version" ||
          !isSequenceWorkspaceCollisionError(error)
        ) {
          throw error;
        }
      }
    }
    throw new Error(
      `No available workspace export version was found within ${SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts} attempts.`,
    );
  }

  async publishStaged(
    plan: PreparedSequenceWorkspaceExport,
    stagedArtifactPath: string,
    stagedIdentity: SequenceWorkspaceStagedIdentity,
    artifactSize: number,
    declaredSha256: string,
    metrics: SequenceWorkspacePublicationMetrics,
    signal: AbortSignal,
    extra?: RootsRequestExtra,
  ): Promise<SequenceWorkspacePublicationResult> {
    const publishStartedAt = Date.now();
    const staged = await lstat(stagedArtifactPath, { bigint: true });
    if (
      staged.isSymbolicLink() ||
      !staged.isFile() ||
      staged.dev.toString() !== stagedIdentity.device ||
      staged.ino.toString() !== stagedIdentity.inode ||
      staged.ctimeNs.toString() !== stagedIdentity.changedAtNanoseconds ||
      staged.mtimeNs.toString() !== stagedIdentity.modifiedAtNanoseconds ||
      staged.size.toString() !== stagedIdentity.size ||
      Number(staged.size) !== artifactSize ||
      (await hashFile(stagedArtifactPath, signal)) !== declaredSha256
    ) {
      throw new Error("The staged workspace export is inconsistent.");
    }
    const maximumAttempt =
      plan.collisionPolicy === "next-version"
        ? SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts
        : plan.versionNumber;
    let candidatePlan = plan;
    for (
      let attempt = plan.versionNumber;
      attempt <= maximumAttempt;
      attempt += 1
    ) {
      throwIfAborted(signal);
      try {
        if (attempt !== candidatePlan.versionNumber) {
          candidatePlan = await this.resolveVersionedPlan(plan, attempt, extra);
        }
        if (!sameCanonicalPath(path.dirname(stagedArtifactPath), candidatePlan.parentPath)) {
          throw new Error("Workspace staging is not local to the selected destination.");
        }
        const sidecar = createWorkspaceSidecar(
          candidatePlan,
          artifactSize,
          declaredSha256,
        );
        await this.revalidatePlan(candidatePlan, "unpublished", undefined, extra);
        await publishSequenceWorkspaceStagedPair({
          artifactPath: candidatePlan.outputPath,
          hooks: {
            beforeArtifactLink: async () => {
              await this.revalidatePlan(candidatePlan, "unpublished", undefined, extra);
              await this.atomicHooks?.beforeArtifactLink?.();
              await this.revalidatePlan(candidatePlan, "unpublished", undefined, extra);
            },
            beforeCommit: async () => {
              await this.revalidatePlan(candidatePlan, "published", {
                artifactSha256: declaredSha256,
                artifactSize,
                sidecar,
              }, extra);
            },
            beforeSidecarLink: async () => {
              await this.revalidatePlan(candidatePlan, "artifact-published", {
                artifactSha256: declaredSha256,
                artifactSize,
              }, extra);
              await this.atomicHooks?.beforeSidecarLink?.();
              await this.revalidatePlan(candidatePlan, "artifact-published", {
                artifactSha256: declaredSha256,
                artifactSize,
              }, extra);
            },
          },
          sidecar,
          sidecarPath: candidatePlan.provenancePath,
          signal,
          stagedArtifactPath,
          stagedIdentity,
        });
        await this.revalidatePlan(candidatePlan, "published", {
          artifactSha256: declaredSha256,
          artifactSize,
          sidecar,
        }, extra);
        Object.assign(plan, candidatePlan);
        metrics.elapsedMs.publish = Math.max(0, Date.now() - publishStartedAt);
        metrics.elapsedMs.total += metrics.elapsedMs.publish;
        return {
          destination: { base: "opened-source", kind: "workspace" },
          format: candidatePlan.format,
          mediaType: candidatePlan.mediaType,
          metrics,
          name: candidatePlan.name,
          outputWorkspacePath: candidatePlan.outputWorkspacePath,
          provenanceWorkspacePath: candidatePlan.provenanceWorkspacePath,
          sha256: declaredSha256,
          size: artifactSize,
          version: 1,
        };
      } catch (error) {
        if (
          plan.collisionPolicy !== "next-version" ||
          !isSequenceWorkspaceCollisionError(error)
        ) {
          throw error;
        }
      }
    }
    throw new Error(
      `No available workspace export version was found within ${SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts} attempts.`,
    );
  }

  private async resolveVersionedPlan(
    plan: PreparedSequenceWorkspaceExport,
    versionNumber: number,
    extra?: RootsRequestExtra,
  ): Promise<PreparedSequenceWorkspaceExport> {
    const binding = this.bindings.get(plan.sessionId);
    if (binding == null || binding.bindingId !== plan.bindingId) {
      throw workspaceCapabilityUnavailableError();
    }
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    const name = versionedWorkspaceName(plan.requestedName, versionNumber);
    const relativePath = replaceWorkspaceDestinationName(
      plan.requestedDestinationRelativePath,
      name,
    );
    return {
      ...plan,
      ...(await resolveDestination({
        binding,
        format: plan.format,
        name,
        relativePath,
      })),
      destinationRelativePath: relativePath,
      name,
      versionNumber,
    };
  }

  async revalidateCompleted(
    plan: PreparedSequenceWorkspaceExport | undefined,
    result: SequenceWorkspacePublicationResult | undefined,
    extra?: RootsRequestExtra,
  ): Promise<void> {
    if (plan == null) return;
    if (
      result == null ||
      result.outputWorkspacePath !== plan.outputWorkspacePath ||
      result.provenanceWorkspacePath !== plan.provenanceWorkspacePath
    ) {
      throw new Error("The completed workspace export binding is inconsistent.");
    }
    const sidecar = createWorkspaceSidecar(plan, result.size, result.sha256);
    await this.revalidatePlan(plan, "published", {
      artifactSha256: result.sha256,
      artifactSize: result.size,
      sidecar,
    }, extra);
  }

  private async revalidatePlan(
    plan: PreparedSequenceWorkspaceExport,
    state: "artifact-published" | "published" | "unpublished",
    published?: {
      artifactSha256: string;
      artifactSize: number;
      sidecar?: string;
    },
    extra?: RootsRequestExtra,
  ): Promise<void> {
    const binding = this.bindings.get(plan.sessionId);
    if (binding == null || binding.bindingId !== plan.bindingId) {
      throw workspaceCapabilityUnavailableError();
    }
    await assertRootStillActive(binding, extra);
    await assertBindingCurrent(binding);
    if (
      !sameDirectoryIdentity(binding.rootIdentity, plan.rootIdentity) ||
      !sameFileIdentity(binding.sourceIdentity, plan.sourceIdentity)
    ) {
      throw new Error("The workspace source binding changed before publication.");
    }
    await assertDirectoryCurrent(plan.parentPath, plan.parentIdentity);
    await assertNoSymlinkComponents(plan.rootPath, plan.parentPath);
    if (state === "unpublished") {
      await assertMissing(plan.outputPath);
      await assertMissing(plan.provenancePath);
      return;
    }
    if (published == null) {
      throw new Error("The published workspace export metadata is missing.");
    }
    await assertPublishedArtifact(
      plan.outputPath,
      plan.sourceIdentity,
      published.artifactSize,
      published.artifactSha256,
    );
    if (state === "artifact-published") {
      await assertMissing(plan.provenancePath);
      return;
    }
    const sidecarStat = await lstat(plan.provenancePath, { bigint: true });
    if (sidecarStat.isSymbolicLink() || !sidecarStat.isFile()) {
      throw new Error("The workspace provenance sidecar is not a regular file.");
    }
    if (
      published.sidecar == null ||
      (await readFile(plan.provenancePath, "utf8")) !== published.sidecar
    ) {
      throw new Error("The workspace provenance sidecar changed after publication.");
    }
  }
}

async function resolveSourceBinding(
  sourcePath: string,
  extra: RootsRequestExtra,
): Promise<SourceBinding | null> {
  if (!path.isAbsolute(sourcePath)) return null;
  const roots = await listCanonicalWorkspaceRoots(extra);
  if (roots.length === 0) return null;
  let canonicalSource: string;
  try {
    canonicalSource = await realpath(sourcePath);
  } catch {
    return null;
  }
  const rootPath = roots
    .filter((root) => isPathWithin(root, canonicalSource))
    .sort((left, right) => right.length - left.length)[0];
  if (rootPath == null) return null;
  try {
    const [sourceIdentity, rootIdentity] = await Promise.all([
      readFileIdentity(canonicalSource),
      readDirectoryIdentity(rootPath),
    ]);
    return {
      bindingId: randomUUID(),
      rootIdentity,
      rootPath,
      sourceIdentity,
      sourcePath: canonicalSource,
      sourceWorkspacePath: toWorkspacePath(
        path.relative(rootPath, canonicalSource),
      ),
    };
  } catch {
    return null;
  }
}

async function listCanonicalWorkspaceRoots(
  extra: RootsRequestExtra,
): Promise<Array<string>> {
  let result: { roots: Array<{ uri: string }> };
  try {
    result = await extra.sendRequest(
      { method: "roots/list" },
      ListRootsResultSchema,
    );
  } catch {
    return [];
  }
  const roots = await Promise.all(
    result.roots.map(async ({ uri }) => {
      if (!uri.startsWith("file://")) return null;
      try {
        return await realpath(fileURLToPath(uri));
      } catch {
        return null;
      }
    }),
  );
  return [...new Set(roots.filter((root): root is string => root != null))];
}

async function assertRootStillActive(
  binding: SourceBinding,
  extra?: RootsRequestExtra,
): Promise<void> {
  if (extra == null) return;
  const roots = await listCanonicalWorkspaceRoots(extra);
  const deepestRoot = roots
    .filter((root) => isPathWithin(root, binding.sourcePath))
    .sort((left, right) => right.length - left.length)[0];
  if (
    deepestRoot == null ||
    !sameCanonicalPath(deepestRoot, binding.rootPath)
  ) {
    throw new Error(
      "The workspace source is no longer inside the same active workspace root.",
    );
  }
}

async function resolveRequestedDestination({
  binding,
  collisionPolicy,
  format,
  name,
  relativePath,
}: {
  binding: SourceBinding;
  collisionPolicy: "exact" | "next-version";
  format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
  name: string;
  relativePath: string;
}): Promise<
  Pick<
    PreparedSequenceWorkspaceExport,
    | "destinationRelativePath"
    | "name"
    | "outputPath"
    | "outputWorkspacePath"
    | "parentIdentity"
    | "parentPath"
    | "provenancePath"
    | "provenanceWorkspacePath"
    | "versionNumber"
  >
> {
  const maximumAttempt =
    collisionPolicy === "next-version"
      ? SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts
      : 1;
  for (let attempt = 1; attempt <= maximumAttempt; attempt += 1) {
    const candidateName = versionedWorkspaceName(name, attempt);
    const candidateRelativePath = replaceWorkspaceDestinationName(
      relativePath,
      candidateName,
    );
    try {
      return {
        ...(await resolveDestination({
          binding,
          format,
          name: candidateName,
          relativePath: candidateRelativePath,
        })),
        destinationRelativePath: candidateRelativePath,
        name: candidateName,
        versionNumber: attempt,
      };
    } catch (error) {
      if (
        collisionPolicy !== "next-version" ||
        !isSequenceWorkspaceCollisionError(error)
      ) {
        throw error;
      }
    }
  }
  throw new Error(
    `No available workspace export version was found within ${SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts} attempts.`,
  );
}

function versionedWorkspaceName(name: string, attempt: number): string {
  if (attempt === 1) return name;
  const extensionIndex = name.lastIndexOf(".");
  if (extensionIndex <= 0) return `${name}-${attempt}`;
  return `${name.slice(0, extensionIndex)}-${attempt}${name.slice(
    extensionIndex,
  )}`;
}

function replaceWorkspaceDestinationName(
  relativePath: string,
  name: string,
): string {
  const directory = path.posix.dirname(relativePath);
  return directory === "." ? name : `${directory}/${name}`;
}

async function resolveBrowserDirectory(
  binding: SourceBinding,
  relativePath: string,
): Promise<{ path: string; workspacePath: string }> {
  const sourceDirectory = path.dirname(binding.sourcePath);
  const requestedPath = path.resolve(
    sourceDirectory,
    ...relativePath.split("/"),
  );
  if (!isPathWithin(binding.rootPath, requestedPath)) {
    throw new Error("The workspace directory escapes the active workspace root.");
  }
  const canonicalPath = await realpath(requestedPath).catch(() => null);
  if (
    canonicalPath == null ||
    !sameCanonicalPath(canonicalPath, requestedPath) ||
    !isPathWithin(binding.rootPath, canonicalPath)
  ) {
    throw new Error(
      "Workspace browsing requires an existing real directory inside the active root.",
    );
  }
  await assertNoSymlinkComponents(binding.rootPath, canonicalPath);
  await readDirectoryIdentity(canonicalPath);
  return {
    path: canonicalPath,
    workspacePath: workspaceLabel(path.relative(binding.rootPath, canonicalPath)),
  };
}

async function readDirectorySnapshot(directoryPath: string): Promise<{
  entries: Array<{
    kind: "directory" | "file";
    name: string;
    size?: number;
  }>;
  fingerprint: string;
  omittedEntries: number;
}> {
  const before = await readMutableDirectoryIdentity(directoryPath);
  const directory = await opendir(directoryPath);
  const entries: Array<{
    kind: "directory" | "file";
    name: string;
    size?: number;
  }> = [];
  let observedEntries = 0;
  let omittedEntries = 0;
  try {
    for await (const entry of directory) {
      observedEntries += 1;
      if (
        observedEntries > SEQUENCE_VIEWER_LIMITS.workspace.maxDirectoryEntries
      ) {
        throw new Error(
          `This directory contains more than ${SEQUENCE_VIEWER_LIMITS.workspace.maxDirectoryEntries.toLocaleString()} entries and cannot be browsed safely.`,
        );
      }
      if (!isSafeWorkspaceBrowserChildName(entry.name)) {
        omittedEntries += 1;
        continue;
      }
      const entryPath = path.join(directoryPath, entry.name);
      const fileStat = await lstat(entryPath, { bigint: true }).catch(() => null);
      if (
        fileStat == null ||
        fileStat.isSymbolicLink() ||
        (!fileStat.isDirectory() && !fileStat.isFile())
      ) {
        omittedEntries += 1;
        continue;
      }
      const size = Number(fileStat.size);
      if (!Number.isSafeInteger(size) || size < 0) {
        omittedEntries += 1;
        continue;
      }
      entries.push({
        kind: fileStat.isDirectory() ? "directory" : "file",
        name: entry.name,
        size: fileStat.isFile() ? size : undefined,
      });
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
  const after = await readMutableDirectoryIdentity(directoryPath);
  if (!sameMutableDirectoryIdentity(before, after)) {
    throw new Error("The workspace directory changed while it was being listed.");
  }
  entries.sort((left, right) =>
    left.name === right.name ? 0 : left.name < right.name ? -1 : 1,
  );
  return {
    entries,
    fingerprint: sha256(Buffer.from(JSON.stringify(entries))),
    omittedEntries,
  };
}

async function inspectWorkspaceCandidate({
  binding,
  directoryPath,
  format,
  name,
}: {
  binding: SourceBinding;
  directoryPath: string;
  format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
  name: string;
}): Promise<NonNullable<SequenceListWorkspaceDirectoryResult["candidate"]>> {
  assertFormatExtension(format, name);
  if (Buffer.byteLength(`${name}.provenance.json`, "utf8") > 255) {
    throw new Error(
      "The workspace export filename is too long for its provenance sidecar.",
    );
  }
  const directoryRelativePath = sourceRelativePath(binding, directoryPath);
  const requestedRelativePath =
    directoryRelativePath === "."
      ? name
      : `${directoryRelativePath.replace(/\/$/u, "")}/${name}`;
  const exactWorkspacePath = workspaceLabel(
    path.relative(binding.rootPath, path.join(directoryPath, name)),
  );
  let exactAvailable = false;
  let nextVersionName: string | undefined;
  let nextVersionWorkspacePath: string | undefined;
  for (
    let attempt = 1;
    attempt <= SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts;
    attempt += 1
  ) {
    const candidateName = versionedWorkspaceName(name, attempt);
    try {
      const resolved = await resolveDestination({
        binding,
        format,
        name: candidateName,
        relativePath: replaceWorkspaceDestinationName(
          requestedRelativePath,
          candidateName,
        ),
      });
      if (attempt === 1) exactAvailable = true;
      nextVersionName = candidateName;
      nextVersionWorkspacePath = resolved.outputWorkspacePath;
      break;
    } catch (error) {
      if (!isSequenceWorkspaceCollisionError(error)) throw error;
    }
  }
  return {
    exactAvailable,
    exactWorkspacePath,
    name,
    nextVersionName,
    nextVersionWorkspacePath,
  };
}

type DirectoryCursor = {
  bindingId: string;
  directoryWorkspacePath: string;
  fingerprint: string;
  offset: number;
};

function createDirectoryCursor(cursor: DirectoryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function parseDirectoryCursor(
  cursor: string | undefined,
  expected: Omit<DirectoryCursor, "offset">,
  entryCount: number,
): number {
  if (cursor == null) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as
      Partial<DirectoryCursor>;
    if (
      parsed.bindingId !== expected.bindingId ||
      parsed.directoryWorkspacePath !== expected.directoryWorkspacePath ||
      parsed.fingerprint !== expected.fingerprint ||
      !Number.isInteger(parsed.offset) ||
      (parsed.offset as number) < 0 ||
      (parsed.offset as number) >= entryCount
    ) {
      throw new Error("Invalid cursor.");
    }
    return parsed.offset as number;
  } catch {
    throw new Error(
      "The workspace directory cursor is stale or invalid. Refresh the listing.",
    );
  }
}

function sourceRelativePath(binding: SourceBinding, candidate: string): string {
  const relative = path.relative(path.dirname(binding.sourcePath), candidate);
  return relative === "" ? "." : toWorkspacePath(relative);
}

function createBrowserBreadcrumbs(
  binding: SourceBinding,
  directoryPath: string,
): Array<{ label: string; relativePath: string; workspacePath: string }> {
  const breadcrumbs = [
    {
      label: "Workspace",
      relativePath: sourceRelativePath(binding, binding.rootPath),
      workspacePath: ".",
    },
  ];
  const relative = path.relative(binding.rootPath, directoryPath);
  if (relative === "") return breadcrumbs;
  let current = binding.rootPath;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    breadcrumbs.push({
      label: component,
      relativePath: sourceRelativePath(binding, current),
      workspacePath: workspaceLabel(path.relative(binding.rootPath, current)),
    });
  }
  return breadcrumbs;
}

function workspaceLabel(relativePath: string): string {
  return relativePath === "" ? "." : toWorkspacePath(relativePath);
}

async function readMutableDirectoryIdentity(
  directoryPath: string,
): Promise<MutableDirectoryIdentity> {
  const fileStat = await lstat(directoryPath, { bigint: true });
  if (fileStat.isSymbolicLink() || !fileStat.isDirectory()) {
    throw new Error("The workspace browser target is not a real directory.");
  }
  return {
    changedAtNanoseconds: fileStat.ctimeNs.toString(),
    device: fileStat.dev.toString(),
    inode: fileStat.ino.toString(),
    modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
  };
}

function sameMutableDirectoryIdentity(
  left: MutableDirectoryIdentity,
  right: MutableDirectoryIdentity,
): boolean {
  return (
    left.changedAtNanoseconds === right.changedAtNanoseconds &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.modifiedAtNanoseconds === right.modifiedAtNanoseconds
  );
}

async function removeCreatedDirectoryIfUnchanged(
  directoryPath: string,
  expected: MutableDirectoryIdentity,
): Promise<void> {
  const current = await readMutableDirectoryIdentity(directoryPath);
  if (sameMutableDirectoryIdentity(current, expected)) {
    await rmdir(directoryPath);
  }
}

async function resolveDestination({
  binding,
  format,
  name,
  relativePath,
}: {
  binding: SourceBinding;
  format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
  name: string;
  relativePath: string;
}): Promise<
  Pick<
    PreparedSequenceWorkspaceExport,
    | "outputPath"
    | "outputWorkspacePath"
    | "parentIdentity"
    | "parentPath"
    | "provenancePath"
    | "provenanceWorkspacePath"
  >
> {
  const sourceDirectory = path.dirname(binding.sourcePath);
  const outputPath = path.resolve(sourceDirectory, ...relativePath.split("/"));
  if (!isPathWithin(binding.rootPath, outputPath)) {
    throw new Error("The workspace export destination escapes the active workspace root.");
  }
  if (sameCanonicalPath(outputPath, binding.sourcePath)) {
    throw new SequenceWorkspaceCollisionError(
      "A workspace export cannot replace its opened source.",
    );
  }
  if (path.basename(outputPath) !== name) {
    throw new Error("The workspace export filename does not match its destination.");
  }
  if (Buffer.byteLength(`${name}.provenance.json`, "utf8") > 255) {
    throw new Error(
      "The workspace export filename is too long for its provenance sidecar.",
    );
  }
  assertFormatExtension(format, name);
  const requestedParent = path.dirname(outputPath);
  let parentPath: string;
  try {
    parentPath = await realpath(requestedParent);
  } catch {
    throw new Error("The workspace export parent directory must already exist.");
  }
  if (!sameCanonicalPath(requestedParent, parentPath)) {
    throw new Error("Workspace export parent directories cannot use symbolic links or junctions.");
  }
  if (!isPathWithin(binding.rootPath, parentPath)) {
    throw new Error("The workspace export destination escapes the active workspace root.");
  }
  await assertNoSymlinkComponents(binding.rootPath, parentPath);
  const parentIdentity = await readDirectoryIdentity(parentPath);
  const canonicalOutputPath = path.join(parentPath, name);
  const provenancePath = `${canonicalOutputPath}.provenance.json`;
  await assertMissing(canonicalOutputPath);
  await assertMissing(provenancePath);
  return {
    outputPath: canonicalOutputPath,
    outputWorkspacePath: toWorkspacePath(
      path.relative(binding.rootPath, canonicalOutputPath),
    ),
    parentIdentity,
    parentPath,
    provenancePath,
    provenanceWorkspacePath: toWorkspacePath(
      path.relative(binding.rootPath, provenancePath),
    ),
  };
}

async function assertBindingCurrent(binding: SourceBinding): Promise<void> {
  const [currentRootPath, currentSourcePath] = await Promise.all([
    realpath(binding.rootPath),
    realpath(binding.sourcePath),
  ]).catch(() => {
    throw new Error("The workspace source or root is no longer available.");
  });
  if (
    !sameCanonicalPath(currentRootPath, binding.rootPath) ||
    !sameCanonicalPath(currentSourcePath, binding.sourcePath) ||
    !isPathWithin(currentRootPath, currentSourcePath)
  ) {
    throw new Error("The workspace source or root changed before publication.");
  }
  const [rootIdentity, sourceIdentity] = await Promise.all([
    readDirectoryIdentity(currentRootPath),
    readFileIdentity(currentSourcePath),
  ]);
  if (
    !sameDirectoryIdentity(rootIdentity, binding.rootIdentity) ||
    !sameFileIdentity(sourceIdentity, binding.sourceIdentity)
  ) {
    throw new Error("The workspace source or root changed before publication.");
  }
}

async function assertDirectoryCurrent(
  directory: string,
  expected: DirectoryIdentity,
): Promise<void> {
  const canonical = await realpath(directory).catch(() => null);
  if (canonical == null || !sameCanonicalPath(canonical, directory)) {
    throw new Error("The workspace export parent changed before publication.");
  }
  const actual = await readDirectoryIdentity(directory);
  if (!sameDirectoryIdentity(actual, expected)) {
    throw new Error("The workspace export parent changed before publication.");
  }
}

async function assertNoSymlinkComponents(
  rootPath: string,
  directory: string,
): Promise<void> {
  const relative = path.relative(rootPath, directory);
  if (relative === "") return;
  let current = rootPath;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    const fileStat = await lstat(current);
    if (fileStat.isSymbolicLink() || !fileStat.isDirectory()) {
      throw new Error("Workspace export parent directories must be real directories.");
    }
  }
}

async function hashBoundSource(
  binding: SourceBinding,
  signal?: AbortSignal,
): Promise<string> {
  const handle = await open(
    binding.sourcePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const before = fileIdentityFromStat(await handle.stat({ bigint: true }));
    if (!sameFileIdentity(before, binding.sourceIdentity)) {
      throw new Error("The workspace source changed before publication.");
    }
    const sourceSize = Number(before.size);
    if (!Number.isSafeInteger(sourceSize) || sourceSize < 0) {
      throw new Error("The workspace source is too large to verify safely.");
    }
    const digest = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let offset = 0;
    while (offset < sourceSize) {
      throwIfAborted(signal);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (bytesRead === 0) {
        throw new Error("The workspace source ended while it was being verified.");
      }
      digest.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const after = fileIdentityFromStat(await handle.stat({ bigint: true }));
    if (!sameFileIdentity(before, after)) {
      throw new Error("The workspace source changed while it was being verified.");
    }
    return digest.digest("hex");
  } finally {
    await handle.close();
  }
}

async function assertPublishedArtifact(
  artifactPath: string,
  sourceIdentity: FileIdentity,
  expectedSize: number,
  expectedSha256: string,
): Promise<void> {
  const artifactIdentity = await readFileIdentity(artifactPath);
  if (
    artifactIdentity.device === sourceIdentity.device &&
    artifactIdentity.inode === sourceIdentity.inode
  ) {
    throw new Error("The workspace export aliases its opened source.");
  }
  if (Number(artifactIdentity.size) !== expectedSize) {
    throw new Error("The published workspace export has an unexpected size.");
  }
  if ((await hashFile(artifactPath)) !== expectedSha256) {
    throw new Error("The published workspace export has an unexpected digest.");
  }
}

async function hashFile(filePath: string, signal?: AbortSignal): Promise<string> {
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (before.isSymbolicLink() || !before.isFile()) {
      throw new Error("The workspace staging file is not a regular file.");
    }
    const digest = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let offset = 0;
    const size = Number(before.size);
    while (offset < size) {
      throwIfAborted(signal);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (bytesRead === 0) {
        throw new Error("The workspace file ended while it was being verified.");
      }
      digest.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      throw new Error("The workspace file changed while it was being verified.");
    }
    return digest.digest("hex");
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

async function readFileIdentity(filePath: string): Promise<FileIdentity> {
  const fileStat = await lstat(filePath, { bigint: true });
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    throw new Error("The workspace source is not a stable regular file.");
  }
  return fileIdentityFromStat(fileStat);
}

function fileIdentityFromStat(fileStat: {
  ctimeNs: bigint;
  dev: bigint;
  ino: bigint;
  mtimeNs: bigint;
  nlink: bigint;
  size: bigint;
}): FileIdentity {
  return {
    changedAtNanoseconds: fileStat.ctimeNs.toString(),
    device: fileStat.dev.toString(),
    inode: fileStat.ino.toString(),
    links: fileStat.nlink.toString(),
    modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
    size: fileStat.size.toString(),
  };
}

async function readDirectoryIdentity(
  directory: string,
): Promise<DirectoryIdentity> {
  const directoryStat = await lstat(directory, { bigint: true });
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new Error("The workspace root or export parent is not a real directory.");
  }
  return {
    device: directoryStat.dev.toString(),
    inode: directoryStat.ino.toString(),
  };
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.changedAtNanoseconds === right.changedAtNanoseconds &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.links === right.links &&
    left.modifiedAtNanoseconds === right.modifiedAtNanoseconds &&
    left.size === right.size
  );
}

function sameDirectoryIdentity(
  left: DirectoryIdentity,
  right: DirectoryIdentity,
): boolean {
  return left.device === right.device && left.inode === right.inode;
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

function toWorkspacePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function assertFormatExtension(
  format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>,
  name: string,
): void {
  if (!isWorkspaceExportNameForFormat(format, name)) {
    throw new Error(`The workspace export filename extension does not match ${format}.`);
  }
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function createWorkspaceSidecar(
  plan: PreparedSequenceWorkspaceExport,
  size: number,
  outputSha256: string,
): string {
  return `${JSON.stringify(
    {
      createdAt: plan.createdAt,
      export: {
        format: plan.format,
        kind: "derived-sequence-export",
        mediaType: plan.mediaType,
        sha256: outputSha256,
        size,
      },
      output: {
        workspacePath: plan.outputWorkspacePath,
      },
      plugin: {
        name: "sequence-viewer",
        version: SEQUENCE_VIEWER_VERSION,
      },
      provenance: plan.provenance,
      schemaVersion: 1,
      source: {
        sha256: plan.sourceSha256,
        workspacePath: plan.sourceWorkspacePath,
      },
    },
    null,
    2,
  )}\n`;
}

function workspaceCapabilityUnavailableError(): Error {
  return new Error(
    "Workspace publication is unavailable for this viewer. Reopen a local file inside an active workspace after the host provides trusted file metadata.",
  );
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
    new DOMException("Workspace export preparation was cancelled.", "AbortError")
  );
}
