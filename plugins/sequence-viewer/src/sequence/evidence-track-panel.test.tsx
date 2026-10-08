import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createOriginSpanningSelection } from "./selection";
import { parseSequenceDocument } from "./parser";
import { parseSequenceTrack } from "./tracks";
import { EvidenceTrackPanel } from "./evidence-track-panel";
import { DEFAULT_READ_PILEUP_STATE, type ReadPileupState } from "./read-pileup";
import { getSequenceResidueStyle } from "./sequence-palette";

afterEach(() => cleanup());

describe("EvidenceTrackPanel", () => {
  it.each([
    ["dna", "ACGTRYSWKMBDHVN"],
    ["rna", "ACGURYSWKMBDHVN"],
    ["nucleic-acid-ambiguous", "ACGTURYSWKMBDHVN"],
  ] as const)(
    "uses the shared soft palette for %s reference and read glyphs, keeping ambiguity neutral",
    (molecule, sequence) => {
      const record = { ...referenceRecord(sequence), molecule };
      const track = samTrack(
        `all-bases\t0\tref\t1\t60\t${sequence.length}M\t*\t0\t0\t${sequence}\t${"I".repeat(sequence.length)}`,
      );
      const { container } = render(
        <EvidenceTrackPanel
          record={record}
          readPileupState={{
            ...DEFAULT_READ_PILEUP_STATE,
            options: {
              ...DEFAULT_READ_PILEUP_STATE.options,
              showAllBases: true,
            },
          }}
          tracks={[track]}
          viewport={null}
        />,
      );
      const referenceGlyphs = screen
        .getByRole("img", { name: "Selected reference bases" })
        .querySelectorAll("g");
      const readGlyphs = container.querySelectorAll("[data-base-comparison]");
      expect(referenceGlyphs).toHaveLength(sequence.length);
      expect(readGlyphs).toHaveLength(sequence.length);
      for (const [index, residue] of [...sequence].entries()) {
        const token =
          residue === "U"
            ? "t"
            : "ACGT".includes(residue)
              ? residue.toLowerCase()
              : "neutral";
        for (const glyph of [referenceGlyphs[index], readGlyphs[index]]) {
          expect(glyph?.querySelector("rect")).toHaveAttribute(
            "fill",
            `var(--bio-sequence-${token}-surface)`,
          );
          const lettering = glyph?.querySelector("text");
          expect(lettering).toHaveAttribute(
            "fill",
            `var(--bio-sequence-${token}-foreground)`,
          );
          expect(lettering).toHaveTextContent(residue);
          expect(lettering).not.toHaveAttribute("stroke");
        }
      }
    },
  );

  it.each([
    ["ncbi-nucleic-acid", "#008000"],
    ["jalview-nucleotide", "#3c88ee"],
  ] as const)(
    "keeps low-quality %s read lettering outlined without changing palette fills or quality opacity",
    (paletteId, uracilColor) => {
      const record = referenceRecord("GUNA");
      const track = samTrack(
        "rna-read\t0\tref\t1\t60\t4M\t*\t0\t0\tGUNA\t!+5I",
      );
      const props = {
        record,
        readPileupState: {
          ...DEFAULT_READ_PILEUP_STATE,
          options: { ...DEFAULT_READ_PILEUP_STATE.options, showAllBases: true },
        },
        tracks: [track],
        viewport: null,
      };
      const { container, rerender } = render(<EvidenceTrackPanel {...props} />);
      expect(
        screen
          .getByRole("img", { name: "Selected reference bases" })
          .querySelectorAll("rect")[1],
      ).toHaveAttribute("fill", "var(--bio-sequence-t-surface)");
      const opacityBefore = Array.from(
        container.querySelectorAll("[data-base-comparison] rect"),
        (rect) => rect.getAttribute("fill-opacity"),
      );
      expect(opacityBefore).toEqual(["0.25", "0.45", "0.65", "1"]);
      const softLettering = container.querySelector(
        "[data-base-comparison] text",
      );
      expect(softLettering).toHaveAttribute(
        "fill",
        "var(--bio-sequence-g-foreground)",
      );
      expect(softLettering).not.toHaveAttribute("stroke");
      expect(softLettering).not.toHaveAttribute("paint-order");

      rerender(<EvidenceTrackPanel {...props} paletteId={paletteId} />);

      const referenceGlyphs = screen
        .getByRole("img", { name: "Selected reference bases" })
        .querySelectorAll("g");
      const readGlyphs = container.querySelectorAll("[data-base-comparison]");
      for (const [index, residue] of [...record.sequence].entries()) {
        const style = getSequenceResidueStyle({
          molecule: record.molecule,
          paletteId,
          residue,
        });
        for (const glyph of [referenceGlyphs[index], readGlyphs[index]]) {
          expect(glyph?.querySelector("rect")).toHaveAttribute(
            "fill",
            style.backgroundColor,
          );
        }
        expect(referenceGlyphs[index]?.querySelector("text")).toHaveAttribute(
          "fill",
          style.color,
        );
        const lettering = readGlyphs[index]?.querySelector("text");
        expect(lettering).toHaveAttribute("fill", "white");
        expect(lettering).toHaveAttribute("stroke", "#1f2937");
        expect(lettering).toHaveAttribute("stroke-width", "0.6");
        expect(lettering).toHaveAttribute("paint-order", "stroke");
      }
      expect(referenceGlyphs[1]?.querySelector("rect")).toHaveAttribute(
        "fill",
        uracilColor,
      );
      expect(readGlyphs[1]?.querySelector("rect")).toHaveAttribute(
        "fill",
        uracilColor,
      );
      expect(
        Array.from(
          container.querySelectorAll("[data-base-comparison] rect"),
          (rect) => rect.getAttribute("fill-opacity"),
        ),
      ).toEqual(opacityBefore);

      rerender(<EvidenceTrackPanel {...props} paletteId="neutral" />);
      const monochromeLettering = container.querySelector(
        "[data-base-comparison] text",
      );
      expect(monochromeLettering).toHaveAttribute(
        "fill",
        "var(--bio-token-text-primary)",
      );
      expect(monochromeLettering).not.toHaveAttribute("stroke");
      expect(monochromeLettering).not.toHaveAttribute("paint-order");
    },
  );

  it("uses a valid segment for an origin-spanning selection", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       demo        12 bp    DNA     circular
ACCESSION   demo
ORIGIN
        1 acgtacgtacgt
//`,
      fileName: "demo.gb",
    });
    const record = document.records[0];
    if (record == null) throw new Error("Expected a sequence record.");
    const track = parseSequenceTrack({
      content: "demo\t11\tv1\tG\tA\t50\tPASS\tDP=2\n",
      displayName: "variants.vcf",
      format: "vcf",
      id: "variants",
      requestedReference: "demo",
    });

    render(
      <EvidenceTrackPanel
        record={record}
        selection={createOriginSpanningSelection({
          end: 3,
          record,
          start: 10,
        })}
        tracks={[track]}
        viewport={null}
      />,
    );

    expect(
      screen.getByText(/10–12 · 0 loaded reads · 1 variants/),
    ).toBeInTheDocument();
    // A variant-only track is not evidence of zero read coverage.
    expect(
      screen.queryByLabelText("Coverage from 10 to 12"),
    ).not.toBeInTheDocument();
  });

  it("renders CIGAR events, read details and filters without counting missing MAPQ as high confidence", async () => {
    const user = userEvent.setup();
    const record = referenceRecord("ACGTACGTACGT");
    const track = samTrack(
      [
        "high\t0\tref\t1\t60\t2M1I1M1D2M2N1M1S\t*\t0\t0\tATGTCGAA\tIIIIIIII",
        "low\t16\tref\t1\t5\t4M\t*\t0\t0\tACGT\t!!!!",
        "unknown\t0\tref\t1\t255\t4M\t*\t0\t0\tAAAA\t*",
      ].join("\n"),
    );
    const { container, rerender } = render(
      <EvidenceTrackPanel record={record} tracks={[track]} viewport={null} />,
    );
    for (const operation of ["I", "D", "N", "S"]) {
      expect(
        container.querySelector(`[data-cigar-operation="${operation}"]`),
      ).toBeInTheDocument();
    }
    expect(
      container.querySelector('[data-base-comparison="mismatch"]'),
    ).toBeInTheDocument();
    const cigarGraphics = Array.from(
      container.querySelectorAll("[data-cigar-operation]"),
      (graphic) => graphic.outerHTML,
    );
    rerender(
      <EvidenceTrackPanel
        record={record}
        paletteId="jalview-nucleotide"
        tracks={[track]}
        viewport={null}
      />,
    );
    expect(
      Array.from(
        container.querySelectorAll("[data-cigar-operation]"),
        (graphic) => graphic.outerHTML,
      ),
    ).toEqual(cigarGraphics);
    await user.click(
      screen.getByRole("button", { name: /^Inspect read high,/ }),
    );
    expect(
      screen.getByRole("complementary", { name: "Selected read details" }),
    ).toHaveTextContent("2M1I1M1D2M2N1M1S");
    expect(
      screen.getByRole("complementary", { name: "Selected read details" }),
    ).toHaveTextContent("Q40.0");
    await user.selectOptions(screen.getByLabelText("Minimum MAPQ"), "30");
    expect(
      screen.queryByRole("button", { name: /^Inspect read low,/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Inspect read unknown,/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByText("Display & filters"));
    await user.click(screen.getByLabelText("Include unavailable MAPQ (255)"));
    expect(
      screen.queryByRole("button", { name: /^Inspect read unknown,/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Coverage uses all 1 filtered, loaded alignments/),
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText("Show soft clips"));
    expect(
      container.querySelector('[data-cigar-operation="S"]'),
    ).not.toBeInTheDocument();
    rerender(
      <EvidenceTrackPanel
        record={record}
        tracks={[track]}
        viewport={{ start: 10, end: 12 }}
      />,
    );
    expect(
      screen.queryByRole("complementary", { name: "Selected read details" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/No loaded reads match this region/),
    ).toBeInTheDocument();
  });

  it("renders a bounded sample but uses every loaded read for coverage and discloses partial sources", () => {
    const track = samTrack(
      Array.from(
        { length: 110 },
        (_, index) => `r${index}\t0\tref\t1\t60\t4M\t*\t0\t0\tACGT\tIIII`,
      ).join("\n"),
    );
    track.summary = { ...track.summary, itemCount: 1_000, truncated: true };
    render(
      <EvidenceTrackPanel
        record={referenceRecord("ACGT")}
        tracks={[track]}
        viewport={null}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: /^Inspect read / }),
    ).toHaveLength(100);
    expect(
      screen.getByText(
        /Showing 100 of 110 reads passing filters · deterministic display sample/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("max observed 110×")).toBeInTheDocument();
    expect(
      screen.getByText(/Partial source · coverage is not extrapolated/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /1,000 source-reported reads; only loaded reads contribute/,
      ),
    ).toBeInTheDocument();
  });

  it("navigates only an unambiguous displayed mate without reusing the same read name as identity", async () => {
    const user = userEvent.setup();
    const track = samTrack(
      [
        "r001\t99\tref\t7\t30\t8M2I4M1D3M\t=\t37\t39\tTTAGATAAAGGATACTG\t*",
        "r001\t147\tref\t37\t30\t9M\t=\t7\t-39\tCAGCGGCAT\t*\tNM:i:1",
      ].join("\n"),
    );
    render(
      <EvidenceTrackPanel
        record={referenceRecord(
          "AGCATGTTAGATAAGATAGCTGTGCTAGTAGGCAGTCAGCGCCAT",
        )}
        tracks={[track]}
        viewport={null}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /^Inspect read r001, 7–22/ }),
    );
    await user.click(screen.getByRole("button", { name: "Inspect mate" }));
    expect(
      screen.getByRole("complementary", { name: "Selected read details" }),
    ).toHaveTextContent("ref:37–45");
    expect(
      screen.getByRole("button", { name: /^Inspect read r001, 37–45/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("discloses unavailable CIGAR and does not draw fabricated span coverage", async () => {
    const user = userEvent.setup();
    render(
      <EvidenceTrackPanel
        record={referenceRecord("ACGT")}
        tracks={[samTrack("unknown\t0\tref\t1\t60\t*\t*\t0\t0\tACGT\tIIII")]}
        viewport={null}
      />,
    );
    expect(screen.getByText("max observed 0×")).toBeInTheDocument();
    expect(
      screen.getByText(/1 reads excluded from coverage/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /^Inspect read unknown,/ }),
    );
    expect(screen.getByText(/Read rendering unavailable:/)).toBeInTheDocument();
  });

  it("shares controlled read options and exact source selection between agent and human actions", async () => {
    const user = userEvent.setup();
    const record = referenceRecord("ACGT");
    const tracks = [
      samTrack("selected\t0\tref\t1\t60\t4M\t*\t0\t0\tACGT\tIIII"),
    ];
    const state: ReadPileupState = {
      options: {
        ...DEFAULT_READ_PILEUP_STATE.options,
        minimumMappingQuality: 15,
      },
      selectedRead: { trackId: "reads", sourceReadIndex: 0 },
    };
    const onChange = vi.fn<(next: ReadPileupState) => void>();
    const { rerender } = render(
      <EvidenceTrackPanel
        record={record}
        tracks={tracks}
        viewport={null}
        readPileupState={state}
        onReadPileupStateChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Minimum MAPQ")).toHaveValue("15");
    expect(
      screen.getByRole("button", { name: /^Inspect read selected,/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.selectOptions(screen.getByLabelText("Minimum MAPQ"), "30");
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toEqual({
      ...state,
      options: { ...state.options, minimumMappingQuality: 30 },
    });
    expect(screen.getByLabelText("Minimum MAPQ")).toHaveValue("15");
    rerender(
      <EvidenceTrackPanel
        record={record}
        tracks={tracks}
        viewport={null}
        readPileupState={next}
        onReadPileupStateChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Minimum MAPQ")).toHaveValue("30");
    await user.click(
      screen.getByRole("button", { name: "Close read details" }),
    );
    expect(onChange.mock.calls.at(-1)?.[0].selectedRead).toBeNull();
  });

  it("withholds read and variant placement on an edited reference while retaining source tracks", () => {
    const record = {
      ...referenceRecord("TACGT"),
      evidenceCoordinatesStale: true,
    };
    const reads = samTrack("original\t0\tref\t1\t60\t4M\t*\t0\t0\tACGT\tIIII");
    const variants = parseSequenceTrack({
      content: "ref\t2\tv1\tC\tT\t50\tPASS\t.\n",
      displayName: "variants.vcf",
      format: "vcf",
      id: "variants",
      requestedReference: "ref",
    });
    render(
      <EvidenceTrackPanel
        record={record}
        tracks={[reads, variants]}
        viewport={null}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Imported tracks are retained in their original source coordinates",
    );
    expect(screen.queryByLabelText(/Coverage from/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Variants in view")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Inspect read / }),
    ).not.toBeInTheDocument();
    expect(reads.reads?.[0]).toMatchObject({
      position: 1,
      sequence: "ACGT",
      cigar: "4M",
    });
  });
});

function referenceRecord(sequence: string) {
  const record = parseSequenceDocument({
    contents: `>ref\n${sequence}\n`,
    fileName: "reference.fasta",
  }).records[0];
  if (record == null) throw new Error("Expected a reference record.");
  return record;
}

function samTrack(content: string) {
  return parseSequenceTrack({
    content,
    displayName: "reads.sam",
    format: "sam",
    id: "reads",
    requestedReference: "ref",
  });
}
