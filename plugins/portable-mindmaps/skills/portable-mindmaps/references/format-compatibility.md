# Format compatibility

The plugin writes the same rooted hierarchy in six portable representations:

- Markdown (`.md`) is human-readable, easy to diff, and uses deterministic comments to round-trip supported metadata.
- OPML 2.0 (`.opml`) is the preferred generic outliner interchange format. It represents a tree of `outline` elements with required `text` attributes, standard `url` attributes for node links, and percent-encoded `category` metadata for tags. Legacy private URL and tag attributes remain accepted on import.
- FreeMind-compatible XML (`.mm`) is useful when a dedicated mind-mapping application accepts the established FreeMind interchange format.
- Canonical JSON (`.json`) preserves the complete documented model and is the most capable interchange form.
- Mermaid (`.mmd`) provides portable mind-map source; the plugin can losslessly re-import only the source it emitted with integrity-checked portable metadata.
- GraphML (`.graphml`) preserves the documented node, tree-edge, and cross-link subset for graph-oriented tools.

Import support and visual layout vary by application. Preserve canonical JSON plus the formats needed by collaborators when portability matters, and treat Markdown as the most readable durable source. Every importer and exporter reports metadata that was omitted or could not be recovered. Do not claim native import compatibility unless the target application was actually exercised.

Format references:

- [OPML 2.0 specification](https://opml.org/spec2.opml)
- [FreeMind file format](https://freemind.sourceforge.io/wiki/index.php/File_format)
