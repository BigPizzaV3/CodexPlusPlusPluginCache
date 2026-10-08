import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  REQUIRED_STARTER_NEGATIVE_CASES,
  validateStarterQualification,
} from "./validate-starter-qualification.mjs";
import {
  SOURCE_SNAPSHOT_DIGEST_ALGORITHM,
  SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES,
} from "./source-snapshot.mjs";

const pluginRoot = process.cwd();
const ZERO_SHA256 = "0".repeat(64);
const EVIDENCE_ARCHIVE_URL = "https://evidence.example/lsc-109-evidence.tar.gz";
const EVIDENCE_ARCHIVE_SHA256 = "8".repeat(64);

async function loadInputs() {
  const [manifestText, starterContractText] = await Promise.all([
    readFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"),
    readFile(path.join(pluginRoot, "starter-examples.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const starterContract = JSON.parse(starterContractText);
  const qualification = buildQualification(starterContract, manifest);
  const reportMarkdown = renderReport(qualification);
  qualification.report.markdownSha256 = sha256(reportMarkdown);
  return { manifest, qualification, reportMarkdown, starterContract };
}

async function loadCheckedInInputs() {
  const [manifest, qualification, reportMarkdown, starterContract] =
    await Promise.all([
      readFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8").then(
        JSON.parse,
      ),
      readFile(path.join(pluginRoot, "lsc-109-qualification.json"), "utf8").then(
        JSON.parse,
      ),
      readFile(path.join(pluginRoot, "LSC_109_QUALIFICATION.md"), "utf8"),
      readFile(path.join(pluginRoot, "starter-examples.json"), "utf8").then(
        JSON.parse,
      ),
    ]);
  return { manifest, qualification, reportMarkdown, starterContract };
}

function buildQualification(starterContract, manifest) {
  const now = "2026-07-02T12:00:00.000Z";
  return {
    schemaVersion: 1,
    contractSchemaVersion: starterContract.schemaVersion,
    issue: "LSC-109",
    status: "passed",
    qualifiedAt: now,
    pluginVersion: starterContract.pluginVersion,
    manifestName: manifest.name,
    environment: {
      sourceBinding: {
        executionRevision: {
          commitSha: "1".repeat(40),
          treeSha: "2".repeat(40),
        },
        qualificationRun: {
          url: "https://evidence.example/qualification-run.json",
          sha256: "4".repeat(64),
        },
        evidenceManifest: {
          url: "https://evidence.example/evidence-manifest.json",
          sha256: "9".repeat(64),
        },
        evidenceArchive: evidenceArchive(),
        runtimeBundleSha256: "3".repeat(64),
        submittedSourceSnapshot: {
          byteLength: 8_388_608,
          digestAlgorithm: SOURCE_SNAPSHOT_DIGEST_ALGORITHM,
          excludedEvidenceFiles: [
            ...SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES,
          ],
          fileCount: 200,
          kind: "tracked-plugin-source",
          sha256: "7".repeat(64),
        },
      },
      bundle: {
        kind: "marketplace-bundle",
        sha256: "3".repeat(64),
        manifestSha256: "5".repeat(64),
        starterContractSha256: "6".repeat(64),
        fileCount: 17,
        byteLength: 4_194_304,
      },
      plugin: { name: manifest.name, version: manifest.version },
      server: {
        name: "biological-sequence-viewer",
        version: manifest.version,
      },
      host: { name: "Codex", version: "1.2.3", build: "2026.07.02" },
      os: { platform: "linux", release: "6.8.0", architecture: "x64" },
      model: {
        name: "GPT-5.6 SOL",
        configuration: { temperature: 0, toolMode: "installed-host" },
      },
      reasoning: { level: "Ultra", description: "literal Ultra reasoning" },
      optionalLifeScienceSkills: {
        available: ["NCBI Entrez", "UniProt"],
        unavailable: ["ENA"],
        inventoryRecorded: true,
        unavailableFallbackQualified: true,
      },
    },
    examples: starterContract.examples.map((contract, index) =>
      buildExample(contract, index, now),
    ),
    negativeCases: REQUIRED_STARTER_NEGATIVE_CASES.map((requirement, index) =>
      buildNegativeCase(requirement, index),
    ),
    relatedIssues: [
      {
        id: "LSC-79",
        url: "https://linear.app/openai/issue/LSC-79/reference-workflow",
        workflow: "Qualified annotated Sequence reference workflow",
      },
      {
        id: "LSC-82",
        url: "https://linear.app/openai/issue/LSC-82/reference-workflow",
        workflow: "Qualified multi-record Alignment reference workflow",
      },
    ],
    knownLimits: [
      "The three-leaf RAS tree is exploratory and not publication-grade.",
    ],
    acceptableNondeterminism: Array.from(
      new Set(
        starterContract.examples.flatMap(
          ({ acceptableVariability }) => acceptableVariability,
        ),
      ),
    ),
    report: {
      path: "LSC_109_QUALIFICATION.md",
      title: "LSC-109 starter qualification report",
      synchronized: true,
      markdownSha256: ZERO_SHA256,
    },
  };
}

function buildExample(contract, index, now) {
  const artifactSha256 =
    contract.expectedResults.artifactSha256 ??
    contract.expectedResults.artifactBaselineSha256 ??
    `${index + 4}`.repeat(64).slice(0, 64);
  const artifactByteLength =
    contract.expectedResults.artifactByteLength ?? 98_765 + index;
  const example = {
    id: contract.id,
    prompt: contract.prompt,
    status: "passed",
    workspace: {
      fresh: true,
      initialEntries: [],
      preexistingBiologicalFiles: 0,
      preexistingOutputs: 0,
    },
    viewer: {
      cardCount: 1,
      contributionCount: 1,
      sessionCount: 1,
      activeSessionIds: [`session-${index + 1}`],
      mode: contract.viewer.mode,
      singleOpenVerified: true,
      stateAssertions: [...contract.viewer.visibleState],
    },
    source: {
      database: contract.source.database,
      identifiers: [...contract.source.stableIdentifiers],
      officialEndpoints: [...contract.source.officialEndpoints],
      route: "official-database-endpoint",
      bytesTransferred: 50_000 + index,
      artifactByteLength,
      artifactSha256,
      receiptSha256: `${index + 7}`.repeat(64).slice(0, 64),
      provenanceOwner: "codex",
      retrievedAt: now,
      subsetRule: contract.bounds.selectionRule ?? null,
      identityValidated: true,
      formatValidated: true,
      nonEmptyValidated: true,
      boundedPayloadValidated: true,
      provenanceValidated: true,
      usedBundledFixture: false,
      usedPreexistingFile: false,
    },
    science: {
      status: "passed",
      liveViewerState: true,
      expectedResults: structuredClone(contract.expectedResults),
      observations: [`Observed ${contract.workflow.scientificQuestion}`],
      operations: [...contract.workflow.operations],
    },
    modelRun: {
      entryPoint: "codex-chat",
      status: "passed",
      prompt: contract.prompt,
      model: "GPT-5.6 SOL",
      reasoning: "Ultra",
      installedBundleSha256: "3".repeat(64),
      completeModelToolViewerTrace: true,
      viewerMounted: true,
      optionalSkillAvailable: false,
      officialEndpointFallbackUsed: true,
      threadId: `thread-${index + 1}`,
      toolSequence: [
        "codex.workspace.exec",
        "sequence.open_from_chat",
        "sequence.query_viewer",
      ],
      evidence: evidenceSet(`model-run-${index + 1}`),
    },
    artifacts: {
      source: {
        path: contract.artifacts.source,
        provenancePath: contract.artifacts.sourceProvenance,
        byteLength: artifactByteLength,
        sha256: artifactSha256,
        provenanceSha256: `${index + 1}`.repeat(64).slice(0, 64),
      },
      derived: null,
    },
    evidence: completeEvidenceSet(`example-${index + 1}`),
    timing: {
      startedAt: now,
      completedAt: "2026-07-02T12:00:05.000Z",
      durationMs: 5_000,
    },
    bytes: { transferred: 50_000 + index, written: 100_000 + index },
    acceptableNondeterminism: [...contract.acceptableVariability],
  };
  if (contract.artifacts.derived != null) {
    example.artifacts.derived = {
      format: contract.artifacts.derived.format,
      destination: structuredClone(contract.artifacts.derived.destination),
      outputPath: contract.artifacts.derived.output,
      provenancePath: contract.artifacts.derived.provenance,
      byteLength: 96,
      sha256: "a".repeat(64),
      provenanceSha256: "b".repeat(64),
      sourceSha256: artifactSha256,
      engine: "sequence-viewer-guide-tree-v1",
      publisher: "codex",
      parameters: {
        algorithm: "neighbor-joining",
        distance: "uncorrected-p-distance",
      },
      createNewVerified: true,
      noOverwriteVerified: true,
      roundTripVerified: true,
      collisionFailureQualified: true,
    };
  }
  return example;
}

function buildNegativeCase(requirement, index) {
  const value = {
    requirement,
    status: "passed",
    actionableResult: true,
    noMisleadingViewer: true,
    noMisleadingArtifact: true,
    noBundledFallback: true,
    testRef: `qualification/${requirement}.test.ts`,
    evidence: {
      ...completeEvidenceSet(`negative-${index + 1}`),
      bundleSha256: "3".repeat(64),
      requirement,
      visibleInstalledHost: true,
    },
  };
  if (requirement === "optional-skill-unavailable-fallback") {
    return {
      ...value,
      optionalSkillAvailable: false,
      officialEndpointFallbackSucceeded: true,
    };
  }
  if (requirement === "viewer-retry-remount") {
    return {
      ...value,
      retryOrRemountSucceeded: true,
      sessionContinuityVerified: true,
    };
  }
  return { ...value, observedError: `Actionable ${requirement} error` };
}

function evidenceSet(stem) {
  return {
    screenshot: {
      url: `https://evidence.example/${stem}.png`,
      sha256: sha256(`${stem}:screenshot`),
    },
    trace: {
      url: `https://evidence.example/${stem}.trace.zip`,
      sha256: sha256(`${stem}:trace`),
    },
    log: {
      url: `https://evidence.example/${stem}.log.json`,
      sha256: sha256(`${stem}:log`),
    },
  };
}

function completeEvidenceSet(stem) {
  return {
    ...evidenceSet(stem),
    completeArchive: evidenceArchive(),
  };
}

function evidenceArchive() {
  return {
    url: EVIDENCE_ARCHIVE_URL,
    sha256: EVIDENCE_ARCHIVE_SHA256,
  };
}

function archiveMember(memberPath, contents) {
  return {
    archiveUrl: EVIDENCE_ARCHIVE_URL,
    archiveSha256: EVIDENCE_ARCHIVE_SHA256,
    memberPath,
    sha256: sha256(contents),
  };
}

function renderReport(qualification) {
  return `# ${qualification.report.title}\n\nLSC-109 Passed\n\n\`\`\`json\n${JSON.stringify(
    qualification,
    null,
    2,
  )}\n\`\`\`\n`;
}

function synchronizeReport(inputs) {
  inputs.reportMarkdown = renderReport(inputs.qualification);
  inputs.qualification.report.markdownSha256 = sha256(inputs.reportMarkdown);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validate(inputs) {
  return validateStarterQualification(inputs);
}

describe("LSC-109 starter qualification validator", () => {
  it("validates the checked-in qualification record and report", async () => {
    const inputs = await loadCheckedInInputs();
    const historicalVersion = inputs.qualification.pluginVersion;
    expect(() =>
      validate({
        ...inputs,
        manifest: { ...inputs.manifest, version: historicalVersion },
        starterContract: {
          ...inputs.starterContract,
          pluginVersion: historicalVersion,
        },
      }),
    ).not.toThrow();
  });

  it("does not transfer historical qualification to the current pending release", async () => {
    const inputs = await loadCheckedInInputs();
    const historicalVersion = inputs.qualification.pluginVersion;
    const currentVersion = inputs.manifest.version;

    expect(currentVersion).not.toBe(historicalVersion);
    expect(inputs.starterContract.pluginVersion).toBe(currentVersion);
    expect(inputs.starterContract.downstreamQualification).toMatchObject({
      lastQualifiedPluginVersion: historicalVersion,
      qualificationComplete: false,
      status: "pending",
    });
    expect(() => validate(inputs)).toThrow(
      "Qualification, starter contract, and manifest plugin versions must match",
    );
  });

  it("accepts a bounded, report-bound complete qualification", async () => {
    const inputs = await loadInputs();
    expect(() => validate(inputs)).not.toThrow();
  });

  it("requires current qualification to acquire through Codex before one chat open", async () => {
    const inputs = await loadInputs();
    for (const example of inputs.qualification.examples) {
      expect(example.modelRun.toolSequence).toEqual([
        "codex.workspace.exec",
        "sequence.open_from_chat",
        "sequence.query_viewer",
      ]);
    }

    expect(() => validate(inputs)).not.toThrow();
  });

  it("does not accept historical plugin acquisition for the current version", async () => {
    const inputs = await loadInputs();
    inputs.qualification.examples[0].modelRun.toolSequence = [
      "sequence.acquire_public_example",
      "sequence.query_viewer",
    ];

    expect(() => validate(inputs)).toThrow(
      "must acquire through Codex before exactly one absolute-path chat open",
    );
  });

  it("does not widen historical plugin acquisition to another version", async () => {
    const inputs = await loadInputs();
    inputs.starterContract.downstreamQualification.lastQualifiedPluginVersion =
      inputs.qualification.pluginVersion;
    inputs.qualification.examples[0].modelRun.toolSequence = [
      "sequence.acquire_public_example",
      "sequence.query_viewer",
    ];

    expect(() => validate(inputs)).toThrow(
      "must acquire through Codex before exactly one absolute-path chat open",
    );
  });

  it("rejects current source provenance that misidentifies its Codex publisher", async () => {
    const inputs = await loadInputs();
    inputs.qualification.examples[0].source.provenanceOwner =
      "sequence-viewer";

    expect(() => validate(inputs)).toThrow(
      "ena-drr037765-first-500 source provenance must truthfully identify Codex as publisher",
    );
  });

  it("rejects a current RAS artifact that falsely claims plugin publication", async () => {
    const inputs = await loadInputs();
    inputs.qualification.examples[1].artifacts.derived.publisher =
      "sequence-viewer";

    expect(() => validate(inputs)).toThrow(
      "uniprot-human-ras-sv1 derived artifact must truthfully identify Codex as publisher",
    );
  });

  it("rejects a current RAS destination that removes Codex as writer", async () => {
    const inputs = await loadInputs();
    inputs.starterContract.examples[1].artifacts.derived.destination.writer =
      "sequence-viewer";
    inputs.qualification.examples[1].artifacts.derived.destination.writer =
      "sequence-viewer";

    expect(() => validate(inputs)).toThrow(
      "uniprot-human-ras-sv1 derived artifact must truthfully identify Codex as publisher",
    );
  });

  it.each([
    ["schema", (inputs) => (inputs.qualification.schemaVersion = 2), /schemaVersion 1/u],
    ["status", (inputs) => (inputs.qualification.status = "pending"), /status must be passed/u],
    ["version", (inputs) => (inputs.qualification.pluginVersion = "9.9.9"), /plugin versions must match/u],
    [
      "source binding",
      (inputs) => (inputs.qualification.environment.sourceBinding = {}),
      /execution revision/u,
    ],
  ])("rejects invalid %s metadata", async (_label, mutate, expected) => {
    const inputs = await loadInputs();
    mutate(inputs);
    expect(() => validate(inputs)).toThrow(expected);
  });

  it("rejects a source binding to a different runtime bundle", async () => {
    const inputs = await loadInputs();
    inputs.qualification.environment.sourceBinding.runtimeBundleSha256 =
      "f".repeat(64);
    inputs.reportMarkdown = renderReport(inputs.qualification);
    inputs.qualification.report.markdownSha256 = sha256(inputs.reportMarkdown);
    expect(() => validate(inputs)).toThrow(/runtime bundle must match/u);
  });

  it("rejects missing, malformed, or widened submitted source snapshots", async () => {
    const missing = await loadInputs();
    delete missing.qualification.environment.sourceBinding
      .submittedSourceSnapshot;
    expect(() => validate(missing)).toThrow(/source snapshot binding/u);

    const malformed = await loadInputs();
    malformed.qualification.environment.sourceBinding.submittedSourceSnapshot.sha256 =
      "not-a-digest";
    expect(() => validate(malformed)).toThrow(/snapshot digest must be SHA-256/u);

    const widened = await loadInputs();
    widened.qualification.environment.sourceBinding.submittedSourceSnapshot.excludedEvidenceFiles.push(
      "src/server.ts",
    );
    expect(() => validate(widened)).toThrow(/exclude only the two/u);
  });

  it("requires HTTPS and SHA-256 bindings for the evidence manifest and archive", async () => {
    const missingManifest = await loadInputs();
    delete missingManifest.qualification.environment.sourceBinding
      .evidenceManifest;
    expect(() => validate(missingManifest)).toThrow(
      /evidence manifest must be an object/u,
    );

    const malformedManifest = await loadInputs();
    malformedManifest.qualification.environment.sourceBinding.evidenceManifest.sha256 =
      "not-a-digest";
    expect(() => validate(malformedManifest)).toThrow(
      /evidence manifest must have exactly an HTTPS link and SHA-256/u,
    );

    const missingArchive = await loadInputs();
    delete missingArchive.qualification.environment.sourceBinding
      .evidenceArchive;
    expect(() => validate(missingArchive)).toThrow(
      /evidence archive must be an object/u,
    );

    const malformedArchive = await loadInputs();
    malformedArchive.qualification.environment.sourceBinding.evidenceArchive.url =
      "http://evidence.example/archive.tar.gz";
    expect(() => validate(malformedArchive)).toThrow(
      /evidence archive must have exactly an HTTPS link and SHA-256/u,
    );
  });

  it("accepts both direct artifacts and explicitly bound archive members", async () => {
    const direct = await loadInputs();
    expect(() => validate(direct)).not.toThrow();

    const archived = await loadInputs();
    archived.qualification.examples[0].evidence.trace = archiveMember(
      "examples/ena/trace.zip",
      "archived trace",
    );
    synchronizeReport(archived);
    expect(() => validate(archived)).not.toThrow();
  });

  it("rejects removed, corrupted, mixed, or wrongly bound evidence artifacts", async () => {
    const removed = await loadInputs();
    delete removed.qualification.examples[0].evidence.trace.url;
    expect(() => validate(removed)).toThrow(/either a direct HTTPS artifact/u);

    const corrupted = await loadInputs();
    corrupted.qualification.examples[0].evidence.trace.sha256 = "bad";
    expect(() => validate(corrupted)).toThrow(/trace digest must be SHA-256/u);

    const mixed = await loadInputs();
    mixed.qualification.examples[0].evidence.trace.memberPath =
      "examples/ena/trace.zip";
    expect(() => validate(mixed)).toThrow(/either a direct HTTPS artifact/u);

    const wrongArchive = await loadInputs();
    wrongArchive.qualification.examples[0].evidence.trace = {
      ...archiveMember("examples/ena/trace.zip", "archived trace"),
      archiveUrl: "https://evidence.example/other.tar.gz",
    };
    expect(() => validate(wrongArchive)).toThrow(
      /archive member must match the source binding evidence archive/u,
    );

    const wrongArchiveDigest = await loadInputs();
    wrongArchiveDigest.qualification.examples[0].evidence.trace = {
      ...archiveMember("examples/ena/trace.zip", "archived trace"),
      archiveSha256: "f".repeat(64),
    };
    expect(() => validate(wrongArchiveDigest)).toThrow(
      /archive member must match the source binding evidence archive/u,
    );

    const disguisedArchiveMember = await loadInputs();
    disguisedArchiveMember.qualification.examples[0].evidence.trace = {
      url: EVIDENCE_ARCHIVE_URL,
      sha256: sha256("archived trace"),
    };
    expect(() => validate(disguisedArchiveMember)).toThrow(
      /explicit archive member binding when its link is the evidence archive/u,
    );
  });

  it.each([
    ["missing", undefined],
    ["absolute", "/examples/ena/trace.zip"],
    ["parent traversal", "examples/../trace.zip"],
    ["current-directory segment", "examples/./trace.zip"],
    ["empty segment", "examples//trace.zip"],
    ["backslash", "examples\\ena\\trace.zip"],
    ["drive-qualified", "C:/examples/ena/trace.zip"],
  ])("rejects an unsafe %s archive member path", async (_label, memberPath) => {
    const inputs = await loadInputs();
    inputs.qualification.examples[0].evidence.trace = archiveMember(
      "examples/ena/trace.zip",
      "archived trace",
    );
    if (memberPath == null) {
      delete inputs.qualification.examples[0].evidence.trace.memberPath;
    } else {
      inputs.qualification.examples[0].evidence.trace.memberPath = memberPath;
    }
    expect(() => validate(inputs)).toThrow(
      memberPath == null
        ? /either a direct HTTPS artifact/u
        : /safe normalized relative path/u,
    );
  });

  it("requires every example and negative case to bind the complete evidence archive", async () => {
    const missingExampleArchive = await loadInputs();
    delete missingExampleArchive.qualification.examples[0].evidence
      .completeArchive;
    expect(() => validate(missingExampleArchive)).toThrow(
      /complete archive must be an object/u,
    );

    const wrongExampleArchive = await loadInputs();
    wrongExampleArchive.qualification.examples[0].evidence.completeArchive.sha256 =
      "f".repeat(64);
    expect(() => validate(wrongExampleArchive)).toThrow(
      /complete archive must exactly match/u,
    );

    const missingNegativeArchive = await loadInputs();
    delete missingNegativeArchive.qualification.negativeCases[0].evidence
      .completeArchive;
    expect(() => validate(missingNegativeArchive)).toThrow(
      /complete archive must be an object/u,
    );

    const wrongNegativeArchive = await loadInputs();
    wrongNegativeArchive.qualification.negativeCases[0].evidence.completeArchive.url =
      "https://evidence.example/other.tar.gz";
    expect(() => validate(wrongNegativeArchive)).toThrow(
      /complete archive must exactly match/u,
    );
  });

  it("synchronizes source evidence and archive-member bindings into the report", async () => {
    const sourceDrift = await loadInputs();
    sourceDrift.qualification.environment.sourceBinding.evidenceManifest.url =
      "https://evidence.example/replacement-manifest.json";
    expect(() => validate(sourceDrift)).toThrow(
      /missing synchronized value: https:\/\/evidence\.example\/replacement-manifest\.json/u,
    );

    const memberDrift = await loadInputs();
    memberDrift.qualification.examples[0].evidence.trace = archiveMember(
      "examples/ena/replacement-trace.zip",
      "archived trace",
    );
    synchronizeReport(memberDrift);
    memberDrift.reportMarkdown = memberDrift.reportMarkdown.replace(
      "examples/ena/replacement-trace.zip",
      "omitted-member-path",
    );
    memberDrift.qualification.report.markdownSha256 = sha256(
      memberDrift.reportMarkdown,
    );
    expect(() => validate(memberDrift)).toThrow(
      /missing synchronized value: examples\/ena\/replacement-trace\.zip/u,
    );
  });

  it.each([
    [
      "bundle SHA-256",
      (environment) => (environment.bundle.sha256 = "not-a-digest"),
      /Bundle digest must be SHA-256/u,
    ],
    [
      "bundled manifest SHA-256",
      (environment) => (environment.bundle.manifestSha256 = "not-a-digest"),
      /Bundled manifest digest must be SHA-256/u,
    ],
    [
      "bundled starter contract SHA-256",
      (environment) =>
        (environment.bundle.starterContractSha256 = "not-a-digest"),
      /Bundled starter contract digest must be SHA-256/u,
    ],
    [
      "bundle file count",
      (environment) => (environment.bundle.fileCount = 0),
      /Bundle file count must be a positive safe integer/u,
    ],
    [
      "bundle byte length",
      (environment) => (environment.bundle.byteLength = 0),
      /Bundle byte length must be a positive safe integer/u,
    ],
  ])("rejects invalid %s metadata", async (_label, mutate, expected) => {
    const inputs = await loadInputs();
    mutate(inputs.qualification.environment);
    expect(() => validate(inputs)).toThrow(expected);
  });

  it("rejects manifest prompt drift and qualification reordering", async () => {
    const manifestDrift = await loadInputs();
    manifestDrift.manifest.interface.defaultPrompt[0] = "Changed prompt";
    expect(() => validate(manifestDrift)).toThrow(
      "Manifest prompts must exactly match the ordered starter contract prompts",
    );

    const reordered = await loadInputs();
    reordered.qualification.examples.reverse();
    expect(() => validate(reordered)).toThrow(
      "Qualification examples must exactly match the ordered starter IDs and prompts",
    );
  });

  it.each([
    [
      "bundle identity",
      (qualification) => (qualification.environment.bundle.kind = "source-tree"),
      /marketplace bundle/u,
    ],
    [
      "bundle digest",
      (qualification) => (qualification.environment.bundle.sha256 = "bad"),
      /Bundle digest must be SHA-256/u,
    ],
    [
      "model configuration",
      (qualification) => (qualification.environment.model.configuration = {}),
      /Model configuration must be recorded/u,
    ],
    [
      "reasoning level",
      (qualification) => (qualification.environment.reasoning.level = "High"),
      /reasoning level must be Ultra/iu,
    ],
    [
      "optional-skill fallback",
      (qualification) =>
        (qualification.environment.optionalLifeScienceSkills.unavailableFallbackQualified =
          false),
      /unavailable official-endpoint fallback/u,
    ],
  ])("rejects incomplete environment %s", async (_label, mutate, expected) => {
    const inputs = await loadInputs();
    mutate(inputs.qualification);
    expect(() => validate(inputs)).toThrow(expected);
  });

  it.each([
    [
      "non-empty workspace",
      (example) => example.workspace.initialEntries.push("old.fasta"),
      /demonstrably empty workspace/u,
    ],
    [
      "second card",
      (example) => (example.viewer.cardCount = 2),
      /exactly one contribution, card, active session/u,
    ],
    [
      "wrong mode",
      (example) => (example.viewer.mode = "alignment"),
      /expected mode/u,
    ],
    [
      "fixture fallback",
      (example) => (example.source.usedBundledFixture = true),
      /without fixture or pre-existing input/u,
    ],
    [
      "source identity drift",
      (example) => (example.source.identifiers = ["FAKE.1"]),
      /source identities must match/u,
    ],
    [
      "science not live",
      (example) => (example.science.liveViewerState = false),
      /from live viewer state/u,
    ],
    [
      "missing screenshot",
      (example) => delete example.evidence.screenshot,
      /screenshot must be an object/u,
    ],
    [
      "missing timing",
      (example) => (example.timing.durationMs = 0),
      /duration must be a positive finite number/u,
    ],
  ])("rejects per-example %s", async (_label, mutate, expected) => {
    const inputs = await loadInputs();
    mutate(inputs.qualification.examples[0]);
    expect(() => validate(inputs)).toThrow(expected);
  });

  it.each([
    [
      "exact prompt",
      (modelRun) => (modelRun.prompt = "A different prompt"),
      /bind the exact prompt, model, installed bundle/u,
    ],
    [
      "installed bundle",
      (modelRun) => (modelRun.installedBundleSha256 = "f".repeat(64)),
      /bind the exact prompt, model, installed bundle/u,
    ],
    [
      "complete trace",
      (modelRun) => (modelRun.completeModelToolViewerTrace = false),
      /bind the exact prompt, model, installed bundle/u,
    ],
    [
      "mounted viewer",
      (modelRun) => (modelRun.viewerMounted = false),
      /bind the exact prompt, model, installed bundle/u,
    ],
    [
      "authoritative acquisition first",
      (modelRun) =>
        (modelRun.toolSequence = [
          "sequence.query_viewer",
          "sequence.open_from_chat",
          "sequence.query_viewer",
        ]),
      /host-authorized Codex acquisition without plugin-managed fetching/u,
    ],
    [
      "an absolute-path chat open",
      (modelRun) =>
        (modelRun.toolSequence = [
          "codex.workspace.exec",
          "sequence.query_viewer",
        ]),
      /before exactly one absolute-path chat open/u,
    ],
    [
      "a single viewer opening",
      (modelRun) =>
        (modelRun.toolSequence = [
          "codex.workspace.exec",
          "sequence.open_from_chat",
          "sequence.open_from_chat",
          "sequence.query_viewer",
        ]),
      /before exactly one absolute-path chat open/u,
    ],
    [
      "Codex-owned acquisition before opening",
      (modelRun) =>
        (modelRun.toolSequence = [
          "sequence.open_from_chat",
          "sequence.query_viewer",
        ]),
      /before exactly one absolute-path chat open/u,
    ],
    [
      "a plugin-free acquisition lane",
      (modelRun) =>
        (modelRun.toolSequence = [
          "sequence.acquire_public_example",
          "sequence.open_from_chat",
          "sequence.query_viewer",
        ]),
      /host-authorized Codex acquisition without plugin-managed fetching/u,
    ],
    [
      "live viewer operation",
      (modelRun) =>
        (modelRun.toolSequence = [
          "codex.workspace.exec",
          "sequence.open_from_chat",
        ]),
      /drive or query live viewer state after acquisition/u,
    ],
  ])("rejects a model run without %s", async (_label, mutate, expected) => {
    const inputs = await loadInputs();
    mutate(inputs.qualification.examples[0].modelRun);
    expect(() => validate(inputs)).toThrow(expected);
  });

  it("rejects incomplete derived-artifact provenance and collision semantics", async () => {
    const inputs = await loadInputs();
    const ras = inputs.qualification.examples.find(
      ({ id }) => id === "uniprot-human-ras-sv1",
    );
    ras.artifacts.derived.sourceSha256 = "f".repeat(64);
    expect(() => validate(inputs)).toThrow(
      "derived artifact must retain the source digest",
    );

    const collision = await loadInputs();
    const collisionRas = collision.qualification.examples.find(
      ({ id }) => id === "uniprot-human-ras-sv1",
    );
    collisionRas.artifacts.derived.collisionFailureQualified = false;
    expect(() => validate(collision)).toThrow(/create-new, collision, and round-trip/u);
  });

  it("requires every negative case and its safe outcome", async () => {
    const missing = await loadInputs();
    missing.qualification.negativeCases.splice(3, 1);
    expect(() => validate(missing)).toThrow(
      "Qualification negative matrix must contain every required case in canonical order",
    );

    const unsafe = await loadInputs();
    unsafe.qualification.negativeCases[0].noBundledFallback = false;
    expect(() => validate(unsafe)).toThrow(/without misleading viewer, artifact, or fallback/u);

    const reused = await loadInputs();
    reused.qualification.negativeCases[1].evidence.trace =
      reused.qualification.negativeCases[0].evidence.trace;
    expect(() => validate(reused)).toThrow(/distinct scenario trace/u);

    const unbound = await loadInputs();
    unbound.qualification.negativeCases[0].evidence.requirement = "different";
    expect(() => validate(unbound)).toThrow(/scenario-specific/u);

    const wrongBundle = await loadInputs();
    wrongBundle.qualification.negativeCases[0].evidence.bundleSha256 =
      "f".repeat(64);
    expect(() => validate(wrongBundle)).toThrow(/scenario-specific/u);

    const notVisible = await loadInputs();
    notVisible.qualification.negativeCases[0].evidence.visibleInstalledHost =
      false;
    expect(() => validate(notVisible)).toThrow(/scenario-specific/u);

    const fallback = await loadInputs();
    const fallbackCase = fallback.qualification.negativeCases.find(
      ({ requirement }) => requirement === "optional-skill-unavailable-fallback",
    );
    fallbackCase.officialEndpointFallbackSucceeded = false;
    expect(() => validate(fallback)).toThrow(/successful official-endpoint fallback/u);

    const remount = await loadInputs();
    const remountCase = remount.qualification.negativeCases.find(
      ({ requirement }) => requirement === "viewer-retry-remount",
    );
    remountCase.sessionContinuityVerified = false;
    expect(() => validate(remount)).toThrow(/successful session continuity/u);
  });

  it("requires LSC-79/82 links and contract-complete nondeterminism", async () => {
    const links = await loadInputs();
    links.qualification.relatedIssues[1].id = "LSC-999";
    expect(() => validate(links)).toThrow(/link LSC-79 and LSC-82/u);

    const variability = await loadInputs();
    variability.qualification.acceptableNondeterminism = ["timestamps"];
    expect(() => validate(variability)).toThrow(
      /Qualification nondeterminism is missing contract allowance/u,
    );
  });

  it("rejects report hash or content drift", async () => {
    const hashDrift = await loadInputs();
    hashDrift.reportMarkdown += "\nchanged\n";
    expect(() => validate(hashDrift)).toThrow(
      "Qualification report digest does not match the checked-in Markdown",
    );

    const contentDrift = await loadInputs();
    const omitted = contentDrift.qualification.examples[0].evidence.trace.url;
    contentDrift.reportMarkdown = contentDrift.reportMarkdown.replace(omitted, "omitted");
    contentDrift.qualification.report.markdownSha256 = sha256(
      contentDrift.reportMarkdown,
    );
    expect(() => validate(contentDrift)).toThrow(
      `Qualification report is missing synchronized value: ${omitted}`,
    );
  });

  it("bounds qualification and report payloads", async () => {
    const inputs = await loadInputs();
    inputs.reportMarkdown = `# LSC-109 Passed\n${"x".repeat(1_024 * 1_024)}`;
    expect(() => validate(inputs)).toThrow(
      "Qualification report markdown must be a bounded non-empty string",
    );
  });
});
