import { describe, expect, it } from "vitest";
import { SEQUENCE_VIEWER_LIMITS } from "../../runtime-contract";
import { parseSnapGeneRecord } from "./snapgene";

const encoder = new TextEncoder();

function concatenate(...pieces: Array<Uint8Array>): Uint8Array {
  const result = new Uint8Array(
    pieces.reduce((sum, piece) => sum + piece.length, 0),
  );
  let offset = 0;
  for (const piece of pieces) {
    result.set(piece, offset);
    offset += piece.length;
  }
  return result;
}

function packet(type: number, payload: string | Uint8Array): Uint8Array {
  const body = typeof payload === "string" ? encoder.encode(payload) : payload;
  const header = new Uint8Array(5);
  header[0] = type;
  new DataView(header.buffer).setUint32(1, body.length);
  return concatenate(header, body);
}

function cookie(
  exportVersion = 15,
  importVersion = 19,
  sequenceType = 1,
): Uint8Array {
  const body = new Uint8Array(14);
  body.set(encoder.encode("SnapGene"));
  const view = new DataView(body.buffer);
  view.setUint16(8, sequenceType);
  view.setUint16(10, exportVersion);
  view.setUint16(12, importVersion);
  return packet(9, body);
}

function sequencePacket(
  sequence = "ATGAAACCCGGG",
  circular = false,
): Uint8Array {
  return packet(
    0,
    concatenate(Uint8Array.of(circular ? 1 : 0), encoder.encode(sequence)),
  );
}

function document(...packets: Array<Uint8Array>): Uint8Array {
  return concatenate(cookie(), sequencePacket(), ...packets);
}

describe("native SnapGene import", () => {
  it("reads genuine TLV headers from a nonzero byte offset without disclosing a path", () => {
    const bytes = concatenate(
      Uint8Array.of(255, 254),
      document(),
      Uint8Array.of(253),
    );
    const result = parseSnapGeneRecord({
      bytes: bytes.subarray(2, bytes.length - 1),
      fileName: "/private/lab/project/vector.dna",
    });
    expect(result.record).toMatchObject({
      id: "vector",
      sourceLabel: "vector",
      length: 12,
      sequence: "ATGAAACCCGGG",
      molecule: "dna",
      topology: "linear",
      features: [],
      metadata: { snapgeneExportVersion: "15", snapgeneImportVersion: "19" },
    });
    expect(result.warnings).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("/private/lab");
  });

  it.each([
    [13, 11],
    [13, 12],
    [14, 16],
    [15, 19],
    [15, 20],
  ])(
    "accepts reference-tested header revision %i:%i",
    (exportVersion, importVersion) => {
      expect(
        parseSnapGeneRecord({
          bytes: concatenate(
            cookie(exportVersion, importVersion),
            sequencePacket("acgtryswkmbdhvn", true),
          ),
        }).record,
      ).toMatchObject({ sequence: "ACGTRYSWKMBDHVN", topology: "circular" });
    },
  );

  it("imports annotations before DNA, compound negative-strand CDS, notes, and qualifiers", () => {
    const bytes = concatenate(
      cookie(),
      packet(
        10,
        `<?xml version="1.0" encoding="UTF-8"?>
      <Features nextValidID="1"><Feature recentID="0" name="enzyme &amp; tag" type="CDS" directionality="2">
        <Segment range="1-3" name="second exon" color="#aabbcc"/>
        <Segment range="7-12" name="first exon"/>
        <Q name="codon_start"><V int="1"/></Q><Q name="transl_table"><V int="1"/></Q>
        <Q name="note"><V text="first"/><V predef="second"/></Q>
      </Feature></Features>`,
      ),
      packet(
        6,
        `<Notes><AccessionNumber>TEST01</AccessionNumber><Description>&lt;html&gt;&lt;body&gt;Demo &#945;&lt;/body&gt;&lt;/html&gt;</Description><Created UTC="12:00">2026.8.21</Created></Notes>`,
      ),
      sequencePacket(),
    );
    const { record, warnings } = parseSnapGeneRecord({ bytes });
    expect(record.description).toBe("Demo α");
    expect(record.metadata).toMatchObject({
      "snapgene.AccessionNumber": "TEST01",
      "snapgene.Created.UTC": "12:00",
    });
    expect(record.features[0]).toMatchObject({
      type: "CDS",
      label: "enzyme & tag",
      start: 1,
      end: 12,
      strand: "-",
      segments: [
        { start: 7, end: 12 },
        { start: 1, end: 3 },
      ],
      sourceLocation: "complement(join(1..3,7..12))",
      translation: "PGH",
      translationTrackReliable: true,
      qualifiers: {
        note: ["first", "second"],
        snapgene_segment_color: "1-3:#aabbcc",
        snapgene_segment_name: ["1-3:second exon", "7-12:first exon"],
      },
    });
    expect(
      record.features[0]?.translationCoordinateMap?.map(
        (codon) => codon.codonCoordinates,
      ),
    ).toEqual([
      [12, 11, 10],
      [9, 8, 7],
      [3, 2, 1],
    ]);
    expect(
      warnings.some((warning) => warning.code === "snapgene-rich-text"),
    ).toBe(true);
  });

  it("preserves forward and reverse origin-spanning feature paths without flattening them", () => {
    const bytes = concatenate(
      cookie(),
      sequencePacket("ATGAAACCCGGG", true),
      packet(
        10,
        `<Features><Feature name="forward" type="CDS" directionality="1"><Segment range="10-3"/></Feature><Feature name="reverse" type="CDS" directionality="2"><Segment range="10-3"/></Feature></Features>`,
      ),
    );
    const { record } = parseSnapGeneRecord({ bytes });
    expect(record.features[0]).toMatchObject({
      segments: [
        { start: 10, end: 12 },
        { start: 1, end: 3 },
      ],
      translation: "GM",
      sourceLocation: "join(10..12,1..3)",
    });
    expect(record.features[1]).toMatchObject({
      segments: [
        { start: 1, end: 3 },
        { start: 10, end: 12 },
      ],
      translation: "HP",
      sourceLocation: "complement(join(10..12,1..3))",
    });
  });

  it("treats equal range endpoints as one base and supports full circular paths", () => {
    const bytes = concatenate(
      cookie(),
      sequencePacket("ACGT", true),
      packet(
        10,
        `<Features><Feature><Segment range="2-2"/></Feature><Feature><Segment range="4-3"/></Feature></Features>`,
      ),
    );
    expect(
      parseSnapGeneRecord({ bytes }).record.features.map(
        (feature) => feature.segments,
      ),
    ).toEqual([
      [{ start: 2, end: 2 }],
      [
        { start: 4, end: 4 },
        { start: 1, end: 3 },
      ],
    ]);
  });

  it("imports primer sites using their zero-based inclusive coordinates and filters hidden duplicates", () => {
    const bytes = document(
      packet(
        5,
        `<Primers><HybridizationParams minContinuousMatchLen="3" minMeltingTemperature="40"/>
      <Primer name="Forward" sequence="AAATGAAA" description="a primer">
        <BindingSite location="0-5" boundStrand="0" annealedBases="ATGAAA" meltingTemperature="55"><Component bases="AA"/></BindingSite>
        <BindingSite location="0-5" boundStrand="0" simplified="1" annealedBases="ATGAAA" meltingTemperature="55"/>
        <BindingSite location="6-7" boundStrand="1" annealedBases="CC" meltingTemperature="12"/>
      </Primer><Primer name="Reverse" sequence="CCC"><BindingSite location="9-11" boundStrand="1" annealedBases="CCC" meltingTemperature="50"/></Primer>
    </Primers>`,
      ),
    );
    const { record, warnings } = parseSnapGeneRecord({ bytes });
    expect(record.features).toHaveLength(2);
    expect(record.features[0]).toMatchObject({
      type: "primer_bind",
      label: "Forward",
      start: 1,
      end: 6,
      strand: "+",
      qualifiers: {
        snapgene_sequence: "AAATGAAA",
        snapgene_primer_location: "0-5",
      },
    });
    expect(record.features[1]).toMatchObject({
      label: "Reverse",
      start: 10,
      end: 12,
      strand: "-",
    });
    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "snapgene-simplified-primer-sites",
        "snapgene-hidden-primer-sites",
        "unsupported-snapgene-xml-property",
      ]),
    );
  });

  it("imports origin-spanning primers and warns about missing filter measurements", () => {
    const bytes = concatenate(
      cookie(),
      sequencePacket("ACGT", true),
      packet(
        5,
        `<Primers><HybridizationParams minContinuousMatchLen="2" minMeltingTemperature="30"/><Primer name="wrap"><BindingSite location="3-0" boundStrand="0"/></Primer><Primer name="unbound" sequence="AAA"/></Primers>`,
      ),
    );
    const { record, warnings } = parseSnapGeneRecord({ bytes });
    expect(record.features[0]?.segments).toEqual([
      { start: 4, end: 4 },
      { start: 1, end: 1 },
    ]);
    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "snapgene-primer-filter-unknown",
        "snapgene-unbound-primer",
      ]),
    );
  });

  it("only suppresses a simplified primer site when a visible detailed counterpart exists", () => {
    const { record } = parseSnapGeneRecord({
      bytes: document(
        packet(
          5,
          `<Primers><HybridizationParams minMeltingTemperature="40"/><Primer name="detailed hidden"><BindingSite location="0-2" simplified="1" meltingTemperature="55"/><BindingSite location="0-2" meltingTemperature="12"/></Primer><Primer name="detailed visible"><BindingSite location="9-11" simplified="1" meltingTemperature="55"/><BindingSite location="9-11" meltingTemperature="55"/></Primer></Primers>`,
        ),
      ),
    });
    expect(
      record.features.map(({ label, start, end }) => ({ label, start, end })),
    ).toEqual([
      { label: "detailed hidden", start: 1, end: 3 },
      { label: "detailed visible", start: 10, end: 12 },
    ]);
  });

  it("normalizes qualifier linebreaks without dropping their text", () => {
    const { record } = parseSnapGeneRecord({
      bytes: document(
        packet(
          10,
          `<Features><Feature><Segment range="1-3"/><Q name="note"><V text="line one&#10;line two&#13;&#10;line three"/></Q></Feature></Features>`,
        ),
      ),
    });
    expect(record.features[0]?.qualifiers.note).toBe(
      "line one line two line three",
    );
  });

  it("retains incomplete literal markup without repeatedly scanning an untrusted string", () => {
    const literal = "&lt;a".repeat(20_000);
    const { record } = parseSnapGeneRecord({
      bytes: document(
        packet(6, `<Notes><Description>${literal}</Description></Notes>`),
      ),
    });
    expect(record.description).toBe("<a".repeat(20_000));
  });

  it("keeps unknown directional or segment semantics explicit without inventing translation", () => {
    const { record, warnings } = parseSnapGeneRecord({
      bytes: document(
        packet(
          10,
          `<Features><Feature directionality="3" type="CDS"><Segment range="1-3"/><Q name="translation"><V text="M"/></Q></Feature><Feature directionality="1" type="CDS"><Segment range="1-3" type="run-on-translation"/><Segment range="4-6" type="gap"/></Feature></Features>`,
        ),
      ),
    });
    expect(record.features[0]).toMatchObject({
      strand: "?",
      translation: "M",
      translationTrackReliable: false,
    });
    expect(record.features[1]).toMatchObject({
      segments: [{ start: 1, end: 3 }],
      translationTrackReliable: false,
      qualifiers: { snapgene_gap_range: "4-6" },
    });
    expect(record.features[1]?.translation).toBeUndefined();
    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "unsupported-snapgene-directionality",
        "unsupported-snapgene-segment",
        "snapgene-gap-segments",
      ]),
    );
  });

  it("reports unsupported packet and XML properties rather than silently discarding them", () => {
    const { warnings } = parseSnapGeneRecord({
      bytes: document(
        packet(0xfe, Uint8Array.of(1, 2, 3)),
        packet(0xfe, Uint8Array.of(4)),
        packet(
          10,
          `<Features display="new"><Unknown/><Feature name="feature" hidden="1"><Segment range="1-3"/><Q name="note"><V unknown="value"/></Q></Feature></Features>`,
        ),
      ),
    });
    expect(
      warnings.filter(
        (warning) => warning.code === "unsupported-snapgene-packet",
      ),
    ).toHaveLength(1);
    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "unsupported-snapgene-packet",
        "unsupported-snapgene-xml-property",
        "unsupported-snapgene-qualifier",
      ]),
    );
  });

  it("treats prototype-shaped qualifier names as ordinary data", () => {
    const { record } = parseSnapGeneRecord({
      bytes: document(
        packet(
          10,
          `<Features><Feature><Segment range="1-3"/><Q name="__proto__"><V text="literal"/></Q><Q name="constructor"><V text="also literal"/></Q></Feature></Features>`,
        ),
      ),
    });
    expect(
      Object.getOwnPropertyDescriptor(
        record.features[0]?.qualifiers,
        "__proto__",
      )?.value,
    ).toBe("literal");
    expect(record.features[0]?.qualifiers.constructor).toBe("also literal");
    expect(Object.getPrototypeOf(record.features[0]?.qualifiers)).toBe(
      Object.prototype,
    );
  });

  it("supports comments, CDATA, numeric entities, and quoted greater-than signs without a DOM", () => {
    const { record } = parseSnapGeneRecord({
      bytes: document(
        packet(
          6,
          `<?xml version='1.0'?><!--source--><Notes><Description><![CDATA[ATG & text]]></Description><Comments>one &quot;two&quot; &#x3b2;</Comments></Notes>`,
        ),
        packet(
          10,
          `<Features><Feature name="A > B"><Segment range='1-3'/></Feature></Features>`,
        ),
      ),
    });
    expect(record.description).toBe("ATG & text");
    expect(record.metadata["snapgene.Comments"]).toBe('one "two" β');
    expect(record.features[0]?.label).toBe("A > B");
  });

  it("bounds computed CDS coordinate-map materialization while preserving imported translations", () => {
    const sequence = "ATG".repeat(166_667);
    const feature = `<Feature directionality="1" type="CDS"><Segment range="1-${sequence.length}"/><Q name="translation"><V text="M"/></Q></Feature>`;
    const { record, warnings } = parseSnapGeneRecord({
      bytes: concatenate(
        cookie(),
        sequencePacket(sequence),
        packet(10, `<Features>${feature}${feature}</Features>`),
      ),
    });
    expect(record.features[0]?.translationTrackReliable).toBe(true);
    expect(record.features[1]).toMatchObject({
      translation: "M",
      translationTrackReliable: false,
      translationMappingUnavailableReason:
        "bounded SnapGene import translation budget",
    });
    expect(
      warnings.some(
        (warning) => warning.code === "snapgene-translation-budget",
      ),
    ).toBe(true);
  });
});

describe("SnapGene untrusted-input validation", () => {
  it.each([
    new Uint8Array(),
    Uint8Array.of(9),
    packet(9, "SnapGene"),
    packet(8, "not a cookie"),
    concatenate(cookie(99, 19), sequencePacket()),
    concatenate(cookie(15, 99), sequencePacket()),
    concatenate(cookie(15, 19, 2), sequencePacket()),
    concatenate(cookie(), cookie(), sequencePacket()),
    concatenate(cookie(), sequencePacket(), sequencePacket()),
    cookie(),
    concatenate(cookie(), packet(0, Uint8Array.of(1))),
    concatenate(cookie(), sequencePacket("ACGTX")),
    concatenate(cookie(), sequencePacket("ACGTſ")),
    concatenate(cookie(), packet(0, Uint8Array.of(0, 0xff))),
  ])(
    "rejects invalid cookies, revisions, sequence types, duplicate or invalid DNA packets (%#)",
    (bytes) => {
      expect(() => parseSnapGeneRecord({ bytes })).toThrow();
    },
  );

  it("validates the cookie magic even when length and type match", () => {
    const bytes = document();
    bytes[5] = "s".charCodeAt(0);
    expect(() => parseSnapGeneRecord({ bytes })).toThrow(/cookie/);
  });

  it("rejects truncated trailing headers and unsigned packet lengths beyond EOF", () => {
    expect(() =>
      parseSnapGeneRecord({
        bytes: concatenate(document(), Uint8Array.of(10, 0, 0)),
      }),
    ).toThrow(/Truncated/);
    expect(() =>
      parseSnapGeneRecord({
        bytes: concatenate(document(), Uint8Array.of(10, 255, 255, 255, 255)),
      }),
    ).toThrow(/beyond/);
    const bytes = document(packet(6, "<Notes/>"));
    expect(() =>
      parseSnapGeneRecord({ bytes: bytes.subarray(0, bytes.length - 1) }),
    ).toThrow(/beyond/);
  });

  it.each([
    "<Features>",
    "<Features><Feature></Features>",
    "<Features/><Features/>",
    "<Features x='1' x='2'/>",
    "<Features x='1'y='2'/>",
    "<Features x='a<b'/>",
    "<Features>&unknown;</Features>",
    "<Features>&#0;</Features>",
    "<Features>&#xD800;</Features>",
    "<Features>&#1114112;</Features>",
    "<Features>&amp</Features>",
    "<!DOCTYPE Features [<!ENTITY secret SYSTEM 'file:///private/secret'>]><Features>&secret;</Features>",
    "<?fetch remote?><Features/>",
    "<Features>\u0000</Features>",
    "<Features/><!--broken--comment-->",
    "<Features xmlns:test='remote'/>",
    "<Features><Feature><Segment range='1-3'/><Q name='n'><V int='1e10'/></Q></Feature></Features>",
  ])(
    "rejects malformed or unsupported XML without external resolution (%#)",
    (xml) => {
      expect(() =>
        parseSnapGeneRecord({ bytes: document(packet(10, xml)) }),
      ).toThrow();
    },
  );

  it.each([
    "0-3",
    "1-13",
    "4-2",
    "2",
    "1-2-3",
    "1.5-3",
    "999999999999999999999-3",
  ])("rejects invalid or out-of-bounds feature locations %s", (range) => {
    expect(() =>
      parseSnapGeneRecord({
        bytes: document(
          packet(
            10,
            `<Features><Feature><Segment range="${range}"/></Feature></Features>`,
          ),
        ),
      }),
    ).toThrow();
  });

  it("rejects malformed feature/primer structures and mislabeled XML packets", () => {
    for (const bytes of [
      document(packet(10, "<Notes/>")),
      document(packet(10, "<Features><Feature/></Features>")),
      document(
        packet(
          10,
          "<Features><Feature><Segment range='1-3'/><Q><V text='a'/></Q></Feature></Features>",
        ),
      ),
      document(
        packet(
          5,
          "<Primers><Primer><BindingSite location='0-12'/></Primer></Primers>",
        ),
      ),
      document(
        packet(
          5,
          "<Primers><Primer><BindingSite location='0-1' boundStrand='3'/></Primer></Primers>",
        ),
      ),
      document(
        packet(
          5,
          "<Primers><HybridizationParams/><HybridizationParams/></Primers>",
        ),
      ),
      document(packet(6, "<Notes/>"), packet(6, "<Notes/>")),
    ]) {
      expect(() => parseSnapGeneRecord({ bytes })).toThrow();
    }
  });

  it.each([
    "<Features\u00a0value='x'/>",
    "<!--before--><?xml version='1.0'?><Features/>",
    "<Features><Feature type='CDS'><Segment range='1-3'/><Q name='codon_start'><V int='0'/></Q></Feature></Features>",
    "<Features><Feature type='CDS'><Segment range='1-3'/><Q name='transl_table'><V text='not a code'/></Q></Feature></Features>",
  ])(
    "rejects malformed XML declaration/whitespace or invalid CDS qualifiers (%#)",
    (xml) => {
      expect(() =>
        parseSnapGeneRecord({ bytes: document(packet(10, xml)) }),
      ).toThrow();
    },
  );

  it("rejects invalid UTF-8 annotations", () => {
    expect(() =>
      parseSnapGeneRecord({ bytes: document(packet(10, Uint8Array.of(0xff))) }),
    ).toThrow();
  });

  it("enforces the input and XML nesting budgets before materializing an unbounded document", () => {
    expect(() =>
      parseSnapGeneRecord({
        bytes: new Uint8Array(
          SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes + 1,
        ),
      }),
    ).toThrow(/byte limit/);
    const nested = `<Features>${"<x>".repeat(32)}${"</x>".repeat(32)}</Features>`;
    expect(() =>
      parseSnapGeneRecord({ bytes: document(packet(10, nested)) }),
    ).toThrow(/nesting limit/);
  });
});
