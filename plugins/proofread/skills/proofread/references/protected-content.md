# Protected content

Preserve these spans byte-for-byte unless the user explicitly includes them in
the editing scope:

- fenced and inline code;
- commands, paths, URLs, identifiers, API names, formulas, and exact values;
- names, numbers, dates, citations, and references;
- required disclosures and legally significant wording;
- verbatim quotations and text marked as immutable.

The bundled `guard` command compares common machine-detectable spans: fenced
code, inline code, URLs, Unix and Windows paths, numbers, numeric citations, and
straight or curly quoted strings. It reports removed and added occurrences as
JSON and exits `2` on a mismatch.

The command cannot reliably recognize every proper name, identifier, command,
formula, or factual claim. It also cannot decide whether an intentional change
was authorized. Treat a passing guard as one check in a manual review, not a
semantic guarantee.

For Markdown, HTML, source code, or configuration files, edit prose segments
only. Do not reformat the whole file as part of proofreading. If tooling cannot
isolate prose safely, provide a suggested patch rather than rewriting the file.
