# Project integration for legacy JasperReports

Read this reference before changing report wiring. Discover the consuming project's actual architecture; the names below are contracts, not prescribed classes or folders.

## Data contract

A field expression resolves by its exact declared name:

```text
view/input key == persistence or DTO key == data-source property/map key == JRXML <field name>
```

For map-backed bean data sources, a spelling or case difference commonly renders an empty field without a helpful layout error. Trace one value through every layer before adding many fields.

For each `$F{name}`:

1. declare `<field name="name" class="..."/>` before report sections;
2. confirm the runtime data source exposes exactly `name`;
3. confirm null and type behavior against the legacy expression compiler;
4. compile and fill with representative data.

Apply the same discipline to `$P{name}`, variables, and subreport parameters.

## Shared subreports

Legacy projects often pass shared header, patient/customer, branding, or footer subreports as parameters. Before redrawing a common block:

- search existing JRXML for `<subreport>` and matching parameters;
- identify whether the value is a compiled `JasperReport`, path, stream, or filename;
- preserve the established `dataSourceExpression`/`connectionExpression`;
- confirm the child `.jasper` was compiled by a compatible JasperReports version.

Do not assume the report engine can load a `.jrxml` where the application expects a precompiled `.jasper`.

## Runtime loading and deployment

Trace the report-generation call to answer:

- Which report name is selected?
- Is the extension appended by code?
- Which directory or classpath resource is used?
- Does development runtime load from source output, build output, an exploded deployment, or an external directory?
- Are artifacts copied during build, or must they be compiled separately?

Use `-DeployDirectory` only after answering these questions. Deploy to one explicit directory per invocation. Re-run the command for additional verified targets rather than baking private folder assumptions into the reusable script.

## Legacy version discovery

Check, in this order:

1. JRXML comment/header and DTD/schema declaration;
2. build dependency declaration or lockfile;
3. jar manifest/name in the runtime library directory;
4. existing iReport project metadata;
5. a known compiling report.

Keep DTD-based JasperReports 2.x syntax intact. Never run a modern formatter/designer that rewrites the document unless migration is the explicit goal.

## New report integration checklist

- Exact report selector/name is wired.
- Every field and parameter has a producer.
- Shared subreports and their data sources are passed.
- The compiled filename matches runtime lookup.
- The artifact is copied only to confirmed runtime paths.
- A representative fill exercises nulls, dates, numeric values, long text, and every conditional branch.
- The generated PDF is compared against the authoritative form.
