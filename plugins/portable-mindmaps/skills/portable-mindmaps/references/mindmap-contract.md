# Legacy simple-generator contract

This file documents the retained `create_mindmap.py` v1 compatibility route. New work should use the canonical v2 contract in `v2-contract.md` and `canonical-v2.schema.json`.

The generator accepts one UTF-8 JSON object:

```json
{
  "title": "Research programme",
  "root": {
    "text": "Research programme",
    "children": [
      {
        "text": "Questions",
        "children": [
          {"text": "Primary question", "children": []}
        ]
      }
    ]
  }
}
```

Only `title` and `root` are allowed at the document level. Every node must contain exactly `text` and `children`. Text must be non-empty Unicode without control characters, surrogate code points, or Unicode noncharacters. The generator limits trees to 2,000 nodes and 64 levels.

Pass an output base path without an extension. `output/research` creates:

- `output/research.md`: an H1 title followed by a nested Markdown bullet tree.
- `output/research.opml`: OPML 2.0 with the document title in `<head>` and the tree in `<body>`.
- `output/research.mm`: deterministic FreeMind-compatible XML with one root `<node>`.

The generator rejects symbolic links in inputs, outputs, and existing parent paths; `..` path traversal; mismatched output extensions; and existing output files unless `--overwrite` is supplied.
