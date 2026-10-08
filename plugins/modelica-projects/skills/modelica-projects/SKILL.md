---
name: modelica-projects
description: Author, import, source-preservingly edit, visually annotate, preview, repair, and statically validate portable Modelica package trees. Use for physical-system models, standard Modelica icons and diagrams, package hierarchies, and reusable .mo components.
---

# Modelica projects

Create portable directory-form Modelica packages with explicit physical assumptions and standard visual annotations. Use `scripts/modelica_tool.py` for canonical v2 authoring. Read `references/v2-contract.md`, validate canonical inputs against `references/canonical-v2.schema.json`, and validate source-preserving edit requests against `references/edit-v1.schema.json`.

## Routes

- New project: define the system boundary, domains, parameters, initialization, scenarios, and checks; write canonical v2 JSON; run `create`.
- Existing package: run `import`, edit the canonical representation, and export a new tree. Import recovers this skill's hash-bound portable visual metadata; it preserves unsupported valid annotations in source and reports that their visual meaning was not interpreted.
- Source-preserving package changes: use `edit` on a staged copy. Select classes by safe relative `.mo` path; add files, update the required `package.order`, repair unambiguous `within` clauses, or add/replace supported standard visual annotations. Every untouched file must remain byte-for-byte identical.
- Visual modeling: describe components, boundary connectors, connections, and optional icon primitives; use deterministic topology-aware layout or preserve supplied placements. Relayout only when explicitly requested.
- Diagnosis: run `lint`; use `repair` only for unambiguous structural normalization.
- Preview: run `preview --format svg|html [--class NAME]` for a deterministic, script-free structural view of the canonical visual graph.
- Compiler evidence: keep `--compiler off` by default. Use `auto|required` only when the user explicitly requests compilation evidence and an existing local `omc` is available; never download or install one.

Emit only standard Modelica syntax and annotations, including `Icon`, `Diagram`, `Placement`, and connection `Line` annotations. Do not add vendor-prefixed annotations, proprietary archives, runtime launchers, or product-specific compatibility claims. Refuse to replace existing graphics unless explicitly authorized.

Run the static checker after every change. Its lexer/parser and checks cover the documented portable authoring subset, not full Modelica semantics. Separate source structure, recovered visual structure, structural preview, compilation, simulation, numerical behavior, physical validity, and native rendering in the evidence report.
