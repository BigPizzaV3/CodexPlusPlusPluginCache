# hgraph Development plugin

<img src="assets/logo.png" alt="hgraph Development plugin logo" width="160">

This skills-only plugin packages the hgraph development guidance for:

- high-performance C++ compute and sink nodes;
- composable C++ and Python graphs;
- operator contracts, overloads, and cross-language registration.

The plugin is useful in downstream projects that build on hgraph and do not
otherwise inherit the repository-local skills from the hgraph source tree.

## Install from the official Codex marketplace

Open the plugin search interface in Codex CLI:

```sh
/plugins
```

Search for `hgraph Development`, select **Install Plugin**, and start a new
Codex session so the bundled skills are loaded. In the Codex app, find the
plugin in the **Developer Tools** section of the Plugins browser.

The canonical plugin source also remains available from the
[hgraph repository](https://github.com/hhenson/hgraph/tree/main/plugins/hgraph-development).

Codex IDE releases that do not support plugins can use the skill directories
directly. Copy or link the required directories from `skills/` into the
downstream repository's `.agents/skills/` directory. Claude users can expose
the same directories under `.claude/skills/`.

## Source and updates

The canonical skills are maintained in the
[hgraph source repository](https://github.com/hhenson/hgraph/tree/main/.agents/skills).
Changes should be made and validated there first, then copied into this
marketplace package as part of an update.
