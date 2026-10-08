import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";

import type { RootsRequestExtra } from "./chat-file-resource";
import { stripBiologicalCompressionSuffix } from "./compressed-file-name";
import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { isSafeWorkspaceBrowserChildName } from "./workspace-browser-protocol";
import {
  type SequenceWorkspaceDirectoryIdentity,
  type SequenceWorkspaceFileIdentity,
  type SequenceWorkspaceSourceBinding,
  SequenceWorkspaceExportPublisher,
} from "./workspace-export-publisher";
import type {
  SequenceListWorkspaceTrackDirectoryInput,
  SequenceListWorkspaceTrackDirectoryResult,
  SequenceResolveWorkspaceTrackBundleInput,
  SequenceResolveWorkspaceTrackBundleResult,
  SequenceWorkspaceTrackCandidate,
  SequenceWorkspaceTrackFormat,
  SequenceWorkspaceTrackRole,
} from "./workspace-track-protocol";

type MutableDirectoryIdentity = SequenceWorkspaceDirectoryIdentity & {
  changedAtNanoseconds: string;
  modifiedAtNanoseconds: string;
};

type DirectoryCandidateBinding = {
  bindingId: string;
  candidateId: string;
  expiresAt: number;
  identity: SequenceWorkspaceDirectoryIdentity;
  kind: "directory";
  label: string;
  path: string;
  sessionId: string;
  workspacePath: string;
};

type FileCandidateBinding = {
  bindingId: string;
  candidateId: string;
  expiresAt: number;
  format: SequenceWorkspaceTrackFormat;
  identity: SequenceWorkspaceFileIdentity;
  kind: "file";
  label: string;
  path: string;
  role: SequenceWorkspaceTrackRole;
  sessionId: string;
  size: number;
  workspacePath: string;
};

type CandidateBinding = DirectoryCandidateBinding | FileCandidateBinding;

type BundleBinding = {
  bindingId: string;
  bundleId: string;
  expiresAt: number;
  index?: FileCandidateBinding;
  primary: FileCandidateBinding;
  reference?: FileCandidateBinding;
  sessionId: string;
};

type SnapshotEntry =
  | {
      identity: SequenceWorkspaceDirectoryIdentity;
      kind: "directory";
      label: string;
      path: string;
      workspacePath: string;
    }
  | {
      format: SequenceWorkspaceTrackFormat;
      identity: SequenceWorkspaceFileIdentity;
      kind: "file";
      label: string;
      path: string;
      role: SequenceWorkspaceTrackRole;
      size: number;
      workspacePath: string;
    };

type DirectorySnapshot = {
  entries: Array<SnapshotEntry>;
  fingerprint: string;
  omittedEntries: number;
};

export type ResolvedSequenceWorkspaceTrackBundle = {
  format: Exclude<
    SequenceWorkspaceTrackFormat,
    "bai" | "crai" | "csi" | "fasta"
  >;
  index?: {
    bytes: Uint8Array;
    format: "bai" | "crai" | "csi";
    name: string;
    sha256: string;
  };
  primary: {
    bytes: Uint8Array;
    name: string;
    sha256: string;
    workspacePath: string;
  };
  reference?: {
    bytes: Uint8Array;
    name: string;
    sha256: string;
  };
};

export type SequenceWorkspaceTrackBrowserOptions = {
  now?: () => number;
};

export function safeSequenceWorkspaceTrackError(error: unknown): Error {
  if (isAbortError(error)) return error;
  if (
    error instanceof Error &&
    !(error instanceof AggregateError) &&
    !("code" in error)
  ) {
    return error;
  }
  return new Error(
    "Workspace track browsing could not safely access the source or candidate.",
  );
}

export class SequenceWorkspaceTrackBrowser {
  private readonly bundles = new Map<string, BundleBinding>();
  private readonly candidates = new Map<string, CandidateBinding>();
  private readonly now: () => number;

  constructor(
    private readonly sourceBindings: SequenceWorkspaceExportPublisher,
    { now = Date.now }: SequenceWorkspaceTrackBrowserOptions = {},
  ) {
    this.now = now;
  }

  async listDirectory(
    input: SequenceListWorkspaceTrackDirectoryInput,
    extra?: RootsRequestExtra,
  ): Promise<SequenceListWorkspaceTrackDirectoryResult> {
    throwIfAborted(extra?.signal);
    const binding = await this.sourceBindings.getActiveSourceBinding(
      input.sessionId,
      extra,
    );
    const directory =
      input.directoryCandidateId == null
        ? await this.bindDirectory(
            binding,
            input.sessionId,
            path.dirname(binding.sourcePath),
          )
        : await this.requireDirectoryCandidate(
            input.directoryCandidateId,
            input.sessionId,
            binding,
          );
    const snapshot = await readTrackDirectorySnapshot(binding, directory.path);
    const offset = parseDirectoryCursor(
      input.cursor,
      {
        bindingId: binding.bindingId,
        directoryWorkspacePath: directory.workspacePath,
        fingerprint: snapshot.fingerprint,
      },
      snapshot.entries.length,
    );
    const page = snapshot.entries.slice(offset, offset + input.limit);
    const entries = await Promise.all(
      page.map(async (entry) => {
        const candidate = this.rememberCandidate(
          candidateFromSnapshot(
            entry,
            binding,
            input.sessionId,
            this.expiresAt(),
          ),
        );
        if (candidate.kind === "directory") {
          return {
            candidateId: candidate.candidateId,
            kind: "directory" as const,
            label: candidate.label,
            workspacePath: candidate.workspacePath,
          };
        }
        return {
          ...publicFileCandidate(candidate),
          bundle: bundleSummary(candidate, snapshot, binding),
        };
      }),
    );
    const breadcrumbs = await this.createBreadcrumbs(
      binding,
      input.sessionId,
      directory.path,
    );
    throwIfAborted(extra?.signal);
    await this.assertBindingAndDirectoryCurrent(binding, directory, extra);
    const nextOffset = offset + entries.length;
    return {
      breadcrumbs,
      directory: breadcrumbs.at(-1)!,
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

  async resolveBundle(
    input: SequenceResolveWorkspaceTrackBundleInput,
    extra?: RootsRequestExtra,
  ): Promise<SequenceResolveWorkspaceTrackBundleResult> {
    throwIfAborted(extra?.signal);
    const binding = await this.sourceBindings.getActiveSourceBinding(
      input.sessionId,
      extra,
    );
    const primary = await this.requireFileCandidate(
      input.primaryCandidateId,
      input.sessionId,
      binding,
    );
    if (!isPrimaryFormat(primary.format)) {
      throw new Error(
        "Choose a supported evidence or read file as the primary track.",
      );
    }
    const explicitIndex =
      input.indexCandidateId == null
        ? undefined
        : await this.requireFileCandidate(
            input.indexCandidateId,
            input.sessionId,
            binding,
          );
    const explicitReference =
      input.referenceCandidateId == null
        ? undefined
        : await this.requireFileCandidate(
            input.referenceCandidateId,
            input.sessionId,
            binding,
          );
    if (
      explicitIndex != null &&
      primary.format !== "bam" &&
      primary.format !== "cram"
    ) {
      throw new Error("Only BAM and CRAM tracks accept an index companion.");
    }
    if (explicitReference != null && primary.format !== "cram") {
      throw new Error("Only CRAM tracks accept a FASTA reference companion.");
    }

    const snapshot = await readTrackDirectorySnapshot(
      binding,
      path.dirname(primary.path),
    );
    const requirements: SequenceResolveWorkspaceTrackBundleResult["requirements"] =
      [];
    let selectedIndex: FileCandidateBinding | undefined;
    let selectedReference: FileCandidateBinding | undefined;

    if (primary.format === "bam" || primary.format === "cram") {
      const primaryFormat = primary.format;
      const compatibleIndexFormats =
        primaryFormat === "bam" ? new Set(["bai", "csi"]) : new Set(["crai"]);
      if (
        explicitIndex != null &&
        (explicitIndex.role !== "index" ||
          !compatibleIndexFormats.has(explicitIndex.format))
      ) {
        throw new Error(
          `The selected index is not compatible with ${primary.format.toUpperCase()}.`,
        );
      }
      const automaticIndexEntries = snapshot.entries.filter(
        (entry): entry is Extract<SnapshotEntry, { kind: "file" }> =>
          entry.kind === "file" &&
          entry.role === "index" &&
          compatibleIndexFormats.has(entry.format) &&
          isNamedIndexCompanion(primary.label, entry.label, primaryFormat),
      );
      const automaticIndexes = automaticIndexEntries
        .slice(0, SEQUENCE_VIEWER_LIMITS.workspace.maxBundleCandidates)
        .map(
          (entry) =>
            this.rememberCandidate(
              candidateFromSnapshot(
                entry,
                binding,
                input.sessionId,
                this.expiresAt(),
              ),
            ) as FileCandidateBinding,
        );
      const indexRequirement = createRequirement({
        automaticCandidateCount: automaticIndexEntries.length,
        automaticCandidates: automaticIndexes,
        explicitCandidate: explicitIndex,
        missingMessage: `${primary.label} needs a matching ${
          primary.format === "bam" ? "BAI or CSI" : "CRAI"
        } index. Browse to an index and select it explicitly.`,
        role: "index",
      });
      requirements.push(indexRequirement.result);
      selectedIndex = indexRequirement.selected;
    }

    if (primary.format === "cram") {
      if (
        explicitReference != null &&
        (explicitReference.role !== "reference" ||
          explicitReference.format !== "fasta")
      ) {
        throw new Error("The selected CRAM reference is not a FASTA file.");
      }
      const referenceEntries = snapshot.entries.filter(
        (entry): entry is Extract<SnapshotEntry, { kind: "file" }> =>
          entry.kind === "file" && entry.format === "fasta",
      );
      const referenceCandidates = referenceEntries
        .slice(0, SEQUENCE_VIEWER_LIMITS.workspace.maxBundleCandidates)
        .map(
          (entry) =>
            this.rememberCandidate(
              candidateFromSnapshot(
                entry,
                binding,
                input.sessionId,
                this.expiresAt(),
              ),
            ) as FileCandidateBinding,
        );
      const sourceInference = inferWorkspaceTrackFile(
        path.basename(binding.sourcePath),
      );
      if (sourceInference?.format === "fasta") {
        const sourceCandidate = await this.bindFile(
          binding,
          input.sessionId,
          binding.sourcePath,
          sourceInference,
        );
        if (
          !referenceCandidates.some(({ path: candidatePath }) =>
            sameCanonicalPath(candidatePath, sourceCandidate.path),
          )
        ) {
          referenceCandidates.push(sourceCandidate);
        }
      }
      const automaticReferenceCount =
        referenceEntries.length +
        (sourceInference?.format === "fasta" &&
        !referenceEntries.some(({ path: candidatePath }) =>
          sameCanonicalPath(candidatePath, binding.sourcePath),
        )
          ? 1
          : 0);
      const referenceRequirement = createRequirement({
        automaticCandidateCount: automaticReferenceCount,
        automaticCandidates: deduplicateCandidates(referenceCandidates),
        explicitCandidate: explicitReference,
        missingMessage: `${primary.label} needs a matching FASTA reference. Browse to a reference and select it explicitly.`,
        role: "reference",
      });
      requirements.push(referenceRequirement.result);
      selectedReference = referenceRequirement.selected;
    }

    const selected = [primary, selectedIndex, selectedReference].filter(
      (candidate): candidate is FileCandidateBinding => candidate != null,
    );
    assertNoAliases(selected);
    throwIfAborted(extra?.signal);
    await Promise.all(
      selected.map((candidate) =>
        this.assertFileCandidateCurrent(candidate, binding),
      ),
    );
    await this.sourceBindings.getActiveSourceBinding(input.sessionId, extra);
    const ready = requirements.every(({ status }) => status === "selected");
    const bundleId = ready
      ? this.rememberBundle({
          bindingId: binding.bindingId,
          bundleId: randomUUID(),
          expiresAt: this.expiresAt(),
          index: selectedIndex,
          primary,
          reference: selectedReference,
          sessionId: input.sessionId,
        }).bundleId
      : undefined;
    return {
      bundleId,
      primary: publicFileCandidate(primary),
      ready,
      requirements,
    };
  }

  async readBundle(
    bundleId: string,
    sessionId: string,
    signal?: AbortSignal,
    extra?: RootsRequestExtra,
  ): Promise<ResolvedSequenceWorkspaceTrackBundle> {
    throwIfAborted(signal);
    this.pruneExpired();
    const bundle = this.bundles.get(bundleId);
    if (
      bundle == null ||
      bundle.sessionId !== sessionId ||
      bundle.expiresAt <= this.now()
    ) {
      throw new Error(
        "The workspace track bundle expired or belongs to another viewer. Resolve it again.",
      );
    }
    const binding = await this.sourceBindings.getActiveSourceBinding(
      sessionId,
      extra,
    );
    if (binding.bindingId !== bundle.bindingId) {
      throw new Error(
        "The workspace source changed after the track bundle was resolved.",
      );
    }
    const candidates = [bundle.primary, bundle.index, bundle.reference].filter(
      (candidate): candidate is FileCandidateBinding => candidate != null,
    );
    assertNoAliases(candidates);
    await Promise.all(
      candidates.map((candidate) =>
        this.assertFileCandidateCurrent(candidate, binding),
      ),
    );
    const [primary, index, reference] = await Promise.all([
      readBoundCandidate(bundle.primary, 100 * 1_024 * 1_024, signal),
      bundle.index == null
        ? undefined
        : readBoundCandidate(
            bundle.index,
            bundle.index.format === "crai"
              ? 16 * 1_024 * 1_024
              : 64 * 1_024 * 1_024,
            signal,
          ),
      bundle.reference == null
        ? undefined
        : readBoundCandidate(bundle.reference, 100 * 1_024 * 1_024, signal),
    ]);
    throwIfAborted(signal);
    await Promise.all(
      candidates.map((candidate) =>
        this.assertFileCandidateCurrent(candidate, binding),
      ),
    );
    await this.sourceBindings.getActiveSourceBinding(sessionId, extra);
    return {
      format: bundle.primary
        .format as ResolvedSequenceWorkspaceTrackBundle["format"],
      index:
        bundle.index == null || index == null
          ? undefined
          : {
              bytes: index,
              format: bundle.index.format as "bai" | "crai" | "csi",
              name: bundle.index.label,
              sha256: sha256(index),
            },
      primary: {
        bytes: primary,
        name: bundle.primary.label,
        sha256: sha256(primary),
        workspacePath: bundle.primary.workspacePath,
      },
      reference:
        bundle.reference == null || reference == null
          ? undefined
          : {
              bytes: reference,
              name: bundle.reference.label,
              sha256: sha256(reference),
            },
    };
  }

  private async bindDirectory(
    binding: SequenceWorkspaceSourceBinding,
    sessionId: string,
    directoryPath: string,
  ): Promise<DirectoryCandidateBinding> {
    const canonical = await realpath(directoryPath).catch(() => null);
    if (
      canonical == null ||
      !sameCanonicalPath(canonical, directoryPath) ||
      !isPathWithin(binding.rootPath, canonical)
    ) {
      throw new Error(
        "The workspace track directory is no longer a real directory inside the active root.",
      );
    }
    await assertNoSymlinkComponents(binding.rootPath, canonical);
    const identity = await readDirectoryIdentity(canonical);
    return this.rememberCandidate({
      bindingId: binding.bindingId,
      candidateId: randomUUID(),
      expiresAt: this.expiresAt(),
      identity,
      kind: "directory",
      label: sameCanonicalPath(canonical, binding.rootPath)
        ? "Workspace"
        : path.basename(canonical),
      path: canonical,
      sessionId,
      workspacePath: workspaceLabel(path.relative(binding.rootPath, canonical)),
    }) as DirectoryCandidateBinding;
  }

  private async bindFile(
    binding: SequenceWorkspaceSourceBinding,
    sessionId: string,
    filePath: string,
    inference: {
      format: SequenceWorkspaceTrackFormat;
      role: SequenceWorkspaceTrackRole;
    },
  ): Promise<FileCandidateBinding> {
    const canonical = await realpath(filePath).catch(() => null);
    if (
      canonical == null ||
      !sameCanonicalPath(canonical, filePath) ||
      !isPathWithin(binding.rootPath, canonical)
    ) {
      throw new Error(
        "The workspace track candidate is no longer a real file inside the active root.",
      );
    }
    await assertNoSymlinkComponents(binding.rootPath, path.dirname(canonical));
    const identity = await readFileIdentity(canonical);
    const size = safeFileSize(identity);
    return this.rememberCandidate({
      bindingId: binding.bindingId,
      candidateId: randomUUID(),
      expiresAt: this.expiresAt(),
      format: inference.format,
      identity,
      kind: "file",
      label: path.basename(canonical),
      path: canonical,
      role: inference.role,
      sessionId,
      size,
      workspacePath: workspaceLabel(path.relative(binding.rootPath, canonical)),
    }) as FileCandidateBinding;
  }

  private async requireDirectoryCandidate(
    candidateId: string,
    sessionId: string,
    binding: SequenceWorkspaceSourceBinding,
  ): Promise<DirectoryCandidateBinding> {
    const candidate = this.requireCandidate(candidateId, sessionId, binding);
    if (candidate.kind !== "directory") {
      throw new Error("The selected workspace candidate is not a directory.");
    }
    await this.assertDirectoryCandidateCurrent(candidate, binding);
    return candidate;
  }

  private async requireFileCandidate(
    candidateId: string,
    sessionId: string,
    binding: SequenceWorkspaceSourceBinding,
  ): Promise<FileCandidateBinding> {
    const candidate = this.requireCandidate(candidateId, sessionId, binding);
    if (candidate.kind !== "file") {
      throw new Error(
        "The selected workspace candidate is not a regular file.",
      );
    }
    await this.assertFileCandidateCurrent(candidate, binding);
    return candidate;
  }

  private requireCandidate(
    candidateId: string,
    sessionId: string,
    binding: SequenceWorkspaceSourceBinding,
  ): CandidateBinding {
    this.pruneExpired();
    const candidate = this.candidates.get(candidateId);
    if (
      candidate == null ||
      candidate.sessionId !== sessionId ||
      candidate.bindingId !== binding.bindingId ||
      candidate.expiresAt <= this.now()
    ) {
      throw new Error(
        "The workspace candidate expired or belongs to another viewer. Refresh the listing.",
      );
    }
    candidate.expiresAt = this.expiresAt();
    return candidate;
  }

  private async assertBindingAndDirectoryCurrent(
    binding: SequenceWorkspaceSourceBinding,
    directory: DirectoryCandidateBinding,
    extra?: RootsRequestExtra,
  ): Promise<void> {
    const current = await this.sourceBindings.getActiveSourceBinding(
      directory.sessionId,
      extra,
    );
    if (current.bindingId !== binding.bindingId) {
      throw new Error(
        "The workspace source changed while the directory was listed.",
      );
    }
    await this.assertDirectoryCandidateCurrent(directory, current);
  }

  private async assertDirectoryCandidateCurrent(
    candidate: DirectoryCandidateBinding,
    binding: SequenceWorkspaceSourceBinding,
  ): Promise<void> {
    if (!isPathWithin(binding.rootPath, candidate.path)) {
      throw new Error("The workspace directory left the active root.");
    }
    const canonical = await realpath(candidate.path).catch(() => null);
    if (canonical == null || !sameCanonicalPath(canonical, candidate.path)) {
      throw new Error("The workspace directory changed after it was listed.");
    }
    await assertNoSymlinkComponents(binding.rootPath, candidate.path);
    const current = await readDirectoryIdentity(candidate.path);
    if (!sameDirectoryIdentity(current, candidate.identity)) {
      throw new Error("The workspace directory changed after it was listed.");
    }
  }

  private async assertFileCandidateCurrent(
    candidate: FileCandidateBinding,
    binding: SequenceWorkspaceSourceBinding,
  ): Promise<void> {
    if (!isPathWithin(binding.rootPath, candidate.path)) {
      throw new Error("The workspace track candidate left the active root.");
    }
    const canonical = await realpath(candidate.path).catch(() => null);
    if (canonical == null || !sameCanonicalPath(canonical, candidate.path)) {
      throw new Error(
        "The workspace track candidate changed after it was listed.",
      );
    }
    await assertNoSymlinkComponents(
      binding.rootPath,
      path.dirname(candidate.path),
    );
    const current = await readFileIdentity(candidate.path);
    if (!sameFileIdentity(current, candidate.identity)) {
      throw new Error(
        "The workspace track candidate changed after it was listed.",
      );
    }
    if (
      !sameCanonicalPath(candidate.path, binding.sourcePath) &&
      sameUnderlyingFile(candidate.identity, binding.sourceIdentity)
    ) {
      throw new Error(
        "The workspace track candidate aliases the opened source.",
      );
    }
  }

  private async createBreadcrumbs(
    binding: SequenceWorkspaceSourceBinding,
    sessionId: string,
    directoryPath: string,
  ): Promise<SequenceListWorkspaceTrackDirectoryResult["breadcrumbs"]> {
    const paths = [binding.rootPath];
    const relative = path.relative(binding.rootPath, directoryPath);
    let current = binding.rootPath;
    if (relative !== "") {
      for (const component of relative.split(path.sep)) {
        current = path.join(current, component);
        paths.push(current);
      }
    }
    return await Promise.all(
      paths.map(async (breadcrumbPath, index) => {
        const candidate = await this.bindDirectory(
          binding,
          sessionId,
          breadcrumbPath,
        );
        return {
          candidateId: candidate.candidateId,
          label: index === 0 ? "Workspace" : candidate.label,
          workspacePath: candidate.workspacePath,
        };
      }),
    );
  }

  private rememberCandidate(candidate: CandidateBinding): CandidateBinding {
    this.pruneExpired();
    while (
      this.candidates.size >=
      SEQUENCE_VIEWER_LIMITS.workspace.maxCandidateTokens
    ) {
      const oldest = this.candidates.keys().next().value as string | undefined;
      if (oldest == null) break;
      this.candidates.delete(oldest);
    }
    this.candidates.set(candidate.candidateId, candidate);
    return candidate;
  }

  private rememberBundle(bundle: BundleBinding): BundleBinding {
    this.pruneExpired();
    while (
      this.bundles.size >= SEQUENCE_VIEWER_LIMITS.workspace.maxBundleTokens
    ) {
      const oldest = this.bundles.keys().next().value as string | undefined;
      if (oldest == null) break;
      this.bundles.delete(oldest);
    }
    this.bundles.set(bundle.bundleId, bundle);
    return bundle;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [candidateId, candidate] of this.candidates) {
      if (candidate.expiresAt <= now) this.candidates.delete(candidateId);
    }
    for (const [bundleId, bundle] of this.bundles) {
      if (bundle.expiresAt <= now) this.bundles.delete(bundleId);
    }
  }

  private expiresAt(): number {
    return this.now() + SEQUENCE_VIEWER_LIMITS.workspace.tokenTtlMs;
  }
}

function candidateFromSnapshot(
  entry: SnapshotEntry,
  binding: SequenceWorkspaceSourceBinding,
  sessionId: string,
  expiresAt: number,
): CandidateBinding {
  if (entry.kind === "directory") {
    return {
      bindingId: binding.bindingId,
      candidateId: randomUUID(),
      expiresAt,
      identity: entry.identity,
      kind: "directory",
      label: entry.label,
      path: entry.path,
      sessionId,
      workspacePath: entry.workspacePath,
    };
  }
  return {
    bindingId: binding.bindingId,
    candidateId: randomUUID(),
    expiresAt,
    format: entry.format,
    identity: entry.identity,
    kind: "file",
    label: entry.label,
    path: entry.path,
    role: entry.role,
    sessionId,
    size: entry.size,
    workspacePath: entry.workspacePath,
  };
}

function publicFileCandidate(
  candidate: FileCandidateBinding,
): SequenceWorkspaceTrackCandidate {
  return {
    candidateId: candidate.candidateId,
    format: candidate.format,
    kind: "file",
    label: candidate.label,
    role: candidate.role,
    size: candidate.size,
    workspacePath: candidate.workspacePath,
  };
}

function createRequirement({
  automaticCandidateCount,
  automaticCandidates,
  explicitCandidate,
  missingMessage,
  role,
}: {
  automaticCandidateCount?: number;
  automaticCandidates: Array<FileCandidateBinding>;
  explicitCandidate?: FileCandidateBinding;
  missingMessage: string;
  role: "index" | "reference";
}): {
  result: SequenceResolveWorkspaceTrackBundleResult["requirements"][number];
  selected?: FileCandidateBinding;
} {
  const candidates = deduplicateCandidates(automaticCandidates);
  const candidateCount = automaticCandidateCount ?? candidates.length;
  const selected =
    explicitCandidate ?? (candidateCount === 1 ? candidates[0] : undefined);
  const status =
    selected != null
      ? "selected"
      : candidateCount === 0
        ? "missing"
        : "ambiguous";
  const visibleCandidates = candidates.slice(
    0,
    SEQUENCE_VIEWER_LIMITS.workspace.maxBundleCandidates,
  );
  const message =
    status === "selected"
      ? `Selected ${selected!.label} as the ${role}.`
      : status === "ambiguous"
        ? `More than one ${role} candidate matched. Select one explicitly.`
        : missingMessage;
  return {
    result: {
      candidates: visibleCandidates.map(publicFileCandidate),
      message,
      omittedCandidates: candidateCount - visibleCandidates.length,
      role,
      selectedCandidate:
        selected == null ? undefined : publicFileCandidate(selected),
      status,
    },
    selected,
  };
}

function bundleSummary(
  primary: FileCandidateBinding,
  snapshot: DirectorySnapshot,
  binding: SequenceWorkspaceSourceBinding,
): SequenceListWorkspaceTrackDirectoryResult["entries"][number] extends infer _Entry
  ?
      | {
          indexMatches: number;
          indexStatus: "ambiguous" | "missing" | "not-required" | "ready";
          referenceMatches: number;
          referenceStatus: "ambiguous" | "missing" | "not-required" | "ready";
        }
      | undefined
  : never {
  if (primary.format !== "bam" && primary.format !== "cram") return undefined;
  const primaryFormat = primary.format;
  const indexMatches = snapshot.entries.filter(
    (entry) =>
      entry.kind === "file" &&
      entry.role === "index" &&
      isNamedIndexCompanion(primary.label, entry.label, primaryFormat),
  ).length;
  const sourceIsReference =
    inferWorkspaceTrackFile(path.basename(binding.sourcePath))?.format ===
    "fasta";
  const referencePaths = new Set(
    snapshot.entries.flatMap((entry) =>
      entry.kind === "file" && entry.format === "fasta" ? [entry.path] : [],
    ),
  );
  if (sourceIsReference) referencePaths.add(binding.sourcePath);
  const referenceMatches = primary.format === "cram" ? referencePaths.size : 0;
  return {
    indexMatches,
    indexStatus: countStatus(indexMatches),
    referenceMatches,
    referenceStatus:
      primary.format === "cram"
        ? countStatus(referenceMatches)
        : "not-required",
  };
}

function countStatus(count: number): "ambiguous" | "missing" | "ready" {
  return count === 0 ? "missing" : count === 1 ? "ready" : "ambiguous";
}

async function readTrackDirectorySnapshot(
  binding: SequenceWorkspaceSourceBinding,
  directoryPath: string,
): Promise<DirectorySnapshot> {
  const before = await readMutableDirectoryIdentity(directoryPath);
  const directory = await opendir(directoryPath);
  const entries: Array<SnapshotEntry> = [];
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
      const fileStat = await lstat(entryPath, { bigint: true }).catch(
        () => null,
      );
      if (fileStat == null || fileStat.isSymbolicLink()) {
        omittedEntries += 1;
        continue;
      }
      const workspacePath = workspaceLabel(
        path.relative(binding.rootPath, entryPath),
      );
      if (fileStat.isDirectory()) {
        entries.push({
          identity: directoryIdentityFromStat(fileStat),
          kind: "directory",
          label: entry.name,
          path: entryPath,
          workspacePath,
        });
        continue;
      }
      if (!fileStat.isFile()) {
        omittedEntries += 1;
        continue;
      }
      const inference = inferWorkspaceTrackFile(entry.name);
      if (inference == null) {
        omittedEntries += 1;
        continue;
      }
      const identity = fileIdentityFromStat(fileStat);
      if (
        !sameCanonicalPath(entryPath, binding.sourcePath) &&
        sameUnderlyingFile(identity, binding.sourceIdentity)
      ) {
        omittedEntries += 1;
        continue;
      }
      entries.push({
        ...inference,
        identity,
        kind: "file",
        label: entry.name,
        path: entryPath,
        size: safeFileSize(identity),
        workspacePath,
      });
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
  const after = await readMutableDirectoryIdentity(directoryPath);
  if (!sameMutableDirectoryIdentity(before, after)) {
    throw new Error(
      "The workspace directory changed while it was being listed.",
    );
  }
  entries.sort((left, right) =>
    left.label === right.label ? 0 : left.label < right.label ? -1 : 1,
  );
  return {
    entries,
    fingerprint: sha256(
      Buffer.from(
        JSON.stringify(
          entries.map(({ identity, kind, label, ...entry }) => ({
            ...entry,
            identity,
            kind,
            label,
          })),
        ),
      ),
    ),
    omittedEntries,
  };
}

export function inferWorkspaceTrackFile(fileName: string):
  | {
      format: SequenceWorkspaceTrackFormat;
      role: SequenceWorkspaceTrackRole;
    }
  | undefined {
  const lower = fileName.toLowerCase();
  const textName = stripBiologicalCompressionSuffix(lower);
  if (/\.(?:gff|gff3)$/u.test(textName)) {
    return { format: "gff3", role: "annotation" };
  }
  if (textName.endsWith(".gtf")) return { format: "gtf", role: "annotation" };
  if (textName.endsWith(".bed")) return { format: "bed", role: "annotation" };
  if (textName.endsWith(".vcf")) return { format: "vcf", role: "variant" };
  if (textName.endsWith(".sam")) return { format: "sam", role: "reads" };
  if (lower.endsWith(".bam")) return { format: "bam", role: "reads" };
  if (lower.endsWith(".cram")) return { format: "cram", role: "reads" };
  if (lower.endsWith(".bai")) return { format: "bai", role: "index" };
  if (lower.endsWith(".csi")) return { format: "csi", role: "index" };
  if (lower.endsWith(".crai")) return { format: "crai", role: "index" };
  if (/\.(?:fa|fas|fasta|fna)$/u.test(textName)) {
    return { format: "fasta", role: "reference" };
  }
  return undefined;
}

function isPrimaryFormat(
  format: SequenceWorkspaceTrackFormat,
): format is Exclude<
  SequenceWorkspaceTrackFormat,
  "bai" | "crai" | "csi" | "fasta"
> {
  return (
    format !== "bai" &&
    format !== "crai" &&
    format !== "csi" &&
    format !== "fasta"
  );
}

function isNamedIndexCompanion(
  primaryName: string,
  indexName: string,
  format: "bam" | "cram",
): boolean {
  const primary = primaryName.toLowerCase();
  const index = indexName.toLowerCase();
  const stem = primary.endsWith(`.${format}`)
    ? primary.slice(0, -1 * `.${format}`.length)
    : primary;
  const extensions = format === "bam" ? ["bai", "csi"] : ["crai"];
  return extensions.some(
    (extension) =>
      index === `${primary}.${extension}` || index === `${stem}.${extension}`,
  );
}

async function readBoundCandidate(
  candidate: FileCandidateBinding,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (candidate.size > maxBytes) {
    throw new Error(
      `${candidate.label} exceeds the bounded ${(
        maxBytes /
        (1_024 * 1_024)
      ).toLocaleString()} MiB input limit.`,
    );
  }
  throwIfAborted(signal);
  const handle = await open(
    candidate.path,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const before = fileIdentityFromStat(await handle.stat({ bigint: true }));
    if (!sameFileIdentity(before, candidate.identity)) {
      throw new Error(`${candidate.label} changed before it could be read.`);
    }
    const bytes = Buffer.alloc(candidate.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      throwIfAborted(signal);
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) {
        throw new Error(`${candidate.label} changed while it was being read.`);
      }
      offset += bytesRead;
    }
    const overflow = Buffer.alloc(1);
    const { bytesRead: overflowBytes } = await handle.read(
      overflow,
      0,
      1,
      offset,
    );
    if (overflowBytes !== 0) {
      throw new Error(`${candidate.label} changed while it was being read.`);
    }
    throwIfAborted(signal);
    const after = fileIdentityFromStat(await handle.stat({ bigint: true }));
    const pathIdentity = await readFileIdentity(candidate.path);
    if (
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(after, pathIdentity)
    ) {
      throw new Error(`${candidate.label} changed while it was being read.`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function assertNoAliases(candidates: Array<FileCandidateBinding>): void {
  for (let index = 0; index < candidates.length; index += 1) {
    for (let other = index + 1; other < candidates.length; other += 1) {
      const left = candidates[index]!;
      const right = candidates[other]!;
      if (
        !sameCanonicalPath(left.path, right.path) &&
        sameUnderlyingFile(left.identity, right.identity)
      ) {
        throw new Error(
          "Workspace track bundle candidates cannot alias one another.",
        );
      }
    }
  }
}

function deduplicateCandidates(
  candidates: Array<FileCandidateBinding>,
): Array<FileCandidateBinding> {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.identity.device}:${candidate.identity.inode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<DirectoryCursor>;
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
      "The workspace track cursor is stale or invalid. Refresh the listing.",
    );
  }
}

async function readFileIdentity(
  filePath: string,
): Promise<SequenceWorkspaceFileIdentity> {
  const fileStat = await lstat(filePath, { bigint: true });
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    throw new Error(
      "The workspace track candidate is not a stable regular file.",
    );
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

async function readDirectoryIdentity(
  directoryPath: string,
): Promise<SequenceWorkspaceDirectoryIdentity> {
  const directoryStat = await lstat(directoryPath, { bigint: true });
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new Error(
      "The workspace track browser target is not a real directory.",
    );
  }
  return directoryIdentityFromStat(directoryStat);
}

function directoryIdentityFromStat(fileStat: {
  dev: bigint;
  ino: bigint;
}): SequenceWorkspaceDirectoryIdentity {
  return {
    device: fileStat.dev.toString(),
    inode: fileStat.ino.toString(),
  };
}

async function readMutableDirectoryIdentity(
  directoryPath: string,
): Promise<MutableDirectoryIdentity> {
  const fileStat = await lstat(directoryPath, { bigint: true });
  if (fileStat.isSymbolicLink() || !fileStat.isDirectory()) {
    throw new Error(
      "The workspace track browser target is not a real directory.",
    );
  }
  return {
    ...directoryIdentityFromStat(fileStat),
    changedAtNanoseconds: fileStat.ctimeNs.toString(),
    modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
  };
}

function safeFileSize(identity: SequenceWorkspaceFileIdentity): number {
  const size = Number(identity.size);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error(
      "The workspace track candidate size is not safe to inspect.",
    );
  }
  return size;
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

function sameUnderlyingFile(
  left: SequenceWorkspaceFileIdentity,
  right: SequenceWorkspaceFileIdentity,
): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function sameDirectoryIdentity(
  left: SequenceWorkspaceDirectoryIdentity,
  right: SequenceWorkspaceDirectoryIdentity,
): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function sameMutableDirectoryIdentity(
  left: MutableDirectoryIdentity,
  right: MutableDirectoryIdentity,
): boolean {
  return (
    sameDirectoryIdentity(left, right) &&
    left.changedAtNanoseconds === right.changedAtNanoseconds &&
    left.modifiedAtNanoseconds === right.modifiedAtNanoseconds
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
      throw new Error("Workspace track directories must be real directories.");
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
    new DOMException("Workspace track operation was cancelled.", "AbortError")
  );
}
