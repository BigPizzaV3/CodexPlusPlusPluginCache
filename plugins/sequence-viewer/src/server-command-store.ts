import { randomUUID } from "node:crypto";

import { z } from "zod";

import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommand,
  SequenceViewerCommandResult,
} from "./viewer-commands";
import {
  SEQUENCE_VIEWER_LIMITS,
  SEQUENCE_VIEWER_SCHEMA_VERSION,
  SequenceViewerLimitError,
  utf8ByteLength,
} from "./runtime-contract";
import {
  sequenceArtifactMetadataSchema,
  sequenceSavedSessionMetadataSchema,
} from "./workbench-persistence-protocol";

type PendingCommand = {
  command: QueuedSequenceViewerCommand;
  reject: (error: Error) => void;
  resolve: (result: SequenceViewerCommandResult) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type SessionWaiter = {
  afterRevision: number;
  resolve: (command: QueuedSequenceViewerCommand | null) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type ViewerSession = {
  completed: Map<
    string,
    { result?: SequenceViewerCommandResult; status: "completed" | "timed-out" }
  >;
  expiresAt: number;
  pending: PendingCommand[];
  revision: number;
  waiters: SessionWaiter[];
};

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const MAX_TERMINAL_COMMANDS = 256;

type SequenceViewerCommandStoreOptions = {
  maxPendingGlobal?: number;
  maxPendingPerSession?: number;
  maxSessions?: number;
  maxWaitersGlobal?: number;
  maxWaitersPerSession?: number;
};

export class SequenceViewerCommandStore {
  private readonly sessions = new Map<string, ViewerSession>();
  private readonly maxPendingGlobal: number;
  private readonly maxPendingPerSession: number;
  private readonly maxSessions: number;
  private readonly maxWaitersGlobal: number;
  private readonly maxWaitersPerSession: number;

  constructor({
    maxPendingGlobal = SEQUENCE_VIEWER_LIMITS.command.maxPendingGlobal,
    maxPendingPerSession = SEQUENCE_VIEWER_LIMITS.command.maxPendingPerSession,
    maxSessions = SEQUENCE_VIEWER_LIMITS.command.maxSessions,
    maxWaitersGlobal = SEQUENCE_VIEWER_LIMITS.command.maxWaitersGlobal,
    maxWaitersPerSession = SEQUENCE_VIEWER_LIMITS.command.maxWaitersPerSession,
  }: SequenceViewerCommandStoreOptions = {}) {
    this.maxPendingGlobal = maxPendingGlobal;
    this.maxPendingPerSession = maxPendingPerSession;
    this.maxSessions = maxSessions;
    this.maxWaitersGlobal = maxWaitersGlobal;
    this.maxWaitersPerSession = maxWaitersPerSession;
  }

  registerSession(): {
    revision: number;
    schemaVersion: number;
    sessionId: string;
  } {
    this.pruneExpiredSessions();
    if (this.sessions.size >= this.maxSessions) {
      throw new SequenceViewerLimitError(
        "viewer_busy",
        "Too many biological viewer sessions are active. Close an unused viewer and retry.",
        { limit: this.maxSessions },
      );
    }
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      completed: new Map(),
      expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
      pending: [],
      revision: 0,
      waiters: [],
    });
    return {
      revision: 0,
      schemaVersion: SEQUENCE_VIEWER_SCHEMA_VERSION,
      sessionId,
    };
  }

  /**
   * Recreate an original command-session UUID only after the caller has
   * authenticated its owner-private, signed viewer-file presentation.
   */
  restoreSession(sessionId: string, acknowledgedRevision = 0): {
    created: boolean;
    revision: number;
    schemaVersion: number;
    sessionId: string;
  } {
    if (!z.string().uuid().safeParse(sessionId).success) {
      throw new Error("The biological viewer session identity is invalid.");
    }
    if (
      !Number.isSafeInteger(acknowledgedRevision) ||
      acknowledgedRevision < 0
    ) {
      throw new Error("The biological viewer session revision is invalid.");
    }
    this.pruneExpiredSessions();
    const existing = this.sessions.get(sessionId);
    if (existing != null) {
      existing.expiresAt = Date.now() + DEFAULT_SESSION_TTL_MS;
      return {
        created: false,
        revision: existing.revision,
        schemaVersion: SEQUENCE_VIEWER_SCHEMA_VERSION,
        sessionId,
      };
    }
    if (this.sessions.size >= this.maxSessions) {
      throw new SequenceViewerLimitError(
        "viewer_busy",
        "Too many biological viewer sessions are active. Close an unused viewer and retry.",
        { limit: this.maxSessions },
      );
    }
    this.sessions.set(sessionId, {
      completed: new Map(),
      expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
      pending: [],
      revision: acknowledgedRevision,
      waiters: [],
    });
    return {
      created: true,
      revision: acknowledgedRevision,
      schemaVersion: SEQUENCE_VIEWER_SCHEMA_VERSION,
      sessionId,
    };
  }

  async enqueue(
    sessionId: string,
    command: SequenceViewerCommand,
    timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  ): Promise<SequenceViewerCommandResult> {
    const session = this.getSession(sessionId);
    if (session.pending.length >= this.maxPendingPerSession) {
      throw new SequenceViewerLimitError(
        "viewer_queue_full",
        "This biological viewer command queue is full. Wait for an active action to finish and retry.",
        { limit: this.maxPendingPerSession },
      );
    }
    if (this.totalPendingCommands() >= this.maxPendingGlobal) {
      throw new SequenceViewerLimitError(
        "viewer_queue_full",
        "The global biological viewer command queue is full. Retry after another action completes.",
        { limit: this.maxPendingGlobal },
      );
    }
    session.revision += 1;
    const queuedCommand: QueuedSequenceViewerCommand = {
      ...command,
      commandId: randomUUID(),
      revision: session.revision,
    };

    return await new Promise<SequenceViewerCommandResult>((resolve, reject) => {
      const pending: PendingCommand = {
        command: queuedCommand,
        reject,
        resolve,
        timeout: setTimeout(() => {
          session.pending = session.pending.filter((item) => item !== pending);
          rememberTerminal(session, queuedCommand.commandId, {
            status: "timed-out",
          });
          reject(
            new Error(
              "The viewer did not acknowledge the requested action before the timeout.",
            ),
          );
        }, timeoutMs),
      };
      session.pending.push(pending);
      this.notifyWaiters(session);
    });
  }

  async waitForCommand(
    sessionId: string,
    afterRevision: number,
    timeoutMs: number,
  ): Promise<QueuedSequenceViewerCommand | null> {
    const session = this.getSession(sessionId);
    const ready = session.pending.find(
      ({ command }) => command.revision > afterRevision,
    );
    if (ready != null) {
      return ready.command;
    }

    if (
      session.waiters.length >= this.maxWaitersPerSession ||
      this.totalWaiters() >= this.maxWaitersGlobal
    ) {
      throw new SequenceViewerLimitError(
        "viewer_queue_full",
        "Too many biological viewer command waiters are active. Retry shortly.",
      );
    }

    return await new Promise<QueuedSequenceViewerCommand | null>((resolve) => {
      const waiter: SessionWaiter = {
        afterRevision,
        resolve,
        timeout: setTimeout(() => {
          session.waiters = session.waiters.filter((item) => item !== waiter);
          resolve(null);
        }, timeoutMs),
      };
      session.waiters.push(waiter);
    });
  }

  complete(
    sessionId: string,
    commandId: string,
    result: SequenceViewerCommandResult,
  ): "completed" | "duplicate" | "late" {
    const session = this.getSession(sessionId);
    const pending = session.pending.find(
      ({ command }) => command.commandId === commandId,
    );
    if (pending == null) {
      const terminal = session.completed.get(commandId);
      if (terminal?.status === "completed") return "duplicate";
      if (terminal?.status === "timed-out") return "late";
      throw new Error("The viewer command is no longer pending.");
    }
    const validatedResult = validateCommandResult(pending.command, result);
    clearTimeout(pending.timeout);
    session.pending = session.pending.filter((item) => item !== pending);
    rememberTerminal(session, commandId, {
      result: validatedResult,
      status: "completed",
    });
    pending.resolve(validatedResult);
    return "completed";
  }

  getPendingCommand(
    sessionId: string,
    commandId: string,
  ): QueuedSequenceViewerCommand {
    const session = this.getSession(sessionId);
    const pending = session.pending.find(
      ({ command }) => command.commandId === commandId,
    );
    if (pending == null) {
      throw new Error("The viewer command is no longer pending.");
    }
    return pending.command;
  }

  assertSessionActive(sessionId: string): void {
    this.getSession(sessionId);
  }

  closeSession(
    sessionId: string,
    reason = "The viewer session was closed before it mounted.",
  ): void {
    const session = this.sessions.get(sessionId);
    if (session == null) return;
    this.disposeSession(sessionId, session, reason);
  }

  private getSession(sessionId: string): ViewerSession {
    this.pruneExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (session == null) {
      throw new Error(
        "The viewer session is no longer active. Reopen the viewer and try again.",
      );
    }
    session.expiresAt = Date.now() + DEFAULT_SESSION_TTL_MS;
    return session;
  }

  private notifyWaiters(session: ViewerSession): void {
    const remaining: SessionWaiter[] = [];
    for (const waiter of session.waiters) {
      const ready = session.pending.find(
        ({ command }) => command.revision > waiter.afterRevision,
      );
      if (ready == null) {
        remaining.push(waiter);
        continue;
      }
      clearTimeout(waiter.timeout);
      waiter.resolve(ready.command);
    }
    session.waiters = remaining;
  }

  private totalPendingCommands(): number {
    let count = 0;
    for (const session of this.sessions.values())
      count += session.pending.length;
    return count;
  }

  private totalWaiters(): number {
    let count = 0;
    for (const session of this.sessions.values())
      count += session.waiters.length;
    return count;
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt > now) {
        continue;
      }
      this.disposeSession(sessionId, session, "The viewer session expired.");
    }
  }

  private disposeSession(
    sessionId: string,
    session: ViewerSession,
    reason: string,
  ): void {
    for (const pending of session.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    for (const waiter of session.waiters) {
      clearTimeout(waiter.timeout);
      waiter.resolve(null);
    }
    this.sessions.delete(sessionId);
  }
}

const compactProvenanceSchema = z
  .object({
    engine: z.string().trim().min(1).max(500),
    parameters: z.record(z.string().max(500), z.unknown()),
    sourceRevision: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) => utf8ByteLength(JSON.stringify(value)) <= 32 * 1_024,
    "Artifact provenance exceeds the compact completion budget.",
  );

function validateCommandResult(
  command: QueuedSequenceViewerCommand,
  result: SequenceViewerCommandResult,
): SequenceViewerCommandResult {
  if (
    !result.applied &&
    (command.action === "export_artifact" || command.action === "save_session")
  ) {
    if (result.state != null && Object.keys(result.state).length > 0) {
      throw new Error(
        "Failed persistence completion cannot include an artifact or session body.",
      );
    }
    return { applied: false, message: result.message };
  }
  if (!result.applied) return result;
  if (command.action === "export_artifact") {
    return {
      ...result,
      state: z
        .object({
          artifact: sequenceArtifactMetadataSchema,
          provenance: compactProvenanceSchema,
        })
        .strict()
        .parse(result.state),
    };
  }
  if (command.action === "save_session") {
    return {
      ...result,
      state: z
        .object({ session: sequenceSavedSessionMetadataSchema })
        .strict()
        .parse(result.state),
    };
  }
  return result;
}

function rememberTerminal(
  session: ViewerSession,
  commandId: string,
  terminal: {
    result?: SequenceViewerCommandResult;
    status: "completed" | "timed-out";
  },
): void {
  session.completed.delete(commandId);
  session.completed.set(commandId, terminal);
  while (session.completed.size > MAX_TERMINAL_COMMANDS) {
    const oldest = session.completed.keys().next().value as string | undefined;
    if (oldest == null) break;
    session.completed.delete(oldest);
  }
}
