// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-backend-entrypoint.mjs
import process from "node:process";

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-backend-runtime.mjs
import { Buffer as Buffer2 } from "node:buffer";
import { createHash as createHash2, randomUUID } from "node:crypto";

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-compressed-byte-source.mjs
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
var MAX_COMPRESSED_CHUNK_BYTES = 64 * 1024;
var MAX_INFLATED_CHUNK_BYTES = 64 * 1024;
var MAX_EXPANSION_RATIO = 256n;
var MAX_LOGICAL_BYTES = 1024n * 1024n * 1024n * 1024n;
function createScientificStructureCompressedByteSource(options) {
  if (options.sizeBytes <= 0n || options.sourceRevision.length === 0 || options.preview.byteLength === 0 || options.preview.byteLength > MAX_COMPRESSED_CHUNK_BYTES || BigInt(options.preview.byteLength) > options.sizeBytes) {
    compressedFailure(
      "RESOURCE_EXHAUSTED",
      "The compressed Structure source exceeds its authenticated range budget"
    );
  }
  let physicalOffset = 0n;
  let compressedBytes = 0n;
  let expandedBytes = 0n;
  let logicalOffset = 0n;
  let buffered = new Uint8Array(0);
  let bufferedOffset = 0;
  let exhausted2 = false;
  let closed = false;
  let activeRead = false;
  let activeSignal;
  let permanentError;
  const compressed = Readable.from(readCompressedChunks(), {
    highWaterMark: MAX_COMPRESSED_CHUNK_BYTES,
    objectMode: false
  });
  const gunzip = createGunzip({ chunkSize: MAX_INFLATED_CHUNK_BYTES });
  compressed.once("error", (error) => gunzip.destroy(error));
  const iterator = compressed.pipe(gunzip)[Symbol.asyncIterator]();
  async function* readCompressedChunks() {
    physicalOffset = BigInt(options.preview.byteLength);
    compressedBytes = physicalOffset;
    yield options.preview;
    while (physicalOffset < options.sizeBytes) {
      if (activeSignal == null) {
        compressedFailure(
          "PERMISSION_DENIED",
          "Compressed Structure ranges require an active approved request"
        );
      }
      activeSignal.throwIfAborted();
      const remaining = options.sizeBytes - physicalOffset;
      const length = remaining < BigInt(MAX_COMPRESSED_CHUNK_BYTES) ? Number(remaining) : MAX_COMPRESSED_CHUNK_BYTES;
      const result = await options.readCompressedRange({
        offset: physicalOffset,
        length,
        signal: activeSignal
      });
      activeSignal.throwIfAborted();
      if (result.bytes.byteLength !== length || result.eof !== (physicalOffset + BigInt(length) === options.sizeBytes)) {
        compressedFailure(
          "SOURCE_CHANGED",
          "The compressed Structure source revision or physical range changed"
        );
      }
      physicalOffset += BigInt(length);
      compressedBytes += BigInt(length);
      yield result.bytes;
    }
  }
  async function fillBuffer() {
    if (bufferedOffset < buffered.byteLength) {
      return true;
    }
    if (exhausted2) {
      return false;
    }
    let next;
    try {
      next = await iterator.next();
    } catch (error) {
      if (typeof error === "object" && error != null && "code" in error && [
        "CANCELLED",
        "CHECKSUM_MISMATCH",
        "CONFLICT",
        "PERMISSION_DENIED",
        "RESOURCE_EXHAUSTED",
        "SOURCE_CHANGED"
      ].includes(String(error.code))) {
        throw error;
      }
      compressedFailure(
        "CHECKSUM_MISMATCH",
        "The compressed Structure gzip/BGZF stream is corrupt or incomplete"
      );
    }
    if (next.done) {
      exhausted2 = true;
      buffered = new Uint8Array(0);
      bufferedOffset = 0;
      return false;
    }
    if (next.value.byteLength > MAX_INFLATED_CHUNK_BYTES) {
      compressedFailure(
        "RESOURCE_EXHAUSTED",
        "The compressed Structure output exceeded its bounded chunk size"
      );
    }
    expandedBytes += BigInt(next.value.byteLength);
    if (expandedBytes > MAX_LOGICAL_BYTES || expandedBytes > compressedBytes * MAX_EXPANSION_RATIO) {
      compressedFailure(
        "RESOURCE_EXHAUSTED",
        "The compressed Structure source exceeded its bounded inflation policy"
      );
    }
    buffered = next.value;
    bufferedOffset = 0;
    return true;
  }
  function close() {
    if (closed) {
      return;
    }
    closed = true;
    compressed.destroy();
    gunzip.destroy();
  }
  return {
    sizeBytes: MAX_LOGICAL_BYTES,
    sourceRevision: options.sourceRevision,
    close,
    async readRange({ offset, length, signal }) {
      signal.throwIfAborted();
      const previousError = permanentError;
      if (previousError instanceof Error) {
        throw Object.assign(
          new Error(previousError.message, { cause: previousError }),
          previousError
        );
      }
      if (closed) {
        compressedFailure(
          "PERMISSION_DENIED",
          "The compressed Structure source has already been closed"
        );
      }
      if (typeof offset !== "bigint" || offset !== logicalOffset || !Number.isSafeInteger(length) || length <= 0 || length > MAX_INFLATED_CHUNK_BYTES || offset + BigInt(length) > MAX_LOGICAL_BYTES) {
        compressedFailure(
          "RESOURCE_EXHAUSTED",
          "Compressed Structure geometry supports only bounded forward reads"
        );
      }
      if (activeRead) {
        compressedFailure(
          "CONFLICT",
          "Compressed Structure geometry cannot be read concurrently"
        );
      }
      activeRead = true;
      activeSignal = signal;
      const abort = () => {
        const reason = signal.reason instanceof Error ? signal.reason : new Error("The approved compressed Structure read was cancelled");
        compressed.destroy(reason);
        gunzip.destroy(reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        const result = new Uint8Array(length);
        let written = 0;
        while (written < length) {
          signal.throwIfAborted();
          if (!await fillBuffer()) {
            break;
          }
          const count = Math.min(
            length - written,
            buffered.byteLength - bufferedOffset
          );
          result.set(
            buffered.subarray(bufferedOffset, bufferedOffset + count),
            written
          );
          bufferedOffset += count;
          logicalOffset += BigInt(count);
          written += count;
        }
        return {
          bytes: written === result.byteLength ? result : result.slice(0, written),
          eof: exhausted2 && bufferedOffset === buffered.byteLength
        };
      } catch (error) {
        permanentError = error instanceof Error ? error : Object.assign(
          new Error("The compressed Structure source failed"),
          {
            code: "CHECKSUM_MISMATCH"
          }
        );
        close();
        throw permanentError;
      } finally {
        activeRead = false;
        signal.removeEventListener("abort", abort);
      }
    }
  };
}
function compressedFailure(code, message) {
  throw Object.assign(new Error(message), {
    code,
    name: "ScientificStructureCompressedSourceError"
  });
}

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-native-project.mjs
var MAX_PROJECT_BYTES = 180 * 1024;
var MAX_PROJECT_RANGE_BYTES = 64 * 1024;
var MAX_DEPENDENCIES = 128;
var RESOURCE_URI = /^viewer-(?:file|data|live-data):\/\/structure-viewer\//u;
function record(value) {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
function safeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !value.startsWith("/") && !value.includes("\\") && !value.includes("\0") && !/^[a-z][a-z0-9+.-]*:/iu.test(value) && value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}
function repair(code, dependencyId, label, message) {
  return {
    structuredContent: {
      available: true,
      restorable: false,
      repairPlan: [{ code, dependencyId, label, message }]
    }
  };
}
async function resolveScientificStructureNativeProject(input) {
  if (input.projectGrant.sourceIdentity.sizeBytes < 1n || input.projectGrant.sourceIdentity.sizeBytes > BigInt(MAX_PROJECT_BYTES)) {
    return repair(
      "oversize",
      "project",
      typeof input.command.relativePath === "string" ? input.command.relativePath : "project",
      "The approved project manifest exceeds its bounded native window."
    );
  }
  const bytes = new Uint8Array(
    Number(input.projectGrant.sourceIdentity.sizeBytes)
  );
  for (let offset = 0; offset < bytes.byteLength; offset += MAX_PROJECT_RANGE_BYTES) {
    input.signal.throwIfAborted();
    const length = Math.min(MAX_PROJECT_RANGE_BYTES, bytes.byteLength - offset);
    const chunk = await input.readSource({
      grant: input.projectGrant,
      logicalSessionId: input.logicalSessionId,
      offset: BigInt(offset),
      length,
      signal: input.signal
    });
    if (chunk.bytes.byteLength !== length) {
      return repair(
        "changed",
        "project",
        "project",
        "The approved project source changed while loading."
      );
    }
    bytes.set(chunk.bytes, offset);
  }
  let manifest;
  try {
    manifest = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    );
  } catch {
    return repair(
      "unsupported",
      "project",
      "project",
      "The approved project manifest is malformed."
    );
  }
  if (!record(manifest) || manifest.kind !== "openai.structure-viewer.project" || manifest.version !== 1 || !record(manifest.primary) || !safeRelativePath(manifest.primary.relativePath) || !Array.isArray(manifest.dependencies) || manifest.dependencies.length > MAX_DEPENDENCIES) {
    return repair(
      "unsupported",
      "project",
      "project",
      "The approved project manifest has an invalid dependency graph."
    );
  }
  const primary = await input.describeSource({
    format: input.primaryFormat,
    grant: input.primaryGrant,
    relativePath: manifest.primary.relativePath
  });
  if (primary == null || primary.byteLength !== manifest.primary.byteLength || primary.format !== manifest.primary.format || primary.sha256 !== manifest.primary.sha256 || !input.sameIntegrity(
    primary.sourceIntegrity,
    manifest.primary.sourceIntegrity
  )) {
    return repair(
      "changed",
      "primary",
      manifest.primary.relativePath,
      "The approved primary source no longer matches the saved project."
    );
  }
  if (!Array.isArray(input.command.projectResources)) {
    return repair(
      "missing",
      "project",
      "project",
      "The host has not restored this project's approved companions."
    );
  }
  const authorizedResources = input.command.projectResources;
  const manifestDependencies = manifest.dependencies;
  const seen = /* @__PURE__ */ new Set();
  const dependencies = [];
  for (const dependency of manifestDependencies) {
    input.signal.throwIfAborted();
    if (!record(dependency) || typeof dependency.id !== "string" || seen.has(dependency.id) || !safeRelativePath(dependency.relativePath) || typeof dependency.format !== "string" || ![
      "structure",
      "trajectory-coordinates",
      "trajectory-topology",
      "volume"
    ].includes(String(dependency.kind))) {
      return repair(
        "escape",
        "project",
        "project",
        "The project contains an invalid or escaping dependency."
      );
    }
    seen.add(dependency.id);
    const resource = authorizedResources.find(
      (candidate) => record(candidate) && candidate.id === dependency.id
    );
    if (!record(resource) || typeof resource.name !== "string" || resource.name !== dependency.relativePath.split("/").at(-1) || typeof resource.resourceUri !== "string" || !RESOURCE_URI.test(resource.resourceUri)) {
      return repair(
        "missing",
        dependency.id,
        dependency.relativePath,
        "A saved project companion is no longer authorized."
      );
    }
    const grant = input.validateGrant(resource.grant);
    const actual = await input.describeSource({
      format: dependency.format,
      grant,
      relativePath: dependency.relativePath
    });
    if (actual == null || actual.byteLength !== dependency.byteLength || actual.format !== dependency.format || actual.sha256 !== dependency.sha256 || !input.sameIntegrity(actual.sourceIntegrity, dependency.sourceIntegrity)) {
      return repair(
        "changed",
        dependency.id,
        dependency.relativePath,
        "An approved project companion no longer matches the saved manifest."
      );
    }
    dependencies.push({
      id: dependency.id,
      name: resource.name,
      resourceUri: resource.resourceUri,
      sourceRevision: grant.sourceRevision,
      sourceSizeBytesDecimal: grant.sourceIdentity.sizeBytes.toString(),
      format: dependency.format
    });
  }
  return {
    structuredContent: {
      available: true,
      restorable: true,
      manifest,
      dependencies
    }
  };
}

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-native-text-parser.mjs
import { Buffer } from "node:buffer";
var MAX_RESIDENT_ATOMS = 16 * 1024;
var MAX_STRUCTURE_LINE_BYTES = 1024 * 1024;
var MAX_MMCIF_HEADERS = 256;
var MAX_MMCIF_METADATA_RECORDS = 4096;
var MAX_MMCIF_METADATA_VALUE_LENGTH = 512;
function appendStructureBytes(state, bytes, offset, eof) {
  if (bytes.byteLength > MAX_STRUCTURE_LINE_BYTES) {
    fail("RESOURCE_EXHAUSTED", "The molecular read exceeds its line budget");
  }
  const pendingByteLength = state.pendingByteLength ?? Buffer.byteLength(state.pending, "utf8");
  let text;
  try {
    text = state.decoder.decode(bytes, { stream: !eof });
  } catch {
    fail(
      "MALFORMED_STRUCTURE",
      "The authorized molecular bytes are not valid UTF-8"
    );
  }
  const combined = state.pending + text;
  if (Buffer.byteLength(combined, "utf8") > MAX_STRUCTURE_LINE_BYTES) {
    fail("RESOURCE_EXHAUSTED", "A molecular record exceeds its line budget");
  }
  const segments = combined.split(/\r?\n/u);
  state.pending = eof ? "" : segments.pop() ?? "";
  if (eof && state.pending.length > 0) {
    segments.push(state.pending);
    state.pending = "";
  }
  const firstRecordStart = offset - BigInt(pendingByteLength);
  let lineByteOffset = firstRecordStart;
  let byteOffset = 0;
  for (const line of segments) {
    if (Buffer.byteLength(line, "utf8") > MAX_STRUCTURE_LINE_BYTES) {
      fail("RESOURCE_EXHAUSTED", "A molecular record exceeds its line budget");
    }
    const newlineOffset = bytes.indexOf(10, byteOffset);
    byteOffset = newlineOffset < 0 ? bytes.byteLength : newlineOffset + 1;
    const recordEnd = offset + BigInt(byteOffset);
    if (state.recordEndOffsets != null || state.format === "mmcif") {
      state.currentRecordStart = lineByteOffset;
      state.currentRecordEnd = recordEnd;
    }
    switch (state.format) {
      case "pdb":
      case "pdbqt":
        parsePdbLine(state, line);
        break;
      case "mmcif":
        parseMmcifLine(state, line);
        break;
      case "pqr":
        parsePqrLine(state, line);
        break;
      case "mol":
      case "sdf":
        parseMolLine(state, line);
        break;
      case "mol2":
        parseMol2Line(state, line);
        break;
      case "gro":
        parseGroLine(state, line);
        break;
      case "xyz":
        parseXyzLine(state, line);
        break;
    }
    lineByteOffset = recordEnd;
  }
  if (eof) assertCompleteMmcifRecords(state);
  state.scanOffset = offset + BigInt(bytes.byteLength);
  state.pendingByteLength = eof ? 0 : Number(state.scanOffset - lineByteOffset);
  state.complete = eof && !state.evicted;
  if (state.mmcifTrustedRange && state.mmcifFraming != null && firstRecordStart <= state.mmcifFraming.scannedThrough && lineByteOffset > state.mmcifFraming.scannedThrough) {
    state.mmcifFraming.scannedThrough = lineByteOffset;
  }
  applyMmcifResidueMetadata(state);
}
function parsePdbLine(state, line) {
  if (line.startsWith("MODEL")) {
    const model = Number.parseInt(line.slice(10).trim(), 10);
    if (Number.isSafeInteger(model) && model > 0) {
      state.model = model;
    }
    return;
  }
  if (!line.startsWith("ATOM  ") && !line.startsWith("HETATM")) {
    return;
  }
  const serial = line.slice(6, 11).trim();
  const atomName = line.slice(12, 16).trim();
  const residueName = line.slice(17, 20).trim();
  const chainId = line.slice(21, 22).trim();
  const residueNumber = Number.parseInt(line.slice(22, 26).trim(), 10);
  const x = Number.parseFloat(line.slice(30, 38).trim());
  const y = Number.parseFloat(line.slice(38, 46).trim());
  const z = Number.parseFloat(line.slice(46, 54).trim());
  if (!serial || !atomName || !residueName || !Number.isSafeInteger(residueNumber) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    fail(
      "MALFORMED_STRUCTURE",
      "An authorized PDB atom has invalid fixed-column coordinates"
    );
  }
  const atomId = `${state.model}:${serial}`;
  const insertionCode = line.slice(26, 27).trim();
  const altLoc = line.slice(16, 17).trim();
  const element = line.slice(76, 78).trim();
  const occupancy = Number.parseFloat(line.slice(54, 60));
  const bFactor = Number.parseFloat(line.slice(60, 66));
  setBoundedStructureAtom(state, atomId, {
    atomId,
    atomName,
    authAtomName: atomName,
    authChainId: chainId,
    authResidueName: residueName,
    authSequenceId: residueNumber,
    ...element ? { element } : {},
    ...Number.isFinite(occupancy) ? { occupancy } : {},
    ...Number.isFinite(bFactor) ? { bFactor } : {},
    residueName,
    chainId,
    residueNumber,
    model: state.model,
    recordType: line.startsWith("HETATM") ? "HETATM" : "ATOM",
    ...insertionCode ? { insertionCode } : {},
    ...altLoc ? { altLoc } : {},
    x,
    y,
    z
  });
}
function parseMmcifLine(state, line) {
  if (state.mmcifTrustedRange === false && state.mmcifFraming != null && state.currentRecordStart != null && state.currentRecordStart < state.mmcifFraming.scannedThrough && !state.mmcifFraming.atomRanges.some(
    ({ start, end }) => state.currentRecordStart >= start && state.currentRecordStart < end
  )) {
    return;
  }
  if (state.mmcifMultiline) {
    if (line.startsWith(";")) state.mmcifMultiline = false;
    return;
  }
  if (line.startsWith(";")) {
    state.mmcifMultiline = true;
    if (state.mmcifPendingScalar != null) {
      state.mmcifPendingScalar = void 0;
    } else {
      consumeMmcifMetadataTokens(state, ["?"]);
    }
    return;
  }
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const control = /^(loop_|stop_)(?:\s+#.*)?$/iu.exec(trimmed)?.[1].toLowerCase();
  const isDataBlock = /^data_/iu.test(trimmed);
  if (trimmed.startsWith("_") || control != null || isDataBlock) {
    assertCompleteMmcifRecords(state);
  }
  if (control != null || isDataBlock) {
    state.headers = [];
    state.mmcifAtomHeadersInferred = false;
    state.mmcifCurrentAtomRange = void 0;
    state.mmcifLoop = control === "loop_";
    state.mmcifRowColumn = 0;
    state.mmcifRowValues = /* @__PURE__ */ new Map();
    state.mmcifPendingScalar = void 0;
    if (isDataBlock) {
      state.mmcifBlockStart = state.currentRecordStart ?? 0n;
      state.mmcifScalarValues = void 0;
    }
    return;
  }
  const positionedTokens = tokenizeMmcifLine(line);
  const tokens = positionedTokens.map(({ value }) => value);
  if (trimmed.startsWith("_")) {
    const header = tokens[0]?.toLowerCase();
    if (header == null) return;
    const sameCategory = state.headers.length === 0 || header.split(".")[0] === state.headers[0]?.split(".")[0];
    if (state.mmcifLoop && tokens.length === 1 && sameCategory) {
      if (state.mmcifAtomHeadersInferred && state.headers.includes(header)) {
        return;
      }
      if (state.headers.length >= MAX_MMCIF_HEADERS) {
        fail("RESOURCE_EXHAUSTED", "The mmCIF header budget is exceeded");
      }
      if (state.headers.includes(header)) {
        fail("MALFORMED_STRUCTURE", "The mmCIF loop repeats a column");
      }
      state.headers.push(header);
      if (header.startsWith("_atom_site.")) {
        state.mmcifAtomHeaders = [...state.headers];
      }
    } else {
      state.headers = [];
      state.mmcifLoop = false;
      state.mmcifCurrentAtomRange = void 0;
      if (tokens[1] == null) state.mmcifPendingScalar = header;
      else retainMmcifScalarMetadata(state, header, tokens[1]);
    }
    return;
  }
  if (state.mmcifPendingScalar != null) {
    if (tokens[0] != null) {
      retainMmcifScalarMetadata(state, state.mmcifPendingScalar, tokens[0]);
    }
    state.mmcifPendingScalar = void 0;
    return;
  }
  if (!state.headers[0]?.startsWith("_atom_site.")) {
    consumeMmcifMetadataTokens(state, tokens);
    return;
  }
  const groupColumn = state.headers.indexOf("_atom_site.group_pdb");
  if (state.mmcifAtomHeadersInferred && state.mmcifTrustedRange === false && (state.mmcifAtomRow?.length ?? 0) === 0 && groupColumn >= 0 && tokens[groupColumn] !== "ATOM" && tokens[groupColumn] !== "HETATM") {
    return;
  }
  if ((state.mmcifAtomRow?.length ?? 0) > 0 && state.mmcifAtomRowLineStart !== state.currentRecordStart) {
    state.mmcifComplexPackets = true;
  }
  for (const [index, token] of positionedTokens.entries()) {
    state.mmcifAtomRow ??= [];
    if (state.mmcifAtomRow.length === 0) {
      state.mmcifAtomRowStart = (state.currentRecordStart ?? 0n) + BigInt(index === 0 ? 0 : token.start);
      state.mmcifAtomRowLineStart = state.currentRecordStart;
    }
    const start = state.mmcifAtomRowStart ?? 0n;
    if ((state.currentRecordStart ?? 0n) + BigInt(token.end) - start > BigInt(MAX_STRUCTURE_LINE_BYTES)) {
      fail(
        "RESOURCE_EXHAUSTED",
        "An mmCIF atom packet exceeds its byte budget"
      );
    }
    state.mmcifAtomRow.push(token.value);
    if (state.mmcifAtomRow.length === state.headers.length) {
      const nextToken = positionedTokens[index + 1];
      const end = nextToken == null ? state.currentRecordEnd : (state.currentRecordStart ?? 0n) + BigInt(nextToken.start);
      const lineAligned = state.mmcifAtomRowLineStart === state.currentRecordStart && index + 1 === state.headers.length && nextToken == null;
      if (!lineAligned) state.mmcifComplexPackets = true;
      if (!state.mmcifComplexPackets || state.mmcifTrustedRange !== false) {
        parseMmcifAtomRow(state, state.mmcifAtomRow, end);
        retainMmcifAtomRange(state, start, end, lineAligned);
      }
      state.mmcifAtomRow = void 0;
      state.mmcifAtomRowStart = void 0;
      state.mmcifAtomRowLineStart = void 0;
    }
  }
  if ((state.mmcifAtomRow?.length ?? 0) > 0) state.mmcifComplexPackets = true;
}
function parseMmcifAtomRow(state, tokens, recordEnd) {
  const values = /* @__PURE__ */ new Map();
  for (const [index, header] of state.headers.entries()) {
    values.set(header, tokens[index]);
  }
  function get(key) {
    const value = values.get(`_atom_site.${key}`);
    return value === "." || value === "?" ? void 0 : value;
  }
  const serial = get("id");
  const x = Number(get("cartn_x"));
  const y = Number(get("cartn_y"));
  const z = Number(get("cartn_z"));
  const model = Number(get("pdbx_pdb_model_num") ?? 1);
  const residueNumber = Number(
    get("auth_seq_id") ?? get("label_seq_id") ?? Number.NaN
  );
  const labelSequenceId = get("label_seq_id") == null ? void 0 : Number(get("label_seq_id"));
  const authSequenceId = get("auth_seq_id") == null ? void 0 : Number(get("auth_seq_id"));
  const occupancy = get("occupancy") == null ? void 0 : Number(get("occupancy"));
  const bFactor = get("b_iso_or_equiv") == null ? void 0 : Number(get("b_iso_or_equiv"));
  if (!serial || !Number.isSafeInteger(model) || !Number.isSafeInteger(residueNumber) || labelSequenceId != null && !Number.isSafeInteger(labelSequenceId) || authSequenceId != null && !Number.isSafeInteger(authSequenceId) || occupancy != null && !Number.isFinite(occupancy) || bFactor != null && !Number.isFinite(bFactor) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    fail(
      "MALFORMED_STRUCTURE",
      "An authorized mmCIF atom has invalid coordinates"
    );
  }
  const atomId = `${model}:${serial}`;
  const insertionCode = get("pdbx_pdb_ins_code");
  const altLoc = get("label_alt_id");
  retainMmcifEntityMembership(
    state,
    get("label_asym_id"),
    get("label_entity_id"),
    "observed"
  );
  setBoundedStructureAtom(
    state,
    atomId,
    {
      atomId,
      atomName: get("auth_atom_id") ?? get("label_atom_id") ?? serial,
      authAtomName: get("auth_atom_id"),
      authChainId: get("auth_asym_id"),
      authResidueName: get("auth_comp_id"),
      authSequenceId,
      ...occupancy == null ? {} : { occupancy },
      ...bFactor == null ? {} : { bFactor },
      chainId: get("auth_asym_id") ?? get("label_asym_id") ?? "",
      labelAtomName: get("label_atom_id"),
      labelChainId: get("label_asym_id"),
      labelResidueName: get("label_comp_id"),
      labelSequenceId,
      entityId: get("label_entity_id"),
      element: get("type_symbol"),
      residueName: get("auth_comp_id") ?? get("label_comp_id") ?? "UNK",
      residueNumber,
      model,
      recordType: get("group_pdb") === "HETATM" ? "HETATM" : "ATOM",
      ...insertionCode ? { insertionCode } : {},
      ...altLoc ? { altLoc } : {},
      x,
      y,
      z
    },
    recordEnd
  );
}
function tokenizeMmcifLine(line) {
  const tokens = [];
  let cursor = 0;
  let byteCursor = 0;
  let previousCursor = 0;
  while (cursor < line.length) {
    while (cursor < line.length && /\s/u.test(line[cursor])) cursor += 1;
    if (cursor === line.length || line[cursor] === "#") break;
    byteCursor += Buffer.byteLength(line.slice(previousCursor, cursor), "utf8");
    const tokenStart = byteCursor;
    const tokenCursor = cursor;
    let value;
    const quote = line[cursor];
    if (quote === "'" || quote === '"') {
      const start = ++cursor;
      while (cursor < line.length && (line[cursor] !== quote || cursor + 1 < line.length && !/\s/u.test(line[cursor + 1]))) {
        cursor += 1;
      }
      if (cursor === line.length) {
        fail("MALFORMED_STRUCTURE", "A quoted mmCIF token is incomplete");
      }
      value = line.slice(start, cursor);
      cursor += 1;
    } else {
      const start = cursor;
      while (cursor < line.length && !/\s/u.test(line[cursor])) cursor += 1;
      value = line.slice(start, cursor);
    }
    byteCursor += Buffer.byteLength(line.slice(tokenCursor, cursor), "utf8");
    previousCursor = cursor;
    tokens.push({ value, start: tokenStart, end: byteCursor });
  }
  return tokens;
}
var MMCIF_RESIDUE_METADATA_FIELDS = /* @__PURE__ */ new Set([
  "_chem_comp.id",
  "_chem_comp.type",
  "_entity.id",
  "_entity.type",
  "_entity_poly.entity_id",
  "_entity_poly.type",
  "_struct_asym.id",
  "_struct_asym.entity_id"
]);
function isMmcifEntityMappingField(header) {
  return header === "_struct_asym.id" || header === "_struct_asym.entity_id";
}
function assertCompleteMmcifRecords(state) {
  if ((state.mmcifAtomRow?.length ?? 0) > 0 && !(state.mmcifComplexPackets && state.mmcifTrustedRange === false)) {
    fail(
      "MALFORMED_STRUCTURE",
      "An authorized mmCIF atom-site row is incomplete"
    );
  }
  if (state.mmcifTrustedRange === false) return;
  if (isMmcifEntityMappingField(state.mmcifPendingScalar)) {
    fail(
      "MALFORMED_STRUCTURE",
      "A native mmCIF entity mapping value is missing"
    );
  }
  if ((state.mmcifRowColumn ?? 0) > 0 && state.headers.some(isMmcifEntityMappingField)) {
    fail(
      "MALFORMED_STRUCTURE",
      "A native mmCIF entity mapping row is incomplete"
    );
  }
}
function assertMmcifEntityIdentifier(value) {
  if (value.trim().length === 0) {
    fail("MALFORMED_STRUCTURE", "A native mmCIF entity identifier is empty");
  }
  if (value.length > MAX_MMCIF_METADATA_VALUE_LENGTH) {
    fail(
      "RESOURCE_EXHAUSTED",
      "A native mmCIF entity identifier exceeds its value budget"
    );
  }
}
function consumeMmcifMetadataTokens(state, tokens) {
  if (!state.headers.some((header) => MMCIF_RESIDUE_METADATA_FIELDS.has(header))) {
    return;
  }
  let column = state.mmcifRowColumn ?? 0;
  let values = state.mmcifRowValues ?? /* @__PURE__ */ new Map();
  for (const token of tokens) {
    const header = state.headers[column];
    if (state.mmcifTrustedRange !== false && isMmcifEntityMappingField(header)) {
      assertMmcifEntityIdentifier(token);
    }
    if (header != null && MMCIF_RESIDUE_METADATA_FIELDS.has(header) && token !== "." && token !== "?" && token.trim().length > 0 && token.length <= MAX_MMCIF_METADATA_VALUE_LENGTH) {
      values.set(header, token);
    }
    column += 1;
    if (column === state.headers.length) {
      retainMmcifResidueMetadata(state, values);
      column = 0;
      values = /* @__PURE__ */ new Map();
    }
  }
  state.mmcifRowColumn = column;
  state.mmcifRowValues = values;
}
function retainMmcifScalarMetadata(state, header, value) {
  if (state.mmcifTrustedRange === false) return;
  if (isMmcifEntityMappingField(header)) assertMmcifEntityIdentifier(value);
  if (!MMCIF_RESIDUE_METADATA_FIELDS.has(header) || value === "." || value === "?" || value.trim().length === 0 || value.length > MAX_MMCIF_METADATA_VALUE_LENGTH) {
    return;
  }
  state.mmcifScalarValues ??= /* @__PURE__ */ new Map();
  setMmcifMetadataValue(state.mmcifScalarValues, header, value);
  retainMmcifResidueMetadata(state, state.mmcifScalarValues);
}
function setMmcifMetadataValue(values, key, value, id = key) {
  const existing = values.get(key);
  if (existing != null && existing !== value) {
    fail(
      "MALFORMED_STRUCTURE",
      `Conflicting mmCIF residue metadata declarations for ${id}`
    );
  }
  values.set(key, value);
}
function mmcifMetadataKey(blockStart, id) {
  return `${blockStart}:${id}`;
}
function retainMmcifEntityMembership(state, labelChainId, entityId, provenance) {
  const metadata = state.mmcifMetadata;
  if (metadata == null || state.mmcifTrustedRange === false || labelChainId == null || entityId == null) {
    return;
  }
  assertMmcifEntityIdentifier(labelChainId);
  assertMmcifEntityIdentifier(entityId);
  const memberships = metadata.entityMemberships;
  const key = mmcifMetadataKey(state.mmcifBlockStart, labelChainId);
  const existing = memberships.get(key);
  if (existing == null && memberships.size >= MAX_MMCIF_METADATA_RECORDS) {
    fail(
      "RESOURCE_EXHAUSTED",
      "The native mmCIF entity membership budget is exceeded"
    );
  }
  const membership = existing ?? {};
  if (provenance === "declared" && membership.declaredEntityId != null && membership.declaredEntityId !== entityId) {
    fail(
      "MALFORMED_STRUCTURE",
      `Conflicting mmCIF residue metadata declarations for ${labelChainId}`
    );
  }
  if (membership.declaredEntityId != null && membership.declaredEntityId !== entityId || provenance === "declared" && (membership.observedConflict || membership.observedEntityId != null && membership.observedEntityId !== entityId)) {
    fail(
      "AMBIGUOUS_IDENTITY",
      `Conflicting mmCIF entity identities for label chain ${labelChainId}`
    );
  }
  if (provenance === "declared") {
    membership.declaredEntityId = entityId;
  } else if (membership.observedEntityId == null) {
    membership.observedEntityId = entityId;
  } else if (membership.observedEntityId !== entityId) {
    membership.observedConflict = true;
  }
  memberships.set(key, membership);
}
function retainMmcifResidueMetadata(state, values) {
  const metadata = state.mmcifMetadata;
  if (metadata == null || state.mmcifTrustedRange === false) return;
  const retain = (target, id, value) => {
    if (id == null || value == null) return;
    const key = mmcifMetadataKey(state.mmcifBlockStart, id);
    if (target.has(key) || target.size < MAX_MMCIF_METADATA_RECORDS) {
      setMmcifMetadataValue(target, key, value, id);
    }
  };
  retain(
    metadata.entityTypes,
    values.get("_entity.id"),
    values.get("_entity.type")
  );
  const polymerEntityId = values.get("_entity_poly.entity_id");
  if (polymerEntityId != null && metadata.polymerEntities.size < MAX_MMCIF_METADATA_RECORDS) {
    metadata.polymerEntities.add(
      mmcifMetadataKey(state.mmcifBlockStart, polymerEntityId)
    );
  }
  retain(
    metadata.polymerTypes,
    polymerEntityId,
    values.get("_entity_poly.type")
  );
  retain(
    metadata.chemicalComponentTypes,
    values.get("_chem_comp.id"),
    values.get("_chem_comp.type")
  );
  retainMmcifEntityMembership(
    state,
    values.get("_struct_asym.id"),
    values.get("_struct_asym.entity_id"),
    "declared"
  );
}
function applyMmcifResidueMetadata(state) {
  const metadata = state.mmcifMetadata;
  if (state.format !== "mmcif" || metadata == null || state.mmcifTrustedRange === false) {
    return;
  }
  for (const [id, atom] of state.atoms) {
    const blockStart = state.mmcifAtomBlocks.get(id);
    if (blockStart == null) continue;
    const declaredEntityId = atom.labelChainId == null ? void 0 : metadata.entityMemberships.get(
      mmcifMetadataKey(blockStart, atom.labelChainId)
    )?.declaredEntityId;
    if (atom.entityId != null && declaredEntityId != null && atom.entityId !== declaredEntityId) {
      fail(
        "AMBIGUOUS_IDENTITY",
        `Conflicting mmCIF entity identities for label chain ${atom.labelChainId}`
      );
    }
    const entityId = atom.entityId ?? declaredEntityId;
    const entityKey = entityId == null ? void 0 : mmcifMetadataKey(blockStart, entityId);
    const entityType = entityKey == null ? void 0 : metadata.entityTypes.get(entityKey) ?? (metadata.polymerEntities.has(entityKey) ? "polymer" : void 0);
    const polymerType = entityKey == null ? void 0 : metadata.polymerTypes.get(entityKey);
    const chemicalComponentType = metadata.chemicalComponentTypes.get(
      mmcifMetadataKey(blockStart, atom.labelResidueName ?? atom.residueName)
    );
    state.atoms.set(id, {
      ...atom,
      ...entityId == null ? {} : { entityId },
      ...entityType == null ? {} : { entityType },
      ...polymerType == null ? {} : { polymerType },
      ...chemicalComponentType == null ? {} : { chemicalComponentType },
      classificationMetadata: entityType != null || polymerType != null ? "declared" : "unavailable"
    });
  }
}
function retainMmcifAtomRange(state, start, end, lineAligned) {
  const framing = state.mmcifFraming;
  if (!state.mmcifTrustedRange || framing == null || start == null || end == null) {
    return;
  }
  state.mmcifCurrentAtomRange ??= framing.atomRanges.find(
    (range) => start >= range.start && start < range.end
  );
  if (state.mmcifCurrentAtomRange == null) {
    state.mmcifCurrentAtomRange = {
      start,
      end,
      lineAligned,
      headers: [...state.headers],
      blockStart: state.mmcifBlockStart
    };
    if (framing.atomRanges.length < MAX_MMCIF_METADATA_RECORDS) {
      framing.atomRanges.push(state.mmcifCurrentAtomRange);
    }
  } else if (end > state.mmcifCurrentAtomRange.end) {
    state.mmcifCurrentAtomRange.end = end;
  }
  if (!lineAligned) state.mmcifCurrentAtomRange.lineAligned = false;
}
function nativeClassificationMetadata(atoms) {
  const declared = atoms.filter(
    (atom) => atom.classificationMetadata === "declared"
  ).length;
  return declared === 0 ? "unavailable" : declared === atoms.length ? "declared" : "partial";
}
function parsePqrLine(state, line) {
  const fields = line.trim().split(/\s+/u);
  if (fields[0] === "MODEL") {
    const model = Number(fields[1]);
    if (Number.isSafeInteger(model) && model > 0) {
      state.model = model;
    }
    return;
  }
  if (fields[0] !== "ATOM" && fields[0] !== "HETATM") {
    return;
  }
  if (fields.length < 10) {
    fail("MALFORMED_STRUCTURE", "An authorized PQR atom row is incomplete");
  }
  const hasChain = fields.length >= 11;
  const residue = /^(-?\d+)([A-Za-z]?)$/u.exec(fields[hasChain ? 5 : 4]);
  const coordinate = hasChain ? 6 : 5;
  if (residue == null) {
    fail("MALFORMED_STRUCTURE", "An authorized PQR residue is invalid");
  }
  appendParsedStructureAtom(state, {
    serial: fields[1],
    atomName: fields[2],
    chainId: hasChain ? fields[4] : "A",
    residueName: fields[3],
    residueNumber: Number(residue[1]),
    recordType: fields[0],
    ...residue[2] ? { insertionCode: residue[2] } : {},
    x: Number(fields[coordinate]),
    y: Number(fields[coordinate + 1]),
    z: Number(fields[coordinate + 2])
  });
}
function parseMolLine(state, line) {
  if (state.format === "sdf" && line.trim() === "$$$$") {
    state.model += 1;
    state.formatLine = 0;
    state.blockAtomCount = void 0;
    state.blockAtomIndex = 0;
    state.formatSection = void 0;
    return;
  }
  const lineNumber = state.formatLine ?? 0;
  state.formatLine = lineNumber + 1;
  if (lineNumber === 3) {
    if (/V3000/u.test(line)) {
      state.formatSection = "v3000";
      return;
    }
    const count2 = Number(line.slice(0, 3).trim());
    if (!Number.isSafeInteger(count2) || count2 <= 0) {
      fail("MALFORMED_STRUCTURE", "An authorized MOL atom count is invalid");
    }
    state.blockAtomCount = count2;
    state.blockAtomIndex = 0;
    return;
  }
  if (state.formatSection === "v3000" || state.formatSection === "v3000-atoms") {
    if (/^M\s+V30\s+BEGIN ATOM\s*$/u.test(line)) {
      state.formatSection = "v3000-atoms";
      return;
    }
    if (/^M\s+V30\s+END ATOM\s*$/u.test(line)) {
      state.formatSection = "v3000";
      return;
    }
    if (state.formatSection !== "v3000-atoms") {
      return;
    }
    const fields = line.replace(/^M\s+V30\s+/u, "").trim().split(/\s+/u);
    if (fields.length < 5) {
      fail("MALFORMED_STRUCTURE", "An authorized MOL V3000 atom is incomplete");
    }
    appendParsedStructureAtom(state, {
      serial: fields[0],
      atomName: `${fields[1]}${fields[0]}`,
      x: Number(fields[2]),
      y: Number(fields[3]),
      z: Number(fields[4])
    });
    return;
  }
  const count = state.blockAtomCount;
  const index = state.blockAtomIndex ?? 0;
  if (count == null || index >= count || lineNumber < 4) {
    return;
  }
  const element = line.slice(31, 34).trim();
  if (!element) {
    fail("MALFORMED_STRUCTURE", "An authorized MOL atom element is missing");
  }
  const serial = String(index + 1);
  appendParsedStructureAtom(state, {
    serial,
    atomName: `${element}${serial}`,
    x: Number(line.slice(0, 10).trim()),
    y: Number(line.slice(10, 20).trim()),
    z: Number(line.slice(20, 30).trim())
  });
  state.blockAtomIndex = index + 1;
}
function parseMol2Line(state, line) {
  if (line.startsWith("@<TRIPOS>MOLECULE")) {
    if (state.formatLine != null) {
      state.model += 1;
    }
    state.formatLine = 0;
    state.formatSection = void 0;
    return;
  }
  if (line.startsWith("@<TRIPOS>ATOM")) {
    state.formatSection = "atoms";
    return;
  }
  if (line.startsWith("@<TRIPOS>")) {
    state.formatSection = void 0;
    return;
  }
  if (state.formatSection !== "atoms" || !line.trim()) {
    return;
  }
  const fields = line.trim().split(/\s+/u);
  if (fields.length < 6) {
    fail("MALFORMED_STRUCTURE", "An authorized MOL2 atom row is incomplete");
  }
  appendParsedStructureAtom(state, {
    serial: fields[0],
    atomName: fields[1],
    residueName: fields[7] ?? "LIG",
    residueNumber: fields[6] == null ? 1 : Number(fields[6]),
    x: Number(fields[2]),
    y: Number(fields[3]),
    z: Number(fields[4])
  });
}
function parseGroLine(state, line) {
  const lineNumber = state.formatLine ?? 0;
  state.formatLine = lineNumber + 1;
  if (lineNumber === 0) {
    return;
  }
  if (lineNumber === 1) {
    const count2 = Number(line.trim());
    if (!Number.isSafeInteger(count2) || count2 <= 0) {
      fail("MALFORMED_STRUCTURE", "An authorized GRO atom count is invalid");
    }
    state.blockAtomCount = count2;
    state.blockAtomIndex = 0;
    return;
  }
  const count = state.blockAtomCount ?? 0;
  const index = state.blockAtomIndex ?? 0;
  if (index >= count) {
    state.model += 1;
    state.formatLine = 0;
    state.blockAtomCount = void 0;
    state.blockAtomIndex = 0;
    return;
  }
  if (line.length < 44) {
    fail("MALFORMED_STRUCTURE", "An authorized GRO atom row is incomplete");
  }
  appendParsedStructureAtom(state, {
    serial: line.slice(15, 20).trim(),
    atomName: line.slice(10, 15).trim(),
    residueName: line.slice(5, 10).trim(),
    residueNumber: Number(line.slice(0, 5).trim()),
    recordType: "ATOM",
    x: 10 * Number(line.slice(20, 28).trim()),
    y: 10 * Number(line.slice(28, 36).trim()),
    z: 10 * Number(line.slice(36, 44).trim())
  });
  state.blockAtomIndex = index + 1;
}
function parseXyzLine(state, line) {
  const lineNumber = state.formatLine ?? 0;
  if (lineNumber === 0 && !line.trim()) {
    return;
  }
  state.formatLine = lineNumber + 1;
  if (lineNumber === 0) {
    const count = Number(line.trim());
    if (!Number.isSafeInteger(count) || count <= 0) {
      fail("MALFORMED_STRUCTURE", "An authorized XYZ atom count is invalid");
    }
    state.blockAtomCount = count;
    state.blockAtomIndex = 0;
    return;
  }
  if (lineNumber === 1) {
    return;
  }
  const fields = line.trim().split(/\s+/u);
  if (fields.length < 4) {
    fail("MALFORMED_STRUCTURE", "An authorized XYZ atom row is incomplete");
  }
  const index = state.blockAtomIndex ?? 0;
  const serial = String(index + 1);
  appendParsedStructureAtom(state, {
    serial,
    atomName: `${fields[0]}${serial}`,
    residueName: "MOL",
    x: Number(fields[1]),
    y: Number(fields[2]),
    z: Number(fields[3])
  });
  state.blockAtomIndex = index + 1;
  if (state.blockAtomIndex === state.blockAtomCount) {
    state.model += 1;
    state.formatLine = 0;
    state.blockAtomCount = void 0;
    state.blockAtomIndex = 0;
  }
}
function appendParsedStructureAtom(state, atom) {
  if (!atom.serial || !atom.atomName || !Number.isSafeInteger(atom.residueNumber ?? 1) || !Number.isFinite(atom.x) || !Number.isFinite(atom.y) || !Number.isFinite(atom.z)) {
    fail("MALFORMED_STRUCTURE", "An authorized structure atom is invalid");
  }
  const atomId = `${state.model}:${atom.serial}`;
  setBoundedStructureAtom(state, atomId, {
    atomId,
    atomName: atom.atomName,
    chainId: atom.chainId ?? "A",
    residueName: atom.residueName ?? "LIG",
    residueNumber: atom.residueNumber ?? 1,
    model: state.model,
    recordType: atom.recordType ?? "HETATM",
    ...atom.insertionCode ? { insertionCode: atom.insertionCode } : {},
    x: atom.x,
    y: atom.y,
    z: atom.z
  });
}
function setBoundedStructureAtom(state, atomId, atom, recordEnd = state.currentRecordEnd) {
  if (state.atoms.has(atomId)) {
    fail("AMBIGUOUS_IDENTITY", "The molecular source repeats an atom identity");
  }
  if (!state.atoms.has(atomId) && state.atoms.size >= MAX_RESIDENT_ATOMS) {
    let evicted = false;
    for (const retainedAtomId of state.atoms.keys()) {
      if (!state.selectedAtomIds?.has(retainedAtomId)) {
        state.atoms.delete(retainedAtomId);
        state.mmcifAtomBlocks.delete(retainedAtomId);
        state.recordEndOffsets?.delete(retainedAtomId);
        state.evicted = true;
        evicted = true;
        break;
      }
    }
    if (!evicted) {
      fail(
        "RESOURCE_EXHAUSTED",
        "The selected molecular atoms exceed their resident index budget"
      );
    }
  }
  state.atoms.set(atomId, {
    ...atom,
    sourceFormat: state.format,
    classificationMetadata: atom.classificationMetadata ?? "unavailable"
  });
  if (state.format === "mmcif" && state.mmcifTrustedRange !== false) {
    state.mmcifAtomBlocks.set(atomId, state.mmcifBlockStart);
  }
  if (state.recordEndOffsets != null && recordEnd != null) {
    state.recordEndOffsets.set(atomId, recordEnd);
  }
}
function fail(code, message) {
  const error = Object.assign(new Error(message), {
    name: "ScientificStructureRuntimeError",
    code
  });
  throw error;
}

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-native-trajectory-bundle.mjs
import { createHash } from "node:crypto";
var _SCIENTIFIC_STRUCTURE_LIMITS = Object.freeze({
  maxAtoms: 1e6,
  maxComparisons: 5e6,
  maxContacts: 5e4,
  maxRmsdAtoms: 2e4,
  maxSelectionAtoms: 1e5,
  maxSourceBytes: 128 * 1024 * 1024
});
var ScientificStructureError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ScientificStructureError";
  }
  code;
};
var SCIENTIFIC_STRUCTURE_TRAJECTORY_LIMITS = Object.freeze({
  maxAlignmentAtoms: 1e5,
  maxFrames: 2e4,
  maxTopologyAtoms: 1e6
});
function validateScientificStructureTrajectoryTopology(topology) {
  if (!/^sha256:[\da-f]{64}$/iu.test(topology.sourceDigest)) {
    throw trajectoryError("Trajectory sourceDigest must be a SHA-256 digest");
  }
  assertText(topology.sourceRevision, "sourceRevision");
  if (topology.atomIds.length === 0) {
    throw trajectoryError("Trajectory topology must contain at least one atom");
  }
  if (topology.atomIds.length > SCIENTIFIC_STRUCTURE_TRAJECTORY_LIMITS.maxTopologyAtoms) {
    throw resourceError("Trajectory topology atom limit exceeded");
  }
  const identities = /* @__PURE__ */ new Set();
  for (const atomId of topology.atomIds) {
    assertText(atomId, "topology atom ID");
    if (identities.has(atomId)) {
      throw trajectoryError(`Duplicate topology atom identity: ${atomId}`);
    }
    identities.add(atomId);
  }
  return {
    atomCount: topology.atomIds.length,
    complete: true,
    sourceDigest: topology.sourceDigest,
    sourceRevision: topology.sourceRevision
  };
}
function validateScientificStructureTrajectoryFrame({
  frame,
  topology
}) {
  const validated = validateScientificStructureTrajectoryTopology(topology);
  if (frame.topologyDigest !== topology.sourceDigest) {
    throw trajectoryError("Trajectory frame topology digest does not match");
  }
  if (!Number.isSafeInteger(frame.index) || frame.index < 0) {
    throw trajectoryError(
      "Trajectory frame index must be a nonnegative integer"
    );
  }
  if (frame.timePicoseconds != null && !Number.isFinite(frame.timePicoseconds)) {
    throw trajectoryError("Trajectory frame time must be finite");
  }
  if (frame.coordinates.length !== validated.atomCount * 3) {
    throw trajectoryError(
      "Trajectory frame coordinate count does not match topology"
    );
  }
  if (Array.from(frame.coordinates).some((value) => !Number.isFinite(value))) {
    throw trajectoryError("Trajectory frame contains non-finite coordinates");
  }
  if (frame.boxAngstrom?.some((length) => !Number.isFinite(length) || length <= 0)) {
    throw trajectoryError(
      "Trajectory periodic box lengths must be positive and finite"
    );
  }
  return {
    atomCount: validated.atomCount,
    complete: true,
    frameIndex: frame.index,
    timePicoseconds: frame.timePicoseconds ?? null,
    topologyDigest: frame.topologyDigest
  };
}
function assertText(value, field) {
  if (value.trim().length === 0 || value.length > 256) {
    throw trajectoryError(`${field} is invalid or exceeds its limit`);
  }
}
function trajectoryError(message) {
  return new ScientificStructureError("INVALID_REQUEST", message);
}
function resourceError(message) {
  return new ScientificStructureError("RESOURCE_EXHAUSTED", message);
}
var ScientificStructureBinaryIoError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ScientificStructureBinaryIoError";
  }
  code;
};
var SCIENTIFIC_STRUCTURE_BINARY_IO_LIMITS = Object.freeze({
  maxAtoms: 1e6,
  maxBcifExpandedBytes: 512 * 1024 * 1024,
  maxBcifScanBytes: 16n * 1024n * 1024n * 1024n,
  maxDecodedFrameBytes: 128 * 1024 * 1024,
  maxFrameBytes: 4n * 1024n * 1024n * 1024n,
  maxFrames: 1e6,
  maxMetadataBytes: 16 * 1024 * 1024,
  maxRangeBytes: 1024 * 1024,
  maxSdfRecordBytes: 128 * 1024 * 1024,
  maxSdfRecords: 1e6
});
var ARCHIVE_SIGNATURES = [
  { bytes: [31, 139], label: "gzip" },
  { bytes: [66, 90, 104], label: "bzip2" },
  { bytes: [80, 75, 3, 4], label: "ZIP" },
  { bytes: [80, 75, 5, 6], label: "ZIP" },
  { bytes: [80, 75, 7, 8], label: "ZIP" },
  { bytes: [253, 55, 122, 88, 90, 0], label: "XZ" },
  { bytes: [40, 181, 47, 253], label: "Zstandard" },
  { bytes: [55, 122, 188, 175, 39, 28], label: "7-Zip" },
  { bytes: [82, 97, 114, 33, 26, 7], label: "RAR" }
];
async function indexScientificStructureBinaryTrajectory(input) {
  const budget = getBudget(input.budget);
  assertSource(input.source);
  await revalidateSource(input.source, input.signal);
  assertNotCancelled(input.signal);
  await assertNotArchive(input.source, input.signal, budget);
  const topology = validateScientificStructureTrajectoryTopology(
    input.topology
  );
  if (topology.atomCount > budget.maxAtoms) {
    throw exhausted("Trajectory topology exceeds maxAtoms");
  }
  const format = input.format === "nc" || input.format === "nctraj" ? "netcdf" : input.format;
  let indexed;
  if (format === "xtc") {
    indexed = await indexXtc(
      input.source,
      topology.atomCount,
      input.signal,
      budget
    );
  } else if (format === "dcd") {
    indexed = await indexDcd(
      input.source,
      topology.atomCount,
      input.signal,
      budget
    );
  } else if (format === "trr") {
    indexed = await indexTrr(
      input.source,
      topology.atomCount,
      input.signal,
      budget
    );
  } else {
    indexed = await indexNetcdf(
      input.source,
      topology.atomCount,
      input.signal,
      budget
    );
  }
  await revalidateSource(input.source, input.signal);
  return {
    ...indexed,
    atomCount: topology.atomCount,
    format,
    sourceDigest: input.source.sourceDigest,
    sourceRevision: input.source.sourceRevision,
    sourceSizeBytes: input.source.sizeBytes,
    topologyDigest: topology.sourceDigest,
    topologyRevision: topology.sourceRevision
  };
}
var ScientificStructureBinaryFrameReader = class {
  constructor(input) {
    this.input = input;
    this.budget = getBudget(input.budget);
    assertSource(input.source);
    const topology = validateScientificStructureTrajectoryTopology(
      input.topology
    );
    if (input.index.sourceDigest !== input.source.sourceDigest || input.index.sourceRevision !== input.source.sourceRevision || input.index.sourceSizeBytes !== input.source.sizeBytes) {
      throw sourceChanged(
        "Trajectory frame index belongs to another source revision"
      );
    }
    if (input.index.topologyDigest !== topology.sourceDigest || input.index.topologyRevision !== topology.sourceRevision || input.index.atomCount !== topology.atomCount) {
      throw topologyMismatch(
        "Trajectory frame index does not match the selected topology"
      );
    }
  }
  input;
  budget;
  async readFrames(input) {
    const stride = input.stride ?? 1;
    if (!Number.isSafeInteger(stride) || stride < 1) {
      throw malformed("Trajectory frame stride must be a positive integer");
    }
    if (!Number.isSafeInteger(input.start) || !Number.isSafeInteger(input.endExclusive) || input.start < 0 || input.endExclusive < input.start || input.endExclusive > this.input.index.frameCount) {
      throw malformed("Requested trajectory frame window is invalid");
    }
    const sampledFrameCount = Math.ceil(
      (input.endExclusive - input.start) / stride
    );
    if (sampledFrameCount > this.budget.maxFrames) {
      throw exhausted("Requested trajectory frame window exceeds maxFrames");
    }
    await revalidateSource(this.input.source, input.signal);
    const frames = [];
    for (let frameIndex = input.start; frameIndex < input.endExclusive; frameIndex += stride) {
      assertNotCancelled(input.signal);
      const descriptor = this.input.index.frames[frameIndex];
      if (descriptor == null || descriptor.frameIndex !== frameIndex) {
        throw malformed("Trajectory frame index is incomplete or out of order");
      }
      const frame = this.input.decoder == null ? await decodeScientificStructureBinaryFrame({
        budget: this.budget,
        descriptor,
        signal: input.signal,
        source: this.input.source,
        topology: this.input.topology
      }) : await this.input.decoder.decodeFrame({
        descriptor,
        format: this.input.index.format,
        signal: input.signal,
        source: this.input.source,
        topology: this.input.topology
      });
      validateDecodedFrame(frame, descriptor, this.input.topology);
      frames.push(frame);
    }
    await revalidateSource(this.input.source, input.signal);
    return {
      complete: true,
      frames,
      indexComplete: this.input.index.complete,
      sampledFrameCount,
      sourceFrameCount: this.input.index.frameCount,
      stride
    };
  }
};
async function decodeScientificStructureBinaryFrame(input) {
  const budget = getBudget(input.budget);
  const descriptor = input.descriptor;
  if (!descriptor.coordinatesComplete) {
    throw malformed("Trajectory frame does not contain coordinates");
  }
  if (descriptor.coordinateEncoding === "xtc-compressed") {
    throw new ScientificStructureBinaryIoError(
      "UNSUPPORTED",
      "Compressed XTC coordinates require an injected governed decoder"
    );
  }
  const coordinateBytes = descriptor.coordinateRanges.reduce(
    (total, range) => total + range.length,
    0
  );
  if (coordinateBytes > budget.maxDecodedFrameBytes) {
    throw exhausted("Decoded trajectory frame exceeds maxDecodedFrameBytes");
  }
  const parts = await Promise.all(
    descriptor.coordinateRanges.map(
      (range) => readExactChunked(
        input.source,
        range.offset,
        range.length,
        input.signal,
        budget
      )
    )
  );
  const coordinates = decodeCoordinates(descriptor, parts);
  const lengths = descriptor.cell?.lengthsAngstrom;
  const frame = {
    ...lengths == null ? {} : { boxAngstrom: lengths },
    coordinates,
    index: descriptor.frameIndex,
    ...descriptor.timePicoseconds == null ? {} : { timePicoseconds: descriptor.timePicoseconds },
    topologyDigest: input.topology.sourceDigest
  };
  validateDecodedFrame(frame, descriptor, input.topology);
  return frame;
}
async function indexXtc(source, topologyAtoms, signal, budget) {
  const frames = [];
  let offset = 0n;
  while (offset < source.sizeBytes) {
    if (frames.length === budget.maxFrames) {
      return partialIndex(frames, offset);
    }
    const header = await readExact(source, offset, 56, signal, budget);
    const view = dataView(header);
    if (view.getInt32(0, false) !== 1995) {
      throw malformed("XTC frame has an invalid magic number");
    }
    const atomCount = view.getInt32(4, false);
    assertFrameAtomCount(atomCount, topologyAtoms, budget, "XTC");
    if (view.getInt32(52, false) !== atomCount) {
      throw malformed("XTC coordinate count does not match its atom count");
    }
    const step = view.getInt32(8, false);
    const timePicoseconds = view.getFloat32(12, false);
    if (!Number.isFinite(timePicoseconds)) {
      throw malformed("XTC frame time is not finite");
    }
    const vectors = readCellVectors(view, 16, 4, false, 10);
    let byteLength;
    let coordinateEncoding;
    let coordinateRange;
    if (atomCount <= 9) {
      const coordinateBytes = safeNumberProduct(
        [atomCount, 12],
        "XTC coordinate payload"
      );
      byteLength = 56n + BigInt(coordinateBytes);
      coordinateEncoding = "float32-be-interleaved-nanometre";
      coordinateRange = { length: coordinateBytes, offset: offset + 56n };
    } else {
      const compressedHeader = await readExact(
        source,
        offset,
        92,
        signal,
        budget
      );
      const compressedView = dataView(compressedHeader);
      const smallIndex = compressedView.getInt32(84, false);
      const compressedBytes = compressedView.getInt32(88, false);
      if (smallIndex < 9 || smallIndex > 72 || compressedBytes < 1) {
        throw malformed("XTC compressed frame has invalid packing metadata");
      }
      const padded = safeNumberProduct(
        [Math.ceil(compressedBytes / 4), 4],
        "XTC compressed coordinate payload"
      );
      byteLength = 92n + BigInt(padded);
      coordinateEncoding = "xtc-compressed";
      coordinateRange = { length: padded, offset: offset + 92n };
    }
    assertFrameSpan(source, offset, byteLength, budget, "XTC frame");
    frames.push({
      atomCount,
      byteLength,
      byteOffset: offset,
      cell: cellFromVectors(vectors),
      coordinateEncoding,
      coordinateRanges: [coordinateRange],
      coordinatesComplete: true,
      frameIndex: frames.length,
      step,
      timePicoseconds
    });
    offset += byteLength;
  }
  return completeIndex(frames, offset);
}
async function indexDcd(source, topologyAtoms, signal, budget) {
  const header = await readExact(source, 0n, 104, signal, budget);
  const view = dataView(header);
  let littleEndian = null;
  if (view.getInt32(0, true) === 84) {
    littleEndian = true;
  } else if (view.getInt32(0, false) === 84) {
    littleEndian = false;
  }
  if (littleEndian == null || !bytesEqualAt(header, 4, [67, 79, 82, 68])) {
    throw malformed("DCD CORD header is invalid");
  }
  const declaredFrameCount = view.getInt32(8, littleEndian);
  const startStep = view.getInt32(12, littleEndian);
  const saveInterval = view.getInt32(16, littleEndian);
  const hasCell = view.getInt32(48, littleEndian) !== 0;
  const hasFourthDimension = view.getInt32(52, littleEndian) === 1;
  if (declaredFrameCount < 0 || view.getInt32(88, littleEndian) !== 84) {
    throw malformed("DCD frame header is invalid");
  }
  const titleBytes = view.getInt32(92, littleEndian);
  const titleLineCount = view.getInt32(96, littleEndian);
  if (titleBytes < 4 || (titleBytes - 4) % 80 !== 0 || titleLineCount < 0) {
    throw malformed("DCD title block is invalid");
  }
  const countedTitleBytes = safeNumberSum(
    [4, safeNumberProduct([titleLineCount, 80], "DCD title records")],
    "DCD title records"
  );
  if (titleBytes > budget.maxMetadataBytes || countedTitleBytes > budget.maxMetadataBytes) {
    throw exhausted("DCD title block exceeds maxMetadataBytes");
  }
  let atomCount;
  let firstFrameOffset;
  let mismatchedAtomCount;
  let candidateWithinSource = false;
  for (const payloadBytes of /* @__PURE__ */ new Set([countedTitleBytes, titleBytes])) {
    const titleEnd = 96n + BigInt(payloadBytes);
    if (titleEnd + 16n > source.sizeBytes) {
      continue;
    }
    candidateWithinSource = true;
    const titleAndAtomBlock = dataView(
      await readExact(source, titleEnd, 16, signal, budget)
    );
    if (titleAndAtomBlock.getInt32(0, littleEndian) !== titleBytes || titleAndAtomBlock.getInt32(4, littleEndian) !== 4 || titleAndAtomBlock.getInt32(12, littleEndian) !== 4) {
      continue;
    }
    const candidateAtomCount = titleAndAtomBlock.getInt32(8, littleEndian);
    if (candidateAtomCount !== topologyAtoms) {
      mismatchedAtomCount ??= candidateAtomCount;
      continue;
    }
    if (firstFrameOffset != null) {
      throw malformed("DCD title block has ambiguous authorized atom records");
    }
    atomCount = candidateAtomCount;
    firstFrameOffset = titleEnd + 16n;
  }
  if (atomCount == null || firstFrameOffset == null) {
    if (mismatchedAtomCount != null) {
      assertFrameAtomCount(mismatchedAtomCount, topologyAtoms, budget, "DCD");
    }
    if (!candidateWithinSource) {
      throw truncated("DCD title or atom-count block exceeds retained source bytes");
    }
    throw malformed("DCD title or atom-count block is invalid");
  }
  assertFrameAtomCount(atomCount, topologyAtoms, budget, "DCD");
  const axisBytes = safeNumberProduct([atomCount, 4], "DCD coordinate block");
  const minimumFrameBytes = BigInt(
    safeNumberProduct([axisBytes + 8, 3], "DCD coordinate frame") + (hasCell ? 56 : 0) + (hasFourthDimension ? 8 : 0)
  );
  if (minimumFrameBytes > budget.maxFrameBytes) {
    throw exhausted("DCD coordinate frame exceeds maxFrameBytes");
  }
  let offset = firstFrameOffset;
  const availableFrameBytes = source.sizeBytes - offset;
  if (availableFrameBytes === 0n && declaredFrameCount > 0) {
    throw truncated("DCD contains no retained declared coordinate frames");
  }
  if (!hasFourthDimension && availableFrameBytes % minimumFrameBytes !== 0n) {
    throw truncated("DCD source contains an incomplete coordinate frame");
  }
  const frames = [];
  while (offset < source.sizeBytes) {
    if (frames.length === budget.maxFrames) {
      return partialIndex(frames, offset);
    }
    if (source.sizeBytes - offset < minimumFrameBytes) {
      throw truncated("DCD source contains an incomplete coordinate frame");
    }
    const frameIndex = frames.length;
    const start = offset;
    let cell;
    if (hasCell) {
      const cellBytes = dataView(
        await readExact(source, offset, 56, signal, budget)
      );
      if (cellBytes.getInt32(0, littleEndian) !== 48 || cellBytes.getInt32(52, littleEndian) !== 48) {
        throw malformed("DCD unit-cell block is invalid");
      }
      const a = cellBytes.getFloat64(4, littleEndian);
      const gamma = cellBytes.getFloat64(12, littleEndian);
      const b = cellBytes.getFloat64(20, littleEndian);
      const beta = cellBytes.getFloat64(28, littleEndian);
      const alpha = cellBytes.getFloat64(36, littleEndian);
      const c = cellBytes.getFloat64(44, littleEndian);
      assertFinite([a, b, c, alpha, beta, gamma], "DCD unit cell");
      if (a <= 0 || b <= 0 || c <= 0) {
        throw malformed("DCD periodic-cell lengths must be positive");
      }
      cell = {
        anglesOrCosines: [alpha, beta, gamma],
        lengthsAngstrom: [a, b, c]
      };
      offset += 56n;
    }
    const ranges = [];
    for (const axis of ["x", "y", "z"]) {
      const markers = await readMarkers(
        source,
        offset,
        axisBytes,
        littleEndian,
        signal,
        budget
      );
      if (markers[0] !== axisBytes || markers[1] !== axisBytes) {
        throw malformed("DCD coordinate block is invalid");
      }
      ranges.push({ axis, length: axisBytes, offset: offset + 4n });
      offset += BigInt(axisBytes + 8);
    }
    if (hasFourthDimension) {
      const lead = dataView(
        await readExact(source, offset, 4, signal, budget)
      ).getInt32(0, littleEndian);
      if (lead < 0) {
        throw malformed("DCD fourth-dimension block is invalid");
      }
      const markers = await readMarkers(
        source,
        offset,
        lead,
        littleEndian,
        signal,
        budget
      );
      if (markers[0] !== lead || markers[1] !== lead) {
        throw malformed("DCD fourth-dimension block is invalid");
      }
      offset += BigInt(lead + 8);
    }
    const byteLength = offset - start;
    assertFrameSpan(source, start, byteLength, budget, "DCD frame");
    frames.push({
      atomCount,
      byteLength,
      byteOffset: start,
      ...cell == null ? {} : { cell },
      coordinateEncoding: littleEndian ? "float32-le-planar-angstrom" : "float32-be-planar-angstrom",
      coordinateRanges: ranges,
      coordinatesComplete: true,
      frameIndex,
      step: startStep + frameIndex * saveInterval
    });
  }
  return completeIndex(frames, offset);
}
async function indexTrr(source, topologyAtoms, signal, budget) {
  const frames = [];
  let offset = 0n;
  while (offset < source.sizeBytes) {
    if (frames.length === budget.maxFrames) {
      return partialIndex(frames, offset);
    }
    const prefix = dataView(
      await readExact(source, offset, 12, signal, budget)
    );
    if (prefix.getInt32(0, false) !== 1993) {
      throw malformed("TRR frame has an invalid magic number");
    }
    const versionBytes = prefix.getInt32(8, false);
    if (versionBytes < 1 || versionBytes > 256) {
      throw malformed("TRR frame has an invalid version header");
    }
    const sizesOffset = offset + 12n + BigInt(versionBytes);
    const header = dataView(
      await readExact(source, sizesOffset, 52, signal, budget)
    );
    const sizes = Array.from(
      { length: 10 },
      (_value, index) => header.getInt32(index * 4, false)
    );
    if (sizes.some((size) => size < 0)) {
      throw malformed("TRR frame has a negative section size");
    }
    const [
      irBytes,
      energyBytes,
      boxBytes,
      virialBytes,
      pressureBytes,
      topologyBytes,
      symmetryBytes,
      coordinateBytes,
      velocityBytes,
      forceBytes
    ] = sizes;
    if (irBytes !== 0 || energyBytes !== 0 || topologyBytes !== 0 || symmetryBytes !== 0) {
      throw malformed("TRR contains unsupported non-coordinate sections");
    }
    const atomCount = header.getInt32(40, false);
    assertFrameAtomCount(atomCount, topologyAtoms, budget, "TRR");
    const step = header.getInt32(44, false);
    const floatBytes = boxBytes / 9;
    if (floatBytes !== 4 && floatBytes !== 8) {
      throw malformed("TRR frame has invalid precision metadata");
    }
    const vectorBytes = safeNumberProduct(
      [atomCount, 3, floatBytes],
      "TRR vector section"
    );
    for (const [label, bytes] of [
      ["coordinates", coordinateBytes],
      ["velocities", velocityBytes],
      ["forces", forceBytes]
    ]) {
      if (bytes !== 0 && bytes !== vectorBytes) {
        throw malformed(`TRR ${label} size does not match its atom count`);
      }
    }
    const payloadOffset = sizesOffset + 52n;
    const metadataBytes = 2 * floatBytes + boxBytes;
    const metadata = dataView(
      await readExact(source, payloadOffset, metadataBytes, signal, budget)
    );
    const timePicoseconds = floatBytes === 4 ? metadata.getFloat32(0, false) : metadata.getFloat64(0, false);
    if (!Number.isFinite(timePicoseconds)) {
      throw malformed("TRR frame time is not finite");
    }
    const vectors = readCellVectors(
      metadata,
      2 * floatBytes,
      floatBytes,
      false,
      10
    );
    const coordinateOffset = payloadOffset + BigInt(2 * floatBytes + boxBytes + virialBytes + pressureBytes);
    const payloadBytes = safeNumberSum(
      [
        2 * floatBytes,
        boxBytes,
        virialBytes,
        pressureBytes,
        coordinateBytes,
        velocityBytes,
        forceBytes
      ],
      "TRR frame payload"
    );
    const byteLength = payloadOffset + BigInt(payloadBytes) - offset;
    assertFrameSpan(source, offset, byteLength, budget, "TRR frame");
    frames.push({
      atomCount,
      byteLength,
      byteOffset: offset,
      cell: cellFromVectors(vectors),
      coordinateEncoding: floatBytes === 4 ? "float32-be-interleaved-nanometre" : "float64-be-interleaved-nanometre",
      coordinateRanges: coordinateBytes === 0 ? [] : [{ length: coordinateBytes, offset: coordinateOffset }],
      coordinatesComplete: coordinateBytes !== 0,
      frameIndex: frames.length,
      step,
      timePicoseconds
    });
    offset += byteLength;
  }
  return completeIndex(frames, offset);
}
async function indexNetcdf(source, topologyAtoms, signal, budget) {
  const cursor = new NetcdfHeaderCursor(source, signal, budget);
  const signature = await cursor.bytes(4, "NetCDF header");
  if (!bytesEqualAt(signature, 0, [67, 68, 70])) {
    throw malformed("NetCDF CDF signature is missing");
  }
  const version = signature[3];
  if (version !== 1 && version !== 2) {
    throw malformed("NetCDF file version is unsupported");
  }
  const recordCount = await cursor.uint32("NetCDF record count");
  if (recordCount === 4294967295) {
    throw malformed("NetCDF streaming record counts are not supported");
  }
  const dimensions = await readNetcdfDimensions(cursor, budget);
  const recordDimension = dimensions.findIndex(({ size }) => size === 0);
  await readNetcdfAttributes(cursor, budget, "NetCDF global attributes");
  const variables = await readNetcdfVariables(
    cursor,
    dimensions,
    recordDimension,
    version,
    budget
  );
  const coordinates = variables.find(
    (variable) => variable.name.toLowerCase() === "coordinates"
  );
  if (coordinates == null || !coordinates.record) {
    throw malformed(
      "NetCDF trajectory is missing a record coordinates variable"
    );
  }
  if (coordinates.type !== 5 && coordinates.type !== 6) {
    throw malformed("NetCDF coordinates must use float32 or float64 values");
  }
  const atomDimension = coordinates.dimensions.map((id) => dimensions[id]).find((dimension) => /^(?:atom|atoms)$/iu.test(dimension?.name ?? ""));
  if (atomDimension != null && atomDimension.size !== topologyAtoms) {
    throw topologyMismatch(
      "NetCDF atom dimension does not match the selected topology"
    );
  }
  const scalarBytes = netcdfTypeBytes(coordinates.type);
  const minimumCoordinateBytes = safeNumberProduct(
    [topologyAtoms, 3, scalarBytes],
    "NetCDF coordinate frame"
  );
  if (coordinates.size < minimumCoordinateBytes) {
    throw truncated("NetCDF coordinates variable is smaller than the topology");
  }
  const recordVariables = variables.filter(({ record: record2 }) => record2);
  const recordStep = safeNumberSum(
    recordVariables.map(({ size }) => size),
    "NetCDF record step"
  );
  for (const variable of variables) {
    const end = variable.offset + BigInt(variable.size) + (variable.record && recordCount > 0 ? BigInt(recordCount - 1) * BigInt(recordStep) : 0n);
    if (end > source.sizeBytes) {
      throw truncated(
        "NetCDF variable points outside the retained source bytes"
      );
    }
  }
  const time = variables.find(
    (variable) => variable.record && variable.name.toLowerCase() === "time"
  );
  const lengths = variables.find(
    (variable) => variable.record && /^(?:cell_lengths|cell_length)$/iu.test(variable.name)
  );
  const angles = variables.find(
    (variable) => variable.record && /^(?:cell_angles|cell_angle)$/iu.test(variable.name)
  );
  const frames = [];
  const indexedFrameCount = Math.min(recordCount, budget.maxFrames);
  for (let frameIndex = 0; frameIndex < indexedFrameCount; frameIndex += 1) {
    const displacement = BigInt(frameIndex) * BigInt(recordStep);
    const timePicoseconds = time == null ? void 0 : (await readNetcdfValues(
      source,
      time,
      displacement,
      1,
      signal,
      budget
    ))[0];
    const cellLengths = lengths == null ? void 0 : await readNetcdfValues(
      source,
      lengths,
      displacement,
      3,
      signal,
      budget
    );
    const cellAngles = angles == null ? void 0 : await readNetcdfValues(
      source,
      angles,
      displacement,
      3,
      signal,
      budget
    );
    if (timePicoseconds != null && !Number.isFinite(timePicoseconds)) {
      throw malformed("NetCDF trajectory time is not finite");
    }
    if (cellLengths != null) {
      assertFinite(cellLengths, "NetCDF cell lengths");
      if (cellLengths.some((value) => value <= 0)) {
        throw malformed("NetCDF periodic-cell lengths must be positive");
      }
    }
    if (cellAngles != null) {
      assertFinite(cellAngles, "NetCDF cell angles");
    }
    const coordinateOffset = coordinates.offset + displacement;
    const byteLength = BigInt(coordinates.size);
    assertFrameSpan(
      source,
      coordinateOffset,
      byteLength,
      budget,
      "NetCDF coordinate frame"
    );
    frames.push({
      atomCount: topologyAtoms,
      byteLength,
      byteOffset: coordinateOffset,
      ...cellLengths == null ? {} : {
        cell: {
          ...cellAngles == null ? {} : {
            anglesOrCosines: [
              cellAngles[0],
              cellAngles[1],
              cellAngles[2]
            ]
          },
          lengthsAngstrom: [cellLengths[0], cellLengths[1], cellLengths[2]]
        }
      },
      coordinateEncoding: coordinates.type === 5 ? "float32-be-interleaved-angstrom" : "float64-be-interleaved-angstrom",
      coordinateRanges: [
        { length: minimumCoordinateBytes, offset: coordinateOffset }
      ],
      coordinatesComplete: true,
      frameIndex,
      ...timePicoseconds == null ? {} : { timePicoseconds }
    });
  }
  const indexedThroughOffset = indexedFrameCount === 0 ? coordinates.offset : coordinates.offset + BigInt(indexedFrameCount - 1) * BigInt(recordStep) + BigInt(coordinates.size);
  return recordCount > budget.maxFrames ? partialIndex(frames, indexedThroughOffset) : completeIndex(frames, indexedThroughOffset);
}
var NetcdfHeaderCursor = class {
  constructor(source, signal, budget) {
    this.source = source;
    this.signal = signal;
    this.budget = budget;
  }
  source;
  signal;
  budget;
  offset = 0n;
  async bytes(length, label) {
    if (!Number.isSafeInteger(length) || length < 0) {
      throw malformed(`${label} length is invalid`);
    }
    this.assertHeaderBudget(BigInt(length), label);
    const bytes = await readExact(
      this.source,
      this.offset,
      length,
      this.signal,
      this.budget
    );
    this.offset += BigInt(length);
    return bytes;
  }
  async uint32(label) {
    return dataView(await this.bytes(4, label)).getUint32(0, false);
  }
  async name(label) {
    const length = await this.uint32(`${label} length`);
    if (length > this.budget.maxMetadataBytes) {
      throw exhausted(`${label} exceeds maxMetadataBytes`);
    }
    const padded = safeNumberProduct(
      [Math.ceil(length / 4), 4],
      `${label} padded length`
    );
    const bytes = await this.bytes(padded, label);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(0, length)
      );
    } catch {
      throw malformed(`${label} is not valid UTF-8`);
    }
  }
  skip(length, label) {
    if (!Number.isSafeInteger(length) || length < 0) {
      throw malformed(`${label} length is invalid`);
    }
    this.assertHeaderBudget(BigInt(length), label);
    if (this.offset + BigInt(length) > this.source.sizeBytes) {
      throw truncated(`${label} is truncated`);
    }
    this.offset += BigInt(length);
  }
  assertHeaderBudget(length, label) {
    if (this.offset + length > BigInt(this.budget.maxMetadataBytes)) {
      throw exhausted(`${label} exceeds maxMetadataBytes`);
    }
  }
};
async function readNetcdfDimensions(cursor, budget) {
  const count = await readNetcdfListCount(cursor, 10, "NetCDF dimensions");
  assertMetadataCount(count, 24, budget, "NetCDF dimensions");
  const dimensions = [];
  for (let index = 0; index < count; index += 1) {
    dimensions.push({
      name: await cursor.name("NetCDF dimension name"),
      size: await cursor.uint32("NetCDF dimension size")
    });
  }
  return dimensions;
}
async function readNetcdfAttributes(cursor, budget, label) {
  const count = await readNetcdfListCount(cursor, 12, label);
  assertMetadataCount(count, 32, budget, label);
  for (let index = 0; index < count; index += 1) {
    await cursor.name(`${label} name`);
    const type = await cursor.uint32(`${label} type`);
    const values = await cursor.uint32(`${label} element count`);
    const bytes = safeNumberProduct(
      [values, netcdfTypeBytes(type)],
      `${label} payload`
    );
    cursor.skip(
      safeNumberProduct([Math.ceil(bytes / 4), 4], `${label} padded payload`),
      `${label} payload`
    );
  }
}
async function readNetcdfVariables(cursor, dimensions, recordDimension, version, budget) {
  const count = await readNetcdfListCount(cursor, 11, "NetCDF variables");
  assertMetadataCount(count, 48, budget, "NetCDF variables");
  const variables = [];
  for (let index = 0; index < count; index += 1) {
    const name = await cursor.name("NetCDF variable name");
    const dimensionCount = await cursor.uint32(
      "NetCDF variable dimensionality"
    );
    assertMetadataCount(
      dimensionCount,
      8,
      budget,
      "NetCDF variable dimensions"
    );
    const ids = [];
    for (let dimension = 0; dimension < dimensionCount; dimension += 1) {
      const id = await cursor.uint32("NetCDF variable dimension ID");
      if (id >= dimensions.length) {
        throw malformed("NetCDF variable references an unknown dimension");
      }
      ids.push(id);
    }
    await readNetcdfAttributes(cursor, budget, "NetCDF variable attributes");
    const type = await cursor.uint32("NetCDF variable type");
    netcdfTypeBytes(type);
    const size = await cursor.uint32("NetCDF variable size");
    const high = await cursor.uint32("NetCDF variable offset");
    const offset = version === 2 ? BigInt(high) * 4294967296n + BigInt(await cursor.uint32("NetCDF variable offset")) : BigInt(high);
    variables.push({
      dimensions: ids,
      name,
      offset,
      record: ids[0] === recordDimension,
      size,
      type
    });
  }
  return variables;
}
async function readNetcdfListCount(cursor, expectedTag, label) {
  const tag = await cursor.uint32(`${label} tag`);
  const count = await cursor.uint32(`${label} count`);
  if (tag === 0 && count !== 0 || tag !== 0 && tag !== expectedTag) {
    throw malformed(`${label} are malformed`);
  }
  return count;
}
async function readNetcdfValues(source, variable, displacement, count, signal, budget) {
  if (variable.type !== 5 && variable.type !== 6) {
    throw malformed(
      `NetCDF ${variable.name} must use float32 or float64 values`
    );
  }
  const scalarBytes = netcdfTypeBytes(variable.type);
  const bytes = safeNumberProduct(
    [count, scalarBytes],
    "NetCDF metadata values"
  );
  if (bytes > variable.size) {
    throw truncated(`NetCDF ${variable.name} frame is truncated`);
  }
  const view = dataView(
    await readExact(
      source,
      variable.offset + displacement,
      bytes,
      signal,
      budget
    )
  );
  return Array.from(
    { length: count },
    (_value, index) => scalarBytes === 4 ? view.getFloat32(index * scalarBytes, false) : view.getFloat64(index * scalarBytes, false)
  );
}
function netcdfTypeBytes(type) {
  if (!Number.isSafeInteger(type) || type < 1 || type > 6) {
    throw malformed("NetCDF variable type is invalid");
  }
  if (type <= 2) {
    return 1;
  }
  if (type === 3) {
    return 2;
  }
  return type <= 5 ? 4 : 8;
}
function decodeCoordinates(descriptor, parts) {
  const encoding = descriptor.coordinateEncoding;
  const planar = encoding.includes("planar");
  const littleEndian = encoding.includes("-le-");
  const float64 = encoding.startsWith("float64");
  const scalarBytes = float64 ? 8 : 4;
  const scale = encoding.endsWith("nanometre") ? 10 : 1;
  const output = float64 ? new Float64Array(descriptor.atomCount * 3) : new Float32Array(descriptor.atomCount * 3);
  if (planar) {
    if (parts.length !== 3) {
      throw malformed(
        "Planar trajectory frame must contain three coordinate ranges"
      );
    }
    for (const [axisIndex, part] of parts.entries()) {
      if (part.byteLength !== descriptor.atomCount * scalarBytes) {
        throw truncated("Planar trajectory coordinate range is truncated");
      }
      const view = dataView(part);
      for (let atom = 0; atom < descriptor.atomCount; atom += 1) {
        output[atom * 3 + axisIndex] = (float64 ? view.getFloat64(atom * scalarBytes, littleEndian) : view.getFloat32(atom * scalarBytes, littleEndian)) * scale;
      }
    }
  } else {
    if (parts.length !== 1) {
      throw malformed(
        "Interleaved trajectory frame must contain one coordinate range"
      );
    }
    const part = parts[0];
    if (part.byteLength !== descriptor.atomCount * 3 * scalarBytes) {
      throw truncated("Interleaved trajectory coordinate range is truncated");
    }
    const view = dataView(part);
    for (let coordinate = 0; coordinate < output.length; coordinate += 1) {
      output[coordinate] = (float64 ? view.getFloat64(coordinate * scalarBytes, littleEndian) : view.getFloat32(coordinate * scalarBytes, littleEndian)) * scale;
    }
  }
  if (Array.from(output).some((value) => !Number.isFinite(value))) {
    throw malformed("Trajectory frame contains non-finite coordinates");
  }
  return output;
}
function validateDecodedFrame(frame, descriptor, topology) {
  if (frame.index !== descriptor.frameIndex) {
    throw malformed("Trajectory decoder returned a different frame index");
  }
  if (descriptor.atomCount !== topology.atomIds.length) {
    throw topologyMismatch(
      "Trajectory frame atom count does not match topology"
    );
  }
  if (descriptor.timePicoseconds != null && frame.timePicoseconds !== descriptor.timePicoseconds) {
    throw sourceChanged(
      "Trajectory decoder returned inconsistent frame-time metadata"
    );
  }
  const lengths = descriptor.cell?.lengthsAngstrom;
  if (lengths != null && (frame.boxAngstrom == null || lengths.some(
    (length, axis) => Math.abs(length - (frame.boxAngstrom?.[axis] ?? Number.NaN)) > 1e-5
  ))) {
    throw sourceChanged(
      "Trajectory decoder returned inconsistent periodic-cell metadata"
    );
  }
  try {
    validateScientificStructureTrajectoryFrame({ frame, topology });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trajectory frame is invalid";
    if (/topology/iu.test(message)) {
      throw topologyMismatch(message);
    }
    throw malformed(message);
  }
}
function readCellVectors(view, offset, scalarBytes, littleEndian, scale) {
  const values = Array.from(
    { length: 9 },
    (_value, index) => scalarBytes === 4 ? view.getFloat32(offset + index * scalarBytes, littleEndian) * scale : view.getFloat64(offset + index * scalarBytes, littleEndian) * scale
  );
  assertFinite(values, "Trajectory periodic-cell vectors");
  return [
    values[0],
    values[1],
    values[2],
    values[3],
    values[4],
    values[5],
    values[6],
    values[7],
    values[8]
  ];
}
function cellFromVectors(vectors) {
  const lengths = [
    Math.hypot(vectors[0], vectors[1], vectors[2]),
    Math.hypot(vectors[3], vectors[4], vectors[5]),
    Math.hypot(vectors[6], vectors[7], vectors[8])
  ];
  if (lengths.some((length) => length <= 0 || !Number.isFinite(length))) {
    throw malformed(
      "Trajectory periodic-cell vectors must have positive lengths"
    );
  }
  return { lengthsAngstrom: lengths, vectorsAngstrom: vectors };
}
async function readMarkers(source, offset, payloadBytes, littleEndian, signal, budget) {
  if (!Number.isSafeInteger(payloadBytes) || payloadBytes < 0) {
    throw malformed("Trajectory block size is invalid");
  }
  const [lead, trailer] = await Promise.all([
    readExact(source, offset, 4, signal, budget),
    readExact(source, offset + BigInt(payloadBytes) + 4n, 4, signal, budget)
  ]);
  return [
    dataView(lead).getInt32(0, littleEndian),
    dataView(trailer).getInt32(0, littleEndian)
  ];
}
async function assertNotArchive(source, signal, budget) {
  if (source.sizeBytes === 0n) {
    throw truncated("Scientific structure source is empty");
  }
  const prefix = await readExactChunked(
    source,
    0n,
    Number(minBigInt(source.sizeBytes, 8n)),
    signal,
    budget
  );
  const archive = ARCHIVE_SIGNATURES.find(
    ({ bytes }) => bytesEqualAt(prefix, 0, bytes)
  );
  if (archive != null) {
    throw new ScientificStructureBinaryIoError(
      "ARCHIVE_REFUSED",
      `Scientific structure input contains ${archive.label}-compressed or archived data; extract it before opening`
    );
  }
}
async function readExact(source, offset, length, signal, budget) {
  assertNotCancelled(signal);
  if (typeof offset !== "bigint" || offset < 0n || !Number.isSafeInteger(length) || length < 0) {
    throw malformed("Scientific binary range is invalid");
  }
  if (length > budget.maxRangeBytes) {
    throw exhausted("Scientific binary range exceeds maxRangeBytes");
  }
  if (offset + BigInt(length) > source.sizeBytes) {
    throw truncated("Scientific binary range exceeds retained source bytes");
  }
  const bytes = await source.readRange({ length, offset, signal });
  assertNotCancelled(signal);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== length) {
    throw sourceChanged("Scientific binary range returned incomplete bytes");
  }
  return bytes;
}
async function readExactChunked(source, offset, length, signal, budget) {
  const result = new Uint8Array(length);
  let written = 0;
  while (written < length) {
    const bytes = await readExact(
      source,
      offset + BigInt(written),
      Math.min(length - written, budget.maxRangeBytes),
      signal,
      budget
    );
    result.set(bytes, written);
    written += bytes.byteLength;
  }
  return result;
}
async function revalidateSource(source, signal) {
  assertNotCancelled(signal);
  if (source.revalidate == null) {
    return;
  }
  const current = await source.revalidate({ signal });
  assertNotCancelled(signal);
  if (current.sizeBytes !== source.sizeBytes || current.sourceDigest !== source.sourceDigest || current.sourceRevision !== source.sourceRevision) {
    throw sourceChanged(
      "Scientific structure source changed during ranged access"
    );
  }
}
function assertSource(source) {
  if (typeof source.sizeBytes !== "bigint" || source.sizeBytes < 0n || !/^sha256:[\da-f]{64}$/iu.test(source.sourceDigest) || typeof source.sourceRevision !== "string" || source.sourceRevision.length === 0 || source.sourceRevision.length > 512 || hasControlCharacter(source.sourceRevision)) {
    throw malformed("Scientific structure source identity is invalid");
  }
}
function assertFrameAtomCount(atomCount, topologyAtoms, budget, format) {
  if (!Number.isSafeInteger(atomCount) || atomCount < 1) {
    throw malformed(`${format} frame atom count is invalid`);
  }
  if (atomCount > budget.maxAtoms) {
    throw exhausted(`${format} frame exceeds maxAtoms`);
  }
  if (atomCount !== topologyAtoms) {
    throw topologyMismatch(
      `${format} frame atom count does not match topology`
    );
  }
  if (BigInt(atomCount) * 12n > BigInt(budget.maxDecodedFrameBytes)) {
    throw exhausted(
      `${format} decoded coordinate memory exceeds maxDecodedFrameBytes`
    );
  }
}
function assertFrameSpan(source, offset, length, budget, label) {
  if (length < 1n || length > budget.maxFrameBytes) {
    throw exhausted(`${label} exceeds maxFrameBytes`);
  }
  if (offset < 0n || offset + length > source.sizeBytes) {
    throw truncated(`${label} is truncated`);
  }
}
function completeIndex(frames, indexedThroughOffset) {
  return {
    complete: true,
    frameCount: frames.length,
    frames,
    indexedThroughOffset
  };
}
function partialIndex(frames, indexedThroughOffset) {
  return {
    complete: false,
    completenessReason: "FRAME_BUDGET",
    frameCount: frames.length,
    frames,
    indexedThroughOffset
  };
}
function getBudget(input = {}) {
  const budget = { ...SCIENTIFIC_STRUCTURE_BINARY_IO_LIMITS, ...input };
  for (const [name, value] of Object.entries(budget)) {
    if (typeof value === "bigint") {
      if (value < 1n) {
        throw exhausted(`${name} must be positive`);
      }
    } else if (!Number.isSafeInteger(value) || value < 1) {
      throw exhausted(`${name} must be a positive integer`);
    }
  }
  return budget;
}
function safeNumberProduct(values, label) {
  let product = 1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0 && product > Number.MAX_SAFE_INTEGER / value) {
      throw malformed(`${label} declared size is not safe`);
    }
    product *= value;
  }
  return product;
}
function safeNumberSum(values, label) {
  let sum = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || sum > Number.MAX_SAFE_INTEGER - value) {
      throw malformed(`${label} declared size is not safe`);
    }
    sum += value;
  }
  return sum;
}
function assertMetadataCount(count, bytesPerEntry, budget, label) {
  if (safeNumberProduct([count, bytesPerEntry], `${label} memory`) > budget.maxMetadataBytes) {
    throw exhausted(`${label} exceeds maxMetadataBytes`);
  }
}
function assertFinite(values, label) {
  if (values.some((value) => !Number.isFinite(value))) {
    throw malformed(`${label} must contain finite values`);
  }
}
function assertNotCancelled(signal) {
  if (!signal?.aborted) {
    return;
  }
  throw new ScientificStructureBinaryIoError(
    "CANCELLED",
    "Scientific structure binary operation was cancelled"
  );
}
function hasControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}
function bytesEqualAt(data, offset, expected) {
  return offset >= 0 && data.byteLength - offset >= expected.length && expected.every((value, index) => data[offset + index] === value);
}
function dataView(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function minBigInt(left, right) {
  return left < right ? left : right;
}
function exhausted(message) {
  return new ScientificStructureBinaryIoError("RESOURCE_EXHAUSTED", message);
}
function malformed(message) {
  return new ScientificStructureBinaryIoError("MALFORMED_BINARY", message);
}
function sourceChanged(message) {
  return new ScientificStructureBinaryIoError("SOURCE_CHANGED", message);
}
function topologyMismatch(message) {
  return new ScientificStructureBinaryIoError("TOPOLOGY_MISMATCH", message);
}
function truncated(message) {
  return new ScientificStructureBinaryIoError("TRUNCATED", message);
}
var XTC_MAGIC_INTS = new Uint32Array([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  8,
  10,
  12,
  16,
  20,
  25,
  32,
  40,
  50,
  64,
  80,
  101,
  128,
  161,
  203,
  256,
  322,
  406,
  512,
  645,
  812,
  1024,
  1290,
  1625,
  2048,
  2580,
  3250,
  4096,
  5060,
  6501,
  8192,
  10321,
  13003,
  16384,
  20642,
  26007,
  32768,
  41285,
  52015,
  65536,
  82570,
  104031,
  131072,
  165140,
  208063,
  262144,
  330280,
  416127,
  524287,
  660561,
  832255,
  1048576,
  1321122,
  1664510,
  2097152,
  2642245,
  3329021,
  4194304,
  5284491,
  6658042,
  8388607,
  10568983,
  13316085,
  16777216
]);
var MAX_RANGE_BYTES = 64 * 1024;
var MAX_COMPRESSED_FRAME_BYTES = 32 * 1024 * 1024;
var MAX_FRAME_ATOMS = 1e6;
var MAX_TEXT_LINE_BYTES = 1024 * 1024;
var MAX_TEXT_FRAMES = 65536;
var NativeTrajectoryCodecError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "NativeTrajectoryCodecError";
  }
  code;
};
function createScientificStructureNativeTrajectorySource(input) {
  const identity = input.grant.sourceIdentity;
  const identityDigest = createHash("sha256").update("openai.scientific.source-identity-fingerprint.v1\0").update(input.logicalSessionId).update("\0").update(identity.fileId).update("\0").update(input.grant.sourceRevision).update("\0").update(identity.sizeBytes.toString()).digest("hex");
  return {
    sourceDigest: `sha256:${identityDigest}`,
    sourceRevision: input.grant.sourceRevision,
    sizeBytes: identity.sizeBytes,
    readRange: async ({ offset, length, signal }) => {
      input.signal.throwIfAborted();
      const authoritySignal = signal ?? input.signal;
      authoritySignal.throwIfAborted();
      if (offset < 0n || !Number.isSafeInteger(length) || length < 0 || length > MAX_RANGE_BYTES || offset + BigInt(length) > identity.sizeBytes) {
        throw new NativeTrajectoryCodecError(
          "RESOURCE_EXHAUSTED",
          "The authenticated trajectory range exceeds its bounded source"
        );
      }
      const result = await input.readSource({
        grant: input.grant,
        logicalSessionId: input.logicalSessionId,
        offset,
        length,
        signal: authoritySignal
      });
      input.signal.throwIfAborted();
      authoritySignal.throwIfAborted();
      if (result.bytes.byteLength !== length) {
        invalid("The approved trajectory range is truncated");
      }
      return result.bytes;
    }
  };
}
function invalid(message) {
  throw new NativeTrajectoryCodecError("MALFORMED_TRAJECTORY", message);
}
async function readExactBounded(source, offset, length, signal) {
  if (offset < 0n || !Number.isSafeInteger(length) || length < 0 || length > MAX_COMPRESSED_FRAME_BYTES || offset + BigInt(length) > source.sizeBytes) {
    throw new NativeTrajectoryCodecError(
      "RESOURCE_EXHAUSTED",
      "The trajectory range exceeds its authenticated source or frame budget"
    );
  }
  const bytes = new Uint8Array(length);
  for (let cursor = 0; cursor < length; cursor += MAX_RANGE_BYTES) {
    signal?.throwIfAborted();
    const requestLength = Math.min(MAX_RANGE_BYTES, length - cursor);
    const chunk = await source.readRange({
      length: requestLength,
      offset: offset + BigInt(cursor),
      signal
    });
    signal?.throwIfAborted();
    if (chunk.byteLength !== requestLength) {
      invalid("The authenticated trajectory frame is truncated");
    }
    bytes.set(chunk, cursor);
  }
  return bytes;
}
var XtcBitReader = class {
  constructor(bytes) {
    this.bytes = bytes;
  }
  bytes;
  position = 0;
  read(count) {
    if (!Number.isSafeInteger(count) || count < 0 || count > 32) {
      invalid("An XTC packed coordinate uses an invalid bit width");
    }
    if (this.position + count > this.bytes.byteLength * 8) {
      invalid("The XTC compressed coordinate bitstream is truncated");
    }
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      const bit = this.position + index;
      const source = this.bytes[Math.floor(bit / 8)];
      const bitValue = Math.floor(source / 2 ** (7 - bit % 8)) % 2;
      value = value * 2 + bitValue;
    }
    this.position += count;
    return value;
  }
};
function xtcIntegerBits(size) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 4294967296) {
    invalid("An XTC packed coordinate has an invalid integer span");
  }
  let bits = 0;
  let capacity = 1;
  while (size >= capacity && bits < 32) {
    bits += 1;
    capacity *= 2;
  }
  return bits;
}
function xtcCombinedBits(sizes) {
  const bytes = new Uint8Array(32);
  bytes[0] = 1;
  let count = 1;
  for (const size of sizes) {
    let carry = 0;
    for (let index = 0; index < count; index += 1) {
      const product = bytes[index] * size + carry;
      bytes[index] = product % 256;
      carry = Math.floor(product / 256);
    }
    while (carry !== 0) {
      if (count === bytes.byteLength) {
        invalid("An XTC coordinate packing span is too large");
      }
      bytes[count] = carry % 256;
      count += 1;
      carry = Math.floor(carry / 256);
    }
  }
  let highestBits = 0;
  let threshold = 1;
  while (bytes[count - 1] >= threshold) {
    highestBits += 1;
    threshold *= 2;
  }
  return highestBits + (count - 1) * 8;
}
function decodeXtcIntegers(reader, bitCount, sizes) {
  if (bitCount > 256) {
    invalid("The XTC mixed-radix packing exceeds its byte budget");
  }
  const bytes = new Uint8Array(32);
  let remaining = bitCount;
  let count = 0;
  while (remaining > 8) {
    bytes[count] = reader.read(8);
    count += 1;
    remaining -= 8;
  }
  if (remaining > 0) {
    bytes[count] = reader.read(remaining);
    count += 1;
  }
  const values = [0, 0, 0];
  for (let dimension = 2; dimension > 0; dimension -= 1) {
    const divisor = sizes[dimension];
    if (!Number.isSafeInteger(divisor) || divisor < 1) {
      invalid("An XTC mixed-radix divisor is invalid");
    }
    let remainder = 0;
    for (let index = count - 1; index >= 0; index -= 1) {
      const value = remainder * 256 + bytes[index];
      bytes[index] = Math.floor(value / divisor);
      remainder = value % divisor;
    }
    values[dimension] = remainder;
  }
  values[0] = bytes[0] + bytes[1] * 256 + bytes[2] * 65536 + bytes[3] * 16777216;
  return values;
}
async function decodeScientificStructureCompressedXtcFrame({
  descriptor,
  signal,
  source,
  topology
}) {
  if (descriptor.coordinateEncoding !== "xtc-compressed" || descriptor.atomCount <= 9 || descriptor.atomCount > MAX_FRAME_ATOMS || descriptor.atomCount !== topology.atomIds.length || descriptor.coordinateRanges.length !== 1) {
    invalid("The selected XTC descriptor does not authorize compressed atoms");
  }
  const header = await readExactBounded(
    source,
    descriptor.byteOffset,
    92,
    signal
  );
  const view = new DataView(
    header.buffer,
    header.byteOffset,
    header.byteLength
  );
  const count = view.getInt32(52, false);
  const precision = view.getFloat32(56, false);
  const minimum = [
    view.getInt32(60, false),
    view.getInt32(64, false),
    view.getInt32(68, false)
  ];
  const sizes = [
    view.getInt32(72, false) - minimum[0] + 1,
    view.getInt32(76, false) - minimum[1] + 1,
    view.getInt32(80, false) - minimum[2] + 1
  ];
  let smallIndex = view.getInt32(84, false);
  const compressedBytes = view.getInt32(88, false);
  const range = descriptor.coordinateRanges[0];
  if (count !== descriptor.atomCount || !Number.isFinite(precision) || precision <= 0 || sizes.some((size) => !Number.isSafeInteger(size) || size < 1) || smallIndex < 9 || smallIndex >= XTC_MAGIC_INTS.length || compressedBytes < 1 || compressedBytes > MAX_COMPRESSED_FRAME_BYTES || compressedBytes > range.length || range.offset !== descriptor.byteOffset + 92n) {
    invalid("The compressed XTC coordinate metadata is inconsistent");
  }
  const payload = await readExactBounded(
    source,
    range.offset,
    compressedBytes,
    signal
  );
  const reader = new XtcBitReader(payload);
  const separate = sizes.some((size) => size > 16777215);
  const bits = [
    xtcIntegerBits(sizes[0]),
    xtcIntegerBits(sizes[1]),
    xtcIntegerBits(sizes[2])
  ];
  const combined = separate ? 0 : xtcCombinedBits(sizes);
  const coordinates = new Float32Array(count * 3);
  const previous = [0, 0, 0];
  let output = 0;
  let processed = 0;
  let run = 0;
  let smaller = Math.floor(XTC_MAGIC_INTS[Math.max(9, smallIndex - 1)] / 2);
  let smallNumber = Math.floor(XTC_MAGIC_INTS[smallIndex] / 2);
  const append = (values) => {
    if (output >= count) {
      invalid("The XTC coordinate run exceeds the approved topology");
    }
    for (let axis = 0; axis < 3; axis += 1) {
      const coordinate = values[axis] * 10 / precision;
      if (!Number.isFinite(coordinate)) {
        invalid("An XTC coordinate is not finite");
      }
      coordinates[output * 3 + axis] = coordinate;
    }
    output += 1;
  };
  while (processed < count) {
    if (processed % 1024 === 0) {
      signal?.throwIfAborted();
    }
    let current = separate ? [reader.read(bits[0]), reader.read(bits[1]), reader.read(bits[2])] : decodeXtcIntegers(reader, combined, sizes);
    processed += 1;
    for (let axis = 0; axis < 3; axis += 1) {
      current[axis] += minimum[axis];
      previous[axis] = current[axis];
    }
    let adjustment = 0;
    if (reader.read(1) === 1) {
      run = reader.read(5);
      adjustment = run % 3;
      run -= adjustment;
      adjustment -= 1;
    }
    if (run > 0) {
      for (let component = 0; component < run; component += 3) {
        if (processed >= count) {
          invalid("The compressed XTC run exceeds its declared atom count");
        }
        const magic = XTC_MAGIC_INTS[smallIndex];
        current = decodeXtcIntegers(reader, smallIndex, [magic, magic, magic]);
        processed += 1;
        for (let axis = 0; axis < 3; axis += 1) {
          current[axis] += previous[axis] - smallNumber;
        }
        if (component === 0) {
          const swapped = [...current];
          current = [...previous];
          previous[0] = swapped[0];
          previous[1] = swapped[1];
          previous[2] = swapped[2];
          append(previous);
        } else {
          previous[0] = current[0];
          previous[1] = current[1];
          previous[2] = current[2];
        }
        append(current);
      }
    } else {
      append(current);
    }
    smallIndex += adjustment;
    if (smallIndex < 9 || smallIndex >= XTC_MAGIC_INTS.length) {
      invalid("The XTC compressed coordinate scale is outside its safe range");
    }
    if (adjustment < 0) {
      smallNumber = smaller;
      smaller = smallIndex > 9 ? Math.floor(XTC_MAGIC_INTS[smallIndex - 1] / 2) : 0;
    } else if (adjustment > 0) {
      smaller = smallNumber;
      smallNumber = Math.floor(XTC_MAGIC_INTS[smallIndex] / 2);
    }
  }
  if (output !== count) {
    invalid("The XTC decoded coordinate count does not match its topology");
  }
  const lengths = descriptor.cell?.lengthsAngstrom;
  return {
    ...lengths == null ? {} : { boxAngstrom: lengths },
    coordinates,
    index: descriptor.frameIndex,
    ...descriptor.timePicoseconds == null ? {} : { timePicoseconds: descriptor.timePicoseconds },
    topologyDigest: topology.sourceDigest
  };
}
async function* readLammpsLines(input) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = new Uint8Array();
  let cursor = input.offset;
  let lineOffset = input.offset;
  while (cursor < input.end) {
    input.signal?.throwIfAborted();
    const length = Number(
      input.end - cursor > BigInt(MAX_RANGE_BYTES) ? BigInt(MAX_RANGE_BYTES) : input.end - cursor
    );
    const chunk = await input.source.readRange({
      length,
      offset: cursor,
      signal: input.signal
    });
    input.signal?.throwIfAborted();
    if (chunk.byteLength !== length) {
      invalid("The LAMMPS trajectory is truncated");
    }
    const bytes = new Uint8Array(pending.byteLength + chunk.byteLength);
    bytes.set(pending);
    bytes.set(chunk, pending.byteLength);
    let start = 0;
    for (let index = 0; index < bytes.byteLength; index += 1) {
      if (bytes[index] !== 10) {
        continue;
      }
      const line = bytes.subarray(start, index);
      if (line.byteLength > MAX_TEXT_LINE_BYTES) {
        invalid("A LAMMPS trajectory record exceeds its bounded line budget");
      }
      let text;
      try {
        text = decoder.decode(
          line[line.byteLength - 1] === 13 ? line.subarray(0, -1) : line
        );
      } catch {
        invalid("A LAMMPS trajectory record is not valid UTF-8");
      }
      const end = lineOffset + BigInt(index - start + 1);
      yield { end, offset: lineOffset, text };
      lineOffset = end;
      start = index + 1;
    }
    pending = bytes.subarray(start);
    if (pending.byteLength > MAX_TEXT_LINE_BYTES) {
      invalid("A LAMMPS trajectory record exceeds its bounded line budget");
    }
    cursor += BigInt(chunk.byteLength);
  }
  if (pending.byteLength > 0) {
    let text;
    try {
      text = decoder.decode(pending);
    } catch {
      invalid("A LAMMPS trajectory record is not valid UTF-8");
    }
    yield { end: input.end, offset: lineOffset, text };
  }
}
async function requireLammpsLine(iterator, expected) {
  const result = await iterator.next();
  if (result.done || expected != null && result.value.text !== expected) {
    invalid(
      expected == null ? "A LAMMPS trajectory frame ends before its required records" : `A LAMMPS trajectory frame is missing ${expected}`
    );
  }
  return result.value;
}
function parseLammpsPositive(text, field) {
  const value = Number(text.trim());
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_FRAME_ATOMS) {
    invalid(`The LAMMPS ${field} is outside its safe atom budget`);
  }
  return value;
}
async function indexScientificStructureLammpsTrajectory(input) {
  if (input.topology.atomIds.length < 1 || input.topology.atomIds.length > MAX_FRAME_ATOMS) {
    throw new NativeTrajectoryCodecError(
      "TOPOLOGY_MISMATCH",
      "The approved LAMMPS topology is outside its safe atom budget"
    );
  }
  const iterator = readLammpsLines({
    end: input.source.sizeBytes,
    offset: 0n,
    signal: input.signal,
    source: input.source
  });
  const frames = [];
  let next = await iterator.next();
  while (!next.done) {
    input.signal?.throwIfAborted();
    if (frames.length === MAX_TEXT_FRAMES) {
      return {
        atomCount: input.topology.atomIds.length,
        complete: false,
        format: "lammpstrj",
        frameCount: frames.length,
        frames,
        indexedThroughOffset: next.value.offset,
        sourceDigest: input.source.sourceDigest,
        sourceRevision: input.source.sourceRevision,
        sourceSizeBytes: input.source.sizeBytes,
        topologyDigest: input.topology.sourceDigest,
        topologyRevision: input.topology.sourceRevision
      };
    }
    const start = next.value;
    if (start.text !== "ITEM: TIMESTEP") {
      invalid("A LAMMPS trajectory frame must begin with ITEM: TIMESTEP");
    }
    const stepLine = await requireLammpsLine(iterator);
    const step = Number(stepLine.text.trim());
    if (!Number.isSafeInteger(step)) {
      invalid("A LAMMPS trajectory timestep is invalid");
    }
    await requireLammpsLine(iterator, "ITEM: NUMBER OF ATOMS");
    const countLine = await requireLammpsLine(iterator);
    const atomCount = parseLammpsPositive(countLine.text, "atom count");
    if (atomCount !== input.topology.atomIds.length) {
      throw new NativeTrajectoryCodecError(
        "TOPOLOGY_MISMATCH",
        "The LAMMPS frame atom count differs from its approved topology"
      );
    }
    const boundsHeader = await requireLammpsLine(iterator);
    if (!/^ITEM: BOX BOUNDS(?:\s|$)/u.test(boundsHeader.text)) {
      invalid("A LAMMPS frame does not declare orthogonal box bounds");
    }
    if (/\b(?:xy|xz|yz|abc)\b/u.test(boundsHeader.text)) {
      invalid(
        "Tilted LAMMPS cells require an explicitly bounded triclinic decoder"
      );
    }
    const bounds = [];
    for (let axis = 0; axis < 3; axis += 1) {
      const line = await requireLammpsLine(iterator);
      const values = line.text.trim().split(/\s+/u).map(Number);
      if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1]) || values[1] <= values[0]) {
        invalid("A LAMMPS periodic box bound is not finite or ordered");
      }
      bounds.push([values[0], values[1]]);
    }
    const [xBounds, yBounds, zBounds] = bounds;
    if (xBounds == null || yBounds == null || zBounds == null) {
      invalid("A LAMMPS periodic box does not declare all three axes");
    }
    const atomHeader = await requireLammpsLine(iterator);
    if (!atomHeader.text.startsWith("ITEM: ATOMS ")) {
      invalid("A LAMMPS frame does not declare atom coordinate columns");
    }
    const columns = atomHeader.text.slice("ITEM: ATOMS ".length).trim().split(/\s+/u);
    if (!columns.includes("id")) {
      invalid("A LAMMPS trajectory must bind every coordinate to an atom id");
    }
    const coordinateModes = [
      ["x", "y", "z"],
      ["xu", "yu", "zu"],
      ["xs", "ys", "zs"],
      ["xsu", "ysu", "zsu"]
    ];
    if (!coordinateModes.some(
      (mode) => mode.every((column) => columns.includes(column))
    )) {
      invalid("A LAMMPS frame has no complete supported coordinate triplet");
    }
    let end = atomHeader.end;
    for (let atom = 0; atom < atomCount; atom += 1) {
      const line = await requireLammpsLine(iterator);
      if (line.text.startsWith("ITEM: ")) {
        invalid("The LAMMPS atom rows end before the declared atom count");
      }
      end = line.end;
    }
    frames.push({
      atomCount,
      atomLineOffset: atomHeader.end,
      bounds: [xBounds, yBounds, zBounds],
      byteLength: end - start.offset,
      byteOffset: start.offset,
      columns,
      frameIndex: frames.length,
      step
    });
    next = await iterator.next();
  }
  if (frames.length === 0) {
    invalid("The LAMMPS trajectory contains no complete frames");
  }
  return {
    atomCount: input.topology.atomIds.length,
    complete: true,
    format: "lammpstrj",
    frameCount: frames.length,
    frames,
    indexedThroughOffset: input.source.sizeBytes,
    sourceDigest: input.source.sourceDigest,
    sourceRevision: input.source.sourceRevision,
    sourceSizeBytes: input.source.sizeBytes,
    topologyDigest: input.topology.sourceDigest,
    topologyRevision: input.topology.sourceRevision
  };
}
async function readScientificStructureLammpsFrame(input) {
  const descriptor = input.index.frames[input.frameIndex];
  if (descriptor == null || input.index.sourceDigest !== input.source.sourceDigest || input.index.sourceRevision !== input.source.sourceRevision || input.index.sourceSizeBytes !== input.source.sizeBytes || input.index.topologyDigest !== input.topology.sourceDigest || input.index.topologyRevision !== input.topology.sourceRevision || input.index.atomCount !== input.topology.atomIds.length) {
    throw new NativeTrajectoryCodecError(
      "SOURCE_CHANGED",
      "The requested LAMMPS frame is not bound to its current source and topology"
    );
  }
  if (!Number.isSafeInteger(input.atomOffset) || !Number.isSafeInteger(input.atomCount) || input.atomOffset < 0 || input.atomCount < 1 || input.atomOffset + input.atomCount > descriptor.atomCount) {
    throw new NativeTrajectoryCodecError(
      "INVALID_REQUEST",
      "The requested LAMMPS atom window is invalid"
    );
  }
  const idIndex = descriptor.columns.indexOf("id");
  const axes = [
    ["x", "y", "z"],
    ["xu", "yu", "zu"],
    ["xs", "ys", "zs"],
    ["xsu", "ysu", "zsu"]
  ].find((mode) => mode.every((column) => descriptor.columns.includes(column)));
  if (axes == null) {
    invalid("The approved LAMMPS coordinate column set is invalid");
  }
  const scaled = axes[0] === "xs" || axes[0] === "xsu";
  const coordinateColumns = axes.map(
    (axis) => descriptor.columns.indexOf(axis)
  );
  const bytes = new Uint8Array(input.atomCount * 12);
  const view = new DataView(bytes.buffer);
  const selected = /* @__PURE__ */ new Set();
  let seen = 0;
  for await (const line of readLammpsLines({
    end: descriptor.byteOffset + descriptor.byteLength,
    offset: descriptor.atomLineOffset,
    signal: input.signal,
    source: input.source
  })) {
    const fields = line.text.trim().split(/\s+/u);
    const identity = parseLammpsPositive(
      fields[idIndex] ?? "",
      "atom identity"
    );
    if (identity > descriptor.atomCount || selected.has(identity)) {
      invalid(
        "A LAMMPS coordinate identity is duplicated or outside its topology"
      );
    }
    selected.add(identity);
    const target = identity - 1 - input.atomOffset;
    if (target >= 0 && target < input.atomCount) {
      for (let axis = 0; axis < 3; axis += 1) {
        const raw = Number(fields[coordinateColumns[axis]]);
        const bounds = descriptor.bounds[axis];
        const coordinate = scaled ? bounds[0] + raw * (bounds[1] - bounds[0]) : raw;
        if (!Number.isFinite(coordinate)) {
          invalid("A LAMMPS trajectory contains a non-finite coordinate");
        }
        view.setFloat32((target * 3 + axis) * 4, coordinate, true);
      }
    }
    seen += 1;
  }
  if (seen !== descriptor.atomCount || selected.size !== descriptor.atomCount) {
    invalid("A LAMMPS trajectory frame does not cover its complete topology");
  }
  return {
    atomCount: input.atomCount,
    atomOffset: input.atomOffset,
    complete: input.atomOffset === 0 && input.atomCount === descriptor.atomCount,
    coordinates: bytes,
    frameIndex: descriptor.frameIndex,
    frameOffsetDecimal: descriptor.byteOffset.toString(),
    step: descriptor.step,
    topologyAtomCount: descriptor.atomCount
  };
}
async function readScientificStructureNativeTrajectoryWindow(input) {
  const { command, index } = input;
  const first = command.frameIndex ?? command.start ?? 0;
  const defaultEndExclusive = typeof first === "number" ? first + 1 : Number.NaN;
  const endExclusive = input.multiple ? command.endExclusive ?? defaultEndExclusive : defaultEndExclusive;
  const stride = command.stride ?? 1;
  const atomOffset = command.atomOffset ?? 0;
  if (typeof first !== "number" || !Number.isSafeInteger(first) || first < 0 || first >= index.frameCount || typeof endExclusive !== "number" || !Number.isSafeInteger(endExclusive) || endExclusive <= first || endExclusive > index.frameCount || typeof stride !== "number" || !Number.isSafeInteger(stride) || stride < 1 || Math.ceil((endExclusive - first) / stride) > 64 || typeof atomOffset !== "number" || !Number.isSafeInteger(atomOffset) || atomOffset < 0 || atomOffset >= index.atomCount) {
    throw new NativeTrajectoryCodecError(
      "RESOURCE_EXHAUSTED",
      "The requested native trajectory frame or atom window is unsafe"
    );
  }
  const atomCount = command.atomCount ?? Math.min(index.atomCount - atomOffset, 512);
  if (typeof atomCount !== "number" || !Number.isSafeInteger(atomCount) || atomCount < 1 || atomCount > 512 || atomOffset + atomCount > index.atomCount) {
    throw new NativeTrajectoryCodecError(
      "RESOURCE_EXHAUSTED",
      "The requested native trajectory atom window is unsafe"
    );
  }
  const frames = [];
  if (index.format === "lammpstrj") {
    const appendLammpsFrame = async (position) => {
      if (position >= endExclusive) {
        return;
      }
      input.signal.throwIfAborted();
      frames.push(
        await readScientificStructureLammpsFrame({
          index,
          frameIndex: position,
          atomOffset,
          atomCount,
          source: input.source,
          topology: input.topology,
          signal: input.signal
        })
      );
      await appendLammpsFrame(position + stride);
    };
    await appendLammpsFrame(first);
  } else {
    const decoder = input.format === "xtc" && index.atomCount > 9 ? { decodeFrame: decodeScientificStructureCompressedXtcFrame } : void 0;
    const reader = new ScientificStructureBinaryFrameReader({
      ...decoder == null ? {} : { decoder },
      index,
      source: input.source,
      topology: input.topology,
      budget: {
        maxAtoms: MAX_FRAME_ATOMS,
        maxDecodedFrameBytes: MAX_COMPRESSED_FRAME_BYTES,
        maxFrames: 64,
        maxRangeBytes: MAX_RANGE_BYTES
      }
    });
    const result = await reader.readFrames({
      start: first,
      endExclusive,
      stride,
      signal: input.signal
    });
    for (const decoded of result.frames) {
      const descriptor = index.frames[decoded.index];
      if (descriptor == null) {
        invalid("A native trajectory frame has no approved descriptor");
      }
      const coordinates = new Uint8Array(atomCount * 12);
      const view = new DataView(coordinates.buffer);
      for (let atom = 0; atom < atomCount; atom += 1) {
        for (let axis = 0; axis < 3; axis += 1) {
          view.setFloat32(
            (atom * 3 + axis) * 4,
            decoded.coordinates[(atomOffset + atom) * 3 + axis],
            true
          );
        }
      }
      frames.push({
        frameIndex: decoded.index,
        frameOffsetDecimal: descriptor.byteOffset.toString(),
        atomOffset,
        atomCount,
        topologyAtomCount: index.atomCount,
        coordinates,
        complete: atomOffset === 0 && atomCount === index.atomCount,
        ...descriptor.step == null ? {} : { step: descriptor.step }
      });
    }
  }
  return input.multiple ? {
    complete: true,
    frames,
    indexComplete: index.complete,
    sampledFrameCount: frames.length,
    sourceFrameCount: index.frameCount,
    stride
  } : frames[0];
}
async function countScientificStructureNativeTopologyAtoms(input) {
  const format = input.format === "cif" ? "mmcif" : input.format;
  if (!["pdb", "mmcif", "gro", "xyz", "psf", "prmtop", "top"].includes(format)) {
    throw new NativeTrajectoryCodecError(
      "INVALID_REQUEST",
      "The approved trajectory topology has an unsupported format"
    );
  }
  const requestedModel = input.model ?? 1;
  if (!Number.isSafeInteger(requestedModel) || requestedModel < 1) {
    throw new NativeTrajectoryCodecError(
      "INVALID_REQUEST",
      "The approved trajectory topology model is invalid"
    );
  }
  const iterator = readLammpsLines({
    end: input.source.sizeBytes,
    offset: 0n,
    signal: input.signal,
    source: input.source
  });
  let count = 0;
  let currentModel = 1;
  let lineNumber = 0;
  let declared;
  let section = "";
  const atomHeaders = [];
  for await (const line of iterator) {
    input.signal?.throwIfAborted();
    const text = line.text.trim();
    if (format === "pdb") {
      if (/^MODEL\b/u.test(text)) {
        currentModel = Number(text.slice("MODEL".length).trim());
        if (!Number.isSafeInteger(currentModel) || currentModel < 1) {
          invalid("An approved PDB topology model identity is invalid");
        }
      } else if (/^ENDMDL\b/u.test(text) && count > 0) {
        break;
      } else if (currentModel === requestedModel && (line.text.startsWith("ATOM  ") || line.text.startsWith("HETATM"))) {
        count += 1;
      }
    } else if (format === "gro" || format === "xyz") {
      if (format === "gro" && lineNumber === 1 || format === "xyz" && lineNumber === 0) {
        declared = parseLammpsPositive(text, `${format} topology atom count`);
      } else if (declared != null && (format === "gro" && lineNumber >= 2 || format === "xyz" && lineNumber >= 2)) {
        if (!text) {
          invalid(`An approved ${format} topology atom record is empty`);
        }
        count += 1;
        if (count === declared) {
          break;
        }
      }
      lineNumber += 1;
    } else if (format === "psf") {
      if (declared == null) {
        const match = /^(\d+)\s+!NATOM\b/u.exec(text);
        if (match != null) {
          declared = parseLammpsPositive(match[1], "PSF topology atom count");
        }
      } else if (text) {
        const fields = text.split(/\s+/u);
        if (fields.length < 6 || Number(fields[0]) !== count + 1) {
          invalid(
            "An approved PSF topology atom identity or record is invalid"
          );
        }
        count += 1;
        if (count === declared) {
          break;
        }
      }
    } else if (format === "prmtop") {
      if (text.startsWith("%FLAG ")) {
        if (section === "ATOM_NAME" && count > 0) {
          break;
        }
        section = text.slice("%FLAG ".length).trim();
      } else if (!text.startsWith("%FORMAT") && text) {
        if (section === "POINTERS" && declared == null) {
          declared = parseLammpsPositive(
            text.split(/\s+/u)[0],
            "PRMTOP topology atom count"
          );
        } else if (section === "ATOM_NAME" && declared != null) {
          const width = 4;
          for (let offset = 0; offset < line.text.length; offset += width) {
            if (line.text.slice(offset, offset + width).trim()) {
              count += 1;
            }
          }
          if (count >= declared) {
            break;
          }
        }
      }
    } else if (format === "top") {
      if (text.startsWith("#include")) {
        invalid(
          "A GROMACS topology include requires its own approved companion grant"
        );
      }
      const match = /^\[\s*([^\]]+)\s*\]/u.exec(text);
      if (match != null) {
        if (section === "atoms" && count > 0) {
          break;
        }
        section = match[1].trim().toLowerCase();
      } else if (section === "atoms" && text && !text.startsWith(";")) {
        const fields = text.split(/\s+/u);
        if (fields.length < 5 || Number(fields[0]) !== count + 1) {
          invalid("A GROMACS topology atom record is incomplete or unordered");
        }
        count += 1;
      }
    } else if (format === "mmcif") {
      if (text === "loop_" || /^data_/iu.test(text) || text.startsWith("#")) {
        if (count > 0) {
          break;
        }
        atomHeaders.length = 0;
      } else if (text.startsWith("_atom_site.")) {
        if (atomHeaders.length >= 256) {
          invalid("An mmCIF topology exceeds its atom-site header budget");
        }
        atomHeaders.push(text.toLowerCase());
      } else if (text.startsWith("_")) {
        if (count > 0) {
          break;
        }
        atomHeaders.length = 0;
      } else if (text && atomHeaders.length > 0) {
        const fields = text.match(/(?:"[^"]*"|'[^']*'|\S+)/gu) ?? [];
        if (fields.length < atomHeaders.length) {
          invalid("An approved mmCIF topology atom row is incomplete");
        }
        const modelIndex = atomHeaders.indexOf("_atom_site.pdbx_pdb_model_num");
        const model = modelIndex < 0 ? 1 : Number(fields[modelIndex]);
        if (model === requestedModel) {
          count += 1;
        } else if (count > 0) {
          break;
        }
      }
    }
    if (count > MAX_FRAME_ATOMS) {
      throw new NativeTrajectoryCodecError(
        "RESOURCE_EXHAUSTED",
        "The approved trajectory topology exceeds one million atoms"
      );
    }
  }
  if (count < 1 || declared != null && count !== declared) {
    throw new NativeTrajectoryCodecError(
      "TOPOLOGY_MISMATCH",
      "The approved topology atom section is missing, truncated, or inconsistent"
    );
  }
  return count;
}
async function readScientificStructureNativeTopologyPage(input) {
  const format = input.format === "cif" ? "mmcif" : input.format;
  if (!["pdb", "mmcif", "gro", "xyz", "psf", "prmtop", "top"].includes(format)) {
    throw new NativeTrajectoryCodecError(
      "INVALID_REQUEST",
      "Unsupported topology page format"
    );
  }
  const offset = input.offset ?? 0n;
  const firstAtom = input.atomOffset ?? 0;
  const limit = input.limit ?? 512;
  if (offset < 0n || offset >= input.source.sizeBytes || !Number.isSafeInteger(firstAtom) || firstAtom < 0 || firstAtom >= MAX_FRAME_ATOMS || !Number.isSafeInteger(limit) || limit < 1 || limit > 512) {
    throw new NativeTrajectoryCodecError(
      "RESOURCE_EXHAUSTED",
      "The topology atom page is unbounded"
    );
  }
  const atoms = [];
  let section = "";
  if (firstAtom > 0) {
    section = format === "prmtop" ? "ATOM_NAME" : "atoms";
  }
  let lineNumber = firstAtom > 0 ? 2 : 0;
  let declared;
  let model = 1;
  const headers = [];
  let lastEnd = offset;
  for await (const line of readLammpsLines({
    end: input.source.sizeBytes,
    offset,
    signal: input.signal,
    source: input.source
  })) {
    lastEnd = line.end;
    const text = line.text.trim();
    let candidates = [];
    if (format === "pdb") {
      if (/^MODEL\b/u.test(text)) {
        model = Number(text.slice("MODEL".length).trim());
      }
      if (line.text.startsWith("ATOM  ") || line.text.startsWith("HETATM")) {
        candidates = [
          {
            atomName: line.text.slice(12, 16).trim(),
            chainId: line.text.slice(21, 22).trim(),
            residueName: line.text.slice(17, 20).trim(),
            residueNumber: Number(line.text.slice(22, 26).trim()),
            x: Number(line.text.slice(30, 38).trim()),
            y: Number(line.text.slice(38, 46).trim()),
            z: Number(line.text.slice(46, 54).trim())
          }
        ];
      }
    } else if (format === "psf") {
      if (section !== "atoms") {
        const match = /^(\d+)\s+!NATOM\b/u.exec(text);
        if (match != null) {
          declared = parseLammpsPositive(match[1], "PSF topology atom count");
          section = "atoms";
        }
      } else if (text) {
        const fields = text.split(/\s+/u);
        if (fields.length < 6) {
          invalid("An approved PSF topology atom record is incomplete");
        }
        candidates = [
          {
            atomName: fields[4],
            chainId: fields[1],
            residueName: fields[3],
            residueNumber: Number(fields[2])
          }
        ];
      }
    } else if (format === "prmtop") {
      if (text.startsWith("%FLAG ")) {
        section = text.slice("%FLAG ".length).trim();
      } else if (section === "ATOM_NAME" && !text.startsWith("%FORMAT")) {
        for (let position = 0; position < line.text.length; position += 4) {
          const atomName = line.text.slice(position, position + 4).trim();
          if (atomName) {
            candidates.push({ atomName });
          }
        }
      }
    } else if (format === "top") {
      const match = /^\[\s*([^\]]+)\s*\]/u.exec(text);
      if (match != null) {
        section = match[1].trim().toLowerCase();
      } else if (section === "atoms" && text && !text.startsWith(";")) {
        const fields = text.split(/\s+/u);
        if (fields.length < 5) {
          invalid("An approved GROMACS topology atom record is incomplete");
        }
        candidates = [
          {
            atomName: fields[4],
            residueName: fields[3],
            residueNumber: Number(fields[2])
          }
        ];
      }
    } else if (format === "gro") {
      if (lineNumber === 1) {
        declared = parseLammpsPositive(text, "GRO topology atom count");
      } else if (lineNumber >= 2 && (declared == null || firstAtom + atoms.length < declared)) {
        candidates = [
          {
            atomName: line.text.slice(10, 15).trim(),
            residueName: line.text.slice(5, 10).trim(),
            residueNumber: Number(line.text.slice(0, 5).trim()),
            x: Number(line.text.slice(20, 28).trim()) * 10,
            y: Number(line.text.slice(28, 36).trim()) * 10,
            z: Number(line.text.slice(36, 44).trim()) * 10
          }
        ];
      }
      lineNumber += 1;
    } else if (format === "xyz") {
      if (lineNumber === 0) {
        declared = parseLammpsPositive(text, "XYZ topology atom count");
      } else if (lineNumber >= 2 && (declared == null || firstAtom + atoms.length < declared)) {
        const fields = text.split(/\s+/u);
        candidates = [
          {
            atomName: fields[0],
            x: Number(fields[1]),
            y: Number(fields[2]),
            z: Number(fields[3])
          }
        ];
      }
      lineNumber += 1;
    } else if (format === "mmcif") {
      if (text.startsWith("_atom_site.")) {
        headers.push(text.toLowerCase());
      } else if (text && headers.length > 0 && !text.startsWith("#")) {
        const fields = text.match(/(?:"[^"]*"|'[^']*'|\S+)/gu) ?? [];
        const get = (name) => {
          const index = headers.indexOf(`_atom_site.${name}`);
          return index < 0 ? void 0 : fields[index];
        };
        candidates = [
          {
            atomName: get("auth_atom_id") ?? get("label_atom_id") ?? get("id") ?? "",
            chainId: get("auth_asym_id") ?? get("label_asym_id"),
            residueName: get("auth_comp_id") ?? get("label_comp_id"),
            residueNumber: Number(
              get("auth_seq_id") ?? get("label_seq_id") ?? "1"
            ),
            x: Number(get("cartn_x")),
            y: Number(get("cartn_y")),
            z: Number(get("cartn_z"))
          }
        ];
        model = Number(get("pdbx_pdb_model_num") ?? "1");
      }
    }
    for (const candidate of candidates) {
      if (!candidate.atomName || !Number.isSafeInteger(model) || candidate.residueNumber != null && !Number.isSafeInteger(candidate.residueNumber) || [candidate.x, candidate.y, candidate.z].some(
        (coordinate) => coordinate != null && !Number.isFinite(coordinate)
      )) {
        invalid("An approved topology atom record is malformed");
      }
      const identity = firstAtom + atoms.length + 1;
      atoms.push({ ...candidate, atomId: `${model}:${identity}`, model });
      if (atoms.length === limit || declared != null && identity === declared) {
        return {
          atomOffset: firstAtom,
          atoms,
          complete: declared != null ? identity === declared : lastEnd === input.source.sizeBytes,
          ...declared != null && identity === declared ? {} : { nextAtomOffset: identity, nextOffset: lastEnd },
          offset
        };
      }
    }
  }
  return { atomOffset: firstAtom, atoms, complete: true, offset };
}

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-native-volume.mjs
var MAX_RANGE_BYTES2 = 256 * 1024;
var MAX_HEADER_BYTES = 4 * 1024 * 1024;
var MAX_HEADER_LINE_BYTES = 256 * 1024;
var MAX_REGION_VALUES = MAX_RANGE_BYTES2 / Float32Array.BYTES_PER_ELEMENT;
var MAX_REGION_READS = 4096;
var MAX_TEXT_SCAN_BYTES = 64n * 1024n * 1024n;
var HEADER_CHUNK_BYTES = 16 * 1024;
var NUMBER_TOKEN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[de][+-]?\d+)?$/iu;
var DECIMAL = /^(0|[1-9]\d*)$/u;
var BOHR_TO_ANGSTROM = 0.529177210859;
var BRIX_NUMBER = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[de][+-]?\\d+)?";
var BRIX_HEADER = new RegExp(
  `^\\s*:-\\)\\s+origin\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+extent\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+grid\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+([+-]?\\d+)\\s+cell\\s+(${BRIX_NUMBER})\\s+(${BRIX_NUMBER})\\s+(${BRIX_NUMBER})\\s+(${BRIX_NUMBER})\\s+(${BRIX_NUMBER})\\s+(${BRIX_NUMBER})\\s+prod\\s+(${BRIX_NUMBER})\\s+plus\\s+([+-]?\\d+)`,
  "iu"
);
async function indexScientificStructureNativeVolume(input) {
  const { grant, logicalSessionId, signal } = input;
  assertGrant(grant, logicalSessionId);
  signal.throwIfAborted();
  const format = normalizeFormat(input.format);
  const sizeBytes = grant.sourceIdentity.sizeBytes;
  let parsed;
  if (format === "ccp4") {
    parsed = parseMrcHeader(await readExact2(input, 0n, 1024));
  } else if (format === "dsn6") {
    parsed = parseDsn6Header(await readExact2(input, 0n, 512));
  } else if (format === "cube" || format === "dx") {
    parsed = await indexTextVolume(input, format);
  } else {
    parsed = await indexDensityServer(input);
  }
  const dataOffset = BigInt(parsed.dataOffsetDecimal);
  const payloadBytesDecimal = "payloadBytesDecimal" in parsed ? parsed.payloadBytesDecimal : void 0;
  if (dataOffset > sizeBytes || payloadBytesDecimal != null && dataOffset + BigInt(payloadBytesDecimal) > sizeBytes) {
    fail2("TRUNCATED", "Scientific density-map payload is truncated");
  }
  return Object.freeze({
    ...parsed,
    format,
    viewerSessionId: logicalSessionId,
    sourceGrantId: grant.grantId,
    sourceHandleId: grant.sourceHandleId,
    sourceRevision: grant.sourceRevision,
    sourceSizeBytesDecimal: sizeBytes.toString(),
    unit: "density",
    maxTileBytes: MAX_RANGE_BYTES2
  });
}
async function readScientificStructureNativeVolumeTile(input) {
  const { grant, index, logicalSessionId, signal } = input;
  assertGrant(grant, logicalSessionId);
  signal.throwIfAborted();
  if (index.viewerSessionId !== logicalSessionId || index.sourceGrantId !== grant.grantId || index.sourceHandleId !== grant.sourceHandleId || index.sourceRevision !== grant.sourceRevision || index.sourceSizeBytesDecimal !== grant.sourceIdentity.sizeBytes.toString()) {
    fail2("SOURCE_CHANGED", "The indexed density map is no longer authorized");
  }
  if (input.region != null) {
    return readVolumeRegion(input);
  }
  const offsetText = input.offsetDecimal ?? "0";
  if (typeof offsetText !== "string" || !DECIMAL.test(offsetText)) {
    fail2("INVALID_REQUEST", "The density-map tile offset is invalid");
  }
  const offset = BigInt(offsetText);
  const requestedLength = input.length ?? MAX_RANGE_BYTES2;
  if (!Number.isSafeInteger(requestedLength) || requestedLength < 1 || requestedLength > MAX_RANGE_BYTES2 || offset > grant.sourceIdentity.sizeBytes) {
    fail2("RESOURCE_EXHAUSTED", "The density-map tile exceeds its byte budget");
  }
  const remaining = grant.sourceIdentity.sizeBytes - offset;
  const length = Number(
    remaining < BigInt(requestedLength) ? remaining : BigInt(requestedLength)
  );
  const bytes = length === 0 ? new Uint8Array() : await readExact2(input, offset, length);
  return {
    viewerSessionId: logicalSessionId,
    sourceRevision: grant.sourceRevision,
    format: index.format,
    offsetDecimal: offset.toString(),
    bytes,
    eof: offset + BigInt(bytes.byteLength) === grant.sourceIdentity.sizeBytes
  };
}
function parseMrcHeader(bytes) {
  if (bytes[208] !== 77 || bytes[209] !== 65 || bytes[210] !== 80 || bytes[211] !== 32) {
    fail2("MALFORMED_SOURCE", "CCP4/MRC header is missing the MAP signature");
  }
  let little = null;
  if (bytes[212] === 68 && bytes[213] === 65) {
    little = true;
  } else if (bytes[212] === 17 && bytes[213] === 17) {
    little = false;
  }
  if (little == null) {
    fail2("MALFORMED_SOURCE", "CCP4/MRC machine stamp is not supported");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const mode = view.getInt32(12, little);
  const modeSizes = /* @__PURE__ */ new Map([
    [0, 1],
    [1, 2],
    [2, 4],
    [6, 2],
    [12, 2]
  ]);
  const bytesPerValue = modeSizes.get(mode);
  if (bytesPerValue == null) {
    fail2("UNSUPPORTED", `Unsupported CCP4/MRC voxel mode ${mode}`);
  }
  const storageDimensions = [0, 4, 8].map(
    (offset) => view.getInt32(offset, little)
  );
  const starts = [16, 20, 24].map((offset) => view.getInt32(offset, little));
  const gridSampling = [28, 32, 36].map(
    (offset) => view.getInt32(offset, little)
  );
  const cellDimensions = [40, 44, 48].map(
    (offset) => view.getFloat32(offset, little)
  );
  const cellAngles = [52, 56, 60].map(
    (offset) => view.getFloat32(offset, little)
  );
  const axisOrder = [64, 68, 72].map(
    (offset) => view.getInt32(offset, little) - 1
  );
  if (storageDimensions.some((value) => value < 1) || gridSampling.some((value) => value < 1) || axisOrder.some((axis) => axis < 0 || axis > 2) || new Set(axisOrder).size !== 3) {
    fail2("MALFORMED_SOURCE", "CCP4/MRC grid dimensions or axes are invalid");
  }
  validateCell(cellDimensions, cellAngles);
  const symmetryBytes = view.getInt32(92, little);
  if (symmetryBytes < 0) {
    fail2("MALFORMED_SOURCE", "CCP4/MRC symmetry header is invalid");
  }
  const dimensions = [0, 0, 0];
  const logicalStarts = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    dimensions[axisOrder[axis]] = storageDimensions[axis];
    logicalStarts[axisOrder[axis]] = starts[axis];
  }
  const basis = cellBasis(cellDimensions, cellAngles, gridSampling);
  const explicitOrigin = [196, 200, 204].map(
    (offset) => view.getFloat32(offset, little)
  );
  if (explicitOrigin.some((value) => !Number.isFinite(value))) {
    fail2("MALFORMED_SOURCE", "CCP4/MRC Cartesian origin is invalid");
  }
  const origin = explicitOrigin.some((value) => value !== 0) ? explicitOrigin : transformBasis(basis, logicalStarts);
  const voxelTypes = /* @__PURE__ */ new Map([
    [0, "int8"],
    [1, "int16"],
    [2, "float32"],
    [6, "uint16"],
    [12, "float16"]
  ]);
  const voxelType = voxelTypes.get(mode);
  if (voxelType == null) {
    fail2("UNSUPPORTED", `Unsupported CCP4/MRC voxel mode ${mode}`);
  }
  return {
    dimensions,
    storageDimensions,
    axisOrder,
    starts,
    gridSampling,
    cellDimensionsAngstrom: cellDimensions,
    cellAnglesDegrees: cellAngles,
    gridToCartesian: affine(basis, origin),
    dataOffsetDecimal: (1024n + BigInt(symmetryBytes)).toString(),
    payloadBytesDecimal: storageDimensions.reduce((total, value) => total * BigInt(value), BigInt(bytesPerValue)).toString(),
    bytesPerValue,
    mode,
    voxelType,
    endianness: little ? "little" : "big",
    dataLayout: "linear"
  };
}
function parseDsn6Header(bytes) {
  const isBrix = bytes[0] === 58 && bytes[1] === 45 && bytes[2] === 41;
  let starts;
  let dimensions;
  let gridSampling;
  let cellDimensions;
  let cellAngles;
  let divisor;
  let summand;
  let little;
  if (isBrix) {
    const fields = BRIX_HEADER.exec(
      new TextDecoder("ascii").decode(bytes)
    )?.slice(1);
    if (fields == null) {
      fail2("MALFORMED_SOURCE", "BRIX density-map header is malformed");
    }
    const value = (index) => Number(fields[index].replace(/[dD]/gu, "E"));
    starts = [value(0), value(1), value(2)];
    dimensions = [value(3), value(4), value(5)];
    gridSampling = [value(6), value(7), value(8)];
    cellDimensions = [value(9), value(10), value(11)];
    cellAngles = [value(12), value(13), value(14)];
    divisor = value(15);
    summand = value(16);
    little = true;
  } else {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    little = view.getInt16(36, true) === 100;
    if (view.getInt16(36, little) !== 100) {
      fail2("MALFORMED_SOURCE", "DSN6 endian marker is invalid");
    }
    const word = (index) => view.getInt16(index * 2, little);
    const scale = word(17);
    if (scale < 1) {
      fail2("MALFORMED_SOURCE", "DSN6 cell scale is invalid");
    }
    starts = [word(0), word(1), word(2)];
    dimensions = [word(3), word(4), word(5)];
    gridSampling = [word(6), word(7), word(8)];
    cellDimensions = [word(9) / scale, word(10) / scale, word(11) / scale];
    cellAngles = [word(12) / scale, word(13) / scale, word(14) / scale];
    divisor = word(15) / 100;
    summand = word(16);
  }
  if (dimensions.some((value) => !Number.isSafeInteger(value) || value < 1) || gridSampling.some((value) => !Number.isSafeInteger(value) || value < 1) || starts.some((value) => !Number.isSafeInteger(value)) || !Number.isFinite(divisor) || divisor <= 0 || !Number.isSafeInteger(summand)) {
    fail2("MALFORMED_SOURCE", "DSN6/BRIX density-map grid is invalid");
  }
  validateCell(cellDimensions, cellAngles);
  const basis = cellBasis(cellDimensions, cellAngles, gridSampling);
  return {
    dimensions,
    storageDimensions: [...dimensions],
    axisOrder: [0, 1, 2],
    starts,
    gridSampling,
    cellDimensionsAngstrom: cellDimensions,
    cellAnglesDegrees: cellAngles,
    gridToCartesian: affine(basis, transformBasis(basis, starts)),
    dataOffsetDecimal: "512",
    payloadBytesDecimal: dimensions.map((value) => BigInt(Math.ceil(value / 8))).reduce((total, value) => total * value, 512n).toString(),
    bytesPerValue: 1,
    voxelType: "uint8",
    endianness: little ? "little" : "big",
    divisor,
    summand,
    dataLayout: "brick",
    sourceEncoding: isBrix ? "brix" : "dsn6"
  };
}
async function indexTextVolume(input, format) {
  const lines = sourceLines(input, 0n, MAX_HEADER_BYTES);
  const next = async (label) => {
    const line = await lines.next();
    if (line.done) {
      fail2("TRUNCATED", `${format.toUpperCase()} ${label} is truncated`);
    }
    return line.value;
  };
  let dimensions;
  let origin;
  let deltas;
  let dataOffset;
  let scale = 1;
  if (format === "cube") {
    await next("first comment");
    await next("second comment");
    const declaration = await next("atom and origin declaration");
    const fields = splitNumeric(declaration.value);
    if (fields.length < 4 || fields.length > 5 || !/^[+-]?\d+$/u.test(fields[0])) {
      fail2("MALFORMED_SOURCE", "CUBE atom and origin declaration is invalid");
    }
    const rawAtoms = Number(fields[0]);
    if (!Number.isSafeInteger(rawAtoms) || Math.abs(rawAtoms) > 1e6) {
      fail2("RESOURCE_EXHAUSTED", "CUBE atom declarations exceed their budget");
    }
    if (fields[4] != null && fields[4] !== "1") {
      fail2("UNSUPPORTED", "Multiple CUBE density datasets are unsupported");
    }
    origin = numericVector(fields.slice(1, 4));
    dimensions = [];
    deltas = [];
    let negativeAxes = 0;
    for await (const row of orderedSourceLines(next, 3, "axis")) {
      const axisFields = splitNumeric(row.value);
      const count = Number(axisFields[0]);
      if (axisFields.length !== 4 || !Number.isSafeInteger(count) || count === 0) {
        fail2("MALFORMED_SOURCE", "CUBE axis declaration is invalid");
      }
      negativeAxes += count < 0 ? 1 : 0;
      dimensions.push(Math.abs(count));
      deltas.push(numericVector(axisFields.slice(1)));
      dataOffset = row.end;
    }
    if (negativeAxes !== 0 && negativeAxes !== 3) {
      fail2("MALFORMED_SOURCE", "CUBE axes mix incompatible coordinate units");
    }
    scale = negativeAxes === 3 ? 1 : BOHR_TO_ANGSTROM;
    for await (const row of orderedSourceLines(
      next,
      Math.abs(rawAtoms),
      "atom"
    )) {
      const atomFields = splitNumeric(row.value);
      if (atomFields.length !== 5 || !/^[+-]?\d+$/u.test(atomFields[0])) {
        fail2("MALFORMED_SOURCE", "CUBE atom declaration is invalid");
      }
      for (const field of atomFields.slice(1)) {
        numeric(field);
      }
      dataOffset = row.end;
    }
    if (rawAtoms < 0) {
      const orbitals = await next("orbital declaration");
      const orbitalFields = splitNumeric(orbitals.value);
      if (orbitalFields.length !== 2 || orbitalFields[0] !== "1") {
        fail2("UNSUPPORTED", "Multiple CUBE orbitals are unsupported");
      }
      dataOffset = orbitals.end;
    }
  } else {
    let connections;
    deltas = [];
    let hasScalarArray = false;
    for await (const row of lines) {
      const line = row.value.replace(/#.*/u, "").trim();
      if (line.length === 0) {
        continue;
      }
      if (/^object\s+\S+\s+class\s+gridpositions\b/iu.test(line)) {
        dimensions = parseDxCounts(line);
      } else if (/^object\s+\S+\s+class\s+gridconnections\b/iu.test(line)) {
        connections = parseDxCounts(line);
      } else if (/^origin\b/iu.test(line)) {
        origin = numericVector(line.split(/\s+/u).slice(1));
      } else if (/^delta\b/iu.test(line)) {
        deltas.push(numericVector(line.split(/\s+/u).slice(1)));
      } else if (/^object\s+\S+\s+class\s+array\b/iu.test(line)) {
        const type = /\btype\s+(byte|double|float|int|short)\b/iu.exec(line);
        const rank = /\brank\s+0\b/iu.exec(line);
        const items = /\bitems\s+(\d+)\b/iu.exec(line)?.[1];
        if (type == null || rank == null || items == null || !/\bdata\s+follows\s*$/iu.test(line) || dimensions == null || connections == null || origin == null || deltas.length !== 3 || connections.some((value, axis) => value !== dimensions[axis]) || BigInt(items) !== dimensions.reduce((total, value) => total * BigInt(value), 1n)) {
          fail2("MALFORMED_SOURCE", "OpenDX scalar grid declaration is invalid");
        }
        dataOffset = row.end;
        hasScalarArray = true;
        break;
      } else {
        fail2(
          "MALFORMED_SOURCE",
          "OpenDX contains an unsupported header declaration"
        );
      }
      if (deltas.length > 3) {
        fail2("MALFORMED_SOURCE", "OpenDX has too many coordinate axes");
      }
    }
    if (!hasScalarArray) {
      fail2("TRUNCATED", "DX scalar-array declaration is truncated");
    }
  }
  const scaledDeltas = deltas.map(
    (vector) => vector.map((value) => value * scale)
  );
  const scaledOrigin = origin.map((value) => value * scale);
  return {
    dimensions,
    storageDimensions: [dimensions[2], dimensions[1], dimensions[0]],
    axisOrder: [2, 1, 0],
    gridToCartesian: [
      scaledDeltas[0][0],
      scaledDeltas[1][0],
      scaledDeltas[2][0],
      scaledOrigin[0],
      scaledDeltas[0][1],
      scaledDeltas[1][1],
      scaledDeltas[2][1],
      scaledOrigin[1],
      scaledDeltas[0][2],
      scaledDeltas[1][2],
      scaledDeltas[2][2],
      scaledOrigin[2],
      0,
      0,
      0,
      1
    ],
    dataOffsetDecimal: dataOffset.toString(),
    bytesPerValue: 0,
    voxelType: "text-float",
    endianness: "little",
    dataLayout: "text"
  };
}
async function indexDensityServer(input) {
  const expectsBinary = input.format.toLowerCase().replace(/^\./u, "") === "bcif";
  const maximum = Number(
    input.grant.sourceIdentity.sizeBytes < BigInt(MAX_HEADER_BYTES) ? input.grant.sourceIdentity.sizeBytes : BigInt(MAX_HEADER_BYTES)
  );
  let previous = "";
  let info = false;
  let data = false;
  let binary = false;
  for await (const { offset, bytes } of sourceChunks(input, 0n, maximum)) {
    if (offset === 0n) {
      binary = bytes[0] >= 128 && bytes[0] <= 143;
      if (expectsBinary && !binary) {
        fail2(
          "MALFORMED_SOURCE",
          "The BinaryCIF density-map root is not a MessagePack map"
        );
      }
    }
    const text = previous + new TextDecoder("latin1").decode(bytes);
    info = info || text.includes("_volume_data_3d_info");
    data = data || /_volume_data_3d(?!_info)/u.test(text);
    previous = text.slice(-128);
    if (info && data) {
      return {
        dataOffsetDecimal: "0",
        bytesPerValue: 0,
        voxelType: binary ? "binary-cif" : "density-cif",
        endianness: "little",
        dataLayout: "density-server"
      };
    }
  }
  fail2(
    "UNSUPPORTED",
    "The CIF companion is not an authenticated DensityServer density map"
  );
}
async function readVolumeRegion(input) {
  const { index, region } = input;
  if (index.dimensions == null || index.dataLayout === "density-server") {
    fail2(
      "UNSUPPORTED",
      "DensityServer CIF requires bounded encoded source tiles"
    );
  }
  if (!Array.isArray(region.start) || !Array.isArray(region.size) || region.start.length !== 3 || region.size.length !== 3 || region.start.some((value) => !Number.isSafeInteger(value) || value < 0) || region.size.some((value) => !Number.isSafeInteger(value) || value < 1) || region.start.some(
    (value, axis) => value + region.size[axis] > index.dimensions[axis]
  )) {
    fail2("INVALID_REQUEST", "The density-map region is outside its voxel grid");
  }
  const count = region.size.reduce((total, value) => total * value, 1);
  if (!Number.isSafeInteger(count) || count > MAX_REGION_VALUES) {
    fail2(
      "RESOURCE_EXHAUSTED",
      "The density-map region exceeds its voxel budget"
    );
  }
  const values = new Float32Array(count);
  const counters = { reads: 0, bytes: 0n };
  if (index.dataLayout === "linear") {
    await readMrcRegion(input, values, counters);
  } else if (index.dataLayout === "brick") {
    await readDsn6Region(input, values, counters);
  } else {
    await readTextRegion(input, values, counters);
  }
  const bytes = new Uint8Array(
    values.buffer,
    values.byteOffset,
    values.byteLength
  );
  return {
    viewerSessionId: input.logicalSessionId,
    sourceRevision: input.grant.sourceRevision,
    format: index.format,
    offsetDecimal: index.dataOffsetDecimal,
    bytes,
    eof: false,
    region: { start: [...region.start], size: [...region.size] },
    voxelType: "float32",
    values: Array.from(values),
    rangeReads: counters.reads,
    sourceBytesReadDecimal: counters.bytes.toString()
  };
}
async function readMrcRegion(input, output, counters) {
  const { index, region } = input;
  const storageStart = index.axisOrder.map((axis) => region.start[axis]);
  const storageSize = index.axisOrder.map((axis) => region.size[axis]);
  const maxValues = Math.floor(MAX_RANGE_BYTES2 / index.bytesPerValue);
  for await (const {
    bytes,
    storageX,
    storageY,
    storageZ,
    valueCount
  } of mrcRegionRows(input, storageStart, storageSize, maxValues, counters)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let valueIndex = 0; valueIndex < valueCount; valueIndex += 1) {
      const value = decodeMrc(
        view,
        valueIndex * index.bytesPerValue,
        index.mode,
        index.endianness === "little"
      );
      if (!Number.isFinite(value)) {
        fail2("MALFORMED_SOURCE", "The density-map voxel is not finite");
      }
      const logical = [0, 0, 0];
      logical[index.axisOrder[0]] = storageX + valueIndex;
      logical[index.axisOrder[1]] = storageY;
      logical[index.axisOrder[2]] = storageZ;
      output[logical[0] + region.size[0] * (logical[1] + region.size[1] * logical[2])] = value;
    }
  }
}
async function* mrcRegionRows(input, storageStart, storageSize, maxValues, counters) {
  const { index } = input;
  for (let storageZ = 0; storageZ < storageSize[2]; storageZ += 1) {
    for (let storageY = 0; storageY < storageSize[1]; storageY += 1) {
      for (let storageX = 0; storageX < storageSize[0]; storageX += maxValues) {
        const valueCount = Math.min(maxValues, storageSize[0] - storageX);
        const flat = BigInt(storageStart[0] + storageX) + BigInt(index.storageDimensions[0]) * (BigInt(storageStart[1] + storageY) + BigInt(index.storageDimensions[1]) * BigInt(storageStart[2] + storageZ));
        const result = countedRead(
          input,
          BigInt(index.dataOffsetDecimal) + flat * BigInt(index.bytesPerValue),
          valueCount * index.bytesPerValue,
          counters
        );
        yield result.then((bytes) => ({
          bytes,
          storageX,
          storageY,
          storageZ,
          valueCount
        }));
      }
    }
  }
}
async function readDsn6Region(input, output, counters) {
  const { index, region } = input;
  const blocks = index.dimensions.map((value) => Math.ceil(value / 8));
  const first = region.start.map((value) => Math.floor(value / 8));
  const last = region.start.map(
    (value, axis) => Math.floor((value + region.size[axis] - 1) / 8)
  );
  for await (const { bytes, blockX, blockY, blockZ } of dsn6RegionBricks(
    input,
    blocks,
    first,
    last,
    counters
  )) {
    for (let z = 0; z < 8; z += 1) {
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const coordinate = [blockX * 8 + x, blockY * 8 + y, blockZ * 8 + z];
          if (coordinate.some(
            (value2, axis) => value2 < region.start[axis] || value2 >= region.start[axis] + region.size[axis]
          )) {
            continue;
          }
          const brickOffset = x + 8 * (y + 8 * z);
          const encoded = index.endianness === "little" ? brickOffset : brickOffset + (brickOffset % 2 === 0 ? 1 : -1);
          const value = (bytes[encoded] - index.summand) / index.divisor;
          output[coordinate[0] - region.start[0] + region.size[0] * (coordinate[1] - region.start[1] + region.size[1] * (coordinate[2] - region.start[2]))] = value;
        }
      }
    }
  }
}
async function* dsn6RegionBricks(input, blocks, first, last, counters) {
  for (let blockZ = first[2]; blockZ <= last[2]; blockZ += 1) {
    for (let blockY = first[1]; blockY <= last[1]; blockY += 1) {
      for (let blockX = first[0]; blockX <= last[0]; blockX += 1) {
        const flat = BigInt(blockX) + BigInt(blocks[0]) * (BigInt(blockY) + BigInt(blocks[1]) * BigInt(blockZ));
        const result = countedRead(
          input,
          BigInt(input.index.dataOffsetDecimal) + flat * 512n,
          512,
          counters
        );
        yield result.then((bytes) => ({ bytes, blockX, blockY, blockZ }));
      }
    }
  }
}
async function readTextRegion(input, output, counters) {
  const { index, region } = input;
  const wanted = /* @__PURE__ */ new Map();
  for (let x = 0; x < region.size[0]; x += 1) {
    for (let y = 0; y < region.size[1]; y += 1) {
      for (let z = 0; z < region.size[2]; z += 1) {
        const absoluteX = BigInt(region.start[0] + x);
        const absoluteY = BigInt(region.start[1] + y);
        const absoluteZ = BigInt(region.start[2] + z);
        const sourcePosition = absoluteZ + BigInt(index.dimensions[2]) * (absoluteY + BigInt(index.dimensions[1]) * absoluteX);
        wanted.set(
          sourcePosition,
          x + region.size[0] * (y + region.size[1] * z)
        );
      }
    }
  }
  const maxPosition = Array.from(wanted.keys()).reduce(
    (max, value) => value > max ? value : max,
    0n
  );
  let seen = 0n;
  for await (const line of sourceLines(
    input,
    BigInt(index.dataOffsetDecimal),
    Number(MAX_TEXT_SCAN_BYTES),
    counters
  )) {
    const content = line.value.replace(/#.*/u, "").trim();
    if (content.length === 0) {
      continue;
    }
    for (const token of content.split(/\s+/u)) {
      if (!NUMBER_TOKEN.test(token)) {
        if (index.format === "dx" && /^(?:attribute|component|object)$/iu.test(token)) {
          fail2(
            "TRUNCATED",
            "OpenDX voxel payload ended before the requested region"
          );
        }
        fail2("MALFORMED_SOURCE", "The text density-map voxel is invalid");
      }
      const target = wanted.get(seen);
      if (target != null) {
        output[target] = numeric(token);
      }
      if (seen === maxPosition) {
        return;
      }
      seen += 1n;
    }
  }
  fail2(
    "RESOURCE_EXHAUSTED",
    "The requested text density region exceeds its incremental scan budget"
  );
}
async function* sourceLines(input, offset, budget, counters) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let carry = new Uint8Array();
  let carryOffset = offset;
  let endOffset = offset;
  for await (const { offset: chunkOffset, bytes: chunk } of sourceChunks(
    input,
    offset,
    budget,
    counters
  )) {
    endOffset = chunkOffset + BigInt(chunk.byteLength);
    const joined = new Uint8Array(carry.byteLength + chunk.byteLength);
    joined.set(carry);
    joined.set(chunk, carry.byteLength);
    let lineStart = 0;
    for (let index = 0; index < joined.byteLength; index += 1) {
      if (joined[index] !== 10) {
        continue;
      }
      const line = joined.subarray(lineStart, index);
      if (line.byteLength > MAX_HEADER_LINE_BYTES) {
        fail2("RESOURCE_EXHAUSTED", "A text density-map line exceeds its limit");
      }
      let value;
      try {
        value = decoder.decode(line).replace(/\r$/u, "");
      } catch {
        fail2("MALFORMED_SOURCE", "The density-map source is not valid UTF-8");
      }
      if (value.includes("\0")) {
        fail2("MALFORMED_SOURCE", "The text density map contains a NUL byte");
      }
      yield { value, end: carryOffset + BigInt(index + 1) };
      lineStart = index + 1;
    }
    carry = joined.subarray(lineStart);
    carryOffset += BigInt(lineStart);
    if (carry.byteLength > MAX_HEADER_LINE_BYTES) {
      fail2("RESOURCE_EXHAUSTED", "A text density-map line exceeds its limit");
    }
  }
  if (endOffset - offset >= BigInt(budget) && endOffset < input.grant.sourceIdentity.sizeBytes) {
    fail2(
      "RESOURCE_EXHAUSTED",
      "The text density-map header or scan exceeds its budget"
    );
  }
  if (carry.byteLength > 0) {
    try {
      yield {
        value: decoder.decode(carry).replace(/\r$/u, ""),
        end: endOffset
      };
    } catch {
      fail2("MALFORMED_SOURCE", "The density-map source is not valid UTF-8");
    }
  }
}
async function* sourceChunks(input, start, budget, counters) {
  let offset = start;
  while (offset < input.grant.sourceIdentity.sizeBytes) {
    const available = BigInt(budget) - (offset - start);
    if (available < 1n) {
      return;
    }
    const remaining = input.grant.sourceIdentity.sizeBytes - offset;
    let readable = remaining < available ? remaining : available;
    if (readable > BigInt(HEADER_CHUNK_BYTES)) {
      readable = BigInt(HEADER_CHUNK_BYTES);
    }
    const length = Number(readable);
    const currentOffset = offset;
    const result = counters == null ? readExact2(input, currentOffset, length) : countedRead(input, currentOffset, length, counters);
    yield result.then((bytes) => ({ offset: currentOffset, bytes }));
    offset += BigInt(length);
  }
}
async function* orderedSourceLines(next, count, label) {
  for (let index = 0; index < count; index += 1) {
    yield next(`${label} ${index + 1}`);
  }
}
async function countedRead(input, offset, length, counters) {
  counters.reads += 1;
  counters.bytes += BigInt(length);
  if (counters.reads > MAX_REGION_READS) {
    fail2(
      "RESOURCE_EXHAUSTED",
      "The density-map tile exceeds its range-read budget"
    );
  }
  return readExact2(input, offset, length);
}
async function readExact2(input, offset, length) {
  input.signal.throwIfAborted();
  if (offset < 0n || !Number.isSafeInteger(length) || length < 1 || length > MAX_RANGE_BYTES2 || offset + BigInt(length) > input.grant.sourceIdentity.sizeBytes) {
    fail2(
      "TRUNCATED",
      "The authenticated density-map range is outside its source"
    );
  }
  const result = await input.readSource({
    grant: input.grant,
    logicalSessionId: input.logicalSessionId,
    offset,
    length,
    signal: input.signal
  });
  input.signal.throwIfAborted();
  if (!(result.bytes instanceof Uint8Array) || result.bytes.byteLength !== length) {
    fail2(
      "SOURCE_CHANGED",
      "The authenticated density map returned a short range"
    );
  }
  return result.bytes;
}
function assertGrant(grant, logicalSessionId) {
  if (grant?.family !== "structure" || grant.logicalSessionId !== logicalSessionId || typeof grant.grantId !== "string" || grant.grantId.length === 0 || typeof grant.sourceHandleId !== "string" || grant.sourceHandleId.length === 0 || typeof grant.sourceRevision !== "string" || grant.sourceRevision.length === 0 || grant.sourceIdentity == null || grant.sourceIdentity.etag !== grant.sourceRevision || typeof grant.sourceIdentity.sizeBytes !== "bigint" || grant.sourceIdentity.sizeBytes < 1n || !Array.isArray(grant.operations) || !grant.operations.includes("range-read")) {
    fail2(
      "PERMISSION_DENIED",
      "The density-map companion grant is not authorized"
    );
  }
  if ((grant.sourceAccessPattern ?? grant.sourceIdentity.accessPattern) === "forward-only") {
    fail2(
      "UNSUPPORTED",
      "Density-map companions require authenticated random access"
    );
  }
}
function normalizeFormat(format) {
  if (typeof format !== "string") {
    fail2("UNSUPPORTED", "The density-map format is not supported");
  }
  const normalized = format.toLowerCase().replace(/^\./u, "");
  if (["ccp4", "map", "mrc"].includes(normalized)) {
    return "ccp4";
  }
  if (["dsn6", "brix"].includes(normalized)) {
    return "dsn6";
  }
  if (["cube", "cub"].includes(normalized)) {
    return "cube";
  }
  if (normalized === "dx") {
    return "dx";
  }
  if (["bcif", "cif", "dscif"].includes(normalized)) {
    return "dscif";
  }
  fail2("UNSUPPORTED", `The density-map format ${format} is not supported`);
}
function decodeMrc(view, offset, mode, little) {
  if (mode === 0) {
    return view.getInt8(offset);
  }
  if (mode === 1) {
    return view.getInt16(offset, little);
  }
  if (mode === 2) {
    return view.getFloat32(offset, little);
  }
  if (mode === 6) {
    return view.getUint16(offset, little);
  }
  const bits = view.getUint16(offset, little);
  const sign = bits >= 32768 ? -1 : 1;
  const magnitude = bits % 32768;
  const exponent = Math.floor(magnitude / 1024);
  const fraction = magnitude % 1024;
  if (exponent === 0) {
    return sign * 2 ** -14 * (fraction / 1024);
  }
  if (exponent === 31) {
    return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  }
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}
function splitNumeric(value) {
  return value.trim().split(/\s+/u);
}
function numeric(value) {
  if (typeof value !== "string" || !NUMBER_TOKEN.test(value)) {
    fail2("MALFORMED_SOURCE", "The density-map numeric value is invalid");
  }
  const parsed = Number(value.replace(/[dD]/gu, "E"));
  if (!Number.isFinite(parsed)) {
    fail2("MALFORMED_SOURCE", "The density-map numeric value is not finite");
  }
  return parsed;
}
function numericVector(fields) {
  if (fields.length !== 3) {
    fail2("MALFORMED_SOURCE", "The density-map coordinate vector is invalid");
  }
  return fields.map(numeric);
}
function parseDxCounts(line) {
  const match = /\bcounts\s+([1-9]\d*)\s+([1-9]\d*)\s+([1-9]\d*)\s*$/iu.exec(
    line
  );
  if (match == null) {
    fail2("MALFORMED_SOURCE", "OpenDX grid counts are invalid");
  }
  const counts = match.slice(1).map(Number);
  if (counts.some((value) => !Number.isSafeInteger(value))) {
    fail2("RESOURCE_EXHAUSTED", "OpenDX grid counts exceed their safe range");
  }
  return counts;
}
function validateCell(dimensions, angles) {
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0) || angles.some(
    (value) => !Number.isFinite(value) || value <= 0 || value >= 180
  )) {
    fail2("MALFORMED_SOURCE", "The density-map unit cell is invalid");
  }
}
function cellBasis(dimensions, angles, sampling) {
  const [a, b, c] = dimensions;
  const [alpha, beta, gamma] = angles.map((value) => value * Math.PI / 180);
  const sinGamma = Math.sin(gamma);
  if (Math.abs(sinGamma) < 1e-12) {
    fail2("MALFORMED_SOURCE", "The density-map unit cell is degenerate");
  }
  const cosBeta = Math.cos(beta);
  const cy = (Math.cos(alpha) - cosBeta * Math.cos(gamma)) / sinGamma;
  const cz = 1 - cosBeta ** 2 - cy ** 2;
  if (cz <= 1e-12) {
    fail2("MALFORMED_SOURCE", "The density-map unit cell is degenerate");
  }
  return [
    a / sampling[0],
    b * Math.cos(gamma) / sampling[1],
    c * cosBeta / sampling[2],
    0,
    b * sinGamma / sampling[1],
    c * cy / sampling[2],
    0,
    0,
    c * Math.sqrt(cz) / sampling[2]
  ].map((value) => Math.abs(value) < 1e-12 ? 0 : value);
}
function transformBasis(basis, point) {
  return [
    basis[0] * point[0] + basis[1] * point[1] + basis[2] * point[2],
    basis[3] * point[0] + basis[4] * point[1] + basis[5] * point[2],
    basis[6] * point[0] + basis[7] * point[1] + basis[8] * point[2]
  ];
}
function affine(basis, origin) {
  return [
    basis[0],
    basis[1],
    basis[2],
    origin[0],
    basis[3],
    basis[4],
    basis[5],
    origin[1],
    basis[6],
    basis[7],
    basis[8],
    origin[2],
    0,
    0,
    0,
    1
  ];
}
function fail2(code, message) {
  throw Object.assign(new Error(message), {
    code,
    name: "ScientificStructureNativeVolumeError"
  });
}

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-workspace-integrity.mjs
var WORKSPACE_IDENTITY_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
function isSafeProjectRelativePath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && value.trim() === value && !value.startsWith("/") && !/^[a-z]:/iu.test(value) && !/^[a-z][a-z0-9+.-]*:/iu.test(value) && !value.includes("\\") && !value.includes("\0") && value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}
function verifiedStructureWorkspaceIntegrity(sourceIdentity) {
  const integrity = sourceIdentity.sourceIntegrity;
  if (!isRecord(integrity) || integrity.kind !== "workspace-file-identity-v1" || !isRecord(integrity.identity)) {
    return void 0;
  }
  const identity = integrity.identity;
  if (identity.links !== "1" || ![
    "changedAtNanoseconds",
    "device",
    "inode",
    "modifiedAtNanoseconds",
    "size"
  ].every(
    (field) => typeof identity[field] === "string" && WORKSPACE_IDENTITY_DECIMAL.test(identity[field])
  ) || BigInt(identity.size) !== sourceIdentity.sizeBytes) {
    return void 0;
  }
  return {
    kind: "workspace-file-identity-v1",
    identity: {
      changedAtNanoseconds: identity.changedAtNanoseconds,
      device: identity.device,
      inode: identity.inode,
      links: "1",
      modifiedAtNanoseconds: identity.modifiedAtNanoseconds,
      size: identity.size
    }
  };
}
function sameVerifiedStructureWorkspaceIntegrity(current, expected) {
  if (current == null || expected == null) {
    return current === expected;
  }
  if (!isRecord(current) || !isRecord(expected) || current.kind !== "workspace-file-identity-v1" || expected.kind !== "workspace-file-identity-v1" || !isRecord(current.identity) || !isRecord(expected.identity) || current.identity.links !== "1" || expected.identity.links !== "1") {
    return false;
  }
  const currentIdentity = current.identity;
  const expectedIdentity = expected.identity;
  return [
    "changedAtNanoseconds",
    "device",
    "inode",
    "modifiedAtNanoseconds",
    "size"
  ].every((field) => {
    const currentValue = currentIdentity[field];
    return typeof currentValue === "string" && WORKSPACE_IDENTITY_DECIMAL.test(currentValue) && currentValue === expectedIdentity[field];
  });
}
function isRecord(value) {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-backend-runtime.mjs
var PREVIEW_BYTES = 64 * 1024;
var MAX_SOURCE_RANGE_BYTES = 256 * 1024;
var MAX_QUERY_SCAN_BYTES = 512 * 1024;
var MAX_RESULT_ATOMS = 512;
var MAX_MMCIF_PAGE_BOUNDARIES = 4096;
var MAX_TRAJECTORIES = 16;
var MAX_VALIDATED_TRAJECTORY_FRAMES = 64;
var MAX_TOPOLOGY_RANGE_BYTES = 64 * 1024;
var MAX_TOPOLOGY_SCAN_BYTES = 128 * 1024 * 1024;
var MAX_SESSIONS = 128;
var MAX_ARTIFACT_TRANSACTIONS = 128;
var MAX_ARTIFACT_CHUNK_BYTES = 256 * 1024;
var MAX_PROJECT_HASH_BYTES = 8 * 1024 * 1024;
var MAX_PROJECT_MANIFEST_BYTES = 180 * 1024;
var MAX_PROJECT_DEPENDENCIES = 128;
var MAX_PENDING_COMMANDS = 128;
var MAX_COMMAND_WAITERS = 16;
var MAX_COMMAND_WAIT_MS = 30 * 1e3;
var DECIMAL2 = /^(0|[1-9][0-9]*)$/u;
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
var ARTIFACT_MEMBER_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.-]*)*$/u;
var ARTIFACT_MEMBER_ROLES = /* @__PURE__ */ new Set([
  "data",
  "index",
  "topology",
  "annotation",
  "image",
  "label-mask",
  "probability-map",
  "measurement-table",
  "spatial-matrix",
  "registration",
  "class-dictionary",
  "project",
  "reference-manifest",
  "provenance"
]);
var VIEWER_COMMAND_ACTIONS = /* @__PURE__ */ new Set([
  "add_structure",
  "align_structures",
  "analyze",
  "apply_scene",
  "delete_scene",
  "derive_object",
  "export",
  "focus_ligand",
  "focus_residue",
  "get_state",
  "list_scenes",
  "load_scene",
  "load_structure",
  "load_trajectory",
  "load_volume",
  "measure",
  "measure_residue_distance",
  "query",
  "redo",
  "remove_structure",
  "render_image",
  "render_movie",
  "reset_view",
  "select_chain",
  "select_residue_range",
  "select_residues",
  "set_color",
  "set_display_mode",
  "set_object_visibility",
  "set_representation",
  "set_selection",
  "set_trajectory_state",
  "set_view_options",
  "show_ligand_contacts",
  "transform_object",
  "undo",
  "validate_render"
]);
var PRIVATE_VIEWER_COMMAND_FIELDS = /* @__PURE__ */ new Set([
  "backendGeneration",
  "backendInstanceId",
  "channelId",
  "destinationGrant",
  "destinationGrantId",
  "family",
  "logicalSessionId",
  "resourceUri",
  "sourceGrant",
  "sourceGrantId",
  "sourceHandleId",
  "sourceIdentity",
  "sourceRevision",
  "trajectorySourceGrant",
  "trajectorySourceGrantId",
  "trajectoryRelativePath",
  "trajectoryResources",
  "topologySourceGrant",
  "topologyRelativePath",
  "structureSourceGrant",
  "structureSourceGrants",
  "structureRelativePath",
  "structureResources",
  "volumeSourceGrant",
  "volumeSourceGrants",
  "volumeRelativePath",
  "volumeResources",
  "projectSourceGrant",
  "projectResources"
]);
async function executeScientificStructureTool({
  operation,
  payload,
  sessions,
  identity,
  readSource,
  writeArtifact,
  artifactTransactions,
  now,
  signal
}) {
  signal.throwIfAborted();
  if (!isRecord2(payload) || !isOpaqueIdentity(payload.logicalSessionId)) {
    fail3(
      "INVALID_REQUEST",
      "Structure operations require an owned logical session"
    );
  }
  const logicalSessionId = payload.logicalSessionId;
  const command = isRecord2(payload.payload) ? payload.payload : payload;
  const sourceGrant = validateSourceGrant({
    grant: command.sourceGrant,
    identity,
    logicalSessionId,
    now: now()
  });
  if (operation === "open" || operation === "open_from_chat") {
    return openStructure({
      sessions,
      logicalSessionId,
      grant: sourceGrant,
      command,
      readSource,
      signal,
      exposeInitialGeometry: operation === "open"
    });
  }
  const state = sessions.get(logicalSessionId);
  if (state == null || !isRecord2(state.molecular)) {
    fail3(
      "NOT_FOUND",
      "The Structure source has not been opened in this process"
    );
  }
  if (state.molecular.sourceGrantId !== sourceGrant.grantId || state.molecular.sourceRevision !== sourceGrant.sourceRevision) {
    fail3("SOURCE_CHANGED", "The Structure session source or revision is stale");
  }
  const readMolecularSource = state.molecular.compressedSource == null ? readSource : async ({ grant, offset, length, signal: signal2 }) => {
    if (grant.grantId !== state.molecular.sourceGrantId || grant.sourceRevision !== state.molecular.sourceRevision) {
      fail3(
        "SOURCE_CHANGED",
        "The compressed Structure source or revision is no longer owned"
      );
    }
    const source = state.molecular.compressedSource;
    if (source == null || source.sourceRevision !== grant.sourceRevision) {
      fail3(
        "SOURCE_CHANGED",
        "The compressed Structure decoder is no longer revision-bound"
      );
    }
    return source.readRange({ offset, length, signal: signal2 });
  };
  switch (operation) {
    case "wait_for_command":
      return waitForStructureCommand({
        logicalSessionId,
        state,
        command,
        signal
      });
    case "get_command_control": {
      const result = await getStructureCommandControl({ state, command, signal });
      if (sessions.get(logicalSessionId) !== state) {
        fail3("SOURCE_CHANGED", "The Structure session source or revision is stale");
      }
      validateSourceGrant({
        grant: sourceGrant,
        identity,
        logicalSessionId,
        now: now()
      });
      return result;
    }
    case "complete_command":
      return completeStructureCommand({ state, command });
    case "get_project_context":
      return getStructureProjectContext({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal
      });
    case "project/resolve": {
      const projectGrant = validateSourceGrant({
        grant: command.projectSourceGrant,
        identity,
        logicalSessionId,
        now: now()
      });
      return resolveScientificStructureNativeProject({
        command,
        logicalSessionId,
        primaryGrant: sourceGrant,
        primaryFormat: state.molecular.format,
        projectGrant,
        readSource,
        signal,
        describeSource: ({ grant, format, relativePath }) => verifiedStructureProjectSource({
          logicalSessionId,
          state,
          grant,
          format,
          relativePath,
          readSource,
          signal
        }),
        sameIntegrity: sameVerifiedStructureWorkspaceIntegrity,
        validateGrant: (grant) => validateSourceGrant({
          grant,
          identity,
          logicalSessionId,
          now: now()
        })
      });
    }
    case "resolve_live_project_checkpoint":
      return resolveStructureLiveProjectCheckpoint({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal,
        identity,
        now
      });
    case "export/begin":
    case "export/append":
    case "export/commit":
    case "export/abort":
    case "export/resume":
      return executeStructureArtifactOperation({
        operation,
        logicalSessionId,
        state,
        sourceGrant,
        command,
        identity,
        writeArtifact,
        artifactTransactions,
        now,
        signal
      });
    case "get_state":
    case "list_structures":
      return structureState(logicalSessionId, state);
    case "list_scenes":
      return {
        structuredContent: {
          viewerSessionId: logicalSessionId,
          viewerCommandRevision: state.revision,
          scenes: [...state.molecular.scenes.keys()]
        }
      };
    case "query":
    case "read_atoms":
    case "focus_residue":
    case "focus_ligand":
      if (command.offsetDecimal != null && (state.molecular.compressedSource != null || (sourceGrant.sourceAccessPattern ?? sourceGrant.sourceIdentity.accessPattern) === "forward-only")) {
        fail3(
          "UNSUPPORTED",
          "A forward-only molecular source cannot run positioned atom queries"
        );
      }
      return queryStructure({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource: readMolecularSource,
        signal
      });
    case "read_atoms_page":
      if (state.molecular.compressedSource != null || (sourceGrant.sourceAccessPattern ?? sourceGrant.sourceIdentity.accessPattern) === "forward-only") {
        fail3(
          "UNSUPPORTED",
          "A forward-only molecular source cannot provide random-access atom pages"
        );
      }
      return readStructureAtomPage({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource: readMolecularSource,
        signal
      });
    case "index_trajectory":
      if (state.molecular.compressedSource != null || (sourceGrant.sourceAccessPattern ?? sourceGrant.sourceIdentity.accessPattern) === "forward-only") {
        fail3(
          "UNSUPPORTED",
          "A forward-only molecular topology cannot index random-access trajectories"
        );
      }
      return indexStructureTrajectory({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal,
        identity,
        now
      });
    case "read_trajectory_frame":
    case "read_trajectory_frames":
      return readStructureTrajectory({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal,
        identity,
        now,
        multiple: operation === "read_trajectory_frames"
      });
    case "read_topology_atoms_page":
      return readStructureTopologyPage({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal,
        identity,
        now
      });
    case "index_volume":
      return indexStructureVolume({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal,
        identity,
        now
      });
    case "read_volume_tile":
    case "read_companion_range":
      return readStructureVolume({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal,
        identity,
        now
      });
    case "load_data":
    case "read_range":
    case "read_geometry":
    case "geometry_tile":
      return readStructureGeometry({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource: readMolecularSource,
        signal
      });
    case "measure":
      return measureStructure({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource: readMolecularSource,
        signal
      });
    case "analyze":
    case "ligand_contacts":
    case "show_ligand_contacts":
      return analyzeStructureContacts({
        logicalSessionId,
        state,
        grant: sourceGrant,
        command,
        readSource,
        signal
      });
    case "control_viewer":
    case "set_selection":
    case "apply_scene":
    case "set_object_visibility":
    case "set_trajectory_state":
    case "transform_object":
    case "save_scene":
    case "load_scene":
    case "undo":
    case "redo":
      return mutateStructure({
        logicalSessionId,
        operation,
        state,
        grant: sourceGrant,
        command,
        readSource: readMolecularSource,
        signal,
        identity,
        now
      });
    default:
      fail3("UNSUPPORTED", "The requested Structure operation is not available");
  }
}
function enqueueStructureViewerCommand({ state, command, createdAt, deadlineAt }) {
  if (typeof command.action !== "string" || !VIEWER_COMMAND_ACTIONS.has(command.action)) {
    fail3(
      "UNSUPPORTED",
      "The requested Structure viewer command is unavailable"
    );
  }
  if (state.molecular.commands.size >= MAX_PENDING_COMMANDS) {
    for (const [commandId2, queued] of state.molecular.commands) {
      if (queued.completion != null) {
        state.molecular.commands.delete(commandId2);
      }
      if (state.molecular.commands.size < MAX_PENDING_COMMANDS) {
        break;
      }
    }
  }
  if (state.molecular.commands.size >= MAX_PENDING_COMMANDS) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The Structure viewer command queue is exhausted"
    );
  }
  const commandId = randomUUID();
  const deliveredCommand = {
    ...Object.fromEntries(
      Object.entries(command).filter(
        ([field]) => !PRIVATE_VIEWER_COMMAND_FIELDS.has(field)
      )
    ),
    commandId,
    revision: state.revision,
    createdAt,
    deadlineAt
  };
  let serialized;
  try {
    serialized = JSON.stringify(deliveredCommand);
  } catch {
    fail3(
      "INVALID_REQUEST",
      "The Structure viewer command cannot be serialized"
    );
  }
  if (Buffer2.byteLength(serialized, "utf8") > MAX_SOURCE_RANGE_BYTES) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The Structure viewer command exceeds its bounded budget"
    );
  }
  state.molecular.commands.set(commandId, {
    command: deliveredCommand,
    completionWaiters: /* @__PURE__ */ new Set(),
    cancelRequested: false
  });
  for (const wake of state.molecular.commandWaiters) {
    wake();
  }
  return commandId;
}
async function waitForStructureCommand({ state, command, signal }) {
  if (typeof command.afterRevision !== "number" || !Number.isSafeInteger(command.afterRevision) || command.afterRevision < 0) {
    fail3("INVALID_REQUEST", "The Structure command revision is invalid");
  }
  const timeoutMs = readPositive(
    command.timeoutMs,
    MAX_COMMAND_WAIT_MS,
    "Structure command wait"
  );
  const next = () => {
    const now = Date.now();
    for (const [commandId, queued] of state.molecular.commands) {
      if (typeof queued.command.deadlineAt === "number" && queued.command.deadlineAt <= now && queued.completion == null) {
        state.molecular.commands.delete(commandId);
        continue;
      }
      if (queued.completion == null && typeof queued.command.revision === "number" && queued.command.revision > command.afterRevision) {
        return queued.command;
      }
    }
    return null;
  };
  const immediate = next();
  if (immediate != null) {
    return { structuredContent: { command: immediate } };
  }
  if (state.molecular.commandWaiters.size >= MAX_COMMAND_WAITERS) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The Structure command wait budget is exhausted"
    );
  }
  signal.throwIfAborted();
  await new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      state.molecular.commandWaiters.delete(finish);
      resolve(void 0);
    };
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      state.molecular.commandWaiters.delete(finish);
      reject(
        signal.reason instanceof Error ? signal.reason : new Error("The Structure command wait was aborted")
      );
    };
    const timer = setTimeout(finish, timeoutMs);
    state.molecular.commandWaiters.add(finish);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
    }
  });
  signal.throwIfAborted();
  return { structuredContent: { command: next() } };
}
async function getStructureCommandControl({ state, command, signal }) {
  if (typeof command.commandId !== "string" || !UUID.test(command.commandId)) {
    fail3("INVALID_REQUEST", "The Structure command identity is invalid");
  }
  const queued = state.molecular.commands.get(command.commandId);
  if (queued == null) {
    fail3("NOT_FOUND", "The Structure process does not own that viewer command");
  }
  const waitMs = command.waitMs ?? 0;
  if (typeof waitMs !== "number" || !Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > MAX_COMMAND_WAIT_MS) {
    fail3("INVALID_REQUEST", "The Structure command result wait is invalid");
  }
  const deadlineAt = queued.command.deadlineAt;
  const timeoutMs = Math.min(
    waitMs,
    typeof deadlineAt === "number" ? Math.max(0, deadlineAt - Date.now()) : 0
  );
  if (timeoutMs > 0 && queued.completion == null && !queued.cancelRequested) {
    if (state.molecular.commandWaiters.size >= MAX_COMMAND_WAITERS) {
      fail3("RESOURCE_EXHAUSTED", "The Structure command wait budget is exhausted");
    }
    signal.throwIfAborted();
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        state.molecular.commandWaiters.delete(wake);
        queued.completionWaiters.delete(wake);
      };
      const finish = () => {
        cleanup();
        resolve(void 0);
      };
      const wake = () => {
        if (queued.completion != null || queued.cancelRequested) {
          finish();
        }
      };
      const abort = () => {
        cleanup();
        reject(
          signal.reason instanceof Error ? signal.reason : new Error("The Structure command result wait was aborted")
        );
      };
      const timer = setTimeout(finish, timeoutMs);
      state.molecular.commandWaiters.add(wake);
      queued.completionWaiters.add(wake);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
      }
    });
    signal.throwIfAborted();
  }
  return {
    structuredContent: {
      cancelRequested: queued.cancelRequested,
      ...queued.completion == null ? { completed: false } : { completed: true, result: queued.completion }
    }
  };
}
function completeStructureCommand({ state, command }) {
  if (typeof command.commandId !== "string" || !UUID.test(command.commandId) || typeof command.applied !== "boolean" || typeof command.message !== "string" || command.message.length === 0 || command.message.length > 4096 || command.state != null && !isRecord2(command.state)) {
    fail3("INVALID_REQUEST", "The Structure command completion is invalid");
  }
  const queued = state.molecular.commands.get(command.commandId);
  if (queued == null) {
    fail3("NOT_FOUND", "The Structure process does not own that viewer command");
  }
  const result = {
    applied: command.applied,
    message: command.message,
    ...command.state == null ? {} : { state: command.state }
  };
  let serialized;
  try {
    serialized = JSON.stringify(result);
  } catch {
    fail3(
      "INVALID_REQUEST",
      "The Structure command completion cannot be serialized"
    );
  }
  if (Buffer2.byteLength(serialized, "utf8") > MAX_SOURCE_RANGE_BYTES) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The Structure command completion exceeds its budget"
    );
  }
  if (queued.completion != null) {
    if (JSON.stringify(queued.completion) !== serialized) {
      fail3(
        "CONFLICT",
        "The Structure command already has a different terminal result"
      );
    }
    return {
      structuredContent: {
        completed: true,
        replayed: true,
        result: queued.completion
      }
    };
  }
  queued.completion = result;
  for (const wake of queued.completionWaiters) {
    wake();
  }
  return { structuredContent: { completed: true, replayed: false, result } };
}
async function hashVerifiedStructureProjectRange({
  digest,
  grant,
  logicalSessionId,
  offset,
  readSource,
  signal
}) {
  if (offset >= grant.sourceIdentity.sizeBytes) {
    return;
  }
  signal.throwIfAborted();
  const remaining = grant.sourceIdentity.sizeBytes - offset;
  const length = Number(
    remaining < BigInt(MAX_SOURCE_RANGE_BYTES) ? remaining : BigInt(MAX_SOURCE_RANGE_BYTES)
  );
  const chunk = await readSource({
    grant,
    logicalSessionId,
    offset,
    length,
    signal
  });
  if (chunk.bytes.byteLength === 0 || chunk.bytes.byteLength > length || chunk.eof && offset + BigInt(chunk.bytes.byteLength) !== grant.sourceIdentity.sizeBytes) {
    fail3(
      "SOURCE_CHANGED",
      "The Structure source changed during project verification"
    );
  }
  digest.update(chunk.bytes);
  await hashVerifiedStructureProjectRange({
    digest,
    grant,
    logicalSessionId,
    offset: offset + BigInt(chunk.bytes.byteLength),
    readSource,
    signal
  });
}
async function verifiedStructureProjectSource({
  logicalSessionId,
  state,
  grant,
  format,
  relativePath,
  readSource,
  signal
}) {
  if (!isSafeProjectRelativePath(relativePath) || grant.sourceIdentity.sizeBytes > BigInt(Number.MAX_SAFE_INTEGER) || (grant.sourceSizePolicy ?? grant.sourceIdentity.sizePolicy) === "bounded-unknown") {
    return null;
  }
  const descriptor = {
    byteLength: Number(grant.sourceIdentity.sizeBytes),
    format,
    relativePath
  };
  const sourceIntegrity = verifiedStructureWorkspaceIntegrity(
    grant.sourceIdentity
  );
  if (sourceIntegrity != null) {
    return { ...descriptor, sourceIntegrity };
  }
  if (grant.sourceIdentity.sizeBytes > BigInt(MAX_PROJECT_HASH_BYTES) || (grant.sourceAccessPattern ?? grant.sourceIdentity.accessPattern) === "forward-only") {
    return null;
  }
  let sha256 = state.molecular.projectDigests.get(grant.grantId);
  if (sha256 == null) {
    const digest = createHash2("sha256");
    await hashVerifiedStructureProjectRange({
      digest,
      grant,
      logicalSessionId,
      offset: 0n,
      readSource,
      signal
    });
    sha256 = digest.digest("hex");
    state.molecular.projectDigests.set(grant.grantId, sha256);
  }
  return { ...descriptor, sha256 };
}
async function getStructureProjectContext({
  logicalSessionId,
  state,
  grant,
  command,
  readSource,
  signal
}) {
  signal.throwIfAborted();
  if (!isSafeProjectRelativePath(command.primaryRelativePath) || !isStringArray(command.objectIds) || !isStringArray(command.volumeIds) || command.objectIds.length > MAX_PROJECT_DEPENDENCIES || command.volumeIds.length > MAX_PROJECT_DEPENDENCIES || command.commandId != null && (typeof command.commandId !== "string" || !UUID.test(command.commandId))) {
    fail3("INVALID_REQUEST", "The Structure project context request is invalid");
  }
  const unavailable = {
    structuredContent: {
      available: false,
      message: "The host has not exposed the verified file identity or companion authority required to checkpoint this Structure source."
    }
  };
  const primary = await verifiedStructureProjectSource({
    logicalSessionId,
    state,
    grant,
    format: state.molecular.format,
    relativePath: command.primaryRelativePath,
    readSource,
    signal
  });
  if (primary == null) {
    return unavailable;
  }
  const objectIds = new Set(command.objectIds);
  const projects = [...state.molecular.trajectoryProjects.values()].filter(
    (project) => objectIds.has(project.objectId)
  );
  const secondaryStructures = [...state.molecular.structureProjects.entries()].filter(([objectId]) => objectIds.has(objectId)).map(([objectId, source]) => ({ kind: "structure", objectId, source }));
  if (objectIds.size > projects.length + secondaryStructures.length + 1) {
    return unavailable;
  }
  const volumeIds = new Set(command.volumeIds);
  const volumeSources = [...state.molecular.volumes.values()].flatMap(
    (volume) => {
      const objectId = volume.objectId;
      return typeof objectId === "string" && volumeIds.has(objectId) ? [
        {
          kind: "volume",
          objectId,
          source: {
            format: volume.index.format,
            grant: volume.grant,
            relativePath: volume.relativePath ?? "",
            resourceUri: volume.resourceUri
          }
        }
      ] : [];
    }
  );
  if (volumeSources.length !== volumeIds.size) {
    return unavailable;
  }
  const projectSources = [
    ...secondaryStructures,
    ...volumeSources,
    ...projects.flatMap((project) => [
      {
        kind: "trajectory-topology",
        objectId: project.objectId,
        source: project.topology
      },
      {
        kind: "trajectory-coordinates",
        objectId: project.objectId,
        source: project.coordinates
      }
    ])
  ];
  const initialDependencies = Promise.resolve([]);
  const dependencies = await projectSources.reduce(
    async (pending, { kind, objectId, source }) => {
      const previous = await pending;
      if (previous == null) {
        return null;
      }
      signal.throwIfAborted();
      if (!isRecord2(source)) {
        fail3("INVALID_REQUEST", "The Structure trajectory source is invalid");
      }
      const descriptor = await verifiedStructureProjectSource({
        logicalSessionId,
        state,
        grant: source.grant,
        format: source.format,
        relativePath: source.relativePath,
        readSource,
        signal
      });
      return descriptor == null ? null : [
        ...previous,
        { ...descriptor, id: `${objectId}:${kind}`, kind, objectId }
      ];
    },
    initialDependencies
  );
  if (dependencies == null) {
    return unavailable;
  }
  return {
    structuredContent: { available: true, dependencies, primary }
  };
}
async function resolveStructureLiveProjectCheckpoint(input) {
  const checkpoint = input.command.checkpoint;
  if (!isRecord2(checkpoint) || checkpoint.kind !== "openai.structure-viewer.live-project-checkpoint" || checkpoint.version !== 1 || typeof checkpoint.sessionId !== "string" || !UUID.test(checkpoint.sessionId) || typeof checkpoint.presentationToken !== "string" || !UUID.test(checkpoint.presentationToken) || typeof checkpoint.commandRevision !== "number" || !Number.isSafeInteger(checkpoint.commandRevision) || checkpoint.commandRevision < 0 || !isRecord2(checkpoint.manifest) || checkpoint.manifest.kind !== "openai.structure-viewer.project" || checkpoint.manifest.version !== 1 || !isRecord2(checkpoint.manifest.primary) || !isSafeProjectRelativePath(checkpoint.manifest.primary.relativePath) || !Array.isArray(checkpoint.manifest.dependencies) || checkpoint.manifest.dependencies.length > MAX_PROJECT_DEPENDENCIES) {
    fail3("INVALID_REQUEST", "The Structure live project checkpoint is invalid");
  }
  let serialized;
  try {
    serialized = JSON.stringify(checkpoint.manifest);
  } catch {
    fail3(
      "INVALID_REQUEST",
      "The Structure project checkpoint cannot be serialized"
    );
  }
  if (Buffer2.byteLength(serialized, "utf8") > MAX_PROJECT_MANIFEST_BYTES) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The Structure project checkpoint exceeds its bounded manifest"
    );
  }
  const checkpointDependencies = checkpoint.manifest.dependencies;
  const dependencyIds = /* @__PURE__ */ new Set();
  const trajectoryObjectIds = /* @__PURE__ */ new Set();
  const volumeObjectIds = /* @__PURE__ */ new Set();
  const structureObjectIds = /* @__PURE__ */ new Set();
  let volumeRestorations = Promise.resolve();
  for (const dependency of checkpointDependencies) {
    if (!isRecord2(dependency) || !isOpaqueIdentity(dependency.id) || !isOpaqueIdentity(dependency.objectId) || !isSafeProjectRelativePath(dependency.relativePath) || dependencyIds.has(dependency.id)) {
      fail3(
        "INVALID_REQUEST",
        "The Structure project dependency is invalid or duplicated"
      );
    }
    dependencyIds.add(dependency.id);
    if (dependency.kind !== "trajectory-topology" && dependency.kind !== "trajectory-coordinates" && dependency.kind !== "volume" && dependency.kind !== "structure") {
      return {
        structuredContent: {
          available: true,
          restorable: false,
          repairPlan: [
            {
              code: "unsupported",
              dependencyId: dependency.id,
              label: dependency.relativePath,
              message: "The host has not granted access to this Structure project companion."
            }
          ]
        }
      };
    }
    if (dependency.kind === "volume") {
      volumeObjectIds.add(dependency.objectId);
    } else if (dependency.kind === "structure") {
      structureObjectIds.add(dependency.objectId);
    } else {
      trajectoryObjectIds.add(dependency.objectId);
    }
  }
  for (const dependency of checkpointDependencies) {
    if (!isRecord2(dependency) || dependency.kind !== "volume" && dependency.kind !== "structure") {
      continue;
    }
    const authorized = dependency.kind === "volume" ? input.command.volumeResources : input.command.structureResources;
    const resource = Array.isArray(authorized) ? authorized.find(
      (candidate) => isRecord2(candidate) && candidate.id === dependency.id
    ) : void 0;
    if (!isRecord2(resource) || !isStructureProjectResourceUri(resource.resourceUri) || typeof dependency.relativePath !== "string" || resource.name !== dependency.relativePath.split("/").at(-1) || typeof dependency.format !== "string") {
      return {
        structuredContent: {
          available: true,
          restorable: false,
          repairPlan: [
            {
              code: "missing",
              dependencyId: dependency.id,
              label: dependency.relativePath,
              message: "The host has not restored this approved Structure companion."
            }
          ]
        }
      };
    }
    const sealedGrants = dependency.kind === "volume" ? input.command.volumeSourceGrants : input.command.structureSourceGrants;
    const sealed = Array.isArray(sealedGrants) ? sealedGrants.find(
      (candidate) => isRecord2(candidate) && candidate.resourceUri === resource.resourceUri
    ) : void 0;
    const fallbackGrant = dependency.kind === "volume" ? input.command.volumeSourceGrant : input.command.structureSourceGrant;
    const grant = validateSourceGrant({
      grant: isRecord2(sealed) && sealed.grant != null ? sealed.grant : fallbackGrant,
      identity: input.identity,
      logicalSessionId: input.logicalSessionId,
      now: input.now()
    });
    if (dependency.kind === "volume") {
      volumeRestorations = volumeRestorations.then(
        () => indexStructureVolume({
          ...input,
          command: {
            resourceUri: resource.resourceUri,
            relativePath: dependency.relativePath,
            format: dependency.format,
            volumeSourceGrant: grant
          }
        })
      ).then(() => {
        const restored = input.state.molecular.volumes.get(
          resource.resourceUri
        );
        if (restored != null && typeof dependency.objectId === "string") {
          restored.objectId = dependency.objectId;
        }
      });
    } else if (typeof dependency.objectId === "string") {
      input.state.molecular.structureProjects.set(dependency.objectId, {
        format: dependency.format,
        grant,
        relativePath: dependency.relativePath,
        resourceUri: resource.resourceUri
      });
    }
  }
  await volumeRestorations;
  for (const objectId of trajectoryObjectIds) {
    if (input.state.molecular.trajectoryProjects.has(objectId)) {
      continue;
    }
    const topology = checkpointDependencies.find(
      (dependency) => isRecord2(dependency) && dependency.objectId === objectId && dependency.kind === "trajectory-topology"
    );
    const coordinates = checkpointDependencies.find(
      (dependency) => isRecord2(dependency) && dependency.objectId === objectId && dependency.kind === "trajectory-coordinates"
    );
    const authorizedResources = input.command.trajectoryResources;
    if (!isRecord2(topology) || !isRecord2(coordinates) || !Array.isArray(authorizedResources)) {
      return {
        structuredContent: {
          available: true,
          restorable: false,
          repairPlan: [
            {
              code: "missing",
              dependencyId: `${objectId}:trajectory-coordinates`,
              label: isRecord2(coordinates) && typeof coordinates.relativePath === "string" ? coordinates.relativePath : objectId,
              message: "The host has not restored both authorized molecular trajectory sources."
            }
          ]
        }
      };
    }
    const topologyResource = authorizedResources.find(
      (resource) => isRecord2(resource) && resource.id === topology.id
    );
    const coordinateResource = authorizedResources.find(
      (resource) => isRecord2(resource) && resource.id === coordinates.id
    );
    if (!isRecord2(topologyResource) || !isRecord2(coordinateResource) || !isStructureProjectResourceUri(topologyResource.resourceUri) || !isStructureProjectResourceUri(coordinateResource.resourceUri) || typeof topologyResource.name !== "string" || typeof coordinateResource.name !== "string" || typeof topology.relativePath !== "string" || typeof coordinates.relativePath !== "string" || topologyResource.name !== topology.relativePath.split("/").at(-1) || coordinateResource.name !== coordinates.relativePath.split("/").at(-1) || typeof topology.format !== "string" || typeof coordinates.format !== "string") {
      fail3(
        "PERMISSION_DENIED",
        "The restored trajectory resource is not host-authorized"
      );
    }
    rememberStructureTrajectoryProject({
      ...input,
      operation: "control_viewer",
      command: {
        action: "load_trajectory",
        alignment: "none",
        objectId,
        coordinates: {
          encoding: "binary",
          name: coordinateResource.name,
          resourceUri: coordinateResource.resourceUri
        },
        coordinatesFormat: coordinates.format,
        topology: {
          encoding: "text",
          name: topologyResource.name,
          resourceUri: topologyResource.resourceUri
        },
        topologyFormat: topology.format,
        trajectorySourceGrant: input.command.trajectorySourceGrant,
        trajectoryRelativePath: coordinates.relativePath,
        topologyRelativePath: topology.relativePath,
        ...input.command.topologySourceGrant == null ? {} : { topologySourceGrant: input.command.topologySourceGrant }
      }
    });
  }
  const context = await getStructureProjectContext({
    ...input,
    command: {
      objectIds: [...trajectoryObjectIds, ...structureObjectIds],
      volumeIds: [...volumeObjectIds],
      primaryRelativePath: checkpoint.manifest.primary.relativePath
    }
  });
  if (context.structuredContent.available !== true) {
    return context;
  }
  const currentPrimary = context.structuredContent.primary;
  const expectedPrimary = checkpoint.manifest.primary;
  if (!isRecord2(currentPrimary) || currentPrimary.byteLength !== expectedPrimary.byteLength || currentPrimary.format !== expectedPrimary.format || currentPrimary.relativePath !== expectedPrimary.relativePath || currentPrimary.sha256 !== expectedPrimary.sha256 || !sameVerifiedStructureWorkspaceIntegrity(
    currentPrimary.sourceIntegrity,
    expectedPrimary.sourceIntegrity
  )) {
    return {
      structuredContent: {
        available: true,
        restorable: false,
        repairPlan: [
          {
            code: "changed",
            dependencyId: "primary",
            label: expectedPrimary.relativePath,
            message: "The approved Structure source no longer matches the checkpointed project."
          }
        ]
      }
    };
  }
  if (!Array.isArray(context.structuredContent.dependencies)) {
    fail3(
      "INVALID_REQUEST",
      "The verified Structure project dependency graph is invalid"
    );
  }
  const currentDependencies = new Map(
    context.structuredContent.dependencies.filter(isRecord2).map((dependency) => [dependency.id, dependency])
  );
  if (currentDependencies.size !== checkpointDependencies.length) {
    return {
      structuredContent: {
        available: true,
        restorable: false,
        repairPlan: [
          {
            code: "missing",
            dependencyId: "trajectory",
            label: "Molecular trajectory",
            message: "The approved trajectory dependency graph is incomplete."
          }
        ]
      }
    };
  }
  const resources = [];
  for (const dependency of checkpointDependencies) {
    if (!isRecord2(dependency)) {
      fail3("INVALID_REQUEST", "The Structure project dependency is invalid");
    }
    const current = currentDependencies.get(dependency.id);
    const objectId = typeof dependency.objectId === "string" ? dependency.objectId : void 0;
    const project = objectId == null ? void 0 : input.state.molecular.trajectoryProjects.get(objectId);
    const volume = [...input.state.molecular.volumes.values()].find(
      (candidate) => candidate.objectId === objectId
    );
    let source;
    if (dependency.kind === "trajectory-topology") {
      source = project?.topology;
    } else if (dependency.kind === "trajectory-coordinates") {
      source = project?.coordinates;
    } else if (dependency.kind === "structure" && objectId != null) {
      source = input.state.molecular.structureProjects.get(objectId);
    } else if (volume != null) {
      source = {
        format: volume.index.format,
        grant: volume.grant,
        relativePath: volume.relativePath ?? "",
        resourceUri: volume.resourceUri
      };
    }
    if (!isRecord2(current) || source == null || current.byteLength !== dependency.byteLength || current.format !== dependency.format || current.id !== dependency.id || current.kind !== dependency.kind || current.objectId !== dependency.objectId || current.relativePath !== dependency.relativePath || current.sha256 !== dependency.sha256 || !sameVerifiedStructureWorkspaceIntegrity(
      current.sourceIntegrity,
      dependency.sourceIntegrity
    )) {
      return {
        structuredContent: {
          available: true,
          restorable: false,
          repairPlan: [
            {
              code: "changed",
              dependencyId: dependency.id,
              label: dependency.relativePath,
              message: "The approved trajectory source no longer matches the checkpointed project."
            }
          ]
        }
      };
    }
    resources.push({
      id: dependency.id,
      name: source.relativePath.split("/").at(-1) ?? source.relativePath,
      resourceUri: source.resourceUri,
      format: source.format,
      sourceRevision: source.grant.sourceRevision,
      sourceSizeBytesDecimal: source.grant.sourceIdentity.sizeBytes.toString()
    });
  }
  return {
    structuredContent: {
      available: true,
      restorable: true,
      manifest: checkpoint.manifest,
      dependencies: resources
    }
  };
}
async function executeStructureArtifactOperation({
  operation,
  logicalSessionId,
  state,
  sourceGrant,
  command,
  identity,
  writeArtifact,
  artifactTransactions,
  now,
  signal
}) {
  signal.throwIfAborted();
  const suppliedGrant = validateStructureDestinationGrant({
    grant: command.destinationGrant,
    sourceGrant,
    identity,
    logicalSessionId,
    now: now()
  });
  if (operation === "export/begin") {
    if (!isOpaqueIdentity(command.idempotencyKey)) {
      fail3(
        "INVALID_REQUEST",
        "The Structure artifact idempotency key is invalid"
      );
    }
    if (artifactTransactions.size >= MAX_ARTIFACT_TRANSACTIONS) {
      for (const [transactionId, transaction2] of artifactTransactions) {
        if (transaction2.state === "published") {
          artifactTransactions.delete(transactionId);
          break;
        }
      }
    }
    if (artifactTransactions.size >= MAX_ARTIFACT_TRANSACTIONS) {
      fail3(
        "RESOURCE_EXHAUSTED",
        "The Structure artifact transaction budget is exhausted"
      );
    }
    const result2 = await writeArtifact({
      logicalSessionId,
      operation: "begin",
      payload: {
        destinationGrantId: suppliedGrant.destinationGrantId,
        idempotencyKey: command.idempotencyKey
      },
      signal
    });
    validateStructureArtifactHostResult(result2);
    const existing = artifactTransactions.get(result2.transactionId);
    if (existing == null) {
      artifactTransactions.set(result2.transactionId, {
        grant: suppliedGrant,
        logicalSessionId,
        sourceRevision: sourceGrant.sourceRevision,
        artifactKind: suppliedGrant.artifactKind,
        collisionPolicy: suppliedGrant.collisionPolicy,
        publicationId: result2.publicationId,
        members: /* @__PURE__ */ new Map(),
        state: result2.state
      });
    } else {
      assertStructureArtifactBinding({
        transaction: existing,
        grant: suppliedGrant,
        logicalSessionId,
        sourceRevision: sourceGrant.sourceRevision
      });
    }
    return {
      structuredContent: {
        ...result2,
        viewerSessionId: logicalSessionId,
        sourceRevision: sourceGrant.sourceRevision
      }
    };
  }
  if (!isOpaqueIdentity(command.transactionId)) {
    fail3(
      "INVALID_REQUEST",
      "The Structure artifact transaction identity is invalid"
    );
  }
  const transaction = artifactTransactions.get(command.transactionId);
  if (transaction == null) {
    fail3(
      "NOT_FOUND",
      "The Structure artifact transaction is not owned by this session"
    );
  }
  assertStructureArtifactBinding({
    transaction,
    grant: suppliedGrant,
    logicalSessionId,
    sourceRevision: sourceGrant.sourceRevision
  });
  const originalGrant = transaction.grant;
  if (!isRecord2(originalGrant)) {
    fail3(
      "PERMISSION_DENIED",
      "The original Structure destination grant is unavailable"
    );
  }
  if (operation === "export/append") {
    if (!(command.bytes instanceof Uint8Array) || command.bytes.byteLength === 0 || command.bytes.byteLength > MAX_ARTIFACT_CHUNK_BYTES) {
      fail3(
        "RESOURCE_EXHAUSTED",
        "The Structure artifact chunk exceeds its host budget"
      );
    }
    if (typeof command.memberName !== "string" || command.memberName.length > 1024 || !ARTIFACT_MEMBER_NAME.test(command.memberName) || command.memberName.split("/").some((component) => component === "." || component === "..") || typeof command.role !== "string" || !ARTIFACT_MEMBER_ROLES.has(command.role) || typeof command.offsetDecimal !== "string" || !DECIMAL2.test(command.offsetDecimal) || !isOpaqueIdentity(command.requestId)) {
      fail3(
        "INVALID_REQUEST",
        "The Structure artifact member or chunk identity is invalid"
      );
    }
    if (command.expectedChunkDigest != null && (typeof command.expectedChunkDigest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(command.expectedChunkDigest))) {
      fail3(
        "INVALID_REQUEST",
        "The Structure artifact chunk checksum is invalid"
      );
    }
    const result2 = await writeArtifact({
      logicalSessionId,
      operation: "append",
      payload: {
        destinationGrantId: originalGrant.destinationGrantId,
        transactionId: command.transactionId,
        memberName: command.memberName,
        role: command.role,
        offsetDecimal: command.offsetDecimal,
        bytes: command.bytes,
        requestId: command.requestId,
        ...command.expectedChunkDigest == null ? {} : { expectedChunkDigest: command.expectedChunkDigest }
      },
      signal
    });
    validateStructureArtifactHostResult(result2, command.transactionId);
    if (transaction.members instanceof Map) {
      transaction.members.set(command.memberName, command.role);
    }
    transaction.state = result2.state;
    return {
      structuredContent: {
        ...result2,
        viewerSessionId: logicalSessionId,
        sourceRevision: sourceGrant.sourceRevision
      }
    };
  }
  if (operation === "export/abort") {
    const result2 = await writeArtifact({
      logicalSessionId,
      operation: "abort",
      payload: {
        destinationGrantId: originalGrant.destinationGrantId,
        transactionId: command.transactionId
      },
      signal
    });
    if (result2.transactionId !== command.transactionId || result2.aborted !== true) {
      fail3(
        "PERMISSION_DENIED",
        "The host did not abort the approved Structure transaction"
      );
    }
    artifactTransactions.delete(command.transactionId);
    return {
      structuredContent: {
        transactionId: command.transactionId,
        aborted: true,
        viewerSessionId: logicalSessionId,
        sourceRevision: sourceGrant.sourceRevision
      }
    };
  }
  if (operation === "export/resume") {
    const result2 = await writeArtifact({
      logicalSessionId,
      operation: "resume",
      payload: {
        destinationGrantId: originalGrant.destinationGrantId,
        transactionId: command.transactionId
      },
      signal
    });
    validateStructureArtifactHostResult(result2, command.transactionId);
    transaction.state = result2.state;
    return {
      structuredContent: {
        ...result2,
        viewerSessionId: logicalSessionId,
        sourceRevision: sourceGrant.sourceRevision
      }
    };
  }
  const result = await writeArtifact({
    logicalSessionId,
    operation: "commit",
    payload: {
      destinationGrantId: originalGrant.destinationGrantId,
      transactionId: command.transactionId,
      sources: [
        {
          safeSourceId: sourceGrant.sourceIdentity.fileId,
          sourceRevision: sourceGrant.sourceRevision,
          identityStrength: "verified-file-identity",
          sizeBytesDecimal: sourceGrant.sourceIdentity.sizeBytes.toString(),
          format: state.molecular.format,
          parser: { name: "codex-scientific-structure-viewer", version: "1" },
          companions: []
        }
      ],
      exactness: "exact",
      evidenceClass: "computed",
      software: [{ name: "codex-scientific-structure-viewer", version: "1" }],
      coordinateConventions: ["cartesian-angstrom", "source-atom-identity"],
      publication: transaction.members instanceof Map && transaction.members.size > 1 ? "manifest-pointer" : "single-file"
    },
    signal
  });
  validateStructureArtifactHostResult(result, command.transactionId);
  if (result.state !== "published" || !isRecord2(result.manifest) || result.manifest.family !== "structure" || result.manifest.publicationId !== result.publicationId || result.manifest.artifactKind !== transaction.artifactKind || !Array.isArray(result.manifest.sources) || result.manifest.sources.length === 0 || result.manifest.sources.some(
    (source) => !isRecord2(source) || source.sourceRevision !== sourceGrant.sourceRevision
  )) {
    fail3(
      "CHECKSUM_MISMATCH",
      "The Structure artifact manifest does not match its authorized source"
    );
  }
  transaction.state = "published";
  return {
    structuredContent: {
      ...result,
      viewerSessionId: logicalSessionId,
      sourceRevision: sourceGrant.sourceRevision
    }
  };
}
function validateStructureDestinationGrant({
  grant,
  sourceGrant,
  identity,
  logicalSessionId,
  now
}) {
  if (!isRecord2(grant) || grant.family !== "structure" || grant.logicalSessionId !== logicalSessionId || grant.backendInstanceId !== identity.backendInstanceId || grant.backendGeneration !== identity.backendGeneration || grant.revocationEpoch !== identity.revocationEpoch || grant.sourceRevision !== sourceGrant.sourceRevision || !isOpaqueIdentity(grant.grantId) || !isOpaqueIdentity(grant.destinationGrantId) || !isOpaqueIdentity(grant.destinationIdentity) || typeof grant.artifactKind !== "string" || grant.artifactKind.length === 0 || grant.artifactKind.length > 128 || !isStringArray(grant.approvedArtifactKinds) || !grant.approvedArtifactKinds.includes(grant.artifactKind) || !isStringArray(grant.operations) || !grant.operations.includes("stage-derived-artifact") || !grant.operations.includes("commit-artifact-set") || !grant.operations.includes("abort-write") || grant.collisionPolicy !== "fail" && grant.collisionPolicy !== "next-version" || !Number.isSafeInteger(grant.issuedAtMs) || !Number.isSafeInteger(grant.expiresAtMs) || grant.issuedAtMs > now || grant.expiresAtMs <= now) {
    fail3(
      "PERMISSION_DENIED",
      "The Structure artifact destination grant is not authorized"
    );
  }
  for (const field of [
    "accountId",
    "organizationId",
    "hostId",
    "workspaceId"
  ]) {
    if (typeof sourceGrant[field] === "string" && grant[field] !== sourceGrant[field]) {
      fail3(
        "PERMISSION_DENIED",
        "The Structure artifact destination belongs to another scope"
      );
    }
  }
  return grant;
}
function assertStructureArtifactBinding({
  transaction,
  grant,
  logicalSessionId,
  sourceRevision
}) {
  const originalGrant = transaction.grant;
  if (!isRecord2(originalGrant) || originalGrant.grantId !== grant.grantId || originalGrant.destinationGrantId !== grant.destinationGrantId || originalGrant.destinationIdentity !== grant.destinationIdentity || transaction.logicalSessionId !== logicalSessionId || transaction.sourceRevision !== sourceRevision || transaction.artifactKind !== grant.artifactKind || transaction.collisionPolicy !== grant.collisionPolicy) {
    fail3(
      "PERMISSION_DENIED",
      "The Structure artifact transaction belongs to another destination"
    );
  }
}
function validateStructureArtifactHostResult(result, transactionId) {
  if (!isRecord2(result) || !isOpaqueIdentity(result.transactionId) || !isOpaqueIdentity(result.publicationId) || typeof result.state !== "string" || !["reserved", "staging", "validating", "publishing", "published"].includes(
    result.state
  ) || typeof result.bytesWrittenDecimal !== "string" || !DECIMAL2.test(result.bytesWrittenDecimal) || transactionId != null && result.transactionId !== transactionId) {
    fail3(
      "PERMISSION_DENIED",
      "The host returned an invalid Structure artifact transaction"
    );
  }
}
async function openStructure({
  sessions,
  logicalSessionId,
  grant,
  command,
  readSource,
  signal,
  exposeInitialGeometry
}) {
  if (sessions.size >= MAX_SESSIONS && !sessions.has(logicalSessionId)) {
    fail3("RESOURCE_EXHAUSTED", "The Structure session budget is exhausted");
  }
  const physicalSizeBytes = grant.sourceIdentity.sizeBytes;
  if (physicalSizeBytes <= 0n) {
    fail3("MALFORMED_STRUCTURE", "The authorized Structure source is empty");
  }
  const previewLength = Number(
    physicalSizeBytes < BigInt(PREVIEW_BYTES) ? physicalSizeBytes : BigInt(PREVIEW_BYTES)
  );
  const physicalPreview = await readSource({
    grant,
    logicalSessionId,
    offset: 0n,
    length: previewLength,
    signal
  });
  signal.throwIfAborted();
  const compressed = physicalPreview.bytes.byteLength >= 2 && physicalPreview.bytes[0] === 31 && physicalPreview.bytes[1] === 139 ? createScientificStructureCompressedByteSource({
    sizeBytes: physicalSizeBytes,
    sourceRevision: grant.sourceRevision,
    preview: physicalPreview.bytes,
    readCompressedRange: ({ offset, length, signal: signal2 }) => readSource({
      grant,
      logicalSessionId,
      offset,
      length,
      signal: signal2
    })
  }) : void 0;
  const preview = compressed == null ? physicalPreview : await compressed.readRange({
    offset: 0n,
    length: PREVIEW_BYTES,
    signal
  });
  signal.throwIfAborted();
  const sizeBytes = compressed?.sizeBytes ?? physicalSizeBytes;
  const sourceAccessPattern = compressed == null ? grant.sourceAccessPattern ?? grant.sourceIdentity.accessPattern ?? "random-access" : "forward-only";
  const sourceSizePolicy = compressed == null ? grant.sourceSizePolicy ?? grant.sourceIdentity.sizePolicy ?? "exact" : "bounded-unknown";
  const format = detectStructureFormat(preview.bytes, command.formatHint);
  const previous = sessions.get(logicalSessionId);
  previous?.molecular?.compressedSource?.close();
  const state = {
    revision: previous?.revision ?? 0,
    checkpoint: previous?.checkpoint,
    molecular: {
      sourceGrantId: grant.grantId,
      sourceRevision: grant.sourceRevision,
      sizeBytes,
      ...compressed == null ? {} : { compressedSource: compressed },
      format,
      atoms: /* @__PURE__ */ new Map(),
      decoder: new TextDecoder("utf-8", { fatal: true }),
      evicted: false,
      model: 1,
      headers: [],
      mmcifBlockStart: 0n,
      mmcifAtomBlocks: /* @__PURE__ */ new Map(),
      mmcifMetadata: {
        chemicalComponentTypes: /* @__PURE__ */ new Map(),
        entityTypes: /* @__PURE__ */ new Map(),
        polymerTypes: /* @__PURE__ */ new Map(),
        polymerEntities: /* @__PURE__ */ new Set(),
        entityMemberships: /* @__PURE__ */ new Map()
      },
      mmcifFraming: { atomRanges: [], scannedThrough: 0n },
      mmcifTrustedRange: true,
      pending: "",
      scanOffset: 0n,
      complete: false,
      selectedAtomIds: /* @__PURE__ */ new Set(),
      scene: { representation: "cartoon", visibility: true },
      scenes: /* @__PURE__ */ new Map(),
      history: [],
      topologyAtomCounts: /* @__PURE__ */ new Map(),
      trajectories: /* @__PURE__ */ new Map(),
      extendedTrajectories: /* @__PURE__ */ new Map(),
      trajectoryProjects: previous?.molecular?.sourceRevision === grant.sourceRevision ? previous.molecular.trajectoryProjects : /* @__PURE__ */ new Map(),
      structureProjects: previous?.molecular?.sourceRevision === grant.sourceRevision ? previous.molecular.structureProjects : /* @__PURE__ */ new Map(),
      volumes: previous?.molecular?.sourceRevision === grant.sourceRevision ? previous.molecular.volumes : /* @__PURE__ */ new Map(),
      commands: previous?.molecular?.sourceRevision === grant.sourceRevision ? previous.molecular.commands : /* @__PURE__ */ new Map(),
      commandWaiters: /* @__PURE__ */ new Set(),
      projectDigests: previous?.molecular?.sourceRevision === grant.sourceRevision ? previous.molecular.projectDigests : /* @__PURE__ */ new Map()
    }
  };
  appendStructureBytes(state.molecular, preview.bytes, 0n, preview.eof);
  if (state.molecular.atoms.size === 0 && !hasStructureHeader(preview.bytes, format)) {
    fail3(
      "MALFORMED_STRUCTURE",
      "The approved source contains no valid molecular header"
    );
  }
  sessions.set(logicalSessionId, state);
  return {
    structuredContent: {
      viewerReady: true,
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      format,
      sourceRevision: grant.sourceRevision,
      ...sourceSizePolicy === "exact" ? { sourceSizeBytesDecimal: sizeBytes.toString() } : { sourceSizeUpperBoundBytesDecimal: sizeBytes.toString() },
      sourceAccessPattern,
      sourceSizePolicy,
      effectiveCapabilities: { sourceAccessPattern, sourceSizePolicy },
      ...exposeInitialGeometry || sourceAccessPattern === "forward-only" ? {
        initialGeometry: {
          bytes: preview.bytes,
          eof: preview.eof,
          offsetDecimal: "0",
          sourceRevision: grant.sourceRevision
        }
      } : {},
      indexedAtomCount: state.molecular.atoms.size,
      complete: state.molecular.complete,
      models: uniqueModels(state.molecular.atoms),
      maxRangeBytes: MAX_SOURCE_RANGE_BYTES,
      maxPageAtoms: MAX_RESULT_ATOMS,
      ...state.molecular.complete ? {} : { nextOffsetDecimal: state.molecular.scanOffset.toString() }
    }
  };
}
async function readStructureAtomPage({
  logicalSessionId,
  state,
  grant,
  command,
  readSource,
  signal
}) {
  let offset = state.molecular.scanOffset;
  if (command.offsetDecimal == null && state.molecular.format === "mmcif") {
    offset = state.molecular.mmcifAtomRowStart ?? offset - BigInt(state.molecular.pendingByteLength ?? 0);
    retainMmcifPageBoundary(state.molecular, offset);
  }
  if (command.offsetDecimal != null) {
    offset = command.offsetDecimal === state.molecular.sizeBytes.toString() ? state.molecular.sizeBytes : parseOffset(command.offsetDecimal, state.molecular.sizeBytes);
  }
  if (offset === state.molecular.sizeBytes) {
    return {
      structuredContent: {
        viewerSessionId: logicalSessionId,
        viewerCommandRevision: state.revision,
        sourceRevision: state.molecular.sourceRevision,
        sourceSizeBytesDecimal: state.molecular.sizeBytes.toString(),
        format: state.molecular.format,
        offsetDecimal: offset.toString(),
        atoms: [],
        classificationMetadata: "unavailable",
        complete: true
      }
    };
  }
  const limit = readPositive(
    command.limit ?? MAX_RESULT_ATOMS,
    MAX_RESULT_ATOMS,
    "atom page limit"
  );
  const requested = readPositive(
    command.length ?? PREVIEW_BYTES,
    MAX_SOURCE_RANGE_BYTES,
    "atom page range"
  );
  const remaining = state.molecular.sizeBytes - offset;
  const length = Number(
    remaining < BigInt(requested) ? remaining : BigInt(requested)
  );
  let chunk = await readSource({
    grant,
    logicalSessionId,
    offset,
    length,
    signal
  });
  signal.throwIfAborted();
  if (chunk.bytes.byteLength === 0 && !chunk.eof) {
    fail3(
      "MALFORMED_STRUCTURE",
      "The authorized source returned an empty non-terminal molecular page"
    );
  }
  const packetBoundary = state.molecular.format === "mmcif" ? state.molecular.mmcifFraming?.pageBoundaries?.get(offset) : void 0;
  const unprovenPacketOffset = state.molecular.format === "mmcif" && packetBoundary == null && state.molecular.mmcifFraming?.atomRanges.some(
    ({ start, end, lineAligned }) => lineAligned === false && offset > start && offset <= end
  );
  if (unprovenPacketOffset)
    return atomPageCursorRequired(logicalSessionId, state, offset);
  let leadingPartialLine = false;
  if (offset > 0n) {
    const preceding = await readSource({
      grant,
      logicalSessionId,
      offset: offset - 1n,
      length: 1,
      signal
    });
    signal.throwIfAborted();
    if (preceding.bytes.byteLength !== 1) {
      fail3(
        "SOURCE_CHANGED",
        "The molecular page boundary is no longer current"
      );
    }
    leadingPartialLine = packetBoundary == null && preceding.bytes[0] !== 10 && preceding.bytes[0] !== 13;
  }
  let bytes = chunk.bytes;
  let finalNewline = bytes.lastIndexOf(10);
  while (!chunk.eof && finalNewline < 0) {
    if (bytes.byteLength >= MAX_STRUCTURE_LINE_BYTES) {
      fail3("RESOURCE_EXHAUSTED", "The molecular page exceeds its line budget");
    }
    const nextOffset2 = offset + BigInt(bytes.byteLength);
    const nextRemaining = state.molecular.sizeBytes - nextOffset2;
    if (nextRemaining <= 0n) {
      fail3("SOURCE_CHANGED", "The molecular page ended before a line boundary");
    }
    const nextLength = Number(
      nextRemaining < BigInt(requested) ? nextRemaining : BigInt(requested)
    );
    chunk = await readSource({
      grant,
      logicalSessionId,
      offset: nextOffset2,
      length: nextLength,
      signal
    });
    signal.throwIfAborted();
    if (chunk.bytes.byteLength === 0 && !chunk.eof) {
      fail3("MALFORMED_STRUCTURE", "The molecular page continuation is empty");
    }
    if (bytes.byteLength + chunk.bytes.byteLength > MAX_STRUCTURE_LINE_BYTES) {
      fail3("RESOURCE_EXHAUSTED", "The molecular page exceeds its line budget");
    }
    const combined = new Uint8Array(bytes.byteLength + chunk.bytes.byteLength);
    combined.set(bytes);
    combined.set(chunk.bytes, bytes.byteLength);
    bytes = combined;
    finalNewline = bytes.lastIndexOf(10);
  }
  let consumedBytes = chunk.eof ? bytes.byteLength : finalNewline + 1;
  if (consumedBytes <= 0) {
    fail3("MALFORMED_STRUCTURE", "The molecular page has no complete records");
  }
  const firstNewline = bytes.indexOf(10);
  let firstRecord = 0;
  if (leadingPartialLine) {
    firstRecord = firstNewline < 0 ? consumedBytes : firstNewline + 1;
  }
  const pageBytes = bytes.subarray(firstRecord, consumedBytes);
  const region = createRegionState(
    state.molecular,
    command.model,
    offset + BigInt(firstRecord)
  );
  if (pageBytes.byteLength > 0) {
    appendStructureBytes(
      region,
      pageBytes,
      offset + BigInt(firstRecord),
      chunk.eof
    );
  }
  let pageReadBytes = bytes.byteLength;
  while (region.mmcifAtomRowStart != null && region.mmcifAtomRowStart <= offset && (!region.mmcifComplexPackets || region.mmcifTrustedRange) && region.atoms.size === 0 && !chunk.eof) {
    const nextOffset2 = region.scanOffset;
    const nextRemaining = state.molecular.sizeBytes - nextOffset2;
    const budget = Math.min(
      MAX_STRUCTURE_LINE_BYTES - pageReadBytes,
      requested - Number(nextOffset2 - offset)
    );
    if (budget <= 0) {
      fail3(
        "RESOURCE_EXHAUSTED",
        "The molecular page exceeds its packet budget"
      );
    }
    const nextLength = Math.min(requested, budget, Number(nextRemaining));
    if (nextLength <= 0) {
      fail3(
        "SOURCE_CHANGED",
        "The molecular page ended before its packet boundary"
      );
    }
    chunk = await readSource({
      grant,
      logicalSessionId,
      offset: nextOffset2,
      length: nextLength,
      signal
    });
    signal.throwIfAborted();
    if (chunk.bytes.byteLength === 0 && !chunk.eof) {
      fail3("MALFORMED_STRUCTURE", "The molecular page continuation is empty");
    }
    pageReadBytes += chunk.bytes.byteLength;
    appendStructureBytes(region, chunk.bytes, nextOffset2, chunk.eof);
    consumedBytes = Number(region.scanOffset - offset) - (region.pendingByteLength ?? 0);
  }
  if (region.evicted) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The molecular page exceeds its resident atom budget"
    );
  }
  if (region.mmcifComplexPackets && !region.mmcifTrustedRange) {
    return atomPageCursorRequired(logicalSessionId, state, offset);
  }
  const packetLimit = offset + BigInt(requested);
  const complexPackets = region.format === "mmcif" && (region.mmcifComplexPackets || region.mmcifFraming?.atomRanges.some(
    ({ start, end, lineAligned }) => lineAligned === false && start < region.scanOffset && end > offset
  ));
  const allMatches = matchAtoms(region.atoms, command);
  const matches = complexPackets ? allMatches.filter(
    (atom) => (region.recordEndOffsets?.get(atom.atomId) ?? packetLimit + 1n) <= packetLimit
  ) : allMatches;
  applyMmcifResidueMetadata(state.molecular);
  const atoms = matches.slice(0, limit);
  let nextOffset = region.mmcifAtomRowStart ?? offset + BigInt(consumedBytes);
  let complete = chunk.eof;
  if (complexPackets && nextOffset > packetLimit) {
    let lastPacketEnd;
    for (const end of region.recordEndOffsets?.values() ?? []) {
      if (end > offset && end <= packetLimit && (lastPacketEnd == null || end > lastPacketEnd))
        lastPacketEnd = end;
    }
    if (lastPacketEnd == null) {
      fail3(
        "RESOURCE_EXHAUSTED",
        "An mmCIF packet exceeds the requested atom-page range"
      );
    }
    nextOffset = lastPacketEnd;
    complete = false;
  }
  if (matches.length >= limit) {
    const lastAtom = atoms[atoms.length - 1];
    const recordEnd = lastAtom == null ? void 0 : region.recordEndOffsets?.get(lastAtom.atomId);
    if (recordEnd == null || recordEnd <= offset || recordEnd > nextOffset) {
      fail3(
        "MALFORMED_STRUCTURE",
        "The molecular page has no safe continuation after its last atom"
      );
    }
    complete = complete && recordEnd === nextOffset;
    nextOffset = recordEnd;
  }
  if (!complete) retainMmcifPageBoundary(region, nextOffset);
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      sourceRevision: state.molecular.sourceRevision,
      sourceSizeBytesDecimal: state.molecular.sizeBytes.toString(),
      format: state.molecular.format,
      offsetDecimal: offset.toString(),
      atoms,
      classificationMetadata: nativeClassificationMetadata(atoms),
      complete,
      ...complete ? {} : { nextOffsetDecimal: nextOffset.toString() }
    }
  };
}
async function indexStructureTrajectory({
  logicalSessionId,
  state,
  grant,
  command,
  readSource,
  signal,
  identity,
  now
}) {
  const trajectoryGrant = validateSourceGrant({
    grant: command.trajectorySourceGrant,
    identity,
    logicalSessionId,
    now: now()
  });
  const topologyGrant = command.topologySourceGrant == null ? grant : validateSourceGrant({
    grant: command.topologySourceGrant,
    identity,
    logicalSessionId,
    now: now()
  });
  const selectedModel = readPositive(
    command.model ?? 1,
    Number.MAX_SAFE_INTEGER,
    "trajectory topology model"
  );
  const actualTopologyAtomCount = topologyGrant.grantId === grant.grantId && state.molecular.format === "pdb" ? await readStructureTopologyAtomCount({
    grant,
    logicalSessionId,
    model: selectedModel,
    readSource,
    signal,
    state
  }) : await countScientificStructureNativeTopologyAtoms({
    format: typeof command.topologyFormat === "string" ? command.topologyFormat : state.molecular.format,
    model: selectedModel,
    signal,
    source: createScientificStructureNativeTrajectorySource({
      grant: topologyGrant,
      logicalSessionId,
      readSource,
      signal
    })
  });
  const topologyAtomCount = command.topologyAtomCount == null ? actualTopologyAtomCount : readPositive(
    command.topologyAtomCount,
    1e6,
    "trajectory topology atom count"
  );
  if (topologyAtomCount !== actualTopologyAtomCount) {
    fail3(
      "TOPOLOGY_MISMATCH",
      "The trajectory atom count does not match the approved molecular model"
    );
  }
  if (command.format !== "dcd") {
    return indexExtendedStructureTrajectory({
      logicalSessionId,
      state,
      trajectoryGrant,
      topologyGrant,
      topologyAtomCount,
      command,
      readSource,
      signal
    });
  }
  const index = await indexScientificStructureBackendTrajectory({
    format: command.format,
    grant: trajectoryGrant,
    logicalSessionId,
    readSource,
    signal,
    topologyAtomCount
  });
  if (!state.molecular.trajectories.has(trajectoryGrant.grantId) && state.molecular.trajectories.size >= MAX_TRAJECTORIES) {
    fail3("RESOURCE_EXHAUSTED", "The Structure trajectory budget is exhausted");
  }
  state.molecular.trajectories.set(trajectoryGrant.grantId, index);
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      format: index.format,
      sourceRevision: index.sourceRevision,
      sourceSizeBytesDecimal: index.sourceSizeBytes.toString(),
      frameCount: index.frameCount,
      atomCount: index.atomCount,
      complete: index.complete,
      indexedThroughOffsetDecimal: index.indexedThroughOffset.toString()
    }
  };
}
async function readStructureTrajectory({
  logicalSessionId,
  state,
  command,
  readSource,
  signal,
  identity,
  multiple,
  now
}) {
  const trajectoryGrant = validateSourceGrant({
    grant: command.trajectorySourceGrant,
    identity,
    logicalSessionId,
    now: now()
  });
  const index = state.molecular.trajectories.get(trajectoryGrant.grantId);
  const extended = state.molecular.extendedTrajectories.get(
    trajectoryGrant.grantId
  );
  if (extended != null) {
    if (extended.index.sourceRevision !== trajectoryGrant.sourceRevision || extended.index.sourceSizeBytes !== trajectoryGrant.sourceIdentity.sizeBytes) {
      fail3(
        "SOURCE_CHANGED",
        "The trajectory has not been indexed for its current source revision"
      );
    }
    const result2 = await readScientificStructureNativeTrajectoryWindow({
      command,
      ...extended,
      multiple,
      signal
    });
    return {
      structuredContent: {
        viewerSessionId: logicalSessionId,
        viewerCommandRevision: state.revision,
        sourceRevision: extended.index.sourceRevision,
        sourceSizeBytesDecimal: extended.index.sourceSizeBytes.toString(),
        format: extended.format,
        ...result2
      }
    };
  }
  if (index == null || index.sourceRevision !== trajectoryGrant.sourceRevision || index.sourceSizeBytes !== trajectoryGrant.sourceIdentity.sizeBytes) {
    fail3(
      "SOURCE_CHANGED",
      "The trajectory has not been indexed for its current source revision"
    );
  }
  const result = await readScientificStructureBackendTrajectoryFrames({
    command,
    grant: trajectoryGrant,
    index,
    logicalSessionId,
    multiple,
    readSource,
    signal
  });
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      sourceRevision: index.sourceRevision,
      sourceSizeBytesDecimal: index.sourceSizeBytes.toString(),
      format: index.format,
      ...result
    }
  };
}
async function readStructureTopologyPage(input) {
  if (!isStructureProjectResourceUri(input.command.resourceUri) || typeof input.command.format !== "string") {
    fail3("PERMISSION_DENIED", "The approved trajectory topology is invalid");
  }
  const topologyGrant = validateSourceGrant({
    grant: input.command.topologySourceGrant,
    identity: input.identity,
    logicalSessionId: input.logicalSessionId,
    now: input.now()
  });
  const offset = input.command.offsetDecimal ?? "0";
  if (typeof offset !== "string" || !DECIMAL2.test(offset)) {
    fail3("INVALID_REQUEST", "The approved topology page offset is invalid");
  }
  const result = await readScientificStructureNativeTopologyPage({
    format: input.command.format,
    offset: BigInt(offset),
    ...typeof input.command.atomOffset === "number" ? { atomOffset: input.command.atomOffset } : {},
    ...typeof input.command.limit === "number" ? { limit: input.command.limit } : {},
    source: createScientificStructureNativeTrajectorySource({
      grant: topologyGrant,
      logicalSessionId: input.logicalSessionId,
      readSource: input.readSource,
      signal: input.signal
    }),
    signal: input.signal
  });
  const { nextOffset, offset: pageOffset, ...page } = result;
  return {
    structuredContent: {
      viewerSessionId: input.logicalSessionId,
      viewerCommandRevision: input.state.revision,
      sourceRevision: topologyGrant.sourceRevision,
      sourceSizeBytesDecimal: topologyGrant.sourceIdentity.sizeBytes.toString(),
      format: input.command.format,
      offsetDecimal: pageOffset.toString(),
      ...page,
      ...nextOffset == null ? {} : { nextOffsetDecimal: nextOffset.toString() }
    }
  };
}
async function indexExtendedStructureTrajectory(input) {
  const requested = input.command.format === "nc" || input.command.format === "netcdf" ? "nctraj" : input.command.format;
  if (requested !== "xtc" && requested !== "trr" && requested !== "nctraj" && requested !== "lammpstrj") {
    fail3("UNSUPPORTED", "The approved trajectory format has no native codec");
  }
  if (!input.state.molecular.extendedTrajectories.has(
    input.trajectoryGrant.grantId
  ) && input.state.molecular.extendedTrajectories.size + input.state.molecular.trajectories.size >= MAX_TRAJECTORIES) {
    fail3("RESOURCE_EXHAUSTED", "The Structure trajectory budget is exhausted");
  }
  const source = createScientificStructureNativeTrajectorySource({
    grant: input.trajectoryGrant,
    logicalSessionId: input.logicalSessionId,
    readSource: input.readSource,
    signal: input.signal
  });
  const topologySource = createScientificStructureNativeTrajectorySource({
    grant: input.topologyGrant,
    logicalSessionId: input.logicalSessionId,
    readSource: input.readSource,
    signal: input.signal
  });
  const topology = {
    atomIds: Array.from(
      { length: input.topologyAtomCount },
      (_value, index2) => `${input.topologyGrant.sourceHandleId}:${index2 + 1}`
    ),
    sourceDigest: topologySource.sourceDigest,
    sourceRevision: input.topologyGrant.sourceRevision
  };
  const index = requested === "lammpstrj" ? await indexScientificStructureLammpsTrajectory({
    source,
    topology,
    signal: input.signal
  }) : await indexScientificStructureBinaryTrajectory({
    budget: {
      maxAtoms: 1e6,
      maxDecodedFrameBytes: 32 * 1024 * 1024,
      maxFrameBytes: 32n * 1024n * 1024n,
      maxFrames: 65536,
      maxRangeBytes: MAX_TOPOLOGY_RANGE_BYTES
    },
    format: requested,
    source,
    topology,
    signal: input.signal
  });
  const extended = { format: requested, index, source, topology };
  input.state.molecular.extendedTrajectories.set(
    input.trajectoryGrant.grantId,
    extended
  );
  return {
    structuredContent: {
      viewerSessionId: input.logicalSessionId,
      viewerCommandRevision: input.state.revision,
      format: requested,
      sourceRevision: index.sourceRevision,
      sourceSizeBytesDecimal: index.sourceSizeBytes.toString(),
      frameCount: index.frameCount,
      atomCount: index.atomCount,
      complete: index.complete,
      indexedThroughOffsetDecimal: index.indexedThroughOffset.toString()
    }
  };
}
async function indexStructureVolume(input) {
  const volumeGrant = validateSourceGrant({
    grant: input.command.volumeSourceGrant,
    identity: input.identity,
    logicalSessionId: input.logicalSessionId,
    now: input.now()
  });
  if (!isStructureProjectResourceUri(input.command.resourceUri) || typeof input.command.format !== "string" || input.command.relativePath != null && !isSafeProjectRelativePath(input.command.relativePath) || volumeGrant.sourceIdentity.fileId === input.grant.sourceIdentity.fileId) {
    fail3("PERMISSION_DENIED", "The molecular volume has no approved companion");
  }
  if (!input.state.molecular.volumes.has(input.command.resourceUri) && input.state.molecular.volumes.size >= MAX_PROJECT_DEPENDENCIES) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The molecular volume companion budget is exhausted"
    );
  }
  const index = await indexScientificStructureNativeVolume({
    grant: volumeGrant,
    logicalSessionId: input.logicalSessionId,
    format: input.command.format,
    readSource: input.readSource,
    signal: input.signal
  });
  const previous = input.state.molecular.volumes.get(input.command.resourceUri);
  if (previous != null && (previous.grant.grantId !== volumeGrant.grantId || previous.grant.sourceHandleId !== volumeGrant.sourceHandleId || previous.grant.sourceRevision !== volumeGrant.sourceRevision)) {
    fail3("SOURCE_CHANGED", "The approved molecular volume source was replaced");
  }
  const relativePath = typeof input.command.relativePath === "string" ? input.command.relativePath : previous?.relativePath;
  input.state.molecular.volumes.set(input.command.resourceUri, {
    grant: volumeGrant,
    index,
    ...previous?.objectId == null ? {} : { objectId: previous.objectId },
    ...relativePath == null ? {} : { relativePath },
    resourceUri: input.command.resourceUri
  });
  const { sourceGrantId, sourceHandleId, ...metadata } = index;
  void sourceGrantId;
  void sourceHandleId;
  return {
    structuredContent: {
      viewerCommandRevision: input.state.revision,
      ...metadata
    }
  };
}
async function readStructureVolume(input) {
  if (!isStructureProjectResourceUri(input.command.resourceUri)) {
    fail3("PERMISSION_DENIED", "The molecular volume has no approved resource");
  }
  const volume = input.state.molecular.volumes.get(input.command.resourceUri);
  const volumeGrant = validateSourceGrant({
    grant: input.command.volumeSourceGrant,
    identity: input.identity,
    logicalSessionId: input.logicalSessionId,
    now: input.now()
  });
  if (volume == null || volume.grant.grantId !== volumeGrant.grantId || volume.grant.sourceHandleId !== volumeGrant.sourceHandleId || volume.grant.sourceRevision !== volumeGrant.sourceRevision) {
    fail3("SOURCE_CHANGED", "The approved molecular volume source has changed");
  }
  const region = input.command.region;
  if (region != null && (!isRecord2(region) || !isStructureVolumeAxis(region.start) || !isStructureVolumeAxis(region.size))) {
    fail3("INVALID_REQUEST", "The molecular volume region is invalid");
  }
  const result = await readScientificStructureNativeVolumeTile({
    grant: volumeGrant,
    logicalSessionId: input.logicalSessionId,
    index: volume.index,
    ...typeof input.command.offsetDecimal === "string" ? { offsetDecimal: input.command.offsetDecimal } : {},
    ...typeof input.command.length === "number" ? { length: input.command.length } : {},
    ...region == null ? {} : { region },
    readSource: input.readSource,
    signal: input.signal
  });
  return {
    structuredContent: {
      viewerCommandRevision: input.state.revision,
      ...result
    }
  };
}
function isStructureVolumeAxis(axis) {
  return Array.isArray(axis) && axis.length === 3 && axis.every(Number.isSafeInteger);
}
async function readStructureTopologyAtomCount(input) {
  const cached = input.state.molecular.topologyAtomCounts.get(input.model);
  if (cached != null) {
    return cached;
  }
  if (input.state.molecular.format !== "pdb") {
    fail3(
      "UNSUPPORTED",
      "Trajectory indexing requires an independently verified PDB topology"
    );
  }
  const accessPattern = input.grant.sourceAccessPattern ?? input.grant.sourceIdentity.accessPattern ?? "random-access";
  if (input.state.molecular.compressedSource != null || accessPattern !== "random-access") {
    fail3(
      "UNSUPPORTED",
      "A trajectory topology requires an authorized random-access source"
    );
  }
  const topology = createRegionState(input.state.molecular, input.model);
  const resumeIndexedModel = !input.state.molecular.evicted && input.state.molecular.model === input.model && [...input.state.molecular.atoms.values()].every(
    (atom) => atom.model === input.model
  );
  let offset = resumeIndexedModel ? input.state.molecular.scanOffset : 0n;
  let currentModel = resumeIndexedModel ? input.state.molecular.model : 1;
  let atomCount = resumeIndexedModel ? input.state.molecular.atoms.size : 0;
  let foundModel = resumeIndexedModel && atomCount > 0;
  let complete = resumeIndexedModel && input.state.molecular.complete;
  if (resumeIndexedModel) {
    topology.pending = input.state.molecular.pending;
  }
  while (!complete && offset < input.state.molecular.sizeBytes) {
    input.signal.throwIfAborted();
    if (offset >= BigInt(MAX_TOPOLOGY_SCAN_BYTES)) {
      fail3(
        "RESOURCE_EXHAUSTED",
        "The approved molecular topology exceeds its bounded model scan"
      );
    }
    const remaining = input.state.molecular.sizeBytes - offset;
    const budget = BigInt(MAX_TOPOLOGY_SCAN_BYTES) - offset;
    const length = Number(
      [BigInt(MAX_TOPOLOGY_RANGE_BYTES), remaining, budget].reduce(
        (smallest, value) => value < smallest ? value : smallest
      )
    );
    const chunk = await readStructureTrajectoryRange(input, offset, length);
    input.signal.throwIfAborted();
    let decoded;
    try {
      decoded = topology.decoder.decode(chunk, {
        stream: offset + BigInt(chunk.byteLength) < input.state.molecular.sizeBytes
      });
    } catch {
      fail3("MALFORMED_STRUCTURE", "The approved topology is not valid UTF-8");
    }
    const combined = topology.pending + decoded;
    if (Buffer2.byteLength(combined, "utf8") > MAX_STRUCTURE_LINE_BYTES) {
      fail3("RESOURCE_EXHAUSTED", "An approved topology record is too large");
    }
    const lines = combined.split(/\r?\n/u);
    const eof = offset + BigInt(chunk.byteLength) === input.state.molecular.sizeBytes;
    topology.pending = eof ? "" : lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("MODEL")) {
        const nextModel = Number.parseInt(line.slice(10).trim(), 10);
        if (!Number.isSafeInteger(nextModel) || nextModel <= 0) {
          fail3("MALFORMED_STRUCTURE", "A molecular model identity is invalid");
        }
        if (foundModel && currentModel === input.model && atomCount > 0) {
          complete = true;
          break;
        }
        currentModel = nextModel;
        topology.model = nextModel;
        if (nextModel === input.model) {
          foundModel = true;
        }
        continue;
      }
      if (line.startsWith("ENDMDL")) {
        if (currentModel === input.model && foundModel) {
          complete = true;
          break;
        }
        continue;
      }
      if (currentModel === input.model && (line.startsWith("ATOM  ") || line.startsWith("HETATM"))) {
        foundModel = true;
        parsePdbLine(topology, line);
        atomCount += 1;
        if (atomCount > 1e6) {
          fail3(
            "RESOURCE_EXHAUSTED",
            "The approved topology has too many atoms"
          );
        }
      }
    }
    offset += BigInt(chunk.byteLength);
    if (eof) {
      complete = true;
    }
  }
  if (!complete || !foundModel || atomCount === 0) {
    fail3("TOPOLOGY_MISMATCH", "The approved molecular model was not found");
  }
  if (input.state.molecular.topologyAtomCounts.size >= MAX_TRAJECTORIES) {
    fail3("RESOURCE_EXHAUSTED", "The molecular topology cache is exhausted");
  }
  input.state.molecular.topologyAtomCounts.set(input.model, atomCount);
  return atomCount;
}
async function indexScientificStructureBackendTrajectory(input) {
  if (input.format !== "dcd") {
    fail3(
      "UNSUPPORTED",
      "Only validated, range-indexed DCD trajectories are enabled in the Structure backend"
    );
  }
  const sourceSizeBytes = input.grant.sourceIdentity.sizeBytes;
  const header = await readStructureTrajectoryRange(input, 0n, 116);
  const view = structureTrajectoryDataView(header);
  let littleEndian = null;
  if (view.getInt32(0, true) === 84) {
    littleEndian = true;
  } else if (view.getInt32(0, false) === 84) {
    littleEndian = false;
  }
  if (littleEndian == null || header[4] !== 67 || header[5] !== 79 || header[6] !== 82 || header[7] !== 68 || view.getInt32(88, littleEndian) !== 84) {
    fail3("MALFORMED_TRAJECTORY", "The DCD coordinate header is invalid");
  }
  const advertisedFrameCount = view.getInt32(8, littleEndian);
  const titleBytes = view.getInt32(92, littleEndian);
  const titleLineCount = view.getInt32(96, littleEndian);
  if (advertisedFrameCount < 0 || titleBytes < 4 || titleBytes > MAX_SOURCE_RANGE_BYTES || (titleBytes - 4) % 80 !== 0 || titleLineCount < 0 || titleLineCount > Math.floor((MAX_SOURCE_RANGE_BYTES - 4) / 80)) {
    fail3("MALFORMED_TRAJECTORY", "The DCD frame or title block is invalid");
  }
  if (view.getInt32(52, littleEndian) !== 0) {
    fail3(
      "UNSUPPORTED",
      "A DCD fourth coordinate requires a separately bounded trajectory decoder"
    );
  }
  const countedTitleBytes = 4 + titleLineCount * 80;
  const titlePayloadCandidates = [countedTitleBytes];
  if (countedTitleBytes !== titleBytes) {
    titlePayloadCandidates.push(titleBytes);
  }
  let atomBlockOffset;
  let matchingTitleRecord = false;
  let matchingAtomRecord = false;
  for (const titlePayloadBytes of titlePayloadCandidates) {
    const titleEnd = 96n + BigInt(titlePayloadBytes);
    if (titleEnd + 16n > sourceSizeBytes) {
      continue;
    }
    const titleAndAtomBlock = titleEnd + 16n <= BigInt(header.byteLength) ? header.subarray(Number(titleEnd), Number(titleEnd) + 16) : await readStructureTrajectoryRange(input, titleEnd, 16);
    const records = structureTrajectoryDataView(titleAndAtomBlock);
    if (records.getInt32(0, littleEndian) !== titleBytes) {
      continue;
    }
    matchingTitleRecord = true;
    if (records.getInt32(4, littleEndian) !== 4 || records.getInt32(12, littleEndian) !== 4) {
      continue;
    }
    matchingAtomRecord = true;
    if (records.getInt32(8, littleEndian) === input.topologyAtomCount) {
      if (atomBlockOffset != null) {
        fail3(
          "MALFORMED_TRAJECTORY",
          "The DCD title record has ambiguous authorized atom-count boundaries"
        );
      }
      atomBlockOffset = titleEnd + 4n;
    }
  }
  if (atomBlockOffset == null) {
    if (matchingAtomRecord) {
      fail3(
        "TOPOLOGY_MISMATCH",
        "The DCD atom-count record does not match its authorized topology"
      );
    }
    fail3(
      "MALFORMED_TRAJECTORY",
      matchingTitleRecord ? "The DCD atom-count record marker is invalid" : "The DCD title record marker is invalid"
    );
  }
  const hasCell = view.getInt32(48, littleEndian) !== 0;
  const axisBytes = input.topologyAtomCount * 4;
  const firstFrameOffset = atomBlockOffset + 12n;
  const frameBytes = BigInt((axisBytes + 8) * 3 + (hasCell ? 56 : 0));
  const retainedFrameBytes = sourceSizeBytes - firstFrameOffset;
  if (retainedFrameBytes < 0n || retainedFrameBytes % frameBytes !== 0n || retainedFrameBytes === 0n && advertisedFrameCount > 0) {
    fail3(
      "MALFORMED_TRAJECTORY",
      "The retained DCD frames do not match the authorized source length"
    );
  }
  const physicalFrameCount = retainedFrameBytes / frameBytes;
  if (physicalFrameCount > 0x7fffffffn) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The retained DCD frame count exceeds its bounded range"
    );
  }
  const frameCount = Number(physicalFrameCount);
  const index = {
    format: "dcd",
    atomCount: input.topologyAtomCount,
    complete: true,
    firstFrameOffset,
    frameBytes,
    frameCount,
    hasCell,
    indexedThroughOffset: sourceSizeBytes,
    littleEndian,
    saveInterval: view.getInt32(16, littleEndian),
    sourceRevision: input.grant.sourceRevision,
    sourceSizeBytes,
    startStep: view.getInt32(12, littleEndian),
    validatedFrames: /* @__PURE__ */ new Map()
  };
  if (frameCount > 0) {
    await validateStructureDcdFrame(input, index, 0);
    if (frameCount > 1) {
      await validateStructureDcdFrame(input, index, frameCount - 1);
    }
  }
  return index;
}
async function readScientificStructureBackendTrajectoryFrames(input) {
  const first = input.command.frameIndex ?? input.command.start ?? 0;
  if (typeof first !== "number" || !Number.isSafeInteger(first) || first < 0 || first >= input.index.frameCount) {
    fail3("INVALID_REQUEST", "The requested trajectory frame is out of range");
  }
  const endExclusive = input.multiple ? input.command.endExclusive ?? first + 1 : first + 1;
  const stride = input.command.stride ?? 1;
  if (typeof endExclusive !== "number" || !Number.isSafeInteger(endExclusive) || endExclusive <= first || endExclusive > input.index.frameCount || typeof stride !== "number" || !Number.isSafeInteger(stride) || stride <= 0 || Math.ceil((endExclusive - first) / stride) > 64) {
    fail3("RESOURCE_EXHAUSTED", "The requested trajectory window is unbounded");
  }
  const atomOffset = input.command.atomOffset ?? 0;
  if (typeof atomOffset !== "number" || !Number.isSafeInteger(atomOffset) || atomOffset < 0 || atomOffset >= input.index.atomCount) {
    fail3("INVALID_REQUEST", "The requested trajectory atom is out of range");
  }
  const atomCount = readPositive(
    input.command.atomCount ?? Math.min(input.index.atomCount - atomOffset, MAX_RESULT_ATOMS),
    MAX_RESULT_ATOMS,
    "trajectory frame atom count"
  );
  if (atomCount > input.index.atomCount - atomOffset) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The requested trajectory atom range is invalid"
    );
  }
  const frames = [];
  for (let frameIndex = first; frameIndex < endExclusive; frameIndex += stride) {
    input.signal.throwIfAborted();
    const { axisOffsets, frameOffset } = await validateStructureDcdFrame(
      input,
      input.index,
      frameIndex
    );
    const parts = await Promise.all(
      axisOffsets.map(
        (offset) => readStructureTrajectoryRange(
          input,
          offset + BigInt(atomOffset * 4),
          atomCount * 4
        )
      )
    );
    input.signal.throwIfAborted();
    const coordinates = new Uint8Array(atomCount * 3 * 4);
    const coordinateView = structureTrajectoryDataView(coordinates);
    for (let atom = 0; atom < atomCount; atom += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = structureTrajectoryDataView(parts[axis]).getFloat32(
          atom * 4,
          input.index.littleEndian
        );
        if (!Number.isFinite(value)) {
          fail3(
            "MALFORMED_TRAJECTORY",
            "The DCD frame contains a non-finite coordinate"
          );
        }
        coordinateView.setFloat32((atom * 3 + axis) * 4, value, true);
      }
    }
    const step = input.index.startStep + frameIndex * input.index.saveInterval;
    if (!Number.isSafeInteger(step)) {
      fail3("MALFORMED_TRAJECTORY", "The DCD trajectory step is not safe");
    }
    frames.push({
      frameIndex,
      frameOffsetDecimal: frameOffset.toString(),
      atomOffset,
      atomCount,
      topologyAtomCount: input.index.atomCount,
      coordinates,
      complete: atomOffset === 0 && atomCount === input.index.atomCount,
      step
    });
  }
  if (!input.multiple) {
    return frames[0];
  }
  return {
    complete: true,
    frames,
    indexComplete: input.index.complete,
    sampledFrameCount: frames.length,
    sourceFrameCount: input.index.frameCount,
    stride
  };
}
async function validateStructureDcdFrame(input, index, frameIndex) {
  const validated = index.validatedFrames.get(frameIndex);
  if (validated != null) {
    return validated;
  }
  const frameOffset = index.firstFrameOffset + BigInt(frameIndex) * index.frameBytes;
  let cursor = frameOffset;
  if (index.hasCell) {
    const cell = structureTrajectoryDataView(
      await readStructureTrajectoryRange(input, cursor, 56)
    );
    if (cell.getInt32(0, index.littleEndian) !== 48 || cell.getInt32(52, index.littleEndian) !== 48) {
      fail3("MALFORMED_TRAJECTORY", "The DCD unit-cell markers are invalid");
    }
    for (const position of [4, 12, 20, 28, 36, 44]) {
      if (!Number.isFinite(cell.getFloat64(position, index.littleEndian))) {
        fail3("MALFORMED_TRAJECTORY", "The DCD unit cell is not finite");
      }
    }
    cursor += 56n;
  }
  const axisBytes = index.atomCount * 4;
  const axisOffsets = [];
  const markers = await Promise.all([
    readStructureTrajectoryRange(input, cursor, 4),
    ...Array.from(
      { length: 3 },
      (_value, axis) => readStructureTrajectoryRange(
        input,
        cursor + BigInt(axis * (axisBytes + 8) + axisBytes + 4),
        axis === 2 ? 4 : 8
      )
    )
  ]);
  if (structureTrajectoryDataView(markers[0]).getInt32(0, index.littleEndian) !== axisBytes) {
    fail3(
      "MALFORMED_TRAJECTORY",
      "The DCD coordinate record markers are invalid"
    );
  }
  for (let axis = 0; axis < 3; axis += 1) {
    const marker = structureTrajectoryDataView(markers[axis + 1]);
    if (marker.getInt32(0, index.littleEndian) !== axisBytes || axis < 2 && marker.getInt32(4, index.littleEndian) !== axisBytes) {
      fail3(
        "MALFORMED_TRAJECTORY",
        "The DCD coordinate record markers are invalid"
      );
    }
    axisOffsets.push(cursor + 4n);
    cursor += BigInt(axisBytes + 8);
  }
  if (cursor !== frameOffset + index.frameBytes) {
    fail3("MALFORMED_TRAJECTORY", "The DCD frame length is inconsistent");
  }
  const result = { axisOffsets, frameOffset };
  if (index.validatedFrames.size >= MAX_VALIDATED_TRAJECTORY_FRAMES) {
    const oldestFrame = index.validatedFrames.keys().next().value;
    if (oldestFrame != null) {
      index.validatedFrames.delete(oldestFrame);
    }
  }
  index.validatedFrames.set(frameIndex, result);
  return result;
}
async function readStructureTrajectoryRange(input, offset, length) {
  input.signal.throwIfAborted();
  const sizeBytes = input.grant.sourceIdentity.sizeBytes;
  if (typeof offset !== "bigint" || offset < 0n || !Number.isSafeInteger(length) || length <= 0 || length > MAX_SOURCE_RANGE_BYTES || offset > sizeBytes || BigInt(length) > sizeBytes - offset) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The requested trajectory range exceeds its authorized source"
    );
  }
  const result = await input.readSource({
    grant: input.grant,
    logicalSessionId: input.logicalSessionId,
    offset,
    length,
    signal: input.signal
  });
  input.signal.throwIfAborted();
  if (result.bytes.byteLength !== length) {
    fail3("SOURCE_CHANGED", "The authorized trajectory range is incomplete");
  }
  return result.bytes;
}
function structureTrajectoryDataView(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
async function queryStructure({
  logicalSessionId,
  state,
  grant,
  command,
  readSource,
  signal
}) {
  const limit = readPositive(
    command.limit ?? 64,
    MAX_RESULT_ATOMS,
    "atom limit"
  );
  if (command.offsetDecimal != null) {
    const offset = parseOffset(
      command.offsetDecimal,
      state.molecular.sizeBytes
    );
    const remaining = state.molecular.sizeBytes - offset;
    const length = Math.min(
      readPositive(
        command.length ?? PREVIEW_BYTES,
        PREVIEW_BYTES,
        "atom range"
      ),
      Number(
        remaining < BigInt(PREVIEW_BYTES) ? remaining : BigInt(PREVIEW_BYTES)
      )
    );
    if (length <= 0) {
      fail3("INVALID_REQUEST", "The requested molecular range is empty");
    }
    const result = await readSource({
      grant,
      logicalSessionId,
      offset,
      length,
      signal
    });
    const direct = createRegionState(
      state.molecular,
      command.model,
      offset === 0n ? offset : void 0
    );
    appendStructureBytes(direct, result.bytes, offset, result.eof);
    const matched2 = matchAtoms(direct.atoms, command).slice(0, limit);
    return atomResult(logicalSessionId, state, matched2, result.eof, offset);
  }
  await scanForStructureAtoms({
    logicalSessionId,
    state,
    grant,
    command,
    readSource,
    signal
  });
  const matched = matchAtoms(state.molecular.atoms, command).slice(0, limit);
  return atomResult(
    logicalSessionId,
    state,
    matched,
    state.molecular.complete,
    void 0
  );
}
async function scanForStructureAtoms(args, scanned = 0) {
  const { logicalSessionId, state, grant, command, readSource, signal } = args;
  if (state.molecular.complete || matchAtoms(state.molecular.atoms, command).length > 0 || scanned >= MAX_QUERY_SCAN_BYTES) {
    return;
  }
  signal.throwIfAborted();
  const remaining = state.molecular.sizeBytes - state.molecular.scanOffset;
  if (remaining <= 0n) {
    state.molecular.complete = !state.molecular.evicted;
    return;
  }
  const length = Number(
    remaining < BigInt(PREVIEW_BYTES) ? remaining : BigInt(PREVIEW_BYTES)
  );
  const chunk = await readSource({
    grant,
    logicalSessionId,
    offset: state.molecular.scanOffset,
    length,
    signal
  });
  if (chunk.bytes.byteLength === 0 && !chunk.eof) {
    fail3(
      "MALFORMED_STRUCTURE",
      "The authorized source returned an empty non-terminal molecular range"
    );
  }
  appendStructureBytes(
    state.molecular,
    chunk.bytes,
    state.molecular.scanOffset,
    chunk.eof
  );
  return scanForStructureAtoms(args, scanned + chunk.bytes.byteLength);
}
async function readStructureGeometry({
  logicalSessionId,
  state,
  grant,
  command,
  readSource,
  signal
}) {
  const offset = parseOffset(
    command.offsetDecimal ?? "0",
    state.molecular.sizeBytes
  );
  const remaining = state.molecular.sizeBytes - offset;
  const requested = readPositive(
    command.length ?? PREVIEW_BYTES,
    PREVIEW_BYTES,
    "geometry range"
  );
  const length = Math.min(
    requested,
    Number(
      remaining < BigInt(PREVIEW_BYTES) ? remaining : BigInt(PREVIEW_BYTES)
    )
  );
  if (length === 0) {
    fail3("INVALID_REQUEST", "The requested Structure geometry range is empty");
  }
  const chunk = await readSource({
    grant,
    logicalSessionId,
    offset,
    length,
    signal
  });
  if ((state.molecular.compressedSource != null || (grant.sourceAccessPattern ?? grant.sourceIdentity.accessPattern) === "forward-only") && offset === state.molecular.scanOffset) {
    appendStructureBytes(state.molecular, chunk.bytes, offset, chunk.eof);
  }
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      format: state.molecular.format,
      sourceRevision: state.molecular.sourceRevision,
      offsetDecimal: offset.toString(),
      bytes: chunk.bytes,
      eof: chunk.eof
    }
  };
}
async function measureStructure(args) {
  const { logicalSessionId, state, command } = args;
  const atomIds = command.atomIds;
  if (!isStringArray(atomIds) || atomIds.length !== 2) {
    fail3(
      "INVALID_REQUEST",
      "A molecular distance requires exactly two atom identities"
    );
  }
  await ensureStructureAtom(args, atomIds[0]);
  await ensureStructureAtom(args, atomIds[1]);
  const first = state.molecular.atoms.get(atomIds[0]);
  const second = state.molecular.atoms.get(atomIds[1]);
  if (first == null || second == null) {
    fail3(
      "INCOMPLETE_INDEX",
      "The requested measurement atoms are not yet indexed"
    );
  }
  const distance = Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.z - second.z
  );
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      atomIds: [first.atomId, second.atomId],
      value: distance,
      unit: "angstrom",
      complete: true
    }
  };
}
async function ensureStructureAtom(args, atomId) {
  if (!args.state.molecular.atoms.has(atomId)) {
    await queryStructure({
      ...args,
      command: { atomIds: [atomId], limit: 1 }
    });
  }
}
async function analyzeStructureContacts(args) {
  const { logicalSessionId, state, command, signal } = args;
  signal.throwIfAborted();
  const cutoff = command.cutoffAngstrom ?? command.cutoff ?? 4;
  if (typeof cutoff !== "number" || !Number.isFinite(cutoff) || cutoff <= 0 || cutoff > 100) {
    fail3(
      "INVALID_REQUEST",
      "A molecular contact cutoff must be between 0 and 100 angstrom"
    );
  }
  if (!state.molecular.complete) {
    fail3(
      "INCOMPLETE_INDEX",
      "A complete source-backed molecular index is required for authoritative contacts"
    );
  }
  const requestedIds = command.ligandAtomIds ?? command.atomIds;
  if (requestedIds != null && (!isStringArray(requestedIds) || requestedIds.length === 0 || requestedIds.length > MAX_RESULT_ATOMS)) {
    fail3(
      "INVALID_REQUEST",
      "Ligand contacts require bounded source-backed atom identities"
    );
  }
  const explicit = requestedIds == null ? void 0 : new Set(requestedIds);
  const atoms = [...state.molecular.atoms.values()];
  if (atoms.length > MAX_RESULT_ATOMS) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The complete molecular contact request exceeds its atom budget"
    );
  }
  const ligands = atoms.filter(
    (atom) => explicit == null ? atom.recordType === "HETATM" : explicit.has(atom.atomId)
  );
  if (ligands.length === 0 || explicit != null && ligands.length !== explicit.size) {
    fail3(
      "NOT_FOUND",
      "The requested contact atoms are not present in the approved source"
    );
  }
  const ligandIds = new Set(ligands.map((atom) => atom.atomId));
  const contacts = [];
  for (const ligand of ligands) {
    signal.throwIfAborted();
    for (const atom of atoms) {
      if (ligandIds.has(atom.atomId) || atom.model !== ligand.model) {
        continue;
      }
      const distance = Math.hypot(
        ligand.x - atom.x,
        ligand.y - atom.y,
        ligand.z - atom.z
      );
      if (distance <= cutoff) {
        contacts.push({
          ligandAtomId: ligand.atomId,
          atomId: atom.atomId,
          chainId: atom.chainId,
          residueName: atom.residueName,
          residueNumber: atom.residueNumber,
          ...atom.insertionCode == null ? {} : { insertionCode: atom.insertionCode },
          distance,
          unit: "angstrom"
        });
        if (contacts.length > MAX_RESULT_ATOMS) {
          fail3(
            "RESOURCE_EXHAUSTED",
            "The molecular contact result exceeds its bounded budget"
          );
        }
      }
    }
  }
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      sourceRevision: state.molecular.sourceRevision,
      cutoffAngstrom: cutoff,
      contacts,
      complete: true
    }
  };
}
function isStructureProjectResourceUri(value) {
  return typeof value === "string" && value.length <= 4096 && /^viewer-(?:file|data|live-data):\/\/structure-viewer\//u.test(value) && !value.includes("\\") && !value.includes("\0");
}
function rememberStructureTrajectoryProject(args) {
  const { logicalSessionId, state, command, grant, identity, now } = args;
  if (!isOpaqueIdentity(command.objectId) || command.objectId.length > 100 || !isRecord2(command.coordinates) || !isRecord2(command.topology) || !["dcd", "xtc", "trr", "nctraj", "lammpstrj"].includes(
    String(command.coordinatesFormat)
  ) || !["pdb", "mmcif", "gro", "xyz", "psf", "prmtop", "top"].includes(
    String(command.topologyFormat)
  ) || !["none", "backbone", "selection"].includes(String(command.alignment)) || !isSafeProjectRelativePath(command.coordinates.name) || !isSafeProjectRelativePath(command.topology.name) || command.trajectoryRelativePath != null && (!isSafeProjectRelativePath(command.trajectoryRelativePath) || command.trajectoryRelativePath.split("/").at(-1) !== command.coordinates.name) || command.topologyRelativePath != null && (!isSafeProjectRelativePath(command.topologyRelativePath) || command.topologyRelativePath.split("/").at(-1) !== command.topology.name) || !isStructureProjectResourceUri(command.coordinates.resourceUri) || !isStructureProjectResourceUri(command.topology.resourceUri)) {
    fail3(
      "INVALID_REQUEST",
      "The Structure trajectory companion request is invalid"
    );
  }
  const trajectoryGrant = validateSourceGrant({
    grant: command.trajectorySourceGrant,
    identity,
    logicalSessionId,
    now: now()
  });
  const topologyGrant = command.topologySourceGrant == null ? grant : validateSourceGrant({
    grant: command.topologySourceGrant,
    identity,
    logicalSessionId,
    now: now()
  });
  if (topologyGrant.grantId === grant.grantId && command.topologyFormat !== state.molecular.format) {
    fail3("TOPOLOGY_MISMATCH", "The primary topology format is inconsistent");
  }
  if (trajectoryGrant.sourceIdentity.fileId === grant.sourceIdentity.fileId || trajectoryGrant.sourceIdentity.sizeBytes <= 0n) {
    fail3(
      "PERMISSION_DENIED",
      "The Structure trajectory has no distinct approved source"
    );
  }
  const existing = state.molecular.trajectoryProjects.get(command.objectId);
  if (existing != null && (existing.coordinates.grant.sourceRevision !== trajectoryGrant.sourceRevision || existing.coordinates.resourceUri !== command.coordinates.resourceUri || existing.topology.resourceUri !== command.topology.resourceUri)) {
    fail3(
      "CONFLICT",
      "The Structure trajectory object has a different approved source"
    );
  }
  if (existing == null && state.molecular.trajectoryProjects.size >= MAX_TRAJECTORIES) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The Structure trajectory companion budget is exhausted"
    );
  }
  state.molecular.trajectoryProjects.set(command.objectId, {
    objectId: command.objectId,
    coordinates: {
      format: command.coordinatesFormat,
      grant: trajectoryGrant,
      relativePath: typeof command.trajectoryRelativePath === "string" ? command.trajectoryRelativePath : command.coordinates.name,
      resourceUri: command.coordinates.resourceUri
    },
    topology: {
      format: command.topologyFormat,
      grant: topologyGrant,
      relativePath: typeof command.topologyRelativePath === "string" ? command.topologyRelativePath : command.topology.name,
      resourceUri: command.topology.resourceUri
    }
  });
}
async function mutateStructure(args) {
  const { logicalSessionId, operation, state, command, signal } = args;
  signal.throwIfAborted();
  const action = operation === "control_viewer" && typeof command.action === "string" ? command.action : operation;
  const queueForViewer = operation === "control_viewer" && VIEWER_COMMAND_ACTIONS.has(action);
  const createdAt = Date.now();
  let deadlineAt = createdAt + 12e4;
  if (queueForViewer && command.nativeDeadlineAt !== void 0) {
    if (typeof command.nativeDeadlineAt !== "number" || !Number.isFinite(command.nativeDeadlineAt)) {
      fail3("INVALID_REQUEST", "The Structure viewer command deadline is invalid");
    }
    if (command.nativeDeadlineAt <= createdAt) {
      fail3("DEADLINE_EXCEEDED", "The Structure viewer command has expired");
    }
    deadlineAt = Math.min(deadlineAt, command.nativeDeadlineAt);
  }
  if (queueForViewer && state.molecular.commands.size >= MAX_PENDING_COMMANDS && ![...state.molecular.commands.values()].some(
    (queued) => queued.completion != null
  )) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The Structure viewer command queue is exhausted"
    );
  }
  if (action === "show_ligand_contacts" || action === "ligand_contacts" || action === "contacts") {
    return analyzeStructureContacts(args);
  }
  let viewerOnly = false;
  switch (action) {
    case "set_selection":
    case "select_chain":
    case "select_residue_range":
    case "select_residues":
    case "focus_residue":
    case "focus_ligand": {
      const queried = await queryStructure({ ...args, command });
      const atoms = queried.structuredContent.atoms;
      if (atoms.length === 0) {
        fail3(
          "INCOMPLETE_INDEX",
          "The requested selection has no indexed molecular atoms"
        );
      }
      state.molecular.history.push({
        selectedAtomIds: [...state.molecular.selectedAtomIds],
        scene: { ...state.molecular.scene }
      });
      state.molecular.selectedAtomIds = new Set(
        atoms.map((atom) => atom.atomId)
      );
      break;
    }
    case "set_representation": {
      if (typeof command.representation !== "string" || !["cartoon", "surface", "sphere", "ballStick", "stick"].includes(
        command.representation
      )) {
        fail3(
          "INVALID_REQUEST",
          "The requested molecular representation is unsupported"
        );
      }
      state.molecular.history.push({
        selectedAtomIds: [...state.molecular.selectedAtomIds],
        scene: { ...state.molecular.scene }
      });
      state.molecular.scene.representation = command.representation;
      break;
    }
    case "set_object_visibility":
      if (typeof command.visible !== "boolean") {
        fail3(
          "INVALID_REQUEST",
          "Structure object visibility requires a boolean"
        );
      }
      state.molecular.scene.visibility = command.visible;
      break;
    case "save_scene":
      if (!isOpaqueIdentity(command.name)) {
        fail3(
          "INVALID_REQUEST",
          "A named Structure scene requires a safe identity"
        );
      }
      state.molecular.scenes.set(command.name, {
        selectedAtomIds: [...state.molecular.selectedAtomIds],
        scene: { ...state.molecular.scene }
      });
      break;
    case "load_scene": {
      if (!isOpaqueIdentity(command.name)) {
        fail3(
          "INVALID_REQUEST",
          "A named Structure scene requires a safe identity"
        );
      }
      const scene = state.molecular.scenes.get(command.name);
      if (scene == null) {
        fail3("NOT_FOUND", "The requested Structure scene has not been saved");
      }
      state.molecular.selectedAtomIds = new Set(scene.selectedAtomIds);
      state.molecular.scene = { ...scene.scene };
      break;
    }
    case "undo": {
      const previous = state.molecular.history.pop();
      if (previous == null) {
        fail3(
          "NOT_FOUND",
          "No acknowledged Structure scene operation can be undone"
        );
      }
      state.molecular.selectedAtomIds = new Set(previous.selectedAtomIds);
      state.molecular.scene = previous.scene;
      break;
    }
    case "add_structure":
    case "align_structures":
    case "analyze":
    case "apply_scene":
    case "delete_scene":
    case "derive_object":
    case "export":
    case "get_state":
    case "list_scenes":
    case "measure":
    case "measure_residue_distance":
    case "query":
    case "redo":
    case "remove_structure":
    case "render_image":
    case "render_movie":
    case "reset_view":
    case "set_color":
    case "set_display_mode":
    case "set_view_options":
    case "transform_object":
    case "validate_render":
      if (!queueForViewer) {
        fail3(
          "UNSUPPORTED",
          "The requested Structure operation requires the attached viewer"
        );
      }
      viewerOnly = true;
      break;
    case "load_structure": {
      if (!queueForViewer || !isOpaqueIdentity(command.objectId) || !isRecord2(command.file) || !isSafeProjectRelativePath(command.file.name) || command.structureRelativePath != null && !isSafeProjectRelativePath(command.structureRelativePath) || !isStructureProjectResourceUri(command.file.resourceUri)) {
        fail3("INVALID_REQUEST", "The approved companion structure is invalid");
      }
      const structureGrant = validateSourceGrant({
        grant: command.structureSourceGrant,
        identity: args.identity,
        logicalSessionId,
        now: args.now()
      });
      if (structureGrant.sourceIdentity.fileId === args.grant.sourceIdentity.fileId) {
        fail3("PERMISSION_DENIED", "The companion structure must be distinct");
      }
      state.molecular.structureProjects.set(command.objectId, {
        format: typeof command.format === "string" ? command.format : "pdb",
        grant: structureGrant,
        relativePath: typeof command.structureRelativePath === "string" && isSafeProjectRelativePath(command.structureRelativePath) ? command.structureRelativePath : command.file.name,
        resourceUri: command.file.resourceUri
      });
      viewerOnly = true;
      break;
    }
    case "load_volume": {
      if (!queueForViewer || !isRecord2(command.file) || !isRecord2(command.volume) || !isOpaqueIdentity(command.volume.id) || !isSafeProjectRelativePath(command.file.name) || command.volumeRelativePath != null && !isSafeProjectRelativePath(command.volumeRelativePath) || !isStructureProjectResourceUri(command.file.resourceUri) || typeof command.volume.format !== "string") {
        fail3(
          "INVALID_REQUEST",
          "The approved molecular density volume is invalid"
        );
      }
      await indexStructureVolume({
        ...args,
        command: {
          resourceUri: command.file.resourceUri,
          relativePath: typeof command.volumeRelativePath === "string" && isSafeProjectRelativePath(command.volumeRelativePath) ? command.volumeRelativePath : command.file.name,
          format: command.volume.format,
          volumeSourceGrant: command.volumeSourceGrant
        }
      });
      const volume = state.molecular.volumes.get(command.file.resourceUri);
      if (volume == null) {
        fail3("NOT_FOUND", "The approved molecular volume was not indexed");
      }
      volume.objectId = command.volume.id;
      viewerOnly = true;
      break;
    }
    case "load_trajectory":
      if (!queueForViewer) {
        fail3(
          "UNSUPPORTED",
          "A molecular trajectory requires an attached viewer"
        );
      }
      rememberStructureTrajectoryProject(args);
      viewerOnly = true;
      break;
    case "set_trajectory_state":
      if (!queueForViewer || !isRecord2(command.state) || !isOpaqueIdentity(command.state.objectId) || !state.molecular.trajectoryProjects.has(command.state.objectId)) {
        fail3("NOT_FOUND", "The approved molecular trajectory is not attached");
      }
      viewerOnly = true;
      break;
    default:
      fail3(
        "UNSUPPORTED",
        "The requested Structure control has no molecular implementation"
      );
  }
  signal.throwIfAborted();
  state.revision += 1;
  const viewerCommandId = queueForViewer ? enqueueStructureViewerCommand({ state, command, createdAt, deadlineAt }) : void 0;
  return {
    structuredContent: {
      ...viewerOnly ? { queued: true } : { applied: true },
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      selection: [...state.molecular.selectedAtomIds],
      scene: { ...state.molecular.scene },
      ...viewerCommandId == null ? {} : { viewerCommandId }
    }
  };
}
function structureState(logicalSessionId, state) {
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      state: {
        format: state.molecular.format,
        sourceRevision: state.molecular.sourceRevision,
        indexedAtomCount: state.molecular.atoms.size,
        indexComplete: state.molecular.complete,
        selectedAtomIds: [...state.molecular.selectedAtomIds],
        models: uniqueModels(state.molecular.atoms),
        scene: { ...state.molecular.scene }
      }
    }
  };
}
function validateSourceGrant({ grant, identity, logicalSessionId, now }) {
  if (!isCurrentSourceGrant(grant, identity, logicalSessionId, now)) {
    fail3(
      "PERMISSION_DENIED",
      "The Structure source capability is not current or authorized"
    );
  }
  return grant;
}
function isCurrentSourceGrant(grant, identity, logicalSessionId, now) {
  return isRecord2(grant) && grant.family === "structure" && grant.logicalSessionId === logicalSessionId && grant.backendInstanceId === identity.backendInstanceId && grant.backendGeneration === identity.backendGeneration && grant.revocationEpoch === identity.revocationEpoch && isOpaqueIdentity(grant.grantId) && isOpaqueIdentity(grant.sourceHandleId) && typeof grant.sourceRevision === "string" && isRecord2(grant.sourceIdentity) && isOpaqueIdentity(grant.sourceIdentity.fileId) && grant.sourceIdentity.etag === grant.sourceRevision && typeof grant.sourceIdentity.sizeBytes === "bigint" && isStringArray(grant.operations) && grant.operations.includes("range-read") && typeof grant.issuedAtMs === "number" && Number.isSafeInteger(grant.issuedAtMs) && typeof grant.expiresAtMs === "number" && Number.isSafeInteger(grant.expiresAtMs) && grant.issuedAtMs <= now && grant.expiresAtMs > now;
}
function detectStructureFormat(bytes, hint) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail3(
      "MALFORMED_STRUCTURE",
      "The approved molecular header is not valid UTF-8"
    );
  }
  if (hint === "pdb" || hint === "pdbqt" || hint === "pqr" || hint === "mol" || hint === "sdf" || hint === "mol2" || hint === "gro" || hint === "xyz") {
    return hint;
  }
  if (hint === "mmcif" || hint === "cif" || /^data_/mu.test(text) || /_atom_site\./u.test(text)) {
    return "mmcif";
  }
  if (/^(?:HEADER|TITLE|REMARK|MODEL\s|ATOM\s|HETATM)/mu.test(text)) {
    return "pdb";
  }
  fail3(
    "UNSUPPORTED",
    "The authorized source is not a supported molecular structure"
  );
}
function hasStructureHeader(bytes, format) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  switch (format) {
    case "pdb":
    case "pdbqt":
    case "pqr":
      return /^(?:HEADER|TITLE|REMARK|MODEL\s|ATOM\s|HETATM)/mu.test(text);
    case "mmcif":
      return /^data_/mu.test(text) || /_atom_site\./u.test(text);
    case "mol":
    case "sdf":
      return /^.{0,80}V(?:2000|3000)/mu.test(text);
    case "mol2":
      return /^@<TRIPOS>(?:MOLECULE|ATOM)/mu.test(text);
    case "gro":
      return /^[^\n]*\n\s*\d+/u.test(text);
    case "xyz":
      return /^\s*\d+/u.test(text);
  }
}
function atomPageCursorRequired(logicalSessionId, state, offset) {
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      sourceRevision: state.molecular.sourceRevision,
      sourceSizeBytesDecimal: state.molecular.sizeBytes.toString(),
      format: state.molecular.format,
      offsetDecimal: offset.toString(),
      atomPageStatus: "cursor-required"
    }
  };
}
function retainMmcifPageBoundary(state, offset) {
  const framing = state.mmcifFraming;
  if (state.format !== "mmcif" || !state.mmcifTrustedRange || framing == null)
    return;
  framing.pageBoundaries ??= /* @__PURE__ */ new Map();
  if (!framing.pageBoundaries.has(offset) && framing.pageBoundaries.size >= MAX_MMCIF_PAGE_BOUNDARIES) {
    const oldest = framing.pageBoundaries.keys().next().value;
    if (oldest != null) framing.pageBoundaries.delete(oldest);
  }
  const range = framing.atomRanges.find(
    ({ start, end }) => offset >= start && offset <= end
  );
  framing.pageBoundaries.set(offset, {
    headers: [...range?.headers ?? state.headers],
    blockStart: range?.blockStart ?? state.mmcifBlockStart
  });
}
function createRegionState(state, model, framedOffset) {
  if (model != null && (typeof model !== "number" || !Number.isSafeInteger(model) || model <= 0)) {
    fail3(
      "INVALID_REQUEST",
      "A selected molecular model must be a positive integer"
    );
  }
  const packetBoundary = framedOffset == null ? void 0 : state.mmcifFraming?.pageBoundaries?.get(framedOffset);
  const knownAtomRange = framedOffset == null ? void 0 : state.mmcifFraming?.atomRanges.find(
    ({ start, end }) => framedOffset >= start && framedOffset <= end
  );
  if (knownAtomRange?.lineAligned === false && framedOffset !== knownAtomRange.start && packetBoundary == null) {
    fail3(
      "INVALID_REQUEST",
      "Use a returned atom-page cursor to resume a wrapped mmCIF packet range"
    );
  }
  return {
    format: state.format,
    atoms: /* @__PURE__ */ new Map(),
    decoder: new TextDecoder("utf-8", { fatal: true }),
    evicted: false,
    headers: [
      ...packetBoundary?.headers ?? knownAtomRange?.headers ?? state.mmcifAtomHeaders ?? state.headers
    ],
    mmcifAtomHeaders: state.mmcifAtomHeaders,
    mmcifAtomHeadersInferred: state.format === "mmcif",
    mmcifBlockStart: framedOffset === 0n ? 0n : packetBoundary?.blockStart ?? knownAtomRange?.blockStart ?? 0n,
    mmcifAtomBlocks: /* @__PURE__ */ new Map(),
    mmcifMetadata: state.mmcifMetadata,
    mmcifFraming: state.mmcifFraming,
    mmcifTrustedRange: framedOffset === 0n || packetBoundary != null || knownAtomRange != null,
    mmcifCurrentAtomRange: knownAtomRange,
    mmcifLoop: state.format === "mmcif",
    model: model ?? state.model,
    pending: "",
    complete: false,
    scanOffset: 0n,
    recordEndOffsets: /* @__PURE__ */ new Map()
  };
}
function matchAtoms(atoms, command) {
  const atomIds = isStringArray(command.atomIds) ? new Set(command.atomIds) : null;
  const residueStart = readOptionalResidue(
    command.residueStart,
    "residue start"
  );
  const residueEnd = readOptionalResidue(command.residueEnd, "residue end");
  return [...atoms.values()].filter(
    (atom) => (atomIds == null || atomIds.has(atom.atomId)) && (command.chainId == null || command.chainId === atom.chainId) && (command.model == null || command.model === atom.model) && (command.residueNumber == null || command.residueNumber === atom.residueNumber) && (residueStart == null || atom.residueNumber >= residueStart) && (residueEnd == null || atom.residueNumber <= residueEnd) && (command.insertionCode == null || command.insertionCode === atom.insertionCode)
  );
}
function readOptionalResidue(value, name) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    fail3("INVALID_REQUEST", `The ${name} must be a safe integer`);
  }
  return value;
}
function atomResult(logicalSessionId, state, atoms, complete, offset) {
  return {
    structuredContent: {
      viewerSessionId: logicalSessionId,
      viewerCommandRevision: state.revision,
      sourceRevision: state.molecular.sourceRevision,
      atoms,
      complete,
      ...offset == null ? {} : { offsetDecimal: offset.toString() }
    }
  };
}
function uniqueModels(atoms) {
  return [...new Set([...atoms.values()].map((atom) => atom.model))].sort(
    (left, right) => left - right
  );
}
function parseOffset(value, sizeBytes) {
  if (typeof value !== "string" || !DECIMAL2.test(value)) {
    fail3("INVALID_REQUEST", "A Structure offset must be an unsigned decimal");
  }
  const offset = BigInt(value);
  if (offset >= sizeBytes) {
    fail3(
      "RESOURCE_EXHAUSTED",
      "The requested Structure range is outside the source"
    );
  }
  return offset;
}
function readPositive(value, maximum, name) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    fail3("RESOURCE_EXHAUSTED", `The ${name} exceeds its bounded source policy`);
  }
  return value;
}
function isOpaqueIdentity(value) {
  return typeof value === "string" && value.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}
function isRecord2(value) {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function fail3(code, message) {
  const error = Object.assign(new Error(message), {
    name: "ScientificStructureRuntimeError",
    code
  });
  throw error;
}

// node_modules/.pnpm/@openai+scientific-viewer-platform@file+..+scientific-viewer-platform/node_modules/@openai/scientific-viewer-platform/src/structure/scientific-structure-backend-entrypoint.mjs
var MAX_CHECKPOINT_BYTES = 256 * 1024;
var MAX_SESSIONS2 = 128;
var MAX_REQUEST_ID_LENGTH = 128;
var MAX_ARTIFACT_CHUNK_BYTES2 = 256 * 1024;
var MAX_ARTIFACT_REQUESTS = 16;
function startScientificStructureBackend({
  environment = process.env,
  channel = process,
  now = Date.now
} = {}) {
  const identity = readStructureIdentity(environment);
  if (typeof channel.send !== "function" || typeof channel.on !== "function") {
    throw new Error(
      "The Structure backend requires a private host IPC channel"
    );
  }
  const sessions = /* @__PURE__ */ new Map();
  const activeRequests = /* @__PURE__ */ new Map();
  const pendingSourceReads = /* @__PURE__ */ new Map();
  const pendingArtifactWrites = /* @__PURE__ */ new Map();
  const artifactTransactions = /* @__PURE__ */ new Map();
  let nextSourceReadId = 0;
  let nextArtifactRequestId = 0;
  let disposed = false;
  const send = (message) => {
    if (!disposed && channel.connected !== false) {
      channel.send(message);
    }
  };
  const reply = (request, result, error) => {
    send({
      type: "scientific-viewer/response",
      requestId: request.requestId,
      backendInstanceId: identity.backendInstanceId,
      backendGeneration: identity.backendGeneration,
      instanceNonce: identity.instanceNonce,
      ...error == null ? { result } : { error: `${error.code}: ${error.message}` }
    });
  };
  const readSource = ({ grant, logicalSessionId, offset, length, signal }) => {
    signal?.throwIfAborted();
    if (typeof offset !== "bigint" || offset < 0n || !Number.isSafeInteger(length) || length <= 0 || length > 256 * 1024) {
      throw new StructureBackendError(
        "RESOURCE_EXHAUSTED",
        "The Structure source read exceeds its positioned request budget"
      );
    }
    const requestId = `structure-range-${++nextSourceReadId}`;
    return new Promise((resolve, reject) => {
      const abort = () => {
        pendingSourceReads.delete(requestId);
        reject(
          new StructureBackendError(
            "CANCELLED",
            "The Structure source read was cancelled"
          )
        );
      };
      pendingSourceReads.set(requestId, {
        resolve,
        reject,
        signal,
        abort,
        logicalSessionId,
        sourceRevision: grant.sourceRevision,
        offsetDecimal: offset.toString(),
        length
      });
      signal?.addEventListener("abort", abort, { once: true });
      send({
        type: "scientific-viewer/source-read",
        requestId,
        family: "structure",
        logicalSessionId,
        backendInstanceId: identity.backendInstanceId,
        backendGeneration: identity.backendGeneration,
        revocationEpoch: identity.revocationEpoch,
        instanceNonce: identity.instanceNonce,
        sourceGrantId: grant.grantId,
        sourceRevision: grant.sourceRevision,
        offsetDecimal: offset.toString(),
        length
      });
    });
  };
  const settleSourceRead = (message) => {
    const pending = pendingSourceReads.get(message.requestId);
    if (pending == null || message.family !== "structure" || message.logicalSessionId !== pending.logicalSessionId || message.backendInstanceId !== identity.backendInstanceId || message.backendGeneration !== identity.backendGeneration || message.instanceNonce !== identity.instanceNonce || message.revocationEpoch !== identity.revocationEpoch) {
      return;
    }
    pendingSourceReads.delete(message.requestId);
    pending.signal?.removeEventListener("abort", pending.abort);
    if (message.type === "scientific-viewer/source-read-error") {
      pending.reject(
        new StructureBackendError(
          typeof message.code === "string" ? message.code : "PERMISSION_DENIED",
          "The host refused the authorized Structure source range"
        )
      );
      return;
    }
    if (message.sourceRevision !== pending.sourceRevision || message.offsetDecimal !== pending.offsetDecimal || !(message.bytes instanceof Uint8Array) || message.bytes.byteLength > pending.length || typeof message.eof !== "boolean" || message.bytes.byteLength < pending.length && !message.eof) {
      pending.reject(
        new StructureBackendError(
          "SOURCE_CHANGED",
          "The host returned an invalid or stale Structure source range"
        )
      );
      return;
    }
    pending.resolve({ bytes: message.bytes, eof: message.eof });
  };
  const writeArtifact = ({ logicalSessionId, operation, payload, signal }) => {
    signal?.throwIfAborted();
    if (!isOpaqueIdentity2(logicalSessionId, 512) || !["begin", "append", "commit", "abort", "resume"].includes(operation) || !isRecord3(payload) || !isOpaqueIdentity2(payload.destinationGrantId, 512)) {
      throw new StructureBackendError(
        "PERMISSION_DENIED",
        "The Structure artifact request is not host-authorized"
      );
    }
    if (operation === "append" && (!(payload.bytes instanceof Uint8Array) || payload.bytes.byteLength === 0 || payload.bytes.byteLength > MAX_ARTIFACT_CHUNK_BYTES2)) {
      throw new StructureBackendError(
        "RESOURCE_EXHAUSTED",
        "The Structure artifact chunk exceeds its host IPC budget"
      );
    }
    if (pendingArtifactWrites.size >= MAX_ARTIFACT_REQUESTS) {
      throw new StructureBackendError(
        "RESOURCE_EXHAUSTED",
        "The Structure artifact request budget is exhausted"
      );
    }
    const requestId = `structure-artifact-${++nextArtifactRequestId}`;
    return new Promise((resolve, reject) => {
      const abort = () => {
        pendingArtifactWrites.delete(requestId);
        reject(
          new StructureBackendError(
            "CANCELLED",
            "The Structure artifact write was cancelled"
          )
        );
      };
      pendingArtifactWrites.set(requestId, {
        abort,
        logicalSessionId,
        reject,
        resolve,
        signal
      });
      signal?.addEventListener("abort", abort, { once: true });
      send({
        type: "scientific-viewer/artifact-request",
        requestId,
        family: "structure",
        logicalSessionId,
        backendInstanceId: identity.backendInstanceId,
        backendGeneration: identity.backendGeneration,
        revocationEpoch: identity.revocationEpoch,
        instanceNonce: identity.instanceNonce,
        operation,
        payload
      });
    });
  };
  const settleArtifactWrite = (message) => {
    const pending = pendingArtifactWrites.get(message.requestId);
    if (pending == null || message.family !== "structure" || message.logicalSessionId !== pending.logicalSessionId || message.backendInstanceId !== identity.backendInstanceId || message.backendGeneration !== identity.backendGeneration || message.revocationEpoch !== identity.revocationEpoch || message.instanceNonce !== identity.instanceNonce) {
      return;
    }
    pendingArtifactWrites.delete(message.requestId);
    pending.signal?.removeEventListener("abort", pending.abort);
    if (message.type === "scientific-viewer/artifact-error") {
      const code = typeof message.error === "string" && /^[A-Z][A-Z_]{0,63}$/u.test(message.error) ? message.error : "PERMISSION_DENIED";
      pending.reject(
        new StructureBackendError(
          code,
          "The host refused the authorized Structure artifact write"
        )
      );
      return;
    }
    if (!isRecord3(message.result)) {
      pending.reject(
        new StructureBackendError(
          "INVALID_REQUEST",
          "The host returned an invalid Structure artifact transaction"
        )
      );
      return;
    }
    pending.resolve(message.result);
  };
  const heartbeat = () => send({
    type: "scientific-viewer/heartbeat",
    backendInstanceId: identity.backendInstanceId,
    backendGeneration: identity.backendGeneration,
    instanceNonce: identity.instanceNonce,
    processId: process.pid,
    sentAtMs: now(),
    activeSessions: sessions.size,
    activeStreams: activeRequests.size,
    bufferedBytes: 0
  });
  const handleRequest = async (request) => {
    if (!validRequestIdentity(request, identity)) {
      return;
    }
    if (!isOpaqueIdentity2(request.requestId, MAX_REQUEST_ID_LENGTH)) {
      return;
    }
    if (activeRequests.has(request.requestId)) {
      reply(request, void 0, {
        code: "CONFLICT",
        message: "A Structure request with that identity is already active"
      });
      return;
    }
    const controller = new AbortController();
    activeRequests.set(request.requestId, controller);
    try {
      const result = await dispatchStructureRequest({
        request,
        sessions,
        identity,
        readSource,
        writeArtifact,
        artifactTransactions,
        now,
        signal: controller.signal
      });
      controller.signal.throwIfAborted();
      reply(request, result);
    } catch (error) {
      reply(request, void 0, {
        code: error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "INVALID_REQUEST",
        message: error instanceof Error ? error.message : "The Structure request failed"
      });
    } finally {
      activeRequests.delete(request.requestId);
    }
  };
  const onMessage = (message) => {
    if (disposed || !isRecord3(message)) {
      return;
    }
    switch (message.type) {
      case "scientific-viewer/heartbeat-request":
        if (validRequestIdentity(message, identity, true)) {
          heartbeat();
        }
        return;
      case "scientific-viewer/request":
        void handleRequest(message);
        return;
      case "scientific-viewer/source-read-result":
      case "scientific-viewer/source-read-error":
        settleSourceRead(message);
        return;
      case "scientific-viewer/artifact-result":
      case "scientific-viewer/artifact-error":
        settleArtifactWrite(message);
        return;
      case "scientific-viewer/cancel":
        if (validRequestIdentity(message, identity)) {
          activeRequests.get(message.requestId)?.abort();
        }
        return;
      case "scientific-viewer/shutdown":
        if (validRequestIdentity(message, identity)) {
          dispose();
        }
        return;
      default:
        return;
    }
  };
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    channel.removeListener("message", onMessage);
    for (const controller of activeRequests.values()) {
      controller.abort();
    }
    activeRequests.clear();
    for (const pending of pendingSourceReads.values()) {
      pending.signal?.removeEventListener("abort", pending.abort);
      pending.reject(
        new StructureBackendError(
          "CANCELLED",
          "The Structure backend source channel was closed"
        )
      );
    }
    pendingSourceReads.clear();
    for (const pending of pendingArtifactWrites.values()) {
      pending.signal?.removeEventListener("abort", pending.abort);
      pending.reject(
        new StructureBackendError(
          "CANCELLED",
          "The Structure backend artifact channel was closed"
        )
      );
    }
    pendingArtifactWrites.clear();
    artifactTransactions.clear();
    sessions.clear();
  };
  channel.on("message", onMessage);
  send({
    type: "scientific-viewer/hello",
    protocolVersion: 1,
    family: "structure",
    backendInstanceId: identity.backendInstanceId,
    backendGeneration: identity.backendGeneration,
    revocationEpoch: identity.revocationEpoch,
    instanceNonce: identity.instanceNonce,
    processId: process.pid,
    startedAtMs: now()
  });
  return { dispose };
}
var StructureBackendError = class extends Error {
  /** @type {string} */
  code;
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "StructureBackendError";
    this.code = code;
  }
};
async function dispatchStructureRequest({
  request,
  sessions,
  identity,
  readSource,
  writeArtifact,
  artifactTransactions,
  now,
  signal
}) {
  signal.throwIfAborted();
  const payload = request.payload;
  if (typeof request.operation === "string" && request.operation.startsWith("ui/scientific/structure/")) {
    return executeScientificStructureTool({
      operation: request.operation.slice("ui/scientific/structure/".length),
      payload,
      sessions,
      identity,
      readSource,
      writeArtifact,
      artifactTransactions,
      now,
      signal
    });
  }
  switch (request.operation) {
    case "session/restore": {
      if (!isRecord3(payload) || !isOpaqueIdentity2(payload.logicalSessionId, 256)) {
        throw new StructureBackendError(
          "INVALID_REQUEST",
          "Structure restore requires an opaque logical session identity"
        );
      }
      const state = isRecord3(payload.payload) ? payload.payload : payload;
      const checkpoint = state.checkpoint;
      const revision = state.lastAcknowledgedRevision ?? state.revision ?? 0;
      if (!Number.isSafeInteger(revision) || revision < 0) {
        throw new StructureBackendError(
          "INVALID_REQUEST",
          "The Structure checkpoint revision is invalid"
        );
      }
      const checkpointBytes = checkpointSize(checkpoint);
      if (checkpointBytes > MAX_CHECKPOINT_BYTES) {
        throw new StructureBackendError(
          "RESOURCE_EXHAUSTED",
          "The Structure checkpoint exceeds the 256 KiB recovery limit"
        );
      }
      const previous = sessions.get(payload.logicalSessionId);
      if (previous != null && revision < previous.revision) {
        throw new StructureBackendError(
          "CONFLICT",
          "The Structure checkpoint revision is older than acknowledged state"
        );
      }
      if (previous == null && sessions.size >= MAX_SESSIONS2) {
        throw new StructureBackendError(
          "RESOURCE_EXHAUSTED",
          "The Structure backend session budget is exhausted"
        );
      }
      signal.throwIfAborted();
      sessions.set(payload.logicalSessionId, {
        revision,
        checkpoint: checkpoint instanceof Uint8Array ? checkpoint.slice() : checkpoint
      });
      return {
        logicalSessionId: payload.logicalSessionId,
        revision,
        restored: true
      };
    }
    case "session/get": {
      if (!isRecord3(payload) || !isOpaqueIdentity2(payload.logicalSessionId, 256)) {
        throw new StructureBackendError(
          "INVALID_REQUEST",
          "Structure session lookup requires an opaque logical identity"
        );
      }
      const state = sessions.get(payload.logicalSessionId);
      if (state == null) {
        throw new StructureBackendError(
          "NOT_FOUND",
          "The Structure backend does not own that logical session"
        );
      }
      return {
        logicalSessionId: payload.logicalSessionId,
        revision: state.revision
      };
    }
    case "session/release": {
      if (!isRecord3(payload) || !isOpaqueIdentity2(payload.logicalSessionId, 256)) {
        throw new StructureBackendError(
          "INVALID_REQUEST",
          "Structure session release requires an opaque logical identity"
        );
      }
      return {
        logicalSessionId: payload.logicalSessionId,
        released: sessions.delete(payload.logicalSessionId)
      };
    }
    case "backend/health":
      return {
        family: "structure",
        activeSessions: sessions.size,
        maxCheckpointBytes: MAX_CHECKPOINT_BYTES
      };
    default:
      throw new StructureBackendError(
        "UNSUPPORTED",
        "The requested operation is not enabled in the Structure backend"
      );
  }
}
function readStructureIdentity(environment) {
  if (environment.SCIENTIFIC_VIEWER_FAMILY !== "structure") {
    throw new Error("The Structure backend cannot serve another viewer family");
  }
  const backendInstanceId = environment.SCIENTIFIC_VIEWER_BACKEND_INSTANCE;
  const instanceNonce = environment.SCIENTIFIC_VIEWER_INSTANCE_NONCE;
  if (!isOpaqueIdentity2(backendInstanceId, 256) || !isOpaqueIdentity2(instanceNonce, 256)) {
    throw new Error("The Structure backend process identity is unavailable");
  }
  return {
    backendInstanceId,
    instanceNonce,
    backendGeneration: readCounter(
      environment.SCIENTIFIC_VIEWER_BACKEND_GENERATION,
      "generation"
    ),
    revocationEpoch: readCounter(
      environment.SCIENTIFIC_VIEWER_REVOCATION_EPOCH,
      "revocation epoch"
    )
  };
}
function validRequestIdentity(message, identity, allowUnidentified = false) {
  if (allowUnidentified && message.backendInstanceId == null) {
    return true;
  }
  return message.backendInstanceId === identity.backendInstanceId && message.backendGeneration === identity.backendGeneration && message.instanceNonce === identity.instanceNonce && (message.family == null || message.family === "structure");
}
function checkpointSize(value) {
  if (value == null) {
    return 0;
  }
  if (value instanceof Uint8Array) {
    return value.byteLength;
  }
  if (typeof value === "string") {
    return new TextEncoder().encode(value).byteLength;
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized == null) {
      throw new Error("Invalid checkpoint");
    }
    return new TextEncoder().encode(serialized).byteLength;
  } catch {
    throw new StructureBackendError(
      "INVALID_REQUEST",
      "The Structure checkpoint cannot be safely serialized"
    );
  }
}
function readCounter(value, label) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`The Structure backend ${label} is invalid`);
  }
  const counter = Number(value);
  if (!Number.isSafeInteger(counter)) {
    throw new Error(`The Structure backend ${label} exceeds the safe range`);
  }
  return counter;
}
function isOpaqueIdentity2(value, maxLength) {
  return typeof value === "string" && value.length <= maxLength && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}
function isRecord3(value) {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
if (process.env.SCIENTIFIC_VIEWER_FAMILY === "structure" && typeof process.send === "function") {
  startScientificStructureBackend();
}
export {
  startScientificStructureBackend
};
/*! Bundled license information:

@openai/scientific-viewer-platform/src/structure/scientific-structure-native-trajectory-bundle.mjs:
  (*!
   * Portions of the GROMACS XTC xdr3dfcoord decoder are derived from the Mol*
   * project, Copyright (c) 2020 Mol* contributors, under the MIT License:
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to
   * deal in the Software without restriction, including without limitation the
   * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
   * sell copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
   * IN THE SOFTWARE.
   *)
*/
