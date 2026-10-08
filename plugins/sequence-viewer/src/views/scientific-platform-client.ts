import type { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";

import type { SequenceNativeCheckpointClient } from "../persistent/durable-viewer-state";
import type { ScientificSequenceDataClient } from "../persistent/scientific-data-client";
import {
  SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
  SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY,
  SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
  SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
  SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
  sequenceScientificSourceSchema,
  type SequenceScientificSource,
} from "../scientific-platform-protocol";

const recordPageSchema = z.object({
  complete: z.boolean(),
  cursor: z.string(),
  nextCursor: z.string().nullable(),
  records: z
    .array(
      z.object({
        description: z.string(),
        id: z.string().min(1),
        sequenceLength: z.number().int().nonnegative(),
      }),
    )
    .max(256),
  sourceRevision: z.string(),
});

const sequenceWindowSchema = z.object({
  end1Decimal: z.string(),
  quality: z.string().optional(),
  sequence: z.string().max(64 * 1_024),
  sourceRevision: z.string(),
  start1Decimal: z.string(),
});

const checkpointReceiptSchema = z.object({
  checkpointVersion: z.literal(1),
  lastAcknowledgedRevision: z.number().int().nonnegative(),
  logicalSessionId: z.string().uuid(),
  recoveryReference: z.string(),
});

const restoredCheckpointSchema = z.discriminatedUnion("hasCheckpoint", [
  z.object({ hasCheckpoint: z.literal(false) }),
  z.object({
    checkpointBase64: z.string(),
    hasCheckpoint: z.literal(true),
    lastAcknowledgedRevision: z.number().int().nonnegative(),
    recoveryReference: z.string(),
    sourceRevision: z.string(),
  }),
]);

export function parsePluginScientificSequenceSource(
  metadata: unknown,
): SequenceScientificSource | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const candidate = Object.hasOwn(
    metadata,
    SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY,
  )
    ? metadata[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY as keyof typeof metadata]
    : undefined;
  const parsed = sequenceScientificSourceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Standard app-only MCP tools: no host extensions, HTTP, or native grants. */
export class PluginScientificSequenceDataClient
  implements SequenceNativeCheckpointClient
{
  readonly session: SequenceNativeCheckpointClient["session"];

  constructor(
    private readonly app: Pick<App, "callServerTool">,
    readonly source: SequenceScientificSource,
  ) {
    this.session = {
      backendGeneration: 0,
      backendInstanceId: "sequence-plugin-mcp",
      family: "sequence",
      logicalSessionId: source.sessionId,
      sourceRevision: source.sourceRevision,
    };
  }

  async listRecords(
    input: Parameters<ScientificSequenceDataClient["listRecords"]>[0],
  ): ReturnType<ScientificSequenceDataClient["listRecords"]> {
    const result = recordPageSchema.parse(
      await this.#request(
        SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
        {
          ...(input.cursor == null ? {} : { cursor: input.cursor }),
          limit: input.limit,
        },
        input.signal,
      ),
    );
    this.#assertRevision(result.sourceRevision);
    return result;
  }

  async readResidueWindow(
    input: Parameters<ScientificSequenceDataClient["readResidueWindow"]>[0],
  ): ReturnType<ScientificSequenceDataClient["readResidueWindow"]> {
    const result = sequenceWindowSchema.parse(
      await this.#request(
        SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
        {
          end1Decimal: input.end1Decimal,
          includeQuality: input.includeQuality === true,
          recordNumber: input.recordNumber,
          start1Decimal: input.start1Decimal,
        },
        input.signal,
      ),
    );
    this.#assertRevision(result.sourceRevision);
    if (
      input.includeQuality === true &&
      (result.quality == null || result.quality.length !== result.sequence.length)
    ) {
      throw new Error("The Sequence quality window does not match its residues.");
    }
    return result;
  }

  async checkpoint(
    input: Parameters<SequenceNativeCheckpointClient["checkpoint"]>[0],
  ): ReturnType<SequenceNativeCheckpointClient["checkpoint"]> {
    const receipt = checkpointReceiptSchema.parse(
      await this.#request(
        SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
        {
          checkpointBase64: encodeBase64(input.checkpoint),
          lastAcknowledgedRevision: input.lastAcknowledgedRevision,
        },
        input.signal,
      ),
    );
    if (receipt.logicalSessionId !== this.source.sessionId) {
      throw new Error("The Sequence checkpoint belongs to another viewer.");
    }
    return receipt;
  }

  async restoreCheckpoint(
    input?: Parameters<SequenceNativeCheckpointClient["restoreCheckpoint"]>[0],
  ): ReturnType<SequenceNativeCheckpointClient["restoreCheckpoint"]> {
    const restored = restoredCheckpointSchema.parse(
      await this.#request(
        SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
        {},
        input?.signal,
      ),
    );
    if (!restored.hasCheckpoint) return restored;
    this.#assertRevision(restored.sourceRevision);
    const { checkpointBase64, ...receipt } = restored;
    return { ...receipt, checkpoint: decodeBase64(checkpointBase64) };
  }

  async #request(
    name: string,
    arguments_: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    signal?.throwIfAborted();
    const result = await this.app.callServerTool(
      {
        arguments: {
          ...arguments_,
          sessionId: this.source.sessionId,
          sourceId: this.source.sourceId,
          sourceRevision: this.source.sourceRevision,
        },
        name,
      },
      signal == null ? undefined : { signal },
    );
    signal?.throwIfAborted();
    if (result.isError) {
      throw new Error("The plugin-owned Sequence source request was refused.");
    }
    return result.structuredContent;
  }

  #assertRevision(revision: string): void {
    if (revision !== this.source.sourceRevision) {
      throw new Error("The Sequence source changed after it was opened.");
    }
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
