# Changelog

All notable changes to Consultor are documented here.

## 0.1.2 - 2026-08-24

- Restored the root `plugin.json` to the closed Agent Plugins v1.0.0 schema.
- Moved OpenAI Directory presentation metadata to `.codex-plugin/plugin.json`, where the OpenAI ingestion contract reads it.
- Kept the root and Codex manifests aligned on identity, version, description, author, homepage, license, and keywords.

## 0.1.1 - 2026-08-24

- Attempted to place OpenAI Directory `interface` metadata in the root manifest. The upload converter ignored that field; superseded by 0.1.2.

## 0.1.0 - 2026-08-24

- Initial public skills-only release.
- Added 18 consulting skills, shared Markdown templates, and local Python helpers.
- Packaged as an Agent Plugins v1.0.0 plugin with one root `plugin.json` manifest.
- Added explicit skill-relative resource paths and runtime compatibility metadata.
