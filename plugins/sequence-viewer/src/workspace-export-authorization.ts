import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  sequencePrepareWorkspaceExportInputSchema,
  type SequenceWorkbenchPayloadDeclaration,
} from "./workbench-persistence-protocol";

type WorkspaceExportRequest = z.infer<
  typeof sequencePrepareWorkspaceExportInputSchema
>;

type Authorization = WorkspaceExportRequest & {
  bindingId: string;
  commandId: string;
  expiresAt: number;
  transport?: {
    callerId: string;
    uploadId: string;
  };
};

const MAX_AUTHORIZATIONS = 64;
const MAX_CONSUMED_AUTHORIZATIONS = 256;
const AUTHORIZATION_TTL_MS = 5 * 60 * 1_000;

type PersistenceIdentity = Pick<
  SequenceWorkbenchPayloadDeclaration,
  "callerId" | "commandId" | "sessionId" | "uploadId"
>;

export class SequenceWorkspaceExportAuthorizationStore {
  private readonly authorizations = new Map<string, Authorization>();
  private readonly consumedAuthorizations = new Map<string, Authorization>();

  constructor(private readonly now: () => number = Date.now) {}

  create(input: WorkspaceExportRequest, bindingId: string): string {
    this.prune();
    if (this.authorizations.size >= MAX_AUTHORIZATIONS) {
      throw new Error(
        "Too many workspace exports are pending. Finish or cancel an export and retry.",
      );
    }
    const commandId = randomUUID();
    this.authorizations.set(commandId, {
      ...input,
      bindingId,
      commandId,
      expiresAt: this.now() + AUTHORIZATION_TTL_MS,
    });
    return commandId;
  }

  assertDeclaration(input: SequenceWorkbenchPayloadDeclaration): string {
    const authorization = this.get(input.commandId, input.sessionId);
    const authorizationKind = authorization.kind ?? "artifact";
    if (
      input.kind !== authorizationKind ||
      input.destination.kind !== "workspace" ||
      input.byteLength !== authorization.byteLength ||
      input.name !== authorization.name ||
      input.sha256 !== authorization.sha256 ||
      JSON.stringify(input.destination) !==
        JSON.stringify(authorization.destination) ||
      (authorizationKind === "artifact" &&
        (input.format !== authorization.format ||
          input.mediaType !== authorization.mediaType ||
          JSON.stringify(input.provenance) !==
            JSON.stringify(authorization.provenance))) ||
      (authorizationKind === "session" &&
        (input.format != null ||
          input.mediaType != null ||
          input.provenance != null))
    ) {
      throw new Error(
        "The workspace upload does not match its authorized destination and declaration.",
      );
    }
    this.assertOrBindTransport(authorization, input);
    return authorization.bindingId;
  }

  assertIdentity(input: PersistenceIdentity): string {
    const authorization = this.get(input.commandId, input.sessionId);
    this.assertOrBindTransport(authorization, input);
    return authorization.bindingId;
  }

  consumeIfPresent(input: PersistenceIdentity): boolean {
    this.prune();
    const active = this.authorizations.get(input.commandId);
    const consumed = this.consumedAuthorizations.get(input.commandId);
    const authorization = active ?? consumed;
    if (authorization == null) return false;
    this.assertSession(authorization, input.sessionId);
    this.assertOrBindTransport(authorization, input);
    authorization.expiresAt = this.now() + AUTHORIZATION_TTL_MS;
    if (active != null) {
      this.authorizations.delete(input.commandId);
      while (
        this.consumedAuthorizations.size >= MAX_CONSUMED_AUTHORIZATIONS
      ) {
        const oldest = this.consumedAuthorizations.keys().next().value as
          | string
          | undefined;
        if (oldest == null) break;
        this.consumedAuthorizations.delete(oldest);
      }
    } else {
      this.consumedAuthorizations.delete(input.commandId);
    }
    this.consumedAuthorizations.set(input.commandId, authorization);
    return true;
  }

  private get(commandId: string, sessionId: string): Authorization {
    this.prune();
    const authorization =
      this.authorizations.get(commandId) ??
      this.consumedAuthorizations.get(commandId);
    if (authorization == null) {
      throw new Error("The workspace export authorization expired or was not found.");
    }
    this.assertSession(authorization, sessionId);
    authorization.expiresAt = this.now() + AUTHORIZATION_TTL_MS;
    return authorization;
  }

  private assertSession(
    authorization: Authorization,
    sessionId: string,
  ): void {
    if (authorization.sessionId !== sessionId) {
      throw new Error("The workspace export belongs to another viewer session.");
    }
  }

  private assertOrBindTransport(
    authorization: Authorization,
    input: Pick<PersistenceIdentity, "callerId" | "uploadId">,
  ): void {
    if (authorization.transport == null) {
      authorization.transport = {
        callerId: input.callerId,
        uploadId: input.uploadId,
      };
      return;
    }
    if (
      authorization.transport.callerId !== input.callerId ||
      authorization.transport.uploadId !== input.uploadId
    ) {
      throw new Error(
        "The workspace export authorization belongs to another upload.",
      );
    }
  }

  private prune(): void {
    const now = this.now();
    for (const [commandId, authorization] of this.authorizations) {
      if (authorization.expiresAt <= now) this.authorizations.delete(commandId);
    }
    for (const [commandId, authorization] of this.consumedAuthorizations) {
      if (authorization.expiresAt <= now) {
        this.consumedAuthorizations.delete(commandId);
      }
    }
  }
}
