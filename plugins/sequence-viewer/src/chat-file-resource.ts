import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { Transform } from "node:stream";
import { createGunzip, gunzip as gunzipCallback } from "node:zlib";

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListRootsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  isGzipCompressedBiologicalFileName,
  stripBiologicalCompressionSuffix,
} from "./compressed-file-name";
import { createHistoricalViewerFileError } from "./resource-error";
import { serializeIndexedSequenceEnvelope } from "./indexed-sequence-envelope";
import { parseIndexedSequenceLines } from "./indexed-sequence-parser";
import { serializeBinarySequenceEnvelope } from "./binary-sequence-envelope";
import {
  getBinarySequenceFormatHint,
  sniffBinarySequenceFormat,
} from "./sequence/binary-parser";
import {
  SEQUENCE_VIEWER_LIMITS,
  assertTextWithinInputBudget,
  formatBytes,
} from "./runtime-contract";

const gunzip = promisify(gunzipCallback);

const DEFAULT_MAX_PERSISTED_FILES = 256;
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_RECORD_BYTES = 64 * 1_024;
const LEGACY_RECORD_VERSION = 1;
const RECORD_VERSION = 2;
const SIGNING_KEY_BYTES = 32;
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ChatViewerFileInput = {
  primaryFile: {
    name: string;
    uri: string;
  };
};

export type RootsRequestExtra = {
  signal?: AbortSignal;
  sendRequest: (
    request: { method: "roots/list"; params?: Record<string, never> },
    schema: typeof ListRootsResultSchema,
  ) => Promise<{ roots: Array<{ uri: string }> }>;
};

export type OpenedChatViewerFile = {
  discard?: () => Promise<void>;
  rangeOnly?: true;
  sessionId?: string;
  sourcePath: string;
  viewerFile: ChatViewerFileInput;
  workspaceBacked: boolean;
};

export type ResolvedChatViewerResource = {
  rangeOnly?: true;
  sessionId: string;
  sourcePath: string;
  workspaceBacked: boolean;
  workspaceRoot: string | null;
};

export type ExpectedChatFileSource = {
  byteLength: number;
  fileIdentity: {
    device: string;
    inode: string;
    modifiedAtNanoseconds: string;
    size: string;
  };
  sha256: string;
};

export type VerifiedOpenedChatViewerFile = OpenedChatViewerFile & {
  discard: () => Promise<void>;
};

export async function readWorkspaceFileBytes({
  extra,
  filePath,
  isSupportedFileName,
  maxFileBytes,
  viewerName,
}: {
  extra: RootsRequestExtra;
  filePath: string;
  isSupportedFileName: (fileName: string) => boolean;
  maxFileBytes: number;
  viewerName: string;
}): Promise<{ bytes: Buffer; name: string }> {
  const openedFile = await resolveWorkspaceFile({
    extra,
    filePath,
    isSupportedFileName,
    viewerName,
  });
  assertFileIdentityWithinBudget(openedFile.fileIdentity, maxFileBytes);
  const fileHandle = await open(openedFile.absolutePath, "r");
  try {
    const beforeRead = fileIdentityFromStat(
      await fileHandle.stat({ bigint: true }),
    );
    if (!sameFileIdentity(beforeRead, openedFile.fileIdentity)) {
      throw new Error(
        `${openedFile.name} changed before it could be read. Retry the operation.`,
      );
    }
    const bytes = await fileHandle.readFile();
    const afterRead = fileIdentityFromStat(
      await fileHandle.stat({ bigint: true }),
    );
    const currentPathIdentity = await readFileIdentity(openedFile.absolutePath);
    if (
      currentPathIdentity == null ||
      !sameFileIdentity(beforeRead, afterRead) ||
      !sameFileIdentity(afterRead, currentPathIdentity)
    ) {
      throw new Error(
        `${openedFile.name} moved or changed while it was being read. Retry the operation.`,
      );
    }
    return { bytes, name: openedFile.name };
  } finally {
    await fileHandle.close();
  }
}

async function assertOpenedFileMatchesExpectedSource(
  openedFile: OpenedFile,
  expected: ExpectedChatFileSource,
): Promise<void> {
  if (
    expected.byteLength !== Number(openedFile.fileIdentity.size) ||
    expected.fileIdentity.size !== String(expected.byteLength) ||
    !sameFileIdentity(openedFile.fileIdentity, expected.fileIdentity) ||
    !/^[a-f0-9]{64}$/u.test(expected.sha256)
  ) {
    throw new Error(
      "The acquired public example changed before it could be opened.",
    );
  }
  const fileHandle = await open(
    openedFile.absolutePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const beforeRead = fileIdentityFromStat(
      await fileHandle.stat({ bigint: true }),
    );
    if (!sameFileIdentity(beforeRead, expected.fileIdentity)) {
      throw new Error(
        "The acquired public example changed before it could be opened.",
      );
    }
    const bytes = await fileHandle.readFile();
    const afterRead = fileIdentityFromStat(
      await fileHandle.stat({ bigint: true }),
    );
    const currentPathIdentity = await readFileIdentity(openedFile.absolutePath);
    if (
      bytes.byteLength !== expected.byteLength ||
      createHash("sha256").update(bytes).digest("hex") !== expected.sha256 ||
      currentPathIdentity == null ||
      !sameFileIdentity(beforeRead, afterRead) ||
      !sameFileIdentity(afterRead, currentPathIdentity) ||
      !sameFileIdentity(afterRead, expected.fileIdentity)
    ) {
      throw new Error(
        "The acquired public example changed before it could be opened.",
      );
    }
  } finally {
    await fileHandle.close();
  }
}

type LegacyFileIdentity = {
  device: string;
  inode: string;
  modifiedAtNanoseconds: string;
  size: string;
};

type FileIdentity = LegacyFileIdentity & {
  changedAtNanoseconds: string;
};

type OpenedFile = {
  absolutePath: string;
  bundled?: true;
  expectedSha256?: string;
  fileIdentity: FileIdentity;
  name: string;
  rangeOnly?: true;
  sessionId?: string;
  workspaceRoot: string | null;
};

const legacyFileIdentitySchema = z
  .object({
    device: z.string().regex(/^\d+$/),
    inode: z.string().regex(/^\d+$/),
    modifiedAtNanoseconds: z.string().regex(/^-?\d+$/),
    size: z.string().regex(/^\d+$/),
  })
  .strict();
const fileIdentitySchema = legacyFileIdentitySchema
  .extend({ changedAtNanoseconds: z.string().regex(/^-?\d+$/) })
  .strict();
const expectedSha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const persistedOpenedFilePayloadSchema = z
  .object({
    absolutePath: z.string().max(32_768).refine(path.isAbsolute),
    bundled: z.literal(true).optional(),
    expectedSha256: expectedSha256Schema.optional(),
    fileIdentity: fileIdentitySchema,
    name: z.string().min(1).max(1_024),
    openedAt: z.number().int().nonnegative(),
    rangeOnly: z.literal(true).optional(),
    sessionId: z.string().uuid().optional(),
    token: z.string().regex(TOKEN_PATTERN),
    version: z.literal(RECORD_VERSION),
    workspaceRoot: z.string().max(32_768).refine(path.isAbsolute).nullable(),
  })
  .strict();
// A v1 record cannot prove that its source escaped a same-inode rewrite with a
// restored mtime. Preserve only public handles whose signed digest still
// authenticates the bytes; ordinary legacy handles must be opened again.
const legacyPersistedOpenedFilePayloadSchema = persistedOpenedFilePayloadSchema
  .extend({
    expectedSha256: expectedSha256Schema,
    fileIdentity: legacyFileIdentitySchema,
    version: z.literal(LEGACY_RECORD_VERSION),
  })
  .strict();
const persistedOpenedFileSchema = z.discriminatedUnion("version", [
  persistedOpenedFilePayloadSchema
    .extend({ signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
    .strict(),
  legacyPersistedOpenedFilePayloadSchema
    .extend({ signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
    .strict(),
]);

type PersistedOpenedFilePayload =
  | z.infer<typeof persistedOpenedFilePayloadSchema>
  | z.infer<typeof legacyPersistedOpenedFilePayloadSchema>;

// Codex mints host-managed file resources for native file entrypoints. Chat
// tools keep the same resources/read contract for workspace files while
// persisting only signed, opaque handles under the user's private Codex state
// directory.
export function createChatFileResourceStore({
  isSupportedFileName,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  maxCompressedFileBytes = 100 * 1_024 * 1_024,
  maxFileBytes = SEQUENCE_VIEWER_LIMITS.input.maxTextBytes,
  maxIndexedFileBytes,
  maxRangedFileBytes,
  maxPersistedFiles = DEFAULT_MAX_PERSISTED_FILES,
  now = Date.now,
  resourceUriPrefix,
  stateDirectory = defaultChatFileStateDirectory(),
  viewerName,
}: {
  isSupportedFileName: (fileName: string) => boolean;
  maxAgeMs?: number;
  maxCompressedFileBytes?: number;
  maxFileBytes?: number;
  maxIndexedFileBytes?: number;
  maxRangedFileBytes?: number;
  maxPersistedFiles?: number;
  now?: () => number;
  resourceUriPrefix: string;
  stateDirectory?: string;
  viewerName: string;
}): {
  open: (
    filePath: string,
    extra: RootsRequestExtra,
  ) => Promise<ChatViewerFileInput>;
  openWithSource: (
    filePath: string,
    extra: RootsRequestExtra,
    sessionId?: string,
  ) => Promise<OpenedChatViewerFile>;
  openVerifiedWithSource: (
    filePath: string,
    expected: ExpectedChatFileSource,
    extra: RootsRequestExtra,
    sessionId?: string,
  ) => Promise<VerifiedOpenedChatViewerFile>;
  openIndexedWorkspaceFile: (
    filePath: string,
    extra: RootsRequestExtra,
    minimumSourceBytes?: number,
    allocateSessionId?: () => string,
  ) => Promise<OpenedChatViewerFile | null>;
  resolveResource: (
    resourceUri: string,
    sessionId: string,
    extra: RootsRequestExtra,
  ) => Promise<ResolvedChatViewerResource>;
  register: (server: McpServer) => void;
} {
  const resolvedMaxIndexedFileBytes =
    maxIndexedFileBytes ??
    (maxFileBytes === SEQUENCE_VIEWER_LIMITS.input.maxTextBytes
      ? 512 * 1_024 * 1_024
      : maxFileBytes);
  const resolvedMaxRangedFileBytes =
    maxRangedFileBytes ?? resolvedMaxIndexedFileBytes;
  async function rememberOpenedFileRecord(
    openedFile: OpenedFile,
    sessionOwner?: string | (() => string),
  ): Promise<{
    discard: () => Promise<void>;
    rangeOnly?: true;
    sessionId?: string;
    viewerFile: ChatViewerFileInput;
  }> {
    const rangeOnly =
      maxRangedFileBytes != null &&
      openedFile.workspaceRoot != null &&
      isIndexableSequenceFileName(openedFile.name) &&
      !isGzipCompressedBiologicalFileName(openedFile.name) &&
      BigInt(openedFile.fileIdentity.size) >
        BigInt(resolvedMaxIndexedFileBytes);
    assertFileIdentityWithinBudget(
      openedFile.fileIdentity,
      rangeOnly
        ? resolvedMaxRangedFileBytes
        : isIndexableSequenceFileName(openedFile.name)
        ? resolvedMaxIndexedFileBytes
        : isGzipCompressedBiologicalFileName(openedFile.name)
          ? maxCompressedFileBytes
          : maxFileBytes,
    );
    const sessionId =
      typeof sessionOwner === "function" ? sessionOwner() : sessionOwner;
    if (sessionId != null && !z.string().uuid().safeParse(sessionId).success) {
      throw new Error("The biological viewer session identity is invalid.");
    }
    const token = randomUUID();
    try {
      await persistOpenedFile({
        maxAgeMs,
        maxPersistedFiles,
        now: now(),
        openedFile: {
          ...openedFile,
          ...(rangeOnly ? { rangeOnly: true as const } : {}),
          ...(sessionId == null ? {} : { sessionId }),
        },
        stateDirectory,
        token,
      });
    } catch {
      throw new Error(
        "The viewer could not securely save this file handle. Check that Codex local state is writable and retry.",
      );
    }
    return {
      discard: async () => unlinkIfExists(recordPath(stateDirectory, token)),
      ...(rangeOnly ? { rangeOnly: true } : {}),
      ...(sessionId == null ? {} : { sessionId }),
      viewerFile: {
        primaryFile: {
          name: openedFile.name,
          uri: `${resourceUriPrefix}/${token}`,
        },
      },
    };
  }

  async function openWithSource(
    filePath: string,
    extra: RootsRequestExtra,
    sessionId?: string,
  ): Promise<OpenedChatViewerFile> {
    const openedFile = await resolveWorkspaceFile({
      extra,
      filePath,
      isSupportedFileName,
      viewerName,
    });
    const remembered = await rememberOpenedFileRecord(openedFile, sessionId);
    return {
      discard: remembered.discard,
      ...(remembered.rangeOnly ? { rangeOnly: true } : {}),
      ...(remembered.sessionId == null
        ? {}
        : { sessionId: remembered.sessionId }),
      sourcePath: openedFile.absolutePath,
      viewerFile: remembered.viewerFile,
      workspaceBacked: openedFile.workspaceRoot != null,
    };
  }

  async function openVerifiedWithSource(
    filePath: string,
    expected: ExpectedChatFileSource,
    extra: RootsRequestExtra,
    sessionId?: string,
  ): Promise<VerifiedOpenedChatViewerFile> {
    const openedFile = await resolveWorkspaceFile({
      extra,
      filePath,
      isSupportedFileName,
      viewerName,
    });
    await assertOpenedFileMatchesExpectedSource(openedFile, expected);
    const remembered = await rememberOpenedFileRecord(
      {
        ...openedFile,
        expectedSha256: expected.sha256,
      },
      sessionId,
    );
    return {
      discard: remembered.discard,
      ...(remembered.sessionId == null
        ? {}
        : { sessionId: remembered.sessionId }),
      sourcePath: openedFile.absolutePath,
      viewerFile: remembered.viewerFile,
      workspaceBacked: openedFile.workspaceRoot != null,
    };
  }

  async function openIndexedWorkspaceFile(
    filePath: string,
    extra: RootsRequestExtra,
    minimumSourceBytes = SEQUENCE_VIEWER_LIMITS.input.maxTextBytes,
    allocateSessionId?: () => string,
  ): Promise<OpenedChatViewerFile | null> {
    if (!isIndexableSequenceFileName(path.basename(filePath))) {
      return null;
    }
    let openedFile: OpenedFile;
    try {
      openedFile = await resolveWorkspaceFile({
        extra,
        filePath,
        isSupportedFileName,
        viewerName,
      });
    } catch {
      // Trusted metadata that cannot be proven to identify a workspace file
      // must leave the host-owned resource route unchanged.
      return null;
    }
    const sourceBytes = Number(openedFile.fileIdentity.size);
    if (
      openedFile.workspaceRoot == null ||
      !Number.isSafeInteger(sourceBytes) ||
      sourceBytes <= minimumSourceBytes
    ) {
      return null;
    }
    const remembered = await rememberOpenedFileRecord(
      openedFile,
      allocateSessionId,
    );
    return {
      discard: remembered.discard,
      ...(remembered.rangeOnly ? { rangeOnly: true } : {}),
      ...(remembered.sessionId == null
        ? {}
        : { sessionId: remembered.sessionId }),
      sourcePath: openedFile.absolutePath,
      viewerFile: remembered.viewerFile,
      workspaceBacked: true,
    };
  }

  return {
    async open(filePath, extra) {
      return (await openWithSource(filePath, extra)).viewerFile;
    },
    openIndexedWorkspaceFile,
    openVerifiedWithSource,
    openWithSource,
    async resolveResource(resourceUri, sessionId, extra) {
      const prefix = `${resourceUriPrefix}/`;
      if (
        !resourceUri.startsWith(prefix) ||
        !TOKEN_PATTERN.test(resourceUri.slice(prefix.length)) ||
        !z.string().uuid().safeParse(sessionId).success
      ) {
        throw new Error("The saved biological viewer presentation is invalid.");
      }
      extra.signal?.throwIfAborted();
      const record = await readPersistedOpenedFile({
        isSupportedFileName,
        maxAgeMs,
        now: now(),
        stateDirectory,
        token: resourceUri.slice(prefix.length),
      });
      if (record.sessionId == null || record.sessionId !== sessionId) {
        throw new Error(
          "The saved biological viewer presentation does not own this session.",
        );
      }
      if (record.bundled) {
        throw new Error("The saved biological viewer source cannot be restored.");
      }
      const canonicalPath = await realpath(record.absolutePath).catch(() => null);
      if (canonicalPath == null || canonicalPath !== record.absolutePath) {
        throw new Error("The saved biological viewer source moved or changed.");
      }
      const roots = await tryListCanonicalWorkspaceRoots(extra);
      const activeRoot = roots
        ?.filter((root) => isPathWithin(root, canonicalPath))
        .sort((left, right) => right.length - left.length)[0];
      if (
        (record.workspaceRoot != null &&
          (activeRoot !== record.workspaceRoot ||
            (await realpath(record.workspaceRoot).catch(() => null)) !==
              record.workspaceRoot)) ||
        (record.workspaceRoot == null &&
          roots != null &&
          roots.length > 0 &&
          activeRoot == null)
      ) {
        throw new Error(
          "The saved biological viewer source is outside its active workspace.",
        );
      }
      extra.signal?.throwIfAborted();
      const handle = await open(
        canonicalPath,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      ).catch(() => null);
      if (handle == null) {
        throw new Error("The saved biological viewer source moved or changed.");
      }
      try {
        const before = await handle.stat({ bigint: true });
        const named = await lstat(canonicalPath, { bigint: true }).catch(
          () => null,
        );
        const after = await handle.stat({ bigint: true });
        if (
          named == null ||
          !before.isFile() ||
          !named.isFile() ||
          named.isSymbolicLink() ||
          !sameFileIdentity(fileIdentityFromStat(before), record.fileIdentity) ||
          !sameFileIdentity(fileIdentityFromStat(after), record.fileIdentity) ||
          !sameFileIdentity(fileIdentityFromStat(named), record.fileIdentity) ||
          before.nlink !== after.nlink ||
          before.nlink !== named.nlink
        ) {
          throw new Error("The saved biological viewer source moved or changed.");
        }
        if (record.version === LEGACY_RECORD_VERSION) {
          const digest = createHash("sha256");
          if (before.size > 0n) {
            for await (const chunk of handle.createReadStream({
              autoClose: false,
              end: Number(before.size) - 1,
              highWaterMark: 64 * 1_024,
              start: 0,
            })) {
              extra.signal?.throwIfAborted();
              digest.update(chunk);
            }
          }
          const afterDigest = await handle.stat({ bigint: true });
          const namedAfterDigest = await lstat(canonicalPath, {
            bigint: true,
          }).catch(() => null);
          if (
            digest.digest("hex") !== record.expectedSha256 ||
            namedAfterDigest == null ||
            !namedAfterDigest.isFile() ||
            namedAfterDigest.isSymbolicLink() ||
            !sameFileIdentity(
              fileIdentityFromStat(afterDigest),
              record.fileIdentity,
            ) ||
            !sameFileIdentity(
              fileIdentityFromStat(namedAfterDigest),
              record.fileIdentity,
            ) ||
            afterDigest.nlink !== namedAfterDigest.nlink
          ) {
            throw new Error(
              "The saved biological viewer source moved or changed.",
            );
          }
        }
        extra.signal?.throwIfAborted();
        return {
          ...(record.rangeOnly ? { rangeOnly: true as const } : {}),
          sessionId,
          sourcePath: canonicalPath,
          workspaceBacked: record.workspaceRoot != null,
          workspaceRoot: record.workspaceRoot,
        };
      } finally {
        await handle.close();
      }
    },
    register(server) {
      server.registerResource(
        `${viewerName} chat file`,
        new ResourceTemplate(`${resourceUriPrefix}/{token}`, {
          list: undefined,
        }),
        {
          description: `A local file opened in the ${viewerName}.`,
          mimeType: "text/plain",
        },
        async (uri, variables, extra) => {
          const token = getSingleTemplateVariable(variables.token);
          if (token == null || !TOKEN_PATTERN.test(token)) {
            throw createHistoricalViewerFileError(
              "This historical viewer link has expired. Reopen the file from chat.",
            );
          }
          const openedFile = await readPersistedOpenedFile({
            isSupportedFileName,
            maxAgeMs,
            now: now(),
            stateDirectory,
            token,
          });
          return {
            contents: [
              {
                mimeType: "text/plain",
                text: await readOpenedFileContents(
                  openedFile,
                  extra,
                  maxFileBytes,
                  maxCompressedFileBytes,
                  resolvedMaxIndexedFileBytes,
                ),
                uri: uri.href,
              },
            ],
          };
        },
      );
    },
  };
}

function defaultChatFileStateDirectory(): string {
  const configuredCodexHome = process.env.CODEX_HOME?.trim();
  return path.resolve(
    configuredCodexHome || path.join(os.homedir(), ".codex"),
    "state",
    "plugins",
    "sequence-viewer",
    "opened-files-v1",
  );
}

async function resolveWorkspaceFile({
  extra,
  filePath,
  isSupportedFileName,
  viewerName,
}: {
  extra: RootsRequestExtra;
  filePath: string;
  isSupportedFileName: (fileName: string) => boolean;
  viewerName: string;
}): Promise<OpenedFile> {
  const requestedName = path.basename(filePath);
  if (!isSupportedFileName(requestedName)) {
    throw new Error(`${requestedName} is not supported by the ${viewerName}.`);
  }

  const roots = await tryListCanonicalWorkspaceRoots(extra);
  if (!path.isAbsolute(filePath) && (roots == null || roots.length === 0)) {
    throw new Error(
      `Relative paths require active local workspace roots. Retry with the exact absolute path to ${requestedName}.`,
    );
  }
  const candidates = path.isAbsolute(filePath)
    ? [path.resolve(filePath)]
    : (roots ?? []).map((root) => path.resolve(root, filePath));

  const resolvedFiles = new Map<string, OpenedFile>();
  for (const candidate of candidates) {
    let canonicalCandidate: string;
    try {
      canonicalCandidate = await realpath(candidate);
    } catch {
      continue;
    }
    const workspaceRoot =
      roots
        ?.filter((root) => isPathWithin(root, canonicalCandidate))
        .sort((left, right) => right.length - left.length)[0] ?? null;
    if (roots != null && roots.length > 0 && workspaceRoot == null) {
      continue;
    }

    try {
      const fileIdentity = await readFileIdentity(canonicalCandidate);
      if (fileIdentity == null) {
        continue;
      }
      resolvedFiles.set(canonicalCandidate, {
        absolutePath: canonicalCandidate,
        fileIdentity,
        name: requestedName,
        workspaceRoot,
      });
    } catch {
      continue;
    }
  }

  if (resolvedFiles.size === 1) {
    return [...resolvedFiles.values()][0] as OpenedFile;
  }
  if (resolvedFiles.size > 1) {
    throw new Error(
      `The relative path to ${requestedName} matches multiple active workspace roots. Retry with its exact absolute path.`,
    );
  }

  throw new Error(
    roots == null || roots.length === 0
      ? `${filePath} was not found as a readable local file.`
      : `${filePath} was not found inside the active local workspace roots.`,
  );
}

async function persistOpenedFile({
  maxAgeMs,
  maxPersistedFiles,
  now,
  openedFile,
  stateDirectory,
  token,
}: {
  maxAgeMs: number;
  maxPersistedFiles: number;
  now: number;
  openedFile: OpenedFile;
  stateDirectory: string;
  token: string;
}): Promise<void> {
  await prepareStateDirectory(stateDirectory);
  const payload: PersistedOpenedFilePayload = {
    ...openedFile,
    openedAt: now,
    token,
    version: RECORD_VERSION,
  };
  const key = await readOrCreateSigningKey(stateDirectory);
  const persistedPath = recordPath(stateDirectory, token);
  let recordWritten = false;
  try {
    await writeFile(
      persistedPath,
      `${JSON.stringify({
        ...payload,
        signature: signOpenedFile(payload, key),
      })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    recordWritten = true;
    await prunePersistedFiles({
      maxAgeMs,
      maxPersistedFiles,
      now,
      stateDirectory,
    });
  } catch (error) {
    if (recordWritten) {
      await unlinkIfExists(persistedPath).catch(() => undefined);
    }
    throw error;
  }
}

async function readPersistedOpenedFile({
  isSupportedFileName,
  maxAgeMs,
  now,
  stateDirectory,
  token,
}: {
  isSupportedFileName: (fileName: string) => boolean;
  maxAgeMs: number;
  now: number;
  stateDirectory: string;
  token: string;
}): Promise<PersistedOpenedFilePayload> {
  try {
    await prepareStateDirectory(stateDirectory);
    const persistedPath = recordPath(stateDirectory, token);
    const persistedStat = await lstat(persistedPath);
    if (!persistedStat.isFile() || persistedStat.size > MAX_RECORD_BYTES) {
      throw new Error("Invalid persisted viewer record.");
    }
    const parsed = persistedOpenedFileSchema.safeParse(
      JSON.parse(await readFile(persistedPath, "utf8")),
    );
    if (!parsed.success || parsed.data.token !== token) {
      throw new Error("Invalid persisted viewer record.");
    }
    const { signature, ...payload } = parsed.data;
    const key = await readOrCreateSigningKey(stateDirectory);
    const actualSignature = Buffer.from(signature, "base64url");
    const expectedSignature = Buffer.from(
      signOpenedFile(payload, key),
      "base64url",
    );
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      throw new Error("Invalid persisted viewer record signature.");
    }
    if (now - payload.openedAt > maxAgeMs) {
      await unlinkIfExists(persistedPath);
      throw new Error("Expired persisted viewer record.");
    }
    if (
      !isSupportedFileName(payload.name) ||
      payload.name.includes("/") ||
      payload.name.includes("\\") ||
      (payload.workspaceRoot != null &&
        !isPathWithin(payload.workspaceRoot, payload.absolutePath))
    ) {
      throw new Error("Expired persisted viewer record.");
    }
    return payload;
  } catch {
    throw createHistoricalViewerFileError(
      "This historical viewer link has expired. Reopen the file from chat.",
    );
  }
}

async function readOpenedFileContents(
  openedFile: PersistedOpenedFilePayload,
  extra: RootsRequestExtra,
  maxFileBytes: number,
  maxCompressedFileBytes: number,
  maxIndexedFileBytes: number,
): Promise<string> {
  if (openedFile.rangeOnly) {
    throw createHistoricalViewerFileError(
      "This large workspace source is available only through the active Sequence viewer's bounded, app-only range tools. Reopen it from its workspace.",
    );
  }
  if (openedFile.bundled) {
    throw createHistoricalViewerFileError(
      "Bundled example cards are retired. Choose a database-backed starter to acquire a current authoritative record.",
    );
  }
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(openedFile.absolutePath);
  } catch {
    throw createHistoricalViewerFileError(
      "The original file was moved or deleted. Reopen it from its current location.",
    );
  }
  if (canonicalPath !== openedFile.absolutePath) {
    throw createHistoricalViewerFileError(
      "The original file moved since this viewer card was created. Reopen it from its current location.",
    );
  }

  if (openedFile.workspaceRoot != null) {
    let canonicalOriginalRoot: string;
    try {
      canonicalOriginalRoot = await realpath(openedFile.workspaceRoot);
    } catch {
      throw createHistoricalViewerFileError(
        "The original workspace is no longer available. Reopen the file from chat.",
      );
    }
    if (
      canonicalOriginalRoot !== openedFile.workspaceRoot ||
      !isPathWithin(canonicalOriginalRoot, canonicalPath)
    ) {
      throw createHistoricalViewerFileError(
        "The original file is no longer available inside its workspace. Reopen it from chat.",
      );
    }
  }

  const currentRoots = await tryListCanonicalWorkspaceRoots(extra);
  const currentWorkspaceRoot = currentRoots
    ?.filter((root) => isPathWithin(root, canonicalPath))
    .sort((left, right) => right.length - left.length)[0];
  if (
    (openedFile.workspaceRoot != null &&
      currentWorkspaceRoot !== openedFile.workspaceRoot) ||
    (openedFile.workspaceRoot == null &&
      currentRoots != null &&
      currentRoots.length > 0 &&
      currentWorkspaceRoot == null)
  ) {
    throw createHistoricalViewerFileError(
      "This viewer file is outside the active workspace. Reopen it from the correct workspace.",
    );
  }

  let fileHandle;
  try {
    fileHandle = await open(
      canonicalPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch {
    throw createHistoricalViewerFileError(
      "The original file can no longer be read. Reopen it from its current location.",
    );
  }
  try {
    const beforeRead = fileIdentityFromStat(
      await fileHandle.stat({ bigint: true }),
    );
    assertFileIdentityWithinBudget(
      beforeRead,
      isIndexableSequenceFileName(openedFile.name)
        ? maxIndexedFileBytes
        : isGzipCompressedBiologicalFileName(openedFile.name)
          ? maxCompressedFileBytes
          : maxFileBytes,
    );
    if (!sameFileIdentity(beforeRead, openedFile.fileIdentity)) {
      throw createHistoricalViewerFileError(
        "The original file changed since this viewer card was created. Reopen it to view the current contents.",
      );
    }
    const fileSize = Number(beforeRead.size);
    const shouldIndex =
      isIndexableSequenceFileName(openedFile.name) &&
      (isGzipCompressedBiologicalFileName(openedFile.name) ||
        fileSize > 8 * 1_024 * 1_024);
    const contents = shouldIndex
      ? await readIndexedSequenceFile({
          expectedSha256: openedFile.expectedSha256,
          fileHandle,
          fileName: openedFile.name,
          maxDecodedBytes: maxIndexedFileBytes,
          signal: extra.signal,
          sourceBytes: fileSize,
          sourceVersion: fileIdentityVersion(openedFile.fileIdentity),
        })
      : await readWholeTextFile({
          compressed: isGzipCompressedBiologicalFileName(openedFile.name),
          expectedSha256: openedFile.expectedSha256,
          fileHandle,
          fileName: openedFile.name,
          maxTextBytes: maxFileBytes,
          sourceBytes: fileSize,
        });
    const afterRead = fileIdentityFromStat(
      await fileHandle.stat({ bigint: true }),
    );
    let currentPathIdentity: FileIdentity | null = null;
    try {
      currentPathIdentity = await readFileIdentity(canonicalPath);
    } catch {
      // The path may have moved or become unreadable after the handle opened.
    }
    if (
      !sameFileIdentity(beforeRead, afterRead) ||
      currentPathIdentity == null ||
      !sameFileIdentity(afterRead, currentPathIdentity)
    ) {
      throw createHistoricalViewerFileError(
        "The original file moved or changed while it was being opened. Reopen it to view the current contents.",
      );
    }
    assertTextWithinInputBudget(contents);
    return contents;
  } finally {
    await fileHandle.close();
  }
}

async function readWholeTextFile({
  compressed,
  expectedSha256,
  fileHandle,
  fileName,
  maxTextBytes,
  sourceBytes,
}: {
  compressed: boolean;
  expectedSha256?: string;
  fileHandle: Awaited<ReturnType<typeof open>>;
  fileName: string;
  maxTextBytes: number;
  sourceBytes: number;
}): Promise<string> {
  const bytes =
    expectedSha256 == null
      ? await fileHandle.readFile()
      : await readExactFileBytes(fileHandle, sourceBytes);
  assertExpectedFileDigest(bytes, expectedSha256);
  const resourceText = (decoded: Uint8Array): string =>
    getBinarySequenceFormatHint(fileName) != null ||
    sniffBinarySequenceFormat(decoded) != null
      ? serializeBinarySequenceEnvelope(decoded)
      : Buffer.from(
          decoded.buffer,
          decoded.byteOffset,
          decoded.byteLength,
        ).toString("utf8");
  if (!compressed) return resourceText(bytes);
  try {
    return resourceText(await gunzip(bytes, { maxOutputLength: maxTextBytes }));
  } catch (error) {
    if (
      error instanceof RangeError ||
      isNodeError(error, "ERR_BUFFER_TOO_LARGE")
    ) {
      throw new Error(
        `This compressed file expands beyond the bounded viewer limit of ${formatBytes(maxTextBytes)}. Create a smaller subset or summary and reopen it.`,
      );
    }
    throw error;
  }
}

async function readIndexedSequenceFile({
  expectedSha256,
  fileHandle,
  fileName,
  maxDecodedBytes,
  signal,
  sourceBytes,
  sourceVersion,
}: {
  expectedSha256?: string;
  fileHandle: Awaited<ReturnType<typeof open>>;
  fileName: string;
  maxDecodedBytes: number;
  signal?: AbortSignal;
  sourceBytes: number;
  sourceVersion: string;
}): Promise<string> {
  const compressed = isGzipCompressedBiologicalFileName(fileName);
  const rawStream = fileHandle.createReadStream({
    autoClose: false,
    ...(expectedSha256 == null || sourceBytes === 0
      ? {}
      : { end: sourceBytes - 1, start: 0 }),
  });
  const rawHash = expectedSha256 == null ? null : createHash("sha256");
  const updateRawHash =
    rawHash == null
      ? null
      : (chunk: string | Buffer) => {
          rawHash.update(chunk);
        };
  if (updateRawHash != null) rawStream.on("data", updateRawHash);
  const decodedStream = compressed ? rawStream.pipe(createGunzip()) : rawStream;
  const contentStream = decodedStream.pipe(
    createDecodedByteLimitTransform(maxDecodedBytes),
  );
  const forwardDecodedError = (error: Error): void => {
    contentStream.destroy(error);
  };
  const forwardRawError = (error: Error): void => {
    if (decodedStream !== rawStream) decodedStream.destroy(error);
    contentStream.destroy(error);
  };
  decodedStream.on("error", forwardDecodedError);
  rawStream.on("error", forwardRawError);
  contentStream.setEncoding("utf8");
  const reader = createInterface({ crlfDelay: Infinity, input: contentStream });
  const abort = (): void => {
    contentStream.destroy(new Error("Indexed sequence loading was cancelled."));
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const envelope = await parseIndexedSequenceLines({
      compressed,
      fileName,
      format: inferIndexedSequenceFormat(fileName),
      lines: reader,
      maxDecodedBytes,
      signal,
      sourceBytes,
      sourceVersion,
    });
    if (expectedSha256 != null && rawHash?.digest("hex") !== expectedSha256) {
      throw changedVerifiedSourceError();
    }
    return serializeIndexedSequenceEnvelope(envelope);
  } finally {
    signal?.removeEventListener("abort", abort);
    decodedStream.off("error", forwardDecodedError);
    rawStream.off("error", forwardRawError);
    if (updateRawHash != null) rawStream.off("data", updateRawHash);
    reader.close();
    if (!contentStream.readableEnded) contentStream.destroy();
    if (decodedStream !== rawStream && !decodedStream.readableEnded) {
      decodedStream.destroy();
    }
    if (!rawStream.readableEnded) rawStream.destroy();
  }
}

async function readExactFileBytes(
  fileHandle: Awaited<ReturnType<typeof open>>,
  byteLength: number,
): Promise<Buffer> {
  const bytes = Buffer.allocUnsafe(byteLength);
  let offset = 0;
  while (offset < byteLength) {
    const { bytesRead } = await fileHandle.read(
      bytes,
      offset,
      byteLength - offset,
      offset,
    );
    if (bytesRead === 0) throw changedVerifiedSourceError();
    offset += bytesRead;
  }
  return bytes;
}

function assertExpectedFileDigest(
  bytes: Uint8Array,
  expectedSha256: string | undefined,
): void {
  if (
    expectedSha256 != null &&
    createHash("sha256").update(bytes).digest("hex") !== expectedSha256
  ) {
    throw changedVerifiedSourceError();
  }
}

function changedVerifiedSourceError(): Error {
  return createHistoricalViewerFileError(
    "The original file changed since this viewer card was created. Reopen it to view the current contents.",
  );
}

function createDecodedByteLimitTransform(maxDecodedBytes: number): Transform {
  let decodedBytes = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      decodedBytes += Buffer.isBuffer(chunk)
        ? chunk.byteLength
        : Buffer.byteLength(String(chunk));
      if (decodedBytes > maxDecodedBytes) {
        callback(indexedExpansionLimitError(maxDecodedBytes));
        return;
      }
      callback(null, chunk);
    },
  });
}

function indexedExpansionLimitError(maxDecodedBytes: number): Error {
  return new Error(
    `This indexed file expands beyond the bounded viewer limit of ${formatBytes(maxDecodedBytes)}. Create a smaller subset or summary and reopen it.`,
  );
}

function isIndexableSequenceFileName(fileName: string): boolean {
  return /\.(?:fasta|fas|fa|fna|faa|fastq|fq)$/iu.test(
    stripBiologicalCompressionSuffix(fileName),
  );
}

function inferIndexedSequenceFormat(fileName: string): "fasta" | "fastq" {
  return /\.(?:fastq|fq)$/iu.test(stripBiologicalCompressionSuffix(fileName))
    ? "fastq"
    : "fasta";
}

function fileIdentityVersion(
  identity: FileIdentity | LegacyFileIdentity,
): string {
  return createHash("sha256")
    .update(
      [
        identity.device,
        identity.inode,
        identity.modifiedAtNanoseconds,
        identity.size,
        ...("changedAtNanoseconds" in identity
          ? [identity.changedAtNanoseconds]
          : []),
      ].join(":"),
    )
    .digest("hex");
}

function assertFileIdentityWithinBudget(
  identity: FileIdentity,
  maxFileBytes: number,
): void {
  const size = Number(identity.size);
  if (!Number.isSafeInteger(size) || size > maxFileBytes) {
    throw new Error(
      `This file is ${Number.isSafeInteger(size) ? formatBytes(size) : "too large"}; the bounded viewer accepts at most ${formatBytes(maxFileBytes)} of text. Create a smaller subset or summary and reopen it.`,
    );
  }
}

async function prepareStateDirectory(stateDirectory: string): Promise<void> {
  await mkdir(stateDirectory, { mode: 0o700, recursive: true });
  const directoryStat = await lstat(stateDirectory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error("Viewer state directory is not a private directory.");
  }
  if (
    typeof process.getuid === "function" &&
    directoryStat.uid !== process.getuid()
  ) {
    throw new Error("Viewer state directory is owned by another user.");
  }
  if (process.platform !== "win32") {
    await chmod(stateDirectory, 0o700);
  }
}

async function readOrCreateSigningKey(stateDirectory: string): Promise<Buffer> {
  const keyPath = path.join(stateDirectory, "signing-key");
  try {
    return await readSigningKey(keyPath);
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) {
      throw error;
    }
  }

  try {
    await writeFile(keyPath, randomBytes(SIGNING_KEY_BYTES), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (!isNodeError(error, "EEXIST")) {
      throw error;
    }
  }
  return readSigningKey(keyPath);
}

async function readSigningKey(keyPath: string): Promise<Buffer> {
  const keyStat = await lstat(keyPath);
  if (!keyStat.isFile() || keyStat.isSymbolicLink()) {
    throw new Error("Viewer state signing key is invalid.");
  }
  const key = await readFile(keyPath);
  if (key.length !== SIGNING_KEY_BYTES) {
    throw new Error("Viewer state signing key is invalid.");
  }
  if (process.platform !== "win32") {
    await chmod(keyPath, 0o600);
  }
  return key;
}

async function prunePersistedFiles({
  maxAgeMs,
  maxPersistedFiles,
  now,
  stateDirectory,
}: {
  maxAgeMs: number;
  maxPersistedFiles: number;
  now: number;
  stateDirectory: string;
}): Promise<void> {
  const entries = await readdir(stateDirectory, { withFileTypes: true });
  const persistedFiles = (
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() &&
            TOKEN_PATTERN.test(entry.name.replace(/\.json$/, "")) &&
            entry.name.endsWith(".json"),
        )
        .map(async (entry) => {
          const filePath = path.join(stateDirectory, entry.name);
          try {
            return { filePath, modifiedAt: (await lstat(filePath)).mtimeMs };
          } catch (error) {
            if (isNodeError(error, "ENOENT")) {
              return null;
            }
            throw error;
          }
        }),
    )
  )
    .filter((entry) => entry != null)
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  await Promise.all(
    persistedFiles
      .filter(
        ({ modifiedAt }, index) =>
          index >= maxPersistedFiles || now - modifiedAt > maxAgeMs,
      )
      .map(({ filePath }) => unlinkIfExists(filePath)),
  );
}

async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) {
      throw error;
    }
  }
}

async function readFileIdentity(
  filePath: string,
): Promise<FileIdentity | null> {
  const fileStat = await stat(filePath, { bigint: true });
  return fileStat.isFile() ? fileIdentityFromStat(fileStat) : null;
}

function fileIdentityFromStat(fileStat: {
  ctimeNs: bigint;
  dev: bigint;
  ino: bigint;
  mtimeNs: bigint;
  size: bigint;
}): FileIdentity {
  return {
    device: fileStat.dev.toString(),
    inode: fileStat.ino.toString(),
    modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
    size: fileStat.size.toString(),
    changedAtNanoseconds: fileStat.ctimeNs.toString(),
  };
}

function sameFileIdentity(
  left: FileIdentity | LegacyFileIdentity,
  right: FileIdentity | LegacyFileIdentity,
): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.modifiedAtNanoseconds === right.modifiedAtNanoseconds &&
    left.size === right.size &&
    (!("changedAtNanoseconds" in left) ||
      !("changedAtNanoseconds" in right) ||
      left.changedAtNanoseconds === right.changedAtNanoseconds)
  );
}

function signOpenedFile(
  payload: PersistedOpenedFilePayload,
  key: Buffer,
): string {
  return createHmac("sha256", key)
    .update(
      JSON.stringify({
        absolutePath: payload.absolutePath,
        bundled: payload.bundled,
        expectedSha256: payload.expectedSha256,
        fileIdentity: {
          device: payload.fileIdentity.device,
          inode: payload.fileIdentity.inode,
          modifiedAtNanoseconds: payload.fileIdentity.modifiedAtNanoseconds,
          size: payload.fileIdentity.size,
          ...(payload.version === RECORD_VERSION
            ? {
                changedAtNanoseconds:
                  payload.fileIdentity.changedAtNanoseconds,
              }
            : {}),
        },
        name: payload.name,
        openedAt: payload.openedAt,
        ...(payload.rangeOnly ? { rangeOnly: true } : {}),
        ...(payload.sessionId == null ? {} : { sessionId: payload.sessionId }),
        token: payload.token,
        version: payload.version,
        workspaceRoot: payload.workspaceRoot,
      }),
    )
    .digest("base64url");
}

function recordPath(stateDirectory: string, token: string): string {
  return path.join(stateDirectory, `${token}.json`);
}

async function tryListCanonicalWorkspaceRoots(
  extra: RootsRequestExtra,
): Promise<Array<string> | null> {
  let rootsResult: { roots: Array<{ uri: string }> };
  try {
    rootsResult = await extra.sendRequest(
      { method: "roots/list" },
      ListRootsResultSchema,
    );
  } catch {
    return null;
  }

  return (
    await Promise.all(
      rootsResult.roots.map(async ({ uri }) => {
        if (!uri.startsWith("file://")) {
          return null;
        }
        try {
          return await realpath(fileURLToPath(uri));
        } catch {
          return null;
        }
      }),
    )
  ).filter((root): root is string => root != null);
}

function isPathWithin(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === "" ||
    (!path.isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`))
  );
}

function getSingleTemplateVariable(
  value: string | Array<string> | undefined,
): string | null {
  return typeof value === "string" ? value : null;
}

function isNodeError(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
