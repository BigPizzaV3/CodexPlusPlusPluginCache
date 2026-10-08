const MAX_DEFAULT_PROMPT_LENGTH = 128;
const CHAT_OPEN_TOOL_NAME = "sequence.open_from_chat";
const LEGACY_PUBLIC_EXAMPLE_TOOL_NAME = "sequence.acquire_public_example";
const STARTER_ACQUISITION_OWNER = "codex";
const STARTER_ACQUISITION_METHOD =
  "host-authorized-research-and-workspace-tools";
const EXPECTED_EXAMPLE_IDS = [
  "ena-drr037765-first-500",
  "uniprot-human-ras-sv1",
  "ncbi-nc-001416-1",
];
const LSC_109_URL =
  "https://linear.app/openai/issue/LSC-109/sequence-and-alignment-viewer-qualify-every-refreshed-starter-example";
const LSC_109_REPORT = "LSC_109_QUALIFICATION.md";
const LSC_109_RECORD = "lsc-109-qualification.json";
const ENA_OFFICIAL_ENDPOINTS = [
  "https://www.ebi.ac.uk/ena/portal/api/filereport",
  "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz",
];
const RAS_OFFICIAL_ENDPOINTS = [
  "https://rest.uniprot.org/uniprotkb/P01116.fasta",
  "https://rest.uniprot.org/uniprotkb/P01111.fasta",
  "https://rest.uniprot.org/uniprotkb/P01112.fasta",
];
const NCBI_OFFICIAL_ENDPOINTS = [
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
];

export function validateSequenceViewerExamplePrompts(
  manifest,
  viewerSkill,
  starterContract,
  documents,
) {
  assert(
    starterContract != null && typeof starterContract === "object",
    "Starter expected-results contract must be an object",
  );
  assert(
    starterContract.schemaVersion === 1,
    "Starter expected-results contract must use schemaVersion 1",
  );
  assert(
    starterContract.pluginVersion === manifest.version,
    "Starter contract and manifest plugin versions must match",
  );
  const qualification = starterContract.downstreamQualification;
  assert(
    qualification?.issue === "LSC-109" &&
      qualification?.url === LSC_109_URL &&
      typeof qualification?.lastQualifiedPluginVersion === "string" &&
      qualification.lastQualifiedPluginVersion !== starterContract.pluginVersion &&
      qualification?.qualificationComplete === false &&
      qualification?.status === "pending" &&
      qualification?.qualificationReport === LSC_109_REPORT &&
      qualification?.qualificationRecord === LSC_109_RECORD,
    "Starter contract must preserve the historical LSC-109 qualification and keep the current version pending",
  );

  const examples = starterContract.examples;
  assert(Array.isArray(examples), "Starter contract examples must be an array");
  assert(
    examples.length === EXPECTED_EXAMPLE_IDS.length,
    `Starter contract must contain exactly ${EXPECTED_EXAMPLE_IDS.length} examples`,
  );
  assert(
    JSON.stringify(examples.map(({ id }) => id)) ===
      JSON.stringify(EXPECTED_EXAMPLE_IDS),
    "Starter contract example IDs and order must match the curated portfolio",
  );

  const prompts = manifest.interface?.defaultPrompt;
  assert(Array.isArray(prompts), "Manifest defaultPrompt must be an array");
  const contractPrompts = examples.map(({ prompt }) => prompt);
  assert(
    JSON.stringify(prompts) === JSON.stringify(contractPrompts),
    "Manifest prompts must exactly equal the ordered starter contract prompts",
  );
  validateCodexManagedStarterGuidance(viewerSkill);

  const requiredDocuments = {
    publicReadme: documents?.publicReadme,
    runbook: documents?.runbook,
  };
  for (const [label, contents] of Object.entries(requiredDocuments)) {
    assert(
      typeof contents === "string" && contents.length > 0,
      `Starter validation requires ${label}`,
    );
  }
  const synchronizedDocuments = {
    ...requiredDocuments,
    viewerSkill,
    ...(documents?.internalReadme == null
      ? {}
      : { internalReadme: documents.internalReadme }),
  };
  for (const prompt of contractPrompts) {
    assert(
      typeof prompt === "string" && prompt.length > 0,
      "Every starter contract prompt must be a non-empty string",
    );
    assert(
      new TextEncoder().encode(prompt.trim()).byteLength <=
        MAX_DEFAULT_PROMPT_LENGTH,
      `Starter prompt exceeds ${MAX_DEFAULT_PROMPT_LENGTH} UTF-8 bytes: ${prompt}`,
    );
    assert(
      !/^Open this\b/iu.test(prompt),
      "Every starter prompt must retrieve its input before opening",
    );
    assert(
      viewerSkill.includes(prompt),
      `Viewer skill is missing exact starter prompt: ${prompt}`,
    );
    for (const [label, contents] of Object.entries(synchronizedDocuments)) {
      assert(
        contents.includes(prompt),
        `${label} is missing exact starter prompt: ${prompt}`,
      );
    }
  }

  const publicStarterSurface = [
    JSON.stringify(manifest),
    JSON.stringify(starterContract),
    viewerSkill,
    ...Object.values(requiredDocuments),
  ].join("\n");
  for (const forbidden of [
    "sequence.open_fastq_example",
    "bundled sample FASTQ",
    "smoke-fixtures",
    "/tmp/",
  ]) {
    assert(
      !publicStarterSurface.includes(forbidden),
      `Public starter contract still references test-only or unsafe data: ${forbidden}`,
    );
  }

  for (const example of examples) validateExampleShape(example);
  validateEna(exampleById(examples, "ena-drr037765-first-500"));
  validateRas(exampleById(examples, "uniprot-human-ras-sv1"));
  validateNcbi(exampleById(examples, "ncbi-nc-001416-1"));
  validateCapabilityMatrix(starterContract.capabilityMatrix);
  validateAlternatives(starterContract.evaluatedAlternatives);

  for (const endpoint of [
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
    "https://rest.uniprot.org/uniprotkb/P01116.fasta",
    "https://rest.uniprot.org/uniprotkb/P01111.fasta",
    "https://rest.uniprot.org/uniprotkb/P01112.fasta",
    "https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/Rfam.seed.gz",
    "https://www.ebi.ac.uk/ena/portal/api/filereport",
    "https://ftp.sra.ebi.ac.uk/",
  ]) {
    assert(
      viewerSkill.includes(endpoint),
      `Viewer skill is missing exact official fallback endpoint: ${endpoint}`,
    );
  }
  for (const contents of Object.values(synchronizedDocuments)) {
    assert(
      contents.includes(LSC_109_URL),
      "Starter documentation must link the completed LSC-109 audit",
    );
    assert(
      contents.includes(LSC_109_REPORT) && contents.includes(LSC_109_RECORD),
      "Starter documentation must link the synchronized LSC-109 report and record",
    );
    assert(
      contents.includes(qualification.lastQualifiedPluginVersion) &&
        contents.includes(starterContract.pluginVersion) &&
        /(?:pending|has not received a separate clean-host qualification)/iu.test(contents),
      "Starter documentation must distinguish the historical qualification from the pending current version",
    );
  }
}

function validateCodexManagedStarterGuidance(viewerSkill) {
  assert(
    viewerSkill.includes(CHAT_OPEN_TOOL_NAME),
    "Viewer skill must open Codex-acquired starters with sequence.open_from_chat",
  );
  assert(
    /host-authorized\s+research\s+and\s+workspace\s+tools/iu.test(
      viewerSkill,
    ),
    "Viewer skill must acquire starters with host-authorized research and workspace tools",
  );
  assert(
    /exact\s+absolute\s+local\s+path/iu.test(viewerSkill),
    "Viewer skill must open the acquired starter by its exact absolute local path",
  );
  assert(
    /never\s+fetch\s+an\s+arbitrary\s+URL/iu.test(viewerSkill),
    "Viewer skill must prohibit arbitrary public-example URLs",
  );

  const mandatoryLegacyAcquisition = [
    /\b(?:must|should|required\s+to)\s+(?:always\s+)?(?:call|use)\s+`?sequence\.acquire_public_example`?/iu,
    /\b(?:call|use)\s+`?sequence\.acquire_public_example`?\s+(?:for|with)\b/iu,
    /\bsequence\.acquire_public_example\b[^\n.]{0,100}\b(?:is|remains)\s+(?:required|mandatory)\b/iu,
  ];
  assert(
    mandatoryLegacyAcquisition.every((pattern) => !pattern.test(viewerSkill)),
    "Viewer skill must not require plugin-managed public-example acquisition",
  );

  if (viewerSkill.includes(LEGACY_PUBLIC_EXAMPLE_TOOL_NAME)) {
    assert(
      /\boptional\b/iu.test(viewerSkill) &&
        /independently\s+authenticated\s+(?:workspace\s+)?roots?/iu.test(
          viewerSkill,
        ),
      "Legacy public-example acquisition must remain optional and require independently authenticated roots",
    );
  }
}

function validateExampleShape(example) {
  assert(
    ["Sequence", "Alignment"].includes(example.area),
    `${example.id} must declare Sequence or Alignment area`,
  );
  assert(
    typeof example.source?.database === "string" &&
      nonEmptyArray(example.source?.stableIdentifiers) &&
      nonEmptyArray(example.source?.officialEndpoints) &&
      example.source.officialEndpoints.every((url) =>
        /^https:\/\//u.test(url),
      ) &&
      /\bCodex\b/iu.test(example.source?.optionalSkill ?? "") &&
      /\b(?:official|fixed)\b/iu.test(example.source?.optionalSkill ?? "") &&
      /\bauthorized\s+workspace\s+tools\b/iu.test(
        example.source?.optionalSkill ?? "",
      ),
    `${example.id} must declare authoritative stable IDs, HTTPS endpoints, and Codex-authorized official-source acquisition`,
  );
  assert(
    objectHasKeys(example.bounds),
    `${example.id} must declare runtime and size bounds`,
  );
  assert(
    example.viewer?.viewerCount === 1 &&
      example.viewer?.sessionCount === 1 &&
      ["sequence", "alignment"].includes(example.viewer?.mode) &&
      nonEmptyArray(example.viewer?.visibleState),
    `${example.id} must declare one viewer/session and expected visible state`,
  );
  assert(
    example.workflow?.acquisitionOwner === STARTER_ACQUISITION_OWNER &&
      example.workflow?.acquisitionMethod === STARTER_ACQUISITION_METHOD &&
      example.workflow?.openTool === CHAT_OPEN_TOOL_NAME &&
      !Object.hasOwn(example.workflow, "acquisitionTool") &&
      nonEmptyArray(example.workflow?.operations) &&
      typeof example.workflow?.scientificQuestion === "string",
    `${example.id} must declare Codex-managed host-authorized acquisition, one chat open, and analysis beyond opening`,
  );
  assert(
    objectHasKeys(example.expectedResults),
    `${example.id} must declare scientific expected results`,
  );
  assert(
    typeof example.artifacts?.source === "string" &&
      typeof example.artifacts?.sourceProvenance === "string" &&
      example.artifacts?.sourceProvenanceOwner === STARTER_ACQUISITION_OWNER,
    `${example.id} must declare source artifact paths and honestly Codex-authored provenance`,
  );
  assert(
    nonEmptyArray(example.failureBehavior) &&
      nonEmptyArray(example.acceptableVariability) &&
      nonEmptyArray(example.tests),
    `${example.id} must declare failure, variability, and test ownership`,
  );
}

function validateEna(example) {
  assert(
    example.prompt.includes("DRR037765") &&
      example.prompt.includes("first 500 reads") &&
      example.prompt.includes("length range") &&
      example.prompt.includes("GC") &&
      example.prompt.includes("Q30") &&
      example.prompt.includes("subset provenance"),
    "ENA starter prompt must require deterministic live QC and subset provenance",
  );
  assert(
    JSON.stringify(example.source.stableIdentifiers) ===
      JSON.stringify([
        "DRR037765",
        "DRR037765.fastq.gz@md5:81735432a6f578b332aae58cdbd95231",
      ]) &&
      JSON.stringify(example.source.officialEndpoints) ===
        JSON.stringify(ENA_OFFICIAL_ENDPOINTS) &&
      example.bounds.metadataBytes === 262_144 &&
      example.bounds.compressedBytes === 16_777_216 &&
      example.bounds.decodedBytes === 67_108_864 &&
      example.bounds.sourceRecords === 967 &&
      example.bounds.selectedRecords === 500 &&
      example.bounds.selectionRule ===
        "first 500 complete parsed FASTQ records in source order, canonical four-line FASTQ" &&
      example.bounds.liveTimeoutSeconds === 60 &&
      example.expectedResults.readCount === 500 &&
      example.expectedResults.totalBases === 235490 &&
      example.expectedResults.readLengthMin === 469 &&
      example.expectedResults.readLengthMax === 471 &&
      example.expectedResults.gcPercent === 28.8462355 &&
      example.expectedResults.q30Percent === 95.3976814 &&
      example.expectedResults.artifactByteLength === 480372 &&
      example.expectedResults.artifactSha256 ===
        "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9",
    "ENA contract must pin the first-500 source and scientific baseline",
  );
}

function validateRas(example) {
  const stableIds = example.source.stableIdentifiers;
  assert(
    JSON.stringify(stableIds) ===
      JSON.stringify(["P01116@SV1", "P01111@SV1", "P01112@SV1"]) &&
      JSON.stringify(example.source.officialEndpoints) ===
        JSON.stringify(RAS_OFFICIAL_ENDPOINTS) &&
      example.bounds.responseBytesPerRecord === 32_768 &&
      example.bounds.recordCount === 3 &&
      example.bounds.residuesPerRecord === 189 &&
      example.bounds.alignmentEngine === "builtin-center-star" &&
      example.bounds.alignmentDynamicProgrammingCells === 72_200 &&
      example.bounds.alignedColumns === 191 &&
      example.bounds.treeRows === 3 &&
      example.bounds.liveTimeoutSeconds === 60,
    "RAS starter must pin the three reviewed UniProtKB sequence versions",
  );
  for (const fragment of [
    "P01116/P01111/P01112",
    "conserved motifs",
    "KRAS",
    "distances/tree",
    "Newick",
    "workspace",
  ]) {
    assert(
      example.prompt.includes(fragment),
      `RAS starter prompt is missing: ${fragment}`,
    );
  }
  assert(
    example.viewer.mode === "alignment" &&
      example.bounds.alignmentEngine === "builtin-center-star" &&
      example.bounds.alignedColumns === 191 &&
      example.expectedResults.artifactByteLength === 786 &&
      example.expectedResults.artifactSha256 ===
        "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f" &&
      example.expectedResults.reference === "P01116" &&
      JSON.stringify(example.expectedResults.motifs) ===
        JSON.stringify([
          "P-loop KRAS 10-17 GAGGVGKS",
          "switch I KRAS 30-38 DEYDPTIED",
          "switch II KRAS 60-76 GQEEYSAMRDQYMRTGE",
          "NKXD region KRAS 116-119 NKCD",
        ]) &&
      JSON.stringify(example.expectedResults.caaxTails) ===
        JSON.stringify({ P01116: "CIIM", P01111: "CVVM", P01112: "CVLS" }) &&
      JSON.stringify(example.expectedResults.pDistances) ===
        JSON.stringify({
          "P01116/P01111": 0.1315789474,
          "P01116/P01112": 0.1368421053,
          "P01111/P01112": 0.1578947368,
        }) &&
      JSON.stringify(example.expectedResults.treeLeaves) ===
        JSON.stringify(["P01116", "P01111", "P01112"]) &&
      example.expectedResults.treeNewick ===
        "('P01116':0.027632,('P01111':0.076316,'P01112':0.081579):0.027632);",
    "RAS contract must require genuine Alignment mode, KRAS reference, and a three-leaf tree",
  );
  const operations = example.workflow.operations.join("\n");
  assert(
    operations.includes("distance-matrix") &&
      operations.includes("neighbor-joining") &&
      /\bCodex\s+writes\s+verified\s+Newick\b/u.test(operations) &&
      !operations.includes("sequence.export_artifact"),
    "RAS contract must exercise distance, graphical tree, and Codex-authorized Newick publication",
  );
  const derived = example.artifacts.derived;
  assert(
    derived?.format === "newick" &&
      derived.destination?.kind === "workspace" &&
      derived.destination?.writer === STARTER_ACQUISITION_OWNER &&
      derived.destination?.base === "opened-source" &&
      derived.destination?.relativePath === "RAS-P01116-P01111-P01112-NJ.nwk" &&
      typeof derived.provenance === "string" &&
      nonEmptyArray(derived.requiredProvenance) &&
      derived.requiredProvenance
        .join("\n")
        .includes("sequence-viewer-guide-tree-v1") &&
      derived.requiredProvenance
        .join("\n")
        .includes("uncorrected-p-distance") &&
      derived.requiredProvenance.join("\n").includes("Codex-authored"),
    "RAS starter must workspace-publish provenance-bearing Newick",
  );
}

function validateNcbi(example) {
  assert(
    example.prompt.includes("NC_001416.1") &&
      example.prompt.includes("cI") &&
      example.prompt.includes("OR1–OR3") &&
      example.prompt.includes("code 11"),
    "NCBI starter prompt must require the cI/operator code-aware workflow",
  );
  assert(
    JSON.stringify(example.source.stableIdentifiers) ===
      JSON.stringify(["NC_001416.1", "NP_040628.1"]) &&
      JSON.stringify(example.source.officialEndpoints) ===
        JSON.stringify(NCBI_OFFICIAL_ENDPOINTS) &&
      example.bounds.responseBytes === 2_097_152 &&
      example.bounds.recordCount === 1 &&
      example.bounds.residueCount === 48_502 &&
      example.bounds.liveTimeoutSeconds === 60 &&
      example.expectedResults.sequenceLength === 48502 &&
      example.expectedResults.ci?.location === "complement(37227..37940)" &&
      example.expectedResults.ci?.start === 37_227 &&
      example.expectedResults.ci?.end === 37_940 &&
      example.expectedResults.ci?.strand === "-" &&
      example.expectedResults.ci?.geneticCodeId === 11 &&
      example.expectedResults.ci?.proteinAccession === "NP_040628.1" &&
      example.expectedResults.ci?.aminoAcids === 237 &&
      example.expectedResults.ci?.codingSequenceSha256 ===
        "a51dec784e51f85a35d643a84820c89430b526cd9bf54a398b91c70045cc62e8" &&
      example.expectedResults.ci?.proteinSha256 ===
        "ec5d954fd10be8c19c920e78badc5d9e9cc281f6801e2c5fde3803c9f133f580" &&
      JSON.stringify(example.expectedResults.operators) ===
        JSON.stringify({
          OR3: "37951..37967",
          OR2: "37974..37990",
          OR1: "37998..38014",
        }) &&
      example.workflow.operations.includes(
        "sequence.run_analysis translate start 37227 end 37940 frame -1 geneticCodeId 11",
      ),
    "NCBI contract must pin the exact lambda cI feature and translation",
  );
}

function validateCapabilityMatrix(matrix) {
  assert(Array.isArray(matrix), "Capability matrix must be an array");
  const expectedMappings = [
    { area: "Sequence", exampleIds: ["ncbi-nc-001416-1"] },
    { area: "Sequence", exampleIds: ["ena-drr037765-first-500"] },
    { area: "Alignment", exampleIds: ["uniprot-human-ras-sv1"] },
    { area: "Shared", exampleIds: EXPECTED_EXAMPLE_IDS },
    { area: "Output", exampleIds: ["uniprot-human-ras-sv1"] },
    { area: "Not selected", exampleIds: [] },
  ];
  assert(
    matrix.length === expectedMappings.length &&
      matrix.every(
        (row, index) =>
          row.area === expectedMappings[index]?.area &&
          JSON.stringify(row.exampleIds) ===
            JSON.stringify(expectedMappings[index]?.exampleIds),
      ),
    "Capability matrix area-to-example mappings must exactly match the curated portfolio",
  );
  for (const area of [
    "Sequence",
    "Alignment",
    "Shared",
    "Output",
    "Not selected",
  ]) {
    assert(
      matrix.some((row) => row.area === area),
      `Capability matrix is missing ${area} coverage`,
    );
  }
  for (const row of matrix) {
    assert(
      typeof row.capability === "string" &&
        Array.isArray(row.exampleIds) &&
        typeof row.expectedState === "string" &&
        typeof row.artifactProvenance === "string" &&
        typeof row.failureBehavior === "string" &&
        nonEmptyArray(row.tests),
      `Capability matrix row ${row.area ?? "unknown"} is incomplete`,
    );
  }
}

function validateAlternatives(alternatives) {
  assert(
    Array.isArray(alternatives) &&
      alternatives.some(({ candidate }) => candidate.includes("RF00360")) &&
      alternatives.some(({ candidate }) => candidate.includes("RF00008")),
    "Starter selection record must document the evaluated Rfam alternatives",
  );
  assert(
    alternatives.every(
      ({ candidate, decision, reason }) =>
        typeof candidate === "string" &&
        typeof decision === "string" &&
        typeof reason === "string",
    ),
    "Every evaluated alternative needs a decision and rationale",
  );
}

function exampleById(examples, id) {
  const example = examples.find((candidate) => candidate.id === id);
  assert(example != null, `Missing ${id} starter contract`);
  return example;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function objectHasKeys(value) {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
