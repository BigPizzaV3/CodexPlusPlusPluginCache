import { runInNewContext } from "node:vm";

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseMsa } from "../msa/parser";
import type { AlignmentWorkbenchView } from "../msa/use-alignment-workbench-commands";
import { addSequenceFeature, insertSequence } from "../sequence/editing";
import {
  createSequenceInterfaceSettings,
  validateSequenceInterfaceSettingsForSource,
} from "../sequence/interface-state";
import { parseSequenceDocument } from "../sequence/parser";
import { parseSequenceTrack } from "../sequence/tracks";
import type { SequenceWorkbenchView } from "../sequence/use-sequence-workbench-commands";
import {
  alignmentWorkbenchReducer,
  createAlignmentWorkbenchState,
  createSequenceWorkbenchState,
  sequenceWorkbenchReducer,
} from "../workbench-state";
import {
  applySequenceDurableDocumentPatches,
  createDurableAlignmentState,
  createDurableSequenceState,
  createSequenceDurableDocumentPatches,
  decodeSequenceDurableViewerState,
  encodeSequenceDurableViewerState,
  MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES,
  SEQUENCE_DURABLE_CHECKPOINT_DEBOUNCE_MS,
  SequenceDurableViewerStateController,
  type SequenceDurableViewerState,
  type SequenceNativeCheckpointClient,
} from "./durable-viewer-state";

afterEach(() => vi.useRealTimers());

describe("application-owned durable Sequence and Alignment viewer state", () => {
  it("persists bounded sequence interface controls without report payloads or source snapshots", () => {
    const input = sequenceInterfaceCheckpointFixture();
    const captured = createDurableSequenceState(input);
    const restored = decodeSequenceDurableViewerState(
      encodeSequenceDurableViewerState({
        family: "sequence",
        mode: "sequence",
        sequence: captured,
        sourceRevision: "revision-1",
        sourceStateKey: input.sourceStateKey,
        version: 1,
      }),
    );

    expect(restored.sequence?.view.interface).toEqual(input.view.interface);
    expect(restored.sequence?.session.view.sequence?.interface).toEqual(
      input.view.interface,
    );
    expect(restored.sequence?.session.snapshot).toBeUndefined();
    expect(restored.sequence?.documentPatches).toEqual([]);
    expect(restored.sequence?.view.interface?.quality).not.toHaveProperty(
      "report",
    );
  });

  it("keeps legacy native checkpoints without interface settings backward compatible", () => {
    const legacy = checkpointEnvelope("artifact:legacy-interface");
    const restored = decodeSequenceDurableViewerState(
      encodeSequenceDurableViewerState(legacy),
    );

    expect(restored.sequence?.view.interface).toBeUndefined();
    expect(restored.sequence?.session.view.sequence?.interface).toBeUndefined();
  });

  it("rejects out-of-source trace settings when capturing a different selected record", () => {
    const input = sequenceInterfaceCheckpointFixture();
    input.view.selectedRecordId = input.state.document.records[1]!.id;
    input.view.interface!.readPileup.selectedRead = null;

    expect(() => createDurableSequenceState(input)).toThrow(
      "outside its selected source record",
    );
    input.view.interface!.chromatogram.firstBase = 3;
    const captured = createDurableSequenceState(input);
    expect(captured.view.selectedRecordId).toBe(
      input.state.document.records[1]!.id,
    );
    expect(captured.view.interface?.chromatogram.firstBase).toBe(3);
  });

  it("revalidates source-relative read selections against the reconstructed selected record", () => {
    const input = sequenceInterfaceCheckpointFixture();
    input.view.interface!.chromatogram.firstBase = 1;
    const captured = createDurableSequenceState(input);
    const restored = decodeSequenceDurableViewerState(
      encodeSequenceDurableViewerState({
        family: "sequence",
        mode: "sequence",
        sequence: captured,
        sourceRevision: "revision-1",
        sourceStateKey: input.sourceStateKey,
        version: 1,
      }),
    ).sequence!;
    const document = applySequenceDurableDocumentPatches(
      input.initialDocument,
      restored.documentPatches,
    );

    expect(() =>
      validateSequenceInterfaceSettingsForSource({
        record: document.records[0],
        records: document.records,
        settings: restored.view.interface!,
        tracks: restored.session.tracks,
      }),
    ).not.toThrow();
    expect(() =>
      validateSequenceInterfaceSettingsForSource({
        record: document.records[1],
        records: document.records,
        settings: restored.view.interface!,
        tracks: restored.session.tracks,
      }),
    ).toThrow(/different.*source record/u);
  });

  it("rejects malformed interface controls and unresolved native-view read identities", () => {
    const checkpoint = checkpointEnvelope("artifact:invalid-interface");
    const sequence = checkpoint.sequence!;
    sequence.view.interface = createSequenceInterfaceSettings();
    sequence.view.interface.chromatogram.basesPerWindow = 101;
    expect(() => encodeSequenceDurableViewerState(checkpoint)).toThrow();

    sequence.view.interface = createSequenceInterfaceSettings();
    sequence.view.interface.readPileup.selectedRead = {
      sourceReadIndex: 0,
      trackId: "not-loaded",
    };
    expect(() => encodeSequenceDurableViewerState(checkpoint)).toThrow(
      "saved read selection",
    );
    expect(() =>
      decodeSequenceDurableViewerState(
        new TextEncoder().encode(JSON.stringify(checkpoint)),
      ),
    ).toThrow("could not be restored");
  });

  it("creates a native checkpoint after a completed FASTQ quality-report job", () => {
    const initial = parseSequenceDocument({
      contents: "@QA-SYNTHETIC-QC\nACGTACGTACGT\n+\nIIIIIIIIIIII\n",
      fileName: "synthetic-qc.fastq",
    });
    const state = createSequenceWorkbenchState(initial);
    state.jobs.push({
      completedAt: 2,
      id: "00000000-0000-4000-8000-000000000001",
      kind: "quality-report",
      message: "Quality-report control completed.",
      parameters: { analysis: "quality-report" },
      progress: 1,
      result: { analysis: "quality-report", scope: { analyzedReads: 1 } },
      startedAt: 1,
      status: "completed",
    });
    const captured = createDurableSequenceState({
      activeSearchHitIndex: 0,
      initialDocument: initial,
      query: "",
      sourceStateKey: "artifact:synthetic-qc",
      state,
      view: {
        ...sequenceView(initial.records[0]!.id),
        interface: createSequenceInterfaceSettings(),
        selectedFeatureId: null,
      },
    });

    expect(captured.session.jobs[0]).toMatchObject({
      kind: "quality-report",
      status: "completed",
    });
    expect(() =>
      encodeSequenceDurableViewerState({
        family: "sequence",
        mode: "sequence",
        sequence: captured,
        sourceRevision: "revision-1",
        sourceStateKey: "artifact:synthetic-qc",
        version: 1,
      }),
    ).not.toThrow();
  });

  it("stores a multi-megabyte sequence edit as a bounded source-relative patch", () => {
    const source = {
      features: [{ end: 8, id: "preserved-feature", start: 2 }],
      record: "A".repeat(4 * 1024 * 1024),
    };
    const edited = {
      ...source,
      features: [...source.features, { end: 120, id: "restored-annotation", start: 100 }],
      record:
        source.record.slice(0, 2 * 1024 * 1024) + "CGT" + source.record.slice(2 * 1024 * 1024 + 3),
    };

    const patches = createSequenceDurableDocumentPatches(source, edited);
    expect(new TextEncoder().encode(JSON.stringify(patches)).byteLength).toBeLessThan(2_048);
    expect(patches).toContainEqual(
      expect.objectContaining({
        operation: "splice-string",
        path: ["record"],
        value: "CGT",
      }),
    );
    expect(applySequenceDurableDocumentPatches(source, patches)).toEqual(edited);
  });

  it("preserves sequence locus, strand, annotation, unsaved edits and history", () => {
    const initial = sequenceDocument("AACCGGTTAACC");
    const record = initial.records[0];
    if (record == null) throw new Error("Expected a source sequence.");
    const edited = {
      ...initial,
      records: [
        {
          ...record,
          features: [
            ...record.features,
            {
              end: 6,
              id: "annotation-1",
              label: "edited feature",
              qualifiers: {},
              start: 2,
              strand: "+" as const,
              type: "misc_feature",
            },
          ],
          sequence: "AATCGGTTAACC",
        },
      ],
    };
    const state = sequenceWorkbenchReducer(createSequenceWorkbenchState(initial), {
      description: "Replace residue and annotate the source copy",
      document: edited,
      type: "apply-sequence-document",
    });
    const captured = createDurableSequenceState({
      activeSearchHitIndex: 7,
      focusCoordinate: 6,
      initialDocument: initial,
      query: "CGG",
      sourceStateKey: "artifact:sequence-source",
      state,
      view: sequenceView(record.id),
    });
    const restored = decodeSequenceDurableViewerState(
      encodeSequenceDurableViewerState({
        family: "sequence",
        mode: "sequence",
        sequence: captured,
        sourceRevision: "revision-1",
        sourceStateKey: "artifact:sequence-source",
        version: 1,
      }),
    );

    expect(restored.sequence).toMatchObject({
      activeSearchHitIndex: 7,
      focusCoordinate: 6,
      query: "CGG",
      view: {
        orientation: "reverse-complement",
        selectedFeatureId: "annotation-1",
        selectedRecordId: record.id,
        viewport: { end: 10, start: 2 },
      },
    });
    if (restored.sequence == null) {
      throw new Error("Expected recovered sequence state.");
    }
    expect(applySequenceDurableDocumentPatches(initial, restored.sequence.documentPatches)).toEqual(
      state.document,
    );
    expect(restored.sequence.history).toHaveLength(1);
    expect(
      applySequenceDurableDocumentPatches(initial, restored.sequence.history[0]?.patches ?? []),
    ).toEqual(initial);
    expect(restored.sequence.session.dirty).toBe(true);
  });

  it("recovers authentic BED12 exon and coding blocks despite legacy undefined metadata", async () => {
    const initial = sequenceDocument("A".repeat(6_000));
    const record = initial.records[0];
    if (record == null) throw new Error("Expected a source sequence.");
    const parsedTrack = parseSequenceTrack({
      content: "chr22\t1000\t5000\tmRNA1\t0\t+\t1200\t4900\t0\t2\t567,488\t0,3512\n",
      displayName: "ucsc-bed12-track.bed",
      format: "bed",
      id: "public-chr22-transcript",
      requestedReference: "chr22",
    });
    const track = {
      ...parsedTrack,
      features: parsedTrack.features?.map((feature) => ({
        ...feature,
        phase: undefined,
        source: undefined,
      })),
      source: {
        ...parsedTrack.source,
        contentHash: undefined,
        workspacePath: undefined,
      },
    };
    const state = sequenceWorkbenchReducer(createSequenceWorkbenchState(initial), {
      track,
      type: "add-track",
    });
    const captured = createDurableSequenceState({
      activeSearchHitIndex: 0,
      initialDocument: initial,
      query: "",
      sourceStateKey: "artifact:public-chr22",
      state,
      view: sequenceView(record.id),
    });

    expect(captured.session.tracks[0]?.source).toEqual({
      displayName: "ucsc-bed12-track.bed",
    });
    expect(captured.session.tracks[0]?.features?.[0]).toMatchObject({
      codingSegments: [
        { end: 1567, start: 1201 },
        { end: 4900, start: 4513 },
      ],
      segments: [
        { end: 1567, start: 1001 },
        { end: 5000, start: 4513 },
      ],
    });
    expect(captured.session.tracks[0]?.features?.[0]).not.toHaveProperty("phase");

    const client = mockNativeClient({ hasCheckpoint: false });
    const controller = new SequenceDurableViewerStateController(client);
    controller.updateSequence({
      sourceStateKey: "artifact:public-chr22",
      state: captured,
    });
    await controller.flush();
    const persisted = vi.mocked(client.checkpoint).mock.calls[0]?.[0]?.checkpoint;
    if (persisted == null) throw new Error("Expected a native recovery checkpoint.");

    const recovered = new SequenceDurableViewerStateController(
      mockNativeClient({ checkpoint: persisted, hasCheckpoint: true }),
    );
    await expect(recovered.restore()).resolves.toMatchObject({
      sequence: {
        session: {
          tracks: [
            {
              features: [
                {
                  segments: [
                    { end: 1567, start: 1001 },
                    { end: 5000, start: 4513 },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
  });

  it("recovers annotated sequence edits without inventing absent quality or feature fields", () => {
    const initial = sequenceDocument("AACCGGTTAACC");
    const record = initial.records[0];
    if (record == null) throw new Error("Expected a source sequence.");
    const annotated = addSequenceFeature(initial, record.id, {
      end: 6,
      id: "annotation-1",
      label: undefined,
      qualifiers: {},
      segments: undefined,
      start: 2,
      strand: "+",
      translationCoordinateMap: undefined,
      type: "misc_feature",
    });
    const edited = insertSequence(annotated, record.id, 3, "T").document;
    let state = sequenceWorkbenchReducer(createSequenceWorkbenchState(initial), {
      description: "Add a real annotation without absent optional values",
      document: annotated,
      type: "apply-sequence-document",
    });
    state = sequenceWorkbenchReducer(state, {
      description: "Edit the annotated sequence copy",
      document: edited,
      type: "apply-sequence-document",
    });
    const captured = createDurableSequenceState({
      activeSearchHitIndex: 0,
      initialDocument: initial,
      query: "",
      sourceStateKey: "artifact:annotated-public-sequence",
      state,
      view: sequenceView(record.id),
    });
    const restored = applySequenceDurableDocumentPatches(
      initial,
      captured.documentPatches,
    );

    expect(restored.records[0]?.sequence).toBe("AATCCGGTTAACC");
    expect(restored.records[0]).not.toHaveProperty("quality");
    expect(restored.records[0]?.features[0]).not.toHaveProperty("label");
    expect(restored.records[0]?.features[0]).not.toHaveProperty("segments");
    expect(restored.records[0]?.features[0]).not.toHaveProperty("translationCoordinateMap");
    expect(captured.history).toHaveLength(2);
  });

  it("normalizes trusted optional properties without admitting unsafe recovery values", () => {
    const initial = sequenceDocument("AACCGGTTAACC");
    const record = initial.records[0];
    if (record == null) throw new Error("Expected a source sequence.");
    const track = parseSequenceTrack({
      content: "chr22\t0\t4\n",
      displayName: "public-regions.bed",
      format: "bed",
      id: "bounded-public-track",
      requestedReference: "chr22",
    });
    const capture = (candidate: typeof track) =>
      createDurableSequenceState({
        activeSearchHitIndex: 0,
        initialDocument: initial,
        query: "",
        sourceStateKey: "artifact:bounded-public-track",
        state: sequenceWorkbenchReducer(createSequenceWorkbenchState(initial), {
          track: candidate,
          type: "add-track",
        }),
        view: sequenceView(record.id),
      });

    const withOptional = {
      ...track,
      source: { ...track.source, contentHash: undefined },
    };
    expect(capture(withOptional).session.tracks[0]?.source).not.toHaveProperty(
      "contentHash",
    );

    const unsafePrototype = Object.assign(
      Object.create({ inherited: true }) as typeof track.source,
      track.source,
    );
    expect(() => capture({ ...track, source: unsafePrototype })).toThrow(
      /non-JSON/u,
    );

    const unsafeSource = { ...track.source };
    Object.defineProperty(unsafeSource, "__proto__", {
      enumerable: true,
      value: "polluted",
    });
    expect(() => capture({ ...track, source: unsafeSource })).toThrow(/unsafe/u);

    expect(() =>
      capture({
        ...track,
        features: track.features?.map((feature) => ({
          ...feature,
          score: Number.POSITIVE_INFINITY,
        })),
      }),
    ).toThrow(/invalid number/u);

    expect(() =>
      createSequenceDurableDocumentPatches({}, { optional: undefined }),
    ).toThrow(/non-JSON/u);
  });

  it("keeps private VCF genotypes inside source-bound native recovery state", () => {
    const initial = sequenceDocument("AACCGGTTAACC");
    const record = initial.records[0];
    if (record == null) throw new Error("Expected a source sequence.");
    const track = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "##FORMAT=<ID=GT,Number=1,Type=String,Description=Genotype>",
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tPUBLIC_A\tPUBLIC_B",
        "1\t5\t.\tA\tG\t.\t.\tAC=1\tGT\t0/1\t1/1",
      ].join("\n"),
      displayName: "public-spec.vcf",
      format: "vcf",
      id: "source-bound-public-vcf",
      requestedReference: "1",
    });
    const state = sequenceWorkbenchReducer(createSequenceWorkbenchState(initial), {
      track,
      type: "add-track",
    });
    const captured = createDurableSequenceState({
      activeSearchHitIndex: 0,
      initialDocument: initial,
      query: "",
      sourceStateKey: "artifact:source-bound-public-vcf",
      state,
      view: sequenceView(record.id),
    });
    const recovered = decodeSequenceDurableViewerState(
      encodeSequenceDurableViewerState({
        family: "sequence",
        mode: "sequence",
        sequence: captured,
        sourceRevision: "revision-1",
        sourceStateKey: "artifact:source-bound-public-vcf",
        version: 1,
      }),
    );

    expect(recovered.sequence?.session.tracks[0]?.vcfHeader).toMatchObject({
      sampleNames: ["PUBLIC_A", "PUBLIC_B"],
    });
    expect(recovered.sequence?.session.tracks[0]?.variants?.[0]).toMatchObject({
      rawFilter: ".",
      samples: { PUBLIC_A: "0/1", PUBLIC_B: "1/1" },
    });
    expect(recovered.sequence?.session.tracks[0]?.variants?.[0]).not.toHaveProperty(
      "sampleValues",
    );
  });

  it("losslessly recovers 27 variants and 100 genotypes within the native checkpoint budget", () => {
    const initial = sequenceDocument("AACCGGTTAACC");
    const record = initial.records[0];
    if (record == null) throw new Error("Expected a source sequence.");
    const sampleNames = Array.from(
      { length: 100 },
      (_, index) => `S${String(index).padStart(3, "0")}`,
    );
    const values = (variantIndex: number) =>
      sampleNames.map(
        (_, sampleIndex) =>
          `0/1:${String(variantIndex).padStart(2, "0")}.${String(sampleIndex).padStart(6, "0")}:0.987654:-0.333333`,
      );
    const content = [
      "##fileformat=VCFv4.3",
      "##FORMAT=<ID=GT,Number=1,Type=String,Description=Genotype>",
      [
        "#CHROM",
        "POS",
        "ID",
        "REF",
        "ALT",
        "QUAL",
        "FILTER",
        "INFO",
        "FORMAT",
        ...sampleNames,
      ].join("\t"),
      ...Array.from({ length: 27 }, (_, index) =>
        ["1", String(10_583 + index), ".", "G", "A", ".", ".", "AC=1", "GT:DS:GL", ...values(index)].join("\t"),
      ),
    ].join("\n");
    const track = parseSequenceTrack({
      content,
      displayName: "official-27-variant-100-sample-conformance.vcf",
      format: "vcf",
      id: "full-public-conformance-track",
      requestedReference: "1",
    });
    expect(new TextEncoder().encode(JSON.stringify(track)).byteLength).toBeGreaterThan(
      MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES,
    );
    const state = sequenceWorkbenchReducer(createSequenceWorkbenchState(initial), {
      track,
      type: "add-track",
    });
    const captured = createDurableSequenceState({
      activeSearchHitIndex: 0,
      initialDocument: initial,
      query: "",
      sourceStateKey: "artifact:full-public-conformance",
      state,
      view: sequenceView(record.id),
    });
    const checkpoint = encodeSequenceDurableViewerState({
      family: "sequence",
      mode: "sequence",
      sequence: captured,
      sourceRevision: "revision-1",
      sourceStateKey: "artifact:full-public-conformance",
      version: 1,
    });
    expect(checkpoint.byteLength).toBeLessThanOrEqual(
      MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES,
    );

    const recovered = decodeSequenceDurableViewerState(checkpoint);
    const recoveredTrack = recovered.sequence?.session.tracks[0];
    expect(recoveredTrack?.vcfHeader?.sampleNames).toEqual(sampleNames);
    expect(recoveredTrack?.variants).toHaveLength(27);
    for (const [index, variant] of (recoveredTrack?.variants ?? []).entries()) {
      expect(Object.values(variant.samples)).toEqual(values(index));
      expect(variant).not.toHaveProperty("sampleValues");
    }
  });

  it.each(["legacy", "modern"] as const)("preserves %s alignment edits, display controls, focus and virtual viewport", (variant) => {
    const result = parseMsa(">row-a\nAACCGG\n>row-b\nAATCGG\n", "demo.aln-fasta");
    if (result.status !== "success") throw new Error(result.message);
    const initial = result.document;
    const row = initial.rows[0];
    if (row == null) throw new Error("Expected a source alignment row.");
    const edited = {
      ...initial,
      rows: initial.rows.map((candidate) =>
        candidate.id === row.id ? { ...candidate, alignedSequence: "AATCGG" } : candidate,
      ),
    };
    let state = alignmentWorkbenchReducer(createAlignmentWorkbenchState(initial), {
      description: "Restore an alignment-cell edit",
      document: edited,
      type: "apply-alignment-document",
    });
    state = alignmentWorkbenchReducer(state, {
      rowIds: [row.id],
      type: "select-alignment-rows",
    });
    const view = alignmentView(row.id);
    if (variant === "modern") {
      view.enabledMetricTracks = ["identity", "sequence-logo"];
      view.rowSortDirection = "desc";
      view.rowSortKey = "identity";
      view.showSequenceLogoHelp = true;
    }
    const captured = createDurableAlignmentState({
      alignmentColumnJump: "42",
      anchorRowId: row.id,
      fileName: "demo.aln-fasta",
      focusedCell: { column: 2, rowId: row.id, symbol: "T" },
      guideTreeNewick: "(row-a,row-b);",
      initialDocument: initial,
      motifQuery: "TCG",
      pinnedCell: { column: 3, rowId: row.id, symbol: "C" },
      referencePositionJump: "19",
      selectedHitIndex: 3,
      sourceStateKey: "artifact:alignment-source",
      state,
      view,
      viewport: { column: 91, row: 14 },
    });
    const restored = decodeSequenceDurableViewerState(
      encodeSequenceDurableViewerState({
        alignment: captured,
        family: "sequence",
        mode: "alignment",
        sourceRevision: "revision-1",
        sourceStateKey: "artifact:alignment-source",
        version: 1,
      }),
    );

    expect(restored.alignment).toMatchObject({
      anchorRowId: row.id,
      focusedCell: { column: 2, rowId: row.id, symbol: "T" },
      guideTreeNewick: "(row-a,row-b);",
      motifQuery: "TCG",
      pinnedCell: { column: 3, rowId: row.id, symbol: "C" },
      selectedHitIndex: 3,
      view: {
        referenceMode: "anchor",
        rowFilter: "row-a",
        selectedRows: [row.id],
      },
      viewport: { column: 91, row: 14 },
    });
    if (restored.alignment == null) {
      throw new Error("Expected recovered alignment state.");
    }
    expect(restored.alignment.view).toEqual(view);
    expect(
      applySequenceDurableDocumentPatches(initial, restored.alignment.documentPatches),
    ).toEqual(edited);
  });

  it("produces byte-identical deterministic checkpoints", () => {
    const first = checkpointEnvelope("artifact:deterministic");
    const second = checkpointEnvelope("artifact:deterministic");
    expect(encodeSequenceDurableViewerState(first)).toEqual(
      encodeSequenceDurableViewerState(second),
    );
  });

  it("accepts authentic Uint8Array checkpoints across native process realms", () => {
    const checkpoint = checkpointEnvelope("artifact:cross-realm");
    const bytes = encodeSequenceDurableViewerState(checkpoint);
    const transferred = runInNewContext("new Uint8Array(bytes)", {
      bytes: Array.from(bytes),
    }) as Uint8Array;

    expect(transferred instanceof Uint8Array).toBe(false);
    expect(decodeSequenceDurableViewerState(transferred)).toEqual(checkpoint);
  });

  it("automatically recovers exact native state after an application restart", async () => {
    const checkpoint = checkpointEnvelope("artifact:cold-restart");
    const client = mockNativeClient({
      checkpoint: encodeSequenceDurableViewerState(checkpoint),
      hasCheckpoint: true,
    });
    const controller = new SequenceDurableViewerStateController(client);

    await expect(controller.restore()).resolves.toEqual(checkpoint);
    expect(client.restoreCheckpoint).toHaveBeenCalledOnce();
    expect(client.checkpoint).not.toHaveBeenCalled();
    expect(controller.restoredState?.sequence?.query).toBe("CGG");
  });

  it("opens a first-use native viewer without checkpoint metadata or MCP", async () => {
    const client = mockNativeClient({ hasCheckpoint: false });
    const controller = new SequenceDurableViewerStateController(client);

    await expect(controller.restore()).resolves.toBeNull();
    expect(client.restoreCheckpoint).toHaveBeenCalledOnce();
    expect(client.checkpoint).not.toHaveBeenCalled();
    expect(controller.restoredState).toBeNull();
  });

  it("coalesces interactions into the latest automatic native checkpoint", async () => {
    vi.useFakeTimers();
    const client = mockNativeClient({ hasCheckpoint: false });
    const controller = new SequenceDurableViewerStateController(client);
    const first = checkpointEnvelope("artifact:latest-only");
    if (first.sequence == null) throw new Error("Expected sequence state.");

    controller.updateSequence({
      sourceStateKey: first.sourceStateKey,
      state: first.sequence,
    });
    controller.updateSequence({
      sourceStateKey: first.sourceStateKey,
      state: { ...first.sequence, query: "latest-only-search" },
    });
    expect(client.checkpoint).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SEQUENCE_DURABLE_CHECKPOINT_DEBOUNCE_MS);

    expect(client.checkpoint).toHaveBeenCalledOnce();
    const checkpointCall = vi.mocked(client.checkpoint).mock.calls[0]?.[0];
    if (checkpointCall == null) throw new Error("Expected a native checkpoint.");
    expect(decodeSequenceDurableViewerState(checkpointCall.checkpoint)).toMatchObject({
      sequence: { query: "latest-only-search" },
    });
  });

  it("persists source-bound toolbar visibility without invalidating legacy checkpoints", async () => {
    const client = mockNativeClient({ hasCheckpoint: false });
    const controller = new SequenceDurableViewerStateController(client);
    const state = checkpointEnvelope("artifact:toolbar");
    if (state.sequence == null) throw new Error("Expected sequence state.");

    controller.setToolbarVisibility({
      sourceStateKey: state.sourceStateKey,
      visible: false,
    });
    expect(controller.restoredState).toBeNull();
    controller.updateSequence({
      sourceStateKey: state.sourceStateKey,
      state: state.sequence,
    });
    expect(controller.restoredState?.toolbarVisible).toBe(false);
    controller.setToolbarVisibility({
      sourceStateKey: "artifact:other-source",
      visible: true,
    });
    expect(controller.restoredState?.toolbarVisible).toBe(false);
    controller.updateSequence({
      sourceStateKey: state.sourceStateKey,
      state: { ...state.sequence, query: "preserve-toolbar" },
    });
    await controller.flush();

    const checkpoint = vi.mocked(client.checkpoint).mock.calls[0]?.[0];
    if (checkpoint == null) throw new Error("Expected a persisted checkpoint.");
    expect(decodeSequenceDurableViewerState(checkpoint.checkpoint)).toMatchObject({
      sequence: { query: "preserve-toolbar" },
      toolbarVisible: false,
    });
    expect(decodeSequenceDurableViewerState(encodeSequenceDurableViewerState(state)))
      .not.toHaveProperty("toolbarVisible");
  });

  it("never transfers a pending toolbar choice to a different source", () => {
    const client = mockNativeClient({ hasCheckpoint: false });
    const controller = new SequenceDurableViewerStateController(client);
    const state = checkpointEnvelope("artifact:actual-source");
    if (state.sequence == null) throw new Error("Expected sequence state.");

    controller.setToolbarVisibility({
      sourceStateKey: "artifact:stale-source",
      visible: false,
    });
    controller.updateSequence({
      sourceStateKey: state.sourceStateKey,
      state: state.sequence,
    });

    expect(controller.restoredState?.toolbarVisible).toBeUndefined();
  });

  it("never applies a pending toolbar choice after its source revision changes", () => {
    const client = mockNativeClient({ hasCheckpoint: false });
    const controller = new SequenceDurableViewerStateController(client);
    const state = checkpointEnvelope("artifact:same-name");
    if (state.sequence == null) throw new Error("Expected sequence state.");

    controller.setToolbarVisibility({
      sourceStateKey: state.sourceStateKey,
      visible: false,
    });
    Object.defineProperty(client.session, "sourceRevision", {
      value: "revision-2",
    });
    controller.updateSequence({
      sourceStateKey: state.sourceStateKey,
      state: state.sequence,
    });

    expect(controller.restoredState?.sourceRevision).toBe("revision-2");
    expect(controller.restoredState?.toolbarVisible).toBeUndefined();
  });

  it("keeps toolbar visibility when switching an authenticated source between viewer modes", () => {
    const client = mockNativeClient({ hasCheckpoint: false });
    const controller = new SequenceDurableViewerStateController(client);
    const state = checkpointEnvelope("artifact:both-modes");
    if (state.sequence == null) throw new Error("Expected sequence state.");
    const parsed = parseMsa(">row-a\nAC-GT\n>row-b\nACTGT\n", "family.fasta");
    if (parsed.status !== "success") throw new Error(parsed.message);
    const anchor = parsed.document.rows[0];
    if (anchor == null) throw new Error("Expected alignment rows.");

    controller.updateSequence({
      sourceStateKey: state.sourceStateKey,
      state: state.sequence,
    });
    controller.setToolbarVisibility({
      sourceStateKey: state.sourceStateKey,
      visible: false,
    });
    controller.updateAlignment({
      sourceStateKey: state.sourceStateKey,
      state: createDurableAlignmentState({
        alignmentColumnJump: "",
        anchorRowId: anchor.id,
        focusedCell: null,
        guideTreeNewick: null,
        initialDocument: parsed.document,
        motifQuery: "",
        pinnedCell: null,
        referencePositionJump: "",
        selectedHitIndex: 0,
        sourceStateKey: state.sourceStateKey,
        state: createAlignmentWorkbenchState(parsed.document),
        view: alignmentView(anchor.id),
        viewport: { column: 0, row: 0 },
      }),
    });

    expect(controller.restoredState).toMatchObject({
      mode: "alignment",
      toolbarVisible: false,
    });
  });

  it("refuses a checkpoint from a changed biological source", async () => {
    const checkpoint = checkpointEnvelope("artifact:stale-source");
    const client = mockNativeClient({
      checkpoint: encodeSequenceDurableViewerState({
        ...checkpoint,
        sourceRevision: "old-revision",
      }),
      hasCheckpoint: true,
    });
    await expect(new SequenceDurableViewerStateController(client).restore()).rejects.toThrow(
      /revision|source/u,
    );
  });

  it("refuses oversized, malformed, cross-mode and unsafe recovery state", () => {
    expect(() =>
      decodeSequenceDurableViewerState(new Uint8Array(MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES + 1)),
    ).toThrow(/invalid|large/u);
    expect(() => decodeSequenceDurableViewerState(new TextEncoder().encode("{not-json"))).toThrow(
      /checkpoint/u,
    );
    expect(() =>
      applySequenceDurableDocumentPatches({ safe: true }, [
        {
          operation: "replace",
          path: ["__proto__", "polluted"],
          value: true,
        },
      ]),
    ).toThrow(/unsafe/u);
    expect(() =>
      encodeSequenceDurableViewerState({
        ...checkpointEnvelope("artifact:wrong-mode"),
        mode: "alignment",
      }),
    ).toThrow(/mode|restorable/u);
  });

  it("never invents an MCP fallback after a refused native checkpoint", async () => {
    const client = mockNativeClient({ hasCheckpoint: false });
    vi.mocked(client.checkpoint).mockRejectedValueOnce(
      new Error("The native source capability was revoked."),
    );
    const controller = new SequenceDurableViewerStateController(client);
    const checkpoint = checkpointEnvelope("artifact:revoked");
    if (checkpoint.sequence == null) throw new Error("Expected sequence state.");
    controller.updateSequence({
      sourceStateKey: checkpoint.sourceStateKey,
      state: checkpoint.sequence,
    });

    await expect(controller.flush()).rejects.toThrow(/revoked/u);
    expect(client.checkpoint).toHaveBeenCalledOnce();
    expect(client.restoreCheckpoint).not.toHaveBeenCalled();
  });
});

function sequenceInterfaceCheckpointFixture() {
  const initialDocument = parseSequenceDocument({
    contents: ">chr1\nACGTACGTACGT\n>chr2\nACGT\n",
    fileName: "synthetic-interface.fasta",
  });
  const state = createSequenceWorkbenchState(initialDocument);
  state.tracks.push(
    parseSequenceTrack({
      content:
        "@SQ\tSN:1\tLN:12\nselected\t0\t1\t5\t60\t4M\t*\t0\t0\tACGT\tIIII\n",
      displayName: "synthetic-read.sam",
      format: "sam",
      id: "synthetic-read-source",
      requestedReference: "chr1",
    }),
  );
  const settings = createSequenceInterfaceSettings();
  settings.annotationIndex = { expanded: true, page: 1, query: "gene" };
  settings.chromatogram = { basesPerWindow: 20, firstBase: 5 };
  settings.originRangeExpanded = true;
  settings.quality.adapterSequence = "ACGTACGT";
  settings.quality.view.methodsExpanded = true;
  settings.quality.view.distributionsExpanded = true;
  settings.quality.view.expandedTables = ["cycle-quality", "read-gc"];
  settings.readPileup.options.minimumMappingQuality = 40;
  settings.readPileup.options.showAllBases = true;
  settings.readPileup.selectedRead = {
    sourceReadIndex: 0,
    trackId: state.tracks[0]!.id,
  };
  settings.recordBrowser = {
    expanded: true,
    page: 2,
    query: "chr",
    sortBy: "label",
  };
  const view: SequenceWorkbenchView = {
    ...sequenceView(initialDocument.records[0]!.id),
    interface: settings,
    selectedFeatureId: null,
    selection: null,
    viewport: null,
  };
  return {
    activeSearchHitIndex: 0,
    initialDocument,
    query: "",
    sourceStateKey: "artifact:interface-settings",
    state,
    view,
  };
}

function sequenceDocument(sequence: string) {
  return parseSequenceDocument({
    contents: ">demo\n" + sequence + "\n",
    fileName: "demo.fasta",
  });
}

function sequenceView(recordId: string): SequenceWorkbenchView {
  return {
    geneticCodeId: 1,
    layout: "split",
    orientation: "reverse-complement",
    paletteId: "neutral",
    selectedFeatureId: "annotation-1",
    selectedRecordId: recordId,
    selection: { end: 6, recordId, start: 2 },
    showFeatures: true,
    showQuality: false,
    showTranslation: false,
    synchronizedViews: true,
    viewport: { end: 10, start: 2 },
    wrapWidth: 60,
  };
}

function alignmentView(rowId: string): AlignmentWorkbenchView {
  return {
    analysisScope: "all-unhidden-rows",
    cellWidth: 25,
    colorMode: "identity",
    referenceMode: "anchor",
    residuePalette: "neutral",
    rowFilter: "row-a",
    searchScope: "currently-displayed-rows",
    selectedColumns: { end: 4, start: 2 },
    selectedRows: [rowId],
    showAnnotationTracks: true,
    showIdenticalAsDots: true,
    showRnaStructureOverlays: false,
  };
}

function checkpointEnvelope(sourceStateKey: string): SequenceDurableViewerState {
  const initial = sequenceDocument("AACCGGTTAACC");
  const record = initial.records[0];
  if (record == null) throw new Error("Expected a source sequence.");
  return {
    family: "sequence",
    mode: "sequence",
    sequence: createDurableSequenceState({
      activeSearchHitIndex: 2,
      focusCoordinate: 4,
      initialDocument: initial,
      query: "CGG",
      sourceStateKey,
      state: createSequenceWorkbenchState(initial),
      view: sequenceView(record.id),
    }),
    sourceRevision: "revision-1",
    sourceStateKey,
    version: 1,
  };
}

function mockNativeClient(
  input: { checkpoint: Uint8Array; hasCheckpoint: true } | { hasCheckpoint: false },
): SequenceNativeCheckpointClient {
  return {
    checkpoint: vi.fn(async ({ lastAcknowledgedRevision }) => ({
      checkpointVersion: 1 as const,
      lastAcknowledgedRevision: lastAcknowledgedRevision + 1,
      logicalSessionId: "native-logical-session",
      recoveryReference: "native-durable-reference",
    })),
    restoreCheckpoint: vi.fn(async () =>
      input.hasCheckpoint
        ? {
            checkpoint: input.checkpoint,
            hasCheckpoint: true as const,
            lastAcknowledgedRevision: 4,
            recoveryReference: "native-durable-reference",
            sourceRevision: "revision-1",
          }
        : { hasCheckpoint: false as const },
    ),
    session: {
      backendGeneration: 2,
      backendInstanceId: "native-sequence-worker",
      family: "sequence",
      logicalSessionId: "native-logical-session",
      sourceRevision: "revision-1",
    },
  };
}
