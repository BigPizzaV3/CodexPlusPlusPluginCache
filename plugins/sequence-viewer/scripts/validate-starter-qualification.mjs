import { createHash } from "node:crypto";

import {
  SOURCE_SNAPSHOT_DIGEST_ALGORITHM,
  SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES,
} from "./source-snapshot.mjs";

const QUALIFICATION_SCHEMA_VERSION = 1;
const MAX_QUALIFICATION_BYTES = 2 * 1_024 * 1_024;
const MAX_REPORT_BYTES = 1 * 1_024 * 1_024;
const MAX_TEXT_BYTES = 32 * 1_024;
const MAX_LIST_ITEMS = 100;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_HASH_PATTERN = /^[a-f0-9]{40,64}$/u;
const HTTPS_URL_PATTERN = /^https:\/\/[^\s]+$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const LEGACY_PLUGIN_MANAGED_STARTER_VERSION = "0.1.26";
const LEGACY_PUBLIC_EXAMPLE_TOOL_NAME = "sequence.acquire_public_example";
const CHAT_OPEN_TOOL_NAME = "sequence.open_from_chat";
const RAS_STARTER_ID = "uniprot-human-ras-sv1";
const LEGACY_RAS_PUBLICATION_OPERATION =
  "sequence.export_artifact newick to workspace";

export const REQUIRED_STARTER_NEGATIVE_CASES = Object.freeze([
  "network-unavailable",
  "rate-limit",
  "malformed-database-response",
  "accession-missing",
  "payload-format-mismatch",
  "oversized-source-or-analysis-budget",
  "deterministic-subset-failure",
  "optional-skill-unavailable-fallback",
  "output-collision",
  "output-quota-failure",
  "viewer-retry-remount",
]);

export function validateStarterQualification({
  manifest,
  qualification,
  reportMarkdown,
  starterContract,
}) {
  assertPlainObject(qualification, "Qualification must be an object");
  assertPlainObject(starterContract, "Starter contract must be an object");
  assertPlainObject(manifest, "Plugin manifest must be an object");
  assertBoundedJson(qualification);
  assertText(reportMarkdown, "Qualification report markdown", {
    maxBytes: MAX_REPORT_BYTES,
  });

  assert(
    qualification.schemaVersion === QUALIFICATION_SCHEMA_VERSION,
    `Qualification must use schemaVersion ${QUALIFICATION_SCHEMA_VERSION}`,
  );
  assert(
    qualification.contractSchemaVersion === starterContract.schemaVersion,
    "Qualification and starter contract schema versions must match",
  );
  assert(
    qualification.issue === "LSC-109" && qualification.status === "passed",
    "LSC-109 qualification status must be passed",
  );
  assertText(qualification.qualifiedAt, "Qualification timestamp");
  assert(
    isUtcIsoDate(qualification.qualifiedAt),
    "Qualification timestamp must be UTC ISO-8601",
  );
  assert(
    qualification.pluginVersion === starterContract.pluginVersion &&
      qualification.pluginVersion === manifest.version,
    "Qualification, starter contract, and manifest plugin versions must match",
  );
  assert(
    qualification.manifestName === manifest.name,
    "Qualification and manifest plugin names must match",
  );

  const contractExamples = starterContract.examples;
  assert(
    Array.isArray(contractExamples) && contractExamples.length === 3,
    "Starter contract must contain exactly three examples",
  );
  const expectedIds = contractExamples.map(({ id }) => id);
  const expectedPrompts = contractExamples.map(({ prompt }) => prompt);
  assert(
    new Set(expectedIds).size === expectedIds.length &&
      expectedIds.every((id) => nonEmptyText(id)),
    "Starter contract example IDs must be unique non-empty strings",
  );
  assert(
    Array.isArray(manifest.interface?.defaultPrompt) &&
      deepEqual(manifest.interface.defaultPrompt, expectedPrompts),
    "Manifest prompts must exactly match the ordered starter contract prompts",
  );
  assert(
    Array.isArray(qualification.examples) &&
      qualification.examples.length === contractExamples.length &&
      deepEqual(
        qualification.examples.map(({ id }) => id),
        expectedIds,
      ) &&
      deepEqual(
        qualification.examples.map(({ prompt }) => prompt),
        expectedPrompts,
      ),
    "Qualification examples must exactly match the ordered starter IDs and prompts",
  );

  validateEnvironment(qualification.environment, {
    manifest,
    pluginVersion: qualification.pluginVersion,
  });
  const historicalPluginManagedAcquisition =
    qualification.pluginVersion === LEGACY_PLUGIN_MANAGED_STARTER_VERSION &&
    qualification.pluginVersion ===
      starterContract.downstreamQualification?.lastQualifiedPluginVersion;
  for (let index = 0; index < contractExamples.length; index += 1) {
    validateExample(
      qualification.examples[index],
      contractExamples[index],
      qualification.environment,
      { historicalPluginManagedAcquisition },
    );
  }
  validateNegativeCases(
    qualification.negativeCases,
    qualification.environment.bundle.sha256,
    qualification.environment.sourceBinding.evidenceArchive,
  );
  validateRelatedIssues(qualification.relatedIssues);
  validateLimitsAndNondeterminism(qualification, contractExamples);
  validateReportBinding(qualification.report, reportMarkdown);
  validateReportSynchronization(qualification, reportMarkdown, contractExamples);

  const serialized = JSON.stringify(qualification);
  for (const forbidden of ["file://", "/home/", "/Users/", "smoke-fixtures/"]) {
    assert(
      !serialized.includes(forbidden) && !reportMarkdown.includes(forbidden),
      `Qualification evidence must not disclose or rely on ${forbidden}`,
    );
  }
}

function validateEnvironment(environment, { manifest, pluginVersion }) {
  assertPlainObject(environment, "Qualification environment must be an object");

  const bundle = environment.bundle;
  assertPlainObject(bundle, "Qualification bundle metadata must be an object");
  assert(
    bundle.kind === "marketplace-bundle",
    "Qualification must exercise the marketplace bundle",
  );
  assertSha256(bundle.sha256, "Bundle digest");
  assertSha256(bundle.manifestSha256, "Bundled manifest digest");
  assertSha256(
    bundle.starterContractSha256,
    "Bundled starter contract digest",
  );
  assertPositiveInteger(bundle.fileCount, "Bundle file count");
  assertPositiveInteger(bundle.byteLength, "Bundle byte length");
  validateSourceBinding(environment.sourceBinding, bundle);

  validateVersionedComponent(environment.plugin, "Plugin");
  validateVersionedComponent(environment.server, "Server");
  assert(
    environment.plugin.name === manifest.name &&
      environment.plugin.version === pluginVersion &&
      environment.server.version === pluginVersion,
    "Qualified plugin and server versions must match the manifest",
  );

  const host = environment.host;
  assertPlainObject(host, "Installed host metadata must be an object");
  for (const [field, value] of Object.entries({
    build: host.build,
    name: host.name,
    version: host.version,
  })) {
    assertText(value, `Installed host ${field}`);
  }

  const os = environment.os;
  assertPlainObject(os, "OS metadata must be an object");
  for (const [field, value] of Object.entries({
    architecture: os.architecture,
    platform: os.platform,
    release: os.release,
  })) {
    assertText(value, `OS ${field}`);
  }

  const model = environment.model;
  assertPlainObject(model, "Model metadata must be an object");
  assertText(model.name, "Model name");
  assert(
    nonEmptyText(model.configuration) || objectHasKeys(model.configuration),
    "Model configuration must be recorded",
  );
  assertText(environment.reasoning?.level, "Reasoning level");
  assert(
    environment.reasoning.level === "Ultra",
    "Qualification reasoning level must be Ultra",
  );
  assertText(environment.reasoning.description, "Reasoning configuration");

  const optionalSkills = environment.optionalLifeScienceSkills;
  assertPlainObject(
    optionalSkills,
    "Optional Life Science Research skill inventory must be an object",
  );
  assertBoundedTextArray(
    optionalSkills.available,
    "Available optional Life Science Research skills",
    { allowEmpty: true },
  );
  assertBoundedTextArray(
    optionalSkills.unavailable,
    "Unavailable optional Life Science Research skills",
  );
  assert(
    optionalSkills.inventoryRecorded === true &&
      optionalSkills.unavailableFallbackQualified === true &&
      optionalSkills.unavailable.every(
        (skill) => !optionalSkills.available.includes(skill),
      ),
    "Optional-skill inventory and unavailable official-endpoint fallback must be qualified",
  );
}

function validateSourceBinding(binding, bundle) {
  assertPlainObject(binding, "Source binding must be an object");
  assertPlainObject(
    binding.executionRevision,
    "Source binding execution revision must be an object",
  );
  assert(
    GIT_HASH_PATTERN.test(binding.executionRevision.commitSha ?? "") &&
      GIT_HASH_PATTERN.test(binding.executionRevision.treeSha ?? ""),
    "Source binding must record the committed execution revision and tree",
  );
  const snapshot = binding.submittedSourceSnapshot;
  assertPlainObject(
    snapshot,
    "Submitted source snapshot binding must be an object",
  );
  assert(
    snapshot.kind === "tracked-plugin-source" &&
      snapshot.digestAlgorithm === SOURCE_SNAPSHOT_DIGEST_ALGORITHM,
    "Submitted source snapshot must use the canonical tracked-plugin digest",
  );
  assertSha256(snapshot.sha256, "Submitted source snapshot digest");
  assertPositiveInteger(
    snapshot.fileCount,
    "Submitted source snapshot file count",
  );
  assertPositiveInteger(
    snapshot.byteLength,
    "Submitted source snapshot byte length",
  );
  assert(
    deepEqual(
      snapshot.excludedEvidenceFiles,
      SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES,
    ),
    "Submitted source snapshot may exclude only the two self-referential evidence files",
  );
  assert(
    binding.runtimeBundleSha256 === bundle.sha256,
    "Source binding runtime bundle must match the qualified bundle digest",
  );
  assertPlainObject(
    binding.qualificationRun,
    "Source binding qualification run must be an object",
  );
  assert(
    HTTPS_URL_PATTERN.test(binding.qualificationRun.url ?? "") &&
      SHA256_PATTERN.test(binding.qualificationRun.sha256 ?? ""),
    "Source binding qualification run must have an HTTPS link and SHA-256",
  );
  validateDirectEvidenceBinding(
    binding.evidenceManifest,
    "Source binding evidence manifest",
  );
  validateDirectEvidenceBinding(
    binding.evidenceArchive,
    "Source binding evidence archive",
  );
}

function validateVersionedComponent(component, label) {
  assertPlainObject(component, `${label} metadata must be an object`);
  assertText(component.name, `${label} name`);
  assertText(component.version, `${label} version`);
}

function validateExample(
  example,
  contract,
  environment,
  { historicalPluginManagedAcquisition },
) {
  assertPlainObject(example, `Qualification example ${contract.id} must be an object`);
  assert(
    example.status === "passed",
    `${contract.id} qualification status must be passed`,
  );

  const workspace = example.workspace;
  assertPlainObject(workspace, `${contract.id} workspace evidence must be an object`);
  assert(
    workspace.fresh === true &&
      Array.isArray(workspace.initialEntries) &&
      workspace.initialEntries.length === 0 &&
      workspace.preexistingBiologicalFiles === 0 &&
      workspace.preexistingOutputs === 0,
    `${contract.id} must begin in a demonstrably empty workspace`,
  );

  const viewer = example.viewer;
  assertPlainObject(viewer, `${contract.id} viewer evidence must be an object`);
  assert(
    viewer.cardCount === 1 &&
      viewer.contributionCount === 1 &&
      viewer.sessionCount === 1 &&
      viewer.singleOpenVerified === true &&
      Array.isArray(viewer.activeSessionIds) &&
      viewer.activeSessionIds.length === 1 &&
      nonEmptyText(viewer.activeSessionIds[0]) &&
      viewer.mode === contract.viewer?.mode,
    `${contract.id} must have exactly one contribution, card, active session, and expected mode`,
  );
  assertBoundedTextArray(
    viewer.stateAssertions,
    `${contract.id} visible state assertions`,
  );
  assert(
    deepEqual(viewer.stateAssertions, contract.viewer.visibleState),
    `${contract.id} visible state assertions must match the starter contract`,
  );

  validateExampleSource(example.source, contract, {
    historicalPluginManagedAcquisition,
  });
  validateExampleScience(example.science, contract, {
    historicalPluginManagedAcquisition,
  });
  validateExampleArtifacts(example.artifacts, example.source, contract, {
    historicalPluginManagedAcquisition,
  });
  validateExampleModelRun(example.modelRun, contract, environment, {
    historicalPluginManagedAcquisition,
  });
  validateEvidenceSet(example.evidence, `${contract.id} evidence`, {
    evidenceArchive: environment.sourceBinding.evidenceArchive,
    requireCompleteArchive: true,
  });
  validateTimingAndBytes(example, contract.id);
  assert(
    deepEqual(example.acceptableNondeterminism, contract.acceptableVariability),
    `${contract.id} acceptable nondeterminism must match the starter contract`,
  );
}

function validateExampleModelRun(
  modelRun,
  contract,
  environment,
  { historicalPluginManagedAcquisition },
) {
  const label = `${contract.id} model run`;
  assertPlainObject(modelRun, `${label} must be an object`);
  assert(
    modelRun.entryPoint === "codex-chat" &&
      modelRun.status === "passed" &&
      modelRun.prompt === contract.prompt &&
      modelRun.model === environment.model.name &&
      modelRun.reasoning === environment.reasoning.level &&
      modelRun.installedBundleSha256 === environment.bundle.sha256 &&
      modelRun.completeModelToolViewerTrace === true &&
      modelRun.viewerMounted === true &&
      modelRun.optionalSkillAvailable === false &&
      modelRun.officialEndpointFallbackUsed === true,
    `${label} must bind the exact prompt, model, installed bundle, fallback lane, and mounted viewer`,
  );
  assertText(modelRun.threadId, `${label} thread ID`);
  assertBoundedTextArray(modelRun.toolSequence, `${label} tool sequence`);
  let firstViewerOperationIndex;
  if (historicalPluginManagedAcquisition) {
    assert(
      modelRun.toolSequence[0] === LEGACY_PUBLIC_EXAMPLE_TOOL_NAME,
      `${label} must begin with historically qualified authoritative acquisition`,
    );
    firstViewerOperationIndex = 1;
  } else {
    const openingIndices = modelRun.toolSequence.flatMap((tool, index) =>
      tool === CHAT_OPEN_TOOL_NAME ? [index] : [],
    );
    assert(
      openingIndices.length === 1 && openingIndices[0] > 0,
      `${label} must acquire through Codex before exactly one absolute-path chat open`,
    );
    const openingIndex = openingIndices[0];
    assert(
      modelRun.toolSequence
        .slice(0, openingIndex)
        .every((tool) => !tool.startsWith("sequence.")) &&
        !modelRun.toolSequence.includes(LEGACY_PUBLIC_EXAMPLE_TOOL_NAME),
      `${label} must use host-authorized Codex acquisition without plugin-managed fetching`,
    );
    firstViewerOperationIndex = openingIndex + 1;
  }
  assert(
    modelRun.toolSequence.slice(firstViewerOperationIndex).some((tool) =>
      [
        "sequence.control_viewer",
        "sequence.query_viewer",
        "sequence.run_analysis",
      ].includes(tool),
    ),
    `${label} must drive or query live viewer state after acquisition`,
  );
  validateEvidenceSet(modelRun.evidence, `${label} evidence`, {
    evidenceArchive: environment.sourceBinding.evidenceArchive,
  });
}

function validateExampleSource(
  source,
  contract,
  { historicalPluginManagedAcquisition },
) {
  assertPlainObject(source, `${contract.id} source evidence must be an object`);
  assert(
    source.database === contract.source?.database &&
      deepEqual(source.identifiers, contract.source?.stableIdentifiers) &&
      deepEqual(source.officialEndpoints, contract.source?.officialEndpoints),
    `${contract.id} authoritative source identities must match the starter contract`,
  );
  assert(
    source.route === "official-database-endpoint" &&
      source.identityValidated === true &&
      source.formatValidated === true &&
      source.nonEmptyValidated === true &&
      source.boundedPayloadValidated === true &&
      source.provenanceValidated === true &&
      source.usedBundledFixture === false &&
      source.usedPreexistingFile === false,
    `${contract.id} must validate an official bounded source without fixture or pre-existing input`,
  );
  if (!historicalPluginManagedAcquisition) {
    assert(
      contract.artifacts?.sourceProvenanceOwner === "codex" &&
        source.provenanceOwner === "codex",
      `${contract.id} source provenance must truthfully identify Codex as publisher`,
    );
  }
  assertPositiveInteger(source.bytesTransferred, `${contract.id} transferred bytes`);
  assertPositiveInteger(source.artifactByteLength, `${contract.id} artifact bytes`);
  assertSha256(source.artifactSha256, `${contract.id} artifact digest`);
  assertSha256(source.receiptSha256, `${contract.id} receipt digest`);
  assert(
    isUtcIsoDate(source.retrievedAt),
    `${contract.id} retrieval time must be UTC ISO-8601`,
  );
  const expectedArtifactSha256 =
    contract.expectedResults?.artifactSha256 ??
    contract.expectedResults?.artifactBaselineSha256;
  if (expectedArtifactSha256 != null) {
    assert(
      source.artifactSha256 === expectedArtifactSha256,
      `${contract.id} source digest must match the pinned baseline`,
    );
    if (contract.expectedResults.artifactByteLength != null) {
      assert(
        source.artifactByteLength ===
          contract.expectedResults.artifactByteLength,
        `${contract.id} source bytes must match the pinned baseline`,
      );
    }
  }
  if (contract.bounds?.selectionRule != null) {
    assert(
      source.subsetRule === contract.bounds.selectionRule,
      `${contract.id} deterministic subset rule must match the starter contract`,
    );
  } else {
    assert(
      source.subsetRule == null,
      `${contract.id} must not claim an undeclared subset rule`,
    );
  }
}

function validateExampleScience(
  science,
  contract,
  { historicalPluginManagedAcquisition },
) {
  assertPlainObject(science, `${contract.id} science evidence must be an object`);
  assert(
    science.status === "passed" &&
      science.liveViewerState === true &&
      deepEqual(science.expectedResults, contract.expectedResults),
    `${contract.id} scientific expected results must be verified from live viewer state`,
  );
  assertBoundedTextArray(science.observations, `${contract.id} scientific observations`);
  assertBoundedTextArray(science.operations, `${contract.id} completed operations`);
  const expectedOperations =
    historicalPluginManagedAcquisition && contract.id === RAS_STARTER_ID
      ? contract.workflow.operations.map((operation) =>
          /^Codex writes verified Newick\b/u.test(operation)
            ? LEGACY_RAS_PUBLICATION_OPERATION
            : operation,
        )
      : contract.workflow.operations;
  assert(
    deepEqual(science.operations, expectedOperations),
    `${contract.id} completed operations must match the starter runbook`,
  );
}

function validateExampleArtifacts(
  artifacts,
  source,
  contract,
  { historicalPluginManagedAcquisition },
) {
  assertPlainObject(artifacts, `${contract.id} artifact evidence must be an object`);
  const sourceArtifact = artifacts.source;
  assertPlainObject(
    sourceArtifact,
    `${contract.id} source artifact evidence must be an object`,
  );
  assert(
    sourceArtifact.path === contract.artifacts?.source &&
      sourceArtifact.provenancePath === contract.artifacts?.sourceProvenance &&
      sourceArtifact.byteLength === source.artifactByteLength &&
      sourceArtifact.sha256 === source.artifactSha256,
    `${contract.id} source artifact must match the acquired workspace artifact`,
  );
  assertSha256(
    sourceArtifact.provenanceSha256,
    `${contract.id} source provenance digest`,
  );

  const expectedDerived = contract.artifacts?.derived;
  if (expectedDerived == null) {
    assert(
      artifacts.derived == null,
      `${contract.id} must not claim an undeclared derived artifact`,
    );
    return;
  }
  const derived = artifacts.derived;
  assertPlainObject(derived, `${contract.id} derived artifact must be recorded`);
  const expectedDestination =
    historicalPluginManagedAcquisition && contract.id === RAS_STARTER_ID
      ? historicalRasDestination(expectedDerived.destination)
      : expectedDerived.destination;
  assert(
    derived.format === expectedDerived.format &&
      deepEqual(derived.destination, expectedDestination) &&
      derived.outputPath === expectedDerived.output &&
      derived.provenancePath === expectedDerived.provenance,
    `${contract.id} derived artifact destination must match the starter contract`,
  );
  assertPositiveInteger(derived.byteLength, `${contract.id} derived artifact bytes`);
  assertSha256(derived.sha256, `${contract.id} derived artifact digest`);
  assertSha256(
    derived.provenanceSha256,
    `${contract.id} derived provenance digest`,
  );
  assert(
    derived.sourceSha256 === source.artifactSha256,
    `${contract.id} derived artifact must retain the source digest`,
  );
  assertText(derived.engine, `${contract.id} derived artifact engine`);
  if (!historicalPluginManagedAcquisition) {
    assert(
      expectedDerived.destination?.writer === "codex" &&
        derived.publisher === "codex" &&
        derived.engine !== "sequence-viewer-alignment-export-v1",
      `${contract.id} derived artifact must truthfully identify Codex as publisher`,
    );
  }
  assert(
    objectHasKeys(derived.parameters) &&
      derived.createNewVerified === true &&
      derived.noOverwriteVerified === true &&
      derived.roundTripVerified === true &&
      derived.collisionFailureQualified === true,
    `${contract.id} derived artifact must prove parameters, create-new, collision, and round-trip semantics`,
  );
}

function historicalRasDestination(destination) {
  assertPlainObject(destination, "Historical RAS destination must be an object");
  assert(
    destination.writer === "codex",
    "Historical RAS projection requires the current Codex-owned destination",
  );
  const { writer: _currentPublisher, ...historicalDestination } = destination;
  return historicalDestination;
}

function validateTimingAndBytes(example, id) {
  const timing = example.timing;
  assertPlainObject(timing, `${id} timing evidence must be an object`);
  assert(
    isUtcIsoDate(timing.startedAt) &&
      isUtcIsoDate(timing.completedAt) &&
      Date.parse(timing.completedAt) >= Date.parse(timing.startedAt),
    `${id} timing bounds must be ordered UTC ISO-8601 timestamps`,
  );
  assertPositiveNumber(timing.durationMs, `${id} duration`);
  assert(
    Math.abs(
      timing.durationMs -
        (Date.parse(timing.completedAt) - Date.parse(timing.startedAt)),
    ) <= 1_000,
    `${id} duration must agree with its timestamps`,
  );
  const bytes = example.bytes;
  assertPlainObject(bytes, `${id} byte metrics must be an object`);
  assertPositiveInteger(bytes.transferred, `${id} total transferred bytes`);
  assertPositiveInteger(bytes.written, `${id} total written bytes`);
}

function validateEvidenceSet(
  evidence,
  label,
  { evidenceArchive, requireCompleteArchive = false },
) {
  assertPlainObject(evidence, `${label} must be an object`);
  for (const kind of ["screenshot", "trace", "log"]) {
    validateEvidenceArtifact(
      evidence[kind],
      `${label} ${kind}`,
      evidenceArchive,
    );
  }
  if (evidence.recording != null) {
    validateEvidenceArtifact(
      evidence.recording,
      `${label} recording`,
      evidenceArchive,
    );
  }
  if (requireCompleteArchive) {
    validateDirectEvidenceBinding(
      evidence.completeArchive,
      `${label} complete archive`,
    );
    assert(
      evidence.completeArchive.url === evidenceArchive.url &&
        evidence.completeArchive.sha256 === evidenceArchive.sha256,
      `${label} complete archive must exactly match the source binding evidence archive`,
    );
  }
}

function validateEvidenceArtifact(item, label, evidenceArchive) {
  assertPlainObject(item, `${label} must be an object`);
  const direct = hasExactKeys(item, ["sha256", "url"]);
  const archiveMember = hasExactKeys(item, [
    "archiveSha256",
    "archiveUrl",
    "memberPath",
    "sha256",
  ]);
  assert(
    direct !== archiveMember && (direct || archiveMember),
    `${label} must be either a direct HTTPS artifact or an explicit archive member binding`,
  );
  assertSha256(item.sha256, `${label} digest`);
  if (direct) {
    assert(
      HTTPS_URL_PATTERN.test(item.url),
      `${label} direct artifact must use an HTTPS link`,
    );
    assert(
      item.url !== evidenceArchive.url,
      `${label} must use an explicit archive member binding when its link is the evidence archive`,
    );
    return;
  }
  assert(
    HTTPS_URL_PATTERN.test(item.archiveUrl) &&
      SHA256_PATTERN.test(item.archiveSha256),
    `${label} archive member must identify an HTTPS archive and its SHA-256`,
  );
  assert(
    item.archiveUrl === evidenceArchive.url &&
      item.archiveSha256 === evidenceArchive.sha256,
    `${label} archive member must match the source binding evidence archive`,
  );
  assert(
    isSafeNormalizedRelativePath(item.memberPath),
    `${label} archive member path must be a safe normalized relative path`,
  );
}

function validateDirectEvidenceBinding(value, label) {
  assertPlainObject(value, `${label} must be an object`);
  assert(
    hasExactKeys(value, ["sha256", "url"]) &&
      HTTPS_URL_PATTERN.test(value.url ?? "") &&
      SHA256_PATTERN.test(value.sha256 ?? ""),
    `${label} must have exactly an HTTPS link and SHA-256`,
  );
}

function isSafeNormalizedRelativePath(value) {
  if (!nonEmptyText(value) || textBytes(value) > MAX_TEXT_BYTES) return false;
  if (value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f]/u.test(value)) {
    return false;
  }
  const segments = value.split("/");
  return (
    segments.every(
      (segment) => segment !== "" && segment !== "." && segment !== "..",
    ) && !/^[A-Za-z]:/u.test(segments[0])
  );
}

function hasExactKeys(value, expected) {
  return deepEqual(Object.keys(value).sort(), [...expected].sort());
}

function validateNegativeCases(cases, bundleSha256, evidenceArchive) {
  assert(
    Array.isArray(cases) &&
      cases.length === REQUIRED_STARTER_NEGATIVE_CASES.length &&
      deepEqual(
        cases.map(({ requirement }) => requirement),
        REQUIRED_STARTER_NEGATIVE_CASES,
      ),
    "Qualification negative matrix must contain every required case in canonical order",
  );
  const traceDigests = new Set();
  for (const negativeCase of cases) {
    const label = `Negative case ${negativeCase.requirement}`;
    assert(
      negativeCase.status === "passed" &&
        negativeCase.actionableResult === true &&
        negativeCase.noMisleadingViewer === true &&
        negativeCase.noMisleadingArtifact === true &&
        negativeCase.noBundledFallback === true,
      `${label} must pass without misleading viewer, artifact, or fallback state`,
    );
    assertText(negativeCase.testRef, `${label} test reference`);
    validateEvidenceSet(negativeCase.evidence, `${label} evidence`, {
      evidenceArchive,
      requireCompleteArchive: true,
    });
    assert(
      negativeCase.evidence.requirement === negativeCase.requirement &&
        negativeCase.evidence.bundleSha256 === bundleSha256 &&
        negativeCase.evidence.visibleInstalledHost === true,
      `${label} evidence must be scenario-specific and bound to the visible installed bundle`,
    );
    assert(
      !traceDigests.has(negativeCase.evidence.trace.sha256),
      `${label} must have a distinct scenario trace`,
    );
    traceDigests.add(negativeCase.evidence.trace.sha256);
    if (negativeCase.requirement === "optional-skill-unavailable-fallback") {
      assert(
        negativeCase.optionalSkillAvailable === false &&
          negativeCase.officialEndpointFallbackSucceeded === true,
        "Optional-skill-unavailable case must prove successful official-endpoint fallback",
      );
    } else if (negativeCase.requirement === "viewer-retry-remount") {
      assert(
        negativeCase.retryOrRemountSucceeded === true &&
          negativeCase.sessionContinuityVerified === true,
        "Viewer retry/remount case must prove successful session continuity",
      );
    } else {
      assertText(negativeCase.observedError, `${label} observed error`);
    }
  }
}

function validateRelatedIssues(relatedIssues) {
  assert(
    Array.isArray(relatedIssues) && relatedIssues.length === 2,
    "Qualification must link exactly the LSC-79 and LSC-82 reference workflows",
  );
  assert(
    deepEqual(
      relatedIssues.map(({ id }) => id),
      ["LSC-79", "LSC-82"],
    ),
    "Qualification must link LSC-79 and LSC-82 in canonical order",
  );
  for (const issue of relatedIssues) {
    assert(
      HTTPS_URL_PATTERN.test(issue.url ?? "") && issue.url.includes(issue.id),
      `${issue.id} must have a matching HTTPS link`,
    );
    assertText(issue.workflow, `${issue.id} qualified workflow`);
  }
}

function validateLimitsAndNondeterminism(qualification, contractExamples) {
  assertBoundedTextArray(qualification.knownLimits, "Known qualification limits");
  assertBoundedTextArray(
    qualification.acceptableNondeterminism,
    "Acceptable qualification nondeterminism",
  );
  const declaredVariability = contractExamples.flatMap(
    ({ acceptableVariability = [] }) => acceptableVariability,
  );
  for (const variability of declaredVariability) {
    assert(
      qualification.acceptableNondeterminism.includes(variability),
      `Qualification nondeterminism is missing contract allowance: ${variability}`,
    );
  }
}

function validateReportBinding(report, reportMarkdown) {
  assertPlainObject(report, "Qualification report binding must be an object");
  assertText(report.path, "Qualification report path");
  assert(
    !report.path.startsWith("/") &&
      !report.path.split(/[\\/]/u).includes("..") &&
      report.path.endsWith(".md"),
    "Qualification report path must be a relative Markdown path",
  );
  assertText(report.title, "Qualification report title");
  assert(
    report.synchronized === true,
    "Qualification report must declare synchronized evidence",
  );
  assertSha256(report.markdownSha256, "Qualification report digest");
  assert(
    sha256(reportMarkdown) === report.markdownSha256,
    "Qualification report digest does not match the checked-in Markdown",
  );
}

function validateReportSynchronization(
  qualification,
  reportMarkdown,
  contractExamples,
) {
  assert(
    reportMarkdown.includes(qualification.report.title) &&
      reportMarkdown.includes("LSC-109") &&
      /\bpassed\b/iu.test(reportMarkdown),
    "Qualification report must identify LSC-109 and its passed status",
  );
  const tokens = [
    qualification.pluginVersion,
    qualification.manifestName,
    qualification.qualifiedAt,
    qualification.environment.bundle.sha256,
    qualification.environment.bundle.manifestSha256,
    qualification.environment.bundle.starterContractSha256,
    qualification.environment.plugin.name,
    qualification.environment.plugin.version,
    qualification.environment.server.name,
    qualification.environment.server.version,
    qualification.environment.host.name,
    qualification.environment.host.version,
    qualification.environment.host.build,
    qualification.environment.os.platform,
    qualification.environment.os.release,
    qualification.environment.os.architecture,
    qualification.environment.model.name,
    ...flattenReportTokens(qualification.environment.model.configuration),
    qualification.environment.reasoning.level,
    qualification.environment.reasoning.description,
    ...qualification.environment.optionalLifeScienceSkills.available,
    ...qualification.environment.optionalLifeScienceSkills.unavailable,
  ];
  const binding = qualification.environment.sourceBinding;
  tokens.push(
    binding.executionRevision.commitSha,
    binding.executionRevision.treeSha,
    binding.submittedSourceSnapshot.sha256,
    binding.submittedSourceSnapshot.digestAlgorithm,
    ...binding.submittedSourceSnapshot.excludedEvidenceFiles,
    binding.runtimeBundleSha256,
    binding.qualificationRun.url,
    binding.qualificationRun.sha256,
    binding.evidenceManifest.url,
    binding.evidenceManifest.sha256,
    binding.evidenceArchive.url,
    binding.evidenceArchive.sha256,
  );
  for (let index = 0; index < qualification.examples.length; index += 1) {
    const example = qualification.examples[index];
    const contract = contractExamples[index];
    tokens.push(
      example.id,
      example.prompt,
      ...contract.source.stableIdentifiers,
      example.source.artifactSha256,
      example.source.receiptSha256,
      example.source.retrievedAt,
      ...example.source.officialEndpoints,
      ...(example.source.subsetRule == null ? [] : [example.source.subsetRule]),
      example.artifacts.source.path,
      example.artifacts.source.provenancePath,
      example.modelRun.entryPoint,
      example.modelRun.status,
      example.modelRun.prompt,
      example.modelRun.model,
      example.modelRun.reasoning,
      example.modelRun.installedBundleSha256,
      example.modelRun.threadId,
      ...example.modelRun.toolSequence,
      ...evidenceReportTokens(example.modelRun.evidence),
      ...evidenceReportTokens(example.evidence),
      String(example.timing.durationMs),
      String(example.bytes.transferred),
      String(example.bytes.written),
      ...example.science.observations,
      ...example.science.operations,
      ...example.viewer.stateAssertions,
    );
    if (example.artifacts.derived != null) {
      tokens.push(
        example.artifacts.derived.outputPath,
        example.artifacts.derived.provenancePath,
        example.artifacts.derived.sha256,
        example.artifacts.derived.provenanceSha256,
        example.artifacts.derived.engine,
        ...flattenReportTokens(example.artifacts.derived.destination),
        ...flattenReportTokens(example.artifacts.derived.parameters),
      );
    }
  }
  for (const negativeCase of qualification.negativeCases) {
    tokens.push(
      negativeCase.requirement,
      negativeCase.testRef,
      ...evidenceReportTokens(negativeCase.evidence),
      negativeCase.evidence.requirement,
      negativeCase.evidence.bundleSha256,
    );
    if (negativeCase.observedError != null) {
      tokens.push(negativeCase.observedError);
    }
  }
  for (const issue of qualification.relatedIssues) {
    tokens.push(issue.id, issue.url, issue.workflow);
  }
  tokens.push(
    ...qualification.knownLimits,
    ...qualification.acceptableNondeterminism,
  );
  for (const token of tokens) {
    if (!nonEmptyText(token)) continue;
    assert(
      reportMarkdown.includes(token),
      `Qualification report is missing synchronized value: ${token}`,
    );
  }
}

function evidenceReportTokens(evidence) {
  return ["screenshot", "trace", "log", "recording", "completeArchive"]
    .flatMap((kind) => flattenReportTokens(evidence[kind]))
    .filter(nonEmptyText);
}

function assertBoundedJson(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Qualification must be JSON-serializable");
  }
  assert(
    Buffer.byteLength(serialized, "utf8") <= MAX_QUALIFICATION_BYTES,
    `Qualification exceeds the ${MAX_QUALIFICATION_BYTES}-byte budget`,
  );
}

function assertBoundedTextArray(
  value,
  label,
  { allowEmpty = false } = {},
) {
  assert(
    Array.isArray(value) &&
      value.length <= MAX_LIST_ITEMS &&
      (allowEmpty || value.length > 0) &&
      value.every((item) => nonEmptyText(item) && textBytes(item) <= MAX_TEXT_BYTES),
    `${label} must be a bounded ${allowEmpty ? "" : "non-empty "}string array`,
  );
}

function assertText(value, label, { maxBytes = MAX_TEXT_BYTES } = {}) {
  assert(
    nonEmptyText(value) && textBytes(value) <= maxBytes,
    `${label} must be a bounded non-empty string`,
  );
}

function assertSha256(value, label) {
  assert(SHA256_PATTERN.test(value ?? ""), `${label} must be SHA-256`);
}

function assertPositiveInteger(value, label) {
  assert(
    Number.isSafeInteger(value) && value > 0,
    `${label} must be a positive safe integer`,
  );
}

function assertPositiveNumber(value, label) {
  assert(
    typeof value === "number" && Number.isFinite(value) && value > 0,
    `${label} must be a positive finite number`,
  );
}

function assertPlainObject(value, message) {
  assert(isPlainObject(value), message);
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function objectHasKeys(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function nonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function textBytes(value) {
  return Buffer.byteLength(value, "utf8");
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function flattenReportTokens(value) {
  if (value == null) return [];
  if (typeof value !== "object") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenReportTokens);
  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...flattenReportTokens(nested),
  ]);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isUtcIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value ?? "")) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const canonical = new Date(timestamp).toISOString();
  return value === canonical || value === canonical.replace(".000Z", "Z");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
