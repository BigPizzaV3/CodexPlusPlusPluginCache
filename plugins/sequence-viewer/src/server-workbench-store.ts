import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "./runtime-contract";

const ARTIFACT_URI_PREFIX = "viewer-artifact://sequence-viewer/generated";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const artifactMetadataSchema = z
  .object({
    createdAt: z.number().int().nonnegative(),
    format: z.string().min(1).max(100),
    id: z.string().regex(UUID_PATTERN),
    mediaType: z.string().min(1).max(200),
    name: z.string().min(1).max(255),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    size: z.number().int().nonnegative(),
    version: z.literal(1),
  })
  .strict();

const sessionMetadataSchema = z
  .object({
    createdAt: z.number().int().nonnegative(),
    id: z.string().regex(UUID_PATTERN),
    name: z.string().min(1).max(255),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    size: z.number().int().nonnegative(),
    version: z.literal(1),
  })
  .strict();

export type PersistedArtifact = z.infer<typeof artifactMetadataSchema> & {
  resourceUri: string;
  sha256: string;
};

export function createServerWorkbenchStore({
  now = Date.now,
  stateDirectory = defaultStateDirectory(),
}: {
  now?: () => number;
  stateDirectory?: string;
} = {}) {
  const root = path.join(stateDirectory, "workbench-v1");
  const artifactsDirectory = path.join(root, "artifacts");
  const sessionsDirectory = path.join(root, "sessions");

  return {
    async persistArtifact({
      content,
      format,
      mediaType,
      name,
    }: {
      content: string;
      format: string;
      mediaType: string;
      name: string;
    }): Promise<PersistedArtifact> {
      const size = utf8ByteLength(content);
      if (size > SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes) {
        throw new Error(
          `Generated artifact is ${size.toLocaleString()} bytes; the bounded artifact store accepts at most ${SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes.toLocaleString()} bytes.`,
        );
      }
      await prepareDirectory(artifactsDirectory);
      const id = randomUUID();
      const metadata = artifactMetadataSchema.parse({
        createdAt: now(),
        format,
        id,
        mediaType,
        name: safeFileName(name),
        sha256: sha256Text(content),
        size,
        version: 1,
      });
      await Promise.all([
        writePrivateFile(artifactContentPath(artifactsDirectory, id), content),
        writePrivateFile(
          artifactMetadataPath(artifactsDirectory, id),
          `${JSON.stringify(metadata)}\n`,
        ),
      ]);
      await pruneDirectory(
        artifactsDirectory,
        ".metadata.json",
        SEQUENCE_VIEWER_LIMITS.session.maxArtifacts,
        now(),
      );
      return {
        ...metadata,
        resourceUri: artifactResourceUri(id),
        sha256: metadata.sha256 as string,
      };
    },

    async readArtifact(id: string): Promise<{
      content: string;
      metadata: z.infer<typeof artifactMetadataSchema>;
    }> {
      assertUuid(id);
      const metadata = artifactMetadataSchema.parse(
        JSON.parse(
          await readBoundedText(
            artifactMetadataPath(artifactsDirectory, id),
            16 * 1_024,
          ),
        ),
      );
      if (now() - metadata.createdAt > MAX_AGE_MS) {
        await deleteArtifactFiles(artifactsDirectory, id);
        throw new Error("This generated viewer artifact has expired.");
      }
      const content = await readBoundedText(
        artifactContentPath(artifactsDirectory, id),
        SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes,
      );
      if (utf8ByteLength(content) !== metadata.size) {
        throw new Error(
          "Generated viewer artifact metadata does not match its content.",
        );
      }
      if (metadata.sha256 != null && sha256Text(content) !== metadata.sha256) {
        throw new Error(
          "Generated viewer artifact digest does not match its content.",
        );
      }
      return { content, metadata };
    },

    register(server: McpServer): void {
      server.registerResource(
        "generated biological sequence artifact",
        new ResourceTemplate(`${ARTIFACT_URI_PREFIX}/{id}`, {
          list: undefined,
        }),
        {
          description:
            "A bounded derived artifact exported by the Biological Sequence & Alignment Viewer.",
          mimeType: "text/plain",
        },
        async (uri, variables) => {
          const id =
            typeof variables.id === "string" ? variables.id : undefined;
          if (id == null) throw new Error("Generated artifact ID is missing.");
          const { content, metadata } = await this.readArtifact(id);
          return {
            contents: [
              {
                mimeType: metadata.mediaType,
                text: content,
                uri: uri.href,
              },
            ],
          };
        },
      );
    },

    async saveSession({
      name,
      session,
    }: {
      name: string;
      session: string;
    }): Promise<{ id: string; name: string; sha256: string; size: number }> {
      const size = utf8ByteLength(session);
      if (size > SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes) {
        throw new Error(
          `Viewer session is ${size.toLocaleString()} bytes; the bounded session store accepts at most ${SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes.toLocaleString()} bytes.`,
        );
      }
      await prepareDirectory(sessionsDirectory);
      const id = randomUUID();
      const metadata = sessionMetadataSchema.parse({
        createdAt: now(),
        id,
        name: safeFileName(name),
        sha256: sha256Text(session),
        size,
        version: 1,
      });
      await Promise.all([
        writePrivateFile(sessionContentPath(sessionsDirectory, id), session),
        writePrivateFile(
          sessionMetadataPath(sessionsDirectory, id),
          `${JSON.stringify(metadata)}\n`,
        ),
      ]);
      await pruneDirectory(
        sessionsDirectory,
        ".metadata.json",
        SEQUENCE_VIEWER_LIMITS.session.maxSessions,
        now(),
      );
      return {
        id,
        name: metadata.name,
        sha256: metadata.sha256 as string,
        size,
      };
    },

    async readSession(id: string): Promise<string> {
      assertUuid(id);
      const metadata = sessionMetadataSchema.parse(
        JSON.parse(
          await readBoundedText(
            sessionMetadataPath(sessionsDirectory, id),
            16 * 1_024,
          ),
        ),
      );
      if (now() - metadata.createdAt > MAX_AGE_MS) {
        await deleteSessionFiles(sessionsDirectory, id);
        throw new Error("This saved viewer session has expired.");
      }
      const session = await readBoundedText(
        sessionContentPath(sessionsDirectory, id),
        SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes,
      );
      if (utf8ByteLength(session) !== metadata.size) {
        throw new Error(
          "Saved viewer session metadata does not match its content.",
        );
      }
      if (metadata.sha256 != null && sha256Text(session) !== metadata.sha256) {
        throw new Error(
          "Saved viewer session digest does not match its content.",
        );
      }
      return session;
    },
  };
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function defaultStateDirectory(): string {
  const configuredCodexHome = process.env.CODEX_HOME?.trim();
  return path.resolve(
    configuredCodexHome || path.join(os.homedir(), ".codex"),
    "state",
    "plugins",
    "sequence-viewer",
  );
}

function artifactResourceUri(id: string): string {
  return `${ARTIFACT_URI_PREFIX}/${id}`;
}

async function prepareDirectory(directory: string): Promise<void> {
  await mkdir(directory, { mode: 0o700, recursive: true });
  const stats = await lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(
      "Viewer workbench state must be stored in a private directory.",
    );
  }
  if (typeof process.getuid === "function" && stats.uid !== process.getuid()) {
    throw new Error(
      "Viewer workbench state directory is owned by another user.",
    );
  }
  if (process.platform !== "win32") {
    await chmod(directory, 0o700);
  }
}

async function writePrivateFile(
  filePath: string,
  content: string,
): Promise<void> {
  await writeFile(filePath, content, { flag: "wx", mode: 0o600 });
}

async function readBoundedText(
  filePath: string,
  maxBytes: number,
): Promise<string> {
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > maxBytes) {
    throw new Error(
      "Viewer workbench state file is invalid or exceeds its budget.",
    );
  }
  return readFile(filePath, "utf8");
}

async function pruneDirectory(
  directory: string,
  suffix: string,
  maxItems: number,
  currentTime: number,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const metadataFiles = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
        .map(async (entry) => {
          const filePath = path.join(directory, entry.name);
          try {
            const stats = await lstat(filePath);
            const id = entry.name.slice(0, -suffix.length);
            return UUID_PATTERN.test(id)
              ? { createdAt: stats.mtimeMs, id }
              : null;
          } catch {
            return null;
          }
        }),
    )
  )
    .filter((value) => value != null)
    .sort((left, right) => right.createdAt - left.createdAt);
  await Promise.all(
    metadataFiles
      .filter(
        ({ createdAt }, index) =>
          index >= maxItems || currentTime - createdAt > MAX_AGE_MS,
      )
      .map(({ id }) =>
        directory.endsWith("artifacts")
          ? deleteArtifactFiles(directory, id)
          : deleteSessionFiles(directory, id),
      ),
  );
}

async function deleteArtifactFiles(
  directory: string,
  id: string,
): Promise<void> {
  await Promise.all([
    unlinkIfExists(artifactContentPath(directory, id)),
    unlinkIfExists(artifactMetadataPath(directory, id)),
  ]);
}

async function deleteSessionFiles(
  directory: string,
  id: string,
): Promise<void> {
  await Promise.all([
    unlinkIfExists(sessionContentPath(directory, id)),
    unlinkIfExists(sessionMetadataPath(directory, id)),
  ]);
}

async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }
}

function artifactContentPath(directory: string, id: string): string {
  return path.join(directory, `${id}.artifact`);
}

function artifactMetadataPath(directory: string, id: string): string {
  return path.join(directory, `${id}.metadata.json`);
}

function sessionContentPath(directory: string, id: string): string {
  return path.join(directory, `${id}.session.json`);
}

function sessionMetadataPath(directory: string, id: string): string {
  return path.join(directory, `${id}.metadata.json`);
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value))
    throw new Error("Viewer workbench identifier is invalid.");
}

function safeFileName(value: string): string {
  const name = path
    .basename(value)
    .replaceAll(/[\0\r\n]/gu, "")
    .slice(0, 255);
  if (name.length === 0 || name === "." || name === "..") {
    throw new Error("Generated artifact name is invalid.");
  }
  return name;
}
