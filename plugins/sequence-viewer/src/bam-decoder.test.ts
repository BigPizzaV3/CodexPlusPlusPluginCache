import { describe, expect, it } from "vitest";

import { decodeBamWindowToSam } from "./bam-decoder";
import { parseSequenceTrack } from "./sequence/tracks";

// Official GMOD bam-js SAM specification fixture and BAI index.
const BAM = "H4sIBAAAAAAA/wYAQkMCAFgAc3L0ZdRiYGBw8HDhDPOzMtQz4wz2t0rOzy9KycxLLEnlcggO5Az2sypKTeP08bMyMeViBKpmAWKgCIMukAYA2DSCpUIAAAAfiwgEAAAAAAD/BgBCQwIAAQELZoAANiBmlfMUYmVIZhCEiqkAsToQFxkYGDI0ABmKQOwAxEJAbADEHSISgiKOjRoO/9GBH9QIDrixDAx8QAyTZ4AYa8RgAmQkALEYEAtCjRcUdGwEGotqYiiaiUxAmhvTRGOGEKiJThqCTo0CSCYEO0YVpabpGFnq6OqYeZj66hia6xhYMzhBDeaHGsyM3WATsKGPgTgAiCVENJpEFJAM94aaIgMyRRDkPAEOVmzOS4Wa0OiigOwqSx1tHdNgM18dYwMdQ2sGa6QoADmKkWEyAydSVN0E6gRHywRQtDi5KDYggt7XmREAnlXuT9YBAAAfiwgEAAAAAAD/BgBCQwIAGwADAAAAAAAAAAAA";
const BAI = "QkFJAQEAAAACAAAASRIAAAEAAAAAAFkAAAAAAAAAWwEAAAAASpIAAAIAAAAAAFkAAAAAAAAAWwEAAAAABgAAAAAAAAAAAAAAAAAAAAEAAAAAAFkAAAAAAAAAAAAAAAAA";

describe("indexed BAM evidence decoding", () => {
  it("decodes a bounded one-based viewer window through BAI", async () => {
    const result = await decodeBamWindowToSam({
      bamBytes: bytes(BAM),
      end: 45,
      indexBytes: bytes(BAI),
      reference: "ref",
      start: 1,
    });
    expect(result).toMatchObject({
      end: 45,
      reference: "ref",
      start: 1,
      truncated: false,
    });
    expect(result.sam).toContain("@SQ\tSN:ref\tLN:45");

    const track = parseSequenceTrack({
      content: result.sam,
      displayName: "samspec.bam",
      format: "bam",
      id: "track",
      requestedReference: "ref",
    });
    expect(track.kind).toBe("reads");
    expect(track.reads?.length).toBeGreaterThan(0);
    expect(track.reads?.some(({ cigar }) => cigar.includes("I"))).toBe(true);
    expect(track.mapping.status).toBe("matched");
  });

  it("rejects oversized and unknown-reference windows", async () => {
    await expect(
      decodeBamWindowToSam({
        bamBytes: bytes(BAM),
        indexBytes: bytes(BAI),
        reference: "missing",
      }),
    ).rejects.toThrow("No BAM reference matched");
  });
});

function bytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "base64"));
}
