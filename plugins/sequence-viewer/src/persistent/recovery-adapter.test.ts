import { describe, expect, it } from "vitest";

import {
  createSequenceScientificRecoveryMetadata,
  parseSequenceScientificRecoveryMetadata,
  SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY,
} from "./recovery-adapter";

describe("persistent Sequence viewer recovery", () => {
  it("creates host-recoverable metadata without source paths or capabilities", () => {
    const metadata = createSequenceScientificRecoveryMetadata({
      logicalSessionId: "11111111-1111-4111-8111-111111111111",
      recoveryReference: "sealed-sequence-reference-1",
    });

    expect(metadata).toEqual({
      family: "sequence",
      logicalSessionId: "11111111-1111-4111-8111-111111111111",
      recoveryReference: "sealed-sequence-reference-1",
      resourceUri: "ui://sequence-viewer/viewer",
    });
    expect(JSON.stringify(metadata)).not.toMatch(
      /(?:file:|workspaceRoot|handleId|bearer|destinationGrant|sourcePath)/u,
    );
  });

  it("restores only exact Sequence-family historical metadata", () => {
    const metadata = createSequenceScientificRecoveryMetadata({
      logicalSessionId: "logical-sequence-1",
      recoveryReference: "opaque-sequence-reference",
    });

    expect(
      parseSequenceScientificRecoveryMetadata({
        [SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY]: metadata,
      }),
    ).toEqual(metadata);

    for (const invalid of [
      { ...metadata, family: "structure" },
      { ...metadata, family: "slide" },
      { ...metadata, resourceUri: "ui://structure-viewer/viewer" },
      { ...metadata, recoveryReference: "/private/source.fa" },
      { ...metadata, recoveryReference: "../source.fa" },
      { ...metadata, sourcePath: "/private/source.fa" },
    ]) {
      expect(
        parseSequenceScientificRecoveryMetadata({
          [SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY]: invalid,
        }),
      ).toBeNull();
    }
  });

  it("retains the distinct strong recovery reference minted by the host", () => {
    const logicalSessionId = "11111111-1111-4111-8111-111111111111";
    const recoveryReference = "host-sealed-072209bb7b154276b8ba";
    expect(
      createSequenceScientificRecoveryMetadata({
        logicalSessionId,
        recoveryReference,
        threadId: "thread-1",
      }),
    ).toMatchObject({
      logicalSessionId,
      recoveryReference,
      threadId: "thread-1",
    });
    expect(recoveryReference).not.toBe(logicalSessionId);
  });
});
