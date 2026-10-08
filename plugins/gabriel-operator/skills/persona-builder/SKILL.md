---
name: persona-builder
description: Interview the user and author a local Gabriel AI Persona draft covering page copy, list schema, pipeline stages, optional team-agent graph, and optional review-only workflow. Use when the user wants to design a new persona in files they control. Produces local drafts only and does not publish, provision, authenticate, or call remote services.
---

# Persona Builder

Design one Gabriel AI Persona as local draft files for human review.

This public skill covers the same draft files as `digital-twin-page`,
`list-builder`, `pipeline-builder`, and `team-agents`. It does not create live
Gabriel resources. Live create, git bind, and publish stay in Gabriel Operator
after the user reviews these files.

## Public authoring boundary

- Work only in the repository the user explicitly selects.
- Write local draft files only. Do not commit, push, publish, deploy, or run.
- Do not request, infer, copy, or store passwords, API keys, access tokens, cookies, or session data.
- Do not call remote APIs, open Gabriel Operator in a browser, or sync live records.
- Do not add real personal, confidential, financial, or authentication data.
- Use placeholder ids such as `page_example`. Do not invent production database ids.
- If the user asks to provision, publish, or authenticate, refuse and point them to Gabriel Operator.

## Interview

Collect, propose, confirm, then write files. Do not dump empty JSON and stop.

1. Ask what the persona does if the user did not already describe it.
2. Propose a title, short description, visibility (`private` default), list columns, pipeline stages, and whether a team-agent graph or a review-only workflow is needed.
3. Confirm the proposal.
4. Write the files below.
5. Summarize the files changed and note that live create/publish is a separate user action.

## Canonical files

```text
assets/chat-config.json
assets/list.json
assets/pipeline.json
assets/team-agent.json
assets/task-orchestration.json
assets/workflow.json
```

Write `chat-config.json`, `list.json`, and `pipeline.json` for every new persona.
Write team-agent and workflow files only when the confirmed proposal includes them.
Preserve unknown fields and stable ids when a file already exists.

## Page copy (`assets/chat-config.json`)

Supported fields only: `pageProfile.title`, `pageProfile.description`,
`pageProfile.longDescription`, `pageProfile.profilePicture`,
`pageProfile.bannerImage`, `pageProfile.bannerType`, `pageProfile.tags`,
`pageProfile.category`, `pageProfile.subcategory`, `publishedConfig.name`,
`publishedConfig.firstMessage`, `publishedConfig.systemPrompt`.

Keep conversational instructions clear and non-deceptive. Do not claim tools,
connectors, or live data this draft cannot provide.

```json
{
  "schemaVersion": 1,
  "pageId": "page_example",
  "publishedConfig": {
    "name": "Assistant",
    "firstMessage": "How can I help?",
    "systemPrompt": "Answer using the material supplied by the user."
  },
  "pageProfile": {
    "title": "Assistant",
    "description": "A helpful digital twin",
    "tags": []
  },
  "updatedAt": 0
}
```

## List schema (`assets/list.json`)

Edit schema only. Do not import or write live records. Column types: `text`,
`number`, `boolean`, `date`, `select`. Use `options` only on `select` columns.

Additional lists, if requested, go in `assets/lists/<slug>.json` with the same shape.

```json
{
  "schemaVersion": 1,
  "listId": "list_example",
  "list": {
    "id": "list_example",
    "name": "Example List",
    "description": "Review-only list schema",
    "collectionId": "collection_example",
    "columns": [
      {
        "key": "title",
        "label": "Title",
        "type": "text",
        "required": true
      }
    ]
  },
  "commitMessage": "Draft list schema"
}
```

## Pipeline (`assets/pipeline.json`)

One pipeline is one state-machine draft. Stages are metadata. Transitions are
allowed moves. Do not run the machine or modify live records.

```json
{
  "schemaVersion": 1,
  "pageId": "page_example",
  "pipelineId": "pipe_example",
  "pipeline": {
    "id": "pipe_example",
    "pageId": "page_example",
    "name": "Example Pipeline",
    "collectionId": "collection_example",
    "columns": [
      {
        "id": "col_title",
        "key": "title",
        "label": "Title",
        "type": "text",
        "required": true,
        "order": 1
      }
    ],
    "stages": [
      {
        "id": "stage_new",
        "name": "New",
        "type": "start",
        "description": "Initial stage"
      },
      {
        "id": "stage_done",
        "name": "Done",
        "type": "end",
        "description": "Completed stage"
      }
    ],
    "transitions": [
      {
        "id": "tr_start_to_done",
        "name": "Complete",
        "fromStageId": "stage_new",
        "toStageId": "stage_done",
        "trigger": "manual"
      }
    ]
  },
  "taskIds": [],
  "commitMessage": "Draft pipeline definition"
}
```

## Team agent (optional)

Edit `assets/team-agent.json` and `assets/task-orchestration.json` only.
Use declarative local nodes and edges. Do not add browser automation, desktop
control, shell execution, credentials, or live connector secrets.

```json
{
  "appId": "app_example",
  "endpointId": "endpoint_example",
  "endpoint": {
    "id": "endpoint_example",
    "slug": "example-endpoint",
    "name": "Example Endpoint",
    "workspace": {
      "nodes": [
        {
          "id": "node_start",
          "type": "start",
          "label": "Start",
          "config": {
            "inputSchema": {
              "type": "object",
              "properties": {}
            }
          }
        },
        {
          "id": "node_output",
          "type": "output",
          "label": "Output",
          "config": {}
        }
      ],
      "edges": [
        {
          "id": "edge_start_output",
          "source": "node_start",
          "target": "node_output"
        }
      ]
    }
  },
  "commitMessage": "Draft team-agent endpoint"
}
```

```json
{
  "schemaVersion": 1,
  "mappings": [],
  "commitMessage": "Draft task orchestration"
}
```

## Workflow (optional)

Edit `assets/workflow.json` only. Supported review-only steps: `navigate`
(with `disableBrowser: true` and empty `url`), `wait`, `llm`, `confirmation`,
`api_output`. If the user needs any other action, describe it in the handoff
instead of adding it.

Keep every step field at the step root. Give each step a unique `stepId` and
sequential `step_number`.

## Finish

Validate JSON syntax, unique ids, and transition/edge references locally.
Report the files changed. Tell the user these are drafts until they create and
publish the persona in Gabriel Operator.

## Live create in Gabriel Operator

This review pack does not collect tokens or call Gateway. For a live persona:

1. Sign up at https://gabrieloperator.com/signup
2. Open **Workspace → Dashboard** and copy a Gabi token from the **Gateway API key** pill
3. Connect GitHub on the same account
4. Connect that token to ChatGPT/Codex MCP (`Authorization: Bearer gabi_…`) or `GABRIEL_TOKEN`
5. Use the live Persona Builder pack, not this local-draft skill

Do not request, store, or use the token inside this skill.

## UI fallback for live configure

If the user needs a live setting this pack cannot draft in files (Composio keys,
Arcade/Nango/Scalekit, GitHub connect, voice BYOK), send them to the UI after a
real page exists. Do not collect those secrets here.

Personal workspace (same destination as **Configure** on the persona page):

https://gabrieloperator.com/workspace/edit-persona/{pageId}

- Composio keys: `?tab=simulated-world` then expand **MCP connectors**
- GitHub: https://gabrieloperator.com/workspace/developer-settings

Give the full URL. Name the tab and the control.
