const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { dispatch } = require("../runtime/orchestrator");
const manifest = require("../runtime/tool-manifest.json");

const root = path.join(__dirname, "..");
const requiredDemoIds = [
  "dangerous_prompt_stops_production",
  "operator_board_briefing",
  "consensus_prevents_wrong_index",
  "cio_cto_roi_narrative",
];

test("killer demos are curated sales-ready scenarios", () => {
  const demos = JSON.parse(fs.readFileSync(path.join(root, "demos", "killer-demos.json"), "utf8"));

  assert.equal(demos.positioning, "Autonomous Database Operations without autonomous production risk.");
  assert.deepEqual(demos.demos.map((demo) => demo.id), requiredDemoIds);

  for (const demo of demos.demos) {
    assert.ok(demo.title.length > 10, `${demo.id} missing title`);
    assert.ok(demo.story.length > 40, `${demo.id} missing story`);
    assert.ok(demo.whyItMatters.length > 40, `${demo.id} missing buyer value`);
    assert.ok(demo.talkTrack.length >= 3, `${demo.id} missing talk track`);
    assert.ok(demo.command.includes(`node runtime/runTool.js ${demo.tool}`), `${demo.id} missing runnable command`);
    assert.ok(manifest.tools.includes(demo.tool), `${demo.tool} missing from manifest`);
    assert.equal(demo.mode, "closed_loop_dry_run");
  }
});

test("killer demos execute and produce their expected decisions", async () => {
  const demos = JSON.parse(fs.readFileSync(path.join(root, "demos", "killer-demos.json"), "utf8"));

  for (const demo of demos.demos) {
    const result = await dispatch(demo.tool, demo.input);
    assert.equal(result.usp, demo.tool, `${demo.id} returned unexpected usp`);
    if (demo.expectedDecision) {
      assert.equal(result.decision, demo.expectedDecision, `${demo.id} returned unexpected decision`);
    }
    for (const field of demo.expectedFields) {
      assert.ok(result[field], `${demo.id} missing expected field ${field}`);
    }
  }
});

test("killer demo markdown contains the four headline flows", () => {
  const markdown = fs.readFileSync(path.join(root, "demos", "KILLER_DEMOS.md"), "utf8");

  for (const id of requiredDemoIds) {
    assert.ok(markdown.includes(id), `${id} missing from markdown`);
  }
  assert.ok(markdown.includes("AI Detects a Dangerous Prompt and Stops Production Risk"));
  assert.ok(markdown.includes("AI Operator Builds a Board-Level Briefing"));
  assert.ok(markdown.includes("Cross-Agent Consensus Prevents the Wrong Index"));
  assert.ok(markdown.includes("ROI Narrative for the CIO/CTO"));
});
