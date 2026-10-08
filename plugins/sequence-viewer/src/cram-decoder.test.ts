import { describe, expect, it } from "vitest";

import {
  cramReadFeaturesToCigar,
  decodeCramWindowToSam,
} from "./cram-decoder";
import { parseSequenceTrack } from "./sequence/tracks";

const CRAM = "Q1JBTQMALQAAAAAAAAAAAAAAAAAAAAAAAADPAAAAAAAAAAAAAgIAgIQlD7gGAQAAeoC6H4sIAAAAAAAAE9vGwMDgEBzIGexnVVHB6eNnZWTA6WtqlZSUZpKSapZiYWJpnmhoaJmSkmiWamBuYmpkaGZinJLMGRpkpR9anFpUrF+UVJqaU6yfklqmn1FSnJOZpF+SWlyiX1Ghl5bIBTW6spL6RgMAKob8NboAAAAQG+fNAAAAQkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7OO9sxAEAAAABFAMAHgoBgKBWntNVAAEAgJWAlRIEVEQBAFNNGxsbGxtSTgFBUAF/EkJGAQEPQ0YDBAEDAQBSTAMEAQoBAEFQAQERUkcDCAH/////DwEATUYBARVOUwMEAQABAE5QAQEXVFMBARZUTAMEAQABAEZOAwQBAAEASU4FAgANQkIEBgEBKgEBJU1RAwQBAQEAUk4FAgALUVMBAQxSSQMEAQABAFNDBQIADgEA5supAgACACMjAAEUAwAIBwsMDxEVFhf/////D7v03m2El6EZ3abgdFIWQ9zWxUHpAAUAAAAvB/zxAQQLHQkfiwgAAAAAAAATSzRkSDRkSDRkAADGOdc0CQAAALzPmRgBBAwWHh+LCAAAAAAABBPjxAsA+TQVfx4AAAAwdMfMAQQPGAQfiwgAAAAAAAQTc1ZumAwAw4prwAQAAAC9oy/4AQQRFwMfiwgAAAAAAAQTY2BlBQDY2VzyAwAAAJ/oBIIBBBUXAx+LCAAAAAAABBNjYGQAAFPoWuYDAAAA8I9LzAEEFiALH4sIAAAAAAAEExP5////P57/////4wEAay8YkQsAAABJvxTdAQQXFwMfiwgAAAAAAAQTY+NmBAD9TD9vAwAAAP0uM3dgAQAAAQEPAgMUCAGAjstk99AAAQCAg4CDEgRURAEAU00bGxsbG1JOAUFQAW0PQkYBAQ9DRgEBEFJMAwQBCgEAQVABARFSRwMIAf////8PAQBORgMEAQABAFRMAwQBAAEARk4DBAEAAQBJTgUCAA1CQgQGAQEqAQElTVEDBAEBAQBSTgUCAAtRUwEBDFJJAwQBAQEAU0MFAgAOAQBAQ8SQAAIAISEBAQ8CAwYFCwwPEBH/////DxsxEk7y96F0BZLwkNjFEeFW/wKIAAUAAAAvB/zxAQQLGgYfiwgAAAAAAAATSzRkSDRkAADPSmNhBgAAAAGvzsoBBAwWFB+LCAAAAAAABBPjxAIAoRgI/hQAAACtHFAPAQQPFgIfiwgAAAAAAAQTc2YGAINfhAMCAAAA9xl7jAEEEBYCH4sIAAAAAAAEE2NlBAAs1qlLAgAAACdVahoBBBEWAh+LCAAAAAAABBNjYAUAcOazMQIAAAAdmLGaDwAAAP////8P4EVPRgAAAAABAAW92U8AAQAGBgEAAQABAO5jAUs=";
const CRAI = "H4sIAAAAAAAAEzLgNOQ0MuA0MjXiNDQD0pZGXIZAIUNTTnMjoJCJEaeRoQEXQIABAHb9ClkmAAAA";
const REFERENCE = ">xx\nAAAAAAAAAATTTTTTTTTT\n>yy\nAAAAAAAAAATTTTTTTTTT\n\n";

describe("CRAM evidence decoding", () => {
  it("decodes an indexed regional CRAM window into a bounded read track", async () => {
    const result = await decodeCramWindowToSam({
      cramBytes: bytes(CRAM),
      end: 20,
      indexBytes: bytes(CRAI),
      reference: "xx",
      referenceContents: REFERENCE,
      referenceFileName: "xx.fa",
      start: 1,
    });
    expect(result).toMatchObject({
      end: 20,
      reference: "xx",
      start: 1,
      truncated: false,
    });
    expect(result.sam).toContain("@SQ\tSN:xx\tLN:20");

    const track = parseSequenceTrack({
      content: result.sam,
      displayName: "triplet.cram",
      format: "cram",
      id: "track",
      requestedReference: "xx",
    });
    expect(track.format).toBe("cram");
    expect(track.kind).toBe("reads");
    expect(track.reads?.length).toBeGreaterThan(0);
    expect(track.mapping.status).toBe("matched");
  });

  it("requires a bounded coordinate window and a matching reference", async () => {
    await expect(
      decodeCramWindowToSam({
        cramBytes: bytes(CRAM),
        end: 200_000,
        indexBytes: bytes(CRAI),
        reference: "missing",
        referenceContents: REFERENCE,
        start: 1,
      }),
    ).rejects.toThrow("No CRAM reference matched");
  });

  it("preserves insertion, deletion, clipping, and splice semantics in CIGAR", () => {
    expect(
      cramReadFeaturesToCigar(
        [
          { code: "S", data: "AA", pos: 1 },
          { code: "I", data: "G", pos: 5 },
          { code: "D", data: 3, pos: 7 },
          { code: "N", data: 20, pos: 8 },
        ],
        10,
      ),
    ).toBe("2S2M1I1M3D1M20N3M");
  });
});

function bytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "base64"));
}
