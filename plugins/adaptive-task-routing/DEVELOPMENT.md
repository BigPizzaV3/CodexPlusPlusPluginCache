# Adaptive Task Routing — OpenAI / ChatGPT / Codex

[English](docs/usage/README.md) · [繁體中文](docs/usage/README.zh-TW.md) · [简体中文](docs/usage/README.zh-CN.md) · [日本語](docs/usage/README.ja.md) · [한국어](docs/usage/README.ko.md)

This plugin contains three workflows with preserved triggers: adaptive-task-routing,
task-context-router, and research-model-router. It suggests context, model and reasoning
for substantial work; both routers default to ask. The Codex compatibility manifest includes
a `UserPromptSubmit` reminder that asks the host to present the requested analysis or plan first,
then invoke the coordinator before any qualifying next phase begins. For an execution request,
the host presents an actionable plan before the gate.

The root plugin.json targets Agent Plugins 1.0.0. OpenAI presentation is under
extensions.com.openai. The generated .codex-plugin/plugin.json is the Codex compatibility
fallback, with the same identity, version and presentation. The hook prints fixed text only;
it does not inspect the prompt or run routing logic. Codex may require one-time hook review.
There is no MCP or app connection. An optional Python 3.10+ read-only metadata helper lives
inside the model Skill; it runs only on demand, never on installation or Skill loading.

The hook belongs to the Codex compatibility manifest. ChatGPT web, desktop, mobile, or
Chrome surfaces that consume only the portable manifest do not execute this local hook;
automatic selection there remains description-based and cannot be guaranteed by this ZIP.

## Model discovery

Follow the [OpenAI host guide](shared/hosts/openai.md). Task capability needs are
reported even when the current pair is unknown. The helper reads a scoped CLI catalog,
disk defaults and optional thread metadata; it does not prove App current settings,
make inference calls or switch models. ChatGPT web/desktop/mobile and Codex App/CLI
need separate acceptance records in the [surface matrix](tests/surface-matrix.json).

## Install and test locally

Extract the OpenAI ZIP into a directory named adaptive-task-routing. The manifest
and skills/ must be directly inside that directory. Keep shared/ beside skills/;
copying individual Skill directories loses shared references.

Codex CLI 0.154.0 installs using a configured marketplace. Ask the built-in
plugin-creator to register this extracted folder in a local marketplace. Once its
actual marketplace name is confirmed, run
`codex plugin add adaptive-task-routing@YOUR-CONFIRMED-MARKETPLACE`.
For a non-default marketplace root, register it first with
`codex plugin marketplace add /absolute/path/to/marketplace-root`.

For desktop testing, use the built-in plugin-creator to register the extracted folder
in a local marketplace, install from the local source in Plugins Directory, and start
a new task. A plugin ZIP is not a marketplace root. This release provides three plugin
archives; it does not provide a fourth marketplace archive. Local marketplace installation
does not publish to your workspace or the public directory.

Check that all three Skill names appear in the new task's inventory and review/enable the
plugin hook when Codex asks. Submit a substantial plan-only task without naming the Skill, then
confirm the useful plan appears first, followed by the plain `Adaptive Task Routing`
divider and routing note, and default `ask` ends the turn there.
Submit a separate execution request and confirm retain/nonblocking defer may continue authorized work in `ask`, while proposed changes require confirmation. Also
test explicit selection. Current conversation
settings or user-only controls must never be claimed to have changed automatically.

## Contents and testing

- [Architecture](docs/architecture.md)
- [Traditional Chinese architecture](docs/architecture.zh-TW.md)
- [Full example](docs/full-example.md)
- [Behavioral cases and platform matrix](tests/behavioral-cases.md)
- [Shared defaults](shared/defaults.yaml)
- [Shared runtime policy](shared/runtime-routing-policy.md)
- [Changelog](CHANGELOG.md)

Version is read from plugin.json. No personal data collection, network service or credential
store is bundled; host/user-managed settings may hold preferences and capability hints.
Public publisher identity and policy URLs still need the owner's final submission metadata.

## Public submission

Use OpenAI Platform's Plugins portal, Create plugin → Skills only. Upload this OpenAI
bundle, complete the verified developer identity, listing/logo/public policy and support URLs,
starter prompts, five positive and three negative cases, availability and attestations.
Run the matrix in the installed hosts before requesting review. Review and publishing
are separate external actions performed by the owner.

See the official [packaging guide](https://developers.openai.com/plugins/build/plugins)
and [submission guide](https://developers.openai.com/plugins/deploy/submission).
