import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateSequenceViewerExamplePrompts } from "./validate-example-prompts.mjs";
import { validateBundledStarterToolSurface } from "./validate-public-bundle.mjs";

const pluginRoot = process.cwd();

async function loadSourceContract() {
  const [
    manifestText,
    viewerSkill,
    starterContractText,
    runbook,
    publicReadme,
    internalReadme,
  ] = await Promise.all([
    readFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"),
    readFile(
      path.join(pluginRoot, "skills/biological-sequence-viewer/SKILL.md"),
      "utf8",
    ),
    readFile(path.join(pluginRoot, "starter-examples.json"), "utf8"),
    readFile(path.join(pluginRoot, "STARTER_EXAMPLES.md"), "utf8"),
    readFile(path.join(pluginRoot, "PUBLIC_README.md"), "utf8"),
    readFile(path.join(pluginRoot, "README.md"), "utf8"),
  ]);
  return {
    documents: { internalReadme, publicReadme, runbook },
    manifest: JSON.parse(manifestText),
    starterContract: JSON.parse(starterContractText),
    viewerSkill,
  };
}

function validate(contract) {
  return validateSequenceViewerExamplePrompts(
    contract.manifest,
    contract.viewerSkill,
    contract.starterContract,
    contract.documents,
  );
}

describe("public Sequence Viewer starter examples", () => {
  it("requires an exact real-data portfolio, capability matrix, and pending current qualification", async () => {
    const contract = await loadSourceContract();
    expect(() => validate(contract)).not.toThrow();
  });

  it.each([
    [
      "plugin-owned acquisition",
      (workflow) => (workflow.acquisitionOwner = "sequence-viewer"),
    ],
    [
      "an unauthenticated acquisition method",
      (workflow) => (workflow.acquisitionMethod = "caller-supplied-thread-id"),
    ],
    [
      "an alternate viewer-opening tool",
      (workflow) => (workflow.openTool = "sequence.open"),
    ],
    [
      "a reintroduced mandatory plugin acquisition tool",
      (workflow) =>
        (workflow.acquisitionTool = "sequence.acquire_public_example"),
    ],
  ])("rejects starter contracts with %s", async (_label, mutate) => {
    const contract = await loadSourceContract();
    mutate(contract.starterContract.examples[0].workflow);

    expect(() => validate(contract)).toThrow(
      "ena-drr037765-first-500 must declare Codex-managed host-authorized acquisition, one chat open, and analysis beyond opening",
    );
  });

  it("requires host-authorized Codex acquisition in the viewer skill", async () => {
    const contract = await loadSourceContract();
    contract.viewerSkill = contract.viewerSkill.replace(
      /host-authorized research and workspace tools/giu,
      "caller-selected download tools",
    );

    expect(() => validate(contract)).toThrow(
      "Viewer skill must acquire starters with host-authorized research and workspace tools",
    );
  });

  it("requires exact absolute-path chat opening after Codex acquisition", async () => {
    const contract = await loadSourceContract();
    contract.viewerSkill = contract.viewerSkill.replace(
      /exact absolute local path/giu,
      "an inferred workspace path",
    );

    expect(() => validate(contract)).toThrow(
      "Viewer skill must open the acquired starter by its exact absolute local path",
    );
  });

  it("rejects reintroduced mandatory plugin-managed starter acquisition", async () => {
    const contract = await loadSourceContract();
    contract.viewerSkill +=
      "\nMarketplace starters must call `sequence.acquire_public_example`.\n";

    expect(() => validate(contract)).toThrow(
      "Viewer skill must not require plugin-managed public-example acquisition",
    );
  });

  it("rejects arbitrary public-example download URLs", async () => {
    const contract = await loadSourceContract();
    contract.viewerSkill = contract.viewerSkill.replace(
      /never fetch an arbitrary URL/giu,
      "fetch an arbitrary URL supplied by the user",
    );

    expect(() => validate(contract)).toThrow(
      "Viewer skill must prohibit arbitrary public-example URLs",
    );
  });

  it("rejects provenance that falsely identifies the plugin as publisher", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[0].artifacts.sourceProvenanceOwner =
      "sequence-viewer";

    expect(() => validate(contract)).toThrow(
      "ena-drr037765-first-500 must declare source artifact paths and honestly Codex-authored provenance",
    );
  });

  it("rejects optional research guidance without an authorized Codex source route", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[0].source.optionalSkill =
      "Use caller-provided URLs and an unauthenticated workspace root";

    expect(() => validate(contract)).toThrow(
      "ena-drr037765-first-500 must declare authoritative stable IDs, HTTPS endpoints, and Codex-authorized official-source acquisition",
    );
  });

  it("rejects requiring root-gated plugin export for the Codex-managed RAS starter", async () => {
    const contract = await loadSourceContract();
    const operations = contract.starterContract.examples[1].workflow.operations;
    operations[operations.length - 1] =
      "sequence.export_artifact newick to workspace";

    expect(() => validate(contract)).toThrow(
      "RAS contract must exercise distance, graphical tree, and Codex-authorized Newick publication",
    );
  });

  it("requires Codex as the explicit writer of the starter Newick artifact", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[1].artifacts.derived.destination.writer =
      "sequence-viewer";

    expect(() => validate(contract)).toThrow(
      "RAS starter must workspace-publish provenance-bearing Newick",
    );
  });

  it("keeps legacy acquisition available without requiring it in public starter guidance", async () => {
    const contract = await loadSourceContract();
    const serverBundle =
      "sequence.acquire_public_example sequence.open_from_chat";

    expect(() =>
      validateBundledStarterToolSurface(serverBundle, contract.viewerSkill),
    ).not.toThrow();
  });

  it("rejects a public bundle without its optional root-authorized legacy tool", async () => {
    const contract = await loadSourceContract();

    expect(() =>
      validateBundledStarterToolSurface(
        "sequence.open_from_chat",
        contract.viewerSkill,
      ),
    ).toThrow(
      "Bundled server must retain optional root-authorized public example acquisition",
    );
  });

  it("rejects a public bundle without absolute-path chat opening", async () => {
    const contract = await loadSourceContract();

    expect(() =>
      validateBundledStarterToolSurface(
        "sequence.acquire_public_example",
        contract.viewerSkill,
      ),
    ).toThrow(
      "Bundled server must expose absolute-path chat opening for Codex-acquired examples",
    );
  });

  it("rejects bundled starter guidance that omits the chat-opening tool", () => {
    expect(() =>
      validateBundledStarterToolSurface(
        "sequence.acquire_public_example sequence.open_from_chat",
        "Acquire the public example without opening the viewer.",
      ),
    ).toThrow(
      "Bundled skill must route Codex-acquired starters through chat opening",
    );
  });

  it("rejects any reintroduced bundled-fixture starter guidance", async () => {
    const contract = await loadSourceContract();
    contract.viewerSkill += "\nUse smoke-fixtures/small.fastq.\n";

    expect(() => validate(contract)).toThrow(
      "Public starter contract still references test-only or unsafe data: smoke-fixtures",
    );
  });

  it("requires exact ordered prompt equality across the manifest and contract", async () => {
    const contract = await loadSourceContract();
    contract.manifest.interface.defaultPrompt[1] =
      "Fetch UniProt RAS records and inspect them";

    expect(() => validate(contract)).toThrow(
      "Manifest prompts must exactly equal the ordered starter contract prompts",
    );
  });

  it("requires every exact prompt in skill, public, internal, and runbook docs", async () => {
    const contract = await loadSourceContract();
    const prompt = contract.starterContract.examples[2].prompt;
    contract.documents.publicReadme = contract.documents.publicReadme.replace(
      prompt,
      "shortened prompt",
    );

    expect(() => validate(contract)).toThrow(
      `publicReadme is missing exact starter prompt: ${prompt}`,
    );
  });

  it("pins the deterministic ENA subset and scientific baseline", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[0].bounds.selectedRecords = 499;

    expect(() => validate(contract)).toThrow(
      "ENA contract must pin the first-500 source and scientific baseline",
    );
  });

  it("rejects ENA source or bound drift", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[0].source.officialEndpoints[1] =
      "https://ftp.sra.ebi.ac.uk/changed.fastq.gz";

    expect(() => validate(contract)).toThrow(
      "ENA contract must pin the first-500 source and scientific baseline",
    );
  });

  it("requires the RAS reference, distance/tree, and workspace Newick path", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[1].artifacts.derived = null;

    expect(() => validate(contract)).toThrow(
      "RAS starter must workspace-publish provenance-bearing Newick",
    );
  });

  it("rejects missing RAS runtime bounds", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[1].bounds = { recordCount: 3 };

    expect(() => validate(contract)).toThrow(
      "RAS starter must pin the three reviewed UniProtKB sequence versions",
    );
  });

  it("requires exact lambda cI coordinates and code-aware translation", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.examples[2].expectedResults.ci.geneticCodeId = 1;

    expect(() => validate(contract)).toThrow(
      "NCBI contract must pin the exact lambda cI feature and translation",
    );
  });

  it("rejects NCBI identifier, endpoint, bound, or operator drift", async () => {
    const contract = await loadSourceContract();
    const ncbi = contract.starterContract.examples[2];
    ncbi.source.stableIdentifiers = ["FAKE.1"];
    ncbi.source.officialEndpoints = ["https://example.test/efetch"];
    ncbi.bounds.responseBytes = 1;
    ncbi.expectedResults.operators.OR1 = "1..2";

    expect(() => validate(contract)).toThrow(
      "NCBI contract must pin the exact lambda cI feature and translation",
    );
  });

  it("requires official endpoint fallback guidance including supported Rfam", async () => {
    const contract = await loadSourceContract();
    contract.viewerSkill = contract.viewerSkill.replace(
      "https://rest.uniprot.org/uniprotkb/P01116.fasta",
      "https://example.test/P01116",
    );

    expect(() => validate(contract)).toThrow(
      "Viewer skill is missing exact official fallback endpoint: https://rest.uniprot.org/uniprotkb/P01116.fasta",
    );
  });

  it("requires Sequence, Alignment, Shared, Output, and deliberate exclusions", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.capabilityMatrix =
      contract.starterContract.capabilityMatrix.filter(
        ({ area }) => area !== "Output",
    );

    expect(() => validate(contract)).toThrow(
      "Capability matrix area-to-example mappings must exactly match the curated portfolio",
    );
  });

  it("rejects capability rows mapped to unknown or wrong examples", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.capabilityMatrix[2].exampleIds = [
      "does-not-exist",
    ];

    expect(() => validate(contract)).toThrow(
      "Capability matrix area-to-example mappings must exactly match the curated portfolio",
    );
  });

  it("rejects describing the current version as qualified", async () => {
    const contract = await loadSourceContract();
    contract.starterContract.downstreamQualification.qualificationComplete = true;
    contract.starterContract.downstreamQualification.status = "passed";

    expect(() => validate(contract)).toThrow(
      "Starter contract must preserve the historical LSC-109 qualification and keep the current version pending",
    );
  });

  it("requires documentation to distinguish historical and current qualification", async () => {
    const contract = await loadSourceContract();
    contract.documents.publicReadme = contract.documents.publicReadme.replace(
      contract.starterContract.pluginVersion,
      "current version",
    );

    expect(() => validate(contract)).toThrow(
      "Starter documentation must distinguish the historical qualification from the pending current version",
    );
  });

  it("rejects a missing LSC-109 report or machine-record reference", async () => {
    const contract = await loadSourceContract();
    contract.documents.publicReadme = contract.documents.publicReadme.replace(
      "lsc-109-qualification.json",
      "missing-qualification.json",
    );

    expect(() => validate(contract)).toThrow(
      "Starter documentation must link the synchronized LSC-109 report and record",
    );
  });
});
