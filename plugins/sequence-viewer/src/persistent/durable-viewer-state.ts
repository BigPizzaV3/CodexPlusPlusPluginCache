import { createContext } from "react";
import { z } from "zod";

import type { AlignmentWorkbenchView } from "../msa/use-alignment-workbench-commands";
import type { MsaDocument } from "../msa/types";
import type { ScientificSequenceDataClient } from "./scientific-data-client";
import type { SequenceWorkbenchView } from "../sequence/use-sequence-workbench-commands";
import {
  sequenceInterfaceSettingsSchema,
  validateSequenceInterfaceSettingsForSource,
} from "../sequence/interface-state";
import type { SequenceDocument } from "../sequence/types";
import {
  parseWorkbenchSession,
  type AlignmentWorkbenchState,
  type SequenceWorkbenchState,
  type WorkbenchSession,
  type WorkbenchSharedState,
} from "../workbench-state";

export const MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES = 192 * 1024;
export const MAX_SEQUENCE_DURABLE_PATCH_OPERATIONS = 2_048;
export const SEQUENCE_DURABLE_CHECKPOINT_DEBOUNCE_MS = 175;

type JsonValue = null | boolean | number | string | Array<JsonValue> | { [key: string]: JsonValue };

type PatchPath = Array<string | number>;

export type SequenceDurableJsonPatch =
  | { operation: "add" | "replace"; path: PatchPath; value: JsonValue }
  | { operation: "remove"; path: PatchPath }
  | {
      deleteCount: number;
      operation: "splice-string";
      path: PatchPath;
      start: number;
      value: string;
    };

const boundedIdentifier = z.string().min(1).max(1_024);
const safeInteger = z.number().int().nonnegative().safe();
const patchPathSchema = z
  .array(z.union([z.string().min(1).max(512), safeInteger]))
  .max(24)
  .superRefine((path, context) => {
    if (
      path.some(
        (segment) =>
          segment === "__proto__" || segment === "prototype" || segment === "constructor",
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "The checkpoint contains an unsafe document path.",
      });
    }
  });

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string().max(MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES),
    z.array(jsonValueSchema).max(MAX_SEQUENCE_DURABLE_PATCH_OPERATIONS),
    z.record(z.string().max(512), jsonValueSchema),
  ]),
);

const documentPatchSchema: z.ZodType<SequenceDurableJsonPatch> = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("add"),
    path: patchPathSchema,
    value: jsonValueSchema,
  }),
  z.object({
    operation: z.literal("replace"),
    path: patchPathSchema,
    value: jsonValueSchema,
  }),
  z.object({ operation: z.literal("remove"), path: patchPathSchema }),
  z.object({
    deleteCount: safeInteger,
    operation: z.literal("splice-string"),
    path: patchPathSchema,
    start: safeInteger,
    value: z.string().max(MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES),
  }),
]);

const documentPatchesSchema = z
  .array(documentPatchSchema)
  .max(MAX_SEQUENCE_DURABLE_PATCH_OPERATIONS);

const storedWorkbenchSessionSchema = z.custom<WorkbenchSession>((value) => {
  try {
    parseWorkbenchSession(JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}, "The durable workbench session is invalid.");

const sequenceSelectionSchema = z
  .object({
    end: safeInteger,
    recordId: boundedIdentifier,
    segments: z
      .array(z.object({ end: safeInteger, start: safeInteger }).strict())
      .max(MAX_SEQUENCE_DURABLE_PATCH_OPERATIONS)
      .optional(),
    start: safeInteger,
  })
  .strict();

const sequenceViewSchema = z
  .object({
    geneticCodeId: safeInteger,
    interface: sequenceInterfaceSettingsSchema.optional(),
    layout: z.enum(["circular", "linear", "split"]),
    orientation: z.enum(["forward", "reverse-complement"]),
    paletteId: boundedIdentifier,
    selectedFeatureId: boundedIdentifier.nullable(),
    selectedRecordId: boundedIdentifier,
    selection: sequenceSelectionSchema.nullable(),
    showFeatures: z.boolean(),
    showQuality: z.boolean(),
    showTranslation: z.boolean(),
    synchronizedViews: z.boolean(),
    viewport: z.object({ end: safeInteger, start: safeInteger }).strict().nullable(),
    wrapWidth: safeInteger,
  })
  .strict();

const alignmentViewSchema = z
  .object({
    analysisScope: boundedIdentifier,
    cellWidth: z.number().finite().positive(),
    colorMode: boundedIdentifier,
    enabledMetricTracks: z
      .array(
        z.enum([
          "gap",
          "identity",
          "mismatch",
          "modality-conservation",
          "rna-structure",
          "sequence-logo",
        ]),
      )
      .max(6)
      .optional(),
    referenceMode: boundedIdentifier,
    residuePalette: boundedIdentifier.nullable(),
    rowFilter: z.string().max(16 * 1024),
    rowSortDirection: z.enum(["asc", "desc"]).optional(),
    rowSortKey: z
      .enum(["coverage", "identity", "label", "length", "mismatches", "source"])
      .optional(),
    searchScope: boundedIdentifier,
    selectedColumns: z.object({ end: safeInteger, start: safeInteger }).strict().nullable(),
    selectedRows: z.array(boundedIdentifier).max(MAX_SEQUENCE_DURABLE_PATCH_OPERATIONS),
    showAnnotationTracks: z.boolean(),
    showIdenticalAsDots: z.boolean(),
    showRnaStructureOverlays: z.boolean(),
    showSequenceLogoHelp: z.boolean().optional(),
  })
  .strict();

const historyEntrySchema = z
  .object({
    description: z.string().max(4 * 1024),
    patches: documentPatchesSchema,
  })
  .strict();

const focusedCellSchema = z
  .object({
    column: safeInteger,
    rowId: boundedIdentifier,
    symbol: z.string().max(16),
  })
  .strict()
  .nullable();

const sequenceStateSchema = z
  .object({
    activeSearchHitIndex: safeInteger,
    documentPatches: documentPatchesSchema,
    focusCoordinate: safeInteger.nullable(),
    future: z.array(historyEntrySchema).max(128),
    history: z.array(historyEntrySchema).max(128),
    query: z.string().max(64 * 1024),
    session: storedWorkbenchSessionSchema,
    view: sequenceViewSchema,
  })
  .strict()
  .superRefine(({ session, view }, context) => {
    if (view.interface == null) return;
    try {
      validateSequenceInterfaceSettingsForSource({
        settings: view.interface,
        tracks: session.tracks,
      });
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error
            ? error.message
            : "The saved read selection is invalid.",
        path: ["view", "interface"],
      });
    }
  });

const alignmentStateSchema = z
  .object({
    alignmentColumnJump: z.string().max(4 * 1024),
    anchorRowId: boundedIdentifier.nullable(),
    documentPatches: documentPatchesSchema,
    focusedCell: focusedCellSchema,
    future: z.array(historyEntrySchema).max(128),
    guideTreeNewick: z
      .string()
      .max(64 * 1024)
      .nullable(),
    history: z.array(historyEntrySchema).max(128),
    motifQuery: z.string().max(64 * 1024),
    pinnedCell: focusedCellSchema,
    referencePositionJump: z.string().max(4 * 1024),
    selectedHitIndex: safeInteger,
    session: storedWorkbenchSessionSchema,
    view: alignmentViewSchema,
    viewport: z.object({ column: safeInteger, row: safeInteger }).strict(),
  })
  .strict();

export const sequenceDurableViewerStateSchema = z
  .object({
    alignment: alignmentStateSchema.optional(),
    family: z.literal("sequence"),
    mode: z.enum(["alignment", "sequence"]),
    sequence: sequenceStateSchema.optional(),
    sourceRevision: boundedIdentifier,
    sourceStateKey: boundedIdentifier,
    toolbarVisible: z.boolean().optional(),
    version: z.literal(1),
  })
  .strict()
  .superRefine((state, context) => {
    if (state[state.mode] == null) {
      context.addIssue({
        code: "custom",
        message: "The active viewer mode has no restorable state.",
      });
    }
  });

export type SequenceDurableViewerState = z.infer<typeof sequenceDurableViewerStateSchema>;
export type SequenceDurableSequenceState = z.infer<typeof sequenceStateSchema>;
export type SequenceDurableAlignmentState = z.infer<typeof alignmentStateSchema>;

export type SequenceNativeCheckpointClient = Pick<ScientificSequenceDataClient, "session"> & {
  checkpoint: (input: {
    checkpoint: Uint8Array;
    lastAcknowledgedRevision: number;
    signal?: AbortSignal;
  }) => Promise<{
    checkpointVersion: 1;
    lastAcknowledgedRevision: number;
    logicalSessionId: string;
    recoveryReference: string;
  }>;
  restoreCheckpoint: (input?: { signal?: AbortSignal }) => Promise<
    | {
        checkpoint?: Uint8Array;
        hasCheckpoint: false;
        lastAcknowledgedRevision?: number;
        recoveryReference?: string;
        sourceRevision?: string;
      }
    | {
        checkpoint: Uint8Array;
        hasCheckpoint: true;
        lastAcknowledgedRevision: number;
        recoveryReference: string;
        sourceRevision: string;
      }
  >;
};

export const SequenceDurableViewerStateContext =
  createContext<SequenceDurableViewerStateController | null>(null);

/** Encode only source-relative state; full biological inputs never enter IPC. */
export function encodeSequenceDurableViewerState(input: SequenceDurableViewerState): Uint8Array {
  const state = sequenceDurableViewerStateSchema.parse(input);
  const canonical = canonicalizeJson(state as unknown as JsonValue, 0);
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  if (bytes.byteLength > MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES) {
    throw new Error("The Sequence viewer recovery checkpoint exceeds its bounded native budget.");
  }
  return bytes;
}

export function decodeSequenceDurableViewerState(
  checkpoint: Uint8Array,
): SequenceDurableViewerState {
  const isNativeByteView =
    ArrayBuffer.isView(checkpoint) &&
    Object.prototype.toString.call(checkpoint) === "[object Uint8Array]";
  if (
    !isNativeByteView ||
    checkpoint.byteLength === 0 ||
    checkpoint.byteLength > MAX_SEQUENCE_DURABLE_CHECKPOINT_BYTES
  ) {
    throw new Error("The native Sequence viewer checkpoint is invalid or too large.");
  }
  try {
    const nativeBytes = new Uint8Array(
      checkpoint.buffer,
      checkpoint.byteOffset,
      checkpoint.byteLength,
    );
    return sequenceDurableViewerStateSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(nativeBytes)),
    );
  } catch (error) {
    throw new Error("The native Sequence viewer checkpoint could not be restored.", {
      cause: error,
    });
  }
}

/** Diff immutable workbench documents without serializing the source file. */
export function createSequenceDurableDocumentPatches(
  original: unknown,
  current: unknown,
): Array<SequenceDurableJsonPatch> {
  const patches: Array<SequenceDurableJsonPatch> = [];
  diffDocumentValue(original, current, [], patches, 0);
  return documentPatchesSchema.parse(patches);
}

export function applySequenceDurableDocumentPatches<Document>(
  source: Document,
  patches: ReadonlyArray<SequenceDurableJsonPatch>,
): Document {
  let current: unknown = source;
  for (const patch of documentPatchesSchema.parse(patches)) {
    current = applyDocumentPatch(current, patch, 0);
  }
  return current as Document;
}

export function createDurableSequenceState(input: {
  activeSearchHitIndex: number;
  focusCoordinate?: number;
  initialDocument: SequenceDocument;
  query: string;
  sourceStateKey: string;
  state: SequenceWorkbenchState;
  view: SequenceWorkbenchView;
}): SequenceDurableSequenceState {
  if (input.view.interface != null) {
    const record = input.state.document.records.find(
      ({ id }) => id === input.view.selectedRecordId,
    );
    if (record == null) {
      throw new Error(
        "The saved interface settings have no selected source record.",
      );
    }
    validateSequenceInterfaceSettingsForSource({
      record,
      records: input.state.document.records,
      settings: input.view.interface,
      tracks: input.state.tracks,
    });
  }
  return sequenceStateSchema.parse({
    activeSearchHitIndex: input.activeSearchHitIndex,
    documentPatches: createSequenceDurableDocumentPatches(
      input.initialDocument,
      input.state.document,
    ),
    focusCoordinate: input.focusCoordinate ?? null,
    future: input.state.future.map((entry) => ({
      description: entry.description,
      patches: createSequenceDurableDocumentPatches(input.initialDocument, entry.document),
    })),
    history: input.state.history.map((entry) => ({
      description: entry.description,
      patches: createSequenceDurableDocumentPatches(input.initialDocument, entry.document),
    })),
    query: input.query,
    session: createDurableWorkbenchSession({
      fileName: input.state.document.fileName,
      format: input.state.document.format,
      mode: "sequence",
      sourceStateKey: input.sourceStateKey,
      state: input.state,
      view: input.view,
    }),
    view: input.view,
  });
}

export function createDurableAlignmentState(input: {
  alignmentColumnJump: string;
  anchorRowId: string | null;
  focusedCell: { column: number; rowId: string; symbol: string } | null;
  guideTreeNewick: string | null;
  initialDocument: MsaDocument;
  motifQuery: string;
  pinnedCell: { column: number; rowId: string; symbol: string } | null;
  referencePositionJump: string;
  selectedHitIndex: number;
  sourceStateKey: string;
  state: AlignmentWorkbenchState;
  view: AlignmentWorkbenchView;
  viewport: { column: number; row: number };
  fileName?: string;
}): SequenceDurableAlignmentState {
  return alignmentStateSchema.parse({
    alignmentColumnJump: input.alignmentColumnJump,
    anchorRowId: input.anchorRowId,
    documentPatches: createSequenceDurableDocumentPatches(
      input.initialDocument,
      input.state.document,
    ),
    focusedCell: input.focusedCell,
    future: input.state.future.map((entry) => ({
      description: entry.description,
      patches: createSequenceDurableDocumentPatches(input.initialDocument, entry.document),
    })),
    guideTreeNewick: input.guideTreeNewick,
    history: input.state.history.map((entry) => ({
      description: entry.description,
      patches: createSequenceDurableDocumentPatches(input.initialDocument, entry.document),
    })),
    motifQuery: input.motifQuery,
    pinnedCell: input.pinnedCell,
    referencePositionJump: input.referencePositionJump,
    selectedHitIndex: input.selectedHitIndex,
    session: createDurableWorkbenchSession({
      fileName: input.fileName,
      format: input.state.document.format,
      mode: "alignment",
      sourceStateKey: input.sourceStateKey,
      state: input.state,
      view: input.view,
    }),
    view: input.view,
    viewport: input.viewport,
  });
}

export class SequenceDurableViewerStateController {
  readonly client: SequenceNativeCheckpointClient;
  #state: SequenceDurableViewerState | null = null;
  #lastAcknowledgedRevision = 0;
  #lastEncoded: string | null = null;
  #pending = false;
  #pendingToolbarVisibility:
    | { sourceRevision: string; sourceStateKey: string; visible: boolean }
    | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #flush: Promise<void> | undefined;
  #disposed = false;

  constructor(client: SequenceNativeCheckpointClient) {
    this.client = client;
  }

  get restoredState(): SequenceDurableViewerState | null {
    return this.#state;
  }

  async restore(signal?: AbortSignal): Promise<SequenceDurableViewerState | null> {
    signal?.throwIfAborted();
    const restored = await this.client.restoreCheckpoint(signal == null ? undefined : { signal });
    signal?.throwIfAborted();
    if (!restored.hasCheckpoint) {
      if (
        restored.sourceRevision != null &&
        restored.sourceRevision !== this.client.session.sourceRevision
      ) {
        throw new Error("The native Sequence checkpoint belongs to a changed source.");
      }
      this.#lastAcknowledgedRevision =
        restored.lastAcknowledgedRevision ?? this.#lastAcknowledgedRevision;
      return null;
    }
    if (restored.sourceRevision !== this.client.session.sourceRevision) {
      throw new Error("The native Sequence checkpoint belongs to a changed source.");
    }
    this.#lastAcknowledgedRevision = restored.lastAcknowledgedRevision;
    const state = decodeSequenceDurableViewerState(restored.checkpoint);
    if (state.sourceRevision !== restored.sourceRevision) {
      throw new Error("The native Sequence checkpoint source revision is stale.");
    }
    this.#state = state;
    this.#lastEncoded = new TextDecoder().decode(encodeSequenceDurableViewerState(state));
    return state;
  }

  updateSequence(input: { sourceStateKey: string; state: SequenceDurableSequenceState }): void {
    this.#update({
      ...this.#sameSourceState(input.sourceStateKey),
      family: "sequence",
      mode: "sequence",
      sequence: input.state,
      sourceRevision: this.client.session.sourceRevision,
      sourceStateKey: input.sourceStateKey,
      version: 1,
    });
  }

  updateAlignment(input: { sourceStateKey: string; state: SequenceDurableAlignmentState }): void {
    this.#update({
      ...this.#sameSourceState(input.sourceStateKey),
      alignment: input.state,
      family: "sequence",
      mode: "alignment",
      sourceRevision: this.client.session.sourceRevision,
      sourceStateKey: input.sourceStateKey,
      version: 1,
    });
  }

  setToolbarVisibility(input: { sourceStateKey: string; visible: boolean }): void {
    const state = this.#state;
    if (state == null) {
      this.#pendingToolbarVisibility = {
        ...input,
        sourceRevision: this.client.session.sourceRevision,
      };
      return;
    }
    if (
      state.sourceStateKey !== input.sourceStateKey ||
      state.sourceRevision !== this.client.session.sourceRevision ||
      state.toolbarVisible === input.visible
    ) {
      return;
    }
    this.#update({ ...state, toolbarVisible: input.visible });
  }

  async flush(): Promise<void> {
    if (this.#timer != null) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    if (this.#flush != null) {
      await this.#flush;
      if (this.#pending) await this.flush();
      return;
    }
    if (!this.#pending || this.#state == null) return;
    this.#pending = false;
    const bytes = encodeSequenceDurableViewerState(this.#state);
    const encoded = new TextDecoder().decode(bytes);
    if (encoded === this.#lastEncoded) return;
    this.#flush = (async () => {
      const receipt = await this.client.checkpoint({
        checkpoint: bytes,
        lastAcknowledgedRevision: this.#lastAcknowledgedRevision,
      });
      if (
        receipt.checkpointVersion !== 1 ||
        receipt.logicalSessionId !== this.client.session.logicalSessionId ||
        receipt.lastAcknowledgedRevision < this.#lastAcknowledgedRevision
      ) {
        throw new Error("The native Sequence host returned an invalid checkpoint.");
      }
      this.#lastAcknowledgedRevision = receipt.lastAcknowledgedRevision;
      this.#lastEncoded = encoded;
    })();
    try {
      await this.#flush;
    } finally {
      this.#flush = undefined;
    }
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#timer != null) clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #sameSourceState(
    sourceStateKey: string,
  ): Partial<SequenceDurableViewerState> | Record<string, never> {
    return this.#state?.sourceStateKey === sourceStateKey &&
      this.#state.sourceRevision === this.client.session.sourceRevision
      ? this.#state
      : {};
  }

  #update(state: SequenceDurableViewerState): void {
    if (this.#disposed) return;
    if (this.#pendingToolbarVisibility != null) {
      if (
        this.#pendingToolbarVisibility.sourceStateKey === state.sourceStateKey &&
        this.#pendingToolbarVisibility.sourceRevision === state.sourceRevision &&
        state.sourceRevision === this.client.session.sourceRevision
      ) {
        state = {
          ...state,
          toolbarVisible: this.#pendingToolbarVisibility.visible,
        };
      }
      this.#pendingToolbarVisibility = undefined;
    }
    // Reject an oversized or malformed state before scheduling host I/O.
    encodeSequenceDurableViewerState(state);
    this.#state = state;
    this.#pending = true;
    if (this.#timer != null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.flush().catch(() => {
        // Keep the exact state retryable; recovery never falls back to MCP.
        this.#pending = true;
      });
    }, SEQUENCE_DURABLE_CHECKPOINT_DEBOUNCE_MS);
  }
}

function createDurableWorkbenchSession(input: {
  fileName?: string;
  format: string;
  mode: "alignment" | "sequence";
  sourceStateKey: string;
  state: WorkbenchSharedState;
  view: AlignmentWorkbenchView | SequenceWorkbenchView;
}): WorkbenchSession {
  const view =
    input.mode === "alignment"
      ? { alignment: input.view as AlignmentWorkbenchView, mode: "alignment" as const }
      : { mode: "sequence" as const, sequence: input.view as SequenceWorkbenchView };
  const session: WorkbenchSession = {
    artifacts: input.state.artifacts.filter(({ format }) => format !== "sequence-viewer-session"),
    createdAt: 0,
    dirty: input.state.dirty,
    jobs: input.state.jobs,
    revision: input.state.revision,
    schemaVersion: 1,
    source: {
      fileName: input.fileName ?? null,
      format: input.format,
      stateKey: input.sourceStateKey,
    },
    tracks: input.state.tracks.map(compactDurableWorkbenchTrack),
    view,
  };
  // Historical in-memory producers represented absent optional track values as
  // undefined. Normalize those trusted object properties before the strict
  // session boundary; arrays, unsafe keys, invalid numbers and prototypes still
  // fail closed, and document patches retain their original strict behavior.
  const normalized = canonicalizeJson(session as unknown as JsonValue, 0, true);
  return parseWorkbenchSession(JSON.stringify(normalized));
}

function compactDurableWorkbenchTrack(
  track: WorkbenchSession["tracks"][number],
): WorkbenchSession["tracks"][number] {
  if (track.vcfHeader == null || track.variants == null) return track;
  const sampleNames = track.vcfHeader.sampleNames;
  return {
    ...track,
    variants: track.variants.map((variant) => {
      if (variant.sampleValues == null) return variant;
      if (
        variant.sampleValues.length !== sampleNames.length ||
        sampleNames.some(
          (name, index) =>
            !Object.hasOwn(variant.samples, name) ||
            variant.samples[name] !== variant.sampleValues?.[index],
        )
      ) {
        throw new Error("The Sequence checkpoint contains inconsistent VCF sample genotypes.");
      }
      // Header sample order plus the complete sample map reconstruct this
      // duplicate representation without spending the bounded native budget.
      const { sampleValues: _redundantSampleValues, ...compacted } = variant;
      return compacted;
    }),
  };
}

function diffDocumentValue(
  original: unknown,
  current: unknown,
  path: PatchPath,
  patches: Array<SequenceDurableJsonPatch>,
  depth: number,
): void {
  if (Object.is(original, current)) return;
  if (depth > 24 || patches.length >= MAX_SEQUENCE_DURABLE_PATCH_OPERATIONS) {
    throw new Error("Sequence document edits exceed the bounded recovery budget.");
  }
  if (typeof original === "string" && typeof current === "string") {
    let start = 0;
    const commonLength = Math.min(original.length, current.length);
    while (start < commonLength && original[start] === current[start]) start++;
    let suffix = 0;
    while (
      suffix < original.length - start &&
      suffix < current.length - start &&
      original[original.length - 1 - suffix] === current[current.length - 1 - suffix]
    ) {
      suffix++;
    }
    patches.push({
      deleteCount: original.length - start - suffix,
      operation: "splice-string",
      path,
      start,
      value: current.slice(start, current.length - suffix),
    });
    return;
  }
  if (Array.isArray(original) && Array.isArray(current)) {
    const shared = Math.min(original.length, current.length);
    for (let index = 0; index < shared; index++) {
      diffDocumentValue(original[index], current[index], [...path, index], patches, depth + 1);
    }
    for (let index = original.length - 1; index >= current.length; index--) {
      patches.push({ operation: "remove", path: [...path, index] });
    }
    for (let index = original.length; index < current.length; index++) {
      patches.push({
        operation: "add",
        path: [...path, index],
        value: canonicalizeJson(current[index] as JsonValue, depth + 1),
      });
    }
    return;
  }
  if (isPlainJsonRecord(original) && isPlainJsonRecord(current)) {
    const originalKeys = Object.keys(original).sort();
    const currentKeys = Object.keys(current).sort();
    for (const key of originalKeys) {
      assertSafeJsonKey(key);
      if (!Object.hasOwn(current, key)) {
        patches.push({ operation: "remove", path: [...path, key] });
      }
    }
    for (const key of currentKeys) {
      assertSafeJsonKey(key);
      if (!Object.hasOwn(original, key)) {
        patches.push({
          operation: "add",
          path: [...path, key],
          value: canonicalizeJson(current[key] as JsonValue, depth + 1),
        });
      } else {
        diffDocumentValue(original[key], current[key], [...path, key], patches, depth + 1);
      }
    }
    return;
  }
  patches.push({
    operation: "replace",
    path,
    value: canonicalizeJson(current as JsonValue, depth + 1),
  });
}

function applyDocumentPatch(
  current: unknown,
  patch: SequenceDurableJsonPatch,
  depth: number,
): unknown {
  if (depth > 24) throw new Error("The recovered document path is too deep.");
  if (patch.path.length === depth) {
    if (patch.operation === "remove") {
      throw new Error("The original biological document cannot be removed.");
    }
    if (patch.operation === "splice-string") {
      if (
        typeof current !== "string" ||
        patch.start > current.length ||
        patch.deleteCount > current.length - patch.start
      ) {
        throw new Error("The recovered biological edit is outside its source.");
      }
      return (
        current.slice(0, patch.start) + patch.value + current.slice(patch.start + patch.deleteCount)
      );
    }
    return canonicalizeJson(patch.value, 0);
  }
  const segment = patch.path[depth];
  if (typeof segment === "string") assertSafeJsonKey(segment);
  if (Array.isArray(current)) {
    if (typeof segment !== "number" || segment > current.length) {
      throw new Error("The recovered biological array coordinate is invalid.");
    }
    const next = [...current];
    if (patch.path.length === depth + 1 && patch.operation === "remove") {
      if (segment >= next.length) throw new Error("The recovered edit is stale.");
      next.splice(segment, 1);
    } else if (patch.path.length === depth + 1 && patch.operation === "add") {
      next.splice(segment, 0, canonicalizeJson(patch.value, 0));
    } else {
      if (segment >= next.length) throw new Error("The recovered edit is stale.");
      next[segment] = applyDocumentPatch(next[segment], patch, depth + 1);
    }
    return next;
  }
  if (!isPlainJsonRecord(current) || typeof segment !== "string") {
    throw new Error("The recovered biological document path is invalid.");
  }
  const next = { ...current };
  if (patch.path.length === depth + 1 && patch.operation === "remove") {
    if (!Object.hasOwn(next, segment)) throw new Error("The recovered edit is stale.");
    delete next[segment];
  } else if (patch.path.length === depth + 1 && patch.operation === "add") {
    if (Object.hasOwn(next, segment)) throw new Error("The recovered edit conflicts.");
    next[segment] = canonicalizeJson(patch.value, 0);
  } else {
    if (!Object.hasOwn(next, segment)) throw new Error("The recovered edit is stale.");
    next[segment] = applyDocumentPatch(next[segment], patch, depth + 1);
  }
  return next;
}

function canonicalizeJson(
  value: JsonValue,
  depth: number,
  omitUndefinedObjectProperties = false,
): JsonValue {
  if (depth > 24) throw new Error("The Sequence checkpoint exceeds its nesting budget.");
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("The Sequence checkpoint contains an invalid number.");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_SEQUENCE_DURABLE_PATCH_OPERATIONS) {
      throw new Error("The Sequence checkpoint exceeds its collection budget.");
    }
    return value.map((entry) =>
      canonicalizeJson(entry, depth + 1, omitUndefinedObjectProperties),
    );
  }
  if (!isPlainJsonRecord(value)) {
    throw new Error("The Sequence checkpoint contains a non-JSON value.");
  }
  const result: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(value).sort()) {
    assertSafeJsonKey(key);
    const entry = value[key];
    if (entry === undefined && omitUndefinedObjectProperties) continue;
    result[key] = canonicalizeJson(
      entry as JsonValue,
      depth + 1,
      omitUndefinedObjectProperties,
    );
  }
  return result;
}

function isPlainJsonRecord(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSafeJsonKey(key: string): void {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    throw new Error("The Sequence checkpoint contains an unsafe property.");
  }
}
