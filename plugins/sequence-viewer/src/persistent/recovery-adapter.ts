import { z } from "zod";

export const SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY = "openai/scientific-viewer/recovery";

export const SEQUENCE_PERSISTENT_RESOURCE_URI = "ui://sequence-viewer/viewer";

const opaqueRecoveryIdentifierSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (value) => value === value.trim() && !/[\u0000-\u001f\u007f/\\]/u.test(value),
    "Viewer recovery identifiers must be opaque and path-free.",
  );

export const sequenceScientificRecoveryMetadataSchema = z
  .object({
    family: z.literal("sequence"),
    logicalSessionId: opaqueRecoveryIdentifierSchema,
    recoveryReference: opaqueRecoveryIdentifierSchema,
    resourceUri: z.literal(SEQUENCE_PERSISTENT_RESOURCE_URI),
    threadId: opaqueRecoveryIdentifierSchema.optional(),
  })
  .strict();

export type SequenceScientificRecoveryMetadata = z.infer<
  typeof sequenceScientificRecoveryMetadataSchema
>;

export function createSequenceScientificRecoveryMetadata({
  logicalSessionId,
  recoveryReference,
  threadId,
}: {
  logicalSessionId: string;
  recoveryReference: string;
  threadId?: string;
}): SequenceScientificRecoveryMetadata {
  return sequenceScientificRecoveryMetadataSchema.parse({
    family: "sequence",
    logicalSessionId,
    recoveryReference,
    resourceUri: SEQUENCE_PERSISTENT_RESOURCE_URI,
    threadId,
  });
}

export function parseSequenceScientificRecoveryMetadata(
  metadata: unknown,
): SequenceScientificRecoveryMetadata | null {
  if (
    typeof metadata !== "object" ||
    metadata == null ||
    !(SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY in metadata)
  ) {
    return null;
  }
  const parsed = sequenceScientificRecoveryMetadataSchema.safeParse(
    metadata[SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY],
  );
  return parsed.success ? parsed.data : null;
}
