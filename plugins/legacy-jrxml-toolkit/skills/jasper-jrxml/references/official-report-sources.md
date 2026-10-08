# Official report sources

Use primary sources when obtaining form layouts and upstream JasperReports examples. Confirm the document's revision/date before reproducing it; official forms can change independently of the software project.

## SINAN and dense official forms

- [SINAN portal — Brazilian Ministry of Health](https://portalsinan.saude.gov.br/)
- [SINAN agravos and documents](https://portalsinan.saude.gov.br/agravos-de-a-z)
- [Official Individual Notification Form (PDF)](https://portalsinan.saude.gov.br/images/documentos/Agravos/NINDIV/Notificacao_Individual_v5.pdf)
- [SINAN rules and routines manual (PDF)](https://portalsinan.saude.gov.br/images/documentos/Aplicativos/sinan_net/Manual_Normas_e_Rotinas_2_edicao.pdf)
- [Ministry of Health SINAN overview](https://www.gov.br/saude/pt-br/composicao/svsa/sistemas-de-informacao/sinan)

Prefer the relevant disease/condition page in the official portal, then download its investigation form. If an official page is temporarily unavailable, do not silently substitute an unofficial modified form: report the limitation and ask the user to provide the authoritative PDF.

For visual inspection, download the PDF into a temporary or project-approved reference directory, preserve the source URL and retrieval date in working notes, render every page at a readable resolution, and inspect both full-page structure and zoomed sections. Do not commit downloaded forms unless licensing and project policy permit it.

## JasperReports

- [JasperReports documentation index](https://jasperreports.sourceforge.net/README.html)
- [JasperReports official sample reference](https://jasperreports.sourceforge.net/sample.reference/README.html)
- [JasperReports source repository](https://github.com/Jaspersoft/jasperreports)

The online samples describe current JasperReports releases. They are useful for concepts and for locating upstream source, but **they are not proof that an element works in JasperReports 2.x**. For a legacy report, the consuming project's compiling JRXML and its exact library version outrank modern documentation.

When historical API details are required, inspect the source/tag matching the project's dependency version or the jars already present in the project. Validate all borrowed syntax with the legacy compiler.
