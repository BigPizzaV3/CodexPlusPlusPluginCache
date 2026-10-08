---
name: jasper-jrxml
description: Use when creating, editing, inspecting, compiling, or validating complex legacy iReport/JasperReports JRXML reports, especially JasperReports 2.x/2.0.4, old DTD-based templates, dense official forms, absolute-position layouts, subreports, or .jrxml to .jasper compilation.
license: MIT
---

# Legacy iReport/JasperReports JRXML

Build high-fidelity complex reports for **legacy iReport/JasperReports 2.x**, especially **JasperReports 2.0.4** and old DTD-based JRXML. Treat modern JasperReports features as incompatible until the consuming project's legacy compiler proves otherwise.

Compatibility requires file access and a shell. The bundled compiler targets Windows/PowerShell with JDK 8 and project-provided JasperReports 2.x dependencies.

## Read first

- Read [`references/legacy-jrxml-layout.md`](references/legacy-jrxml-layout.md) before authoring or changing a dense fixed-layout report.
- Read [`references/project-integration.md`](references/project-integration.md) before wiring fields, parameters, subreports, data sources, deployment paths, or runtime loading.
- Read [`references/official-report-sources.md`](references/official-report-sources.md) before downloading or inspecting official forms and JasperReports examples.
- Read the consuming project's `docs/report/` Markdown files before changing an existing report. These contain validated local conventions and corrections.

Paths in this skill are relative to the root of the **consuming project**, unless explicitly stated otherwise.

## Scope

- Author `.jrxml` by cloning the nearest compatible project model and rewriting only the necessary section.
- Reproduce dense official forms with numbered fields, boxes, dividers, checkboxes, rotated sidebars, and absolute coordinates.
- Compile and validate `.jrxml` into `.jasper` with the project’s exact legacy JasperReports dependencies.
- Integrate fields, parameters, subreports, data-source keys, runtime lookup, and optional deployment without assuming a particular application structure.

## Mandatory compatibility rules

1. Detect the JasperReports/iReport version and JRXML header/DTD before editing.
2. Prefer a report already compiling in the same project as the model.
3. Do not migrate DTD-based JRXML to a modern schema unless explicitly requested.
4. Do not introduce components, attributes, expressions, or Java APIs that the legacy compiler has not accepted.
5. Compile after every meaningful layout or expression change. The compiler is the structural validator.
6. Generate a PDF in the consuming application and compare it with the source form; compilation alone does not prove visual fidelity.

## Prerequisites for JasperReports 2.0.4

- A **JDK 8** installation. Very old JasperReports expression compilers may fail on newer modular JDKs.
- The consuming project's compatible JasperReports and transitive jars, including the XML parser dependencies it actually uses.
- A project build or dependency directory that provides those jars.
- PowerShell for the bundled headless compiler driver.

Never download random legacy jars into a private project without checking its build and license constraints first. Prefer the dependency set already proven by that project.

## Compile and validate

Use [`scripts/compile-jrxml.ps1`](scripts/compile-jrxml.ps1):

```powershell
pwsh -NoProfile -File path/to/jasper-jrxml/scripts/compile-jrxml.ps1 `
  -Jrxml "reports/complex-form.jrxml" `
  -ProjectRoot "." `
  -LibDirectory "target/app/WEB-INF/lib"
```

Optionally publish the compiled artifact to one runtime directory:

```powershell
pwsh -NoProfile -File path/to/jasper-jrxml/scripts/compile-jrxml.ps1 `
  -Jrxml "reports/complex-form.jrxml" `
  -ProjectRoot "." `
  -LibDirectory "target/app/WEB-INF/lib" `
  -DeployDirectory "src/main/webapp/WEB-INF/reports"
```

Use `-JdkHome` when JDK 8 is not discoverable. Use `-AdditionalClasspath` for required jars outside `-LibDirectory`. The `.jasper` is written beside the `.jrxml`; `-DeployDirectory` copies it only after successful compilation.

An invalid field/parameter expression, malformed XML, unsupported DTD element, missing class, or Jasper validation failure must return a non-zero exit. Correct the JRXML and recompile; never treat warning filtering as error suppression.

## Human iReport path

Use the exact iReport version associated with the project only when visual editing is useful. Headless compilation remains the repeatable validation path. Confirm whether runtime loads `.jrxml` dynamically or a precompiled `.jasper`; legacy applications commonly load only `.jasper`.

## Core layout gotchas

- **Rounded box with an open top:** draw the rounded rectangle, then cover the top border with a slightly narrower opaque white borderless rectangle. Preserve the rounded corners.
- **Coordinates:** derive `x/y/width/height` from clear section-level references. Align the small numbered box with the field container.
- **Data contract:** every `$F{field}` and `$P{parameter}` must be declared and must exactly match the data-source/parameter key supplied by the application.
- **Subreports:** reuse compatible existing header/detail subreports when the project provides them; do not redraw shared blocks without a requirement.
- **Verbose format:** keep one attribute per line, explicit border colors, and unique element keys to make legacy iReport output reviewable.
- **Source images:** request a full-page view plus sharp zoomed captures for each section. Several clear crops are better than one compressed page image.

Full patterns and snippets are in `references/legacy-jrxml-layout.md`.

## Workflow

1. Inspect project instructions, `docs/report/`, existing JRXML headers, dependency versions, runtime loading, and the nearest compiling model.
2. Obtain the original PDF and clear full-page/section captures; list sections, numbered fields, boxes, dividers, domains, and page order.
3. Map the report data contract: fields, parameters, subreports, collections, and exact keys.
4. Clone the nearest legacy model; preserve its DTD, common declarations, styles, page geometry, and shared subreports.
5. Rewrite only the required report-specific sections using absolute coordinates and the documented legacy blocks.
6. Compile with the bundled driver and the project's dependencies. Fix every real validation error.
7. Generate the PDF through the application, compare side by side, and iterate on geometry.
8. Run the fidelity checklist in `references/legacy-jrxml-layout.md`.
9. Record newly confirmed project-specific lessons under `docs/report/` using the protocol below.

## Project self-learning protocol

When the agent makes a wrong assumption, compilation fails for a project-specific reason, visual comparison exposes a recurring defect, or the user corrects a convention:

1. Confirm the cause with compiler output, runtime evidence, visual comparison, or explicit user correction.
2. Search `docs/report/` for an existing equivalent lesson and update it instead of duplicating it.
3. Create or update one or more focused `.md` files under `docs/report/`.
4. Record: context/version, symptom, confirmed cause, validated correction, verification evidence, and affected reports or pattern.
5. Never store credentials, personal data, company names, private hostnames, or unnecessary proprietary business details.
6. Keep local conventions local. Do not edit this distributed skill automatically.
7. Promote a lesson into the reusable skill only when the user explicitly asks and the rule is demonstrably project-independent.

Use the template in [`docs/report/README.md`](docs/report/README.md) when the consuming project has no report documentation yet.

## Troubleshooting

- `JRValidationException: Report design not valid`: check undeclared `$F{}`/`$P{}`, incompatible elements/attributes, duplicate keys where relevant, and elements outside bands.
- JDK 8 not found: pass `-JdkHome` or install a compatible JDK; do not silently use a modern JDK.
- Missing jars: point `-LibDirectory` and `-AdditionalClasspath` to the project's proven legacy dependencies.
- Deprecated `pen`/border warnings: expected in many JasperReports 2.x templates; retain them unless compilation actually fails.
- Correct compilation but wrong PDF: inspect font metrics, band heights, element order, overlap, stretch behavior, subreport data sources, and absolute coordinates.

## Completion criteria

- The legacy compiler exits successfully.
- Every expression refers to a declared field/parameter and matches the application contract.
- The application loads the intended `.jasper` or `.jrxml` from the verified runtime path.
- The generated PDF was compared with the complete original form, including every page.
- Rounded open-top boxes, numbered boxes, rotated section labels, borders, dividers, domains, and footer are visually checked.
- Any newly discovered project pattern is recorded under `docs/report/` without sensitive information.
