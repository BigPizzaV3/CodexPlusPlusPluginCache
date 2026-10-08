import ast
import json
from pathlib import Path

PLUGIN_REPO_ROOT = Path(__file__).resolve().parents[3]
MONOREPO_ROOT = Path(__file__).resolve().parents[5]
PLUGIN_ROOT = PLUGIN_REPO_ROOT / "plugins" / "onenote"
ONENOTE_CONNECTOR_ID = "connector_6a6917bfa0d8819082c3a0425e82cade"
ONENOTE_CONNECTOR_ROOT = (
    MONOREPO_ROOT
    / "lib"
    / "applied"
    / "connectors"
    / "connectors_impl"
    / "connectors_impl"
    / "microsoft_onenote"
)
ONENOTE_CONNECTOR_SOURCES = (
    ONENOTE_CONNECTOR_ROOT / "onenote.py",
    ONENOTE_CONNECTOR_ROOT / "onenote_extended.py",
)
PLATFORM_CONNECTOR_CONTRACT = (
    MONOREPO_ROOT
    / "lib"
    / "applied"
    / "connectors"
    / "connectors_client"
    / "connectors_client"
    / "platform_connector_slug_to_id.contract.json"
)


DOCUMENTED_ACTIONS = {
    "add_page_resources",
    "append_to_page",
    "append_to_shared_page",
    "copy_page_to_section",
    "create_notebook",
    "create_page",
    "create_section",
    "create_section_group",
    "delete_page",
    "export_page_as_markdown",
    "fetch_page",
    "fetch_page_resource",
    "fetch_shared_page",
    "find_page_text",
    "get_operation",
    "get_page_tables",
    "get_page_text",
    "list_notebooks",
    "list_pages",
    "list_section_groups",
    "list_sections",
    "list_shared_notebooks",
    "list_shared_pages",
    "list_shared_section_groups",
    "list_shared_sections",
    "search_pages_by_text",
    "search_pages_by_title",
    "update_page",
    "update_shared_page",
}


def _action_names(source_path: Path) -> set[str]:
    tree = ast.parse(source_path.read_text(), filename=str(source_path))
    return {
        node.name
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef)
        and any(
            isinstance(decorator, ast.Call)
            and isinstance(decorator.func, ast.Name)
            and decorator.func.id == "action"
            for decorator in node.decorator_list
        )
    }


def test_onenote_plugin_manifest_and_skill_paths_exist() -> None:
    manifest = json.loads((PLUGIN_ROOT / ".codex-plugin" / "plugin.json").read_text())
    app_config = json.loads((PLUGIN_ROOT / ".app.json").read_text())
    platform_connector_ids = json.loads(PLATFORM_CONNECTOR_CONTRACT.read_text())

    assert manifest["name"] == "onenote"
    assert manifest["version"] == "0.1.4"
    assert manifest["interface"]["displayName"] == "OneNote (Beta)"
    assert manifest["skills"] == "./skills/"
    assert manifest["apps"] == "./.app.json"
    assert (PLUGIN_ROOT / "skills" / "onenote" / "SKILL.md").is_file()
    assert (PLUGIN_ROOT / "skills" / "export-onenote-to-markdown" / "SKILL.md").is_file()
    assert (
        PLUGIN_ROOT / "skills" / "export-onenote-to-markdown" / "agents" / "openai.yaml"
    ).is_file()
    assert (PLUGIN_ROOT / "assets" / "onenote.svg").is_file()
    assert (PLUGIN_ROOT / "assets" / "onenote-small.svg").is_file()
    assert app_config["apps"]["onenote"]["id"] == ONENOTE_CONNECTOR_ID
    assert platform_connector_ids["shared_slug_to_id"]["onenote_connector"] == ONENOTE_CONNECTOR_ID


def test_onenote_skill_documents_live_connector_actions() -> None:
    skill = (PLUGIN_ROOT / "skills" / "onenote" / "SKILL.md").read_text()
    connector_actions = set().union(
        *(_action_names(source_path) for source_path in ONENOTE_CONNECTOR_SOURCES)
    )

    assert DOCUMENTED_ACTIONS <= connector_actions
    for action_name in DOCUMENTED_ACTIONS:
        assert f"`{action_name}`" in skill


def test_onenote_plugin_is_registered_in_marketplace() -> None:
    marketplace = json.loads((PLUGIN_REPO_ROOT / "marketplace.json").read_text())
    entry = next(plugin for plugin in marketplace["plugins"] if plugin["name"] == "onenote")

    assert entry["source"]["path"] == "./plugins/onenote"
    assert entry["policy"]["installation"] == "AVAILABLE"
    assert entry["policy"]["authentication"] == "ON_INSTALL"
    assert entry["category"] == "Productivity"
