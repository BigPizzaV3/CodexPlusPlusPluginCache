# Optional local pathology analysis

These are bounded research workflows, not clinical decision support, verified cell identities, QuPath/Cellpose equivalence, or full-slide inference/stitching. Actual image and annotation reads remain behind the viewer's issued source grants. No image pixels enter model tool arguments, output text, or durable job journals. The local worker receives pixels only after the trusted worker-PID and source-authorization hook completes. Cancellation waits for child exit.

## Available computations

- RGB8 foreground components and features of explicit supplied object masks or boundaries; a generic connected component is not called a cell.
- Explicitly labeled, regularized object and pixel logistic classifiers. Pixel models use training-only scaling and stratified sampling; heldout source/revision, identical raster, and declared specimen leakage is rejected. Uncertain donor aliases are not proof of independent specimens.
- Pinned StarDist `2D_versatile_he` nucleus predictions on at most 512×512 RGB8 pixels. The supplied sampling scale is preserved; there is no implicit diameter or microns-per-pixel rescaling. Scores are not calibrated identity probabilities. This model predicts nuclei, not whole cells.
- DNA-seeded cytoplasm-gradient watershed on two explicitly identified, same-grid fluorescence channels, each at most 512×512. Nuclear seeds come from the actual DNA image (Gaussian smoothing, thresholding, distance peaks); cell boundaries follow the actual cytoplasm gradient within image-derived foreground. Manual reference masks are never inference seeds. Outputs are **estimated cell regions**, including possible split/merged or multinucleate regions, not verified single cells or H&E whole-cell segmentation.
- Source-annotation evaluation with pixel-center polygon rasterization. At IoU≥0.5 instance matching is one-to-one. Exhaustive coverage is an explicit dataset/user declaration. Annotated-only references report matches, misses, recall and matched IoU, but withhold false positives, precision, F1, PQ and whole-field Dice/IoU. Unknown annotation space is not verified background.

All intensity features operate on the supplied **RGB8 code values**, including recorded display contrast/gamma. Negative-log RGB features are optical-density proxies, not calibrated absorbance or validated stain unmixing. Areas and perimeters use raster pixel cells, or explicit vector boundaries where stated; micron units require verified anisotropic XY calibration. Otherwise units remain source pixels.

## Explicit runtime setup

Nothing is installed or downloaded when the viewer opens or a job starts. The optional environment is `.pathology-venv`; public assets are in `.pathology-assets`. Both are ignored and must not enter Git or release archives. The qualified local platform is macOS arm64, CPython 3.12.13, CPU only. Other platforms need their own runtime/inference qualification even if wheels exist.

The exact package declarations are in `pathology-requirements.txt`. In an environment with the approved OpenAI package-manager bootstrap already available, run from this plugin directory:

```sh
python3 src/pathology/setup_runtime.py --python /path/to/python3.12 \
  --bootstrap-install-py /path/to/openai/install.py --install-runtime
python3 src/pathology/setup_runtime.py --download-model --check
```

The first command creates only the private environment, bootstraps `oaipkg` into that chosen interpreter, and runs `oaipkg installpip -r` against the declared requirements. It preserves manager constraints. No raw pip/uv or host environment fallback is provided. Outside a workspace with an approved manager, an operator must explicitly provision the declared private runtime through their approved process; the plugin reports `RUNTIME_UNAVAILABLE` until then. An offline metadata/hash check is available with `--check`; this is not an inference or accuracy test.

The build must distribute the worker scripts and their registry JSON files in `dist/pathology`, and retain the requirements, this document, and explicit provisioning scripts. Installed jobs use fixed package-relative locations, not model-provided executable or model paths. The worker permits only one CPU process at a time and enforces an input/pixel/object/output/deadline bound.

## Model and data provenance

The StarDist archive is the upstream [v0.1 H&E model](https://github.com/stardist/stardist-models/releases/download/v0.1/python_2D_versatile_he.zip), with upstream SHA-256 `f1696ef0631bd7e1c0e5c0d3017e2b4c6a95e284c6aab9c22fc2f08317817b28`. Configuration, thresholds and weights have separate pinned hashes in `src/pathology/model-registry.json`. The model repository supplies a [BSD-3-Clause license](https://github.com/stardist/stardist-models/blob/ff53277eb2adbd4b8b25cc37c4c4c68496ca216b/LICENSE.txt). The explicit provisioner pins this license's commit and content hash. Initial download URLs are fixed; redirects are limited to reviewed HTTPS publisher origins (including GitHub's release-asset host), with no credentials or signed redirect URLs included in diagnostics. Cache assets use exclusive creation and existing qualified bytes are never silently overwritten. The [official model description](https://github.com/stardist/stardist) identifies MoNuSeg 2018 training data and TNBC as its training sources.

[PUMA record 15050523](https://zenodo.org/records/15050523) supplies real H&E ROIs and source nucleus/tissue polygons under CC0. Explicit provisioning reads only four fixed 1024-square ROI specimens with bounded HTTP ranges; it does not download the 14.2 GB context archive. ZIP-member CRC32 and local member SHA-256 are verified; a full-archive MD5 is not claimed. These are the public training release, not hidden challenge-test data. Fixed ROI choices and coverage assumptions are recorded in qualification receipts.

[BBBC007 v1](https://bbbc.broadinstitute.org/BBBC007) supplies separate DNA and actin images plus manually drawn nuclear and cell outlines, with a publisher waiver of copyright and related rights. Its two downloaded archives total less than 10 MiB. The outlines are black strokes on white, not instance labels. `prepare_bbbc007_reference.py` extracts enclosed white manual cell interiors, excludes exterior/border regions, cross-checks manual nuclear interiors, and retains multinuclear regions exactly as drawn. It does not repair or split reference regions. Original TIFF hashes and conversion details accompany the derived GeoJSON; qualification verifies its exact pixel-label round trip. Coverage remains annotated-only. This fluorescence example does not validate H&E whole-cell boundaries or independent biological donors.

No Cellpose weights are bundled or downloaded. Its [current upstream notice](https://github.com/MouseLand/cellpose) discusses noncommercial training-data restrictions; a permissive code license alone is not treated as a separate unrestricted weights/data grant.

## Reproduce bounded qualification from a source checkout

Provisioning is an explicit network action; qualification itself uses only cached sources, rechecking their recorded digests. Reference conversion/comparison CLIs live in `scripts/pathology/`, outside the shipped inference workers. Their scientific dependencies are explicitly pinned in `pathology-requirements.txt` and installed by the private-environment setup above. These scripts and the Vitest cases below require the source checkout and its existing development dependencies; they are not prerequisites for an installed job. Never run the optional inference cases during the default unit suite or concurrently with heavy viewer benchmarks.

```sh
.pathology-venv/bin/python -I src/pathology/provision_assets.py \
  --puma-sample training_set_primary_roi_001 \
  --puma-sample training_set_primary_roi_002 \
  --puma-sample training_set_metastatic_roi_001 \
  --puma-sample training_set_metastatic_roi_002
.pathology-venv/bin/python -I src/pathology/provision_assets.py --download-bbbc007
.pathology-venv/bin/python -I scripts/pathology/prepare_bbbc007_reference.py
```

Use the project's pinned Node runtime and existing Vitest installation with `--maxWorkers=1`. Opt-in cases are `puma-qualification.test.ts` with `SLIDE_PATHOLOGY_PUMA_QUALIFICATION=1`, `puma-pixel-qualification.test.ts` with `SLIDE_PATHOLOGY_PUMA_PIXEL_QUALIFICATION=1`, and `bbbc007-qualification.test.ts` with `SLIDE_PATHOLOGY_BBBC007_QUALIFICATION=development`, then `heldout`. The two development fields are `17P1_POS0006` and `17P1_POS0007`; heldout fields are `20P1_POS0002` and `20P1_POS0005`. Parameters are declared before scoring, frozen after development, and checked unchanged for heldout execution. Reference images never become algorithm input masks. Receipts and canonical little-endian label masks are saved only under the ignored public-asset cache. `compare_puma_reference.py` independently verifies saved instance metrics using StarDist matching and NumPy; it does not claim an independent annotation source or the challenge's rasterization convention. `compare_bbbc007_reference.py` independently checks the saved partial-reference instance metrics and reports internal predicted-boundary agreement with the original manual outlines, using explicit eight-neighbor adjacency and a two-pixel Euclidean tolerance. This is not a direct comparison with the publisher's seed/foreground-controlled benchmark: our algorithm uses neither manual seeds nor a manual foreground mask.

After producing the qualification receipts, run the independent comparisons in that same pinned environment:

```sh
.pathology-venv/bin/python -I scripts/pathology/compare_puma_reference.py \
  --sample training_set_primary_roi_001
.pathology-venv/bin/python -I scripts/pathology/compare_bbbc007_reference.py
```

The tissue-pixel check trains on the fixed top-left 512-square crops from PUMA `primary_roi_001` and `metastatic_roi_001`, and evaluates `primary_roi_002` and `metastatic_roi_002`. Only explicit tumor/stroma labels are scored; other tissue classes and unlabeled pixels are ignored. This is a source/ROI split of public release data, not established donor independence or a hidden-test evaluation.

In the BBBC007 archive, two selected fields have tiny blue/green X marks in the four corners of the source RGB files, although the publisher describes grayscale channels. Source bytes are preserved; channel zero was chosen before scoring. Inspection found identical non-gray positions across these files and no such pixels within two pixels of the corresponding manual boundaries. Their purpose is not documented by the publisher. The clean grayscale `20P1_POS0002` field is preferred for the default-tool conformance check. Two small heldout fields and partial manual interiors do not establish general whole-cell accuracy.
