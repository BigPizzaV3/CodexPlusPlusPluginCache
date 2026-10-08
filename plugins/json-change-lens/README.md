# JSON Change Lens

Developer: ailuntz.

Readable, exact comparisons of JSON configuration files and API snapshots. A skills-only community plugin for ChatGPT and Codex environments that provide Python 3.9+ and file execution.

Ask: “Compare these API snapshots, matching object arrays by id.” Or run the helper directly:

```sh
python3 skills/compare-json/scripts/json_diff.py before.json after.json
python3 skills/compare-json/scripts/json_diff.py before.json after.json --array-key id --ignore-key updated_at --format json
python3 skills/compare-json/scripts/json_diff.py before.json after.json --output changes.md
```

Object key ordering and number spelling do not cause changes. Numbers retain decimal precision. Arrays use position by default; `--array-key` matches every array of objects by a unique string/number field, while scalar arrays remain positional. Ignored key names apply at every depth. Reports distinguish additions, removals, value changes, and type changes. Paths identify the original documents; the empty pointer is the root. Reports are explanatory diffs, not executable JSON Patch documents. Compatibility conclusions require a supplied schema or contract.

Exit status: **0** equivalent, **1** differences found, **2** input/options/output error. Report limits preserve full totals and show omitted counts. Existing output paths are refused. The two input files are not modified. UTF-8 JSON, optional BOM, at most 20 MiB per file; duplicate keys, NaN/Infinity, invalid array IDs, and excessive nesting are errors.

The helper uses the Python standard library, makes no network requests, and requires no service credentials. Input values appear in reports and may be processed by the host assistant. The host chat and execution environment retain their own data-handling rules. No separate backend, analytics, or telemetry is included.

Licensed under MIT. This is independent community software, not an official OpenAI product.
