# LSC-109 starter qualification report

Status: **passed** on 2026-07-02T14:57:33.986Z.

The shipped Sequence Viewer 0.1.26 marketplace bundle was the only installed bundle in each host and was exercised through both an actual GPT-5.6 SOL model-driven MCP App flow and a visible installed-browser host. The workspace began empty for every run; all three official-endpoint workflows produced exactly one viewer contribution, one card, and one active session.

## Qualified runtime

- Execution commit: d7fd06c59f3f232c1ca7ea982d2b219469212ef0 (tree 7690b55352fc38cccf2e97bbb1ee37e51cfbcc44)
- Submitted tracked-plugin source snapshot SHA-256: 815303ec54a02acec897d262b1aeba5997f1ccb724606a97e8b7910d507046ca (316 files, 2926698 bytes)
- Snapshot algorithm: sha256(sorted tracked relativePath NUL byteLength NUL fileSha256 LF)
- Snapshot exclusions are limited to the self-referential evidence files: LSC_109_QUALIFICATION.md, lsc-109-qualification.json
- Bundle SHA-256: 2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c (13 files, 3002439 bytes)
- Manifest SHA-256: e251955505f5b3c4c65b55d79ff24c051260c094d6dcc47bca6dd686e6c26848
- [Evidence manifest](https://drive.google.com/file/d/1HJmyJeBFtDrhWYczcA1OT8J4HKbckZuK/view?usp=drivesdk) SHA-256 643c76608cb4068bda74cc313231d09180bccd5ad06c3d84e1c9938a2bbc279c
- Starter contract SHA-256: cdfebb95e15ffad58710d9183c7fd850e51b04e72500c6ca1413dfaa557bfb8d
- [Qualification run](https://drive.google.com/file/d/13UwN-CT7_kGkWqAiCR8dZxJK6aRSUr-Y/view?usp=drivesdk) SHA-256 a79ff9202229bfdc2c39f1a28624d03205d447801e7d47c0ea14f69a740f0816
- [Complete raw evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) SHA-256 9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1
- Evidence folder: https://drive.google.com/drive/folders/134iz8GS9qHSjmheMb0l8WAtdNna357US

## Model-driven installed workflows

| Example | Mode | Stable authoritative IDs | Live scientific result | Model evidence |
| --- | --- | --- | --- | --- |
| ena-drr037765-first-500 | sequence | DRR037765, DRR037765.fastq.gz@md5:81735432a6f578b332aae58cdbd95231 | 500 reads; 235,490 total bases; 469-471 bp read length; 28.8462355% GC; 95.3976814% Q30. The first 500 complete parsed FASTQ records were selected deterministically from 967 source records. | [viewer](https://drive.google.com/file/d/1rxnnNrCWyNVYL6chy22eRu9Vc1jX8Wsq/view?usp=drivesdk) / [trace archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) (`lsc109-final5-share/model/ena/trace.jsonl`) |
| uniprot-human-ras-sv1 | alignment | P01116@SV1, P01111@SV1, P01112@SV1 | KRAS P01116 was the active reference; all three RAS rows preserved the four pinned core motifs. Live p-distances were 0.1315789474, 0.1368421053, and 0.1578947368; the exact three-leaf neighbor-joining Newick was reproduced. The Newick and provenance sidecar round-tripped by SHA-256; an exact collision failed without changing either file; remount retained the same session. | [viewer](https://drive.google.com/file/d/1idnFKeWlOk0UkKh6h_Nlbw8JOA6DRWl5/view?usp=drivesdk) / [trace archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) (`lsc109-final5-share/model/ras/trace.jsonl`) |
| ncbi-nc-001416-1 | sequence | NC_001416.1, NP_040628.1 | The 48,502-base record mapped cI at complement(37227..37940) and OR3/OR2/OR1 at 37951..37967, 37974..37990, and 37998..38014. Genetic code 11 translation produced the pinned 237-aa NP_040628.1 protein and SHA-256 ec5d954fd10be8c19c920e78badc5d9e9cc281f6801e2c5fde3803c9f133f580. | [viewer](https://drive.google.com/file/d/1rdSNs6nqK9Abpfo4LfTMd1w-HQ9ok3De/view?usp=drivesdk) / [trace archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) (`lsc109-final5-share/model/ncbi/trace.jsonl`) |

The submitted prompts were the exact ordered marketplace prompts recorded below. Optional Life Science Research skills were unavailable, so every successful run qualified the official-database endpoint fallback. The RAS workflow saved a provenance-bearing Newick file, verified create-new/no-overwrite behavior, reopened it by digest, and retained the viewer session across remount.

The NCBI model run also exercised the formerly over-envelope cI feature query followed by later OR1-OR3 queries, controls, and translation in the same session; bounded pagination kept the full completion request below the installed-host envelope without stalling command revision advancement.

## Installed-host failure matrix

| Requirement | Result | Scenario-specific evidence |
| --- | --- | --- |
| network-unavailable | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| rate-limit | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| malformed-database-response | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| accession-missing | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| payload-format-mismatch | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| oversized-source-or-analysis-budget | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| deterministic-subset-failure | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| optional-skill-unavailable-fallback | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| output-collision | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| output-quota-failure | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |
| viewer-retry-remount | passed | [scenario evidence archive](https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk) |

Every failure was actionable and left no misleading viewer or newly published artifact. No scenario used bundled, synthetic, or pre-existing biological data.

Reference workflows: https://linear.app/openai/issue/LSC-79/validate-the-v1-sequence-viewer-reference-workflow and https://linear.app/openai/issue/LSC-82/validate-the-v1-alignment-viewer-reference-workflow.

## Synchronized qualification record

```json
{
  "schemaVersion": 1,
  "contractSchemaVersion": 1,
  "issue": "LSC-109",
  "status": "passed",
  "qualifiedAt": "2026-07-02T14:57:33.986Z",
  "pluginVersion": "0.1.26",
  "manifestName": "sequence-viewer",
  "environment": {
    "sourceBinding": {
      "executionRevision": {
        "commitSha": "d7fd06c59f3f232c1ca7ea982d2b219469212ef0",
        "treeSha": "7690b55352fc38cccf2e97bbb1ee37e51cfbcc44"
      },
      "submittedSourceSnapshot": {
        "byteLength": 2926698,
        "digestAlgorithm": "sha256(sorted tracked relativePath NUL byteLength NUL fileSha256 LF)",
        "excludedEvidenceFiles": [
          "LSC_109_QUALIFICATION.md",
          "lsc-109-qualification.json"
        ],
        "fileCount": 316,
        "kind": "tracked-plugin-source",
        "sha256": "815303ec54a02acec897d262b1aeba5997f1ccb724606a97e8b7910d507046ca"
      },
      "runtimeBundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
      "qualificationRun": {
        "url": "https://drive.google.com/file/d/13UwN-CT7_kGkWqAiCR8dZxJK6aRSUr-Y/view?usp=drivesdk",
        "sha256": "a79ff9202229bfdc2c39f1a28624d03205d447801e7d47c0ea14f69a740f0816"
      },
      "evidenceManifest": {
        "url": "https://drive.google.com/file/d/1HJmyJeBFtDrhWYczcA1OT8J4HKbckZuK/view?usp=drivesdk",
        "sha256": "643c76608cb4068bda74cc313231d09180bccd5ad06c3d84e1c9938a2bbc279c"
      },
      "evidenceArchive": {
        "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
        "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
      }
    },
    "bundle": {
      "kind": "marketplace-bundle",
      "sha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
      "manifestSha256": "e251955505f5b3c4c65b55d79ff24c051260c094d6dcc47bca6dd686e6c26848",
      "starterContractSha256": "cdfebb95e15ffad58710d9183c7fd850e51b04e72500c6ca1413dfaa557bfb8d",
      "fileCount": 13,
      "byteLength": 3002439
    },
    "plugin": {
      "name": "sequence-viewer",
      "version": "0.1.26"
    },
    "server": {
      "name": "biological-sequence-viewer",
      "version": "0.1.26"
    },
    "host": {
      "name": "Codex model host plus Playwright installed marketplace host",
      "version": "Codex 0.143.0-alpha.33 / qualification host 1",
      "build": "LSC-109 exact marketplace bundle model and visible browser host"
    },
    "os": {
      "platform": "linux",
      "release": "5.15.0-1110-azure",
      "architecture": "x64"
    },
    "model": {
      "name": "GPT-5.6 SOL",
      "configuration": {
        "entryPoint": "codex exec with mounted MCP App",
        "marketplaceBundleCount": 1,
        "optionalSkillLane": "unavailable"
      }
    },
    "reasoning": {
      "level": "Ultra",
      "description": "literal Ultra reasoning"
    },
    "optionalLifeScienceSkills": {
      "available": [],
      "unavailable": [
        "NCBI Entrez skill",
        "UniProt skill",
        "ENA/SRA skill"
      ],
      "inventoryRecorded": true,
      "unavailableFallbackQualified": true
    }
  },
  "examples": [
    {
      "id": "ena-drr037765-first-500",
      "prompt": "Fetch ENA DRR037765 first 500 reads to active workspace; open and report live length range, GC, Q30, and subset provenance",
      "status": "passed",
      "workspace": {
        "fresh": true,
        "initialEntries": [],
        "preexistingBiologicalFiles": 0,
        "preexistingOutputs": 0
      },
      "viewer": {
        "cardCount": 1,
        "contributionCount": 1,
        "sessionCount": 1,
        "activeSessionIds": [
          "6bda39d1-0fa0-4676-9df9-4d840c74006f"
        ],
        "mode": "sequence",
        "singleOpenVerified": true,
        "stateAssertions": [
          "FASTQ overview",
          "500 reads",
          "read length, GC, and Q30 values from live viewer context"
        ]
      },
      "source": {
        "database": "ENA",
        "identifiers": [
          "DRR037765",
          "DRR037765.fastq.gz@md5:81735432a6f578b332aae58cdbd95231"
        ],
        "officialEndpoints": [
          "https://www.ebi.ac.uk/ena/portal/api/filereport",
          "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz"
        ],
        "route": "official-database-endpoint",
        "bytesTransferred": 127687,
        "artifactByteLength": 480372,
        "artifactSha256": "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9",
        "receiptSha256": "8fb9c92a7622f0428e3bbbab90abae18ffb2003c526797a2f5da75b0519b15af",
        "retrievedAt": "2026-07-02T14:57:04.080Z",
        "subsetRule": "first 500 complete parsed FASTQ records in source order, canonical four-line FASTQ",
        "identityValidated": true,
        "formatValidated": true,
        "nonEmptyValidated": true,
        "boundedPayloadValidated": true,
        "provenanceValidated": true,
        "usedBundledFixture": false,
        "usedPreexistingFile": false
      },
      "science": {
        "status": "passed",
        "liveViewerState": true,
        "expectedResults": {
          "readCount": 500,
          "totalBases": 235490,
          "readLengthMin": 469,
          "readLengthMax": 471,
          "gcPercent": 28.8462355,
          "q30Percent": 95.3976814,
          "displayGcPercent": "28.8%",
          "displayQ30Percent": "95.4%",
          "artifactByteLength": 480372,
          "artifactSha256": "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9"
        },
        "observations": [
          "500 reads; 235,490 total bases; 469-471 bp read length; 28.8462355% GC; 95.3976814% Q30.",
          "The first 500 complete parsed FASTQ records were selected deterministically from 967 source records."
        ],
        "operations": [
          "read the mounted FASTQ summary from live viewer state"
        ]
      },
      "artifacts": {
        "source": {
          "path": "codex-viewer-examples/DRR037765-first-500.fastq",
          "provenancePath": "codex-viewer-examples/DRR037765-first-500.fastq.provenance.json",
          "byteLength": 480372,
          "sha256": "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9",
          "provenanceSha256": "8fb9c92a7622f0428e3bbbab90abae18ffb2003c526797a2f5da75b0519b15af"
        },
        "derived": null
      },
      "evidence": {
        "screenshot": {
          "url": "https://drive.google.com/file/d/11gjz67tpeyubOEd1Pnixmjf0e1RsQ1TU/view?usp=drivesdk",
          "sha256": "8f45e0e71781243bf1fe4f522d65dafd9c7d6cf8ab53256d3718a954520060db"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/ena-drr037765-first-500.json",
          "sha256": "f0db23454e2e3f0b736ede7ed4bc361271d01c895952e4877e724b9372e9d4b1"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/playwright.log",
          "sha256": "7295cf3273358825f8bc836552530d2c3b74717e3697cad2004ff04c09a6ca0d"
        },
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "timing": {
        "startedAt": "2026-07-02T14:57:03.675Z",
        "completedAt": "2026-07-02T14:57:07.656Z",
        "durationMs": 3981
      },
      "bytes": {
        "transferred": 127687,
        "written": 482468
      },
      "acceptableNondeterminism": [
        "retrieval timestamp and HTTP cache metadata",
        "collision-safe source filename suffix on a non-clean workspace"
      ],
      "modelRun": {
        "entryPoint": "codex-chat",
        "status": "passed",
        "prompt": "Fetch ENA DRR037765 first 500 reads to active workspace; open and report live length range, GC, Q30, and subset provenance",
        "model": "GPT-5.6 SOL",
        "reasoning": "Ultra",
        "installedBundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "completeModelToolViewerTrace": true,
        "viewerMounted": true,
        "optionalSkillAvailable": false,
        "officialEndpointFallbackUsed": true,
        "threadId": "019f235a-37b2-7041-a157-f829bc0bfcc6",
        "toolSequence": [
          "sequence.acquire_public_example",
          "sequence.query_viewer"
        ],
        "evidence": {
          "screenshot": {
            "url": "https://drive.google.com/file/d/1rxnnNrCWyNVYL6chy22eRu9Vc1jX8Wsq/view?usp=drivesdk",
            "sha256": "2a671ab03cbb80a204510b82329bc1a2fef2a5baee2aa5f22d308c65ffa7260d"
          },
          "trace": {
            "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
            "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
            "memberPath": "lsc109-final5-share/model/ena/trace.jsonl",
            "sha256": "bb55cd63031814661f8798e19fce545a6e541a900ef5a3fd51aa5ae4a7e0f899"
          },
          "log": {
            "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
            "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
            "memberPath": "lsc109-final5-share/model/ena/response.md",
            "sha256": "86ad2abd4425c5b4dab5a4cf218ae62b88af18d9049edbd7ab38b81a12813e24"
          }
        }
      }
    },
    {
      "id": "uniprot-human-ras-sv1",
      "prompt": "Fetch UniProt P01116/P01111/P01112 alignment; map conserved motifs to KRAS, compute distances/tree, publish Newick to workspace",
      "status": "passed",
      "workspace": {
        "fresh": true,
        "initialEntries": [],
        "preexistingBiologicalFiles": 0,
        "preexistingOutputs": 0
      },
      "viewer": {
        "cardCount": 1,
        "contributionCount": 1,
        "sessionCount": 1,
        "activeSessionIds": [
          "6046b9c5-ba13-4e4a-acdd-0b9d275e45a3"
        ],
        "mode": "alignment",
        "singleOpenVerified": true,
        "stateAssertions": [
          "three-row, 191-column aligned FASTA",
          "P01116 KRAS as active reference",
          "reference-coordinate mapping and conservation",
          "distance matrix and graphical neighbor-joining tree"
        ]
      },
      "source": {
        "database": "UniProtKB",
        "identifiers": [
          "P01116@SV1",
          "P01111@SV1",
          "P01112@SV1"
        ],
        "officialEndpoints": [
          "https://rest.uniprot.org/uniprotkb/P01116.fasta",
          "https://rest.uniprot.org/uniprotkb/P01111.fasta",
          "https://rest.uniprot.org/uniprotkb/P01112.fasta"
        ],
        "route": "official-database-endpoint",
        "bytesTransferred": 807,
        "artifactByteLength": 786,
        "artifactSha256": "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f",
        "receiptSha256": "9acbc84f09ad62ee1b92fe4c0585000f05c51105b8bd7124d654c791bd5f3ad8",
        "retrievedAt": "2026-07-02T14:57:10.432Z",
        "subsetRule": null,
        "identityValidated": true,
        "formatValidated": true,
        "nonEmptyValidated": true,
        "boundedPayloadValidated": true,
        "provenanceValidated": true,
        "usedBundledFixture": false,
        "usedPreexistingFile": false
      },
      "science": {
        "status": "passed",
        "liveViewerState": true,
        "expectedResults": {
          "artifactByteLength": 786,
          "artifactSha256": "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f",
          "reference": "P01116",
          "motifs": [
            "P-loop KRAS 10-17 GAGGVGKS",
            "switch I KRAS 30-38 DEYDPTIED",
            "switch II KRAS 60-76 GQEEYSAMRDQYMRTGE",
            "NKXD region KRAS 116-119 NKCD"
          ],
          "caaxTails": {
            "P01116": "CIIM",
            "P01111": "CVVM",
            "P01112": "CVLS"
          },
          "pDistances": {
            "P01116/P01111": 0.1315789474,
            "P01116/P01112": 0.1368421053,
            "P01111/P01112": 0.1578947368
          },
          "treeLeaves": [
            "P01116",
            "P01111",
            "P01112"
          ],
          "treeNewick": "('P01116':0.027632,('P01111':0.076316,'P01112':0.081579):0.027632);",
          "treeInterpretation": "exploratory uncorrected p-distance guide tree; do not interpret the three-leaf topology as a publication phylogeny"
        },
        "observations": [
          "KRAS P01116 was the active reference; all three RAS rows preserved the four pinned core motifs.",
          "Live p-distances were 0.1315789474, 0.1368421053, and 0.1578947368; the exact three-leaf neighbor-joining Newick was reproduced.",
          "The Newick and provenance sidecar round-tripped by SHA-256; an exact collision failed without changing either file; remount retained the same session."
        ],
        "operations": [
          "sequence.control_viewer set_alignment_reference P01116",
          "map KRAS reference residues 10-17, 30-38, 60-76, and 116-119",
          "sequence.run_analysis distance-matrix",
          "sequence.run_analysis build-tree neighbor-joining",
          "sequence.export_artifact newick to workspace"
        ]
      },
      "artifacts": {
        "source": {
          "path": "codex-viewer-examples/human-RAS-UniProt-SV1.aln-fasta",
          "provenancePath": "codex-viewer-examples/human-RAS-UniProt-SV1.aln-fasta.provenance.json",
          "byteLength": 786,
          "sha256": "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f",
          "provenanceSha256": "9acbc84f09ad62ee1b92fe4c0585000f05c51105b8bd7124d654c791bd5f3ad8"
        },
        "derived": {
          "format": "newick",
          "destination": {
            "kind": "workspace",
            "base": "opened-source",
            "relativePath": "RAS-P01116-P01111-P01112-NJ.nwk"
          },
          "outputPath": "codex-viewer-examples/RAS-P01116-P01111-P01112-NJ.nwk",
          "provenancePath": "codex-viewer-examples/RAS-P01116-P01111-P01112-NJ.nwk.provenance.json",
          "byteLength": 68,
          "sha256": "2f7aa2bb6a6776863c450b3e6ccbc3bf458843d97a38359f7fac5c0ee58efdb2",
          "provenanceSha256": "e3a962dfcb6d0c6d52fbb09fd05d465a59b9c0bdf57d1e2322c179f1a8527048",
          "sourceSha256": "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f",
          "engine": "sequence-viewer-alignment-export-v1",
          "parameters": {
            "algorithm": "neighbor-joining",
            "distanceModel": "uncorrected-p-distance",
            "guideTreeEngine": "sequence-viewer-guide-tree-v1",
            "scope": "all"
          },
          "createNewVerified": true,
          "noOverwriteVerified": true,
          "roundTripVerified": true,
          "collisionFailureQualified": true
        }
      },
      "evidence": {
        "screenshot": {
          "url": "https://drive.google.com/file/d/126UKZ3E9s8K3D7yKDLEg15pFJwNVGPH6/view?usp=drivesdk",
          "sha256": "1cda390048a0fe25a4173e17472d286704d6969340214eb15050fe97d533b4bb"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/uniprot-human-ras-sv1.json",
          "sha256": "f8eed18fcad1af1acc572d12e1d37b5779771fd4cc1360255286a73874ec4576"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/playwright.log",
          "sha256": "7295cf3273358825f8bc836552530d2c3b74717e3697cad2004ff04c09a6ca0d"
        },
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "timing": {
        "startedAt": "2026-07-02T14:57:08.027Z",
        "completedAt": "2026-07-02T14:57:14.385Z",
        "durationMs": 6358
      },
      "bytes": {
        "transferred": 807,
        "written": 5137
      },
      "acceptableNondeterminism": [
        "retrieval timestamp and HTTP cache metadata",
        "collision-safe acquired-source filename suffix on a non-clean workspace",
        "equivalent Newick child ordering and display layout with the same leaf set and distances"
      ],
      "modelRun": {
        "entryPoint": "codex-chat",
        "status": "passed",
        "prompt": "Fetch UniProt P01116/P01111/P01112 alignment; map conserved motifs to KRAS, compute distances/tree, publish Newick to workspace",
        "model": "GPT-5.6 SOL",
        "reasoning": "Ultra",
        "installedBundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "completeModelToolViewerTrace": true,
        "viewerMounted": true,
        "optionalSkillAvailable": false,
        "officialEndpointFallbackUsed": true,
        "threadId": "019f235a-2b30-7100-9640-2806e3a532a2",
        "toolSequence": [
          "sequence.acquire_public_example",
          "sequence.control_viewer",
          "sequence.query_viewer",
          "sequence.run_analysis",
          "sequence.export_artifact"
        ],
        "evidence": {
          "screenshot": {
            "url": "https://drive.google.com/file/d/1idnFKeWlOk0UkKh6h_Nlbw8JOA6DRWl5/view?usp=drivesdk",
            "sha256": "e2591de228979076349512ea05780a179f7be4b36870671a817c8c351ebe9d3c"
          },
          "trace": {
            "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
            "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
            "memberPath": "lsc109-final5-share/model/ras/trace.jsonl",
            "sha256": "f8b5d0dc7ee03e0163ece0bc1db1b4659ac5432b911385118bed7971d43bdbad"
          },
          "log": {
            "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
            "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
            "memberPath": "lsc109-final5-share/model/ras/response.md",
            "sha256": "e654bd354fc2678d59ba808d6f31943b5a89de7393fb726b5c4fd99e89bd8fe2"
          }
        }
      }
    },
    {
      "id": "ncbi-nc-001416-1",
      "prompt": "Fetch NCBI NC_001416.1 to active workspace; open it, map cI to OR1–OR3, and translate cI with code 11",
      "status": "passed",
      "workspace": {
        "fresh": true,
        "initialEntries": [],
        "preexistingBiologicalFiles": 0,
        "preexistingOutputs": 0
      },
      "viewer": {
        "cardCount": 1,
        "contributionCount": 1,
        "sessionCount": 1,
        "activeSessionIds": [
          "26721249-d331-401b-b91f-de618eae729f"
        ],
        "mode": "sequence",
        "singleOpenVerified": true,
        "stateAssertions": [
          "NC_001416.1 metadata and 48,502-base sequence",
          "cI CDS pinned on the reverse strand",
          "OR3, OR2, and OR1 regulatory annotations",
          "completed code-11 reverse-frame translation job"
        ]
      },
      "source": {
        "database": "NCBI Nuccore",
        "identifiers": [
          "NC_001416.1",
          "NP_040628.1"
        ],
        "officialEndpoints": [
          "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        ],
        "route": "official-database-endpoint",
        "bytesTransferred": 176721,
        "artifactByteLength": 176721,
        "artifactSha256": "3c624302adeeb3c00649f549903ab781b9e75bab16069ae655833d536407367f",
        "receiptSha256": "4184c7b6a86b5c21aea35abec2a32a757feb819baf39f67c00a29d8569739a27",
        "retrievedAt": "2026-07-02T14:57:17.363Z",
        "subsetRule": null,
        "identityValidated": true,
        "formatValidated": true,
        "nonEmptyValidated": true,
        "boundedPayloadValidated": true,
        "provenanceValidated": true,
        "usedBundledFixture": false,
        "usedPreexistingFile": false
      },
      "science": {
        "status": "passed",
        "liveViewerState": true,
        "expectedResults": {
          "sequenceLength": 48502,
          "ci": {
            "location": "complement(37227..37940)",
            "start": 37227,
            "end": 37940,
            "strand": "-",
            "geneticCodeId": 11,
            "proteinAccession": "NP_040628.1",
            "aminoAcids": 237,
            "codingSequenceSha256": "a51dec784e51f85a35d643a84820c89430b526cd9bf54a398b91c70045cc62e8",
            "proteinSha256": "ec5d954fd10be8c19c920e78badc5d9e9cc281f6801e2c5fde3803c9f133f580"
          },
          "operators": {
            "OR3": "37951..37967",
            "OR2": "37974..37990",
            "OR1": "37998..38014"
          },
          "artifactBaselineSha256": "3c624302adeeb3c00649f549903ab781b9e75bab16069ae655833d536407367f"
        },
        "observations": [
          "The 48,502-base record mapped cI at complement(37227..37940) and OR3/OR2/OR1 at 37951..37967, 37974..37990, and 37998..38014.",
          "Genetic code 11 translation produced the pinned 237-aa NP_040628.1 protein and SHA-256 ec5d954fd10be8c19c920e78badc5d9e9cc281f6801e2c5fde3803c9f133f580."
        ],
        "operations": [
          "sequence.control_viewer select_sequence_feature cI CDS",
          "query exact cI and operator annotations",
          "sequence.run_analysis translate start 37227 end 37940 frame -1 geneticCodeId 11"
        ]
      },
      "artifacts": {
        "source": {
          "path": "codex-viewer-examples/NC_001416.1.gb",
          "provenancePath": "codex-viewer-examples/NC_001416.1.gb.provenance.json",
          "byteLength": 176721,
          "sha256": "3c624302adeeb3c00649f549903ab781b9e75bab16069ae655833d536407367f",
          "provenanceSha256": "4184c7b6a86b5c21aea35abec2a32a757feb819baf39f67c00a29d8569739a27"
        },
        "derived": null
      },
      "evidence": {
        "screenshot": {
          "url": "https://drive.google.com/file/d/1ccQ5hGA_1RXtV3yA3YkNQQZITnOGztF-/view?usp=drivesdk",
          "sha256": "346fd736071e0a033aac8f634a0c02a7498c8c0abf15f5f70eff431f5f12ee9a"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/ncbi-nc-001416-1.json",
          "sha256": "755c36661f2e3326f08a32e2eeb5ba8403c8c074881acaf11df9dfbdc294628b"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/playwright.log",
          "sha256": "7295cf3273358825f8bc836552530d2c3b74717e3697cad2004ff04c09a6ca0d"
        },
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "timing": {
        "startedAt": "2026-07-02T14:57:14.974Z",
        "completedAt": "2026-07-02T14:57:19.756Z",
        "durationMs": 4782
      },
      "bytes": {
        "transferred": 176721,
        "written": 178420
      },
      "acceptableNondeterminism": [
        "retrieval timestamp, HTTP cache metadata, and GenBank annotation serialization",
        "collision-safe source filename suffix on a non-clean workspace"
      ],
      "modelRun": {
        "entryPoint": "codex-chat",
        "status": "passed",
        "prompt": "Fetch NCBI NC_001416.1 to active workspace; open it, map cI to OR1–OR3, and translate cI with code 11",
        "model": "GPT-5.6 SOL",
        "reasoning": "Ultra",
        "installedBundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "completeModelToolViewerTrace": true,
        "viewerMounted": true,
        "optionalSkillAvailable": false,
        "officialEndpointFallbackUsed": true,
        "threadId": "019f2358-451c-7143-ac42-8e6032932c4a",
        "toolSequence": [
          "sequence.acquire_public_example",
          "sequence.query_viewer",
          "sequence.control_viewer",
          "sequence.run_analysis"
        ],
        "evidence": {
          "screenshot": {
            "url": "https://drive.google.com/file/d/1rdSNs6nqK9Abpfo4LfTMd1w-HQ9ok3De/view?usp=drivesdk",
            "sha256": "422c23733fb1ece91eabe32b5c8156cad9d8187c7595511dc73a21340621c824"
          },
          "trace": {
            "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
            "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
            "memberPath": "lsc109-final5-share/model/ncbi/trace.jsonl",
            "sha256": "cbe9e4d9e61c06d511704039ca4e697b0222737ca672f50fec2d2f4f9e2c21d6"
          },
          "log": {
            "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
            "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
            "memberPath": "lsc109-final5-share/model/ncbi/response.md",
            "sha256": "66150a63ddb58a0b8f24a95a6ce859b5572cd12d58cf0f03b64e5903a4cf25ad"
          }
        }
      }
    }
  ],
  "negativeCases": [
    {
      "requirement": "network-unavailable",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed network-unavailable is actionable and leaves no viewer or artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/network-unavailable.png",
          "sha256": "1bcfc7f5917f8c7cad8cdfdcfbd57e923145acd3f1fc1725f96bd6b39afff98a"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/network-unavailable.json",
          "sha256": "a9fcc85b294837a2dc7f604cfbaecc031db1860bc6ae1d740e8aa6591355ae35"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/network-unavailable.log",
          "sha256": "ed7ff84c7c623ce34c5d6082b2cada4f8cb764d5fffaf7d143d5bb6fcd73a7a0"
        },
        "requirement": "network-unavailable",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "The authoritative database could not be reached. Check network access and retry."
    },
    {
      "requirement": "rate-limit",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed rate-limit is actionable and leaves no viewer or artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/rate-limit.png",
          "sha256": "07e028683e92076fb73fd07525467f1355e2ba95da7322919cd158d3881ed369"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/rate-limit.json",
          "sha256": "cb31b32937a58225952371881527d964d92f9526f596c7b439146fd421cc71a3"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/rate-limit.log",
          "sha256": "2c0742566305473060e252c99bcbb6e5468d83a3fa4cfa6fc57ec9e2b4b0fc45"
        },
        "requirement": "rate-limit",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "The authoritative database returned HTTP 429. Retry after 60 seconds."
    },
    {
      "requirement": "malformed-database-response",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed malformed-database-response is actionable and leaves no viewer or artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/malformed-database-response.png",
          "sha256": "4748e9f78a2589cafd69e41a474f05cacc50eff16fc385c01e7fe1afca94604e"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/malformed-database-response.json",
          "sha256": "e159e583276caaa7e483f7a03b54fa599503da7c2042a63be1d763f14b6d7060"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/malformed-database-response.log",
          "sha256": "5bbe6063912ab9dccc947bcef59d12c816c61dd7afaca5a9f38e214ae886cb18"
        },
        "requirement": "malformed-database-response",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "NCBI GenBank response contained an HTML or database error page."
    },
    {
      "requirement": "accession-missing",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed accession-missing is actionable and leaves no viewer or artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/accession-missing.png",
          "sha256": "1ae4041d8cdbee6d3406a66efcfa0ea98d1ef4161b55c97a69c0591e9e1434af"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/accession-missing.json",
          "sha256": "63a91279d6e60c861cf56701b88484d903df2ab49c4cbf7c8d67bc3cb23fc40d"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/accession-missing.log",
          "sha256": "5f50086faca234015054ba7c2b30d13c4ba84ad6fbfe3a7b104cfdbcce2c305c"
        },
        "requirement": "accession-missing",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "The authoritative database returned HTTP 404."
    },
    {
      "requirement": "payload-format-mismatch",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed payload-format-mismatch is actionable and leaves no viewer or artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/payload-format-mismatch.png",
          "sha256": "befdd2d573ef5d3544f0801d1307819b7a09035ea5514b009a1f13ec1f61e056"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/payload-format-mismatch.json",
          "sha256": "6eeb94424c4ee0898ee48878afe70e84e01818af05c08a67d5985b3f2ccaebb0"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/payload-format-mismatch.log",
          "sha256": "60ffbf7f3bc9b220b883f7d24d220968674c49f10088d14893ef6c9bb29723ec"
        },
        "requirement": "payload-format-mismatch",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "ENA file metadata did not uniquely match the pinned run and FASTQ file."
    },
    {
      "requirement": "oversized-source-or-analysis-budget",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed oversized-source-or-analysis-budget is actionable and leaves no viewer or artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/oversized-source-or-analysis-budget.png",
          "sha256": "1fc013f930b81d04aa6db31fce50f6b8b831f119f11a901931802faed6d0f1d3"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/oversized-source-or-analysis-budget.json",
          "sha256": "ecfb9196f3a74b0cca7a6779b452eee181ce851f582f71441992a612725a6e56"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/oversized-source-or-analysis-budget.log",
          "sha256": "7ad1c51febb0a7d8dfc40e3e821efcd571de94fc9fbd08337e295c4e4b135cbe"
        },
        "requirement": "oversized-source-or-analysis-budget",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "The authoritative response exceeded the starter byte budget."
    },
    {
      "requirement": "deterministic-subset-failure",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed deterministic-subset-failure is actionable and leaves no viewer or artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/deterministic-subset-failure.png",
          "sha256": "8bc01ea4c0c512bc5e8f7a34e81db77aeb053922fc0c797ada5071fdaad37ac5"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/deterministic-subset-failure.json",
          "sha256": "17c670784e0b406fc176b0b8b999b7d6d3b1f7d071b681d610a7fd4d270826c7"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/deterministic-subset-failure.log",
          "sha256": "590bdf877d37f3ed33abc1f59d0fcc4a668fd30d927a0de0673ecab69c3fa8ac"
        },
        "requirement": "deterministic-subset-failure",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "The pinned ENA run did not contain 500 complete, identity-matched FASTQ reads."
    },
    {
      "requirement": "optional-skill-unavailable-fallback",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "visible ENA starter acquires through MCP and reports live FASTQ QC",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/optional-skill-unavailable-fallback.png",
          "sha256": "496d43a4e91795641aa80a88a9921d72e6e954cee26bbb1875155e6b21641aa3"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/optional-skill-unavailable-fallback.json",
          "sha256": "0bcd3419269cb72f1502c1e774b6ab3d0ba5104f6b49740309758e53e6e9f043"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/optional-skill-unavailable-fallback.log",
          "sha256": "be95058c54669a8635fc8fb203a636c40b2b6b6a08e8b9b4b98ce065a7c33f86"
        },
        "requirement": "optional-skill-unavailable-fallback",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "optionalSkillAvailable": false,
      "officialEndpointFallbackSucceeded": true
    },
    {
      "requirement": "output-collision",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "visible UniProt RAS starter maps a reference, computes distances/tree, and publishes provenance Newick",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/output-collision.png",
          "sha256": "1cda390048a0fe25a4173e17472d286704d6969340214eb15050fe97d533b4bb"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/output-collision.json",
          "sha256": "b7528b4aa9b0814d6fc683d6a638d9ce7a48f095f148fb01a365f86302b3b6bd"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/output-collision.log",
          "sha256": "7c1cac0fbe97e77f58a2264f75f2efe4d7c9a3fe3210ae16217456bee0df99a6"
        },
        "requirement": "output-collision",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "The viewer could not persist the requested workbench payload: The workspace export or provenance sidecar already exists."
    },
    {
      "requirement": "output-quota-failure",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "bundle-backed output quota failure preserves the mounted source and publishes no derived artifact",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/output-quota-failure.png",
          "sha256": "4376c584b97de40547c49bd4bc3d9fbc76947f1ab3646c1486c3840849bd69ed"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/output-quota-failure.json",
          "sha256": "d183ce53ff2af705831c8c38891a18e40529f7ef7255a3c3199206cf73e17dd7"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/output-quota-failure.log",
          "sha256": "68ed8967a54a0d4e97e79a613432187d1bcdf4cc4fdb23511a345a9b1094e098"
        },
        "requirement": "output-quota-failure",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "observedError": "The viewer could not persist the requested workbench payload: The workspace destination does not have enough free disk space for this chunk."
    },
    {
      "requirement": "viewer-retry-remount",
      "status": "passed",
      "actionableResult": true,
      "noMisleadingViewer": true,
      "noMisleadingArtifact": true,
      "noBundledFallback": true,
      "testRef": "visible UniProt RAS starter maps a reference, computes distances/tree, and publishes provenance Newick",
      "evidence": {
        "screenshot": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/screenshots/failures/viewer-retry-remount.png",
          "sha256": "371ae98abd4f16c1845549ead8ffa7ae19da120ec07784679aaf90498f9391c4"
        },
        "trace": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/traces/failures/viewer-retry-remount.json",
          "sha256": "0684db21e43f74149393d41e852e7447699264afebb54d3534a2eee06581e806"
        },
        "log": {
          "archiveUrl": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "archiveSha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1",
          "memberPath": "lsc109-final5-share/installed-host/logs/failures/viewer-retry-remount.log",
          "sha256": "16b17041b3ee5b31396950d8755e5ef35c493383bcf03a316d36943ca749b088"
        },
        "requirement": "viewer-retry-remount",
        "bundleSha256": "2d9e8b8cbf24b3ad07fb94fd2816bc83c7a21f00e30fa2ab1a14338b0267db8c",
        "visibleInstalledHost": true,
        "completeArchive": {
          "url": "https://drive.google.com/file/d/15RF7MSatf_zpj97v5Zo0pV2sk2r_R8Po/view?usp=drivesdk",
          "sha256": "9561b6557faf616d2a6dc91da87f5f09f6b5874c6e46becb6aa3631474aefbc1"
        }
      },
      "retryOrRemountSucceeded": true,
      "sessionContinuityVerified": true
    }
  ],
  "relatedIssues": [
    {
      "id": "LSC-79",
      "url": "https://linear.app/openai/issue/LSC-79/validate-the-v1-sequence-viewer-reference-workflow",
      "workflow": "Qualified annotated lambda Sequence reference workflow"
    },
    {
      "id": "LSC-82",
      "url": "https://linear.app/openai/issue/LSC-82/validate-the-v1-alignment-viewer-reference-workflow",
      "workflow": "Qualified multi-record human RAS Alignment reference workflow"
    }
  ],
  "knownLimits": [
    "The three-leaf RAS tree is an exploratory guide tree, not a publication phylogeny.",
    "Authoritative endpoints remain externally operated and can rate-limit or become temporarily unavailable.",
    "The installed-host harness records the optional-skill-disabled official-endpoint lane; optional skills are not required for success."
  ],
  "acceptableNondeterminism": [
    "retrieval timestamp and HTTP cache metadata",
    "collision-safe source filename suffix on a non-clean workspace",
    "collision-safe acquired-source filename suffix on a non-clean workspace",
    "equivalent Newick child ordering and display layout with the same leaf set and distances",
    "retrieval timestamp, HTTP cache metadata, and GenBank annotation serialization"
  ]
}
```
